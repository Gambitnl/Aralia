/**
 * @file wingParts.ts — wing mesh parts.
 *
 * Convention: the returned object contains child groups named `wingL` and
 * `wingR`; the assembler drives them each frame. Feathered wings are a single
 * fan the assembler rotates by the flap angle. Membrane wings (round 7,
 * creature-anatomy) are a real THREE-JOINT ARMATURE:
 *
 *   wingL/R › wingArm (shoulder) › wingElbow › wingHand
 *
 * Each joint group carries `userData.wingJoint = { spread, folded, beatSign }`
 * — two local-space pose quaternions the assembler slerps by the driver's
 * wingFold (plus the flap beat at the shoulder). Folded, the humerus sweeps
 * up-and-back so the ELBOW peaks high above the back line, the radius folds
 * forward-down bringing the wrist (and its thumb spike) over the shoulder,
 * and the finger spars fan back along the flank with the membrane draped
 * between them in sagging catenary scallops — articulated anatomy hugging the
 * torso, not a kite-sail panel. The membrane is split per segment
 * (propatagium on the arm, forearm web, distal fan on the hand) so it folds
 * WITH the bones instead of tearing.
 *
 * Round-6 lesson baked in: ink outline shells on thin wing pieces read as
 * scribble wires and slabs, so every membrane/spar/spike mesh sets
 * `userData.noOutline` and the assembler skips their shells.
 *
 * round 9 (creature-anatomy): FOLDED AND SPREAD ARE DIFFERENT MESHES — the
 * low-poly game trick. Articulating the spread armature into a fold failed
 * three rounds straight (buried, kite-sail, panel clutter), so each membrane
 * wing now ALSO carries a `wingFolded` group: one continuous sculpted blade
 * loft that roots inside the shoulder mass, rises to a wrist-spike peak above
 * the back line, and sweeps back past the hips along the flank.
 *
 * round 10 (creature-anatomy): the round-9 blade still carried a SEPARATE
 * jointed ridge (stacked cylinders) and a naked shoulder-boss sphere — the
 * critic read "an umbrella strut with an exposed ball joint resting on the
 * back". The folded wing is now ARM-FUSED: one continuous tapered arm loft
 * IS the blade's leading edge (shoulder muscle → elbow peak → finger spar →
 * wingtip, a single unbroken taper with no joint geometry anywhere), the
 * membrane loft hangs off it with its upper edge embedded inside the arm
 * tube, and the shared root plunges below the back line so the shoulder mass
 * of the body itself swallows it. Zero bare spheres, zero detached struts.
 * The assembler cross-scales blade vs armature by the driver's wingFold;
 * flight keeps the articulated spread wing.
 *
 * round 17 (creature-anatomy): spars read through VALUE and SILHOUETTE, not
 * displacement. Rounds 15 and 16 both baked geometric ridge relief into the
 * blade loft (0.024 then 0.05 amplitude), verified it locally, and the critic
 * still saw "flat slabs" — the toon ramp quantizes shading into few bands, so
 * small surface displacement produces ZERO value change at sheet distance.
 * The finger spars are now thin BONE-TONE TUBES laid on both blade faces
 * (sparStripGeometry), riding the exact sparRelief ray paths from the wrist
 * peak to the trailing edge: a different base color makes a different toon
 * band regardless of normals, exactly like the arm-fused leading edge the
 * critic already sees. The trailing edge scallop deepened 0.16 → 0.34 with
 * sharper finger tips so the lower edge CUTS the outline — silhouettes render
 * pure shape, so the scallop reads there no matter what the shading does.
 *
 * round 18 (creature-anatomy): the 0.45 scallop SHREDDED the membrane — the
 * verdict read "4-5 separate dark strips dangling off the back". The trailing
 * edge is now one continuous web at FULL depth on every spar tip, with a
 * bounded 0.28-deep concave notch midway between adjacent tips (bladeDepthAt)
 * — one folded scallop-edged wing surface, not banners. The round-17 value
 * spars are untouched.
 *
 * round 19 (creature-anatomy): ONE CLOSED LOFT — architecture ruling after
 * ~10 composite rounds (blade + spar tubes + membrane pieces kept reading as
 * separate objects; round 18: "a vertical rectangular slab plus free-hanging
 * strips"). The folded wing is now a SINGLE closed mesh: each cross-section
 * ring carries a thick arm-ridge bulge on its top edge (the shoulder→elbow→
 * finger taper, armRadiusAt) fused into the thin membrane sheet below it, so
 * shoulder muscle, leading edge, and drape are one unbroken surface with one
 * ink outline. The finger spars are VALUE ONLY: darkened vertex-color bands
 * fanning from the wrist peak along the old sparRelief rays (the round-17/18
 * lesson industrialized — a different tint lands in a different toon band no
 * matter what the ramp does). The separate arm lofts, the 8 spar strip tubes,
 * and the wrist-spike cone are DELETED — zero separate parts in the folded
 * state. A front depth ramp keeps the membrane shallow ahead of the wrist so
 * the shoulder run reads as a rising limb ridge, not a vertical plank.
 *
 * round 21 (creature-anatomy): WING_MASS bounded search + edge cusps. The
 * round-20 fan read as a "tiny flat fin" and the value-band fingers did not
 * survive sheet distance. One mass dial (rendered at 2.0/2.5/3.0, picked by
 * eye) scales peak height, rear reach (clamped at the hips), drape depth,
 * cap, and ridge gauge together; three finger CUSPS now project past the
 * sag line so the fan's outer profile breaks the silhouette edge, with the
 * membrane dipping between them. One-loft architecture unchanged.
 *
 * round 22 (creature-anatomy): AUTHORED SILHOUETTE — method ruling after 12
 * rounds of parametric loft shaping ("ruffled blanket hump" / "arms raised
 * in surrender"). The folded wing's side-view outline is now an explicit 2D
 * polygon drawn point-by-point (FOLDED_OUTLINE): shoulder root, thick
 * leading-edge arm rising to a WRIST SPIKE peak above the shoulder, three
 * FINGER STRUT tips descending back along the flank, concave MEMBRANE SAG
 * arcs draped between them, closing at the hips. Every named feature is a
 * placed vertex, not an emergent value. The outline was verified in 2D
 * before lofting (spike above the back line, struts convex past the sag
 * chords, sags concave, hem capped at mid-torso, tip clamped at the hips,
 * simple polygon, ear-clip validity), then pillow-lofted to thickness —
 * thick at the arm edge, thin at the membrane hem — into ONE closed mesh
 * under the signed-volume winding guard. Value: dark membrane, skin-tone
 * arm, pale bone-tone spike/wrist/strut tips. Eyeball fixes during the
 * round: the wrist cluster rakes rearward and the plane TENTS INBOARD
 * (~11°) so the two peaks converge over the spine — the front view reads
 * one folded-wing tent behind the neck, never "arms raised in surrender".
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import type { Frame, PartDef, PartMeshCtx } from '../types';
import { FT_TO_M, heightM } from '../types';

/** Per-joint fold pose the assembler blends (local space, parent-relative). */
export interface WingJointPose {
  spread: Quaternion;
  folded: Quaternion;
  /** Non-zero on the shoulder joint: the flap beat's z-rotation sign. */
  beatSign: number;
}

