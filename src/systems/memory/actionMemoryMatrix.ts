/**
 * @file src/systems/memory/actionMemoryMatrix.ts
 * Action -> NPC memory mapping matrix (agora-1024, planmap:npc-memory-reconciliation).
 *
 * WHAT THIS ADDS
 * Before this file, "the player did something and an NPC remembers it" was
 * spelled out by hand at every call site: `handleNpcInteraction.ts` dispatches
 * `UPDATE_NPC_DISPOSITION`, `handleGeminiCustom.ts` hand-builds a `KnownFact`
 * with an ad-hoc strength and lifespan, and `handleMerchantInteraction.ts`
 * invents its own fact id and a lifespan measured in milliseconds instead of
 * long-rest ticks. Nothing said which actions SHOULD be remembered, or how
 * strongly. This module is that single table.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * It does not introduce a fourth NPC-memory store. Three already exist and all
 * three landed on the same `NpcMemory` object (`src/types/world.ts`):
 *   1. `knownFacts` + `disposition` — the original lane (`memoryUtils.learnFact`).
 *   2. `emotionalMarkers`  — grudges and bonds (`../social/npcEmotionalMemory`).
 *   3. `witnessedActs`     — what was seen or heard (`../social/npcWitnessMemory`).
 * The matrix is a ROUTER over those three. Every effect names the fact it writes
 * and, where the sibling catalogs already model the same event, the
 * `WITNESS_OBSERVATIONS` key and/or the `EMOTIONAL_TRIGGERS` key it forwards to.
 * No catalog entry is re-declared here.
 *
 * PRECEDENCE RULE (why an action never plants two grudges)
 * `applyWitnessedAct` already derives a grudge/bond from an observation's own
 * catalog entry. So when an action routes to a witness observation that carries
 * an emotion, this module does NOT also emit its own marker — the witness
 * derivation owns it, and it scales the intensity by belief and magnitude, which
 * a flat matrix constant cannot. A matrix-authored marker is emitted only for
 * actions with no witness analog (a gift handed to one person in private is not
 * a public deed, but it is still a bond).
 *
 * UNITS
 * `lifespan` is counted in long-rest ticks — the same unit
 * `handleLongRestWorldEvents` decrements — and 999 means "never forgets", which
 * is the sentinel that loop already special-cases. `strength` is 0-10 and is
 * mirrored into the optional `significance` field so post-merge readers agree
 * with pre-merge ones.
 *
 * NOTE ON THE TASK TEXT
 * The task body specifies no disposition change for the three combat actions.
 * That is preserved literally (`dispositionDelta: 0`) rather than "improved":
 * combat standing is meant to flow from the witness model's mercy/prowess axes,
 * which already move disposition through `deriveWitnessDispositionShift`.
 * Applying a second, flat delta here would double-count it.
 */

import type { KnownFact, NpcMemory } from '../../types/world';
import type { AppAction } from '../../state/actionTypes';
import { learnFact } from '../../utils/world/memoryUtils';
import {
  createEmotionalMarker,
  recordEmotionalMarker,
  type EmotionalMarker,
  type EmotionalMarkerType,
  type EmotionalTrigger,
} from '../social/npcEmotionalMemory';
import {
  applyWitnessedAct,
  confidenceForHops,
  createWitnessedAct,
  getObservationDefinition,
  PLAYER_ACTOR_ID,
  type WitnessChannel,
  type WitnessObservation,
  type WitnessedAct,
} from '../social/npcWitnessMemory';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * Everything the matrix is allowed to look at when an action resolves.
 *
 * Kept to plain data rather than a `GameState` handle on purpose: the matrix has
 * to be callable from a reducer, a hook, a test and a future server tick without
 * dragging the whole store along. Callers that hold a `GameState` build this
 * from it (see {@link actionContextFromGameState}).
 */
