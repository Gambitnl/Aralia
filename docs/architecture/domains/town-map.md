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
| `src/components/Town/*.ts*` | Directory | Town UI components and index |
| `src/services/realmsmith/**/*.ts` | Directory | RealmSmith subsystems |
| `src/services/RealmSmith*.ts` | Service | Town generation and assets |
| `src/services/villageGenerator.ts` | Service | Village generation |
| `src/hooks/useTownController.ts` | Hook | Town navigation |
| `src/state/reducers/townReducer.ts` | Reducer | Town state |
| `src/types/town.ts` | Types | Town type definitions |


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

### Claimed Tests (Auto-generated)

| Test File | Description |
|-----------|-------------|
| `src/components/Town/__tests__/TownCanvasPan.test.tsx` | Town canvas panning tests |
| `src/components/Town/__tests__/TownDevControls.test.tsx` | Town dev controls tests |
| `src/components/Town/__tests__/TownNavigationControls.test.tsx` | Town navigation control tests |
| `src/hooks/__tests__/useTownController.test.tsx` | Town controller hook tests |
| `src/components/__tests__/MerchantModal.test.tsx` | Merchant modal component tests |
| `src/services/__tests__/strongholdService.test.ts` | Stronghold service tests |
