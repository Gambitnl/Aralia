// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 08:29:09
 * Dependents: state/reducers/npcReducer.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/systems/social/npcEmotionalMemory.ts
 * NPC Grudge & Bond System — persistent emotional memory.
 *
 * WHAT THIS ADDS
 * NPCs already remember facts, goals, suspicion and a scalar `disposition`
 * (`src/types/world.ts` -> `NpcMemory`). That scalar cannot say WHY an NPC feels a
 * certain way, so it cannot drive "you killed my brother" behavior that survives
 * across encounters. This module adds discrete, dated emotional markers on top of
 * the existing memory object — it does not replace disposition, and nothing here
 * changes existing disposition math.
 *
 * WHY IT IS AN INTERSECTION TYPE INSTEAD OF A FIELD ON `NpcMemory`
 * The canonical `NpcMemory` interface lives in `src/types/world.ts`, which was
 * locked by another agent when this system was written. Rather than block, markers
 * are attached through {@link NpcMemoryWithEmotion} (an intersection), which is
 * structurally identical at runtime and assignable to `NpcMemory` everywhere.
 * FOLLOW-UP: when `src/types/world.ts` is free, move `emotionalMarkers?` onto
 * `NpcMemory` itself and re-point {@link NpcMemoryWithEmotion} at it. All readers
 * already go through {@link getEmotionalMarkers}, so that move is a one-file change.
 *
 * DECAY MODEL
 * Markers fade exponentially. `decay_rate` is a per-game-day rate, stored on each
 * marker so authored or AI-generated markers can be stubborn or fleeting:
 *   effective = intensity * e^(-decay_rate * daysElapsed)
 * Default rates come from the design half-lives: grudges halve every 30 game days,
 * bonds every 90. A marker with `decay_rate: 0` never fades (blood feuds, oaths).
 */

import type { NpcMemory } from '../../types/world';

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

/** A grudge is remembered harm; a bond is remembered kindness. */
export type EmotionalMarkerType = 'grudge' | 'bond';

/** Canonical grudge triggers from the design. */
export type GrudgeTrigger =
  | 'killed_friend'
  | 'stole_from_them'
  | 'broke_promise'
  | 'threatened_family';

/** Canonical bond triggers from the design. */
export type BondTrigger =
  | 'saved_life'
  | 'completed_quest'
  | 'generous_gift'
  | 'defended_honor';

/**
 * Trigger identifier. The known triggers are unioned in for autocomplete and
 * exhaustiveness, but the field stays assignable from `string` so future systems
 * (quests, AI-authored events) can mint their own trigger keys without editing
 * this file. That openness is deliberate — see the repo's expansion-first rule.
 */
export type EmotionalTrigger = GrudgeTrigger | BondTrigger | (string & {});

/**
 * One persistent emotional marker in an NPC's memory.
 * Field names follow the design spec verbatim (`decay_rate`, `created_at`) so the
 * shape matches save data and task documentation rather than local camelCase habit.
 */
export interface EmotionalMarker {
  /** Stable id, unique within one NPC's marker list. */
  id: string;
  type: EmotionalMarkerType;
  trigger: EmotionalTrigger;
  /** Raw strength at `created_at`, 1 (a slight) to 10 (unforgivable / life debt). */
  intensity: number;
  /** Per-game-day exponential decay rate. 0 means "never forgets". */
  decay_rate: number;
  /** Game day the marker was created (see `getGameDay` in utils/core/timeUtils). */
  created_at: number;
  /** Optional human/AI-readable line for dialogue and logs. */
  note?: string;
  /** Who the marker is about, when it is not the player (e.g. the friend who died). */
  subjectId?: string;
}

/**
 * `NpcMemory` plus emotional markers. See the file header for why this is an
 * intersection rather than a field on `NpcMemory`.
 */
