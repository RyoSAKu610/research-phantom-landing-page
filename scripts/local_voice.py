"""Local reference-conditioned Japanese TTS. No Ondoku API requests.

Examples:
  .venv-tts/bin/python scripts/local_voice.py --text 'おはようございます。'
  .venv-tts/bin/python scripts/local_voice.py --all
  .venv-tts/bin/python scripts/local_voice.py --serve
"""

import argparse
import json
import hashlib
import math
import os
import re
import shutil
import subprocess
import tempfile
import threading
import webbrowser
from dataclasses import asdict, dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Callable

import numpy as np
import soundfile as sf


ROOT = Path(__file__).resolve().parent.parent
MODEL = "mlx-community/Qwen3-TTS-12Hz-1.7B-Base-6bit"


def default_model():
    bundle = os.environ.get("LOCAL_TTS_MODELS_DIR")
    return str(Path(bundle).expanduser() / "models/Base") if bundle else MODEL


DEFAULT_REFERENCE = ROOT / ".local-voice/reference.mp3"
DEFAULT_TRANSCRIPT = ROOT / ".local-voice/reference.txt"
SCRIPT_FILE = ROOT / "src/audio/narration.json"
REFERENCE_OUTPUT = ROOT / "src/audio/offline-reference"
PREVIEW_OUTPUT = ROOT / "src/audio/previews"


@dataclass(frozen=True)
class VoiceSettings:
    speed: float = 1.0
    pitch: float = 0.0
    expression: int = 50
    clarity: int = 50

    @classmethod
    def from_mapping(cls, values: dict | None = None) -> "VoiceSettings":
        if values is None:
            return cls()
        if not isinstance(values, dict) or set(values) != {"speed", "pitch", "expression", "clarity"}:
            raise ValueError("Specify speed, pitch, expression and clarity")
        ranges = {"speed": (0.8, 1.2), "pitch": (-2.0, 2.0), "expression": (0, 100), "clarity": (0, 100)}
        for name, (low, high) in ranges.items():
            number = values[name]
            try:
                valid = not isinstance(number, bool) and isinstance(number, (int, float)) and math.isfinite(float(number)) and low <= number <= high
            except (OverflowError, TypeError, ValueError):
                valid = False
            if not valid:
                raise ValueError(f"{name} must be between {low} and {high}")
        return cls(**values)


def audio_tool(name: str) -> str:
    candidate = shutil.which(name) or str(Path("/opt/homebrew/bin") / name)
    if not Path(candidate).is_file():
        raise RuntimeError(f"{name} is missing. Install it with: brew install ffmpeg")
    return candidate


def split_for_speech(text: str, limit: int = 220) -> list[str]:
    """Avoid cutting off long input at the model's generation-token limit."""
    sentences = re.findall(r"[^。！？.!?]+[。！？.!?]*\s*|[。！？.!?]+\s*", text)
    chunks: list[str] = []
    current = ""
    for sentence in sentences:
        sentence = sentence.lstrip()
        while len(sentence) > limit:
            if current:
                chunks.append(current)
                current = ""
            split = max(sentence.rfind("、", 0, limit), sentence.rfind("，", 0, limit)) + 1
            if split < limit // 2:
                split = limit
            chunks.append(sentence[:split])
            sentence = sentence[split:].strip()
        if sentence:
            if current and len(current) + len(sentence) > limit:
                chunks.append(current)
                current = ""
            current += sentence
    if current:
        chunks.append(current.strip())
    return chunks


