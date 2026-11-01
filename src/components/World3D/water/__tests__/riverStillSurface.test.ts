/** CPU height regression only; shader execution/rendered stillness remains
 * a separate parent check. Static rock pillow and arriving impacts stay active. */
import { describe, expect, it } from 'vitest';
import type { RiverReachData } from '@/systems/world3d/river/riverWorker';
import { RiverSurfaceMirror } from '../riverSurfaceMirror';
import { createRiverFlowTextures } from '../riverWaterMaterial';

/** Only the flow textures and sheet are consumed by the surface sampler. */
function surface({ main = false, mainShare = 1, speed = 0, turbulence = 0, forcing = 0, micro = 0 } = {}) {
  const grid = { nx: 4, nz: 4, dx: 1, x0: 0, z0: 0 };
  const t0 = new Float32Array(64), t1 = new Float32Array(64), t2 = new Float32Array(64);
  for (let i = 0; i < 16; i++) {
    t0.set([speed, 0, 0.5, 1], i * 4);
    t1.set([0, 0, 0, turbulence], i * 4);
    t2.set([0.003, 0, forcing, micro], i * 4);
  }
  const data = { grid, t0, t1, t2, surface: new Float32Array(16).fill(1) } as RiverReachData;
  const mirror = new RiverSurfaceMirror(data);
  if (main) mirror.setMainRapidsMorphology(new Uint8Array(64).fill(Math.round(255 * mainShare)), true);
  return { mirror, data };
}
const samples = (mirror: RiverSurfaceMirror) => [0, 0.3, 1.2, 5, 120, 125].map(t => mirror.heightAt(1.73, 1.41, t));
const range = (a: number[]) => Math.max(...a) - Math.min(...a);

describe('settled river surface', () => {
  it.each([false, true])('has no clock-driven ripples without excitation (main=%s)', main => {
    const { mirror, data } = surface({ main });
    const before = [data.t0.slice(), data.t1.slice(), data.t2.slice(), data.surface.slice()];
    expect(range(samples(mirror))).toBe(0);
    // Preserve the static rock pillow and the hydraulic state.
    expect(samples(mirror)[0]).toBeCloseTo(0.003, 5);
    expect([data.t0, data.t1, data.t2, data.surface]).toEqual(before);
  });
  it.each([0.25, 0.75])('keeps unexcited main/legacy blend still (main share=%s)', mainShare => {
    expect(range(samples(surface({ main: true, mainShare }).mirror))).toBe(0);
  });
  it('does not give the observed nearly still legacy patch a minimum wave amplitude', () => {
    expect(range(samples(surface({ speed: 0.000563 }).mirror))).toBe(0);
  });
  it('retains carried turbulence even when the mean current is zero', () => {
    expect(range(samples(surface({ turbulence: 0.6 }).mirror))).toBeGreaterThan(0.0001);
  });
  it('retains current-generated roughness in flowing legacy water', () => {
    expect(range(samples(surface({ speed: 1.5 }).mirror))).toBeGreaterThan(0.0001);
  });
  it('retains local forcing and fine ripples in the main channel', () => {
    expect(range(samples(surface({ main: true, forcing: 0.6 }).mirror))).toBeGreaterThan(0.0001);
    expect(range(samples(surface({ main: true, micro: 0.05 }).mirror))).toBeGreaterThan(0.0001);
  });
  it('retains arriving waterfall impact waves over otherwise settled water', () => {
    const { mirror } = surface();
    mirror.setPoolImpact({ x: 1.5, z: 1.5, tx: 1, tz: 0, width: 10, discharge: 1.5, verticalSpeed: 30, poolLevel: 1, depth: 0.5 });
    expect(range(samples(mirror))).toBeGreaterThan(0.001);
  });
});

/** Sharing the shader's half data must preserve both the initial sampler
 * and the standalone caller's private cold snapshot until live replacement. */
describe('surface flow ownership', () => {
  function pair(data: RiverReachData) {
    const flow = createRiverFlowTextures({ grid: data.grid, t0: data.t0, t1: data.t1, t2: data.t2, surface: data.surface, stats: data.mapStats });
    const half = [flow.flow0.image.data as Uint16Array, flow.flow1.image.data as Uint16Array, flow.flow2.image.data as Uint16Array] as const;
    return { legacy: new RiverSurfaceMirror(data), shared: new RiverSurfaceMirror(data, half), half, textures: Object.values(flow) };
  }
  function compare(a: RiverSurfaceMirror, b: RiverSurfaceMirror) {
    for (const [x, z] of [[1.73, 1.41], [-1, -1], [3.5, 4.1], [0.5, 0.5]]) {
      for (const which of [0, 1, 2] as const) expect(a.flow(which, x, z, [])).toEqual(b.flow(which, x, z, []));
    }
    expect(samples(a)).toEqual(samples(b));
  }
  it('matches texture fields and changing surface heights from construction', () => {
    const { data } = surface({ speed: 1.5, turbulence: 0.2, forcing: 0.6, micro: 0.02 });
    for (let c = 0; c < 16; c++) { data.t0[c * 4] += c * 0.13; data.t2[c * 4 + 3] += c * 0.001; }
    const p = pair(data);
    try { compare(p.legacy, p.shared); } finally { p.textures.forEach(t => t.dispose()); }
  });
  it('preserves the cold snapshot when source float fields change', () => {
    const { data } = surface({ speed: 1.5, turbulence: 0.2 });
    const p = pair(data), before = samples(p.legacy);
    try {
      data.t0.fill(99); data.t1.fill(99); data.t2.fill(99);
      expect(samples(p.legacy)).toEqual(before);
      compare(p.legacy, p.shared);
    } finally { p.textures.forEach(t => t.dispose()); }
  });
  it('follows repeated live replacements and their current half texels', () => {
    const first = surface({ speed: 0.7 }).data, second = surface({ speed: 1.8, turbulence: 0.4 }).data;
    const a = pair(first), b = pair(second);
    try {
      for (const update of [b, a, b]) {
        a.legacy.setFlowHalf(...update.half, second.surface);
        a.shared.setFlowHalf(...update.half, second.surface);
        compare(a.legacy, a.shared);
      }
      b.half[0].fill(0);
      expect(a.shared.depth(1.73, 1.41)).toBe(0);
      compare(a.legacy, a.shared);
    } finally { [...a.textures, ...b.textures].forEach(t => t.dispose()); }
  });
});
