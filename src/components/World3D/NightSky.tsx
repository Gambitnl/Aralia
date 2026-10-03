// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/08/2026, 14:47:53
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file NightSky.tsx
 * @description Physically-based NIGHT sky for World3D — stars, moon, and the
 * Bruneton atmospheric dome from @takram/three-atmosphere, via the component
 * extracted out of ThreeDModal on 2026-08-26 (src/components/World3D/sky/).
 *
 * Mount-and-forget contract:
 * - Renders NOTHING while the true astronomical sun is above the horizon, so
 *   the existing daytime path (GradientSky dome + World3DLighting) stays
 *   byte-identical. The swap to the Bruneton dome happens at twilight, where
 *   both skies are in their dusk states. A crossfade was considered and
 *   deferred — the hard swap has not yet shown a visible seam.
 * - effectComposerEnabled={false} is LOAD-BEARING: TakramSkySystem's internal
 *   EffectComposer exists only to drive volumetric Clouds + their ToneMapping,
 *   and World3DScene already runs its own post chain (N8AO + ACES ToneMapping).
 *   Two EffectComposers cannot stack in one R3F canvas — the second would take
 *   over rendering. Sky dome, Stars, and Moon all render as ordinary scene
 *   meshes and work without it; volumetric clouds remain deferred until the
 *   scene's post chain can host the atmosphere-scoped composer.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import TakramSkySystem from './sky/TakramSkySystem';
import { DEFAULT_TIME_OF_DAY_H, trueSunVector } from './World3DLighting';

/** True-sun height below which the night sky takes over from the gradient dome. */
export const NIGHT_SKY_SUN_Y = 0.02;

const NightSky: React.FC<{ timeOfDayHours?: number }> = ({
  timeOfDayHours = DEFAULT_TIME_OF_DAY_H,
}) => {
  // Rebuilt only when the clock hour changes; TakramSkySystem reads this same
  // Vector3 object every frame inside its own useFrame.
  const sunDirection = useMemo(() => trueSunVector(timeOfDayHours), [timeOfDayHours]);

  // Day / high twilight: nothing to render — pre-night path untouched.
  if (sunDirection.y > NIGHT_SKY_SUN_Y) return null;

  return (
    <TakramSkySystem
      sunDirection={sunDirection as THREE.Vector3}
      effectComposerEnabled={false}
      starsEnabled
      moonEnabled
    />
  );
};

export default NightSky;
