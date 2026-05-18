#!/bin/sh

# This hook script is the human-readable policy for Aralia push checks.
#
# It protects pushes from workflow problems that usually mean Git cannot safely sync
# the branch. Aralia has many exploratory systems and generated-data surfaces, so
# broad type/lint debt should stay visible without becoming a veto on unrelated work.

# ============================================================================
# Startup
# ============================================================================
# Run from the repo root so paths are stable whether Git calls this from a hook or
# an agent runs it directly while checking the workflow.
# ============================================================================
cd "$(git rev-parse --show-toplevel)" || exit 1

echo "Pre-push: running Aralia sync checks..."

# ============================================================================
# Fast Sync Gate
# ============================================================================
# Ordinary pushes run the fast sync-check only. It blocks unresolved conflicts,
# committed conflict markers, and critical JSON syntax failures without running
# the full TypeScript/lint backlog.
# ============================================================================
npm run sync-check 2>&1
if [ $? -ne 0 ]; then
  echo ""
  echo "!! Push blocked: Aralia sync-check failed."
  exit 1
fi

# ============================================================================
# Intent Gate
# ============================================================================
# The intent gate is still blocking because it is about whether the session has an
# approved direction. It protects the project from agents pushing broad work with
# unclear purpose.
# ============================================================================
node .agent/workflows/intent-gate-check.mjs --strict 2>&1
if [ $? -ne 0 ]; then
  echo ""
  echo "!! Push blocked: Intent gate is missing/incomplete."
  echo "!! Fill .agent/workflows/INTENT-GATE.local.md and set Status: approved."
  echo "!! Emergency bypass: ARALIA_INTENT_GATE_BYPASS=1 git push --no-verify"
  exit 1
fi

# ============================================================================
# Optional Strict Verification
# ============================================================================
# Strict mode runs the broad debt summary and fails if typecheck or lint fails.
# This preserves a deliberate review/cleanup mode without making ordinary sync
# wait on project-wide debt reports.
# ============================================================================
if [ "$ARALIA_PRE_PUSH_STRICT" = "1" ]; then
  npm run quality:debt:strict 2>&1
  if [ $? -ne 0 ]; then
    echo ""
    echo "!! Push blocked: ARALIA_PRE_PUSH_STRICT=1 makes typecheck/lint failures blocking."
    exit 1
  fi
else
  echo "Pre-push: skipped full typecheck/lint. Run npm run quality:debt for a summarized report."
fi

echo "Pre-push: sync checks finished."
