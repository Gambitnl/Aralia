// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 08:50:01
 * Dependents: state/reducers/npcReducer.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/social/npcWitnessMemory.ts
 * NPC Reaction Memory — what an NPC SAW the player do, and what they only HEARD.
 *
 * WHAT THIS ADDS
 * --------------
 * Two neighbouring systems already exist and are reused rather than re-built:
 *
 *   - `src/systems/social/npcEmotionalMemory.ts` (agora-fe77) owns the durable
 *     grudge/bond model: intensity, exponential decay, reinforce-instead-of-
 *     duplicate, and the derived combat/commerce/dialogue effects. This file
 *     does NOT re-implement any of that. It converts an observation into that
 *     module's `EmotionalMarker` and hands it over.
 *   - `src/systems/intrigue/RumorMillSystem.ts` (agora-9b) owns propagation:
 *     social graphs, per-day spread, staleness. This file does NOT re-implement
 *     gossip. Second-hand knowledge is produced by projecting an observation
 *     into a `NotableDeed`, letting the rumor mill carry it, and then reading it
 *     back off the rumors an NPC has actually heard.
 *
 * What was MISSING between them is the thing this file owns: the *witness
 * record*. A grudge says "I hate you". A rumor says "the town is talking".
 * Neither says "I watched you cut down three guards in the square and I am
 * deciding, right now, whether to surrender to you." That decision needs the
 * act itself — its domain, its scale, whether the NPC saw it or heard it, and
 * how sure they are.
 *
 * WHY AN INTERSECTION TYPE INSTEAD OF A FIELD ON `NpcMemory`
 * ---------------------------------------------------------
 * Same reason, and the same precedent, as `NpcMemoryWithEmotion`: the canonical
 * `NpcMemory` interface lives in `src/types/world.ts`, which is locked by another
 * agent (agora-9e0f) while this is being written. `NpcMemoryWithWitness` is an
 * intersection, structurally identical at runtime and assignable to `NpcMemory`
 * everywhere. FOLLOW-UP: when `src/types/world.ts` is free, move
 * `witnessedActs?` onto `NpcMemory` itself. Every reader here goes through
 * {@link getWitnessedActs}, so that move is a one-file change.
 *
 * PRESERVED / CONSUMERS
 * ---------------------
 * The reducer entry point (`RECORD_NPC_WITNESSED_ACT` /
 * `PRUNE_NPC_WITNESSED_ACTS`) is wired, so observations really do reach
 * `GameState.npcMemory`. The two readers originally postponed when this file was written are
 * now in place (agora-f58b):
 *
 *   - {@link deriveEncounterStance} is read by `src/utils/combat/combatAI.ts`
 *     (`resolveEncounterStance`), which supplies the one battlefield fact this
 *     module cannot compute for itself — `cornered` — and turns the resulting
 *     stance into a stand-down, a rout, or a refusal to retreat.
 *   - {@link buildWitnessDialogueContext} is read by
 *     `src/services/dialogueService.ts` (`describeWitnessRecall`), which wraps the
 *     recall lines into a prompt fragment beside the NPC knowledge profile.
 *
 * STILL UNWIRED ABOVE THOSE TWO: the hooks that call them —
 * `src/hooks/combat/useCombatAI.ts` and `src/hooks/useDialogueSystem.ts` — must
 * pass `GameState.npcMemory[npcId]` and the game day down. Both files are outside
 * this module's packet; the dialogue half is tracked as `agora-f821.12`.
 */

import type { NpcMemory } from '../../types/world';
import {
  createEmotionalMarker,
  recordEmotionalMarker,
  type EmotionalMarker,
  type EmotionalMarkerType,
  type NpcMemoryWithEmotion,
} from './npcEmotionalMemory';
import {
  advanceRumors,
  generateRumor,
  getRumorsForNpc,
  type NotableDeed,
  type RumorKind,
  type RumorSocialGraph,
  type RumorTone,
  type TownRumor,
} from '../intrigue/RumorMillSystem';

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

/** Did this NPC see it, or was it told to them? */
export type WitnessChannel = 'firsthand' | 'secondhand';

/** Which half of the design an observation belongs to. */
export type WitnessDomain = 'combat' | 'social';

/** Canonical combat observations from the design. */
export type CombatObservation =
  | 'defeated_foes'
  | 'spared_surrendering'
  | 'accepted_surrender'
  | 'executed_surrendering'
  | 'slaughtered_helpless'
  | 'protected_bystander'
  | 'fled_battle';

