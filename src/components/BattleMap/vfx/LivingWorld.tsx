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
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BattleMapData } from '../../../types/combat';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_SIZE = 1.0;

// ---------------------------------------------------------------------------
// Per-biome ambient configuration
// ---------------------------------------------------------------------------

interface BiomeAmbientConfig {
  /** Main ambient particle count */
  particleCount: number;
  /** Particle color */
  particleColor: number;
  /** Particle size */
  particleSize: number;
  /** Particle opacity */
  particleOpacity: number;
  /** Vertical drift speed (positive = up, negative = down) */
  driftY: number;
  /** Horizontal drift speed */
  driftXZ: number;
  /** Whether to add firefly/bioluminescent point lights */
  hasFireflies: boolean;
  /** Firefly color */
  fireflyColor: number;
  /** Number of fireflies */
  fireflyCount: number;
  /** Whether to add weather particles (rain/snow) */
  hasWeather: boolean;
  /** Weather type */
  weatherType: 'rain' | 'snow' | 'sandstorm' | 'none';
  /** Weather particle count */
  weatherCount: number;
  /** Weather particle color */
  weatherColor: number;
  /** Weather fall speed */
  weatherSpeed: number;
}

const BIOME_AMBIENT: Record<string, BiomeAmbientConfig> = {
  forest: {
    particleCount: 800,
    particleColor: 0xeedd88,
    particleSize: 0.06,
    particleOpacity: 0.65,
    driftY: 0.03,
    driftXZ: 0.02,
    hasFireflies: true,
    fireflyColor: 0x88ff44,
    fireflyCount: 8,
    hasWeather: false,
    weatherType: 'none',
    weatherCount: 0,
    weatherColor: 0xffffff,
    weatherSpeed: 0,
  },
  cave: {
    particleCount: 500,
    particleColor: 0x6688cc,
    particleSize: 0.05,
    particleOpacity: 0.55,
    driftY: -0.01,
    driftXZ: 0.005,
    hasFireflies: true,
    fireflyColor: 0x44aaff,
    fireflyCount: 6,
    hasWeather: false,
    weatherType: 'none',
    weatherCount: 0,
    weatherColor: 0xffffff,
    weatherSpeed: 0,
  },
  dungeon: {
    particleCount: 600,
    particleColor: 0xcc9966,
    particleSize: 0.045,
    particleOpacity: 0.5,
    driftY: 0.01,
    driftXZ: 0.01,
    hasFireflies: true,
    fireflyColor: 0xff8844,
    fireflyCount: 4,
    hasWeather: false,
    weatherType: 'none',
    weatherCount: 0,
    weatherColor: 0xffffff,
    weatherSpeed: 0,
  },
  desert: {
    particleCount: 700,
    particleColor: 0xddcc88,
    particleSize: 0.05,
    particleOpacity: 0.45,
    driftY: 0.005,
    driftXZ: 0.06,
    hasFireflies: false,
    fireflyColor: 0xffffff,
    fireflyCount: 0,
    hasWeather: true,
    weatherType: 'sandstorm',
    weatherCount: 800,
    weatherColor: 0xd4b896,
    weatherSpeed: 0.15,
  },
  swamp: {
    particleCount: 700,
    particleColor: 0x99bb55,
    particleSize: 0.05,
    particleOpacity: 0.55,
    driftY: 0.015,
    driftXZ: 0.015,
    hasFireflies: true,
    fireflyColor: 0x66ff88,
    fireflyCount: 10,
    hasWeather: false,
    weatherType: 'none',
    weatherCount: 0,
    weatherColor: 0xffffff,
    weatherSpeed: 0,
  },
};

// ---------------------------------------------------------------------------
// Seeded random
// ---------------------------------------------------------------------------

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ---------------------------------------------------------------------------
// Ambient Particles — pollen, dust, spores, embers
// ---------------------------------------------------------------------------

