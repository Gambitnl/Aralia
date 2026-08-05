// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/07/2026, 00:34:41
 * Dependents: components/World3D/WebGPUProbeScene.tsx, components/World3D/World3DScene.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
import * as THREE from 'three';
import { GROUND_FOG_FAR, GROUND_FOG_NEAR, type CanopyInterior } from './canopyInterior';

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
  /** Gradient-sky zenith color (deep blue high sun, indigo at dusk). */
  skyZenith: number;
  /** Gradient-sky horizon-band color, matched to the fog so they blend. */
  skyHorizon: number;
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
  // How far the sun has dropped, 0 at solar noon and 1 at the daylight edges.
  // Note this is LINEAR IN ELEVATION (elevation = sin(t·π) · 62°), so it reads
  // 0.61 at a sun still 24° up — most of an afternoon sky.
  const lowSun = 1 - Math.sin(t * Math.PI);
  // Reddening of DIRECT sunlight is an air-mass effect: it barely exists above
  // ~15° elevation and then runs away as the sun touches the horizon. Using
  // `lowSun` raw made the whole afternoon amber, and amber light is not a tint
  // — it is a multiply. Measured at the 18.2h default, the raw ramp put the key
  // at linear (1.00, 0.58, 0.32), which turned savanna ground whose vertex
  // colour is (0.50, 0.66, 0.36) into an on-screen 105,76,59: red-dominant, the
  // green lead not just reduced but INVERTED. Cubing concentrates the amber
  // into the last hour where it belongs (0.61 → 0.22 at the default hour, still
  // 1.00 at true dusk), so grassland reads green in the afternoon and sunset
  // still burns. Rejected alternatives: lightening the biome palettes (hides a
  // lighting bug in the art, and would undo today's dark forest-litter fix) and
  // simply moving the default hour to midday (throws away the wanted low-sun
  // shadows and warm sky, and leaves the curve wrong for every other hour).
  const keyWarmth = lowSun * lowSun * lowSun;
  // Key light: creamy high sun, deep amber at true golden hour.
  const sunColor = new THREE.Color(0xfff0d0).lerp(new THREE.Color(0xff9c46), keyWarmth * 0.9);
  // Atmosphere warms EARLIER and more readily than the key does: the horizon
  // band is hazy and warm well before the sun itself reddens, and unlike the
  // key it multiplies nothing — it only sits in front of distant terrain
  // (ground fog starts at 600 m). So sky and fog keep a much gentler exponent
  // and retain the evening mood the default hour is chosen for.
  const skyWarmth = Math.pow(lowSun, 1.5);
  // Fog / horizon band: a genuinely tinted atmosphere, NOT the old near-white
  // pale blue that washed the horizon out. Deep hazy blue at noon melts into a
  // rich amber at golden hour, so distant terrain (and the low sky, which the
  // far fog also tints) dissolves into a real, saturated horizon band instead
  // of a flat grey-white edge. Rides `skyWarmth`, not the key's cubed ramp, so
  // golden hour still lands firmly in warm territory rather than a muddy
  // blue/amber midpoint.
  const fogColor = new THREE.Color(0x5f7ea8).lerp(new THREE.Color(0xcf7f34), skyWarmth);
  // Gradient-sky colours. The zenith deepens toward indigo as the sun drops;
  // the horizon band warms toward amber and is kept close to the fog tint so
  // the sky dome and the far terrain haze read as one continuous atmosphere.
  const skyZenith = new THREE.Color(0x2f6fc8).lerp(new THREE.Color(0x1e2d58), skyWarmth);
  const skyHorizon = new THREE.Color(0x9fc4e8).lerp(new THREE.Color(0xeca457), skyWarmth);
  return {
    direction,
    sunColor: sunColor.getHex(),
    // Stronger directional key so the scene has punch and contrast.
    sunIntensity: 1.85 + 0.5 * Math.sin(t * Math.PI),
    // Deeper sky-blue fill (was a pale 0xbcd6ff that flattened everything).
    hemiSkyColor: 0x89b0f0,
    hemiGroundColor: 0x6b5a3e,
    // Lower ambient fill = more contrast between sunlit and shaded faces, so
    // buildings and terrain gain depth instead of hazing to a uniform flat.
    hemiIntensity: 0.38 + 0.22 * Math.sin(t * Math.PI),
    fogColor: fogColor.getHex(),
    skyZenith: skyZenith.getHex(),
    skyHorizon: skyHorizon.getHex(),
  };
}

