/**
 * @file fixtures.ts — canned CreaturePlans: the body-plan language's living
 * examples. Tests use these so no suite ever calls the LLM; the driver and
 * compiler suites treat them as their reference creatures.
 */
import type { CreaturePlan } from './planSchema';

const dragon: CreaturePlan = {
  name: 'Emberwing Dragon',
  frame: { heightFt: 9, lengthFt: 22, bulk: 0.85, stance: 'horizontal' },
  // round 5 (creature-anatomy): ONE confident arc. round 4's [1.3, 0.95,
  // 1.15] put two humps on the side profile (deep chest, dip, re-swelling
  // hips — the critic read "a two-humped camel"). The back line now falls
  // monotonically chest → hips → tail: chest is the single high point, the
  // waist barely tucks, and taper 0.41 lands the rear tip at 0.98 × 0.41 ≈
  // 0.40 of bodyRadM — the tail chain's root radius, keeping the round-4
  // seamless torso→tail flow.
  spine: { segments: 6, taper: 0.41, arch: 0.15, mass: [1.35, 1.12, 0.98] },
  appendages: [
    {
      kind: 'leg',
      attach: 0.22,
      perSide: true,
      count: 1,
      chain: [
        { lenFt: 4, r: 0.42 },
        { lenFt: 3.4, r: 0.28 },
      ],
    },
    {
      kind: 'leg',
      attach: 0.78,
      perSide: true,
      count: 1,
      chain: [
        { lenFt: 4.4, r: 0.5 },
        { lenFt: 3.6, r: 0.3 },
      ],
    },
    {
      kind: 'tail',
      attach: 1,
      heightFrac: 0.5,
      count: 1,
      chain: [
        { lenFt: 4.5, r: 0.4 },
        { lenFt: 4, r: 0.28 },
        { lenFt: 3.5, r: 0.18 },
        { lenFt: 3, r: 0.09 },
      ],
    },
  ],
  heads: [
    {
      // round 6 (creature-anatomy): the round-5 serpent form at 1.3 with 0.9
      // eyes still read "ball cranium + googly discs + duck-bill" — the
      // sculpted loft rendered, but small against the neck with oversized eye
      // spheres swamping the brow. 'beast' is the drake skull (flat cranium,
      // heavy brows, boxy muzzle, near-closed jaw), 1.55 makes it the
      // confident head statement, and 0.55 slit eyes sit IN the skull instead
      // of on top of it.
      form: 'beast',
      // round 23 (creature-anatomy): 1.55 → 1.95 — the round-22 verdict read
      // "a swan neck with a small cat-like head". The skull must out-gauge
      // the neck that carries it (the serpent crown lesson at drake scale).
      sizeScale: 1.95,
      eyes: { count: 2, sizeScale: 0.55, pupil: 'slit' },
      // round 21 (creature-anatomy): CLOSED MOUTH AT IDLE — the round-20
      // front panel read the tucked head + open jaw as "one dark mess"
      // merged with the chest. droop -0.6 nearly closes the hinge (formed
      // heads use snout.droop as a gape scale only; no cone snout renders).
      snout: { lengthScale: 1, droop: -0.6 },
    },
  ],
  palette: { bodyHex: '#8c3b2e', accentHex: '#d98e3a', bellyHex: '#d8c49a', eyeHex: '#f2c14e' },
  // Membrane wings come from the polished wing PART (flap-synced by the
  // assembler) — chain wings render as bare sticks on big bodies.
  garnish: [
    // round 2 (creature-anatomy): scale 1 — hornsCurved now sizes off the
    // injected anchorRadM skull radius, so the 2.6x hack read as black limbs
    { partId: 'hornsCurved', params: { scale: 1 } },
    { partId: 'wingsMembrane', params: { scale: 1.6 } },
  ],
};

