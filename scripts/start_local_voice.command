#!/bin/zsh
set -e

cd "${0:A:h:h}"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"
if /usr/bin/curl -fsS --max-time 2 http://127.0.0.1:8765/health 2>/dev/null | /usr/bin/grep -q '"engine": "local-qwen3-tts-reference"'; then
  print '音声スタジオは起動済みです。ブラウザで開きます。'
  open 'http://127.0.0.1:8765/'
  exit 0
fi
"$PWD/scripts/setup_local_voice.command"
exec .venv-tts/bin/python scripts/local_voice.py --serve --open
