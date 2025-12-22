/**
 * @file src/systems/spells/targeting/TargetAllocator.ts
 * Provides logic for complex target allocation strategies, such as the HP pool mechanics
 * used by "Sleep" and "Color Spray".
 */

import { TargetAllocation, Spell, ScalingFormula } from '../../../types/spells';
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
 * TODO(Steward): Integrate `TargetAllocator` into `TargetResolver` or `SpellService`.
 * The `TargetAllocation` system (for Sleep/Color Spray) is built but not wired up.
 *
 * Steps:
 * 1. In `TargetResolver.resolveTargets`, check if `spell.targeting.allocation` exists.
 * 2. If it does, call `TargetAllocator.allocateTargets` with the resolved candidates.
 * 3. Pass the `allocation.logs` to the combat log.
 * 4. Use `allocation.selectedTargets` as the final target list for effects.
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

    // 1. Roll the pool
    // TODO: Handle scaling dice (e.g. +2d8 per level).
    // For now, we assume the dice string is fully resolved or we use base.
    // In a full implementation, we'd use context.castLevel and poolConfig.scaling to adjust the dice string.
    const finalDice = dice;
    // NOTE: Simple scaling injection could happen here if we had a dice string builder.

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
      return character.hp; // Current HP
    }
    // Fallback for hit_dice or other resources
    // TODO: Implement hit dice lookup if needed
    return 0;
  }
}
