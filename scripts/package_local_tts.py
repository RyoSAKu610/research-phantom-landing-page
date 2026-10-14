"""Create, verify, and safely restore a private, portable Qwen3-TTS model ZIP64 bundle."""

import argparse
import hashlib
import json
import os
import re
import stat
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

MODELS = {
    "Base": "mlx-community/Qwen3-TTS-12Hz-1.7B-Base-6bit",
    "CustomVoice": "mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-6bit",
}
DEFAULT_ARCHIVE = Path(__file__).resolve().parents[2] / "research-phantom-local-tts-models-private.zip"
MANIFEST = "manifest.json"
CHUNK = 1024 * 1024


def safe_name(name):
    path = PurePosixPath(name)
    if not name or "\\" in name or name.startswith("/") or any(p in ("", ".", "..") for p in name.split("/")) or path.as_posix() != name:
        raise ValueError(f"Unsafe archive path: {name}")
    return path


def sources(cache_root):
    for kind, model_id in MODELS.items():
        cache = cache_root / ("models--" + model_id.replace("/", "--"))
        snapshots = cache / "snapshots"
        commits = list(snapshots.iterdir()) if snapshots.is_dir() else []
        if len(commits) != 1 or not re.fullmatch(r"[a-f0-9]{40}", commits[0].name) or not commits[0].is_dir():
            raise ValueError(f"Expected one complete cached snapshot for {model_id} in {snapshots}")
        yield kind, model_id, cache, commits[0]


def files_in_snapshot(snapshot, cache):
    allowed = {"config.json", "generation_config.json", "merges.txt", "model.safetensors",
               "model.safetensors.index.json", "preprocessor_config.json", "tokenizer_config.json", "vocab.json",
               "speech_tokenizer/config.json", "speech_tokenizer/configuration.json",
               "speech_tokenizer/model.safetensors", "speech_tokenizer/preprocessor_config.json"}
    found = {}
    for directory, dirs, files in os.walk(snapshot, followlinks=False):
        if any((Path(directory) / d).is_symlink() for d in dirs):
            raise ValueError("Symlinked snapshot directory refused")
        for name in files:
            item = Path(directory) / name
            relative = item.relative_to(snapshot).as_posix()
            if relative not in allowed:
                raise ValueError(f"Unexpected snapshot file (possibly private): {relative}")
            target = item.resolve(strict=True)
            first_link = Path(os.path.abspath(item.parent / os.readlink(item))) if item.is_symlink() else item
            if not first_link.is_relative_to(cache / "blobs") and first_link != item:
                raise ValueError(f"Symlink escapes model cache: {item}")
            if not (target.is_relative_to((cache / "blobs").resolve()) or
                    target.is_relative_to((cache.parent / "blobs").resolve()) or
                    (not item.is_symlink() and target.is_relative_to(snapshot.resolve()))) or not target.is_file():
                raise ValueError(f"Symlink escapes model cache: {item}")
            found[relative] = target
    if set(found) != allowed:
        raise ValueError(f"Incomplete snapshot {snapshot}: missing {sorted(allowed - set(found))}")
    return found


def create(archive, cache_root):
    if archive.exists():
        raise FileExistsError(f"Archive already exists: {archive}")
    archive.parent.mkdir(parents=True, exist_ok=True)
    staging = None
    try:
        with tempfile.NamedTemporaryFile(prefix=".local-tts-", suffix=".zip", dir=archive.parent, delete=False) as temp:
            staging = Path(temp.name)
        manifest = {"format": "local-qwen3-tts-models-v1", "models": {}, "files": {}}
        with zipfile.ZipFile(staging, "w", allowZip64=True) as bundle:
            for kind, model_id, cache, snapshot in sources(cache_root):
                manifest["models"][kind] = {"model_id": model_id, "commit": snapshot.name, "path": f"models/{kind}"}
                for relative, source in sorted(files_in_snapshot(snapshot, cache).items()):
                    member = f"models/{kind}/{relative}"
                    digest = hashlib.sha256()
                    size = 0
                    info = zipfile.ZipInfo(member)
                    info.compress_type = zipfile.ZIP_STORED  # pre-compressed weights; avoid CPU/disk overhead
                    info.external_attr = 0o100644 << 16
                    with source.open("rb") as original, bundle.open(info, "w", force_zip64=True) as output:
                        for chunk in iter(lambda: original.read(CHUNK), b""):
                            output.write(chunk)
                            digest.update(chunk)
                            size += len(chunk)
                    manifest["files"][member] = {"sha256": digest.hexdigest(), "size": size}
            bundle.writestr(MANIFEST, json.dumps(manifest, sort_keys=True, indent=2) + "\n")
        staging.replace(archive)
    finally:
        if staging is not None:
            staging.unlink(missing_ok=True)
    return manifest


