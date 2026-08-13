/**
 * @file headParts.ts — crisp mesh components for heads: ears, horns, beak.
 *
 * Convention: buildMesh returns an object positioned relative to its anchor
 * origin (the assembler moves the container to the live anchor each frame).
 * Symmetric parts anchor to `head` and include both sides.
 */
import { BufferGeometry, ConeGeometry, Float32BufferAttribute, Group, Mesh, TorusGeometry, Vector3 } from 'three';
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
      // round 8 (humanoid-anatomy): rooted in the one-surface skull — the
      // loft's temple half-width is ~0.57 hr (the old ball was 0.9), so the
      // 0.92 mount left both ears floating in air. The cone's base now sits
      // deep inside the temple and the point emerges out-and-up past it.
      ear.position.set(sgn * r * 0.62, r * 0.22, 0);
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
    const hex = str(ctx, 'colorHex', HORN_HEX);
    // Placement keys off the REAL skull radius: compilePlan injects
    // anchorRadM (the driver's head-socket radius) for planned bodies whose
    // sockets outgrow the frame head. Horn bases must start INSIDE the skull
    // surface — round 1 fixed the dragon's horns floating detached because
    // both size and placement scaled with the oversized `scale` param.
    const R = num(ctx, 'anchorRadM', hr(ctx.frame));
    // round 2 (creature-anatomy): horn SIZE also keys off the real skull when
    // a socket radius is present — frame-head sizing needed a 2.6x scale hack
    // on the dragon, which grew horns into a second pair of black limbs. A
    // horn is horn-sized against its skull: total arc ~0.95 skull radii.
    const hasSocket = typeof ctx.params.anchorRadM === 'number';
    const r = (hasSocket ? R * 0.62 : hr(ctx.frame)) * num(ctx, 'scale', 1);
    const group = new Group();
    // round 6 (creature-anatomy): ONE continuous swept loft per horn — the
    // round-2 stack of three tilted cylinders rendered as a black scribble /
    // hair tuft at sheet distance. The loft rises from a buried base, arcs
    // up, and sweeps back to a point: two clean drake horns in silhouette.
    // Stations are fractions of the horn size `r` (x = outward flare).
    const stations: Array<{ p: [number, number, number]; rad: number }> = [
      { p: [0, -0.22, 0.06], rad: 0.24 }, // base, buried in the skull
      { p: [0.02, 0.3, 0.0], rad: 0.19 },
      { p: [0.07, 0.72, -0.22], rad: 0.14 },
      { p: [0.12, 0.95, -0.62], rad: 0.085 },
      { p: [0.16, 0.98, -1.05], rad: 0.04 },
      { p: [0.18, 0.92, -1.3], rad: 0.001 }, // tip point
    ];
    for (const sgn of [-1, 1]) {
      const horn = new Mesh(sweptHorn(stations, sgn, r), ctx.material(hex));
      // mount well inside the unit skull sphere, on the cranium table behind
      // the brow line
      horn.position.set(sgn * R * 0.45, R * 0.5, -R * 0.15);
      horn.rotation.z = sgn * -0.22;
      // round 7 (creature-anatomy): no ink shell — the inverse hull past the
      // near-zero tip station rendered as detached scribble-whisker arcs
      horn.userData.noOutline = true;
      group.add(horn);
    }
    return { object: group };
  },
};

/**
 * Sweep a closed tapering horn through stations (scaled by `size`, x mirrored
 * by `sgn`), flat-shaded. Signed-volume winding guard: flip if inside-out.
 */
