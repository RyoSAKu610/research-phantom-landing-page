"""Create seven offline Japanese narration clips for each selectable character guide.

Uses the locally cached Qwen3-TTS CustomVoice model after its first download.
Run: .venv-tts/bin/python scripts/generate_guide_voices.py [--guide phantom|kitsune|owl]
The existing fourth guide (meiji) has separate vendor recordings in the M4A workflow.
Use --mp3-batch for an independent four-guide offline MP3 export, including a local Meiji voice.
"""

import argparse
import hashlib
import json
import os
import math
import statistics
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf


ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "src/audio/guides"
SCRIPT = ROOT / "src/audio/narration.json"
MODEL = "mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-6bit"
MP3_OUTPUT = ROOT / ".local-voice/outputs/local-mp3"


def audio_quality(file: Path, duration: float, text: str):
    pcm = subprocess.check_output(["/opt/homebrew/bin/ffmpeg", "-v", "error", "-i", str(file),
                                   "-f", "f32le", "-ac", "1", "-ar", "24000", "pipe:1"])
    wave = np.frombuffer(pcm, dtype="<f4")
    if not len(wave) or not np.all(np.isfinite(wave)):
        raise ValueError("Decoded audio is empty or non-finite")
    peak = float(np.max(np.abs(wave)))
    rms_dbfs = 20 * math.log10(max(float(np.sqrt(np.mean(np.square(wave)))), 1e-10))
    clipped = float(np.mean(np.abs(wave) >= 0.999))
    window = 6000  # 0.25-second silence windows at the requested 24 kHz decode rate
    windows = [float(np.sqrt(np.mean(np.square(wave[i:i + window])))) for i in range(0, len(wave), window)]
    quiet = [value < 0.004 for value in windows]  # approximately -48 dBFS RMS
    leading = next((index for index, silent in enumerate(quiet) if not silent), len(quiet)) * .25
    trailing = next((index for index, silent in enumerate(reversed(quiet)) if not silent), len(quiet)) * .25
    longest = run = 0
    for silent in quiet:
        run = run + 1 if silent else 0
        longest = max(longest, run)
    metrics = {"peak": peak, "rms_dbfs": round(rms_dbfs, 2), "clipped_fraction": round(clipped, 6),
               "silent_fraction": round(sum(quiet) / len(quiet), 3),
               "leading_silence_seconds": leading, "trailing_silence_seconds": trailing,
               "longest_silence_seconds": longest * .25,
               "seconds_per_spoken_character": round(duration / max(len(text), 1), 3)}
    if peak < .02 or rms_dbfs < -36 or clipped > .002 or sum(quiet) / len(quiet) > .65 or max(leading, trailing) > 2.5 or longest * .25 > 5 or not .07 < duration / max(len(text), 1) < .7:
        raise ValueError(f"Silence, clipping, truncation or level check failed: {metrics}")
    return metrics


