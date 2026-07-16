# Travel System — Cell-Native Movement (Absorbed 2026-07-14)

Preserved from `docs/projects/travel/` after absorption into planmap.

## Scope

Migrate travel, movement, discovery off rectangular grid onto Voronoi cells. Cell-selected = cell-traveled = cell-discovered.

## Current State

- Azgaar FMG embedded in MapPane via window.__araliaAzgaar bridge
- Travel highlights Voronoi polygons
- Grid Gap: still resolves to rectangular grid via gridTileFromWorld
- Many cells collapse to one grid tile

## Wired Systems

- Travel math: src/systems/travel/TravelCalculations.ts
- Navigation: src/systems/travel/TravelNavigation.ts  
- Movement: src/hooks/actions/handleMovement.ts
- Quick travel: src/components/Submap/useQuickTravel.ts

## Open Gaps

Tracked in planmap topic `maritime-remainder` (G1, G2).

Full git history: `git log docs/projects/travel/GAPS.md`