/** Canonical social observations from the design. */
export type SocialObservation =
  | 'donated_to_temple'
  | 'gave_to_beggar'
  | 'publicly_praised'
  | 'kept_word'
  | 'insulted_authority'
  | 'broke_word'
  | 'bribed_official'
  | 'threatened_civilian';

/**
 * Observation key. The designed keys are unioned in for autocomplete and
 * exhaustiveness, but the field stays assignable from `string` so quests and
 * AI-authored events can mint their own without editing this file — the same
 * deliberate openness as `EmotionalTrigger`.
 */
export type WitnessObservation = CombatObservation | SocialObservation | (string & {});

/** One thing an NPC believes the player did. */
export interface WitnessedAct {
  /** Stable id, unique within one NPC's list. */
  id: string;
  domain: WitnessDomain;
  observation: WitnessObservation;
  /** Game day the ACT happened (not the day it was heard about). */
  day: number;
  /** Who did it. Defaults to the player. */
  actorId: string;
  channel: WitnessChannel;
  /**
   * 0..1 belief. An eyewitness is 1. Hearsay degrades per hop, so an NPC can
   * hold a wrong-ish version of events without the system pretending it is fact.
   */
  confidence: number;
  /** Hops from the eyewitness. 0 = saw it themselves. */
  hops: number;
  /** Scale: 3 guards, 100 gold. 1 when the act is not countable. */
  magnitude: number;
  /** Free text folded into recall lines ("guards", "the goblins in the caves"). */
  detail?: string;
  locationId?: string;
  /** For second-hand acts, the NPC (or rumor) the story arrived through. */
  toldBy?: string;
}

/**
 * `NpcMemory` plus witness records. Intersected with `NpcMemoryWithEmotion` so a
 * single memory object can carry both witness records and the grudges/bonds they
 * produce without either module having to know the other's field.
 */
// 2026-09-09: `witnessedActs` now lives on `NpcMemory` itself (src/types/world.ts).
// The alias stays so existing readers and tests keep compiling unchanged.
export type NpcMemoryWithWitness = NpcMemoryWithEmotion;

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

/**
 * Belief multiplier per retelling hop. One retelling leaves an NPC fairly sure;
 * a fourth-hand story is barely worth acting on. Deliberately above the rumor
 * mill's staleness cutoff so a *believed* story can outlive the *talk* about it.
 */
export const SECONDHAND_CONFIDENCE_FALLOFF = 0.6;

/** Memory of a specific deed halves every 45 game days. */
export const WITNESS_HALF_LIFE_DAYS = 45;

/** Per-game-day exponential rate derived from the half-life. */
export const WITNESS_DECAY_RATE = Math.LN2 / WITNESS_HALF_LIFE_DAYS;

/** Below this weight an act no longer changes behavior, so pruning may drop it. */
export const WITNESS_FORGOTTEN_THRESHOLD = 0.05;

/**
 * How lopsided the mercy/brutality evidence must be before it overrides a
 * default stance. Set to one clearly-seen act: an NPC who watched you spare a
 * beaten man has seen enough to change how they open the next fight.
 */
export const STANCE_DECISION_THRESHOLD = 1;

/**
 * Demonstrated prowess at which the player stops being a peer and starts being
 * a threat. Roughly one decisive witnessed victory. Below it a merciful NPC
 * bargains; above it they yield, because yielding to someone who spares people
 * is survivable and fighting them is not.
 */
export const PROWESS_FEAR_THRESHOLD = 2;

/** Default actor for every observation: the player. */
export const PLAYER_ACTOR_ID = 'player';

// ---------------------------------------------------------------------------
// Observation catalog
// ---------------------------------------------------------------------------

interface ObservationDefinition {
  domain: WitnessDomain;
  /**
   * -1 (brutal) .. +1 (merciful). Only combat observations carry a non-zero
   * value; this is the axis requirement (4) turns into surrender-vs-fight.
   */
  mercy: number;
  /** -1 (this makes people like you less) .. +1 (more). Drives disposition. */
  valence: number;
  /** 0..1 how much the act demonstrates the player is dangerous. */
  prowess: number;
  /** Base weight of one occurrence, before magnitude/confidence/decay. */
  weight: number;
  /** Grudge or bond this act plants, or null for acts that plant neither. */
  emotion: EmotionalMarkerType | null;
  /** Raw 1-10 emotional intensity for a single, fully believed occurrence. */
  emotionIntensity: number;
  /** Rumor kind used when this act becomes town talk. */
  rumorKind: RumorKind;
  rumorTone: RumorTone;
  /** Verb phrase, `{count}` and `{detail}` substituted. See {@link describeWitnessedAct}. */
  phrase: string;
  /** Used when the caller supplies no detail. */
  fallbackDetail: string;
}

