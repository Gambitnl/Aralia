/**
 * @file WaterSystem.tsx
 * Animated water plane using MeshStandardMaterial + onBeforeCompile.
 *
 * Why onBeforeCompile instead of raw ShaderMaterial:
 * - PBR lighting, fog, and tone-mapping come for free from MeshStandardMaterial
 * - We only need to inject: uTime uniform, wave displacement, caustic color,
 *   and animated normal perturbation
 * - Much easier to make water look like it belongs in the scene
 *
 * Key visual fixes over previous version:
 * - Removed fract()-based depth proxy that created visible tile-grid lines
 * - Replaced with world-position FBM noise → seamless color variation
 * - Better biome color palettes (more vibrant, less dark/murky)
 * - Animated normal perturbation for ripple reflections
 * - Caustic brightening using dual scrolling FBM layers
 * - Crest brightness via wave displacement feedback
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md — "Water System"
 */
import React from 'react';
import { BattleMapData } from '../../../types/combat';
interface WaterSystemProps {
    mapData: BattleMapData;
}
declare const WaterSystem: React.FC<WaterSystemProps>;
export default WaterSystem;
