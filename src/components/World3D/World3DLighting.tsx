/**
 * @file World3DLighting.tsx
 * @description Sun + sky + atmosphere for the streamed 3D ground world
 * (beautification wave, lighting lift — sub-spec beautification--lighting-migration.md).
 *
 * What lives here:
 * - Time-of-day sun model: `sunFromTime(hours)` maps a fractional hour to a sun
 *   direction + warm/cool color mix. Plumbed but fixed at a pleasant late-morning
 *   default by the host (no UI yet); the game clock can drive it later.
 * - Atmospheric `Sky` dome (drei / three in-tree Preetham) aligned to the same sun.
 * - Warm directional sun key + cool-sky/warm-ground hemisphere fill (battle-map
 *   parity: BattleMap3D uses the same warm-key/cool-fill split).
 * - Soft shadows (ground profile only): bounded ortho shadow camera that FOLLOWS
 *   the camera each frame with texel snapping, so a small high-res frustum covers
 *   the walking-scale neighbourhood instead of one giant acne-prone frustum over
 *   the whole streamed window. Continent profile keeps shadows off — the km-scale
 *   window is what caused the historical shadow-pass stalls.
 * - Distance fog tinted to the sky horizon so far terrain dissolves instead of
 *   ending on a flat page-background band.
 *
 * WebGL + WebGPU safe: standard three lights/materials only, no TSL.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import * as THREE from 'three';

export interface SunState {
  /** Unit-ish sun direction (points FROM origin TOWARD the sun). */
  direction: [number, number, number];
  /** Sun key light color (warm near horizon, neutral-warm at noon). */
  sunColor: number;
  sunIntensity: number;
  hemiSkyColor: number;
  hemiGroundColor: number;
  hemiIntensity: number;
  /** Fog / horizon haze tint, matched to the sky so the two blend. */
  fogColor: number;
}

/**
 * Simple analytic time-of-day model. Daylight-only for now (the streamed world
 * has no night mode yet): hours outside ~6..20 clamp to the nearest daylight edge.
 * Pure and deterministic so it can be tested and later driven by the game clock.
 */
export function sunFromTime(hours: number): SunState {
  const h = Math.min(20, Math.max(6, hours));
  // Sun elevation: 0 at 6h/20h, peak ~62° at 13h (solar noon).
  const t = (h - 6) / 14; // 0..1 across the day
  const elevation = Math.sin(t * Math.PI) * (62 * Math.PI) / 180;
  // Azimuth swings east→south→west across the day.
  const azimuth = (-100 + t * 200) * (Math.PI / 180);
  const cosE = Math.cos(elevation);
  const direction: [number, number, number] = [
    Math.sin(azimuth) * cosE,
    Math.sin(elevation),
    Math.cos(azimuth) * cosE,
  ];
  // Warmth rises as the sun drops (golden hour), neutral-warm high sun.
  const lowSun = 1 - Math.sin(t * Math.PI); // 1 at dawn/dusk, 0 at noon
  const sunColor = new THREE.Color(0xfff1da).lerp(new THREE.Color(0xffc27a), lowSun * 0.8);
  const fogColor = new THREE.Color(0xcdd9e6).lerp(new THREE.Color(0xe8cfae), lowSun * 0.5);
  return {
    direction,
    sunColor: sunColor.getHex(),
    sunIntensity: 1.6 + 0.5 * Math.sin(t * Math.PI),
    hemiSkyColor: 0xbcd6ff,
    hemiGroundColor: 0x6b6048,
    hemiIntensity: 0.55 + 0.25 * Math.sin(t * Math.PI),
    fogColor: fogColor.getHex(),
  };
}

/** Pleasant late-morning default (spec: plumbed, fixed, no UI). */
export const DEFAULT_TIME_OF_DAY_H = 10.5;

/** Half-extent (m) of the follow shadow frustum — covers the walking-scale neighbourhood. */
const SHADOW_HALF_M = 220;
const SHADOW_MAP_SIZE = 2048;
/** Sun distance from the frustum center along the sun direction. */
const SUN_DIST_M = 900;

