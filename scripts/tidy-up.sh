#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PROMPT=$(cat <<'EOF'
Run the full tidy-up chain (all steps), in this order:

1) Execute the /test-ts workflow end-to-end as written in .agent/workflows/test-ts.md.
2) Execute the /session-ritual workflow end-to-end as written in .agent/workflows/session-ritual.md.
   - For dependency sync, use `git status --porcelain` to list modified files.
   - Run: npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync path/to/modified_file
   - Skip deleted files and non-code files.
   - Perform the mandatory "Update Roadmap State" checkpoint from session-ritual Step 3.
   - Include the required roadmap report block in your final tidy-up summary:
     - Roadmap Update: yes|no (with reason)
     - Roadmap Files Reviewed: <paths>
     - Roadmap Files Updated: <paths or none>
     - Status/Naming Corrections Applied: <list or none>
     - Open Follow-ups: <list or none>
3) Execute /codexception to extract any reusable learnings from this tidy-up run.

Rules:
- Follow the workflows exactly; do not skip steps unless a prerequisite fails.
- Do not mark tidy-up complete if the roadmap report block is missing.
- If no terminal learnings are found, explicitly say so.
- For /review-session (Phase 1), propose TODOs only; do not edit files.
- Summarize what ran and stop.
EOF
)

codex exec "$@" "$PROMPT"
