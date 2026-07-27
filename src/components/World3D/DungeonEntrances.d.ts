/**
 * @file DungeonEntrances.tsx — Pillar 2, Task 6 render rung for world-grown
 * dungeon ENTRANCES. `GroundWorld.dungeonEntrances` carries a sealed-door site
 * per dungeon whose mouth falls in the window; this draws a simple but READABLE
 * marker per `entranceKind` so a player can spot and walk up to one.
 *
 * Approach (matches GroundProps' flat-shaded primitive look):
 *  - Each entrance is a small per-instance <group> of a few boxes/cylinders —
 *    entrances are low-count (a handful per window), so no instancing needed.
 *  - Position: xM/zM are window-local ground meters; Y is sampled from the
 *    heightfield via `groundSurfaceY` (exactly like GroundProps/PlayerAvatar),
 *    then rebased into scene space by subtracting the scene origin.
 *  - NO lights (hard rule) — pure geometry + flat materials.
 *
 * The four kinds:
 *  - ruin-door:   a stone doorframe slab (two jambs + a lintel) with a dark leaf.
 *  - cave-mouth:  a dark arch set against a low rock mound.
 *  - temple-stair: a stair-down block (descending step slabs into a dark shaft).
 *  - sewer-grate: a flat grate disc set in a stone rim.
 */
import React from 'react';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { type GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
interface DungeonEntrancesProps {
    ground?: GroundWorld | null;
    sceneOrigin: SceneOrigin;
}
declare const DungeonEntrances: React.FC<DungeonEntrancesProps>;
export default DungeonEntrances;
