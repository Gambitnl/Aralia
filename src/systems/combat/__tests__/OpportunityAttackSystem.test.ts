import { describe, it, expect, beforeEach } from 'vitest';
import { OpportunityAttackSystem } from '../reactions/OpportunityAttackSystem';
import { createMockCombatCharacter, createMockItem } from '@/utils/factories';
import { canTakeReaction } from '@/utils/combatUtils';

describe('OpportunityAttackSystem and Reaction Rules', () => {
  let oaSystem: OpportunityAttackSystem;

  beforeEach(() => {
    oaSystem = new OpportunityAttackSystem();
  });

  it('prevents reactions if character has Reactions Suppressed condition', () => {
    const character = createMockCombatCharacter({ id: 'target' });
    character.statusEffects.push({
      id: 'reactions_suppressed',
      name: 'Reactions Suppressed',
      type: 'debuff',
      duration: 1
    });

    expect(canTakeReaction(character)).toBe(false);
  });

  it('prevents reactions if character has Confused condition', () => {
    const character = createMockCombatCharacter({ id: 'target' });
    character.statusEffects.push({
      id: 'confused',
      name: 'Confused',
      type: 'debuff',
      duration: 1
    });

    expect(canTakeReaction(character)).toBe(false);
  });

  it('prevents reactions if character has Slowed condition', () => {
    const character = createMockCombatCharacter({ id: 'target' });
    character.statusEffects.push({
      id: 'slowed',
      name: 'Slowed',
      type: 'debuff',
      duration: 1
    });

    expect(canTakeReaction(character)).toBe(false);
  });

  it('prevents opportunity attacks specifically if character has Opportunity Attacks Suppressed condition', () => {
    const mover = createMockCombatCharacter({ id: 'mover', position: { x: 2, y: 0 }, team: 'enemy' });

    // Attacker has a melee weapon (reach 1) and the OA suppressed condition.
    const attacker = createMockCombatCharacter({ id: 'attacker', position: { x: 0, y: 0 }, team: 'player' });
    attacker.abilities.push({
      id: 'melee_attack', name: 'Melee', type: 'attack', range: 1, weapon: createMockItem({
        id: 'melee_weapon',
        name: 'Melee Weapon',
        description: 'A simple melee weapon',
        type: 'weapon'
      }), isProficient: true,
      cost: { type: 'action' }, description: '', targeting: { type: 'single', validTargets: ['creatures'] } as any, effects: []
    });
    attacker.statusEffects.push({
      id: 'oa_suppressed',
      name: 'Opportunity Attacks Suppressed',
      type: 'debuff',
      duration: 1
    });

    // Mover leaves reach (1 -> 2)
    const fromPos = { x: 1, y: 0 };
    const toPos = { x: 2, y: 0 };

    const results = oaSystem.checkOpportunityAttacks(mover, fromPos, toPos, [attacker]);

    expect(results.length).toBe(0); // OA prevented
    // Note: canTakeReaction should still be true because it's only OA that is suppressed
    expect(canTakeReaction(attacker)).toBe(true);
  });

  it('flags must_attack reason if attacker has Enemies Abound', () => {
    const mover = createMockCombatCharacter({ id: 'mover', position: { x: 2, y: 0 }, team: 'enemy' });

    const attacker = createMockCombatCharacter({ id: 'attacker', position: { x: 0, y: 0 }, team: 'player' });
    attacker.abilities.push({
      id: 'melee_attack', name: 'Melee', type: 'attack', range: 1, weapon: createMockItem({
        id: 'melee_weapon',
        name: 'Melee Weapon',
        description: 'A simple melee weapon',
        type: 'weapon'
      }), isProficient: true,
      cost: { type: 'action' }, description: '', targeting: { type: 'single', validTargets: ['creatures'] } as any, effects: []
    });
    attacker.statusEffects.push({
      id: 'enemies_abound',
      name: 'Enemies Abound',
      type: 'debuff',
      duration: 1
    });

    const fromPos = { x: 1, y: 0 };
    const toPos = { x: 2, y: 0 };

    const results = oaSystem.checkOpportunityAttacks(mover, fromPos, toPos, [attacker]);

    expect(results.length).toBe(1);
    expect(results[0].canAttack).toBe(true);
    expect(results[0].reason).toBe('enemies_abound_must_attack');
  });
});
