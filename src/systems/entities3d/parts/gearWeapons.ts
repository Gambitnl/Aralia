/**
 * @file gearWeapons.ts — held equipment mesh parts (class kits + real gear).
 *
 * Weapons build grip-at-origin, blade up (+y); the assembler parents them to
 * the hand anchors, so a walking arm swings the weapon naturally.
 */
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Material,
  Mesh,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { Frame, PartDef } from '../types';
import { heightM } from '../types';

const STEEL = '#b9c2cc';
/** Forged (unpolished) steel — axe cheeks, poll. The light STEEL tone on the
 * broad axe cheeks read as a white slab (round-7 verdict). */
const DARK_STEEL = '#79828c';
const WOOD = '#7a5a38';
const GRIP = '#54402c';
const STRING = '#e8ddc8';

/** Weapon scale unit — roughly forearm length in meters, oversized a touch
 * so gear reads against the chunky metaball bodies. */
function unit(frame: Frame): number {
  return heightM(frame) * 0.31;
}

/** round 9 (humanoid-anatomy): GRIP READ. Hands are mittens, so weapons read
 * as objects resting against a fist (round-8 verdict: "the human's sword
 * floats beside the closed hand"). Weapons build grip-at-origin and the palm
 * block (radius ≈ 0.115 u) wraps that origin — this band is a darker bulge
 * across the haft right there, split by two near-black grooves, so at sheet
 * distance it reads as fingers wrapped around the grip. No per-finger
 * modeling: three stacked 8-gon cylinders.
 * `material` is the part context's shared toon-material factory. */
function gripBand(u: number, material: (hex: string) => Material, scale = 1): Group {
  const band = new Group();
  band.name = 'gripBand';
  const r = u * 0.15 * scale;
  const h = u * 0.3 * scale;
  const bulge = new Mesh(new CylinderGeometry(r, r * 0.94, h, 8), material('#4a3a28'));
  band.add(bulge);
  for (const yk of [-0.17, 0.17] as const) {
    const groove = new Mesh(new CylinderGeometry(r * 1.02, r * 1.02, h * 0.14, 8), material('#241a12'));
    groove.position.y = h * yk;
    band.add(groove);
  }
  return band;
}

const swordMain: PartDef = {
  id: 'swordMain',
  anchor: 'handR',
  kind: 'mesh',
  buildMesh(ctx) {
    const u = unit(ctx.frame);
    const group = new Group();
    const blade = new Mesh(new BoxGeometry(u * 0.14, u * 1.7, u * 0.045), ctx.material(STEEL));
    blade.position.y = u * 1.05;
    // round 8 (humanoid-anatomy): STEEL guard. The accent-colored crossguard
    // (#8a3333 on the fighter kit) sat at the fist with the blade emerging
    // above it — from every angle it read as a detached red fragment floating
    // at the hand (the round-7 pommel fix hit the wrong piece). Steel ties it
    // into the blade; it also drops to y 0.16 so it seats against the fist.
    const guard = new Mesh(new BoxGeometry(u * 0.5, u * 0.1, u * 0.12), ctx.material(STEEL));
    guard.position.y = u * 0.16;
    // round 7 (humanoid-anatomy): the grip runs long enough to emerge below
    // the wrapped fist (fist radius ≈ 0.12 u around the origin), and the
    // pommel is SUNK ONTO its lower end — the round-6 verdict saw the old
    // 0.34-length grip end inside the fist, leaving the accent-colored pommel
    // as a detached fragment floating below the hand.
    const grip = new Mesh(new CylinderGeometry(u * 0.06, u * 0.06, u * 0.52, 8), ctx.material(GRIP));
    grip.position.y = -u * 0.05;
    // steel, not accent: the dark grip disappears against dark tunics, and an
    // accent-colored sphere past it read as a detached red drip (round 6)
    const pommel = new Mesh(new SphereGeometry(u * 0.09, 8, 6), ctx.material(STEEL));
    pommel.position.y = -u * 0.27; // overlaps the grip's lower end — one connected hilt
    group.add(blade, guard, grip, pommel, gripBand(u, ctx.material));
    return { object: group };
  },
};

