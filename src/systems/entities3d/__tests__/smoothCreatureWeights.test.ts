/**
 * @file smoothCreatureWeights.test.ts — agora-bc64: multi-bone SMOOTH joint
 * weights on the creature (plan) and species skinned bodies.
 *
 * The contract this pins:
 *  (a) the rigid path is UNCHANGED — one bone, weight 1, on every vertex;
 *  (b) smooth changes weights ONLY: vertex count and every vertex POSITION are
 *      bit-identical to the rigid build, so the bind pose cannot shift;
 *  (c) every vertex still sums to weight 1 and indexes an in-range bone;
 *  (d) a blended vertex's second influence is its link's real PARENT bone, not
 *      an arbitrary neighbour — the blend follows the skeleton topology;
 *  (e) the blend is a RAMP: vertices near a joint share the two bones, and
 *      vertices far down the link are back to 100% their own bone;
 *  (f) links parented to the ROOT bone stay rigid (the root never receives a
 *      driver emission — blending into it would drag the body to the origin);
 *  (g) createSkinnedPlan / createSkinnedSpecies accept weights 'smooth'
 *      instead of throwing, and the assembled body still poses without error.
 */
import { describe, it, expect } from 'vitest';
import type { BufferAttribute, SkinnedMesh } from 'three';
import type { Frame, PlanSpec } from '../types';
import { deriveFrame } from '../types';
import { compilePlan } from '../textPlan/compilePlan';
import { PLAN_FIXTURES } from '../textPlan/fixtures';
import { registerAllParts } from '../parts';
import {
  buildPlanBindGeometry,
  buildSpeciesBindGeometry,
  createSkinnedPlan,
  createSkinnedSpecies,
} from '../three/skinnedBody';
import { buildPlanSkeleton } from '../three/planSkeleton';
import { SPECIES_GAITS, buildSpeciesSkeleton, type SpeciesGait } from '../three/speciesSkeleton';

registerAllParts();

const OPTS = { colorHex: '#77aa66', outlineThickness: 0.03 } as const;

/** Plan fixtures with real branching topology (a spine plus limb chains). */
const PLAN_KEYS = ['centaur', 'dragon', 'threeHeadedSerpent', 'beholder', 'gelatinousCube'] as const;

function planCases(): Array<[string, Frame, PlanSpec]> {
  return PLAN_KEYS.map((k) => {
    const c = compilePlan(PLAN_FIXTURES[k]);
    return [k, c.frame, c.planSpec!];
  });
}

function speciesFrame(gait: SpeciesGait): Frame {
  const heightFt = gait === 'quad' ? 6.5 : gait === 'hexapod' ? 4 : gait === 'flyer' ? 3 : 5;
  return deriveFrame(gait, heightFt, 1.15, 1);
}

interface Skin {
  count: number;
  pos: Float32Array;
  si: Uint16Array;
  sw: Float32Array;
}

function readSkin(g: import('three').BufferGeometry): Skin {
  return {
    count: g.attributes.position.count,
    pos: (g.getAttribute('position') as BufferAttribute).array as Float32Array,
    si: (g.getAttribute('skinIndex') as BufferAttribute).array as Uint16Array,
    sw: (g.getAttribute('skinWeight') as BufferAttribute).array as Float32Array,
  };
}

function firstMesh(body: { root: import('three').Object3D }): SkinnedMesh {
  let found: SkinnedMesh | undefined;
  body.root.traverse((o) => {
    if (!found && (o as SkinnedMesh).isSkinnedMesh) found = o as SkinnedMesh;
  });
  if (!found) throw new Error('no SkinnedMesh in body');
  return found;
}

/** Bones with a non-root parent — only these may blend. */
function blendableBones(
  index: ReadonlyMap<string, number>,
  parentId: ReadonlyMap<string, string | null>,
): Map<number, number> {
  const out = new Map<number, number>();
  for (const [id, parent] of parentId) {
    if (!parent || parent === 'root') continue;
    const self = index.get(id);
    const p = index.get(parent);
    if (self !== undefined && p !== undefined) out.set(self, p);
  }
  return out;
}

