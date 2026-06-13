# Combat System Living Tracker

Status: active (G30 decision recorded 2026-06-10; implementation lane open)
Last updated: 2026-06-10

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Current Resume Target

- G3 AI/turn-loop assumptions are now verified and closed; G4 death-save/stability cleanup is now verified and closed; G11 class feature generation, G12 premade martial weapon regression coverage, G19 zone resistance/immunity resolution, G21 speed recalculation, G23 combat log persistence, G24 War Caster OA spell option, G25 Sentinel OA stop-in-place, G26 AI ability await sequencing, G27 opportunity-attack reach inspection, and G28 stale-batch concentration cleanup are done; G29 command/hook concentration cleanup parity also completed; G20 now has verified 2D token-badge and 3D actor-overlay parity. G30 is the only remaining hold and requires human review before any more Combat implementation work is assigned. Update (2026-06-10): G30 is decided (DECISION_BLITZ D6 â€” Code Modularization Audit owns the split plan; Combat contributes invariants/tests). The next Combat slice is the invariants/preservation-tests contribution; code movement stays with the audit project.

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
