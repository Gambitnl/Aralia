/**
 * TakramSkySystem — physically-based sky + volumetric clouds + stars via @takram/three-atmosphere.
 *
 * Replaces EnhancedSkyDome + LabClouds when skyMode='takram' is active in Scene3D.
 *
 * Key integration notes:
 * - Atmosphere loads pre-baked Bruneton LUT textures from public/data/takram-atmosphere/
 *   (copied once from node_modules/@takram/three-atmosphere/assets/). Using pre-baked
 *   files avoids the GPU requestIdleCallback precomputation path, which stalls permanently
 *   when the RAF loop consumes 100% of the main-thread budget at low FPS.
 * - We override the astronomically-derived sun direction each frame with Aralia's own
 *   game-time sun vector, so fantasy time-of-day lighting works correctly.
 * - correctAltitude={true} (default) is required even for a flat scene. WGS84 equatorial
 *   radius (6378 km) exceeds Bruneton's bottomRadius (6360 km). Without correction the
 *   camera sits ~18 km above the Bruneton surface (stratosphere) → near-black zenith.
 * - ground={false} disables the Bruneton ground-intersection test. With ground=true any
 *   ray with mu<0 (slightly downward) gets transmittance=0 → black. Our scene has its
 *   own terrain geometry, so we skip the Bruneton ground disc.
 * - EffectComposer MUST live inside <Atmosphere> context (this component) so that
 *   <Clouds> can read the sun direction and ECEF matrix from AtmosphereContext.
 *   This is why the EffectComposer is here rather than in Scene3D.
 * - enableNormalPass is required on EffectComposer so Clouds can read scene depth.
 * - Render order inside EffectComposer: Clouds → ToneMapping.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Vector3 } from 'three';
import {
  AdditiveBlending,
  Color,
  Matrix4,
  ShaderMaterial,
  SphereGeometry,
  Vector3 as ThreeVector3,
} from 'three';
import {
  Atmosphere,
  Sky,
  Stars,
  type AtmosphereApi,
} from '@takram/three-atmosphere/r3f';
import { CloudLayer, Clouds } from '@takram/three-clouds/r3f';
import type { CloudsQualityPreset } from '@takram/three-clouds';
import { Ellipsoid, Geodetic } from '@takram/three-geospatial';
import { EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

interface TakramSkySystemProps {
  /** Aralia's computed sun direction (normalised). */
  sunDirection: Vector3;
  /** Hides all sky rendering without unmounting (e.g. cave/dungeon biomes). */
  visible?: boolean;
  /** 0–1 cloud density. Forwarded to Clouds.coverage. */
  cloudCoverage?: number;
  /** Takram quality preset — use 'low' during development; 'high' for screenshots. */
  qualityPreset?: CloudsQualityPreset;
  /** Show stars at night. */
  starsEnabled?: boolean;
  /** Show a procedural moon opposite the sun. */
  moonEnabled?: boolean;
  /**
   * correctAltitude — moves the Bruneton camera position from the WGS84 surface
   * (~6378 km) down to the Bruneton bottomRadius (~6360 km).
   * Default true; set false to debug "stratosphere" sky appearance.
   */
  correctAltitude?: boolean;
  /**
   * ground — enables Bruneton ground-intersection test. When true, any ray with
   * mu < 0 (slightly downward) gets transmittance=0 → black pixels at horizon.
   * Default false (our scene has its own terrain geometry).
   */
  ground?: boolean;
  /**
   * When false, disables the EffectComposer (and therefore Clouds + ToneMapping).
   * Useful for debugging raw Bruneton output without post-processing.
   */
  effectComposerEnabled?: boolean;
  /** Exposure multiplier for the ACES ToneMapping pass (default 6). */
  exposure?: number;
  /**
   * Altitude multiplier for cloud layers (default 1.0).
   * Values < 1 bring clouds closer to the camera, > 1 push them higher.
   * The base altitudes are 750m, 1000m, and 7500m (from @takram/three-clouds defaults).
   */
  cloudAltitude?: number;
}

// Compute once: a matrix that places the Three.js world origin on the Earth's
// surface at the equator/prime meridian (altitude 0). getNorthUpEastFrame maps
// local axes (north=X, up=Y, east=Z) to ECEF, which matches Three.js Y-up convention.
// Without this the atmosphere shader thinks the camera is at Earth's centre
// (6371km underground) and shows a black sky when looking upward.
const SURFACE_ECEF = new Geodetic(0, 0, 0).toECEF();
const WORLD_TO_ECEF = Ellipsoid.WGS84.getNorthUpEastFrame(SURFACE_ECEF, new Matrix4());