/** Dark shade of a palette tone as a hex string (membranes, spars, claws). */
function shadeHex(hex: string, f: number): string {
  return `#${new Color(hex).multiplyScalar(f).getHexString()}`;
}
/** Light tint of a palette tone (feathers). Keeps wings in the body palette
 * instead of the old one-hex-fits-all cream/mauve that clashed with skin. */
function tintHex(hex: string, f: number): string {
  return `#${new Color(hex).lerp(new Color('#ffffff'), f).getHexString()}`;
}
/** Explicit params.colorHex always wins; otherwise derive from the skin tone. */
function wingColor(ctx: PartMeshCtx, derived: string): string {
  return typeof ctx.params.colorHex === 'string' ? ctx.params.colorHex : derived;
}

function span(frame: Frame): number {
  // Wingspan rivals body height — wings must read at a glance, even on quads
  // whose heightFt is only shoulder height.
  return Math.max(heightM(frame) * 0.95, frame.shoulderWidthFt * FT_TO_M * 1.5);
}

/**
 * Muscled wing-root boss (round 1): a skin-toned deltoid hump where the wing
 * meets the back, so the wing reads ATTACHED through shoulder mass instead of
 * a sail pinned to the spine. Lives inside the shoulder joint group, so it
 * bunches with the fold like real shoulder muscle.
 */
function shoulderBoss(ctx: PartMeshCtx, s: number): Mesh {
  const boss = new Mesh(new SphereGeometry(s * 0.085, 8, 6), ctx.material(ctx.palette.skinHex));
  boss.scale.set(1.3, 0.9, 0.9);
  return boss;
}

/* ------------------------------------------------ feather blade (round 25) */

/**
 * Unit feather blade outline in (along, across) blade space: root at 0, tip at
 * 1, widest at ~45%. Walked clockwise (leading edge out, trailing edge back)
 * so the pillow loft's rim normals resolve.
 */
const FEATHER_OUTLINE: Array<[number, number]> = [
  [0.0, 0.0],
  [0.14, 0.085],
  [0.42, 0.125],
  [0.7, 0.115],
  [0.9, 0.07],
  [1.0, 0.0], // tip
  [0.88, -0.075],
  [0.62, -0.135],
  [0.34, -0.145],
  [0.12, -0.09],
];

/**
 * Per-face winding fix: order (a, b, c) so its geometric normal agrees with
 * `want`. The round-23 lesson — a whole-mesh signed-volume guard passes mixed
 * orientations, and culled front faces render as the BackSide ink hull (solid
 * black).
 */
function orientFace(
  pos: number[],
  a: number,
  b: number,
  c: number,
  want: readonly [number, number, number],
): [number, number, number] {
  const ux = pos[b * 3] - pos[a * 3];
  const uy = pos[b * 3 + 1] - pos[a * 3 + 1];
  const uz = pos[b * 3 + 2] - pos[a * 3 + 2];
  const vx = pos[c * 3] - pos[a * 3];
  const vy = pos[c * 3 + 1] - pos[a * 3 + 1];
  const vz = pos[c * 3 + 2] - pos[a * 3 + 2];
  const dot =
    (uy * vz - uz * vy) * want[0] + (uz * vx - ux * vz) * want[1] + (ux * vy - uy * vx) * want[2];
  return dot >= 0 ? [a, b, c] : [a, c, b];
}

/**
 * round 25 (creature-anatomy): ONE unit feather blade, built once and
 * instanced by scale/rotation across every feather of both wings. A pillow
 * loft (outline offset ±half-thickness on z, ear-clipped caps, sealed rim)
 * rather than a capsule: the round-24 verdict read the capsule vanes as "six
 * flat opaque paddle blades", and a capsule has no straight leading edge, no
 * point, and no vane taper. Blade space: +x along the shaft (root→tip), +y
 * across the vane, ±z the thin axis. A raised shaft ridge (the rachis) runs
 * the centre line so the blade is a solid form from every camera, not a card.
 */
function featherBladeGeometry(): BufferGeometry {
  const n = FEATHER_OUTLINE.length;
  const half = 0.028;
  const positions: number[] = [];
  for (const side of [1, -1] as const) {
    for (const [u, v] of FEATHER_OUTLINE) {
      // the rachis ridge: thickest on the centre line, thinning to the vane
      // edge, so the blade profiles as a lens and catches a value break down
      // its middle instead of reading as one flat card
      const ridge = half * (0.35 + 0.65 * Math.max(0, 1 - Math.abs(v) / 0.145));
      positions.push(u, v, side * ridge);
    }
  }
  const pts = FEATHER_OUTLINE.map(([z, y]) => ({ z, y }));
  const index: number[] = [];
  for (const [a, b, c] of earClip(pts)) {
    index.push(...orientFace(positions, a, b, c, [0, 0, 1]));
    index.push(...orientFace(positions, n + a, n + b, n + c, [0, 0, -1]));
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const eu = FEATHER_OUTLINE[j][0] - FEATHER_OUTLINE[i][0];
    const ev = FEATHER_OUTLINE[j][1] - FEATHER_OUTLINE[i][1];
    const rim = [-ev, eu, 0] as const; // outward 2D normal of a clockwise walk
    index.push(...orientFace(positions, i, j, n + j, rim));
    index.push(...orientFace(positions, i, n + j, n + i, rim));
  }
  if (signedVolume(positions, index) < 0) {
    throw new Error('feather blade loft wound inside-out after per-face orientation');
  }
  const indexed = new BufferGeometry();
  indexed.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  indexed.setIndex(index);
  const geometry = indexed.toNonIndexed(); // flat facets, matching the body
  geometry.computeVertexNormals();
  indexed.dispose();
  return geometry;
}

