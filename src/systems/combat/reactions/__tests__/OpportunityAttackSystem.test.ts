
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
    // Attacker at 0,0. Reach 1.
    const attacker = createAttacker('orc', 0, 0);
    // Mover at 0,1 (in reach) moves to 0,2 (out of reach).
    const mover = createMover('hero', 0, 1);

    const results = system.checkOpportunityAttacks(mover, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker]);

    expect(results).toHaveLength(1);
    expect(results[0].attackerId).toBe('orc');
    expect(results[0].canAttack).toBe(true);
  });

  it('does NOT detect OA when moving within reach', () => {
    // Attacker at 0,0. Reach 1.
    const attacker = createAttacker('orc', 0, 0);
    // Mover at 1,0 (in reach) moves to 1,1 (still in reach - diagonal is dist 1 in Chebyshev).
    // Wait, 5e diagonals:
    // In Chebyshev (5-5-5), 1,1 is distance 1.
    // In Euclidean/5-10-5, 1,1 is distance 1.5 (approx 5ft, but logically adjacent).
    // The system uses `getDistance` which is Chebyshev.

    const mover = createMover('hero', 1, 0);
    const results = system.checkOpportunityAttacks(mover, { x: 1, y: 0 }, { x: 1, y: 1 }, [attacker]);

    expect(results).toHaveLength(0);
  });

  it('does NOT detect OA if attacker has no reaction', () => {
    const attacker = createAttacker('orc', 0, 0, false); // No reaction
    const mover = createMover('hero', 0, 1);

    const results = system.checkOpportunityAttacks(mover, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker]);
    expect(results).toHaveLength(0);
  });

  it('does NOT detect OA if mover Disengaged', () => {
    const attacker = createAttacker('orc', 0, 0);
    const mover = createMover('hero', 0, 1, true); // Disengaged

    const results = system.checkOpportunityAttacks(mover, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker]);
    expect(results).toHaveLength(0);
  });

  it('does NOT detect OA if attacker is ally', () => {
     const attacker = createAttacker('ally', 0, 0);
     attacker.team = 'player'; // Same team as mover
     const mover = createMover('hero', 0, 1);

     const results = system.checkOpportunityAttacks(mover, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker]);
     expect(results).toHaveLength(0);
  });
});