class VoiceEngine:
    """Keep the same model and reference in memory for repeated local synthesis."""

    def __init__(self, reference: Path, transcript: Path, model_id: str = MODEL):
        if not reference.is_file() or not transcript.is_file():
            raise FileNotFoundError("Missing .local-voice/reference.mp3 or reference.txt")
        self.reference = reference.resolve()
        self.ref_text = transcript.read_text(encoding="utf-8").strip()
        if not self.ref_text:
            raise ValueError("The reference transcript must match the recording")
        from mlx_audio.tts.utils import load_model

        print(f"Loading voice model: {model_id}", flush=True)
        self.model = load_model(model_id)
        self.lock = threading.Lock()
        self.model_id = model_id

    def synthesize(self, text: str, settings: VoiceSettings = VoiceSettings()) -> bytes:
        text = text.strip()
        if not 1 <= len(text) <= 400:
            raise ValueError("Enter between 1 and 400 characters per clip")
        with self.lock:  # MLX caches are shared; one generation at a time.
            rate = self.model.sample_rate
            parts = []
            for phrase in split_for_speech(text):
                clips = list(self.model.generate(
                    text=phrase,
                    lang_code="Japanese",
                    ref_audio=str(self.reference),
                    ref_text=self.ref_text,
                    max_tokens=900,
                    temperature=0.9 + (settings.expression - 50) * 0.003,
                ))
                if len(clips) != 1:
                    raise RuntimeError("Local model did not return one clip")
                parts.append(np.asarray(clips[0].audio).squeeze())
            gap = np.zeros(round(rate * 0.18), dtype=np.float32)
            wave = np.concatenate([part for i, clip in enumerate(parts) for part in ([gap, clip] if i else [clip])])
            if wave.ndim != 1 or len(wave) < rate // 2 or not np.all(np.isfinite(wave)):
                raise RuntimeError("Generated audio is invalid or too short")
            if len(wave) > rate * 120:
                raise RuntimeError("Generated audio is unexpectedly long")
            with tempfile.TemporaryDirectory() as directory:
                raw = Path(directory) / "raw.wav"
                processed = Path(directory) / "clear.m4a"
                sf.write(raw, np.clip(wave, -1, 1), rate)
                filters = ["highpass=f=75", "lowpass=f=11000"]
                pitch_factor = 2 ** (settings.pitch / 12)
                if settings.pitch:
                    filters += [f"asetrate={round(rate * pitch_factor)}", f"aresample={rate}"]
                if settings.pitch or settings.speed != 1.0:
                    filters.append(f"atempo={settings.speed / pitch_factor:.5f}")
                if settings.clarity != 50:
                    filters.append(f"equalizer=f=3200:t=q:w=1:g={(settings.clarity - 50) * 0.05:.2f}")
                filters.append("loudnorm=I=-18:TP=-2:LRA=11")
                subprocess.run([
                    audio_tool("ffmpeg"), "-hide_banner", "-loglevel", "error", "-y", "-i", str(raw),
                    "-af", ",".join(filters),
                    "-c:a", "aac", "-b:a", "96k", str(processed),
                ], check=True)
                return processed.read_bytes()


