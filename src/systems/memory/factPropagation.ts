// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 10:35:25
 * Dependents: hooks/actions/handleWorldEvents.ts, state/reducers/npcReducer.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/systems/memory/factPropagation.ts
 * Cross-NPC fact propagation (DIAL-002).
 *
 * WHAT THIS IS. When the player tells one NPC something — or an NPC witnesses
 * something and files it as a fact — the rest of the town should not stay
 * permanently ignorant. This module answers one question, purely and
 * deterministically: given a fact that `originNpcId` now knows, WHICH other
 * NPCs learn it, THROUGH WHICH channel, and ON WHICH GAME DAY.
 *
 * WHY IT IS SEPARATE FROM THE NEIGHBOURING SYSTEMS.
 *  - `systems/intrigue/RumorMillSystem` owns talk moving through a social
 *    graph over days. This file does NOT re-implement that. The stranger
 *    channel here is a *gate*: a fact only reaches an NPC outside the origin's
 *    town and faction if the rumor mill already carried it to them, and the
 *    caller passes that reach in as `rumorReachedNpcIds`.
 *  - `systems/social/npcWitnessMemory` owns what an NPC saw and how sure they
 *    are; its `SECONDHAND_CONFIDENCE_FALLOFF` is reused here so a fact heard
 *    second-hand and an act heard second-hand degrade by the same amount.
 *  - `hooks/actions/handleWorldEvents.handleGossipEvent` owns the *flavour*
 *    lane: an LLM rephrases a fact in the speaker's voice before a random
 *    listener in the same room gets it. That lane is random, same-room only,
 *    and needs a model call. This file is the deterministic, typed, testable
 *    rules lane that runs with no model and no randomness. They are
 *    complementary; the rules lane is what dialogue can rely on.
 *
 * WHAT WAS PRESERVED. Nothing here mutates memory or state. Every function
 * returns new objects, mirroring `actionMemoryMatrix`'s "pure resolver plus a
 * dispatch-shaped builder" contract so the same call sites can adopt it.
 *
 * DEFERRED. Dialogue consumption is a one-line call to
 * {@link buildPropagatedFactDialogueContext} from whichever prompt builder
 * wins; the dialogue-graph files were owned by another agent when this landed,
 * so the wiring is a follow-up, exactly as `buildRumorDialogueContext` and
 * `buildWitnessDialogueContext` are today.
 */

import { KnownFact } from '../../types/world';
import { SECONDHAND_CONFIDENCE_FALLOFF } from '../social/npcWitnessMemory';
import { RUMOR_DIALOGUE_DELAY_DAYS } from '../intrigue/RumorMillSystem';

// ============================================================================
// Rules
// ============================================================================

/**
 * How a fact got from the origin NPC to someone else.
 * `same_town` — they drink in the same tavern; public news travels the day it happens.
 * `faction` — the same banner in another town; it rides the next courier/patrol.
 * `rumor_mill` — no tie at all. Only reachable when the rumor mill carried it.
 */
export type FactPropagationChannel = 'same_town' | 'faction' | 'rumor_mill';

/** The typed rule for one channel. */
export interface FactPropagationRule {
  channel: FactPropagationChannel;
  /** Whole game days between the origin learning it and the target being able to say it. */
  delayDays: number;
  /** Multiplier applied to `confidence` on the propagated copy. */
  confidenceFalloff: number;
  /** Flat subtraction from `strength`, so second-hand copies decay out first. */
  strengthPenalty: number;
}

/**
 * The rules the acceptance criteria name. Exported as data (not buried in a
 * switch) so a designer can retune a delay without touching the resolver, and
 * so tests can assert against the same numbers the runtime uses.
 */
export const FACT_PROPAGATION_RULES: Record<FactPropagationChannel, FactPropagationRule> = {
  same_town: { channel: 'same_town', delayDays: 0, confidenceFalloff: 0.9, strengthPenalty: 1 },
  faction: { channel: 'faction', delayDays: 1, confidenceFalloff: 0.75, strengthPenalty: 2 },
  // Strangers hear it only as talk, so it lands with the same delay and the
  // same confidence loss the witness/rumor lanes already use for hearsay.
  rumor_mill: {
    channel: 'rumor_mill',
    delayDays: RUMOR_DIALOGUE_DELAY_DAYS,
    confidenceFalloff: SECONDHAND_CONFIDENCE_FALLOFF,
    strengthPenalty: 3,
  },
};

