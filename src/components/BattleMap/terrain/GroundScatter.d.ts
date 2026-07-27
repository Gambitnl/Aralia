/**
 * @file GroundScatter.tsx
 * Small ground-level scatter objects that fill open tiles with visual interest.
 *
 * Generates instanced meshes for:
 * - Small rock clusters (2-4 pebbles merged)
 * - Fallen leaves (flat quads with slight curl)
 * - Twig bundles (thin cylinders at angles)
 * - Mushroom patches (tiny spheres on stems)
 *
 * Placement strategy:
 * - 4-8 scatter objects per open grass tile
 * - Skip tiles with decorations (trees, boulders already fill them)
 * - Reduced density near tile edges for natural transition
 * - Seeded random for deterministic placement
 *
 * Performance: ~3000-5000 instances total, split across 4 InstancedMeshes.
 * Single draw call per scatter type.
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md
 */
import React from 'react';
import { BattleMapData } from '../../../types/combat';
interface GroundScatterProps {
    mapData: BattleMapData;
}
declare const GroundScatter: React.FC<GroundScatterProps>;
export default GroundScatter;
