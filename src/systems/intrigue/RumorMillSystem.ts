/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intrigue/RumorMillSystem.ts
 * The Town Rumor Mill: turns notable player deeds into gossip, spreads that
 * gossip through a town's social graph day by day, feeds it to NPC dialogue
 * context, decays it as it goes stale, and reports the reputation it earned.
 *
 * WHAT THIS IS (and what it deliberately is not)
 * ----------------------------------------------
 * This is the *generation and propagation* engine only. It is pure and
 * synchronous: every function takes state in and hands new state back, so it
 * can be driven from a reducer, a day-tick, or a test with no wiring.
 *
 * It does NOT replace two neighbouring systems, and reuses both instead:
 *   - `TavernGossipSystem` sells `WorldRumor`s to the player over a bar. That
 *     is a *purchase* surface. This file is the *social* layer underneath it.
 *   - `WorldRumor` (types/world.ts) stays the canonical rumor shape consumed by
 *     `dialogueService.getDynamicRumorTopics` and the tavern UI. A `TownRumor`
 *     projects down to a `WorldRumor` via `townRumorToWorldRumor`, so nothing
 *     downstream has to learn a second type to show town gossip.
 *
 * WHY A SECOND SHAPE AT ALL
 * -------------------------
 * `WorldRumor` models *faction* news: it knows source/target factions and a
 * location, but has no idea which people have heard it. A rumor about the
 * player is person-shaped — it has a mouth it came out of and a set of ears it
 * has reached — so it needs `sourceNpc` and `reachedNpcs`. Rather than widen
 * `WorldRumor` (used in ~15 places and persisted in saves), `TownRumor` is a
 * superset kept beside it, and the projection is one function.
 *
 * WIRING (agora-049c, PK-30)
 * --------------------------
 * The engine is no longer free-floating:
 *   - `GameState.townRumors` holds the live rumors and rides the save with the
 *     rest of the state (src/types/state.ts).
 *   - `townReducer` is the bridge. It needs no new action types: it turns the
 *     already-dispatched COMPLETE_QUEST and COMMIT_CRIME into deeds, and
 *     advances the spread one day per ADVANCE_TIME over the town sim's own
 *     relationship web.
 *   - `TavernGossipSystem` reads the spread talk back out: a rumor that has
 *     been retold at least once is offered over the bar as gossip, projected
 *     down to `WorldRumor` by `townRumorToWorldRumor`.
 *
 * STILL DEFERRED
 * --------------
 * `buildRumorDialogueContext` has no caller. Feeding it into the NPC prompt
 * builders is board task `agora-f821.12` (see
 * docs/deepdives/dialogue-models-boundary.md, F8 and §5.3), which owns
 * `useDialogueSystem.ts` and `useConversation.ts`; it is left to that task
 * rather than duplicated here.
 */

import { SeededRandom } from '../../utils/random';
import type { AgentRelationshipBond } from '../worldforge/townsim/types';
import type { WorldRumor } from '../../types/world';

// ============================================================================
// Tuning constants
// ============================================================================

/**
 * Old news stops being interesting after a week. A rumor older than this is
 * stale: it no longer spreads, no longer appears in dialogue, and no longer
 * contributes reputation.
 */
export const RUMOR_LIFESPAN_DAYS = 7;

/**
 * An NPC will not bring a rumor up on the same day they first heard it — talk
 * needs a night to settle. Combined with the spread model below, a rumor
 * typically becomes conversational across a town over game days 1-3.
 */
export const RUMOR_DIALOGUE_DELAY_DAYS = 1;

/** Notoriety earned per *listener* of a fully-weighted negative rumor. */
export const NOTORIETY_PER_LISTENER = 1.5;

/** Disposition moved per listener of a fully-weighted rumor (sign follows tone). */
export const DISPOSITION_PER_LISTENER = 4;

// ============================================================================
// Types
// ============================================================================

/** Which way a rumor cuts. Neutral gossip spreads but moves no meters. */
export type RumorTone = 'positive' | 'negative' | 'neutral';

/**
 * The kinds of deed the town currently talks about. Open-ended by design:
 * `custom` exists so a caller can push a one-off line (a scripted scene, a
 * quest beat) through the same spread and decay machinery without this file
 * having to know about it.
 */
