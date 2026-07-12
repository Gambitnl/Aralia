/**
 * @file gearArmor.ts — worn equipment mesh parts: shield, headwear, cape,
 * pauldrons, robe skirt, pouches, quiver.
 *
 * Headwear anchors to `head`, shoulder gear to `chest`, hanging gear to
 * `back`/`hips`. Everything scales from the frame so kit pieces fit any race.
 */
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { Frame, PartDef } from '../types';
import { FT_TO_M, headRadiusM, heightM } from '../types';

const STEEL = '#aab4bf';
const LEATHER = '#6e4a32';

function hr(frame: Frame): number {
  return headRadiusM(frame);
}

const shieldOff: PartDef = {
  id: 'shieldOff',
  anchor: 'handL',
  kind: 'mesh',
  buildMesh(ctx) {
    const u = heightM(ctx.frame) * 0.19;
    const group = new Group();
    const disc = new Mesh(new CylinderGeometry(u, u, u * 0.12, 18), ctx.material(ctx.palette.accentHex));
    disc.rotation.x = Math.PI / 2;
    const rim = new Mesh(new TorusGeometry(u, u * 0.06, 6, 18), ctx.material(STEEL));
    const boss = new Mesh(new SphereGeometry(u * 0.22, 10, 8), ctx.material(STEEL));
    boss.position.z = u * 0.1;
    group.add(disc, rim, boss);
    // sits clearly outside the thick metaball forearm
    group.position.x = -u * 0.55;
    group.rotation.y = -0.35; // angled a touch toward the viewer's front
    return { object: group };
  },
};

const helmet: PartDef = {
  id: 'helmet',
  anchor: 'head',
  kind: 'mesh',
  buildMesh(ctx) {
    const r = hr(ctx.frame) * 1.12;
    const group = new Group();
    const dome = new Mesh(new SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), ctx.material(STEEL));
    dome.position.y = r * 0.15;
    const nose = new Mesh(new BoxGeometry(r * 0.16, r * 0.5, r * 0.1), ctx.material(STEEL));
    nose.position.set(0, -r * 0.05, r * 0.92);
    const crestRidge = new Mesh(new BoxGeometry(r * 0.1, r * 0.22, r * 1.3), ctx.material(ctx.palette.accentHex));
    crestRidge.position.y = r * 0.75;
    group.add(dome, nose, crestRidge);
    return { object: group };
  },
};

const hoodUp: PartDef = {
  id: 'hoodUp',
  anchor: 'head',
  kind: 'mesh',
  buildMesh(ctx) {
    const r = hr(ctx.frame) * 1.2;
    const group = new Group();
    const shell = new Mesh(
      new SphereGeometry(r, 12, 9, Math.PI * 0.6, Math.PI * 1.8, 0, Math.PI * 0.72),
      ctx.material(ctx.palette.accentHex),
    );
    shell.position.y = r * 0.12;
    shell.rotation.y = Math.PI; // opening faces forward
    const peak = new Mesh(new ConeGeometry(r * 0.32, r * 0.6, 8), ctx.material(ctx.palette.accentHex));
    peak.position.set(0, r * 0.75, -r * 0.35);
    peak.rotation.x = -0.7;
    group.add(shell, peak);
    return { object: group };
  },
};

const hatWide: PartDef = {
  id: 'hatWide',
  anchor: 'head',
  kind: 'mesh',
  buildMesh(ctx) {
    const r = hr(ctx.frame);
    const group = new Group();
    const brim = new Mesh(new CylinderGeometry(r * 2.0, r * 2.15, r * 0.12, 16), ctx.material(ctx.palette.accentHex));
    brim.position.y = r * 0.55;
    const cone = new Mesh(new ConeGeometry(r * 0.95, r * 2.1, 12), ctx.material(ctx.palette.accentHex));
    cone.position.y = r * 1.55;
    cone.rotation.z = 0.12; // slouch
    const band = new Mesh(new CylinderGeometry(r * 0.98, r * 1.02, r * 0.28, 12), ctx.material(ctx.palette.secondaryHex));
    band.position.y = r * 0.75;
    group.add(brim, cone, band);
    return { object: group };
  },
};

