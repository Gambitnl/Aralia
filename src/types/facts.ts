/**
 * @file src/types/facts.ts
 * The durable, world-level fact store (DIAL-002 + DIAL-004).
 *
 * When an NPC tells the player something that should unlock options with OTHER
 * NPCs, that knowledge is a fact about the WORLD the player now knows — not a
 * per-NPC memory (`KnownFact` models what an NPC knows about the player) and
 * not a player-facing journal entry (`DiscoveryLog` is presentation). This
 * store is the single mechanical source of truth for "does the player durably
 * know X", keyed by semantic fact key, serialized with saves.
 */

/**
 * How far a fact ripples. All facts are player-known world knowledge; scope
 * exists so systems can reason about reach (e.g. a region-scoped secret can
 * gate topics only with NPCs of that region, while global facts unlock
 * everywhere). Default is 'global'.
 */
export type WorldFactScope = 'global' | 'region' | 'npc';

/** A single durable unlock-fact the player has learned. */
export interface WorldFact {
  /** Unique instance id (audit/debug). */
  id: string;
  /**
   * Semantic key — the identity of the fact. One fact per key; learning the
   * same key twice is a no-op. Convention: `<kind>:<subject>`, e.g.
   * `topic_unlocked:ask_about_ruins`.
   */
  key: string;
  /** Optional payload (e.g. a location id the fact points at). */
  value?: string | number | boolean;
  scope: WorldFactScope;
  /** Region the fact is scoped to when scope === 'region'. */
  regionId?: string;
  /** NPC the fact is scoped to when scope === 'npc'. */
  npcId?: string;
  /** Provenance: the NPC who told the player (undefined for system grants). */
  sourceNpcId?: string;
  /** Provenance: the dialogue topic whose outcome granted the fact. */
  sourceTopicId?: string;
  /** Game-time (ms timestamp) when the fact was learned. */
  learnedAt: number;
}

/** The serializable store. Lives on GameState and round-trips through saves. */
export interface WorldFactStore {
  version: 1;
  /** Facts keyed by their semantic `key`. */
  facts: Record<string, WorldFact>;
}

/** Input for learning a fact — id/learnedAt defaults are filled by the store helper. */
export interface LearnWorldFactInput {
  key: string;
  value?: string | number | boolean;
  scope?: WorldFactScope;
  regionId?: string;
  npcId?: string;
  sourceNpcId?: string;
  sourceTopicId?: string;
  learnedAt?: number;
}
