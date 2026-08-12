/**
 * @file smoothBipedGeometry.ts — slice 3 of the entity skeleton pivot: the
 * one-piece smooth biped. Each bone chain (torso column, each arm, each leg)
 * lofts as ONE continuous tube whose vertices blend between the two adjacent
 * bones across a smoothstep zone at every interior joint — elbows and knees
 * crease instead of shearing apart. Terminal pieces (head, deltoids) stay
 * rigid spheres, merged into the same geometry; hands are flattened mitt
 * tubes (palm continues the arm chain, thumb is its own capped tube), and
 * feet are heel-to-toe wedge tubes rigid to the foot bones (round 5).
 *
 * Spec: docs/superpowers/specs/2026-07-17-entity-skeleton-pivot-design.md
 * Plan: docs/superpowers/plans/2026-07-23-skeleton-smooth-bodies.md
 *
 * What changed: new file. Why: rigid weights (slice 1) reproduce the segment
 * look; the smooth look needs different geometry AND weights, kept behind
 * skinnedBody's `weights: 'smooth'` option until the eyeball gate passes.
 * Winding guard: each closed tube's signed volume is measured after build and
 * the index order flipped if negative — the Emberwing inside-out lesson as
 * code, not vigilance.
 */
import { BufferAttribute, BufferGeometry, SphereGeometry, Uint16BufferAttribute, Vector3 } from 'three';
import type { Frame } from '../types';
import type { BipedBoneName, BipedRestPose } from './skeletonBuilder';

export interface ChainDef {
  /** Rest segment ids in root→tip order; segment k is owned by its own bone. */
  segIds: string[];
}

/** The chains of the smooth biped, in build order.
 * round 2 (humanoid-anatomy): each arm chain lofts THROUGH the wrist into the
 * palm segment — the mitt is a continuation of the arm, not a glued-on ball —
 * and each thumb is its own short capped tube rigid to the hand bone. */
export const SMOOTH_CHAINS: readonly ChainDef[] = [
  { segIds: ['torso.pelvis', 'torso.chest', 'neck'] },
  // round 15 (humanoid-anatomy): the arm chain lofts THROUGH the palm into a
  // curled FINGER MASS bent toward the knuckle front — the bend puts a real
  // knuckle plane break on the fist silhouette (the round-6/8 crest rings
  // never survived the toon ramp at panel distance).
  { segIds: ['armL.upper', 'armL.fore', 'handL.palm', 'handL.fingers'] },
  { segIds: ['handL.thumb'] },
  { segIds: ['armR.upper', 'armR.fore', 'handR.palm', 'handR.fingers'] },
  { segIds: ['handR.thumb'] },
  { segIds: ['legL.thigh', 'legL.shin'] },
  { segIds: ['legR.thigh', 'legR.shin'] },
  // round 5 (humanoid-anatomy): heel-to-toe wedge feet — each foot is its own
  // short capped tube rigid to the foot bone (like the thumbs), replacing the
  // terminal nub-ball spheres
  { segIds: ['footL'] },
  { segIds: ['footR'] },
];

const RADIAL = 12;
/** Blend zone width as a fraction of the shorter adjacent bone length.
 * round 1 (humanoid-anatomy): 0.48 → 0.34 — the half-bone blend rounded the
 * knee/elbow into a rubber-hose curve; a tighter zone keeps a visible hard
 * break at the joint while still creasing instead of shearing. */
const ZONE_FACTOR = 0.34;
/** round 3 (humanoid-anatomy): the chest→neck joint blends across nearly the
 * full shorter adjacent length — the 1.0 r chest top slides into the 0.52 r
 * neck root as a trapezius slope instead of a stepped shelf. All other
 * joints keep the tight ZONE_FACTOR crease. */
const NECK_ZONE_FACTOR = 0.9;
/** round 15 (humanoid-anatomy): the palm→fingers joint creases TIGHT — the
 * knuckle plane break must stay a hard bend, not a rubber-hose curve. */
const KNUCKLE_ZONE_FACTOR = 0.22;
/** round 16 (humanoid-anatomy): the belt joint creases tighter than the limb
 * default — on short bulky torsos (dwarf) the 0.34 zone spanned most of the
 * pelvis and chest segments and smeared the 0.9→waist→1.12 profile into an
 * unpinched barrel. */
const BELT_ZONE_FACTOR = 0.26;
/** round 17 (humanoid-anatomy): arm links shrank 0.52 → 0.4 armLen (the
 * hanging-arm fix), which shrank the elbow blend zone with them and pushed
 * the 90° bend stretch past its budget. 0.5 restores (slightly over) the
 * ABSOLUTE zone width the 0.34 factor had on the old links. */
const ELBOW_ZONE_FACTOR = 0.5;
/** round 18 (humanoid-anatomy): the WRIST joint creases tight — the round-17
 * verdict called the shield-hand wrist merge "mushy in 3/4"; the default 0.34
 * zone smeared the forearm-taper-into-palm-block step on big-fisted frames
 * (the dwarf's skull-floored handR). Same trick as the knuckle. */
const WRIST_ZONE_FACTOR = 0.22;
const zoneFactorFor = (downstreamSegId: string): number =>
  downstreamSegId === 'neck' ? NECK_ZONE_FACTOR
  : downstreamSegId.endsWith('.fingers') ? KNUCKLE_ZONE_FACTOR
  : downstreamSegId.endsWith('.palm') ? WRIST_ZONE_FACTOR
  : downstreamSegId.endsWith('.fore') ? ELBOW_ZONE_FACTOR
  : downstreamSegId === 'torso.chest' ? BELT_ZONE_FACTOR
  : ZONE_FACTOR;
/** Rings across each blend zone (odd — one ring sits on the joint). */
const ZONE_RINGS = 5;

