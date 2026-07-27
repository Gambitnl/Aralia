/**
 * @file DistantTerrain.tsx
 * Distant horizon terrain for the 3D combat map — a procedurally displaced
 * ridge band ringing the battlefield so the map reads as part of a larger
 * landscape instead of a flat slab floating in fog.
 *
 * Why this exists:
 * The combat map already has a flat ground apron, a mesa skirt, and a gradient
 * sky dome (see BattleMap3D.tsx). But between the battlefield edge and the
 * horizon there was nothing — the eye travelled "detailed map → flat colored
 * disk → fog → sky", which reads as a diorama in haze. This component fills
 * that mid/far ground with rolling hills / mesas / cavern walls that rise above
 * the apron and dissolve into the scene fog, giving real depth.
 *
 * Design notes:
 * - One low-poly annulus (ring) mesh centered on the map. Vertices are pushed
 *   up by layered value-noise into terrain. No textures (matches the codebase's
 *   procedural style), no shadow casting, a few thousand tris — cheap.
 * - Scene fog (per biome, set in BattleMap3D) does the distance fade. The ridge
 *   base color is chosen to melt into each biome's fog/horizon color, and the
 *   SkyDome horizon is already set to the fog color, so ridge → fog → sky is
 *   seamless.
 * - Open biomes (forest/desert/swamp) get distant rolling terrain. Enclosed
 *   biomes (cave/dungeon) get a taller, steeper, closer dark ring that reads as
 *   cavern walls instead of an open horizon — their intentional dark mood is
 *   preserved, not brightened.
 *
 * Scope: this is decorative backdrop geometry inside the combat scene (like the
 * apron and sky dome). It is NOT World3D exploration terrain.
 */
import React from 'react';
import { BattleMapData } from '../../../types/combat';
interface DistantTerrainProps {
    mapData: BattleMapData;
}
/**
 * Procedural ridge band ringing the battlefield. Single mesh, fogged, no
 * shadows. Geometry is built centered on the origin and the mesh is positioned
 * at the map center so it surrounds the play area.
 */
declare const DistantTerrain: React.FC<DistantTerrainProps>;
export default DistantTerrain;
