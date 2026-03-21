# Time & World Events

## Purpose

This domain covers the systems that model game time, seasonal changes, world events, faction-level world activity, and the reducers or services that expose those changes to the rest of the game.

## Verified Entry Points

- src/systems/time/
- src/systems/world/
- src/state/reducers/worldReducer.ts
- src/state/reducers/religionReducer.ts
- src/services/landmarkService.ts
- src/services/strongholdService.ts

## Current Shape

### Time lane

This pass verified the current time subtree under src/systems/time/, including:

- CalendarSystem.ts
- SeasonalSystem.ts
- src/systems/time/__tests__/CalendarSystem.test.ts
- src/systems/time/__tests__/SeasonalSystem.test.ts

### World-events and faction lane

This pass verified the current world subtree under src/systems/world/, including:

- FactionEconomyManager.ts
- FactionManager.ts
- NobleIntrigueManager.ts
- WorldEventManager.ts
- the current world-manager test suite under src/systems/world/__tests__/

### Supporting reducers, data, and utilities

This pass verified:

- src/state/reducers/worldReducer.ts
- src/state/reducers/religionReducer.ts
- src/data/factions.ts
- src/data/landmarks.ts
- src/data/deities/
- src/data/temples/
- src/utils/core/timeUtils.ts
- src/utils/factionUtils.ts
- src/utils/world/factionUtils.ts

## Important Corrections

- The older doc used several flat utility paths as if they were the only current source of truth. The repo now clearly has namespaced utility lanes such as src/utils/core/timeUtils.ts and src/utils/world/factionUtils.ts alongside some older bridge paths.
- TempleModal is not at src/components/TempleModal.tsx; the current path is src/components/Religion/TempleModal.tsx.
- The current world lane includes an explicit FactionEconomyManager.ts, which means world-events and faction systems now overlap more directly with economy than the older doc made clear.

## Tests Verified In This Pass

- src/systems/time/__tests__/CalendarSystem.test.ts
- src/systems/time/__tests__/SeasonalSystem.test.ts
- src/systems/world/__tests__/FactionEconomyManager.test.ts
- src/systems/world/__tests__/FactionManager.test.ts
- src/systems/world/__tests__/NobleIntrigueManager.test.ts
- src/systems/world/__tests__/WorldEventManager.test.ts

## Current Interpretation

Re-verified on 2026-03-11.
Treat this domain as the time plus world-state lane: calendar and season systems, world-event managers, faction-world logic, and the reducers or services that persist and expose those changes.