export interface ActionContext {
  /** Matrix key. Bare (`'kill'`) or namespaced (`'combat:kill'`, `'combat.kill'`). */
  actionType: string;
  /** The NPC whose memory this mutates — the one who saw or received the act. */
  observerNpcId: string;
  /** Who performed the act. Defaults to the player. */
  actorId?: string;
  /** Id of what the act was done to, when there is one. */
  targetId?: string;
  /** Display name substituted for `{target}` in a fact template. */
  targetName?: string;
  /** Current game day (`getGameDay` in utils/core/timeUtils). Drives every decay clock. */
  gameDay: number;
  /**
   * Value written to `KnownFact.timestamp`. Defaults to `gameDay`. Callers that
   * already store ms timestamps on facts may pass `gameTime.getTime()` instead;
   * the field is only used for ordering and for the merchant expiry check.
   */
  timestamp?: number;
  /** Scale of the act: 3 guards, 100 gold. Defaults to 1. */
  magnitude?: number;
  /** Free text folded into witness recall lines and `{detail}`. */
  detail?: string;
  locationId?: string;
  /** Did the observer see it, or were they told? Defaults to firsthand. */
  channel?: WitnessChannel;
  /** Retelling hops from the eyewitness. Defaults to 0 firsthand / 1 secondhand. */
  hops?: number;
  /** Was the act done where others could see? Gates the "public deed" routings. */
  isPublic?: boolean;
  /** The target had surrendered. Turns a kill into an execution. */
  targetSurrendered?: boolean;
  /** The target could not fight back. Turns a kill into a slaughter. */
  targetHelpless?: boolean;
  /** The observer cared about the target — the "you killed my brother" case. */
  targetMatteredToObserver?: boolean;
  /** The observer holds office/rank, so an insult to them is an insult to authority. */
  observerIsAuthority?: boolean;
  /** The target is the observer's kin. Escalates a threat to `threatened_family`. */
  targetIsObserverFamily?: boolean;
}

// ---------------------------------------------------------------------------
// Effect
// ---------------------------------------------------------------------------

/**
 * What one action does to one NPC's memory.
 *
 * The first four fields are the shape the task specifies and are the contract
 * other systems should read. The remaining fields are optional routing hints —
 * additive, so a caller that only understands the four required fields still
 * gets correct fact + disposition behavior and simply skips the sibling systems.
 */
export interface MemoryEffect {
  /** Fact text with `{target}`, `{actor}`, `{detail}` and `{count}` placeholders. */
  factTemplate: string;
  /** 0-10 importance. Mirrored into `KnownFact.significance`. */
  strength: number;
  /** Long-rest ticks before the fact is forgotten. 999 = never. */
  lifespan: number;
  /** Applied to `NpcMemory.disposition` via `UPDATE_NPC_DISPOSITION`. */
  dispositionDelta: number;

  /** Semantic key for "does this NPC know X" queries. */
  factKey?: string;
  /** Provenance written onto the fact. Defaults from `context.channel`. */
  factSource?: KnownFact['source'];
  /** Is the fact something the NPC will repeat? Defaults to `context.isPublic`. */
  isPublic?: boolean;
  /** Which `WITNESS_OBSERVATIONS` entry this action is an instance of, if any. */
  witnessObservation?: WitnessObservation;
  /**
   * A grudge/bond to plant DIRECTLY, for actions with no witness analog.
   * Ignored when `witnessObservation` names an entry that carries its own
   * emotion — see the precedence rule in the file header.
   */
  emotional?: {
    trigger: EmotionalTrigger;
    /** Required for triggers outside `EMOTIONAL_TRIGGERS`; the catalog cannot guess. */
    type?: EmotionalMarkerType;
    intensity?: number;
    note?: string;
  };
}

/** The matrix itself: an action key resolved against a context. */
export type ActionMemoryMap = Record<string, (context: ActionContext) => MemoryEffect | null>;

/** Grouping used by {@link ACTION_CATEGORIES} and by the namespaced key form. */
export type ActionCategory = 'combat' | 'social' | 'quest';

// ---------------------------------------------------------------------------
// The matrix
// ---------------------------------------------------------------------------

/**
 * A constant effect, wrapped as a resolver. Most rows do not vary by context;
 * the ones that do (kill, insult, praise, threaten) are written out longhand.
 */
const always =
  (effect: MemoryEffect) =>
  (): MemoryEffect =>
    effect;