interface Station {
  pos: Vector3;
  tangent: Vector3;
  radius: number;
  bone0: number;
  bone1: number;
  w0: number;
  w1: number;
  /** Binormal (front-back) scale — hand pieces squash to a mitt. */
  flat: number;
  /** 0 round … 1 squared-off ring (rounded-rectangle cross-section) — hand
   * pieces read as blocks, not sausages (round 6, humanoid-anatomy). */
  sq: number;
  /** Vertex-color RGB multiplier ([1,1,1] = skin). round 13
   * (humanoid-anatomy): below-belt pieces shift toward desaturated leather
   * browns (trousers/boots) and the belt joint carries a near-black band —
   * the material break that kills the naked one-tone read. A pure greyscale
   * darken FAILED here first: 0.66× landed exactly on the toon ramp's own
   * shadow band, so the trousers read as shading. The HUE shift is what
   * survives the quantized ramp. */
  tint: readonly [number, number, number];
  /** Per-vertex ink-shell weight (1 = full hull thickness). round 16
   * (humanoid-anatomy): hands attenuate to 0.45 — the uniform hull inked the
   * thumb/knuckle creases shut and rounded the fist into a ball. */
  ink: number;
  /** 0..1 sternum carve — pec rings dent and darken their front-center
   * vertex column so the chest splits into two plates on a sternum line
   * instead of one tangent-sphere roll (round 16, humanoid-anatomy). */
  sternum: number;
  /** 0..1 FRONT-ONLY swell — scales vertices by frontness² so the pec ledge
   * bulges the chest front without wrapping the back as a raised ring (the
   * round-16 uniform ×1.07 ring was one of the "horizontal ring seams",
   * round 17 humanoid-anatomy). */
  pec: number;
  /** Front-only tint override, blended in by frontness — the under-pec
   * shadow line must not wrap the back as a seam (round 17). */
  frontTint: readonly [number, number, number] | null;
  /** 0..1 tunic weave — alternate vertex columns drop a value step so the
   * cloth reads as woven, not glazed ceramic (round 17, humanoid-anatomy). */
  weave: number;
  /** 0..1 inseam split — thigh-root rings darken and re-ink their INNER
   * vertex columns so each leg roots separately instead of merging into one
   * pelvis fairing (round 19, Remy: "HIPS?!?!" — no leg separation at the
   * root in the front view). */
  inseam: number;
  /** +1 when the chain's inner side is +X (left leg), −1 for the right. */
  inSgn: number;
}

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** round 6 (humanoid-anatomy): the palm flattens to 0.42 of its radius — a
 * slab roughly half the wrist's depth (round 2's 0.62 still read as a ball at
 * sheet distance); the thumb wedge stays chunkier at 0.66.
 * round 13 (humanoid-anatomy): torso rings go ELLIPTICAL — chest 1.18 deep —
 * so the side view stops being paper-thin through the chest (the flat factor
 * scales the binormal, which is the front-back axis on the vertical torso
 * chain). round 14: pelvis depth 1.12 → 1.0 — the deep hip ellipse was the
 * side-view "rump-pod"; the glutes must tuck under the ribcage, not swell
 * past it. */
/** round 15 (humanoid-anatomy): the palm thickens 0.42 → 0.55 and the finger
 * mass rides 0.58 — a FIST is a chunky block, not a slab; the 0.42 slab's
 * wide front face read as a fingerless sphere at panel distance. */
/** round 19 (humanoid-anatomy): palm/finger depth 0.55/0.58 → 0.62 — Remy's
 * live view read the (now smaller) fist as "a giant flat slab"; a chunkier
 * cross-section keeps the block read without regrowing the width. */
const flatOf = (segId: string): number =>
  segId.endsWith('.palm') ? 0.62
  : segId.endsWith('.fingers') ? 0.62
  : segId.endsWith('.thumb') ? 0.66
  : segId === 'torso.chest' ? 1.18
  : segId === 'torso.pelvis' ? 1.0
  : 1;

/** round 13 (humanoid-anatomy): RGB tint per segment — hips and legs read as
 * leather-brown trousers, feet as darker boots, everything else keeps skin.
 * Multiplicative over the race skin hex, so outfits stay race-consistent. */
const SKIN_TINT: readonly [number, number, number] = [1, 1, 1];
/** round 17 (humanoid-anatomy): the chest wears a TUNIC — a warm khaki
 * hue-shift over the race skin (the Valheim reference torso carries cloth
 * value texture; ours read as bare glazed ceramic). Multiplicative, so the
 * cloth stays race-consistent; the weave stripes ride on top. */
/** round 20 (humanoid-anatomy): the khaki [0.82,0.74,0.58] over pale human
 * skin multiplied out to another skin tan — the round-19 verdict's "bare
 * shop-mannequin, two flat skin values". Skin is always r>g>b; a multiplier
 * with g ≥ r is the only multiplicative shift that can break the skin hue
 * family. Olive-drab wool now — over every race skin it lands on a cloth
 * olive, never a tan. */
/** The BARE-torso base (orc, dwarf) — a warm khaki over the race skin that
 * still reads as a muscled chest under the value ladder. Round 19 praised the
 * orc's "visible pec/ab value ladder" and the dwarf's torso banding on it, so
 * bulky frames keep exactly this. */
const TORSO_TINT: readonly [number, number, number] = [0.66, 0.7, 0.52];
/** round 20 (humanoid-anatomy): slim frames wear a REAL TUNIC. Round 19: the
 * human "reads as a bare shop-mannequin — two flat skin values", losing to the
 * Valheim player on CLOTHES. Two things kept the round-17 khaki in the skin
 * family: (1) at 0.66/0.70/0.52 over pale human skin it landed on another tan,
 * and (2) the pec ladder's skin-brown band tints are front-weighted by
 * frontness², so the whole FRONT of the chest — the only part the panel sees —
 * was repainted back to skin. Now: a decisive dark wool olive (g > r breaks
 * the r>g>b skin family; ~0.45 value crosses at least one toon band), and the
 * ladder bands are re-expressed as ratios over the cloth (see `band` below) so
 * the muscle stations survive as cloth folds instead of bare skin. */
const TUNIC_TINT: readonly [number, number, number] = [0.4, 0.47, 0.31];
const TROUSER_TINT: readonly [number, number, number] = [0.52, 0.4, 0.34];
/** round 20 (humanoid-anatomy): slim frames wear SLEEVES — the upper arms
 * carry the tunic cloth, the forearms stay skin, and a dark hem ring at the
 * elbow joint draws the cloth boundary (the belt/knuckle band trick). The
 * skin-vs-cloth break at mid-arm is the strongest "clothed, not mannequin"
 * signal the Valheim reference carries. Bulky frames (orc, dwarf) keep bare
 * muscled arms — gated by the same softening the pec ladder uses. */