// Reusable scratch vector — avoids a new allocation every frame.
const _ecefSunDir = new ThreeVector3();

// All pre-baked textures served from public/data/takram-atmosphere/.
// Atmosphere + star assets copied from node_modules/@takram/three-atmosphere/assets/.
// Cloud shape/weather assets copied from node_modules/@takram/three-clouds/assets/.
// stbn.bin (STBN noise) is not shipped in any npm package — downloaded once from GitHub
// CDN and cached locally in public/data/takram-atmosphere/ alongside the other assets.
// BASE_URL handles the /Aralia/ prefix in dev and production builds.
const _base = import.meta.env.BASE_URL || '/';
const _atm = `${_base}data/takram-atmosphere`;
const ATMOSPHERE_TEXTURES_URL = _atm;
const STARS_DATA_URL = `${_atm}/stars.bin`;
const CLOUD_LOCAL_WEATHER_URL = `${_atm}/local_weather.png`;
const CLOUD_SHAPE_URL = `${_atm}/shape.bin`;
const CLOUD_SHAPE_DETAIL_URL = `${_atm}/shape_detail.bin`;
const CLOUD_TURBULENCE_URL = `${_atm}/turbulence.png`;
// stbn.bin = Spatio-Temporal Blue Noise (64³ 3D texture used for cloud jitter).
// Not shipped in any npm package; downloaded from the GitHub CDN once and cached
// locally in public/data/takram-atmosphere/ to avoid CDN latency / failures.
const CLOUD_STBN_URL = `${_atm}/stbn.bin`;

// Moon distance in scene units — far enough to sit on the sky dome.
const MOON_DISTANCE = 80000;
// Offset angle (radians) so the moon isn't perfectly opposite the sun.
// ~30° offset gives a realistic waxing-gibbous look most of the time.
const MOON_ORBIT_OFFSET = (30 * Math.PI) / 180;

const _moonPos = new ThreeVector3();

/**
 * Simple procedural moon — a self-lit sphere positioned roughly opposite the
 * sun. Opacity fades to 0 during full daylight so it doesn't compete with the
 * atmosphere's luminance.
 */