function sweptHorn(stations: Array<{ p: [number, number, number]; rad: number }>, sgn: number, size: number): BufferGeometry {
  const RADIAL = 7;
  const positions: number[] = [];
  const index: number[] = [];
  const tangent = new Vector3();
  const side = new Vector3();
  const up = new Vector3();
  const WORLD_X = new Vector3(1, 0, 0);
  for (const [i, s] of stations.entries()) {
    const prev = stations[Math.max(0, i - 1)].p;
    const next = stations[Math.min(stations.length - 1, i + 1)].p;
    tangent.set(next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]).normalize();
    side.crossVectors(tangent, WORLD_X);
    if (side.lengthSq() < 1e-6) side.set(0, 0, 1);
    side.normalize();
    up.crossVectors(side, tangent);
    for (let j = 0; j < RADIAL; j++) {
      const a = (j / RADIAL) * Math.PI * 2;
      const co = Math.cos(a) * s.rad;
      const si = Math.sin(a) * s.rad;
      // mirror only the spine point across x — the ring basis stays as-is
      // (the horn is nearly planar in yz, so the basis mirror is negligible)
      positions.push(
        (s.p[0] * sgn + side.x * co + up.x * si) * size,
        (s.p[1] + side.y * co + up.y * si) * size,
        (s.p[2] + side.z * co + up.z * si) * size,
      );
    }
  }
  for (let i = 0; i < stations.length - 1; i++) {
    const a = i * RADIAL;
    const b = (i + 1) * RADIAL;
    for (let j = 0; j < RADIAL; j++) {
      const j1 = (j + 1) % RADIAL;
      index.push(a + j, b + j, b + j1);
      index.push(a + j, b + j1, a + j1);
    }
  }
  // base cap
  const base = stations[0];
  const baseC = positions.length / 3;
  positions.push(base.p[0] * sgn * size, base.p[1] * size, base.p[2] * size);
  for (let j = 0; j < RADIAL; j++) {
    const j1 = (j + 1) % RADIAL;
    index.push(baseC, j1, j);
  }
  // signed-volume winding guard (the Emberwing inside-out lesson)
  let vol = 0;
  for (let e = 0; e < index.length; e += 3) {
    const a = index[e] * 3;
    const b = index[e + 1] * 3;
    const c = index[e + 2] * 3;
    vol +=
      positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1]) +
      positions[a + 1] * (positions[b + 2] * positions[c] - positions[b] * positions[c + 2]) +
      positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c]);
  }
  if (vol < 0) {
    for (let e = 0; e < index.length; e += 3) {
      const t = index[e + 1];
      index[e + 1] = index[e + 2];
      index[e + 2] = t;
    }
  }
  const indexed = new BufferGeometry();
  indexed.setAttribute('position', new Float32BufferAttribute(positions, 3));
  indexed.setIndex(index);
  const geometry = indexed.toNonIndexed();
  geometry.computeVertexNormals();
  indexed.dispose();
  return geometry;
}

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
    // round 10 (humanoid-anatomy): #6b4a2f → #423028 — the round-9 dwarf's
    // auburn beard matched his #c68642-family skin and merged into the chest;
    // a darker, desaturated umber separates hair from skin at sheet distance.
    const hex = str(ctx, 'colorHex', '#423028');
    const len = r * 1.35 * num(ctx, 'lengthScale', 1);
    const group = new Group();
    // round 8 (humanoid-anatomy): the beard ROOTS in the one-surface skull.
    // The old z 0.72 forward push (a metaball-era survival trick) left the
    // wedge floating a third of a head in front of the sculpted chin — the
    // verdict's "flat cone sticker". The wedge's base ring is now buried up
    // into the chin/jaw underside (skull local ≈ (0, −0.40, 0.40), inside
    // the ≈0.52 chin front) and the point sweeps down-forward off the jaw.
    // round 21 (humanoid-anatomy): the beard BREAKS INTO PLANES. Round 20:
    // "one solid black wedge that fuses into a dark chest triangle with no
    // strand or plane breaks". One cone at one value has nothing for the toon
    // ramp to quantize, so it renders as a silhouette hole. Three overlapping
    // strand masses now: a long centre fork flanked by two shorter side
    // planes, each stepped in value, each cocked a few degrees so its edge
    // profiles to at least one camera (the camera-aimed-feature rule), and
    // each bulging past its neighbour's radius so the outline scallops.
    const shade = (k: number): string => {
      const n = parseInt(hex.slice(1), 16);
      const ch = (v: number): number => Math.max(0, Math.min(255, Math.round(v * k)));
      const rgb = (ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255);
      return `#${rgb.toString(16).padStart(6, '0')}`;
    };
    const wedge = new Mesh(new ConeGeometry(r * 0.5, len, 7), ctx.material(shade(1.35)));
    wedge.position.set(0, -len * 0.42, r * 0.16);
    wedge.rotation.x = Math.PI - 0.25; // point down, swept slightly forward
    group.add(wedge);
    for (const sgn of [-1, 1]) {
      // side planes: darker, shorter, rolled outward so each one owns an edge
      const strand = new Mesh(new ConeGeometry(r * 0.34, len * 0.78, 6), ctx.material(shade(sgn < 0 ? 0.72 : 0.92)));
      strand.position.set(sgn * r * 0.3, -len * 0.3, r * 0.04);
      strand.rotation.set(Math.PI - 0.18, 0, sgn * -0.3);
      group.add(strand);
    }
    // the FORK — a lighter tip mass past the centre wedge's point, so the
    // beard ends in a braided step instead of dissolving into the chest
    const forkTip = new Mesh(new ConeGeometry(r * 0.26, len * 0.5, 6), ctx.material(shade(1.6)));
    forkTip.position.set(0, -len * 0.86, r * 0.24);
    forkTip.rotation.x = Math.PI - 0.34;
    group.add(forkTip);
    // round 11 (humanoid-anatomy): mustache rides ABOVE the mouth cut. The
    // round-10 lobes sat at the mouth line and would swallow the new dark
    // mouth bar (assembleEntity mouthLine at skull local y ≈ −0.235); the
    // lobes lift to the upper lip and sweep outward-down, leaving the mouth
    // cut and lower-lip step visible between beard wedge and mustache.
    for (const sgn of [-1, 1]) {
      const lobe = new Mesh(new ConeGeometry(r * 0.15, r * 0.5, 5), ctx.material(hex));
      lobe.position.set(sgn * r * 0.26, r * 0.31, r * 0.1);
      lobe.rotation.z = sgn * (Math.PI / 2 + 0.55);
      group.add(lobe);
    }
    return { object: group };
  },
};

/**
 * round 11 (humanoid-anatomy): per-race face-loft parameters as a feature
 * part — the existing head-params channel (speciesProfiles features →
 * blueprint.parts). Carries data only: assembleEntity reads the params into
 * buildHumanoidHead and skips the container, so this builds nothing.
 */
const faceSculpt: PartDef = {
  id: 'faceSculpt',
  anchor: 'head',
  kind: 'mesh',
  buildMesh() {
    return { object: new Group() };
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

export const HEAD_PARTS: PartDef[] = [earsPointed, earsLong, hornsCurved, hornsStraight, hornsRam, beardMesh, beak, faceSculpt];