const threeHeadedSerpent: CreaturePlan = {
  name: 'Threefold Fen Serpent',
  frame: { heightFt: 2.5, lengthFt: 26, bulk: 0.6, stance: 'serpentine' },
  // round 4 (creature-anatomy): the round-3 verdict called this "a uniform
  // garden hose". mass makes one continuous diminishing curve: thickest just
  // behind the necks (chest 1.45 at u 0.18 — the Valheim serpent's neck-base
  // swell), then one smooth taper to a pointed rear tip, not a capped end.
  // round 20 (creature-anatomy): the round-19 verdict read "balloons into a
  // fat smooth mid-body ... a slug with bumps". The mass now front-loads:
  // chest 1.45 stays (it IS the neck-base the crown pours out of) but the
  // waist drops 1.0 → 0.72 and the hips 0.6 → 0.5 (the schema floor), so
  // the silhouette is all neck-base carriage diminishing fast — Valheim's
  // serpent is a head and neck towing a tail, never a barrel amidships.
  // round 21 (creature-anatomy): the round-20 verdict still read "lumpy
  // tadpole" — the waist slims further (0.72 → 0.6) so the trunk is pure
  // towed diminuendo behind the neck-base swell.
  // round 22 (creature-anatomy): HEAD > NECK > TRUNK inversion — the
  // round-21 verdict: "pinheads on a garden hose ... the TRUNK is thicker
  // than the heads". With the serpentine hull slimmed (compilePlan 0.042 →
  // 0.033) the chest swell drops 1.45 → 1.15: the neck-base carriage stays
  // the trunk's thickest station but now sits UNDER the hero head's radius,
  // so the crown out-gauges everything it grows from.
  spine: { segments: 8, taper: 0.3, arch: 0, mass: [1.15, 0.6, 0.5] },
  // scaled hide: necks join with hard clean seams (junction blend floor)
  skin: { blend: 0 },
  // round 12 (creature-anatomy): HYDRA CROWN. Rounds 8-11 staggered the neck
  // roots along the front trunk (attach 0.03/0.05-0.12, heights 0.42-0.85)
  // and the round-11 verdict read the flankers as "miniature clone heads...
  // at each shoulder". The failure was PLACEMENT, not head count: all three
  // necks now root in ONE tight cluster at the very front of the reared S
  // (attach 0.03-0.05 all round to the same spine station; heightFrac
  // 0.8-0.85 so they leave from the crown, not the flanks), with fat first
  // links that overlap into one muscular branching base. The gaits crown fan
  // keeps their bases on a shared rising line and fans the skulls apart only
  // at the top: entry 0 fans LEFT, entry 1 holds CENTER (the hero, highest),
  // entry 2 fans RIGHT — a crown of skulls, nothing at shoulder height.
  // (round 3 lesson stands: chain r is a FRACTION of bodyRadM, not feet —
  // 0.7/0.46 class radii, never straw-gauge 0.42/0.3.)
  appendages: [
    // round 13 (creature-anatomy): the round-12 verdict still read "three
    // thin equal-width stalks ... broccoli". The width STAGGER now reads at
    // sheet distance: hero 0.82 → 0.5 (a trunk-class column), left flanker
    // 0.52 → 0.3, right flanker 0.44 → 0.26 — center clearly thickest, no
    // two necks the same gauge.
    // round 14 (creature-anatomy): the round-13 stagger DID NOT SURVIVE
    // compilation — the neck ROOT_SWELL floor (hullR × 0.4 ≈ half the trunk
    // gauge) plus tip × 1.9 pulled the compiled roots to 0.38 / 0.23 / 0.20:
    // flankers within 12% of each other, and the 4.3 vs 3.9 ft lengths put
    // the flanker skulls at near-equal height. The floor is now spread-aware
    // in compilePlan (multi-neck crowns keep their authored stagger) and the
    // authored gaps widen: widths 0.82 / 0.4 / 0.26, lengths 6.2 / 4.0 /
    // 2.7 ft — hero over 2× either flanker, no two necks within 30% in
    // either width or height.
    // round 20 (creature-anatomy): HEAVIER NECK ROOTS — the round-19 verdict
    // read "three pea-sized knob-heads on a thin neck". Every neck root
    // gains gauge so the crown flows out of the trunk as muscle (flankers
    // 0.4/0.26 → 0.52/0.34, hero 0.82 → 0.9), while the stagger holds: no
    // two necks within 30% in width (0.9 / 0.52 / 0.34).
    // round 21 (creature-anatomy): CROWN DOMINANCE — the round-20 verdict
    // still read "knobby buds ... lumpy tadpole" at sheet distance. Every
    // neck lengthens (~35%) and roots higher on the reared front so the
    // crown carries clear of the trunk; with the slimmer waist the read is
    // heads-and-necks towing a tail. Width stagger and shared root hold.
    // round 23 (creature-anatomy): MUSCULAR COLUMNS INTO THE JAW — the
    // round-22 verdict still read "broccoli florets on a stalk": the necks
    // tapered hard (hero 0.9 → 0.54) so each skull sat on a visibly thinner
    // stem. Valheim's serpent neck widens INTO the jaw. Every neck gains
    // gauge and keeps far more of it at the tip (hero tip 0.54 → 0.7), so
    // the column flows into the skull instead of necking down under it.
    // Stagger holds: no two necks within 30% in width or height.
    {
      // left flanker: mid length AND mid gauge of the stagger
      kind: 'neck',
      attach: 0.04,
      heightFrac: 0.85,
      count: 1,
      chain: [
        { lenFt: 3.1, r: 0.62 },
        { lenFt: 2.3, r: 0.42 },
      ],
    },
    {
      // center HERO neck: longest, highest, THICKEST — carries the full maw
      kind: 'neck',
      attach: 0.03,
      heightFrac: 0.9,
      count: 1,
      chain: [
        { lenFt: 4.4, r: 1.0 },
        { lenFt: 3.6, r: 0.85 },
      ],
    },
    {
      // right flanker: clearly the RUNT — shortest and thinnest, low in the
      // crown, its base still fused with the other two at the shared root
      kind: 'neck',
      attach: 0.05,
      heightFrac: 0.85,
      count: 1,
      chain: [
        { lenFt: 2.2, r: 0.42 },
        { lenFt: 1.5, r: 0.28 },
      ],
    },
  ],
  // round 8 (creature-anatomy): per-head CHARACTER. sizeScale steps down from
  // the hero (2.5 / 2.1 / 1.8 — round 3's Valheim-scale lesson holds: the
  // hero's maw stays ~body-radius class), and snout.droop on a FORMED head
  // now scales its jaw gape (headForms gapeScale): only the center head holds
  // the full striking maw; the flankers close partway.
  // round 11 (creature-anatomy): flanker jaws open PARTWAY (-0.2 / -0.3, was
  // -0.35 / -0.55) — a near-closed serpent head on a drooped neck is exactly
  // the shape the round-10 verdict read as a limp four-claw paw. Every head
  // must read as a skull with a visible gape at the tip of its neck.
  // round 20 (creature-anatomy): LARGER HEAD READ — the round-19 "pea-sized
  // knob-heads" verdict. Skulls step up (2.5/2.1/1.5 → 2.9/2.4/1.9) so with
  // the slimmed waist the hero maw (≈0.46 m class) out-reads the mid-body:
  // head-and-neck carriage, not a slug towing bumps.
  // round 21 (creature-anatomy): skulls step up again (2.9/2.4/1.9 →
  // 3.0/2.6/2.1, hero at the schema's 3.0 cap) — at sheet distance the
  // crown must out-read the trunk.
  // round 22 (creature-anatomy): the round-21 heads were AT the old cap and
  // the trunk still out-gauged them ("pinheads on a garden hose"). The cap
  // rose to 4 (planSchema, deliberate) and the skulls grow through it
  // (3.0/2.6/2.1 → 3.8/3.0/2.4): with the slimmed trunk (hull 0.033, chest
  // 1.15 → r ≈ 0.36 m) the hero head's socket lands ≈ 0.43 m — wider than
  // the chest swell and ~2.8× its own neck tip. Every head is now WIDER
  // than the neck it sits on; face detail and the red dorsal crest hold.
  // round 23 (creature-anatomy): the CROWN is the heaviest silhouette element
  // — the round-22 verdict: "the head-to-neck mass ratio is inverted at sheet
  // distance". All three skulls scale up (3.8/3.0/2.4 → 4.0/3.6/3.0, hero at
  // the schema cap) so heads+jaws+frill visually outweigh the trunk in the
  // silhouette panel.
  heads: [
    { neckIndex: 1, form: 'serpent', sizeScale: 4.0, eyes: { count: 2, sizeScale: 0.8, pupil: 'slit' }, snout: { lengthScale: 1.4, droop: 0 } },
    { neckIndex: 0, form: 'serpent', sizeScale: 3.4, eyes: { count: 2, sizeScale: 0.8, pupil: 'slit' }, snout: { lengthScale: 1.3, droop: -0.2 } },
    // round 14 (creature-anatomy): the runt trails the stagger — its
    // neck-carry floor (boundHeadR × 0.5) must not re-thicken the thinnest
    // neck past the authored gauge gap.
    { neckIndex: 2, form: 'serpent', sizeScale: 2.7, eyes: { count: 2, sizeScale: 0.8, pupil: 'slit' }, snout: { lengthScale: 1.2, droop: -0.3 } },
  ],
  // round 13 (creature-anatomy): ONE CONTINUOUS HIDE — the round-12 verdict
  // read "a pale khaki trunk hard-cut against dark green heads and rear at a
  // visible seam ring". The belly stays the SAME hide's hue family so
  // countershade reads as light falling off one skin, not a paint seam.
  // round 20 (creature-anatomy): HARD VALUE BREAKS — round 19 read "one
  // uninterrupted green gradient". Dorsal darkens (#3e6b4f → #315843), the
  // ventral lightens well past the old timid #7fa389 (hue held), and the
  // crest leaves green entirely for a Valheim-style rust-red contrast tone.
  palette: { bodyHex: '#315843', accentHex: '#b0452c', bellyHex: '#b7cba0', eyeHex: '#e8d44d' },
  // round 2 (creature-anatomy): dorsal fin ridge along the raised spine —
  // the critic's third serpent requirement after the rear and the jaws
  garnish: [{ partId: 'finRidge', params: { scale: 1, count: 12 } }],
};

