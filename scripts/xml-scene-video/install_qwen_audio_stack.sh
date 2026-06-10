#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:${PATH}"
export PYTORCH_ENABLE_MPS_FALLBACK=1
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PRELOAD="${1:-}"
ALIGNER_HOME="${QWEN3_FORCED_ALIGNER_HOME:-$HOME/.openclaw/tools/qwen3-forced-aligner}"
VOICEOVER_INSTALL="${QWEN3_VOICEOVER_INSTALL:-$HOME/.openclaw/workspace-ralph/skills/qwen3-voiceover/scripts/install.sh}"

if [ ! -x "$VOICEOVER_INSTALL" ]; then
  echo "Qwen3 voiceover installer not found at: $VOICEOVER_INSTALL" >&2
  echo "Set QWEN3_VOICEOVER_INSTALL to the qwen3-voiceover install.sh path." >&2
  exit 1
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required but not found on PATH." >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required but not found on PATH." >&2
  exit 1
fi

bash "$VOICEOVER_INSTALL" --preload-default

mkdir -p "$ALIGNER_HOME"
if [ ! -d "$ALIGNER_HOME/.venv" ]; then
  uv venv --python 3.12 "$ALIGNER_HOME/.venv"
fi

# shellcheck disable=SC1091
source "$ALIGNER_HOME/.venv/bin/activate"
uv pip install -U pip setuptools wheel
uv pip install -U qwen-asr huggingface_hub soundfile

python - <<'PY'
import torch
print('Forced aligner runtime ready')
print('torch', torch.__version__)
print('mps_built', torch.backends.mps.is_built())
print('mps_available', torch.backends.mps.is_available())
PY

if [ "$PRELOAD" = "--preload" ]; then
  python - <<'PY'
import torch
from qwen_asr import Qwen3ASRModel

if torch.backends.mps.is_available():
    device = 'mps'
    dtype = torch.float32
elif torch.cuda.is_available():
    device = 'cuda:0'
    dtype = torch.bfloat16
else:
    device = 'cpu'
    dtype = torch.float32

Qwen3ASRModel.from_pretrained(
    'Qwen/Qwen3-ASR-0.6B',
    dtype=dtype,
    device_map=device,
    max_inference_batch_size=1,
    max_new_tokens=512,
    forced_aligner='Qwen/Qwen3-ForcedAligner-0.6B',
    forced_aligner_kwargs={
        'dtype': dtype,
        'device_map': device,
    },
)
print('Preloaded Qwen/Qwen3-ASR-0.6B + Qwen/Qwen3-ForcedAligner-0.6B')
PY
fi

echo "Qwen3 audio stack is installed."
echo "- TTS: via $VOICEOVER_INSTALL"
echo "- Forced aligner: $ALIGNER_HOME"
