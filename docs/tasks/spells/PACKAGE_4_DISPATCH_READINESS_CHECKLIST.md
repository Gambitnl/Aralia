# Package 4 Dispatch Readiness Checklist

Status: historical launch checklist; Linear issue `ARA-10` was linked, Jules
opened PR #979, PR #979 merged, and local proof is recorded while the Atlas
source gap remains separate.

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
- Jules session: completed; PR #979 was the implementation review boundary.
- Jules implementation PR: `yes`,
  `https://github.com/Gambitnl/Aralia/pull/979`, merged on 2026-05-22.
- Visible next boundary: Package 5 scoping can begin, with `bless` kept as a
  recorded follow-up gap instead of a scope expansion.
- Spell gate refresh run for Package 4: `yes`; `npm run generate:spell-gates`
  completed and only timestamp fields changed in the regenerated JSON.
- `public/data/spell_gate_report.json` changed: `yes locally`, but the diff is
  timestamp-only and should stay out of the commit.
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

1. Keep the `bless` gap and Atlas source gap (`G48`) visible as separate
   follow-ups rather than broadening Package 4.
2. Treat Jules session `9133898485760935702` as a stale/duplicate Package 4
   workflow artifact unless it is explicitly recovered. On 2026-05-24, the
   dashboard promoted that old session even though Package 4 was already closed
   by PR #979. Visible Jules inspection showed it was waiting for plan approval;
   after approval it began changing spell audit scripts outside the declared
   Package 4 write scope, so the foreman paused the session before it could
   submit an out-of-scope PR.

## Abort Or Repair Path

If Package 4 exposes a dashboard blocker, record it as a Symphony workflow gap
and repair the dashboard path before continuing. If it exposes a broad spell
mechanics decision, record the decision and either keep it tiny inside this
pilot or split it into the first mechanics-bucket package.

For stale or duplicate Jules sessions, prefer one of these visible resolutions
before continuing the package queue:

1. Send visible Jules feedback that reverts out-of-scope edits and confirms no
   duplicate PR should be opened.
2. Archive or dismiss the stale handoff in the dashboard so a completed Package
   4 does not block Package 5.
3. If browser text entry remains blocked by the missing virtual clipboard,
   leave the session paused and record the blocker rather than using hidden
   endpoints or accepting a polluted PR.
