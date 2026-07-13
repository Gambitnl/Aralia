/**
 * @file assemble.test.ts — blueprint → live three.js entity (headless: object
 * graph only, no renderer).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { Vector3, Mesh } from 'three';
import { assembleEntity } from '../three/assembleEntity';
import { generateEntityBlueprint } from '../generateEntityBlueprint';
import { registerAllParts } from '../parts';

const WALK = { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 1.2 };

describe('entities3d assembler', () => {
  beforeAll(() => {
    registerAllParts();
  });

  it('builds a group with body, eyes, shadow, and one container per mesh part', () => {
    const bp = generateEntityBlueprint({
      kind: 'humanoid',
      raceId: 'infernal_tiefling',
      classId: 'wizard',
      seed: 'asm-1',
    });
    const meshPartCount = bp.parts.filter((p) =>
      ['hornsCurved', 'earsPointed', 'staffMain', 'hatWide', 'robeSkirt', 'beltPouch'].includes(p.partId),
    ).length;
    expect(meshPartCount).toBeGreaterThan(2); // sanity: tiefling wizard carries mesh parts
    const handle = assembleEntity(bp);
    expect(handle.blueprint).toBe(bp);
    const partContainers = handle.group.getObjectByName('parts');
    expect(partContainers, 'parts container missing').toBeTruthy();
    const meshContainers = partContainers!.children.length;
    expect(meshContainers).toBeGreaterThanOrEqual(meshPartCount);
    expect(handle.group.getObjectByName('metaballBody'), 'metaball body missing').toBeTruthy();
    expect(handle.group.getObjectByName('eyeL'), 'left eye missing').toBeTruthy();
    expect(handle.group.getObjectByName('eyeR'), 'right eye missing').toBeTruthy();
    expect(handle.group.getObjectByName('blobShadow'), 'shadow missing').toBeTruthy();
    handle.dispose();
  });

  it('wireframe (default) draws no ink outlines', () => {
    const bp = generateEntityBlueprint({ kind: 'humanoid', raceId: 'human', classId: 'fighter', seed: 'asm-wire' });
    const handle = assembleEntity(bp); // default render mode is wireframe
    expect(handle.group.getObjectByName('metaballOutline'), 'wireframe should have no body outline').toBeFalsy();
    let outlined = 0;
    handle.group.traverse((o) => {
      if (o.name === 'partOutline') outlined += 1;
    });
    expect(outlined, 'wireframe should have no part outlines').toBe(0);
    handle.dispose();
  });

  it('solid mode adds the body inverse-hull outline and part ink outlines', () => {
    const bp = generateEntityBlueprint({ kind: 'humanoid', raceId: 'human', classId: 'fighter', seed: 'asm-solid' });
    const handle = assembleEntity(bp, { renderMode: 'solid' });
    expect(handle.group.getObjectByName('metaballOutline'), 'solid body outline missing').toBeTruthy();
    let outlined = 0;
    handle.group.traverse((o) => {
      if (o.name === 'partOutline' && (o as Mesh).isMesh) outlined += 1;
    });
    expect(outlined).toBeGreaterThan(0);
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