export type RumorKind =
  | 'combat_victory'
  | 'quest_completed'
  | 'crime'
  | 'donation'
  | 'custom';

/** A single piece of talk moving through a town. */
export interface TownRumor {
  id: string;
  /** The line an NPC would actually say. */
  text: string;
  /** NPC id whose mouth it came out of. Always the first entry of reachedNpcs. */
  sourceNpc: string;
  /** Game day the rumor entered the town. */
  spreadDay: number;
  /** Every NPC id that has heard it, in the order they heard it. */
  reachedNpcs: string[];
  tone: RumorTone;
  kind: RumorKind;
  /** 0..1 — how eagerly a carrier retells it to any one contact. */
  virality: number;
  /** 0..1 — how much reputation each listener is worth. */
  weight: number;
  /** Last game day this rumor gained a listener (or its spread day). */
  lastSpreadDay: number;
  /** Who the talk is about. Defaults to the player. */
  subject: string;
  /** Optional town/location the deed happened in, carried for WorldRumor projection. */
  locationId?: string;
}

/** A notable thing that happened and is worth talking about. */
export interface NotableDeed {
  kind: RumorKind;
  /** Game day the deed happened. */
  day: number;
  /** NPC id who saw it and starts the talk. */
  sourceNpc: string;
  /** Who the deed is about; shown in the rumor text. Defaults to 'the stranger'. */
  subject?: string;
  /** Free text folded into the rumor line (a quest name, a law broken, a foe). */
  detail?: string;
  /** 0..1 — how big a deal it was. Defaults to the kind's own weight. */
  magnitude?: number;
  /** Overrides the kind's default tone (a "victory" that was really a murder). */
  tone?: RumorTone;
  locationId?: string;
  /** Explicit id, for callers that need to correlate a rumor with their own record. */
  id?: string;
}

/** One directed hop in the social graph. Ties are stored both ways. */
export interface RumorEdge {
  npcId: string;
  /** 0..1 — how readily talk crosses this tie. */
  strength: number;
}

/** Who talks to whom. Adjacency keyed by NPC id. */
export interface RumorSocialGraph {
  edges: Record<string, RumorEdge[]>;
}

/** What a set of live rumors has done to the player's standing. */
export interface RumorReputationDelta {
  /** Total notoriety gained from negative talk currently in circulation. */
  notorietyDelta: number;
  /** Per-NPC disposition nudge, keyed by NPC id. Signed by rumor tone. */
  dispositionDeltas: Record<string, number>;
}

// ============================================================================
// Rumor generation
// ============================================================================

interface KindProfile {
  tone: RumorTone;
  virality: number;
  weight: number;
  /** Templates; `{subject}` and `{detail}` are substituted. */
  templates: string[];
  /** Used when a deed carries no detail of its own. */
  fallbackDetail: string;
}

/**
 * Per-kind defaults. Crime travels fastest and hits hardest; charity travels
 * slowest, because a donation is only interesting to people who care about the
 * temple. These numbers are the tuning surface for the whole system.
 */
const KIND_PROFILES: Record<RumorKind, KindProfile> = {
  combat_victory: {
    tone: 'positive',
    virality: 0.45,
    weight: 0.6,
    fallbackDetail: 'something with too many teeth',
    templates: [
      'They say {subject} put down {detail} without breaking a sweat.',
      'Word is {subject} walked away from {detail}. Walked, mind you.',
      "{subject} faced {detail} and it's {subject} still standing.",
    ],
  },
  quest_completed: {
    tone: 'positive',
    virality: 0.4,
    weight: 0.7,
    fallbackDetail: 'a job nobody else would take',
    templates: [
      'Heard {subject} finally settled {detail}.',
      "{detail}? Done. {subject} saw to it, so they're saying.",
      'Folk are grateful — {subject} handled {detail}.',
    ],
  },
  crime: {
    tone: 'negative',
    virality: 0.65,
    weight: 0.9,
    fallbackDetail: 'something the watch would like to discuss',
    templates: [
      "Keep your purse close. {subject} is the one behind {detail}.",
      'Watch is asking after {subject} over {detail}.',
      "You didn't hear it from me, but {detail} — that was {subject}.",
    ],
  },
  donation: {
    tone: 'positive',
    virality: 0.3,
    weight: 0.5,
    fallbackDetail: 'a good sum to the temple',
    templates: [
      'The temple did well by {subject} — {detail}, freely given.',
      '{subject} gave {detail}. Not many would.',
      "Priests are saying kind words about {subject} after {detail}.",
    ],
  },
  custom: {
    tone: 'neutral',
    virality: 0.35,
    weight: 0.4,
    fallbackDetail: 'something worth mentioning',
    templates: ['Talk is that {subject} was mixed up in {detail}.'],
  },
};