/**
 * Fact provenances that are allowed to start a propagation. A fact that is
 * itself hearsay does not re-propagate: that would let one public fact ripple
 * around the map forever, and the rumor mill already models multi-hop spread.
 */
const PROPAGATABLE_SOURCES: ReadonlySet<KnownFact['source']> = new Set([
  'direct',
  'witnessed',
  'told_by_player',
]);

/** Whether a fact is eligible to leave the NPC who knows it at all. */
export const isPropagatableFact = (fact: KnownFact): boolean =>
  fact.isPublic === true && PROPAGATABLE_SOURCES.has(fact.source);

// ============================================================================
// Roster
// ============================================================================

/** The minimum an NPC has to expose for the rules to place them. */
export interface PropagationNpc {
  id: string;
  /** Location id treated as "the town" for the same-town rule. */
  townId?: string;
  /** Faction id for the faction rule; matches `NPC.faction`. */
  factionId?: string;
}

/** Structural inputs for {@link buildPropagationRoster}; no store types imported. */
export interface PropagationRosterInput {
  /** Every NPC that could send or receive, keyed by id. */
  npcs: Record<string, { id?: string; faction?: string } | undefined>;
  /** Locations whose `npcIds` define town membership (authored + dynamic). */
  locations: Record<string, { npcIds?: string[] } | undefined>;
  /** Extra townId -> npc ids for NPCs placed at runtime rather than in the location record. */
  extraTownMembers?: Record<string, readonly string[]>;
}

/**
 * Flattens the game's own shapes into the flat roster the rules need.
 *
 * An NPC listed in two locations keeps the FIRST town seen, so a wandering
 * entry cannot silently move a resident's home town between ticks.
 */
export function buildPropagationRoster(input: PropagationRosterInput): PropagationNpc[] {
  const townOf = new Map<string, string>();

  const claim = (townId: string, npcIds: readonly string[] | undefined): void => {
    for (const npcId of npcIds ?? []) {
      if (!townOf.has(npcId)) townOf.set(npcId, townId);
    }
  };

  for (const [townId, location] of Object.entries(input.locations)) {
    claim(townId, location?.npcIds);
  }
  for (const [townId, npcIds] of Object.entries(input.extraTownMembers ?? {})) {
    claim(townId, npcIds);
  }

  const roster: PropagationNpc[] = [];
  for (const [npcId, npc] of Object.entries(input.npcs)) {
    if (!npc) continue;
    roster.push({
      id: npc.id ?? npcId,
      townId: townOf.get(npcId),
      factionId: npc.faction,
    });
  }
  // NPCs placed in a town but absent from the NPC registry still exist as far
  // as propagation is concerned; dropping them would silently break spread in
  // any town built entirely from runtime NPCs.
  for (const [npcId, townId] of townOf) {
    if (!(npcId in input.npcs)) roster.push({ id: npcId, townId });
  }
  return roster;
}

// ============================================================================
// Resolution
// ============================================================================

/** Everything the rules need to decide who hears a fact. */
export interface FactPropagationContext {
  /** The NPC who already knows the fact. */
  originNpcId: string;
  /** Candidate recipients, including the origin (it is skipped). */
  npcs: readonly PropagationNpc[];
  /** Game day the origin learned it — the clock the delays are measured from. */
  learnedOnDay: number;
  /**
   * NPCs the rumor mill has already carried this talk to (a `TownRumor`'s
   * `reachedNpcs`). ONLY these ids can be reached through the stranger
   * channel; omit it and strangers hear nothing, which is the default the
   * acceptance criteria ask for.
   */
  rumorReachedNpcIds?: readonly string[];
  /** NPCs that must not receive it (already know it, dead, not simulated). */
  excludeNpcIds?: readonly string[];
}

/** One resolved recipient. */
export interface PropagatedFact {
  npcId: string;
  channel: FactPropagationChannel;
  /** First game day this NPC may reference the fact. `learnedOnDay + delayDays`. */
  availableFromDay: number;
  /** The copy to store on the recipient, already carrying `sourceNpcId`. */
  fact: KnownFact;
}

/**
 * Which channel, if any, carries a fact from `origin` to `target`.
 *
 * Order matters and is the rule the task states: town first (tightest tie,
 * no delay), then faction, then the rumor mill as the only way a stranger
 * ever hears anything. Returns null when no channel applies.
 */
