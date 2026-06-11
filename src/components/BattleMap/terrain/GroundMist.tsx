/**
 * @file GroundMist.tsx
 * Low-hanging animated mist layers for moody biomes (GOAL #56).
 *
 * A few large translucent planes hover just above ground level with scrolling
 * FBM alpha. Because the planes are flat and depth-tested against the terrain
 * heightfield, mist naturally pools in hollows while hills and props rise
 * clear of it — the classic "ground fog" read without volumetrics.
 *
 * Per-biome character: swamp = thick low murk, forest = faint morning haze,
 * cave/dungeon = subtle cold floor vapor, desert = none (heat, not moisture).
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BattleMapData } from '../../../types/combat';

const TILE_SIZE = 1.0;

interface MistLayer {
  /** World Y of the plane */
  height: number;
  /** Multiplier on the biome's base opacity */
  opacity: number;
  /** Noise scale multiplier so layers don't move in lockstep */
  scale: number;
}

interface MistConfig {
  color: THREE.Color;
  baseOpacity: number;
  layers: MistLayer[];
}

function getBiomeMist(biome: string): MistConfig | null {
  switch (biome) {
    case 'swamp':
      return {
        color: new THREE.Color(0x8aa178),
        baseOpacity: 0.30,
        layers: [
          { height: 0.22, opacity: 1.0, scale: 1.0 },
          { height: 0.48, opacity: 0.75, scale: 1.4 },
          { height: 0.78, opacity: 0.45, scale: 0.8 },
        ],
      };
    case 'forest':
      return {
        color: new THREE.Color(0xaab8a0),
        baseOpacity: 0.10,
        layers: [
          { height: 0.28, opacity: 1.0, scale: 1.0 },
          { height: 0.60, opacity: 0.55, scale: 1.5 },
        ],
      };
    case 'cave':
      return {
        color: new THREE.Color(0x4a5868),
        baseOpacity: 0.10,
        layers: [
          { height: 0.20, opacity: 1.0, scale: 1.0 },
          { height: 0.45, opacity: 0.6, scale: 1.6 },
        ],
      };
    case 'dungeon':
      return {
        color: new THREE.Color(0x3a3540),
        baseOpacity: 0.08,
        layers: [{ height: 0.18, opacity: 1.0, scale: 1.0 }],
      };
    default: // desert and unknown: no moisture mist
      return null;
  }
}

const MIST_VERTEX = /* glsl */ `
  varying vec2 vMistXZ;
  varying vec2 vMistUv;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vMistXZ = worldPos.xz;
    vMistUv = uv;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const MIST_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3  uColor;
  uniform float uOpacity;
  uniform float uScale;
  varying vec2 vMistXZ;
  varying vec2 vMistUv;

  float mHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float mNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mHash(i), mHash(i + vec2(1.0, 0.0)), f.x),
      mix(mHash(i + vec2(0.0, 1.0)), mHash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  float mFbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * mNoise(p);
      p = p * 2.07 + vec2(3.1, 7.7);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Two counter-scrolling FBM fields → slowly churning wisps, no tiling
    float n1 = mFbm(vMistXZ * 0.16 * uScale + vec2(uTime * 0.022, -uTime * 0.015));
    float n2 = mFbm(vMistXZ * 0.31 * uScale - vec2(uTime * 0.011,  uTime * 0.018));
    float wisp = smoothstep(0.40, 0.78, n1 * 0.62 + n2 * 0.38);

    // Radial fade so the sheet never shows a hard rectangular edge
    float edge = 1.0 - smoothstep(0.55, 0.98, length(vMistUv * 2.0 - 1.0));

    float a = wisp * edge * uOpacity;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

interface GroundMistProps {
  mapData: BattleMapData;
}

const GroundMist: React.FC<GroundMistProps> = ({ mapData }) => {
  const biome = (mapData as BattleMapData & { biome?: string; theme?: string }).biome
    ?? mapData.theme
    ?? 'forest';
  const config = getBiomeMist(biome);

  const { width, height } = mapData.dimensions;

  const materialsRef = useRef<THREE.ShaderMaterial[]>([]);

  const layers = useMemo(() => {
    if (!config) return null;
    const planeW = width * TILE_SIZE * 1.5;
    const planeH = height * TILE_SIZE * 1.5;
    const cx = (width * TILE_SIZE) / 2;
    const cz = (height * TILE_SIZE) / 2;

    const built = config.layers.map((layer) => {
      const geometry = new THREE.PlaneGeometry(planeW, planeH, 1, 1);
      geometry.rotateX(-Math.PI / 2);
      const material = new THREE.ShaderMaterial({
        vertexShader: MIST_VERTEX,
        fragmentShader: MIST_FRAGMENT,
        uniforms: {
          uTime:    { value: 0 },
          uColor:   { value: config.color },
          uOpacity: { value: config.baseOpacity * layer.opacity },
          uScale:   { value: layer.scale },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      return { geometry, material, position: [cx, layer.height, cz] as const };
    });
    materialsRef.current = built.map((b) => b.material);
    return built;
  }, [config, width, height]);

  // Dispose GPU resources when layers change or component unmounts
  useEffect(() => () => {
    layers?.forEach(({ geometry, material }) => {
      geometry.dispose();
      material.dispose();
    });
  }, [layers]);

  useFrame((state) => {
    for (const mat of materialsRef.current) {
      mat.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  if (!layers) return null;

  return (
    <>
      {layers.map(({ geometry, material, position }, i) => (
        <mesh
          key={i}
          geometry={geometry}
          material={material}
          position={[position[0], position[1], position[2]]}
          renderOrder={3}
        />
      ))}
    </>
  );
};

export default GroundMist;
