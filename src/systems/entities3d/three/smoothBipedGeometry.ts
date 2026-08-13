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
  /** 0..1 boot SOLE band — the ring's bottom vertex arc darkens to leather
   * sole, so the boot carries a ground line that reads from front, 3/4 and
   * profile (round 21, humanoid-anatomy). */
  sole: number;
  /** 0..1 DELTOID SEAM relief — attenuates the ink hull on this ring's LATERAL
   * vertex columns only (round 22, humanoid-anatomy). Round 21 thinned the
   * deltoid ball's own hull to 0.2 to kill the "action-figure joint" ring, and
   * the round-21 verdict still read "every junction drawn shut with a full
   * black outline ring ... deltoid-to-torso" on the orc. The other half of the
   * seam is the CHEST's hull: at full thickness it inflates out through the
   * deltoid wherever the two masses interpenetrate, redrawing the boundary the
   * deltoid's own thin hull no longer draws. Front and back columns keep their
   * ink (they own the side-view silhouette); only the shoulder overlap loses
   * it, and only above 0.45 of the chest (round 23 lowered the start — see
   * the lat flare below, which now owns the outline from 0.5 up). */
  seam: number;
  /** round 23 (humanoid-anatomy): LATERAL-ONLY radial swell — scales the ±X
   * vertex columns by (1 + lat·c²) with front and back untouched. Negative
   * values pinch. This is the one channel that can build a LAT FLARE and a
   * TRAPEZIUS YOKE without touching the front/back profile the pec ladder and
   * the side panel own.
   *
   * Why the shoulder girdle needed geometry and not another tint: the numbers
   * say the deltoid ball's CENTER sits ABOVE the chest top on all three
   * subjects (orc chest top y 1.574, deltoid center 1.602, deltoid crown
   * 1.761) — at the height where the shoulder mass lives, the only torso
   * present is a thin traps cone. The shoulder therefore IS a ball hung beside
   * the neck, exactly as the round-22 verdict read it, and no amount of ink
   * relief or value banding can make a ball that touches nothing read as body
   * mass. The torso has to grow out to meet it. */
  lat: number;
  /** round 23 (humanoid-anatomy): lateral-only DROP along −tangent, in units
   * of the ring radius. On the +Y torso chain this pulls the ±X columns DOWN
   * while the front/back/center stay put, which is what turns a horizontal
   * shoulder shelf into a trapezius RAMP: the surface leaves the neck high at
   * the midline and slopes down and out to the acromion. Round 22's verdict —
   * "the neck drops into a flat horizontal shoulder bar" — is a direct
   * description of this term being zero. */
  yoke: number;
  /** Lateral-only tint (blended in by c²) — the armpit/lat groove. Expressed
   * as a RATIO over whatever the ring already wears (the round-20 rule), so a
   * tunic gets a cloth shadow and a bare chest gets a skin one. */
  latTint: readonly [number, number, number] | null;
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
/** round 21 (humanoid-anatomy): slim frames wear WOOL trousers, not leather.
 * Round 20's verdict read the human "bare from hip to ground" — the leather
 * brown multiplied over pale human skin lands one band from bare skin, the
 * exact failure TUNIC_TINT was invented to fix on the chest. Same rule here:
 * g ≈ r breaks the r>g>b skin family, so it can never read as a leg. */
const TROUSER_CLOTH_TINT: readonly [number, number, number] = [0.35, 0.34, 0.27];
/** round 21 (humanoid-anatomy): the HIP WRAP. Round 20: "thighs emerge from a
 * rounded diaper-shaped pelvis ... no belt, wrap, kilt or strap overlaps the
 * thigh tops the way both references do, so the hips read as underwear". The
 * pelvis tuck rings (which already round the glute down into the crotch) now
 * widen past the pelvis, carry leather, and reach BELOW the thigh roots, with
 * a proud belt lip at the top that bulges past the pelvis radius — a real
 * silhouette event, not a painted stripe. The crotch carve stays strong so the
 * praised two-rooted-legs split survives the wrap. */
const HIPWRAP_TINT: readonly [number, number, number] = [0.2, 0.16, 0.13];
/** round 21: the boot cuff line — trousers tuck INTO the boot. */
const BOOTHEM_TINT: readonly [number, number, number] = [0.24, 0.19, 0.17];
/** round 20 (humanoid-anatomy): slim frames wear SLEEVES — the upper arms
 * carry the tunic cloth, the forearms stay skin, and a dark hem ring at the
 * elbow joint draws the cloth boundary (the belt/knuckle band trick). The
 * skin-vs-cloth break at mid-arm is the strongest "clothed, not mannequin"
 * signal the Valheim reference carries. Bulky frames (orc, dwarf) keep bare
 * muscled arms — gated by the same softening the pec ladder uses. */
const SLEEVE_HEM_TINT: readonly [number, number, number] = [0.3, 0.28, 0.22];
// round 21b (humanoid-anatomy): the round-21a boot rendered LIGHTER than
// the trouser above it. Cause: [0.36,0.28,0.24] is r>g>b — the skin family —
// so under the toon ramp a lit boot top plate quantized up into the same band
// as bare leg. Decisively dark and near-neutral now, the way both references
// carry boots: the boot is the darkest thing on the figure below the belt.
const BOOT_TINT: readonly [number, number, number] = [0.24, 0.21, 0.19];
/** round 21 (humanoid-anatomy): the TOE BOX steps a value darker than the
 * boot shaft so the toe reads as its own mass in the front and 3/4 panels,
 * where a forward projection produces almost no silhouette of its own. */
