# Crafting UI Living Tracker

Status: active
Last updated: 2026-06-17

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`
## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|
| T2 | done | Preserve unresolved UI/systems boundary, and define what is in scope for the next implementation slice | Qoder CLI | 2026-06-17 | `src/state/actionTypes.ts:311`, `src/state/reducers/craftingReducer.ts:88-113`, `src/components/Crafting/ExperimentPanel.tsx:185-194`, `src/components/Crafting/AlchemyBenchPanel.tsx:150,188` | Boundary defined: next slice is G2+G5 (typing + reducer proof). G3 resolved in source. G4, G6, G7 deferred. | See DECISIONS.md D-002 and GAPS.md for scope rationale. |

## Closed Task Log

| ID | Status | Task | Closed | Decision |
|---|---|---|---|---|
| T2 | done | Preserve unresolved UI/systems boundary, and define next implementation slice | 2026-06-17 | Next slice: G2 (typing) + G5 (reducer proof). G3 resolved. See D-002. |

## Tracker Notes

- G3 was discovered resolved in source during T2 evidence scan: `ExperimentPanel.tsx` dispatches `MODIFY_PARTY_HEALTH` and test proves it.
- G2 and G5 should be taken as a single slice: tighten `UPDATE_CRAFTING_STATS` payload typing and add `craftingReducer` unit tests in the same pass.
- G4 (windowing pattern), G6 (alchemy bench modularization), and G7 (stats dispatch coverage) remain real follow-ups.
- Any future implementation should continue here and update `NORTH_STAR.md` only when contract boundaries change.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
