"""Generate seven offline narration clips with the local Qwen3-TTS / MLX engine.

Run from the repository root with .venv-tts/bin/python. Model weights are
downloaded once and cached; later inference does not contact a service.
"""

import argparse
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MODEL = "mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-6bit"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--speaker", default="Ono_Anna")
    parser.add_argument(
        "--style",
        default="落ち着いた知的な日本語ナレーション。明瞭な発音で、専門用語を一語ずつ丁寧に、自然な間を取りながら忠実に読み上げる。声を張り上げず、速すぎない。",
    )
    parser.add_argument("--scene", type=int, choices=range(1, 8), help="Generate only one scene for review")
    parser.add_argument("--output", type=Path, default=ROOT / "src/audio/offline")
    args = parser.parse_args()

    scripts = json.loads((ROOT / "src/audio/narration.json").read_text())
    if len(scripts) != 7:
        raise ValueError("Expected exactly seven narration scripts")

    from mlx_audio.tts.utils import load_model

    model = load_model(args.model)
    args.output.mkdir(parents=True, exist_ok=True)
    scene_numbers = [args.scene] if args.scene else range(1, 8)
    for number in scene_numbers:
        text = scripts[number - 1]
        print(f"Scene {number:02d}/07: {text}", flush=True)
        result = list(model.generate_custom_voice(
            text=text,
            speaker=args.speaker,
            language="Japanese",
            instruct=args.style,
        ))
        if not result:
            raise RuntimeError(f"No audio for scene {number}")
        wave = np.asarray(result[0].audio).squeeze()
        sample_rate = model.sample_rate
        if wave.ndim != 1 or len(wave) < sample_rate or not np.all(np.isfinite(wave)):
            raise RuntimeError(f"Invalid or too-short audio for scene {number}")

        # Gentle normalization and high-pass EQ emphasize intelligibility
        # without claiming to change or reproduce the speaker's identity.
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp) / "generated.wav"
            sf.write(raw, np.clip(wave, -1, 1), sample_rate)
            target = args.output / f"{number:02d}-local-qwen.m4a"
            subprocess.run([
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(raw),
                "-af", "highpass=f=75,lowpass=f=11000,loudnorm=I=-18:TP=-2:LRA=11",
                "-c:a", "aac", "-b:a", "96k", str(target),
            ], check=True)
            print(f"Saved {target} ({len(wave) / sample_rate:.1f}s)", flush=True)


if __name__ == "__main__":
    main()
