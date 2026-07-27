import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAbilitySystem } from '../useAbilitySystem';
import { createMockCombatCharacter } from '../../utils/core/factories';
import type { Ability, CombatAction, CombatCharacter } from '../../types/combat';
import type { Spell } from '../../types/spells';

/**
 * This file proves that a Summon Greater Demon blood circle protects targets
 * from area damage even when the area is aimed outside the protected tiles.
 *
 * Called by: focused Vitest runtime proof for the G14 area-protection slice.
 * Depends on: useAbilitySystem, getBloodCircleRejection, and the combat action
 * handoff used by area abilities.
 */

vi.mock('../combat/useTargeting', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    useTargeting: () => {
      const [selectedAbility, setSelectedAbility] = React.useState<Ability | null>(null);
      const [targetingMode, setTargetingMode] = React.useState(false);

      return {
        selectedAbility,
        targetingMode,
        aoePreview: null,
        teleportDestinationPreview: null,
        startTargeting: (ability: Ability) => {
          setSelectedAbility(ability);
          setTargetingMode(true);
        },
        cancelTargeting: () => {
          setSelectedAbility(null);
          setTargetingMode(false);
        },
        previewAoE: vi.fn(),
        previewTeleportDestinations: vi.fn(),
        isTeleportDestination: () => false
      };
    }
  };
});

vi.mock('../../commands', () => ({
  SpellCommandFactory: { createCommands: vi.fn().mockResolvedValue([]) },
  AbilityCommandFactory: { createCommands: vi.fn().mockReturnValue([]) },
  CommandExecutor: {
    execute: vi.fn(async (_commands: unknown, state: unknown) => ({
      success: true,
      finalState: { ...(state as object), combatLog: [] }
    }))
  }
}));

vi.mock('../../utils/combatUtils', async () => {
  const actual = await vi.importActual<typeof import('../../utils/combatUtils')>('../../utils/combatUtils');
  return {
    ...actual,
    getOccupiedTiles: (character: CombatCharacter) => [character.position],
    generateId: () => 'blood-circle-area-test-id'
  };
});

const makeAreaAbility = (): Ability => ({
  id: 'demon-area-attack',
  name: 'Demon Area Attack',
  description: 'Area damage used to prove blood-circle protection.',
  type: 'spell',
  targeting: 'area',
  range: 30,
  areaOfEffect: { shape: 'circle', size: 10 },
  cost: { type: 'action' },
  effects: [{ type: 'damage', dice: '1d6', damageType: 'fire' }],
  spell: {
    id: 'demon-area-attack',
    name: 'Demon Area Attack',
    level: 1,
    school: 'Evocation',
    classes: ['Wizard'],
    description: 'Area damage used to prove blood-circle protection.',
    castingTime: { value: 1, unit: 'action' },
    range: { type: 'distance', distance: 30 },
    components: { verbal: true, somatic: true, material: false },
    duration: { type: 'instantaneous' },
    targeting: { type: 'area', validTargets: ['enemies'] },
    effects: [{ type: 'DAMAGE', damage: { dice: '1d6', type: 'Fire' }, trigger: { type: 'immediate' } }]
  } as unknown as Spell
});

const makeDemon = (): CombatCharacter => createMockCombatCharacter({
  id: 'summoned-demon',
  name: 'Summoned Demon',
  team: 'enemy',
  position: { x: 0, y: 0 },
  summonMetadata: {
    spellId: 'summon-greater-demon',
    casterId: 'caster',
    bloodCircle: {
      center: { x: 0, y: 0 },
      protectedTiles: [{ x: 0, y: 0 }, { x: 1, y: 0 }]
    }
  }
});

const makeTarget = (id: string, position: { x: number; y: number }): CombatCharacter => createMockCombatCharacter({
  id,
  name: id,
  team: 'player',
  position
});

describe('useAbilitySystem blood-circle area protection', () => {
  it('removes protected creatures while preserving legal area targets', async () => {
    const caster = makeDemon();
    const inside = makeTarget('inside-circle', { x: 1, y: 0 });
    const outside = makeTarget('outside-circle', { x: 4, y: 0 });
    const onExecuteAction = vi.fn((_action: CombatAction) => true);
    const { result } = renderHook(() => useAbilitySystem({
      characters: [caster, inside, outside],
      mapData: null,
      onExecuteAction,
      onCharacterUpdate: vi.fn(),
      onLogEntry: vi.fn()
    }));

    await act(async () => {
      await result.current.executeAbility(
        makeAreaAbility(),
        caster,
        { x: 4, y: 0 },
        [inside.id, outside.id]
      );
    });

    expect(onExecuteAction).toHaveBeenCalledTimes(1);
    expect(onExecuteAction.mock.calls[0]?.[0]?.targetCharacterIds).toEqual([outside.id]);
  });

  it('rejects an area action when every target is inside the protected circle', async () => {
    const caster = makeDemon();
    const inside = makeTarget('inside-circle', { x: 1, y: 0 });
    const onExecuteAction = vi.fn((_action: CombatAction) => true);
    const onLogEntry = vi.fn();
    const { result } = renderHook(() => useAbilitySystem({
      characters: [caster, inside],
      mapData: null,
      onExecuteAction,
      onCharacterUpdate: vi.fn(),
      onLogEntry
    }));

    await act(async () => {
      await result.current.executeAbility(
        makeAreaAbility(),
        caster,
        { x: 4, y: 0 },
        [inside.id]
      );
    });

    expect(onExecuteAction).not.toHaveBeenCalled();
    expect(onLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ rejectedReason: 'blood_circle_area_target_blocked' })
    }));
  });
});
