# Companions System Living Tracker

Status: active (G6 decision recorded 2026-06-10; implementation lane open)
Last updated: 2026-06-10

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T2 | active | Clarify/route in-project gaps for implementation handoff and risk control. | Worker A | 2026-06-10 | `docs/projects/companions/GAPS.md`, `src/systems/companions/Companions_Ralph.md`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D10 | G5 is resolved as a documentation contract, G8 is now a documented companion-owned banter split plan, and G9 has a focused regression; G6 review cleared 2026-06-10 with the hysteresis romance-exit decision (DECISION_BLITZ D10), so the G6 implementation slice is assignable. | Encode the hysteresis policy (threshold + sustained duration, specified in the slice) in `RelationshipManager` and add the focused romance-to-hostile regression. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G6 | not_started | in_scope_now | Worker A | `docs/projects/companions/GAPS.md` | `src/systems/companions/Companions_Ralph.md` review | Romance state lock-in can keep a companion flagged as `romance` even after approval collapses to hostile territory. Decided 2026-06-10: hysteresis exit (DECISION_BLITZ D10). | `src/systems/companions/Companions_Ralph.md`, `src/systems/companions/RelationshipManager.ts`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D10 | Story logic needs an explicit breakup/downgrade contract before more relationship content can be safely added. | Encode the hysteresis breakup semantics (threshold + sustained duration, specified in the slice) in `RelationshipManager`. | Run a regression that drops approval from romance to hostile and verifies the exit fires only after the sustained-low-approval condition. |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
