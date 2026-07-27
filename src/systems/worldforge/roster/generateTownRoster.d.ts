/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 18/07/2026, 20:24:31
 * Dependents: components/World3D/World3DWrapper.tsx, components/Worldforge/AgentSim3DPreview.tsx, components/Worldforge/AgentSimPreview.tsx, components/Worldforge/LivingWorldPreview.tsx, components/debug/AgentSimDevOverlay.tsx, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/townsim/townSimRegistration.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { TownPlan } from "../artifacts";
import type { BlueprintPlan } from "../interior/blueprintTypes";
import { type SeedPath } from "../seedPath";
import type { TownRoster } from "./types";
/**
 * This file turns a generated Worldforge town plan into the people who live
 * and work there.
 *
 * The town generator owns streets and building plots. The canonical building
 * blueprint owns bedroom counts for each house. This roster pass sits between them:
 * every house receives a household sized to its bedrooms, and adult residents
 * are assigned to nearby market or workshop jobs. Names are injected so the
 * later FMG culture-name bridge can plug in without changing roster logic.
 *
 * Called by: future Worldforge ground/interior agent placement.
 * Depends on: TownPlan, blueprintForPlot, and seedPath deterministic streams.
 */
export interface GenerateTownRosterOptions {
    nameFor: (rng: {
        next(): number;
    }) => string;
}
export declare function generateTownRoster(plan: TownPlan, seedPath: SeedPath, opts: GenerateTownRosterOptions): TownRoster;
/** Count every above-ground sleeping room in the canonical blueprint. */
export declare function houseBedroomCount(plan: BlueprintPlan): number;
