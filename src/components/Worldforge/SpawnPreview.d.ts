/**
 * @file SpawnPreview.tsx — dedicated preview mode for the reroll→spawn problem.
 *
 * Reachable at `?phase=spawnpreview`. This harness exists to make the "player
 * spawning on an ocean tile" bug reproducible and *visible* in isolation, decoupled
 * from live game state. Each reroll:
 *   1. generates a fresh legacy map (`generateMap`, the same call the game uses),
 *   2. applies the real spawn fix (`applyWfSpawnToMap`: unify biomes → resolve a
 *      land/burg spawn → relocate the player tile), then
 *   3. renders the marker through the EXACT MapPane pipeline — the player's
 *      `isPlayerCurrent` grid tile mapped back through the grid↔atlas bridge to a
 *      Voronoi cell, marker placed at that cell's site — over the real atlas.
 *
 * A readout panel reports the resolved spawn (seed, grid cell, burg, atlas cell,
 * height, biome) and a big PASS/FAIL: FAIL means the rendered marker sits on a
 * water cell (h < 20), i.e. the ocean-spawn bug. A batch iterator runs N rerolls
 * and tallies failures so the invariant can be checked at a glance.
 *
 * `window.__spawnPreview` exposes `reroll(seed?)` and `audit(n)` for headless proof.
 */
import React from 'react';
declare const SpawnPreview: React.FC;
export default SpawnPreview;