const capeCloak: PartDef = {
  id: 'capeCloak',
  anchor: 'back',
  kind: 'mesh',
  buildMesh(ctx) {
    const h = heightM(ctx.frame);
    const w = ctx.frame.shoulderWidthFt * FT_TO_M;
    const group = new Group();
    const cloth = new Mesh(
      new CylinderGeometry(w * 0.52, w * 0.78, h * 0.48, 10, 1, true, Math.PI * 0.52, Math.PI * 0.96),
      ctx.material(ctx.palette.accentHex),
    );
    cloth.position.set(0, -h * 0.2, 0.015);
    cloth.rotation.y = Math.PI; // drape opens forward, cloth hangs at the back
    const clasp = new Mesh(new SphereGeometry(w * 0.06, 8, 6), ctx.material(ctx.palette.secondaryHex));
    clasp.position.set(0, h * 0.05, 0.02);
    group.add(cloth, clasp);
    return { object: group };
  },
};

const pauldrons: PartDef = {
  id: 'pauldrons',
  anchor: 'chest',
  kind: 'mesh',
  buildMesh(ctx) {
    const w = (ctx.frame.shoulderWidthFt * FT_TO_M) / 2;
    const r = hr(ctx.frame) * 0.72;
    const group = new Group();
    for (const sgn of [-1, 1]) {
      const cap = new Mesh(
        new SphereGeometry(r, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.55),
        ctx.material(STEEL),
      );
      cap.position.set(sgn * (w + r * 0.25), r * 0.4, 0);
      cap.rotation.z = sgn * -0.35;
      const stud = new Mesh(new SphereGeometry(r * 0.18, 6, 5), ctx.material(ctx.palette.accentHex));
      stud.position.set(sgn * (w + r * 0.25), r * 0.85, 0);
      group.add(cap, stud);
    }
    return { object: group };
  },
};

const robeSkirt: PartDef = {
  id: 'robeSkirt',
  anchor: 'hips',
  kind: 'mesh',
  buildMesh(ctx) {
    const h = heightM(ctx.frame);
    const r = hr(ctx.frame);
    const skirt = new Mesh(
      new CylinderGeometry(r * 1.15 * ctx.frame.bulk, r * 1.9 * ctx.frame.bulk, h * 0.42, 12, 1, true),
      ctx.material(ctx.palette.accentHex),
    );
    skirt.position.y = -h * 0.18;
    const belt = new Mesh(
      new TorusGeometry(r * 1.15 * ctx.frame.bulk, r * 0.09, 6, 14),
      ctx.material(ctx.palette.secondaryHex),
    );
    belt.rotation.x = Math.PI / 2;
    belt.position.y = h * 0.015;
    const group = new Group();
    group.add(skirt, belt);
    return { object: group };
  },
};

const beltPouch: PartDef = {
  id: 'beltPouch',
  anchor: 'hips',
  kind: 'mesh',
  buildMesh(ctx) {
    const r = hr(ctx.frame);
    const group = new Group();
    const pouch = new Mesh(new SphereGeometry(r * 0.35, 8, 6), ctx.material(LEATHER));
    pouch.scale.set(1, 0.85, 0.7);
    pouch.position.set(r * 0.95, -r * 0.1, r * 0.55);
    const flap = new Mesh(new BoxGeometry(r * 0.5, r * 0.12, r * 0.45), ctx.material('#54402c'));
    flap.position.set(r * 0.95, r * 0.18, r * 0.55);
    group.add(pouch, flap);
    return { object: group };
  },
};

const quiverBack: PartDef = {
  id: 'quiverBack',
  anchor: 'back',
  kind: 'mesh',
  buildMesh(ctx) {
    const h = heightM(ctx.frame);
    const r = hr(ctx.frame);
    const group = new Group();
    const tube = new Mesh(new CylinderGeometry(r * 0.32, r * 0.28, h * 0.28, 10), ctx.material(LEATHER));
    for (let i = 0; i < 3; i++) {
      const arrow = new Mesh(new CylinderGeometry(r * 0.035, r * 0.035, h * 0.14, 4), ctx.material('#8a6742'));
      arrow.position.set((i - 1) * r * 0.12, h * 0.19, (i % 2) * r * 0.08);
      const fletch = new Mesh(new ConeGeometry(r * 0.09, r * 0.18, 4), ctx.material(ctx.palette.accentHex));
      fletch.position.set((i - 1) * r * 0.12, h * 0.27, (i % 2) * r * 0.08);
      group.add(arrow, fletch);
    }
    group.add(tube);
    group.rotation.z = 0.35; // slung diagonally
    group.position.z = -r * 0.3;
    return { object: group };
  },
};

export const ARMOR_PARTS: PartDef[] = [
  shieldOff,
  helmet,
  hoodUp,
  hatWide,
  capeCloak,
  pauldrons,
  robeSkirt,
  beltPouch,
  quiverBack,
];
