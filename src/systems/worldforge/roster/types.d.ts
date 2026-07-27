/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 18/07/2026, 19:54:32
 * Dependents: components/Worldforge/TownAgentSnapshotView.tsx, components/Worldforge/VillagerRegistry.tsx, systems/worldforge/body/generateBody.ts, systems/worldforge/bridge/groundAgentMotion.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/roster/agentLife.ts, systems/worldforge/roster/agentSim.ts, systems/worldforge/roster/family.ts, systems/worldforge/roster/generateTownRoster.ts, systems/worldforge/roster/occupantSchedule.ts, systems/worldforge/roster/townSnapshot.ts, systems/worldforge/town/household.ts, systems/worldforge/townsim/keyNpcs.ts, systems/worldforge/townsim/townSim.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { TownPlan } from "../artifacts";
/**
 * This file defines the public data contract for Worldforge town rosters.
 *
 * A town plan says where buildings are; this roster says which deterministic
 * people live in those buildings and which adult residents work in markets or
 * workshops. Later schedule, faction, and economy passes can extend these
 * records without asking interior generation to invent people on its own.
 *
 * Called by: generateTownRoster and future ground/interior agent placement.
 * Depends on: TownPlan only for the plot role type alias below.
 */
export type AgeBand = "child" | "adult" | "elder";
export type Occupation = "resident" | "shopkeeper" | "artisan";
export interface Occupant {
    id: number;
    name: string;
    /**
     * Stable named-household identity when this roster person comes from the
     * lazy household pipeline. Servants use it today; later family unification
     * can adopt the same key without changing existing numeric roster ids.
     */
    householdMemberId?: string;
    ageBand: AgeBand;
    homePlotId: number;
    workPlotId?: number;
    occupation: Occupation;
}
export interface TownRoster {
    burgId: number;
    occupants: Occupant[];
}
export type TownPlot = TownPlan["plots"][number];
