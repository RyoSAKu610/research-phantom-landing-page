"""Manifest checks that do not rebuild or overwrite the release ZIPs."""

import base64
import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from zipfile import ZipFile

import package_release as release


SERVER_PATHS = {"server/research.mjs", "server/research.d.mts", "server/start.mjs"}
AUDIO_PATHS = {
    *(f"src/audio/offline/{scene:02d}-local-qwen.m4a" for scene in range(1, 8)),
    *(f"src/audio/offline-reference/{scene:02d}-local-reference.m4a" for scene in range(1, 8)),
    *(
        f"src/audio/guides/{guide}/{scene:02d}-guide.m4a"
        for guide in ("phantom", "kitsune", "owl", "meiji")
        for scene in range(1, 8)
    ),
}
LOCAL_MP3_PATHS = {
    f"src/audio/local-mp3/{guide}/{scene:02d}-guide.mp3"
    for guide in ("phantom", "kitsune", "owl", "meiji")
    for scene in range(1, 8)
}
GUIDES = ("phantom", "kitsune", "owl", "meiji")


def complete_local_mp3_fixture(root: Path) -> dict:
    narration = root / "src/audio/narration.json"
    narration.parent.mkdir(parents=True, exist_ok=True)
    narration.write_text("fixture narration")
    tracks = []
    for name in sorted(LOCAL_MP3_PATHS):
        file = root / name
        file.parent.mkdir(parents=True, exist_ok=True)
        data = f"ID3{name}".encode()
        file.write_bytes(data)
        tracks.append({
            "file": name.removeprefix("src/audio/local-mp3/"),
            "sha256": hashlib.sha256(data).hexdigest(),
            "bytes": len(data),
            "duration_seconds": 1.0,
        })
    return {
        "provider": "local-qwen3-tts",
        "script_sha256": hashlib.sha256(narration.read_bytes()).hexdigest(),
        "tracks": tracks,
    }


def built_audio_fixture(root: Path, *, local_mp3: bool) -> tuple[dict, dict]:
    if local_mp3:
        manifest = complete_local_mp3_fixture(root)
        (root / "src/audio/local-mp3/manifest.json").write_text(json.dumps(manifest))
    else:
        narration = root / "src/audio/narration.json"
        narration.parent.mkdir(parents=True)
        narration.write_text("fixture narration")
    digest = hashlib.sha256((root / "src/audio/narration.json").read_bytes()).hexdigest()
    for name in ("src/audio/offline-reference/voice.json", "src/audio/guides/voice.json"):
        file = root / name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(json.dumps({"script_sha256": digest}))

    provider = "local-qwen3-tts" if local_mp3 else "mixed-offline-guide-voices"
    metadata = {
        "provider": provider,
        "script_sha256": digest,
        "guides": {guide: {"provider": provider if local_mp3 else "ondoku3-beta" if guide == "meiji" else "local"} for guide in GUIDES},
    }
    voices = {}
    for guide in GUIDES:
        clips = []
        for scene in range(1, 8):
            extension = "mp3" if local_mp3 else "m4a"
            folder = "local-mp3" if local_mp3 else "guides"
            file = root / f"src/audio/{folder}/{guide}/{scene:02d}-guide.{extension}"
            if not local_mp3:
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(f"M4A/{guide}/{scene}".encode())
            mime = "audio/mpeg" if local_mp3 else "audio/mp4"
            clips.append(f"data:{mime};base64,{base64.b64encode(file.read_bytes()).decode()}")
        voices[guide] = clips
    write_built_html(root, metadata, voices)
    return metadata, voices


def write_built_html(root: Path, metadata: dict, voices: dict) -> None:
    html = (
        '<script id="embedded-guide-audio" type="application/json">'
        + json.dumps(voices) + "</script>\n"
        '<script id="embedded-guide-meta" type="application/json">'
        + json.dumps(metadata) + "</script>"
    )
    for name in ("dist/index.html", "standalone-offline.html"):
        file = root / name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(html)