def validate(archive, destination=None):
    with zipfile.ZipFile(archive) as bundle:
        members = bundle.infolist()
        names = [item.filename for item in members]
        if len(names) != len(set(names)) or not names or names[-1] != MANIFEST:
            raise ValueError("Invalid or duplicate archive entries")
        for item in members:
            safe_name(item.filename)
            if item.is_dir() or stat.S_IFMT(item.external_attr >> 16) not in (0, stat.S_IFREG):
                raise ValueError(f"Non-regular archive entry: {item.filename}")
        manifest = json.loads(bundle.read(MANIFEST))
        if manifest.get("format") != "local-qwen3-tts-models-v1" or set(manifest.get("models", {})) != set(MODELS):
            raise ValueError("Unknown bundle manifest")
        for kind, model in manifest["models"].items():
            if model != {"model_id": MODELS[kind], "commit": model.get("commit"), "path": f"models/{kind}"} or not re.fullmatch(r"[a-f0-9]{40}", model["commit"]):
                raise ValueError("Invalid model provenance")
        if set(names) != set(manifest.get("files", {})) | {MANIFEST}:
            raise ValueError("Manifest and archive entries differ")
        for name, expected in manifest["files"].items():
            safe_name(name)
            if not any(name.startswith(f"models/{kind}/") for kind in MODELS):
                raise ValueError(f"Unexpected file: {name}")
            if set(expected) != {"sha256", "size"} or not re.fullmatch(r"[a-f0-9]{64}", expected["sha256"]) or not isinstance(expected["size"], int) or expected["size"] < 0:
                raise ValueError(f"Invalid checksum: {name}")
            digest = hashlib.sha256()
            size = 0
            with bundle.open(name) as source:
                output = None
                try:
                    if destination is not None:
                        path = destination.joinpath(*PurePosixPath(name).parts)
                        path.parent.mkdir(parents=True, exist_ok=True)
                        output = path.open("xb")
                        path.chmod(0o600)
                    for chunk in iter(lambda: source.read(CHUNK), b""):
                        digest.update(chunk)
                        size += len(chunk)
                        if output:
                            output.write(chunk)
                finally:
                    if output:
                        output.close()
            if digest.hexdigest() != expected["sha256"] or size != expected["size"]:
                raise ValueError(f"Checksum mismatch: {name}")
        return manifest


def restore(archive, destination):
    if destination.exists():
        raise FileExistsError(f"Restore destination already exists: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".local-tts-restore-", dir=destination.parent) as temporary:
        staging = Path(temporary) / "bundle"
        staging.mkdir(mode=0o700)
        manifest = validate(archive, staging)
        (staging / MANIFEST).write_text(json.dumps(manifest, sort_keys=True, indent=2) + "\n")
        staging.rename(destination)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("create", "verify", "restore"))
    parser.add_argument("--archive", type=Path, default=DEFAULT_ARCHIVE)
    parser.add_argument("--cache-root", type=Path, default=Path.home() / ".cache/huggingface/hub")
    parser.add_argument("--destination", type=Path, help="New directory for restore")
    args = parser.parse_args()
    if args.action == "create":
        result = create(args.archive, args.cache_root)
    elif args.action == "verify":
        result = validate(args.archive)
    else:
        if args.destination is None:
            parser.error("--destination is required for restore")
        result = restore(args.archive, args.destination)
    print(json.dumps({"archive": str(args.archive), "models": result["models"], "files": len(result["files"]), "bytes": args.archive.stat().st_size}, indent=2))


if __name__ == "__main__":
    main()
