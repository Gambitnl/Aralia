#!/usr/bin/env bash

# This script starts Aralia whenever a Codespace is created or resumed.
#
# The server binds to every container interface so GitHub can forward port
# 3000. A small PID record prevents duplicate Vite processes after resume. Logs
# stay in ignored scratch storage and can be inspected from the terminal.

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
scratch_dir="$repo_root/.agent/scratch/codespaces"
pid_file="$scratch_dir/vite.pid"
log_file="$scratch_dir/vite.log"

mkdir -p "$scratch_dir"
cd "$repo_root"

# Reuse the existing server only when its recorded process is still alive.
# A stale PID file is harmless and is replaced by the new process below.
if [[ -f "$pid_file" ]]; then
  existing_pid="$(<"$pid_file")"
  if [[ "$existing_pid" =~ ^[0-9]+$ ]] && kill -0 "$existing_pid" 2>/dev/null; then
    printf 'Aralia is already running as process %s.\n' "$existing_pid"
    exit 0
  fi
fi

# The background process survives the lifecycle command. Codespaces forwards
# port 3000 privately and shows the link in its Ports panel.
nohup npm run dev -- --host 0.0.0.0 --port 3000 >"$log_file" 2>&1 &
server_pid=$!
printf '%s\n' "$server_pid" >"$pid_file"

printf 'Aralia started as process %s. Logs: %s\n' "$server_pid" "$log_file"
printf '%s\n' 'Open /Aralia/misc/design.html?step=herolab on forwarded port 3000 for Hero Lab.'
