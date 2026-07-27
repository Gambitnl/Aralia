/**
 * @file DecorationProps.tsx
 * Procedural 3D decoration props (trees, boulders, stalagmites, pillars, cacti, mangroves)
 * rendered as instanced meshes for draw call efficiency.
 *
 * Until glTF models are sourced (Phase 2), props are rendered as procedural geometry:
 * - Trees: cylinder trunk + cone/sphere canopy
 * - Boulders: icosahedron with jittered vertices
 * - Stalagmites: cone pointing up
 * - Pillars: cylinder
 * - Cacti: green cylinder + arms
 * - Mangroves: twisted trunk + wide canopy
 *
 * Each prop type uses a single InstancedMesh for minimal draw calls.
 * Placement uses seeded random jitter (±0.3 tiles offset, random Y rotation)
 * so props don't sit on grid centers.
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md — "Decorations as 3D Props" section
 */
import React from 'react';
import { BattleMapData } from '../../../types/combat';
interface DecorationPropsProps {
    mapData: BattleMapData;
}
declare const DecorationProps: React.FC<DecorationPropsProps>;
export default DecorationProps;