const SLEEVE_HEM_TINT: readonly [number, number, number] = [0.3, 0.28, 0.22];
const BOOT_TINT: readonly [number, number, number] = [0.36, 0.28, 0.24];
/** round 15 (humanoid-anatomy): the curled finger mass sits a step darker
 * than the palm so the fist splits into two values at panel distance.
 * round 16: the 0.88 greyscale step sat inside ONE toon band — invisible, the
 * exact round-13 trouser lesson. HUE-shifted warm-dark now, like the
 * trousers: the shift survives the quantized ramp. */
const FINGER_TINT: readonly [number, number, number] = [0.82, 0.72, 0.62];
/** round 15 (humanoid-anatomy): the thumb crosses the skin-toned palm front —
 * same-value skin-on-skin vanished at panel distance, so the thumb carries
 * its own step down. round 16: hue-shifted (see FINGER_TINT).
 * round 19: THIRD thumb strike. Zoom diagnosis: the lobe IS in the render
 * (visible as a lighter facet mass at 4×) but its tint sat one shade from
 * the finger mass and the 0.45 hand ink drew no line between them — the
 * fist re-fused into one boulder at panel distance. The thumb now carries a
 * decisive hue+value step of its own... */
const THUMB_TINT: readonly [number, number, number] = [0.68, 0.55, 0.46];
const tintOf = (segId: string): readonly [number, number, number] =>
  segId === 'torso.pelvis' || segId.startsWith('leg') ? TROUSER_TINT
  : segId === 'torso.chest' ? TORSO_TINT
  : segId.startsWith('foot') ? BOOT_TINT
  : segId.endsWith('.fingers') ? FINGER_TINT
  : segId.endsWith('.thumb') ? THUMB_TINT
  : SKIN_TINT;

/** The near-black leather belt band at the pelvis→chest joint ring. */
const BELT_TINT: readonly [number, number, number] = [0.2, 0.16, 0.14];
/** round 15 (humanoid-anatomy): dark knuckle line at the palm→fingers joint
 * ring — the seam that reads as four knuckles when the geometry quantizes
 * flat under the toon ramp. */
const KNUCKLE_TINT: readonly [number, number, number] = [0.58, 0.52, 0.49];
/** round 15 (humanoid-anatomy): under-pec shadow line — the value break that
 * splits the flat single-value front torso into abdomen and chest plate.
 * round 19: [0.74,0.69,0.66] was a near-grey nudge that quantized into the
 * tunic's own band — the round-18 verdict saw "zero value breaks". Deep warm
 * shift now, the belt/trouser trick at chest scale. */
const UNDERPEC_TINT: readonly [number, number, number] = [0.62, 0.53, 0.46];
/** round 19 (humanoid-anatomy): clavicle/collar line — the top of the torso
 * value ladder the round-18 verdict demanded ("no clavicle line, no pec
 * shelf, no ab tiers"). Rides the 0.87 pec-step ring, front-only. */
const CLAVICLE_TINT: readonly [number, number, number] = [0.6, 0.52, 0.44];
/** round 19 (humanoid-anatomy): ab tier break lines — two front-only value
 * breaks that split the abdomen into readable tiers. NOT the round-15
 * geometric ab-band ladder (which wrapped the back and read as ring seams):
 * hue-shifted tint lines, front-weighted, zero silhouette change. */
const AB_TINT: readonly [number, number, number] = [0.68, 0.58, 0.48];
/** round 19 (humanoid-anatomy): inner-thigh inseam shade — darker than the
 * trousers so the crotch reads as two rooted legs, not one fairing. */
const INSEAM_DARKEN: readonly [number, number, number] = [0.62, 0.6, 0.62];

/** round 6 (humanoid-anatomy): hand pieces square their rings so the palm has
 * flat faces and hard-ish corners — the knuckle plane needs an edge to live
 * on, and a squared slab cannot be mistaken for a ball. */
const sqOf = (segId: string): number => (segId.startsWith('hand') ? 1 : 0);

/** round 16 (humanoid-anatomy): per-vertex ink-shell weight. The uniform
 * inverse-hull thickness (hM * 0.011) is wider than the valleys between
 * hand-scale forms — the ink filled the thumb/palm and knuckle creases and
 * redrew the fist's outer contour as one boulder. Hands carry 0.45 of the
 * hull so the carved forms keep their negative space. */
const inkOf = (segId: string): number =>
  // round 19 (humanoid-anatomy): the THUMB re-inks to near-full — with the
  // fist mass at 0.45 the thumb's own hull rim is what draws the split at
  // the thumb-fist valley (the second separation channel; the tint step is
  // the first). Order matters: 'handL.thumb' also startsWith('hand').
  segId.endsWith('.thumb') ? 0.95
  : segId.startsWith('hand') ? 0.45
  // round 17 (humanoid-anatomy): the forearm carries a lighter hull (0.75) —
  // the full-thickness ink bridged the narrow wrist throat between the
  // forearm taper and the fist and redrew arm+fist as one sausage.
  : segId.endsWith('.fore') ? 0.75
  // round 19: boot hull drops to 0.7 — the full hull sprouted black spurs
  // off the small toe cap ("broken lumps", Remy).
  : segId.startsWith('foot') ? 0.7
  : 1;

/** How far a full-sq ring is pulled from the circle toward the square.
 * round 8 (humanoid-anatomy): 0.7 → 0.85 — the flat palm faces washed out
 * to a mitten on slim (human/dwarf) frames; only hand rings carry sq > 0,
 * so the harder pull sharpens hands without touching any other chain. */
const SQ_STRENGTH = 0.85;

/** Build the ring stations for one chain: segment ends, mid-bone rings, and
 * smoothstep-weighted rings across each interior joint. */
