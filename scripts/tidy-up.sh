#!/usr/bin/env bash
set -euo pipefail

# This launcher turns the tracked tidy-up workflow into mode-specific Codex CLI
# prompts. Active Codex Desktop sessions should read the workflow doc directly,
# because they already have the conversation history that tidy-up needs.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE="${1:-standard}"
if [[ $# -gt 0 ]]; then
  shift
fi

PRINT_ONLY=false
if [[ "${1:-}" == "--print" ]]; then
  PRINT_ONLY=true
  shift
fi

case "$MODE" in
  light|standard|full|push)
    ;;
  -h|--help|help)
    cat <<'EOF'
Usage: bash scripts/tidy-up.sh <mode> [--print] [codex exec args...]

Modes:
  light     Docs/comments/local notes/tiny metadata.
  standard  Ordinary code, data, tests, or user-facing behavior changes.
  full      Shared-system, workflow, tooling, hook, package-script, roadmap, or agent-doc changes.
  push      Push preparation, Git/worktree cleanup, hook repair, or sync blocker checks.

Use --print to display the generated prompt without launching Codex.
EOF
    exit 0
    ;;
  *)
    echo "Unknown tidy-up mode: $MODE" >&2
    echo "Expected one of: light, standard, full, push" >&2
    exit 2
    ;;
esac

# These shared instructions keep every mode aligned with the tracked workflow
# location and the local-only .agent/workflows boundary.
COMMON_HEADER=$(cat <<'EOF'
Tracked workflow docs live in public/agent-docs/workflows/.
The .agent/workflows/ directory is local-only and ignored by Git; use it only for local calibration files.
Read public/agent-docs/workflows/tidy-up.md before deciding whether this mode is still appropriate.
EOF
)

case "$MODE" in
  light)
    PROMPT=$(cat <<EOF
Run the LIGHT Aralia tidy-up mode.

$COMMON_HEADER

Use this mode only for low-risk docs, comments, local notes, or tiny metadata edits.

Required steps:
1) Inspect git status with git status --short --branch.
2) Run npm run sync-check.
3) Confirm whether focused verification already ran, or explain why no focused test is needed.
4) If workflow docs, scripts, package metadata, or tooling catalogs changed, scan for stale workflow-path references.
5) Report changed files and open follow-ups.

Do not run the full roadmap/session ritual chain unless the changed files raise the tier to STANDARD or FULL.
EOF
)
    ;;
  standard)
    PROMPT=$(cat <<EOF
Run the STANDARD Aralia tidy-up mode.

$COMMON_HEADER

Use this mode for ordinary code, data, tests, or user-facing behavior changes.

Required steps:
1) Complete the LIGHT requirements.
2) Run the relevant /test-ts path or focused test command for the changed area.
3) Run /verify from public/agent-docs/workflows/verify.md with focused verification evidence.
4) Include rendered verification for UI or visual work.
5) Run targeted session-ritual steps only for files actually touched.

If exported types, shared utilities, hooks, state, build scripts, workflow scripts, Git hooks, package scripts, roadmap docs, or agent workflow docs changed, escalate to FULL.
EOF
)
    ;;
  full)
    PROMPT=$(cat <<EOF
Run the FULL Aralia tidy-up chain.

$COMMON_HEADER

Use this mode for shared-system, workflow, tooling, Git-hook, package-script, roadmap, or agent-doc changes.

Required steps:
1) Execute the /test-ts workflow end-to-end as written in public/agent-docs/workflows/test-ts.md.
2) Execute the /roadmap-node-orchestration workflow end-to-end as written in public/agent-docs/workflows/roadmap-node-orchestration.md.
   - Treat this as mandatory, not optional.
   - Include every field from the required output block defined in that workflow.
3) Execute the /session-ritual workflow end-to-end as written in public/agent-docs/workflows/session-ritual.md.
   - For dependency sync, use git status --porcelain to list modified files.
   - Run: npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync path/to/modified_file
   - Skip deleted files and non-code files.
   - Perform the mandatory roadmap-node orchestration checkpoint from session-ritual Step 4.
   - Perform the mandatory user-profile calibration checkpoint from session-ritual Step 5.
4) Execute /codexception when this tidy-up run produced reusable learnings.

Rules:
- Follow the workflows exactly; do not skip steps unless a prerequisite fails.
- Use sub-agents for independent analysis-only checkpoints when possible, but never parallelize dependency-gated steps or overlapping file mutations.
- Do not mark tidy-up complete if the roadmap-node orchestration report block is missing.
- If no terminal learnings are found, explicitly say so.
- For /review-session Phase 1, propose TODOs only; do not edit files.
- Summarize what ran and stop.
EOF
)
    ;;
  push)
    PROMPT=$(cat <<EOF
Run the PUSH Aralia tidy-up mode.

$COMMON_HEADER

Use this mode for push preparation, Git/worktree cleanup, hook repairs, release prep, or sync blockers.

Required steps:
1) Run npm run sync-check.
2) Run npm run git:hygiene.
3) Run npm run intent-gate -- --strict.
4) If .agent/workflows/INTENT-GATE.local.md is absent or not approved, report the blocker exactly and do not bypass silently.
5) If extra branches or worktrees are intentionally temporary, require an explicit ARALIA_GIT_HYGIENE_ALLOWED_BRANCHES or ARALIA_GIT_HYGIENE_ALLOWED_WORKTREES value in the report.
6) If a bypass is explicitly justified by the active task, use ARALIA_GIT_HYGIENE_BYPASS=1, simulate the tracked hook with the same environment the push will use, and record the bypass reason.
7) Pair this mode with STANDARD or FULL when the changed files also need normal code/workflow verification.

Do not push unless the active user request specifically asks for publishing.
EOF
)
    ;;
esac

if $PRINT_ONLY; then
  printf '%s\n' "$PROMPT"
  exit 0
fi

codex exec "$@" "$PROMPT"
