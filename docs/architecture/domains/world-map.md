# World Map

## Purpose

The World Map provides region-level navigation showing the broader geography of the game world. Players use it to select regions for exploration and view discovered landmarks and points of interest.

## Key Entry Points

| File | Role |
|------|------|
| `src/components/MapPane.tsx` | Main map component (12KB) |
| `src/components/MapTile.tsx` | Individual region tiles |
| `src/services/mapService.ts` | Map data service |
| `src/components/WorldPane.tsx` | World overview panel |

## Subcomponents

- **Region Tiles**: `MapTile.tsx` - Clickable region representations
- **Map Controls**: Within `MapPane.tsx` - Zoom, pan, selection
- **World Overview**: `WorldPane.tsx` - Summary panel
- **Minimap**: `Minimap.tsx` - Navigation minimap

## File Ownership

| Path | Type | Description |
|------|------|-------------|
| `src/components/MapPane.tsx` | Component | Main map display |
| `src/components/MapTile.tsx` | Component | Region tile |
| `src/components/WorldPane.tsx` | Component | World overview |
| `src/components/Minimap.tsx` | Component | Minimap navigation |
| `src/services/mapService.ts` | Service | Map data handling |
| `src/data/world/` | Data | World data definitions |
| `src/types/exploration.ts` | Types | Exploration types |
| `src/state/reducers/worldReducer.ts` | Reducer | World state |

## Dependencies

### Depends On

- **[Data Pipelines](./data-pipelines.md)**: World data generation

### Used By

- **[Submap](./submap.md)**: Region selection transitions to submap
- **App.tsx**: World map view rendering

## Boundaries / Constraints

- World Map is for region selection, not tile-level exploration
- Landmark discovery should update world state
- Navigation should respect travel restrictions

## Open Questions / TODOs

- [ ] Document region discovery mechanics
- [ ] Clarify zoom level implementation
- [ ] Map relationship between world data and biomes
