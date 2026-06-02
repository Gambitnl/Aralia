# Underdark System North Star

Status: active
Last updated: 2026-05-31

## Why This Project Exists
The Underdark system already has implemented code in multiple lanes, but no single living artifact was tracking:
- what is currently wired,
- what is only partially integrated,
- and what should be verified next.

This project file keeps that continuity for future workers.

## Purpose and Scope
Document implemented Underdark mechanics and adjacent integration boundaries for cold-start continuation.

## Concrete File Map

- Core systems
  - `src/systems/underdark/UnderdarkMechanics.ts`
  - `src/systems/underdark/FaerzressSystem.ts`
  - `src/systems/underdark/UnderdarkFactionSystem.ts`
- System tests
  - `src/systems/underdark/__tests__/UnderdarkMechanics.test.ts`
  - `src/systems/underdark/__tests__/UnderdarkBiomeMechanics.test.ts`
  - `src/systems/underdark/__tests__/UnderdarkFactionSystem.test.ts`
  - `src/systems/underdark/__tests__/FaerzressSystem.test.ts`
- State and type surfaces
  - `src/types/underdark.ts`
  - `src/types/underdark.d.ts`
  - `src/state/initialState.ts`
  - `src/state/appState.ts`
  - `src/state/reducers/worldReducer.ts`
- Data and helper surfaces
  - `src/data/underdark/biomes.ts`
  - `src/data/underdarkFactions.ts`
  - `src/services/underdarkService.ts`
  - `src/services/__tests__/underdarkService.test.ts`
  - `src/hooks/useUnderdarkLighting.ts`
  - `src/utils/world/encounterUtils.ts`
  - `src/data/travelEvents.ts`
  - `docs/architecture/domains/naval-underdark.md`

## Implemented State
- `UnderdarkState` is fully defined and includes depth, biome, light state, active sources, faerzress, wild magic, sanity, and optional territory faction.
- `UnderdarkMechanics.processTime` executes light source decay, ambient light refresh, sanity decay/recovery, and madness threshold messaging during time advancement.
- `FaerzressSystem` exposes wild magic chance, faerzress glow, sanity multiplier, and teleportability status.
- `UnderdarkFactionSystem` exposes depth-to-layer mapping, faction lookup by depth, hostility scoring, and mechanic application.
- `worldReducer` calls `UnderdarkMechanics.processTime` in `ADVANCE_TIME`, then appends underdark messages.
- Encounters receive cave/underdark tags through `src/utils/world/encounterUtils.ts`.
- Underdark travel flavor is represented in `src/data/travelEvents.ts` via an explicit `underdark` event list.

## Integration Points and Open Wiring
- State defaults are seeded in both:
  - `src/state/initialState.ts`
  - `src/state/appState.ts` (`INITIAL_UNDERDARK_STATE`)
- `underdarkService.ts` currently implements a second lighting/sanity path with different constants and base assumptions from `UnderdarkMechanics`, but is not the time tick path used by `worldReducer`.
- `UnderdarkFactionSystem.applyTerritoryMechanics` is implemented and test-covered, but no direct reducer path currently drives it.
- `currentDepth` and `currentBiomeId` are typed and initialized, but there is no obvious production source that mutates these fields during travel/submap traversal in the scan.

## Active Gaps and Uncertainties
- Source-of-truth risk: two underdark calculation implementations now diverge (`UnderdarkMechanics` vs `underdarkService`).
- Geometry transition risk: no confirmed runtime updates for `currentDepth/currentBiomeId` from movement or map systems.
- Territory risk: `currentTerritoryFactionId` is not clearly assigned in gameplay flow.
- Hook-path risk: `useUnderdarkLighting` gives inventory-light inference but is not obviously the canonical source for global underdark light.

## Immediate Next Checks
1. Confirm where underdark depth/biome fields should be authored during movement and tie that to `ADVANCE_TIME`.
2. Decide whether `underdarkService.ts` is retired, wrapped, or aligned to avoid duplicate logic.
3. Add a reducer or event chain for faction territory mechanics if `currentTerritoryFactionId` is intended to drive gameplay effects.
4. Add acceptance checks for time + travel + encounter flows that use underdark state after the above integration decision.

## Evidence and Proof

| Evidence | What it proves | Location |
|---|---|---|
| Core system implementation | Underdark mechanics are already implemented and covered by tests | `src/systems/underdark/` |
| Registry baseline | Official project ownership is already registered | `docs/projects/PROJECT_TRACKER.md` |
| State reducer integration | Underdark time effects are in the main world tick path | `src/state/reducers/worldReducer.ts` |
| Domain architecture context | Underdark lane is treated as verified in architecture docs | `docs/architecture/domains/naval-underdark.md` |

## Resume Path
1. Read this file.
2. Read `docs/projects/underdark/TRACKER.md`.
3. Read `docs/projects/underdark/GAPS.md`.
4. Re-open the file list above and confirm each evidence path still exists.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
