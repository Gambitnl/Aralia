# Naval UI Tracker

Status: active
Last updated: 2026-06-05

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action |
|---|---|---|---|---|---|---|
| U1 | done | Add initial Naval UI project docs from living-project protocol | Worker B | 2026-05-31 | `docs/projects/naval-ui/*.md` | Keep this package updated with UI-surface drift |
| U2 | active | Document naval UI implementation state, integration points, and current gaps | Worker B | 2026-06-05 | `docs/projects/naval-ui/*.md`, `src/components/Naval`, `src/components/layout/GameModals.tsx`, `src/state/reducers` | Keep the refreshed handoff aligned and trace the ShipPane action decision against reducer behavior before adding controls |
| U3 | active | Track gaps that block Voyage + crew + status workflows from becoming usable from UI | Worker B | 2026-06-05 | `src/state/reducers/navalReducer.ts`, `src/state/actionTypes.ts`, `src/data/naval/*` | Add UI-safe proof checks in the next implementation slice |

## Gap Log

| Gap ID | Status | Location | Why it matters | Next proof/check |
|---|---|---|---|---|
| U-G1 | active | `docs/projects/naval-ui/GAPS.md` | `ShipPane` is read-only, no direct action controls for advance voyage/recruit/repair | Add at least one actionable control or confirm intended delegation surface |
| U-G2 | active | `src/state/reducers/navalReducer.ts` + `src/state/actionTypes.ts` | `NAVAL_REPAIR_SHIP` is declared but not handled | Add reducer case and test, or remove contract and update docs |
| U-G3 | active | `src/hooks/actions/handleMovement.ts` + naval action surface | Water tiles are blocked before voyage dispatch, so sea travel cannot trigger `NAVAL_START_VOYAGE` | Add verified voyage start transition from intended movement path |
| U-G4 | active | `src/data/naval/voyageEvents.ts`, `src/data/naval/voyageEvents/index.ts` | Duplicate event catalogs can produce split behavior | Add canonical source decision before adding new UI actions |
