/**
 * @file src/systems/npcPersonality/personalityEffects.ts
 * What a personality actually DOES (board task agora-d9e1).
 *
 * THREE EFFECTS, AND WHY EACH IS A MODIFIER RATHER THAN A MODEL
 *
 * 1. `dispositionModifier` returns a MULTIPLIER on an existing disposition delta.
 *    The deltas themselves live in `systems/memory/actionMemoryMatrix.ts`
 *    (`MemoryEffect.dispositionDelta`) and stay the single source of truth for
 *    "how much is a gift worth". Personality only says how much THIS person cares.
 *
 * 2. `combatAggression` returns a personality BASELINE in 0-1.
 *    `systems/social/npcEmotionalMemory.ts -> deriveEmotionalEffects` already owns
 *    grudge-driven aggression. Rather than forking that, {@link composeCombatAggression}
 *    blends the two, so there remains exactly one number the combat layer reads.
 *
 * 3. `dialogueTone` returns an adverb prefix. It sits BESIDE
 *    `systems/social/speechProfile.ts`, which owns dialect, register and verbal
 *    tics — the two never touch the same field. Speech says how the words are
 *    shaped; tone says what mood they are delivered in.
 *
 * DELIBERATELY NOT HERE: shop prices. `deriveEmotionalEffects.shopPriceMultiplier`
 * already models that, the task does not ask personality to move it, and a second
 * price model would be exactly the duplication this module is trying to avoid.
 *
 * NEUTRALITY: every helper accepts `undefined` and returns the do-nothing value,
 * so an NPC generated before this system behaves exactly as it did.
 */

import type { EmotionalEffects } from '../social/npcEmotionalMemory.js';
import type { Archetype, NPCPersonality, TraitMap } from './types.js';
import { ARCHETYPE_BASE_TRAITS } from './types.js';

// ---------------------------------------------------------------------------
// 1. Disposition
// ---------------------------------------------------------------------------

/**
 * Whether an action reads as good or bad to its target.
 *
 * Keys mirror `ACTION_MEMORY_MATRIX` in `systems/memory/actionMemoryMatrix.ts`.
 * That module is NOT imported: it was lock-held by a concurrent task, and more
 * importantly this file only needs the SIGN of an action, not its magnitude, so
 * importing the whole matrix would couple a pure scoring helper to a table that
 * pulls in the witness and emotional catalogs behind it. Unknown keys fall back
 * to `'neutral'`, so a matrix row added later still scores sanely.
 */
export type ActionValence = 'positive' | 'negative' | 'neutral';

/** Sign of each action the memory matrix routes. */
export const ACTION_VALENCE: Readonly<Record<string, ActionValence>> = {
  // Combat
  hit: 'negative',
  kill: 'negative',
  spare: 'positive',
  capture: 'positive',
  protect: 'positive',
  flee: 'negative',
  // Social
  gift: 'positive',
  insult: 'negative',
  praise: 'positive',
  defend_honor: 'positive',
  steal: 'negative',
  threaten: 'negative',
  rescue: 'positive',
  donate: 'positive',
  almsgiving: 'positive',
  bribe: 'neutral',
  // Quest
  complete: 'positive',
  fail: 'negative',
  betray: 'negative',
};

/**
 * Per-archetype overrides for specific actions.
 *
 * These are the character beats worth hand-writing; everything not listed falls
 * through to the trait math below. A greedy merchant discounting gifts is the
 * task's own worked example and is the reason this layer exists at all: a gift
 * from a stranger reads to them as an opening bid, not a kindness.
 */
const ARCHETYPE_ACTION_OVERRIDES: Readonly<Partial<Record<Archetype, Readonly<Record<string, number>>>>> = {
  greedy: {
    gift: 0.5, // A gift is a bid, not a gesture.
    donate: 0.6,
    almsgiving: 0.5,
    bribe: 1.6, // Coin, however, speaks clearly.
    steal: 1.6, // And theft is the unforgivable one.
  },
  pious: {
    almsgiving: 1.8,
    donate: 1.7,
    bribe: 0.2, // Offering money to a priest is itself an insult.
    betray: 1.4,
    protect: 1.3,
  },
  scholarly: {
    praise: 1.3, // Recognition of the work lands harder than a present.
    gift: 0.8,
    complete: 1.3,
  },
  gruff: {
    praise: 0.5, // Flattery bounces off.
    protect: 1.4, // Deeds do not.
    threaten: 0.7, // Hard to rattle.
  },
  cunning: {
    bribe: 1.4,
    gift: 0.9,
    betray: 1.5, // They notice, and they keep the ledger.
  },
  naive: {
    gift: 1.4,
    praise: 1.4,
    betray: 1.6, // Because they never saw it coming.
  },
  suspicious: {
    gift: 0.6, // What do they want?
    praise: 0.5,
  },
  melancholy: {
    praise: 1.2,
    rescue: 1.3,
  },
};

