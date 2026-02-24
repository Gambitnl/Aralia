#!/usr/bin/env bash
# Syncs .agent/workflows/track-*.md files from .claude/commands/conductor-*.md sources.
# The conductor files in .claude/commands/ are the canonical versions;
# the track files in .agent/workflows/ are mirrors for universal agent access.
#
# Usage: bash scripts/sync-track-workflows.sh [--dry-run]

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SRC="$ROOT/.claude/commands"
DST="$ROOT/.agent/workflows"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

# Mapping: "conductor-source|track-dest" pairs
PAIRS=(
  "conductor-setup.md|track-setup.md"
  "conductor-status.md|track-status.md"
  "conductor-implement.md|track-implement.md"
  "conductor-newtrack.md|track-plan.md"
  "conductor-revert.md|track-revert.md"
)

synced=0
skipped=0

for pair in "${PAIRS[@]}"; do
  src_name="${pair%%|*}"
  dst_name="${pair##*|}"
  src_file="$SRC/$src_name"
  dst_file="$DST/$dst_name"

  if [[ ! -f "$src_file" ]]; then
    echo "SKIP  $src_name (source not found)"
    skipped=$((skipped + 1))
    continue
  fi

  if [[ -f "$dst_file" ]] && diff -q "$src_file" "$dst_file" > /dev/null 2>&1; then
    echo "OK    $dst_name (already in sync)"
    skipped=$((skipped + 1))
    continue
  fi

  if $DRY_RUN; then
    echo "WOULD $dst_name <- $src_name"
  else
    cp "$src_file" "$dst_file"
    echo "SYNC  $dst_name <- $src_name"
  fi
  synced=$((synced + 1))
done

echo ""
echo "Done: $synced synced, $skipped unchanged."
