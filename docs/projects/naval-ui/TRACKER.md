# Naval UI Living Tracker

Status: active
Last updated: 2026-06-15

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`
## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action |
|---|---|---|---|---|---|---|
| U2 | done | Document naval UI implementation state, integration points, and current gaps | Iteration Agent 2 | 2026-06-15 | Source inspection confirmed all file map entries accurate, all 5 gaps verified against current code, docs consistency check passed across NORTH_STAR/TRACKER/GAPS | None - documentation verification complete |
| U3 | active | Track gaps that block Voyage + crew + status workflows from becoming usable from UI | Worker B | 2026-06-05 | `src/state/reducers/navalReducer.ts`, `src/state/actionTypes.ts`, `src/data/naval/*` | Add UI-safe proof checks in the next implementation slice |

## Gap Log

| Gap ID | Status | Location | Why it matters | Next proof/check |
|---|---|---|---|---|
| U-G1 | active | `docs/projects/naval-ui/GAPS.md` | `ShipPane` is read-only, no direct action controls for advance voyage/recruit/repair | Add at least one actionable control or confirm intended delegation surface |
| U-G2 | active | `src/state/reducers/navalReducer.ts` + `src/state/actionTypes.ts` | `NAVAL_REPAIR_SHIP` is declared but not handled | Add reducer case and test, or remove contract and update docs |
| U-G3 | active | `src/hooks/actions/handleMovement.ts` + naval action surface | Water tiles are blocked before voyage dispatch, so sea travel cannot trigger `NAVAL_START_VOYAGE` | Add verified voyage start transition from intended movement path |
| U-G4 | active | `src/data/naval/voyageEvents.ts`, `src/data/naval/voyageEvents/index.ts` | Duplicate event catalogs can produce split behavior | Add canonical source decision before adding new UI actions |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
