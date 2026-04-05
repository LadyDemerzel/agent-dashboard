#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
PID_FILE="$RUN_DIR/agent-dashboard.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "Agent Dashboard is not running (no PID file found)."
  exit 0
fi

PID="$(cat "$PID_FILE")"

if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "Stopped Agent Dashboard (PID $PID)."
else
  echo "PID file existed, but process $PID was not running."
fi

rm -f "$PID_FILE"