/** Trait scaling strength: at trait 10 a positive action lands `1 + POSITIVE_TRAIT_SWING` times as hard. */
const POSITIVE_TRAIT_SWING = 0.5;
/** At neuroticism/disagreeableness 10, a negative action stings `1 + NEGATIVE_TRAIT_SWING` times as hard. */
const NEGATIVE_TRAIT_SWING = 0.6;

/** Multipliers are clamped so no personality can zero out or invert a delta. */
export const MIN_DISPOSITION_MODIFIER = 0.2;
export const MAX_DISPOSITION_MODIFIER = 2.5;

const clampModifier = (value: number): number =>
  Math.max(MIN_DISPOSITION_MODIFIER, Math.min(MAX_DISPOSITION_MODIFIER, value));

/** Maps a 0-10 trait onto -1..1, where 5 is neutral. */
const centered = (trait: number): number => (trait - 5) / 5;

/**
 * How strongly THIS personality reacts to `action`.
 *
 * Returns a multiplier to apply to `MemoryEffect.dispositionDelta`, never a delta
 * of its own. `1` means "reacts exactly as the matrix says", which is also what an
 * NPC with no personality returns.
 *
 * Composition order: the archetype override (if any) multiplies the trait-derived
 * scaling, so a greedy NPC with unusually high agreeableness still discounts gifts
 * — just less than a typical one.
 */
export function dispositionModifier(
  personality: NPCPersonality | undefined | null,
  action: string
): number {
  if (!personality) return 1;

  const traits = personality.traits ?? ARCHETYPE_BASE_TRAITS[personality.archetype];
  const valence = ACTION_VALENCE[action] ?? 'neutral';
  const override = ARCHETYPE_ACTION_OVERRIDES[personality.archetype]?.[action] ?? 1;

  let traitScale = 1;
  if (valence === 'positive') {
    // Warm, open people are moved by kindness; cold ones shrug it off.
    traitScale = 1 + centered(traits.agreeableness) * POSITIVE_TRAIT_SWING;
  } else if (valence === 'negative') {
    // Anxious and disagreeable people take injury harder, and hold it.
    const grievance = (centered(traits.neuroticism) - centered(traits.agreeableness)) / 2;
    traitScale = 1 + grievance * NEGATIVE_TRAIT_SWING;
  }

  return clampModifier(traitScale * override);
}

/**
 * Convenience wrapper: the matrix's delta, scaled by this personality.
 * Rounded because `NpcMemory.disposition` is an integer scale.
 */
export function applyDispositionModifier(
  personality: NPCPersonality | undefined | null,
  action: string,
  baseDelta: number
): number {
  return Math.round(baseDelta * dispositionModifier(personality, action));
}

// ---------------------------------------------------------------------------
// 2. Combat
// ---------------------------------------------------------------------------

/**
 * Personality's standing appetite for a fight, 0-1.
 *
 * This is a BASELINE, not the final number a combat AI should read — see
 * {@link composeCombatAggression}. It is driven by traits rather than the
 * archetype label so an authored NPC can tune it without leaving its archetype.
 *
 * Aggression rises with disagreeableness (willingness to harm) and falls with
 * neuroticism (nerve). Conscientiousness contributes a little: a dutiful NPC
 * presses an attack they believe is theirs to make.
 */
export function combatAggression(personality: NPCPersonality | undefined | null): number {
  if (!personality) return 0.5;
  const traits = personality.traits ?? ARCHETYPE_BASE_TRAITS[personality.archetype];

  const hostility = (10 - traits.agreeableness) / 10; // 0..1
  const nerve = (10 - traits.neuroticism) / 10; // 0..1
  const duty = traits.conscientiousness / 10; // 0..1

  const raw = hostility * 0.5 + nerve * 0.35 + duty * 0.15;
  return Number(Math.max(0, Math.min(1, raw)).toFixed(4));
}

