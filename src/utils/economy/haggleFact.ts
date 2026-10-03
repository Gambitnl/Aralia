/**
 * @file src/utils/economy/haggleFact.ts
 * Single source of truth for the `recent_haggle` NPC memory fact: how its text
 * is written, how it is parsed back, and how an *unexpired* one is found.
 *
 * Why this file exists (UI-3 haggle flow consistency, 2026-09-09): the format
 * was previously written in `handleMerchantInteraction` and parsed a few lines
 * below it, while the merchant UI knew nothing about it at all. That let the
 * displayed price and the charged price disagree. Both the handler and
 * `MerchantModal` now go through these helpers, so a change to the format can
 * only be made in one place.
 *
 * The fact text is deliberately NOT renamed (see GG-143/GG-136 notes on this
 * flow): it still starts with the `recent_haggle` marker and still carries a
 * `priceMultiplier=<n>` token, so any older saved fact keeps parsing.
 */
import type { KnownFact } from '../../types/world';

/** Marker every haggle fact's text begins with. Stable — do not rename. */
export const RECENT_HAGGLE_MARKER = 'recent_haggle';

/**
 * Cooldown window, in milliseconds of game time, before the same merchant can
 * be haggled again. Stored as the fact's `lifespan`, so the cooldown and the
 * price effect expire together — one fact, one meaning.
 */
export const HAGGLE_COOLDOWN_MS = 86_400_000; // 24 game hours

/**
 * Build the fact text.
 *
 * The trailing `at=<timestamp>` is not decoration. `ADD_NPC_KNOWN_FACT` drops a
 * fact whose `text` already exists on the NPC and does not consider expiry
 * (GG-136), so a stable text meant the second successful haggle of a given
 * strategy — days later, after the first had expired — was silently discarded
 * and the player got no discount. Stamping the game-time instant keeps each
 * haggle a distinct fact while leaving the marker and the multiplier token
 * exactly where every reader expects them. Growth is bounded by the cooldown:
 * at most one fact per merchant per 24 game hours.
 */
export function buildHaggleFactText(priceMultiplier: number, atMs: number): string {
  return `${RECENT_HAGGLE_MARKER} priceMultiplier=${priceMultiplier} at=${atMs}`;
}

/** True when this text is a haggle fact (any vintage, including pre-`at=` ones). */
export function isHaggleFactText(text: string | undefined): boolean {
  return typeof text === 'string' && text.includes(RECENT_HAGGLE_MARKER);
}

/**
 * Read the negotiated multiplier back out of a fact's text.
 * Returns undefined for a missing, malformed, or non-finite value so callers
 * can fall back to full price rather than to NaN.
 */
export function getPriceMultiplierFromHaggleFactText(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const match = text.match(/priceMultiplier=([0-9]+(?:\.[0-9]+)?)/);
  if (!match?.[1]) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Minimal shape this module needs from an NPC memory entry. */
export interface HaggleFactMemory {
  knownFacts: KnownFact[];
}

/**
 * Find the merchant's still-active haggle fact, if any. A fact is active while
 * `timestamp + lifespan` is still ahead of the current game time.
 *
 * When several are stored (older saves could accumulate them before the `at=`
 * stamp made each one distinct), the newest still-active fact wins, so the
 * price the player just negotiated is the price they get.
 */
export function findActiveHaggleFact(
  memory: HaggleFactMemory | undefined,
  nowMs: number,
): KnownFact | undefined {
  if (!memory?.knownFacts) return undefined;
  let newest: KnownFact | undefined;
  for (const fact of memory.knownFacts) {
    if (!isHaggleFactText(fact?.text)) continue;
    const expiresAt = (fact.timestamp || 0) + (fact.lifespan || 0);
    if (expiresAt <= nowMs) continue;
    if (!newest || (fact.timestamp || 0) > (newest.timestamp || 0)) newest = fact;
  }
  return newest;
}

/**
 * The multiplier that should be applied to a merchant's prices right now: the
 * active haggle result, or 1 (full price) when there is none. Used by the buy
 * handler and by the merchant UI's price display so the two cannot drift.
 */
export function activeHagglePriceMultiplier(
  memory: HaggleFactMemory | undefined,
  nowMs: number,
): number {
  const fact = findActiveHaggleFact(memory, nowMs);
  return getPriceMultiplierFromHaggleFactText(fact?.text) ?? 1;
}

/** Round a gold value to the nearest copper (2 dp), matching merchant pricing. */
export function roundToCopper(gpValue: number): number {
  return Math.round(gpValue * 100) / 100;
}
