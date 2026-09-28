/**
 * @file src/systems/npcPersonality/types.ts
 * NPC Personality — core traits, quirks and dispositions (board task agora-d9e1).
 *
 * WHAT THIS IS
 * A small, serializable personality object hung off every generated NPC:
 * an `archetype` (the readable label), a `TraitMap` (five 0-10 numeric axes) and
 * two or three `quirks` (short behavioral lines for prompts and flavor text).
 *
 * WHY IT IS A NEW MODULE AND NOT A FIELD ON AN EXISTING ONE
 * Three sibling NPC systems already shipped on 2026-09-09 and each owns a
 * different slice of "who is this NPC":
 *   - `systems/social/speechProfile.ts`     -> HOW they talk (dialect/register/tics)
 *   - `systems/npc/backgroundBrief.ts`      -> WHERE they came from (history/secret)
 *   - `systems/social/npcEmotionalMemory.ts`-> HOW THEY FEEL ABOUT YOU (grudges/bonds)
 * None of them model stable disposition. Personality is that fourth slice, and it
 * deliberately does NOT re-derive anything the other three own. In particular
 * `personalityEffects.ts` produces MODIFIERS that compose with
 * `deriveEmotionalEffects` rather than a second aggression or price model.
 *
 * PRESERVED
 * `NPC.personality` is optional everywhere. An NPC without one behaves exactly as
 * before: every effect helper has a neutral default for `undefined`.
 *
 * NOT TO BE CONFUSED WITH
 * `VillagePersonality` (`src/types/village.ts`) describes a SETTLEMENT (wealth,
 * culture, industry). It was checked first; it has no per-person axis and no
 * overlap with these fields, so it is left untouched and unwidened.
 */

/**
 * Readable personality label. Ten archetypes, chosen so the set spans both
 * social warmth (friendly/cheerful vs suspicious/gruff) and motive
 * (greedy/cunning vs pious/scholarly), which is what the effect helpers key on.
 */
export type Archetype =
  | 'friendly'
  | 'suspicious'
  | 'greedy'
  | 'pious'
  | 'scholarly'
  | 'gruff'
  | 'cheerful'
  | 'melancholy'
  | 'cunning'
  | 'naive';

/** Stable, ordered list of every archetype. Exported for tables, tests and UI. */
export const ARCHETYPES: readonly Archetype[] = [
  'friendly',
  'suspicious',
  'greedy',
  'pious',
  'scholarly',
  'gruff',
  'cheerful',
  'melancholy',
  'cunning',
  'naive',
];

/**
 * Five-factor trait scores on a 0-10 scale (5 is unremarkable).
 *
 * The names follow the standard five-factor vocabulary on purpose: it is the one
 * personality axis set a reader is likely to already know, so a designer reading
 * `agreeableness: 2` needs no legend. `neuroticism` is the only inverted-feeling
 * axis (high = anxious), which the effect helpers account for explicitly.
 */
export interface TraitMap {
  openness: number;
  conscientiousness: number;
  extroversion: number;
  agreeableness: number;
  neuroticism: number;
}

/** Trait keys, ordered. Useful for iteration without `Object.keys` casts. */
export const TRAIT_KEYS: readonly (keyof TraitMap)[] = [
  'openness',
  'conscientiousness',
  'extroversion',
  'agreeableness',
  'neuroticism',
];

/** Lowest legal trait score. */
export const TRAIT_MIN = 0;
/** Highest legal trait score. */
export const TRAIT_MAX = 10;

/** Clamps a raw number onto the 0-10 trait scale. */
export const clampTrait = (value: number): number =>
  Math.max(TRAIT_MIN, Math.min(TRAIT_MAX, value));

/**
 * A generated NPC's personality.
 *
 * `quirks` are complete, human-readable behavior lines ("always offers tea"), not
 * ids — they are written straight into AI prompts and flavor text, and keeping
 * them as strings means an AI-authored NPC can supply its own without registering
 * anything. `traits` stays the machine-readable half.
 */
export interface NPCPersonality {
  archetype: Archetype;
  quirks: string[];
  traits: TraitMap;
}

/**
 * Baseline traits for each archetype, before per-NPC jitter.
 *
 * These are the numeric definition of each label: everything numeric downstream
 * (disposition modifiers, aggression, flee threshold) reads traits, not the
 * archetype string, so a hand-authored NPC can keep an archetype label while
 * tuning its numbers freely.
 */
export const ARCHETYPE_BASE_TRAITS: Readonly<Record<Archetype, TraitMap>> = {
  // Warm, agreeable, sociable, unbothered.
  friendly: { openness: 6, conscientiousness: 5, extroversion: 7, agreeableness: 9, neuroticism: 3 },
  // Closed, watchful, disagreeable and anxious — the classic paranoid townsfolk.
  suspicious: { openness: 3, conscientiousness: 7, extroversion: 3, agreeableness: 2, neuroticism: 7 },
  // Disciplined about money, cold about people.
  greedy: { openness: 4, conscientiousness: 7, extroversion: 6, agreeableness: 2, neuroticism: 4 },
  // Dutiful and kind, but incurious about anything outside doctrine.
  pious: { openness: 4, conscientiousness: 9, extroversion: 5, agreeableness: 7, neuroticism: 3 },
  // Maximum curiosity, low sociability.
  scholarly: { openness: 9, conscientiousness: 8, extroversion: 3, agreeableness: 5, neuroticism: 4 },
  // Blunt and hard, not actually anxious — gruff is not the same as suspicious.
  gruff: { openness: 3, conscientiousness: 7, extroversion: 4, agreeableness: 2, neuroticism: 2 },
  // The loud optimist.
  cheerful: { openness: 7, conscientiousness: 4, extroversion: 9, agreeableness: 8, neuroticism: 2 },
  // Withdrawn and fragile, but not unkind.
  melancholy: { openness: 6, conscientiousness: 5, extroversion: 2, agreeableness: 5, neuroticism: 8 },
  // Clever, controlled, and out for themselves.
  cunning: { openness: 8, conscientiousness: 7, extroversion: 6, agreeableness: 2, neuroticism: 3 },
  // Trusting to a fault and easily rattled — the reason naive NPCs flee early.
  naive: { openness: 7, conscientiousness: 3, extroversion: 6, agreeableness: 8, neuroticism: 6 },
};
