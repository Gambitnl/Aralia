# Crafting UI Living Tracker

Status: active
Last updated: 2026-06-12

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
| T2 | active | Preserve unresolved UI/systems boundary, and define what is in scope for the next implementation slice | Worker | 2026-06-09 | `docs/projects/PROJECT_TRACKER.md`, `src/state/reducers/craftingReducer.ts`, `docs/projects/crafting-ui/GAPS.md` | Use the G2/G3 ordering in GAPS.md to choose the next implementation slice without widening scope | Confirm each gap has owner, status, and next proof before code changes |
| T3 | active | Capture evidence for missing contract areas before code changes | Worker | 2026-06-05 | `src/components/Crafting/*.tsx`, `src/systems/crafting/*`, `src/state/actionTypes.ts` | Carry the existing contract evidence forward so the next slice can start from the documented blockers | Docs remain in sync with the active gap list and resume path |

## Tracker Notes

- This tracker is intentionally limited to docs-only continuity for the current pass.
- The current resume priority is G3, then G2; G4, G5, and G6 remain follow-up work.
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