/**
 * Every action the game can route into NPC memory.
 *
 * The eight rows the task names carry its exact strength/lifespan/disposition
 * numbers. The remaining rows exist because the sibling catalogs already model
 * those events and leaving them unrouted would mean a second, competing mapping
 * gets written later for `stole_from_them`, `saved_life`, `bribed_official` and
 * friends. Adding them here costs one line each and closes that hole.
 */
export const ACTION_MEMORY_MATRIX: ActionMemoryMap = {
  // --- Combat -------------------------------------------------------------

  /**
   * A landed blow. No witness analog: the catalog models OUTCOMES (defeated,
   * spared, executed), not individual swings, and inventing an `attacked_someone`
   * observation here would fork the catalog. Left fact-only, deliberately.
   */
  hit: always({
    factTemplate: 'saw you attack {target}',
    strength: 3,
    lifespan: 30,
    dispositionDelta: 0,
    factKey: 'player_attacked_target',
  }),

  /**
   * A kill reads three different ways depending on how it happened, and the
   * witness catalog already draws those distinctions. Routing to the right one
   * is the whole reason this row is a function rather than a constant.
   */
  kill: (context: ActionContext): MemoryEffect => ({
    factTemplate: 'saw you kill {target}',
    strength: 8,
    lifespan: 999,
    dispositionDelta: 0,
    factKey: 'player_killed_target',
    witnessObservation: context.targetHelpless
      ? 'slaughtered_helpless'
      : context.targetSurrendered
        ? 'executed_surrendering'
        : 'defeated_foes',
    // `defeated_foes` carries no emotion, so a killing that mattered to the
    // observer personally needs the grudge stated here. When the kill was an
    // execution or a slaughter, the witness catalog's own grudge wins (see the
    // precedence rule) and this is dropped.
    ...(context.targetMatteredToObserver
      ? { emotional: { trigger: 'killed_friend' as const } }
      : {}),
  }),

  spare: always({
    factTemplate: 'saw you spare {target}',
    strength: 5,
    lifespan: 60,
    dispositionDelta: 0,
    factKey: 'player_spared_target',
    witnessObservation: 'spared_surrendering',
  }),

  /** Taking a beaten foe alive rather than letting them go — the softer mercy. */
  capture: always({
    factTemplate: 'saw you take {target} alive',
    strength: 4,
    lifespan: 60,
    dispositionDelta: 0,
    factKey: 'player_accepted_surrender',
    witnessObservation: 'accepted_surrender',
  }),

  protect: always({
    factTemplate: 'saw you shield {target} from harm',
    strength: 6,
    lifespan: 999,
    dispositionDelta: 15,
    factKey: 'player_protected_bystander',
    witnessObservation: 'protected_bystander',
  }),

  flee: always({
    factTemplate: 'saw you run from {target}',
    strength: 3,
    lifespan: 30,
    dispositionDelta: -5,
    factKey: 'player_fled_battle',
    witnessObservation: 'fled_battle',
  }),

  // --- Social -------------------------------------------------------------

  /**
   * First contact. Not a deed anyone witnessed, and no grudge or bond: it is the
   * bookkeeping fact the dialogue lanes wrote by hand before this row existed
   * (`handleNpcInteraction.handleStartDialogue` and `handleTalk`). It belongs in
   * the table rather than beside it so first contact gets the same deterministic
   * id, the same decay clock and the same de-duplication rules as every other
   * memory, instead of a fresh `generateId()` on every greeting.
   *
   * `factSource: 'direct'` because the NPC met the player face to face; the
   * default `'witnessed'` would read as "saw someone else do it". The player's
   * self-description is the `{detail}` slot, so the caller decides whether the
   * NPC remembers "the adventurer" or a specific presentation.
   */
  met: always({
    factTemplate: 'Met {detail}.',
    strength: 3,
    lifespan: 999,
    dispositionDelta: 0,
    factKey: 'player_met_npc',
    factSource: 'direct',
    isPublic: true,
  }),

  /**
   * A finished conversation, as the banter model summarized it. The summary text
   * IS the fact, so the template is a bare `{detail}` — the matrix owns the
   * strength, the lifespan, the provenance and the id; the model owns only the
   * wording.
   *
   * Disposition stays at 0 on purpose: `useConversation` already moves it by the
   * summary's own sentiment score, which is a measured value a flat table
   * constant would double-count.
   *
   * Callers should pass the conversation's id as `targetId`. Two conversations
   * with the same NPC on the same day otherwise resolve to the same
   * {@link actionFactId}, and `learnFact` would drop the second.
   */
  converse: always({
    factTemplate: '{detail}',
    strength: 4,
    lifespan: 999,
    dispositionDelta: 0,
    factKey: 'player_conversed_with_npc',
    factSource: 'direct',
    isPublic: false,
  }),

  gift: always({
    factTemplate: 'received a gift from you',
    strength: 4,
    lifespan: 30,
    dispositionDelta: 10,
    factKey: 'player_gave_gift',
    // Handed to this NPC, not performed for a crowd, so there is no witness
    // observation — but `generous_gift` is exactly this event in the grudge/bond
    // catalog, so the bond is planted directly.
    emotional: { trigger: 'generous_gift' },
  }),

  /**
   * An insult only becomes `insulted_authority` when the person insulted holds
   * rank, or when it happened in front of people. A private slight is still
   * remembered and still stings — it just is not a public deed the town retells.
   */
  insult: (context: ActionContext): MemoryEffect => ({
    factTemplate: 'was insulted by you',
    strength: 6,
    lifespan: 60,
    dispositionDelta: -15,
    factKey: 'player_insulted_npc',
    ...(context.observerIsAuthority || context.isPublic
      ? { witnessObservation: 'insulted_authority' as const }
      : {
          // No catalog trigger covers a plain insult, and `EmotionalTrigger` is
          // deliberately open to caller-minted keys — but an unknown key must
          // declare its own type or `createEmotionalMarker` throws.
          emotional: { trigger: 'insulted_you', type: 'grudge' as const, intensity: 3 },
        }),
  }),

  praise: (context: ActionContext): MemoryEffect => ({
    factTemplate: 'was praised by you',
    strength: 3,
    lifespan: 30,
    dispositionDelta: 5,
    factKey: 'player_praised_npc',
    ...(context.isPublic
      ? { witnessObservation: 'publicly_praised' as const }
      : { emotional: { trigger: 'praised_you', type: 'bond' as const, intensity: 2 } }),
  }),

  /** Speaking for someone's good name against someone else. Catalog bond. */
  defend_honor: always({
    factTemplate: 'heard you defend their name',
    strength: 5,
    lifespan: 60,
    dispositionDelta: 12,
    factKey: 'player_defended_honor',
    emotional: { trigger: 'defended_honor' },
  }),

  steal: always({
    factTemplate: 'caught you stealing from them',
    strength: 6,
    lifespan: 90,
    dispositionDelta: -20,
    factKey: 'player_stole_from_npc',
    emotional: { trigger: 'stole_from_them' },
  }),

  /**
   * Threatening the observer's kin is the catalog's `threatened_family`, a much
   * heavier grudge than frightening a stranger in the street.
   */
  threaten: (context: ActionContext): MemoryEffect => ({
    factTemplate: 'was threatened by you',
    strength: 7,
    lifespan: 90,
    dispositionDelta: -25,
    factKey: 'player_threatened_npc',
    ...(context.targetIsObserverFamily
      ? { emotional: { trigger: 'threatened_family' as const } }
      : { witnessObservation: 'threatened_civilian' as const }),
  }),

  rescue: always({
    factTemplate: 'owes you their life',
    strength: 9,
    lifespan: 999,
    dispositionDelta: 30,
    factKey: 'player_saved_life',
    emotional: { trigger: 'saved_life' },
  }),

  donate: always({
    factTemplate: 'saw you give to {target}',
    strength: 4,
    lifespan: 60,
    dispositionDelta: 8,
    factKey: 'player_donated',
    witnessObservation: 'donated_to_temple',
  }),

  almsgiving: always({
    factTemplate: 'saw you give to {target}',
    strength: 3,
    lifespan: 30,
    dispositionDelta: 5,
    factKey: 'player_gave_to_beggar',
    witnessObservation: 'gave_to_beggar',
  }),

  bribe: always({
    factTemplate: 'saw you put coin in the hand of {target}',
    strength: 4,
    lifespan: 60,
    dispositionDelta: -8,
    factKey: 'player_bribed_official',
    witnessObservation: 'bribed_official',
  }),

  // --- Quest --------------------------------------------------------------

  complete: always({
    factTemplate: 'completed a task for you',
    strength: 7,
    lifespan: 999,
    dispositionDelta: 20,
    factKey: 'player_completed_quest',
    // `kept_word` is the public reading of the same event; its catalog bond
    // (intensity 5) matches `completed_quest`, so routing through the witness
    // lane keeps the deed rumor-spreadable without double-planting the bond.
    witnessObservation: 'kept_word',
  }),

  fail: always({
    factTemplate: 'failed a task for you',
    strength: 5,
    lifespan: 60,
    dispositionDelta: -10,
    factKey: 'player_failed_quest',
    // Failure is not betrayal: the fact and the disposition hit land, but no
    // grudge, because `broke_word` is reserved for `betray` below.
    emotional: { trigger: 'failed_you', type: 'grudge', intensity: 2 },
  }),

  betray: always({
    factTemplate: 'saw you go back on your word',
    strength: 7,
    lifespan: 999,
    dispositionDelta: -30,
    factKey: 'player_broke_word',
    witnessObservation: 'broke_word',
  }),
};

