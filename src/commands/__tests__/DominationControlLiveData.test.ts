import { describe, expect, it, vi } from 'vitest';
import { StatusConditionCommand } from '../effects/StatusConditionCommand';
import type { CommandContext } from '../base/SpellCommand';
import type { CombatCharacter, CombatState } from '../../types/combat';
import type { StatusConditionEffect } from '../../types/spells';
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '../../utils/factories';
import dominateBeast from '../../../public/data/spells/level-4/dominate-beast.json';
import dominatePerson from '../../../public/data/spells/level-5/dominate-person.json';
import dominateMonster from '../../../public/data/spells/level-8/dominate-monster.json';

/**
 * Dominate Beast, Dominate Person, and Dominate Monster control an existing
 * target instead of creating a new summon actor. This proof keeps their authored
 * command channel, Reaction cost, and idle behavior attached to the live Charmed
 * condition so later UI and AI work can consume the control relationship from
 * combat state.
 */

vi.mock('../../utils/savingThrowUtils', () => ({
  calculateSpellDC: vi.fn(() => 15),
  rollSavingThrow: vi.fn(() => ({
    roll: 2,
    modifier: 0,
    total: 2,
    dc: 15,
    success: false,
    modifiersApplied: []
  }))
}));

type DominationCase = {
  spell: typeof dominateBeast;
  targetType: string;
  entityType: string;
  idleBehavior: string;
  reactionCommand: string;
  hasCommandExamples: boolean;
};

const dominationCases: DominationCase[] = [
  {
    spell: dominateBeast,
    targetType: 'Beast',
    entityType: 'dominated_beast_target',
    idleBehavior: 'if order complete and no new command, acts and moves as it likes while protecting itself',
    reactionCommand: 'caster can command target Reaction by spending caster Reaction',
    hasCommandExamples: true
  },
  {
    spell: dominatePerson as unknown as typeof dominateBeast,
    targetType: 'Humanoid',
    entityType: 'dominated_humanoid_target',
    idleBehavior: 'acts and moves as it likes, focusing on self-protection, after completing command',
    reactionCommand: 'caster can command Reaction by spending caster Reaction',
    hasCommandExamples: false
  },
  {
    spell: dominateMonster as unknown as typeof dominateBeast,
    targetType: 'Dragon',
    entityType: 'dominated_creature_target',
    idleBehavior: 'acts and moves as it likes, focusing on self-protection, after completing command',
    reactionCommand: 'caster can command Reaction by spending caster Reaction',
    hasCommandExamples: false
  }
];

describe('Domination control live data bridge', () => {
  it.each(dominationCases)('preserves $spell.name command metadata on the Charmed target', async ({
    spell,
    targetType,
    entityType,
    idleBehavior,
    reactionCommand,
    hasCommandExamples
  }) => {
    const caster = createMockCombatCharacter({
      id: `${spell.id}-caster`,
      name: `${spell.name} Caster`,
      stats: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 18,
        baseInitiative: 0,
        speed: 30,
        cr: '1'
      }
    }) as CombatCharacter;
    const target = createMockCombatCharacter({
      id: `${spell.id}-target`,
      name: `${spell.name} Target`,
      creatureTypes: [targetType],
      conditions: [],
      statusEffects: []
    }) as CombatCharacter;
    const effect = spell.effects.find(candidate =>
      candidate.type === 'STATUS_CONDITION' ||
      (candidate.type === 'UTILITY' && 'statusCondition' in candidate)
    ) as unknown as StatusConditionEffect;
    const context = {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: spell.level,
      caster,
      targets: [target],
      gameState: createMockGameState(),
      effectDuration: spell.duration
    } as CommandContext;
    const state = createMockCombatState({
      characters: [caster, target],
      turnState: {
        currentTurn: 3,
        currentCharacterId: caster.id,
        turnOrder: [caster.id, target.id],
        phase: 'action',
        actionsThisTurn: []
      }
    }) as CombatState;

    const afterCast = await new StatusConditionCommand(effect, context).execute(state);
    const updatedTarget = afterCast.characters.find(character => character.id === target.id);
    const charmedStatus = updatedTarget?.statusEffects.find(status => status.name === 'Charmed');
    const charmedCondition = updatedTarget?.conditions?.find(condition => condition.name === 'Charmed');

    expect(charmedStatus?.dominationControl).toEqual(expect.objectContaining({
      entityType,
      summonsNewEntity: false,
      controlChannel: 'same-plane telepathic link',
      commandAction: 'no action on caster turn',
      obedience: 'target does its best to obey on its turn',
      idleBehavior,
      reactionCommand,
      telepathicLink: expect.objectContaining({
        requiresSamePlane: true,
        actionCost: 'none'
      }),
      reaction: expect.objectContaining({
        requiresCasterReaction: true
      })
    }));
    if (hasCommandExamples) {
      expect(charmedStatus?.dominationControl?.commands).toEqual(expect.arrayContaining([
        'Attack that creature',
        'Move over there',
        'Fetch that object'
      ]));
    }
    expect(charmedCondition?.dominationControl).toEqual(charmedStatus?.dominationControl);
  });
});
