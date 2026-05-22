# Package 3 Dispatch Readiness Checklist

Status: launched to Jules; visible Jules work exists, waiting for PR capture or publish explanation.

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
- Package 3 Symphony handoff receipt:
  `docs/tasks/spells/PACKAGE_3_SYMPHONY_HANDOFF_RECEIPT.md`
- Decision report:
  `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`

## Pre-Dispatch State

- Package 2 merged: `yes`, PR #935 merged as Package 2 implementation.
- Package 2 closeout docs merged: `yes`, PR #938 recorded closeout.
- Package 3 scope mapped: `yes`.
- Symphony dashboard draft created: `yes`, `draft-1779442977969-w2vsy4`.
- Linear issue created: `yes`, ARA-9:
  `https://linear.app/aralia/issue/ARA-9/spell-phase-1-package-3-spellbook-and-character-creator-visibility`.
- Symphony handoff prepared: `yes`, `handoff-1779443555192-bnpws7`.
- Jules manifest staged: `yes`,
  `.jules/runs/symphony-handoff-1779443555192-bnpws7/manifest.json`.
- Jules handoff launched: `yes`.
- Jules session id: `2823658242418460192`.
- Jules plan approval: `yes`, recorded through the dashboard at
  2026-05-22 12:09 local time.
- Jules session state: feedback answered after Symphony reported
  `AWAITING_USER_FEEDBACK` on 2026-05-22.
- Jules confirmation caveat: Symphony's dashboard approval did not clear the
  visible Jules input gate by itself. The visible Jules session still asked
  whether the plan looked good; the agent confirmed the bounded Package 3 plan
  in that signed-in Jules surface, then refreshed the dashboard.
- GitHub PR/branch check: no PR and no
  `jules/spells-package3-spellbook-creator-visibility` branch were visible in
  GitHub after the confirmation refresh.
- Post-PR #944 monitor: a later dashboard-first refresh still reported
  `IN_PROGRESS`; visible Jules still showed the approved plan, no new feedback
  prompt, no PR link, and no visible failure. The agent kept the current Jules
  run alive rather than relaunching or splitting Package 3.
- Post-PR #945 monitor: after the Package 3 monitor-decision docs merged, the
  dashboard still reported `IN_PROGRESS` and no PR URL, while the visible Jules
  page showed actual in-scope code changes and a `Working` pre-commit step. The
  agent kept the current Jules run alive rather than downloading the zip,
  rebuilding the diff locally, or relaunching the task.
- Known-caster prep-control feedback: a later dashboard refresh reported
  `Send Jules Feedback`. The visible Jules session asked whether to change the
  shared 2024 `getMaxPreparedSpells.ts` behavior, localize the fixed-known
  caster Prep/Unprep visibility rule in the spellbook UI, or allow those
  classes to prepare/unprepare. The agent chose the localized UI rule and sent
  that feedback through the visible Jules chat.
- Completed-no-PR routing repair: after option B feedback, Symphony again
  reported Jules `COMPLETED` with no PR URL. The dashboard required visible
  Jules inspection, but its middleman PR lane reused old Package 2 PR #935
  instead of keeping the waiting PR boundary on Package 3. The foreman patched
  Symphony and verifier coverage for this active-handoff routing defect.
- Completed-no-PR routing repair merged: PR #947 merged on 2026-05-22 after
  the ambient full-suite movement-test failure was rerun successfully. The
  remaining Gemini review failure was quota-related advisory automation.
- Explicit publish request: after PR #947 landed and the dashboard was checked
  from a fresh `origin/master` branch, the live dashboard still reported
  Package 3 completed-without-PR. The visible Jules session still showed code
  but no PR link, so the agent sent a visible Jules chat request asking Jules
  to push/open the expected PR or state that it cannot and whether Download zip
  is the only remaining handoff path.
- Package 3 implementation PR: `none`.

## Reserved Names

Recommended implementation branch:

- `jules/spells-package3-spellbook-creator-visibility`

Optional Codex review/repair branch:

- `codex/spells-package3-spellbook-creator-visibility-review`

Optional local review worktree:

- `F:\Repos\Aralia\.worktrees\spells-package3-spellbook-creator-visibility`

## Next Dispatch Steps

1. Continue dashboard-first Jules status refreshes until one of these outcomes
   is captured: resumed work, PR URL, another feedback/approval request,
   failure, or durable no-code completion.
2. If a PR appears, run the Package 3 review path before Scout/Core merge:
   scope check, relevant focused tests, visual proof, Atlas/gate checkpoint,
   and PR checks.
3. If Jules remains completed-without-PR after the explicit visible publish
   request, record the no-PR result as a Package 3 publish blocker before
   deciding whether to relaunch Jules, use the visible Jules Download zip
   export path, or split the task further.
4. Record the PR URL or no-PR proof, verifier output, visual proof, and
   Atlas/gate checkpoint
   in this checklist and the Package 3 receipts.
5. Keep combat simulator casting and AI arbitration discoveries as Package 4/5
   gaps unless they are tiny fixture-only changes required to test Package 3.

## Abort Or Repair Path

If Package 3 uncovers a broad assembly, class-rule, or spellbook data-model
decision, record it in the decision report before allowing Jules to broaden the
slice. If the decision belongs to combat simulator casting or AI arbitration,
record it as a Package 4 or Package 5 gap instead of expanding Package 3.