/**
 * One layered feather group: `count` blades swept from `u0` to `u1` along the
 * wing arm, each rotated `rake` back from the arm axis and splayed by `splay`
 * so neighbouring tips separate. Every blade BULGES past its neighbours'
 * valley (the round-20 rule) because the tips fan while the roots stack, so
 * the outline scallops between them instead of inking the row shut.
 */
interface FeatherGroupSpec {
  count: number;
  /** Root position along the arm axis, span fractions. */
  u0: number;
  u1: number;
  /** Blade length at the first and last feather, span fractions. */
  len0: number;
  len1: number;
  /** Sweep from the outboard arm axis toward the tail, radians (first → last).
   * 0 = straight outboard, π/2 = straight back. */
  rake0: number;
  rake1: number;
  /** Downward pitch of the blade below the wing plane at the last feather. */
  droop: number;
  /** Blade width multiplier. */
  width: number;
  /** Value: 0 = body tone, 1 = white. */
  tint: number;
}

/** Build-time scratch vectors for the feather basis (no per-frame cost — the
 * feathered wing is built once and re-anchored). */
const FEATHER_DIR = new Vector3();
const FEATHER_UP = new Vector3();
const FEATHER_SIDE = new Vector3();

const FEATHER_GROUPS: Record<'coverts' | 'secondaries' | 'primaries', FeatherGroupSpec> = {
  // shoulder pack: short, dark, densely overlapping — the mass event that
  // roots the wing in the back instead of pinning a fan to the spine
  coverts: { count: 6, u0: 0.04, u1: 0.36, len0: 0.16, len1: 0.24, rake0: 1.2, rake1: 0.95, droop: 0.12, width: 1.45, tint: 0.34 },
  // the inner sheet: medium blades, mid value, a scalloped trailing edge
  secondaries: { count: 6, u0: 0.3, u1: 0.66, len0: 0.34, len1: 0.44, rake0: 0.95, rake1: 0.62, droop: 0.3, width: 1.15, tint: 0.62 },
  // the finger feathers: long, pale, splayed so SKY shows between the tips
  primaries: { count: 7, u0: 0.6, u1: 1.0, len0: 0.5, len1: 0.42, rake0: 0.62, rake1: 0.05, droop: 0.5, width: 0.85, tint: 0.9 },
};

const wingsFeathered: PartDef = {
  id: 'wingsFeathered',
  anchor: 'back',
  kind: 'mesh',
  buildMesh(ctx: PartMeshCtx) {
    // round 23 (creature-anatomy): params.scale — wingsMembrane always honored
    // it but the feathered fan ignored it, so the Celestial Large archetype
    // wore "tiny vestigial feather stubs buried in its back" (Remy, live).
    const s = span(ctx.frame) * (Number(ctx.params.scale) || 1);
    const group = new Group();
    // round 25 (creature-anatomy): the plan driver mounts a vertical body's
    // back anchor at the very TOP of the spine (a 4-segment torso rounds
    // u≈0.12 to station 0), which is neck height — the round-24 celestial
    // face panel framed a feather blade standing beside the skull. The whole
    // wing assembly drops to the true shoulder line here, inside the part,
    // where the fix cannot disturb the shared driver.
    // round-25 eyeball fix: keyed to the FRAME, not the span — the span
    // carries params.scale (1.35 on a celestial), so a span-fraction drop
    // slid the whole assembly to the hips.
    group.position.y = -heightM(ctx.frame) * 0.14;
    const blade = featherBladeGeometry();
    const skin = ctx.palette.skinHex;
    // three GROUP tones a full toon band apart: dark coverts, mid secondaries,
    // pale primaries. The round-24 fan was one cream value across all five
    // vanes, so the layers had no boundary and read as a folding paper fan.
    const toneFor = (spec: FeatherGroupSpec) => wingColor(ctx, tintHex(skin, spec.tint));
    for (const [name, sgn] of [
      ['wingL', -1],
      ['wingR', 1],
    ] as const) {
      const wing = new Group();
      wing.name = name;
      // wing arm axis: outboard, a little up, raked back off the shoulder.
      // round-25 eyeball fix: 0.86 → 0.5 of the span. `span()` is already a
      // FULL-wingspan gauge, so an 0.86 arm per side put a 9 m spread on a
      // 3 m celestial and the feathers swept the ground.
      const armLen = s * 0.5;
      for (const spec of [FEATHER_GROUPS.coverts, FEATHER_GROUPS.secondaries, FEATHER_GROUPS.primaries]) {
        const material = ctx.material(toneFor(spec));
        for (let i = 0; i < spec.count; i++) {
          const f = spec.count > 1 ? i / (spec.count - 1) : 0;
          const u = spec.u0 + (spec.u1 - spec.u0) * f;
          const len = (spec.len0 + (spec.len1 - spec.len0) * f) * s;
          const feather = new Mesh(blade, material);
          feather.scale.set(len, len * spec.width, len * spec.width);
          // root walks out along the arm; the arm itself rises then flattens
          feather.position.set(
            sgn * u * armLen,
            s * (0.12 + 0.1 * Math.sin(u * 1.5)) - u * s * 0.06,
            -s * (0.03 + u * 0.07),
          );
          // round-25 eyeball fix: MIRRORING. Composing sgn-flipped Euler
          // rotations does not mirror a shape whose own +x is the shaft — the
          // first capture grew one wing of vertical spikes and one of
          // down-swept blades. Each blade now aims an explicit direction
          // whose x simply negates across the midline, and its basis is built
          // from that direction, so left and right are exact mirrors.
          const rake = spec.rake0 + (spec.rake1 - spec.rake0) * f;
          const pitch = -spec.droop * (0.35 + 0.65 * f);
          FEATHER_DIR.set(
            sgn * Math.cos(rake) * Math.cos(pitch),
            Math.sin(pitch),
            -Math.sin(rake) * Math.cos(pitch),
          ).normalize();
          // the vane spreads in the wing's own sheet: the thin axis runs
          // horizontally across the sheet, so every blade shows its WIDTH to
          // the front and side cameras and its edge to none of them
          FEATHER_UP.set(0, 1, 0);
          FEATHER_SIDE.crossVectors(FEATHER_DIR, FEATHER_UP);
          if (FEATHER_SIDE.lengthSq() < 1e-8) FEATHER_SIDE.set(sgn, 0, 0);
          FEATHER_SIDE.normalize();
          FEATHER_UP.crossVectors(FEATHER_SIDE, FEATHER_DIR).normalize();
          feather.quaternion.setFromRotationMatrix(
            new Matrix4().makeBasis(FEATHER_DIR, FEATHER_UP, FEATHER_SIDE),
          );
          // a few degrees of twist per blade about its own shaft: identical
          // vanes stacked flush have no silhouette event between them
          feather.rotateX(sgn * (f - 0.45) * 0.5);
          wing.add(feather);
        }
      }
      // MASS EVENT at the shoulder: the deltoid boss plus a second, larger
      // scapular hump behind it, so the wing root is a volume the feathers
      // grow out of. Round 24's boss was one small ball lost under the fan.
      // round-25 eyeball fix: the boss and scapula are span-fraction sized,
      // and the span is a wingspan — at 1.9× and 0.1 s they rendered as a
      // pair of tan boulders bigger than the skull. Both now key off the
      // FRAME height, so the root reads as shoulder muscle at any wing scale.
      const rootR = heightM(ctx.frame) * 0.055;
      const boss = new Mesh(new SphereGeometry(rootR, 8, 6), ctx.material(skin));
      boss.scale.set(1.3, 0.9, 0.9);
      boss.position.set(sgn * rootR * 1.5, rootR * 0.9, -rootR * 0.2);
      boss.rotation.z = sgn * -0.5;
      wing.add(boss);
      const scapula = new Mesh(new SphereGeometry(rootR * 0.9, 8, 6), ctx.material(shadeHex(skin, 0.72)));
      scapula.scale.set(1.6, 1.0, 0.8);
      scapula.position.set(sgn * rootR * 0.6, -rootR * 0.2, -rootR * 1.1);
      wing.add(scapula);
      group.add(wing);
    }
    return { object: group };
  },
};

