# WorldForge Tactical Battlefield Source Inventory

Status: active production-path audit
Last updated: 2026-07-16

## Purpose

This inventory is the completion ledger for the WorldForge battlefield-authority
goal. It follows every route that can reach Aralia's tactical `CombatView` and
records whether the route:

1. projects the encounter's real WorldForge location into `BattleMapData`,
2. fails closed because its source bridge is not implemented yet, or
3. is an explicitly labeled developer-only sandbox.

A row is not considered migrated merely because it supplies monsters. Production
combat needs both actor facts and a tactical projection of the location where the
encounter occurred. `CombatView` is the final safety boundary: without
`state.extractedBattleMap`, it mounts `BattlefieldSourceGap` and gives the combat
AI no actors instead of invoking `BattleMapGenerator`.

## Status Vocabulary

| Status | Meaning |
|---|---|
| `migrated` | The production caller supplies a real WorldForge tactical projection and has deterministic source-to-combat proof. |
| `withheld` | The production caller is recognized, but its location bridge is incomplete. The visible source-gap state is the intended current behavior. |
| `developer-only` | The path is deliberately non-production and may use the legacy procedural generator when its URL/UI labels make that authority explicit. |
| `separate-system` | The combat system does not enter tactical `CombatView`; it is audited here to prevent accidental classification as a battlefield source path. |

## Production Encounter Classes

| Encounter class | Runtime entry | Battlefield source path | Status | Current proof | Required next work |
|---|---|---|---|---|---|
| Ground hostile proximity | `World3DWrapper.handlePositionChange` -> `extractLocalTerrainPatch` -> `handleStartBattleMapEncounter` | Mounted `GroundWorld` at the player's exact meters; provenance retains world seed, atlas cell, crop anchor, live occupants, terrain, props, and structures. | `migrated` | `groundChunkLoader.test.ts`, production handoff coverage in `World3DWrapper`, and the deterministic World Battle Lab wilderness/road scenarios. | Add a dedicated hostile-creature visual recipe when creature provenance and encounter framing become richer than the current source position plus bestiary bridge. |
| Generated-settlement wanted watch | `handleNpcInteraction` -> active GroundWorld provider -> `projectLiveSettlementEncounter` | Exact player-position crop, live occupant snapshot, matching settlement defense, witnessed-crime/state-standing evidence, and regiment-derived actors. | `migrated` | `activeGroundCombatSession.test.ts`, `handleNpcInteraction.test.ts`, `liveSettlementEncounter.test.ts`, `worldEncounterCombatants.test.ts`, and `combat-world-live-watch`. | Preserve the explicit hostility receipt; do not restore generic guards when a generated settlement source rejects the confrontation. |
| Generated-state patrol world event | `World3DWrapper.handlePositionChange` -> `findStatePatrolWorldEvent` -> active GroundWorld provider | Exact generated town envelope, controlling-state standing, stationed land regiment, player meters, game day, and a save-backed once-per-day event receipt. | `migrated` | `statePatrolWorldEvent.test.ts`, `activeGroundCombatSession.test.ts`, `worldEncounterCombatants.test.ts`, and the State Patrol World Battle Lab recipe. | Replace daily cadence only when battle outcome, escape, bribes, and standing changes author authoritative cooldown facts. |
| Land-travel ambush | `App.triggerTravelEncounter` -> `prepareTravelBattlefield` -> `loadCompleteGroundWorld` -> `createTravelAmbushBattlefield` -> `handleStartBattleMapEncounter` | The committed destination atlas cell is rebuilt with the saved world seed, time, and WorldForge deltas. Tactical extraction selects the nearest real destination-cell road, retains the exact cell/crop provenance, and appends the committed route-cell receipt to the generation path. | `migrated` when a source road exists; otherwise visibly withheld | `travelAmbushBattlefield.test.ts` proves deterministic source-road framing, exact provenance, and the no-road refusal. `createWorldGenClient.test.ts` proves complete Stage-B loading and disposal. `?dev_travel_ambush=1` passes the canonical seed-42/cell-373 receipt through the same production action/reducer/`CombatView` route; rendered 1600x1000 and 1353x1272 proofs show party-on-road and enemy-flank deployment. | Preserve fail-closed behavior for route events whose destination publishes no road. Add non-road land encounter kinds only after WorldForge authors their own location/frame facts instead of borrowing this road contract. |
| Hostile opening attack or failed de-escalation | `buildSituationLocation` -> game-authored opening receipt -> `runDeEscalationFlow` -> mounted GroundWorld provider -> `projectOpeningThreatBattlefield` -> `handleStartBattleMapEncounter` | The receipt freezes the opening's world seed, atlas cell, place label, and matching Ground center. The mounted world validates that identity, freezes the exact live player-position crop, and emits a directionless opening frame. Missing, stale, or mismatched receipts fail closed. | `migrated`, with enemy spatial facts explicitly partial | `useOpeningSituation.location.test.ts`, `generateOpeningSituation.test.ts`, `useDeEscalation.test.ts`, `activeGroundCombatSession.test.ts`, `openingThreatBattlefield.test.ts`, `useBattleMapGeneration.test.ts`, `BattleMap.parity.test.tsx`, and the Hostile Opening World Battle Lab recipe. Rendered 1600x1000 and 1353x1272 review rejected the first compass-perfect ring, accepted the deterministic terrain-fit constellation, and retained visible `Not authored` diagnostics for enemy positions and approach direction. | Author threat entities or scene-placement receipts in WorldForge so exact enemy positions, group relationships, and approach evidence can replace the labeled tactical constellation. Improve species readability and ecological traces without adding renderer-only set dressing. |
| Static authored-town wanted watch | `handleNpcInteraction` fallback after no mounted generated-settlement provider | Two generic Guards are still prepared for legacy authored towns, but no source terrain or authored-town-to-WorldForge location bridge exists. | `withheld` | `handleNpcInteraction.test.ts` proves the caller route; `CombatView` source-gap proof prevents the old placeless arena behavior. | Either map each authored town into a canonical WorldForge site/cell and extract it, or keep the encounter visibly unsupported. Generic guards alone are not a battlefield source. |
| Daily sea encounter | `useSeaEncounter` -> `handleStartBattleMapEncounter` | The naval event supplies foes but no authoritative sea surface, vessel decks, relative headings, weather footprint, or boarding context. | `withheld` | `useSeaEncounter.test.tsx` proves one-shot routing and clearing; the global source-gap boundary withholds the placeless arena. | Define a WorldForge/naval tactical artifact for vessel and sea geometry before enabling tactical combat. Do not use a land biome as a stand-in. |
| Encounter modal custom/bestiary/AI simulation | `EncounterModal` -> `START_BATTLE_MAP_ENCOUNTER` action handler | The modal authors a roster but has no selected world location. It is reachable from the game UI, so it must not inherit production terrain implicitly. | `withheld` | `handleEncounter.test.ts` proves roster conversion; `CombatView` source-gap regression proves missing location facts stay non-operational. | Require the user/caller to choose a real WorldForge location, or move this surface behind an explicitly labeled developer sandbox entry. |
| Generic `START_BATTLE_MAP_ENCOUNTER` action dispatch | `actionHandlers.START_BATTLE_MAP_ENCOUNTER` -> `handleStartBattleMapEncounter` | Caller-defined. The reducer stores only an explicitly supplied `extractedBattleMap`; omission reaches the global source-gap state. | `withheld` by default | `appState.worldStateShape.test.ts`, `handleEncounter.test.ts`, and `CombatView.responsive.test.tsx`. | Keep this gate fail closed. New production callers must add a row here and deterministic source proof before being marked migrated. |

