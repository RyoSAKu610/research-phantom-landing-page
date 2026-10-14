# Private local TTS model bundle

`research-phantom-local-tts-models-private.zip` (in the workspace parent directory) is a ZIP64 archive of two **MLX 6-bit** Qwen3-TTS snapshots: `mlx-community/Qwen3-TTS-12Hz-1.7B-Base-6bit` and `mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-6bit`. Its `manifest.json` records the upstream repository IDs, exact cached commits, and SHA-256/size for every file. The model directories contain regular files, including speech tokenizer weights, rather than links into a particular machine's Hugging Face cache. The bundle is private and must not be published with the website or release ZIP. The original `.local-voice/reference.mp3`, its transcript, generated speech, credentials, and unrelated cache data are not part of this archive.

From this project directory, verify and restore into a **new** directory:

```sh
python3 scripts/package_local_tts.py verify
python3 scripts/package_local_tts.py restore --destination "$HOME/local-tts-bundle"
```

To create a new bundle from your cached snapshots (the default output is the workspace parent):

```sh
python3 scripts/package_local_tts.py create
```

`--archive` and `--cache-root` override the defaults. Creation refuses an existing output and rejects symlink targets outside the relevant model cache and any unexpected files; restoration rejects unsafe archive paths and validates checksums before making its destination visible. Keep the ZIP private. The model repository IDs and pinned snapshot commits are in `manifest.json`; review the upstream model licensing and usage terms before redistribution.

## Offline runtime

Use a **fresh Python virtual environment on the target machine**; `.venv-tts` is OS/architecture-specific and not bundled. Python 3.11 and `ffmpeg`/`ffprobe` are needed for audio generation. Install dependencies from `scripts/voice-requirements.txt` (`mlx-audio==0.5.5`, `soundfile==0.14.0`; transitive MLX, NumPy, Hugging Face dependencies are resolved by pip). MLX requires a supported Apple Silicon macOS system. For example:

```sh
python3.11 -m venv .venv-tts
.venv-tts/bin/python -m pip install -r scripts/voice-requirements.txt
brew install ffmpeg
```

Set `LOCAL_TTS_MODELS_DIR` to the **restore root** and force Hugging Face offline mode. Both scripts choose local model paths automatically; without the variable they retain their existing Hugging Face model-ID defaults. `--model` can also explicitly select a restored model directory.

```sh
export LOCAL_TTS_MODELS_DIR="$HOME/local-tts-bundle"
export HF_HUB_OFFLINE=1
export TRANSFORMERS_OFFLINE=1
.venv-tts/bin/python scripts/local_voice.py --model "$LOCAL_TTS_MODELS_DIR/models/Base" --reference .local-voice/reference.mp3 --transcript .local-voice/reference.txt --text 'おはようございます。'
.venv-tts/bin/python scripts/generate_guide_voices.py --model "$LOCAL_TTS_MODELS_DIR/models/CustomVoice" --guide phantom
.venv-tts/bin/python scripts/generate_guide_voices.py --mp3-batch --model "$LOCAL_TTS_MODELS_DIR/models/CustomVoice"
```

The reference recording and matching transcript are needed only for Base reference-conditioned voice synthesis. Supply these separately and privately; the CustomVoice model does not require them. `generate_guide_voices.py` writes clips to the project's guide audio directory and checks the existing guide manifest before generation.

`--mp3-batch` is a separate offline export: it stages `phantom`, `kitsune`, `owl`, and a distinct locally synthesized `meiji` under `.local-voice/outputs/local-mp3/<guide>/NN-guide.mp3`. The adjacent `.local-voice/outputs/local-mp3-qa.json` records model/source/commit, intended and spoken script text, style and filters, hashes, sizes, durations, and any failures. A complete, verified batch has exactly 28 clips and a minimal `local-export.json` receipt in the staging root. Use `--finalize-mp3` to recheck and create the receipt without loading the model. Only this staged local MP3 set uses the fourth synthetic guide; it does not claim to reproduce the vendor voice or overwrite the existing vendor M4A files. Existing `--guide`/`--scene` M4A operation remains unchanged when `--mp3-batch` is omitted.

Once the batch is import-ready, the separate audio importer can copy it atomically with `python3 scripts/import_ondoku_guides.py .local-voice/outputs/local-mp3 --local --ffprobe /opt/homebrew/bin/ffprobe`; this generator does not write to `src/audio/local-mp3` itself.

The finalizer also decodes all 28 clips and checks peak/RMS level, clipping, leading/trailing and prolonged silence, speech-length plausibility, and duration outliers; the resulting measurements are saved in `local-mp3-qa.json`. These automated checks do **not** verify pronunciation or naturalness by ear. To preview all clips before release, listen to each track while comparing `intended_text` and `spoken_text` in that QA file:

```sh
for guide in phantom kitsune owl meiji; do
  for scene in 01 02 03 04 05 06 07; do
    echo "$guide scene $scene"
    /opt/homebrew/bin/ffplay -nodisp -autoexit ".local-voice/outputs/local-mp3/$guide/$scene-guide.mp3"
  done
done
```