/* --------------------------------------------------- membrane wing armature */

/**
 * Right-handed joint basis: local +X runs along the bone, +Y is the membrane
 * normal hint orthogonalized against it, +Z completes the frame. Both fold
 * poses are authored as world-ish {dir, up} pairs and converted here.
 */
function basisQuat(dir: Vector3, up: Vector3): Quaternion {
  const x = dir.clone().normalize();
  const y = up.clone().addScaledVector(x, -x.dot(up)).normalize();
  const z = new Vector3().crossVectors(x, y);
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
}

/** Bone spar along local +X, tapered root→tip. */
function boneX(ctx: PartMeshCtx, len: number, r0: number, r1: number, hex: string): Mesh {
  const bone = new Mesh(new CylinderGeometry(r1, r0, len, 6), ctx.material(hex));
  bone.rotation.z = -Math.PI / 2; // cylinder +Y → local +X
  bone.position.set(len / 2, 0, 0);
  (bone.userData as { noOutline?: boolean }).noOutline = true;
  return bone;
}

/**
 * Double-sided membrane fan: triangles (apex, p[i], p[i+1]) over an outline
 * that is star-shaped around the apex. Open sheet (both windings emitted), so
 * the signed-volume closed-loft guard does not apply.
 */
function membraneFan(apex: [number, number, number], outline: Array<[number, number, number]>): BufferGeometry {
  const positions: number[] = [];
  for (let i = 0; i < outline.length - 1; i++) {
    const a = outline[i];
    const b = outline[i + 1];
    positions.push(...apex, ...a, ...b);
    positions.push(...apex, ...b, ...a);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geo.computeVertexNormals();
  return geo;
}

/** World-ish pose spec per joint (right wing; x mirrors for the left). */
interface JointDirUp {
  dir: readonly [number, number, number];
  up: readonly [number, number, number];
}
type WingPose = Record<'arm' | 'elbow' | 'hand', JointDirUp>;
const POSE: { spread: WingPose; folded: WingPose } = {
  spread: {
    arm: { dir: [0.6, 0.72, 0.1], up: [0, 0.55, 0.84] },
    elbow: { dir: [0.9, 0.36, -0.25], up: [0, 0.6, 0.8] },
    hand: { dir: [0.93, -0.1, -0.35], up: [0, 1, 0.15] },
  },
  folded: {
    // round 7 second pass: the first fold pose sent both elbows nearly
    // straight up from the shoulder roots — the two wings interpenetrated at
    // the midline as a crumpled starburst. The humerus now sweeps OUTBOARD as
    // well as up-and-back, so each folded wing stacks beside the spine.
    arm: { dir: [0.36, 0.62, -0.7], up: [0.9, 0.3, 0.3] },
    elbow: { dir: [0.06, -0.5, 0.86], up: [0.95, 0.2, 0.1] },
    hand: { dir: [0.12, -0.42, -0.9], up: [0.95, 0.28, 0.1] },
  },
};

/** Finger fan in hand-local space: [alongBone, drop, back] direction + length
 * (fractions of the span scale). round 7 second pass: the fan is NARROW
 * (~45° total) — a rigid 130° fan cannot bundle when the wing folds, and the
 * folded idle pose is what every anatomy sheet judges. Folded, the near-
 * parallel spars sweep back along the flank a hand-width apart, with the
 * membrane sagging between them. */
/* round 25 (creature-anatomy): the fan WIDENS from ~39° to ~64° and the inner
 * finger keeps most of its length. The narrow fan was authored in round 7 so
 * the spread armature could bundle when it folded; since round 9 the fold is a
 * DIFFERENT MESH (buildFoldedWing) and this armature never folds, so nothing
 * was buying that constraint any more — it only crowded the finger bays until
 * the distal edge read as one straight cut with no scallop. */
const FINGERS: Array<{ d: [number, number, number]; len: number }> = [
  { d: [0.99, 0.02, -0.06], len: 0.78 },
  { d: [0.9, -0.05, 0.32], len: 0.74 },
  { d: [0.72, -0.1, 0.62], len: 0.66 },
  { d: [0.48, -0.16, 0.84], len: 0.56 },
];

/* ----------------------------------------------------- folded blade (r9) */

/** Signed volume (×6) of an indexed triangle mesh. Negative = inside-out. */
function signedVolume(pos: number[], index: number[]): number {
  let vol = 0;
  for (let e = 0; e < index.length; e += 3) {
    const a = index[e] * 3;
    const b = index[e + 1] * 3;
    const c = index[e + 2] * 3;
    vol +=
      pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1]) +
      pos[a + 1] * (pos[b + 2] * pos[c] - pos[b] * pos[c + 2]) +
      pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c]);
  }
  return vol;
}