// 2026-09-09: `emotionalMarkers` now lives on `NpcMemory` itself (src/types/world.ts).
// The alias stays so existing readers and tests keep compiling unchanged.
export type NpcMemoryWithEmotion = NpcMemory;

// ---------------------------------------------------------------------------
// Decay constants
// ---------------------------------------------------------------------------

/** Grudges halve every 30 game days. */
export const GRUDGE_HALF_LIFE_DAYS = 30;
/** Bonds halve every 90 game days — kindness outlasts injury. */
export const BOND_HALF_LIFE_DAYS = 90;

/** Converts a half-life in game days into the exponential rate stored on a marker. */
export const decayRateForHalfLife = (halfLifeDays: number): number =>
  halfLifeDays > 0 ? Math.LN2 / halfLifeDays : 0;

export const GRUDGE_DECAY_RATE = decayRateForHalfLife(GRUDGE_HALF_LIFE_DAYS);
export const BOND_DECAY_RATE = decayRateForHalfLife(BOND_HALF_LIFE_DAYS);

/**
 * Below this effective intensity a marker no longer changes behavior in any
 * meaningful way, so pruning may drop it. Kept above 0 because exponential decay
 * never reaches 0 and an unpruned list would grow without bound.
 */
export const MARKER_FORGOTTEN_THRESHOLD = 0.25;

// ---------------------------------------------------------------------------
// Trigger catalog
// ---------------------------------------------------------------------------

interface TriggerDefinition {
  type: EmotionalMarkerType;
  /** Default raw intensity, 1-10. Callers may override per situation. */
  intensity: number;
  /** Default note used when the caller supplies none. */
  note: string;
}

/**
 * The eight designed triggers. Unknown trigger keys are still allowed (see
 * {@link createEmotionalMarker}); this table only supplies defaults.
 */
export const EMOTIONAL_TRIGGERS: Record<GrudgeTrigger | BondTrigger, TriggerDefinition> = {
  // Grudges
  killed_friend: { type: 'grudge', intensity: 9, note: 'You killed someone they cared about.' },
  threatened_family: { type: 'grudge', intensity: 8, note: 'You threatened their family.' },
  stole_from_them: { type: 'grudge', intensity: 5, note: 'You stole from them.' },
  broke_promise: { type: 'grudge', intensity: 4, note: 'You broke a promise to them.' },
  // Bonds
  saved_life: { type: 'bond', intensity: 9, note: 'You saved their life.' },
  defended_honor: { type: 'bond', intensity: 6, note: 'You defended their honor.' },
  completed_quest: { type: 'bond', intensity: 5, note: 'You finished what they asked of you.' },
  generous_gift: { type: 'bond', intensity: 3, note: 'You gave them a generous gift.' },
};

const clampIntensity = (value: number): number => Math.max(0, Math.min(10, value));

// ---------------------------------------------------------------------------
// Creation and recording
// ---------------------------------------------------------------------------

let markerSequence = 0;

/**
 * Builds a marker for a trigger at a game day.
 *
 * Unknown triggers are permitted but must declare their own `type`, because we
 * cannot guess whether a novel event is harm or kindness. Throwing here (rather
 * than defaulting to 'grudge') keeps a typo from silently making an NPC hostile.
 */
export const createEmotionalMarker = (
  trigger: EmotionalTrigger,
  gameDay: number,
  overrides: Partial<Omit<EmotionalMarker, 'trigger' | 'created_at'>> = {}
): EmotionalMarker => {
  const definition = EMOTIONAL_TRIGGERS[trigger as GrudgeTrigger | BondTrigger];
  const type = overrides.type ?? definition?.type;

  if (!type) {
    throw new Error(
      `createEmotionalMarker: unknown trigger "${trigger}" requires an explicit \`type\` override.`
    );
  }

  const defaultRate = type === 'grudge' ? GRUDGE_DECAY_RATE : BOND_DECAY_RATE;

  return {
    id: overrides.id ?? `emo-${gameDay}-${trigger}-${(markerSequence += 1)}`,
    type,
    trigger,
    intensity: clampIntensity(overrides.intensity ?? definition?.intensity ?? 5),
    // `?? defaultRate` and not `|| defaultRate`: 0 is a legal "never forgets" rate.
    decay_rate: overrides.decay_rate ?? defaultRate,
    created_at: gameDay,
    ...(overrides.note ?? definition?.note ? { note: overrides.note ?? definition?.note } : {}),
    ...(overrides.subjectId ? { subjectId: overrides.subjectId } : {}),
  };
};