function chainStations(
  restPose: BipedRestPose,
  boneIndex: ReadonlyMap<BipedBoneName, number>,
  def: ChainDef,
  /** round 18 (humanoid-anatomy): 0..1 pec-ladder strength — bulky frames
   * soften the sternum carve / pec ledge / under-pec line, see below. */
  soft = 1,
): Station[] {
  const segs = def.segIds.map((id) => {
    const seg = restPose.segments.find((s) => s.id === id);
    if (!seg) throw new Error(`smooth biped: rest segment "${id}" missing`);
    return seg;
  });
  // round 20 (humanoid-anatomy): sleeves on slim frames only (soft tracks
  // 1/bulk — human 1, orc ≈0.55, dwarf ≈0.45)
  const sleeved = soft >= 0.75;
  // round 20 (humanoid-anatomy): the tunic covers the CHEST and the upper arms
  // on slim frames only. Bulky frames (orc, dwarf) keep the bare khaki torso
  // and bare muscled arms the round-19 verdict praised.
  const tintFor = (segId: string): readonly [number, number, number] =>
    sleeved && (segId.endsWith('.upper') || segId === 'torso.chest') ? TUNIC_TINT : tintOf(segId);
  const stations: Station[] = [];
  const push = (
    seg: (typeof segs)[number],
    t: number,
    bone0: number,
    bone1: number,
    w0: number,
    w1: number,
    flat = flatOf(seg.id),
    radius?: number,
    sq = sqOf(seg.id),
    tint = tintFor(seg.id),
    sternum = 0,
    ink = inkOf(seg.id),
    pec = 0,
    frontTint: readonly [number, number, number] | null = null,
  ) => {
    const a = new Vector3(...seg.a);
    const b = new Vector3(...seg.b);
    const pos = a.clone().lerp(b, t);
    const tangent = b.clone().sub(a).normalize();
    // round 20 (humanoid-anatomy): sleeves carry the tunic weave too
    const weave = seg.id === 'torso.chest' || (sleeved && seg.id.endsWith('.upper')) ? 1 : 0;
    // round 19 (humanoid-anatomy): thigh-root rings carry the inseam split —
    // strongest at the hip, fading out by mid-thigh.
    const isThigh = seg.id.endsWith('.thigh');
    const inseam = isThigh ? Math.max(0, 1 - Math.max(0, t) / 0.5) : 0;
    const inSgn = isThigh ? (seg.id.startsWith('legL') ? 1 : -1) : 0;
    stations.push({ pos, tangent, radius: radius ?? seg.r0 + (seg.r1 - seg.r0) * t, bone0, bone1, w0, w1, flat, sq, tint, ink, sternum, pec, frontTint, weave, inseam, inSgn });
  };

  for (let k = 0; k < segs.length; k++) {
    const seg = segs[k];
    const bone = boneIndex.get(seg.bone)!;
    const len = new Vector3(...seg.b).distanceTo(new Vector3(...seg.a));
    const prevLen = k > 0 ? new Vector3(...segs[k - 1].b).distanceTo(new Vector3(...segs[k - 1].a)) : 0;
    // fraction of THIS segment consumed by the zones at its ends
    // round 3 (humanoid-anatomy): the factor is per-joint (keyed by the
    // downstream segment) so the chest→neck zone can widen into a trapezius
    const zoneIn = k > 0 ? (zoneFactorFor(seg.id) * Math.min(prevLen, len)) / 2 / len : 0;
    const nextLen = k < segs.length - 1 ? new Vector3(...segs[k + 1].b).distanceTo(new Vector3(...segs[k + 1].a)) : 0;
    const zoneOut = k < segs.length - 1 ? (zoneFactorFor(segs[k + 1].id) * Math.min(len, nextLen)) / 2 / len : 0;

    if (k === 0) {
      // round 13 (humanoid-anatomy): GLUTE TUCK — the torso chain no longer
      // ends in the flat "skirt-hem" disc the round-12 verdict named. Two
      // extrapolated rings below the pelvis root (0.88 r0 then 0.52 r0)
      // round the hip mass down into the crotch, so the thighs read as
      // rooted INTO it instead of hanging from a hem.
      // round 15 (humanoid-anatomy): the tuck SHORTENS (−0.58 → −0.3 r0) and
      // FLATTENS (0.8 depth) — the round-13 drop hung a trouser-tinted blob
      // between the orc's thighs that the critic read as a dangling
      // loincloth "third limb". The hem still rounds; it just stops at the
      // crotch line instead of below it.
      // round 19 (humanoid-anatomy): three tuck rings — smoother glute curve
      // (the two-ring jump read as boxy corners in Remy's back view), wider
      // at the bottom so the round-18 "dark void gap at the crotch" closes.
      // The lower rings carry a STERNUM-style front-center carve: the dent +
      // dark column is the crotch V that splits the front into two rooted
      // thighs instead of one smooth fairing (Remy: "HIPS?!?!").
      if (seg.id === 'torso.pelvis') {
        push(seg, -(seg.r0 * 0.36) / len, bone, 0, 1, 0, 0.75, seg.r0 * 0.6, 0, tintOf(seg.id), 0.7);
        push(seg, -(seg.r0 * 0.24) / len, bone, 0, 1, 0, 0.85, seg.r0 * 0.8, 0, tintOf(seg.id), 0.6);
        push(seg, -(seg.r0 * 0.12) / len, bone, 0, 1, 0, 0.95, seg.r0 * 0.96);
      }
      push(seg, 0, bone, 0, 1, 0); // chain root ring, rigid
    }
    // mid-bone ring, rigid (between the zones)
    // round 15 (humanoid-anatomy): the chest replaced its single mid ring
    // with a PEC LADDER of stacked rings — which the round-15 verdict read
    // as "soft horizontal ab bands". round 16: ONE break, high. A plain mid
    // ring keeps the belly volume, the UNDERPEC line rides at 0.68 (the
    // clavicle-to-pec break's shadow edge), the pec ledge swells at 0.78,
    // and the pec block steps back at 0.87. The ledge rings also carry a
    // STERNUM carve (front-center dent + dark vertex column) so the chest
    // reads as two plates meeting at a sternum line, not tangent spheres.
    if (seg.id === 'torso.chest') {
      // round 17 (humanoid-anatomy): the pec ladder goes FRONT-ONLY. The
      // round-16 under-pec tint wrapped the whole ring and the ×1.07 pec
      // swell raised the back too — the critic's "ceramic dress-form with
      // horizontal ring seams". The shadow line now blends in by frontness
      // (frontTint) and the ledge bulges by frontness² (pec), so the back
      // and sides stay one continuous surface.
      // round 18 (humanoid-anatomy): the ladder softens with bulk (soft<1) —
      // the round-17 orc chest read as "stacked armor plates rather than
      // pectoral muscle over a ribcage"; on big-r frames the full-strength
      // sternum carve + ledge + shadow line cut the chest into plates. The
      // under-pec line eases toward the tunic tint, the carve and ledge
      // scale down, and the chest reads as one pec mass over the ribcage.
      // Slim frames (soft = 1, the praised human torso) are bit-identical.
      // round 19 (humanoid-anatomy): the round-18 verdict named THE gap —
      // "the torso is a single flat value plane ... no clavicle line, no pec
      // shelf, no ab tiers". Two causes: the under-pec tint was a near-grey
      // nudge inside one toon band, and the round-18 bulk softening scaled
      // the whole ladder toward zero on the orc/dwarf. Now: (1) all band
      // TINTS are deep hue+value shifts; (2) bulk softening keeps applying
      // fully to the GEOMETRY (sternum carve, pec swell — the round-18
      // "armor plates" complaint was geometric) but the VALUE bands keep a
      // 0.75 floor, because muscle stations read through value everywhere;
      // (3) two ab tier lines split the abdomen (front-only tints, not the
      // round-15 wrapped geometric bands).
      const tintSoft = 0.75 + 0.25 * soft;
      // round 20 (humanoid-anatomy): the ladder rides whatever the chest is
      // WEARING. The band tints (AB/UNDERPEC/CLAVICLE) are skin-family browns
      // and they are applied front-only at frontness² — i.e. at full strength
      // straight down the camera axis. Against a clothed chest that repainted
      // the entire visible front back to bare skin, which is exactly the
      // round-19 "bare shop-mannequin, two flat skin values" read. Each band
      // is now converted to its RATIO against the bare-torso base and reapplied
      // over the actual chest tint, so a tunic gets a cloth-fold ladder of the
      // same relative value steps and a bare chest is bit-identical to r19.
      const chestBase = tintFor(seg.id);
      const clothed = chestBase !== TORSO_TINT;
      const band = (bandTint: readonly [number, number, number]): readonly [number, number, number] => {
        const target: readonly [number, number, number] = clothed
          ? [
              chestBase[0] * (bandTint[0] / TORSO_TINT[0]),
              chestBase[1] * (bandTint[1] / TORSO_TINT[1]),
              chestBase[2] * (bandTint[2] / TORSO_TINT[2]),
            ]
          : bandTint;
        return [
          chestBase[0] + (target[0] - chestBase[0]) * tintSoft,
          chestBase[1] + (target[1] - chestBase[1]) * tintSoft,
          chestBase[2] + (target[2] - chestBase[2]) * tintSoft,
        ];
      };
      const rAt = (t: number): number => seg.r0 + (seg.r1 - seg.r0) * t;
      push(seg, 0.18, bone, 0, 1, 0, flatOf(seg.id), rAt(0.18), 0, tintFor(seg.id), 0, inkOf(seg.id), 0, band(AB_TINT));
      push(seg, 0.26, bone, 0, 1, 0, flatOf(seg.id), rAt(0.26), 0, tintFor(seg.id), 0, inkOf(seg.id), 0.05 * soft);
      push(seg, 0.34, bone, 0, 1, 0, flatOf(seg.id), rAt(0.34), 0, tintFor(seg.id), 0, inkOf(seg.id), 0, band(AB_TINT));
      push(seg, 0.5, bone, 0, 1, 0);
      push(seg, 0.68, bone, 0, 1, 0, flatOf(seg.id), rAt(0.68), 0, tintFor(seg.id), 0.55 * soft, inkOf(seg.id), 0, band(UNDERPEC_TINT));
      push(seg, 0.78, bone, 0, 1, 0, flatOf(seg.id), rAt(0.78), 0, tintFor(seg.id), 1 * soft, inkOf(seg.id), 0.14 * soft);
      push(seg, 0.87, bone, 0, 1, 0, flatOf(seg.id), rAt(0.87), 0, tintFor(seg.id), 0.7 * soft, inkOf(seg.id), 0, band(CLAVICLE_TINT));
    } else if (seg.id.endsWith('.fore')) {
      // round 17 (humanoid-anatomy): the forearm is not a cone — a
      // brachioradialis FLARE just past the elbow (×1.5 the local lerp,
      // ≈0.98 armR, wider than the 0.68 elbow) that tapers away to the
      // wrist. With the elbow narrowing on both sides, the arm outline now
      // carries deltoid → elbow pinch → forearm flare → wrist valley.
      const rAt = (t: number): number => seg.r0 + (seg.r1 - seg.r0) * t;
      // round 20 (humanoid-anatomy): the flare peaks harder and the mid-forearm
      // drops nearly to the wrist — round 19 read "tube arms with no
      // forearm-to-wrist taper" on the human and "near-constant-width arms" on
      // the orc. With the driver's narrower wrist (0.49 armR) the run is now
      // ≈1.0 → 0.62 → 0.52 armR: a visible collapse into the wrist, not a cone.
      push(seg, 0.28, bone, 0, 1, 0, flatOf(seg.id), rAt(0.28) * 1.6);
      push(seg, 0.55, bone, 0, 1, 0, flatOf(seg.id), rAt(0.55) * 1.08);
      push(seg, 0.85, bone, 0, 1, 0);
    } else if (seg.id.endsWith('.thigh')) {
      // round 18 (humanoid-anatomy): QUAD MASS — the round-17 verdict:
      // "legs are featureless cones ... no knee station and no calf bulge".
      // The same station method that fixed the arms: the thigh carries its
      // hip-root width down the leg (×1.18 the local lerp at 0.28 ≈ the
      // root radius again) before the taper bottoms out at the pinched
      // 0.4-thighR knee (driver radii). Stations stop at 0.78 — the 0.34
      // knee blend zone starts at 0.83 and must keep its crease absolute
      // (the round-17 arm lesson: blend zones can bridge a pinch shut).
      // round 19 (Remy, back view): the two-station quad read as "hard boxy
      // corners" — five stations sweep the same swell as a curve.
      const rAt = (t: number): number => seg.r0 + (seg.r1 - seg.r0) * t;
      push(seg, 0.2, bone, 0, 1, 0, flatOf(seg.id), rAt(0.2) * 1.12);
      push(seg, 0.34, bone, 0, 1, 0, flatOf(seg.id), rAt(0.34) * 1.17);
      push(seg, 0.5, bone, 0, 1, 0, flatOf(seg.id), rAt(0.5) * 1.12);
      push(seg, 0.64, bone, 0, 1, 0, flatOf(seg.id), rAt(0.64) * 1.05);
      push(seg, 0.78, bone, 0, 1, 0);
    } else if (seg.id.endsWith('.shin')) {
      // round 18 (humanoid-anatomy): CALF SWELL — a gastrocnemius bulge just
      // below the knee (peak ×1.5 at 0.26, clearly wider than the pinched
      // knee) that narrows through 0.5 into the 0.36-legR ankle. The first
      // station sits at 0.19, just past the knee zone's last blended ring
      // (0.17), so the knee pinch itself stays untouched.
      // round 19 (Remy, back view): the 1.15→1.5 calf jump was a hard ledge —
      // six stations round the gastrocnemius into a bell that lands on an
      // unpinched ankle (ankle radius raised in the driver/rest pose).
      const rAt = (t: number): number => seg.r0 + (seg.r1 - seg.r0) * t;
      push(seg, 0.19, bone, 0, 1, 0, flatOf(seg.id), rAt(0.19) * 1.16);
      push(seg, 0.28, bone, 0, 1, 0, flatOf(seg.id), rAt(0.28) * 1.42);
      push(seg, 0.4, bone, 0, 1, 0, flatOf(seg.id), rAt(0.4) * 1.38);
      push(seg, 0.55, bone, 0, 1, 0, flatOf(seg.id), rAt(0.55) * 1.24);
      push(seg, 0.7, bone, 0, 1, 0, flatOf(seg.id), rAt(0.7) * 1.1);
      push(seg, 0.85, bone, 0, 1, 0);
    } else {
      push(seg, (zoneIn + (1 - zoneOut)) / 2, bone, 0, 1, 0);
    }

    if (k < segs.length - 1) {
      // blend zone across the joint into segment k+1
      const nextSeg = segs[k + 1];
      const nextBone = boneIndex.get(nextSeg.bone)!;
      const half = Math.floor(ZONE_RINGS / 2);
      // round 2 (humanoid-anatomy): blend the flatten factor across the zone
      // so the wrist eases from round forearm into the flattened palm
      const flatA = flatOf(seg.id);
      const flatB = flatOf(nextSeg.id);
      // round 6 (humanoid-anatomy): the ring squareness blends across the
      // zone too — the wrist eases from a round forearm into the squared palm
      const sqA = sqOf(seg.id);
      const sqB = sqOf(nextSeg.id);
      // round 16 (humanoid-anatomy): the ink weight blends across the zone —
      // the wrist eases from full-hull forearm into the light-inked hand
      const inkA = inkOf(seg.id);
      const inkB = inkOf(nextSeg.id);
      // round 3 (humanoid-anatomy): blend RADIUS across the zone when the two
      // segments disagree at the joint. Before, each ring took its own
      // segment's lerped radius, so the chest top (1.0 r) meeting the neck
      // root (0.52 r) rendered as a hard shelf between adjacent rings;
      // blending sweeps it into a continuous trapezius slope. Joints whose
      // radii already match at the joint (elbow, wrist, knee) keep their
      // exact per-segment radii — zero change there.
      const tExit = (zoneFactorFor(nextSeg.id) * Math.min(len, nextLen)) / 2 / nextLen;
      const rEntry = seg.r0 + (seg.r1 - seg.r0) * (1 - zoneOut);
      const rExit = nextSeg.r0 + (nextSeg.r1 - nextSeg.r0) * tExit;
      const blendRadius = Math.abs(seg.r1 - nextSeg.r0) > 1e-9;
      // round 13 (humanoid-anatomy): tint blends across the zone, and the
      // pelvis→chest joint ring darkens to BELT_TINT — the dark belt band
      // riding exactly on the silhouette's waist pinch.
      const tintA = tintFor(seg.id);
      const tintB = tintFor(nextSeg.id);
      const isBelt = seg.id === 'torso.pelvis' && nextSeg.id === 'torso.chest';
      // round 15 (humanoid-anatomy): the palm→fingers joint ring darkens to
      // the knuckle line — same value trick as the belt band.
      const isKnuckle = seg.id.endsWith('.palm') && nextSeg.id.endsWith('.fingers');
      // round 20 (humanoid-anatomy): the sleeve HEM — a dark ring where the
      // tunic sleeve ends and the skin forearm begins (the belt trick at the
      // elbow). Only on sleeved (slim) frames.
      const isSleeveHem = sleeved && seg.id.endsWith('.upper') && nextSeg.id.endsWith('.fore');
      const lerpTint = (t2: number): readonly [number, number, number] => [
        tintA[0] + (tintB[0] - tintA[0]) * t2,
        tintA[1] + (tintB[1] - tintA[1]) * t2,
        tintA[2] + (tintB[2] - tintA[2]) * t2,
      ];
      for (let ring = 0; ring < ZONE_RINGS; ring++) {
        const t = smoothstep(ring / (ZONE_RINGS - 1));
        const flat = flatA + (flatB - flatA) * t;
        const sq = sqA + (sqB - sqA) * t;
        const ink = inkA + (inkB - inkA) * t;
        const radius = blendRadius ? rEntry + (rExit - rEntry) * t : undefined;
        const tint =
          isBelt && ring === half ? BELT_TINT
          : isKnuckle && ring === half ? KNUCKLE_TINT
          : isSleeveHem && ring === half ? SLEEVE_HEM_TINT
          : lerpTint(t);
        if (ring < half) {
          push(seg, 1 - zoneOut * (1 - ring / half), bone, nextBone, 1 - t, t, flat, radius, sq, tint, 0, ink);
        } else if (ring === half) {
          push(seg, 1, bone, nextBone, 1 - t, t, flat, radius, sq, tint, 0, ink); // on the joint
        } else {
          const u = (ring - half) / half;
          push(nextSeg, tExit * u, bone, nextBone, 1 - t, t, flat, radius, sq, tint, 0, ink);
        }
      }
    } else {
      push(seg, 1, bone, 0, 1, 0); // chain tip ring, rigid
    }
  }
  // round 15 (humanoid-anatomy): the round-6/8 palm-tip crest rings are GONE
  // — the arm chain now ends in the curled finger mass, whose bend IS the
  // knuckle plane break. The fingertips get one blunt bevel ring past the
  // tip so the fist ends square, not in a rounded cap.
  const last = segs[segs.length - 1];
  if (last.id.endsWith('.fingers')) {
    const lastBone = boneIndex.get(last.bone)!;
    const len = new Vector3(...last.b).distanceTo(new Vector3(...last.a));
    push(last, 1 + (last.r1 * 0.28) / len, lastBone, 0, 1, 0, flatOf(last.id), last.r1 * 0.58);
  }
  return stations;
}

