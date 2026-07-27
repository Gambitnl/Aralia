/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/06/2026, 22:17:54
 * Dependents: systems/spells/targeting/TargetResolver.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/systems/spells/targeting/TargetAllocator.ts
 * Provides logic for complex target allocation strategies, such as the HP pool mechanics
 * used by "Sleep" and "Color Spray".
 */
import { TargetAllocation, ScalingFormula } from '../../../types/spells';
import { CombatCharacter } from '../../../types/combat';
export interface AllocationResult {
    /** The subset of candidates that were selected */
    selectedTargets: CombatCharacter[];
    /** Detailed logs of the allocation process */
    logs: string[];
    /** The final state of the pool (if applicable) */
    remainingPool?: number;
    /** The initial pool value (if applicable) */
    initialPool?: number;
}
/**
 * Runtime integration note:
 * `TargetResolver` now calls this allocator after normal range, sight, plane,
 * and creature-filter checks. Combat execution also calls the resolver bridge
 * with the already selected UI candidates so area spells keep their clicked
 * footprint while pool rules reduce the final affected target list.
 */
export interface AllocatorContext {
    /** The level the spell was cast at (for scaling) */
    castLevel?: number;
    /** Optional function to resolve scalable numbers if needed */
    resolveScaling?: (formula: ScalingFormula, level: number) => number;
}
/**
 * Handles the logic of selecting targets from a candidate list based on
 * complex strategies like resource pools (Sleep/Color Spray).
 */
export declare class TargetAllocator {
    /**
     * allocating targets from a list of candidates based on the spell's allocation strategy.
     *
     * @param candidates - The list of valid targets within the area/range.
     * @param allocation - The allocation strategy definition.
     * @param context - Context for dice rolling and scaling.
     */
    static allocateTargets(candidates: CombatCharacter[], allocation: TargetAllocation, context?: AllocatorContext): AllocationResult;
    private static processPoolAllocation;
    private static getResourceValue;
    private static resolvePoolDice;
}