const World3DLighting: React.FC<{
  viewProfile: 'continent' | 'ground';
  timeOfDayHours?: number;
}> = ({ viewProfile, timeOfDayHours = DEFAULT_TIME_OF_DAY_H }) => {
  const sun = useMemo(() => sunFromTime(timeOfDayHours), [timeOfDayHours]);
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const castShadows = viewProfile === 'ground';

  // Sky wants a far-away sun position; scale the unit direction up.
  const skySunPos = useMemo<[number, number, number]>(
    () => [sun.direction[0] * 1000, sun.direction[1] * 1000, sun.direction[2] * 1000],
    [sun],
  );

  // R3F pierced `shadow-camera-*` props set the ortho bounds but do NOT call
  // updateProjectionMatrix(), so without this the shadow frustum silently stays
  // at the three.js default ±5 m — shadows exist in a 10 m patch and look absent.
  useEffect(() => {
    // `.shadow` is absent on the mocked light in the jsdom test environment.
    lightRef.current?.shadow?.camera?.updateProjectionMatrix();
  }, [castShadows]);

  // Follow the camera with the shadow frustum, snapped to shadow-map texels so
  // shadow edges don't crawl/shimmer as the camera pans (standard CSM trick,
  // single cascade). Without this a static frustum either misses the player or
  // has to span the whole streamed window at mush resolution.
  useFrame(({ camera }) => {
    const light = lightRef.current;
    if (!light || !castShadows) return;
    const texel = (SHADOW_HALF_M * 2) / SHADOW_MAP_SIZE;
    const tx = Math.round(camera.position.x / texel) * texel;
    const tz = Math.round(camera.position.z / texel) * texel;
    // Center the frustum under the camera at terrain-ish height; generous
    // near/far absorb the vertical-exaggeration height range.
    light.target.position.set(tx, 0, tz);
    light.target.updateMatrixWorld();
    light.position.set(
      tx + sun.direction[0] * SUN_DIST_M,
      sun.direction[1] * SUN_DIST_M,
      tz + sun.direction[2] * SUN_DIST_M,
    );
  });

  return (
    <>
      {/* Atmospheric sky dome (Preetham scattering) — sun aligned to the
          directional key so lit faces match where the sun visibly sits. */}
      <Sky
        distance={45000}
        sunPosition={skySunPos}
        turbidity={6}
        rayleigh={1.2}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />
      {/* Cool sky / warm ground-bounce hemisphere fill. */}
      <hemisphereLight args={[sun.hemiSkyColor, sun.hemiGroundColor, sun.hemiIntensity]} />
      {/* Warm sun key. Bias pair tuned against acne (bias) and peter-panning
          (normalBias kept small in meters — buildings are ~5 m tall). */}
      <directionalLight
        ref={lightRef}
        position={[sun.direction[0] * SUN_DIST_M, sun.direction[1] * SUN_DIST_M, sun.direction[2] * SUN_DIST_M]}
        intensity={sun.sunIntensity}
        color={sun.sunColor}
        castShadow={castShadows}
        shadow-mapSize-width={SHADOW_MAP_SIZE}
        shadow-mapSize-height={SHADOW_MAP_SIZE}
        shadow-camera-near={10}
        shadow-camera-far={SUN_DIST_M + SHADOW_HALF_M * 4}
        shadow-camera-left={-SHADOW_HALF_M}
        shadow-camera-right={SHADOW_HALF_M}
        shadow-camera-top={SHADOW_HALF_M}
        shadow-camera-bottom={-SHADOW_HALF_M}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
      />
      {/* Distance fog tinted to the sky horizon. Ground profile pulls it in to
          meet the artifact-edge haze; continent keeps the km-scale falloff.
          Near distances stay generous so the midground never grays out. */}
      <fog
        attach="fog"
        args={viewProfile === 'ground' ? [sun.fogColor, 450, 2000] : [sun.fogColor, 1100, 5200]}
      />
    </>
  );
};

export default World3DLighting;
