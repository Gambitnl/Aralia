// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 10:53:50
 * Dependents: components/debug/DevMenu.tsx, state/reducers/factReducer.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/systems/dialogue/unlockRegistry.ts
 * The durable global unlock-fact registry (DIAL-004).
 *
 * WHAT THIS IS
 * ------------
 * A typed boolean-flag view of what the player has PERMANENTLY unlocked —
 * through dialogue, or through any other action a system wants to record.
 * "The player learned the password", "the player found the passage": one bit
 * each, world-level, save-durable, readable by every NPC and every system.
 *
 * WHY IT IS NOT A NEW STATE SLICE (the important decision here)
 * ------------------------------------------------------------
 * Aralia ALREADY has the durable store this needs:
 *   - `src/types/facts.ts`         -> `WorldFactStore`
 *   - `src/systems/facts/worldFactStore.ts` -> pure, reducer-friendly helpers
 *   - `GameState.worldFacts`       -> serialized with every save
 * Both files are headed "DIAL-002 + DIAL-004": the fact store was built as the
 * substrate for THIS task and DIAL-002's cross-NPC propagation together.
 * Adding a second `unlockFlags` slice to `GameState` would have produced two
 * competing answers to "does the player durably know X", two save-migration
 * paths, and a cross-NPC propagation system (DIAL-002) that only sees half the
 * unlocks. So `UnlockRegistry` is an ALIAS for `WorldFactStore`, and a flag is
 * a fact under the reserved `unlock:` key namespace.
 *
 * That means the acceptance criteria "registry in GameState, persists across
 * saves" is met by the store already on `GameState.worldFacts`, with no new
 * field and no migration: pre-DIAL-004 saves load with zero flags set, exactly
 * as a fresh registry would.
 *
 * A flag carries provenance (which NPC, which topic, when) for free, because a
 * `WorldFact` already does. `hasUnlockFlag` still answers a plain boolean.
 *
 * PURITY
 * ------
 * Every helper is pure and returns the SAME store reference on a no-op, so
 * `factReducer` can cheaply skip a re-render. Every reader tolerates
 * `undefined` so legacy saves need no healing at the call site.
 *
 * Called by: state/reducers/factReducer.ts, components/debug/DevMenu.tsx,
 *            components/Dialogue/* (via the dialogue-graph bridge below).
 * Depends on: systems/facts/worldFactStore.ts, systems/dialogue/dialogueGraphTypes.ts.
 */

import {
  createEmptyWorldFactStore,
  getWorldFact,
  learnWorldFact,
  listWorldFacts,
  normalizeWorldFactStore,
} from '../facts/worldFactStore';
import type { WorldFact, WorldFactScope, WorldFactStore } from '../../types/facts';
import type {
  DialogueEffectOutcome,
  DialogueGraphContext,
} from './dialogueGraphTypes';

// ============================================================================
// Types
// ============================================================================

/**
 * The registry IS the durable world-fact store. The alias exists so call sites
 * that only care about unlocks read as unlock code, and so the boolean-flag
 * contract can be documented independently of the fact store's wider job.
 */
export type UnlockRegistry = WorldFactStore;

/** Reserved key namespace. Only keys under it are unlock flags. */
export const UNLOCK_FLAG_PREFIX = 'unlock:';

/**
 * The four standard flags named by DIAL-004.
 *
 * TASK-TEXT CORRECTION: the task body spells the fourth flag
 * `learnednpc_secret` (missing underscore). Shipped as `learned_npc_secret` to
 * match the other three; `LEGACY_UNLOCK_FLAG_ALIASES` below keeps the literal
 * spelling readable so authored JSON written against the task text still
 * resolves instead of silently never matching.
 */
export const STANDARD_UNLOCK_FLAGS = {
  LEARNED_SECRET_PASSWORD: 'learned_secret_password',
  DISCOVERED_HIDDEN_PASSAGE: 'discovered_hidden_passage',
  GAINED_FACTION_TRUST: 'gained_faction_trust',
  LEARNED_NPC_SECRET: 'learned_npc_secret',
} as const;

export type StandardUnlockFlag =
  (typeof STANDARD_UNLOCK_FLAGS)[keyof typeof STANDARD_UNLOCK_FLAGS];

/** Misspellings/older spellings mapped to their canonical flag name. */
export const LEGACY_UNLOCK_FLAG_ALIASES: Record<string, StandardUnlockFlag> = {
  learnednpc_secret: STANDARD_UNLOCK_FLAGS.LEARNED_NPC_SECRET,
};

/** A flag as the debug menu and any inspector wants it: name, truth, provenance. */
export interface UnlockFlagEntry {
  /** Canonical flag name, without the `unlock:` prefix. */
  flag: string;
  /** True unless the stored payload is literally `false`. */
  isSet: boolean;
  /** Optional payload a flag may carry alongside its truth. */
  value?: string | number | boolean;
  scope: WorldFactScope;
  /** Game-time ms when the flag was set. */
  setAt: number;
  sourceNpcId?: string;
  sourceTopicId?: string;
}