/**
 * Shared assertions for one rigid/smooth geometry pair. These geometries carry
 * ~100k vertices, and one expect() per vertex is slow enough to trip vitest's
 * default timeout — so the scan COLLECTS the first offender per rule and the
 * assertions run once, which also reports a readable failure instead of the
 * first of thousands.
 */
function assertSmoothPair(
  label: string,
  rigid: Skin,
  smooth: Skin,
  boneCount: number,
  parentOf: Map<number, number>,
): { blended: number } {
  // (b) weights only — the shapes must not move.
  expect(smooth.count, `${label} vertex count`).toBe(rigid.count);
  let movedAt = -1;
  for (let i = 0; i < rigid.count * 3; i++) {
    if (smooth.pos[i] !== rigid.pos[i]) { movedAt = i; break; }
  }
  expect(movedAt, `${label} position component moved`).toBe(-1);

  let blended = 0;
  let badSum = -1;
  let badOwn = -1;
  let badTail = -1;
  let badParent = -1;
  for (let v = 0; v < smooth.count; v++) {
    const w1 = smooth.sw[v * 4 + 1];
    const sum = smooth.sw[v * 4] + w1 + smooth.sw[v * 4 + 2] + smooth.sw[v * 4 + 3];
    // (c) partition of unity; slot 0 must stay the piece's OWN bone, exactly
    // as the rigid build wrote it; slots 2/3 stay unused.
    if (badSum < 0 && Math.abs(sum - 1) >= 1e-6) badSum = v;
    const own = smooth.si[v * 4];
    if (badOwn < 0 && (own >= boneCount || own !== rigid.si[v * 4])) badOwn = v;
    if (badTail < 0 && (smooth.sw[v * 4 + 2] !== 0 || smooth.sw[v * 4 + 3] !== 0)) badTail = v;
    if (w1 <= 1e-6) continue;
    blended++;
    // (d) the second influence is this bone's real parent, and (f) a
    // root-parented bone never reaches here at all.
    const parent = smooth.si[v * 4 + 1];
    if (badParent < 0 && (parent >= boneCount || parentOf.get(own) !== parent)) badParent = v;
  }
  expect(badSum, `${label} vertex with weights not summing to 1`).toBe(-1);
  expect(badOwn, `${label} vertex whose own bone changed or is out of range`).toBe(-1);
  expect(badTail, `${label} vertex using skin slot 2 or 3`).toBe(-1);
  expect(badParent, `${label} vertex not blending toward its own parent bone`).toBe(-1);
  return { blended };
}

