import { describe, expect, it } from 'vitest';
import { StatusConditionCommand } from '../effects/StatusConditionCommand';
import type { CommandContext } from '../base/SpellCommand';
import type { CombatCharacter, CombatState, Position } from '@/types/combat';
import type { StatusConditionEffect } from '@/types/spells';
import type { Class, GameState } from '@/types';
import { createMockGameState, createMockPlayerCharacter } from '../../utils/core';
import powerWordPain from '@/data/spells/level-7/power-word-pain.json';

/**
 * This file proves that status-condition commands apply, log, and refresh
 * conditions without duplicating them.
 *
 * It builds complete combat and command fixtures locally, then exercises the
 * same asynchronous command path used by live spell execution.
 */

// ============================================================================
// Combat Fixtures
// ============================================================================
// These shared values provide the smallest complete character, state, and spell
// context needed by every status-condition behavior below.
// ============================================================================

const baseStats = {
  strength: 10,
  dexterity: 12,
  constitution: 12,
  intelligence: 10,
  wisdom: 10,
  charisma: 8,
  baseInitiative: 0,
  speed: 30,
  cr: '0'
};

const baseEconomy = {
  action: { used: false, remaining: 1 },
  bonusAction: { used: false, remaining: 1 },
  reaction: { used: false, remaining: 1 },
  legendary: { used: 0, total: 0 },
  movement: { used: 0, total: 30 },
  freeActions: 0
};

const mockClass: Class = {
  id: 'fighter',
  name: 'Fighter',
  description: 'A martial combatant.',
  hitDie: 10,
  primaryAbility: ['Strength'],
  savingThrowProficiencies: ['Strength', 'Constitution'],
  skillProficienciesAvailable: [],
  numberOfSkillProficiencies: 2,
  armorProficiencies: [],
  weaponProficiencies: [],
  features: []
};

const makeCharacter = (id: string, position: Position): CombatCharacter => ({
  id,
  name: id,
  level: 3,
  class: mockClass,
  position,
  stats: { ...baseStats },
  abilities: [],
  team: 'player',
  currentHP: 12,
  maxHP: 12,
  initiative: 0,
  statusEffects: [],
  conditions: [],
  actionEconomy: { ...baseEconomy }
});

const makeState = (characters: CombatCharacter[]): CombatState => ({
  isActive: true,
  characters,
  turnState: {
    currentTurn: 1,
    turnOrder: characters.map(c => c.id),
    currentCharacterId: characters[0]?.id ?? null,
    phase: 'action',
    actionsThisTurn: []
  },
  selectedCharacterId: null,
  selectedAbilityId: null,
  actionMode: 'select',
  validTargets: [],
  validMoves: [],
  combatLog: [],
  reactiveTriggers: [],
  activeLightSources: []
});

const makeContext = (caster: CombatCharacter, targets: CombatCharacter[]): CommandContext => ({
  spellId: 'test-condition',
  spellName: 'Test Condition',
  castAtLevel: 1,
  caster,
  targets,
  gameState: createMockGameState({
    party: [caster, ...targets].map(character => ({
      ...createMockPlayerCharacter({ id: character.id, name: character.name }),
    })),
    currentLocationId: 'arena',

  }) as GameState
});

// ============================================================================
// Status-Condition Behavior
// ============================================================================
// Each test covers a player-visible rule: applying a condition, removing one,
// logging the change, or refreshing duration without stacking duplicates.
// ============================================================================

