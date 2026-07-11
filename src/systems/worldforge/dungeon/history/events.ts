/**
 * @file history/events.ts
 * @description Event-kind picking (chain rolling) — extracted VERBATIM from
 * simulateHistory.ts (packet W1-P6). `pickKind`/`pickReplacement` each consume
 * exactly ONE rng draw (ineligible kinds are pruned BEFORE the draw so the draw
 * count is stable); `bestOccupyingKind`/`reassignApex` are rng-free. Move-only:
 * bodies are byte-identical, so the single draw per pick fires in the same place.
 * Exported for the main loop.
 */

import type { SimCtx } from './context';
import type { DungeonEvent, EventKind } from '../types';

// ─── Chain rolling ───────────────────────────────────────────────────────────

export const OCCUPYING: ReadonlySet<EventKind> = new Set<EventKind>(['den', 'awaken', 'reoccupy', 'bloom']);

/**
 * Weighted kind pick honoring the hard eligibility rules given the plan so far.
 * Consumes exactly ONE rng draw whether or not the pick lands on an eligible
 * kind — ineligible kinds are removed from the weighted pool BEFORE the draw so
 * the draw count is stable regardless of which kinds are currently eligible
 * (eligibility itself is seed-determined via the prior picks).
 */
export function pickKind(
  ctx: SimCtx,
  weights: Readonly<Partial<Record<EventKind, number>>>,
  soFar: EventKind[],
): EventKind | null {
  const hasPlunder = soFar.includes('plunder');
  const hasTunnel = soFar.includes('tunnel');
  const hasSeal = soFar.includes('seal');
  // A cycle now ALWAYS exists from the start — the intact builder opens BUILT
  // loop cross-cuts (DEFECT A). So collapse/brick-off are eligible even before
  // any robber tunnel: they may bring down / wall up a built cross-cut, which is
  // connectivity-safe on any cycle edge. This makes those events more common and
  // more interesting. The application-time safety checks (connectivity, an intact
  // loop corridor to target) still guard the appliers.

  const pool: Array<{ kind: EventKind; w: number }> = [];
  for (const [k, w] of Object.entries(weights) as Array<[EventKind, number]>) {
    if (!w) continue;
    if (k === 'seal' && hasSeal) continue; // no duplicate seal
    if (k === 'awaken' && !hasPlunder && !hasTunnel) continue; // desecration first
    if (k === 'reoccupy' && !hasTunnel) continue; // needs a way in
    // collapse/brick-off: no chain precondition — a built cycle always exists.
    pool.push({ kind: k, w });
  }
  if (pool.length === 0) return null;
  const total = pool.reduce((s, p) => s + p.w, 0);
  let r = ctx.rng.float(0, total);
  for (const p of pool) {
    r -= p.w;
    if (r < 0) return p.kind;
  }
  return pool[pool.length - 1].kind;
}

/** The archetype's highest-weight occupying kind (the forced-occupation slot). */
export function bestOccupyingKind(
  weights: Readonly<Partial<Record<EventKind, number>>>,
): EventKind {
  let best: EventKind = 'den';
  let bestW = -1;
  for (const [k, w] of Object.entries(weights) as Array<[EventKind, number]>) {
    if (!w) continue;
    if (!OCCUPYING.has(k)) continue;
    if (w > bestW) {
      bestW = w;
      best = k;
    }
  }
  return best;
}

/**
 * Deterministic replacement pick for a slot whose rolled kind left no evidence.
 * Same weighted machinery as `pickKind` (honoring eligibility against the kinds
 * KEPT so far), minus any kinds already tried for this slot. Consumes one rng
 * draw, like `pickKind`.
 */
export function pickReplacement(
  ctx: SimCtx,
  weights: Readonly<Partial<Record<EventKind, number>>>,
  kept: EventKind[],
  tried: ReadonlySet<EventKind>,
): EventKind | null {
  const pruned: Partial<Record<EventKind, number>> = {};
  for (const [k, w] of Object.entries(weights) as Array<[EventKind, number]>) {
    if (!w || tried.has(k)) continue;
    pruned[k] = w;
  }
  return pickKind(ctx, pruned, kept);
}

/**
 * Re-resolve the apex flag over the FINAL kept log: the last surviving occupying
 * event is the apex, everything else is not. Updates both the event objects and
 * the matching `ctx.occupations` rows so downstream (Task 6 boss placement) reads
 * one apex, on a real logged occupation.
 */
export function reassignApex(ctx: SimCtx, events: DungeonEvent[]): void {
  let apexId = -1;
  for (const ev of events) {
    if (OCCUPYING.has(ev.kind)) apexId = ev.id;
  }
  for (const occ of ctx.occupations) {
    occ.isApex = occ.eventRef === apexId;
  }
}
