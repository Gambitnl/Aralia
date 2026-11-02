/**
 * @file terrainSurfaceNoiseNode.ts — ADR 0009 step 4: the streamed terrain's
 * per-fragment surface noise as a TSL node material, for the game world on
 * WebGPURenderer (`?gpu=1`).
 *
 * The WebGL terrain installs `applyTerrainSurfaceNoise` through
 * `onBeforeCompile` (`terrain/terrainSurfaceNoise.ts`). Under WebGPU that hook
 * is ignored without a message, so the ground lost the 2.4-41 m band and its
 * material boundaries went back to straight lines. This file rebuilds the SAME
 * math as a node graph on a `MeshStandardNodeMaterial`:
 *
 *   tint = 1 + fbm(worldXZ) * NOISE_AMP * (1.15, 1.0, 0.75)
 *   diffuse = color * map * tint * vertexColor
 *
 * The GLSL multiplies the tint AFTER `color_fragment` (map and vertex color).
 * Multiplication commutes, so `colorNode = color * map * tint` with
 * `vertexColors = true` (the node path multiplies the vertex color after
 * `colorNode`) is the same product. The octave table, the weights and the
 * amplitude are read from the WebGL module, at the same decimal rounding the
 * GLSL source string used, so the two cannot drift.
 *
 * The WebGL module is untouched for WebGL users (this file only imports its
 * constants).
 */
import { DoubleSide, type Texture, type Vector2 } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  Fn,
  dot,
  float,
  floor,
  fract,
  materialColor,
  mix,
  positionWorld,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { useEffect, useMemo } from 'react';
import {
  TERRAIN_NOISE_AMP,
  TERRAIN_NOISE_OCTAVES,
  TERRAIN_NOISE_WEIGHT_SUM,
} from '../terrain/terrainSurfaceNoise';
import { riverFootprintDiscard } from './riverFootprintCut';
import type { TslNode } from '@/types/tslNode';

/* TSL node graphs chain operators that @types/three 0.172 does not model. */
type N = TslNode; // Shared TSL alias (GG-588): see src/types/tslNode.ts.

/** The GLSL wrote its constants with toFixed; the node graph uses the same rounded numbers. */
const AMP = Number(TERRAIN_NOISE_AMP.toFixed(3));
const WEIGHT_SUM = Number(TERRAIN_NOISE_WEIGHT_SUM.toFixed(3));
const OCTAVES = TERRAIN_NOISE_OCTAVES.map(
  ([m, w]) => [Number(m.toFixed(2)), Number(w.toFixed(3))] as const,
);

// Hash without sin(): the same Dave Hoskins hash the GLSL uses (araliaTsnHash).
const tsnHash = Fn(([p]: [N]) => {
  const p3 = fract(vec3(p.x, p.y, p.x).mul(0.1031));
  const p3b = p3.add(dot(p3, p3.yzx.add(33.33)));
  return fract(p3b.x.add(p3b.y).mul(p3b.z));
});

// Value noise, smoothstep-interpolated (araliaTsnNoise).
const tsnNoise = Fn(([p]: [N]) => {
  const i = floor(p);
  const f = fract(p);
  const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));
  const a = tsnHash(i);
  const b = tsnHash(i.add(vec2(1.0, 0.0)));
  const c = tsnHash(i.add(vec2(0.0, 1.0)));
  const d = tsnHash(i.add(vec2(1.0, 1.0)));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
});

/**
 * The surface-noise tint for a world XZ position: a vec3 multiplier centered
 * on 1 (araliaTerrainFbm, then the channel weights 1.15 / 1.0 / 0.75).
 */
export const terrainSurfaceNoiseTint = Fn(([xz]: [N]) => {
  const s = float(0.0).toVar();
  for (const [m, w] of OCTAVES) {
    s.addAssign(tsnNoise(xz.div(m)).mul(w));
  }
  // Centered on zero so the term is a perturbation, not a brightening.
  const n = s.div(WEIGHT_SUM).mul(2.0).sub(1.0);
  return vec3(
    n.mul(AMP * 1.15).add(1.0),
    n.mul(AMP).add(1.0),
    n.mul(AMP * 0.75).add(1.0),
  );
});

export interface TerrainNoiseNodeMaterialParams {
  map: Texture | null;
  normalMap?: Texture | null;
  normalScale?: Vector2;
  roughness?: number;
  /** The frontier skirt is flat-shaded; the terrain surface is smooth. */
  flatShading?: boolean;
}

/**
 * A `MeshStandardNodeMaterial` with the terrain surface noise in its color.
 * Vertex colors, DoubleSide and the maps match the JSX material it replaces.
 */
export function makeTerrainSurfaceNoiseNodeMaterial(
  p: TerrainNoiseNodeMaterialParams,
): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial();
  m.vertexColors = true;
  m.side = DoubleSide;
  m.map = p.map ?? null;
  m.normalMap = p.normalMap ?? null;
  if (p.normalScale) m.normalScale.copy(p.normalScale);
  m.roughness = p.roughness ?? 1;
  m.flatShading = p.flatShading === true;
  // World XZ, not chunk-local: positionWorld is modelWorldMatrix * position,
  // the same `(modelMatrix * vec4(transformed, 1.0)).xz` the GLSL varying holds.
  // ADR 0009 step 6, slice 10: inside the live river's footprint the river
  // draws its own bed, so the terrain fragment is dropped there
  // (riverFootprintCut.ts; off by default, then the branch never fires).
  m.colorNode = Fn(() => {
    riverFootprintDiscard();
    const base: N = vec4(materialColor);
    const tint: N = terrainSurfaceNoiseTint(vec2((positionWorld as N).x, (positionWorld as N).z));
    return vec4(base.rgb.mul(tint), base.a);
  })();
  return m;
}

/**
 * Hook form for the scene's terrain pieces: builds the node material only when
 * `enabled`, rebuilds when a texture changes, and disposes the old one.
 */
export function useTerrainSurfaceNoiseNodeMaterial(
  enabled: boolean,
  p: TerrainNoiseNodeMaterialParams,
): MeshStandardNodeMaterial | null {
  const { map, normalMap = null, normalScale, roughness, flatShading } = p;
  const material = useMemo(
    () =>
      enabled
        ? makeTerrainSurfaceNoiseNodeMaterial({ map, normalMap, normalScale, roughness, flatShading })
        : null,
    [enabled, map, normalMap, normalScale, roughness, flatShading],
  );
  useEffect(() => () => material?.dispose(), [material]);
  return material;
}
