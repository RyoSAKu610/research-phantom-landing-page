#!/usr/bin/env python3
"""Atomically import a complete, operator-attested local or Ondoku MP3 export."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "src/audio/ondoku"
GUIDES = ("phantom", "kitsune", "owl", "meiji")
FILES = tuple(f"{guide}/0{number}-guide.mp3" for guide in GUIDES for number in range(1, 8))


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def import_tracks(source, destination=None, ffprobe="ffprobe", provider="ondoku3-beta"):
    if provider not in ("ondoku3-beta", "local-qwen3-tts"):
        raise ValueError("Unsupported audio provenance")
    if destination is None:
        destination = ROOT / "src/audio" / ("local-mp3" if provider == "local-qwen3-tts" else "ondoku")
    destination = Path(destination)
    source = Path(source)
    if not source.is_dir() or source.is_symlink():
        raise ValueError("Source must be an ordinary directory")
    receipt_name = "local-export.json" if provider == "local-qwen3-tts" else "ondoku-export.json"
    expected = {receipt_name, *GUIDES}
    if {p.name for p in source.iterdir()} != expected:
        raise ValueError(f"Source must contain exactly {receipt_name} and four guide directories")
    receipt_path = source / receipt_name
    if not receipt_path.is_file() or receipt_path.is_symlink():
        raise ValueError("Export attestation must be a regular JSON file")
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    script_hash = sha256((ROOT / "src/audio/narration.json").read_bytes())
    if receipt != {"provider": provider, "script_sha256": script_hash}:
        raise ValueError(f"Export attestation must declare {provider} and the current narration script SHA-256")
    if json.loads((ROOT / "src/audio/guides/voice.json").read_text(encoding="utf-8"))["script_sha256"] != script_hash:
        raise ValueError("Existing guide script hash does not match the current narration")
    if destination.exists() or destination.is_symlink():
        raise FileExistsError(f"Destination already exists: {destination}; inspect it before replacing an import")

    tracks = []
    payloads = []
    seen = set()
    for guide in GUIDES:
        folder = source / guide
        if not folder.is_dir() or folder.is_symlink() or {p.name for p in folder.iterdir()} != {
            f"0{number}-guide.mp3" for number in range(1, 8)
        }:
            raise ValueError(f"{guide}: expected exactly seven numbered MP3 files, no symlinks or extras")
    for relative in FILES:
        path = source / relative
        if not path.is_file() or path.is_symlink():
            raise ValueError(f"Unsafe or missing source: {relative}")
        data = path.read_bytes()
        digest = sha256(data)
        if not data or digest in seen:
            raise ValueError(f"Empty or duplicate clip: {relative}")
        seen.add(digest)
        result = subprocess.run(
            [ffprobe, "-v", "error", "-show_entries", "stream=codec_name,codec_type:format=duration", "-of", "json", str(path)],
            check=True, capture_output=True, text=True,
        )
        media = json.loads(result.stdout)
        streams = [stream for stream in media.get("streams", []) if stream.get("codec_type") == "audio"]
        duration = float(media.get("format", {}).get("duration", 0))
        if not streams or any(stream.get("codec_name") != "mp3" for stream in streams) or not 0 < duration < float("inf"):
            raise ValueError(f"Invalid MPEG Layer III audio: {relative}")
        tracks.append({"file": relative, "sha256": digest, "bytes": len(data), "duration_seconds": duration})
        payloads.append(data)

    destination.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".ondoku-import-", dir=destination.parent))
    try:
        for relative, data in zip(FILES, payloads):
            target = staging / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        (staging / "manifest.json").write_text(
            json.dumps({"provider": provider, "script_sha256": script_hash, "tracks": tracks}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        if destination.exists() or destination.is_symlink():
            raise FileExistsError(f"Destination appeared during import: {destination}")
        os.rename(staging, destination)
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    return destination


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Directory of 28 MP3s and the corresponding export JSON")
    parser.add_argument("--confirm-ondoku-export", action="store_true", help="Attest the files were exported from Ondoku, not synthesized/transcoded elsewhere")
    parser.add_argument("--local", action="store_true", help="Import locally generated Qwen3-TTS tracks with local-export.json into src/audio/local-mp3")
    parser.add_argument("--ffprobe", default="ffprobe", help="Path to ffprobe")
    args = parser.parse_args()
    if not args.local and not args.confirm_ondoku_export:
        parser.error("--confirm-ondoku-export is required; audio codec alone cannot prove its generator")
    if args.local and args.confirm_ondoku_export:
        parser.error("Local generation and Ondoku export are distinct provenance modes")
    provider = "local-qwen3-tts" if args.local else "ondoku3-beta"
    print(f"Imported 28 {provider} MP3 clips to {import_tracks(args.source, ffprobe=args.ffprobe, provider=provider)}")