const TOECAP_TINT: readonly [number, number, number] = [0.16, 0.14, 0.13];
/** round 21: the SOLE — the bottom vertex arc of every boot ring. A dark
 * ground line under a light-topped boot is the single cheapest "this is a
 * foot, not a leg stump" signal, and it survives every camera. */
const SOLE_TINT: readonly [number, number, number] = [0.1, 0.09, 0.09];
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
/** round 23 (humanoid-anatomy): near-neutral, not orange — see the matching
 * note on gearWeapons.WRAP_THUMB. The two must stay in step: they are the same
 * thumb, one lofted and one worn over a haft. */
const THUMB_TINT: readonly [number, number, number] = [0.72, 0.67, 0.6];
/** round 21 (humanoid-anatomy): the FREE FIST gets the grip hand's recipe.
 * Round 20 praised every weapon-grip hand ("three finger ridges plus a thumb
 * crossing the haft ... that read survives at panel distance") and failed
 * every free fist ("a smooth mitten club with one faint diagonal crease and no
 * thumb"). The grip hand wins with two channels the free fist never had:
 * ridges that BULGE PAST a valley radius (a silhouette event that survives any
 * ramp and any azimuth) and near-black VALLEY rings sunk into the gaps the
 * silhouette already cut. Both are now lofted into the finger mass and the
 * thumb — same numbers, same near-black valley step. */
const FINGER_VALLEY_TINT: readonly [number, number, number] = [0.24, 0.2, 0.17];
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
/** round 23 (humanoid-anatomy): the ARMPIT / LAT groove — a lateral-only
 * shadow riding the pinch at chest t 0.78, where the latissimus tucks under
 * the deltoid. Value alone never produced a shoulder read (rounds 19-22 all
 * tried); it works here because the geometry now cuts a real valley for it to
 * sit in, and because it is lateral-only it can never repaint the front of the
 * chest the way the round-19 front-weighted bands did. */
const LAT_GROOVE_TINT: readonly [number, number, number] = [0.44, 0.38, 0.31];
/** round 23 (humanoid-anatomy): the knee crease — a near-black ring sunk into
 * the pinch above the calf, so the leg carries a KNEE EVENT under a dark
 * trouser where the taper alone quantized into one band (round 22: the orc's
 * "legs are parallel tubes with no knee event"). Same recipe as the belt and
 * the finger valleys: a geometric valley the outline already cuts, with the
 * value step sunk into it. */
const KNEE_CREASE_TINT: readonly [number, number, number] = [0.2, 0.17, 0.15];
/** round 19 (humanoid-anatomy): inner-thigh inseam shade — darker than the
 * trousers so the crotch reads as two rooted legs, not one fairing. */
const INSEAM_DARKEN: readonly [number, number, number] = [0.62, 0.6, 0.62];

/** round 6 (humanoid-anatomy): hand pieces square their rings so the palm has
 * flat faces and hard-ish corners — the knuckle plane needs an edge to live
 * on, and a squared slab cannot be mistaken for a ball. */
/** round 21 (humanoid-anatomy): BOOTS square their rings too (0.6). A round
 * tube lofted along +Z shows the front camera nothing but its end cap — the
 * round-20 verdict's "legs ending in blunt stumps". A squared ring gives the
 * boot a flat top plate, flat sides and a flat sole, so the widened form
 * reads as a shoe from every azimuth instead of a sausage seen end-on. */
const sqOf = (segId: string): number => (segId.startsWith('hand') ? 1 : segId.startsWith('foot') ? 0.6 : 0);

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

/** round 21 (humanoid-anatomy): THE BOOT. The round-20 verdict's biggest gap:
 * "the shin cylinder runs straight to the ground and stops, with zero width
 * gain past the ankle and no toe projection ... the profile panels reveal a
 * plain rectangular slab". Three causes, all fixed here:
 *
 * 1. WIDTH. The old foot was one tapered ROUND tube (r0 = 0.62 legR) lofted
 *    along +Z — i.e. pointed straight at the front camera, which therefore saw
 *    only its end cap, a circle no wider than the 0.44-legR ankle. The loft
 *    radius on a +Z chain is the X half-width, so the boot now runs ≈1.8× the
 *    ankle across, and `flat` is solved PER STATION as (station height ÷
 *    radius) so the sole stays flat on the ground while the width does what it
 *    likes. Front view: shin, then a boot clearly wider than it.
 * 2. TOE PROJECTION. A forward projection is invisible to a front camera by
 *    definition (the camera-aimed-feature rule), so the driver splays each toe
 *    outward and the ladder below carries an ARCH VALLEY (0.86) that the BALL
 *    of the foot bulges back past (1.0) — the bulge-past-valley rule, so the
 *    outline scallops in the top/profile panels — plus a toe-box value step.
 * 3. THE FLOATING TAB. The old rectangular slab and the far foot read as two
 *    detached pieces with a gap. One connected form now: the heel bevel rounds
 *    back behind the ankle, the shaft rises to twice the heel height so the
 *    shortened shin plunges INTO it, and the toe closes with a bevel ring.
 *
 * Ground plane is y = 0 in the rest pose (bipedRestPose plants both feet at
 * y 0), which is what makes the per-station `flat` solve exact. */
