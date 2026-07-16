/**
 * @file assemble.test.ts — blueprint → live three.js entity (headless: object
 * graph only, no renderer). Body v2: segmented skeleton, no metaballs.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { Vector3, Mesh, LineSegments } from 'three';
import { assembleEntity } from '../three/assembleEntity';
import { generateEntityBlueprint } from '../generateEntityBlueprint';
import { registerAllParts } from '../parts';

const WALK = { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 1.2 };

/** Count fill meshes / line nodes under an object, skipping eyes + shadow. */
function countVisuals(root: import('three').Object3D): { meshes: number; lines: number } {
  let meshes = 0;
  let lines = 0;
  root.traverse((o) => {
    if (o.name === 'eyeL' || o.name === 'eyeR' || o.name === 'blobShadow') return;
    if (o.parent?.name === 'eyeL' || o.parent?.name === 'eyeR') return;
    if ((o as Mesh).isMesh) meshes += 1;
    if ((o as LineSegments).isLineSegments) lines += 1;
  });
  return { meshes, lines };
}

describe('entities3d assembler (body v2)', () => {
  beforeAll(() => {
    registerAllParts();
  });

  it('builds a group with segment body, eyes, shadow, and one container per mesh part', () => {
    const bp = generateEntityBlueprint({
      kind: 'humanoid',
      raceId: 'infernal_tiefling',
      classId: 'wizard',
      seed: 'asm-1',
    });
    const meshPartCount = bp.parts.filter((p) =>
      ['hornsCurved', 'staffMain', 'hatWide', 'robeSkirt', 'beltPouch'].includes(p.partId),
    ).length;
    expect(meshPartCount).toBeGreaterThan(2);
    const handle = assembleEntity(bp);
    expect(handle.blueprint).toBe(bp);
    expect(handle.group.getObjectByName('segmentBody'), 'segment body missing').toBeTruthy();
    expect(handle.group.getObjectByName('seg:torso.chest'), 'chest segment missing').toBeTruthy();
    expect(handle.group.getObjectByName('seg:legL.thigh'), 'thigh segment missing').toBeTruthy();
    expect(handle.group.getObjectByName('seg:head'), 'head node missing').toBeTruthy();
    const partContainers = handle.group.getObjectByName('parts');
    expect(partContainers, 'parts container missing').toBeTruthy();
    expect(partContainers!.children.length).toBeGreaterThanOrEqual(meshPartCount);
    expect(handle.group.getObjectByName('eyeL'), 'left eye missing').toBeTruthy();
    expect(handle.group.getObjectByName('eyeR'), 'right eye missing').toBeTruthy();
    expect(handle.group.getObjectByName('blobShadow'), 'shadow missing').toBeTruthy();
    handle.dispose();
  });

  it('blink never stretches the eyes, even across huge frame gaps', () => {
    const bp = generateEntityBlueprint({ kind: 'humanoid', raceId: 'human', classId: 'fighter', seed: 'asm-blink' });
    const handle = assembleEntity(bp);
    const eyeL = handle.group.getObjectByName('eyeL')!;
    const eyeR = handle.group.getObjectByName('eyeR')!;
    // long frames (hitches, headless renders) drive the blink phase deep
    // negative; the squash curve must never see that (scale exploded to ~80).
    let t = 0;
    for (let i = 0; i < 40; i++) {
      const dt = i % 3 === 0 ? 5 : 0.016; // mix hitches with normal frames
      t += dt;
      handle.update(t, dt, WALK);
      for (const eye of [eyeL, eyeR]) {
        expect(eye.scale.y, `frame ${i}: eye scale must stay in the squash range`).toBeGreaterThanOrEqual(0.08);
        expect(eye.scale.y, `frame ${i}: eye scale must never stretch past 1`).toBeLessThanOrEqual(1);
      }
    }
    handle.dispose();
  });

  it('a tiefling tail renders as chain segments driven per frame', () => {
    const bp = generateEntityBlueprint({ kind: 'humanoid', raceId: 'infernal_tiefling', classId: 'rogue', seed: 'asm-tail' });
    expect(bp.parts.some((p) => p.partId === 'tailThin')).toBe(true);
    const handle = assembleEntity(bp);
    const tailSeg = handle.group.getObjectByName('seg:tailThin:tailThin.0');
    expect(tailSeg, 'tail chain segment missing').toBeTruthy();
    const z0 = tailSeg!.position.clone();
    handle.update(2.5, 1 / 60, WALK); // wag advances with time
    expect(tailSeg!.position.equals(z0)).toBe(false);
    handle.dispose();
  });

  it('wireframe (default) renders lines only — no fill meshes, no outlines', () => {
    const bp = generateEntityBlueprint({ kind: 'humanoid', raceId: 'human', classId: 'fighter', seed: 'asm-wire' });
    const handle = assembleEntity(bp); // global default is wireframe
    const { meshes, lines } = countVisuals(handle.group);
    expect(lines, 'wireframe should render line nodes').toBeGreaterThan(10);
    expect(meshes, 'wireframe should have no fill meshes (eyes/shadow excepted)').toBe(0);
    handle.dispose();
  });

  it('solid mode renders toon meshes with ink outlines and joint spheres', () => {
    const bp = generateEntityBlueprint({ kind: 'humanoid', raceId: 'human', classId: 'fighter', seed: 'asm-solid' });
    const handle = assembleEntity(bp, { renderMode: 'solid' });
    let segOutlines = 0;
    let partOutlines = 0;
    handle.group.traverse((o) => {
      if (o.name === 'segOutline') segOutlines += 1;
      if (o.name === 'partOutline') partOutlines += 1;
    });
    expect(segOutlines).toBeGreaterThan(10);
    expect(partOutlines).toBeGreaterThan(0);
    expect(handle.group.getObjectByName('seg:legL.thigh.jointA'), 'knee joint sphere missing').toBeTruthy();
    handle.dispose();
  });

  it('updates without throwing and re-anchors held gear while walking', () => {
    const bp = generateEntityBlueprint({ kind: 'humanoid', raceId: 'human', classId: 'fighter', seed: 'asm-2' });
    const handle = assembleEntity(bp);
    handle.update(0, 1 / 60, WALK);
    const sword = handle.group
      .getObjectByName('parts')!
      .children.find((c) => c.name === 'part:swordMain');
    expect(sword, 'sword container missing').toBeTruthy();
    const z0 = sword!.position.z;
    for (let t = 1 / 60; t < 0.45; t += 1 / 60) {
      handle.update(t, 1 / 60, WALK);
    }
    expect(Math.abs(sword!.position.z - z0)).toBeGreaterThan(0.02);
    handle.dispose();
  });

  it('lifts the body root for airborne gaits', () => {
    const bp = generateEntityBlueprint({ kind: 'creature', creatureType: 'Aberration', size: 'Medium', seed: 'asm-3' });
    const handle = assembleEntity(bp);
    handle.update(0.5, 1 / 60, { ...WALK, speed: 0.5 });
    expect(handle.group.getObjectByName('bodyRoot')!.position.y).toBeGreaterThan(0.2);
    handle.dispose();
  });

  it('dispose leaves the group empty', () => {
    const bp = generateEntityBlueprint({ kind: 'creature', creatureType: 'Beast', size: 'Medium', seed: 'asm-5', cues: ['wolf'] });
    const handle = assembleEntity(bp);
    handle.update(0.1, 1 / 60, WALK);
    handle.dispose();
    expect(handle.group.children.length).toBe(0);
  });
});