def finalize_mp3_batch(destination: Path):
    """Verify every staged file and emit the importer's minimal receipt only when complete."""
    qa_path = destination.with_name(destination.name + "-qa.json")
    legacy = destination / "qa-manifest.json"
    if legacy.exists():
        if qa_path.exists():
            raise ValueError("Conflicting QA manifests")
        legacy.replace(qa_path)
    qa = json.loads(qa_path.read_text(encoding="utf-8"))
    scripts = json.loads(SCRIPT.read_text(encoding="utf-8"))
    variants_manifest = json.loads((OUTPUT / "voice.json").read_text(encoding="utf-8"))
    expected = {f"{guide}/{number:02d}-guide.mp3" for guide in (*GUIDES, "meiji") for number in range(1, 8)}
    root_entries = {path.name for path in destination.iterdir()}
    permitted = {*GUIDES, "meiji", "local-export.json"}
    if root_entries - permitted or not {*GUIDES, "meiji"}.issubset(root_entries):
        raise ValueError(f"Unexpected or missing staging entries: {sorted(root_entries ^ permitted)}")
    if qa["provider"] != "local-qwen3-tts-customvoice-mlx" or qa["script_sha256"] != hashlib.sha256(SCRIPT.read_bytes()).hexdigest() or set(qa["clips"]) != expected or qa["failures"]:
        raise ValueError(f"Incomplete staged MP3 batch: {len(qa['clips'])}/28; failures: {qa['failures']}")
    if variants_manifest["script_sha256"] != qa["script_sha256"]:
        raise ValueError("Spoken variants do not match narration script")
    hashes = set()
    durations = {}
    for name in sorted(expected):
        file = destination / name
        item = qa["clips"][name]
        guide, filename = name.split("/")
        number = int(filename[:2])
        intended = scripts[number - 1]
        spoken = variants_manifest["spoken_variants"].get(guide, {}).get(str(number), intended)
        if item["intended_text"] != intended or item["spoken_text"] != spoken:
            raise ValueError(f"Narration/spoken-variant correspondence failed: {name}")
        if file.is_symlink() or not file.is_file() or file.stat().st_size != item["bytes"] or hashlib.sha256(file.read_bytes()).hexdigest() != item["sha256"]:
            raise ValueError(f"Unverified local MP3: {name}")
        if item["sha256"] in hashes:
            raise ValueError(f"Duplicate local MP3 audio: {name}")
        hashes.add(item["sha256"])
        probe = json.loads(subprocess.check_output(["/opt/homebrew/bin/ffprobe", "-v", "error", "-show_entries",
                                                     "format=duration:stream=codec_name", "-of", "json", str(file)]))
        duration = float(probe["format"]["duration"])
        if not any(stream.get("codec_name") == "mp3" for stream in probe["streams"]) or not 2 < duration < 120:
            raise ValueError(f"Invalid MP3 codec/duration: {name}")
        durations[name] = duration
        try:
            item["quality"] = audio_quality(file, duration, item["spoken_text"])
        except ValueError as error:
            qa["failures"][name] = str(error)
    median = statistics.median(durations.values())
    for name, duration in durations.items():
        if not .5 * median <= duration <= 2 * median:
            qa["failures"][name] = f"Duration outlier: {duration:.2f}s vs median {median:.2f}s"
    qa_path.write_text(json.dumps(qa, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if qa["failures"]:
        raise ValueError(f"MP3 quality gate failed: {qa['failures']}")
    for guide in (*GUIDES, "meiji"):
        folder = destination / guide
        if folder.is_symlink() or {file.name for file in folder.iterdir()} != {f"{number:02d}-guide.mp3" for number in range(1, 8)}:
            raise ValueError(f"Unexpected files in {folder}")
    receipt = destination / "local-export.json"
    receipt.write_text(json.dumps({"provider": "local-qwen3-tts", "script_sha256": qa["script_sha256"]}, indent=2) + "\n", encoding="utf-8")
    print(f"Import-ready local MP3 files: {len(expected)}/28; QA: {qa_path}", flush=True)
GUIDES = {
    "phantom": {
        "speaker": "Aiden",
        "style": "仮面の学者。中低音の日本語で、神秘的だが温かく、読者にそっと問いかける。落ち着いた知性と自然な間で、数字と専門用語ははっきり話す。",
        "filters": "highpass=f=75,lowpass=f=11000,equalizer=f=260:t=q:w=1:g=1,loudnorm=I=-18:TP=-2:LRA=11",
    },
    "kitsune": {
        "speaker": "Ono_Anna",
        "style": "古書を愛する狐の司書。柔らかく澄んだ女性の声で、親しみと好奇心を含む自然な抑揚。日本語を丁寧に語り、重要な言葉の前で少し間を置く。",
        "filters": "highpass=f=85,lowpass=f=11000,loudnorm=I=-18:TP=-2:LRA=11",
    },
    "owl": {
        "speaker": "Ryan",
        "style": "時計仕掛けのフクロウ分析者。低く落ち着いた日本語の声。正確で理知的なテンポで数字をはっきり読み、断定を急がず静かに結論を告げる。",
        "filters": "highpass=f=75,lowpass=f=11000,equalizer=f=3200:t=q:w=1:g=1,loudnorm=I=-18:TP=-2:LRA=11",
    },
}


def generate_mp3(args, scripts):
    """Stage a complete, resumable local-only four-guide MP3 set with QA provenance."""
    from mlx_audio.tts.utils import load_model

    voice_manifest = json.loads((OUTPUT / "voice.json").read_text(encoding="utf-8"))
    if voice_manifest["script_sha256"] != hashlib.sha256(SCRIPT.read_bytes()).hexdigest():
        raise ValueError("Narration and spoken-variant manifest differ")
    configs = {key: dict(GUIDES[key]) for key in GUIDES}
    # A distinct locally synthesized persona; vendor Iris voice and seed are never used here.
    configs["meiji"] = {
        "speaker": "Serena",
        "style": "明治期の女性研究者の語り。自然な日本語の発音、品のある落ち着いた抑揚。問いの後は短く間をとり、専門用語と数字は明瞭に。急がず知的で温かな声。",
        "filters": "highpass=f=75,lowpass=f=11000,loudnorm=I=-18:TP=-2:LRA=11",
    }
    model_path = Path(args.model)
    commit = None
    bundle_manifest = model_path.parent.parent / "manifest.json"
    if bundle_manifest.is_file():
        commit = json.loads(bundle_manifest.read_text(encoding="utf-8"))["models"]["CustomVoice"]["commit"]
    else:
        cache = Path.home() / ".cache/huggingface/hub/models--mlx-community--Qwen3-TTS-12Hz-1.7B-CustomVoice-6bit/snapshots"
        snapshots = list(cache.iterdir()) if cache.is_dir() else []
        if len(snapshots) == 1:
            commit = snapshots[0].name
    selected_guides = [args.guide] if args.guide else [*GUIDES, "meiji"]
    selected_scenes = args.scene if args.scene else range(1, 8)
    destination = args.mp3_output
    destination.mkdir(parents=True, exist_ok=True)
    qa_path = destination.with_name(destination.name + "-qa.json")
    legacy_qa_path = destination / "qa-manifest.json"
    if legacy_qa_path.exists() and not qa_path.exists():
        legacy_qa_path.replace(qa_path)
    identity = {
        "provider": "local-qwen3-tts-customvoice-mlx", "model_id": MODEL,
        "model_source": args.model, "model_commit": commit,
        "script_sha256": hashlib.sha256(SCRIPT.read_bytes()).hexdigest(),
        "codec": "libmp3lame", "bitrate": "128k", "sample_rate": 24000,
    }
    if qa_path.is_file():
        qa = json.loads(qa_path.read_text(encoding="utf-8"))
        if any(qa.get(key) != value for key, value in identity.items()):
            raise ValueError("Existing MP3 batch identity differs; use another --mp3-output")
    else:
        qa = {**identity, "clips": {}, "failures": {}}

    def save_qa():
        temporary = qa_path.with_suffix(".tmp")
        temporary.write_text(json.dumps(qa, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporary.replace(qa_path)

    save_qa()
    model = load_model(args.model)
    for guide in selected_guides:
        config = configs[guide]
        for number in selected_scenes:
            key = f"{guide}/{number:02d}-guide.mp3"
            target = destination / key
            intended = scripts[number - 1]
            spoken = voice_manifest["spoken_variants"].get(guide, {}).get(str(number), intended)
            record = qa["clips"].get(key)
            if record and target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest() == record["sha256"]:
                print(f"Already verified {key}", flush=True)
                continue
            print(f"Synthesizing local MP3 {key}", flush=True)
            try:
                results = list(model.generate_custom_voice(text=spoken, speaker=config["speaker"],
                                                           language="Japanese", instruct=config["style"], max_tokens=1100))
                if not results:
                    raise RuntimeError("No generated audio")
                wave = np.concatenate([np.asarray(result.audio).squeeze() for result in results])
                rate = model.sample_rate
                if wave.ndim != 1 or len(wave) < rate * 2 or not np.all(np.isfinite(wave)):
                    raise RuntimeError("Invalid or too-short waveform")
                target.parent.mkdir(parents=True, exist_ok=True)
                with tempfile.TemporaryDirectory(dir=destination) as directory:
                    raw = Path(directory) / "raw.wav"
                    encoded = Path(directory) / "encoded.mp3"
                    sf.write(raw, np.clip(wave, -1, 1), rate)
                    subprocess.run(["/opt/homebrew/bin/ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                                    "-i", str(raw), "-af", config["filters"], "-c:a", "libmp3lame", "-b:a", "128k", str(encoded)], check=True)
                    probe = json.loads(subprocess.check_output(["/opt/homebrew/bin/ffprobe", "-v", "error", "-show_entries",
                                                                 "format=duration:stream=codec_name,sample_rate", "-of", "json", str(encoded)]))
                    duration = float(probe["format"]["duration"])
                    if not math.isfinite(duration) or not 2 < duration < 120 or encoded.stat().st_size < 4000 or not any(
                        stream.get("codec_name") == "mp3" for stream in probe["streams"]
                    ):
                        raise RuntimeError("MP3 codec, duration or size validation failed")
                    encoded.replace(target)
                qa["clips"][key] = {"intended_text": intended, "spoken_text": spoken,
                                    "speaker": config["speaker"], "style": config["style"], "filters": config["filters"],
                                    "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                                    "bytes": target.stat().st_size, "duration_seconds": duration}
                qa["failures"].pop(key, None)
                save_qa()
            except Exception as error:
                qa["failures"][key] = str(error)
                save_qa()
                print(f"Failed {key}: {error}", flush=True)
    expected = {f"{guide}/{number:02d}-guide.mp3" for guide in (*GUIDES, "meiji") for number in range(1, 8)}
    verified = {key for key in expected if key in qa["clips"] and (destination / key).is_file() and
                hashlib.sha256((destination / key).read_bytes()).hexdigest() == qa["clips"][key]["sha256"]}
    if not args.guide and not args.scene and (verified != expected or qa["failures"]):
        raise RuntimeError(f"Incomplete offline MP3 batch: {len(verified)}/28, failures: {qa['failures']}")
    print(f"Verified staged local MP3 files: {len(verified)}/28", flush=True)
    if not args.guide and not args.scene:
        finalize_mp3_batch(destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--guide", choices=(*GUIDES, "meiji"), help="Only generate the selected guide (meiji requires --mp3-batch)")
    parser.add_argument("--scene", type=int, choices=range(1, 8), action="append", help="Regenerate a scene; repeat for multiple scenes")
    parser.add_argument("--mp3-batch", action="store_true", help="Stage 4 × 7 locally generated MP3 files with QA manifest")
    parser.add_argument("--finalize-mp3", action="store_true", help="Verify staged MP3 files and write local-export.json without loading a model")
    parser.add_argument("--mp3-output", type=Path, default=MP3_OUTPUT)
    bundle = os.environ.get("LOCAL_TTS_MODELS_DIR")
    parser.add_argument("--model", default=str(Path(bundle).expanduser() / "models/CustomVoice") if bundle else MODEL,
                        help="Model ID or restored models/CustomVoice path (LOCAL_TTS_MODELS_DIR also supported)")
    args = parser.parse_args()
    if args.finalize_mp3:
        finalize_mp3_batch(args.mp3_output)
        return
    scripts = json.loads(SCRIPT.read_text(encoding="utf-8"))
    if len(scripts) != 7:
        raise ValueError("Expected exactly seven scene scripts")
    if args.mp3_batch:
        generate_mp3(args, scripts)
        return
    if args.guide == "meiji":
        parser.error("meiji is available only with --mp3-batch")
    # Shorter equivalent wording prevents the model from swallowing technical terms and numbers.
    scene_three = scripts[2].replace("持続性で重み付けし、再びエントロピー化します。", "持続性に応じた重みをつけ、再びエントロピーに変換します。")
    spoken_variants = {
        guide: {"3": scene_three} for guide in GUIDES
    }
    spoken_variants["owl"].update({
        "5": scripts[4].replace("5つの比較手法", "五種類の比較手法"),
        "6": scripts[5].replace("深層学習手法", "ディープラーニングの手法"),
    })
    digest = hashlib.sha256(SCRIPT.read_bytes()).hexdigest()
    manifest = OUTPUT / "voice.json"
    identity = {"provider": "mixed-offline-guide-voices", "local_model": MODEL, "script_sha256": digest,
                 "guides": {key: {"speaker": value["speaker"], "style": value["style"], "filters": value["filters"]}
                            for key, value in GUIDES.items()}, "spoken_variants": spoken_variants}
    if manifest.exists():
        existing = json.loads(manifest.read_text())
        if any(existing.get(key) != identity[key] for key in ("provider", "local_model", "script_sha256")) or any(
            existing.get("guides", {}).get(guide) != identity["guides"][guide] or
            existing.get("spoken_variants", {}).get(guide) != spoken_variants[guide]
            for guide in GUIDES
        ):
            raise ValueError("Guide voices or script changed. Regenerate the clips and update the manifest together.")
        identity["guides"].update({key: value for key, value in existing["guides"].items() if key not in GUIDES})
        identity["spoken_variants"].update({key: value for key, value in existing["spoken_variants"].items() if key not in GUIDES})
    from mlx_audio.tts.utils import load_model
    model = load_model(args.model)
    for guide in [args.guide] if args.guide else GUIDES:
        config = GUIDES[guide]
        folder = OUTPUT / guide
        folder.mkdir(parents=True, exist_ok=True)
        for number in args.scene if args.scene else range(1, 8):
            target = folder / f"{number:02d}-guide.m4a"
            if target.exists() and target.stat().st_size > 2000 and not args.scene:
                print(f"{guide} scene {number}: already exists", flush=True)
                continue
            print(f"Generating {guide} scene {number}/7", flush=True)
            results = list(model.generate_custom_voice(text=spoken_variants[guide].get(str(number), scripts[number - 1]), speaker=config["speaker"],
                                                        language="Japanese", instruct=config["style"], max_tokens=1100))
            if not results:
                raise RuntimeError(f"No audio for {guide} scene {number}")
            wave = np.concatenate([np.asarray(result.audio).squeeze() for result in results])
            rate = model.sample_rate
            if wave.ndim != 1 or len(wave) < rate or not np.all(np.isfinite(wave)):
                raise RuntimeError(f"Invalid audio for {guide} scene {number}")
            with tempfile.TemporaryDirectory() as directory:
                raw = Path(directory) / "raw.wav"
                encoded = Path(directory) / "encoded.m4a"
                sf.write(raw, np.clip(wave, -1, 1), rate)
                subprocess.run(["/opt/homebrew/bin/ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                                "-i", str(raw), "-af", config["filters"], "-c:a", "aac", "-b:a", "96k", str(encoded)], check=True)
                encoded.replace(target)
            print(f"Saved {target} ({len(wave) / rate:.1f}s)", flush=True)
    if all((OUTPUT / guide / f"{number:02d}-guide.m4a").is_file() for guide in GUIDES for number in range(1, 8)):
        manifest.write_text(json.dumps(identity, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("All three local guide voices complete", flush=True)


if __name__ == "__main__":
    main()