/** Provenance/options accepted when setting a flag. */
export interface SetUnlockFlagOptions {
  value?: string | number | boolean;
  scope?: WorldFactScope;
  regionId?: string;
  npcId?: string;
  sourceNpcId?: string;
  sourceTopicId?: string;
  /** Game-time ms; defaults to wall clock only when the caller has no clock. */
  setAt?: number;
}

// ============================================================================
// Keys
// ============================================================================

/** Canonicalizes a flag name (trims, lowercases, resolves known misspellings). */
export function canonicalUnlockFlag(flag: string): string {
  const trimmed = String(flag ?? '').trim();
  const lower = trimmed.toLowerCase();
  return LEGACY_UNLOCK_FLAG_ALIASES[lower] ?? lower;
}

/** `learned_secret_password` -> `unlock:learned_secret_password`. */
export function unlockFlagKey(flag: string): string {
  return `${UNLOCK_FLAG_PREFIX}${canonicalUnlockFlag(flag)}`;
}

/** Inverse of `unlockFlagKey`; returns undefined for non-unlock fact keys. */
export function unlockFlagFromKey(key: string): string | undefined {
  return key.startsWith(UNLOCK_FLAG_PREFIX)
    ? key.slice(UNLOCK_FLAG_PREFIX.length)
    : undefined;
}

// ============================================================================
// Registry operations (pure)
// ============================================================================

export function createEmptyUnlockRegistry(): UnlockRegistry {
  return createEmptyWorldFactStore();
}

export { normalizeWorldFactStore as normalizeUnlockRegistry };

/**
 * Sets a flag. Returns the SAME store when the flag is already set with the
 * same payload, so a repeated dialogue effect is a genuine no-op.
 *
 * A flag is a fact, and `learnWorldFact` is first-provenance-wins. That is
 * right for "the player learned X" but wrong for a flag whose payload changes
 * (e.g. a faction-trust tier). So a value CHANGE re-writes the entry while
 * preserving the original `learnedAt` — the moment of unlock is the durable
 * part, the payload is allowed to move.
 */
export function setUnlockFlag(
  registry: UnlockRegistry | undefined,
  flag: string,
  options: SetUnlockFlagOptions = {},
): UnlockRegistry {
  const canonical = canonicalUnlockFlag(flag);
  if (!canonical) return registry ?? createEmptyUnlockRegistry();

  const store = normalizeWorldFactStore(registry);
  const key = unlockFlagKey(canonical);
  const value = options.value ?? true;
  const existing = store.facts[key];

  if (existing) {
    if (existing.value === value) return registry ?? store;
    // Payload moved: rewrite in place, keep the original unlock timestamp.
    return {
      version: 1,
      facts: { ...store.facts, [key]: { ...existing, value } },
    };
  }

  return learnWorldFact(store, {
    key,
    value,
    scope: options.scope ?? 'global',
    regionId: options.regionId,
    npcId: options.npcId,
    sourceNpcId: options.sourceNpcId,
    sourceTopicId: options.sourceTopicId,
    learnedAt: options.setAt ?? Date.now(),
  });
}

/**
 * Clears a flag, removing the entry entirely.
 *
 * DELIBERATELY SCOPED: this only ever deletes keys under `unlock:`. The wider
 * fact store has no `forget` helper on purpose — DIAL-002 treats a learned
 * fact as permanent world knowledge — and this must not become a back door for
 * erasing quest or town-situation receipts. Unlock flags are the one namespace
 * where a system legitimately needs to take a bit back (a debug reset, a
 * faction expelling the player, a timed access window closing).
 */
export function clearUnlockFlag(
  registry: UnlockRegistry | undefined,
  flag: string,
): UnlockRegistry {
  const key = unlockFlagKey(flag);
  if (!registry?.facts?.[key]) return registry ?? createEmptyUnlockRegistry();

  const store = normalizeWorldFactStore(registry);
  const facts = { ...store.facts };
  delete facts[key];
  return { version: 1, facts };
}

/**
 * Is the flag set? Absent, or stored as literal `false`, both read as unset —
 * matching `dialogueGraphRuntime`'s `unlock_flag` evaluator so the registry and
 * the graph can never disagree about the same flag.
 */
export function hasUnlockFlag(
  registry: UnlockRegistry | undefined,
  flag: string,
): boolean {
  const fact = getWorldFact(registry, unlockFlagKey(flag));
  return !!fact && fact.value !== false;
}

/** The flag's payload (`true` for a plain truth marker), or undefined if unset. */
export function getUnlockFlagValue(
  registry: UnlockRegistry | undefined,
  flag: string,
): string | number | boolean | undefined {
  return getWorldFact(registry, unlockFlagKey(flag))?.value;
}