/**
 * Fraction of max HP at which this NPC starts looking for a way out.
 *
 * The naive/gruff contrast the task asks for lands here rather than in
 * {@link combatAggression}: "flees sooner" is a morale threshold, not an appetite.
 * Ranges roughly 0.1 (a gruff veteran fights to the last) to 0.5 (a naive
 * townsperson runs at half health).
 */
export function fleeHealthThreshold(personality: NPCPersonality | undefined | null): number {
  if (!personality) return 0.25;
  const traits = personality.traits ?? ARCHETYPE_BASE_TRAITS[personality.archetype];
  const raw = 0.12 + (traits.neuroticism / 10) * 0.3 + ((10 - traits.conscientiousness) / 10) * 0.1;
  return Number(Math.max(0.05, Math.min(0.6, raw)).toFixed(4));
}

/** Weight of personality when blending with grudge-driven aggression. */
const PERSONALITY_AGGRESSION_WEIGHT = 0.6;

/**
 * The one aggression number combat should read.
 *
 * `deriveEmotionalEffects(...).combatAggression` is grudge-driven and starts at 0
 * for an NPC who has never met you; personality is the standing baseline. A plain
 * average would let a fresh grudge DILUTE a naturally hostile NPC, so the blend is
 * weighted toward personality and then floored at the grudge value: a strong
 * grudge can only ever raise aggression, never lower it.
 *
 * Passing no emotional effects returns the bare personality baseline, which is the
 * correct answer for a first encounter.
 */
export function composeCombatAggression(
  personality: NPCPersonality | undefined | null,
  emotional?: Pick<EmotionalEffects, 'combatAggression'> | null
): number {
  const base = combatAggression(personality);
  if (!emotional) return base;

  const blended =
    base * PERSONALITY_AGGRESSION_WEIGHT +
    emotional.combatAggression * (1 - PERSONALITY_AGGRESSION_WEIGHT);
  return Number(Math.max(0, Math.min(1, Math.max(blended, emotional.combatAggression))).toFixed(4));
}

// ---------------------------------------------------------------------------
// 3. Dialogue tone
// ---------------------------------------------------------------------------

/**
 * Adverb per archetype, used as a delivery prefix ("suspiciously", "warmly").
 *
 * Kept as an authored table rather than derived from traits: an adverb is a
 * writing choice, and "melancholy -> wearily" is not something trait arithmetic
 * would ever produce well.
 */
export const ARCHETYPE_TONES: Readonly<Record<Archetype, string>> = {
  friendly: 'warmly',
  suspicious: 'suspiciously',
  greedy: 'shrewdly',
  pious: 'solemnly',
  scholarly: 'precisely',
  gruff: 'curtly',
  cheerful: 'brightly',
  melancholy: 'wearily',
  cunning: 'smoothly',
  naive: 'eagerly',
};

/** Tone used when an NPC has no personality — the pre-existing neutral delivery. */
export const DEFAULT_TONE = 'plainly';

/**
 * Delivery adverb for this NPC's line.
 *
 * Extreme traits override the archetype's default, because a specific NPC's
 * numbers should be able to beat their label: a scholarly NPC rolled with
 * neuroticism 9 reads as nervous, whatever the table says.
 */
export function dialogueTone(personality: NPCPersonality | undefined | null): string {
  if (!personality) return DEFAULT_TONE;

  const traits: TraitMap = personality.traits ?? ARCHETYPE_BASE_TRAITS[personality.archetype];
  if (traits.neuroticism >= 9) return 'nervously';
  if (traits.agreeableness <= 1) return 'coldly';
  if (traits.extroversion >= 9) return 'loudly';

  return ARCHETYPE_TONES[personality.archetype] ?? DEFAULT_TONE;
}

/**
 * One-line prompt hint, mirroring `describeSpeechProfile` in
 * `systems/social/speechProfile.ts` so the two can be concatenated into an AI
 * prompt without either knowing about the other.
 *
 * Returns an empty string for a missing personality so callers can append it
 * unconditionally.
 */
export function describePersonality(personality: NPCPersonality | undefined | null): string {
  if (!personality) return '';
  const quirks = personality.quirks?.length
    ? ` Your habits: ${personality.quirks.join('; ')}.`
    : '';
  return `You come across as ${personality.archetype}, and you speak ${dialogueTone(personality)}.${quirks}`;
}