/** Which category each action belongs to, for UI grouping and coverage checks. */
export const ACTION_CATEGORIES: Record<string, ActionCategory> = {
  hit: 'combat',
  kill: 'combat',
  spare: 'combat',
  capture: 'combat',
  protect: 'combat',
  flee: 'combat',
  met: 'social',
  converse: 'social',
  gift: 'social',
  insult: 'social',
  praise: 'social',
  defend_honor: 'social',
  steal: 'social',
  threaten: 'social',
  rescue: 'social',
  donate: 'social',
  almsgiving: 'social',
  bribe: 'social',
  complete: 'quest',
  fail: 'quest',
  betray: 'quest',
};

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Accepts `'kill'`, `'combat:kill'`, `'combat.kill'` and `'COMBAT_KILL'`.
 * Call sites name actions inconsistently across this repo (dialogue options use
 * dotted ids, reducers use SCREAMING_SNAKE), and a mapping table that silently
 * returns null on a naming mismatch is worse than no mapping at all.
 */
export const normalizeActionType = (actionType: string): string => {
  const tail = actionType.split(/[:.]/).pop() ?? actionType;
  return tail.trim().toLowerCase();
};

/** Looks up and evaluates the row for an action. Null when nothing is remembered. */
export const resolveMemoryEffect = (context: ActionContext): MemoryEffect | null => {
  const resolver = ACTION_MEMORY_MATRIX[normalizeActionType(context.actionType)];
  return resolver ? resolver(context) : null;
};

