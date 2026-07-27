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
export declare const OCCUPYING: ReadonlySet<EventKind>;
/**
 * Weighted kind pick honoring the hard eligibility rules given the plan so far.
 * Consumes exactly ONE rng draw whether or not the pick lands on an eligible
 * kind — ineligible kinds are removed from the weighted pool BEFORE the draw so
 * the draw count is stable regardless of which kinds are currently eligible
 * (eligibility itself is seed-determined via the prior picks).
 */
export declare function pickKind(ctx: SimCtx, weights: Readonly<Partial<Record<EventKind, number>>>, soFar: EventKind[]): EventKind | null;
/** The archetype's highest-weight occupying kind (the forced-occupation slot). */
export declare function bestOccupyingKind(weights: Readonly<Partial<Record<EventKind, number>>>): EventKind;
/**
 * Deterministic replacement pick for a slot whose rolled kind left no evidence.
 * Same weighted machinery as `pickKind` (honoring eligibility against the kinds
 * KEPT so far), minus any kinds already tried for this slot. Consumes one rng
 * draw, like `pickKind`.
 */
export declare function pickReplacement(ctx: SimCtx, weights: Readonly<Partial<Record<EventKind, number>>>, kept: EventKind[], tried: ReadonlySet<EventKind>): EventKind | null;
/**
 * Re-resolve the apex flag over the FINAL kept log: the last surviving occupying
 * event is the apex, everything else is not. Updates both the event objects and
 * the matching `ctx.occupations` rows so downstream (Task 6 boss placement) reads
 * one apex, on a real logged occupation.
 */
export declare function reassignApex(ctx: SimCtx, events: DungeonEvent[]): void;
