# World System North Star

Status: active  
Last updated: 2026-05-31

## Why This Project Exists

Aralia has a narrow town-description surface in `docs/projects/town-description-system`, but the broader world runtime is owned by `src/systems/world` plus `src/services/worldSim`, `src/state` integration, and shared types. This project preserves that broader system so world generation, factions, simulation events, and geography state are not collapsed into a narrower town scope.

## Purpose

Provide a cold-start map of implemented world-state ownership and open gaps around the world simulation contract, so future work can continue at the right boundaries.

## Implemented Scope Map

- Core loop: `src/systems/world/WorldEventManager.ts` owns daily simulation. It runs rumor propagation, economy event cleanup, route processing, weighted random events, quest deadline checks, bounty hunter spawns, regional economics updates, faction daily economy updates, and courier delivery.
- Faction services:
  - `src/systems/world/FactionManager.ts` for reputation ripple and rumor generation.
  - `src/systems/world/FactionEconomyManager.ts` for treasury/route competition/policy logic.
  - `src/systems/world/NobleIntrigueManager.ts` for noble-house intrigue events.
- Time/state coupling:
  - `src/state/reducers/worldReducer.ts` processes `ADVANCE_TIME` daily pipeline and appends logs from world simulation.
  - `src/state/appState.ts` initializes/rebuilds `factions`, `playerFactionStandings`, `worldSeed`, and `mapData` on setup/load flows.
  - `src/state/initialState.ts` seeds world-facing runtime state (`factions`, `worldHistory`, `activeRumors`, `worldBusinesses`, `pendingCouriers`, etc).
- World generation and migration:
  - `src/services/worldSim/index.ts` produces `WorldData` v2 (procedural outputs: rivers, roads, sites, biome zones, coasts, lakes).
  - `src/services/worldSim/types.ts` defines the canonical `WorldData` contract.
  - `src/state/migrations/worldDataMigration.ts` migrates old `mapData` shapes to include `worldData` and is used on save load flows.
- State/types:
  - `src/types/world.ts` defines `MapData`, `WorldRumor`, geography and rumor spread fields.
  - `src/types/state.ts` defines world-facing state contract including `activeRumors`, `worldHistory`, `factions`, and `playerFactionStandings`.
- Movement/world hooks:
  - `src/hooks/actions/handleMovement.ts` advances world time and triggers `handleGossipEvent`.
  - `src/hooks/actions/handleWorldEvents.ts` implements background gossip and long-rest world-memory decay.

## Implemented Evidence

- World state is simulated from player time progression through `ADVANCE_TIME` in `worldReducer.ts`.
- Dynamic rumor lifecycle exists in `WorldEventManager` and is persisted in `GameState.activeRumors`.
- Faction economy and diplomacy are actively mutated from the daily loop and exposed via `playerFactionStandings`.
- `worldDataMigration` already handles missing/legacy `MapData` by regenerating `worldData` with `runWorldSim(...)`.

## Relevant Tests

- `src/systems/world/__tests__/WorldEventManager.test.ts`
- `src/systems/world/__tests__/FactionManager.test.ts`
- `src/systems/world/__tests__/FactionEconomyManager.test.ts`
- `src/systems/world/__tests__/NobleIntrigueManager.test.ts`
- `src/state/reducers/__tests__/worldReducer.test.ts`
- `src/services/worldSim/__tests__/*.test.ts`

## Current Gaps To Track

Keep this project focused on world-system ownership; do not close open items from world generation, event simulation, or state typing under town-only docs.

## Resume Notes

1. Read this file.
2. Read `docs/projects/world/TRACKER.md`.
3. Read `docs/projects/world/GAPS.md`.
4. Continue with evidence-backed gap resolution and boundary checks before any runtime edits.