/**
 * Stable numeric seed for a string.
 *
 * The trailing avalanche is load-bearing, not decoration. Plain djb2 only
 * moves its LOW bits when the last character changes, and `SeededRandom` is a
 * Lehmer generator whose first output is `seed * 16807 / m` — so seeds like
 * `"<id>|1"` and `"<id>|2"` produced the SAME first draw. That made a rumor
 * that failed its first contact on day 1 fail it on every later day too, and
 * spread stalled. The mix spreads the low bits across the whole word.
 */
function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash * 33) ^ input.charCodeAt(i)) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2246822507) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 3266489909) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Turns one notable deed into a rumor. Deterministic: the same deed and seed
 * always produce the same line and id, so a replayed save says the same thing.
 */
export function generateRumor(deed: NotableDeed, seed = 0): TownRumor {
  const profile = KIND_PROFILES[deed.kind] ?? KIND_PROFILES.custom;
  const subject = deed.subject ?? 'the stranger';
  const detail = deed.detail ?? profile.fallbackDetail;

  const rng = new SeededRandom(
    (hashString(`${deed.kind}|${deed.sourceNpc}|${detail}|${deed.day}`) + seed) % 2147483647,
  );
  const template = rng.pick(profile.templates);
  const text = template.split('{subject}').join(subject).split('{detail}').join(detail);

  const id =
    deed.id ??
    `rumor_${deed.kind}_${deed.day}_${hashString(`${deed.sourceNpc}|${detail}|${seed}`).toString(36)}`;

  return {
    id,
    text,
    sourceNpc: deed.sourceNpc,
    spreadDay: deed.day,
    // The witness is, by definition, the first person who knows.
    reachedNpcs: [deed.sourceNpc],
    tone: deed.tone ?? profile.tone,
    kind: deed.kind,
    virality: profile.virality,
    weight: deed.magnitude !== undefined ? clamp01(deed.magnitude) : profile.weight,
    lastSpreadDay: deed.day,
    subject,
    locationId: deed.locationId,
  };
}

/** Convenience for a batch of deeds resolved in the same tick. */
export function generateRumors(deeds: NotableDeed[], seed = 0): TownRumor[] {
  return deeds.map((deed, index) => generateRumor(deed, seed + index));
}

// ============================================================================
// Social graph construction
// ============================================================================

function addEdge(graph: RumorSocialGraph, from: string, to: string, strength: number): void {
  if (from === to) return;
  const list = graph.edges[from] ?? (graph.edges[from] = []);
  const existing = list.find((edge) => edge.npcId === to);
  if (existing) {
    existing.strength = Math.max(existing.strength, strength);
    return;
  }
  list.push({ npcId: to, strength });
}

/**
 * Preferred graph source: the town sim's relationship web
 * (`AgentDeepeningState.relationships`).
 *
 * Tie strength uses the ABSOLUTE affinity, not the signed value. A rival is
 * not a dead end for gossip — a rival is the most motivated retelling you will
 * ever get. Contact days add a smaller, capped term so long acquaintance still
 * beats a single loud argument.
 */
export function buildSocialGraphFromBonds(
  relationships: Record<string, AgentRelationshipBond>,
  options: { idPrefix?: string } = {},
): RumorSocialGraph {
  const prefix = options.idPrefix ?? '';
  const graph: RumorSocialGraph = { edges: {} };

  for (const bond of Object.values(relationships ?? {})) {
    if (!bond) continue;
    const left = `${prefix}${bond.leftId}`;
    const right = `${prefix}${bond.rightId}`;
    const affinityTerm = Math.abs(bond.affinity ?? 0) / 200; // 0..0.5
    const contactTerm = Math.min(bond.contactDays ?? 0, 60) / 240; // 0..0.25
    const strength = Math.max(0.05, Math.min(1, 0.15 + affinityTerm + contactTerm));
    addEdge(graph, left, right, strength);
    addEdge(graph, right, left, strength);
  }

  return graph;
}

