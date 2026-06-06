# Town Description System Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable unresolveds owned by the town-description system.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | in_scope_now | in_scope_now | future owner | `docs/projects/town-description-system/TRACKER.md` | docs/code scan | Missing shared town metadata shape and persistence lane for description data. | `src/types/world.ts`, `src/types/state.ts`, `src/services/saveLoadService.ts`, `src/services/worldSim/sites.ts` | Without a stable metadata shape, town identities and descriptions cannot survive save/load safely. | Define `TownMetadata` placement and schema in this project before implementation. | Decision written to `TRACKER.md` and reflected in `NORTH_STAR.md`. |
| G2 | in_scope_now | in_scope_now | future owner | `docs/projects/town-description-system/TRACKER.md` | `src/services/villageGenerator.ts`, `src/App.tsx`, `src/components/Town/TownCanvas.tsx` | Town metadata and settlement profile are not consumed on the active rendering path. | `TownCanvas` gets `settlementInfo` as `unknown` and only uses local seed logic. | Town descriptions cannot surface cultural identity and governing style without a defined consume path. | Choose first consume path: TownCanvas direct mapping or shared metadata bridge. | Proof by code review of active `TownCanvas` entry flow. |
| G3 | adjacent_follow_up | adjacent_follow_up | future owner | `docs/projects/town/TRACKER.md` | `src/state/actionTypes.ts`, `src/state/reducers/townReducer.ts`, `src/hooks/actions/actionHandlers.ts`, `src/hooks/actions/handleMovement.ts`, `src/App.tsx` | Town runtime entry contracts are split across `ENTER_TOWN` and `ENTER_VILLAGE`. | `ENTER_TOWN` is in reducer/action types, `ENTER_VILLAGE` is used by handler path. | Canonical entry mismatch creates coupling risk for description handoff payloads. | Confirm owner decision for this contract split and document boundary. | Add cross-project note in `docs/projects/town/NORTH_STAR.md` and link here. |
| G4 | adjacent_follow_up | adjacent_follow_up | future owner | `docs/projects/town-description-system/TRACKER.md` | `src/components/Town/VillageScene.tsx`, `src/components/Town/TownCanvas.tsx` | Secondary rendering surface (`VillageScene`) has richer integration payload than active surface (`TownCanvas`). | `VillageScene` constructs `VillageActionContext` with cultural data; active flow uses `TownCanvas` stub fields. | Duplicate or orphaned context paths can produce inconsistent behavior if both surfaces evolve differently. | Decide whether `VillageScene` remains secondary or is retired for description feature. | Add explicit decision and migration note in `TRACKER.md`. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | Gap blocks current project-owned implementation planning. |
| `adjacent_follow_up` | Important context sits in another project but impacts this ownership boundary. |
| `blocked_human_decision` | Needs direction from project owner before technical closure. |
