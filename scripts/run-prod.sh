#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

USER_HOME="$(cd "$ROOT_DIR/../../.." && pwd)"
export HOME="${DASHBOARD_HOME:-$USER_HOME}"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-3000}"
RUN_DIR="$ROOT_DIR/.run"
PID_FILE="$RUN_DIR/agent-dashboard.pid"
LOG_FILE="$RUN_DIR/agent-dashboard.log"
LSOF_BIN="${LSOF_BIN:-$(command -v lsof || true)}"
TMUX_BIN="${TMUX_BIN:-$(command -v tmux || true)}"
TMUX_SESSION="${TMUX_SESSION:-agent-dashboard-prod}"

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

mkdir -p "$RUN_DIR"

if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID="$(cat "$PID_FILE")"
  if is_dashboard_pid "$EXISTING_PID"; then
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
LAUNCH_PID=""

if [[ -n "$TMUX_BIN" ]]; then
  "$TMUX_BIN" kill-session -t "$TMUX_SESSION" 2>/dev/null || true
  "$TMUX_BIN" new-session -d -s "$TMUX_SESSION" -c "$ROOT_DIR" \
    "exec ./node_modules/.bin/next start --hostname '$HOST' --port '$PORT' > '$LOG_FILE' 2>&1"
else
  nohup ./node_modules/.bin/next start --hostname "$HOST" --port "$PORT" >"$LOG_FILE" 2>&1 < /dev/null &
  LAUNCH_PID=$!
  echo "$LAUNCH_PID" > "$PID_FILE"
fi

for _ in {1..20}; do
  if curl -fsS "http://127.0.0.1:$PORT/api/status" >/dev/null 2>&1; then
    SERVER_PID="$(resolve_dashboard_pid || true)"
    if [[ -n "$SERVER_PID" ]]; then
      echo "$SERVER_PID" > "$PID_FILE"
    fi
    echo "Agent Dashboard running."
    echo "PID: ${SERVER_PID:-$LAUNCH_PID}"
    echo "URL: http://$HOST:$PORT"
    echo "Log: $LOG_FILE"
    exit 0
  fi

  if [[ -n "$LAUNCH_PID" ]] && ! kill -0 "$LAUNCH_PID" 2>/dev/null; then
    break
  fi

  sleep 1
done

echo "Agent Dashboard failed to start. Recent log output:"
tail -n 80 "$LOG_FILE" || true
if [[ -n "$LAUNCH_PID" ]] && kill -0 "$LAUNCH_PID" 2>/dev/null; then
  kill "$LAUNCH_PID" 2>/dev/null || true
fi
if [[ -n "$TMUX_BIN" ]]; then
  "$TMUX_BIN" kill-session -t "$TMUX_SESSION" 2>/dev/null || true
fi
rm -f "$PID_FILE"
exit 1
