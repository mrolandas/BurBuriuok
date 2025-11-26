#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_DIR="$SCRIPT_DIR"
FRONTEND_PID_FILE="$PID_DIR/frontend-dev.pid"
BACKEND_PID_FILE="$PID_DIR/backend-dev.pid"
SUPABASE_CHECK="$REPO_ROOT/tests/checkSupabaseConnection.mjs"
AUTH_TABLE_CHECK="$REPO_ROOT/tests/checkAuthProfilesReady.mjs"
FRONTEND_DIR="$REPO_ROOT/frontend"
BACKEND_CMD=(npm run backend:dev)
FRONTEND_CMD=(npm run dev -- --host)
LOG_DIR="$REPO_ROOT/logs"
FRONTEND_LOG="$LOG_DIR/frontend.log"
BACKEND_LOG="$LOG_DIR/backend.log"
DEV_URL="http://localhost:5173"
BACKEND_URL="http://localhost:4000/health"

mkdir -p "$LOG_DIR"

: >"$BACKEND_LOG"
: >"$FRONTEND_LOG"

ensure_not_running() {
	local pid_file="$1"
	if [[ -f "$pid_file" ]]; then
		local existing_pid existing_pgid raw
		raw=$(<"$pid_file")
		IFS=' :'
		read -r existing_pid existing_pgid <<<"$raw" || true
		IFS=' \t\n'
		if [[ -z "${existing_pid:-}" ]]; then
			rm -f "$pid_file"
			return
		fi
		existing_pgid="${existing_pgid:-$existing_pid}"
		if { kill -0 "$existing_pid" >/dev/null 2>&1; } || { kill -0 -- -"$existing_pgid" >/dev/null 2>&1; }; then
			echo "Process defined in $pid_file already running (pid $existing_pid)."
			echo "Use scripts/stop_stack.sh to stop the stack before starting a new one."
			exit 1
		else
			rm -f "$pid_file"
		fi
	fi
}

ensure_not_running "$FRONTEND_PID_FILE"
ensure_not_running "$BACKEND_PID_FILE"

ensure_port_free() {
	local port="$1"
	local label="$2"
	if command -v lsof >/dev/null 2>&1; then
		if lsof -ti tcp:"$port" >/dev/null 2>&1; then
			echo "$label port $port is already in use. Free the port or run scripts/stop_stack.sh before retrying."
			exit 1
		fi
	elif command -v ss >/dev/null 2>&1; then
		if ss -tulpn | grep -q ":$port"; then
			echo "$label port $port is already in use. Free the port or run scripts/stop_stack.sh before retrying."
			exit 1
		fi
	fi
}

ensure_port_free 4000 "Backend"
ensure_port_free 5173 "Frontend"

echo "Checking Supabase connectivity..."
node "$SUPABASE_CHECK"

echo "Verifying auth/profile tables..."
node "$AUTH_TABLE_CHECK"

echo "Starting backend (logs: $BACKEND_LOG)..."
cd "$REPO_ROOT"
"${BACKEND_CMD[@]}" &>>"$BACKEND_LOG" &
BACKEND_PID=$!
BACKEND_PGID=$(ps -o pgid= -p "$BACKEND_PID" | tr -d ' ' || true)
BACKEND_PGID="${BACKEND_PGID:-$BACKEND_PID}"
echo "$BACKEND_PID $BACKEND_PGID" >"$BACKEND_PID_FILE"

echo "Starting frontend (logs: $FRONTEND_LOG)..."
cd "$FRONTEND_DIR"
"${FRONTEND_CMD[@]}" &>>"$FRONTEND_LOG" &
FRONTEND_PID=$!
FRONTEND_PGID=$(ps -o pgid= -p "$FRONTEND_PID" | tr -d ' ' || true)
FRONTEND_PGID="${FRONTEND_PGID:-$FRONTEND_PID}"
echo "$FRONTEND_PID $FRONTEND_PGID" >"$FRONTEND_PID_FILE"

echo "Stack is booting."
echo "Frontend: $DEV_URL"
echo "Backend health: $BACKEND_URL"
echo "Check logs with: tail -f $FRONTEND_LOG $BACKEND_LOG"
