#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PROMPT=$(cat <<'EOF'
Run the full tidy-up chain (all steps), in this order:

1) Execute the /test-ts workflow end-to-end as written in .agent/workflows/test-ts.md.
2) Execute the /roadmap-node-orchestration workflow end-to-end as written in .agent/workflows/roadmap-node-orchestration.md.
   - Treat this as mandatory, not optional.
   - Include every field from the required output block defined in that workflow.
3) Execute the /session-ritual workflow end-to-end as written in .agent/workflows/session-ritual.md.
   - For dependency sync, use `git status --porcelain` to list modified files.
   - Run: npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync path/to/modified_file
   - Skip deleted files and non-code files.
   - Perform the mandatory roadmap-node orchestration checkpoint from session-ritual Step 4.
   - Perform the mandatory user-profile calibration checkpoint from session-ritual Step 5.
4) Execute /codexception to extract any reusable learnings from this tidy-up run.

Rules:
- Follow the workflows exactly; do not skip steps unless a prerequisite fails.
- Use sub-agents for independent analysis-only checkpoints when possible (for example session-ritual parallel branches), but never parallelize dependency-gated steps or overlapping file mutations.
- Do not mark tidy-up complete if the roadmap-node orchestration report block is missing.
- If no terminal learnings are found, explicitly say so.
- For /review-session (Phase 1), propose TODOs only; do not edit files.
- Summarize what ran and stop.
EOF
)

codex exec "$@" "$PROMPT"
