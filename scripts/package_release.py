"""Package the offline LP and a separate, private reference-voice backup."""

import argparse
import base64
import hashlib
import json
import math
import re
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parent.parent
PREFIX = ROOT.name
PUBLIC_ZIP = ROOT.parent / "research-phantom-landing-page-offline-voice.zip"
PRIVATE_ZIP = ROOT.parent / "research-phantom-local-voice-profile-private.zip"
PUBLIC_ROOT_FILES = {
    "AGENT_PAYMENT_SETUP.md", "ONDOKU_SETUP.md", "PHANTOMRESEARCH_PLAN.md",
    "VOICE_REFERENCE.md", "ONLINE_RESEARCH_SETUP.md", "LOCAL_TTS_BUNDLE.md",
    "README.md", ".gitignore", "index.html", "standalone-offline.html",
    "server.mjs",
    "package.json", "package-lock.json", "tsconfig.json", "vite.config.ts",
}
PUBLIC_SOURCE_EXTENSIONS = {
    ".command", ".css", ".html", ".jpeg", ".jpg", ".js", ".json",
    ".md", ".mjs", ".mts", ".png", ".py", ".svg", ".ts",
    ".tsx", ".txt", ".webp",
}
PUBLIC_SERVER_FILES = {
    ("server", "research.mjs"), ("server", "start.mjs"),
    ("server", "research.d.mts"),
}
PUBLIC_AUDIO = re.compile(
    r"src/audio/(?:offline/0[1-7]-local-qwen|"
    r"offline-reference/0[1-7]-local-reference|"
    r"guides/(?:phantom|kitsune|owl|meiji)/0[1-7]-guide)\.m4a"
)
PUBLIC_LOCAL_MP3 = {
    f"src/audio/local-mp3/{guide}/{scene:02d}-guide.mp3"
    for guide in ("phantom", "kitsune", "owl", "meiji")
    for scene in range(1, 8)
}
PRIVATE_PARTS = {
    "__macosx", "__pycache__", "backups", "cache", "coverage", "logs", "node_modules",
    "hf-cache", "hf_cache", "huggingface", "models", "outputs", "previews",
    "scratch", "temp", "tmp", "workspace",
}
PRIVATE_NAME = re.compile(
    r"(?:^|[._-])(?:secret|secrets|credential|credentials|token|tokens|"
    r"password|passwords|private|key|keys|wallet|keystore|id_rsa|id_ed25519|"
    r"tmp|temp|scratch|backup|backups|workspace)"
    r"(?:[._-]|$)", re.I,
)
OFFLINE_NOTE = """ResearchPhantom public offline edition / 公開用オフライン版

Open dist/index.html or standalone-offline.html directly in a browser.
The bundled research examples and narration work offline. The optional live
research API source is included in server/; opening an HTML file does not start
it. For live lookup, follow ONLINE_RESEARCH_SETUP.md to run npm run start and
open the local server URL. Live APIs require network access and any optional
credentials must be supplied separately; none are included in this ZIP.
Payment requests in this edition are drafts, not completed transactions.
If included, the 28 local-mp3 guide tracks were synthesized locally with
Qwen3-TTS; they are not Ondoku Beta recordings. TTS model weights and Hugging
Face caches are not included. The separate
research-phantom-local-tts-models-private.zip is a private archive, not part
of this public offline ZIP.

同梱の論文例と音声はオフラインで利用できます。オンライン論文検索・外部APIには
server/ の起動とネット接続が必要です。手順は ONLINE_RESEARCH_SETUP.md を参照。
決済は実行されません。
local-mp3/ の音声（同梱時）はローカルのQwen3-TTSで合成したもので、
音読さんBetaの収録音声ではありません。モデル重みとHFキャッシュは非同梱です。
元の参照音声・環境変数・認証情報はこの公開用ZIPに含まれません。
"""


