/**
 * @file organicParts.ts — body-feature mesh parts (body v2).
 *
 * These were metaball field parts when bodies were blobs; with segmented
 * bodies they are ordinary rigid meshes at their anchors: snouts, muzzles,
 * tusked jaws, brows, bellies, crests, and the plain beard. Ids are preserved
 * from the field era so every profile and kit keeps working unchanged.
 */
import { BoxGeometry, ConeGeometry, Group, Mesh, SphereGeometry } from 'three';
import type { Frame, PartDef, PartMeshCtx } from '../types';
import { headRadiusM } from '../types';

const BONE_HEX = '#e8ddc8';

function num(ctx: PartMeshCtx, key: string, fallback: number): number {
  const v = ctx.params[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function hr(frame: Frame): number {
  return headRadiusM(frame);
}

const snout: PartDef = {
  id: 'snout',
  anchor: 'jaw',
  kind: 'mesh',
  buildMesh(ctx) {
    const r = hr(ctx.frame);
    const len = r * 1.6 * num(ctx, 'lengthScale', 1);
    // droop > 0 curls the snout downward — a trunk
    const droop = num(ctx, 'droop', 0);
    const group = new Group();
    const base = new Mesh(new ConeGeometry(r * 0.5, len * 0.62, 8), ctx.material(ctx.palette.skinHex));
    base.position.set(0, r * 0.05 - len * droop * 0.12, r * 0.35 + len * 0.3);
    base.rotation.x = Math.PI / 2 + 0.15 + droop * 0.5;
    group.add(base);
    const tip = new Mesh(new ConeGeometry(r * 0.32, len * 0.5, 8), ctx.material(ctx.palette.skinHex));
    tip.position.set(0, r * 0.02 - len * droop * 0.5, r * 0.35 + len * 0.62);
    tip.rotation.x = Math.PI / 2 + 0.1 + droop * 1.35;
    group.add(tip);
    return { object: group };
  },
};

const muzzleShort: PartDef = {
  id: 'muzzleShort',
  anchor: 'jaw',
  kind: 'mesh',
  buildMesh(ctx) {
    const r = hr(ctx.frame);
    const group = new Group();
    const muzzle = new Mesh(new SphereGeometry(r * 0.42, 10, 8), ctx.material(ctx.palette.skinHex));
    muzzle.scale.set(1, 0.8, 1.15);
    muzzle.position.set(0, -r * 0.05, r * 0.62);
    group.add(muzzle);
    return { object: group };
  },
};

const tuskJaw: PartDef = {
  id: 'tuskJaw',
  anchor: 'jaw',
  kind: 'mesh',
  buildMesh(ctx) {
    const r = hr(ctx.frame);
    const group = new Group();
    const jaw = new Mesh(new BoxGeometry(r * 0.95, r * 0.42, r * 0.6), ctx.material(ctx.palette.skinHex));
    jaw.position.set(0, -r * 0.28, r * 0.42);
    group.add(jaw);
    for (const sgn of [-1, 1]) {
      const tusk = new Mesh(new ConeGeometry(r * 0.11, r * 0.4, 6), ctx.material(BONE_HEX));
      tusk.position.set(sgn * r * 0.34, -r * 0.02, r * 0.6);
      tusk.rotation.z = sgn * -0.18;
      group.add(tusk);
    }
    return { object: group };
  },
};

const brow: PartDef = {
  id: 'brow',
  anchor: 'head',
  kind: 'mesh',
  buildMesh(ctx) {
    const r = hr(ctx.frame);
    const group = new Group();
    for (const sgn of [-1, 1]) {
      const ridge = new Mesh(new BoxGeometry(r * 0.5, r * 0.16, r * 0.22), ctx.material(ctx.palette.skinHex));
      ridge.position.set(sgn * r * 0.42, r * 0.35, r * 0.62);
      ridge.rotation.z = sgn * -0.15;
      group.add(ridge);
    }
    return { object: group };
  },
};

const belly: PartDef = {
  id: 'belly',
  anchor: 'hips',
  kind: 'mesh',
  buildMesh(ctx) {
    const r = hr(ctx.frame);
    const size = r * 1.0 * ctx.frame.bulk * num(ctx, 'size', 1);
    const group = new Group();
    const paunch = new Mesh(new SphereGeometry(size, 12, 10), ctx.material(ctx.palette.skinHex));
    paunch.scale.set(1, 0.9, 0.85);
    paunch.position.set(0, r * 0.3, r * 0.35);
    group.add(paunch);
    return { object: group };
  },
};

const crest: PartDef = {
  id: 'crest',
  anchor: 'crown',
  kind: 'mesh',
  buildMesh(ctx) {
    const r = hr(ctx.frame);
    const group = new Group();
    for (let i = 0; i < 3; i++) {
      const u = i / 2;
      const fin = new Mesh(new ConeGeometry(r * 0.16, r * (0.55 - u * 0.18), 4), ctx.material(ctx.palette.skinHex));
      fin.scale.x = 0.35; // flatten into a fin
      fin.position.set(0, r * (0.28 - u * 0.4), -u * r * 0.85);
      fin.rotation.x = -0.35 - u * 0.4;
      group.add(fin);
    }
    return { object: group };
  },
};

/** The plain (non-dwarf) beard: a short hair-colored wedge under the jaw. */
const beardField: PartDef = {
  id: 'beardField',
  anchor: 'jaw',
  kind: 'mesh',
  buildMesh(ctx) {
    const r = hr(ctx.frame);
    const len = r * 1.0 * num(ctx, 'lengthScale', 1);
    const group = new Group();
    const wedge = new Mesh(new ConeGeometry(r * 0.45, len, 7), ctx.material('#5d4630'));
    wedge.position.set(0, -len * 0.4, r * 0.5);
    wedge.rotation.x = Math.PI - 0.28;
    group.add(wedge);
    return { object: group };
  },
};

/** A jagged cluster of crystal shards jutting from the back — the stylized
 * answer to "crystalline/faceted" creature descriptions. Accent-colored.
 * Params: scale (overall size), jaggedness (0–1 rotation chaos), count (3–9). */
const crystalSpikes: PartDef = {
  id: 'crystalSpikes',
  anchor: 'back',
  kind: 'mesh',
  buildMesh(ctx) {
    const r = hr(ctx.frame) * num(ctx, 'scale', 1);
    const jag = num(ctx, 'jaggedness', 0.5);
    const count = Math.max(3, Math.min(9, Math.round(num(ctx, 'count', 5))));
    const group = new Group();
    for (let i = 0; i < count; i++) {
      const u = i / Math.max(1, count - 1);
      // deterministic pseudo-jitter from the index — no RNG in parts
      const wob = Math.sin(i * 12.9898) * 0.5;
      const h = r * (0.9 + Math.sin(i * 4.7) * 0.35) * (1 + jag * 0.4);
      const shard = new Mesh(new ConeGeometry(r * 0.22, h, 5), ctx.material(ctx.palette.accentHex));
      shard.position.set((u - 0.5) * r * 1.6, h * 0.32, wob * r * 0.5);
      shard.rotation.set(wob * jag * 0.9, i * 1.3, (u - 0.5) * jag * 1.2);
      group.add(shard);
    }
    return { object: group };
  },
};

export const ORGANIC_PARTS: PartDef[] = [snout, muzzleShort, tuskJaw, brow, belly, crest, beardField, crystalSpikes];