const daggerBuild: PartDef['buildMesh'] = (ctx) => {
  const u = unit(ctx!.frame) * 0.55;
  const group = new Group();
  const blade = new Mesh(new BoxGeometry(u * 0.16, u * 1.3, u * 0.05), ctx!.material(STEEL));
  blade.position.y = u * 0.85;
  const guard = new Mesh(new BoxGeometry(u * 0.42, u * 0.09, u * 0.1), ctx!.material(GRIP));
  guard.position.y = u * 0.18;
  const grip = new Mesh(new CylinderGeometry(u * 0.06, u * 0.06, u * 0.3, 8), ctx!.material(GRIP));
  // the fist is body-scaled, not weapon-scaled — band off the full unit
  group.add(blade, guard, grip, gripBand(unit(ctx!.frame), ctx!.material));
  return { object: group };
};

const daggerMain: PartDef = { id: 'daggerMain', anchor: 'handR', kind: 'mesh', buildMesh: daggerBuild };
const daggerOff: PartDef = { id: 'daggerOff', anchor: 'handL', kind: 'mesh', buildMesh: daggerBuild };

const axeMain: PartDef = {
  id: 'axeMain',
  anchor: 'handR',
  kind: 'mesh',
  buildMesh(ctx) {
    const u = unit(ctx.frame);
    const group = new Group();
    const haft = new Mesh(new CylinderGeometry(u * 0.055, u * 0.065, u * 1.9, 8), ctx.material(WOOD));
    haft.position.y = u * 0.55;
    // round 8 (humanoid-anatomy): the flat light-gray box head read as "a
    // strapped-on white book" from the side. Darker forged-steel cheeks, a
    // wedge PRISM bevel (a triangular cylinder, point leading) carrying a
    // bright honed line at the cutting edge, and a poll collar where the
    // head meets the haft.
    const head = new Mesh(new BoxGeometry(u * 0.5, u * 0.46, u * 0.09), ctx.material(DARK_STEEL));
    head.position.set(u * 0.24, u * 1.25, 0);
    const bevel = new Mesh(new CylinderGeometry(u * 0.28, u * 0.28, u * 0.55, 3, 1), ctx.material('#98a1ab'));
    // triangular prism: axis along the blade height (y), rotated so one
    // vertex LINE leads +x (the cutting edge) and the flat face behind it
    // seats against the head cheeks — a real beveled edge, thinned in z
    bevel.rotation.y = Math.PI / 2; // local +z (a triangle vertex) → world +x
    // matrix order T·R·S: scale acts on LOCAL axes. Local x lands on world z
    // after the y-rotation, so thinning the blade means scaling local x.
    bevel.scale.set(0.35, 1, 1);
    bevel.position.set(u * 0.52, u * 1.25, 0);
    const edge = new Mesh(new BoxGeometry(u * 0.04, u * 0.5, u * 0.03), ctx.material('#e9eef3'));
    edge.position.set(u * 0.77, u * 1.25, 0);
    const poll = new Mesh(new CylinderGeometry(u * 0.09, u * 0.09, u * 0.34, 8), ctx.material(DARK_STEEL));
    poll.position.set(0, u * 1.25, 0);
    group.add(haft, head, bevel, edge, poll, gripBand(u, ctx.material));
    return { object: group };
  },
};

const maceMain: PartDef = {
  id: 'maceMain',
  anchor: 'handR',
  kind: 'mesh',
  buildMesh(ctx) {
    const u = unit(ctx.frame);
    const group = new Group();
    const haft = new Mesh(new CylinderGeometry(u * 0.05, u * 0.06, u * 1.3, 8), ctx.material(GRIP));
    haft.position.y = u * 0.4;
    const head = new Mesh(new SphereGeometry(u * 0.28, 8, 6), ctx.material(STEEL));
    head.position.y = u * 1.15;
    const group2 = new Group();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const flange = new Mesh(new BoxGeometry(u * 0.08, u * 0.3, u * 0.16), ctx.material(STEEL));
      flange.position.set(Math.cos(a) * u * 0.26, u * 1.15, Math.sin(a) * u * 0.26);
      flange.rotation.y = -a;
      group2.add(flange);
    }
    group.add(haft, head, group2, gripBand(u, ctx.material));
    return { object: group };
  },
};

