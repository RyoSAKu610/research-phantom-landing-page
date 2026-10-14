import hashlib
import tempfile
import unittest
import warnings
import zipfile
from pathlib import Path

from package_local_tts import MODELS, create, files_in_snapshot, restore, validate


class BundleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.cache_root = self.root / "hub"
        self.archive = self.root / "models.zip"
        for kind, model_id in MODELS.items():
            cache = self.cache_root / ("models--" + model_id.replace("/", "--"))
            snapshot = cache / "snapshots" / ("a" * 40)
            blobs = cache / "blobs"
            snapshot.mkdir(parents=True)
            blobs.mkdir()
            # Fixture exercises all model artifacts and blob symlinks without huge weights.
            for index, relative in enumerate(sorted({"config.json", "generation_config.json", "merges.txt", "model.safetensors",
                                                      "model.safetensors.index.json", "preprocessor_config.json", "tokenizer_config.json", "vocab.json",
                                                      "speech_tokenizer/config.json", "speech_tokenizer/configuration.json",
                                                      "speech_tokenizer/model.safetensors", "speech_tokenizer/preprocessor_config.json"})):
                target = snapshot / relative
                target.parent.mkdir(exist_ok=True)
                blob = blobs / f"{kind}-{index}"
                blob.write_bytes(f"{kind}:{relative}".encode())
                target.symlink_to(blob)

    def test_create_restore_hashes_and_privacy(self):
        private = self.root / "reference.mp3"
        private.write_bytes(b"private recording")
        create(self.archive, self.cache_root)
        manifest = validate(self.archive)
        restored = self.root / "restored"
        restore(self.archive, restored)
        for name, record in manifest["files"].items():
            item = restored / name
            self.assertFalse(item.is_symlink())
            self.assertEqual(hashlib.sha256(item.read_bytes()).hexdigest(), record["sha256"])
        with zipfile.ZipFile(self.archive) as archive:
            self.assertEqual(set(archive.namelist()), set(manifest["files"]) | {"manifest.json"})
            self.assertNotIn(private.read_bytes(), self.archive.read_bytes())

    def test_reject_escaping_symlink_and_private_file(self):
        cache = self.cache_root / ("models--" + MODELS["Base"].replace("/", "--"))
        snapshot = cache / "snapshots" / ("a" * 40)
        (snapshot / "config.json").unlink()
        (self.root / "reference.mp3").write_bytes(b"private")
        (snapshot / "config.json").symlink_to(self.root / "reference.mp3")
        with self.assertRaisesRegex(ValueError, "escapes"):
            files_in_snapshot(snapshot, cache)
        (snapshot / "config.json").unlink()
        (snapshot / "config.json").write_text("safe")
        (snapshot / "reference.mp3").write_bytes(b"private")
        with self.assertRaisesRegex(ValueError, "Unexpected"):
            create(self.archive, self.cache_root)
        self.assertFalse(self.archive.exists())

    def test_reject_traversal_and_tampering_before_restore(self):
        create(self.archive, self.cache_root)
        with zipfile.ZipFile(self.archive, "a") as archive:
            archive.writestr("../escape.txt", "bad")
        with self.assertRaisesRegex(ValueError, "Invalid|Unsafe"):
            restore(self.archive, self.root / "restored")
        self.assertFalse((self.root / "restored").exists())
        self.assertFalse((self.root / "escape.txt").exists())

    def test_detect_corrupt_content(self):
        create(self.archive, self.cache_root)
        with zipfile.ZipFile(self.archive) as archive:
            members = {name: archive.read(name) for name in archive.namelist()}
        member = next(name for name in members if name.endswith("config.json"))
        members[member] = b"corrupted"
        with zipfile.ZipFile(self.archive, "w") as archive:
            for name, content in members.items():
                archive.writestr(name, content)
        with self.assertRaisesRegex(ValueError, "Checksum mismatch"):
            validate(self.archive)

    def test_duplicate_and_symlink_members_are_refused(self):
        create(self.archive, self.cache_root)
        with zipfile.ZipFile(self.archive, "a") as archive:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", UserWarning)
                archive.writestr("manifest.json", "{}")
        with self.assertRaisesRegex(ValueError, "duplicate"):
            validate(self.archive)
        self.archive.unlink()
        create(self.archive, self.cache_root)
        with zipfile.ZipFile(self.archive) as archive:
            files = [(entry.filename, archive.read(entry.filename)) for entry in archive.infolist()]
        with zipfile.ZipFile(self.archive, "w") as archive:
            for name, content in files[:-1]:
                archive.writestr(name, content)
            link = zipfile.ZipInfo("models/Base/link")
            link.create_system = 3
            link.external_attr = 0o120777 << 16
            archive.writestr(link, "../../private")
            archive.writestr(*files[-1])
        with self.assertRaisesRegex(ValueError, "Non-regular"):
            validate(self.archive)


if __name__ == "__main__":
    unittest.main()
