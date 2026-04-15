#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3000}"
RUN_DIR="$ROOT_DIR/.run"
PID_FILE="$RUN_DIR/agent-dashboard.pid"
LSOF_BIN="${LSOF_BIN:-$(command -v lsof || true)}"

if [[ -z "$LSOF_BIN" && -x /usr/sbin/lsof ]]; then
  LSOF_BIN="/usr/sbin/lsof"
fi

if [[ -z "$LSOF_BIN" ]]; then
  echo "lsof is required to manage the Agent Dashboard process." >&2
  exit 1
fi

get_pid_command() {
  ps -p "$1" -o command= 2>/dev/null || true
}

get_pid_cwd() {
  "$LSOF_BIN" -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1
}

is_dashboard_pid() {
  local pid="$1"
  local command cwd

  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" 2>/dev/null || return 1

  command="$(get_pid_command "$pid")"
  cwd="$(get_pid_cwd "$pid")"

  [[ "$cwd" == "$ROOT_DIR" ]] || return 1
  [[ "$command" == *"next-server"* || "$command" == *"next/dist/bin/next"* ]]
}

resolve_dashboard_pid() {
  local pid

  while IFS= read -r pid; do
    [[ -n "$pid" ]] || continue

    if is_dashboard_pid "$pid"; then
      printf '%s\n' "$pid"
      return 0
    fi
  done < <("$LSOF_BIN" -Pan -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)

  return 1
}

if [[ ! -f "$PID_FILE" ]]; then
  PID="$(resolve_dashboard_pid || true)"
  if [[ -z "$PID" ]]; then
    echo "Agent Dashboard is not running (no PID file found)."
    exit 0
  fi
else
  PID="$(cat "$PID_FILE")"
fi

if ! is_dashboard_pid "$PID"; then
  RESOLVED_PID="$(resolve_dashboard_pid || true)"
  if [[ -n "$RESOLVED_PID" ]]; then
    PID="$RESOLVED_PID"
  fi
fi

if is_dashboard_pid "$PID"; then
  kill "$PID" 2>/dev/null || true
  for _ in {1..10}; do
    if ! kill -0 "$PID" 2>/dev/null; then
      break
    fi

    sleep 1
  done

  if kill -0 "$PID" 2>/dev/null; then
    kill -9 "$PID" 2>/dev/null || true
  fi

  echo "Stopped Agent Dashboard (PID $PID)."
else
  echo "PID file existed, but process $PID was not running."
fi

rm -f "$PID_FILE"