/* ------------------------------------------ authored folded wing (round 22) */

/** Outline vertex tags name the anatomy each point draws; thickness and value
 * key off them. */
type FoldedTag = 'root' | 'arm' | 'spike' | 'wrist' | 'sag' | 'strut' | 'tip' | 'hem';

/**
 * round 22 (creature-anatomy): THE AUTHORED SILHOUETTE. Side-view outline of
 * the folded wing, drawn point-by-point in wing-local span fractions
 * (+z toward the head, y up; body landmarks from the round-15 measurements:
 * back line y +0.05, mid-torso y -0.115, hip front z -0.57, hips z -0.72).
 * Walk order is clockwise: root → leading-edge arm → wrist spike → three
 * finger struts with concave sag arcs between → wingtip at the hips → hem
 * back to the root. Verified in 2D before lofting: spike above the back
 * line, each strut tip convex past its sag chord, each sag concave inside
 * its strut chord, hem capped near mid-torso, tip never past the hips,
 * simple polygon, ear-clip triangulation succeeds.
 */
const FOLDED_OUTLINE: Array<{ z: number; y: number; tag: FoldedTag }> = [
  // round-22 eyeball fix: the first capture's front panel read the peak as
  // "arms raised" — the whole wrist/spike cluster RAKES REARWARD (spike
  // z 0.17 → 0.06, wrist to -0.03) so the front view foreshortens the climb
  // into a swept shoulder pack instead of a tower beside the neck.
  { z: 0.3, y: -0.12, tag: 'root' }, // buried in the body's shoulder mass
  { z: 0.33, y: 0.0, tag: 'arm' }, // thick leading-edge arm, front face
  { z: 0.27, y: 0.13, tag: 'arm' }, // arm climbing up-and-back
  { z: 0.19, y: 0.24, tag: 'arm' },
  { z: 0.08, y: 0.31, tag: 'arm' }, // front of the wrist knuckle
  { z: 0.06, y: 0.39, tag: 'spike' }, // WRIST SPIKE peak, high above the shoulder
  { z: -0.03, y: 0.29, tag: 'wrist' }, // back of the wrist — the fan's origin
  // round 23 (creature-anatomy): TRUE SCALLOPS. The round-22 "sag" points sat
  // ABOVE their strut-to-strut chords — a convex edge, one smooth hump, zero
  // scallop in any panel. Each sag pair now dips ~0.065 BELOW its chord and
  // each strut tip is raised so it projects past both neighboring notches:
  // notches A (y 0.16) and B (y 0.07) cut above the back line (y +0.05), so
  // SKY shows between the strut tips in the side and silhouette panels.
  { z: -0.09, y: 0.17, tag: 'sag' }, // membrane sag arc A (concave)
  { z: -0.14, y: 0.13, tag: 'sag' },
  { z: -0.2, y: 0.2, tag: 'strut' }, // FINGER STRUT 1 tip
  { z: -0.27, y: 0.07, tag: 'sag' }, // sag arc B
  { z: -0.33, y: 0.04, tag: 'sag' },
  { z: -0.4, y: 0.11, tag: 'strut' }, // FINGER STRUT 2 tip
  { z: -0.46, y: -0.02, tag: 'sag' }, // sag arc C
  { z: -0.52, y: -0.05, tag: 'sag' },
  { z: -0.58, y: 0.0, tag: 'strut' }, // FINGER STRUT 3 tip, at the hip front
  { z: -0.66, y: -0.09, tag: 'tip' }, // trailing wingtip — never past the hips
  { z: -0.48, y: -0.125, tag: 'hem' }, // membrane hem running forward
  { z: -0.2, y: -0.13, tag: 'hem' }, // capped at mid-torso
  { z: 0.1, y: -0.135, tag: 'hem' },
];

/** Loft half-thickness per anatomy tag (span fractions): thick at the arm
 * edge, thin at the membrane hem, sharp at the spike. */
const FOLDED_THICK: Record<FoldedTag, number> = {
  root: 0.06,
  arm: 0.055,
  spike: 0.01,
  wrist: 0.045,
  sag: 0.01,
  strut: 0.02,
  tip: 0.012,
  hem: 0.01,
};

/** 2D cross product (b−a)×(c−a) in outline (z, y) space. */
function cross2(a: { z: number; y: number }, b: { z: number; y: number }, c: { z: number; y: number }): number {
  return (b.z - a.z) * (c.y - a.y) - (b.y - a.y) * (c.z - a.z);
}

/** Deterministic ear-clipping triangulation of the authored outline — the
 * sag arcs make it concave, so no fan or convex shortcut is valid. Returns
 * index triples into the outline. */
