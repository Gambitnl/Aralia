/**
 * @file terrainColorNode.ts
 * @description TSL translation of the WebGL battle-map procedural terrain
 * texturing (`terrain/TerrainMesh.tsx`'s `onBeforeCompile` GLSL). The WebGL
 * path injects hand-written GLSL (per-type color functions, organic edge
 * blending, slope-exposed rock, wet banks, canopy dapple) into a
 * `MeshStandardMaterial`. That mechanism has NO node-path equivalent, so this
 * module rebuilds the SAME visual result as a TSL node graph that feeds the
 * `colorNode` of an unlit `MeshBasicNodeMaterial` (the baked-lighting pattern
 * from `WebGPUProbeScene`: `albedo × (hemisphere + directional Lambert)`).
 *
 * Rung 1 of the WebGPU battle-map port (wave spec §8). This is a real
 * translation of the GLSL — the 3-scale noise hierarchy, the per-type palettes,
 * the slope→rock blend, and the shoreline wet-bank darkening are all preserved
 * — NOT the flat per-tile palette the interim scene shipped.
 *
 * TESTABILITY: `buildTerrainColorNode` constructs and returns a TSL node with
 * no GPU. Its unit test asserts the graph is a real node (has `.build`) so the
 * translation can be validated in CI without a WebGPU device (headless has no
 * adapter — see the probe report's "backend honesty" note).
 */
import {
  Fn,
  vec2,
  vec3,
  float,
  floor,
  fract,
  mix,
  smoothstep,
  min as tslMin,
  max as tslMax,
  abs as tslAbs,
  clamp,
  sin,
  dot,
  normalize as tslNormalize,
  cross,
  positionWorld,
  dFdx,
  dFdy,
  texture,
  int,
  If,
  Loop,
} from 'three/tsl';
import type { Texture } from 'three/webgpu';

