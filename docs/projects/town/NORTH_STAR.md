# Town North Star

Status: active
Last updated: 2026-06-05

## Dashboard Card Schema

| Field | Value |
|---|---|
| Project | Town |
| Slug | town |
| Category | active project |
| Status | active |
| Confidence | unknown |
| Evidence | docs/projects/town/TRACKER.md; docs/projects/town/GAPS.md |
| Gap signal | present |
| Protocol | living-project |
| Next step | Resume from TRACKER.md and keep the gap log aligned. |
| Required verification | docs consistency |
| Completed verification | docs refresh |
| Last proof | 2026-06-05 docs refresh |
| Workflow gaps reviewed | yes |

## Purpose

Preserve a usable cold-start handoff for the Town runtime surface.

Town currently runs as a live phase (`GamePhase.VILLAGE_VIEW`) with map rendering, movement, and interaction handlers already connected to shared game state.

## Scope

In scope:
- Runtime docs for current Town surface and coupling points.
- Flow from overworld movement into town view.
- Merchant, NPC, and shop interaction integration.
- City-state/settlement metadata coupling (what is already wired and what is not).

Out of scope:
- Editing runtime code as part of this doc pass.
- Expanding full town-description persistence ownership (owned by `town-description-system`).
- World simulation redesign.

## File Map (runtime references)

- `src/components/Town/TownCanvas.tsx` : primary town view, pointer interactions, controls, local/external movement.
- `src/components/Town/VillageScene.tsx` : alternate scene renderer with typed `VillageActionContext` and merchant/context actions.
- `src/components/Town/hooks/useTownController.ts` : map generation state, entry-direction spawn selection, local player position.
- `src/components/Town/TownNavigationControls.tsx` : 8-direction movement and adjacent building affordances.
- `src/components/Town/townMetadata.ts` and `src/components/Town/townUtils.ts` : building metadata, layout helpers.
- `src/App.tsx` : game phase switch into `TownCanvas` and phase exit path.
- `src/hooks/actions/actionHandlers.ts` : action dispatch routing for `ENTER_VILLAGE`, `OPEN_DYNAMIC_MERCHANT`, `OPEN_TEMPLE`, `START_DIALOGUE_SESSION`, etc.
- `src/hooks/actions/handleMovement.ts` : blocked tile logic for village approach and town entry.
- `src/hooks/actions/handleMerchantInteraction.ts` : dynamic merchant generation and integration context flow.
- `src/state/reducers/townReducer.ts` : reducer-level town session and movement state updates.
- `src/types/town.ts`, `src/types/actions.ts`, `src/types/world.ts`, `src/types/state.ts` : typed contracts used by town actions and state.
- `src/state/appState.ts` and `src/state/initialState.ts` : town fields in global reducer flow.
- `src/services/villageGenerator.ts`, `src/services/RealmSmithTownGenerator.ts` : procedural town/village generation services.

## Implemented State

- Town phase exists and is rendered by App through `GamePhase.VILLAGE_VIEW`.
- `gameState.townState` and `gameState.townEntryDirection` are in `src/types/state.ts` and initialized in `initialState.ts`.
- Town state is reduced via `townReducer` in root state flow (`appState.ts`).
- Overworld entry is coupled to movement:
  - `village_area` is impassable and requires explicit entry actions.
  - `aralia_town_center` movement path sets `GamePhase.VILLAGE_VIEW`.
  - Exit action clears town state and returns phase to `PLAYING`.
- `VillageActionContext` and `OPEN_DYNAMIC_MERCHANT` support contextualised shop prompts and Gemini logging.
- `handleOpenDynamicMerchant` can persist generated merchant NPCs and link business records via global registries.

## Integrations

- Action pipeline: Town components dispatch typed `Action` objects; handlers consume them in `actionHandlers.ts` and route to feature handlers.
- Shops:
  - Building click in TownCanvas can dispatch `OPEN_DYNAMIC_MERCHANT`.
  - VillageScene merchant tiles map to merchant-specific interactions with full context payload.
- NPC interactions:
  - Pointer hit-testing prioritises NPCs and dispatches `START_DIALOGUE_SESSION`.
  - fallback path sends building/exploration actions.
- World/economy coupling:
  - merchant generation uses global economy, active events, and generated world/business registries.
  - settlement personality inputs are available from `settlementGeneration.ts`.

## Relation to Town-Description-System and World

- Town-description concerns are split:
  - Runtime execution is owned by this `docs/projects/town` surface.
  - Persistent town metadata generation scope remains in `docs/projects/town-description-system`.
- World system contributes settlement inputs (`determineSettlementInfo`, site coordinates, economy state), while Town runtime currently consumes them at entry time and does not yet own a dedicated persisted `TownMetadata` object.

## Gaps and Uncertainties

- `ENTER_TOWN` exists in action types and reducer logic but is not the active enter route in all movement paths.
- `determineSettlementInfo(...)` is computed in App while TownCanvas currently receives the value and does not use it in renderer logic.
- Town rendering currently has parallel components (`TownCanvas` primary in App, `VillageScene` unused by App runtime).
- City-state coupling signals exist (`governingBody`, wealth/culture profiles, personality) but are not consistently threaded into persisted town state.

## Next Checks

- Confirm the intended entry contract for town transition and whether `ENTER_TOWN` should be the canonical entry action.
- Confirm whether active TownCanvas should consume settlement profile signals before future city-state coupling work.
- Confirm handoff boundary for persistent settlement identity between this project and `town-description-system`.

## Resume Path

1. Read this file.
2. Read `docs/projects/town/TRACKER.md`.
3. Read `docs/projects/town/GAPS.md`.
4. Check `docs/projects/PROJECT_TRACKER.md` and `docs/projects/GLOBAL_GAPS.md`.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
