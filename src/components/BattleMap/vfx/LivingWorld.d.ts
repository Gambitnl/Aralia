/**
 * @file LivingWorld.tsx
 * Ambient environmental effects that make the 3D battlefield feel alive.
 *
 * Per-biome ambient particles and atmospheric effects:
 * - Forest: floating pollen/dust motes, fireflies (at night)
 * - Cave: dripping water particles, bioluminescent spores
 * - Dungeon: drifting dust, torch ember sparks
 * - Desert: sand/dust drifts, heat shimmer (via vertex distortion)
 * - Swamp: fog wisps, insects, floating spores
 *
 * Also provides:
 * - Ambient particle field (pollen, dust, embers) with gentle drift
 * - Weather layer (rain, snow) for biome-specific weather
 * - Firefly / bioluminescent point lights
 *
 * Performance: Uses a single Points mesh for ambient particles (~500-1000 particles),
 * and a small number of animated point lights for fireflies (max 8).
 *
 * Research references:
 * - R3F weather visualization: https://tympanus.net/codrops/2025/09/18/creating-an-immersive-3d-weather-visualization-with-react-three-fiber/
 * - Three.js particles: https://threejs-journey.com/lessons/particles
 * - Particle recycling pattern: https://discourse.threejs.org/t/realistic-rain-snow-fall-with-threejs/53810
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md — "Living World" section
 */
import React from 'react';
import { BattleMapData } from '../../../types/combat';
interface LivingWorldProps {
    mapData: BattleMapData;
}
declare const LivingWorld: React.FC<LivingWorldProps>;
export default LivingWorld;
