# Naval & Underdark

## Purpose

This domain covers the specialized naval and Underdark system lanes: ship and voyage mechanics, naval combat, faerzress and Underdark environmental rules, and the supporting data, services, types, and UI that expose those systems.

## Verified Entry Points

- src/systems/naval/
- src/systems/underdark/
- src/services/underdarkService.ts
- src/components/Naval/ShipPane.tsx
- src/types/naval.ts
- src/types/navalCombat.ts
- src/types/underdark.ts

## Current Shape

### Naval lane

This pass verified the live naval subtree under src/systems/naval/, including:

- CrewManager.ts
- NavalCombatSystem.ts
- NavalLogic.ts
- VoyageManager.ts
- src/systems/naval/__tests__/NavalCombatSystem.test.ts
- src/systems/naval/__tests__/VoyageManager.test.ts

It also confirmed adjacent naval UI and data surfaces:

- src/components/Naval/ShipPane.tsx
- src/components/Naval/__tests__/ShipPane.test.tsx
- src/data/naval/
- src/data/ships.ts
- src/data/shipModifications.ts
- src/data/navalManeuvers.ts

### Underdark lane

This pass verified the live Underdark subtree under src/systems/underdark/, including:

- FaerzressSystem.ts
- UnderdarkFactionSystem.ts
- UnderdarkMechanics.ts
- src/systems/underdark/__tests__/FaerzressSystem.test.ts
- src/systems/underdark/__tests__/UnderdarkBiomeMechanics.test.ts
- src/systems/underdark/__tests__/UnderdarkFactionSystem.test.ts
- src/systems/underdark/__tests__/UnderdarkMechanics.test.ts

It also confirmed:

- src/services/underdarkService.ts
- src/data/underdark/
- src/data/underdarkFactions.ts

## Important Corrections

- The repo now has a real naval UI surface under src/components/Naval/, which the older doc did not call out.
- The naval lane is not only utilities and data; it has concrete system managers and tests.
- The older type listing included infernal-plane types as if they belonged directly to this domain. Plane-specific types belong more naturally with the planar and travel lane.

## Current Interpretation

Re-verified on 2026-03-11.
Treat this domain as the specialized naval plus Underdark mechanics lane: ship and voyage logic, naval combat, faerzress and faction systems, and the supporting data and UI that expose those environments.