const tentacledOoze: CreaturePlan = {
  name: 'Gutter Ooze',
  // round 16 (creature-anatomy): LOWER, LONGER SLUMP — the round-15 verdict's
  // silhouette panel read "a featureless egg, TALLER than wide — an inflated
  // balloon, not settled liquid". Frame height drops and the footprint
  // lengthens so the mound is clearly wider than tall (height ~0.6-0.7 of
  // width) from every ground-level angle; palette and translucency untouched
  // (the color panels tied a shipped gel). Length stays under the moundBody
  // gate (bodyLenM < bodyRadM * 7, i.e. lengthFt < 2.52 * heightFt).
  frame: { heightFt: 2.2, lengthFt: 5.2, bulk: 1, stance: 'horizontal' },
  // round 5 (creature-anatomy): back to the SOFT SETTLED MOUND (it passed in
  // round 0; round 4's sharp lobes + pointed tentacles regressed it into "a
  // spiky seed pod"). Gentler lobes — still lopsided, no hard steps — taper
  // so the rear rounds off instead of spiking, and a low arch: the read is a
  // slumped drop with a wide ground-contact skirt.
  // round 13 (creature-anatomy): LOPSIDED SETTLE — the round-12 silhouette
  // panel was "a nearly perfect featureless circle with one nub". The lobes
  // now step harder (front shoulder 1.3, mid crest 1.48, rear slump 0.68)
  // and the taper drops to 0.42 so the profile reads as an irregular settled
  // blob: high crest off-center, one flank dropping faster than the other.
  spine: { segments: 5, taper: 0.42, arch: 0.06, mass: [1.3, 1.48, 0.68] },
  // amorphous: tentacles melt into the mound (junction blend showcase)
  skin: { blend: 1 },
  // round 8 (creature-anatomy): PSEUDOPODS, NOT LEGS. Rounds 4–5 softened the
  // mound but the tick read persisted because the tentacles were the killer:
  // stiff limbs held in the air read as spider legs no matter how soft the
  // dome. Every chain is now a SHORT THICK MELTING STUB rooted at near-ground
  // height (heightFrac ≤ 0.1) — the driver's tentacle droop plus the ground
  // clamp lays them flat, so they read as gel oozing out of the skirt and
  // dragging along the floor. skin.blend 1 keeps their roots melted into the
  // ground-pooling skirt (spine.skirt collars in gaits.buildBody).
  // round 10 (creature-anatomy): FEWER, FATTER stubs — five stubs hooking out
  // of the flanks read as turtle flippers (round-9 verdict). Three remain
  // (one wide pair + the rear smear), each shorter and thicker so it reads
  // as gel bulging out of the skirt, with the boosted tentacle root collars
  // (compilePlan ROOT_COLLAR_BOOST) melting every root into the mound.
  appendages: [
    {
      kind: 'tentacle',
      attach: 0.4,
      heightFrac: 0.08,
      perSide: true,
      count: 1,
      chain: [
        { lenFt: 1.0, r: 0.44 },
        { lenFt: 0.6, r: 0.26 },
      ],
    },
    {
      kind: 'tentacle',
      attach: 0.85,
      heightFrac: 0.06,
      count: 1,
      // one longer smear dragging behind — still ground-bound
      chain: [
        { lenFt: 1.3, r: 0.34 },
        { lenFt: 0.9, r: 0.2 },
        { lenFt: 0.7, r: 0.12 },
      ],
    },
    {
      // round 13 (creature-anatomy): one UNPAIRED forward stub — the mirrored
      // pair + rear smear left the top view bilaterally symmetric, feeding
      // the "plain circle" silhouette. A single off-axis bulge breaks it.
      kind: 'tentacle',
      attach: 0.18,
      heightFrac: 0.07,
      count: 1,
      chain: [
        { lenFt: 0.9, r: 0.4 },
        { lenFt: 0.5, r: 0.22 },
      ],
    },
  ],
  // round 21 (creature-anatomy): the dark head-ball + pinprick eyes read as
  // "an ambiguous pill/mouth" (round-20 verdict). The mound ball no longer
  // renders (gaits skips it for moundBody — the mound IS the head) and the
  // three eyes grow into distinct spheres with pupil highlights.
  // Eye spacing rides head sizeScale (socket radius) while eye radius rides
  // sizeScale × eyes.sizeScale — 1.2/1.1 keeps each ball clear of its
  // neighbors so three DISTINCT spheres read, never a fused pill.
  heads: [{ sizeScale: 1.2, eyes: { count: 3, sizeScale: 1.1 } }],
  // round 6 (creature-anatomy): opacity 0.5 — the round-5 mound read as "an
  // opaque tusked boulder". An ooze is a GEL: the language's translucency
  // (palette.opacity) is the one honest tool for that read; eyes stay solid.
  // round 11 (creature-anatomy): TOXIC TEAL, not grass-green — the round-10
  // verdict found the gel "the exact hue of the grass, functionally invisible
  // in five of six panels". A saturated blue-teal separates from any green or
  // brown floor while the translucency keeps the wet-gel read. (First
  // round-11 capture: #2fae9b at 0.5 alpha averaged back to grass-green over
  // the lawn — the body leans BLUE and the alpha rises to 0.58 so the
  // composited hue stays teal on green ground.)
  palette: { bodyHex: '#1899b8', accentHex: '#4fd0e0', eyeHex: '#f2e968', opacity: 0.58 },
};

