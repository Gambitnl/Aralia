# Planes / Travel

## Purpose

This domain covers planar mechanics, overland travel systems, travel-event generation, and the supporting data, types, and utilities that connect those systems to the rest of the game.

## Verified Entry Points

- src/systems/planar/
- src/systems/travel/
- src/services/travelEventService.ts
- src/services/travelService.ts
- src/data/planes.ts
- src/data/travelEvents.ts
- src/types/planes.ts
- src/types/travel.ts

## Current Shape

### Planar lane

This pass verified the live planar subtree under src/systems/planar/, including:

- AbyssalMechanics.ts
- AstralMechanics.ts
- FeywildMechanics.ts
- InfernalMechanics.ts
- ShadowfellMechanics.ts
- PlanarHazardSystem.ts
- PlanarService.ts
- PortalSystem.ts
- rest.ts

It also confirmed the current planar test suite under src/systems/planar/__tests__/.

### Travel lane

This pass verified the live travel subtree under src/systems/travel/, including:

- TravelCalculations.ts
- TravelNavigation.ts
- src/systems/travel/__tests__/TravelCalculations.test.ts
- src/systems/travel/__tests__/TravelNavigation.test.ts

It also confirmed:

- src/services/travelEventService.ts
- src/services/travelService.ts
- src/utils/travel/TravelCalculator.ts
- src/utils/travel/__tests__/TravelCalculator.test.ts

## Important Corrections

- The planar lane is broader than the older file described. The current repo includes Abyssal and Astral mechanics in addition to Feywild, Shadowfell, and Infernal mechanics.
- The current planar lane also has an explicit PlanarService.ts and a tested portal path.
- The utility layer now exists both in flat legacy files and in a namespaced src/utils/planar/ folder, so this doc should not pretend there is only one stable utility location.

## Tests Verified In This Pass

- src/systems/planar/__tests__/AbyssalMechanics.test.ts
- src/systems/planar/__tests__/AstralMechanics.test.ts
- src/systems/planar/__tests__/FeywildMechanics.test.ts
- src/systems/planar/__tests__/InfernalMechanics.test.ts
- src/systems/planar/__tests__/PlanarHazardSystem.test.ts
- src/systems/planar/__tests__/PlanarIntegration.test.ts
- src/systems/planar/__tests__/PlanarService.test.ts
- src/systems/planar/__tests__/PortalSystem.test.ts
- src/systems/planar/__tests__/rest.test.ts
- src/systems/planar/__tests__/ShadowfellMechanics.test.ts
- src/systems/travel/__tests__/TravelCalculations.test.ts
- src/systems/travel/__tests__/TravelNavigation.test.ts
- src/services/__tests__/travelEventService.test.ts
- src/services/__tests__/travelService.test.ts
- src/data/__tests__/planes.test.ts

## Current Interpretation

Re-verified on 2026-03-11.
Treat this domain as the planar plus travel lane: planar mechanics, portal and hazard systems, travel calculations and navigation, travel-event services, and the data and utility surfaces that support them.
