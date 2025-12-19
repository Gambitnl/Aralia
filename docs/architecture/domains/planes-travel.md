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
| `src/systems/planar/` | Directory | Planar systems (~13 files) |
| `src/systems/planar/FeywildMechanics.ts` | System | Feywild rules |
| `src/systems/planar/ShadowfellMechanics.ts` | System | Shadowfell rules |
| `src/systems/planar/InfernalMechanics.ts` | System | Infernal rules |
| `src/systems/planar/PlanarHazardSystem.ts` | System | Hazards |
| `src/systems/planar/PortalSystem.ts` | System | Portals |
| `src/systems/planar/rest.ts` | System | Planar rest mechanics |
| `src/systems/travel/` | Directory | Travel systems |
| `src/services/travelEventService.ts` | Service | Travel events |
| `src/services/travelService.ts` | Service | Travel logic |
| `src/data/planes.ts` | Data | Plane definitions |
| `src/data/travelEvents.ts` | Data | Travel event definitions |
| `src/utils/planarUtils.ts` | Utils | Planar utilities |
| `src/utils/travel/` | Utils | Travel utilities |
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
