# Environment & Physics

## Purpose

Handles environmental effects (weather, day/night cycles, hazards), terrain mechanics, and physical/elemental interactions within the game world.

## Key Entry Points

| File | Role |
|------|------|
| `src/systems/environment/` | Environmental systems |
| `src/systems/physics/` | Physics and elemental systems |

## Subcomponents

- **Environment**: Weather, hazards, and terrain-specific mechanics.
- **Physics**: Elemental interactions and physical object logic.

## File Ownership

| Path | Type | Description |
|------|------|-------------|
| `src/systems/environment/*.ts` | Directory | Environment systems |
| `src/systems/physics/*.ts` | Directory | Physics systems |
| `src/components/Submap/submapVisuals.ts` | Config | Visual settings |
| `src/data/biomes.ts` | Data | Biome definitions |
| `src/data/underdark/*.ts` | Data | Underdark environment data |
| `src/types/realmsmith.ts` | Types | RealmSmith generation types |
| `src/types/village.ts` | Types | Village generation types |
| `src/types/environment.ts` | Types | Environmental types |
| `src/utils/physicsUtils*.ts` | Utils | Physics utilities |
| `src/utils/walkabilityUtils.ts` | Utils | Movement validation |
| `src/utils/locationUtils.ts` | Utils | Position helpers |

## Systems Owned by Other Domains

The following files have environmental aspects but are primarily owned elsewhere:
- `src/data/world/pois.ts` — managed by npcs-companions (NPC locations)
- `src/services/landmarkService.ts` — managed by time-world-events (historical landmarks)
- `src/services/underdarkService.ts` — managed by naval-underdark (underdark exploration)

## Dependencies

### Depends On

- **[Combat](./combat.md)**: Hazards and weather affect combat stats

### Used By

- **[Submap](./submap.md)**: Overworld environmental effects
- **[Battle Map](./battle-map.md)**: Tactical environment effects

### Claimed Tests (Auto-generated)

| Test File | Description |
|-----------|-------------|
| `src/systems/environment/__tests__/EnvironmentSystem.test.ts` | Unit test |
| `src/systems/environment/__tests__/TerrainSystem.test.ts` | Unit test |
| `src/systems/environment/__tests__/hazards.test.ts` | Unit test |
| `src/systems/physics/__tests__/ElementalInteractionSystem.test.ts` | Unit test |