/**
 * Default time-of-day: late-afternoon golden hour. A lower sun gives a warmer
 * key colour, long dramatic shadows, and a richly-scattered (non-washed) sky —
 * the whole reason for shifting off the old flat late-morning default. The
 * `sunFromTime` time-of-day model stays intact and plumbed for the game clock;
 * only this tuning default changed.
 */
export const DEFAULT_TIME_OF_DAY_H = 18.2;

/** Half-extent (m) of the NEAR follow shadow frustum — walking-scale neighbourhood. */
const SHADOW_HALF_M = 220;
const SHADOW_MAP_SIZE = 2048;
/**
 * Coarse SECOND cascade: a much larger frustum on a lower-res map so shadows
 * stay legible out to town-overview distance instead of ending at ~220 m. One
 * extra shadow-casting light (three.js has no native multi-cascade per light);
 * the sun's key intensity is SPLIT between the two so total scene brightness is
 * unchanged and both cast. Far map is deliberately low-res — it only needs to
 * read as "there are shadows over there," not crisp edges.
 */
const FAR_SHADOW_HALF_M = 850;
const FAR_SHADOW_MAP_SIZE = 1024;
/** Fraction of the sun key carried by the far cascade light. */
const FAR_SHADOW_INTENSITY_SHARE = 0.35;
/**
 * The far cascade is useful only after the camera rises into a true town
 * overview. At walking and opening-diorama heights the near 440-metre-wide
 * shadow map already covers the visible play space; replaying every caster into
 * a second 1.7-kilometre map cost roughly one third of the delivered frames.
 */
export const FAR_SHADOW_ENABLE_HEIGHT_M = 90;
/** Sun distance from the frustum center along the sun direction. */
const SUN_DIST_M = 900;

/** Pure threshold used by the live light and its regression test. */
export function shouldUseFarShadow(cameraY: number, referenceSurfaceY: number): boolean {
  return cameraY - referenceSurfaceY >= FAR_SHADOW_ENABLE_HEIGHT_M;
}

/**
 * Custom gradient sky dome. Replaces drei's Preetham `Sky`, whose high-radiance
 * output blew out to a flat white band under the scene's ACES tone mapping (the
 * town camera tilts down, so the whole visible band was the bright near-horizon
 * zone). This dome writes its colours DIRECTLY (`toneMapped = false`), so the
 * authored zenith→horizon ramp and warm sun glow display exactly and can never
 * clip to white. A back-side sphere that follows the camera keeps the horizon
 * at eye level; depthWrite off + a huge radius keep it behind all geometry.
 */
const SKY_DOME_RADIUS = 8000;
const GradientSky: React.FC<{
  zenith: number;
  horizon: number;
  sunColor: number;
  sunDir: [number, number, number];
}> = ({ zenith, horizon, sunColor, sunDir }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenith: { value: new THREE.Color() },
        uHorizon: { value: new THREE.Color() },
        uSunColor: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        void main() {
          vec3 dir = normalize(vDir);
          // Altitude 0 at horizon, 1 overhead; soft curve keeps the warm band
          // hugging the skyline and the blue filling the upper dome.
          float h = clamp(dir.y, 0.0, 1.0);
          float t = pow(h, 0.42);
          vec3 col = mix(uHorizon, uZenith, t);
          // A gentle warm glow where the sun sits, fading fast so it reads as a
          // sun rather than washing the whole sky.
          float sd = max(dot(dir, normalize(uSunDir)), 0.0);
          col += uSunColor * (pow(sd, 180.0) * 0.9 + pow(sd, 6.0) * 0.10);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    mat.toneMapped = false;
    return mat;
  }, []);

  // Push the latest colours into the shader uniforms.
  useEffect(() => {
    (material.uniforms.uZenith.value as THREE.Color).setHex(zenith);
    (material.uniforms.uHorizon.value as THREE.Color).setHex(horizon);
    (material.uniforms.uSunColor.value as THREE.Color).setHex(sunColor);
    (material.uniforms.uSunDir.value as THREE.Vector3).set(sunDir[0], sunDir[1], sunDir[2]);
  }, [material, zenith, horizon, sunColor, sunDir]);

  // Follow the camera so the horizon stays at eye level as the player moves.
  useFrame(({ camera }) => {
    meshRef.current?.position.copy(camera.position);
  });

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh ref={meshRef} material={material} frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[SKY_DOME_RADIUS, 32, 16]} />
    </mesh>
  );
};