/**
 * The designed observations. Unknown keys are still allowed (see
 * {@link createWitnessedAct}); this table only supplies defaults.
 *
 * Note the asymmetry between `spared_surrendering` and `executed_surrendering`:
 * mercy is remembered as a bond of moderate strength, butchery as a strong
 * grudge. That is intentional — the design wants brutality to dominate an NPC's
 * read of the player, because fear is a louder signal than gratitude.
 */
export const WITNESS_OBSERVATIONS: Record<
  CombatObservation | SocialObservation,
  ObservationDefinition
> = {
  // --- Combat -------------------------------------------------------------
  defeated_foes: {
    domain: 'combat',
    mercy: 0,
    valence: 0,
    prowess: 0.8,
    weight: 1,
    emotion: null,
    emotionIntensity: 0,
    rumorKind: 'combat_victory',
    rumorTone: 'positive',
    phrase: 'defeat {count}{detail}',
    fallbackDetail: 'a fight they should not have won',
  },
  spared_surrendering: {
    domain: 'combat',
    mercy: 1,
    valence: 0.6,
    prowess: 0.3,
    weight: 1.4,
    emotion: 'bond',
    emotionIntensity: 5,
    rumorKind: 'combat_victory',
    rumorTone: 'positive',
    phrase: 'spare {detail}',
    fallbackDetail: 'a beaten enemy',
  },
  accepted_surrender: {
    domain: 'combat',
    mercy: 0.7,
    valence: 0.4,
    prowess: 0.4,
    weight: 1.1,
    emotion: 'bond',
    emotionIntensity: 4,
    rumorKind: 'combat_victory',
    rumorTone: 'positive',
    phrase: 'take {detail} alive',
    fallbackDetail: 'a surrendering foe',
  },
  executed_surrendering: {
    domain: 'combat',
    mercy: -1,
    valence: -0.8,
    prowess: 0.6,
    weight: 1.8,
    emotion: 'grudge',
    emotionIntensity: 8,
    rumorKind: 'crime',
    rumorTone: 'negative',
    phrase: 'cut down {detail} after they yielded',
    fallbackDetail: 'a man on his knees',
  },
  slaughtered_helpless: {
    domain: 'combat',
    mercy: -1,
    valence: -1,
    prowess: 0.5,
    weight: 2.2,
    emotion: 'grudge',
    emotionIntensity: 9,
    rumorKind: 'crime',
    rumorTone: 'negative',
    phrase: 'kill {count}{detail} who could not fight back',
    fallbackDetail: 'people',
  },
  protected_bystander: {
    domain: 'combat',
    mercy: 0.8,
    valence: 0.7,
    prowess: 0.3,
    weight: 1.3,
    emotion: 'bond',
    emotionIntensity: 6,
    rumorKind: 'quest_completed',
    rumorTone: 'positive',
    phrase: 'put yourself between {detail} and the blade',
    fallbackDetail: 'a stranger',
  },
  fled_battle: {
    domain: 'combat',
    mercy: 0,
    valence: -0.2,
    // A runner is not frightening. Negative prowess is how the model says
    // "this one does not scare me", which lowers flee propensity later.
    prowess: -0.4,
    weight: 0.8,
    emotion: null,
    emotionIntensity: 0,
    rumorKind: 'custom',
    rumorTone: 'negative',
    phrase: 'run from {detail}',
    fallbackDetail: 'a fight',
  },

  // --- Social -------------------------------------------------------------
  donated_to_temple: {
    domain: 'social',
    mercy: 0.3,
    valence: 0.7,
    prowess: 0,
    weight: 1.2,
    emotion: 'bond',
    emotionIntensity: 4,
    rumorKind: 'donation',
    rumorTone: 'positive',
    phrase: 'give {count}to {detail}',
    fallbackDetail: 'the temple',
  },
  gave_to_beggar: {
    domain: 'social',
    mercy: 0.4,
    valence: 0.4,
    prowess: 0,
    weight: 0.8,
    emotion: 'bond',
    emotionIntensity: 2,
    rumorKind: 'donation',
    rumorTone: 'positive',
    phrase: 'give {count}to {detail}',
    fallbackDetail: 'a beggar',
  },
  publicly_praised: {
    domain: 'social',
    mercy: 0.1,
    valence: 0.5,
    prowess: 0,
    weight: 0.9,
    emotion: 'bond',
    emotionIntensity: 3,
    rumorKind: 'custom',
    rumorTone: 'positive',
    phrase: 'speak up for {detail}',
    fallbackDetail: 'someone with no one else to speak for them',
  },
  kept_word: {
    domain: 'social',
    mercy: 0.2,
    valence: 0.6,
    prowess: 0,
    weight: 1,
    emotion: 'bond',
    emotionIntensity: 5,
    rumorKind: 'quest_completed',
    rumorTone: 'positive',
    phrase: 'keep your word about {detail}',
    fallbackDetail: 'what you promised',
  },
  insulted_authority: {
    domain: 'social',
    mercy: -0.2,
    valence: -0.6,
    prowess: 0.1,
    weight: 1.1,
    emotion: 'grudge',
    emotionIntensity: 4,
    rumorKind: 'custom',
    rumorTone: 'negative',
    phrase: 'insult {detail}',
    fallbackDetail: 'the magistrate',
  },
  broke_word: {
    domain: 'social',
    mercy: -0.2,
    valence: -0.7,
    prowess: 0,
    weight: 1.2,
    emotion: 'grudge',
    emotionIntensity: 5,
    rumorKind: 'custom',
    rumorTone: 'negative',
    phrase: 'go back on {detail}',
    fallbackDetail: 'your word',
  },
  bribed_official: {
    domain: 'social',
    mercy: 0,
    valence: -0.4,
    prowess: 0,
    weight: 1,
    emotion: 'grudge',
    emotionIntensity: 3,
    rumorKind: 'crime',
    rumorTone: 'negative',
    phrase: 'put coin in the hand of {detail}',
    fallbackDetail: 'an official',
  },
  threatened_civilian: {
    domain: 'social',
    mercy: -0.7,
    valence: -0.8,
    prowess: 0.4,
    weight: 1.5,
    emotion: 'grudge',
    emotionIntensity: 6,
    rumorKind: 'crime',
    rumorTone: 'negative',
    phrase: 'put {detail} in fear of your hands',
    fallbackDetail: 'an honest townsman',
  },
};

