# Import complete local guide MP3s

The primary workflow generates all 28 tracks with a **local Qwen3-TTS model**, then imports the MP3s with provenance `local-qwen3-tts`. This is independent of Ondoku's API and its quotas; it does not bypass vendor rate limits. Beta voice output can inform listening/quality checks, but locally generated speech is not an Ondoku export.

Arrange the generated MP3s in a directory such as `/path/to/local-export`, with `local-export.json` and four guide folders containing `01-guide.mp3` through `07-guide.mp3` each:

```text
local-export/
  local-export.json
  phantom/01-guide.mp3 ... 07-guide.mp3
  kitsune/01-guide.mp3 ... 07-guide.mp3
  owl/01-guide.mp3 ... 07-guide.mp3
  meiji/01-guide.mp3 ... 07-guide.mp3
```

From the project directory, once the model has **actually produced** and listened to all 28 tracks:

```sh
python3 -c 'import hashlib,json,pathlib; p=pathlib.Path("src/audio/narration.json"); print(json.dumps({"provider":"local-qwen3-tts","script_sha256":hashlib.sha256(p.read_bytes()).hexdigest()},indent=2))' > /path/to/local-export/local-export.json
python3 scripts/import_ondoku_guides.py /path/to/local-export --local
npm run build
npm run verify:release
```

The import atomically installs `src/audio/local-mp3/` only when all 28 files are playable MPEG Layer III with distinct hashes, positive durations, safe paths and a matching script hash. The build embeds MP3 as `data:audio/mpeg`; its metadata identifies local Qwen3-TTS. An incomplete or altered import cannot silently replace the existing audio. If the generation pipeline directly installs that destination, it must provide the same complete `manifest.json` format with exact file hashes and durations. The release verifier compares every embedded byte to its source.

## Optional: original Ondoku export

The current offline build contains 21 locally generated Qwen M4A clips and seven Ondoku3 Beta Iris M4A clips. To replace them with **28 original Ondoku MP3 exports**, provide the actual tracks for all four guides and seven scenes. No Ondoku credentials or remaining 21 Ondoku recordings are available in this workspace. The private `.local-voice/reference.mp3` is unrelated and must not be imported.

Arrange the exported files in a directory outside the project (shown here as `/path/to/ondoku-export`):

```text
ondoku-export/
  ondoku-export.json
  phantom/01-guide.mp3 ... 07-guide.mp3
  kitsune/01-guide.mp3 ... 07-guide.mp3
  owl/01-guide.mp3 ... 07-guide.mp3
  meiji/01-guide.mp3 ... 07-guide.mp3
```

`ondoku-export.json` is an operator attestation tying the export to the current narration script. Create it after exporting the matching scene scripts:

```sh
python3 -c 'import hashlib,json,pathlib; p=pathlib.Path("src/audio/narration.json"); print(json.dumps({"provider":"ondoku3-beta","script_sha256":hashlib.sha256(p.read_bytes()).hexdigest()},indent=2))' > /path/to/ondoku-export/ondoku-export.json
python3 scripts/import_ondoku_guides.py /path/to/ondoku-export --confirm-ondoku-export
npm run build
npm run verify:release
```

Run those commands from the project directory. The importer requires `ffprobe` on PATH (or `--ffprobe /opt/homebrew/bin/ffprobe`). It verifies the exact 28-file set, rejects symlinks, empty/duplicate/non-MP3 clips, checks positive durations and the script hash, and installs a manifest and audio into `src/audio/ondoku/` only after all checks pass. An existing import is never overwritten automatically. The build verifies file hashes and codec again, embeds `data:audio/mpeg` bytes in the offline HTML, and the release verifier checks the embeds against their source files. Until a complete import exists, the existing mixed M4A build remains in use.

The script hash and operator attestation cannot establish where a playable MP3 was generated. Only supply original Ondoku exports; do not relabel or transcode locally generated voices.
