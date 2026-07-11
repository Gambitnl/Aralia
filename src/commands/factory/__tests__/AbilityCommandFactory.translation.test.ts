import { describe, expect, it, vi } from 'vitest';
import { createMockCombatCharacter, createMockCombatState, AbilityCommandFactory, WeaponAttackCommand, DismissFamiliarToPocketCommand, RecallFamiliarFromPocketCommand, CommandedSummonCommand } from './AbilityCommandFactory.testHelpers';
import type { Ability, GameState, Spell } from './AbilityCommandFactory.testHelpers';

// ============================================================================
// Ability Translation
// ============================================================================
// This section keeps non-attack actions from accidentally re-entering the weapon
// attack path while preserving command support for true attacks and direct
// non-attack effects like healing.
// ============================================================================

describe('AbilityCommandFactory', () => {
  it('creates a weapon attack command for attack abilities', () => {
    const attacker = createMockCombatCharacter({ id: 'attacker', name: 'Attacker' });
    const target = createMockCombatCharacter({ id: 'target', name: 'Target' });
    const attack: Ability = {
      id: 'basic_attack',
      name: 'Basic Attack',
      description: 'A normal melee strike.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 1,
      effects: [{ type: 'damage', value: 4, damageType: 'physical' }]
    };

    // Real attacks should still roll through WeaponAttackCommand so hit/miss,
    // cover, riders, and damage command behavior stay centralized.
    const commands = AbilityCommandFactory.createCommands(attack, attacker, [target], {} as any);

    expect(commands).toHaveLength(1);
    expect(commands[0]).toBeInstanceOf(WeaponAttackCommand);
  });

  it('lets Shield turn a just-hit weapon attack into a miss before damage resolves', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.55);
    const attacker = createMockCombatCharacter({
      id: 'shield-attacker',
      name: 'Shield Attacker',
      stats: { strength: 10, dexterity: 10 } as any,
      level: 1
    });
    const shieldSpell: Spell = {
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
    } as Spell;
    const defender = createMockCombatCharacter({
      id: 'shield-defender',
      name: 'Shield Defender',
      armorClass: 12,
      currentHP: 20,
      maxHP: 20,
      abilities: [{ id: 'shield-ability', type: 'spell', spell: shieldSpell } as any],
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
    const attack: Ability = {
      id: 'borderline_strike',
      name: 'Borderline Strike',
      description: 'A hit that Shield can still stop.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 1,
      attackBonus: 0,
      effects: [{ type: 'damage', value: 4, damageType: 'slashing' }]
    };
    const requestReaction = vi.fn().mockResolvedValue('shield');
    const commands = AbilityCommandFactory.createCommands(
      attack,
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

      // The attack roll is 12 against AC 12, so it initially hits. Shield
      // raises the target to AC 17 before damage commands run, proving the
      // defensive reaction changes the triggering hit outcome instead of only
      // adding AC after damage has already landed.
      expect(requestReaction).toHaveBeenCalledWith(attacker.id, defender.id, 'on_hit', [shieldSpell]);
      expect(updatedDefender?.currentHP).toBe(20);
      expect(updatedDefender?.armorClass).toBe(17);
      expect(updatedDefender?.actionEconomy.reaction.used).toBe(true);
      expect(updatedDefender?.spellSlots?.level_1.current).toBe(0);
      expect(result.combatLog.some(entry => entry.message.includes('turns the hit into a miss'))).toBe(true);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('ends Friends early when its caster makes a weapon attack roll', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    try {
      const attacker = createMockCombatCharacter({
        id: 'friends-caster',
        name: 'Friends Caster',
        concentratingOn: {
          spellId: 'friends',
          spellName: 'Friends',
          spellLevel: 0,
          startedTurn: 1,
          effectIds: ['friends-charm-status'],
          canDropAsFreeAction: true
        }
      });
      const charmedTarget = createMockCombatCharacter({
        id: 'friends-target',
        name: 'Friends Target',
        conditions: [{ name: 'Charmed', duration: { type: 'minutes', value: 1 }, appliedTurn: 1, source: 'Friends', sourceCasterId: attacker.id }],
        statusEffects: [{
          id: 'friends-charm-status',
          name: 'Charmed',
          type: 'debuff',
          duration: 10,
          source: 'Friends',
          sourceCasterId: attacker.id,
          socialLifecycle: { kind: 'friends_charm', targetKnowsOnEnd: true, recastMemoryDurationRounds: 14400 }
        }]
      });
      const attackTarget = createMockCombatCharacter({
        id: 'attack-target',
        name: 'Attack Target',
        armorClass: 30,
        currentHP: 20,
        maxHP: 20
      });
      const attack: Ability = {
        id: 'basic_attack',
        name: 'Basic Attack',
        description: 'A normal melee strike.',
        type: 'attack',
        cost: { type: 'action' },
        targeting: 'single_enemy',
        range: 1,
        effects: [{ type: 'damage', value: 4, damageType: 'physical' }]
      };
      const commands = AbilityCommandFactory.createCommands(attack, attacker, [attackTarget], {} as GameState);
      const state = createMockCombatState({
        characters: [attacker, charmedTarget, attackTarget],
        turnState: {
          currentTurn: 2,
          turnOrder: [attacker.id, charmedTarget.id, attackTarget.id],
          currentCharacterId: attacker.id,
          phase: 'action',
          actionsThisTurn: []
        },
        combatLog: []
      });

      const result = await commands[0].execute(state);
      const updatedAttacker = result.characters.find(character => character.id === attacker.id);
      const updatedCharmedTarget = result.characters.find(character => character.id === charmedTarget.id);

      expect(updatedAttacker?.concentratingOn).toBeUndefined();
      expect(updatedCharmedTarget?.statusEffects.some(effect => effect.name === 'Charmed')).toBe(false);
      expect(updatedCharmedTarget?.socialAwareness?.some(entry =>
        entry.sourceSpellId === 'friends' &&
        entry.casterId === attacker.id
      )).toBe(true);
      expect(result.combatLog.some(entry => entry.data?.earlyEndReason === 'caster_makes_attack_roll')).toBe(true);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('does not create an attack command for Dash movement', () => {
    const actor = createMockCombatCharacter({ id: 'actor', name: 'Actor' });
    const dash: Ability = {
      id: 'dash',
      name: 'Dash',
      description: 'Gain extra movement for the turn.',
      type: 'movement',
      cost: { type: 'action' },
      targeting: 'self',
      range: 0,
      effects: [{ type: 'movement', value: 30 }]
    };

    // Dash is resolved by useActionExecutor because it changes movement economy
    // for the current turn. Returning no command prevents the old self-attack.
    const commands = AbilityCommandFactory.createCommands(dash, actor, [actor], {} as any);

    expect(commands).toHaveLength(0);
  });

  it('keeps direct healing effects on the command path', () => {
    const actor = createMockCombatCharacter({ id: 'actor', name: 'Actor' });
    const secondWind: Ability = {
      id: 'second_wind',
      name: 'Second Wind',
      description: 'Regain hit points.',
      type: 'utility',
      cost: { type: 'bonus' },
      targeting: 'self',
      range: 0,
      effects: [{ type: 'heal', value: 11 }]
    };

    // Non-attack utility effects still use commands when they have a concrete
    // command-side effect. This preserves future class-feature behavior while
    // removing the accidental weapon attack.
    const commands = AbilityCommandFactory.createCommands(secondWind, actor, [actor], {} as any);

    expect(commands).toHaveLength(1);
    expect(commands[0].metadata.effectType).toBe('HEALING');
  });

  it('uses the source spell id when creating familiar pocket commands', () => {
    const actor = createMockCombatCharacter({ id: 'actor', name: 'Actor' });
    const dismissFamiliar: Ability = {
      id: 'familiar_dismiss_find-familiar',
      sourceSpellId: 'find-familiar',
      name: 'Dismiss Familiar',
      description: 'Dismiss the familiar created by Find Familiar.',
      type: 'utility',
      cost: { type: 'action' },
      targeting: 'self',
      range: 0,
      effects: [{ type: 'familiar_pocket', familiarPocketAction: 'dismiss' }]
    };
    const recallFamiliar: Ability = {
      ...dismissFamiliar,
      id: 'familiar_recall_find-familiar',
      name: 'Recall Familiar',
      effects: [{ type: 'familiar_pocket', familiarPocketAction: 'recall' }]
    };

    const dismissCommands = AbilityCommandFactory.createCommands(dismissFamiliar, actor, [actor], {} as any);
    const recallCommands = AbilityCommandFactory.createCommands(recallFamiliar, actor, [actor], {} as any);

    // The familiar pocket commands compare their context spell id against
    // summonMetadata.spellId. The generated ability button has a different id,
    // so the factory must preserve the source spell id or the runtime button
    // cannot find its own familiar.
    expect(dismissCommands[0]).toBeInstanceOf(DismissFamiliarToPocketCommand);
    expect(dismissCommands[0].metadata.spellId).toBe('find-familiar');
    expect(recallCommands[0]).toBeInstanceOf(RecallFamiliarFromPocketCommand);
    expect(recallCommands[0].metadata.spellId).toBe('find-familiar');
  });

  it('places commanded-summon gates before summon attack commands', () => {
    const summon = createMockCombatCharacter({
      id: 'summon-beast',
      name: 'Bestial Spirit',
      isSummon: true,
      summonMetadata: {
        casterId: 'druid',
        spellId: 'summon-beast',
        sourceName: 'Summon Beast',
        commandCost: 'bonus_action',
        commandsPerTurn: 1,
        commandsUsedThisTurn: 0,
        dismissable: false
      }
    });
    const target = createMockCombatCharacter({ id: 'target', name: 'Target' });
    const rend: Ability = {
      id: 'summon_beast_rend',
      sourceSpellId: 'summon-beast',
      name: 'Rend',
      description: 'The spirit attacks after being commanded.',
      type: 'attack',
      cost: { type: 'bonus' },
      targeting: 'single_enemy',
      range: 1,
      effects: [
        { type: 'commanded_summon', commandedSummonAction: 'issue_command', summonCommandDescription: 'The spirit attacks after being commanded.' },
        { type: 'damage', dice: '1d8', damageType: 'physical' }
      ]
    };

    // Summon attacks are still attacks, but they must first spend the
    // spell-authored command budget. This protects Summon Beast / Conjure Fey
    // style actions from bypassing the controlled-entity cadence.
    const commands = AbilityCommandFactory.createCommands(rend, summon, [target], {} as any);

    expect(commands).toHaveLength(2);
    expect(commands[0]).toBeInstanceOf(CommandedSummonCommand);
    expect(commands[1]).toBeInstanceOf(WeaponAttackCommand);
  });

  it('blocks summon attack commands after the command budget is spent', () => {
    const summon = createMockCombatCharacter({
      id: 'summon-beast',
      name: 'Bestial Spirit',
      isSummon: true,
      summonMetadata: {
        casterId: 'druid',
        spellId: 'summon-beast',
        sourceName: 'Summon Beast',
        commandCost: 'bonus_action',
        commandsPerTurn: 1,
        commandsUsedThisTurn: 1,
        dismissable: false
      }
    });
    const target = createMockCombatCharacter({ id: 'target', name: 'Target' });
    const rend: Ability = {
      id: 'summon_beast_rend',
      sourceSpellId: 'summon-beast',
      name: 'Rend',
      description: 'The spirit attacks after being commanded.',
      type: 'attack',
      cost: { type: 'bonus' },
      targeting: 'single_enemy',
      range: 1,
      effects: [
        { type: 'commanded_summon', commandedSummonAction: 'issue_command', summonCommandDescription: 'The spirit attacks after being commanded.' },
        { type: 'damage', dice: '1d8', damageType: 'physical' }
      ]
    };

    // Once the summon has spent its allowed command, only the command gate is
    // returned. The gate logs the rejection; damage/attack commands are not
    // created, so over-budget summon actions cannot leak their later effects.
    const commands = AbilityCommandFactory.createCommands(rend, summon, [target], {} as any);

    expect(commands).toHaveLength(1);
    expect(commands[0]).toBeInstanceOf(CommandedSummonCommand);
  });
});