/** True when the matrix has a row for this action key. */
export const hasMemoryEffect = (actionType: string): boolean =>
  normalizeActionType(actionType) in ACTION_MEMORY_MATRIX;

/** Substitutes `{target}`, `{actor}`, `{detail}` and `{count}` into a template. */
export const renderFactText = (template: string, context: ActionContext): string =>
  template
    .replace(/\{target\}/g, context.targetName ?? context.targetId ?? 'someone')
    .replace(/\{actor\}/g, context.actorId ?? PLAYER_ACTOR_ID)
    .replace(/\{detail\}/g, context.detail ?? '')
    .replace(/\{count\}/g, String(context.magnitude ?? 1))
    .replace(/\s{2,}/g, ' ')
    .trim();

const hopsFor = (context: ActionContext): number =>
  Math.max(0, context.hops ?? (context.channel === 'secondhand' ? 1 : 0));

/**
 * Stable fact id: observer + action + target + day.
 *
 * Deterministic rather than sequential on purpose. Hitting the same guard four
 * times in one day should reinforce one memory through `learnFact`, not append
 * four identical facts that then crowd out a murder when `MAX_FACTS_PER_NPC`
 * trims the list by strength.
 */
export const actionFactId = (context: ActionContext): string =>
  [
    'amm',
    context.observerNpcId,
    normalizeActionType(context.actionType),
    context.targetId ?? 'none',
    context.gameDay,
  ].join(':');

