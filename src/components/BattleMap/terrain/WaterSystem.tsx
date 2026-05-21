/**
 * @file WaterSystem.tsx
 * Animated water plane for water-type tiles with UV distortion, depth transparency,
 * surface waves, and projected caustic patterns.
 *
 * Creates one merged plane mesh covering all water tiles. A custom shader handles:
 * - Animated UV distortion for flowing water appearance
 * - Depth-based transparency (shallow edges clear, deep center opaque)
 * - Subtle vertex displacement for surface wave motion
 * - Fresnel-based rim lighting for water surface shine
 *
 * Research references:
 * - Three.js Water Pro: https://threejsroadmap.com/assets/threejs-water-pro
 * - WaterSurface R3F: https://github.com/nhtoby311/WaterSurface
 * - Water caustics: https://medium.com/@martinRenou/real-time-rendering-of-water-caustics-59cda1d74aa
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md — "Water System" section
 */
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BattleMapData } from '../../../types/combat';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_SIZE = 1.0;
const ELEVATION_SCALE = 0.3;
const WATER_SUBDIVISIONS = 8; // Per tile for wave detail
const WAVE_AMPLITUDE = 0.015;
const WAVE_SPEED = 0.8;
const FLOW_SPEED = 0.15;

// ---------------------------------------------------------------------------
// Shader code
// ---------------------------------------------------------------------------

const waterVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWaveAmplitude;
  uniform float uWaveSpeed;

  varying vec3 vWorldPosition;
  varying vec2 vUv;
  varying float vWaveHeight;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;

    vec4 worldPos = modelMatrix * vec4(position, 1.0);

    // Multi-frequency wave displacement
    float wave1 = sin(worldPos.x * 3.0 + uTime * uWaveSpeed) * uWaveAmplitude;
    float wave2 = sin(worldPos.z * 2.5 + uTime * uWaveSpeed * 0.7 + 1.3) * uWaveAmplitude * 0.6;
    float wave3 = sin((worldPos.x + worldPos.z) * 4.0 + uTime * uWaveSpeed * 1.3) * uWaveAmplitude * 0.3;

    worldPos.y += wave1 + wave2 + wave3;
    vWaveHeight = wave1 + wave2 + wave3;
    vWorldPosition = worldPos.xyz;

    // Approximate normal from wave derivatives
    float dx = cos(worldPos.x * 3.0 + uTime * uWaveSpeed) * 3.0 * uWaveAmplitude
             + cos((worldPos.x + worldPos.z) * 4.0 + uTime * uWaveSpeed * 1.3) * 4.0 * uWaveAmplitude * 0.3;
    float dz = cos(worldPos.z * 2.5 + uTime * uWaveSpeed * 0.7 + 1.3) * 2.5 * uWaveAmplitude * 0.6
             + cos((worldPos.x + worldPos.z) * 4.0 + uTime * uWaveSpeed * 1.3) * 4.0 * uWaveAmplitude * 0.3;
    vNormal = normalize(vec3(-dx, 1.0, -dz));

    // View direction for Fresnel
    vViewDir = normalize(cameraPosition - worldPos.xyz);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const waterFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uFlowSpeed;
  uniform vec3 uShallowColor;
  uniform vec3 uDeepColor;
  uniform float uOpacity;

  varying vec3 vWorldPosition;
  varying vec2 vUv;
  varying float vWaveHeight;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  // Simple noise for water surface distortion
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // Caustic pattern
  float caustic(vec2 uv, float time) {
    float c = 0.0;
    c += noise(uv * 8.0 + time * 0.3) * 0.5;
    c += noise(uv * 16.0 - time * 0.2) * 0.25;
    c += noise(uv * 32.0 + time * 0.1) * 0.125;
    return c * c * 2.0; // Sharpen for caustic look
  }

  void main() {
    // Flowing UV distortion
    vec2 flowUV = vWorldPosition.xz;
    flowUV.x += uTime * uFlowSpeed;

    float distortion = noise(flowUV * 3.0 + uTime * 0.15) * 0.03;
    vec2 distortedUV = vWorldPosition.xz + distortion;

    // Fresnel effect — more reflective at glancing angles
    float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.0);
    fresnel = clamp(fresnel, 0.1, 0.9);

    // Depth-based color blend (use fractional position within tile as proxy)
    float frac_x = fract(vWorldPosition.x);
    float frac_z = fract(vWorldPosition.z);
    float edgeDist = min(min(frac_x, 1.0 - frac_x), min(frac_z, 1.0 - frac_z));
    float depthFactor = smoothstep(0.0, 0.4, edgeDist);

    vec3 waterColor = mix(uShallowColor, uDeepColor, depthFactor);

    // Add caustic highlights
    float causticPattern = caustic(distortedUV, uTime);
    waterColor += vec3(causticPattern * 0.15);

    // Specular highlight from sun direction
    vec3 lightDir = normalize(vec3(0.5, 0.8, 0.3));
    vec3 halfVec = normalize(lightDir + vViewDir);
    float specular = pow(max(dot(vNormal, halfVec), 0.0), 64.0);
    waterColor += vec3(1.0, 0.95, 0.85) * specular * 0.6;

    // Fresnel: mix surface color with reflection (sky color approximation)
    vec3 skyColor = vec3(0.4, 0.5, 0.65);
    waterColor = mix(waterColor, skyColor, fresnel * 0.5);

    // Wave-based brightness variation
    waterColor += vWaveHeight * 2.0;

    // Opacity: deeper = more opaque, edges more transparent
    float alpha = mix(0.5, uOpacity, depthFactor);

    gl_FragColor = vec4(waterColor, alpha);
  }
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WaterSystemProps {
  mapData: BattleMapData;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const WaterSystem: React.FC<WaterSystemProps> = ({ mapData }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const { width, height } = mapData.dimensions;

  // Collect all water tiles
  const waterTiles = useMemo(() => {
    const tiles: { x: number; y: number; elevation: number }[] = [];
    for (const [, tile] of mapData.tiles) {
      if (tile.terrain === 'water') {
        tiles.push({
          x: tile.coordinates.x,
          y: tile.coordinates.y,
          elevation: tile.elevation,
        });
      }
    }
    return tiles;
  }, [mapData]);

  // Build merged water geometry from all water tiles
  const geometry = useMemo(() => {
    if (waterTiles.length === 0) return null;

    const mergedGeo = new THREE.BufferGeometry();
    const allPositions: number[] = [];
    const allUVs: number[] = [];
    const allIndices: number[] = [];
    let vertexOffset = 0;

    for (const tile of waterTiles) {
      const subX = WATER_SUBDIVISIONS;
      const subZ = WATER_SUBDIVISIONS;

      for (let iz = 0; iz <= subZ; iz++) {
        for (let ix = 0; ix <= subX; ix++) {
          const x = tile.x * TILE_SIZE + (ix / subX) * TILE_SIZE;
          const z = tile.y * TILE_SIZE + (iz / subZ) * TILE_SIZE;
          const y = tile.elevation * ELEVATION_SCALE + 0.05; // Slightly above terrain

          allPositions.push(x, y, z);
          allUVs.push(ix / subX, iz / subZ);
        }
      }

      // Indices for this tile
      for (let iz = 0; iz < subZ; iz++) {
        for (let ix = 0; ix < subX; ix++) {
          const a = vertexOffset + iz * (subX + 1) + ix;
          const b = a + 1;
          const c = a + (subX + 1);
          const d = c + 1;
          allIndices.push(a, c, b);
          allIndices.push(b, c, d);
        }
      }

      vertexOffset += (subX + 1) * (subZ + 1);
    }

    mergedGeo.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
    mergedGeo.setAttribute('uv', new THREE.Float32BufferAttribute(allUVs, 2));
    mergedGeo.setIndex(allIndices);
    mergedGeo.computeVertexNormals();

    return mergedGeo;
  }, [waterTiles]);

  // Determine water colors based on biome
  const { shallowColor, deepColor } = useMemo(() => {
    const theme = mapData.theme;
    switch (theme) {
      case 'swamp':
        return {
          shallowColor: new THREE.Color(0.15, 0.2, 0.08),
          deepColor: new THREE.Color(0.08, 0.12, 0.05),
        };
      case 'cave':
        return {
          shallowColor: new THREE.Color(0.05, 0.15, 0.25),
          deepColor: new THREE.Color(0.02, 0.06, 0.15),
        };
      case 'desert':
        return {
          shallowColor: new THREE.Color(0.15, 0.35, 0.45),
          deepColor: new THREE.Color(0.05, 0.18, 0.3),
        };
      default: // forest, dungeon
        return {
          shallowColor: new THREE.Color(0.08, 0.25, 0.35),
          deepColor: new THREE.Color(0.03, 0.1, 0.2),
        };
    }
  }, [mapData.theme]);

  // Shader material
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uWaveAmplitude: { value: WAVE_AMPLITUDE },
        uWaveSpeed: { value: WAVE_SPEED },
        uFlowSpeed: { value: FLOW_SPEED },
        uShallowColor: { value: shallowColor },
        uDeepColor: { value: deepColor },
        uOpacity: { value: 0.85 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, [shallowColor, deepColor]);

  // Animate
  useFrame((state) => {
    if (shaderMaterial) {
      shaderMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  if (!geometry || waterTiles.length === 0) return null;

  return (
    <mesh geometry={geometry} material={shaderMaterial} renderOrder={2} />
  );
};

export default WaterSystem;
