// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/07/2026, 12:43:13
 * Dependents: systems/entities3d/generateEntityBlueprint.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file creaturePlans.ts — creature type × size × cue → CreaturePlan.
 *
 * The creature-quality pass (2026-07-19): monster recipes no longer render as
 * segment mannequins from the hardcoded quad/biped gait bodies. Every
 * creature type compiles to a text-to-creature CreaturePlan here — the same
 * universal body language the Describe mode uses — so bestiary monsters get
 * swept-tube bodies with muscle bulge, countershaded bellies, sculpted head
 * forms, pupil shapes, neck chains, wagging tails, toes and hands for free,
 * and any future body-plan feature lands on all monsters at once.
 *
 * Palettes stay in creatureProfiles.ts (seeded skin-tone picks happen in
 * generateEntityBlueprint); this file owns only ANATOMY. Gaits the plan
 * language cannot express yet (hopper squash-hop, flyer fuselage) return null
 * and keep their legacy driver.
 */
import { CreatureType } from '../../types/creatures';
import type { SizeCategory } from './types';
import type { CreaturePlan, PlanAppendage, PlanHead } from './textPlan/planSchema';

/** Body plan without colors — generateEntityBlueprint stamps the palette. */
export type PlanTemplate = Omit<CreaturePlan, 'palette'>;

/** Seed stream shape shared with generateEntityBlueprint (seedPath rng). */
export type PlanRng = { next(): number };

/**
 * Seeded garnish variants for GENERIC monsters: an individual Large Dragon
 * rolls its horn style, an individual Beast rolls its ear set. Applied only
 * in the creature path of generateEntityBlueprint — humanoid race identities
 * (raceMap) are fixed by design and never pass through here.
 */
export const CREATURE_PART_VARIANTS: Readonly<Record<string, readonly string[]>> = {
  hornsStraight: ['hornsStraight', 'hornsCurved', 'hornsRam'],
  hornsCurved: ['hornsCurved', 'hornsStraight', 'hornsRam'],
  earsPointed: ['earsPointed', 'earsPointed', 'earsLong'], // pointed 2:1
};

function range(rng: PlanRng, lo: number, hi: number): number {
  return lo + rng.next() * (hi - lo);
}

function pickOne<T>(rng: PlanRng, items: readonly T[]): T {
  return items[Math.floor(rng.next() * items.length) % items.length];
}

/**
 * Seeded individuality for a template creature: generic proportion jitter
 * (limb/tail lengths, radii, bulge, taper, head size, snout) plus per-type
 * identity picks (dragon head form, monstrosity pupil). Templates are built
 * fresh per call, so the jittered copy is safe to hand out. Called only when
 * a seed stream is provided — omitting it keeps the historical fixed anatomy
 * byte-identical (tests, dev tools, the fixtures path).
 */
function varyPlan(creatureType: string, template: PlanTemplate, rng: PlanRng): PlanTemplate {
  const t: PlanTemplate = {
    ...template,
    frame: { ...template.frame },
    spine: { ...template.spine },
    appendages: template.appendages.map((a) => ({
      ...a,
      chain: a.chain.map((l) => ({ ...l })),
    })),
    heads: template.heads.map((h) => ({
      ...h,
      eyes: { ...h.eyes },
      ...(h.snout ? { snout: { ...h.snout } } : {}),
    })),
  };
  // generic proportion jitter — individuals, not clones
  if (t.frame.lengthFt !== undefined) t.frame.lengthFt *= range(rng, 0.94, 1.08);
  if (t.spine.bulge !== undefined) t.spine.bulge = Math.min(1, Math.max(0, t.spine.bulge * range(rng, 0.8, 1.2)));
  t.spine.taper = Math.min(1, Math.max(0.2, t.spine.taper + range(rng, -0.05, 0.05)));
  for (const [ai, a] of t.appendages.entries()) {
    for (const l of a.chain) {
      l.lenFt *= range(rng, 0.88, 1.14);
      l.r *= range(rng, 0.9, 1.12);
    }
    // Budget-neutral lengths: per-link jitter above varies SEGMENTATION, but
    // independent rolls stack multiplicatively down a chain — the 2026-07-27
    // "giraffe dragon" (forge seed 1: all 3 neck links rolled long while the
    // 2-link legs rolled short, a ~2x neck-vs-leg silhouette drift). Rescale
    // each chain so its TOTAL length lands in a tight band around the
    // template — individuals differ in build, species silhouettes stay sane.
    const tpl = template.appendages[ai];
    const tplTotal = tpl ? tpl.chain.reduce((s, l) => s + l.lenFt, 0) : 0;
    const gotTotal = a.chain.reduce((s, l) => s + l.lenFt, 0);
    if (tplTotal > 0 && gotTotal > 0) {
      const k = (tplTotal * range(rng, 0.94, 1.08)) / gotTotal;
      for (const l of a.chain) l.lenFt *= k;
    }
  }
  for (const h of t.heads) {
    h.sizeScale *= range(rng, 0.9, 1.12);
    if (h.snout) h.snout.lengthScale *= range(rng, 0.85, 1.25);
  }
  // per-type identity picks
  switch (creatureType as CreatureType) {
    case CreatureType.Dragon:
      // most dragons keep the heavy wolf-skull; some are lithe serpents
      if (rng.next() < 0.35) {
        t.heads = t.heads.map((h) => ({ ...h, form: 'serpent' as const }));
      }
      break;
    case CreatureType.Monstrosity:
      for (const h of t.heads) {
        h.eyes.pupil = pickOne(rng, ['goat', 'slit', 'round'] as const);
      }
      break;
    default:
      break;
  }
  return t;
}

