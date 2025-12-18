
import { describe, it, expect, vi } from 'vitest';
import { RitualManager } from '../RitualManager';
import { Spell } from '../../../types/spells';
import { CombatCharacter } from '../../../types/combat';
import { RitualEvent } from '../../../types/rituals';

const mockRitualSpell: Spell = {
  id: 'alarm',
  name: 'Alarm',
  level: 1,
  school: 'Abjuration',
  classes: ['Wizard'],
  description: 'Wards an area.',
  castingTime: { value: 1, unit: 'minute' },
  range: { type: 'ranged', distance: 30 },
  components: { verbal: true, somatic: true, material: false },
  duration: { type: 'timed', value: 8, unit: 'hour', concentration: false },
  targeting: { type: 'single', range: 30, validTargets: ['creatures'] },
  effects: [],
  ritual: true,
};

const mockCaster: CombatCharacter = {
  id: 'wizard-1',
  name: 'Wizard',
  // ... minimal required props
} as any;

describe('RitualManager', () => {
  it('should initialize a ritual with correct duration', () => {
    const ritual = RitualManager.startRitual(mockRitualSpell, mockCaster, [], 1000);

    expect(ritual.spell.id).toBe('alarm');
    expect(ritual.casterId).toBe('wizard-1');
    expect(ritual.durationMinutes).toBe(11); // 1 min cast time + 10 min ritual
    expect(ritual.progressMinutes).toBe(0);
    expect(ritual.isComplete).toBe(false);
  });

  it('should throw error if spell is not a ritual', () => {
    const nonRitualSpell = { ...mockRitualSpell, ritual: false };
    expect(() => RitualManager.startRitual(nonRitualSpell, mockCaster, [], 0)).toThrow();
  });

  it('should advance ritual progress', () => {
    let ritual = RitualManager.startRitual(mockRitualSpell, mockCaster, [], 0);

    ritual = RitualManager.advanceRitual(ritual, 5);
    expect(ritual.progressMinutes).toBe(5);
    expect(ritual.isComplete).toBe(false);

    ritual = RitualManager.advanceRitual(ritual, 6);
    expect(ritual.progressMinutes).toBe(11);
    expect(ritual.isComplete).toBe(true);
  });

  it('should check interruptions (Damage)', () => {
    const ritual = RitualManager.startRitual(mockRitualSpell, mockCaster, [], 0);
    const damageEvent: RitualEvent = {
      type: 'damage',
      targetId: 'wizard-1',
      value: 10
    };

    const result = RitualManager.checkInterruption(ritual, damageEvent);
    expect(result.interrupted).toBe(true);
    expect(result.canSave).toBe(true);
    expect(result.saveDC).toBe(10); // min 10
  });

  it('should check interruptions (High Damage)', () => {
    const ritual = RitualManager.startRitual(mockRitualSpell, mockCaster, [], 0);
    const damageEvent: RitualEvent = {
      type: 'damage',
      targetId: 'wizard-1',
      value: 40
    };

    const result = RitualManager.checkInterruption(ritual, damageEvent);
    expect(result.interrupted).toBe(true);
    expect(result.canSave).toBe(true);
    expect(result.saveDC).toBe(20); // 40/2
  });

  it('should check interruptions (Movement)', () => {
    const ritual = RitualManager.startRitual(mockRitualSpell, mockCaster, [], 0);
    const event: RitualEvent = {
      type: 'movement',
      targetId: 'wizard-1',
      value: 10 // Moved 10ft
    };

    const result = RitualManager.checkInterruption(ritual, event);
    expect(result.interrupted).toBe(true);
    expect(result.canSave).toBe(false);
  });

  it('should ignore events for other characters', () => {
    const ritual = RitualManager.startRitual(mockRitualSpell, mockCaster, [], 0);
    const event: RitualEvent = {
      type: 'damage',
      targetId: 'fighter-1', // Not the caster
      value: 50
    };

    const result = RitualManager.checkInterruption(ritual, event);
    expect(result.interrupted).toBe(false);
  });

  // New Tests for Ritualist Features

  it('should handle material consumption timing', () => {
    // Default: Consumed at end
    let ritual = RitualManager.startRitual(mockRitualSpell, mockCaster, [], 0);
    expect(ritual.materialsConsumed).toBe(false);

    ritual = RitualManager.advanceRitual(ritual, 5); // ~45%
    expect(ritual.materialsConsumed).toBe(false);

    ritual = RitualManager.advanceRitual(ritual, 6); // Complete (100%)
    expect(ritual.materialsConsumed).toBe(true);

    // Custom: Consumed at 50%
    let customRitual = RitualManager.startRitual(mockRitualSpell, mockCaster, [], 0, { materialConsumptionProgress: 0.5 });

    customRitual = RitualManager.advanceRitual(customRitual, 4); // 4/11 ~36%
    expect(customRitual.materialsConsumed).toBe(false);

    customRitual = RitualManager.advanceRitual(customRitual, 2); // 6/11 ~54%
    expect(customRitual.materialsConsumed).toBe(true);
  });

  it('should apply participant bonuses to concentration DC', () => {
    const participants = [{ id: 'p1' }, { id: 'p2' }] as CombatCharacter[];
    const ritual = RitualManager.startRitual(mockRitualSpell, mockCaster, participants, 0);

    expect(ritual.participationBonus).toBe(2);

    const damageEvent: RitualEvent = {
      type: 'damage',
      targetId: 'wizard-1',
      value: 24 // Normal DC: 12
    };

    const result = RitualManager.checkInterruption(ritual, damageEvent);
    expect(result.canSave).toBe(true);
    // Effective DC = 12 - 2 = 10
    expect(result.saveDC).toBe(10);
  });

  it('should cap participant bonus at 5', () => {
    const participants = Array(10).fill({ id: 'p' }) as CombatCharacter[];
    const ritual = RitualManager.startRitual(mockRitualSpell, mockCaster, participants, 0);

    expect(ritual.participationBonus).toBe(5);
  });
});