/** Signed volume of an indexed triangle soup (×6). Negative = inside-out. */
function signedVolume(positions: number[], index: number[], from: number, to: number): number {
  let vol = 0;
  for (let e = from; e < to; e += 3) {
    const a = index[e] * 3;
    const b = index[e + 1] * 3;
    const c = index[e + 2] * 3;
    vol +=
      positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1]) +
      positions[a + 1] * (positions[b + 2] * positions[c] - positions[b] * positions[c + 2]) +
      positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c]);
  }
  return vol;
}

export function buildSmoothBipedGeometry(
  restPose: BipedRestPose,
  boneIndex: ReadonlyMap<BipedBoneName, number>,
  /** round 18 (humanoid-anatomy): optional frame — bulk softens the chest's
   * pec ladder (see chainStations). Callers without it keep full strength. */
  frame?: Frame,
): BufferGeometry {
  const positions: number[] = [];
  const skinIndex: number[] = [];
  const skinWeight: number[] = [];
  const index: number[] = [];
  // round 13 (humanoid-anatomy): per-vertex value tints (trousers, boots,
  // belt band) — greyscale multipliers over the material's skin tone. The
  // fill material enables vertexColors; the ink shell ignores them.
  const colors: number[] = [];
  // round 16 (humanoid-anatomy): per-vertex ink-shell weight — hands carry
  // 0.45 so the inverse hull stops inking their creases shut.
  const inks: number[] = [];

  const normal = new Vector3();
  const binormal = new Vector3();
  const prevTangent = new Vector3();
  const offset = new Vector3();

  // round 4 (humanoid-anatomy): thick-necked rest poses carry a trapezius
  // wedge segment (chest top → skull equator) that swallows the hard outline
  // step where the neck meets the head ball — loft it as its own capped cone
  // so the smooth body keeps parity with the segment renderer. Frames without
  // it (slender necks) build the unchanged chain table.
  const chains: readonly ChainDef[] = restPose.segments.some((s) => s.id === 'torso.traps')
    ? [...SMOOTH_CHAINS, { segIds: ['torso.traps'] }]
    : SMOOTH_CHAINS;

  // round 18 (humanoid-anatomy): pec-ladder softening — 1 at human bulk,
  // easing toward 0.45 as bulk climbs past 1 (orc ≈ 0.5, dwarf ≈ 0.45).
  const soft = frame ? Math.max(0.45, 1 - 1.3 * Math.max(0, frame.bulk - 1)) : 1;

  for (const def of chains) {
    const stations = chainStations(restPose, boneIndex, def, soft);
    const ringStart: number[] = [];

    // parallel-transport frame down the chain (bind paths are near-straight;
    // the frame stays stable through the small elbow/knee bind bends)
    normal.set(1, 0, 0);
    if (Math.abs(stations[0].tangent.dot(normal)) > 0.9) normal.set(0, 0, 1);
    binormal.crossVectors(stations[0].tangent, normal).normalize();
    normal.crossVectors(binormal, stations[0].tangent).normalize();
    prevTangent.copy(stations[0].tangent);

    for (const st of stations) {
      if (st.tangent.dot(prevTangent) < 0.9999) {
        // rotate the frame with the tangent (Rodrigues via cross products)
        const axis = new Vector3().crossVectors(prevTangent, st.tangent);
        const s = axis.length();
        if (s > 1e-6) {
          axis.divideScalar(s);
          const angle = Math.asin(Math.min(1, s));
          normal.applyAxisAngle(axis, angle);
          binormal.applyAxisAngle(axis, angle);
        }
        prevTangent.copy(st.tangent);
      }
      ringStart.push(positions.length / 3);
      for (let j = 0; j < RADIAL; j++) {
        const a = (j / RADIAL) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        // round 6 (humanoid-anatomy): squared rings — blend the unit circle
        // toward the unit square (divide by the Chebyshev norm) by sq, so
        // hand pieces loft as blocks with flat faces
        let k = st.sq > 0 ? 1 + st.sq * SQ_STRENGTH * (1 / Math.max(Math.abs(c), Math.abs(s)) - 1) : 1;
        let tint = st.tint;
        // round 17 (humanoid-anatomy): front-only pec ledge + under-pec line
        // (frontness-weighted) — the uniform ring versions wrapped the back
        // as the "horizontal ring seams" the round-16 verdict named.
        if (st.pec > 0 || st.frontTint) {
          const fr = Math.max(0, -s);
          if (st.pec > 0) k *= 1 + st.pec * fr * fr;
          if (st.frontTint) {
            const w = fr * fr;
            tint = [
              tint[0] + (st.frontTint[0] - tint[0]) * w,
              tint[1] + (st.frontTint[1] - tint[1]) * w,
              tint[2] + (st.frontTint[2] - tint[2]) * w,
            ];
          }
        }
        // round 17 (humanoid-anatomy): tunic WEAVE — alternate vertex columns
        // on tunic-tinted rings drop a step in value (warm-shifted, the hue
        // trick that survives the quantized toon ramp), so the cloth carries
        // a vertical warp texture instead of reading as glazed ceramic.
        if (st.weave > 0 && j % 2 === 1) {
          tint = [tint[0] * 0.93, tint[1] * 0.9, tint[2] * 0.86];
        }
        // round 16 (humanoid-anatomy): STERNUM carve — pec rings dent their
        // front-center vertex column (front = −binormal on the +Y torso
        // chain, i.e. s < 0) and darken it, so the chest splits into two
        // plates meeting at a vertical sternum line instead of one roll. The
        // dark column is the carrier — the dent alone quantizes flat under
        // the toon ramp (render lesson).
        if (st.sternum > 0) {
          const frontness = Math.max(0, -s);
          const centerness = Math.max(0, 1 - Math.abs(c) * 1.8);
          const dent = st.sternum * frontness * frontness * centerness;
          k *= 1 - 0.16 * dent;
          if (dent > 0) {
            tint = [tint[0] * (1 - 0.26 * dent), tint[1] * (1 - 0.32 * dent), tint[2] * (1 - 0.35 * dent)];
          }
        }
        // round 19 (humanoid-anatomy): INSEAM SPLIT — thigh-root rings darken
        // their inner columns (hue-shifted, survives the ramp) and thicken
        // the local ink so the hull draws the leg-vs-pelvis split. Both
        // separation channels, same as the thumb.
        let ink = st.ink;
        if (st.inseam > 0) {
          const inner = Math.max(0, st.inSgn * c);
          const w = st.inseam * inner * inner;
          if (w > 0) {
            tint = [
              tint[0] * (1 - (1 - INSEAM_DARKEN[0]) * w),
              tint[1] * (1 - (1 - INSEAM_DARKEN[1]) * w),
              tint[2] * (1 - (1 - INSEAM_DARKEN[2]) * w),
            ];
            ink += 0.35 * w;
          }
        }
        offset.copy(normal).multiplyScalar(c * k * st.radius)
          .addScaledVector(binormal, s * k * st.radius * st.flat);
        positions.push(st.pos.x + offset.x, st.pos.y + offset.y, st.pos.z + offset.z);
        skinIndex.push(st.bone0, st.bone1, 0, 0);
        skinWeight.push(st.w0, st.w1, 0, 0);
        colors.push(tint[0], tint[1], tint[2]);
        inks.push(ink);
      }
    }

    const chainIndexStart = index.length;
    for (let i = 0; i < stations.length - 1; i++) {
      const a0 = ringStart[i];
      const b0 = ringStart[i + 1];
      for (let j = 0; j < RADIAL; j++) {
        const j1 = (j + 1) % RADIAL;
        index.push(a0 + j, a0 + j1, b0 + j, a0 + j1, b0 + j1, b0 + j);
      }
    }
    // end caps (fan to a center vertex, rigid to the end ring's primary bone)
    for (const [ringIdx, stationIdx] of [
      [0, 0],
      [ringStart.length - 1, stations.length - 1],
    ] as const) {
      const st = stations[stationIdx];
      const center = positions.length / 3;
      positions.push(st.pos.x, st.pos.y, st.pos.z);
      skinIndex.push(st.bone0, st.bone1, 0, 0);
      skinWeight.push(st.w0, st.w1, 0, 0);
      colors.push(st.tint[0], st.tint[1], st.tint[2]);
      inks.push(st.ink);
      const base = ringStart[ringIdx];
      for (let j = 0; j < RADIAL; j++) {
        const j1 = (j + 1) % RADIAL;
        if (stationIdx === 0) index.push(center, base + j1, base + j);
        else index.push(center, base + j, base + j1);
      }
    }
    // the Emberwing lesson as code: measure, and flip if inside-out
    if (signedVolume(positions, index, chainIndexStart, index.length) < 0) {
      for (let e = chainIndexStart; e < index.length; e += 3) {
        const tmp = index[e + 1];
        index[e + 1] = index[e + 2];
        index[e + 2] = tmp;
      }
    }
  }

  // terminal rigid pieces — same spheres slice 1 builds.
  // round 7 (humanoid-anatomy): the head ball is SKIPPED — the sculpted
  // humanoid head (headForms.buildHumanoidHead) mounts on the head bone in
  // assembleEntity; baking the old sphere here would leave an egg poking
  // through the new skull planes. The rest-pose ball itself stays (it binds
  // the head bone and drives it through the pose sink).
  for (const ball of restPose.balls) {
    if (ball.id === 'head') continue;
    // round 16 (humanoid-anatomy): deltoids drop from a 12×9 near-perfect
    // sphere to a coarse 8×5 faceted mass, flattened slightly front-to-back
    // (0.94 deep; height untouched — the bounds parity test keeps the
    // shoulder top) — under flat shading the big facets read as a cut
    // deltoid form instead of the round-15 verdict's "perfect balloons".
    const sphere = new SphereGeometry(ball.r, 8, 5);
    sphere.scale(1, 1, 0.94);
    sphere.translate(ball.center[0], ball.center[1], ball.center[2]);
    const pos = sphere.attributes.position;
    const base = positions.length / 3;
    const bone = boneIndex.get(ball.bone)!;
    // round 19 (humanoid-anatomy): MERGE the deltoid into the torso. The
    // round-18 verdict: "two detached spheres on a flat green slab". Two
    // causes: the full-ink hull drew a heavy black boundary where the ball
    // overlaps the chest, and the flat skin tone gave no transition into the
    // pec/trap masses. The inner-lower octant now darkens toward the pec
    // value (hue-shifted warm) and the ball's hull thins to 0.6 so the
    // outline stops fencing it off the torso.
    const isDeltoid = ball.id.startsWith('deltoid');
    const inSgnBall = ball.center[0] > 0 ? -1 : 1; // toward the body midline
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v);
      const y = pos.getY(v);
      const z = pos.getZ(v);
      let m = 0;
      if (isDeltoid) {
        const dx = (x - ball.center[0]) / ball.r;
        const dy = (y - ball.center[1]) / ball.r;
        m = Math.min(1, Math.max(0, 0.55 * inSgnBall * dx + 0.45 * -dy));
      }
      positions.push(x, y, z);
      skinIndex.push(bone, 0, 0, 0);
      skinWeight.push(1, 0, 0, 0);
      colors.push(1 - 0.22 * m, 1 - 0.3 * m, 1 - 0.4 * m);
      inks.push(isDeltoid ? 0.6 : 1);
    }
    const sIndex = sphere.index!;
    for (let e = 0; e < sIndex.count; e++) index.push(base + sIndex.getX(e));
    sphere.dispose();
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.setAttribute('aInk', new BufferAttribute(new Float32Array(inks), 1));
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(skinIndex), 4));
  geometry.setAttribute('skinWeight', new BufferAttribute(new Float32Array(skinWeight), 4));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}