/**
 * Profile parts the compiled plan body replaces: the plan grows its own tail
 * chains, head snouts, tentacle crowns, and belly volume, so the legacy
 * mesh/chain versions would double up. Everything else (horns, wings, ears,
 * crests, brows, beards, tusks, antennae) stays and rides the plan anchors.
 */
export const PLAN_REPLACED_PARTS: ReadonlySet<string> = new Set([
  'tailThin',
  'tailThick',
  'snout',
  'muzzleShort',
  'tentacles',
  'belly',
]);

/** Belly tone for countershading: the body hue lifted toward warm cream.
 * round 24 (creature-anatomy): mix 0.48 → 0.64 — the round-23 Beast Large
 * read "uniform gray, zero surface value variation"; at 0.48 the lift died
 * inside one toon band on mid-value hides. The ventral must land a full band
 * lighter (Valheim boar countershade). */
export function bellyToneFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const mix = (c: number, t: number) => Math.round(c + (t - c) * 0.64);
  const to2 = (v: number) => v.toString(16).padStart(2, '0');
  return `#${to2(mix(r, 0xe8))}${to2(mix(g, 0xdd))}${to2(mix(b, 0xc8))}`;
}

/* ------------------------------------------------------------ limb helpers */

/** Two-link quadruped legs; front pair finer, rear pair heavier (haunches). */
function quadLegs(reachFt: number, rFront: number, rRear: number): PlanAppendage[] {
  const mk = (attach: number, r0: number): PlanAppendage => ({
    kind: 'leg',
    attach,
    perSide: true,
    count: 1,
    chain: [
      { lenFt: reachFt * 0.52, r: r0 },
      { lenFt: reachFt * 0.48, r: r0 * 0.72 },
    ],
  });
  return [mk(0.14, rFront), mk(0.86, rRear)];
}

/** Two-link legs + arms for upright walkers; arms may end in hands. */
function bipedLimbs(h: number, legR: number, armR: number, hands: boolean): PlanAppendage[] {
  const legReach = h * 0.56;
  const armReach = h * 0.44;
  return [
    {
      kind: 'leg',
      attach: 0.97,
      perSide: true,
      count: 1,
      chain: [
        { lenFt: legReach * 0.52, r: legR },
        { lenFt: legReach * 0.48, r: legR * 0.7 },
      ],
    },
    {
      kind: 'arm',
      attach: 0.1,
      perSide: true,
      count: 1,
      ...(hands ? { tips: 'hand' as const } : {}),
      chain: [
        { lenFt: armReach * 0.52, r: armR },
        { lenFt: armReach * 0.48, r: armR * 0.75 },
      ],
    },
  ];
}

/** Tapering tail chain rooted at the spine rear. links = [lenFt, r] root→tip. */
function tailChain(links: Array<[number, number]>): PlanAppendage {
  return {
    kind: 'tail',
    attach: 1,
    heightFrac: 0.55,
    perSide: false,
    count: 1,
    chain: links.map(([lenFt, r]) => ({ lenFt, r })),
  };
}

/* ---------------------------------------------------------------- templates */

