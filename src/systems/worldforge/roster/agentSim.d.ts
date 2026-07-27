/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 19:32:47
 * Dependents: components/Worldforge/AgentSimPreview.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file agentSim.ts — WF-AGENTSIM behaviour layer (SPEC §8).
 *
 * The schedule substrate (`occupantSchedule`) answers "where is occupant O at hour
 * H" from a FIXED hash-of-id routine. This layer makes townsfolk actually *decide*:
 * each has needs that decay/recover, picks an activity by its most-pressing need
 * (tempered by the time of day), spends/earns wealth, and socialises when it shares
 * a place with others. Needs PERSIST across ticks, so behaviour varies day to day
 * (a late shift → low energy → an early night) instead of repeating identically.
 *
 * Pure + deterministic: state in → state out, no Math.random / Date.now. A seeded
 * per-occupant stream supplies small threshold jitter so the town doesn't move in
 * lockstep. This is the stateful counterpart to the stateless `townSnapshotAt`;
 * a host ticks it forward and reads each agent's chosen `activity` + `targetPlotId`.
 */
import type { Occupant } from './types';
/** All needs are 0 (desperate) … 100 (fully satisfied). */
export interface AgentNeeds {
    /** Rest. Drains while awake (faster working), restored by sleeping. */
    energy: number;
    /** Food. Drains steadily, restored by eating (costs wealth). */
    satiety: number;
    /** Company. Drains over time, restored by being co-located with others. */
    social: number;
    /** Money. Earned by working, spent on eating/shopping. Never blocks survival. */
    wealth: number;
}
/** What an agent has chosen to do this tick. */
export type AgentActivity = 'sleep' | 'eat' | 'work' | 'socialize' | 'shop' | 'home';
/** One agent's evolving mind: needs + the decision it acted on this tick. */
export interface AgentMind {
    occupantId: number;
    needs: AgentNeeds;
    activity: AgentActivity;
    /** Plot the activity sends them to (home / work / a gathering place). */
    targetPlotId: number;
    /** True when this tick's social recovery came from real company (interaction). */
    socialized: boolean;
}
/** Town context the simulation reads (plots it can route activities to). */
export interface AgentSimContext {
    /** Plot ids that serve as gathering places (markets/workshops). */
    gatheringPlotIds: number[];
    /**
     * Optional kinship so families act together: a child trails an out-and-about
     * parent (or stays home with a resting one), and spouses who both go out to
     * socialise meet at the SAME place. Keyed by occupant id.
     */
    kin?: Map<number, {
        parentId?: number;
        spouseId?: number;
    }>;
}
export interface StepOptions {
    /** Fractional hour of day (0–24). */
    hour: number;
    /** Sim time elapsed this step, in hours. */
    dtHours: number;
    context: AgentSimContext;
}
/** Deterministic starting minds for a roster: everyone wakes rested + fed. */
export declare function initAgentMinds(occupants: Occupant[]): AgentMind[];
/**
 * Advance every agent one tick: decay needs, decide the next activity, apply the
 * activity's recovery (sleep→energy, eat→satiety−wealth, work→wealth), then resolve
 * co-location — agents sharing a plot while socialising recover MORE social and are
 * flagged `socialized` (a real interaction, not solo idling). Pure: returns new
 * minds; inputs are untouched.
 */
export declare function stepAgentSim(minds: AgentMind[], occupants: Occupant[], opts: StepOptions): AgentMind[];
/** Options for a whole-day replay. */
export interface SimulateDayOptions {
    /** Fixed simulation step, in hours (smaller = finer, slower). Default 0.25 (15 min). */
    stepHours?: number;
    /** Hour the day's replay anchors from (the "dawn" reset point). Default 0 (midnight). */
    dayStart?: number;
}
/**
 * Deterministically replay the behaviour sim from the day's anchor up to `clock`
 * and return the resulting minds. This is the "scrub anywhere" contract: instead
 * of carrying live per-frame state, a host can ask "what does the town look like
 * at hour H?" and always get the SAME answer for the same (roster, context, H).
 *
 * The replay starts every occupant fresh (`initAgentMinds`) at `dayStart` and folds
 * `stepAgentSim` in fixed `stepHours` increments, with one final partial step to
 * land exactly on `clock`. Because both `initAgentMinds` and `stepAgentSim` are
 * pure and deterministic, so is this — no live clock, no accumulated frame drift.
 *
 * `clock` and `dayStart` are wrapped into [0,24). Replay distance is measured
 * forward from the anchor, so a 06:00 anchor can correctly reach 03:00 by
 * crossing midnight instead of mistaking that target for "before the day".
 * Only a target exactly on the anchor returns the fresh minds unchanged.
 */
export declare function simulateMindsTo(occupants: Occupant[], context: AgentSimContext, clock: number, opts?: SimulateDayOptions): AgentMind[];