def save_scenes(
    engine: VoiceEngine, indices: list[int], output: Path, publish: bool = False,
    settings: VoiceSettings = VoiceSettings(), progress: Callable[[int], None] | None = None,
):
    scripts = json.loads(SCRIPT_FILE.read_text(encoding="utf-8"))
    if len(scripts) != 7 or any(not isinstance(text, str) or not 1 <= len(text.strip()) <= 400 for text in scripts):
        raise ValueError("Seven scripts of 1–400 characters each are required")
    output.mkdir(parents=True, exist_ok=True)
    if publish:
        identity = {
            "model": engine.model_id,
            "script_sha256": hashlib.sha256(SCRIPT_FILE.read_bytes()).hexdigest(),
            "reference_sha256": hashlib.sha256(engine.reference.read_bytes()).hexdigest(),
            "transcript_sha256": hashlib.sha256(engine.ref_text.encode()).hexdigest(),
            "settings": asdict(settings),
        }
        staging = None
        for candidate in sorted(output.parent.glob("scene-tts-*"), key=lambda item: item.stat().st_mtime, reverse=True):
            try:
                if json.loads((candidate / ".generation.json").read_text()) == identity:
                    staging = candidate
                    break
            except (OSError, ValueError):
                continue
        if staging is None:
            staging = Path(tempfile.mkdtemp(prefix="scene-tts-", dir=output.parent))
            (staging / ".generation.json").write_text(json.dumps(identity) + "\n")
    else:
        staging = output
    for number in indices:
        target = staging / f"{number:02d}-local-reference.m4a"
        if publish and target.is_file() and target.stat().st_size > 2000:
            probe = subprocess.run([audio_tool("ffprobe"), "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(target)], capture_output=True, text=True)
            try:
                if probe.returncode == 0 and 3 < float(probe.stdout.strip()) < 120:
                    print(f"Scene {number}/7 already ready; resuming", flush=True)
                    if progress:
                        progress(number)
                    continue
            except ValueError:
                pass
        print(f"Synthesizing scene {number}/7…", flush=True)
        data = engine.synthesize(scripts[number - 1], settings)
        target.write_bytes(data)
        print(f"Scene {number}: {len(data)} bytes", flush=True)
        if progress:
            progress(number)
    if publish:
        # Only generated audio is packaged. The original reference MP3 stays local.
        manifest = {
            "provider": "local-qwen3-tts-reference",
            "model": engine.model_id.split("/")[-1],
            "voice": "user-reference",
            "sample_reference": True,
            "script_sha256": identity["script_sha256"],
            "settings": asdict(settings),
        }
        (staging / "voice.json").write_text(json.dumps(manifest, ensure_ascii=False) + "\n", encoding="utf-8")
        (staging / ".generation.json").unlink()
        previous = Path(tempfile.mkdtemp(prefix="scene-previous-", dir=output.parent))
        previous.rmdir()
        try:
            if output.exists():
                output.rename(previous)
            staging.rename(output)
        except Exception:
            if previous.exists() and not output.exists():
                previous.rename(output)
            raise
        if previous.exists():
            shutil.rmtree(previous)
        print("All seven local reference-voice clips are ready for npm run build.", flush=True)


def serve(engine: VoiceEngine, port: int, open_browser: bool = False):
    page = (ROOT / "scripts/local_voice_studio.html").read_bytes()
    allowed_origin = f"http://127.0.0.1:{port}"
    job = {"state": "idle", "scene": 0, "message": "", "error": ""}
    job_lock = threading.Lock()

    def update_job(**values):
        with job_lock:
            job.update(values)

    def render_scenes(settings: VoiceSettings):
        try:
            npm = shutil.which("npm")
            if npm is None:
                npm = next((str(path) for path in sorted(Path.home().glob(".local/opt/node-*/bin/npm"), reverse=True)), None)
            if npm is None:
                raise RuntimeError("Node.jsとnpmを導入して、もう一度お試しください。")
            environment = dict(os.environ)
            environment["PATH"] = str(Path(npm).parent) + os.pathsep + environment.get("PATH", "")
            if not (ROOT / "node_modules").is_dir():
                update_job(message="HTML用の依存関係を初期設定中…")
                subprocess.run([npm, "ci", "--no-audit", "--no-fund"], cwd=ROOT, env=environment, capture_output=True, text=True, check=True, timeout=300)
            update_job(message="7場面の音声を合成中…")
            save_scenes(
                engine, list(range(1, 8)), REFERENCE_OUTPUT, publish=True, settings=settings,
                progress=lambda number: update_job(scene=number, message=f"場面 {number} / 7 の音声が完成"),
            )
            update_job(message="オフラインHTMLを作成中…")
            result = subprocess.run([npm, "run", "build"], cwd=ROOT, env=environment, capture_output=True, text=True, timeout=180)
            if result.returncode:
                raise RuntimeError("HTMLのビルドに失敗しました。ターミナルで npm run build を確認してください。\n" + result.stderr[-500:])
            update_job(state="complete", message="参照音声の7本を保存し、案内役つきHTMLを更新しました。")
        except Exception as error:
            print(f"Scene render error: {error}", flush=True)
            detail = error.stderr[-500:] if isinstance(error, subprocess.CalledProcessError) and error.stderr else str(error)
            update_job(state="error", error=detail, message="再生成できませんでした。")

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/":
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(page)))
                self.end_headers()
                self.wfile.write(page)
            elif self.path == "/health":
                self.respond_json(200, {"ready": True, "engine": "local-qwen3-tts-reference"})
            elif self.path == "/scenes":
                self.respond_json(200, json.loads(SCRIPT_FILE.read_text(encoding="utf-8")))
            elif self.path == "/render-status":
                with job_lock:
                    result = dict(job)
                self.respond_json(200, result)
            elif self.path in ("/download/react", "/download/standalone"):
                filename, source = ("researchphantom-react-offline.html", ROOT / "dist/index.html") if self.path.endswith("react") else ("researchphantom-direct-offline.html", ROOT / "standalone-offline.html")
                if not source.is_file():
                    self.send_error(404, "Run the HTML build first")
                    return
                output = source.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(output)))
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                self.end_headers()
                self.wfile.write(output)
            else:
                self.send_error(404)

        def respond_json(self, code, result):
            body = json.dumps(result, ensure_ascii=False).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            if self.path not in ("/synthesize", "/render-scenes"):
                self.send_error(404)
                return
            if self.headers.get("Origin") != allowed_origin:
                self.send_error(403, "Use the local studio page")
                return
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                self.send_error(415)
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length < 4096:
                    raise ValueError("Request too large")
                request = json.loads(self.rfile.read(length))
                if not isinstance(request, dict):
                    raise ValueError("The request must be a JSON object")
                settings = VoiceSettings.from_mapping(request.get("controls"))
                if self.path == "/render-scenes":
                    with job_lock:
                        if job["state"] == "running":
                            self.respond_json(409, {"error": "Seven-scene generation is already running"})
                            return
                        job.update(state="running", scene=0, message="生成を開始しています…", error="")
                    threading.Thread(target=render_scenes, args=(settings,), daemon=True).start()
                    self.respond_json(202, {"started": True})
                    return
                with job_lock:
                    if job["state"] == "running":
                        self.respond_json(409, {"error": "7場面を生成中です。完了までお待ちください。"})
                        return
                text = request["text"]
                if not isinstance(text, str):
                    raise ValueError("Text must be a string")
                clip = engine.synthesize(text, settings)
            except (ValueError, KeyError, json.JSONDecodeError) as error:
                self.respond_json(400, {"error": str(error)})
                return
            except Exception as error:
                print(f"Synthesis error: {error}", flush=True)
                self.respond_json(500, {"error": "Local voice generation failed"})
                return
            self.send_response(200)
            self.send_header("Content-Type", "audio/mp4")
            self.send_header("Content-Length", str(len(clip)))
            self.send_header("Content-Disposition", 'attachment; filename="local-voice.m4a"')
            self.end_headers()
            self.wfile.write(clip)

    try:
        server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    except OSError as error:
        raise SystemExit(f"Could not start the voice studio on port {port}: {error}") from error
    print(f"Offline voice studio: {allowed_origin}/ (Ctrl+C to stop)", flush=True)
    if open_browser:
        webbrowser.open(f"{allowed_origin}/")
    server.serve_forever()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument("--all", action="store_true", help="Generate the seven site scenes")
    selection.add_argument("--scene", type=int, choices=range(1, 8), help="Preview one scene")
    selection.add_argument("--text", help="Generate a new sentence offline")
    selection.add_argument("--text-file", type=Path, help="Read one new sentence from UTF-8 file")
    selection.add_argument("--serve", action="store_true", help="Launch the local browser studio")
    parser.add_argument("--output", type=Path, help="Output filename for --text/--text-file")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--open", action="store_true", help="Open the browser after starting --serve")
    parser.add_argument("--reference", type=Path, default=DEFAULT_REFERENCE)
    parser.add_argument("--transcript", type=Path, default=DEFAULT_TRANSCRIPT)
    parser.add_argument("--model", default=default_model(), help="Model ID or restored models/Base path (LOCAL_TTS_MODELS_DIR also supported)")
    parser.add_argument("--speed", type=float, default=1.0, help="Speaking rate from 0.8 to 1.2")
    parser.add_argument("--pitch", type=float, default=0.0, help="Pitch shift in semitones from -2 to 2")
    parser.add_argument("--expression", type=int, default=50, help="Sampling variation from 0 to 100")
    parser.add_argument("--clarity", type=int, default=50, help="Presence EQ from 0 to 100")
    args = parser.parse_args()
    try:
        settings = VoiceSettings.from_mapping({"speed": args.speed, "pitch": args.pitch, "expression": args.expression, "clarity": args.clarity})
    except ValueError as error:
        parser.error(str(error))
    text = None
    if args.text is not None:
        text = args.text
    elif args.text_file is not None:
        try:
            text = args.text_file.read_text(encoding="utf-8")
        except OSError as error:
            parser.error(f"Could not read the text file: {error}")
    if text is not None and not 1 <= len(text.strip()) <= 400:
        parser.error("Enter between 1 and 400 characters per clip")
    engine = VoiceEngine(args.reference, args.transcript, args.model)
    if args.serve:
        serve(engine, args.port, args.open)
    elif args.all:
        save_scenes(engine, list(range(1, 8)), REFERENCE_OUTPUT, publish=True, settings=settings)
    elif args.scene:
        save_scenes(engine, [args.scene], PREVIEW_OUTPUT, settings=settings)
    else:
        output = args.output or ROOT / ".local-voice/outputs/local-voice.m4a"
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(engine.synthesize(text, settings))
        print(f"Saved {output}")


if __name__ == "__main__":
    main()
