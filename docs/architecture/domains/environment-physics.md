# Environment & Physics

## Purpose

This domain covers the environmental, terrain, hazard, weather, and elemental-interaction systems that shape world-state behavior.
The current repo also makes it clear that visibility is an adjacent integration lane, and that broader physics utilities now live under combat-oriented utility paths rather than under a large standalone physics subsystem.

## Verified Entry Points

- src/systems/environment/
- src/systems/physics/
- src/systems/visibility/
- src/types/environment.ts
- src/data/biomes.ts
- src/data/underdark/biomes.ts

## Current Shape

### Environment lane

This pass verified the live environment subtree under src/systems/environment/, including:

- EnvironmentSystem.ts
- TerrainSystem.ts
- WeatherSystem.ts
- hazards.ts
- the current environment test suite under src/systems/environment/__tests__/

### Physics and elemental lane

This pass verified:

- src/systems/physics/ElementalInteractionSystem.ts
- src/systems/physics/__tests__/ElementalInteractionSystem.test.ts
- src/utils/combat/physicsUtils.ts
- src/utils/combat/__tests__/physicsUtils.test.ts
- src/utils/combat/__tests__/physicsUtils_light.test.ts
- src/utils/combat/__tests__/physicsUtils_movement.test.ts

The repo still contains older bridge paths for some physics and walkability utilities, but the stronger active utility surface now sits under the namespaced combat and spatial utility folders.

### Visibility integration lane

This pass also confirmed:

- src/systems/visibility/VisibilitySystem.ts
- src/systems/visibility/index.ts
- src/systems/visibility/__tests__/VisibilitySystem.test.ts

Visibility should not replace this domain, but it is clearly part of the same environmental-behavior neighborhood and should be treated as a close integration surface.

## Important Corrections

- The older doc's ownership list mixed verified environment systems with several stale or weakly-supported utility and type claims.
- The strongest verified anchors are EnvironmentSystem, TerrainSystem, WeatherSystem, hazards, ElementalInteractionSystem, VisibilitySystem, and the biome-data surfaces in src/data/biomes.ts plus src/data/underdark/biomes.ts.
- This file should not pretend to own Submap rendering helpers, POI data, or generic location helpers just because those systems interact with environmental logic.
- Combat, Submap, and Battle Map relationships are plausible, but this pass did not verify enough direct imports to state them as hard dependency claims.

## Tests Verified In This Pass

- src/systems/environment/__tests__/EnvironmentSystem.test.ts
- src/systems/environment/__tests__/hazards.test.ts
- src/systems/environment/__tests__/TerrainSystem.test.ts
- src/systems/environment/__tests__/WeatherSystem.test.ts
- src/systems/physics/__tests__/ElementalInteractionSystem.test.ts
- src/utils/combat/__tests__/physicsUtils.test.ts
- src/utils/combat/__tests__/physicsUtils_light.test.ts
- src/utils/combat/__tests__/physicsUtils_movement.test.ts
- src/systems/visibility/__tests__/VisibilitySystem.test.ts

## Current Interpretation

Re-verified on 2026-03-11.
Treat this domain as the environment plus terrain plus weather plus elemental-interaction lane, with visibility called out as an adjacent integration surface and with the heavier physics utility helpers now anchored under the combat utility subtree.
