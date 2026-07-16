/**
 * @file headParts.ts — crisp mesh components for heads: ears, horns, beak.
 *
 * Convention: buildMesh returns an object positioned relative to its anchor
 * origin (the assembler moves the container to the live anchor each frame).
 * Symmetric parts anchor to `head` and include both sides.
 */
import { ConeGeometry, CylinderGeometry, Group, Mesh, TorusGeometry } from 'three';
import type { Frame, PartDef, PartMeshCtx } from '../types';
import { headRadiusM } from '../types';

function num(ctx: PartMeshCtx, key: string, fallback: number): number {
  const v = ctx.params[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function str(ctx: PartMeshCtx, key: string, fallback: string): string {
  const v = ctx.params[key];
  return typeof v === 'string' ? v : fallback;
}

const HORN_HEX = '#3d3340';
const BONE_HEX = '#e8ddc8';

function hr(frame: Frame): number {
  return headRadiusM(frame);
}

const earsPointed: PartDef = {
  id: 'earsPointed',
  anchor: 'head',
  kind: 'mesh',
  buildMesh(ctx) {
    const r = hr(ctx.frame);
    const len = r * 1.15 * num(ctx, 'lengthScale', 1);
    const group = new Group();
    for (const sgn of [-1, 1]) {
      const ear = new Mesh(new ConeGeometry(r * 0.22, len, 6), ctx.material(ctx.palette.skinHex));
      ear.position.set(sgn * r * 0.92, r * 0.28, 0);
      ear.rotation.z = sgn * -1.15; // point out and up
      group.add(ear);
    }
    return { object: group };
  },
};

const earsLong: PartDef = {
  id: 'earsLong',
  anchor: 'head',
  kind: 'mesh',
  buildMesh(ctx) {
    const r = hr(ctx.frame);
    const len = r * 2.1;
    const group = new Group();
    for (const sgn of [-1, 1]) {
      const ear = new Mesh(new ConeGeometry(r * 0.26, len, 6), ctx.material(ctx.palette.skinHex));
      ear.position.set(sgn * r * 0.55, r * 0.9 + len * 0.3, -r * 0.1);
      ear.rotation.z = sgn * -0.22; // long rabbit ears, mostly upright
      group.add(ear);
    }
    return { object: group };
  },
};

const hornsCurved: PartDef = {
  id: 'hornsCurved',
  anchor: 'head',
  kind: 'mesh',
  buildMesh(ctx) {
    // planned creatures pass scale — frame head radius understates big heads
    const r = hr(ctx.frame) * num(ctx, 'scale', 1);
    const hex = str(ctx, 'colorHex', HORN_HEX);
    const group = new Group();
    for (const sgn of [-1, 1]) {
      const horn = new Group();
      // three tapering segments arcing backward
      const segments = [
        { r0: r * 0.2, len: r * 0.55, tiltX: -0.25 },
        { r0: r * 0.15, len: r * 0.5, tiltX: -0.85 },
        { r0: r * 0.1, len: r * 0.45, tiltX: -1.45 },
      ];
      let y = 0;
      let z = 0;
      for (const seg of segments) {
        const m = new Mesh(new CylinderGeometry(seg.r0 * 0.7, seg.r0, seg.len, 6), ctx.material(hex));
        m.position.set(0, y + seg.len * 0.5 * Math.cos(seg.tiltX), z + seg.len * 0.5 * Math.sin(-seg.tiltX) * -1);
        m.rotation.x = seg.tiltX;
        y += seg.len * Math.cos(seg.tiltX);
        z -= seg.len * Math.sin(seg.tiltX) * -1;
        horn.add(m);
      }
      horn.position.set(sgn * r * 0.5, r * 0.75, 0);
      horn.rotation.z = sgn * -0.28;
      group.add(horn);
    }
    return { object: group };
  },
};

const hornsStraight: PartDef = {
  id: 'hornsStraight',
  anchor: 'head',
  kind: 'mesh',
  buildMesh(ctx) {
    const r = hr(ctx.frame);
    const hex = str(ctx, 'colorHex', HORN_HEX);
    const group = new Group();
    for (const sgn of [-1, 1]) {
      const horn = new Mesh(new ConeGeometry(r * 0.16, r * 1.05, 6), ctx.material(hex));
      horn.position.set(sgn * r * 0.55, r * 0.95, 0.05 * r);
      horn.rotation.z = sgn * -0.35;
      group.add(horn);
    }
    return { object: group };
  },
};

const hornsRam: PartDef = {
  id: 'hornsRam',
  anchor: 'head',
  kind: 'mesh',
  buildMesh(ctx) {
    const r = hr(ctx.frame);
    const hex = str(ctx, 'colorHex', BONE_HEX);
    const group = new Group();
    for (const sgn of [-1, 1]) {
      const horn = new Mesh(
        new TorusGeometry(r * 0.55, r * 0.16, 6, 12, Math.PI * 1.5),
        ctx.material(hex),
      );
      horn.position.set(sgn * r * 0.85, r * 0.35, -r * 0.15);
      horn.rotation.y = sgn * Math.PI * 0.5;
      horn.rotation.x = 0.35;
      group.add(horn);
    }
    return { object: group };
  },
};

const beardMesh: PartDef = {
  id: 'beardMesh',
  anchor: 'jaw',
  kind: 'mesh',
  buildMesh(ctx) {
    const r = hr(ctx.frame);
    const hex = str(ctx, 'colorHex', '#6b4a2f'); // dark auburn — reads as hair, not skin
    const len = r * 1.35 * num(ctx, 'lengthScale', 1);
    const group = new Group();
    // main beard wedge hanging from the chin — pushed well forward so the
    // chest metaball can't swallow it
    const wedge = new Mesh(new ConeGeometry(r * 0.55, len, 7), ctx.material(hex));
    wedge.position.set(0, -len * 0.38, r * 0.72);
    wedge.rotation.x = Math.PI - 0.3; // point down, swept slightly forward
    group.add(wedge);
    // mustache lobes
    for (const sgn of [-1, 1]) {
      const lobe = new Mesh(new ConeGeometry(r * 0.17, r * 0.55, 5), ctx.material(hex));
      lobe.position.set(sgn * r * 0.3, r * 0.12, r * 0.85);
      lobe.rotation.z = sgn * (Math.PI / 2 + 0.5);
      group.add(lobe);
    }
    return { object: group };
  },
};

const beak: PartDef = {
  id: 'beak',
  anchor: 'head',
  kind: 'mesh',
  buildMesh(ctx) {
    const r = hr(ctx.frame);
    const hex = str(ctx, 'colorHex', '#e2a33d');
    const group = new Group();
    const upper = new Mesh(new ConeGeometry(r * 0.32, r * 1.1, 5), ctx.material(hex));
    upper.position.set(0, -r * 0.08, r * 0.9);
    upper.rotation.x = Math.PI / 2 + 0.12;
    group.add(upper);
    return { object: group };
  },
};

export const HEAD_PARTS: PartDef[] = [earsPointed, earsLong, hornsCurved, hornsStraight, hornsRam, beardMesh, beak];
