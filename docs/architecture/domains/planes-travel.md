# Planes / Travel

## Purpose

This domain handles planar mechanics (Feywild, Shadowfell, etc.) and travel systems including overland travel events, random encounters, and planar hazards.

## Key Entry Points

| File | Role |
|------|------|
| `src/systems/planar/` | Planar mechanics systems |
| `src/systems/travel/` | Travel mechanics |
| `src/data/planes.ts` | Plane definitions |
| `src/services/travelEventService.ts` | Travel event generation |

## Subcomponents

- **Planar Mechanics**:
  - `FeywildMechanics.ts` - Feywild-specific rules
  - `ShadowfellMechanics.ts` - Shadowfell-specific rules
  - `InfernalMechanics.ts` - Nine Hells mechanics
  - `PlanarHazardSystem.ts` - Planar environmental hazards
  - `PortalSystem.ts` - Portal mechanics
- **Travel Systems**: `src/systems/travel/` - Overland travel mechanics
- **Travel Events**: `travelEventService.ts`, `travelService.ts` - Event generation

## File Ownership

| Path | Type | Description |
|------|------|-------------|
| `src/systems/planar/*.ts` | Directory | Planar systems |
| `src/systems/travel/*.ts` | Directory | Travel systems |
| `src/services/travel*.ts` | Service | Travel logic and events |
| `src/data/planes.ts` | Data | Plane definitions |
| `src/data/travelEvents.ts` | Data | Travel event definitions |
| `src/utils/planar*.ts` | Utils | Planar utilities |
| `src/utils/travel/*.ts` | Utils | Travel utilities |
| `src/types/planes.ts` | Types | Plane types |
| `src/types/travel.ts` | Types | Travel types |

## Dependencies

### Depends On

- **[Combat](./combat.md)**: Planar combat modifiers
- **[Submap](./submap.md)**: Travel event triggers

### Used By

- **[Submap](./submap.md)**: Planar terrain effects
- **[Combat](./combat.md)**: Planar environment effects

## Boundaries / Constraints

- Planar effects should modify existing systems, not replace them
- Travel events should be procedural but consistent with seed
- Portal mechanics should respect planar travel rules
- Plane-specific mechanics should be isolated to their files

## Open Questions / TODOs

- [ ] Document planar corruption mechanics
- [ ] Clarify portal discovery system
- [ ] Map planar faction interactions

### Claimed Tests (Auto-generated)

| Test File | Description |
|-----------|-------------|
| `src/systems/planar/__tests__/FeywildMechanics.test.ts` | Unit test |
| `src/systems/planar/__tests__/InfernalMechanics.test.ts` | Unit test |
| `src/systems/planar/__tests__/PlanarHazardSystem.test.ts` | Unit test |
| `src/systems/planar/__tests__/PlanarIntegration.test.ts` | Unit test |
| `src/systems/planar/__tests__/PlanarService.test.ts` | Unit test |
| `src/systems/planar/__tests__/PortalSystem.test.ts` | Unit test |
| `src/systems/planar/__tests__/ShadowfellMechanics.test.ts` | Unit test |
| `src/systems/planar/__tests__/rest.test.ts` | Unit test |
| `src/systems/travel/__tests__/TravelCalculations.test.ts` | Unit test |
| `src/utils/travel/__tests__/TravelCalculator.test.ts` | Unit test |
