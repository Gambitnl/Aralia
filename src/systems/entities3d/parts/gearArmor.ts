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
import { FT_TO_M, heightM } from '../types';
import { bipedShoulderOutM, bipedSkullRadiusM, bipedSlimT } from '../three/skeletonBuilder';

const STEEL = '#aab4bf';
/** round 21 (humanoid-anatomy): forged (unpolished) steel for helmet rims and
 * bands — a value step below STEEL, so the helmet reads as plates and rolls
 * instead of one bowl under the toon ramp. */
const DARK_STEEL = '#6e7784';
const LEATHER = '#6e4a32';
/** round 22 (humanoid-anatomy): the shadow a plate casts on the mass it is
 * strapped to. Near-black and near-neutral so it can never quantize up into
 * the steel's lit band — the same rule BOOT_TINT learned in round 21b. */
const PLATE_SHADOW = '#23262b';

/** round 6 (humanoid-anatomy): gear scales from the DRAWN skull radius, not
 * headRadiusM — slim frames draw a smaller skull, and a helmet sized to the
 * old radius would keep the oversized-dome read the skull fix removes. */
function hr(frame: Frame): number {
  return bipedSkullRadiusM(frame);
}

const shieldOff: PartDef = {
  id: 'shieldOff',
  anchor: 'handL',
  kind: 'mesh',
  buildMesh(ctx) {
    // round 21 (humanoid-anatomy): HARD ERROR FIX. Round 20: "on both human
    // and dwarf a rounded skin-tone peg pokes THROUGH the front face of the
    // shield next to the boss ... the shield-arm hand clipping out the front".
    // The disc was centred ON the hand anchor (the fist centre) with only
    // 0.06 u of half-thickness, so the fist — which reaches ~0.35 u forward of
    // its centre — simply came out the front beside the boss. A shield is
    // gripped from BEHIND at the boss, so the whole disc now sits forward of
    // the fist and the straps that carry it face back toward the arm.
    const u = heightM(ctx.frame) * 0.19;
    const group = new Group();
    const disc = new Mesh(new CylinderGeometry(u, u, u * 0.12, 18), ctx.material(ctx.palette.accentHex));
    disc.rotation.x = Math.PI / 2;
    const rim = new Mesh(new TorusGeometry(u, u * 0.06, 6, 18), ctx.material(STEEL));
    const boss = new Mesh(new SphereGeometry(u * 0.22, 10, 8), ctx.material(STEEL));
    boss.position.z = u * 0.1;
    group.add(disc, rim, boss);
    // round 21: the CARRY. Round 20 also read the shield as "hanging beside
    // the body with no forearm carrying it". Two leather straps cross the back
    // face — the enarme the forearm slides through and the grip bar the fist
    // closes on — so the back of the shield reads as harness in the side, 3/4
    // and top panels, which is exactly where the fist is now visible behind it.
    const enarme = new Mesh(new CylinderGeometry(u * 0.07, u * 0.07, u * 1.05, 6), ctx.material(LEATHER));
    enarme.rotation.z = Math.PI / 2;
    enarme.position.set(0, u * 0.34, -u * 0.12);
    const gripBar = new Mesh(new CylinderGeometry(u * 0.07, u * 0.07, u * 0.86, 6), ctx.material(LEATHER));
    gripBar.rotation.z = Math.PI / 2;
    gripBar.position.set(0, -u * 0.18, -u * 0.12);
    group.add(enarme, gripBar);
    // round 17 (humanoid-anatomy): pulled in −0.55 u → −0.4 u — with the
    // straightened hanging arm the fist rides close to the hip, and the old
    // offset floated the disc as a disconnected blob in the top panel.
    // round 21: +z clears the whole fist (fist reach ≈ 0.35 u from the anchor,
    // disc back face now at 0.3 u), and +y seats the disc on the forearm
    // rather than dangling from the knuckles.
    // round 22 (humanoid-anatomy): UNCOVER THE FIST. Round 21's verdict, on
    // both the human and the dwarf: "the shield-side fist is completely hidden
    // by the shield in front, 3/4 AND side, so it goes unproven in every
    // panel" — the fist is the one piece of anatomy that never got judged.
    // The disc is 0.38 h across and the fist 0.09 h, so no offset small enough
    // to keep the shield on the arm can clear it: the fix has to come from
    // ANGLE. Carried at ≈60° instead of ≈24°, the disc's front-panel width
    // drops to half its diameter, and a matching outboard step puts the whole
    // fist inboard of the near rim — visible in the front panel, and wide open
    // in the 3/4 where the disc turns nearly edge-on.
    // Round 21's seating is deliberately untouched: the disc still sits
    // forward of the fist (no clipping through the face) and the enarme and
    // grip straps still cross its back toward the arm, which is what the
    // round-21 verdict passed.
    group.position.set(-u * 0.62, u * 0.2, u * 0.3);
    group.rotation.y = -1.05;
    group.rotation.x = 0.1;
    return { object: group };
  },
};

