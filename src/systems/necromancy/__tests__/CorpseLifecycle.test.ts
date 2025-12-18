
import { describe, it, expect } from 'vitest';
import { createCorpse, isValidCorpseTarget, canRevivify } from '../CorpseLifecycle';
import { Corpse } from '../models';
import { CombatCharacter } from '@/types/combat';

describe('CorpseLifecycle', () => {
  const mockCharacter: CombatCharacter = {
    id: 'char-1',
    name: 'Dead Guy',
    creatureTypes: ['Humanoid'],
    level: 1,
    class: { id: 'fighter', name: 'Fighter', level: 1, hitDie: 'd10' },
    position: { x: 0, y: 0 },
    stats: {
      strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10,
      baseInitiative: 0, speed: 30, cr: '1/4'
    },
    abilities: [],
    team: 'player',
    currentHP: 0,
    maxHP: 10,
    initiative: 10,
    statusEffects: [],
    actionEconomy: {
      action: { used: false, remaining: 1 },
      bonusAction: { used: false, remaining: 1 },
      reaction: { used: false, remaining: 1 },
      movement: { used: 0, total: 30 },
      freeActions: 1
    }
  };

  it('should create a fresh corpse from a character', () => {
    const corpse = createCorpse(mockCharacter, 5);
    expect(corpse.originalCharacterId).toBe(mockCharacter.id);
    expect(corpse.turnOfDeath).toBe(5);
    expect(corpse.state).toBe('fresh');
    expect(corpse.characterSnapshot.name).toBe('Dead Guy');
  });

  it('should validate corpse targets based on type and state', () => {
    const corpse = createCorpse(mockCharacter, 5);

    // Animate Dead usually requires Humanoid
    const isHumanoid = isValidCorpseTarget(corpse, ['fresh', 'bones'], ['Humanoid']);
    expect(isHumanoid).toBe(true);

    // Should fail if we need a Beast
    const isBeast = isValidCorpseTarget(corpse, ['fresh', 'bones'], ['Beast']);
    expect(isBeast).toBe(false);

    // Should fail if state doesn't match
    const isBones = isValidCorpseTarget(corpse, ['bones']);
    expect(isBones).toBe(false);
  });

  it('should check revivify time limits', () => {
    const corpse = createCorpse(mockCharacter, 10);

    // 5 rounds later (within 1 min)
    expect(canRevivify(corpse, 15)).toBe(true);

    // 10 rounds later (exactly 1 min)
    expect(canRevivify(corpse, 20)).toBe(true);

    // 11 rounds later (too late)
    expect(canRevivify(corpse, 21)).toBe(false);
  });
});
