import type { SizeCategory } from './types';
import type { CreaturePlan } from './textPlan/planSchema';
/** Body plan without colors — generateEntityBlueprint stamps the palette. */
export type PlanTemplate = Omit<CreaturePlan, 'palette'>;
/** Seed stream shape shared with generateEntityBlueprint (seedPath rng). */
export type PlanRng = {
    next(): number;
};
/**
 * Seeded garnish variants for GENERIC monsters: an individual Large Dragon
 * rolls its horn style, an individual Beast rolls its ear set. Applied only
 * in the creature path of generateEntityBlueprint — humanoid race identities
 * (raceMap) are fixed by design and never pass through here.
 */
export declare const CREATURE_PART_VARIANTS: Readonly<Record<string, readonly string[]>>;
/**
 * Profile parts the compiled plan body replaces: the plan grows its own tail
 * chains, head snouts, tentacle crowns, and belly volume, so the legacy
 * mesh/chain versions would double up. Everything else (horns, wings, ears,
 * crests, brows, beards, tusks, antennae) stays and rides the plan anchors.
 */
export declare const PLAN_REPLACED_PARTS: ReadonlySet<string>;
/** Belly tone for countershading: the body hue lifted toward warm cream. */
export declare function bellyToneFor(hex: string): string;
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
export declare function planForCreature(creatureType: string, size: SizeCategory, cues: string[], heightFt: number, frameBulk: number, rng?: PlanRng): PlanTemplate | null;
