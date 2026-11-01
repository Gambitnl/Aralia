/** Native regression: the ability publisher must retain the executor's paid turn effects. */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAbilityExecution } from '../useAbilityExecution';
import { useActionExecutor } from '../../combat/useActionExecutor';
import { defaultProps } from '../../combat/__tests__/useActionExecutor.fixtures';
import { createMockCombatCharacter } from '../../../utils/core/factories';
import { canAffordActionCost, consumeActionCost } from '../../../utils/combat/actionEconomyUtils';
import type { UseAbilityExecutionProps } from '../abilityExecutionTypes';
import type { Ability, CombatCharacter } from '../../../types/combat';

const ref = <T,>(current: T) => ({ current });

function mount(ability: Ability, affordable = true, overrides: Partial<CombatCharacter> = {}) {
  const base = createMockCombatCharacter();
  const caster = createMockCombatCharacter({
    id: 'mara', abilities: [ability], statusEffects: [],
    actionEconomy: {
      ...base.actionEconomy,
      action: { used: false, remaining: 1 },
      movement: { total: 30, used: 0 },
    },
    ...overrides,
  });
  // Match React batching: publishing does not synchronously refresh ability refs.
  // This reproduces the actual ownership boundary without mocking either hook.
  let published = caster;
  const publish = vi.fn((character: CombatCharacter) => { published = character; });
  const consume = vi.fn(consumeActionCost);
  const log = vi.fn();
  const config: UseAbilityExecutionProps = {
    charactersRef: ref([caster]), mapDataRef: ref(null),
    reactiveTriggersRef: ref(undefined), currentPlaneRef: ref(undefined),
    pocketedSummonsRef: ref(undefined), activeSpellHelpersRef: ref(undefined),
    activeSpellForcesRef: ref(undefined), activeSpellGuardiansRef: ref(undefined),
    activeAnimatedObjectsRef: ref(undefined), activeSpellStructuresRef: ref(undefined),
    activeExtradimensionalSpacesRef: ref(undefined), activeSpellEmanationsRef: ref(undefined),
    spellObjectImpactsRef: ref(undefined), spellObjectRepairsRef: ref(undefined),
    spellObjectAccessChangesRef: ref(undefined), activeFireEffectsRef: ref(undefined),
    activeTruePolymorphTransformationsRef: ref(undefined),
    onExecuteAction: () => false, onCharacterUpdate: publish, onLogEntry: log,
    requestReaction: vi.fn(async () => null),
    processedPostDamageReactionEventIdsRef: ref(new Set()), cancelTargeting: vi.fn(),
  };
  const hook = renderHook(() => {
    const executor = useActionExecutor({
      ...defaultProps, characters: [caster],
      turnState: { ...defaultProps.turnState, currentCharacterId: caster.id, turnOrder: [caster.id] },
      onCharacterUpdate: publish, onLogEntry: log,
      consumeAction: consume,
      canAfford: (character, cost) => affordable && canAffordActionCost(character, cost),
    });
    return useAbilityExecution({ ...config, onExecuteAction: executor.executeAction });
  });
  return {
    run: () => act(async () => { await hook.result.current.executeAbility(ability, caster, caster.position, [caster.id]); }),
    current: () => published, config, consume, publish, log,
  };
}

const utility = (id: string, effects: Ability['effects'] = []): Ability => ({
  id, name: id === 'dash' ? 'Dash' : 'Disengage', description: '',
  type: 'utility', cost: { type: 'action' }, targeting: 'self', range: 0, effects,
});

describe('committed immediate effects across action and ability execution', () => {
  it('retains the real Dash movement gain and pays its action once', async () => {
    const flow = mount(utility('dash', [{ type: 'movement', value: 30 }]));
    await flow.run();
    expect(flow.current().actionEconomy.movement).toEqual({ total: 60, used: 0 });
    expect(flow.current().actionEconomy.action.remaining).toBe(0);
    expect(flow.config.charactersRef.current[0].actionEconomy.movement.total).toBe(60);
    expect(flow.consume).toHaveBeenCalledTimes(1);
  });

  it('retains Disengage protection through the final character publication', async () => {
    const flow = mount(utility('disengage'));
    await flow.run();
    expect(flow.current().statusEffects.filter(effect => effect.id === 'disengage')).toHaveLength(1);
    expect(flow.config.charactersRef.current[0].statusEffects.some(effect => effect.id === 'disengage')).toBe(true);
    expect(flow.current().actionEconomy.action.remaining).toBe(0);
    expect(flow.consume).toHaveBeenCalledTimes(1);
  });

  it('keeps limited-use tracking without replacing the committed movement budget', async () => {
    const flow = mount({ ...utility('dash', [{ type: 'movement', value: 30 }]), maxUses: 2, usesRemaining: 2 });
    await flow.run();
    expect(flow.current().abilities[0].usesRemaining).toBe(1);
    expect(flow.current().actionEconomy.movement.total).toBe(60);
    expect(flow.consume).toHaveBeenCalledTimes(1);
  });

  it('does not grant protection or charge a rejected action', async () => {
    const flow = mount(utility('disengage'), false);
    await flow.run();
    expect(flow.current().statusEffects).toEqual([]);
    expect(flow.current().actionEconomy.action.remaining).toBe(1);
    expect(flow.consume).not.toHaveBeenCalled();
    expect(flow.publish).not.toHaveBeenCalled();
  });

  it('keeps Stand Up removal and its actual movement payment', async () => {
    const flow = mount({ ...utility('stand_up'), name: 'Stand Up', cost: { type: 'movement-only', movementCost: 15 } }, true, {
      statusEffects: [{ id: 'prone', name: 'Prone', type: 'debuff', duration: 1, effect: { type: 'condition' }, icon: 'prone' }],
    });
    await flow.run();
    expect(flow.current().statusEffects).toEqual([]);
    expect(flow.current().actionEconomy.movement).toEqual({ total: 30, used: 15 });
    expect(flow.current().actionEconomy.action.remaining).toBe(1);
    expect(flow.consume).toHaveBeenCalledTimes(1);
  });

  it('still resolves a real healing command alongside immediate movement and cooldown', async () => {
    const flow = mount({
      ...utility('dash', [{ type: 'movement', value: 30 }, { type: 'heal', value: 2 }]), cooldown: 3,
    }, true, { currentHP: 5, maxHP: 11 });
    await flow.run();
    expect(flow.current().currentHP).toBe(7);
    expect(flow.current().abilities[0].currentCooldown).toBe(3);
    expect(flow.current().actionEconomy.movement.total).toBe(60);
    expect(flow.current().actionEconomy.action.remaining).toBe(0);
    expect(flow.consume).toHaveBeenCalledTimes(1);
  });
});
