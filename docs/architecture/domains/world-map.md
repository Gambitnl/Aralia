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

## Navigation Mechanics

### Zoom Implementation
Zooming is handled via CSS transformations on the main grid container within `MapPane.tsx`.
- **State**: Managed via local `scale` (0.5x to 3.0x) and `offset` (x/y pan) state.
- **Controls**:
  - **Mouse Wheel**: +/- 0.1 scale increments.
  - **Keyboard**: `+`/`-` keys for 0.1 scale increments.
  - **UI Buttons**: On-screen controls for 0.2 scale increments.
- **Rendering**: The grid applies `transform: translate(x, y) scale(z)`. Child `MapTile` components do not handle zoom logic directly.

### Panning
- **Mouse Drag**: Standard click-and-drag updates the `offset` state.
- **Keyboard Navigation**: Arrow keys move the focused cursor (selection), but do not natively pan the view unless the focused element scrolls into view (browser behavior).

## File Ownership

| Path | Type | Description |
|------|------|-------------|
| `src/components/MapPane.tsx` | Component | Main map display |
| `src/components/__tests__/MapTile.test.tsx` | Test | Region tile tests |
| `src/components/MapTile.tsx` | Component | Region tile |
| `src/components/WorldPane.tsx` | Component | World overview |
| `src/components/Minimap.tsx` | Component | Minimap navigation |
| `src/services/mapService.ts` | Service | Map data handling |
| `src/types/world.ts` | Types | World entity types |
| `src/types/exploration.ts` | Types | Exploration types |
| `src/utils/economyUtils.ts` | Utils | Economy helper |

## Tests

| Test File | Description |
|-----------|-------------|
| `src/components/__tests__/MapTile.test.tsx` | Map tile UI tests |


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
- [x] Clarify zoom level implementation
- [ ] Map relationship between world data and biomes