const floatingEye: CreaturePlan = {
  name: 'Warden Orb',
  frame: { heightFt: 3.5, bulk: 0.95, stance: 'floating' },
  spine: { segments: 2, taper: 0.9, arch: 0 },
  appendages: [],
  heads: [{ sizeScale: 1.6, eyes: { count: 1, sizeScale: 2 } }],
  palette: { bodyHex: '#6b5b8f', accentHex: '#a08cc4', eyeHex: '#7fd4c1' },
};

/** v1.2 stress creature: tauric — humanoid torso with arms riding a quad body. */
const centaur: CreaturePlan = {
  name: 'Gladefoot Centaur',
  frame: { heightFt: 7, lengthFt: 8, bulk: 0.65, stance: 'horizontal' },
  spine: { segments: 4, taper: 0.78, arch: 0.08 },
  appendages: [
    {
      kind: 'leg', attach: 0.18, perSide: true, count: 1,
      chain: [{ lenFt: 2.1, r: 0.24 }, { lenFt: 1.9, r: 0.16 }],
    },
    {
      kind: 'leg', attach: 0.82, perSide: true, count: 1,
      chain: [{ lenFt: 2.1, r: 0.26 }, { lenFt: 1.9, r: 0.17 }],
    },
    {
      kind: 'torso', attach: 0.06, count: 1,
      chain: [{ lenFt: 1.6, r: 0.6 }, { lenFt: 1.4, r: 0.5 }],
    },
    {
      kind: 'arm', attach: 0.06, parent: 2, perSide: true, count: 1, tips: 'hand',
      chain: [{ lenFt: 1.5, r: 0.14 }, { lenFt: 1.3, r: 0.1 }],
    },
    {
      kind: 'tail', attach: 1, heightFrac: 0.6, count: 1,
      chain: [{ lenFt: 1.4, r: 0.12 }, { lenFt: 1.2, r: 0.07 }],
    },
  ],
  heads: [{ neckIndex: 2, form: 'blunt', sizeScale: 0.95, eyes: { count: 2, sizeScale: 1 } }],
  palette: { bodyHex: '#7a5236', accentHex: '#caa06b', bellyHex: '#a9825d', eyeHex: '#2e2418' },
};

