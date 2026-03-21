# Town Description System - Implementation Plan

Status: preserved phased plan, rewritten on 2026-03-11 after repo verification.

This plan now separates verified foundations from still-unfinished work.

## Verified Foundations Already Present

- Town scene entry and rendering exist through `src/components/Town/TownCanvas.tsx`.
- Town map generation exists through `src/hooks/useTownController.ts` and the RealmSmith town generator.
- Deterministic village-layout generation exists through `src/services/villageGenerator.ts`.
- Settlement personality and race/biome-aware settlement traits exist through `src/utils/world/settlementGeneration.ts`.
- Whole-game save/load with checksum validation exists through `src/services/saveLoadService.ts`.
- Session-level town exploration state exists through `src/types/state.ts` and `src/types/town.ts`.

These should be reused, not rebuilt.

## Phase 1: Shared Town Metadata And Persistence

Goal: create one stable metadata and save-state lane for generated town identity and details.

- Define a shared town metadata type in the main type system.
- Decide where generated town data lives inside the existing save payload.
- Add a stable town identifier and seed strategy that matches the current `worldSeed + coords` approach.
- Store generated town details in a way that survives save/load without creating a second disconnected save architecture.

## Phase 2: Description Generation

Goal: add a rich description layer that sits on top of the existing layout and settlement systems.

- Extract reusable layout features from generated towns.
- Create one description generator or transformer fed by:
  - settlement traits
  - biome
  - layout-derived signals
  - optional player-context flavor
- Persist generated descriptions through the same shared metadata/persistence lane.

## Phase 3: Presentation Integration

Goal: expose the new metadata/description lane through one town-facing UI surface first.

- Choose one primary presentation surface.
- Integrate the generated description without duplicating town state.
- Verify that the displayed description is derived from the shared metadata path, not from ad hoc local formatting.

## Phase 4: Deeper Town State

Goal: extend the feature beyond description-only if the shared metadata lane proves stable.

- Add richer town-specific state such as NPC sets, events, or notable locations.
- Keep these attached to the same town identity and persistence model.
- Avoid parallel mini-systems for each content type.

## Phase 5: Performance And Loading Strategy

Goal: optimize only after the shared data model is real.

- Add proximity-triggered generation if still needed.
- Add cache policy only once there is meaningful town detail data to cache.
- Consider background loading only after correctness and persistence are stable.

## Explicitly Not Yet Verified

These older plan assumptions were not confirmed during the current audit:

- a live `TownMetadata` implementation
- `TownSeeds` utilities as named in the old docs
- `TownDescriptionGenerator`
- `townStates` / `PersistentTownData`
- immediate autosave on town-content generation
- LRU cache for town details
- background loading for anticipated towns

## Current Resume Priority

1. metadata shape
2. save-state integration
3. one description generator
4. one presentation surface
5. only then advanced town-state and performance work
