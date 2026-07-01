import { describe, expect, it, vi } from 'vitest';
import { DamageCommand } from '../effects/DamageCommand';
import { createMockCombatCharacter, createMockCombatState, createMockCommandContext, createMockGameState } from '../../utils/factories';
import type { DamageEffect } from '../../types/spells';
import negativeEnergyFlood from '../../../public/data/spells/level-5/negative-energy-flood.json';

/**
 * Negative Energy Flood stores its delayed zombie clause on the live damage
 * row. This proof keeps lethal damage from stopping at 0 HP and forgetting the
 * start-of-caster-next-turn aftermath.
 */
vi.mock('../../utils/savingThrowUtils', () => ({
  calculateSpellDC: vi.fn(() => 16),
  rollSavingThrow: vi.fn(() => ({
    roll: 1,
    modifier: 0,
    total: 1,
    dc: 16,
    success: false,
    modifiersApplied: []
  })),
  calculateSaveDamage: vi.fn((damage: number) => damage)
}));

describe('DamageCommand live Negative Energy Flood aftermath bridge', () => {
  it('records a pending zombie rise when live spell damage kills a non-Undead target', async () => {
    const caster = createMockCombatCharacter({
      id: 'negative-energy-flood-caster',
      name: 'Negative Energy Flood Caster',
      team: 'player',
      position: { x: 0, y: 0 },
      activeEffects: []
    });
    const target = createMockCombatCharacter({
      id: 'negative-energy-flood-target',
      name: 'Doomed Guard',
      team: 'enemy',
      creatureTypes: ['Humanoid'],
      currentHP: 1,
      maxHP: 12,
      position: { x: 4, y: 2 }
    });
    const effect = negativeEnergyFlood.effects.find(candidate => candidate.type === 'DAMAGE') as DamageEffect | undefined;
    const context = createMockCommandContext({
      spellId: negativeEnergyFlood.id,
      spellName: negativeEnergyFlood.name,
      castAtLevel: negativeEnergyFlood.level,
      caster,
      targets: [target],
      gameState: createMockGameState()
    });

    expect(effect).toBeDefined();

    vi.spyOn(Math, 'random').mockReturnValue(0);

    const afterDamage = await new DamageCommand(effect!, context).execute(createMockCombatState({
      characters: [caster, target],
      turnState: {
        currentTurn: 7,
        currentCharacterId: caster.id,
        turnOrder: [caster.id, target.id],
        phase: 'action',
        actionsThisTurn: []
      },
      combatLog: []
    }));

    vi.restoreAllMocks();

    const updatedCaster = afterDamage.characters.find(character => character.id === caster.id);
    const updatedTarget = afterDamage.characters.find(character => character.id === target.id);
    const pendingRise = updatedCaster?.activeEffects?.find(effectRecord =>
      effectRecord.mechanics?.negativeEnergyFloodZombieRise?.targetId === target.id
    );

    expect(updatedTarget?.currentHP).toBe(0);
    expect(pendingRise?.spellId).toBe(negativeEnergyFlood.id);
    expect(pendingRise?.mechanics?.negativeEnergyFloodZombieRise).toEqual(expect.objectContaining({
      targetId: target.id,
      targetName: target.name,
      position: target.position,
      entityType: 'zombie_from_killed_target',
      timing: 'start_of_caster_next_turn'
    }));
    expect(afterDamage.combatLog.some(entry =>
      entry.data?.spellId === negativeEnergyFlood.id &&
      entry.data?.pendingAftermath === 'negative_energy_flood_zombie_rise'
    )).toBe(true);
  });
});
