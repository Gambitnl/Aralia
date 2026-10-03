/**
 * @file EzTreeLayer.tsx
 * Procedural trees using the vendored ez-tree library (vendor/ez-tree/).
 *
 * The npm package @dgreenheck/ez-tree has module-level TextureLoader side-effects
 * in textures.js that prevent R3F Canvas WebGL initialization. The vendored copy
 * stubs that file out so the Tree geometry generator can be imported safely.
 *
 * Strategy:
 * - Generate N tree variant geometries once (different presets + seeds per biome)
 * - Use THREE.InstancedMesh for branches and leaves — all trees share draw calls
 * - Override ALL materials with solid MeshStandardMaterial (no texture uploads)
 * - Biome configs own which species and seeds to use
 *
 * Scale calibration:
 * - Oak Medium: trunk length[0] = 37.24 native units
 * - At scale 0.065 → 37.24 * 0.065 ≈ 2.4 world units of trunk
 * - Full tree height ~3-4 world units (one tile = 1 world unit, camera at y=10)
 */
import React from 'react';
import { BattleMapData } from '../../../types/combat';
interface EzTreeLayerProps {
    mapData: BattleMapData;
}
declare const EzTreeLayer: React.FC<EzTreeLayerProps>;
export default EzTreeLayer;
