# Package 4 Dispatch Readiness Checklist

Status: dashboard draft created, Linear issue `ARA-10` linked, Jules handoff
launched, and the package is waiting on a refreshed Jules state or PR
boundary.

This checklist guards the handoff from Codex foreman planning to a Jules-owned
implementation task for the deterministic combat spell pilot.

## Ready Artifacts

- Phase 1 plan:
  `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- Living tracker:
  `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- Linear issue:
  `ARA-10`
- Package 4 task:
  `docs/tasks/spells/PACKAGE_4_COMBAT_SIMULATOR_DETERMINISTIC_PILOT_JULES_TASK.md`
- Exact Jules prompt:
  `docs/tasks/spells/PACKAGE_4_COMBAT_SIMULATOR_DETERMINISTIC_PILOT_JULES_PROMPT.md`
- Package 4 combat proof receipt:
  `docs/tasks/spells/PACKAGE_4_COMBAT_PROOF_RECEIPT.md`
- Package 4 Atlas/gate receipt:
  `docs/tasks/spells/PACKAGE_4_ATLAS_GATE_CHECKPOINT_RECEIPT.md`
- Decision report:
  `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`

## Launch State

- Package 3 implementation merged: `yes`, PR #954.
- Package 3 closeout receipts merged: `yes`, PR #974 and PR #975.
- Local monitor branch: `codex/spell-phase1-monitor-33`, tracking
  `origin/master`.
- Local-master sync blocker: still present. The user's local `master` checkout
  has 2 local-only commits, so the monitor worktree must not mutate it.
- Package 4 scope mapped: `yes`.
- Linear issue linked: `yes`, `ARA-10`.
- Symphony dashboard draft created: `yes`,
  `draft-1779475056546-wvf3oh` at 2026-05-22 20:37 +02:00 through the visible
  dashboard form.
- Symphony handoff prepared: `yes`.
- Jules manifest staged: `yes`.
- Jules handoff launched: `yes`.
- Jules session: `IN_PROGRESS`; no PR URL captured yet.
- Jules implementation PR: `none`.
- Visible next boundary: refreshed Jules state, plan approval, PR, or blocker.
- Flow blocker still visible: local-master sync is blocked because the user's
  main `master` checkout has 2 local-only commits; the monitor worktree is
  current on `origin/master`, but the dashboard base-branch sync model still
  surfaces the main-checkout blocker.
- CI friction repaired during packet publication: PR #976 initially failed on
  `src/hooks/actions/__tests__/handleMovement.test.ts` because the seasonal
  movement timing test allowed random procedural travel events to add delay
  time. Codex stabilized that test by mocking `generateTravelEvent` to `null`
  for the seasonal multiplier assertions, then local and GitHub Vitest passed.

## Reserved Names

Recommended implementation branch:

- `jules/spells-package4-combat-deterministic-pilot`

Optional Codex review/repair branch:

- `codex/spells-package4-combat-deterministic-pilot-review`

Optional local review worktree:

- `F:\Repos\Aralia\.worktrees\spells-package4-combat-deterministic-pilot`

## Current Watch Steps

1. Refresh Jules state through the dashboard until it asks for plan approval,
   opens a PR, reports a blocker, or produces another visible action.
2. After Jules returns, fill the combat proof and Atlas/gate receipts before
   deciding whether Package 5 can begin.

## Abort Or Repair Path

If Package 4 exposes a dashboard blocker, record it as a Symphony workflow gap
and repair the dashboard path before continuing. If it exposes a broad spell
mechanics decision, record the decision and either keep it tiny inside this
pilot or split it into the first mechanics-bucket package.
