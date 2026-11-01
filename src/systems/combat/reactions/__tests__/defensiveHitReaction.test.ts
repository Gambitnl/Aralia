/** Native-derived Shield regression: decide before lethal damage and debit the actual grant. */
import { describe, expect, it, vi } from 'vitest';
import { AbilityCommandFactory } from '@/commands/factory/AbilityCommandFactory';
import { createMockCombatCharacter, createMockCombatState, createMockGameState, createMockSpellSlots } from '@/utils/core/factories';
import type { Ability, CombatCharacter } from '@/types/combat';
import type { Spell } from '@/types/spells';
import shieldData from '@/data/spells/level-1/shield.json';
import fireBoltData from '@/data/spells/level-0/fire-bolt.json';
import { SpellCommandFactory } from '@/commands/factory/SpellCommandFactory';
import * as dice from '@/systems/dice/rollers';
import { act, renderHook } from '@testing-library/react';
import { useAbilityExecution } from '@/hooks/ability/useAbilityExecution';
import type { UseAbilityExecutionProps } from '@/hooks/ability/abilityExecutionTypes';

const shield = shieldData as unknown as Spell;
const strike: Ability = {
  id: 'source-scimitar', name: 'Scimitar', description: '', type: 'attack',
  targeting: 'single_enemy', range: 1, cost: { type: 'action' }, attackBonus: 0,
  effects: [{ type: 'damage', value: 4, damageType: 'slashing' }],
};
const defender = (overrides: Partial<CombatCharacter> = {}) => createMockCombatCharacter({
  id: 'mara', name: 'Mara', team: 'player', armorClass: 16, currentHP: 4, maxHP: 11,
  position: { x: 1, y: 0 }, feats: ['magic_initiate'],
  spellSlots: createMockSpellSlots({ level_1: { current: 0, max: 2 } }),
  limitedUses: { feat_magic_initiate_shield: { name: 'Magic Initiate: Cast shield', current: 1, max: 1, resetOn: 'long_rest' } },
  abilities: [{ id: 'shield', name: 'Shield', description: '', type: 'spell', targeting: 'self', range: 0, cost: { type: 'reaction' }, effects: [], spell: shield }],
  ...overrides,
});

async function attack(target: CombatCharacter, choice: string | null = 'shield', roll = 0.85) {
  const attacker = createMockCombatCharacter({ id: 'bandit', name: 'Bandit', team: 'enemy', position: { x: 0, y: 0 } });
  const state = createMockCombatState({ characters: [attacker, target] });
  const request = vi.fn(async () => choice);
  const [command] = AbilityCommandFactory.createCommands(strike, attacker, [target], createMockGameState(), undefined, request, { attackRollRng: () => roll, damageRng: () => 0 });
  const result = await command.execute(state);
  return { target: result.characters.find(character => character.id === target.id)!, result, request };
}

