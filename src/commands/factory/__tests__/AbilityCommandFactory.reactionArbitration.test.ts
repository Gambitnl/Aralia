import { describe, expect, it, vi } from 'vitest';
import { createMockCombatCharacter, createMockCombatState, AbilityCommandFactory } from './AbilityCommandFactory.testHelpers';
import type { Ability, GameState, Spell } from './AbilityCommandFactory.testHelpers';

// ============================================================================
// Reaction Arbitration Fallbacks (G4)
// ============================================================================
// The defensive when-hit reaction prompt is the ability path's arbitration
// point: the runtime asks an arbiter (player UI or AI) whether the just-hit
// target spends a reaction such as Shield. The Shield test above proves a valid
// "shield" choice cancels the hit. These cases pin the fallback branches so an
// absent arbiter, an empty option set, a declined (null) choice, or an unknown
// choice id each leave the triggering hit intact instead of silently eating it
// or throwing during resolution. All four share the same borderline roll: a
// bare 12 against AC 12 hits, and nothing but a real Shield cast should move it.
// ============================================================================

describe('AbilityCommandFactory reaction arbitration fallbacks', () => {
  const createShieldSpell = (): Spell => ({
    id: 'shield',
    name: 'Shield',
    level: 1,
    school: 'Abjuration',
    classes: ['Wizard'],
    description: 'A shimmering barrier appears.',
    castingTime: { value: 1, unit: 'reaction' },
    range: { type: 'self' },
    components: { verbal: true, somatic: true, material: false },
    duration: { type: 'timed', value: 1, unit: 'round', concentration: false },
    targeting: { type: 'self', validTargets: ['self'] },
    effects: [{
      type: 'DEFENSIVE',
      defenseType: 'ac_bonus',
      acBonus: 5,
      duration: { type: 'rounds', value: 1 },
      trigger: { type: 'immediate' },
      condition: { type: 'always' },
      reactionTrigger: { event: 'when_hit' }
    }]
  } as Spell);

  const createBorderlineAttacker = () => createMockCombatCharacter({
    id: 'fallback-attacker',
    name: 'Fallback Attacker',
    stats: { strength: 10, dexterity: 10 } as any,
    level: 1
  });

  const createShieldDefender = (abilities: any[]) => createMockCombatCharacter({
    id: 'fallback-defender',
    name: 'Fallback Defender',
    armorClass: 12,
    currentHP: 20,
    maxHP: 20,
    abilities,
    actionEconomy: {
      action: { used: false },
      bonusAction: { used: false },
      reaction: { used: false },
      movement: { used: 0, total: 30 }
    } as any,
    spellSlots: {
      level_1: { current: 1, max: 1 }
    } as any
  });

  const borderlineStrike: Ability = {
    id: 'borderline_strike',
    name: 'Borderline Strike',
    description: 'A hit that a defensive reaction could still stop.',
    type: 'attack',
    cost: { type: 'action' },
    targeting: 'single_enemy',
    range: 1,
    attackBonus: 0,
    effects: [{ type: 'damage', value: 4, damageType: 'slashing' }]
  };

  it('keeps the hit when the arbiter declines the reaction (null choice)', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.55);
    const attacker = createBorderlineAttacker();
    const shieldSpell = createShieldSpell();
    const defender = createShieldDefender([{ id: 'shield-ability', type: 'spell', spell: shieldSpell } as any]);
    const requestReaction = vi.fn().mockResolvedValue(null);

    const commands = AbilityCommandFactory.createCommands(
      borderlineStrike,
      attacker,
      [defender],
      {} as GameState,
      undefined,
      requestReaction
    );

    try {
      const result = await commands[0].execute(createMockCombatState({
        characters: [attacker, defender],
        combatLog: []
      }));
      const updatedDefender = result.characters.find(character => character.id === defender.id);

      // The arbiter is still consulted with the eligible Shield option, but
      // returning null (no reaction) must leave the hit intact: AC unchanged,
      // damage applied, and neither the reaction nor the spell slot spent.
      expect(requestReaction).toHaveBeenCalledWith(attacker.id, defender.id, 'on_hit', [shieldSpell]);
      expect(updatedDefender?.armorClass).toBe(12);
      expect(updatedDefender?.currentHP).toBeLessThan(20);
      expect(updatedDefender?.actionEconomy.reaction.used).toBe(false);
      expect(updatedDefender?.spellSlots?.level_1.current).toBe(1);
      expect(result.combatLog.some(entry => entry.message.includes('turns the hit into a miss'))).toBe(false);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('keeps the hit when the arbiter returns an unknown reaction id', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.55);
    const attacker = createBorderlineAttacker();
    const shieldSpell = createShieldSpell();
    const defender = createShieldDefender([{ id: 'shield-ability', type: 'spell', spell: shieldSpell } as any]);
    const requestReaction = vi.fn().mockResolvedValue('not-a-real-reaction');

    const commands = AbilityCommandFactory.createCommands(
      borderlineStrike,
      attacker,
      [defender],
      {} as GameState,
      undefined,
      requestReaction
    );

    try {
      const result = await commands[0].execute(createMockCombatState({
        characters: [attacker, defender],
        combatLog: []
      }));
      const updatedDefender = result.characters.find(character => character.id === defender.id);

      // An id that does not match any offered reaction is a malformed arbiter
      // answer. It must be treated as "no reaction" rather than crashing or
      // partially spending resources, so the hit stands exactly as if declined.
      expect(requestReaction).toHaveBeenCalledWith(attacker.id, defender.id, 'on_hit', [shieldSpell]);
      expect(updatedDefender?.armorClass).toBe(12);
      expect(updatedDefender?.currentHP).toBeLessThan(20);
      expect(updatedDefender?.actionEconomy.reaction.used).toBe(false);
      expect(updatedDefender?.spellSlots?.level_1.current).toBe(1);
      expect(result.combatLog.some(entry => entry.message.includes('turns the hit into a miss'))).toBe(false);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('does not consult the arbiter when the target has no eligible reaction', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.55);
    const attacker = createBorderlineAttacker();
    const defender = createShieldDefender([]);
    const requestReaction = vi.fn().mockResolvedValue('shield');

    const commands = AbilityCommandFactory.createCommands(
      borderlineStrike,
      attacker,
      [defender],
      {} as GameState,
      undefined,
      requestReaction
    );

    try {
      const result = await commands[0].execute(createMockCombatState({
        characters: [attacker, defender],
        combatLog: []
      }));
      const updatedDefender = result.characters.find(character => character.id === defender.id);

      // With no when-hit reaction spell available, the arbiter must not be
      // prompted at all. A stray "shield" answer cannot conjure a reaction the
      // defender never had, so the hit resolves normally.
      expect(requestReaction).not.toHaveBeenCalled();
      expect(updatedDefender?.armorClass).toBe(12);
      expect(updatedDefender?.currentHP).toBeLessThan(20);
      expect(updatedDefender?.actionEconomy.reaction.used).toBe(false);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('keeps the hit when no arbiter is provided even though the target could react', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.55);
    const attacker = createBorderlineAttacker();
    const shieldSpell = createShieldSpell();
    const defender = createShieldDefender([{ id: 'shield-ability', type: 'spell', spell: shieldSpell } as any]);

    // createCommands is called without the requestReaction arbiter, matching a
    // runtime path (such as an automated or headless resolve) that has no way
    // to prompt for reactions.
    const commands = AbilityCommandFactory.createCommands(
      borderlineStrike,
      attacker,
      [defender],
      {} as GameState
    );

    try {
      const result = await commands[0].execute(createMockCombatState({
        characters: [attacker, defender],
        combatLog: []
      }));
      const updatedDefender = result.characters.find(character => character.id === defender.id);

      // No arbiter means the reaction window is skipped entirely: the target
      // keeps its base AC, takes the damage, and its reaction and spell slot
      // remain available for later use.
      expect(updatedDefender?.armorClass).toBe(12);
      expect(updatedDefender?.currentHP).toBeLessThan(20);
      expect(updatedDefender?.actionEconomy.reaction.used).toBe(false);
      expect(updatedDefender?.spellSlots?.level_1.current).toBe(1);
      expect(result.combatLog.some(entry => entry.message.includes('turns the hit into a miss'))).toBe(false);
    } finally {
      randomSpy.mockRestore();
    }
  });
});