/** Lookup that tolerates caller-minted observation keys. */
export const getObservationDefinition = (
  observation: WitnessObservation
): ObservationDefinition | undefined =>
  WITNESS_OBSERVATIONS[observation as CombatObservation | SocialObservation];

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const clamp01 = (value: number): number => clamp(value, 0, 1);

// ---------------------------------------------------------------------------
// Creation and recording
// ---------------------------------------------------------------------------

let actSequence = 0;

/** Belief left after `hops` retellings. An eyewitness (0 hops) is certain. */
export const confidenceForHops = (hops: number): number =>
  hops <= 0 ? 1 : clamp01(SECONDHAND_CONFIDENCE_FALLOFF ** hops);

/**
 * Builds a witness record.
 *
 * An unknown observation must declare its own `domain`, because we cannot guess
 * whether a novel event is a fight or a conversation. Throwing (rather than
 * defaulting) keeps a typo from silently landing in the wrong half of the model.
 */
export const createWitnessedAct = (
  observation: WitnessObservation,
  day: number,
  overrides: Partial<Omit<WitnessedAct, 'observation' | 'day'>> = {}
): WitnessedAct => {
  const definition = getObservationDefinition(observation);
  const domain = overrides.domain ?? definition?.domain;

  if (!domain) {
    throw new Error(
      `createWitnessedAct: unknown observation "${observation}" requires an explicit \`domain\` override.`
    );
  }

  const hops = Math.max(0, overrides.hops ?? (overrides.channel === 'secondhand' ? 1 : 0));
  const channel: WitnessChannel = overrides.channel ?? (hops === 0 ? 'firsthand' : 'secondhand');

  return {
    id: overrides.id ?? `wit-${day}-${observation}-${(actSequence += 1)}`,
    domain,
    observation,
    day,
    actorId: overrides.actorId ?? PLAYER_ACTOR_ID,
    channel,
    // `?? confidenceForHops(hops)` and not `||`: an explicit 0 means "told by a
    // known liar" and must survive.
    confidence: clamp01(overrides.confidence ?? confidenceForHops(hops)),
    hops,
    magnitude: Math.max(0, overrides.magnitude ?? 1),
    ...(overrides.detail !== undefined ? { detail: overrides.detail } : {}),
    ...(overrides.locationId !== undefined ? { locationId: overrides.locationId } : {}),
    ...(overrides.toldBy !== undefined ? { toldBy: overrides.toldBy } : {}),
  };
};