/** v1.2 stress creature: box body + translucency. */
const gelatinousCube: CreaturePlan = {
  name: 'Gelatinous Cube',
  frame: { heightFt: 9, lengthFt: 9, bulk: 1, stance: 'horizontal' },
  spine: { segments: 2, taper: 1, arch: 0, shape: 'box' },
  appendages: [],
  heads: [{ sizeScale: 0.55, eyes: { count: 1, sizeScale: 0.9 } }],
  palette: { bodyHex: '#8fd4a2', accentHex: '#c8f2d2', eyeHex: '#3f6b4a', opacity: 0.35 },
};

/** v1.2 stress creature: 11 heads — a floating orb ringed by eyestalks. */
const beholder: CreaturePlan = {
  name: 'Tyrant Orb',
  frame: { heightFt: 8, bulk: 0.95, stance: 'floating' },
  spine: { segments: 3, taper: 0.9, arch: 0 },
  appendages: [
    {
      kind: 'neck', attach: 0.15, heightFrac: 0.9, perSide: true, count: 3,
      chain: [{ lenFt: 1.6, r: 0.09 }, { lenFt: 1.3, r: 0.06 }],
    },
    {
      kind: 'neck', attach: 0.6, heightFrac: 0.85, perSide: true, count: 2,
      chain: [{ lenFt: 1.5, r: 0.09 }, { lenFt: 1.2, r: 0.06 }],
    },
  ],
  heads: [
    { sizeScale: 1.7, eyes: { count: 1, sizeScale: 2, pupil: 'goat' }, cilia: true },
    ...Array.from({ length: 6 }, () => ({ neckIndex: 0, sizeScale: 0.45, eyes: { count: 1, sizeScale: 1.6 } })),
    ...Array.from({ length: 4 }, () => ({ neckIndex: 1, sizeScale: 0.45, eyes: { count: 1, sizeScale: 1.6 } })),
  ],
  palette: { bodyHex: '#8a4a3b', accentHex: '#d98e3a', eyeHex: '#e8d44d' },
};

