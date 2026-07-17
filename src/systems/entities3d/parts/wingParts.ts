/**
 * @file wingParts.ts — wing mesh parts.
 *
 * Convention: the returned object contains child groups named `wingL` and
 * `wingR`; the assembler rotates those by the gait's flap angle each frame.
 *
 * Feathered wings = a fan of overlapping rounded feather boards, longest at
 * the tip. Membrane wings = a triangular sail hung between finger spars.
 * Both taper and sweep back so they read as wings, not fences.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  ShapeUtils,
  Vector2,
  Vector3,
} from 'three';
import type { Frame, PartDef, PartMeshCtx } from '../types';
import { FT_TO_M, heightM } from '../types';

function span(frame: Frame): number {
  // Wingspan rivals body height — wings must read at a glance, even on quads
  // whose heightFt is only shoulder height.
  return Math.max(heightM(frame) * 0.95, frame.shoulderWidthFt * FT_TO_M * 1.5);
}

const wingsFeathered: PartDef = {
  id: 'wingsFeathered',
  anchor: 'back',
  kind: 'mesh',
  buildMesh(ctx: PartMeshCtx) {
    const s = span(ctx.frame);
    const group = new Group();
    for (const [name, sgn] of [
      ['wingL', -1],
      ['wingR', 1],
    ] as const) {
      const wing = new Group();
      wing.name = name;
      const feathers = 5;
      for (let i = 0; i < feathers; i++) {
        const u = (i + 1) / feathers;
        // rounded feather board: a squashed capsule, longer toward the tip
        const len = s * (0.3 + u * 0.34);
        const rad = s * (0.055 - u * 0.018);
        const feather = new Mesh(new CapsuleGeometry(rad, len, 3, 7), ctx.material('#e8e2d4'));
        feather.scale.z = 0.35; // flatten into a vane
        // fan out from the shoulder: root near anchor, tips sweep out and back
        feather.position.set(sgn * (s * 0.16 + u * s * 0.36), s * 0.16 - u * s * 0.1, -u * s * 0.05);
        feather.rotation.z = sgn * (-0.5 - u * 0.75);
        wing.add(feather);
      }
      group.add(wing);
    }
    return { object: group };
  },
};

/** One membrane sail: a triangle fan between a wing-root and finger tips. */
/**
 * Dragon Forge technique: a hand-authored rim polygon (leading edge up, then
 * a scalloped trailing edge whose rim points sag between finger tips) fed to
 * ShapeUtils.triangulateShape — one flat membrane whose curvature is baked
 * into the points. Finger positions are exported so spars can fan to them.
 */
export function membraneRim(sgn: number, s: number, sag = 0.14): Array<[number, number, number]> {
  const drop = s * sag;
  return [
    [sgn * s * 0.06, s * 0.08, 0], // shoulder root
    [sgn * s * 0.3, s * 0.46, -s * 0.02], // wrist crest
    [sgn * s * 0.72, s * 0.34, -s * 0.05], // finger 1 tip (leading)
    [sgn * s * 0.66, s * 0.1 - drop * 0.4, -s * 0.05], // scallop
    [sgn * s * 0.56, -s * 0.04, -s * 0.045], // finger 2 tip
    [sgn * s * 0.42, -s * 0.1 - drop * 0.6, -s * 0.04], // scallop (deep sag)
    [sgn * s * 0.3, -s * 0.12, -s * 0.03], // finger 3 tip
    [sgn * s * 0.16, -s * 0.12 - drop, -s * 0.015], // trailing scallop
    [sgn * s * 0.05, -s * 0.05, 0], // body trailing root
  ];
}

function membraneSail(sgn: number, s: number, sag = 0.14): BufferGeometry {
  const rim = membraneRim(sgn, s, sag);
  const contour = rim.map(([x, y]) => new Vector2(x * sgn, y)); // mirror-safe planar winding
  const tris = ShapeUtils.triangulateShape(contour, []);
  const positions: number[] = [];
  for (const [a, b, c] of tris) {
    positions.push(...rim[a], ...rim[b], ...rim[c]);
    positions.push(...rim[a], ...rim[c], ...rim[b]); // both windings = two-sided
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geo.computeVertexNormals();
  return geo;
}

const wingsMembrane: PartDef = {
  id: 'wingsMembrane',
  anchor: 'back',
  kind: 'mesh',
  buildMesh(ctx: PartMeshCtx) {
    // planned creatures pass scale (frame height understates a long dragon)
    const s = span(ctx.frame) * (Number(ctx.params.scale) || 1);
    const group = new Group();
    for (const [name, sgn] of [
      ['wingL', -1],
      ['wingR', 1],
    ] as const) {
      const wing = new Group();
      wing.name = name;
      const sail = new Mesh(membraneSail(sgn, s), ctx.material('#5a4458'));
      wing.add(sail);
      // bone structure: arm spar to the wrist crest, then fingers fanning to
      // the rim's finger tips (Dragon Forge HO/fm)
      const rim = membraneRim(sgn, s);
      const wrist = rim[1];
      const spars: Array<[[number, number, number], [number, number, number]]> = [
        [rim[0], wrist],
        [wrist, rim[2]],
        [wrist, rim[4]],
        [wrist, rim[6]],
      ];
      const SPAR_UP = new Vector3(0, 1, 0);
      for (const [a, b] of spars) {
        const dir = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const len = Math.max(dir.length(), 1e-4);
        const spar = new Mesh(new CylinderGeometry(s * 0.014, s * 0.022, len, 5), ctx.material('#3a2f3c'));
        spar.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
        spar.quaternion.setFromUnitVectors(SPAR_UP, dir.normalize());
        wing.add(spar);
      }
      group.add(wing);
    }
    return { object: group };
  },
};

export const WING_PARTS: PartDef[] = [wingsFeathered, wingsMembrane];