/** Reads acts off any memory object, tolerating memories written before this system. */
export const getWitnessedActs = (memory: NpcMemory | undefined | null): WitnessedAct[] =>
  (memory as NpcMemoryWithWitness | undefined | null)?.witnessedActs ?? [];

/** Two records describe the same event when actor, act, day and detail all match. */
const sameEvent = (a: WitnessedAct, b: WitnessedAct): boolean =>
  a.actorId === b.actorId &&
  a.observation === b.observation &&
  a.day === b.day &&
  (a.detail ?? '') === (b.detail ?? '');

/**
 * Records an act on a memory, immutably.
 *
 * The de-duplication rule is BELIEF, not recency: an NPC who watched something
 * happen does not get less sure because a drunk repeated a garbled version at
 * them, so a lower-confidence retelling of an event they already know is
 * dropped. A better-informed version (fewer hops, higher confidence) replaces
 * the weaker one and keeps the stronger channel. Returns the same object when
 * nothing changed, to keep reducer identity checks cheap.
 */
export const recordWitnessedAct = (
  memory: NpcMemory,
  act: WitnessedAct
): NpcMemoryWithWitness => {
  const existing = getWitnessedActs(memory);
  const matchIndex = existing.findIndex(known => sameEvent(known, act));

  if (matchIndex === -1) {
    return { ...memory, witnessedActs: [...existing, act] };
  }

  const prior = existing[matchIndex];
  if (act.confidence <= prior.confidence) return memory as NpcMemoryWithWitness;

  const next = [...existing];
  next[matchIndex] = {
    ...act,
    id: prior.id,
    // Keep the largest scale anyone reported. A rumor that undercounts the dead
    // should not shrink what the eyewitness saw.
    magnitude: Math.max(prior.magnitude, act.magnitude),
  };
  return { ...memory, witnessedActs: next };
};

// ---------------------------------------------------------------------------
// Decay and pruning
// ---------------------------------------------------------------------------

/**
 * How much an act still counts at `gameDay`: belief times exponential fade.
 * Clock skew (a day before the act) returns the undecayed weight rather than
 * amplifying it, mirroring `effectiveIntensity` in npcEmotionalMemory.
 */
export const witnessWeight = (act: WitnessedAct, gameDay: number): number => {
  const elapsed = gameDay - act.day;
  if (elapsed <= 0) return act.confidence;
  return act.confidence * Math.exp(-WITNESS_DECAY_RATE * elapsed);
};

/**
 * Drops acts faded below {@link WITNESS_FORGOTTEN_THRESHOLD}. Like the emotional
 * model, this never rewrites `confidence`/`day`, so decay stays a pure function
 * of elapsed time and a save loaded on any day yields the same answer.
 */
export const pruneWitnessedActs = (
  memory: NpcMemory,
  gameDay: number,
  threshold: number = WITNESS_FORGOTTEN_THRESHOLD
): NpcMemoryWithWitness => {
  const existing = getWitnessedActs(memory);
  if (existing.length === 0) return memory as NpcMemoryWithWitness;

  const remaining = existing.filter(act => witnessWeight(act, gameDay) >= threshold);
  if (remaining.length === existing.length) return memory as NpcMemoryWithWitness;

  return { ...memory, witnessedActs: remaining };
};

// ---------------------------------------------------------------------------
// Reputation profile
// ---------------------------------------------------------------------------

/** What an NPC's witness records add up to, from their point of view. */
export interface WitnessReputation {
  /** 0..10 evidence the player shows mercy. */
  mercy: number;
  /** 0..10 evidence the player is brutal. */
  brutality: number;
  /** -10..10 how dangerous the player looks in a fight. */
  prowess: number;
  /** -10..10 net social standing from what they saw and heard. */
  standing: number;
  /** How many records were counted (before decay dropped any to zero). */
  sampleSize: number;
  /** True when at least one counted record was seen with their own eyes. */
  hasFirsthand: boolean;
}

/**
 * Magnitude is compressed logarithmically. Killing 3 guards is meaningfully
 * scarier than killing 1; killing 30 is not ten times scarier than killing 3,
 * it is just "a massacre". Linear scaling would let one big number swamp every
 * other thing the NPC ever saw.
 */
const magnitudeScale = (magnitude: number): number => 1 + Math.log10(Math.max(1, magnitude));