interface UprightOptions {
  bulge: number;
  taper: number;
  legR: number;
  armR: number;
  hands: boolean;
  head: PlanHead;
  /** Three-lobe chest/waist/hip profile (replaces bulge when set). */
  mass?: [number, number, number];
  extra?: PlanAppendage[];
}

function uprightPlan(name: string, h: number, b: number, o: UprightOptions): PlanTemplate {
  return {
    name,
    frame: { heightFt: h, bulk: b, stance: 'upright' },
    spine: { segments: 4, taper: o.taper, arch: 0.05, bulge: o.bulge, ...(o.mass ? { mass: o.mass } : {}) },
    appendages: [...bipedLimbs(h, o.legR, o.armR, o.hands), ...(o.extra ?? [])],
    heads: [o.head],
  };
}

/** The wolf/big-cat/bear body; also the skeletal-hound base (skull head). */
function beastPlan(name: string, h: number, b: number, head?: PlanHead): PlanTemplate {
  const reach = h * 0.98;
  return {
    name,
    frame: { heightFt: h, lengthFt: h * 2.3, bulk: Math.max(b, 0.35), stance: 'horizontal' },
    // round 23 (creature-anatomy): the Beast Large archetype read as "a gray
    // featureless sausage-lizard" (Remy, live debugger) — a uniform bulge
    // tube on stick legs. The fixture-round lessons now reach the default:
    // a real three-lobe mass profile (deep chest, tucked waist, driving
    // hips) and legs thick enough to carry haunches through compilePlan's
    // root swell.
    spine: { segments: 5, taper: 0.72, arch: 0.06, bulge: 0.42, mass: [1.32, 0.88, 1.18] },
    appendages: [
      ...quadLegs(reach, 0.48, 0.62),
      // round 24 (creature-anatomy): SHORT THICK REAL NECK — the round-23
      // verdict read the auto S-neck carriage as a "camel-long sausage neck";
      // that carriage is dragon-tuned (rise 2.15 bodyR). A beast gets an
      // explicit two-link neck: short, thick, flowing shoulder → skull.
      {
        kind: 'neck',
        attach: 0.05,
        perSide: false,
        count: 1,
        chain: [
          { lenFt: h * 0.22, r: 0.78 },
          { lenFt: h * 0.18, r: 0.62 },
        ],
      },
      tailChain([
        [h * 0.32, 0.3],
        [h * 0.28, 0.18],
        [h * 0.24, 0.1],
      ]),
    ],
    heads: [
      // every beast head (including the Monstrosity/Undead overrides) rides
      // the new neck chain — an unbound neck would render as a headless stump
      head ? { neckIndex: 2, ...head } : {
        neckIndex: 2,
        form: 'beast',
        // round 23 (creature-anatomy): 1.05 → 1.3 — the Large archetype's
        // skull vanished at sheet distance (the dragon/serpent lesson: the
        // head must out-gauge the neck that carries it)
        sizeScale: 1.3,
        // round 24 (creature-anatomy): 0.9 → 0.55 — "cartoon yellow eyes";
        // the dragon's round-6 lesson: small eyes sit IN the skull, big ones
        // sit ON it as googly discs.
        eyes: { count: 2, sizeScale: 0.55 },
        snout: { lengthScale: 1.05, droop: 0.12 },
      },
    ],
  };
}

/** Long thin legs around a small rounded body — spiders and giant insects. */
function spiderPlan(name: string, h: number, b: number): PlanTemplate {
  const reach = h * 1.3;
  const leg = (attach: number): PlanAppendage => ({
    kind: 'leg',
    attach,
    perSide: true,
    count: 1,
    chain: [
      { lenFt: reach * 0.55, r: 0.15 },
      { lenFt: reach * 0.45, r: 0.09 },
    ],
  });
  return {
    name,
    frame: { heightFt: h, lengthFt: h * 1.6, bulk: Math.max(b, 0.5), stance: 'horizontal' },
    spine: { segments: 4, taper: 0.6, arch: 0.1, bulge: 0.5 },
    appendages: [leg(0.18), leg(0.4), leg(0.6), leg(0.82)],
    heads: [{ sizeScale: 0.8, eyes: { count: 4, sizeScale: 0.7 } }],
  };
}

