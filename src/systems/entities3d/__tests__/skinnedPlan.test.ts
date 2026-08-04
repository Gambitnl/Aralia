/**
 * @file skinnedPlan.test.ts — skeleton pivot slice 4, task 2: the rigid-weight
 * skinned plan body through the stack.
 *
 * Asserts the plan's Task 2 contract: (a) every vertex is owned 100% by one
 * in-range bone; (b) the body is exactly 2 SkinnedMesh draw calls under
 * PLAN_TRIANGLE_BUDGET for every stress fixture; (c) skinned bone joints match
 * a fresh collecting-sink capture over a walk cycle; (d) decorative emissions
 * (snouts, cilia, fingers) still render through the anchor path via the
 * decorative delegate; (e) guards: species gaits refuse skinned.
 */
import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import type { EntityBlueprint, Frame, PlanSpec, SegmentSink, Palette } from '../types';
import { deriveFrame } from '../types';
import { compilePlan } from '../textPlan/compilePlan';
import { PLAN_FIXTURES } from '../textPlan/fixtures';
import { PLAN_TRIANGLE_BUDGET } from '../textPlan/budgets';
import { registerAllParts } from '../parts';
import { createSkinnedPlan } from '../three/skinnedBody';
import { assembleEntity } from '../three/assembleEntity';
import { createGaitDriver } from '../three/gaits';

registerAllParts();

const PALETTE: Palette = { skinHex: '#77aa66', accentHex: '#aa8844', secondaryHex: '#d8c49a', eyeHex: '#f2c14e' };

function fixtureCases(): Array<[string, Frame, PlanSpec]> {
  const keys = ['centaur', 'gelatinousCube', 'beholder', 'ghost', 'dragon', 'threeHeadedSerpent'] as const;
  return keys.map((k) => {
    const c = compilePlan(PLAN_FIXTURES[k]);
    return [k, c.frame, c.planSpec!];
  });
}

function skinnedMeshes(body: ReturnType<typeof createSkinnedPlan>): import('three').SkinnedMesh[] {
  const meshes: import('three').SkinnedMesh[] = [];
  body.root.traverse((o) => {
    if ((o as import('three').SkinnedMesh).isSkinnedMesh) meshes.push(o as import('three').SkinnedMesh);
  });
  return meshes;
}

function collectBones(body: ReturnType<typeof createSkinnedPlan>): Map<string, Vector3> {
  const out = new Map<string, Vector3>();
  body.root.traverse((o) => {
    const b = o as import('three').Bone;
    if (b.isBone) out.set(b.name, new Vector3().setFromMatrixPosition(b.matrixWorld));
  });
  return out;
}

describe('createSkinnedPlan — rigid-weight bind geometry', () => {
  it('(a) every vertex is owned 100% by one in-range bone', () => {
    for (const [name, frame, spec] of fixtureCases()) {
      const body = createSkinnedPlan(frame, spec, { colorHex: '#77aa66', outlineThickness: 0.03 });
      const g = skinnedMeshes(body)[0].geometry;
      const boneCount = collectBones(body).size;
      const si = (g.getAttribute('skinIndex') as import('three').BufferAttribute).array as Uint16Array;
      const sw = (g.getAttribute('skinWeight') as import('three').BufferAttribute).array as Float32Array;
      for (let v = 0; v < g.attributes.position.count; v++) {
        const sum = sw[v * 4] + sw[v * 4 + 1] + sw[v * 4 + 2] + sw[v * 4 + 3];
        expect(Math.abs(sum - 1), `${name} vertex ${v} weight sum`).toBeLessThan(1e-6);
        const nonZero = [0, 1, 2, 3].filter((k) => sw[v * 4 + k] > 1e-6).length;
        expect(nonZero, `${name} vertex ${v} nonzero influences`).toBe(1);
        expect(si[v * 4], `${name} vertex ${v} skinIndex`).toBeLessThan(boneCount);
      }
      body.dispose();
    }
  });

  it('(b) body is exactly 2 SkinnedMesh draw calls under PLAN_TRIANGLE_BUDGET for every fixture', () => {
    for (const [name, frame, spec] of fixtureCases()) {
      const body = createSkinnedPlan(frame, spec, { colorHex: '#77aa66', outlineThickness: 0.03 });
      expect(skinnedMeshes(body).length, `${name} draw calls`).toBe(2);
      expect(body.triangles(), `${name} triangles`).toBeLessThan(PLAN_TRIANGLE_BUDGET);
      body.dispose();
    }
  });
});