function earClip(pts: Array<{ z: number; y: number }>): Array<[number, number, number]> {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area += a.z * b.y - b.z * a.y;
  }
  const ccw = area > 0;
  const rem = pts.map((_, i) => i);
  const tris: Array<[number, number, number]> = [];
  let guard = 0;
  while (rem.length > 3 && guard++ < 1000) {
    let clipped = false;
    for (let k = 0; k < rem.length; k++) {
      const i0 = rem[(k + rem.length - 1) % rem.length];
      const i1 = rem[k];
      const i2 = rem[(k + 1) % rem.length];
      const c = cross2(pts[i0], pts[i1], pts[i2]);
      if (ccw ? c <= 1e-12 : c >= -1e-12) continue; // reflex or degenerate corner
      let inside = false;
      for (const j of rem) {
        if (j === i0 || j === i1 || j === i2) continue;
        const c0 = cross2(pts[i0], pts[i1], pts[j]);
        const c1 = cross2(pts[i1], pts[i2], pts[j]);
        const c2 = cross2(pts[i2], pts[i0], pts[j]);
        if ((c0 > 0 && c1 > 0 && c2 > 0) || (c0 < 0 && c1 < 0 && c2 < 0)) {
          inside = true;
          break;
        }
      }
      if (inside) continue;
      tris.push([i0, i1, i2]);
      rem.splice(k, 1);
      clipped = true;
      break;
    }
    // a simple polygon always has an ear; the authored outline is verified
    // simple, so this cannot fire — no silent fallback, fail loud
    if (!clipped) throw new Error('folded wing outline is not a simple polygon');
  }
  tris.push([rem[0], rem[1], rem[2]]);
  return tris;
}

/** round-22 eyeball fix: the plane TENTS INBOARD as it rises — the first
 * capture leaned it outboard and the front panel read two raised towers
 * flanking the neck. Folded dragon wings close over the spine: the two
 * peaks now converge toward the midline, so the front view reads one
 * folded-wing tent behind the neck, not raised arms. */
const FOLDED_X0 = 0.095;
// round 23 (creature-anatomy): -0.2 → -0.14. At -0.2 the tent overshot the
// midline (top x = 0.095 − 0.2·0.53 < 0): the two wings CROSSED over the
// spine and the top panel read an X-lattice of interpenetrating plates —
// the round-22 "white patchy geometry along the spine ridge". At -0.14 the
// peaks converge to x ≈ +0.02·s and never touch.
const FOLDED_XT = -0.14;

/**
 * Pillow-loft the authored outline into ONE closed mesh: the outline is
 * offset ±half-thickness along the leaned plane's normal (outboard/inboard
 * faces), both faces are ear-clip triangulated, and a rim of quads seals the
 * silhouette edge. Winding is fixed by the signed-volume guard. Value rides
 * vertex colors: dark membrane, skin-tone arm, pale bone spike/wrist/struts.
 */
function foldedWingGeometry(ctx: PartMeshCtx, s: number, sgn: number, membraneHex: string, paleBoneHex: string): BufferGeometry {
  const n = FOLDED_OUTLINE.length;
  // leaned plane: x = X0 + XT·(y + 0.14); its outboard normal (unit, mirrored)
  const nx = 1 / Math.hypot(1, FOLDED_XT);
  const ny = -FOLDED_XT * nx;
  const skin = new Color(ctx.palette.skinHex);
  const bone = new Color(paleBoneHex);
  const membrane = new Color(membraneHex);
  // round 23 (creature-anatomy): pale bone on SPIKE and STRUT tips only. The
  // round-22 map also boned the wrist and wingtip, and the big ear-clip cap
  // triangles interpolated that into a pale flood over the whole upper fan —
  // snow-capped, not strutted. With dark sag points flanking each strut tip,
  // the pale now lands as narrow wedges converging on the notch peaks.
  const toneFor = (tag: FoldedTag): Color =>
    tag === 'root' || tag === 'arm' || tag === 'wrist' ? skin : tag === 'spike' || tag === 'strut' ? bone : membrane;
  const positions: number[] = [];
  const tint: number[] = [];
  // outboard ring [0, n), then inboard ring [n, 2n)
  for (const side of [1, -1] as const) {
    for (const p of FOLDED_OUTLINE) {
      const th = FOLDED_THICK[p.tag] * s * side;
      const bx = FOLDED_X0 + FOLDED_XT * (p.y + 0.14);
      positions.push(sgn * (bx * s + nx * th), p.y * s + ny * th, p.z * s);
      const c = toneFor(p.tag);
      tint.push(c.r, c.g, c.b);
    }
  }
  const index: number[] = [];
  // round 23 (creature-anatomy): PER-FACE orientation, not a global volume
  // flip. The round-22 mesh shipped with its caps wound INTO the slab while
  // the rim wound outward — a mixed orientation whose signed-volume sum still
  // came out positive, so the guard "passed" an inside-out surface. Culled
  // caps made the toon faces invisible and the BackSide ink hull rendered in
  // their place: the critic's featureless solid-black sail, two rounds
  // running. Every face is now tested against the direction it must face and
  // flipped individually; the closed-volume guard stays as a final assert.
  const flipTo = (a: number, b: number, c: number, want: { x: number; y: number; z: number }): [number, number, number] => {
    const ux = positions[b * 3] - positions[a * 3];
    const uy = positions[b * 3 + 1] - positions[a * 3 + 1];
    const uz = positions[b * 3 + 2] - positions[a * 3 + 2];
    const vx = positions[c * 3] - positions[a * 3];
    const vy = positions[c * 3 + 1] - positions[a * 3 + 1];
    const vz = positions[c * 3 + 2] - positions[a * 3 + 2];
    const dot =
      (uy * vz - uz * vy) * want.x + (uz * vx - ux * vz) * want.y + (ux * vy - uy * vx) * want.z;
    return dot >= 0 ? [a, b, c] : [a, c, b];
  };
  const outboard = { x: sgn * nx, y: ny, z: 0 };
  const inboard = { x: -outboard.x, y: -outboard.y, z: 0 };
  for (const [a, b, c] of earClip(FOLDED_OUTLINE)) {
    index.push(...flipTo(a, b, c, outboard)); // outboard cap faces outboard
    index.push(...flipTo(n + a, n + b, n + c, inboard)); // inboard cap faces inboard
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // rim faces point along the outline edge's outward 2D normal (z, y plane)
    const ez = FOLDED_OUTLINE[j].z - FOLDED_OUTLINE[i].z;
    const ey = FOLDED_OUTLINE[j].y - FOLDED_OUTLINE[i].y;
    // outline walks clockwise in (z, y): outward normal = rotate edge -90°
    const rim = { x: 0, y: -ez, z: ey };
    index.push(...flipTo(i, j, n + j, rim));
    index.push(...flipTo(i, n + j, n + i, rim));
  }
  // consistent outward orientation ⇒ positive enclosed volume; fail loud
  if (signedVolume(positions, index) < 0) {
    throw new Error('folded wing loft wound inside-out after per-face orientation');
  }
  const indexed = new BufferGeometry();
  indexed.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  indexed.setAttribute('color', new BufferAttribute(new Float32Array(tint), 3));
  indexed.setIndex(index);
  const geometry = indexed.toNonIndexed(); // flat facets, matching the body
  geometry.computeVertexNormals();
  indexed.dispose();
  return geometry;
}

