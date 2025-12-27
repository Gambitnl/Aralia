
import { describe, it, expect } from 'vitest';
import { OpportunityAttackSystem } from '../OpportunityAttackSystem';
import { CombatCharacter } from '../../../../types/combat';
import { createMockCombatCharacter } from '../../../../utils/factories';

describe('OpportunityAttackSystem - Conditions', () => {
  const system = new OpportunityAttackSystem();

  const createAttacker = (id: string, x: number, y: number): CombatCharacter => {
    const char = createMockCombatCharacter({ id, name: id, team: 'enemy' });
    char.position = { x, y };
    return char;
  };

  const createMover = (id: string, x: number, y: number): CombatCharacter => {
    const char = createMockCombatCharacter({ id, name: id, team: 'player' });
    char.position = { x, y };
    return char;
  };

  it('should prevent OA if attacker is Paralyzed', () => {
    const attacker = createAttacker('orc_paralyzed', 0, 0);
    // Apply Paralyzed condition (using legacy statusEffects for now as that is what systems use primarily, but should test both)
    attacker.statusEffects.push({
      id: 'paralyzed_effect',
      name: 'Paralyzed',
      type: 'debuff',
      duration: 1,
      effect: { type: 'condition' } // Assuming simplified structure
    });
    // Also add to conditions array for forward compatibility if system uses it
    attacker.conditions = [{
        name: 'Paralyzed',
        duration: { type: 'rounds', value: 1 },
        appliedTurn: 1
    }];

    const mover = createMover('hero', 0, 1);

    // Move out of reach
    const results = system.checkOpportunityAttacks(mover, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker]);

    // Should be empty because Paralyzed creatures can't take reactions
    expect(results).toHaveLength(0);
  });

  it('should prevent OA if attacker is Stunned', () => {
    const attacker = createAttacker('orc_stunned', 0, 0);
    attacker.statusEffects.push({
      id: 'stunned_effect',
      name: 'Stunned',
      type: 'debuff',
      duration: 1,
      effect: { type: 'condition' }
    });

    const mover = createMover('hero', 0, 1);
    const results = system.checkOpportunityAttacks(mover, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker]);

    expect(results).toHaveLength(0);
  });

  it('should prevent OA if attacker is Unconscious', () => {
    const attacker = createAttacker('orc_sleep', 0, 0);
    attacker.statusEffects.push({
      id: 'sleep_effect',
      name: 'Unconscious',
      type: 'debuff',
      duration: 1,
      effect: { type: 'condition' }
    });

    const mover = createMover('hero', 0, 1);
    const results = system.checkOpportunityAttacks(mover, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker]);

    expect(results).toHaveLength(0);
  });
});
