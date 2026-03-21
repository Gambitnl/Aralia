# Town Description System - Task Breakdown

Status: live backlog, rewritten on 2026-03-11 after repo verification.

This backlog tracks the unfinished town-description layer without pretending that the town canvas and layout systems are missing.

## Verified Foundations

- [x] Deterministic town entry based on `worldSeed` and world coordinates
- [x] Town canvas rendering and interaction surface
- [x] Deterministic village layout generation
- [x] Settlement trait inference from race/biome/context
- [x] Whole-game save/load infrastructure
- [x] Session-level town exploration state

## Core Missing Layer

### 1. Shared Metadata

- [ ] Define a shared town metadata type in the main type system
- [ ] Add a stable town identifier and display-name lane
- [ ] Store settlement and biome context in that metadata
- [ ] Add a detail-level concept only if it maps to real UI/data stages

### 2. Persistence Integration

- [ ] Decide where generated town data belongs in the existing save payload
- [ ] Persist generated town details through the current save/load architecture
- [ ] Verify load behavior prevents town drift across save/load cycles
- [ ] Define integrity expectations for generated town data only after the storage lane exists

### 3. Description Generation

- [ ] Extract layout features from generated towns
- [ ] Create one description-generation path that consumes settlement context plus layout features
- [ ] Persist generated descriptions through the shared metadata lane
- [ ] Avoid parallel one-off description builders in multiple UI surfaces

### 4. Presentation

- [ ] Pick one first presentation surface for town descriptions
- [ ] Show generated descriptions from shared data rather than ad hoc strings
- [ ] Confirm the feature works in the rendered town flow before broadening scope

## Later Extensions

- [ ] Add richer town-specific NPC bundles if the metadata lane is stable
- [ ] Add current events or rumor hooks tied to the same town identity
- [ ] Add notable-location summaries or landmarks
- [ ] Consider player-influenced town evolution only after baseline persistence is trustworthy

## Deferred Until The Core Path Exists

- [ ] Proximity-triggered background loading
- [ ] Cache policy or LRU behavior for town details
- [ ] Preloading anticipated nearby towns
- [ ] Expanded multi-surface tooltip integration
- [ ] Inter-town relationship modeling

## Guardrails

- Do not rebuild the town canvas or village generator as part of this feature.
- Do not create a second save architecture disconnected from `saveLoadService.ts`.
- Do not treat older design-only types such as `TownMetadata`, `TownSeeds`, or `PersistentTownData` as implemented until they exist in the live type and save layers.