/** Turns an effect into the `KnownFact` the original memory lane stores. */
export const buildKnownFact = (effect: MemoryEffect, context: ActionContext): KnownFact => {
  const hops = hopsFor(context);
  const secondhand = hops > 0 || context.channel === 'secondhand';

  return {
    id: actionFactId(context),
    text: renderFactText(effect.factTemplate, context),
    source: effect.factSource ?? (secondhand ? 'gossip' : 'witnessed'),
    isPublic: effect.isPublic ?? context.isPublic ?? false,
    timestamp: context.timestamp ?? context.gameDay,
    strength: effect.strength,
    lifespan: effect.lifespan,
    ...(effect.factKey ? { factKey: effect.factKey } : {}),
    // Belief falls off with retelling, exactly as it does in the witness model,
    // so a rumor-sourced fact does not read as certain knowledge.
    confidence: confidenceForHops(hops),
    // `significance` is the post-merge name for the same 0-10 axis as `strength`.
    significance: effect.strength,
  };
};

/** Builds the witness record an effect routes to, or null when it routes to none. */
export const buildWitnessedAct = (
  effect: MemoryEffect,
  context: ActionContext
): WitnessedAct | null => {
  if (!effect.witnessObservation) return null;
  const hops = hopsFor(context);

  return createWitnessedAct(effect.witnessObservation, context.gameDay, {
    actorId: context.actorId ?? PLAYER_ACTOR_ID,
    hops,
    channel: context.channel ?? (hops === 0 ? 'firsthand' : 'secondhand'),
    magnitude: context.magnitude ?? 1,
    ...(context.detail !== undefined ? { detail: context.detail } : {}),
    ...(context.locationId !== undefined ? { locationId: context.locationId } : {}),
  });
};

/**
 * True when the effect's witness observation already carries its own grudge/bond.
 * The precedence rule in the file header, in one predicate.
 */
const witnessOwnsEmotion = (effect: MemoryEffect): boolean =>
  Boolean(effect.witnessObservation) &&
  Boolean(getObservationDefinition(effect.witnessObservation as WitnessObservation)?.emotion);

/**
 * Builds the matrix's own emotional marker, or null when there is none to build
 * or when the witness lane owns it.
 */
export const buildEmotionalMarker = (
  effect: MemoryEffect,
  context: ActionContext
): EmotionalMarker | null => {
  if (!effect.emotional || witnessOwnsEmotion(effect)) return null;

  const { trigger, type, intensity, note } = effect.emotional;

  // Built first so the catalog resolves its own default intensity for triggers
  // the matrix does not override. Scaling only the override would have left
  // `gift` (which relies on `generous_gift`'s default) immune to belief — a bug
  // the second-hand test caught.
  const marker = createEmotionalMarker(trigger, context.gameDay, {
    ...(type ? { type } : {}),
    ...(intensity !== undefined ? { intensity } : {}),
    ...(note ? { note } : {}),
    ...(context.targetId && context.targetId !== context.observerNpcId
      ? { subjectId: context.targetId }
      : {}),
  });

  // Hearsay plants a weaker feeling than an eyewitness account, matching
  // `emotionalMarkerFromWitnessedAct`.
  const belief = confidenceForHops(hopsFor(context));
  return belief >= 1 ? marker : { ...marker, intensity: marker.intensity * belief };
};

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

/** Everything one resolved action does, in inspectable form. */
export interface ResolvedActionMemory {
  effect: MemoryEffect;
  fact: KnownFact;
  dispositionDelta: number;
  witnessedAct: WitnessedAct | null;
  emotionalMarker: EmotionalMarker | null;
}