/**
 * The complete folded wing: ONE closed authored-silhouette loft, ONE mesh,
 * ONE ink outline (the assembler's inverse-hull shell traces the silhouette
 * — which now IS the authored arm + spike + struts + sags polygon). The
 * folded membrane runs darker than the spread armature's so the pale bone
 * spike/wrist/strut tips land whole toon bands lighter.
 */
function buildFoldedWing(ctx: PartMeshCtx, s: number, sgn: number): Group {
  const folded = new Group();
  folded.name = 'wingFolded';
  // round 23 (creature-anatomy): membrane base 0.5 → 0.68 — a near-black
  // surface carries NO internal detail under the toon ramp; one value step
  // up leaves the pale bone spike/wrist/strut tints whole bands lighter and
  // the ink silhouette line still darker than the membrane.
  const membraneHex = wingColor(ctx, shadeHex(ctx.palette.skinHex, 0.68));
  // round 23: 0.45 → 0.3 — chalk-white tips read as snow, not bone
  const paleBoneHex = tintHex(ctx.palette.skinHex, 0.3);
  const material = ctx.material('#ffffff');
  material.vertexColors = true;
  folded.add(new Mesh(foldedWingGeometry(ctx, s, sgn, membraneHex, paleBoneHex), material));
  return folded;
}


