# Submap

## Purpose

The Submap is the primary exploration interface where players navigate tile-based terrain within a region. It handles procedural terrain generation, travel mechanics, feature discovery, and day/night cycles. This is where most overworld gameplay occurs.

## Key Entry Points

| File | Role |
|------|------|
| `src/components/Submap/SubmapPane.tsx` | Main submap container (31KB) |
| `src/components/Submap/SubmapRendererPixi.tsx` | PixiJS-based rendering |
| `src/hooks/useSubmapProceduralData.ts` | Procedural generation hook |
| `src/components/Submap/submapData.ts` | Tile and feature data definitions |

## Subcomponents

- **Rendering**: `SubmapRendererPixi.tsx`, `SubmapTile.tsx` - Visual tile rendering
- **Painters**: `painters/` directory - Specialized PixiJS painters for terrain, features, overlays
- **Quick Travel**: `useQuickTravel.ts` - Fast travel mechanics
- **Tile Inspection**: `useInspectableTiles.ts` - Tile info on hover/click
- **Day/Night**: `useDayNightOverlay.ts` - Time-of-day visual effects
- **Procedural Data**: `useSubmapProceduralData.ts` - Terrain generation
- **Visuals**: `submapVisuals.ts` - Visual configuration and styling

## File Ownership

| Path | Type | Description |
|------|------|-------------|
| `src/components/Submap/*.tsx` | Directory | All submap components |
| `src/components/Submap/painters/*.ts` | Directory | PixiJS painter classes |
| `src/components/Submap/hooks/*.ts` | Directory | Submap-specific hooks |
| `src/components/Submap/use*.ts` | Hook | Submap-related hooks |
| `src/hooks/useSubmap*.ts` | Hook | Procedural generation |
| `src/services/cellularAutomataService.ts` | Service | Procedural generation |
| `src/services/wfcService.ts` | Service | Procedural generation |
| `src/utils/submapUtils.ts` | Utils | Submap utility functions |
| `src/utils/realmsmithRng.ts` | Utils | RNG utilities |

## Battle Map Systems (Owned by Battle Map Domain)

Battle map systems (hooks and services for tactical grid generation and state management) are owned by the [Battle Map](./battle-map.md) domain and not claimed by submap.


## Dependencies

### Depends On

- **[World Map](./world-map.md)**: Receives region context from world map navigation
- **[Combat](./combat.md)**: Triggers combat encounters
- **[Planes / Travel](./planes-travel.md)**: Travel event system
- **[Glossary](./glossary.md)**: Displays tile/feature information

### Used By

- **[Town Map](./town-map.md)**: Submap navigates to towns via village tiles
- **[Battle Map](./battle-map.md)**: Combat transitions from submap encounters
- **App.tsx**: Main game view renders submap

## Boundaries / Constraints

- Submap should NOT directly modify combat state (use Combat domain)
- Village tiles should trigger Town Map transition, not render town internally
- Procedural generation should be deterministic given the same seed

## Open Questions / TODOs

- [ ] Optimize PixiJS rendering for large submaps
- [ ] Document painter architecture (SubmapTilePainter, SubmapFeaturePainter, etc.)
- [ ] Clarify boundary between submapData.ts and biomes.ts
- [ ] TODO(Lockpick): Integrate trap detection into Submap movement logic.

## Claimed Tests

| Test File | Description |
|-----------|-------------|
| `src/services/villageGenerator.test.ts` | Village generator tests |
| `src/utils/__tests__/visualUtils.test.ts` | Visual utility tests |
| `src/utils/__tests__/pathfindingHeuristic.test.ts` | Pathfinding heuristic tests |
