---
schema_version: 1
project: World
slug: world
category: active project
main_category: "Game & Simulation"
subcategory: "World, Travel & Maps"
status: review-required
last_updated: 2026-06-09
confidence: unknown
evidence: "docs/projects/world/TRACKER.md; docs/projects/world/GAPS.md"
gap_signal: "present; tile-grid phase-out dependency contract blocks forward runtime assignment"
protocol: living-project
next_step: Preserve tile-grid movement/save/migration contracts before forward runtime assignment.
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
required_verification:
  - docs consistency
completed_verification:
  - docs refresh
last_proof: 2026-06-09
workflow_gaps_reviewed: 2026-06-09
compaction_status: not_needed
lifecycle_status: phase-out-contract-review
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "yes"
---
# World System North Star

Status: review-required
Last updated: 2026-06-09

## Dashboard Card Schema

| Field | Value |
|---|---|
| Project | World |
| Slug | world |
| Category | active project |
| Status | review-required |
| Confidence | unknown |
| Evidence | docs/projects/world/TRACKER.md; docs/projects/world/GAPS.md |
| Gap signal | present; tile-grid phase-out dependency contract blocks forward runtime assignment |
| Protocol | living-project |
| Next step | Preserve tile-grid movement/save/migration contracts before forward runtime assignment. |
| Required verification | docs consistency |
| Completed verification | docs refresh |
| Last proof | 2026-06-09 Required Review Brief added for tile-grid phase-out contract |
| Workflow gaps reviewed | 2026-06-09 |

Dashboard lifecycle: phase-out-contract-review
Assignment rule: Do not assign forward runtime changes until `MapData` tile-grid movement, save/load, and migration compatibility dependencies are explicitly preserved or routed.

## Required Review Brief

Title: Tile-grid world-map phase-out contract
Question: Which tile-grid `MapData` gameplay contracts must remain canonical while Azgaar, worldSim, and 3D/world-render paths replace the old world-map renderer?
Issue: The tile-grid world map is being phased out as a renderer, but its data contract still carries movement semantics, passability, discovery/current tile markers, startup/load continuity, migration compatibility, and 3D marker anchors.
Current behavior: `MapPane`, `handleMovement`, `MapData`, app setup/load flows, and `worldDataMigration` still preserve tile-grid world data even as newer geography and rendering paths expand.
Why blocked: Forward world-runtime agents could accidentally remove or bypass tile-grid fields that gameplay and save/load still depend on, so runtime edits must stop until the preservation contract is explicit.
Option A: Keep tile-grid `MapData` as the canonical gameplay compatibility layer and adapt new renderers/world data around it.
Option B: Promote a new canonical world geography contract and create an explicit migration/adapter layer for every tile-grid dependency before retiring old fields.
Evidence: `docs/projects/world/GAPS.md` G3; `src/components/MapPane.tsx`; `src/hooks/actions/handleMovement.ts`; `src/types/world.ts`; `src/state/appState.ts`; `src/state/migrations/worldDataMigration.ts`; `src/hooks/useGameInitialization.ts`.
Decision owner: Human/product owner plus world, map, save/load, and 3D/world-render owners.
Proof after decision: Contract preservation table plus focused startup/load/movement verification proving passability, current/discovered markers, migration, and 3D marker anchors still work.

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
- `MapPane`, `handleMovement`, `MapData`, app state setup/load flows, and `worldDataMigration` still preserve tile-grid world data while Azgaar/3D rendering paths replace the old world-map renderer.

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
4. Continue with evidence-backed tile-grid contract preservation before any forward runtime edits.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
