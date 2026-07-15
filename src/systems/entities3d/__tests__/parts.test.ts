/**
 * @file parts.test.ts — the modular part catalog builds and registers cleanly.
 * Body v2: parts are `mesh` (rigid, anchored) or `chain` (animated segment
 * chains); the metaball `field` kind is gone.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { MeshBasicMaterial, Object3D, Mesh } from 'three';
import { registerAllParts } from '../parts';
import { allParts, getPart } from '../registry';
import type { Frame, Palette, PartAnchors, PartPhase } from '../types';
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
  // chains (animated)
  'tailThin',
  'tailThick',
  'tentacles',
  'antennae',
  // organic meshes (were field parts)
  'snout',
  'muzzleShort',
  'tuskJaw',
  'brow',
  'belly',
  'crest',
  'beardField',
  // head mesh
  'earsPointed',
  'earsLong',
  'hornsCurved',
  'hornsStraight',
  'hornsRam',
  'beardMesh',
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

  it('has no field parts left anywhere', () => {
    for (const def of allParts()) {
      expect(def.kind === 'mesh' || def.kind === 'chain', `part "${def.id}" has unknown kind "${def.kind}"`).toBe(true);
    }
  });

  it('every chain part returns finite, connected, stable-id segments', () => {
    for (const def of allParts().filter((p) => p.kind === 'chain')) {
      const a = def.buildChain!(FRAME, {}, PHASE, TEST_ANCHORS);
      expect(a.length, `chain part "${def.id}" returned no segments`).toBeGreaterThan(0);
      for (const s of a) {
        expect(Number.isFinite(s.ax + s.ay + s.az + s.bx + s.by + s.bz), `"${def.id}" segment ${s.id} not finite`).toBe(true);
        expect(Math.min(s.r0, s.r1), `"${def.id}" segment ${s.id} non-positive radius`).toBeGreaterThan(0);
      }
      const b = def.buildChain!(FRAME, {}, { ...PHASE, t: 1.7 }, TEST_ANCHORS);
      expect(a.map((s) => s.id), `chain "${def.id}" ids unstable across frames`).toEqual(b.map((s) => s.id));
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
