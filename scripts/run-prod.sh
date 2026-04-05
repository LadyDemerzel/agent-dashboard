#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-3000}"
RUN_DIR="$ROOT_DIR/.run"
PID_FILE="$RUN_DIR/agent-dashboard.pid"
LOG_FILE="$RUN_DIR/agent-dashboard.log"

mkdir -p "$RUN_DIR"

if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID="$(cat "$PID_FILE")"
  if kill -0 "$EXISTING_PID" 2>/dev/null; then
    echo "Agent Dashboard is already running (PID $EXISTING_PID)."
    echo "URL: http://$HOST:$PORT"
    echo "Log: $LOG_FILE"
    exit 0
  fi

  rm -f "$PID_FILE"
fi

echo "Building Agent Dashboard..."
npm run build

echo "Starting Agent Dashboard in the background on $HOST:$PORT ..."
nohup ./node_modules/.bin/next start --hostname "$HOST" --port "$PORT" >"$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"

sleep 3

if kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "Agent Dashboard running."
  echo "PID: $SERVER_PID"
  echo "URL: http://$HOST:$PORT"
  echo "Log: $LOG_FILE"
  exit 0
fi

echo "Agent Dashboard failed to start. Recent log output:"
tail -n 80 "$LOG_FILE" || true
rm -f "$PID_FILE"
exit 1