/** Aggregates witness records at `gameDay`. */
export const getWitnessReputation = (
  memory: NpcMemory,
  gameDay: number,
  actorId: string = PLAYER_ACTOR_ID
): WitnessReputation => {
  let mercy = 0;
  let brutality = 0;
  let prowess = 0;
  let standing = 0;
  let sampleSize = 0;
  let hasFirsthand = false;

  for (const act of getWitnessedActs(memory)) {
    if (act.actorId !== actorId) continue;
    const weight = witnessWeight(act, gameDay);
    if (weight <= 0) continue;

    const definition = getObservationDefinition(act.observation);
    if (!definition) continue;

    sampleSize += 1;
    if (act.channel === 'firsthand') hasFirsthand = true;

    const scaled = weight * definition.weight * magnitudeScale(act.magnitude);
    if (definition.mercy > 0) mercy += definition.mercy * scaled;
    else if (definition.mercy < 0) brutality += -definition.mercy * scaled;
    prowess += definition.prowess * scaled;
    standing += definition.valence * scaled;
  }

  return {
    mercy: clamp(mercy, 0, 10),
    brutality: clamp(brutality, 0, 10),
    prowess: clamp(prowess, -10, 10),
    standing: clamp(standing, -10, 10),
    sampleSize,
    hasFirsthand,
  };
};

/**
 * Disposition nudge, in the same -100..100 units as `NpcMemory.disposition`.
 * Deliberately conservative (10 points per point of standing): witness memory
 * colors an existing relationship, it does not replace the disposition system.
 * Requirement (3), disposition half.
 */
export const DISPOSITION_PER_STANDING_POINT = 10;

export const deriveWitnessDispositionShift = (
  memory: NpcMemory,
  gameDay: number,
  actorId: string = PLAYER_ACTOR_ID
): number =>
  Math.round(
    clamp(
      getWitnessReputation(memory, gameDay, actorId).standing * DISPOSITION_PER_STANDING_POINT,
      -100,
      100
    )
  );

// ---------------------------------------------------------------------------
// Encounter stance (requirement 4)
// ---------------------------------------------------------------------------

/** What this NPC is inclined to do when a fight with the player starts. */
export type EncounterStance =
  | 'negotiate'
  | 'surrender'
  | 'flee'
  | 'fight_to_death'
  | 'stand_ground';

export interface EncounterStanceResult {
  stance: EncounterStance;
  /** Independent 0..1 propensities. A caller may roll against one, or take `stance`. */
  surrender: number;
  negotiate: number;
  flee: number;
  fightToDeath: number;
  reputation: WitnessReputation;
  /** Plain-language reason, for combat logs and debugging. */
  reason: string;
}

/**
 * Turns what an NPC believes into how they open a fight.
 *
 * The design in one line: MERCY buys you surrenders and parley, BRUTALITY buys
 * you routs and last stands. Prowess is the amplifier on both — a merciful
 * nobody is ignored, a merciful monster is negotiated with.
 *
 * `cornered` exists because the brutality branch is genuinely ambiguous: someone
 * who saw you butcher prisoners runs if there is anywhere to run and dies with a
 * blade in hand if there is not. Without that flag the model would have to guess,
 * and guessing wrong is the difference between a chase and a massacre.
 *
 * Deterministic on purpose — no RNG here. The caller owns the roll, so combat
 * stays replayable from a seed it controls.
 */