describe('pre-damage defensive reaction and owned feat payment', () => {
  it('offers once before damage through the real ability continuation, with no late duplicate', async () => {
    const target = defender();
    const attacker = createMockCombatCharacter({ id: 'bandit', name: 'Bandit', team: 'enemy', abilities: [strike], position: { x: 0, y: 0 } });
    const ref = <T,>(current: T) => ({ current });
    const charactersRef = ref([attacker, target]);
    const offeredHP: number[] = [];
    const request = vi.fn(async () => {
      offeredHP.push(charactersRef.current.find(character => character.id === target.id)!.currentHP);
      return 'shield';
    });
    const props: UseAbilityExecutionProps = {
      charactersRef, mapDataRef: ref(null), reactiveTriggersRef: ref(undefined), currentPlaneRef: ref(undefined),
      pocketedSummonsRef: ref(undefined), activeSpellHelpersRef: ref(undefined), activeSpellForcesRef: ref(undefined),
      activeSpellGuardiansRef: ref(undefined), activeAnimatedObjectsRef: ref(undefined), activeSpellStructuresRef: ref(undefined),
      activeExtradimensionalSpacesRef: ref(undefined), activeSpellEmanationsRef: ref(undefined), spellObjectImpactsRef: ref(undefined),
      spellObjectRepairsRef: ref(undefined), spellObjectAccessChangesRef: ref(undefined), activeFireEffectsRef: ref(undefined),
      activeTruePolymorphTransformationsRef: ref(undefined), onExecuteAction: vi.fn(() => true), onCharacterUpdate: vi.fn(),
      requestReaction: request, processedPostDamageReactionEventIdsRef: ref(new Set()), cancelTargeting: vi.fn(),
    };
    const { result } = renderHook(() => useAbilityExecution(props));
    await act(async () => result.current.executeAbility(strike, attacker, target.position, [target.id], undefined, undefined,
      { attackRollRng: () => 0.85, damageRng: () => 0 }));
    expect(offeredHP).toEqual([4]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(charactersRef.current.find(character => character.id === target.id)).toMatchObject({
      currentHP: 4, armorClass: 21,
      limitedUses: { feat_magic_initiate_shield: { current: 0 } },
    });
  });

  it('offers the unused feat cast with zero slots and prevents the triggering lethal hit', async () => {
    const outcome = await attack(defender());
    expect(outcome.request).toHaveBeenCalledTimes(1);
    expect(outcome.request).toHaveBeenCalledWith('bandit', 'mara', 'on_hit', [expect.objectContaining({
      id: 'shield', hitPreview: { attackTotal: 18, currentAC: 16, defendedAC: 21, isCritical: false, stopsAttack: true },
    })]);
    expect(outcome.target.currentHP).toBe(4);
    expect(outcome.target.armorClass).toBe(21);
    expect(outcome.target.limitedUses?.feat_magic_initiate_shield.current).toBe(0);
    expect(outcome.target.spellSlots?.level_1.current).toBe(0);
    expect(outcome.target.actionEconomy.reaction.used).toBe(true);
    expect(outcome.result.combatLog.some(entry => entry.message.includes('turns the hit into a miss'))).toBe(true);
  });

  it('keeps a declined hit and does not consume the free cast', async () => {
    const outcome = await attack(defender(), null);
    expect(outcome.request).toHaveBeenCalledTimes(1);
    expect(outcome.target.currentHP).toBe(0);
    expect(outcome.target.limitedUses?.feat_magic_initiate_shield.current).toBe(1);
    expect(outcome.target.actionEconomy.reaction.used).toBe(false);
  });

  it('does not treat an orphaned feat counter as ownership', async () => {
    const outcome = await attack(defender({ feats: [] }));
    expect(outcome.request).not.toHaveBeenCalled();
    expect(outcome.target.limitedUses?.feat_magic_initiate_shield.current).toBe(1);
  });

  it('does not offer a defensive reaction to an already downed actor', async () => {
    const outcome = await attack(defender({ currentHP: 0, spellSlots: createMockSpellSlots({ level_1: { current: 1, max: 2 } }) }));
    expect(outcome.request).not.toHaveBeenCalled();
  });

  it('still permits Shield on a critical hit without cancelling the automatic hit', async () => {
    const outcome = await attack(defender(), 'shield', 0.999);
    expect(outcome.request).toHaveBeenCalledTimes(1);
    expect(outcome.target.armorClass).toBe(21);
    expect(outcome.target.currentHP).toBe(0);
    expect(outcome.target.limitedUses?.feat_magic_initiate_shield.current).toBe(0);
  });

  it('quotes an unpreventable hit truthfully and leaves the choice to the player', async () => {
    const outcome = await attack(defender({ armorClass: 12 }), null);
    expect(outcome.request).toHaveBeenCalledWith('bandit', 'mara', 'on_hit', [expect.objectContaining({
      hitPreview: { attackTotal: 18, currentAC: 12, defendedAC: 17, isCritical: false, stopsAttack: false },
    })]);
    expect(outcome.target.limitedUses?.feat_magic_initiate_shield.current).toBe(1);
    expect(shield).not.toHaveProperty('hitPreview');
  });

  it('uses a slot after the free cast is exhausted', async () => {
    const target = defender({
      limitedUses: { feat_magic_initiate_shield: { name: 'Magic Initiate: Cast shield', current: 0, max: 1, resetOn: 'long_rest' } },
      spellSlots: createMockSpellSlots({ level_1: { current: 1, max: 2 } }),
    });
    const outcome = await attack(target);
    expect(outcome.request).toHaveBeenCalledTimes(1);
    expect(outcome.target.currentHP).toBe(4);
    expect(outcome.target.spellSlots?.level_1.current).toBe(0);
    expect(outcome.target.limitedUses?.feat_magic_initiate_shield.current).toBe(0);
  });

  it('does not offer another reaction after the reaction is spent', async () => {
    const target = defender();
    target.actionEconomy.reaction = { used: true, remaining: 0 };
    const outcome = await attack(target);
    expect(outcome.request).not.toHaveBeenCalled();
    expect(outcome.target.limitedUses?.feat_magic_initiate_shield.current).toBe(1);
  });

  it('resolves the same defense before a real spell attack damage command', async () => {
    const target = defender({ position: { x: 3, y: 0 } });
    const caster = createMockCombatCharacter({ id: 'mage', team: 'enemy', spellcastingAbility: 'intelligence', stats: { intelligence: 10 }, position: { x: 0, y: 0 } });
    const request = vi.fn(async () => 'shield');
    // Test-only roll injection; actual campaign rolls are never replaced.
    const roll = vi.spyOn(dice, 'rollD20').mockReturnValue(16);
    try {
      const commands = await SpellCommandFactory.createCommands(fireBoltData as unknown as Spell, caster, [target], 0, createMockGameState(), undefined, undefined, request);
      let state = createMockCombatState({ characters: [caster, target] });
      for (const command of commands) state = await command.execute(state);
      const finalTarget = state.characters.find(character => character.id === target.id)!;
      expect(request).toHaveBeenCalledTimes(1);
      expect(finalTarget.currentHP).toBe(4);
      expect(finalTarget.armorClass).toBe(21);
      expect(finalTarget.limitedUses?.feat_magic_initiate_shield.current).toBe(0);
      expect(state.combatLog.some(entry => entry.message.includes('MISS.'))).toBe(true);
    } finally { roll.mockRestore(); }
  });
});
