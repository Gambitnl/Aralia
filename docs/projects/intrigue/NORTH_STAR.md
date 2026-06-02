# Intrigue System North Star

Status: active
Last updated: 2026-05-31

Purpose
Intrigue connects social intelligence, faction politics, and rumor-driven world state with the rest of Aralia. It is implemented as three layers:

- Core identity and leverage logic in `src/systems/intrigue/*`
- Daily world-level intrigue events in `src/systems/world/*`
- UI discovery paths in taverns/merchant flow

Scope
- In scope: factions, rumors, secrets, reputation effects, and their state/update integration points.
- Explicitly not in scope: making major design changes to combat, UI architecture, or quest story engine ownership.

Concrete file map
- Core intrigue:
  - `src/systems/intrigue/IdentityManager.ts`
  - `src/systems/intrigue/LeverageSystem.ts`
  - `src/systems/intrigue/SecretGenerator.ts`
  - `src/systems/intrigue/NobleHouseGenerator.ts`
  - `src/systems/intrigue/TavernGossipSystem.ts`
- World integration:
  - `src/systems/world/WorldEventManager.ts`
  - `src/systems/world/NobleIntrigueManager.ts`
  - `src/systems/world/FactionManager.ts`
  - `src/utils/factionUtils.ts`
  - `src/utils/world/factionUtils.ts`
- State and action integration:
  - `src/state/actionTypes.ts` (`CREATE_ALIAS`, `EQUIP_DISGUISE`, `REMOVE_DISGUISE`, `LEARN_SECRET`)
  - `src/state/reducers/identityReducer.ts`
  - `src/state/reducers/worldReducer.ts`
  - `src/state/appState.ts` (`START_NEW_GAME_SETUP`, `START_GAME_SUCCESS` paths initialize intrigue-relevant factions and standings)
- Types:
  - `src/types/identity.ts`
  - `src/types/factions.ts`
  - `src/types/state.ts`
  - `src/types/world.ts` (`WorldRumor`)
- UI integration:
  - `src/components/Town/Intrigue/RumorMill.tsx`
  - `src/components/Trade/MerchantModal.tsx`
  - `src/components/debug/NobleHouseList.tsx`
- Tests:
  - `src/systems/intrigue/__tests__/SecretSystem.test.ts`
  - `src/systems/intrigue/__tests__/LeverageSystem.test.ts`
  - `src/systems/intrigue/__tests__/TavernGossipSystem.test.ts`
  - `src/systems/intrigue/__tests__/NobleHouseGenerator.test.ts`
  - `src/systems/world/__tests__/NobleIntrigueManager.test.ts`
  - `src/systems/world/__tests__/WorldEventManager.test.ts`
  - `src/systems/world/__tests__/FactionManager.test.ts`

Implemented state (current evidence)
- Identity state exists and initializes per character via `IdentityManager.createInitialState`, and aliases/disguises/secrets can be mutated by reducer.
- Secret and rumor generation are deterministic by seed/day/location in several paths (`SecretGenerator`, `TavernGossipSystem`, `NobleIntrigueManager`, world skirmish rumors).
- World tick integration exists: `ADVANCE_TIME` can call `processWorldEvents`, which runs intrigue and skirmish/event paths and appends rumor/state changes.
- Player rumor acquisition path is implemented: tavern/merchant UI calls `TavernGossipSystem.getAvailableRumors` and purchases create inventory note items via `BUY_ITEM`.

Integration points to preserve
- `factions` + `playerFactionStandings` are seeded from `data/factions.ts` and `getAllFactions(worldSeed)` at game setup.
- `processWorldEvents` owns rumor lifecycle: daily cleanup, propagation, event-driven adds, and eventual expiry.
- `NobleIntrigueManager` writes `WorldRumor` records and faction relationship changes into state.
- `FactionManager.applyReputationChange` wraps visible/reputation delta logic and can generate secondary rumors.
- `RumorMill` marks rumor content as purchased by writing `note` items with id prefix `rumor_`.

Current gaps and uncertainties to carry forward
- `IntrigueCheckResult` is defined in `src/types/identity.ts` but not used by any live reducer or action flow.
- `LeverageSystem` has no production wiring; it is currently covered by unit tests only.
- `TavernGossipSystem` marks `lead` option payload as `undefined` with a TODO to connect quest/world hookups.
- `TavernGossipSystem` and two noble/secret generator families show partial overlap and different payload conventions.
- Reputation/rumor hooks are present, but there is no complete player-facing chain for applying discovered secret leverage in social resolution.

Next checks for any continuation
- Confirm whether `leverage` and `intrigue checks` should be added to action payloads and reducers before narrative expansion.
- Decide a canonical secret generation path (systems intrigue vs utils/world) and lock tag/value schema.
- Confirm lead handling contract: quest start, map marker, or world objective trigger.
- Re-run focused tests for:
  - intrigue unit coverage (`src/systems/intrigue/__tests__`)
  - world simulation coverage (`src/systems/world/__tests__`)
- Cross-check this project's active gap IDs against `docs/projects/GLOBAL_GAPS.md` before adding new cross-project routing.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps in `GAPS.md` before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
