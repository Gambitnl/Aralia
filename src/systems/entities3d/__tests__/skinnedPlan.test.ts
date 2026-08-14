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
import { AnimationClip, QuaternionKeyframeTrack, Vector3 } from 'three';
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
  // Slice 5 (speciesSkeleton.ts) gave the species gaits their own bone
  // hierarchies, so the quad no longer refuses skinned — it builds one. The
  // guard that remains is the wireframe one (decided Remy 2026-07-21).
  // Full species parity coverage lives in speciesSkeleton.test.ts.
  it('bodyTech skinned + a species gait (quad) now builds a skinned body', () => {
    const blueprint: EntityBlueprint = {
      gait: 'quad',
      frame: deriveFrame('quad', 6, 1, 1),
      palette: PALETTE,
      parts: [],
      label: 'TestQuad',
    };
    const handle = assembleEntity(blueprint, { bodyTech: 'skinned' });
    expect(handle.group.getObjectByName('skinnedBody'), 'quad has no skinned body').toBeTruthy();
    handle.dispose();
    expect(() => assembleEntity(blueprint, { bodyTech: 'skinned', renderMode: 'wireframe' })).toThrow(
      /solid shaded only/,
    );
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

describe('assembleEntity — Task 3: formed heads ride their head<i> bone', () => {
  it('skinned mode parents the sculpted head to its head bone on the live socket; segments mode keeps the anchor path', () => {
    const { frame, planSpec } = compilePlan(PLAN_FIXTURES.dragon);
    const spec = planSpec!;
    // the dragon's serpent head is a formed head — the fixture must exercise this
    expect(spec.heads.some((h) => h.form)).toBe(true);
    const blueprint: EntityBlueprint = {
      gait: 'plan',
      frame,
      palette: PALETTE,
      parts: [],
      label: 'Dragon',
      planSpec: spec,
    };

    // skinned: the sculpted head group hangs under the head0 BONE, and lands
    // exactly on the live socket of the same driver state (assemble settles
    // with update(0, 1/60) at idle, so a fresh driver reproduces it).
    const skinned = assembleEntity(blueprint, { bodyTech: 'skinned' });
    const formGroup = skinned.group.getObjectByName('head0:form');
    expect(formGroup, 'skinned formed head exists').toBeTruthy();
    const boneParent = formGroup!.parent as import('three').Bone;
    expect(boneParent.isBone, 'skinned formed head rides a bone').toBe(true);
    expect(boneParent.name).toBe('head0');
    const driver = createGaitDriver('plan', frame, spec);
    driver.update(0, 1 / 60, { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 0 });
    const socket = driver.headSockets!()[0];
    skinned.group.updateMatrixWorld(true);
    const world = new Vector3();
    formGroup!.getWorldPosition(world);
    expect(world.distanceTo(new Vector3(socket.x, socket.y, socket.z)), 'formed head sits on its socket').toBeLessThan(1e-6);
    skinned.dispose();

    // segments (default): no bones exist — the head keeps the direct socket path
    const segments = assembleEntity(blueprint);
    const segForm = segments.group.getObjectByName('head0:form');
    expect(segForm, 'segments formed head exists').toBeTruthy();
    expect(((segForm!.parent as import('three').Bone).isBone ?? false), 'segments formed head stays off bones').toBe(false);
    segments.dispose();
  });
});

describe('assembleEntity — clip contract guards (the ONE mixer door)', () => {
  const bipedBlueprint: EntityBlueprint = {
    gait: 'biped',
    frame: deriveFrame('biped', 6, 1, 1),
    palette: PALETTE,
    parts: [],
    label: 'ClipGuard',
  };

  it("animSource 'clip' on a non-skinned body throws — a clip needs bones", () => {
    expect(() => assembleEntity(bipedBlueprint, { animSource: 'clip', clips: new Map() })).toThrow(/needs bodyTech 'skinned'/);
  });

  it("animSource 'clip' without a loaded pack throws", () => {
    expect(() => assembleEntity(bipedBlueprint, { bodyTech: 'skinned', animSource: 'clip' })).toThrow(/needs a loaded clip pack/);
  });

  it('clip mode animates bones while the group never moves (gait owns locomotion/facing)', () => {
    // in-place rotation-only clip through the canonical contract
    const track = new QuaternionKeyframeTrack('.bones[upperArmL].quaternion', [0, 1], [0, 0, 0, 1, 0, 0.7071, 0, 0.7071]);
    const clips = new Map([
      ['Idle', new AnimationClip('Idle', 1, [track])],
      ['Walk', new AnimationClip('Walk', 1, [track.clone()])],
    ]);
    const handle = assembleEntity(bipedBlueprint, { bodyTech: 'skinned', animSource: 'clip', clips });
    const bone = handle.group.getObjectByName('upperArmL') as import('three').Bone;
    expect(bone?.isBone, 'skinned biped carries the arm bone').toBe(true);
    handle.update(1 / 60, 1 / 60, { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 1.4 });
    const q1 = bone.quaternion.clone();
    for (let k = 2; k <= 20; k++) {
      handle.update(k / 60, 1 / 60, { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 1.4 });
    }
    expect(bone.quaternion.angleTo(q1), 'mixer time advances the bone').toBeGreaterThan(1e-4);
    // clip root translation must never drive locomotion: the group stays put
    expect(handle.group.position.length(), 'clip never moves the entity group').toBe(0);
    handle.dispose();
  });
});


