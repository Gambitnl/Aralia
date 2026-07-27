/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 18/07/2026, 20:18:25
 * Dependents: None (Orphan)
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { TownSimState } from '../townsim/types';
import type { TownRoster } from './types';
export interface AgentLifeMoment {
    /** Calendar day on which this replay window begins at `dayStart`. */
    anchorDay: number;
    /** Hour shown by the agent-sim clock; values are normalized into [0, 24). */
    hour: number;
}
export interface AgentLifeReplayOptions {
    /** Hour the behaviour day begins. Defaults to midnight; arbitrary values wrap. */
    dayStart?: number;
    /** Keep the core-only default, or opt into economy, relationships, and town events. */
    mode?: AgentLifeMode;
}
/** Optional daily layers supported by the same multi-day replay spine. */
export type AgentLifeMode = 'life-events' | 'deepened';
/** Inputs needed when advancing days without the one-call roster wrapper below. */
export interface AgentLifeAdvanceOptions {
    mode?: AgentLifeMode;
    /** Deepened replay reads existing home, work, age-band, and occupation facts. */
    roster?: TownRoster;
}
export interface ResolvedAgentLifeMoment {
    /** Calendar day after accounting for an anchored replay crossing midnight. */
    day: number;
    /** Normalized hour in [0, 24). */
    hour: number;
}
export interface AgentLifeSnapshot extends ResolvedAgentLifeMoment {
    /** Replayable canonical life-event state, including dead genealogical records. */
    state: TownSimState;
    /** Only people alive at this moment, shaped for the hourly behaviour sim. */
    roster: TownRoster;
}
/** Resolve an anchored agent clock to one unambiguous calendar day and hour. */
export declare function resolveAgentLifeMoment(moment: AgentLifeMoment, opts?: AgentLifeReplayOptions): ResolvedAgentLifeMoment;
/** Advance the multi-day spine to an explicit calendar day. */
export declare function advanceAgentLifeDays(state: TownSimState, worldSeed: number, targetDay: number, opts?: AgentLifeAdvanceOptions): TownSimState;
/** Project canonical life state into the existing, id-sorted visual roster. */
export declare function livingRosterAt(state: TownSimState, generatedRoster: TownRoster, day: number): TownRoster;
/** Advance life history and return the living roster for one anchored clock. */
export declare function replayAgentLifeTo(state: TownSimState, generatedRoster: TownRoster, worldSeed: number, moment: AgentLifeMoment, opts?: AgentLifeReplayOptions): AgentLifeSnapshot;