/** Resolves an action into its concrete memory writes without applying them. */
export const resolveActionMemory = (context: ActionContext): ResolvedActionMemory | null => {
  const effect = resolveMemoryEffect(context);
  if (!effect) return null;

  return {
    effect,
    fact: buildKnownFact(effect, context),
    dispositionDelta: effect.dispositionDelta,
    witnessedAct: buildWitnessedAct(effect, context),
    emotionalMarker: buildEmotionalMarker(effect, context),
  };
};

const DISPOSITION_MIN = -100;
const DISPOSITION_MAX = 100;

/**
 * The single call a game system should make when an action resolves: applies the
 * fact, the disposition move, the witness record and the grudge/bond to one
 * memory object, immutably. Returns the same object when the action is not in
 * the matrix, so reducer identity checks stay cheap.
 */
export const applyActionMemory = (memory: NpcMemory, context: ActionContext): NpcMemory => {
  const resolved = resolveActionMemory(context);
  if (!resolved) return memory;

  let next = learnFact(memory, resolved.fact);

  if (resolved.dispositionDelta !== 0) {
    next = {
      ...next,
      disposition: Math.max(
        DISPOSITION_MIN,
        Math.min(DISPOSITION_MAX, next.disposition + resolved.dispositionDelta)
      ),
    };
  }

  // `applyWitnessedAct` stores the act AND the grudge/bond its catalog entry
  // implies, so this one call covers both lanes for routed actions.
  if (resolved.witnessedAct) next = applyWitnessedAct(next, resolved.witnessedAct);
  if (resolved.emotionalMarker) next = recordEmotionalMarker(next, resolved.emotionalMarker);

  return next;
};

/**
 * The dispatch-shaped form, for the hooks in `src/hooks/actions/**` that resolve
 * player actions and hold a `dispatch` rather than a memory object.
 *
 * Returns an empty array for unmapped actions so a call site can stay a single
 * unconditional `.forEach(dispatch)` line. `RECORD_NPC_WITNESSED_ACT` runs
 * `applyWitnessedAct` inside the reducer, which is why no separate marker action
 * is emitted for witness-routed effects.
 */
export const buildActionMemoryDispatches = (context: ActionContext): AppAction[] => {
  const resolved = resolveActionMemory(context);
  if (!resolved) return [];

  const actions: AppAction[] = [
    { type: 'ADD_NPC_KNOWN_FACT', payload: { npcId: context.observerNpcId, fact: resolved.fact } },
  ];

  if (resolved.dispositionDelta !== 0) {
    actions.push({
      type: 'UPDATE_NPC_DISPOSITION',
      payload: { npcId: context.observerNpcId, amount: resolved.dispositionDelta },
    });
  }

  if (resolved.witnessedAct) {
    actions.push({
      type: 'RECORD_NPC_WITNESSED_ACT',
      payload: { npcId: context.observerNpcId, act: resolved.witnessedAct },
    });
  }

  if (resolved.emotionalMarker) {
    actions.push({
      type: 'RECORD_NPC_EMOTIONAL_MARKER',
      payload: { npcId: context.observerNpcId, marker: resolved.emotionalMarker },
    });
  }

  return actions;
};

/**
 * Fans one action out to every NPC who observed it.
 *
 * The observers list is the caller's business — line of sight, earshot and who
 * was in the room are decided by `src/systems/perception`, not here. This only
 * guarantees each observer gets its own context and therefore its own fact id.
 */
export const buildActionMemoryDispatchesForObservers = (
  observerNpcIds: readonly string[],
  context: Omit<ActionContext, 'observerNpcId'>
): AppAction[] =>
  observerNpcIds.flatMap(observerNpcId =>
    buildActionMemoryDispatches({ ...context, observerNpcId })
  );

/**
 * Convenience builder for call sites that hold a `GameState`-shaped object.
 * Typed structurally rather than against `GameState` so the matrix keeps no
 * dependency on the store's full shape.
 */
export const actionContextFromGameState = (
  state: { gameTime: Date },
  context: Omit<ActionContext, 'gameDay' | 'timestamp'> & { gameDay: number }
): ActionContext => ({
  ...context,
  timestamp: state.gameTime.getTime(),
});
