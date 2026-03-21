# Town Description System - Technical Specification

Status: preserved design target, rewritten on 2026-03-11 after repo verification.

This file is a target-state technical spec. It does not describe the current repo as if every interface below already exists.

## Verified Current Baseline

### Live Town Stack

- `src/components/Town/TownCanvas.tsx` provides the active town-view surface.
- `src/hooks/useTownController.ts` manages deterministic town-map generation and local town-view state.
- `src/services/villageGenerator.ts` provides deterministic village layout generation and personality-aware structure placement.
- `src/utils/world/settlementGeneration.ts` already derives settlement traits from race, biome, and context.
- `src/types/state.ts` already carries `worldSeed`, `mapData`, and session-level `townState`.
- `src/services/saveLoadService.ts` already persists the overall `GameState` with checksum validation.

### What Was Not Verified

- a live `TownMetadata` type in the current type system
- a live `TownDescription` payload type
- a live `TownDescriptionGenerator`
- a live `PersistentTownData` or `townStates` storage lane
- a live proximity-triggered town-detail loader

## Target Additions

The following structures are still useful as design targets, but they should be treated as proposed additions rather than current code truth.

### Proposed Shared Town Metadata

The missing metadata lane should cover:

- stable town identity
- display name
- world coordinates
- settlement and biome context
- generation seed linkage
- optional generated detail payloads

It should be designed to sit on top of the current world/town stack instead of replacing it.

### Proposed Description Payload

A town-description package could include:

- overview
- visual description
- atmosphere
- economy
- social or cultural notes

That payload should be generated from current layout plus settlement context, not from disconnected template text alone.

### Proposed Persistence Shape

If town details are persisted, they should live inside the existing save architecture rather than in a second isolated storage model.

Target persisted content could include:

- town metadata
- generated description
- optional generated layout reference or cached layout details
- optional NPC/event bundles if that scope is resumed

## Integration Constraints From The Current Repo

### Constraint 1: Reuse Current Determinism

Town generation already derives deterministic behavior from `worldSeed` and world coordinates. Any new metadata or description seed scheme should align with that existing path.

### Constraint 2: Reuse Existing Save/Load Infrastructure

The repo already has one main save/load path. The town-description feature should extend that system rather than inventing a parallel save silo.

### Constraint 3: Reuse Current Town Presentation

The repo already has a town canvas and interaction flow. The first description integration should attach there or to an immediately adjacent town surface.

### Constraint 4: Keep One Shared Method

If rich town descriptions are added, they should come from one shared metadata and description-generation path so the roadmap and UI do not drift into multiple incompatible implementations.

## Still-Unfinished Design Questions

- Where should shared town metadata live in the main type tree?
- Should town detail persistence sit directly in `GameState` or in a nested world-content lane inside the save payload?
- What is the first town-facing UI surface that should consume generated descriptions?
- Should NPC/event generation be part of the same first slice, or follow after description-only support is stable?

## Recommended Technical Sequence

1. define metadata
2. wire persistence
3. build one description generator
4. attach one presentation surface
5. only then expand into deeper town-state and performance systems
