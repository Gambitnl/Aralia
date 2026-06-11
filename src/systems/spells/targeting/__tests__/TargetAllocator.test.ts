
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TargetAllocator } from '../TargetAllocator';
import { TargetAllocation } from '../../../../types/spells';
import { createMockCombatCharacter } from '../../../../utils/factories';
import * as combatUtils from '../../../../utils/combatUtils';

/**
 * This file protects the pool-target allocation rules used by spell targeting.
 *
 * Pool allocation is how the spell system can take an eligible creature list
 * and then spend a rolled resource across that list instead of affecting every
 * candidate. These tests keep the allocator honest for base HP pools, partial
 * application, empty candidate lists, and exact dice replacement from scaling
 * tiers.
 */

describe('TargetAllocator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Pool Allocation
  // ============================================================================
  // These tests cover the final target-selection pass after normal targeting has
  // already produced candidate creatures. The allocator sorts, rolls the pool,
  // and decides which candidates are actually affected.
  // ============================================================================

  describe('processPoolAllocation', () => {
    it('should select targets in ascending order until pool is exhausted', () => {
      // Mock dice roll to return 25
      vi.spyOn(combatUtils, 'rollDice').mockReturnValue(25);

      const c1 = createMockCombatCharacter({ id: 'c1', name: 'Goblin Weak', currentHP: 7 });
      const c2 = createMockCombatCharacter({ id: 'c2', name: 'Goblin Avg', currentHP: 10 });
      const c3 = createMockCombatCharacter({ id: 'c3', name: 'Goblin Strong', currentHP: 15 });
      const c4 = createMockCombatCharacter({ id: 'c4', name: 'Orc', currentHP: 30 });  

      // Input order shouldn't matter as it sorts them
      const candidates = [c4, c2, c1, c3];

      const allocation: TargetAllocation = {
        type: 'pool',
        pool: {
          resource: 'hp',
          dice: '5d8',
          sortOrder: 'ascending',
          strictLimit: true
        }
      };

      const result = TargetAllocator.allocateTargets(candidates, allocation);

      // Expected:
      // 1. Sorts: c1(7), c2(10), c3(15), c4(30)
      // 2. Pool 25.
      // 3. c1 takes 7 -> Pool 18. Selected.
      // 4. c2 takes 10 -> Pool 8. Selected.
      // 5. c3 takes 15 -> Need 15, have 8. Skipped.
      // 6. c4 takes 30 -> Need 30, have 8. Skipped.

      expect(result.selectedTargets).toHaveLength(2);
      expect(result.selectedTargets).toContain(c1);
      expect(result.selectedTargets).toContain(c2);
      expect(result.selectedTargets).not.toContain(c3);
      expect(result.remainingPool).toBe(8);
    });

    it('should handle strictLimit=false (partial application)', () => {
      vi.spyOn(combatUtils, 'rollDice').mockReturnValue(10);
      const c1 = createMockCombatCharacter({ id: 'c1', currentHP: 15 });

      const allocation: TargetAllocation = {
        type: 'pool',
        pool: {
          resource: 'hp',
          dice: '5d8',
          sortOrder: 'ascending',
          strictLimit: false // ALLOW partial
        }
      };

      const result = TargetAllocator.allocateTargets([c1], allocation);

      expect(result.selectedTargets).toHaveLength(1);
      expect(result.selectedTargets[0].id).toBe('c1');
    });

    it('should handle empty candidates', () => {
       vi.spyOn(combatUtils, 'rollDice').mockReturnValue(25);
       const result = TargetAllocator.allocateTargets([], {
         type: 'pool',
         pool: { resource: 'hp', dice: '5d8', sortOrder: 'ascending' }
       });
       expect(result.selectedTargets).toHaveLength(0);
       expect(result.remainingPool).toBe(25);
    });

    it('uses exact scaling tier dice when the cast level reaches a pool threshold', () => {
      // The allocator should not guess at linear scaling, but explicit tier maps
      // already provide the complete dice string to roll for a given cast level.
      const rollSpy = vi.spyOn(combatUtils, 'rollDice').mockReturnValue(16);
      const c1 = createMockCombatCharacter({ id: 'c1', name: 'Scaled Target', currentHP: 12 });

      const allocation: TargetAllocation = {
        type: 'pool',
        pool: {
          resource: 'hp',
          dice: '5d8',
          sortOrder: 'ascending',
          scaling: {
            type: 'slot_level',
            scalingTiers: {
              '3': '7d8',
              '5': '9d8'
            }
          }
        }
      };

      const result = TargetAllocator.allocateTargets([c1], allocation, { castLevel: 5 });

      // The selected tier must be the highest threshold at or below the current
      // cast level, so a 5th-level cast rolls 9d8 instead of the base 5d8.
      expect(rollSpy).toHaveBeenCalledWith('9d8');
      expect(result.initialPool).toBe(16);
      expect(result.selectedTargets).toContain(c1);
      expect(result.logs).toContain('Applied allocation scaling tier 5: 9d8');
    });
  });
});