/**
 * Fallback when no relationship web exists for a town: everyone sharing a
 * location can overhear everyone else. Weaker ties than real bonds, because
 * standing in the same square is not the same as being trusted.
 */
export function buildProximityGraph(
  npcs: Array<{ id: string; locationId: string }>,
  strength = 0.35,
): RumorSocialGraph {
  const graph: RumorSocialGraph = { edges: {} };
  const byLocation = new Map<string, string[]>();

  for (const npc of npcs) {
    if (!npc?.id) continue;
    const bucket = byLocation.get(npc.locationId) ?? [];
    bucket.push(npc.id);
    byLocation.set(npc.locationId, bucket);
  }

  for (const bucket of byLocation.values()) {
    for (const a of bucket) {
      for (const b of bucket) {
        addEdge(graph, a, b, strength);
      }
    }
  }

  return graph;
}

// ============================================================================
// Decay
// ============================================================================

/** 1.0 on the day it happened, falling linearly to 0 at RUMOR_LIFESPAN_DAYS. */
export function rumorFreshness(rumor: TownRumor, currentDay: number): number {
  const age = currentDay - rumor.spreadDay;
  if (age < 0) return 1;
  return clamp01(1 - age / RUMOR_LIFESPAN_DAYS);
}

/** Old news. Stops spreading, stops being said, stops counting. */
export function isRumorStale(rumor: TownRumor, currentDay: number): boolean {
  return currentDay - rumor.spreadDay >= RUMOR_LIFESPAN_DAYS;
}

/** Drops stale rumors. Returns the same array reference when nothing expired. */
export function pruneStaleRumors(rumors: TownRumor[], currentDay: number): TownRumor[] {
  const kept = rumors.filter((rumor) => !isRumorStale(rumor, currentDay));
  return kept.length === rumors.length ? rumors : kept;
}

// ============================================================================
// Spread
// ============================================================================

/**
 * Advances every live rumor by exactly one game day.
 *
 * Model: each NPC who already knows a rumor gets one chance to tell each of
 * their contacts, at `virality * tieStrength`, damped by freshness so week-old
 * talk crawls. Nobody is told twice, and the source cannot un-know it.
 *
 * Returns new arrays/objects; the input rumors are never mutated.
 */
export function spreadRumorsOneDay(
  rumors: TownRumor[],
  graph: RumorSocialGraph,
  currentDay: number,
  seed = 0,
): { rumors: TownRumor[]; newReaches: Record<string, string[]> } {
  const newReaches: Record<string, string[]> = {};

  const next = rumors.map((rumor) => {
    if (isRumorStale(rumor, currentDay)) return rumor;

    const freshness = rumorFreshness(rumor, currentDay);
    // Even day-old talk is a little less urgent than the moment it happened,
    // but a stale-ish rumor still moves at ~half speed rather than stopping dead.
    const damping = 0.5 + 0.5 * freshness;

    const known = new Set(rumor.reachedNpcs);
    const carriers = [...rumor.reachedNpcs];
    const gained: string[] = [];
    const rng = new SeededRandom(
      (hashString(`${rumor.id}|${currentDay}`) + seed) % 2147483647,
    );

    for (const carrier of carriers) {
      const contacts = graph.edges[carrier];
      if (!contacts) continue;
      for (const contact of contacts) {
        if (known.has(contact.npcId)) continue;
        const chance = clamp01(rumor.virality * contact.strength * damping);
        if (rng.next() < chance) {
          known.add(contact.npcId);
          gained.push(contact.npcId);
        }
      }
    }

    if (gained.length === 0) return rumor;
    newReaches[rumor.id] = gained;
    return {
      ...rumor,
      reachedNpcs: [...rumor.reachedNpcs, ...gained],
      lastSpreadDay: currentDay,
    };
  });

  return { rumors: next, newReaches };
}

/**
 * Runs the spread one day at a time from `fromDay` up to and including
 * `toDay`, then prunes what went stale on the way. This is the function a
 * day-tick should call.
 */
