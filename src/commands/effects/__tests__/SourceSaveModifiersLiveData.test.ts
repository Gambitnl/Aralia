/**
 * This file proves that live spell save-modifier data reaches combat rolls.
 *
 * The tests load authored spell JSON rather than rebuilding its modifier shape.
 * They cover status saves for fighting-target Advantage, damage saves for
 * creature-conditioned Disadvantage, and the factory normalization used by a
 * utility-shaped domination row. A final guard confirms unknown prose is not
 * interpreted as a rule.
 *
 * Exercises: StatusConditionCommand, DamageCommand, and the shared source save
 * modifier resolver.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusConditionCommand } from '../StatusConditionCommand';
import { DamageCommand } from '../DamageCommand';
import { SpellCommandFactory } from '../../factory/SpellCommandFactory';
import type { CommandContext } from '../../base/SpellCommand';
import type { CombatCharacter, CombatState } from '@/types/combat';
import type { DamageEffect, Spell, StatusConditionEffect } from '@/types/spells';
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/core';
import { resolveSourceSaveAdvantageModifiers } from '@/systems/spells/mechanics/sourceSaveModifierResolution';
import * as combatUtils from '@/utils/combat/combatUtils';
import charmPerson from '@/data/spells/level-1/charm-person.json';
import shatter from '@/data/spells/level-2/shatter.json';
import fastFriends from '@/data/spells/level-3/fast-friends.json';
import charmMonster from '@/data/spells/level-4/charm-monster.json';
import dominateBeast from '@/data/spells/level-4/dominate-beast.json';
import dominatePerson from '@/data/spells/level-5/dominate-person.json';
import modifyMemory from '@/data/spells/level-5/modify-memory.json';
import dominateMonster from '@/data/spells/level-8/dominate-monster.json';

// The shared save roller and damage command both use this module. Mocking its
// dice functions lets each test prove whether one or two d20s were requested.
vi.mock('@/utils/combat/combatUtils', async importOriginal => {
  const actual = await importOriginal<typeof import('@/utils/combat/combatUtils')>();
  return {
    ...actual,
    rollDice: vi.fn(),
    rollDamage: vi.fn()
  };
});

/** Build a combatant with neutral saving-throw modifiers and an explicit side. */
const makeCharacter = (
  id: string,
  team: CombatCharacter['team'],
  overrides: Partial<CombatCharacter> = {}
): CombatCharacter => createMockCombatCharacter({
  id,
  name: id,
  team,
  creatureTypes: ['Humanoid'],
  conditions: [],
  statusEffects: [],
  ...overrides
});

/** Build the command envelope used by both live-data effect commands. */
const makeContext = (
  spellId: string,
  spellName: string,
  caster: CombatCharacter,
  target: CombatCharacter
): CommandContext => ({
  spellId,
  spellName,
  caster,
  targets: [target],
  castAtLevel: 5,
  gameState: createMockGameState()
});

/** Build the smallest state needed to execute one spell effect. */
const makeState = (caster: CombatCharacter, target: CombatCharacter): CombatState => (
  createMockCombatState({
    characters: [caster, target],
    combatLog: [],
    turnState: {
      currentTurn: 1,
      currentCharacterId: caster.id,
      turnOrder: [caster.id, target.id],
      phase: 'planning',
      actionsThisTurn: []
    }
  })
);