/* TSL node graphs are dynamically typed; the exported types are too narrow to
 * compose the chained builders cleanly, so glue helpers take/return `any`. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type N = any;

// ── Hash / value noise / FBM / voronoi (port of the GLSL preamble) ───────────

const hash21 = Fn(([p]: [N]) => {
  // Dave Hoskins style hash21 (matches the GLSL exactly).
  const p3 = fract(vec3(p.x, p.y, p.x).mul(0.1031));
  const p3b = p3.add(dot(p3, p3.yzx.add(33.33)));
  return fract(p3b.x.add(p3b.y).mul(p3b.z));
});

const vnoise = Fn(([p]: [N]) => {
  const i = floor(p);
  const f0 = fract(p);
  const f = f0.mul(f0).mul(float(3.0).sub(f0.mul(2.0)));
  const a = hash21(i);
  const b = hash21(i.add(vec2(1.0, 0.0)));
  const c = hash21(i.add(vec2(0.0, 1.0)));
  const d = hash21(i.add(vec2(1.0, 1.0)));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
});

const fbm4 = Fn(([p0]: [N]) => {
  const v = float(0.0).toVar();
  const a = float(0.5).toVar();
  const p = p0.toVar();
  Loop({ start: 0, end: 4, type: 'int', condition: '<' }, () => {
    v.addAssign(a.mul(vnoise(p)));
    p.assign(p.mul(2.03).add(vec2(1.7, 9.2)));
    a.mulAssign(0.5);
  });
  return v;
});

const voronoi = Fn(([p]: [N]) => {
  const i = floor(p);
  const f = fract(p);
  const md = float(1.0).toVar();
  Loop({ start: -1, end: 1, type: 'int', condition: '<=', name: 'vy' }, ({ vy }: N) => {
    Loop({ start: -1, end: 1, type: 'int', condition: '<=', name: 'vx' }, ({ vx }: N) => {
      const nb = vec2(float(vx), float(vy));
      const h = hash21(i.add(nb));
      const pt = vec2(fract(h.mul(17.31)), fract(h.mul(43.47)));
      md.assign(tslMin(md, nb.add(pt).sub(f).length()));
    });
  });
  return md;
});

// ── Per-terrain-type color functions (port of getXxxColor) ───────────────────

const getGrassColor = Fn(([wXZ]: [N]) => {
  const macro = fbm4(wXZ.mul(0.2).add(vec2(1.7, 3.1)));
  const mid = fbm4(wXZ.mul(0.85).add(vec2(8.3, 2.4)));
  const grain = vnoise(wXZ.mul(8.0));
  const lush = vec3(0.09, 0.3, 0.07);
  const field = vec3(0.2, 0.4, 0.13);
  const faded = vec3(0.28, 0.38, 0.16);
  const c = mix(lush, field, smoothstep(0.25, 0.65, macro)).toVar();
  c.assign(mix(c, faded, smoothstep(0.58, 0.82, macro).mul(0.65)));
  c.addAssign(vec3(0.0, 0.03, 0.0).mul(smoothstep(0.48, 0.72, mid)));
  const dp = fbm4(wXZ.mul(0.42).add(vec2(42.7, 17.3)));
  c.assign(mix(c, vec3(0.28, 0.22, 0.12), smoothstep(0.6, 0.76, dp).mul(0.42)));
  c.addAssign(grain.sub(0.5).mul(0.05));
  return clamp(c, 0.0, 1.0);
});

const getRockColor = Fn(([wXZ]: [N]) => {
  const macro = fbm4(wXZ.mul(0.18).add(vec2(51.0, 17.3)));
  const mid = fbm4(wXZ.mul(0.8).add(vec2(7.0, 33.0)));
  const crack = voronoi(wXZ.mul(1.1));
  const fine = voronoi(wXZ.mul(3.2));
  const light = vec3(0.58, 0.55, 0.5);
  const dark = vec3(0.24, 0.22, 0.2);
  const ochre = vec3(0.48, 0.38, 0.26);
  const c = mix(dark, light, macro.mul(0.45).add(0.38)).toVar();
  c.mulAssign(float(0.55).add(smoothstep(0.0, 0.18, crack).mul(0.45)));
  c.mulAssign(float(0.88).add(smoothstep(0.0, 0.08, fine).mul(0.12)));
  const stain = smoothstep(0.62, 0.8, fbm4(wXZ.mul(0.28).add(vec2(71.0, 59.0))));
  c.assign(mix(c, ochre, stain.mul(0.35)));
  c.addAssign(mid.sub(0.5).mul(0.06));
  return clamp(c, 0.0, 1.0);
});

const getDirtColor = Fn(([wXZ]: [N]) => {
  const macro = fbm4(wXZ.mul(0.22).add(vec2(17.0, 23.0)));
  const grain = vnoise(wXZ.mul(9.0));
  const wet = vec3(0.16, 0.1, 0.05);
  const dryr = vec3(0.4, 0.3, 0.18);
  const clay = vec3(0.5, 0.38, 0.24);
  const c = mix(wet, dryr, smoothstep(0.28, 0.72, macro)).toVar();
  const clayPatch = smoothstep(0.58, 0.74, fbm4(wXZ.mul(0.38).add(vec2(29.0, 53.0))));
  c.assign(mix(c, clay, clayPatch.mul(0.38)));
  const pebble = smoothstep(0.85, 0.87, vnoise(wXZ.mul(6.0)));
  c.assign(mix(c, vec3(0.55, 0.5, 0.42), pebble.mul(0.55)));
  c.addAssign(grain.sub(0.5).mul(0.04));
  return clamp(c, 0.0, 1.0);
});

const getSandColor = Fn(([wXZ]: [N]) => {
  const dune = fbm4(wXZ.mul(vec2(0.14, 0.28)).add(vec2(33.0, 41.0)));
  const mid = fbm4(wXZ.mul(0.55).add(vec2(11.0, 7.0)));
  const ripple = sin(wXZ.x.mul(6.0).add(wXZ.y.mul(2.5)).add(dune.mul(4.5))).mul(0.5).add(0.5);
  const pale = vec3(0.9, 0.82, 0.62);
  const shadow = vec3(0.54, 0.43, 0.27);
  const c = mix(shadow, pale, smoothstep(0.28, 0.72, dune)).toVar();
  c.addAssign(vec3(0.05, 0.04, 0.02).mul(ripple).mul(0.6));
  const red = smoothstep(0.64, 0.8, fbm4(wXZ.mul(0.22).add(vec2(91.0, 37.0))));
  c.assign(mix(c, vec3(0.72, 0.48, 0.26), red.mul(0.28)));
  c.addAssign(mid.sub(0.5).mul(0.04));
  return clamp(c, 0.0, 1.0);
});

const getWaterBedColor = Fn(([wXZ]: [N]) => {
  const macro = fbm4(wXZ.mul(0.45).add(vec2(7.0, 13.0)));
  const pebble = voronoi(wXZ.mul(1.8));
  const silt = mix(vec3(0.08, 0.18, 0.26), vec3(0.14, 0.28, 0.36), macro.mul(0.5).add(0.35)).toVar();
  silt.mulAssign(float(0.78).add(smoothstep(0.0, 0.14, pebble).mul(0.22)));
  return clamp(silt, 0.0, 1.0);
});

const getWallColor = Fn(([wXZ]: [N]) => {
  const block = voronoi(wXZ.mul(0.75));
  const fine = voronoi(wXZ.mul(2.8));
  const macro = fbm4(wXZ.mul(0.22).add(vec2(71.0, 59.0)));
  const stone = mix(vec3(0.22, 0.2, 0.18), vec3(0.44, 0.4, 0.36), macro.mul(0.45).add(0.4)).toVar();
  stone.mulAssign(float(0.4).add(smoothstep(0.0, 0.14, block).mul(0.6)));
  stone.mulAssign(float(0.88).add(smoothstep(0.0, 0.08, fine).mul(0.12)));
  const mossEdge = smoothstep(0.1, 0.22, float(1.0).sub(block));
  stone.assign(mix(stone, vec3(0.18, 0.26, 0.16), mossEdge.mul(0.38)));
  return clamp(stone, 0.0, 1.0);
});

const getFloorColor = Fn(([wXZ]: [N]) => {
  const macro = fbm4(wXZ.mul(0.25).add(vec2(51.0, 37.0)));
  const mid = fbm4(wXZ.mul(0.9).add(vec2(13.0, 71.0)));
  const grout = smoothstep(0.04, 0.09, fract(wXZ.x)).mul(smoothstep(0.04, 0.09, fract(wXZ.y)));
  const slab = mix(vec3(0.3, 0.26, 0.22), vec3(0.5, 0.46, 0.4), macro.mul(0.45).add(0.4)).toVar();
  slab.mulAssign(float(0.75).add(grout.mul(0.25)));
  const wear = smoothstep(0.55, 0.72, float(1.0).sub(mid));
  slab.assign(mix(slab, slab.mul(0.7), wear.mul(0.35)));
  return clamp(slab, 0.0, 1.0);
});

/** Dispatch on terrain type index (matches GLSL getTerrainColor). */
const getTerrainColor = Fn(([idx, wXZ]: [N, N]) => {
  const t = int(idx.add(0.5));
  const color = getGrassColor(wXZ).toVar();
  If(t.equal(int(1)), () => {
    color.assign(getRockColor(wXZ));
  })
    .ElseIf(t.equal(int(2)), () => {
      color.assign(getDirtColor(wXZ));
    })
    .ElseIf(t.equal(int(3)), () => {
      color.assign(getSandColor(wXZ));
    })
    .ElseIf(t.equal(int(4)), () => {
      color.assign(getWaterBedColor(wXZ));
    })
    .ElseIf(t.equal(int(5)), () => {
      color.assign(getWallColor(wXZ));
    })
    .ElseIf(t.equal(int(6)), () => {
      color.assign(getFloorColor(wXZ));
    });
  return color;
});