const World3DLighting: React.FC<{
  viewProfile: 'continent' | 'ground';
  timeOfDayHours?: number;
  /**
   * Canopy atmosphere (forests Task 11): already-damped modulation values from
   * the scene — hemisphere intensity × lightMul, ground-profile fog pulled to
   * fogNear/fogFar. Null (the default) renders the exact pre-canopy values.
   */
  interior?: CanopyInterior | null;
  /** Spawn-ground elevation used to distinguish walking height from overview. */
  shadowReferenceY?: number;
}> = ({
  viewProfile,
  timeOfDayHours = DEFAULT_TIME_OF_DAY_H,
  interior = null,
  shadowReferenceY = 0,
}) => {
  const sun = useMemo(() => sunFromTime(timeOfDayHours), [timeOfDayHours]);
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const farLightRef = useRef<THREE.DirectionalLight>(null);
  const castShadows = viewProfile === 'ground';

  // R3F pierced `shadow-camera-*` props set the ortho bounds but do NOT call
  // updateProjectionMatrix(), so without this the shadow frustum silently stays
  // at the three.js default ±5 m — shadows exist in a 10 m patch and look absent.
  useEffect(() => {
    // `.shadow` is absent on the mocked light in the jsdom test environment.
    lightRef.current?.shadow?.camera?.updateProjectionMatrix();
    farLightRef.current?.shadow?.camera?.updateProjectionMatrix();
  }, [castShadows]);

  // Follow the camera with the shadow frustum, snapped to shadow-map texels so
  // shadow edges don't crawl/shimmer as the camera pans (standard CSM trick,
  // single cascade). Without this a static frustum either misses the player or
  // has to span the whole streamed window at mush resolution.
  useFrame(({ camera }) => {
    if (!castShadows) return;
    const useFarShadow = shouldUseFarShadow(camera.position.y, shadowReferenceY);

    // Keep the wide light as an unshadowed share of the sun at walking height,
    // preserving total brightness while skipping its expensive second caster
    // pass. The Town Cell aerial camera crosses the threshold and restores the
    // far map automatically.
    if (farLightRef.current && farLightRef.current.castShadow !== useFarShadow) {
      farLightRef.current.castShadow = useFarShadow;
      farLightRef.current.shadow.needsUpdate = useFarShadow;
    }
    const followFrustum = (
      light: THREE.DirectionalLight | null,
      halfM: number,
      mapSize: number,
    ) => {
      if (!light) return;
      const texel = (halfM * 2) / mapSize;
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
    };
    followFrustum(lightRef.current, SHADOW_HALF_M, SHADOW_MAP_SIZE);
    if (useFarShadow) {
      followFrustum(farLightRef.current, FAR_SHADOW_HALF_M, FAR_SHADOW_MAP_SIZE);
    }
  });

  return (
    <>
      {/* Gradient sky dome — direct-colour (non-tone-mapped) zenith→horizon
          ramp + a soft warm sun glow, aligned to the directional key. Replaces
          drei's Preetham Sky, which blew out to a flat white band under this
          scene's ACES tone mapping. */}
      <GradientSky
        zenith={sun.skyZenith}
        horizon={sun.skyHorizon}
        sunColor={sun.sunColor}
        sunDir={sun.direction}
      />
      {/* Cool sky / warm ground-bounce hemisphere fill. Canopy shade dims it
          via `interior.lightMul`; intensity rides its own prop (not args) so
          the damped per-frame value updates the light instead of rebuilding it. */}
      <hemisphereLight
        args={[sun.hemiSkyColor, sun.hemiGroundColor]}
        intensity={sun.hemiIntensity * (interior?.lightMul ?? 1)}
      />
      {/* Warm sun key — NEAR cascade. Carries the majority of the key so the
          walking-scale neighbourhood gets crisp, high-res shadows. */}
      <directionalLight
        ref={lightRef}
        position={[sun.direction[0] * SUN_DIST_M, sun.direction[1] * SUN_DIST_M, sun.direction[2] * SUN_DIST_M]}
        intensity={sun.sunIntensity * (1 - FAR_SHADOW_INTENSITY_SHARE)}
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
        // normalBias is a distance in METERS, and it was 0.6 — which is not a
        // bias, it is an eraser. It slides the shadow lookup along the surface
        // normal, so on flat ground under a sun 24° up (the default hour) it
        // displaces the sample by 0.6/tan(24°) = 1.3 m laterally. Canopy lobes
        // and the gaps between them are ~1 m across, so every scrap of tree
        // silhouette was eroded away and shadows landed as featureless blobs
        // detached from their trunks (see .agent/scratch/sunfix/before-shadow-
        // zoom.png: clearly lobed canopy, perfectly smooth shadow). At 0.08 the
        // erosion is ~0.18 m, under the 0.215 m shadow texel, so the map's own
        // resolution is once again the limit on shadow detail rather than the
        // bias. Kept non-zero because slope-scaled bias is still what keeps
        // acne off the terrain's shallow-angle faces at this low sun.
        shadow-normalBias={0.08}
      />
      {/* Coarse FAR cascade — same sun direction, much larger frustum on a
          low-res map. Carries the remaining key share and casts the distant
          shadows that the near cascade's ~220 m frustum drops, so wide town
          overviews are no longer shadowless past the neighbourhood. Larger
          biases absorb the coarse texel size (a far texel spans several meters).
          Ground profile only. */}
      {castShadows && (
        <directionalLight
          ref={farLightRef}
          position={[sun.direction[0] * SUN_DIST_M, sun.direction[1] * SUN_DIST_M, sun.direction[2] * SUN_DIST_M]}
          intensity={sun.sunIntensity * FAR_SHADOW_INTENSITY_SHARE}
          color={sun.sunColor}
          // The frame loop enables this only for a true aerial overview. The
          // near cascade is sufficient at the opening/walking camera height.
          castShadow={false}
          shadow-mapSize-width={FAR_SHADOW_MAP_SIZE}
          shadow-mapSize-height={FAR_SHADOW_MAP_SIZE}
          shadow-camera-near={10}
          shadow-camera-far={SUN_DIST_M + FAR_SHADOW_HALF_M * 4}
          shadow-camera-left={-FAR_SHADOW_HALF_M}
          shadow-camera-right={FAR_SHADOW_HALF_M}
          shadow-camera-top={FAR_SHADOW_HALF_M}
          shadow-camera-bottom={-FAR_SHADOW_HALF_M}
          shadow-bias={-0.0006}
          shadow-normalBias={1.5}
        />
      )}
      {/* Distance fog tinted to the sky horizon. Ground profile pulls it in to
          meet the artifact-edge haze; continent keeps the km-scale falloff.
          Near distances stay generous so the midground never grays out. Under
          canopy (forests Task 11) the damped interior override pulls the
          ground fog in further so the woods close around the player. */}
      <fog
        attach="fog"
        args={
          viewProfile === 'ground'
            ? [sun.fogColor, interior?.fogNear ?? GROUND_FOG_NEAR, interior?.fogFar ?? GROUND_FOG_FAR]
            : [sun.fogColor, 1100, 5200]
        }
      />
    </>
  );
};

export default World3DLighting;