export const deriveEncounterStance = (
  memory: NpcMemory,
  gameDay: number,
  options: { cornered?: boolean; actorId?: string } = {}
): EncounterStanceResult => {
  const actorId = options.actorId ?? PLAYER_ACTOR_ID;
  const cornered = options.cornered ?? false;
  const reputation = getWitnessReputation(memory, gameDay, actorId);
  const { mercy, brutality, prowess } = reputation;

  // Prowess only ever raises the stakes; a player nobody fears changes nothing.
  const danger = clamp01(Math.max(0, prowess) / (PROWESS_FEAR_THRESHOLD * 2));
  const mercyEdge = Math.max(0, mercy - brutality);
  const brutalEdge = Math.max(0, brutality - mercy);

  // Both merciful responses grow with the evidence of mercy; danger decides
  // WHICH of them. Yielding scales up with how outmatched the NPC feels,
  // bargaining scales down, because you only haggle with someone you could
  // plausibly fight.
  const surrender = clamp01((mercyEdge / 5) * (0.15 + 0.85 * danger));
  const negotiate = clamp01((mercyEdge / 5) * (0.9 - 0.5 * danger));
  // A cornered NPC cannot run, so the fear that would have become flight
  // becomes a last stand instead.
  const fearDriven = clamp01((brutalEdge / 6) * (0.4 + 0.6 * danger));
  const flee = cornered ? 0 : fearDriven;
  const fightToDeath = cornered ? clamp01(fearDriven + 0.15) : clamp01(fearDriven * 0.45);

  let stance: EncounterStance = 'stand_ground';
  let reason = 'No memory of this one either way.';

  if (mercyEdge >= STANCE_DECISION_THRESHOLD && mercyEdge >= brutalEdge) {
    // A crisp threshold rather than comparing two nearly-equal scores: the
    // continuous propensities stay available for callers that want to roll, but
    // the reported stance should not flip on a rounding error.
    stance = prowess >= PROWESS_FEAR_THRESHOLD ? 'surrender' : 'negotiate';
    reason = reputation.hasFirsthand
      ? 'Saw this one show mercy; yielding is survivable.'
      : 'Heard this one shows mercy; yielding is probably survivable.';
  } else if (brutalEdge >= STANCE_DECISION_THRESHOLD) {
    stance = cornered ? 'fight_to_death' : 'flee';
    reason = cornered
      ? 'Knows this one takes no prisoners, and there is nowhere to run.'
      : 'Knows this one takes no prisoners; better to run.';
  } else if (reputation.sampleSize > 0) {
    reason = 'Knows of this one, but nothing that settles the question.';
  }

  return { stance, surrender, negotiate, flee, fightToDeath, reputation, reason };
};

// ---------------------------------------------------------------------------
// Emotional bridge — reuses npcEmotionalMemory rather than duplicating it
// ---------------------------------------------------------------------------

/**
 * Projects an act into the grudge/bond model. Returns null for observations that
 * are informative but not personal (watching a stranger win a fight tells you
 * they are dangerous; it does not make you love or hate them).
 *
 * Intensity is scaled by belief and scale, so hearsay plants a weaker grudge
 * than an eyewitness account — which is exactly the design's point about
 * second-hand knowledge.
 */
export const emotionalMarkerFromWitnessedAct = (
  act: WitnessedAct
): EmotionalMarker | null => {
  const definition = getObservationDefinition(act.observation);
  if (!definition || !definition.emotion) return null;

  const intensity =
    definition.emotionIntensity * act.confidence * magnitudeScale(act.magnitude);

  return createEmotionalMarker(act.observation, act.day, {
    type: definition.emotion,
    intensity,
    note: describeWitnessedAct(act),
    ...(act.actorId !== PLAYER_ACTOR_ID ? { subjectId: act.actorId } : {}),
  });
};

/**
 * The single call a game system should make when an NPC observes something:
 * stores the witness record AND the grudge/bond it implies, on one memory
 * object, in one immutable update. Requirement (3) in one function.
 */
export const applyWitnessedAct = (
  memory: NpcMemory,
  act: WitnessedAct
): NpcMemoryWithWitness => {
  const withAct = recordWitnessedAct(memory, act);
  // Nothing recorded (a weaker retelling of a known event) means nothing to feel.
  if (withAct === memory) return memory as NpcMemoryWithWitness;

  const marker = emotionalMarkerFromWitnessedAct(act);
  if (!marker) return withAct;

  return recordEmotionalMarker(withAct, marker) as NpcMemoryWithWitness;
};

// ---------------------------------------------------------------------------
// Second-hand knowledge (requirement 5) — reuses RumorMillSystem
// ---------------------------------------------------------------------------

/**
 * Projects an act into a `NotableDeed` the rumor mill can carry.
 * The rumor id is derived from the act id so the story can be read back onto the
 * originating act; see {@link buildWitnessRumorIndex}.
 */
export const witnessedActToDeed = (
  act: WitnessedAct,
  sourceNpc: string,
  subject = 'the stranger'
): NotableDeed => {
  const definition = getObservationDefinition(act.observation);
  return {
    id: rumorIdForAct(act),
    kind: definition?.rumorKind ?? 'custom',
    day: act.day,
    sourceNpc,
    subject,
    detail: recallDetail(act),
    tone: definition?.rumorTone,
    magnitude: clamp01((definition?.weight ?? 1) / 2.2),
    ...(act.locationId !== undefined ? { locationId: act.locationId } : {}),
  };
};

/** Stable rumor id for an act, so a rumor can be mapped back to what happened. */
export const rumorIdForAct = (act: WitnessedAct): string => `rumor-of-${act.id}`;

/** rumorId -> the act it is talk about. Pass this to {@link learnFromRumors}. */
export const buildWitnessRumorIndex = (
  acts: WitnessedAct[]
): Record<string, WitnessedAct> => {
  const index: Record<string, WitnessedAct> = {};
  for (const act of acts) index[rumorIdForAct(act)] = act;
  return index;
};