def is_public(file: Path, root: Path = ROOT) -> bool:
    """Select only the offline deliverables and public project source files."""
    parts = file.relative_to(root).parts
    if any(root.joinpath(*parts[:index]).is_symlink() for index in range(1, len(parts) + 1)):
        return False
    if parts == (".gitignore",):
        return True  # Preserves credential exclusions for users of the extracted project.
    for part in parts:
        name = part.lower()
        if (
            part.startswith(".") or name in PRIVATE_PARTS
            or name in {"thumbs.db", "desktop.ini", "icon\r"}
            or ".local." in name
            or name.startswith(("scene-tts-", "scene-previous-"))
            or name.startswith("._") or PRIVATE_NAME.search(part)
        ):
            return False
    if file.name.lower().endswith(("~", ".tmp", ".bak", ".orig", ".rej", ".swp", ".swo")):
        return False
    if len(parts) == 1:
        return parts[0] in PUBLIC_ROOT_FILES
    if parts == ("dist", "index.html"):
        return True
    if parts[0] == "server":
        return parts in PUBLIC_SERVER_FILES
    if parts[:3] == ("src", "audio", "ondoku"):
        return False  # This public ZIP supports local MP3 and legacy M4A sources only.
    if parts[:3] == ("src", "audio", "local-mp3"):
        return parts == ("src", "audio", "local-mp3", "manifest.json") or file.relative_to(root).as_posix() in PUBLIC_LOCAL_MP3
    if file.suffix.lower() == ".m4a":
        return bool(PUBLIC_AUDIO.fullmatch(file.relative_to(root).as_posix()))
    if parts[0] in {"src", "scripts"}:
        if file.suffix.lower() not in PUBLIC_SOURCE_EXTENSIONS:
            return False
        return not (file.suffix.lower() == ".txt" and "reference" in file.stem.lower())
    return False


def validate_local_mp3_manifest(root: Path, manifest_path: Path, mp3_files: dict[str, Path]) -> None:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict) or set(manifest) != {"provider", "script_sha256", "tracks"}:
        raise ValueError("Invalid local guide MP3 manifest structure")
    script_hash = hashlib.sha256((root / "src/audio/narration.json").read_bytes()).hexdigest()
    if manifest["provider"] != "local-qwen3-tts" or manifest["script_sha256"] != script_hash:
        raise ValueError("Local guide MP3 provider or script hash does not match the release")
    tracks = manifest["tracks"]
    if not isinstance(tracks, list) or len(tracks) != len(PUBLIC_LOCAL_MP3):
        raise ValueError("Local guide MP3 manifest must list exactly 28 tracks")

    expected = {name.removeprefix("src/audio/local-mp3/"): file for name, file in mp3_files.items()}
    seen = set()
    for track in tracks:
        if not isinstance(track, dict) or set(track) != {"file", "sha256", "bytes", "duration_seconds"}:
            raise ValueError("Invalid local guide MP3 track entry")
        relative = track["file"]
        if not isinstance(relative, str) or relative not in expected or relative in seen:
            raise ValueError("Unexpected or repeated local guide MP3 track")
        seen.add(relative)
        file = expected[relative]
        if (
            not isinstance(track["sha256"], str) or not re.fullmatch(r"[0-9a-f]{64}", track["sha256"])
            or type(track["bytes"]) is not int or track["bytes"] != file.stat().st_size
            or type(track["duration_seconds"]) not in (int, float)
            or not math.isfinite(track["duration_seconds"]) or track["duration_seconds"] <= 0
        ):
            raise ValueError(f"Invalid local guide MP3 metadata: {relative}")
        digest = hashlib.sha256()
        with file.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(chunk)
        if digest.hexdigest() != track["sha256"]:
            raise ValueError(f"Local guide MP3 hash mismatch: {relative}")
    if seen != expected.keys():
        raise ValueError("Local guide MP3 manifest is missing tracks")


def public_files(root: Path = ROOT) -> list[Path]:
    candidates = [root / name for name in PUBLIC_ROOT_FILES]
    candidates.append(root / "dist/index.html")
    for directory in ("src", "scripts", "server"):
        candidates.extend((root / directory).rglob("*"))
    files = sorted(file for file in candidates if is_public(file, root) and file.is_file())
    mp3_files = {file.relative_to(root).as_posix(): file for file in files if file.suffix.lower() == ".mp3"}
    manifest_path = root / "src/audio/local-mp3/manifest.json"
    if mp3_files or manifest_path.exists() or manifest_path.is_symlink():
        if (
            mp3_files.keys() != PUBLIC_LOCAL_MP3 or manifest_path not in files
            or any(file.stat().st_size == 0 for file in mp3_files.values())
        ):
            raise ValueError(f"Incomplete local guide MP3 set ({len(mp3_files)}/28); manifest.json and all 28 required")
        validate_local_mp3_manifest(root, manifest_path, mp3_files)
    return files