export function advanceRumors(
  rumors: TownRumor[],
  graph: RumorSocialGraph,
  fromDay: number,
  toDay: number,
  seed = 0,
): TownRumor[] {
  let current = rumors;
  for (let day = fromDay; day <= toDay; day += 1) {
    current = spreadRumorsOneDay(current, graph, day, seed).rumors;
  }
  return pruneStaleRumors(current, toDay);
}

// ============================================================================
// Dialogue context
// ============================================================================

/**
 * Everything `npcId` could bring up today: rumors they have actually heard,
 * that are not stale, and that they have had at least one night to chew on.
 * Freshest first, so a caller can just take the top N.
 */
export function getRumorsForNpc(
  rumors: TownRumor[],
  npcId: string,
  currentDay: number,
): TownRumor[] {
  return rumors
    .filter((rumor) => {
      if (isRumorStale(rumor, currentDay)) return false;
      if (currentDay - rumor.spreadDay < RUMOR_DIALOGUE_DELAY_DAYS) return false;
      return rumor.reachedNpcs.includes(npcId);
    })
    .sort((a, b) => b.spreadDay - a.spreadDay);
}

/**
 * Prompt-ready lines for an NPC's dialogue context. Kept as plain strings so
 * either the scripted topic layer or the LLM prompt builder can take them.
 */
export function buildRumorDialogueContext(
  rumors: TownRumor[],
  npcId: string,
  currentDay: number,
  max = 3,
): string[] {
  return getRumorsForNpc(rumors, npcId, currentDay)
    .slice(0, max)
    .map((rumor) => {
      const age = currentDay - rumor.spreadDay;
      const when = age <= 1 ? 'yesterday' : `${age} days ago`;
      return `Heard ${when}: ${rumor.text}`;
    });
}

// ============================================================================
// Reputation
// ============================================================================

/**
 * What the talk currently in circulation is worth.
 *
 * Negative rumors raise notoriety per listener, as the task requires. Tone also
 * signs a per-listener disposition nudge — a positive rumor warms the people
 * who heard it, and a negative one cools them. Neutral talk moves neither.
 * Fresh talk counts for more, so reputation fades with the rumor.
 */
export function summarizeRumorReputation(
  rumors: TownRumor[],
  currentDay: number,
): RumorReputationDelta {
  let notorietyDelta = 0;
  const dispositionDeltas: Record<string, number> = {};

  for (const rumor of rumors) {
    if (isRumorStale(rumor, currentDay)) continue;
    if (rumor.tone === 'neutral') continue;

    const freshness = rumorFreshness(rumor, currentDay);
    // The source witnessed it; only the people they told are "reached by talk".
    const listeners = rumor.reachedNpcs.filter((npcId) => npcId !== rumor.sourceNpc);
    const perListener = rumor.weight * freshness;

    if (rumor.tone === 'negative') {
      notorietyDelta += listeners.length * perListener * NOTORIETY_PER_LISTENER;
    }

    const sign = rumor.tone === 'positive' ? 1 : -1;
    for (const npcId of listeners) {
      dispositionDeltas[npcId] =
        (dispositionDeltas[npcId] ?? 0) + sign * perListener * DISPOSITION_PER_LISTENER;
    }
  }

  return { notorietyDelta, dispositionDeltas };
}

// ============================================================================
// Interop with the existing WorldRumor pipeline
// ============================================================================

/**
 * Projects a TownRumor down to the canonical `WorldRumor` so the tavern gossip
 * board and `dialogueService.getDynamicRumorTopics` can show town talk with no
 * changes of their own. Person-level detail (sourceNpc/reachedNpcs) is dropped
 * on purpose — WorldRumor has no place for it and does not need one.
 */
export function townRumorToWorldRumor(rumor: TownRumor): WorldRumor {
  return {
    id: rumor.id,
    text: rumor.text,
    type: rumor.kind === 'crime' ? 'event' : 'misc',
    timestamp: rumor.spreadDay,
    expiration: rumor.spreadDay + RUMOR_LIFESPAN_DAYS,
    locationId: rumor.locationId,
    spreadDistance: Math.max(0, rumor.reachedNpcs.length - 1),
    virality: rumor.virality,
  };
}
