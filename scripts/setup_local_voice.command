#!/bin/zsh
set -e

cd "${0:A:h:h}"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"

if [[ "$(uname -s)" != "Darwin" || "$(uname -m)" != "arm64" ]]; then
  print 'このローカル音声合成はApple Silicon搭載Mac用です。内蔵HTMLの音声再生は他の端末でも利用できます。'
  exit 1
fi
if ! command -v ffmpeg >/dev/null; then
  print 'ffmpegが必要です。Homebrewを導入済みなら「brew install ffmpeg」を実行してください。'
  exit 1
fi
if ! command -v uv >/dev/null; then
  print 'uvが必要です。Homebrewを導入済みなら「brew install uv」を実行してください。'
  exit 1
fi
if [[ ! -f .local-voice/reference.mp3 || ! -f .local-voice/reference.txt ]]; then
  print '参照音声がありません。.local-voice/reference.mp3 と .local-voice/reference.txt を用意してください。'
  print '原本は配布用ZIPには含めていません。詳しくは ONDOKU_SETUP.md を参照してください。'
  exit 1
fi

if [[ ! -x .venv-tts/bin/python ]]; then
  uv venv --python 3.11 .venv-tts
fi
if ! .venv-tts/bin/python -c 'from importlib.metadata import version; assert version("mlx-audio") == "0.5.5" and version("soundfile") == "0.14.0"' >/dev/null 2>&1; then
  uv pip install --python .venv-tts/bin/python -r scripts/voice-requirements.txt
fi
print '準備完了。初回のモデル取得後は、ローカルで繰り返し音声を作成できます。'