describe('entities3d debug API (vistest harness)', () => {
  beforeAll(() => {
    registerAllParts();
  });

  it('exposes the live pose and lets the debugger scrub the gait phase', () => {
    const bp = generateEntityBlueprint({ kind: 'humanoid', raceId: 'human', classId: 'fighter', seed: 'dbg-1' });
    const handle = assembleEntity(bp);
    handle.setGaitPhase(0.25);
    handle.update(1, 0, WALK);
    const zA = handle.pose.anchors.handR.pos.z;
    handle.setGaitPhase(0.75);
    handle.update(1, 0, WALK);
    const zB = handle.pose.anchors.handR.pos.z;
    expect(Math.abs(zA - zB)).toBeGreaterThan(0.05); // opposite swing extremes
    handle.dispose();
  });

  it('reports stats: segment count, triangles, render mode', () => {
    const bp = generateEntityBlueprint({ kind: 'humanoid', raceId: 'human', classId: 'fighter', seed: 'dbg-2' });
    const handle = assembleEntity(bp, { renderMode: 'solid' });
    handle.update(0.2, 1 / 60, WALK);
    const stats = handle.stats();
    expect(stats.segments).toBeGreaterThan(10);
    expect(stats.triangles).toBeGreaterThan(100);
    expect(stats.renderMode).toBe('solid');
    handle.dispose();
  });
});