/**
 * Starts town talk about acts that eyewitnesses saw, then runs the existing
 * rumor mill forward. Thin on purpose: spread, staleness and social graphs stay
 * owned by `RumorMillSystem`.
 */
export const spreadWitnessedActs = (
  acts: WitnessedAct[],
  witnessByActId: Record<string, string>,
  graph: RumorSocialGraph,
  fromDay: number,
  toDay: number,
  options: { subject?: string; seed?: number } = {}
): { rumors: TownRumor[]; index: Record<string, WitnessedAct> } => {
  const seed = options.seed ?? 0;
  const seeded = acts
    .filter(act => witnessByActId[act.id])
    .map((act, i) =>
      generateRumor(witnessedActToDeed(act, witnessByActId[act.id], options.subject), seed + i)
    );

  return {
    rumors: advanceRumors(seeded, graph, fromDay, toDay, seed),
    index: buildWitnessRumorIndex(acts),
  };
};

/**
 * Reads the rumors an NPC has actually heard back into their own memory as
 * second-hand records. This is what makes "I heard you defeated the goblins in
 * the caves" possible for an NPC who was nowhere near the caves.
 *
 * Rumors carry no teller chain (`TownRumor.reachedNpcs` records who knows, not
 * who told whom), so every rumor-learned act is one hop. The model supports
 * deeper chains for callers that DO track a chain — pass `hops` yourself via
 * {@link createWitnessedAct}. Stated plainly rather than faked, because an
 * invented hop count would silently distort confidence.
 */
export const learnFromRumors = (
  memory: NpcMemory,
  rumors: TownRumor[],
  index: Record<string, WitnessedAct>,
  npcId: string,
  gameDay: number
): NpcMemoryWithWitness => {
  let next: NpcMemoryWithWitness = memory as NpcMemoryWithWitness;

  for (const rumor of getRumorsForNpc(rumors, npcId, gameDay)) {
    const origin = index[rumor.id];
    // Not every rumor in a town is about a witnessed act; ignore the rest.
    if (!origin) continue;
    // An eyewitness does not learn from gossip about what they already saw.
    if (rumor.sourceNpc === npcId) continue;

    next = applyWitnessedAct(
      next,
      createWitnessedAct(origin.observation, origin.day, {
        domain: origin.domain,
        actorId: origin.actorId,
        channel: 'secondhand',
        hops: 1,
        magnitude: origin.magnitude,
        detail: origin.detail,
        locationId: origin.locationId,
        toldBy: rumor.sourceNpc,
        id: `heard-${npcId}-${origin.id}`,
      })
    );
  }

  return next;
};

// ---------------------------------------------------------------------------
// Dialogue context (requirement 3, dialogue half)
// ---------------------------------------------------------------------------

/** The detail string an NPC would actually use when recalling this act. */
const recallDetail = (act: WitnessedAct): string => {
  const definition = getObservationDefinition(act.observation);
  const detail = act.detail ?? definition?.fallbackDetail ?? act.observation;
  const count = act.magnitude > 1 ? `${act.magnitude} ` : '';
  const phrase = definition?.phrase ?? '{count}{detail}';
  return phrase.split('{count}').join(count).split('{detail}').join(detail);
};

/**
 * One line of recall, in the NPC's own mouth. "I saw you ..." for an eyewitness,
 * "I heard you ..." for hearsay — the grammatical difference IS the second-hand
 * knowledge feature, so it lives in one place rather than at every call site.
 */
export const describeWitnessedAct = (act: WitnessedAct): string => {
  const opener = act.channel === 'firsthand' ? 'I saw you' : 'I heard you';
  return `${opener} ${recallDetail(act)}.`;
};

/**
 * Prompt-ready recall lines for an NPC, strongest belief first. Plain strings so
 * either the scripted topic layer or the LLM prompt builder can take them, the
 * same contract as `buildRumorDialogueContext`.
 */
export const buildWitnessDialogueContext = (
  memory: NpcMemory,
  gameDay: number,
  max = 3
): string[] =>
  getWitnessedActs(memory)
    .map(act => ({ act, weight: witnessWeight(act, gameDay) }))
    .filter(entry => entry.weight >= WITNESS_FORGOTTEN_THRESHOLD)
    .sort((a, b) => b.weight - a.weight || b.act.day - a.act.day)
    .slice(0, max)
    .map(({ act }) => describeWitnessedAct(act));
