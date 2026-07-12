/**
 * @file parts.test.ts — the modular part catalog builds and registers cleanly.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { MeshBasicMaterial, Object3D, Mesh } from 'three';
import { registerAllParts } from '../parts';
import { allParts, getPart } from '../registry';
import type { BallSink, Frame, Palette, PartAnchors, PartPhase } from '../types';
import { ANCHORS } from '../types';

const FRAME: Frame = {
  heightFt: 5.5,
  bulk: 1,
  headScale: 1,
  limbLengthFt: 2.6,
  armLengthFt: 2.3,
  shoulderWidthFt: 1.4,
  stanceWidthFt: 0.8,
};

const PALETTE: Palette = {
  skinHex: '#c68642',
  accentHex: '#4a5e6e',
  secondaryHex: '#9a8a72',
  eyeHex: '#1a1a22',
};

const PHASE: PartPhase = { t: 0.25, gaitPhase: 0.25, flap: 0.2 };

/** Rough humanoid rest anchors (meters) — enough for parts to place themselves. */
const TEST_ANCHORS: PartAnchors = Object.fromEntries(
  ANCHORS.map((a) => [
    a,
    a === 'head' || a === 'crown' || a.startsWith('brow') || a.startsWith('ear') || a === 'jaw'
      ? { x: 0, y: 1.5, z: 0.05 }
      : a.startsWith('hand')
        ? { x: a.endsWith('L') ? -0.35 : 0.35, y: 0.75, z: 0.05 }
        : { x: 0, y: 0.95, z: a === 'back' || a === 'tailRoot' ? -0.15 : 0.08 },
  ]),
) as PartAnchors;

const EXPECTED_PART_IDS = [
  // field
  'snout',
  'muzzleShort',
  'tuskJaw',
  'brow',
  'belly',
  'tailThin',
  'tailThick',
  'beardField',
  'tentacles',
  'antennae',
  'crest',
  // head mesh
  'earsPointed',
  'earsLong',
  'hornsCurved',
  'hornsStraight',
  'hornsRam',
  'beak',
  // weapons
  'swordMain',
  'axeMain',
  'maceMain',
  'daggerMain',
  'staffMain',
  'bowMain',
  'orbFocus',
  'luteBack',
  // armor / worn
  'shieldOff',
  'daggerOff',
  'helmet',
  'hoodUp',
  'hatWide',
  'capeCloak',
  'pauldrons',
  'robeSkirt',
  'beltPouch',
  'quiverBack',
  // wings
  'wingsFeathered',
  'wingsMembrane',
];

class RecordingSink implements BallSink {
  balls: Array<{ x: number; y: number; z: number; r: number }> = [];
  ball(x: number, y: number, z: number, r: number): void {
    this.balls.push({ x, y, z, r });
  }
}

describe('entities3d part catalog', () => {
  beforeAll(() => {
    registerAllParts();
  });

  it('is idempotent', () => {
    expect(() => registerAllParts()).not.toThrow();
  });

  it('registers every cataloged part id', () => {
    const ids = new Set(allParts().map((p) => p.id));
    for (const id of EXPECTED_PART_IDS) {
      expect(ids.has(id), `missing part "${id}"`).toBe(true);
    }
  });

  it('every field part emits at least one ball with finite coordinates and positive radius', () => {
    for (const def of allParts().filter((p) => p.kind === 'field')) {
      const sink = new RecordingSink();
      def.buildField!(sink, FRAME, {}, PHASE, TEST_ANCHORS);
      expect(sink.balls.length, `field part "${def.id}" emitted no balls`).toBeGreaterThan(0);
      for (const b of sink.balls) {
        expect(Number.isFinite(b.x + b.y + b.z + b.r), `part "${def.id}" emitted NaN`).toBe(true);
        expect(b.r, `part "${def.id}" emitted non-positive radius`).toBeGreaterThan(0);
      }
    }
  });

  it('every mesh part builds an Object3D containing at least one mesh', () => {
    for (const def of allParts().filter((p) => p.kind === 'mesh')) {
      const { object } = def.buildMesh!({
        frame: FRAME,
        palette: PALETTE,
        params: {},
        material: (hex) => new MeshBasicMaterial({ color: hex }),
      });
      expect(object).toBeInstanceOf(Object3D);
      let meshCount = 0;
      object.traverse((o) => {
        if ((o as Mesh).isMesh) meshCount += 1;
      });
      expect(meshCount, `mesh part "${def.id}" contains no meshes`).toBeGreaterThan(0);
    }
  });

  it('wing parts expose wingL/wingR groups for flap animation', () => {
    for (const id of ['wingsFeathered', 'wingsMembrane']) {
      const { object } = getPart(id).buildMesh!({
        frame: FRAME,
        palette: PALETTE,
        params: {},
        material: (hex) => new MeshBasicMaterial({ color: hex }),
      });
      expect(object.getObjectByName('wingL'), `${id} missing wingL`).toBeTruthy();
      expect(object.getObjectByName('wingR'), `${id} missing wingR`).toBeTruthy();
    }
  });
});