function footStations(seg: RestSegmentLike, bone: number): Station[] {
  const a = new Vector3(...seg.a);
  const b = new Vector3(...seg.b);
  const tangent = b.clone().sub(a).normalize();
  const W = seg.r0;
  // [t along heel→toe, width as a fraction of W, toe-box tint blend]
  const ladder: ReadonlyArray<readonly [number, number, number]> = [
    [-0.1, 0.6, 0],
    [0.04, 0.9, 0],
    [0.22, 1.0, 0],
    [0.45, 0.82, 0], // arch waist — the valley
    // round 23 (humanoid-anatomy): THE TOE BOX. The round-22 verdict read all
    // three boots as "toe-less potato blobs — no toe box, no ankle, no
    // left/right difference". Diffing rounds 21 and 22 clears round 22 of
    // flattening anything: every boot term round 22 touched is gated on
    // bipedSlimT, so the dwarf's boot (the one round 21 praised as reading "as
    // FEET") is bit-identical between the two sheets. The blob is therefore
    // original, and the ball of the foot only ever matched the widest shaft
    // ring — no scallop at all past the arch. It now bulges clearly PAST both
    // the arch valley and the shaft (1.14), and the toe closes down from it in
    // two steps, so the front and 3/4 panels show shaft → waist → wide toe box.
    [0.68, 1.14, 0.6], // ball of the foot — bulges PAST the valley
    [0.86, 1.0, 1],
    [1, 0.74, 1],
    [1.07, 0.34, 1],
  ];
  return ladder.map(([t, wk, cap]) => {
    const pos = a.clone().lerp(b, t);
    const radius = W * wk;
    // solve the binormal (height) scale so the sole lands on y = 0
    const flat = Math.min(1.15, Math.max(0.24, pos.y / radius));
    const tint: readonly [number, number, number] = [
      BOOT_TINT[0] + (TOECAP_TINT[0] - BOOT_TINT[0]) * cap,
      BOOT_TINT[1] + (TOECAP_TINT[1] - BOOT_TINT[1]) * cap,
      BOOT_TINT[2] + (TOECAP_TINT[2] - BOOT_TINT[2]) * cap,
    ];
    return {
      pos,
      tangent,
      radius,
      bone0: bone,
      bone1: 0,
      w0: 1,
      w1: 0,
      flat,
      sq: sqOf(seg.id),
      tint,
      ink: inkOf(seg.id),
      sternum: 0,
      pec: 0,
      frontTint: null,
      weave: 0,
      inseam: 0,
      inSgn: 0,
      sole: 1,
      seam: 0,
      lat: 0,
      yoke: 0,
      latTint: null,
    };
  });
}

interface RestSegmentLike {
  id: string;
  a: readonly [number, number, number];
  b: readonly [number, number, number];
  r0: number;
}

/** Build the ring stations for one chain: segment ends, mid-bone rings, and
 * smoothstep-weighted rings across each interior joint. */
