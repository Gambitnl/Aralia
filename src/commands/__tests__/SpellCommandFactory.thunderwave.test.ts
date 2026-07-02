import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpellCommandFactory } from '../factory/SpellCommandFactory';
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories';
import type { CombatCharacter } from '@/types/combat';
import type { Spell } from '@/types/spells';
import { rollSavingThrow } from '@/utils/character/savingThrowUtils';

vi.mock('@/utils/character/savingThrowUtils', async () => {
  const actual = await vi.importActual<typeof import('@/utils/character/savingThrowUtils')>('@/utils/character/savingThrowUtils');
  return {
    ...actual,
    rollSavingThrow: vi.fn()
  };
});

const makeThunderwaveSpell = (): Spell => ({
  id: 'thunderwave',
  name: 'Thunderwave',
  level: 1,
  school: 'Evocation',
  classes: ['Wizard'],
  subClasses: [],
  ritual: false,
  castingTime: { value: 1, unit: 'action' },
  range: { type: 'self', distance: 0 },
  components: { verbal: true, somatic: true, material: false },
  duration: { type: 'instantaneous', concentration: false },
  targeting: {
    type: 'area',
    validTargets: ['creatures'],
    lineOfSight: false,
    areaOfEffect: { shape: 'Cube', size: 15, sizeUnit: 'feet', height: 0 },
    range: 0,
    maxTargets: 1
  },
  effects: [
    {
      type: 'DAMAGE',
      trigger: { type: 'immediate', frequency: 'every_time', movementType: 'any' },
      condition: { type: 'save', saveType: 'Constitution', saveEffect: 'half' },
      damage: { dice: '2d8', type: 'Thunder' },
      scaling: { type: 'slot_level', bonusPerLevel: '+1d8' }
    },
    {
      type: 'UTILITY',
      trigger: { type: 'immediate', frequency: 'every_time', movementType: 'any' },
      condition: { type: 'save', saveType: 'Constitution', saveEffect: 'none' },
      utilityType: 'control',
      description: 'Failed-save creatures and unsecured objects are pushed 10 feet away.',
      forcedMovementState: {
        kind: 'thunder_push',
        targets: ['creatures_that_fail_Constitution_save', 'unsecured_objects_wholly_in_cube'],
        distance: '10_feet',
        direction: 'away_from_caster',
        objectSave: 'none'
      }
    },
    {
      type: 'MOVEMENT',
      trigger: { type: 'immediate', frequency: 'every_time', movementType: 'forced' },
      condition: { type: 'save', saveType: 'Constitution', saveEffect: 'none' },
      movementType: 'push',
      forcedMovement: { direction: 'away_from_caster', maxDistance: '10 ft', usesReaction: false },
      duration: { type: 'instantaneous', value: 0 },
      distance: 10
    }
  ],
  description: 'Each creature in a 15-foot cube takes thunder damage and is pushed on a failed save.'
} as unknown as Spell);

const makeActor = (id: string, name: string, position: { x: number; y: number }): CombatCharacter => (
  createMockCombatCharacter({
    id,
    name,
    position,
    currentHP: 30,
    maxHP: 30,
    stats: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      baseInitiative: 0,
      speed: 30,
      cr: '0'
    } as never
  })
);

describe('SpellCommandFactory Thunderwave bridge', () => {
  beforeEach(() => {
    vi.mocked(rollSavingThrow).mockReset();
  });

  it('pushes failed-save targets away from the caster and applies full damage once', async () => {
    vi.mocked(rollSavingThrow).mockReturnValue({
      total: 9,
      success: false,
      modifiersApplied: []
    } as never);

    const caster = makeActor('caster', 'Caster', { x: 0, y: 0 });
    const target = makeActor('target', 'Target', { x: 1, y: 0 });
    const state = createMockCombatState({
      characters: [caster, target],
      combatLog: []
    });

    const commands = await SpellCommandFactory.createCommands(
      makeThunderwaveSpell(),
      caster,
      [target],
      1,
      createMockGameState()
    );

    expect(commands).toHaveLength(1);

    const nextState = await commands[0].execute(state);
    const movedTarget = nextState.characters.find(character => character.id === target.id);

    expect(movedTarget?.position).toEqual({ x: 3, y: 0 });
    expect((movedTarget?.currentHP ?? 30)).toBeLessThan(30);
    expect(nextState.combatLog.some(entry => entry.message.includes('fails Constitution save'))).toBe(true);
    expect(nextState.combatLog.some(entry => entry.message.includes('is pushed'))).toBe(true);
  });

  it('does not push successful-save targets and still applies reduced damage', async () => {
    vi.mocked(rollSavingThrow).mockReturnValue({
      total: 18,
      success: true,
      modifiersApplied: []
    } as never);

    const caster = makeActor('caster', 'Caster', { x: 0, y: 0 });
    const target = makeActor('target', 'Target', { x: 1, y: 0 });
    const state = createMockCombatState({
      characters: [caster, target],
      combatLog: []
    });

    const commands = await SpellCommandFactory.createCommands(
      makeThunderwaveSpell(),
      caster,
      [target],
      1,
      createMockGameState()
    );

    const nextState = await commands[0].execute(state);
    const updatedTarget = nextState.characters.find(character => character.id === target.id);

    expect(updatedTarget?.position).toEqual(target.position);
    expect((updatedTarget?.currentHP ?? 30)).toBeLessThan(30);
    expect(nextState.combatLog.some(entry => entry.message.includes('succeeds Constitution save'))).toBe(true);
    expect(nextState.combatLog.some(entry => entry.message.includes('is pushed'))).toBe(false);
  });
});
