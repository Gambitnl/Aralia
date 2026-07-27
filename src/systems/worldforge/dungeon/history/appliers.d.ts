/**
 * @file history/appliers.ts
 * @description Event dispatch + all decay-event appliers + their occupation /
 * tunnel / cycle-edge / reachability helpers — extracted VERBATIM from
 * simulateHistory.ts (packet W1-P6). Every applier returns the logged
 * `DungeonEvent` or `null` (no evidence → excluded), routing its concrete
 * mutations through the recorder so a cutoff replays exactly the right prefix.
 * Move-only: bodies are byte-identical, so each applier draws rng in the same
 * order. Exported for the main loop: `applyEvent` (dispatch), `assertReachable`,
 * and the `builderNoun`/`structureNoun` vocabulary; everything else stays
 * module-internal exactly as it was file-internal in the monolith.
 */
import type { SimCtx } from './context';
import { type IntactState } from '../buildIntact';
import { type BuilderArchetype, type DungeonEvent, type EventKind } from '../types';
interface PendingEvent {
    id: number;
    kind: EventKind;
    yearsAgo: number;
    isApex: boolean;
    /** Always true in the canonical pass — every event is fully applied (and its
     * concrete mutations recorded into `ctx.rec`). The `asOfYearsAgo` cutoff is not
     * gated HERE; it is realized afterward by restoring the snapshot and replaying
     * only the prefix's recorded deltas. Kept for call-site clarity. Returning null
     * from an applier means "this event left no evidence and is excluded from the
     * log" — a purely structural decision, so identical across every cutoff. */
    apply: boolean;
}
/**
 * Apply one event. Returns the logged `DungeonEvent`, or `null` when the applier
 * could not leave any real evidence (an evidence-less collapse/brick-off/flood) —
 * the caller then re-rolls a replacement kind or drops the slot (F5). The
 * exclusion decision is purely structural and so identical across `asOfYearsAgo`.
 */
export declare function applyEvent(ctx: SimCtx, p: PendingEvent): DungeonEvent | null;
export declare function builderNoun(archetype: BuilderArchetype): string;
export declare function structureNoun(archetype: BuilderArchetype): string;
/** Throw if any Floor cell is unreachable from the entrance-room center. */
export declare function assertReachable(st: IntactState): void;
export {};