def write_zip(destination: Path, files: list[Path], *, offline_note: bool = False) -> None:
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    try:
        with ZipFile(temporary, "w", compression=ZIP_DEFLATED, compresslevel=6) as archive:
            for file in files:
                archive.write(file, f"{PREFIX}/{file.relative_to(ROOT).as_posix()}")
            if offline_note:
                archive.writestr(f"{PREFIX}/OFFLINE_PACKAGE.txt", OFFLINE_NOTE)
        with ZipFile(temporary) as archive:
            invalid = archive.testzip()
            if invalid:
                raise RuntimeError(f"Invalid ZIP entry: {invalid}")
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)
    print(f"Created {destination} ({destination.stat().st_size // 1024} KiB, {len(files) + offline_note} files)")


def validate_offline_html(file: Path, digest: str, local_mp3: bool) -> None:
    html = file.read_text(encoding="utf-8")

    def embedded(script_id: str):
        match = re.search(
            rf'<script id="{script_id}" type="application/json">(.*?)</script>', html, re.S,
        )
        return json.loads(match.group(1)) if match else None

    voices = embedded("embedded-guide-audio")
    metadata = embedded("embedded-guide-meta")
    provider = "local-qwen3-tts" if local_mp3 else "mixed-offline-guide-voices"
    guides = {"phantom", "kitsune", "owl", "meiji"}
    if (
        not isinstance(metadata, dict) or metadata.get("provider") != provider
        or metadata.get("script_sha256") != digest
        or not isinstance(metadata.get("guides"), dict)
        or set(metadata["guides"]) != guides
        or (local_mp3 and any(
            not isinstance(guide, dict) or guide.get("provider") != provider
            for guide in metadata["guides"].values()
        ))
        or (not local_mp3 and (
            not isinstance(metadata["guides"]["meiji"], dict)
            or metadata["guides"]["meiji"].get("provider") != "ondoku3-beta"
        ))
        or not isinstance(voices, dict) or set(voices) != guides
    ):
        raise ValueError(f"The offline HTML has stale or incorrect guide provenance: {file}")

    mime = "audio/mpeg" if local_mp3 else "audio/mp4"
    folder = "local-mp3" if local_mp3 else "guides"
    extension = "mp3" if local_mp3 else "m4a"
    prefix = f"data:{mime};base64,"
    for guide in sorted(guides):
        clips = voices[guide]
        if not isinstance(clips, list) or len(clips) != 7:
            raise ValueError(f"The offline HTML is missing guide clips: {file}: {guide}")
        for index, clip in enumerate(clips, start=1):
            if not isinstance(clip, str) or not clip.startswith(prefix):
                raise ValueError(f"The offline HTML has an incorrect guide MIME: {file}: {guide}/{index}")
            try:
                decoded = base64.b64decode(clip[len(prefix):], validate=True)
            except ValueError as error:
                raise ValueError(f"The offline HTML has invalid guide audio: {file}: {guide}/{index}") from error
            source = ROOT / f"src/audio/{folder}/{guide}/{index:02d}-guide.{extension}"
            if decoded != source.read_bytes():
                raise ValueError(f"The offline HTML differs from the source audio: {file}: {guide}/{index}")


def main(public_only: bool = False) -> None:
    scripts = ROOT / "src/audio/narration.json"
    manifest = json.loads((ROOT / "src/audio/offline-reference/voice.json").read_text())
    digest = hashlib.sha256(scripts.read_bytes()).hexdigest()
    if manifest.get("script_sha256") != digest:
        raise ValueError("The scene scripts changed. Regenerate the seven clips and rebuild first.")
    guide_manifest = json.loads((ROOT / "src/audio/guides/voice.json").read_text())
    if guide_manifest.get("script_sha256") != digest:
        raise ValueError("Guide voices do not match the scene scripts")
    public = public_files(ROOT)
    local_mp3 = ROOT / "src/audio/local-mp3/manifest.json" in public
    if not local_mp3 and (ROOT / "src/audio/ondoku/manifest.json").exists():
        raise ValueError("Ondoku MP3 imports are not supported by the public offline ZIP")
    essentials = [ROOT / "dist/index.html", ROOT / "standalone-offline.html"]
    for file in essentials:
        validate_offline_html(file, digest, local_mp3)

    write_zip(PUBLIC_ZIP, public, offline_note=True)

    if public_only:
        return
    private_files = [ROOT / ".local-voice/reference.mp3", ROOT / ".local-voice/reference.txt"]
    if not all(file.is_file() for file in private_files):
        raise FileNotFoundError("The private reference MP3 and transcript are required")
    write_zip(PRIVATE_ZIP, private_files)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--public-only", action="store_true", help="Refresh only the public ZIP; leave the private backup untouched")
    main(public_only=parser.parse_args().public_only)
