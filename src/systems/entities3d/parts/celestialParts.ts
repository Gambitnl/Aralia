/**
 * @file parts/celestialParts.ts — the celestial identity kit: halo, shoulder
 * mantle, robe.
 *
 * round 25 (creature-anatomy): the round-24 verdict called the Celestial Large
 * archetype the worst subject on the wall — "a naked featureless tan
 * mannequin ... no garment, and nothing celestial — no halo, no light, no
 * radiance", and noted that even a low-tier trash mob carries ruffed shoulders
 * and a face. Anatomy alone was never going to fix that: a bare biped loft in
 * one skin tone has no value break anywhere on it. This file supplies the
 * three things the archetype was missing as SOLID FORMS (the round-24 rule —
 * every detail part must read from all camera angles, so rings are closed tori
 * and the robe is a capped solid, never a one-sided plane):
 *
 *   halo             — a closed torus riding above the crown, tilted so it
 *                      profiles as an ellipse from the front and an edge-on
 *                      bar from the side; near-white, so it lands in the toon
 *                      ramp's top band against any sky and reads as radiance.
 *   celestialMantle  — the MASS EVENT at the shoulder: two ruffed pads
 *                      overhanging the deltoids, a closed collar torus at the
 *                      neck, and a chest plate that breaks the naked torso
 *                      into a light garment over a darker body.
 *   celestialRobe    — a capped, flared skirt with a hem band: the bright
 *                      lower value block, and a wide silhouette base under the
 *                      narrow chest.
 *
 * All three key off the frame, so they fit any size roll.
 */
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { PartDef, PartMeshCtx } from '../types';
import { FT_TO_M, heightM } from '../types';

/** Bleached linen — a full toon band lighter than any celestial hide tone, so
 * the garment reads as cloth over skin rather than more skin. */
const VESTMENT = '#efe6d4';
/** The shadowed underside of the same cloth: the value break that makes the
 * mantle a layered garment instead of one flat white shape. */
const VESTMENT_SHADE = '#b9ab90';
/** Radiance: near-white with a gold cast. */
const RADIANCE = '#fff3c4';

/** Torso half-width in metres — the shoulder line every piece hangs off. */
function shoulderHalfM(ctx: PartMeshCtx): number {
  return (ctx.frame.shoulderWidthFt * FT_TO_M) / 2;
}

const halo: PartDef = {
  id: 'halo',
  anchor: 'crown',
  kind: 'mesh',
  buildMesh(ctx: PartMeshCtx) {
    const h = heightM(ctx.frame);
    const ring = h * 0.085;
    const group = new Group();
    // closed torus, never a disc: a flat ring vanishes edge-on, and the
    // round-24 rule is that a detail form must survive a 360° orbit
    const disc = new Mesh(new TorusGeometry(ring, ring * 0.15, 6, 20), ctx.material(RADIANCE));
    // tilted back ~22°, so the front camera sees a wide ellipse, the side
    // camera a slanted bar, and the top camera a full circle
    disc.rotation.x = Math.PI / 2 - 0.38;
    // round-25 eyeball fix: 0.09 h left the ring floating a head's height
    // clear of the crown — a hovering prop, not a halo. It now rides just
    // above the skull.
    disc.position.y = h * 0.035;
    disc.position.z = -h * 0.02;
    group.add(disc);
    // a second, thinner ring inside it: two concentric bands read as light
    // rather than as a hoop prop
    const inner = new Mesh(new TorusGeometry(ring * 0.72, ring * 0.07, 5, 16), ctx.material(RADIANCE));
    inner.rotation.copy(disc.rotation);
    inner.position.copy(disc.position);
    group.add(inner);
    return { object: group };
  },
};