// ── Flat-shaded world normal (matches the WebGL terrain's normal handling) ───
const flatNormal = () => tslNormalize(cross(dFdx(positionWorld), dFdy(positionWorld)));

export interface TerrainColorNodeParams {
  /** Per-tile terrain-type DataTexture (R = type index 0–7), NearestFilter. */
  typeTex: Texture;
  mapWidth: number;
  mapHeight: number;
  /** Canopy dapple strength: forest 1.0, swamp 0.45, else 0. */
  dapple: number;
}

/**
 * Build the terrain ALBEDO node (before baked lighting is multiplied in): the
 * full procedural color pipeline — per-type palette, organic edge blending,
 * slope-exposed rock, and shoreline wet banks + canopy dapple.
 */
export function buildTerrainAlbedoNode(p: TerrainColorNodeParams): N {
  const { typeTex, mapWidth, mapHeight, dapple } = p;
  const W = float(mapWidth);
  const H = float(mapHeight);

  return Fn(() => {
    const wXZ = vec2(positionWorld.x, positionWorld.z);
    const tileUV = vec2(floor(wXZ.x).add(0.5).div(W), floor(wXZ.y).add(0.5).div(H));
    // Type index: DataTexture R channel is 0..1 → ×255 back to the byte index.
    const terrainIdx = texture(typeTex, tileUV).r.mul(255.0);
    const terrainColor = getTerrainColor(terrainIdx, wXZ).toVar();

    // ── Organic edge blending toward the neighbour type ──
    const tileFrac = fract(wXZ);
    const edgeW = float(0.16);
    const ex = tslMin(tileFrac.x, float(1.0).sub(tileFrac.x));
    const ez = tslMin(tileFrac.y, float(1.0).sub(tileFrac.y));
    const eNoise = fbm4(wXZ.mul(2.7).add(vec2(7.3, 13.7)));
    const edgeDist = clamp(tslMin(ex, ez).add(eNoise.sub(0.5).mul(0.24)), 0.0, 1.0);
    If(edgeDist.lessThan(edgeW), () => {
      const blend = float(1.0).sub(smoothstep(0.02, edgeW, edgeDist));
      const nOff = vec2(0.0, 0.0).toVar();
      If(ex.lessThan(ez), () => {
        nOff.x.assign(tileFrac.x.lessThan(0.5).select(float(-1.0), float(1.0)));
      }).Else(() => {
        nOff.y.assign(tileFrac.y.lessThan(0.5).select(float(-1.0), float(1.0)));
      });
      const nUV = vec2(
        floor(wXZ.x.add(nOff.x)).add(0.5).div(W),
        floor(wXZ.y.add(nOff.y)).add(0.5).div(H),
      );
      If(nUV.x.greaterThanEqual(0.0).and(nUV.x.lessThanEqual(1.0)).and(nUV.y.greaterThanEqual(0.0)).and(nUV.y.lessThanEqual(1.0)), () => {
        const nIdx = texture(typeTex, nUV).r.mul(255.0);
        If(tslAbs(nIdx.sub(terrainIdx)).greaterThan(0.5), () => {
          const nColor = getTerrainColor(nIdx, wXZ);
          terrainColor.assign(mix(terrainColor, nColor, blend.mul(0.85)));
        });
      });
    });

    // ── Slope-exposed rock on grass/dirt/sand ──
    const sType = int(terrainIdx.add(0.5));
    const fn = flatNormal();
    If(sType.equal(int(0)).or(sType.equal(int(2))).or(sType.equal(int(3))), () => {
      const slope = float(1.0).sub(clamp(fn.y, 0.0, 1.0));
      const rocky = smoothstep(0.09, 0.24, slope).toVar();
      If(rocky.greaterThan(0.001), () => {
        const rockC = getRockColor(wXZ).mul(0.92);
        const streak = fbm4(wXZ.mul(vec2(0.9, 2.6)).add(vec2(31.0, 5.0)));
        rocky.mulAssign(float(0.55).add(smoothstep(0.35, 0.65, streak).mul(0.45)));
        terrainColor.assign(mix(terrainColor, rockC, clamp(rocky, 0.0, 1.0).mul(0.85)));
      });
    });

    // ── Wet bank: darken land fragments near a water tile ──
    If(sType.notEqual(int(4)), () => {
      const wetDist = float(9.0).toVar();
      Loop({ start: -1, end: 1, type: 'int', condition: '<=', name: 'wy' }, ({ wy }: N) => {
        Loop({ start: -1, end: 1, type: 'int', condition: '<=', name: 'wx' }, ({ wx }: N) => {
          If(int(wx).equal(int(0)).and(int(wy).equal(int(0))).not(), () => {
            const wTile = floor(wXZ).add(vec2(float(wx), float(wy)));
            const wUV = wTile.add(0.5).div(vec2(W, H));
            If(wUV.x.greaterThanEqual(0.0).and(wUV.x.lessThanEqual(1.0)).and(wUV.y.greaterThanEqual(0.0)).and(wUV.y.lessThanEqual(1.0)), () => {
              const wIdx = int(texture(typeTex, wUV).r.mul(255.0).add(0.5));
              If(wIdx.equal(int(4)), () => {
                const wNear = clamp(wXZ, wTile, wTile.add(1.0));
                wetDist.assign(tslMin(wetDist, wXZ.distance(wNear)));
              });
            });
          });
        });
      });
      const wet = float(1.0).sub(smoothstep(0.04, 0.42, wetDist));
      terrainColor.assign(mix(terrainColor, terrainColor.mul(vec3(0.52, 0.5, 0.52)), wet.mul(0.65)));
    });

    // ── Canopy dapple (forest/swamp) ──
    if (dapple > 0.001) {
      const dap = fbm4(wXZ.mul(0.55).add(vec2(17.0, 83.0)));
      const pool = smoothstep(0.48, 0.72, dap);
      terrainColor.assign(
        terrainColor
          .mul(float(1.0).sub(float(0.2 * dapple)))
          .add(terrainColor.mul(vec3(1.0, 0.96, 0.8)).mul(float(0.5 * dapple)).mul(pool)),
      );
    }

    return terrainColor;
  })();
}

/** The flat world normal node reused by the scene for baked lighting on terrain. */
export function terrainFlatNormalNode(): N {
  return flatNormal();
}
/* eslint-enable @typescript-eslint/no-explicit-any */
