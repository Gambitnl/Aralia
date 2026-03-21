# Intrigue & Crime

## Purpose

This domain covers the implemented intrigue and crime systems: noble-house and secret generation, identity management, thieves-guild play, smuggling, heists, black-market flows, and the reducer or UI surfaces that support them.

## Verified Entry Points

- src/systems/intrigue/
- src/systems/crime/
- src/state/reducers/crimeReducer.ts
- src/state/reducers/identityReducer.ts
- src/components/Crime/
- src/components/debug/NobleHouseList.tsx
- src/types/identity.ts
- src/types/noble.ts

## Current Shape

### Intrigue lane

This pass verified the live intrigue subtree under src/systems/intrigue/, including:

- IdentityManager.ts
- LeverageSystem.ts
- NobleHouseGenerator.ts
- SecretGenerator.ts
- TavernGossipSystem.ts

### Crime lane

This pass verified the live crime subtree under src/systems/crime/, including:

- CrimeSystem.ts
- ThievesGuildSystem.ts
- SmugglingSystem.ts
- HeistManager.ts
- BlackMarketSystem.ts
- BountyHunterSystem.ts
- fencing/FenceSystem.ts

### UI and reducer lane

This pass verified:

- src/components/Crime/ThievesGuild/
- src/components/Crime/ThievesGuild/HeistPlanningModal.tsx
- src/components/Crime/ThievesGuild/FenceInterface.tsx
- src/components/Crime/ThievesGuild/ThievesGuildInterface.tsx
- src/state/reducers/crimeReducer.ts
- src/state/reducers/identityReducer.ts

## Important Corrections

- The repo now has concrete intrigue and crime subsystems rather than only a conceptual lane.
- TempleModal is not at src/components/TempleModal.tsx; the current path is src/components/Religion/TempleModal.tsx, so it should not be listed as a direct root-level ownership marker here.
- Some older helper paths still exist in legacy locations, but the current utility drift points toward namespaced world and core utility folders rather than one flat utils ownership block.

## Tests Verified In This Pass

- src/systems/intrigue/__tests__/LeverageSystem.test.ts
- src/systems/intrigue/__tests__/NobleHouseGenerator.test.ts
- src/systems/intrigue/__tests__/SecretSystem.test.ts
- src/systems/intrigue/__tests__/TavernGossipSystem.test.ts
- src/systems/crime/__tests__/BlackMarketSystem.test.ts
- src/systems/crime/__tests__/BountyHunterSystem.test.ts
- src/systems/crime/__tests__/CrimeSystem.test.ts
- src/systems/crime/__tests__/HeistManager.test.ts
- src/systems/crime/__tests__/SmugglingSystem.test.ts
- src/systems/crime/__tests__/ThievesGuildSystem.test.ts
- src/systems/crime/fencing/__tests__/FenceSystem.test.ts
- src/components/Crime/ThievesGuild/__tests__/ThievesGuildInterface.test.tsx

## Current Interpretation

Re-verified on 2026-03-11.
Treat this domain as the implemented social-intrigue plus criminal-activity lane: intrigue systems, crime systems, related reducers, and the thieves-guild UI surfaces that expose those mechanics.