const wingsMembrane: PartDef = {
  id: 'wingsMembrane',
  anchor: 'back',
  kind: 'mesh',
  buildMesh(ctx: PartMeshCtx) {
    // planned creatures pass scale (frame height understates a long dragon)
    const s = span(ctx.frame) * (Number(ctx.params.scale) || 1);
    // round 7 second pass: sized so the FOLDED wing dominates the upper
    // silhouette — elbow peak ~0.7 span-fractions above the shoulder line,
    // finger spars reaching past mid-body along the flank.
    const humerus = s * 0.36;
    const forearm = s * 0.4;
    const group = new Group();
    // round 19 (creature-anatomy): membrane lightened 0.55 → 0.66 so the
    // vertex-color spar bands (×0.5 value) land two toon bands darker and
    // read at sheet distance against the dark hide
    const membraneHex = wingColor(ctx, shadeHex(ctx.palette.skinHex, 0.66));
    const boneHex = shadeHex(ctx.palette.skinHex, 0.3);
    const markNoOutline = (m: Mesh): Mesh => {
      (m.userData as { noOutline?: boolean }).noOutline = true;
      return m;
    };

    for (const [name, sgn] of [
      ['wingL', -1],
      ['wingR', 1],
    ] as const) {
      const wing = new Group();
      wing.name = name;

      // Mirror-aware helpers. In each joint's right-handed local frame,
      // "tailward" is local -Z on the right wing and +Z on the left (the
      // mirrored basis flips Z), so local points are authored as
      // [alongBone, up, back] and mapped here.
      const mv = (v: readonly number[]) => new Vector3(sgn * v[0], v[1], v[2]);
      const lp = (a: number, u: number, b: number): [number, number, number] => [a, u, -sgn * b];
      const ld = (v: readonly [number, number, number]) => new Vector3(v[0], v[1], -sgn * v[2]);

      // World pose quaternions per joint, then parent-local conversions so
      // nested slerps compose without per-frame vector math.
      const world = (pose: WingPose) => ({
        arm: basisQuat(mv(pose.arm.dir), mv(pose.arm.up)),
        elbow: basisQuat(mv(pose.elbow.dir), mv(pose.elbow.up)),
        hand: basisQuat(mv(pose.hand.dir), mv(pose.hand.up)),
      });
      const ws = world(POSE.spread);
      const wf = world(POSE.folded);
      const local = (w: ReturnType<typeof world>) => ({
        arm: w.arm.clone(),
        elbow: w.arm.clone().invert().multiply(w.elbow),
        hand: w.elbow.clone().invert().multiply(w.hand),
      });
      const ls = local(ws);
      const lf = local(wf);

      // --- shoulder joint (the whole arm): humerus + propatagium + boss
      const arm = new Group();
      arm.name = 'wingArm';
      arm.position.set(sgn * s * 0.09, s * 0.04, 0);
      arm.quaternion.copy(ls.arm);
      (arm.userData as { wingJoint?: WingJointPose }).wingJoint = {
        spread: ls.arm,
        folded: lf.arm,
        beatSign: -sgn,
      };
      arm.add(boneX(ctx, humerus, s * 0.042, s * 0.03, boneHex));
      arm.add(shoulderBoss(ctx, s));
      wing.add(arm);

      // --- elbow joint: forearm bone + web + elbow knob
      const elbow = new Group();
      elbow.name = 'wingElbow';
      elbow.position.set(humerus, 0, 0);
      elbow.quaternion.copy(ls.elbow);
      (elbow.userData as { wingJoint?: WingJointPose }).wingJoint = {
        spread: ls.elbow,
        folded: lf.elbow,
        beatSign: 0,
      };
      elbow.add(boneX(ctx, forearm, s * 0.03, s * 0.02, boneHex));
      const elbowKnob = new Mesh(new SphereGeometry(s * 0.03, 8, 6), ctx.material(ctx.palette.skinHex));
      elbow.add(elbowKnob);
      arm.add(elbow);

      // --- wrist joint: thumb spike, finger spars, draped distal membrane
      const hand = new Group();
      hand.name = 'wingHand';
      hand.position.set(forearm, 0, 0);
      hand.quaternion.copy(ls.hand);
      (hand.userData as { wingJoint?: WingJointPose }).wingJoint = {
        spread: ls.hand,
        folded: lf.hand,
        beatSign: 0,
      };
      const wristKnob = new Mesh(new SphereGeometry(s * 0.026, 8, 6), ctx.material(ctx.palette.skinHex));
      hand.add(wristKnob);
      // thumb spike: continues the leading edge past the wrist — folded, the
      // two spikes rise over the shoulders and frame the neck in front view.
      // authored so the folded hand frame maps it to world-up: the spikes
      // rise over the shoulders and frame the neck in the front view
      const spikeDir = ld([-0.25, 0.3, 0.85]).normalize();
      const spikeLen = s * 0.2;
      const spike = new Mesh(new ConeGeometry(s * 0.02, spikeLen, 5), ctx.material(shadeHex(ctx.palette.skinHex, 0.28)));
      spike.position.copy(spikeDir).multiplyScalar(spikeLen * 0.5);
      spike.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), spikeDir);
      markNoOutline(spike);
      hand.add(spike);
      // finger spars: THE structure the folded wing must show — thicker at the
      // knuckle, dark against the membrane, fanning back along the body.
      const tips: Vector3[] = [];
      for (const finger of FINGERS) {
        const dir = ld(finger.d).normalize();
        const len = finger.len * s;
        const sparMesh = new Mesh(new CylinderGeometry(s * 0.007, s * 0.015, len, 5), ctx.material(boneHex));
        sparMesh.position.copy(dir).multiplyScalar(len / 2);
        sparMesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir);
        markNoOutline(sparMesh);
        hand.add(sparMesh);
        tips.push(dir.multiplyScalar(len));
      }
      elbow.add(hand);

      // round 24 (creature-anatomy): ONE SHEET, BODY TO WINGTIP. Rounds 22-23
      // drew three membrane fans, one per joint frame (propatagium on the arm,
      // web on the elbow, drape on the hand). Three frames means three
      // boundaries that only line up by luck, and the round-23 verdict read
      // the result as "a broken umbrella ... disjoint triangular flags with
      // visible gaps". The membrane is now a SINGLE fan authored in the ARM's
      // frame, with the shoulder root as its apex: every triangle shares that
      // apex, so the sheet is closed from the body to the outline by
      // construction — there is no interior edge left to gap.
      //
      // The outline traces only the LEADING edge (elbow → wrist → fingertips)
      // and the distal scallops; the trailing edge is the implicit apex→last
      // point run, which is exactly a bat's trailing edge sweeping back to the
      // flank. Sag points between the struts give the drape.
      //
      // Legal because the spread pose is rigid through this subtree (elbow and
      // hand carry beatSign 0, so a wing beat rotates the arm and everything
      // under it together). While the wing folds, the assembler cross-scales
      // this armature out and the dedicated folded blade in.
      //
      // round 25 (creature-anatomy): THE BRACHIOPATAGIUM. The round-24 fan was
      // apexed at the shoulder ROOT with its first outline point at the elbow
      // and its last at 0.55 of the innermost fingertip — both nearly along
      // the humerus, so the wedge angle AT the apex was a few degrees and the
      // sheet had ~zero width beside the upper arm. The round-24 verdict named
      // it exactly: "a bare cylindrical humerus ... with open sky on both
      // sides, and the membrane only begins above that elbow ... a flag on a
      // pole with the brachiopatagium missing entirely".
      //
      // The outline now CLOSES ON THE BODY: after the last fingertip it walks
      // a sagging trailing edge inboard to a FLANK point below and behind the
      // shoulder. The apex fan therefore opens through a wide angle at the
      // shoulder and the sheet is unbroken from the flank to the wingtip —
      // real bat/drake anatomy, where the membrane spans shoulder-to-elbow
      // along the body side.
      {
        const qElbow = ls.elbow;
        const qHand = ls.elbow.clone().multiply(ls.hand);
        const elbowP = new Vector3(humerus, 0, 0);
        const wristP = elbowP.clone().add(new Vector3(forearm, 0, 0).applyQuaternion(qElbow));
        const armTips = tips.map((t) => t.clone().applyQuaternion(qHand).add(wristP));
        const outline: Array<[number, number, number]> = [
          [elbowP.x, elbowP.y, elbowP.z],
          [wristP.x, wristP.y, wristP.z],
        ];
        /** Catenary dip between two edge points: the membrane HANGS. Depth is
         * a fraction of the bay width, so every bay scallops in proportion —
         * the round-24 verdict read "every trailing edge is a dead-straight
         * line with zero sag or scallop between fingers". */
        const bay = (a: Vector3, b: Vector3, depth: number, pull: number): [number, number, number] => {
          const mid = a.clone().add(b).multiplyScalar(0.5).lerp(wristP, pull);
          mid.y -= a.distanceTo(b) * depth;
          return [mid.x, mid.y, mid.z];
        };
        for (let i = 0; i < armTips.length; i++) {
          outline.push([armTips[i].x, armTips[i].y, armTips[i].z]);
          if (i < armTips.length - 1) {
            outline.push(bay(armTips[i], armTips[i + 1], 0.42, 0.1));
          }
        }
        // The flank anchor, in the ARM's own frame: down and rearward from the
        // shoulder root, on the body wall. Authored in wing-local space (x
        // lateral, y up, z toward the head) and pulled back through the arm's
        // spread rotation, so it lands on the FLANK whatever pose the arm
        // holds.
        const flank = new Vector3(sgn * s * 0.02, -s * 0.42, -s * 0.3).applyQuaternion(
          ls.arm.clone().invert(),
        );
        // the trailing edge runs fingertip → flank in THREE sagging steps, so
        // the long rear edge scallops like a drape instead of cutting one
        // dead-straight chord back to the body
        const lastTip = armTips[armTips.length - 1];
        for (const k of [0.62, 0.32] as const) {
          const p = lastTip.clone().lerp(flank, 1 - k);
          p.y -= s * 0.13 * Math.sin((1 - k) * Math.PI);
          outline.push([p.x, p.y, p.z]);
        }
        outline.push([flank.x, flank.y, flank.z]);
        arm.add(markNoOutline(new Mesh(membraneFan([0, 0, 0], outline), ctx.material(membraneHex))));
      }

      // round 9 (creature-anatomy): the dedicated folded-wing blade — the
      // assembler cross-scales this against the armature by wingFold, so the
      // idle sheet shows ONE continuous shoulder-rooted membrane blade instead
      // of the armature crumpled into panel clutter.
      wing.add(buildFoldedWing(ctx, s, sgn));

      group.add(wing);
    }
    return { object: group };
  },
};

export const WING_PARTS: PartDef[] = [wingsFeathered, wingsMembrane];
