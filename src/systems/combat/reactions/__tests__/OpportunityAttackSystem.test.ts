
import { describe, it, expect } from 'vitest';
import { OpportunityAttackSystem } from '../OpportunityAttackSystem';
import { CombatCharacter } from '../../../../types/combat';
import { createMockCombatCharacter } from '../../../../utils/factories';

describe('OpportunityAttackSystem', () => {
  const system = new OpportunityAttackSystem();

  const createAttacker = (id: string, x: number, y: number, hasReaction: boolean = true): CombatCharacter => {
    const char = createMockCombatCharacter({ id, name: id, team: 'enemy' });
    char.position = { x, y };
    char.actionEconomy.reaction.used = !hasReaction;
    return char;
  };

  const createMover = (id: string, x: number, y: number, isDisengaged: boolean = false): CombatCharacter => {
    const char = createMockCombatCharacter({ id, name: id, team: 'player' });
    char.position = { x, y };
    if (isDisengaged) {
      char.statusEffects.push({
        id: 'disengage',
        name: 'Disengage',
        type: 'buff',
        duration: 1,
        effect: { type: 'stat_modifier' }
      });
    }
    return char;
  };

  it('detects OA when moving out of reach (5ft)', () => {
    const attacker = createAttacker('orc', 0, 0);
    const mover = createMover('hero', 0, 1);
    const results = system.checkOpportunityAttacks(mover, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker]);
    expect(results).toHaveLength(1);
    expect(results[0].attackerId).toBe('orc');
  });

  it('does NOT detect OA when moving within reach', () => {
    const attacker = createAttacker('orc', 0, 0);
    const mover = createMover('hero', 1, 0);
    const results = system.checkOpportunityAttacks(mover, { x: 1, y: 0 }, { x: 1, y: 1 }, [attacker]);
    expect(results).toHaveLength(0);
  });

  it('does NOT detect OA if attacker has no reaction', () => {
    const attacker = createAttacker('orc', 0, 0, false);
    const mover = createMover('hero', 0, 1);
    const results = system.checkOpportunityAttacks(mover, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker]);
    expect(results).toHaveLength(0);
  });

  it('does NOT detect OA if mover Disengaged', () => {
    const attacker = createAttacker('orc', 0, 0);
    const mover = createMover('hero', 0, 1, true);
    const results = system.checkOpportunityAttacks(mover, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker]);
    expect(results).toHaveLength(0);
  });

  it('does NOT detect OA if attacker is ally', () => {
     const attacker = createAttacker('ally', 0, 0);
     attacker.team = 'player';
     const mover = createMover('hero', 0, 1);
     const results = system.checkOpportunityAttacks(mover, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker]);
     expect(results).toHaveLength(0);
  });

  describe('Condition Checks', () => {
    it('should prevent OA if attacker is Paralyzed', () => {
      const attacker = createAttacker('orc_paralyzed', 0, 0);
      attacker.statusEffects.push({
        id: 'paralyzed_effect',
        name: 'Paralyzed',
        type: 'debuff',
        duration: 1,
        effect: { type: 'condition' }
      });
      const mover = createMover('hero', 0, 1);
      const results = system.checkOpportunityAttacks(mover, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker]);
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
});
