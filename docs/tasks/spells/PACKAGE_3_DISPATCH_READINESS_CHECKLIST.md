# Package 3 Dispatch Readiness Checklist

Status: draft prepared; waiting for Symphony dashboard draft creation.

This checklist guards the handoff from Codex foreman planning to a Jules-owned
implementation task. It should be updated before dispatch, after Jules creates a
PR, and during closeout.

## Ready Artifacts

- Phase 1 plan:
  `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- Living tracker:
  `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- Package 3 task:
  `docs/tasks/spells/PACKAGE_3_SPELLBOOK_CREATOR_VISIBILITY_JULES_TASK.md`
- Exact Jules prompt:
  `docs/tasks/spells/PACKAGE_3_SPELLBOOK_CREATOR_VISIBILITY_JULES_PROMPT.md`
- Symphony draft payload:
  `docs/tasks/spells/PACKAGE_3_SYMPHONY_TASK_DRAFT_PAYLOAD.json`
- Package 3 Atlas/gate receipt:
  `docs/tasks/spells/PACKAGE_3_ATLAS_GATE_CHECKPOINT_RECEIPT.md`
- Package 3 visual proof receipt:
  `docs/tasks/spells/PACKAGE_3_VISUAL_PROOF_RECEIPT.md`
- Decision report:
  `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`

## Pre-Dispatch State

- Package 2 merged: `yes`, PR #935 merged as Package 2 implementation.
- Package 2 closeout docs merged: `yes`, PR #938 recorded closeout.
- Package 3 scope mapped: `yes`.
- Symphony dashboard draft created: `no`.
- Linear issue created: `not yet`.
- Jules handoff launched: `no`.
- Jules session id: `none`.
- Package 3 implementation PR: `none`.

## Reserved Names

Recommended implementation branch:

- `jules/spells-package3-spellbook-creator-visibility`

Optional Codex review/repair branch:

- `codex/spells-package3-spellbook-creator-visibility-review`

Optional local review worktree:

- `F:\Repos\Aralia\.worktrees\spells-package3-spellbook-creator-visibility`

## Next Dispatch Steps

1. Use the Symphony dashboard as the primary path to create the Package 3 task
   draft from `PACKAGE_3_SYMPHONY_TASK_DRAFT_PAYLOAD.json`.
2. If dashboard input blocks the visible flow, record the blocker and repair the
   dashboard/workflow rather than silently posting to hidden endpoints.
3. Create or link the Package 3 Linear issue if Symphony exposes that gate.
4. Launch the Jules handoff from the visible task page once the draft passes its
   gates.
5. Record the draft id, handoff id, Jules session id, branch name, PR URL, and
   verifier output in this checklist and the Package 3 receipts.

## Abort Or Repair Path

If Package 3 uncovers a broad assembly, class-rule, or spellbook data-model
decision, record it in the decision report before allowing Jules to broaden the
slice. If the decision belongs to combat simulator casting or AI arbitration,
record it as a Package 4 or Package 5 gap instead of expanding Package 3.