const AmbientParticles: React.FC<{
  config: BiomeAmbientConfig;
  mapWidth: number;
  mapHeight: number;
  seed: number;
}> = ({ config, mapWidth, mapHeight, seed }) => {
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const rand = seededRandom(seed + 5555);
    const positions = new Float32Array(config.particleCount * 3);

    const worldW = mapWidth * TILE_SIZE;
    const worldH = mapHeight * TILE_SIZE;

    for (let i = 0; i < config.particleCount; i++) {
      positions[i * 3] = rand() * worldW;
      positions[i * 3 + 1] = rand() * 3.0; // 0-3 units above ground
      positions[i * 3 + 2] = rand() * worldH;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [config.particleCount, mapWidth, mapHeight, seed]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const positions = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const time = state.clock.elapsedTime;
    const worldW = mapWidth * TILE_SIZE;
    const worldH = mapHeight * TILE_SIZE;

    for (let i = 0; i < config.particleCount; i++) {
      let x = positions.getX(i);
      let y = positions.getY(i);
      let z = positions.getZ(i);

      // Gentle vertical drift
      y += config.driftY * 0.016; // Normalize to ~60fps

      // Horizontal drift with sin variation per particle
      const phase = i * 0.37;
      x += Math.sin(time * 0.5 + phase) * config.driftXZ * 0.016;
      z += Math.cos(time * 0.4 + phase * 1.3) * config.driftXZ * 0.016;

      // Wrap around if outside bounds
      if (y > 3.5) y = 0;
      if (y < -0.2) y = 3.0;
      if (x < -1) x = worldW + 0.5;
      if (x > worldW + 1) x = -0.5;
      if (z < -1) z = worldH + 0.5;
      if (z > worldH + 1) z = -0.5;

      positions.setXYZ(i, x, y, z);
    }
    positions.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color={config.particleColor}
        size={config.particleSize}
        transparent
        opacity={config.particleOpacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
};

// ---------------------------------------------------------------------------
// Fireflies / Bioluminescent lights
// ---------------------------------------------------------------------------

const Fireflies: React.FC<{
  config: BiomeAmbientConfig;
  mapWidth: number;
  mapHeight: number;
  seed: number;
}> = ({ config, mapWidth, mapHeight, seed }) => {
  const groupRef = useRef<THREE.Group>(null);

  // Pre-compute firefly paths (elliptical orbits with varying radii)
  const fireflyData = useMemo(() => {
    const rand = seededRandom(seed + 7777);
    const worldW = mapWidth * TILE_SIZE;
    const worldH = mapHeight * TILE_SIZE;

    return Array.from({ length: config.fireflyCount }, () => ({
      // Home position (center of orbit)
      homeX: rand() * worldW,
      homeY: 0.5 + rand() * 1.5,
      homeZ: rand() * worldH,
      // Orbit radii
      radiusX: 0.3 + rand() * 0.8,
      radiusZ: 0.3 + rand() * 0.8,
      // Speed and phase
      speed: 0.3 + rand() * 0.7,
      phase: rand() * Math.PI * 2,
      // Intensity flicker speed
      flickerSpeed: 2 + rand() * 4,
      flickerPhase: rand() * Math.PI * 2,
    }));
  }, [config.fireflyCount, mapWidth, mapHeight, seed]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.elapsedTime;

    groupRef.current.children.forEach((child, i) => {
      if (i >= fireflyData.length) return;
      const data = fireflyData[i];

      // Orbit position
      const angle = time * data.speed + data.phase;
      child.position.set(
        data.homeX + Math.sin(angle) * data.radiusX,
        data.homeY + Math.sin(time * 0.5 + data.phase) * 0.3,
        data.homeZ + Math.cos(angle) * data.radiusZ,
      );

      // Intensity flicker
      const light = child.children[0] as THREE.PointLight | undefined;
      if (light && 'intensity' in light) {
        const flicker = (Math.sin(time * data.flickerSpeed + data.flickerPhase) + 1) * 0.5;
        light.intensity = 0.2 + flicker * 0.8;
      }
    });
  });

  if (config.fireflyCount === 0) return null;

  return (
    <group ref={groupRef}>
      {fireflyData.map((data, i) => (
        <group key={i} position={[data.homeX, data.homeY, data.homeZ]}>
          <pointLight
            color={config.fireflyColor}
            intensity={0.5}
            distance={4}
            decay={2}
          />
          {/* Visible glow sphere */}
          <mesh>
            <sphereGeometry args={[0.06, 8, 6]} />
            <meshBasicMaterial
              color={config.fireflyColor}
              transparent
              opacity={0.8}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Weather particles — rain, snow, sandstorm
// ---------------------------------------------------------------------------

const WeatherParticles: React.FC<{
  config: BiomeAmbientConfig;
  mapWidth: number;
  mapHeight: number;
  seed: number;
}> = ({ config, mapWidth, mapHeight, seed }) => {
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    if (!config.hasWeather || config.weatherCount === 0) return null;

    const geo = new THREE.BufferGeometry();
    const rand = seededRandom(seed + 9999);
    const positions = new Float32Array(config.weatherCount * 3);

    const worldW = mapWidth * TILE_SIZE;
    const worldH = mapHeight * TILE_SIZE;

    for (let i = 0; i < config.weatherCount; i++) {
      positions[i * 3] = rand() * worldW;
      positions[i * 3 + 1] = rand() * 8.0; // Spread throughout vertical range
      positions[i * 3 + 2] = rand() * worldH;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [config, mapWidth, mapHeight, seed]);

  useFrame((state) => {
    if (!pointsRef.current || !geometry) return;
    const positions = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const time = state.clock.elapsedTime;
    const worldW = mapWidth * TILE_SIZE;
    const worldH = mapHeight * TILE_SIZE;

    for (let i = 0; i < config.weatherCount; i++) {
      let x = positions.getX(i);
      let y = positions.getY(i);
      let z = positions.getZ(i);

      switch (config.weatherType) {
        case 'rain':
          y -= config.weatherSpeed;
          // Slight wind drift
          x += Math.sin(time * 0.5) * 0.003;
          if (y < 0) {
            y = 6 + Math.random() * 2;
            x = Math.random() * worldW;
            z = Math.random() * worldH;
          }
          break;

        case 'snow':
          y -= config.weatherSpeed * 0.3;
          // Lateral drift for snow
          x += Math.sin(time * 0.5 + i * 0.1) * 0.008;
          z += Math.cos(time * 0.3 + i * 0.13) * 0.006;
          if (y < 0) {
            y = 5 + Math.random() * 3;
            x = Math.random() * worldW;
            z = Math.random() * worldH;
          }
          break;

        case 'sandstorm':
          // Horizontal drift with turbulence
          x += config.weatherSpeed * 0.5;
          z += Math.sin(time + i * 0.2) * 0.02;
          y += Math.sin(time * 2 + i * 0.3) * 0.01;
          // Wrap around
          if (x > worldW + 2) {
            x = -1;
            z = Math.random() * worldH;
            y = Math.random() * 3.0;
          }
          break;
      }

      positions.setXYZ(i, x, y, z);
    }
    positions.needsUpdate = true;
  });

  if (!config.hasWeather || !geometry) return null;

  // Particle shape based on weather type
  const size = config.weatherType === 'rain' ? 0.01
    : config.weatherType === 'snow' ? 0.02
    : 0.015;

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color={config.weatherColor}
        size={size}
        transparent
        opacity={config.weatherType === 'sandstorm' ? 0.3 : 0.5}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
};

// ---------------------------------------------------------------------------
// Biome atmosphere lights — fixed, themed point lights (not wandering)
// ---------------------------------------------------------------------------
//
// These complement the wandering fireflies by establishing the biome's ground-
// level mood:
//   forest  → dappled warm patches at 0.8 m (sunlight through canopy)
//   dungeon → fixed torch pools at 2.0 m (wall sconces / torches on pillars)
//   cave    → bioluminescent floor glow (fungi / crystal veins)
//   desert  → harsh sand-bounce fill light from east (bleached ground)
//   swamp   → murky greenish pooled reflections at water level
//
// Light count is kept low (4–6 lights) so we don't push the scene past Three.js's
// per-material point-light limit (8 max in MeshStandardMaterial shader).

interface BiomeAtmosLightConfig {
  count: number;
  color: number;
  intensity: number;
  distance: number;
  height: number;           // World Y above tile elevation
  flickerSpeed: number;     // 0 = static, >0 = flickers
  flickerDepth: number;     // Fraction of intensity that flickers (0–1)
  driftRadius: number;      // XZ drift radius (0 = static)
}

const BIOME_ATMOS_LIGHTS: Record<string, BiomeAtmosLightConfig> = {
  forest: {
    count: 5,
    color: 0xffe880,       // warm golden dapple
    intensity: 0.60,
    distance: 5.0,
    height: 0.8,
    flickerSpeed: 0.6,     // gentle leaf-flutter shimmer
    flickerDepth: 0.25,
    driftRadius: 0.15,
  },
  dungeon: {
    count: 5,
    color: 0xff6820,       // deep torch orange
    intensity: 1.80,
    distance: 6.0,
    height: 2.0,           // at sconce/pillar height
    flickerSpeed: 4.0,     // fast torch flicker
    flickerDepth: 0.55,
    driftRadius: 0.0,
  },
  cave: {
    count: 4,
    color: 0x44ccff,       // cold bioluminescent blue
    intensity: 0.70,
    distance: 4.0,
    height: 0.3,           // floor-level glow from fungi
    flickerSpeed: 1.2,
    flickerDepth: 0.30,
    driftRadius: 0.0,
  },
  desert: {
    count: 3,
    color: 0xffe0a0,       // bleached sand bounce
    intensity: 0.55,
    distance: 7.0,
    height: 0.2,           // ground-level bounce
    flickerSpeed: 0.0,
    flickerDepth: 0.0,
    driftRadius: 0.0,
  },
  swamp: {
    count: 4,
    color: 0x66bb44,       // sickly swamp green
    intensity: 0.45,
    distance: 4.5,
    height: 0.15,          // at water surface
    flickerSpeed: 0.8,
    flickerDepth: 0.20,
    driftRadius: 0.05,
  },
};

const BiomeAtmosphereLights: React.FC<{
  mapWidth: number;
  mapHeight: number;
  seed: number;
  biome: string;
}> = ({ mapWidth, mapHeight, seed, biome }) => {
  const cfg = BIOME_ATMOS_LIGHTS[biome] ?? BIOME_ATMOS_LIGHTS.forest;
  const groupRef = useRef<THREE.Group>(null);

  /** Deterministic placement on a jittered grid within map bounds */
  const lightPositions = useMemo(() => {
    const rand = seededRandom(seed + 3131);
    const worldW = mapWidth * TILE_SIZE;
    const worldH = mapHeight * TILE_SIZE;
    const positions: { x: number; z: number; phase: number }[] = [];

    for (let i = 0; i < cfg.count; i++) {
      // Distribute across the map with 15% padding from edges
      const padX = worldW * 0.15;
      const padZ = worldH * 0.15;
      positions.push({
        x: padX + rand() * (worldW - 2 * padX),
        z: padZ + rand() * (worldH - 2 * padZ),
        phase: rand() * Math.PI * 2,
      });
    }
    return positions;
  }, [cfg.count, mapWidth, mapHeight, seed]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    groupRef.current.children.forEach((child, i) => {
      if (i >= lightPositions.length) return;
      const pos = lightPositions[i];

      // Gentle XZ drift
      if (cfg.driftRadius > 0) {
        child.position.x = pos.x + Math.sin(t * 0.3 + pos.phase) * cfg.driftRadius;
        child.position.z = pos.z + Math.cos(t * 0.25 + pos.phase * 1.3) * cfg.driftRadius;
      }

      // Flicker intensity on the point light child
      if (cfg.flickerSpeed > 0) {
        const light = child.children[0] as THREE.PointLight | undefined;
        if (light && 'intensity' in light) {
          const raw = Math.sin(t * cfg.flickerSpeed + pos.phase)
                    * Math.cos(t * cfg.flickerSpeed * 0.7 + pos.phase * 1.5);
          light.intensity = cfg.intensity * (1.0 - cfg.flickerDepth * (raw * 0.5 + 0.5));
        }
      }
    });
  });

  if (cfg.count === 0) return null;

  return (
    <group ref={groupRef}>
      {lightPositions.map((pos, i) => (
        <group key={i} position={[pos.x, cfg.height, pos.z]}>
          <pointLight
            color={cfg.color}
            intensity={cfg.intensity}
            distance={cfg.distance}
            decay={2}
            castShadow={false}
          />
        </group>
      ))}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Main LivingWorld component
// ---------------------------------------------------------------------------

interface LivingWorldProps {
  mapData: BattleMapData;
}

const LivingWorld: React.FC<LivingWorldProps> = ({ mapData }) => {
  const { width, height } = mapData.dimensions;
  const biome = (mapData as BattleMapData & { biome?: string }).biome ?? mapData.theme ?? 'forest';
  const config = BIOME_AMBIENT[biome] ?? BIOME_AMBIENT.forest;
  const seed = mapData.seed ?? 42;

  return (
    <group>
      {/* Fixed biome-themed atmosphere lights (torch pools, dapple, bioluminescence) */}
      <BiomeAtmosphereLights
        mapWidth={width}
        mapHeight={height}
        seed={seed}
        biome={biome}
      />

      {/* Ambient particles — pollen, dust, spores */}
      <AmbientParticles
        config={config}
        mapWidth={width}
        mapHeight={height}
        seed={seed}
      />

      {/* Fireflies / bioluminescent lights */}
      {config.hasFireflies && (
        <Fireflies
          config={config}
          mapWidth={width}
          mapHeight={height}
          seed={seed}
        />
      )}

      {/* Weather particles — rain, snow, sandstorm */}
      {config.hasWeather && (
        <WeatherParticles
          config={config}
          mapWidth={width}
          mapHeight={height}
          seed={seed}
        />
      )}
    </group>
  );
};

export default LivingWorld;