describe('agora-bc64 — smooth joint weights on plan creatures', () => {
  it('(a) the rigid build stays 100%-one-bone', () => {
    for (const [name, frame, spec] of planCases()) {
      const built = buildPlanSkeleton(frame, spec);
      const g = buildPlanBindGeometry(built.restPose, built.index);
      const s = readSkin(g);
      let bad = -1;
      for (let v = 0; v < s.count; v++) {
        if (s.sw[v * 4] !== 1 || s.sw[v * 4 + 1] !== 0) { bad = v; break; }
      }
      expect(bad, `${name} vertex that is not 100% one bone`).toBe(-1);
      g.dispose();
    }
  });

  it('(b-f) smooth blends each link toward its parent without moving a vertex', () => {
    for (const [name, frame, spec] of planCases()) {
      const rigidBuilt = buildPlanSkeleton(frame, spec);
      const rigidGeo = buildPlanBindGeometry(rigidBuilt.restPose, rigidBuilt.index);
      const smoothBuilt = buildPlanSkeleton(frame, spec);
      const smoothGeo = buildPlanBindGeometry(smoothBuilt.restPose, smoothBuilt.index, undefined, {
        parentId: smoothBuilt.parentId,
      });

      const { blended } = assertSmoothPair(
        name,
        readSkin(rigidGeo),
        readSkin(smoothGeo),
        smoothBuilt.bones.length,
        blendableBones(smoothBuilt.index, smoothBuilt.parentId),
      );
      // Every one of these fixtures has at least one non-root-parented link,
      // so a zero here means the blend silently did nothing.
      expect(blended, `${name} blended vertices`).toBeGreaterThan(0);
      rigidGeo.dispose();
      smoothGeo.dispose();
    }
  });

  it('(e) the blend is a ramp: full parent behind the joint, full own bone down the link', () => {
    const [, frame, spec] = planCases().find(([k]) => k === 'centaur')!;
    const built = buildPlanSkeleton(frame, spec);
    const g = buildPlanBindGeometry(built.restPose, built.index, undefined, { parentId: built.parentId });
    const s = readSkin(g);

    let nearParent = 0; // own-bone share below 0.1 — behind the joint plane
    let midBlend = 0; // genuinely shared
    let ownOnly = 0; // back to rigid down the link
    for (let v = 0; v < s.count; v++) {
      const w0 = s.sw[v * 4];
      if (w0 < 0.1) nearParent++;
      else if (w0 < 0.9) midBlend++;
      else if (s.sw[v * 4 + 1] <= 1e-6) ownOnly++;
    }
    expect(nearParent, 'vertices carried by the parent across the joint').toBeGreaterThan(0);
    expect(midBlend, 'genuinely shared vertices').toBeGreaterThan(0);
    expect(ownOnly, 'vertices past the ramp').toBeGreaterThan(0);
    g.dispose();
  });

  it("(g) createSkinnedPlan accepts weights 'smooth'", () => {
    for (const [name, frame, spec] of planCases()) {
      const body = createSkinnedPlan(frame, spec, { ...OPTS, weights: 'smooth' });
      const s = readSkin(firstMesh(body).geometry);
      let blended = 0;
      for (let v = 0; v < s.count; v++) if (s.sw[v * 4 + 1] > 1e-6) blended++;
      expect(blended, `${name} blended vertices through the factory`).toBeGreaterThan(0);
      // the pose pipeline must still resolve with the new weights in place
      expect(() => body.finishFrame()).not.toThrow();
      body.dispose();
    }
  });
});

describe('agora-bc64 — smooth joint weights on species gaits', () => {
  it('(b-f) every species gait blends toward its parent without moving a vertex', () => {
    for (const gait of SPECIES_GAITS) {
      const frame = speciesFrame(gait);
      const rigidBuilt = buildSpeciesSkeleton(gait, frame);
      const rigidGeo = buildSpeciesBindGeometry(rigidBuilt.restPose, rigidBuilt.index);
      const smoothBuilt = buildSpeciesSkeleton(gait, frame);
      const smoothGeo = buildSpeciesBindGeometry(smoothBuilt.restPose, smoothBuilt.index, {
        parentId: smoothBuilt.parentId,
      });

      const { blended } = assertSmoothPair(
        gait,
        readSkin(rigidGeo),
        readSkin(smoothGeo),
        smoothBuilt.bones.length,
        blendableBones(smoothBuilt.index, smoothBuilt.parentId),
      );
      expect(blended, `${gait} blended vertices`).toBeGreaterThan(0);
      rigidGeo.dispose();
      smoothGeo.dispose();
    }
  });

  it("(g) createSkinnedSpecies accepts weights 'smooth'", () => {
    for (const gait of SPECIES_GAITS) {
      const body = createSkinnedSpecies(gait, speciesFrame(gait), { ...OPTS, weights: 'smooth' });
      const s = readSkin(firstMesh(body).geometry);
      let blended = 0;
      for (let v = 0; v < s.count; v++) if (s.sw[v * 4 + 1] > 1e-6) blended++;
      expect(blended, `${gait} blended vertices through the factory`).toBeGreaterThan(0);
      expect(() => body.finishFrame()).not.toThrow();
      body.dispose();
    }
  });
});