const helmet: PartDef = {
  id: 'helmet',
  anchor: 'head',
  kind: 'mesh',
  buildMesh(ctx) {
    // round 7 (humanoid-anatomy): fitted to the SCULPTED skull
    // (headForms.buildHumanoidHead — crown 0.88, half-width 0.74, eyes at
    // y 0.16 / z 0.6 in skull radii). The old 1.12-radius dome with its rim
    // at head-center height swallowed the new deeper-set face whole — the
    // round-7 first capture showed helmet, neck, and no eyes.
    // round 9 (humanoid-anatomy): OPEN-FACE for real. The round-8 rim
    // (~0.26 r) still sat ON the brow shelf (loft station y 0.30), hiding the
    // carved sockets, and the nasal bar eclipsed the recessed right eye at
    // the face camera's parallax — the verdict's "one floating iris dot".
    // The dome now rides higher (rim ≈ 0.44 r, above the brow shelf, below
    // the forehead station at 0.46) and the nasal bar is gone: the skull
    // loft's own brow shelf, sockets, and lidded eyes stay visible under it.
    const r = hr(ctx.frame) * 0.98;
    const group = new Group();
    const dome = new Mesh(new SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.46), ctx.material(STEEL));
    dome.position.y = r * 0.32;
    // round 17 (humanoid-anatomy): footprint widened 0.88 → 0.96 wide and
    // 1.04 deep — the narrow dome read as a beanie floating on the skull in
    // the top panel. The rim height (the round-9 open-face fix) is untouched,
    // so the brow shelf and eyes stay visible.
    dome.scale.set(0.96, 1, 1.04);
    const crestRidge = new Mesh(new BoxGeometry(r * 0.1, r * 0.22, r * 1.3), ctx.material(ctx.palette.accentHex));
    crestRidge.position.y = r * 0.93;
    group.add(dome, crestRidge);
    // round 21 (humanoid-anatomy): the helmet gets a FORM. Round 20 read it as
    // "a featureless grey bowl cap". Three additions, none of which touch the
    // round-9 open-face rim height that keeps the brow and eyes visible:
    // a rolled rim welded onto the dome's lower edge (the dome's cap ends at
    // y ≈ 0.445 r with radius ≈ 0.99 r), two hanging cheek guards that give the
    // helmet a silhouette below the rim in the front and 3/4 panels, and a
    // darker crown band that breaks the dome into two value plates.
    const brim = new Mesh(new TorusGeometry(r * 0.99, r * 0.1, 6, 18), ctx.material(DARK_STEEL));
    brim.rotation.x = Math.PI / 2;
    brim.position.y = r * 0.445;
    brim.scale.set(0.96, 1.04, 1);
    const crownBand = new Mesh(new TorusGeometry(r * 0.78, r * 0.06, 5, 16), ctx.material(DARK_STEEL));
    crownBand.rotation.x = Math.PI / 2;
    crownBand.position.y = r * 0.86;
    crownBand.scale.set(0.96, 1.04, 1);
    group.add(brim, crownBand);
    for (const sgn of [-1, 1]) {
      const cheek = new Mesh(new BoxGeometry(r * 0.14, r * 0.62, r * 0.72), ctx.material(STEEL));
      cheek.position.set(sgn * r * 0.9, r * 0.14, -r * 0.02);
      cheek.rotation.z = sgn * 0.12;
      group.add(cheek);
    }
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
    // round 16 (humanoid-anatomy): CUT pauldrons — the round-15 verdict named
    // the sphere caps "perfect balloons". Each pauldron is now a beveled
    // 9-sided frustum dome (flat top plate → bevel) over a flared rim skirt
    // whose bottom edge steps out past the dome — a smith-cut plate with a
    // visible rim edge, not an inflated ball.
    // round 17 (humanoid-anatomy): SEATED on the deltoids. The round-16
    // placement ran on skull-radius offsets from the chest anchor, so on the
    // dwarf the plates floated beside the shoulders as "disconnected blobs"
    // in the top panel. The pauldron now computes the driver's own deltoid
    // center (shoulder joint at chestY + 0.45 baseR, x = halfWidth +
    // shoulderOut — mirror of BipedDriver.buildBody) and caps that ball, and
    // its radius carries a deltoid-derived floor so the plate always
    // overhangs the shoulder mass it sits on.
    const w = (ctx.frame.shoulderWidthFt * FT_TO_M) / 2;
    const hM = heightM(ctx.frame);
    const baseR = hM * 0.105 * ctx.frame.bulk;
    const armR = Math.max(baseR * 0.3, ctx.frame.armLengthFt * FT_TO_M * 0.085);
    // round 22 (humanoid-anatomy): both the deltoid ball and its outward push
    // now carry a slim-frame floor (skeletonBuilder bipedSlimT /
    // bipedShoulderOutM) — a pauldron sized and placed on the old numbers
    // would float off a slim shoulder and sink into a bulky one.
    const deltR = armR * (1.7 + 0.5 * Math.min(0.6, Math.max(0, ctx.frame.bulk - 1)) + 0.5 * bipedSlimT(ctx.frame));
    const shoulderOut = bipedShoulderOutM(ctx.frame);
    // chest anchor sits at (0, chestY, 0.15 baseR); deltoid center relative:
    const cx = w + shoulderOut;
    const cy = baseR * 0.45;
    const cz = 0.02 - baseR * 0.15;
    // round 21 (humanoid-anatomy): the deltoid mass now stretches 1.34× along X
    // (smoothBipedGeometry, the shoulder-junction fix), so a plate sized to the
    // old ball radius sank into it and the round-20 pauldron read as a bare
    // steel stripe. The plate grows to keep the overhang it had.
    // round 22 (humanoid-anatomy): 1.32 → 1.24 of the deltoid. With the slim
    // floor the deltoid itself is now a real mass, and a plate sized 1.32× on
    // top of it turned the human's shoulder into steel with a thin arm hanging
    // out from under it. 1.24 still clears the ball's 1.34× X stretch (so the
    // round-21 "bare steel stripe" cannot come back) while letting the deltoid
    // read as anatomy under the armor.
    const r = Math.max(hr(ctx.frame) * 0.78, deltR * 1.24);
    const group = new Group();
    // round 19 (humanoid-anatomy, Remy back view): the rim band broke into
    // "detached shards" — it sat laterally offset from the dome and low
    // enough that the deltoid ball surfaced through the thin ring, leaving
    // steel slivers. The rim now welds DIRECTLY under the dome (same axis,
    // same tilt), taller and wider, so dome bottom (0.88 r) overlaps rim top
    // (0.95 r) and the whole pauldron reads as one plate + one band.
    // round 22 (humanoid-anatomy): PLATE THICKNESS + SEATING SHADOW. The
    // round-21 verdict, the dwarf's last open item: "a flat grey rhombus decal
    // with no plate thickness or seating shadow". Both causes are value, not
    // form (the render lesson): every piece was one STEEL tone, so the dome,
    // the rim and the shoulder under them quantized into a single band and the
    // whole pauldron collapsed to a painted shape. Two new pieces fix it, and
    // both are real 3D forms that read from every azimuth:
    //   • EDGE — a short forged-steel drum a hair wider than the rim, standing
    //     proud of it. It is the plate's CUT EDGE seen from outside: a darker
    //     band under a lit top plate is what tells the eye the steel has
    //     thickness, and it bulges past the rim so the silhouette scallops too
    //     (the bulge-past-valley rule).
    //   • SEAT — a near-black flared ring tucked UNDER the edge, overhanging
    //     the deltoid. It is the shadow the plate casts on the shoulder it
    //     rests on, and it is what stops the pauldron from floating.
    for (const sgn of [-1, 1]) {
      const x = sgn * cx;
      const dome = new Mesh(new CylinderGeometry(r * 0.42, r * 0.88, r * 0.55, 9), ctx.material(STEEL));
      dome.position.set(x, cy + deltR * 0.5, cz);
      dome.rotation.z = sgn * -0.35;
      const rim = new Mesh(new CylinderGeometry(r * 0.95, r * 1.08, r * 0.3, 9), ctx.material(STEEL));
      rim.position.set(x, cy + deltR * 0.28, cz);
      rim.rotation.z = sgn * -0.35;
      const edge = new Mesh(new CylinderGeometry(r * 1.14, r * 1.1, r * 0.16, 9), ctx.material(DARK_STEEL));
      edge.position.set(x, cy + deltR * 0.11, cz);
      edge.rotation.z = sgn * -0.35;
      const seat = new Mesh(new CylinderGeometry(r * 1.02, r * 0.72, r * 0.22, 9), ctx.material(PLATE_SHADOW));
      seat.position.set(x, cy - deltR * 0.04, cz);
      seat.rotation.z = sgn * -0.35;
      const stud = new Mesh(new SphereGeometry(r * 0.16, 5, 4), ctx.material(ctx.palette.accentHex));
      stud.position.set(x - sgn * r * 0.1, cy + deltR * 0.82, cz);
      group.add(dome, rim, edge, seat, stud);
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
