# Package 4 Dispatch Readiness Checklist

Status: draft artifacts prepared; not yet submitted to the Symphony dashboard.

This checklist guards the handoff from Codex foreman planning to a Jules-owned
implementation task for the deterministic combat spell pilot.

## Ready Artifacts

- Phase 1 plan:
  `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- Living tracker:
  `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- Package 4 task:
  `docs/tasks/spells/PACKAGE_4_COMBAT_SIMULATOR_DETERMINISTIC_PILOT_JULES_TASK.md`
- Exact Jules prompt:
  `docs/tasks/spells/PACKAGE_4_COMBAT_SIMULATOR_DETERMINISTIC_PILOT_JULES_PROMPT.md`
- Symphony draft payload:
  `docs/tasks/spells/PACKAGE_4_SYMPHONY_TASK_DRAFT_PAYLOAD.json`
- Package 4 combat proof receipt:
  `docs/tasks/spells/PACKAGE_4_COMBAT_PROOF_RECEIPT.md`
- Package 4 Atlas/gate receipt:
  `docs/tasks/spells/PACKAGE_4_ATLAS_GATE_CHECKPOINT_RECEIPT.md`
- Decision report:
  `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`

## Pre-Dispatch State

- Package 3 implementation merged: `yes`, PR #954.
- Package 3 closeout receipts merged: `yes`, PR #974 and PR #975.
- Local monitor branch: `codex/spell-phase1-monitor-32`, tracking
  `origin/master`.
- Local-master sync blocker: still present. The user's local `master` checkout
  has 2 local-only commits, so the monitor worktree must not mutate it.
- Package 4 scope mapped: `yes`.
- Symphony dashboard draft created: `no`.
- Linear issue created: `no`.
- Symphony handoff prepared: `no`.
- Jules manifest staged: `no`.
- Jules handoff launched: `no`.
- Jules implementation PR: `none`.

## Reserved Names

Recommended implementation branch:

- `jules/spells-package4-combat-deterministic-pilot`

Optional Codex review/repair branch:

- `codex/spells-package4-combat-deterministic-pilot-review`

Optional local review worktree:

- `F:\Repos\Aralia\.worktrees\spells-package4-combat-deterministic-pilot`

## Next Dispatch Steps

1. Use the visible Symphony dashboard to create the Package 4 draft from the
   payload.
2. Record the returned draft id in this checklist and in
   `PACKAGE_4_SYMPHONY_TASK_DRAFT_PAYLOAD.json`.
3. Let the dashboard route through Linear issue creation, manifest staging, and
   Jules launch. Do not use hidden endpoints to skip visible blockers.
4. Refresh Jules state through the dashboard until it asks for plan approval,
   opens a PR, reports a blocker, or produces another visible action.
5. After Jules returns, fill the combat proof and Atlas/gate receipts before
   deciding whether Package 5 can begin.

## Abort Or Repair Path

If Package 4 exposes a dashboard blocker, record it as a Symphony workflow gap
and repair the dashboard path before continuing. If it exposes a broad spell
mechanics decision, record the decision and either keep it tiny inside this
pilot or split it into the first mechanics-bucket package.
