/**
 * @file VolumetricClouds.tsx
 * @description Physically-based volumetric clouds for World3D, hosted INSIDE
 * the scene's existing post chain rather than a second EffectComposer.
 *
 * Why this shape (2026-08-26, night-sky port follow-up):
 * - @takram/three-clouds' <Clouds> is a postprocessing `Effect` (fullscreen
 *   ray-march, needs only the DEPTH buffer). It attaches itself to whichever
 *   EffectComposer is in React context — so it can join World3DScene's own
 *   N8AO + ACES ToneMapping chain as a sibling effect.
 * - The blocker everyone assumed was "two EffectComposers cannot stack in one
 *   canvas". That's true, but it was never required: the only hard constraints
 *   are (a) <Clouds> must sit inside an <Atmosphere> context provider for the
 *   sun direction + ECEF matrix, and (b) it must be inside a composer for
 *   camera + depth. Both hold here with ONE composer.
 * - <Atmosphere> is a pure context provider (renders no meshes) and loads its
 *   pre-baked Bruneton LUTs through three's TextureLoader, which URL-caches —
 *   so the second instance this component mounts costs almost nothing over
 *   TakramSkySystem's own.
 * - Mounted unconditionally (day AND night): the ray-marched clouds composite
 *   over whatever sky is behind them. NightSky's TakramSkySystem stays
 *   effectComposerEnabled={false} so it never tries to stack its own composer.
 *
 * Known limitation: World3DScene's post chain only exists on the ground
 * profile (viewProfile === 'ground'); the continent view deliberately has no
 * composer (it relies on gl.toneMapping). So clouds render on the ground
 * profile only for now.
 *
 * FIX (2026-08-28): CloudsEffect.skipRendering defaults to true via
 * @define('SKIP_RENDERING'), which adds a shader #define that zeroes alpha.
 * Without skipRendering={false}, the ray-march runs but composites zero alpha
 * — invisible clouds. TakramSkySystem already passes this prop; this component
 * did not. TEMP diagnostic code (scene.traverse readback) removed.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Vector3 } from 'three';
import { Vector3 as ThreeVector3 } from 'three';
import { Atmosphere, type AtmosphereApi } from '@takram/three-atmosphere/r3f';
import { Clouds } from '@takram/three-clouds/r3f';
import type { CloudsQualityPreset } from '@takram/three-clouds';
import { trueSunVector } from './World3DLighting';
import {
  ATMOSPHERE_TEXTURES_URL,
  CLOUD_LOCAL_WEATHER_URL,
  CLOUD_SHAPE_DETAIL_URL,
  CLOUD_SHAPE_URL,
  CLOUD_STBN_URL,
  CLOUD_TURBULENCE_URL,
  WORLD_TO_ECEF,
} from './sky/TakramSkySystem';

const _ecefSunDir = new ThreeVector3();

const VolumetricClouds: React.FC<{
  timeOfDayHours?: number;
  /** 0–1 cloud density, forwarded to Clouds.coverage. */
  cloudCoverage?: number;
  /** Takram quality preset — 'low' during development; 'high' for screenshots. */
  qualityPreset?: CloudsQualityPreset;
}> = ({ timeOfDayHours = 18.2, cloudCoverage = 0.5, qualityPreset = 'low' }) => {
  const sunDirection = useMemo(() => trueSunVector(timeOfDayHours), [timeOfDayHours]);
  const atmosphereRef = useRef<AtmosphereApi>(null);

  // Same per-frame sun injection TakramSkySystem does: the Atmosphere API's
  // sunDirection IS the transient state <Clouds> reads every frame.
  useFrame(() => {
    const atm = atmosphereRef.current;
    if (!atm) return;
    _ecefSunDir.copy(sunDirection).transformDirection(WORLD_TO_ECEF);
    atm.sunDirection.copy(_ecefSunDir);
    atm.worldToECEFMatrix.copy(WORLD_TO_ECEF);
  });

  return (
    // correctAltitude + ground={false}: same reasoning as TakramSkySystem —
    // WGS84 radius exceeds Bruneton's, and our scene owns the terrain disc.
    <Atmosphere
      ref={atmosphereRef}
      textures={ATMOSPHERE_TEXTURES_URL}
      correctAltitude
      ground={false}
    >
      <Clouds
        coverage={cloudCoverage}
        qualityPreset={qualityPreset}
        skipRendering={false}
        // Thin leaf silhouettes need current-frame cloud coverage at full
        // resolution; reconstructed samples left speckles along the skyline.
        temporalUpscale={false}
        localWeatherTexture={CLOUD_LOCAL_WEATHER_URL}
        shapeTexture={CLOUD_SHAPE_URL}
        shapeDetailTexture={CLOUD_SHAPE_DETAIL_URL}
        turbulenceTexture={CLOUD_TURBULENCE_URL}
        stbnTexture={CLOUD_STBN_URL}
      />
    </Atmosphere>
  );
};

export default VolumetricClouds;
