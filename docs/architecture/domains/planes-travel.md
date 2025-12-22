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
| `src/types/history.ts` | Types | Historical event types |

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
| `src/systems/planar/__tests__/FeywildMechanics.test.ts` | Feywild mechanics tests |
| `src/systems/planar/__tests__/InfernalMechanics.test.ts` | Infernal mechanics tests |
| `src/systems/planar/__tests__/PlanarHazardSystem.test.ts` | Planar hazard system tests |
| `src/systems/planar/__tests__/PlanarIntegration.test.ts` | Planar integration tests |
| `src/systems/planar/__tests__/PlanarService.test.ts` | Planar service tests |
| `src/systems/planar/__tests__/PortalSystem.test.ts` | Portal system tests |
| `src/systems/planar/__tests__/ShadowfellMechanics.test.ts` | Shadowfell mechanics tests |
| `src/systems/planar/__tests__/rest.test.ts` | Rest mechanics tests |
| `src/systems/travel/__tests__/TravelCalculations.test.ts` | Travel calculation tests |
| `src/utils/travel/__tests__/TravelCalculator.test.ts` | Travel calculator utility tests |
| `src/services/__tests__/travelEventService.test.ts` | Travel event service tests |
| `src/services/__tests__/travelService.test.ts` | Travel service tests |
| `src/systems/religion/__tests__/favor.test.ts` | Religion favor system tests |
| `src/utils/__tests__/planarUtils.test.ts` | Planar utility tests |
| `src/utils/__tests__/planarUtils_atmosphere.test.ts` | Planar atmosphere utility tests |
| `src/utils/__tests__/religionUtils.test.ts` | Religion utility tests |
| `src/data/__tests__/planes.test.ts` | Planes data tests |
