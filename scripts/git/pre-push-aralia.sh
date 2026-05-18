#!/bin/sh

# This hook script is the human-readable policy for Aralia push checks.
#
# It protects pushes from workflow problems that usually mean Git cannot safely sync
# the branch, while keeping broader TypeScript and lint debt visible as reports.
# Aralia has many exploratory systems and generated-data surfaces, so broad type debt
# should not silently become a veto on unrelated work.

# ============================================================================
# Startup
# ============================================================================
# Run from the repo root so paths are stable whether Git calls this from a hook or
# an agent runs it directly while checking the workflow.
# ============================================================================
cd "$(git rev-parse --show-toplevel)" || exit 1

echo "Pre-push: running Aralia sync checks..."

# ============================================================================
# Merge Conflict Gate
# ============================================================================
# Unresolved conflicts mean Git does not have one coherent version of the files.
# This remains a hard blocker because pushing from that state would hide unfinished
# merge decisions rather than preserve useful future work.
# ============================================================================
if [ -n "$(git ls-files -u)" ]; then
  echo ""
  echo "!! Push blocked: unresolved merge conflicts remain."
  echo "!! Resolve the conflicted files, stage them, and commit the merge."
  git ls-files -u | sed 's/.*	//g' | sort -u
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
# Visible Type And Lint Debt
# ============================================================================
# Typecheck and lint still run so the user and agents can see the current risk.
# By default they do not block ordinary pushes because existing project-wide debt
# should not prevent syncing unrelated progress. Set ARALIA_PRE_PUSH_STRICT=1 for
# review sessions where typecheck/lint failure should become a hard stop.
# ============================================================================
TYPECHECK_STATUS=0
LINT_STATUS=0

npm run typecheck 2>&1
TYPECHECK_STATUS=$?
if [ $TYPECHECK_STATUS -ne 0 ]; then
  echo ""
  echo "!! TypeScript issues found, but push is allowed by the Aralia sync policy."
  echo "!! Run npm run typecheck when you want the full report."
fi

npm run lint 2>&1
LINT_STATUS=$?
if [ $LINT_STATUS -ne 0 ]; then
  echo ""
  echo "!! Lint issues found, but push is allowed by the Aralia sync policy."
  echo "!! Run npm run lint when you want the full report."
fi

# ============================================================================
# Optional Strict Mode
# ============================================================================
# Strict mode lets maintainers intentionally use the same hook as a hard quality
# gate without turning every normal sync into a whole-repo cleanup session.
# ============================================================================
if [ "$ARALIA_PRE_PUSH_STRICT" = "1" ]; then
  if [ $TYPECHECK_STATUS -ne 0 ] || [ $LINT_STATUS -ne 0 ]; then
    echo ""
    echo "!! Push blocked: ARALIA_PRE_PUSH_STRICT=1 makes typecheck/lint failures blocking."
    exit 1
  fi
fi

echo "Pre-push: sync checks finished."
