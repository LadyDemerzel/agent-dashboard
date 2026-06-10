#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:${PATH}"
export PYTORCH_ENABLE_MPS_FALLBACK=1
TOOL_ROOT="${QWEN3_FORCED_ALIGNER_HOME:-$HOME/.openclaw/tools/qwen3-forced-aligner}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "$TOOL_ROOT/.venv/bin/activate" ]; then
  echo "Qwen3 forced aligner is not installed yet. Run: $SCRIPT_DIR/install_qwen_audio_stack.sh --preload" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required but not found on PATH." >&2
  exit 1
fi

# shellcheck disable=SC1091
source "$TOOL_ROOT/.venv/bin/activate"
exec python "$SCRIPT_DIR/qwen_forced_align.py" "$@"