export function classifyPropagation(
  origin: PropagationNpc,
  target: PropagationNpc,
  rumorReachedNpcIds?: readonly string[],
): FactPropagationChannel | null {
  if (origin.id === target.id) return null;

  if (origin.townId && target.townId && origin.townId === target.townId) return 'same_town';
  if (origin.factionId && target.factionId && origin.factionId === target.factionId) return 'faction';
  if (rumorReachedNpcIds?.includes(target.id)) return 'rumor_mill';

  return null;
}

/**
 * Builds the recipient's copy of a fact.
 *
 * `text` is deliberately unchanged: the reducer de-duplicates known facts on
 * text, so an identical string is what makes re-running the daily pass
 * idempotent. Provenance moves to `source: 'gossip'` + `sourceNpcId`, which is
 * what dialogue reads to say "Bram told me…".
 */
function copyFactForRecipient(
  fact: KnownFact,
  originNpcId: string,
  targetNpcId: string,
  rule: FactPropagationRule,
  availableFromDay: number,
): KnownFact {
  const baseConfidence = fact.confidence ?? Math.max(0, Math.min(1, fact.strength / 10));
  return {
    ...fact,
    // Deterministic id: the same origin/target/fact triple always yields the
    // same id, so a repeated pass overwrites rather than accumulating.
    id: `${fact.id}::via-${originNpcId}->${targetNpcId}`,
    source: 'gossip',
    sourceNpcId: originNpcId,
    // A propagated copy is repeatable talk, not a secret the recipient keeps.
    isPublic: true,
    strength: Math.max(1, fact.strength - rule.strengthPenalty),
    confidence: Math.max(0, Math.min(1, baseConfidence * rule.confidenceFalloff)),
    // Stamped with the day it becomes sayable, not the day the origin heard it,
    // so recency ordering in dialogue reflects when THIS NPC learned it.
    timestamp: availableFromDay,
  };
}

/**
 * The entry point. Resolves every NPC who learns `fact` because
 * `context.originNpcId` knows it.
 *
 * Non-public facts and hearsay produce an empty list — a secret told to one
 * NPC stays with that NPC.
 */
export function propagateFact(
  fact: KnownFact,
  context: FactPropagationContext,
): PropagatedFact[] {
  if (!isPropagatableFact(fact)) return [];

  const origin = context.npcs.find((npc) => npc.id === context.originNpcId);
  if (!origin) return [];

  const excluded = new Set(context.excludeNpcIds ?? []);
  const results: PropagatedFact[] = [];

  for (const target of context.npcs) {
    if (excluded.has(target.id)) continue;
    const channel = classifyPropagation(origin, target, context.rumorReachedNpcIds);
    if (!channel) continue;

    const rule = FACT_PROPAGATION_RULES[channel];
    const availableFromDay = context.learnedOnDay + rule.delayDays;
    results.push({
      npcId: target.id,
      channel,
      availableFromDay,
      fact: copyFactForRecipient(fact, context.originNpcId, target.id, rule, availableFromDay),
    });
  }

  return results;
}

/**
 * The subset of a propagation that has actually arrived by `currentDay`.
 *
 * The delayed remainder is not queued anywhere: a caller re-runs
 * `propagateFact` on a later day and the faction/rumor entries become due
 * then. That keeps the delay rule stateless and save-compatible.
 */
export const duePropagatedFacts = (
  propagated: readonly PropagatedFact[],
  currentDay: number,
): PropagatedFact[] => propagated.filter((entry) => entry.availableFromDay <= currentDay);

// ============================================================================
// Dialogue context
// ============================================================================

/**
 * Prompt-ready lines for facts this NPC learned from someone else, newest
 * first. Same plain-string contract as `buildRumorDialogueContext` and
 * `buildWitnessDialogueContext`, so whichever prompt builder consumes those
 * can take these with no new shape.
 */
export function buildPropagatedFactDialogueContext(
  facts: readonly KnownFact[],
  nameOfNpc: (npcId: string) => string | undefined,
  max = 3,
): string[] {
  return facts
    .filter((fact) => fact.source === 'gossip' && !!fact.sourceNpcId)
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, max)
    .map((fact) => {
      const who = nameOfNpc(fact.sourceNpcId as string) ?? 'someone in town';
      return `${who} mentioned: ${fact.text}`;
    });
}