describe('source-backed spell save modifiers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(combatUtils.rollDamage).mockReturnValue(8);
  });

  it('keeps every fighting-rule save modifier on an explicit runtime predicate', () => {
    const fightingRuleSpells = [
      charmPerson,
      fastFriends,
      charmMonster,
      dominateBeast,
      dominatePerson,
      modifyMemory,
      dominateMonster
    ] as unknown as Spell[];
    const fightingModifiers = fightingRuleSpells.flatMap(spell => (
      spell.effects.flatMap(effect => effect.condition.saveModifiers ?? [])
    ));

    // Seven spells contain eight rows because Modify Memory applies the same
    // initial-save rule to both of its paired condition effects.
    expect(fightingModifiers).toHaveLength(8);
    expect(fightingModifiers.map(modifier => modifier.condition)).toEqual([
      'caster_or_allies_fighting_target',
      'caster_or_companions_fighting_target',
      'caster_or_allies_fighting_target',
      'caster_or_allies_fighting_target',
      'caster_or_allies_fighting_target',
      'caster_fighting_target',
      'caster_fighting_target',
      'caster_or_allies_fighting_target'
    ]);
  });

  it('gives an opposing Charm Person target Advantage from the explicit fighting predicate', async () => {
    const caster = makeCharacter('caster', 'player');
    const target = makeCharacter('target', 'enemy');
    const effect = charmPerson.effects.find(candidate => (
      candidate.type === 'STATUS_CONDITION' && candidate.statusCondition?.name === 'Charmed'
    )) as StatusConditionEffect;

    // The first result fails and the second succeeds. The target can resist only
    // if the live fighting predicate reaches the shared Advantage roll.
    vi.mocked(combatUtils.rollDice)
      .mockReturnValueOnce(2)
      .mockReturnValueOnce(20);

    const result = await new StatusConditionCommand(
      effect,
      makeContext(charmPerson.id, charmPerson.name, caster, target)
    ).execute(makeState(caster, target));
    const liveTarget = result.characters.find(character => character.id === target.id)!;

    expect(combatUtils.rollDice).toHaveBeenCalledTimes(2);
    expect(liveTarget.conditions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Charmed' })])
    );
  });

  it('does not grant Charm Person Advantage when the caster and target share a side', async () => {
    const caster = makeCharacter('caster', 'player');
    const target = makeCharacter('target', 'player');
    const effect = charmPerson.effects.find(candidate => (
      candidate.type === 'STATUS_CONDITION' && candidate.statusCondition?.name === 'Charmed'
    )) as StatusConditionEffect;

    vi.mocked(combatUtils.rollDice).mockReturnValue(2);

    const result = await new StatusConditionCommand(
      effect,
      makeContext(charmPerson.id, charmPerson.name, caster, target)
    ).execute(makeState(caster, target));
    const liveTarget = result.characters.find(character => character.id === target.id)!;

    expect(combatUtils.rollDice).toHaveBeenCalledTimes(1);
    expect(liveTarget.conditions).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Charmed' })])
    );
  });

  it('routes live Dominate Person control through its Wisdom save and fighting Advantage', async () => {
    const caster = makeCharacter('caster', 'player');
    const target = makeCharacter('target', 'enemy');

    // The utility-shaped source row must become a StatusConditionCommand before
    // execution. A failed first die and successful second die then prove the
    // normalized fighting predicate reaches that real factory-built boundary.
    vi.mocked(combatUtils.rollDice)
      .mockReturnValueOnce(2)
      .mockReturnValueOnce(20);

    const commands = await SpellCommandFactory.createCommands(
      dominatePerson as unknown as Spell,
      caster,
      [target],
      dominatePerson.level,
      createMockGameState()
    );
    const statusCommand = commands.find(command => command instanceof StatusConditionCommand);

    expect(statusCommand).toBeDefined();
    const result = await statusCommand!.execute(makeState(caster, target));
    const liveTarget = result.characters.find(character => character.id === target.id)!;

    expect(combatUtils.rollDice).toHaveBeenCalledTimes(2);
    expect(liveTarget.conditions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Charmed' })])
    );
  });

  it('applies Shatter Disadvantage only to the authored Construct target family', async () => {
    const caster = makeCharacter('caster', 'player');
    const construct = makeCharacter('construct', 'enemy', { creatureTypes: ['Construct'] });
    const humanoid = makeCharacter('humanoid', 'enemy');
    const effect = shatter.effects.find(candidate => candidate.type === 'DAMAGE') as DamageEffect;

    // A natural 20 followed by a 1 proves Disadvantage: the Construct takes the
    // full eight damage, while the Humanoid uses one successful roll and takes half.
    vi.mocked(combatUtils.rollDice)
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(1);
    const constructResult = await new DamageCommand(
      effect,
      makeContext(shatter.id, shatter.name, caster, construct)
    ).execute(makeState(caster, construct));

    expect(combatUtils.rollDice).toHaveBeenCalledTimes(2);
    expect(constructResult.characters.find(character => character.id === construct.id)?.currentHP)
      .toBe(construct.currentHP - 8);

    vi.mocked(combatUtils.rollDice).mockClear();
    vi.mocked(combatUtils.rollDice).mockReturnValue(20);
    const humanoidResult = await new DamageCommand(
      effect,
      makeContext(shatter.id, shatter.name, caster, humanoid)
    ).execute(makeState(caster, humanoid));

    expect(combatUtils.rollDice).toHaveBeenCalledTimes(1);
    expect(humanoidResult.characters.find(character => character.id === humanoid.id)?.currentHP)
      .toBe(humanoid.currentHP - 4);
  });

  it('leaves unknown prose conditions inert', () => {
    const caster = makeCharacter('caster', 'player');
    const target = makeCharacter('target', 'enemy');

    expect(resolveSourceSaveAdvantageModifiers([{
      type: 'advantage',
      condition: 'The target has Advantage if some unmodeled narrative fact is true.'
    }], caster, target)).toEqual([]);
  });
});