## Developer And Non-Tactical Paths

| Path | Entry | Classification | Boundary |
|---|---|---|---|
| Procedural combat sandbox | `?dev_combat=1`, `BattleMapDemo`, biome/new-map controls | `developer-only` | `generateProceduralSandboxBattleSetup` is the only constructor that imports `BattleMapGenerator`; production `CombatView` reaches it only through the dev-permission URL fixture. |
| Missing-source visual fixture | `?dev_combat_source_gap=1` | `developer-only` proof fixture | Starts a deterministic roster without terrain solely to capture and test the production fail-closed screen. It never enables combat. |
| Production travel-handoff fixture | `?dev_travel_ambush=1` | `developer-only` deterministic trigger, source-backed | Supplies the canonical seed-42/cell-373 travel receipt to the same asynchronous WorldForge loader, route projector, encounter action, reducer, and `CombatView` used by committed land travel. It does not contain a fallback map. |
| Fight-in-place developer probe | `?fipfight` / `window.__fipTestFight` | `developer-only`, source-backed | Uses the mounted GroundWorld and the same extraction/provenance path as production proximity encounters. A context-picker refusal yields the same source gap rather than an arena. |
| Battle-map scenario lab | `misc/design.html?step=battlemaplab` | `developer-only` visual harness, source-backed | Rebuilds named real WorldForge locations and mounts the real combat UI. The Hostile Opening recipe runs the production opening projector and labels its model roster plus unauthored spatial facts. Deterministic hostility fixtures are permitted only when diagnostics identify them as fixtures. |
| Naval combat utilities | `src/utils/naval/navalCombatUtils.ts` | `separate-system` | Resolves the naval subsystem's own state and does not provide `BattleMapData` to tactical `CombatView`. It becomes an inventory row only if that system later enters the tactical shell. |

## Authority Invariants

- `generateWorldBattleSetup` requires `BattleMapData`; it has no optional map and
  no generator fallback.
- `generateProceduralSandboxBattleSetup` is the only production-source-tree
  import path that constructs `BattleMapGenerator`, and its callers must remain
  developer-only.
- A production caller without `extractedBattleMap` may still prepare actors, but
  `CombatView` must render `BattlefieldSourceGap`, pass an empty actor list to
  combat AI, and expose only a safe return action.
- WorldForge-provenance maps suppress synthetic object-like painter scatter.
  Continuous texture, lighting, and readability treatments may remain renderer
  authored; discrete roads, water crossings, vegetation, structures, props,
  occupants, and encounter anchors must trace to source facts.
- Adding a new encounter launcher or direct combat-phase transition requires an
  inventory row, a migrated/withheld decision, and deterministic proof.

## Current Completion Read

The production safety invariant is enforced, but the full goal is not complete.
Five production classes are migrated, now including hostile openings and failed
de-escalations. A land travel event with no destination road is deliberately
withheld rather than reframed against invented terrain. Static authored-town
watch encounters, sea encounters, and location-free encounter simulation remain
explicitly withheld. Opening threats still expose enemy world positions and
approach direction as unauthored; their deterministic terrain-fit constellation
is a referee policy, not a claim that WorldForge placed those monsters there.