const staffMain: PartDef = {
  id: 'staffMain',
  anchor: 'handR',
  kind: 'mesh',
  buildMesh(ctx) {
    const u = unit(ctx.frame);
    const group = new Group();
    const shaft = new Mesh(new CylinderGeometry(u * 0.06, u * 0.075, u * 3.1, 8), ctx.material(WOOD));
    shaft.position.y = u * 0.85;
    const orb = new Mesh(new SphereGeometry(u * 0.2, 10, 8), ctx.material(ctx.palette.accentHex));
    orb.position.y = u * 2.55;
    const collar = new Mesh(new TorusGeometry(u * 0.13, u * 0.04, 6, 10), ctx.material(ctx.palette.secondaryHex));
    collar.position.y = u * 2.3;
    collar.rotation.x = Math.PI / 2;
    group.add(shaft, orb, collar, gripBand(u, ctx.material));
    return { object: group };
  },
};

const bowMain: PartDef = {
  id: 'bowMain',
  anchor: 'handL',
  kind: 'mesh',
  buildMesh(ctx) {
    const u = unit(ctx.frame);
    const group = new Group();
    const limb = new Mesh(new TorusGeometry(u * 1.05, u * 0.05, 6, 16, Math.PI * 0.92), ctx.material(WOOD));
    limb.rotation.z = Math.PI / 2 - Math.PI * 0.46; // arc opens forward
    const string = new Mesh(new CylinderGeometry(u * 0.012, u * 0.012, u * 1.98, 4), ctx.material(STRING));
    group.add(limb, string, gripBand(u, ctx.material));
    group.rotation.x = -0.1;
    return { object: group };
  },
};

const orbFocus: PartDef = {
  id: 'orbFocus',
  anchor: 'handL',
  kind: 'mesh',
  buildMesh(ctx) {
    const u = unit(ctx.frame);
    const group = new Group();
    const orb = new Mesh(new SphereGeometry(u * 0.3, 12, 10), ctx.material(ctx.palette.accentHex));
    orb.position.set(0, u * 0.42, u * 0.18);
    const ring = new Mesh(new TorusGeometry(u * 0.36, u * 0.04, 6, 14), ctx.material(ctx.palette.secondaryHex));
    ring.position.copy(orb.position);
    ring.rotation.x = Math.PI / 2.6;
    group.add(orb, ring);
    return { object: group };
  },
};

const luteBack: PartDef = {
  id: 'luteBack',
  anchor: 'back',
  kind: 'mesh',
  buildMesh(ctx) {
    const u = unit(ctx.frame);
    const group = new Group();
    const body = new Mesh(new SphereGeometry(u * 0.5, 10, 8), ctx.material(WOOD));
    body.scale.set(0.85, 1.1, 0.35);
    const neck = new Mesh(new BoxGeometry(u * 0.12, u * 1.1, u * 0.08), ctx.material(GRIP));
    neck.position.y = u * 0.95;
    const headstock = new Mesh(new BoxGeometry(u * 0.18, u * 0.22, u * 0.09), ctx.material(GRIP));
    headstock.position.y = u * 1.55;
    group.add(body, neck, headstock);
    group.rotation.z = 0.5; // slung diagonally across the back
    group.position.z = -u * 0.15;
    return { object: group };
  },
};

export const WEAPON_PARTS: PartDef[] = [
  swordMain,
  daggerMain,
  daggerOff,
  axeMain,
  maceMain,
  staffMain,
  bowMain,
  orbFocus,
  luteBack,
];
