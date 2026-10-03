import { describe, expect, it, vi } from 'vitest';
import { createMockCombatCharacter, createMockCombatState, AbilityCommandFactory } from './AbilityCommandFactory.testHelpers';
import type { Ability, GameState, Spell } from './AbilityCommandFactory.testHelpers';

// agora-f821.4: this file pins Math.random to make a roll deterministic. Game rolls now
// run on the audit log's own seed stream, so the pin only reaches them
// through the roller's supported injected-source seam. Feeding
// Math.random in as that source keeps every pin below meaning what it
// meant before the migration.
vi.mock('../../../systems/dice/rollers', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../systems/dice/rollers')>()
  return {
    ...actual,
    rollDice: (notation: string, options: { rng?: () => number } = {}) =>
      actual.rollDice(notation, { ...options, rng: options.rng ?? Math.random }),
    rollD20: (options: { rng?: () => number } = {}) =>
      actual.rollD20({ ...options, rng: options.rng ?? Math.random }),
    rollDamage: (
      notation: string,
      isCritical: boolean,
      minRoll = 1,
      rng?: () => number,
    ) => actual.rollDamage(notation, isCritical, minRoll, rng ?? Math.random),
  }
})


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
  // ==========================================================================
  // Reaction Trigger Eligibility (SYS-6)
  // ==========================================================================
  // The fallback cases above all start from a spell that IS a legal when-hit
  // reaction and vary the arbiter's answer. These cases vary the spell and the
  // defender's resources instead, pinning the filter that decides whether the
  // arbiter is consulted at all. Every one of them must skip the prompt: an
  // over-eager filter would interrupt combat to offer a reaction the defender
  // cannot legally take.
  // ==========================================================================

  it('does not offer a defensive spell whose trigger event is not when_hit', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.55);
    const attacker = createBorderlineAttacker();
    // Same AC bonus and same reaction casting time as Shield, but it keys off
    // taking damage rather than being hit, so it cannot cancel this hit.
    const wrongTrigger = createShieldSpell();
    wrongTrigger.id = 'late-ward';
    wrongTrigger.name = 'Late Ward';
    (wrongTrigger.effects[0] as any).reactionTrigger = { event: 'when_damaged' };
    const defender = createShieldDefender([{ id: 'late-ward-ability', type: 'spell', spell: wrongTrigger } as any]);
    const requestReaction = vi.fn().mockResolvedValue('late-ward');

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

      expect(requestReaction).not.toHaveBeenCalled();
      expect(updatedDefender?.armorClass).toBe(12);
      expect(updatedDefender?.currentHP).toBeLessThan(20);
      expect(updatedDefender?.spellSlots?.level_1.current).toBe(1);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('does not offer a when-hit spell that is not cast as a reaction', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.55);
    const attacker = createBorderlineAttacker();
    // A one-action defensive buff carrying a when_hit rider is a buff, not a
    // reaction. Casting time is the gate, so it must never reach the arbiter.
    const actionCast = createShieldSpell();
    actionCast.id = 'slow-ward';
    actionCast.name = 'Slow Ward';
    (actionCast as any).castingTime = { value: 1, unit: 'action' };
    const defender = createShieldDefender([{ id: 'slow-ward-ability', type: 'spell', spell: actionCast } as any]);
    const requestReaction = vi.fn().mockResolvedValue('slow-ward');

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

      expect(requestReaction).not.toHaveBeenCalled();
      expect(updatedDefender?.armorClass).toBe(12);
      expect(updatedDefender?.currentHP).toBeLessThan(20);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('does not offer a legal reaction the defender can no longer afford', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.55);
    const attacker = createBorderlineAttacker();
    const shieldSpell = createShieldSpell();
    const defender = createShieldDefender([{ id: 'shield-ability', type: 'spell', spell: shieldSpell } as any]);
    // The defender already spent its reaction this round. The spell is still a
    // perfectly good Shield; the action economy is what disqualifies it.
    defender.actionEconomy.reaction.used = true;
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

      expect(requestReaction).not.toHaveBeenCalled();
      expect(updatedDefender?.armorClass).toBe(12);
      expect(updatedDefender?.currentHP).toBeLessThan(20);
      expect(updatedDefender?.spellSlots?.level_1.current).toBe(1);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('does not offer a reaction spell the defender has no slot for', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.55);
    const attacker = createBorderlineAttacker();
    const shieldSpell = createShieldSpell();
    const defender = createShieldDefender([{ id: 'shield-ability', type: 'spell', spell: shieldSpell } as any]);
    // Out of 1st-level slots: Shield stays on the sheet but cannot be cast, so
    // the reaction window must pass without a prompt.
    (defender.spellSlots as any).level_1 = { current: 0, max: 1 };
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

      expect(requestReaction).not.toHaveBeenCalled();
      expect(updatedDefender?.armorClass).toBe(12);
      expect(updatedDefender?.currentHP).toBeLessThan(20);
    } finally {
      randomSpy.mockRestore();
    }
  });
});