const celestialMantle: PartDef = {
  id: 'celestialMantle',
  anchor: 'chest',
  kind: 'mesh',
  buildMesh(ctx: PartMeshCtx) {
    const h = heightM(ctx.frame);
    const half = shoulderHalfM(ctx);
    const pad = Math.max(h * 0.045, half * 0.5);
    const group = new Group();
    // round-25 eyeball fix: the plan driver's `chest` anchor on a VERTICAL
    // body sits at the top spine station — which is the neck, not the
    // shoulder line. The first capture had the pads flanking the SKULL and
    // the chest plate covering the face in the close-up panel. The whole
    // mantle drops to the real shoulder line here, inside the part.
    group.position.y = -h * 0.13;
    for (const sgn of [-1, 1] as const) {
      // RUFFED PAD: a squashed sphere overhanging the deltoid, then a shadowed
      // under-flange stepping out past it — the pad edge scallops the
      // silhouette instead of blending into the arm (the round-20 rule: a
      // detail form must BULGE past its valley or the ink outline swallows it)
      const cap = new Mesh(new SphereGeometry(pad, 9, 6), ctx.material(VESTMENT));
      cap.scale.set(1.25, 0.78, 0.95);
      cap.position.set(sgn * (half + pad * 0.15), h * 0.015, 0);
      cap.rotation.z = sgn * -0.28;
      group.add(cap);
      const flange = new Mesh(
        new CylinderGeometry(pad * 1.08, pad * 0.72, pad * 0.5, 9),
        ctx.material(VESTMENT_SHADE),
      );
      flange.position.set(sgn * (half + pad * 0.2), -pad * 0.5, 0);
      flange.rotation.z = sgn * -0.28;
      group.add(flange);
    }
    // COLLAR: closed torus at the neck base, the top edge of the garment
    const collar = new Mesh(
      new TorusGeometry(half * 0.62, h * 0.014, 5, 14),
      ctx.material(VESTMENT_SHADE),
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = h * 0.055;
    group.add(collar);
    // CHEST PLATE: a light garment block across the front of the torso, so the
    // body carries a light-over-dark break instead of one bare tan value from
    // chin to knee. Boxed and slightly proud, so its edges ink.
    const plate = new Mesh(
      new BoxGeometry(half * 1.5, h * 0.135, half * 1.15),
      ctx.material(VESTMENT),
    );
    plate.position.set(0, -h * 0.03, half * 0.16);
    group.add(plate);
    // a gold stole running down the middle of the plate: one narrow accent
    // stripe against the linen, the detail the close-up panel needs
    const stole = new Mesh(
      new BoxGeometry(half * 0.34, h * 0.155, half * 1.24),
      ctx.material(ctx.palette.accentHex),
    );
    stole.position.set(0, -h * 0.03, half * 0.16);
    group.add(stole);
    return { object: group };
  },
};

const celestialRobe: PartDef = {
  id: 'celestialRobe',
  anchor: 'hips',
  kind: 'mesh',
  buildMesh(ctx: PartMeshCtx) {
    const h = heightM(ctx.frame);
    const half = shoulderHalfM(ctx);
    const group = new Group();
    // CAPPED cylinder (openEnded false): a one-sided skirt wall shows its
    // backface as the ink hull from behind — the campaign's solid-form rule
    const skirt = new Mesh(
      new CylinderGeometry(half * 1.0, half * 1.72, h * 0.3, 12),
      ctx.material(VESTMENT),
    );
    skirt.position.y = -h * 0.13;
    group.add(skirt);
    // hem band a value below the skirt: the bottom edge reads as a hem, and
    // the skirt stops being one white cone
    const hem = new Mesh(
      new CylinderGeometry(half * 1.72, half * 1.78, h * 0.035, 12),
      ctx.material(VESTMENT_SHADE),
    );
    hem.position.y = -h * 0.29;
    group.add(hem);
    // belt: closed torus at the waist
    const belt = new Mesh(
      new TorusGeometry(half * 1.02, h * 0.016, 5, 14),
      ctx.material(ctx.palette.accentHex),
    );
    belt.rotation.x = Math.PI / 2;
    belt.position.y = h * 0.005;
    group.add(belt);
    return { object: group };
  },
};

export const CELESTIAL_PARTS: PartDef[] = [halo, celestialMantle, celestialRobe];