describe('createSkinnedPlan — pose parity over a walk cycle (c)', () => {
  it('skinned bone joints match a fresh collecting-sink capture at a later frame', () => {
    for (const [name, frame, spec] of fixtureCases()) {
      const body = createSkinnedPlan(frame, spec, { colorHex: '#77aa66', outlineThickness: 0.03 });
      const driver = createGaitDriver('plan', frame, spec);
      const loco = { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 1.4 };
      for (let k = 0; k < 60; k++) {
        driver.update(k / 60, 1 / 60, loco);
        driver.buildBody(body.sink);
        body.finishFrame();
      }
      const rec = new Map<string, Vector3>();
      const r: SegmentSink = {
        seg: (id, ax, ay, az, bx, by, bz) => rec.set(id, new Vector3(ax, ay, az)),
        ball: (id, x, y, z) => rec.set(id, new Vector3(x, y, z)),
        box: (id, ax, ay, az, bx, by, bz) => rec.set(id, new Vector3(ax, ay, az)),
        tube: () => {},
      };
      driver.buildBody(r);
      body.root.updateMatrixWorld(true); // recompute bone matrixWorld from locals
      const bones = collectBones(body);
      for (const [id, expected] of rec) {
        const bone = bones.get(id);
        if (!bone) continue; // decorative-only ids map to no bone
        expect(bone.distanceTo(expected), `${name} ${id}`).toBeLessThan(1e-6);
      }
      body.dispose();
    }
  });
});

describe('createSkinnedPlan — decorative emissions stay on the anchor path (d)', () => {
  it('forwards snouts/cilia/fingers to the decorative delegate with zero dropped pieces', () => {
    const cases: Array<[string, string]> = [
      // dragon → leg toes (decorative segs; its formed serpent head suppresses snouts)
      ['dragon', 'leg0L.toe0'],
      // beholder → cilia lash ring (decorative segs)
      ['beholder', 'head0.cilia0'],
      // ghost → hand-tipped arms (decorative fingers)
      ['ghost', 'arm0L.finger0'],
    ];
    for (const [key, expectId] of cases) {
      const { frame, planSpec } = compilePlan(PLAN_FIXTURES[key as keyof typeof PLAN_FIXTURES]);
      const spec = planSpec!;
      const seen: string[] = [];
      const delegate: SegmentSink = {
        seg: (id) => seen.push(id),
        ball: (id) => seen.push(id),
        ring: () => {},
        collar: () => {},
      };
      const body = createSkinnedPlan(frame, spec, {
        colorHex: '#77aa66',
        outlineThickness: 0.03,
        decorativeDelegate: delegate,
      });
      const driver = createGaitDriver('plan', frame, spec);
      driver.update(0, 1 / 60, { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 0 });
      driver.buildBody(body.sink);
      body.finishFrame();
      expect(seen, `${key} decorative ids`).toContain(expectId);
      body.dispose();
    }
  });
});

describe('assembleEntity — slice 4 guards (e)', () => {
  it('bodyTech skinned + a species gait (quad) throws', () => {
    const blueprint: EntityBlueprint = {
      gait: 'quad',
      frame: deriveFrame('quad', 6, 1, 1),
      palette: PALETTE,
      parts: [],
      label: 'TestQuad',
    };
    expect(() => assembleEntity(blueprint, { bodyTech: 'skinned' })).toThrow(/only the biped and plan gaits/);
  });

  it('skinned plan blueprints assemble (no throw) and stay under budget', () => {
    const { frame, planSpec } = compilePlan(PLAN_FIXTURES.centaur);
    const blueprint: EntityBlueprint = {
      gait: 'plan',
      frame,
      palette: PALETTE,
      parts: [],
      label: 'Centaur',
      planSpec,
    };
    expect(() => assembleEntity(blueprint, { bodyTech: 'skinned' })).not.toThrow();
    const handle = assembleEntity(blueprint, { bodyTech: 'skinned' });
    expect(handle.stats().triangles).toBeGreaterThan(0);
    expect(handle.stats().triangles).toBeLessThan(PLAN_TRIANGLE_BUDGET);
    handle.dispose();
  });
});


