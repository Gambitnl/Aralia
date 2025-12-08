import { describe, expect, it } from 'vitest';
import { StatusConditionCommand } from '../effects/StatusConditionCommand';
import type { CommandContext } from '../base/SpellCommand';
import type { CombatCharacter, CombatState, Position } from '@/types/combat';
import type { StatusConditionEffect } from '@/types/spells';

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
  movement: { used: 0, total: 30 },
  freeActions: 0
};

const makeCharacter = (id: string, position: Position): CombatCharacter => ({
  id,
  name: id,
  level: 3,
  class: { savingThrowProficiencies: [] } as any,
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
  combatLog: []
});

const makeContext = (caster: CombatCharacter, targets: CombatCharacter[]): CommandContext => ({
  spellId: 'test-condition',
  spellName: 'Test Condition',
  castAtLevel: 1,
  caster,
  targets,
  gameState: {} as any
});

describe('StatusConditionCommand', () => {
  it('applies conditions and mirrors them to statusEffects', () => {
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
    const result = command.execute(state);

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

  it('refreshes an existing condition instead of stacking duplicates', () => {
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
    const firstResult = command.execute(baseState);

    const secondState: CombatState = {
      ...firstResult,
      turnState: { ...firstResult.turnState, currentTurn: 3 }
    };

    const secondResult = command.execute(secondState);
    const updated = secondResult.characters.find(c => c.id === 'target');

    expect(updated?.conditions).toHaveLength(1);
    expect(updated?.conditions?.[0]?.appliedTurn).toBe(3);
    expect(updated?.statusEffects).toHaveLength(1);
    expect(updated?.statusEffects[0]?.duration).toBe(1);
  });
});