function chainStations(
  restPose: BipedRestPose,
  boneIndex: ReadonlyMap<BipedBoneName, number>,
  def: ChainDef,
  /** round 18 (humanoid-anatomy): 0..1 pec-ladder strength — bulky frames
   * soften the sternum carve / pec ledge / under-pec line, see below. */
  soft = 1,
  /** round 22 (humanoid-anatomy): 0..1 slim-frame strength (bipedSlimT) — 1 on
   * the human, 0 on the orc and dwarf. Slim frames need their own floors, not
   * a scaled-down share of the bulky terms; see the calf and boot stations. */
  slim = 1,
): Station[] {
  const segs = def.segIds.map((id) => {
    const seg = restPose.segments.find((s) => s.id === id);
    if (!seg) throw new Error(`smooth biped: rest segment "${id}" missing`);
    return seg;
  });
  // round 21 (humanoid-anatomy): the boot owns its whole station ladder
  if (segs.length === 1 && segs[0].id.startsWith('foot')) {
    return footStations(segs[0], boneIndex.get(segs[0].bone)!);
  }
  // round 20 (humanoid-anatomy): sleeves on slim frames only (soft tracks
  // 1/bulk — human 1, orc ≈0.55, dwarf ≈0.45)
  const sleeved = soft >= 0.75;
  // round 20 (humanoid-anatomy): the tunic covers the CHEST and the upper arms
  // on slim frames only. Bulky frames (orc, dwarf) keep the bare khaki torso
  // and bare muscled arms the round-19 verdict praised.
  const tintFor = (segId: string): readonly [number, number, number] =>
    sleeved && (segId.endsWith('.upper') || segId === 'torso.chest') ? TUNIC_TINT
    // round 21 (humanoid-anatomy): slim frames get cloth trousers too
    // round 21b (humanoid-anatomy): the PELVIS wears the trousers too. Round
    // 21a left it on leather TROUSER_TINT, which over pale human skin lands a
    // band lighter than both the tunic above and the trousers below — a pale
    // strip across the hips, i.e. the round-20 "underwear" read surviving the
    // hip wrap that was supposed to kill it.
    : sleeved && (segId.startsWith('leg') || segId === 'torso.pelvis') ? TROUSER_CLOTH_TINT
    : tintOf(segId);
  // round 22 (humanoid-anatomy): the THUMB's hull is bulk-aware. Round 19
  // deliberately re-inked the thumb to 0.95 so its own hull rim would draw the
  // thumb-vs-fist split, and that is still right on a slim hand — but the hull
  // thickness is a fixed fraction of BODY HEIGHT while the thumb-to-fist
  // crease is a fraction of the fist, so on the orc the 0.95 hull is ~28% of
  // the thumb's own radius and does the opposite: it fills the crease and
  // welds the thumb into the mass ("a featureless potato with no legible
  // thumb"). The exact aInk crease rule from round 16, applied one scale up.
  const inkFor = (segId: string): number =>
    segId.endsWith('.thumb') ? 0.65 + 0.3 * slim : inkOf(segId);
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
    ink = inkFor(seg.id),
    pec = 0,
    frontTint: readonly [number, number, number] | null = null,
    /** round 23 (humanoid-anatomy): the girdle channels, kept in an options
     * bag — the positional list was already at fourteen. */
    girdle: { lat?: number; yoke?: number; latTint?: readonly [number, number, number] | null } = {},
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
    // round 22 (humanoid-anatomy): the deltoid seam relief (see Station.seam)
    // is derived from the piece and its height, so the chest→neck blend rings
    // — which sit exactly in the shoulder overlap — pick it up for free.
    // round 23 (humanoid-anatomy): the relief starts LOWER (0.6 → 0.45) and
    // the NECK joins the list. The round-22 verdict still read an ink ring
    // sealing the deltoid on the orc, and the orc is the frame where the fix
    // could not land: its visible neck is 0.05 skullR (human 0.35, dwarf 0.26 —
    // the hunch term eats it, see skeletonBuilder neckLift), so the whole
    // shoulder overlap sits in the chest→neck blend and on the neck segment
    // itself, neither of which carried any seam relief above t 0.6.
    const seam =
      seg.id === 'torso.traps' ? 0.9
      : seg.id === 'neck' ? 0.75
      : seg.id === 'torso.chest' ? Math.min(1, Math.max(0, (t - 0.45) / 0.4)) * 0.9
      : 0;
    stations.push({
      pos, tangent, radius: radius ?? seg.r0 + (seg.r1 - seg.r0) * t, bone0, bone1, w0, w1,
      flat, sq, tint, ink, sternum, pec, frontTint, weave, inseam, inSgn, sole: 0, seam,
      lat: girdle.lat ?? 0, yoke: girdle.yoke ?? 0, latTint: girdle.latTint ?? null,
    });
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
      // round 21 (humanoid-anatomy): the tuck becomes a HIP WRAP — see
      // HIPWRAP_TINT. Four rings: a rounded leather hem that ends BELOW the
      // thigh roots (so gear overlaps the legs the way both references do), a
      // widest ring proud of the pelvis, and a belt lip that steps out past
      // the pelvis radius above it. The crotch carve rides the lower rings.
      if (seg.id === 'torso.pelvis') {
        // NEXT ROUND (humanoid-anatomy): on the ORC these carve strengths stack
        // on top of dark leather and render the crotch as a near-black
        // triangle — close to the "dark void gap at the crotch" the round-18
        // verdict named. Easing them to 0.5/0.38/0.22/0.1 is the fix, but this
        // checkout's sheets were captured at the values below and the machine
        // could not produce another capture to prove the eased version, so the
        // code stays exactly what round-21's sheets show. Ease and re-capture.
        push(seg, -(seg.r0 * 0.44) / len, bone, 0, 1, 0, 0.78, seg.r0 * 0.72, 0, HIPWRAP_TINT, 0.8);
        push(seg, -(seg.r0 * 0.3) / len, bone, 0, 1, 0, 0.88, seg.r0 * 0.96, 0, HIPWRAP_TINT, 0.6);
        push(seg, -(seg.r0 * 0.16) / len, bone, 0, 1, 0, 0.96, seg.r0 * 1.06, 0, HIPWRAP_TINT, 0.35);
        push(seg, -(seg.r0 * 0.04) / len, bone, 0, 1, 0, 1, seg.r0 * 1.1, 0, BELT_TINT, 0.15);
      }
      if (seg.id.endsWith('.upper')) {
        // round 21 (humanoid-anatomy): THE SHOULDER JUNCTION. Round 20: "a
        // wide ink-line gap separates the upper arm and pauldron from the
        // torso ... an action-figure joint read". The junction-blend collar
        // that fixes this in the SEGMENT renderer (segmentBody.sink.collar)
        // never runs on a skinned body — the sheets are skinned, so the collar
        // work simply was not in this path. The cause here is the inverse-hull
        // ink: at full thickness it draws a black boundary everywhere the arm
        // root overlaps the chest, fencing the deltoid off as a separate
        // object. The arm root now ramps its hull in from near zero (the same
        // aInk channel the hands use), so the deltoid-into-pec overlap renders
        // as one continuous mass and the ink only re-appears once the arm owns
        // the silhouette on its own.
        push(seg, 0, bone, 0, 1, 0, flatOf(seg.id), undefined, 0, tintFor(seg.id), 0, 0.1);
      } else if (seg.id === 'torso.traps') {
        // the yoke's root sits inside the ribcage; it starts nearly round so
        // the ramp GROWS out of the chest instead of stepping off it
        push(seg, 0, bone, 0, 1, 0, flatOf(seg.id), undefined, 0, tintFor(seg.id), 0, inkFor(seg.id), 0, null, { lat: 0.1, yoke: 0.15 });
      } else {
        push(seg, 0, bone, 0, 1, 0); // chain root ring, rigid
      }
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
      // round 23 (humanoid-anatomy): THE LAT FLARE. The round-22 verdict's
      // named gap included "vertical ribcage sides and no lat flare beneath the
      // arm". Literally true: every chest station took its own lerped radius,
      // so the ribcage ran as one straight cone from waist to shoulder and the
      // only lateral event on the whole torso was the deltoid ball. The armpit
      // sits at t ≈ 0.68 on all three subjects (solved from the deltoid ball's
      // lower pole), so the latissimus now swells LATERALLY (front and back
      // profiles untouched — the pec ladder and the side panel keep their
      // silhouette) peaking just below it, then PINCHES back at 0.78 into the
      // armpit notch that the deltoid bulges past. That pinch is the
      // bulge-past-valley rule applied to the shoulder: without a valley the
      // deltoid had nothing to be proud of and read as a sphere sitting on a
      // slab.
      push(seg, 0.18, bone, 0, 1, 0, flatOf(seg.id), rAt(0.18), 0, tintFor(seg.id), 0, inkFor(seg.id), 0, band(AB_TINT));
      push(seg, 0.26, bone, 0, 1, 0, flatOf(seg.id), rAt(0.26), 0, tintFor(seg.id), 0, inkFor(seg.id), 0.05 * soft);
      push(seg, 0.34, bone, 0, 1, 0, flatOf(seg.id), rAt(0.34), 0, tintFor(seg.id), 0, inkFor(seg.id), 0, band(AB_TINT));
      push(seg, 0.5, bone, 0, 1, 0, flatOf(seg.id), rAt(0.5), 0, tintFor(seg.id), 0, inkFor(seg.id), 0, null, { lat: 0.16 });
      push(seg, 0.62, bone, 0, 1, 0, flatOf(seg.id), rAt(0.62), 0, tintFor(seg.id), 0, inkFor(seg.id), 0, null, { lat: 0.34 });
      push(seg, 0.68, bone, 0, 1, 0, flatOf(seg.id), rAt(0.68), 0, tintFor(seg.id), 0.55 * soft, inkFor(seg.id), 0, band(UNDERPEC_TINT), { lat: 0.2 });
      push(seg, 0.78, bone, 0, 1, 0, flatOf(seg.id), rAt(0.78), 0, tintFor(seg.id), 1 * soft, inkFor(seg.id), 0.14 * soft, null, { lat: -0.14, latTint: band(LAT_GROOVE_TINT) });
      push(seg, 0.87, bone, 0, 1, 0, flatOf(seg.id), rAt(0.87), 0, tintFor(seg.id), 0.7 * soft, inkFor(seg.id), 0, band(CLAVICLE_TINT), { lat: 0.1, yoke: 0.14 });
    } else if (seg.id === 'torso.traps') {
      // round 23 (humanoid-anatomy): THE TRAPEZIUS YOKE — the structural half
      // of the round-22 gap ("the neck drops into a flat horizontal shoulder
      // bar ... the deltoid sits as a separate sphere").
      //
      // Diagnosis first, because four rounds of ink and tint work had already
      // failed here. Solving the rest pose numerically: on the orc the chest
      // top is y 1.574 and the deltoid ball's CENTER is y 1.602 with its crown
      // at 1.761 — the entire upper half of the shoulder mass lives ABOVE the
      // torso, where the only body present is this thin traps cone. Human and
      // dwarf are the same shape of wrong. So the shoulder really was a ball
      // hung beside the neck, and the relief work was trying to erase the
      // boundary of a gap that was really there.
      //
      // The cone is now a YOKE: its ±X columns swell out toward the deltoid
      // (lat) AND drop along −Y (yoke) while the front, back and midline
      // columns stay where they are. The midline therefore stays at the neck
      // base and the sides sweep down and out into the deltoid's own volume —
      // a continuous trapezius ramp instead of a shelf with a ball beside it.
      // The drop is tuned so the lateral edge lands at the deltoid's LOWER pole
      // (the armpit line) on all three subjects, which is where the reference
      // trapezius meets the acromion.
      push(seg, 0.35, bone, 0, 1, 0, flatOf(seg.id), undefined, 0, tintFor(seg.id), 0, inkFor(seg.id), 0, null, { lat: 0.45, yoke: 0.3 });
      push(seg, 0.68, bone, 0, 1, 0, flatOf(seg.id), undefined, 0, tintFor(seg.id), 0, inkFor(seg.id), 0, null, { lat: 0.62, yoke: 0.45 });
    } else if (seg.id.endsWith('.fingers')) {
      // round 21 (humanoid-anatomy): SCALLOPED KNUCKLE ROWS — see
      // FINGER_VALLEY_TINT. Three bulges split by two sunk near-black valleys,
      // so the free fist's outline steps the way the praised grip stack does.
      const rAt = (t: number): number => seg.r0 + (seg.r1 - seg.r0) * t;
      push(seg, 0.14, bone, 0, 1, 0, flatOf(seg.id), rAt(0.14) * 1.06);
      push(seg, 0.31, bone, 0, 1, 0, flatOf(seg.id), rAt(0.31) * 0.8, sqOf(seg.id), FINGER_VALLEY_TINT);
      push(seg, 0.47, bone, 0, 1, 0, flatOf(seg.id), rAt(0.47) * 1.1);
      push(seg, 0.64, bone, 0, 1, 0, flatOf(seg.id), rAt(0.64) * 0.82, sqOf(seg.id), FINGER_VALLEY_TINT);
      push(seg, 0.8, bone, 0, 1, 0, flatOf(seg.id), rAt(0.8) * 1.04);
    } else if (seg.id.endsWith('.palm')) {
      // round 22 (humanoid-anatomy): THE FREE FIST, UNIFIED WITH THE GRIP HAND.
      // The critic has praised every weapon-grip hand for three rounds and
      // failed every free fist for four ("a featureless potato with no legible
      // thumb"), so this round stopped re-tuning the free fist and diffed the
      // two code paths. They ARE different: the grip hand is gearWeapons.
      // gripBand() — FOUR scalloped ellipsoids of bulge radius 1.3 fist-radii
      // separated by THREE near-black valley rings at 1.06, stacked across the
      // WHOLE fist length (4 × 0.62 fr ≈ 2.5 fr) — while the free fist put
      // three small bulges on the finger mass alone, which is 0.95 handR: 41%
      // of the fist. Same recipe, 2.4× less of it, so at panel distance the
      // free fist had one wobble where the grip hand has four steps.
      // The ladder now runs the full length: the palm carries the first two
      // scallops on the same bulge:valley ratio (1.13 : 0.9 ≈ 1.26, the grip
      // band's 1.3 : 1.06) with the same near-black valley tint, then the
      // knuckle joint ring, then the finger mass carries the rest.
      const rAt = (t: number): number => seg.r0 + (seg.r1 - seg.r0) * t;
      // round 22: the WRIST ink ramp — the first station sheds most of its
      // hull. The wrist is the narrowest point on the whole arm (0.45 armR)
      // and the forearm flare and the fist both out-mass it by ~2×, so the
      // uniform hull closed the throat and drew the round-21 verdict's black
      // ring "at the wrist". Same fix as round 21's shoulder root, other end.
      // round 23 (humanoid-anatomy): THE GRIP-HAND REGRESSION. Round 22's palm
      // scallops fixed the free fist and broke the weapon hand, which the
      // critic had praised for three rounds and now calls "a lumpy clump around
      // the tang". The two forms are coaxial and nobody checked the clearance:
      // gearWeapons.gripBand wraps the fist in four ellipsoids at 1.3 fist-radii
      // separated by valley rings at 1.06, sized to "clear the underlying
      // skinned fist cleanly" — and the round-22 palm bulge lands at
      // rAt(0.58) × 1.13 = 1.073 fist-radii, i.e. THROUGH the wrap's valleys.
      // Six competing bumps on one column. The bulge now peaks at 1.05 (just
      // inside the wrap) and the valleys sink further instead, which keeps the
      // 1.25 bulge:valley ratio the free fist won with while leaving the grip
      // band the only thing carrying the outline on a weapon hand.
      push(seg, 0.1, bone, 0, 1, 0, flatOf(seg.id), rAt(0.1), sqOf(seg.id), tintFor(seg.id), 0, 0.24);
      push(seg, 0.34, bone, 0, 1, 0, flatOf(seg.id), rAt(0.34) * 0.84, sqOf(seg.id), FINGER_VALLEY_TINT);
      push(seg, 0.58, bone, 0, 1, 0, flatOf(seg.id), rAt(0.58) * 1.05);
      push(seg, 0.8, bone, 0, 1, 0, flatOf(seg.id), rAt(0.8) * 0.84, sqOf(seg.id), FINGER_VALLEY_TINT);
    } else if (seg.id.endsWith('.thumb')) {
      // round 21 (humanoid-anatomy): the thumb gets a KNUCKLE of its own — a
      // bulge, a sunk dark valley, then the tip pad — so it reads as a digit
      // with a joint rather than a smooth lobe fused to the fist.
      const rAt = (t: number): number => seg.r0 + (seg.r1 - seg.r0) * t;
      // round 22 (humanoid-anatomy): a near-black ring at the thumb's ROOT.
      // Four rounds of thumb work have all been silhouette work — bigger lobe,
      // fatter root, more ink — and the round-21 verdict still read "no legible
      // thumb" on the orc. What the fingers finally won with was not size but
      // the VALLEY: a sunk near-black ring in the gap the silhouette already
      // cuts. The thumb meets the fist in exactly such a gap and never had one.
      push(seg, 0.08, bone, 0, 1, 0, flatOf(seg.id), rAt(0.08) * 0.82, sqOf(seg.id), FINGER_VALLEY_TINT);
      push(seg, 0.28, bone, 0, 1, 0, flatOf(seg.id), rAt(0.28) * 1.12);
      push(seg, 0.53, bone, 0, 1, 0, flatOf(seg.id), rAt(0.53) * 0.78, sqOf(seg.id), FINGER_VALLEY_TINT);
      push(seg, 0.78, bone, 0, 1, 0, flatOf(seg.id), rAt(0.78) * 1.14);
    } else if (seg.id.endsWith('.upper')) {
      // round 21 (humanoid-anatomy): the ink hull ramps back in across the
      // first third of the upper arm — zero at the torso overlap, full by the
      // time the arm hangs free — and the mid-arm carries a taper toward the
      // elbow so the deltoid reads as a mass that NARROWS into the joint (the
      // grunt's "deltoid-into-pec integration and a taper to the elbow").
      const rAt = (t: number): number => seg.r0 + (seg.r1 - seg.r0) * t;
      push(seg, 0.12, bone, 0, 1, 0, flatOf(seg.id), rAt(0.12), 0, tintFor(seg.id), 0, 0.34);
      push(seg, 0.26, bone, 0, 1, 0, flatOf(seg.id), rAt(0.26), 0, tintFor(seg.id), 0, 0.72);
      push(seg, 0.48, bone, 0, 1, 0);
      // round 22 (humanoid-anatomy): THE ELBOW INK RAMP — the other end of the
      // same arm. Round 21 ramped the hull in at the shoulder root and the
      // round-21 verdict still read "every junction drawn shut with a full
      // black outline ring — deltoid-to-torso, ELBOW, WRIST". The elbow is a
      // deliberate pinch (0.62 armR) sitting between a 1.9-armR shoulder and a
      // 1.6× forearm flare: a valley narrower than the hull that brackets it,
      // which is the aInk crease rule verbatim. The hull now ramps back OUT
      // toward the joint so the arm keeps one continuous outline through it.
      push(seg, 0.72, bone, 0, 1, 0, flatOf(seg.id), rAt(0.72) * 0.94, 0, tintFor(seg.id), 0, 0.55);
      push(seg, 0.88, bone, 0, 1, 0, flatOf(seg.id), rAt(0.88), 0, tintFor(seg.id), 0, 0.28);
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
      // round 22 (humanoid-anatomy): the forearm's own half of the elbow and
      // wrist ink ramps (see the .upper branch). The flare — the widest part of
      // the forearm — is what inflates over both throats, so its hull comes in
      // low at the elbow, reaches its round-17 weight through the belly of the
      // muscle, and sheds again into the wrist.
      push(seg, 0.1, bone, 0, 1, 0, flatOf(seg.id), rAt(0.1), 0, tintFor(seg.id), 0, 0.3);
      push(seg, 0.28, bone, 0, 1, 0, flatOf(seg.id), rAt(0.28) * 1.6, 0, tintFor(seg.id), 0, 0.62);
      push(seg, 0.55, bone, 0, 1, 0, flatOf(seg.id), rAt(0.55) * 1.08);
      push(seg, 0.85, bone, 0, 1, 0, flatOf(seg.id), rAt(0.85), 0, tintFor(seg.id), 0, 0.34);
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
      // round 21 (humanoid-anatomy): "thigh and shin are near the same width".
      // The quad swell grows and the run down to the (now harder-pinched,
      // see the driver's kneeR) knee steepens, so the thigh:knee ratio the
      // outline shows lands near 2:1 like the references.
      push(seg, 0.2, bone, 0, 1, 0, flatOf(seg.id), rAt(0.2) * 1.16);
      push(seg, 0.34, bone, 0, 1, 0, flatOf(seg.id), rAt(0.34) * 1.22);
      push(seg, 0.5, bone, 0, 1, 0, flatOf(seg.id), rAt(0.5) * 1.14);
      push(seg, 0.64, bone, 0, 1, 0, flatOf(seg.id), rAt(0.64) * 1.03);
      // round 23 (humanoid-anatomy): THE PATELLA. Round 22 read the orc's legs
      // as "parallel tubes with no knee event", and the radii say otherwise —
      // thigh:knee is 2.86:1 on all three subjects. What the orc lacks is not
      // taper but an EVENT: a dark leather trouser under a toon ramp shows one
      // value from hip to boot, so a smooth taper reads as a tube. The knee now
      // carries a front-only cap that swells past the local lerp and a dark
      // crease line under it — a value break and a front-profile bump landing
      // exactly on the pinch, which is where a knee is legible from the front.
      // ring forms, not front-weighted ones: on a leg chain the binormal points
      // BACKWARD (tangent is −Y), so the frontness² channel the chest uses
      // would have painted the popliteal instead of the kneecap.
      push(seg, 0.72, bone, 0, 1, 0, flatOf(seg.id), rAt(0.72) * 1.12);
      push(seg, 0.8, bone, 0, 1, 0, flatOf(seg.id), rAt(0.8) * 0.92, 0, KNEE_CREASE_TINT);
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
      // round 22 (humanoid-anatomy): slim frames swell the gastrocnemius
      // harder — the round-21 verdict asked for the human's "calf past the
      // ankle, matching the dwarf", and the dwarf gets its calf mass from a
      // bulk-driven legR the human does not have. Bulky frames unchanged.
      const calf = 1 + 0.2 * slim;
      push(seg, 0.19, bone, 0, 1, 0, flatOf(seg.id), rAt(0.19) * 1.14 * calf);
      push(seg, 0.28, bone, 0, 1, 0, flatOf(seg.id), rAt(0.28) * 1.34 * calf);
      push(seg, 0.4, bone, 0, 1, 0, flatOf(seg.id), rAt(0.4) * 1.3 * calf);
      push(seg, 0.55, bone, 0, 1, 0, flatOf(seg.id), rAt(0.55) * 1.18 * calf);
      push(seg, 0.7, bone, 0, 1, 0, flatOf(seg.id), rAt(0.7) * 1.06);
      // round 21 (humanoid-anatomy): the BOOT CUFF — a dark ring where the
      // trouser tucks into the boot shaft. Same belt/knuckle trick, and it
      // gives the leg a third material break between hip wrap and sole.
      push(seg, 0.84, bone, 0, 1, 0, flatOf(seg.id), rAt(0.84) * 1.02, 0, BOOTHEM_TINT);
      push(seg, 0.92, bone, 0, 1, 0, flatOf(seg.id), rAt(0.92), 0, BOOTHEM_TINT);
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
      const inkA = inkFor(seg.id);
      const inkB = inkFor(nextSeg.id);
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
      // round 22 (humanoid-anatomy): the ELBOW and WRIST joint rings themselves
      // shed most of their hull. The stations either side ramp down (see the
      // .upper/.fore/.palm branches); this closes the gap over the joint ring,
      // which is the narrowest point of the valley and therefore the ring the
      // inverse hull actually seals shut. Every other joint (knee, belt,
      // knuckle, neck) keeps its full ink.
      const jointInkFloor =
        nextSeg.id.endsWith('.fore') || nextSeg.id.endsWith('.palm') ? 0.22 : 1;
      const lerpTint = (t2: number): readonly [number, number, number] => [
        tintA[0] + (tintB[0] - tintA[0]) * t2,
        tintA[1] + (tintB[1] - tintA[1]) * t2,
        tintA[2] + (tintB[2] - tintA[2]) * t2,
      ];
      for (let ring = 0; ring < ZONE_RINGS; ring++) {
        const t = smoothstep(ring / (ZONE_RINGS - 1));
        const flat = flatA + (flatB - flatA) * t;
        const sq = sqA + (sqB - sqA) * t;
        // the dip is deepest on the joint ring (t = 0.5) and gone at the zone
        // edges, where the neighbouring stations have already taken over
        const ink = (inkA + (inkB - inkA) * t) * (1 - (1 - jointInkFloor) * (1 - Math.abs(2 * t - 1)));
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
    } else if (seg.id === 'torso.traps') {
      // the yoke's top ring: midline still at the neck base, sides out and
      // down into the deltoid — the sweep the WoW grunt leads with
      push(seg, 1, bone, 0, 1, 0, flatOf(seg.id), undefined, 0, tintFor(seg.id), 0, inkFor(seg.id), 0, null, { lat: 0.55, yoke: 0.5 });
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
  // round 22 (humanoid-anatomy): slim-frame strength — the same curve
  // skeletonBuilder.bipedSlimT uses (kept inline: this module takes an
  // optional frame and must not import the driver's helpers for one number).
  const slim = frame ? Math.min(1, Math.max(0, (1.25 - frame.bulk) / 0.1)) : 1;

  for (const def of chains) {
    const stations = chainStations(restPose, boneIndex, def, soft, slim);
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
        // round 22 (humanoid-anatomy): DELTOID SEAM relief — the upper chest
        // and the trapezius wedge shed their hull on the LATERAL columns only
        // (c = ±1 is the ±X side of a vertical torso chain), which is exactly
        // where the deltoid mass interpenetrates them. Front and back columns
        // keep full ink, so the torso's own silhouette is untouched in every
        // panel; what disappears is the black ring the chest's hull drew
        // through the deltoid.
        if (st.seam > 0) ink *= 1 - st.seam * c * c;
        // round 21 (humanoid-anatomy): BOOT SOLE — on a foot chain the
        // binormal is world up, so s < 0 is the underside. The bottom arc
        // steps to dark leather, drawing a ground line under the boot that
        // reads at panel distance from the front, the 3/4 and the profile.
        if (st.sole > 0) {
          // round 21b: the band starts ABOVE the equator. A front camera sees
          // the boot's top plate and front face, almost none of its underside,
          // so a strictly-underside band was invisible in the panel that
          // failed. Darkening the lower half reads as sole + welt from every
          // camera, and it is what separates boot from leg at panel distance.
          const under = Math.max(0, (-s + 0.12) / 0.9);
          const w = st.sole * under;
          if (w > 0) {
            tint = [
              tint[0] + (SOLE_TINT[0] - tint[0]) * w,
              tint[1] + (SOLE_TINT[1] - tint[1]) * w,
              tint[2] + (SOLE_TINT[2] - tint[2]) * w,
            ];
          }
        }
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
        // round 23 (humanoid-anatomy): THE SHOULDER GIRDLE, as geometry.
        // `lat` swells (or pinches) the ±X columns only — c² is 1 on the flank
        // and 0 dead front/back — so the lat flare and the trapezius yoke never
        // touch the front profile the pec ladder owns nor the side profile the
        // silhouette panel judges. `yoke` slides those same columns DOWN the
        // chain tangent, which is what converts a horizontal shoulder shelf
        // into a neck-to-acromion ramp.
        let drop = 0;
        if (st.lat !== 0 || st.yoke > 0) {
          const lateral = c * c;
          k *= 1 + st.lat * lateral;
          drop = st.yoke * lateral * st.radius;
          if (st.latTint) {
            const w = lateral * lateral;
            tint = [
              tint[0] + (st.latTint[0] - tint[0]) * w,
              tint[1] + (st.latTint[1] - tint[1]) * w,
              tint[2] + (st.latTint[2] - tint[2]) * w,
            ];
          }
        }
        offset.copy(normal).multiplyScalar(c * k * st.radius)
          .addScaledVector(binormal, s * k * st.radius * st.flat)
          .addScaledVector(st.tangent, -drop);
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
    const isDeltoidBall = ball.id.startsWith('deltoid');
    // round 21 (humanoid-anatomy): the deltoid is no longer a BALL hung off
    // the side of the torso. It stretches 1.34× along X and its center slides
    // 0.34 r toward the midline, so its inner pole ends up 1.68 r INSIDE the
    // ribcage — the two masses interpenetrate instead of touching — while the
    // outer pole lands on exactly the old x (bounds parity, and the round-20
    // boulder-shoulder silhouette is untouched).
    const inSgnBall = ball.center[0] > 0 ? -1 : 1; // toward the body midline
    const shiftX = isDeltoidBall ? inSgnBall * ball.r * 0.34 : 0;
    const cx = ball.center[0] + shiftX;
    const sphere = new SphereGeometry(ball.r, 8, 5);
    sphere.scale(isDeltoidBall ? 1.34 : 1, 1, 0.94);
    sphere.translate(cx, ball.center[1], ball.center[2]);
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
    const isDeltoid = isDeltoidBall;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v);
      const y = pos.getY(v);
      const z = pos.getZ(v);
      let m = 0;
      if (isDeltoid) {
        const dx = (x - cx) / (ball.r * 1.34);
        const dy = (y - ball.center[1]) / ball.r;
        m = Math.min(1, Math.max(0, 0.55 * inSgnBall * dx + 0.45 * -dy));
      }
      positions.push(x, y, z);
      skinIndex.push(bone, 0, 0, 0);
      skinWeight.push(1, 0, 0, 0);
      colors.push(1 - 0.28 * m, 1 - 0.36 * m, 1 - 0.46 * m);
      // round 21 (humanoid-anatomy): 0.6 → 0.2. The hull thickness is what
      // drew the "wide ink-line gap" the round-20 verdict named; at 0.2 the
      // deltoid's overlap with the trap and pec renders as continuous mass.
      inks.push(isDeltoid ? 0.2 : 1);
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
