/**
 * @file occupantSchedule.ts
 * @description The smallest real step into Worldforge agent BEHAVIOR (SPEC §6
 * "later schedule pass", anticipated by roster/types.ts): a pure, deterministic
 * answer to "where is occupant O, and what are they doing, at hour H?".
 *
 * This is data, not simulation — no ticking, no mutation, no rendering. It
 * derives a daily routine from a single occupant's static roster record so any
 * consumer (3D agent placement, debug overlays, future needs/economy sim) can
 * ask the same question and get the same answer for a given (occupant, hour).
 *
 * Routine model (a conventional medieval day, deterministic per person):
 *   - SLEEP overnight at home (wake/sleep times jittered ±a couple hours by id).
 *   - WORKERS (have a workPlotId) commute out and WORK their trade by day; age
 *     shortens an elder's shift and a child never works.
 *   - Non-workers are HOME, with a midday OUT block (market/errands/play).
 * Location is always a concrete plot id (home or work) so consumers can place
 * the agent; `activity` carries the intent.
 *
 * Determinism: a per-occupant jitter is hashed from `occupant.id` only — same
 * occupant, same hour → identical block, no RNG/seed-path plumbing needed.
 */
import type { Occupant } from './types';
export type ActivityKind = 'sleeping' | 'home' | 'working' | 'out';
export interface ScheduleBlock {
    /** What the occupant is doing this hour. */
    activity: ActivityKind;
    /** The plot they are at: their work plot while `working`, else their home plot. */
    plotId: number;
    /** 0–23 hour this block answers. */
    hour: number;
}
/**
 * Where the occupant is, and what they are doing, at `hour` (0–23). Pure.
 */
export declare function occupantLocationAt(occupant: Occupant, hour: number): ScheduleBlock;
/** The occupant's full 24-hour routine (one block per hour, 0→23). Pure. */
export declare function occupantDayRoutine(occupant: Occupant): ScheduleBlock[];
