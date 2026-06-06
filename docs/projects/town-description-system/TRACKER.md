# Town Description System Living Tracker

Status: active
Last updated: 2026-06-05

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|
| T1 | done | Align project docs with verified town-description evidence. | Codex integration pass | 2026-05-31 | `src/utils/world/settlementGeneration.ts`, `src/services/villageGenerator.ts`, `src/App.tsx`, `src/components/Town/TownCanvas.tsx`, `docs/projects/world/NORTH_STAR.md`, `docs/projects/town/NORTH_STAR.md` | Keep only project-owned docs in this folder and verify coupling language. | `TRACKER.md` and `GAPS.md` match `NORTH_STAR.md`. |
| T2 | active | Define ownership and first implementation lane for town metadata persistence. | future owner | 2026-05-31 | `src/types/state.ts`, `src/services/saveLoadService.ts`, `src/services/worldSim/types.ts` | Add one concrete owner decision for metadata home and migration expectation. | Decision note in `GAPS.md` + updated `NORTH_STAR.md` relation section. |
| T3 | active | Resolve coupling boundaries for settlement context consumption in runtime flow. | future owner | 2026-05-31 | `src/components/Town/TownCanvas.tsx`, `src/components/Town/VillageScene.tsx`, `src/App.tsx`, `src/hooks/actions/actionHandlers.ts` | Choose whether `TownCanvas` consumes settlement metadata directly or through a shared metadata object. | Evidence check: context path used for the active town entry surface. |
| T4 | active | Resolve town entry path contract overlap (`ENTER_TOWN` vs `ENTER_VILLAGE`). | future owner | 2026-05-31 | `src/state/actionTypes.ts`, `src/state/reducers/townReducer.ts`, `src/hooks/actions/actionHandlers.ts`, `src/hooks/actions/handleMovement.ts` | Record canonical entry contract and ownership decision. | Update GAPS row and reference proof lines in this project docs. |

## Update Rules

- Docs-only for this pass: modify only files under `docs/projects/town-description-system`.
- Preserve boundary discipline: world contracts stay in `docs/projects/world`, town runtime behavior stays in `docs/projects/town`.
- Every open gap here needs one next check/proof entry and a known owner signal.
