import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import os

from import_ondoku_guides import FILES, ROOT, import_tracks


class OndokuImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = tempfile.TemporaryDirectory()
        cls.source = Path(cls.fixture.name) / "source"
        cls.source.mkdir()
        script_hash = hashlib.sha256((ROOT / "src/audio/narration.json").read_bytes()).hexdigest()
        (cls.source / "ondoku-export.json").write_text(json.dumps({"provider": "ondoku3-beta", "script_sha256": script_hash}))
        for index, name in enumerate(FILES):
            clip = cls.source / name
            clip.parent.mkdir(exist_ok=True)
            subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
                            f"sine=frequency={300 + index * 11}:duration=0.2", "-codec:a", "libmp3lame", "-q:a", "6", str(clip)], check=True)

    @classmethod
    def tearDownClass(cls):
        cls.fixture.cleanup()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.copy = Path(self.temp.name) / "export"
        shutil.copytree(self.source, self.copy)
        self.destination = Path(self.temp.name) / "imported"

    def test_complete_export(self):
        imported = import_tracks(self.copy, self.destination)
        manifest = json.loads((imported / "manifest.json").read_text())
        self.assertEqual([entry["file"] for entry in manifest["tracks"]], list(FILES))
        self.assertEqual(manifest["provider"], "ondoku3-beta")

    def test_local_export_has_local_provenance(self):
        receipt = self.copy / "ondoku-export.json"
        metadata = json.loads(receipt.read_text())
        metadata["provider"] = "local-qwen3-tts"
        receipt.rename(self.copy / "local-export.json")
        (self.copy / "local-export.json").write_text(json.dumps(metadata))
        imported = import_tracks(self.copy, self.destination, provider="local-qwen3-tts")
        self.assertEqual(json.loads((imported / "manifest.json").read_text())["provider"], "local-qwen3-tts")

    def test_embedded_mode_and_integrity(self):
        imported = import_tracks(self.copy, self.destination)
        isolated = Path(self.temp.name) / "isolated"
        (isolated / "scripts").mkdir(parents=True)
        (isolated / "src/audio").mkdir(parents=True)
        shutil.copyfile(ROOT / "scripts/ondoku-audio.mjs", isolated / "scripts/ondoku-audio.mjs")
        shutil.copyfile(ROOT / "src/audio/narration.json", isolated / "src/audio/narration.json")
        code = "import {importedTracks,narrationHash} from './scripts/ondoku-audio.mjs'; const result=await importedTracks(await narrationHash()); console.log(result?.tracks?.phantom?.length ?? 0, result?.tracks?.meiji?.[6]?.startsWith('data:audio/mpeg;base64,'));"
        env = dict(os.environ, FFPROBE=shutil.which("ffprobe") or "/opt/homebrew/bin/ffprobe")
        def check():
            return subprocess.run([shutil.which("node") or "/opt/homebrew/bin/node", "--input-type=module", "-e", code], cwd=isolated, env=env, capture_output=True, text=True)
        result = check()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "0 undefined")
        shutil.copytree(imported, isolated / "src/audio/ondoku")
        result = check()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "7 true")
        (isolated / "src/audio/ondoku" / FILES[0]).write_bytes(b"tampered")
        result = check()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("integrity failed", result.stderr)

    def test_local_mode_is_preferred_to_ondoku(self):
        import_tracks(self.copy, self.destination)
        receipt = self.copy / "ondoku-export.json"
        metadata = json.loads(receipt.read_text())
        metadata["provider"] = "local-qwen3-tts"
        receipt.rename(self.copy / "local-export.json")
        (self.copy / "local-export.json").write_text(json.dumps(metadata))
        isolated = Path(self.temp.name) / "isolated"
        (isolated / "scripts").mkdir(parents=True)
        (isolated / "src/audio").mkdir(parents=True)
        shutil.copyfile(ROOT / "scripts/ondoku-audio.mjs", isolated / "scripts/ondoku-audio.mjs")
        shutil.copyfile(ROOT / "src/audio/narration.json", isolated / "src/audio/narration.json")
        shutil.copytree(self.destination, isolated / "src/audio/ondoku")
        import_tracks(self.copy, isolated / "src/audio/local-mp3", provider="local-qwen3-tts")
        code = "import {importedTracks,narrationHash} from './scripts/ondoku-audio.mjs'; console.log((await importedTracks(await narrationHash())).manifest.provider)"
        env = dict(os.environ, FFPROBE=shutil.which("ffprobe") or "/opt/homebrew/bin/ffprobe")
        result = subprocess.run([shutil.which("node") or "/opt/homebrew/bin/node", "--input-type=module", "-e", code], cwd=isolated, env=env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "local-qwen3-tts")

    def test_partial_export_keeps_destination_absent(self):
        (self.copy / FILES[-1]).unlink()
        with self.assertRaises(ValueError):
            import_tracks(self.copy, self.destination)
        self.assertFalse(self.destination.exists())

    def test_fake_mp3_keeps_destination_absent(self):
        (self.copy / FILES[0]).write_bytes(b"not MPEG Layer III")
        with self.assertRaises((ValueError, subprocess.CalledProcessError)):
            import_tracks(self.copy, self.destination)
        self.assertFalse(self.destination.exists())

    def test_duplicate_clips_rejected(self):
        shutil.copyfile(self.copy / FILES[0], self.copy / FILES[1])
        with self.assertRaisesRegex(ValueError, "duplicate"):
            import_tracks(self.copy, self.destination)

    def test_symlink_rejected(self):
        (self.copy / FILES[0]).unlink()
        (self.copy / FILES[0]).symlink_to(self.copy / FILES[1])
        with self.assertRaises(ValueError):
            import_tracks(self.copy, self.destination)

    def test_wrong_script_hash_rejected(self):
        (self.copy / "ondoku-export.json").write_text(json.dumps({"provider": "ondoku3-beta", "script_sha256": "0" * 64}))
        with self.assertRaisesRegex(ValueError, "attestation"):
            import_tracks(self.copy, self.destination)


if __name__ == "__main__":
    unittest.main()