/** Reads markers off any memory object, tolerating memories written before this system. */
export const getEmotionalMarkers = (memory: NpcMemory | undefined | null): EmotionalMarker[] =>
  (memory as NpcMemoryWithEmotion | undefined | null)?.emotionalMarkers ?? [];

/**
 * Records a marker on a memory, immutably.
 *
 * Repeating the same offense against the same subject REINFORCES the existing
 * marker instead of appending a duplicate: the old marker is decayed to `gameDay`,
 * the new intensity is added on top (capped at 10), and `created_at` is reset so
 * decay restarts from the fresh injury. Without this, stealing ten copper pieces
 * ten times would out-weigh a murder purely by list length.
 */
export const recordEmotionalMarker = (
  memory: NpcMemory,
  marker: EmotionalMarker
): NpcMemoryWithEmotion => {
  const existing = getEmotionalMarkers(memory);
  const matchIndex = existing.findIndex(
    m => m.type === marker.type && m.trigger === marker.trigger && m.subjectId === marker.subjectId
  );

  if (matchIndex === -1) {
    return { ...memory, emotionalMarkers: [...existing, marker] };
  }

  const prior = existing[matchIndex];
  const decayedPrior = effectiveIntensity(prior, marker.created_at);
  const reinforced: EmotionalMarker = {
    ...prior,
    intensity: clampIntensity(decayedPrior + marker.intensity),
    decay_rate: marker.decay_rate,
    created_at: marker.created_at,
    note: marker.note ?? prior.note,
  };

  const next = [...existing];
  next[matchIndex] = reinforced;
  return { ...memory, emotionalMarkers: next };
};

// ---------------------------------------------------------------------------
// Decay and pruning
// ---------------------------------------------------------------------------

/**
 * Current strength of a marker at `gameDay`.
 * Clock skew (a day earlier than creation) returns the raw intensity rather than
 * amplifying the marker, so a bad timestamp cannot manufacture a super-grudge.
 */
export const effectiveIntensity = (marker: EmotionalMarker, gameDay: number): number => {
  const elapsed = gameDay - marker.created_at;
  if (elapsed <= 0 || marker.decay_rate <= 0) return marker.intensity;
  return marker.intensity * Math.exp(-marker.decay_rate * elapsed);
};

/**
 * Drops markers that have faded below {@link MARKER_FORGOTTEN_THRESHOLD}.
 * Intentionally does NOT rewrite `intensity`/`created_at`: decay stays a pure
 * function of elapsed time so a save loaded at any day yields the same answer.
 * Returns the same object when nothing was forgotten, to keep reducer identity
 * checks cheap.
 */
export const pruneEmotionalMarkers = (
  memory: NpcMemory,
  gameDay: number,
  threshold: number = MARKER_FORGOTTEN_THRESHOLD
): NpcMemoryWithEmotion => {
  const existing = getEmotionalMarkers(memory);
  if (existing.length === 0) return memory;

  const remaining = existing.filter(m => effectiveIntensity(m, gameDay) >= threshold);
  if (remaining.length === existing.length) return memory;

  return { ...memory, emotionalMarkers: remaining };
};

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

export interface EmotionalStanding {
  /** Summed effective grudge intensity, capped at 10. */
  grudge: number;
  /** Summed effective bond intensity, capped at 10. */
  bond: number;
  /** bond - grudge, in [-10, 10]. Positive means the NPC is, on balance, fond of you. */
  net: number;
}

