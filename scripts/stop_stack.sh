#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$SCRIPT_DIR"
FRONTEND_PID_FILE="$PID_DIR/frontend-dev.pid"
BACKEND_PID_FILE="$PID_DIR/backend-dev.pid"

stop_process() {
	local pid_file="$1"
	local label="$2"

	if [[ ! -f "$pid_file" ]]; then
		echo "$label is not running."
		return
	fi

	local raw pid pgid
	raw=$(<"$pid_file")
	IFS=' :'
	read -r pid pgid <<<"$raw" || true
	IFS=' \t\n'
	if [[ -z "${pid:-}" ]]; then
		rm -f "$pid_file"
		return
	fi
	pgid="${pgid:-$pid}"

	if ! kill -0 "$pid" >/dev/null 2>&1 && ! kill -0 -- -"$pgid" >/dev/null 2>&1; then
		echo "$label recorded pid $pid but process is already stopped."
		rm -f "$pid_file"
		return
	fi

	echo "Stopping $label (pid $pid, pgid $pgid)..."
	kill -- -"$pgid" >/dev/null 2>&1 || true
	kill "$pid" >/dev/null 2>&1 || true

	for _ in {1..10}; do
		if ! kill -0 "$pid" >/dev/null 2>&1 && ! kill -0 -- -"$pgid" >/dev/null 2>&1; then
			break
		fi
		sleep 0.3
	done

	if kill -0 "$pid" >/dev/null 2>&1 || kill -0 -- -"$pgid" >/dev/null 2>&1; then
		echo "$label did not exit; sending SIGKILL."
		kill -9 -- -"$pgid" >/dev/null 2>&1 || true
		kill -9 "$pid" >/dev/null 2>&1 || true
	fi

	rm -f "$pid_file"
	echo "$label stopped."
}

stop_process "$FRONTEND_PID_FILE" "Frontend"
stop_process "$BACKEND_PID_FILE" "Backend"

echo "Stack stopped."