/** Every flag in the registry, newest first. Non-unlock facts are excluded. */
export function listUnlockFlags(registry: UnlockRegistry | undefined): UnlockFlagEntry[] {
  return listWorldFacts(registry)
    .filter((fact: WorldFact) => fact.key.startsWith(UNLOCK_FLAG_PREFIX))
    .map<UnlockFlagEntry>((fact) => ({
      flag: fact.key.slice(UNLOCK_FLAG_PREFIX.length),
      isSet: fact.value !== false,
      value: fact.value,
      scope: fact.scope,
      setAt: fact.learnedAt,
      sourceNpcId: fact.sourceNpcId,
      sourceTopicId: fact.sourceTopicId,
    }))
    .sort((a, b) => b.setAt - a.setAt || a.flag.localeCompare(b.flag));
}

/**
 * The four standard flags with their current state, always all four present so
 * a debug surface can show "not yet unlocked" rather than an empty list.
 */
export function listStandardUnlockFlags(
  registry: UnlockRegistry | undefined,
): UnlockFlagEntry[] {
  return Object.values(STANDARD_UNLOCK_FLAGS).map((flag) => {
    const fact = getWorldFact(registry, unlockFlagKey(flag));
    return {
      flag,
      isSet: !!fact && fact.value !== false,
      value: fact?.value,
      scope: fact?.scope ?? 'global',
      setAt: fact?.learnedAt ?? 0,
      sourceNpcId: fact?.sourceNpcId,
      sourceTopicId: fact?.sourceTopicId,
    };
  });
}

// ============================================================================
// Dialogue-graph bridge (DIAL-001 seam)
// ============================================================================
// `dialogueGraphTypes.ts` reserved `unlock_flag` (read) and `set_flag` (write)
// for this system and documented this file's store as their backing. The two
// functions below are the whole seam: one turns the registry into the graph's
// `flags` context, the other turns resolved `set_flag` outcomes into reducer
// actions. Nothing in the graph runtime imports game state, and nothing here
// imports the graph runtime — the bridge stays in one direction.
// ============================================================================

/** Action a caller dispatches to set a flag. Mirrored in `state/actionTypes.ts`. */
export interface SetUnlockFlagAction {
  type: 'SET_UNLOCK_FLAG';
  payload: { flag: string } & SetUnlockFlagOptions;
}

/** Action a caller dispatches to clear a flag. Mirrored in `state/actionTypes.ts`. */
export interface ClearUnlockFlagAction {
  type: 'CLEAR_UNLOCK_FLAG';
  payload: { flag: string };
}

export type UnlockFlagAction = SetUnlockFlagAction | ClearUnlockFlagAction;

/**
 * Registry -> `DialogueGraphContext.flags`, the map an `unlock_flag` condition
 * reads. Cleared flags are absent (not `false`), which is what the evaluator
 * expects, and a flag's payload rides along so a graph can branch on a tier as
 * well as on truth.
 */
export function unlockFlagsForDialogueContext(
  registry: UnlockRegistry | undefined,
): Record<string, unknown> {
  const flags: Record<string, unknown> = {};
  for (const entry of listUnlockFlags(registry)) {
    flags[entry.flag] = entry.value ?? true;
  }
  return flags;
}

/**
 * Builds the flag half of a graph evaluation context, preserving anything the
 * caller already put in `flags` (registry wins on a collision — it is the
 * durable truth).
 */
export function withUnlockFlags(
  context: DialogueGraphContext,
  registry: UnlockRegistry | undefined,
): DialogueGraphContext {
  return {
    ...context,
    flags: { ...(context.flags ?? {}), ...unlockFlagsForDialogueContext(registry) },
  };
}

/**
 * Resolved dialogue effects -> unlock actions.
 *
 * Only `set_flag` outcomes that actually resolved produce an action; a
 * malformed effect (missing `params.flag`) is already marked `applied: false`
 * by the runtime and is skipped here rather than dispatched as a broken write.
 * `provenance` lets the caller stamp the speaking NPC and the graph id onto
 * every flag the conversation sets.
 */
export function unlockActionsFromDialogueEffects(
  outcomes: readonly DialogueEffectOutcome[],
  provenance: Pick<SetUnlockFlagOptions, 'sourceNpcId' | 'sourceTopicId' | 'setAt' | 'scope' | 'regionId'> = {},
): SetUnlockFlagAction[] {
  const actions: SetUnlockFlagAction[] = [];
  for (const outcome of outcomes) {
    if (outcome.type !== 'set_flag' || !outcome.applied || !outcome.flag) continue;
    const raw = outcome.flagValue;
    // The graph allows an arbitrary payload; the registry stores only JSON
    // scalars, so anything else degrades to a plain truth marker.
    const value =
      typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean'
        ? raw
        : true;
    actions.push({
      type: 'SET_UNLOCK_FLAG',
      payload: { flag: outcome.flag, value, ...provenance },
    });
  }
  return actions;
}