/** v1.2 stress creature: translucent trailing spirit — no legs, wisp taper. */
const ghost: CreaturePlan = {
  name: 'Barrow Wisp',
  frame: { heightFt: 6, bulk: 0.55, stance: 'floating' },
  spine: { segments: 5, taper: 0.3, arch: -0.15 },
  appendages: [
    {
      kind: 'arm', attach: 0.25, perSide: true, count: 1, tips: 'hand',
      chain: [{ lenFt: 1.6, r: 0.14 }, { lenFt: 1.4, r: 0.09 }],
    },
    {
      kind: 'tail', attach: 0.95, heightFrac: 0.3, count: 1,
      chain: [{ lenFt: 1.8, r: 0.2 }, { lenFt: 1.5, r: 0.12 }, { lenFt: 1.2, r: 0.05 }],
    },
  ],
  heads: [{ sizeScale: 1.1, eyes: { count: 2, sizeScale: 1.3 } }],
  palette: { bodyHex: '#9fb8d8', accentHex: '#d8e8f8', eyeHex: '#1a2a3f', opacity: 0.42 },
};

/**
 * The multi-link limb example: four links per leg, so every leg takes the
 * FABRIK path in `posePlanChain` instead of the two-bone `solveKnee`. Two leg
 * pairs, not three — a third pair puts the body over the 30k triangle budget.
 *
 * The plan language has always allowed 1–8 links per chain, but no fixture
 * used more than two, so the multi-link path had no living example and no
 * visual check. This is that example — the arthropod shape the language can
 * describe and generated creatures reach for.
 */