function dragonPlan(h: number, b: number): PlanTemplate {
  // 2026-07-28 "dachshund" fix: the torso was 2.8h long on 0.95h legs (~3:1 —
  // literally dachshund ratio). Now ~2:1 with a taller stance, which reads
  // big-cat/dragon instead of sausage-dog. Tail still supplies the length.
  const reach = h * 1.12;
  return {
    name: 'Dragon',
    frame: { heightFt: h, lengthFt: h * 1.8, bulk: Math.max(b, 0.55), stance: 'horizontal' },
    // three-lobe mass: deep chest (wings + forelegs), tucked waist, driving hips —
    // the 2026-07-27 "hot dog dragon" was the old single-sine bulge sausage
    spine: { segments: 5, taper: 0.7, arch: 0.08, bulge: 0.5, mass: [1.42, 0.76, 1.2] },
    appendages: [
      // heavier haunches than the generic quad — dragon hindquarters drive it
      ...quadLegs(reach, 0.52, 0.85),
      // index 2 — neck: ~0.6x torso per the mz-3 therapsid reference
      // (was 0.84h garden hose, then over-cut to 0.53h in wave 5);
      // thick base tapering to the head; compilePlan thickens it further
      {
        kind: 'neck',
        attach: 0.04,
        perSide: false,
        count: 1,
        chain: [
          { lenFt: h * 0.3, r: 0.72 },
          { lenFt: h * 0.26, r: 0.56 },
          { lenFt: h * 0.24, r: 0.44 },
          { lenFt: h * 0.2, r: 0.34 },
        ],
      },
      tailChain([
        [h * 0.56, 0.62],
        [h * 0.5, 0.46],
        [h * 0.42, 0.3],
        [h * 0.33, 0.16],
      ]),
    ],
    heads: [
      {
        neckIndex: 2,
        form: 'beast',
        sizeScale: 1.32, // a head big enough to justify the neck (was a knob)
        eyes: { count: 2, sizeScale: 0.9, pupil: 'slit' },
        snout: { lengthScale: 1.4, droop: 0.1 },
      },
    ],
  };
}

/* ------------------------------------------------------------------ table */

/**
 * Compile-ready anatomy for a creature recipe, or null when the type/cue
 * keeps a legacy gait (hopper squash-hop, flyer fuselage — motion styles the
 * plan language has no stance for yet).
 *
 * `heightFt`/`frameBulk` are the FINAL seeded values from the blueprint
 * generator (Frame-scale bulk, 0.6–1.6); plan bulk is the 0–1 plan scale.
 *
 * `rng` (optional): the caller's 'anatomy' seed stream. When given, the
 * template passes through `varyPlan` for per-individual jitter and identity
 * picks; when omitted, the fixed historical anatomy comes back byte-identical.
 */
export function planForCreature(
  creatureType: string,
  size: SizeCategory,
  cues: string[],
  heightFt: number,
  frameBulk: number,
  rng?: PlanRng,
): PlanTemplate | null {
  const template = basePlanForCreature(creatureType, size, cues, heightFt, frameBulk);
  if (!template || !rng) return template;
  return varyPlan(creatureType, template, rng);
}

