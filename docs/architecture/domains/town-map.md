# Town Map

## Purpose

The Town Map renders interior layouts of villages and towns, allowing players to navigate within settlements, interact with NPCs, and access town services like shops and temples.

## Key Entry Points

| File | Role |
|------|------|
| `src/components/Town/TownCanvas.tsx` | Main town renderer (30KB) |
| `src/components/Town/VillageScene.tsx` | Village scene composition |
| `src/services/RealmSmithTownGenerator.ts` | Town generation (53KB) |
| `src/hooks/useTownController.ts` | Town navigation hook |

## Subcomponents

- **Canvas Rendering**: `TownCanvas.tsx` - Main isometric/2D rendering
- **Village Scene**: `VillageScene.tsx` - Scene composition
- **Dev Controls**: `TownDevControls.tsx` - Development/debug tools
- **Navigation**: `TownNavigationControls.tsx` - Player movement controls
- **Generation**: `RealmSmithTownGenerator.ts` - Procedural town layout

## File Ownership

| Path | Type | Description |
|------|------|-------------|
| `src/components/Town/` | Directory | Town UI components |
| `src/components/Town/TownCanvas.tsx` | Component | Main renderer |
| `src/components/Town/VillageScene.tsx` | Component | Scene wrapper |
| `src/components/Town/TownDevControls.tsx` | Component | Dev tools |
| `src/components/Town/TownNavigationControls.tsx` | Component | Navigation |
| `src/components/Town/index.ts` | Index | Public exports |
| `src/services/RealmSmithTownGenerator.ts` | Service | Town generation |
| `src/services/realmsmith/` | Directory | RealmSmith subsystems |
| `src/services/RealmSmithAssetPainter.ts` | Service | Asset rendering |
| `src/services/villageGenerator.ts` | Service | Village generation (26KB) |
| `src/hooks/useTownController.ts` | Hook | Town navigation |
| `src/state/reducers/townReducer.ts` | Reducer | Town state |
| `src/types/town.ts` | Types | Town type definitions |
| `src/types/realmsmith.ts` | Types | RealmSmith types |

## Dependencies

### Depends On

- **[Submap](./submap.md)**: Entry from village tiles on submap
- **[NPCs / Companions](./npcs-companions.md)**: NPC placement and interaction
- **[Items / Trade / Inventory](./items-trade-inventory.md)**: Shop/merchant access

### Used By

- **App.tsx**: Town view rendering

## Boundaries / Constraints

- Town generation should be deterministic given same seed
- Town should not trigger combat encounters directly
- Navigation should respect building collision
- Exit points should return to submap at correct position

## Open Questions / TODOs

- [ ] Document RealmSmith architecture
- [ ] Clarify asset painter system
- [ ] Map building interaction system