describe('StatusConditionCommand', () => {
  it('applies conditions and mirrors them to statusEffects', async () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 });
    const target = makeCharacter('target', { x: 1, y: 0 });
    const state = makeState([caster, target]);

    const effect: StatusConditionEffect = {
      type: 'STATUS_CONDITION',
      statusCondition: { name: 'Prone', duration: { type: 'rounds', value: 2 } },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    };

    const command = new StatusConditionCommand(effect, makeContext(caster, [target]));
    const result = await command.execute(state);

    const updated = result.characters.find(c => c.id === 'target');
    expect(updated?.conditions?.[0]?.name).toBe('Prone');
    expect(updated?.conditions?.[0]?.duration).toEqual({ type: 'rounds', value: 2 });
    expect(updated?.conditions?.[0]?.appliedTurn).toBe(1);
    expect(updated?.conditions?.[0]?.source).toBe('Test Condition');

    expect(updated?.statusEffects).toHaveLength(1);
    expect(updated?.statusEffects[0]?.name).toBe('Prone');
    expect(updated?.statusEffects[0]?.duration).toBe(2);

    const lastLog = result.combatLog.at(-1);
    expect(lastLog?.message).toContain('Prone');
  });

  it('refreshes an existing condition instead of stacking duplicates', async () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 });
    const target = makeCharacter('target', { x: 1, y: 0 });
    const baseState = makeState([caster, target]);

    const effect: StatusConditionEffect = {
      type: 'STATUS_CONDITION',
      statusCondition: { name: 'Prone', duration: { type: 'rounds', value: 1 } },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    };

    const command = new StatusConditionCommand(effect, makeContext(caster, [target]));
    // The command can resolve follow-up saves and reactions asynchronously, so
    // wait for the completed combat state before using it as the next cast input.
    const firstResult = await command.execute(baseState);

    const secondState: CombatState = {
      ...firstResult,
      turnState: { ...firstResult.turnState, currentTurn: 3 }
    };

    const secondResult = await command.execute(secondState);
    const updated = secondResult.characters.find(c => c.id === 'target');

    expect(updated?.conditions).toHaveLength(1);
    expect(updated?.conditions?.[0]?.appliedTurn).toBe(3);
    expect(updated?.statusEffects).toHaveLength(1);
    expect(updated?.statusEffects[0]?.duration).toBe(1);
  });

  it('preserves an end-of-current-turn boundary without flattening it to a round', async () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 });
    const target = makeCharacter('target', { x: 1, y: 0 });
    const baseState = makeState([caster, target]);
    const state: CombatState = {
      ...baseState,
      turnState: { ...baseState.turnState, currentCharacterId: target.id }
    };
    const effect: StatusConditionEffect = {
      type: 'STATUS_CONDITION',
      statusCondition: {
        name: 'Poisoned',
        duration: { type: 'until_end_of_current_turn', value: 0 }
      },
      trigger: { type: 'turn_start' },
      condition: { type: 'always' }
    };

    // Stinking Cloud applies during the affected creature's turn. The command
    // keeps the authored boundary and schedules its first turn end for expiry.
    const result = await new StatusConditionCommand(effect, makeContext(caster, [target])).execute(state);
    const updated = result.characters.find(character => character.id === target.id);

    expect(updated?.conditions?.[0]?.duration).toEqual({ type: 'until_end_of_current_turn', value: 0 });
    expect(updated?.conditions?.[0]?.turnEndEventsRemaining).toBe(1);
    expect(updated?.statusEffects[0]?.duration).toBe(1);
  });

  it('keeps a next-turn boundary beyond the target current turn end', async () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 });
    const target = makeCharacter('target', { x: 1, y: 0 });
    const baseState = makeState([target, caster]);
    const state: CombatState = {
      ...baseState,
      turnState: { ...baseState.turnState, currentCharacterId: target.id }
    };
    const effect: StatusConditionEffect = {
      type: 'STATUS_CONDITION',
      statusCondition: { name: 'Blinded', duration: { type: 'turn_end', value: 1 } },
      trigger: { type: 'on_attack_hit' },
      condition: { type: 'always' }
    };

    // Holy Aura can blind an attacker during its own turn. The current turn
    // end consumes the first boundary and the condition ends on the next one.
    const result = await new StatusConditionCommand(effect, makeContext(caster, [target])).execute(state);
    const updated = result.characters.find(character => character.id === target.id);

    expect(updated?.conditions?.[0]?.duration).toEqual({ type: 'turn_end', value: 1 });
    expect(updated?.conditions?.[0]?.turnEndEventsRemaining).toBe(2);
  });

  it('preserves Power Word Pain on-target-cast saves as a pre-cast restriction', async () => {
    const caster = makeCharacter('pain-caster', { x: 0, y: 0 });
    const target = makeCharacter('pain-target', { x: 1, y: 0 });
    const state = makeState([caster, target]);
    const effect = powerWordPain.effects.find(candidate =>
      candidate.type === 'STATUS_CONDITION' && candidate.statusCondition?.name === 'Crippling Pain'
    ) as unknown as StatusConditionEffect;
    const context = {
      ...makeContext(caster, [target]),
      spellId: powerWordPain.id,
      spellName: powerWordPain.name
    };

    const result = await new StatusConditionCommand(effect, context).execute(state);
    const updated = result.characters.find(character => character.id === target.id);

    expect(updated?.statusEffects[0]?.spellcastingRestriction).toEqual(expect.objectContaining({
      saveType: 'Constitution',
      dc: expect.any(Number),
      successOutcome: 'spell_casting_continues',
      failureOutcome: 'casting_fails_and_spell_is_wasted'
    }));
    expect(updated?.conditions?.[0]?.spellcastingRestriction).toEqual(
      updated?.statusEffects[0]?.spellcastingRestriction
    );
  });
});