const jointedCrawler: CreaturePlan = {
  name: 'Carapace Crawler',
  frame: { heightFt: 2.2, lengthFt: 4.5, bulk: 1, stance: 'horizontal' },
  spine: { segments: 4, taper: 0.5, arch: 0.08, mass: [1.1, 1.2, 0.95] },
  appendages: [
    // Legs total ~1.9 ft under a 2.2 ft body: low-slung and splayed, the way a
    // crab carries itself. Longer links turn it into a stilt-legged deer.
    {
      kind: 'leg', attach: 0.25, perSide: true, count: 2,
      chain: [
        { lenFt: 0.62, r: 0.2 },
        { lenFt: 0.52, r: 0.15 },
        { lenFt: 0.44, r: 0.11 },
        { lenFt: 0.34, r: 0.07 },
      ],
    },
    {
      kind: 'leg', attach: 0.72, perSide: true, count: 2,
      chain: [
        { lenFt: 0.66, r: 0.21 },
        { lenFt: 0.56, r: 0.16 },
        { lenFt: 0.46, r: 0.12 },
        { lenFt: 0.36, r: 0.08 },
      ],
    },
    {
      kind: 'tail', attach: 1, heightFrac: 0.5, count: 1,
      chain: [
        { lenFt: 0.7, r: 0.16 },
        { lenFt: 0.55, r: 0.1 },
        { lenFt: 0.4, r: 0.05 },
      ],
    },
  ],
  heads: [
    {
      form: 'beast', sizeScale: 1.05,
      eyes: { count: 2, sizeScale: 0.6, pupil: 'round' },
      snout: { lengthScale: 0.7, droop: -0.4 },
    },
  ],
  palette: { bodyHex: '#5e4b32', accentHex: '#2f2718', bellyHex: '#a4906b', eyeHex: '#101010' },
};

export const PLAN_FIXTURES = {
  dragon,
  threeHeadedSerpent,
  tentacledOoze,
  floatingEye,
  centaur,
  gelatinousCube,
  beholder,
  ghost,
  jointedCrawler,
} as const satisfies Record<string, CreaturePlan>;
