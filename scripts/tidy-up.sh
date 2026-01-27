#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PROMPT=$(cat <<'EOF'
Run the full tidy-up chain (all steps), in this order:

1) Execute the /test-ts workflow end-to-end as written in .agent/workflows/test-ts.md.
2) Execute the /session-ritual workflow end-to-end as written in .agent/workflows/session-ritual.md.
   - For dependency sync, use `git status --porcelain` to list modified files.
   - Run: npx tsx scripts/codebase-visualizer-server.ts --sync path/to/modified_file
   - Skip deleted files and non-code files.
3) Execute /codexception to extract any reusable learnings from this tidy-up run.

Rules:
- Follow the workflows exactly; do not skip steps unless a prerequisite fails.
- If no terminal learnings are found, explicitly say so.
- For /review-session (Phase 1), propose TODOs only; do not edit files.
- Summarize what ran and stop.
EOF
)

codex exec "$@" "$PROMPT"
