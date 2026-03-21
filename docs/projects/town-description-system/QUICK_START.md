# Town Description System - Quick Start

Status: preserved restart guide, rewritten on 2026-03-11 after repo verification.

This file is for resuming the town-description project from the current repo, not from the older greenfield assumptions that originally shaped this folder.

## Start From What Already Exists

Before adding anything new, re-check these live surfaces:

- `src/components/Town/TownCanvas.tsx`
- `src/hooks/useTownController.ts`
- `src/services/villageGenerator.ts`
- `src/utils/world/settlementGeneration.ts`
- `src/types/state.ts`
- `src/types/town.ts`
- `src/services/saveLoadService.ts`

Those files already provide:

- deterministic town entry using `worldSeed` plus world coordinates
- a generated town layout and interactive town canvas
- settlement personality and race/biome-aware settlement traits
- whole-game save/load with checksum validation
- session-level town exploration state

## Do Not Start By Rebuilding These

Do not start by creating a second town generator, a second town scene, or a standalone save system. Those foundations already exist.

## Immediate Resume Order

### 1. Define The Missing Metadata Layer

Add one shared town metadata shape that can sit between world generation and town presentation.

The missing lane is roughly:

- stable town identifier
- display name
- world coordinates
- settlement/biome context
- generation seeds
- detail level
- optional generated description package

Current repo check:

- settlement traits exist conceptually
- a dedicated persisted `TownMetadata` structure was not verified

### 2. Decide Where Persistence Actually Lives

Do not invent a parallel town-only save silo unless it is truly necessary.

Current repo check:

- `saveLoadService.ts` already persists the full `GameState`
- `GameState` does not currently expose a verified `worldState.townStates` lane

So the first concrete design choice is:

- extend current save-state structures to host town metadata and generated town details
- or formally introduce a world-content persistence lane inside the existing save payload

### 3. Add A Description Layer On Top Of Existing Town Generation

The current town stack already generates layout and presentation. The missing layer is rich descriptive content informed by that layout and settlement context.

Current repo check:

- no verified `TownDescriptionGenerator`
- no verified proximity-driven town-description loading

So the next implementation slice should be:

- derive layout features from the generated town
- feed them into a single description generator
- store the result in the town metadata/persistence lane

### 4. Choose The First Presentation Surface

Do not spread the feature across every town UI surface at once.

Best first target:

- one reliable town-facing surface, likely the existing town canvas entry flow or a closely related town detail panel

The older docs suggested multiple targets such as tooltips and town canvas integration. Those remain possible, but they should come after the shared metadata and description path exists.

## Suggested First Real Task Stack

1. Define a town metadata type in the existing type system.
2. Add a persistence lane for generated town details inside the current save architecture.
3. Create one layout-to-description transformer/service.
4. Attach that result to one town-facing UI surface.
5. Only then consider proximity loading, background generation, or richer NPC/event bundles.

## What Remains Explicitly Unverified

These older assumptions were not confirmed during the 2026-03-11 pass and should not be treated as already implemented:

- immediate autosave on town-content generation
- complete town-specific integrity validation
- LRU town-detail cache
- background preloading of anticipated nearby towns
- integrated persistence of town layout, NPCs, events, and player interactions as one package