/** The fixed anatomy table (seed-free); see planForCreature for the seeded path. */
function basePlanForCreature(
  creatureType: string,
  size: SizeCategory,
  cues: string[],
  heightFt: number,
  frameBulk: number,
): PlanTemplate | null {
  void size; // size is already folded into heightFt by the caller
  const h = heightFt;
  const b = Math.min(1, Math.max(0, frameBulk - 0.6));
  const has = (...want: string[]) => want.some((c) => cues.includes(c));

  switch (creatureType as CreatureType) {
    case CreatureType.Beast:
      if (has('bird', 'hawk', 'eagle', 'raven', 'owl', 'vulture')) return null; // flyer fuselage
      if (has('frog', 'toad')) return null; // hopper squash-hop
      if (has('spider', 'insect', 'beetle', 'centipede', 'scorpion')) return spiderPlan('Beast', h, b);
      return beastPlan('Beast', h, b);

    case CreatureType.Dragon:
      return dragonPlan(h, b);

    case CreatureType.Monstrosity:
      if (has('spider', 'insect', 'crawler', 'ankheg')) return spiderPlan('Monstrosity', h, b);
      if (has('bull', 'gorgon')) {
        return beastPlan('Monstrosity', h, Math.max(b, 0.6), {
          form: 'blunt',
          sizeScale: 1.1,
          eyes: { count: 2, sizeScale: 0.85 },
          snout: { lengthScale: 0.7, droop: 0.25 },
        });
      }
      return beastPlan('Monstrosity', h, b, {
        form: 'beast',
        sizeScale: 1.1,
        eyes: { count: 2, sizeScale: 0.9, pupil: 'goat' },
        snout: { lengthScale: 0.9, droop: 0.2 },
      });

    case CreatureType.Undead:
      if (has('wolf', 'beast', 'horse', 'hound', 'dog')) {
        return beastPlan('Undead', h, 0.1, {
          form: 'skull',
          sizeScale: 1.0,
          eyes: { count: 2, sizeScale: 0.8 },
          snout: { lengthScale: 1.0, droop: 0.1 },
        });
      }
      return uprightPlan('Undead', h, Math.min(b, 0.15), {
        bulge: 0.15,
        taper: 0.8,
        legR: 0.22,
        armR: 0.18,
        hands: true,
        head: { form: 'skull', sizeScale: 1.0, eyes: { count: 2, sizeScale: 0.8 } },
      });

    case CreatureType.Giant:
      return uprightPlan('Giant', h, Math.max(b, 0.6), {
        bulge: 0.45,
        taper: 0.8,
        legR: 0.34,
        armR: 0.3,
        hands: true,
        head: { form: 'blunt', sizeScale: 0.95, eyes: { count: 2, sizeScale: 0.85 } },
      });

    case CreatureType.Celestial:
      // round 24 (creature-anatomy): the round-23 verdict read "a beige
      // mannequin ... two dot eyes on an egg". A sculpted blunt head (brow
      // shelf, jaw — the face-zone treatment) replaces the ball+dots, and a
      // chest-dominant mass profile breaks the tube torso: guardian
      // shoulders over a drawn waist, not one smooth loft.
      return uprightPlan('Celestial', h, b, {
        bulge: 0.3,
        taper: 0.75,
        mass: [1.3, 0.82, 1.0],
        legR: 0.26,
        armR: 0.22,
        hands: true,
        head: { form: 'blunt', sizeScale: 1.0, eyes: { count: 2, sizeScale: 0.7 } },
      });

    case CreatureType.Construct:
      return uprightPlan('Construct', h, Math.max(b, 0.6), {
        bulge: 0.25,
        taper: 0.9,
        legR: 0.4,
        armR: 0.36,
        hands: true,
        head: { form: 'blunt', sizeScale: 0.9, eyes: { count: 2, sizeScale: 0.7 } },
      });

    case CreatureType.Fey:
      return uprightPlan('Fey', h, b, {
        bulge: 0.3,
        taper: 0.72,
        legR: 0.24,
        armR: 0.2,
        hands: true,
        head: { sizeScale: 1.05, eyes: { count: 2, sizeScale: 1.1 } },
      });

    case CreatureType.Fiend:
      return uprightPlan('Fiend', h, b, {
        bulge: 0.35,
        taper: 0.75,
        legR: 0.3,
        armR: 0.26,
        hands: true,
        head: {
          form: 'beast',
          sizeScale: 1.0,
          eyes: { count: 2, sizeScale: 0.9, pupil: 'slit' },
          snout: { lengthScale: 0.55, droop: 0.3 },
        },
        extra: [
          tailChain([
            [h * 0.4, 0.22],
            [h * 0.34, 0.13],
            [h * 0.3, 0.07],
          ]),
        ],
      });

    case CreatureType.Humanoid:
      if (has('skeleton')) {
        return uprightPlan('Humanoid', h, 0.1, {
          bulge: 0.15,
          taper: 0.8,
          legR: 0.22,
          armR: 0.18,
          hands: true,
          head: { form: 'skull', sizeScale: 1.0, eyes: { count: 2, sizeScale: 0.8 } },
        });
      }
      if (has('orc', 'ogre')) {
        return uprightPlan('Humanoid', h, Math.max(b, 0.55), {
          bulge: 0.4,
          taper: 0.82,
          legR: 0.34,
          armR: 0.3,
          hands: true,
          head: { form: 'blunt', sizeScale: 1.05, eyes: { count: 2, sizeScale: 0.85 } },
        });
      }
      if (has('goblin', 'kobold')) {
        return uprightPlan('Humanoid', h, Math.min(b, 0.3), {
          bulge: 0.3,
          taper: 0.72,
          legR: 0.26,
          armR: 0.22,
          hands: true,
          head: { sizeScale: 1.25, eyes: { count: 2, sizeScale: 1.1 } },
        });
      }
      return uprightPlan('Humanoid', h, b, {
        bulge: 0.35,
        taper: 0.78,
        legR: 0.3,
        armR: 0.26,
        hands: true,
        head: { form: 'blunt', sizeScale: 1.0, eyes: { count: 2, sizeScale: 0.9 } },
      });

    case CreatureType.Plant:
      return uprightPlan('Plant', h, Math.max(b, 0.55), {
        bulge: 0.4,
        taper: 0.85,
        legR: 0.32,
        armR: 0.28,
        hands: false,
        head: { form: 'blunt', sizeScale: 0.9, eyes: { count: 2, sizeScale: 0.7, pupil: 'goat' } },
      });

    case CreatureType.Elemental:
      // round 24 (creature-anatomy): THE named gap — the old floating
      // "jewelry display" (smooth gem-loft torso, pencil arms, featureless
      // sphere head) violated every line of the elemental design language
      // (.agent/critique-refs/elementals/DESIGN-LANGUAGE.md). The body is now
      // BUILT FROM THE ELEMENT: surface 'rock' makes the driver stack 3-6
      // overlapping boulder plates over the torso and every limb with dark
      // recessed joints, moss and crystal accents, and sunken glow eyes
      // under a brow plate. Anatomy follows the 14 references: a planted
      // top-heavy hulk — huge shoulders, massive long arms ending in
      // claw-mass hands (the biggest limb forms on the body), thick short
      // legs, and a small head low between the shoulders. Element subtypes
      // (fire/water/air) come later — one convincing earth elemental first.
      return {
        name: 'Elemental',
        frame: { heightFt: h, bulk: Math.max(b, 0.8), stance: 'upright' },
        surface: 'rock',
        // top-heavy: chest lobe (top of the upright spine) dominates, waist
        // tucks, pelvis re-widens for the planted stance
        spine: { segments: 5, taper: 0.9, arch: 0, mass: [1.5, 1.0, 1.2] },
        skin: { blend: 0.1 }, // rock joins hard — plates, not melted flesh
        appendages: [
          {
            // thick short planted legs — the earth golem's stumpy base
            kind: 'leg',
            attach: 0.95,
            perSide: true,
            count: 1,
            // round 24 second pass: the first capture buried the legs — the
            // torso sat on the ground and only toe stubs showed. Longer and
            // fatter, so the planted stance reads as legs carrying a mass.
            chain: [
              { lenFt: h * 0.3, r: 0.66 },
              { lenFt: h * 0.26, r: 0.54 },
            ],
          },
          {
            // massive arms: the biggest limbs on the body, knuckles near the
            // ground. The last link's fat radius IS the claw-mass gauge — the
            // driver's rocky hand scales palm and claws off it.
            kind: 'arm',
            attach: 0.08,
            heightFrac: 0.85,
            perSide: true,
            count: 1,
            tips: 'hand',
            chain: [
              { lenFt: h * 0.3, r: 0.5 },
              { lenFt: h * 0.26, r: 0.44 },
              { lenFt: h * 0.16, r: 0.52 },
            ],
          },
        ],
        // small head sunk low between the shoulders (the driver drops the
        // rocky upright socket); eyes count 0 — the driver draws sunken GLOW
        // eyes itself (unlit accent orbs under the brow plate), so the
        // assembler's white cartoon eyeballs must not double them.
        // round 24 second pass: 0.62 → 1.0. The head is still small next to
        // the shoulder boulders, but the face zone (brow + hollow + jaw +
        // glow eyes) is built off this radius, and at 0.62 the whole zone
        // vanished at panel distance.
        heads: [{ sizeScale: 1.0, eyes: { count: 0, sizeScale: 1 } }],
      };

    case CreatureType.Aberration:
      return {
        name: 'Aberration',
        frame: { heightFt: h, bulk: Math.max(b, 0.55), stance: 'floating' },
        spine: { segments: 4, taper: 0.6, arch: 0, bulge: 0.35 },
        appendages: [
          {
            kind: 'tentacle',
            attach: 0.55,
            heightFrac: 0.3,
            perSide: true,
            count: 2,
            chain: [
              { lenFt: h * 0.3, r: 0.2 },
              { lenFt: h * 0.26, r: 0.13 },
              { lenFt: h * 0.2, r: 0.07 },
            ],
          },
        ],
        heads: [{ sizeScale: 1.2, eyes: { count: 5, sizeScale: 0.8, pupil: 'goat' } }],
      };

    case CreatureType.Ooze:
      return null; // hopper squash-hop — no plan stance for it yet

    default:
      return null;
  }
}
