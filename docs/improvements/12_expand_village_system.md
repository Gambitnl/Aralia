# Improvement Note: Expand Village System

## Status

This note is now a rebased improvement brief.
It should not be read as proof that the village system is still a simple hardcoded stub, but it also should not be read as proof that all richer settlement goals are complete.

## Verified Foundations Already Present

- `VILLAGE_VIEW` and town-entry flows already exist in [`src/App.tsx`](F:\Repos\Aralia\src\App.tsx).
- [`src/components/Town/VillageScene.tsx`](F:\Repos\Aralia\src\components\Town\VillageScene.tsx) renders a deterministic generated village layout from `generateVillageLayout(...)`.
- [`src/components/Town/TownCanvas.tsx`](F:\Repos\Aralia\src\components\Town\TownCanvas.tsx) provides a larger live town exploration surface.
- [`src/services/villageGenerator.ts`](F:\Repos\Aralia\src\services\villageGenerator.ts) already contains the richer building palette, personality-aware layout generation, and building description/integration hooks that this older plan was originally pushing toward.
- [`src/utils/world/settlementGeneration.ts`](F:\Repos\Aralia\src\utils\world\settlementGeneration.ts) already provides settlement flavor scaffolding.

## Verified Gaps That Still Matter

- the current town stack does not yet provide a full persistent town-description system
- `settlementInfo` is only partially integrated because `TownCanvas.tsx` receives it but does not currently consume it
- deeper town life systems like persistent town metadata, richer save-backed description state, and broader NPC/event simulation are still open
- the older doc's PR-specific completion claims are historical and should not be reused as current verification

## Rebased Improvement Direction

### 1. Keep Extending The Existing Town Stack

Future work in this area should extend:
- `TownCanvas`
- `VillageScene`
- `useTownController`
- `villageGenerator`
- settlement-generation utilities

It should not start from the assumption that village generation still needs to be invented from scratch.

### 2. Focus On Missing Depth, Not Missing Existence

The live question is no longer "can Aralia generate a village at all?"
The live question is "how much richer, more persistent, and more systemic should towns become?"

### 3. Good Remaining Branches

- richer town metadata and persistence
- better use of settlement and cultural context inside the town UI
- town descriptions and town-specific narrative flavor
- deeper NPC and service integration
- stronger connection between world-map settlements and town-level generated detail

## Preserved Historical Value

This file still captures the intent to push towns beyond a static handcrafted scene.
That intent remains valid, but the current baseline is much further along than the original text assumed.