/** Aggregates decayed marker strength at `gameDay`. */
export const getEmotionalStanding = (memory: NpcMemory, gameDay: number): EmotionalStanding => {
  let grudge = 0;
  let bond = 0;

  for (const marker of getEmotionalMarkers(memory)) {
    const strength = effectiveIntensity(marker, gameDay);
    if (marker.type === 'grudge') grudge += strength;
    else bond += strength;
  }

  grudge = Math.min(10, grudge);
  bond = Math.min(10, bond);
  return { grudge, bond, net: bond - grudge };
};

/** Bond strength at which an NPC opens up with bond-only dialogue. */
export const BOND_DIALOGUE_THRESHOLD = 4;
/** Bond strength at which an NPC trusts the player with personal quests. */
export const BOND_QUEST_HOOK_THRESHOLD = 6;
/** Grudge strength at which an NPC will start a fight rather than merely bristle. */
export const GRUDGE_HOSTILITY_THRESHOLD = 6;

export interface EmotionalEffects {
  standing: EmotionalStanding;
  /** 0..1 extra willingness to open combat and press attacks. Grudge-driven. */
  combatAggression: number;
  /** True once the grudge is strong enough that the NPC may attack unprovoked. */
  willInitiateHostility: boolean;
  /**
   * Multiplier applied to a merchant's asking price.
   * Grudge marks the player UP, bond marks the player DOWN.
   *
   * NOTE ON THE TASK TEXT: the task body reads "grudges ... decrease shop prices",
   * which would reward the player for wronging a merchant. Read as intent —
   * grudges make trade worse and bonds make it better — the sign is inverted here.
   * Flagged in the task result rather than implemented literally.
   */
  shopPriceMultiplier: number;
  /** Bond-gated unique dialogue is available. */
  unlocksUniqueDialogue: boolean;
  /** Bond-gated personal quest hooks are available. */
  unlocksQuestHooks: boolean;
}

/** Price swing per point of standing: up to +30% hostile, down to -20% friendly. */
const GRUDGE_PRICE_STEP = 0.03;
const BOND_PRICE_STEP = 0.02;

/**
 * Derives every downstream effect from an NPC's emotional memory.
 * Single entry point on purpose: combat, commerce and dialogue should never each
 * re-derive their own interpretation of the same markers.
 */
export const deriveEmotionalEffects = (memory: NpcMemory, gameDay: number): EmotionalEffects => {
  const standing = getEmotionalStanding(memory, gameDay);

  return {
    standing,
    combatAggression: standing.grudge / 10,
    willInitiateHostility: standing.grudge >= GRUDGE_HOSTILITY_THRESHOLD,
    shopPriceMultiplier: Number(
      (1 + standing.grudge * GRUDGE_PRICE_STEP - standing.bond * BOND_PRICE_STEP).toFixed(4)
    ),
    unlocksUniqueDialogue: standing.bond >= BOND_DIALOGUE_THRESHOLD,
    unlocksQuestHooks: standing.bond >= BOND_QUEST_HOOK_THRESHOLD,
  };
};

/**
 * One-line summaries of the strongest markers, for injection into AI dialogue
 * prompts alongside `formatMemoryForAI` in `src/utils/world/memoryUtils.ts`.
 */
export const describeEmotionalMemory = (
  memory: NpcMemory,
  gameDay: number,
  limit = 3
): string[] =>
  getEmotionalMarkers(memory)
    .map(marker => ({ marker, strength: effectiveIntensity(marker, gameDay) }))
    .filter(entry => entry.strength >= MARKER_FORGOTTEN_THRESHOLD)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, limit)
    .map(
      ({ marker, strength }) =>
        `[${marker.type.toUpperCase()} ${strength.toFixed(1)}/10] ${marker.note ?? marker.trigger}`
    );
