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
function membraneSail(sgn: number, s: number): BufferGeometry {
  const root: [number, number, number] = [sgn * s * 0.08, s * 0.1, 0];
  const top: [number, number, number] = [sgn * s * 0.34, s * 0.42, -s * 0.03];
  const tip: [number, number, number] = [sgn * s * 0.62, s * 0.28, -s * 0.06];
  const mid: [number, number, number] = [sgn * s * 0.5, s * 0.02, -s * 0.05];
  const low: [number, number, number] = [sgn * s * 0.2, -s * 0.08, -s * 0.02];
  // fan around the root, both winding orders so it renders two-sided
  const tris: Array<[number, number, number][]> = [
    [root, top, tip],
    [root, tip, mid],
    [root, mid, low],
  ];
  const positions: number[] = [];
  for (const [a, b, c] of tris) {
    positions.push(...a, ...b, ...c);
    positions.push(...a, ...c, ...b);
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
      // finger spars along the sail's leading edges
      const spars: Array<[[number, number, number], [number, number, number]]> = [
        [
          [sgn * s * 0.08, s * 0.1, 0],
          [sgn * s * 0.34, s * 0.42, -s * 0.03],
        ],
        [
          [sgn * s * 0.08, s * 0.1, 0],
          [sgn * s * 0.62, s * 0.28, -s * 0.06],
        ],
      ];
      for (const [a, b] of spars) {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const dz = b[2] - a[2];
        const len = Math.hypot(dx, dy, dz);
        const spar = new Mesh(new CylinderGeometry(s * 0.016, s * 0.022, len, 5), ctx.material('#3a2f3c'));
        spar.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
        // orient the cylinder (+y) along a→b
        spar.rotation.z = sgn * -Math.atan2(Math.abs(dx), dy) * (dx * sgn >= 0 ? 1 : -1);
        spar.rotation.x = Math.atan2(dz, Math.hypot(dx, dy));
        wing.add(spar);
      }
      group.add(wing);
    }
    return { object: group };
  },
};

export const WING_PARTS: PartDef[] = [wingsFeathered, wingsMembrane];
