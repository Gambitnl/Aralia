/**
 * @file src/systems/npcPersonality/quirkGenerator.ts
 * Deterministic quirk selection and trait jitter (board task agora-d9e1).
 *
 * WHAT: given an archetype plus a world seed and an NPC identity, picks 2-3
 * distinct behavioral quirks and jitters the archetype's baseline traits, so two
 * greedy merchants in the same town are recognizably the same KIND of person
 * without being the same person.
 *
 * WHY DETERMINISTIC: `backgroundBrief.ts` established the rule for this NPC layer
 * — an NPC regenerated from a save must read identically. The rest of
 * `npcGenerator.ts` is still time-seeded (names, height, family), which is a known
 * inconsistency in that file, not something introduced here. Personality follows
 * the brief's rule rather than the generator's.
 *
 * TASK-TEXT NOTE: the task asks for "20 quirk sets, one per archetype" while
 * defining exactly 10 archetypes. Read as intent — a distinct pool per archetype,
 * deep enough that a pair of NPCs rarely collides — this ships 10 pools of 6, i.e.
 * 60 authored quirks. Flagged rather than padded with 10 unreachable pools.
 */

import { createSeededRandom } from '../../utils/random/seededRandom.js';
import { ARCHETYPE_BASE_TRAITS, clampTrait, TRAIT_KEYS } from './types.js';
import type { Archetype, TraitMap } from './types.js';

/**
 * Behavioral quirk pools, one per archetype.
 *
 * Written as complete predicate phrases ("always offers tea") so they drop
 * straight into an AI prompt after a subject, and into flavor text after a name.
 * Six per pool: enough that the 2-3 drawn per NPC give C(6,2)+C(6,3) = 35 distinct
 * combinations per archetype.
 */
export const QUIRK_POOLS: Readonly<Record<Archetype, readonly string[]>> = {
  friendly: [
    'always offers tea',
    'remembers your name',
    'tells long stories',
    'asks after your family',
    'walks you to the door',
    'presses food on visitors',
  ],
  suspicious: [
    'watches your hands',
    'asks many questions',
    'never turns their back',
    'repeats your answers back to you',
    'stands where the exit is behind them',
    'counts their stock while you talk',
  ],
  greedy: [
    'mentions prices unprompted',
    'eyes your equipment',
    'haggles everything',
    'weighs coins twice',
    'quotes what a rival would charge',
    'finds a reason the price just went up',
  ],
  pious: [
    'blesses you before you leave',
    'quotes scripture at odd moments',
    'touches a holy symbol when startled',
    'refuses to speak ill of the dead',
    'pauses to pray at the hour bell',
    'offers to light a candle for you',
  ],
  scholarly: [
    'corrects your terminology',
    'takes notes mid-conversation',
    'cites a source nobody has read',
    'gets distracted by an unrelated question',
    'asks to examine anything unusual you carry',
    'talks in numbered points',
  ],
  gruff: [
    'answers in as few words as possible',
    'grunts instead of greeting',
    'keeps working while you talk',
    'spits before saying anything unpleasant',
    'calls everyone by their trade, not their name',
    'ends conversations by turning away',
  ],
  cheerful: [
    'laughs at their own jokes',
    'greets you before you speak',
    'hums between sentences',
    'claps you on the shoulder',
    'insists the weather is fine regardless',
    'invents a nickname for you on the spot',
  ],
  melancholy: [
    'sighs at the end of sentences',
    'mentions someone they lost',
    'trails off mid-thought',
    'says the town used to be better',
    'looks past you while answering',
    'apologizes for taking your time',
  ],
  cunning: [
    'answers a question with a question',
    'smiles a beat too late',
    'lets a silence run long on purpose',
    'knows something about you they should not',
    'offers a favor before you ask for one',
    'never quite says no',
  ],
  naive: [
    'believes whatever you tell them',
    'asks what the world outside is like',
    'repeats gossip as fact',
    'volunteers information nobody asked for',
    'is visibly impressed by your gear',
    'assumes strangers mean well',
  ],
};

/** Minimum quirks per NPC (the task's lower bound). */
export const MIN_QUIRKS = 2;
/** Maximum quirks per NPC (the task's upper bound). */
export const MAX_QUIRKS = 3;

/** Inputs for a deterministic personality roll. */
export interface QuirkGenerationInput {
  archetype: Archetype;
  /**
   * World seed. Two worlds with different seeds give the same NPC different
   * quirks; the same world always gives the same ones. Defaults to 0.
   */
  worldSeed?: number;
  /**
   * Per-NPC identity string — pass the NPC id, or the name when no id exists yet.
   * Without it every NPC of an archetype in a world would draw the same quirks.
   */
  identity?: string;
}

/** Builds the RNG both quirk and trait rolls share, salted per purpose. */
function rngFor(input: QuirkGenerationInput, purpose: string): () => number {
  return createSeededRandom(
    input.worldSeed ?? 0,
    undefined,
    `${input.archetype}|${input.identity ?? 'anonymous'}`,
    purpose
  );
}

/**
 * Draws 2-3 distinct quirks for an NPC.
 *
 * Uses a partial Fisher-Yates over a copy of the pool rather than "roll until
 * unique": with a 6-entry pool the retry form is fine, but the shuffle keeps the
 * number of RNG draws fixed, which is what makes the result stable if the pool is
 * later extended at the END of the array.
 */
export function generateQuirks(input: QuirkGenerationInput): string[] {
  const pool = QUIRK_POOLS[input.archetype];
  if (!pool || pool.length === 0) return [];

  const rand = rngFor(input, 'quirks');
  const count = Math.min(pool.length, MIN_QUIRKS + Math.floor(rand() * (MAX_QUIRKS - MIN_QUIRKS + 1)));

  const remaining = [...pool];
  const picked: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.floor(rand() * remaining.length);
    picked.push(remaining.splice(index, 1)[0]);
  }
  return picked;
}

/** How far a jittered trait may move from its archetype baseline, in either direction. */
export const TRAIT_JITTER = 2;

/**
 * Applies +/- {@link TRAIT_JITTER} of deterministic jitter to an archetype's
 * baseline traits, clamped to 0-10.
 *
 * The jitter is what keeps the archetype a CENTER rather than a stereotype: a
 * gruff guard with `agreeableness: 4` is still gruff, but negotiable, and the
 * effect helpers read the number, not the label.
 */
export function generateTraits(input: QuirkGenerationInput): TraitMap {
  const base = ARCHETYPE_BASE_TRAITS[input.archetype] ?? ARCHETYPE_BASE_TRAITS.friendly;
  const rand = rngFor(input, 'traits');

  const traits = { ...base };
  for (const key of TRAIT_KEYS) {
    const offset = Math.round((rand() * 2 - 1) * TRAIT_JITTER);
    traits[key] = clampTrait(base[key] + offset);
  }
  return traits;
}
