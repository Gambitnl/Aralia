
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TargetAllocator } from '../TargetAllocator';
import { TargetAllocation } from '../../../../types/spells';
import { createMockCombatCharacter } from '../../../../utils/factories';
import * as combatUtils from '../../../../utils/combatUtils';

describe('TargetAllocator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

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
  });
});