const Moon = ({ sunDirection }: { sunDirection: Vector3 }) => {
  const meshRef = useRef<import('three').Mesh>(null);

  const geometry = useMemo(() => new SphereGeometry(600, 32, 32), []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uSunDir: { value: new ThreeVector3() },
          uMoonColor: { value: new Color(0xfff8e7) },
          uOpacity: { value: 1.0 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vNormal;
          varying vec3 vWorldPos;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uSunDir;
          uniform vec3 uMoonColor;
          uniform float uOpacity;
          varying vec3 vNormal;
          void main() {
            // Simple Lambertian lit sphere — the face toward the sun is bright,
            // the face away is dark, creating a natural phase effect.
            float NdotL = dot(normalize(vNormal), uSunDir);
            // Soft terminator so the shadow edge isn't razor-sharp.
            float lit = smoothstep(-0.1, 0.4, NdotL);
            // Add a small ambient so the dark side isn't pure black.
            float brightness = 0.06 + lit * 0.94;
            vec3 color = uMoonColor * brightness;
            gl_FragColor = vec4(color, uOpacity);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    []
  );

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Position the moon roughly opposite the sun with a slight orbital offset.
    // Negate sun direction, then rotate around the Y axis by MOON_ORBIT_OFFSET.
    _moonPos.set(-sunDirection.x, -sunDirection.y, -sunDirection.z);
    // Rotate around Y by the offset to break the perfect opposition.
    const cosA = Math.cos(MOON_ORBIT_OFFSET);
    const sinA = Math.sin(MOON_ORBIT_OFFSET);
    const rx = _moonPos.x * cosA + _moonPos.z * sinA;
    const rz = -_moonPos.x * sinA + _moonPos.z * cosA;
    _moonPos.x = rx;
    _moonPos.z = rz;
    // Keep the moon above the horizon (don't render it underground).
    _moonPos.y = Math.max(_moonPos.y, 0.05);
    _moonPos.normalize().multiplyScalar(MOON_DISTANCE);
    mesh.position.copy(_moonPos);

    // Fade opacity: fully visible when sun is below horizon (sunDir.y < 0),
    // fade out as the sun climbs so it doesn't compete with daylight.
    const sunHeight = sunDirection.y;
    const opacity = 1.0 - smoothstep(sunHeight, -0.05, 0.25);
    material.uniforms.uOpacity.value = opacity;
    // Pass the actual sun direction for lighting the moon face.
    material.uniforms.uSunDir.value.copy(sunDirection);
    mesh.visible = opacity > 0.01;
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} />;
};

/** GLSL-style smoothstep for JS. */
function smoothstep(x: number, edge0: number, edge1: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const TakramSkySystem = ({
  sunDirection,
  visible = true,
  cloudCoverage = 0.5,
  qualityPreset = 'low',
  starsEnabled = true,
  moonEnabled = true,
  correctAltitude = true,
  ground = false,
  effectComposerEnabled = true,
  exposure = 6,
  cloudAltitude = 1,
}: TakramSkySystemProps) => {
  const atmosphereRef = useRef<AtmosphereApi>(null);

  // Each frame: inject Aralia's game-sun direction (transformed to ECEF space)
  // and the surface-frame matrix into the Atmosphere's transient state.
  //
  // sunDirection lives in Three.js world space. The Atmosphere shader expects
  // it in ECEF space. We apply the rotation part of WORLD_TO_ECEF (via
  // transformDirection, which ignores the translation) to convert it.
  useFrame(() => {
    const atm = atmosphereRef.current;
    if (!atm) return;
    _ecefSunDir.copy(sunDirection).transformDirection(WORLD_TO_ECEF);
    atm.sunDirection.copy(_ecefSunDir);
    atm.worldToECEFMatrix.copy(WORLD_TO_ECEF);
  });

  if (!visible) return null;

  return (
    // correctAltitude={true} (default) is required even for a flat scene.
    // WGS84 equatorial radius (6378 km) > Bruneton bottomRadius (6360 km).
    // Without correction the camera sits ~18 km above the Bruneton surface
    // (stratosphere), making the upper sky appear near-black.
    //
    // ground={false} — disables the Bruneton ground-intersection test inside
    // GetSkyRadiance. With ground=true, any ray with a slightly downward angle
    // (mu < 0) is treated as hitting the ground and gets transmittance=0, turning
    // it black. Our scene provides its own terrain geometry so we skip the
    // Bruneton ground disc entirely.
    <Atmosphere
      ref={atmosphereRef}
      textures={ATMOSPHERE_TEXTURES_URL}
      correctAltitude={correctAltitude}
      ground={ground}
    >
      {/* Physically-based sky dome (Bruneton precomputed scattering) */}
      <Sky />

      {/* Night-sky stars — naturally dim during daylight, visible at night */}
      {starsEnabled && <Stars data={STARS_DATA_URL} />}

      {/* Procedural moon — lit sphere opposite the sun, fades during daylight */}
      {moonEnabled && <Moon sunDirection={sunDirection} />}

      {/* EffectComposer MUST be inside <Atmosphere> so <Clouds> can access
          AtmosphereContext (sun direction, ECEF matrix). enableNormalPass is
          required by Clouds for depth-aware ray marching. Render order:
          Clouds first (builds cloud buffer), then ToneMapping (ACES over everything). */}
      {effectComposerEnabled && (
        <EffectComposer enableNormalPass multisampling={0}>
          <Clouds
            coverage={cloudCoverage}
            qualityPreset={qualityPreset}
            correctAltitude={correctAltitude}
            skipRendering={false}
            disableDefaultLayers={cloudAltitude !== 1}
            localWeatherTexture={CLOUD_LOCAL_WEATHER_URL}
            shapeTexture={CLOUD_SHAPE_URL}
            shapeDetailTexture={CLOUD_SHAPE_DETAIL_URL}
            turbulenceTexture={CLOUD_TURBULENCE_URL}
            stbnTexture={CLOUD_STBN_URL}
          >
            {cloudAltitude !== 1 && (
              <>
                <CloudLayer channel="r" altitude={750 * cloudAltitude} height={650 * cloudAltitude} densityScale={0.2} shapeAmount={1} shapeDetailAmount={1} weatherExponent={1} shapeAlteringBias={0.35} coverageFilterWidth={0.6} shadow />
                <CloudLayer channel="g" altitude={1000 * cloudAltitude} height={1200 * cloudAltitude} densityScale={0.2} shapeAmount={1} shapeDetailAmount={1} weatherExponent={1} shapeAlteringBias={0.35} coverageFilterWidth={0.6} shadow />
                <CloudLayer channel="b" altitude={7500 * cloudAltitude} height={500 * cloudAltitude} densityScale={0.003} shapeAmount={0.4} shapeDetailAmount={0} weatherExponent={1} shapeAlteringBias={0.35} coverageFilterWidth={0.5} />
              </>
            )}
          </Clouds>
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} exposure={exposure} />
        </EffectComposer>
      )}
    </Atmosphere>
  );
};

export default TakramSkySystem;
