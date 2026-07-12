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
  Mesh,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { Frame, PartDef } from '../types';
import { heightM } from '../types';

const STEEL = '#b9c2cc';
const WOOD = '#7a5a38';
const GRIP = '#54402c';
const STRING = '#e8ddc8';

/** Weapon scale unit — roughly forearm length in meters, oversized a touch
 * so gear reads against the chunky metaball bodies. */
function unit(frame: Frame): number {
  return heightM(frame) * 0.31;
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
    const guard = new Mesh(new BoxGeometry(u * 0.5, u * 0.09, u * 0.11), ctx.material(ctx.palette.accentHex));
    guard.position.y = u * 0.2;
    const grip = new Mesh(new CylinderGeometry(u * 0.05, u * 0.05, u * 0.34, 8), ctx.material(GRIP));
    const pommel = new Mesh(new SphereGeometry(u * 0.08, 8, 6), ctx.material(ctx.palette.accentHex));
    pommel.position.y = -u * 0.2;
    group.add(blade, guard, grip, pommel);
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
  group.add(blade, guard, grip);
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
    const head = new Mesh(new BoxGeometry(u * 0.65, u * 0.5, u * 0.08), ctx.material(STEEL));
    head.position.set(u * 0.28, u * 1.25, 0);
    const edge = new Mesh(new BoxGeometry(u * 0.12, u * 0.6, u * 0.1), ctx.material('#dfe6ec'));
    edge.position.set(u * 0.6, u * 1.25, 0);
    group.add(haft, head, edge);
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
    group.add(haft, head, group2);
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
    group.add(shaft, orb, collar);
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
    group.add(limb, string);
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