class PublicPackageTests(unittest.TestCase):
    def test_fixture_zip_contains_offline_files_but_no_local_secrets(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            root = base / "project"
            root.mkdir()
            allowed = {
                "dist/index.html", "standalone-offline.html", "index.html",
                "package.json", "package-lock.json", "tsconfig.json", "vite.config.ts",
                "README.md", ".gitignore", "ONLINE_RESEARCH_SETUP.md",
                "LOCAL_TTS_BUNDLE.md", "server.mjs",
                "src/research/papers.ts", "src/research/SOURCES.md",
                "src/payments/agent-payments.ts", "scripts/package_release.py",
                "scripts/voice-requirements.txt", "src/audio/narration.json",
                "src/audio/offline-reference/voice.json",
                "src/audio/local-mp3/manifest.json",
            } | SERVER_PATHS | AUDIO_PATHS | LOCAL_MP3_PATHS
            denied = {
                ".env", ".env.local", ".npmrc", ".git/config",
                "research-phantom-local-tts-models-private.zip",
                "server/.env", "server/.env.local", "server/.npmrc",
                "server/credentials.json", "server/private-key.mjs",
                "server/config.local.mjs", "server/notes.tmp.mjs",
                "server/apiKey.json", "server/data.json", "server/extra.mjs",
                "server/nested/start.mjs", "server/research.test.mjs",
                ".local-voice/reference.mp3", ".venv-tts/model.bin",
                "node_modules/package/index.js", "dist/assets/main.js",
                "src/.env.production", "src/research/.env.local",
                "scripts/.npmrc", "src/research/secret-key.json",
                "src/research/credentials.json", "src/research/tokens.json",
                "src/research/private.pem", "src/research/keys.json",
                "src/audio/previews/01-local-reference.m4a",
                "src/audio/reference.m4a", "src/audio/reference.txt",
                "src/audio/user-recording.m4a", "src/assets/user-recording.m4a",
                "src/audio/offline/08-local-qwen.m4a",
                "src/audio/offline/01-local-qwen-preview.m4a",
                "src/audio/offline-reference/08-local-reference.m4a",
                "src/audio/guides/unknown/01-guide.m4a",
                "src/audio/guides/owl/08-guide.m4a",
                "scripts/user-recording.m4a",
                "src/audio/user-recording.mp3", "scripts/user-recording.mp3",
                "src/audio/local-mp3/user-recording.mp3",
                "src/audio/local-mp3/phantom/08-guide.mp3",
                "src/audio/local-mp3/phantom/01-take.mp3",
                "src/audio/local-mp3/unknown/01-guide.mp3",
                "src/audio/local-mp3/phantom/01-guide.json",
                "src/audio/local-mp3/voice.json",
                "src/audio/local-mp3/extra.json",
                "src/audio/local-mp3/hf-cache/config.json",
                "src/audio/ondoku/manifest.json", "src/audio/ondoku/meiji/01-guide.mp3",
                "src/hf-cache/config.json", "src/models/weights.json",
                "src/research/temp-draft.ts", "src/research/workspace-copy.json",
                "src/research/config.local.ts", "src/__MACOSX/metadata.ts",
                "src/research/notes.tmp.js", "src/research/Thumbs.db",
                "src/research/.DS_Store", "src/research/._guide.png",
                "src/research/prod.log", "scripts/package_release.py.bak",
                "src/research/scene-previous-01.json",
            }
            for name in allowed | denied:
                file = root / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text(name)
            manifest = complete_local_mp3_fixture(root)
            (root / "src/audio/local-mp3/manifest.json").write_text(json.dumps(manifest))

            outside = base / "outside-secret.json"
            outside.write_text("private")
            (root / "src/research/linked.json").symlink_to(outside)
            self.assertFalse(release.is_public(root / "src/research/linked.json", root))
            self.assertFalse(release.is_public(root / "src/audio/local-mp3/phantom/01-guide.MP3", root))

            selected = release.public_files(root)
            self.assertEqual({file.relative_to(root).as_posix() for file in selected}, allowed)

            # This fixture-only ZIP verifies the offline note and manifest without
            # touching the real release artifacts or invoking main/build checks.
            archive_path = base / "fixture.zip"
            with patch.object(release, "ROOT", root), patch.object(release, "PREFIX", root.name):
                release.write_zip(archive_path, selected, offline_note=True)
            with ZipFile(archive_path) as archive:
                names = {name.removeprefix(f"{root.name}/") for name in archive.namelist()}
                self.assertEqual(names, allowed | {"OFFLINE_PACKAGE.txt"})
                note = archive.read(f"{root.name}/OFFLINE_PACKAGE.txt").decode()
                self.assertIn("public offline edition", note)
                self.assertIn("npm run start", note)
                self.assertIn("ONLINE_RESEARCH_SETUP.md", note)
                self.assertIn("locally with Qwen3-TTS", note.replace("\n", " "))
                self.assertIn("not Ondoku Beta recordings", note)
                self.assertIn("research-phantom-local-tts-models-private.zip is a private archive", note.replace("\n", " "))

    def test_real_manifest_keeps_offline_build_and_rebuild_inputs(self) -> None:
        names = {file.relative_to(release.ROOT).as_posix() for file in release.public_files()}
        self.assertTrue({
            "dist/index.html", "standalone-offline.html", "index.html",
            "package.json", "package-lock.json", "vite.config.ts", ".gitignore",
            "ONLINE_RESEARCH_SETUP.md", "LOCAL_TTS_BUNDLE.md", "server.mjs",
            "scripts/package_release.py", "scripts/local_voice.py",
            "src/research/papers.ts", "src/audio/narration.json",
            "src/audio/offline-reference/voice.json",
        } <= names)
        self.assertEqual({name for name in names if name.startswith("server/")}, SERVER_PATHS)
        self.assertEqual({name for name in names if name.lower().endswith(".m4a")}, AUDIO_PATHS)
        local_mp3 = {name for name in names if name.lower().endswith(".mp3")}
        self.assertIn(local_mp3, (set(), LOCAL_MP3_PATHS))
        self.assertEqual("src/audio/local-mp3/manifest.json" in names, bool(local_mp3))
        ignore_rules = (release.ROOT / ".gitignore").read_text().splitlines()
        self.assertIn(".env*", ignore_rules)
        self.assertIn(".npmrc", ignore_rules)

    def test_allowlisted_server_symlink_is_denied(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            root = base / "project"
            (root / "server").mkdir(parents=True)
            outside = base / "private.mjs"
            outside.write_text("private")
            link = root / "server/start.mjs"
            link.symlink_to(outside)
            self.assertFalse(release.is_public(link, root))
            self.assertNotIn(link, release.public_files(root))

    def test_partial_local_mp3_set_or_manifest_refuses_packaging(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first = root / "src/audio/local-mp3/phantom/01-guide.mp3"
            first.parent.mkdir(parents=True)
            first.write_bytes(b"ID3guide")
            with self.assertRaisesRegex(ValueError, "Incomplete local guide MP3 set \\(1/28\\)"):
                release.public_files(root)

            first.unlink()
            manifest = root / "src/audio/local-mp3/manifest.json"
            manifest.write_text("{}")
            with self.assertRaisesRegex(ValueError, "Incomplete local guide MP3 set \\(0/28\\)"):
                release.public_files(root)

    def test_full_local_mp3_set_requires_valid_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            correct = complete_local_mp3_fixture(root)
            path = root / "src/audio/local-mp3/manifest.json"
            with self.assertRaisesRegex(ValueError, "manifest.json and all 28 required"):
                release.public_files(root)

            incorrect = {
                "wrong provider": ({**correct, "provider": "ondoku3-beta"}, "provider or script hash"),
                "old narration": ({**correct, "script_sha256": "0" * 64}, "provider or script hash"),
                "missing track": ({**correct, "tracks": correct["tracks"][:-1]}, "exactly 28 tracks"),
                "wrong digest": ({**correct, "tracks": [{**correct["tracks"][0], "sha256": "0" * 64}, *correct["tracks"][1:]]}, "hash mismatch"),
                "extra field": ({**correct, "apiKey": "private"}, "manifest structure"),
            }
            for name, (payload, error) in incorrect.items():
                with self.subTest(name=name):
                    path.write_text(json.dumps(payload))
                    with self.assertRaisesRegex(ValueError, error):
                        release.public_files(root)

            path.write_text(json.dumps(correct))
            selected = {file.relative_to(root).as_posix() for file in release.public_files(root)}
            self.assertEqual(selected, {"src/audio/narration.json", "src/audio/local-mp3/manifest.json"} | LOCAL_MP3_PATHS)

    def test_empty_local_mp3_prevents_complete_set(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in LOCAL_MP3_PATHS:
                file = root / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(b"ID3guide")
            (root / "src/audio/local-mp3/phantom/01-guide.mp3").write_bytes(b"")
            with self.assertRaisesRegex(ValueError, "Incomplete local guide MP3 set \\(28/28\\)"):
                release.public_files(root)

    def test_public_packaging_accepts_local_mp3_and_legacy_m4a_builds(self) -> None:
        for local_mp3 in (True, False):
            with self.subTest(local_mp3=local_mp3), tempfile.TemporaryDirectory() as directory:
                base = Path(directory)
                root = base / "project"
                built_audio_fixture(root, local_mp3=local_mp3)
                destination = base / "fixture-public.zip"
                with patch.object(release, "ROOT", root), patch.object(release, "PREFIX", root.name), patch.object(release, "PUBLIC_ZIP", destination):
                    release.main(public_only=True)
                with ZipFile(destination) as archive:
                    names = {name.removeprefix(f"{root.name}/") for name in archive.namelist()}
                    self.assertEqual(LOCAL_MP3_PATHS <= names, local_mp3)
                    self.assertEqual("src/audio/local-mp3/manifest.json" in names, local_mp3)
                    self.assertIn("dist/index.html", names)
                    self.assertIn("standalone-offline.html", names)

    def test_local_mp3_build_rejects_stale_provider_mime_or_bytes_in_either_html(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            root = base / "project"
            correct_meta, correct_voices = built_audio_fixture(root, local_mp3=True)
            correct_html = (root / "dist/index.html").read_text()
            cases = {
                "provider": (lambda meta, voices: meta.update(provider="mixed-offline-guide-voices"), "provenance"),
                "guide provider": (lambda meta, voices: meta["guides"]["owl"].update(provider="ondoku3-beta"), "provenance"),
                "script hash": (lambda meta, voices: meta.update(script_sha256="0" * 64), "provenance"),
                "mime": (lambda meta, voices: voices["phantom"].__setitem__(0, voices["phantom"][0].replace("audio/mpeg", "audio/mp4")), "MIME"),
                "base64": (lambda meta, voices: voices["phantom"].__setitem__(0, "data:audio/mpeg;base64,@@invalid@@"), "invalid guide audio"),
                "bytes": (lambda meta, voices: voices["phantom"].__setitem__(0, "data:audio/mpeg;base64," + base64.b64encode(b"wrong clip").decode()), "differs from the source audio"),
            }
            for target in ("dist/index.html", "standalone-offline.html"):
                for name, (tamper, error) in cases.items():
                    with self.subTest(target=target, tamper=name):
                        metadata, voices = copy.deepcopy(correct_meta), copy.deepcopy(correct_voices)
                        tamper(metadata, voices)
                        write_built_html(root, metadata, voices)
                        (root / ("standalone-offline.html" if target == "dist/index.html" else "dist/index.html")).write_text(correct_html)
                        with patch.object(release, "ROOT", root), patch.object(release, "PUBLIC_ZIP", base / "must-not-exist.zip"):
                            with self.assertRaisesRegex(ValueError, error):
                                release.main(public_only=True)
                        self.assertFalse((base / "must-not-exist.zip").exists())

    def test_stale_legacy_build_rejected_when_local_mp3_manifest_exists(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            root = base / "project"
            built_audio_fixture(root, local_mp3=False)
            correct = complete_local_mp3_fixture(root)
            (root / "src/audio/local-mp3/manifest.json").write_text(json.dumps(correct))
            with patch.object(release, "ROOT", root), patch.object(release, "PUBLIC_ZIP", base / "must-not-exist.zip"):
                with self.assertRaisesRegex(ValueError, "provenance"):
                    release.main(public_only=True)
            self.assertFalse((base / "must-not-exist.zip").exists())

    def test_ondoku_import_is_not_silently_packaged_without_public_sources(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            root = base / "project"
            built_audio_fixture(root, local_mp3=False)
            manifest = root / "src/audio/ondoku/manifest.json"
            manifest.parent.mkdir(parents=True)
            manifest.write_text("{}")
            with patch.object(release, "ROOT", root), patch.object(release, "PUBLIC_ZIP", base / "must-not-exist.zip"):
                with self.assertRaisesRegex(ValueError, "Ondoku MP3 imports are not supported"):
                    release.main(public_only=True)
            self.assertFalse((base / "must-not-exist.zip").exists())


if __name__ == "__main__":
    unittest.main()
