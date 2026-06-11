// @dependencies-start
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
// @dependencies-end

/**
 * @file src/systems/spells/targeting/TargetAllocator.ts
 * Provides logic for complex target allocation strategies, such as the HP pool mechanics
 * used by "Sleep" and "Color Spray".
 */
// TODO(lint-intent): 'Spell' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { TargetAllocation, Spell as _Spell, ScalingFormula } from '../../../types/spells';
import { CombatCharacter } from '../../../types/combat';
import { rollDice } from '../../../utils/combatUtils';

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
export class TargetAllocator {

  /**
   * allocating targets from a list of candidates based on the spell's allocation strategy.
   *
   * @param candidates - The list of valid targets within the area/range.
   * @param allocation - The allocation strategy definition.
   * @param context - Context for dice rolling and scaling.
   */
  public static allocateTargets(
    candidates: CombatCharacter[],
    allocation: TargetAllocation,
    context: AllocatorContext = {}
  ): AllocationResult {
    const logs: string[] = [];

    // Default strategy: ALL
    if (!allocation || allocation.type === 'all') {
      return { selectedTargets: candidates, logs: ['All targets selected.'] };
    }

    // Pool Strategy (Sleep, Color Spray)
    if (allocation.type === 'pool' && allocation.pool) {
      return this.processPoolAllocation(candidates, allocation.pool, context, logs);
    }

    // TODO: Implement 'random' and 'choice' strategies when needed.
    logs.push(`Unsupported allocation type: ${allocation.type}`);
    return { selectedTargets: candidates, logs };
  }

  private static processPoolAllocation(
    candidates: CombatCharacter[],
    poolConfig: NonNullable<TargetAllocation['pool']>,
    context: AllocatorContext,
    logs: string[]
  ): AllocationResult {
    const { resource, dice, sortOrder, strictLimit = true } = poolConfig;

    // 1. Roll the pool after applying any safe, data-backed dice replacement.
    // Tier maps are exact dice strings keyed by slot/character level, so they
    // can be applied without knowing the spell's base level. Linear bonus text
    // stays logged but unresolved until allocation receives that missing anchor.
    const finalDice = this.resolvePoolDice(dice, poolConfig.scaling, context, logs);

    const poolTotal = rollDice(finalDice);
    let remainingPool = poolTotal;
    logs.push(`Rolled ${finalDice} for ${resource} pool: ${poolTotal}`);

    // 2. Sort candidates
    const sortedCandidates = [...candidates].sort((a, b) => {
      const valA = this.getResourceValue(a, resource);
      const valB = this.getResourceValue(b, resource);
      return sortOrder === 'ascending' ? valA - valB : valB - valA;
    });

    const selectedTargets: CombatCharacter[] = [];

    // 3. Allocate
    for (const candidate of sortedCandidates) {
      const value = this.getResourceValue(candidate, resource);

      // Sleep Rule: "A creature's Hit Points must be equal to or less than the remaining total"
      if (remainingPool >= value) {
        selectedTargets.push(candidate);
        remainingPool -= value;
        logs.push(`Selected ${candidate.name} (${value} ${resource}). Pool remaining: ${remainingPool}`);
      } else {
        if (strictLimit) {
          logs.push(`Skipped ${candidate.name} (${value} ${resource}) - exceeds pool (${remainingPool}).`);
          // For Sleep/Color Spray, we STOP or SKIP?
          // PHB Sleep: "Subtract each creature's Hit Points... moving on to the next... A creature's HP must be equal to or less..."
          // It implies we skip and try the next? "moving on to the creature with the next lowest"
          // Actually, if we are sorted ascending, and the current (lowest available) is too high,
          // then ALL subsequent ones (which are higher) will also be too high.
          // So we can break early optimization.
          if (sortOrder === 'ascending') {
            break;
          }
        } else {
          // Partial application (not standard 5e, but supported by engine if needed)
          selectedTargets.push(candidate);
          remainingPool = 0;
          logs.push(`Selected ${candidate.name} (Partial). Pool depleted.`);
          break;
        }
      }

      if (remainingPool <= 0) break;
    }

    return {
      selectedTargets,
      logs,
      initialPool: poolTotal,
      remainingPool
    };
  }

  private static getResourceValue(character: CombatCharacter, resource: 'hp' | 'hit_dice'): number {
    if (resource === 'hp') {
      // Some callers provide a loose combat stub with `hp`; fall back to `currentHP`.
      // TODO(lint-intent): Normalize on `currentHP` across combat helpers.
      return (character as unknown as { hp?: number }).hp ?? character.currentHP ?? 0;
    }
    if (resource === 'hit_dice') {
      if (character.hitPointDice && character.hitPointDice.length > 0) {
        // Sum remaining dice across die sizes for pool-based spells.
        return character.hitPointDice.reduce((sum, pool) => sum + pool.current, 0);
      }
      return character.level ?? 0;
    }
    return 0;
  }

  private static resolvePoolDice(
    baseDice: string,
    scaling: ScalingFormula | undefined,
    context: AllocatorContext,
    logs: string[]
  ): string {
    // Spells without pool scaling use the declared dice exactly as written.
    if (!scaling) {
      return baseDice;
    }

    // Explicit scaling tiers are the safest representation because each
    // threshold already names the complete replacement dice string.
    if (scaling.scalingTiers && context.castLevel !== undefined) {
      const activeTier = Object.keys(scaling.scalingTiers)
        .map(levelText => Number.parseInt(levelText, 10))
        .filter(level => Number.isFinite(level) && context.castLevel !== undefined && level <= context.castLevel)
        .sort((a, b) => b - a)[0];

      if (activeTier !== undefined) {
        const tierDice = scaling.scalingTiers[activeTier.toString()];
        logs.push(`Applied allocation scaling tier ${activeTier}: ${tierDice}`);
        return tierDice;
      }
    }

    // The older scaling shape can also expose a numeric resolver callback. That
    // is useful for flat numeric payloads, but a dice pool needs a dice string,
    // so we leave the original dice in place instead of converting a number
    // into a misleading fake dice expression.
    if (context.resolveScaling) {
      logs.push('Allocation scaling resolver was provided but skipped because pool allocation needs dice text.');
    }

    // Linear text such as "+2d8 per slot level" cannot be safely expanded here
    // because this context does not know the spell's base level. Logging the
    // deferral makes the runtime behavior visible while preserving the base dice.
    if (scaling.bonusPerLevel || scaling.customFormula) {
      logs.push(`Allocation scaling not applied; base dice preserved: ${baseDice}`);
    }

    return baseDice;
  }
}
