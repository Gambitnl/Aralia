/**
 * @file authorRig.test.ts — the pack's own author armature as the drive body
 * (board agora-2560, Remy's question-sheet pick 2026-08-28).
 *
 * Two things are gated here:
 *  1. the ADAPTER — tools/entities3d/authorBoneRemap.mjs must agree with the
 *     39-bone contract in skeletonBuilder.ts, and must fold every author joint
 *     that has no contract slot onto a mapped ancestor;
 *  2. the ARTIFACT — the built `<id>.authorrig.glb` must be exactly our
 *     contract skeleton (names, parenting, root at the origin, normalized
 *     height) and must carry the AUTHOR's painted weights, measured by the
 *     belly-ownership rule that our bone-heat rigs fail: the neck must not
 *     own the ribcage.
 *
 * The GLB is parsed with @gltf-transform (already a dependency of the rig
 * tooling) rather than three's GLTFLoader — no DOM, no fetch, and the file on
 * disk IS what the lab serves.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { BIPED_BONE_NAMES, BIPED_BONE_PARENT } from '../three/skeletonBuilder';
import { AUTHOR_BONE_REMAP, CONTRACT_BONES, CONTRACT_PARENT, authorBoneKey, contractNameFor, foldAuthorSkeleton } from '../../../../tools/entities3d/authorBoneRemap.mjs';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const BASE_DIR = path.join(ROOT, 'public', 'references', 'basemesh');
const IDS = ['lowpoly-female', 'lowpoly-male'] as const;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
// top-level await: gltf-transform's reader is async, and describe.each needs
// the parsed document synchronously when it builds the suites
const DOCS = new Map(
  await Promise.all(
    IDS.map(async (id) => [id, await io.readBinary(new Uint8Array(readFileSync(path.join(BASE_DIR, `${id}.authorrig.glb`))))] as const),
  ),
);

describe('the author-armature adapter', () => {
  it('mirrors the 39-bone contract exactly', () => {
    expect(CONTRACT_BONES).toEqual([...BIPED_BONE_NAMES]);
    expect(CONTRACT_PARENT).toEqual(BIPED_BONE_PARENT);
  });

  it('claims every contract bone exactly once', () => {
    const claimed = Object.values(AUTHOR_BONE_REMAP);
    expect(new Set(claimed).size).toBe(claimed.length);
    expect([...claimed].sort()).toEqual([...BIPED_BONE_NAMES].sort());
  });

  it('strips the pack exporter\'s joint suffix, including the male armature\'s odd numbering', () => {
    expect(authorBoneKey('PELVIS CENTRAL_02')).toBe('PELVIS CENTRAL');
    expect(authorBoneKey('HAND_MAIN.R_010')).toBe('HAND_MAIN.R');
    expect(authorBoneKey('HAND MIDLE.L_00')).toBe('HAND MIDLE.L');
    expect(authorBoneKey('_rootJoint')).toBe('_rootJoint');
  });

  it('accepts the sanitized spelling three\'s GLTFLoader produces', () => {
    // the loader drops spaces and dots: `HAND_MAIN.R_010` -> `HAND_MAINR_010`
    expect(contractNameFor('HAND_MAINR_010')).toBe('handR');
    expect(contractNameFor('PELVISCENTRAL_02')).toBe('pelvis');
    expect(contractNameFor('BREASTL_032')).toBeNull();
  });

  it('folds an unmapped joint onto its nearest mapped ancestor', () => {
    // BELLY -> chest, and CHEST CENTRAL (no slot) folds up into it
    const names = ['_rootJoint', 'PELVIS CENTRAL_02', 'BELLY_03', 'CHEST CENTRAL_04', 'BREAST.L_032'];
    const parents = [-1, 0, 1, 2, 3];
    const stub = [...names, ...Object.keys(AUTHOR_BONE_REMAP).filter((k) => !names.some((n) => authorBoneKey(n) === k))];
    const stubParents = stub.map((_, i) => (i < parents.length ? parents[i] : 0));
    const { target, mapped } = foldAuthorSkeleton(stub, stubParents);
    expect(mapped[2]).toBe('chest');
    expect(mapped[3]).toBeNull();
    expect(target[3]).toBe('chest');
    expect(target[4]).toBe('chest');
  });

  it('refuses a skeleton that leaves a contract bone unclaimed', () => {
    expect(() => foldAuthorSkeleton(['_rootJoint'], [-1])).toThrow(/no author joint maps to/);
  });
});

describe.each(IDS)('%s.authorrig.glb', (id) => {
  const doc = DOCS.get(id)!;
  const root = doc.getRoot();
  const skin = root.listSkins()[0];
  const joints = skin.listJoints();
  const node = root.listNodes().find((n) => n.getMesh() && n.getSkin())!;
  const prim = node.getMesh()!.listPrimitives()[0];

  it('is our 39-bone contract, in order, contract-parented', () => {
    expect(joints.map((j) => j.getName())).toEqual([...BIPED_BONE_NAMES]);
    for (const j of joints) {
      const parent = j.getParentNode();
      expect(parent?.getName() ?? null, j.getName()).toBe(BIPED_BONE_PARENT[j.getName() as keyof typeof BIPED_BONE_PARENT]);
    }
  });

  it('binds the root at the origin — createSkinnedFromRig throws otherwise', () => {
    const rootBone = joints[0];
    expect(rootBone.getName()).toBe('root');
    expect(Math.hypot(...rootBone.getTranslation())).toBeLessThan(1e-6);
  });

  it('is normalized like the rest of the base meshes: height 1, feet on y = 0, centered', () => {
    const pos = prim.getAttribute('POSITION')!;
    const lo = pos.getMin([]);
    const hi = pos.getMax([]);
    expect(hi[1] - lo[1]).toBeCloseTo(1, 5);
    expect(lo[1]).toBeCloseTo(0, 5);
    expect((lo[0] + hi[0]) / 2).toBeCloseTo(0, 5);
    expect((lo[2] + hi[2]) / 2).toBeCloseTo(0, 5);
  });

  it('keeps normalized skin weights that address only real joints', () => {
    const ji = prim.getAttribute('JOINTS_0')!;
    const jw = prim.getAttribute('WEIGHTS_0')!;
    expect(ji.getCount()).toBe(prim.getAttribute('POSITION')!.getCount());
    const j4: number[] = [];
    const w4: number[] = [];
    let worst = 0;
    for (let v = 0; v < ji.getCount(); v++) {
      ji.getElement(v, j4);
      jw.getElement(v, w4);
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        expect(j4[k]).toBeLessThan(joints.length);
        expect(w4[k]).toBeGreaterThanOrEqual(0);
        sum += w4[k];
      }
      worst = Math.max(worst, Math.abs(sum - 1));
    }
    expect(worst).toBeLessThan(1e-5);
  });

  it('records where the author armature went, so the folded joints are recoverable', () => {
    const extras = root.getExtras() as { authorArmature?: string; authorJoints?: string[]; remap?: Record<string, string> };
    expect(extras.authorArmature).toMatch(/^BASEMESH ARMATURE (FEMALE|MALE)$/);
    expect(extras.authorJoints!.length).toBeGreaterThanOrEqual(68);
    expect(Object.keys(extras.remap!).length).toBe(extras.authorJoints!.length);
    // every author joint either IS a contract bone or names the one it folded into
    for (const v of Object.values(extras.remap!)) {
      const name = v.startsWith('fold:') ? v.slice(5) : v;
      expect(BIPED_BONE_NAMES).toContain(name);
    }
  });

  /**
   * THE QUALITY BAR (goal doc, 2026-08-23). Dominant bone per height band on
   * the midline torso slab. Our bone-heat rigs put the NECK in charge of the
   * ribcage (measured 0.64-0.76 h on lowpoly-male) and gave the pelvis almost
   * nothing. The author's painted weights are the fix Remy bought.
   */
  it('gives the torso to the spine, not the neck', () => {
    const pos = prim.getAttribute('POSITION')!;
    const ji = prim.getAttribute('JOINTS_0')!;
    const jw = prim.getAttribute('WEIGHTS_0')!;
    const names = joints.map((j) => j.getName());
    const p3: number[] = [];
    const j4: number[] = [];
    const w4: number[] = [];
    const bands = new Map<number, Map<string, number>>();
    for (let v = 0; v < pos.getCount(); v++) {
      pos.getElement(v, p3);
      if (Math.abs(p3[0]) > 0.06) continue; // midline slab (height is 1)
      const h = p3[1];
      if (h < 0.4 || h > 0.95) continue;
      const b = Math.floor(h / 0.02);
      let row = bands.get(b);
      if (!row) bands.set(b, (row = new Map()));
      ji.getElement(v, j4);
      jw.getElement(v, w4);
      for (let k = 0; k < 4; k++) if (w4[k] > 0) row.set(names[j4[k]], (row.get(names[j4[k]]) ?? 0) + w4[k]);
    }
    const owner = (h: number) => {
      const row = bands.get(Math.floor(h / 0.02));
      expect(row, `no torso vertices in the band at ${h}`).toBeDefined();
      return [...row!.entries()].sort((a, b) => b[1] - a[1])[0][0];
    };
    // the ribcage belongs to the spine
    for (const h of [0.65, 0.7, 0.75]) expect(owner(h), `band ${h}`).toBe('chest');
    // the belly belongs to the pelvis, not the chest
    expect(owner(0.55)).toBe('pelvis');
    // and the neck owns nothing below the collar line
    for (const h of [0.55, 0.65, 0.7, 0.75]) expect(owner(h), `neck must not own ${h}`).not.toBe('neck');
  });
});
