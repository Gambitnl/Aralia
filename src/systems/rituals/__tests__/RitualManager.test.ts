
import { describe, it, expect } from 'vitest';
import { RitualManager } from '../RitualManager';
import { Spell } from '../../../types/spells';
import { CombatCharacter } from '../../../types/combat';
import { RitualEvent } from '../../../types/rituals';

// Mock Data
const mockRitualSpell: Spell = {
  id: 'alarm',
  name: 'Alarm',
  level: 1,
  school: 'Abjuration',
  classes: ['Wizard'],
  description: 'Wards an area.',
  ritual: true,
  castingTime: { value: 1, unit: 'minute' },
  range: { type: 'range', distance: 30 },
  components: { verbal: true, somatic: true, material: false },
  duration: { type: 'timed', value: 8, unit: 'hour', concentration: false },
  targeting: { type: 'area', range: 30, areaOfEffect: { shape: 'Cube', size: 20 } },
  effects: []
};

const mockCaster: CombatCharacter = {
  id: 'wizard-1',
  name: 'Gandalf',
  position: { x: 0, y: 0 },
  // ... minimally required fields for the test
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

  it('should advance progress correctly', () => {
    let ritual = RitualManager.startRitual(mockRitualSpell, mockCaster, [], 0);

    ritual = RitualManager.advanceRitual(ritual, 5);
    expect(ritual.progressMinutes).toBe(5);
    expect(ritual.isComplete).toBe(false);

    ritual = RitualManager.advanceRitual(ritual, 6);
    expect(ritual.progressMinutes).toBe(11);
    expect(ritual.isComplete).toBe(true);
  });

  it('should detect interruptions from damage', () => {
    const ritual = RitualManager.startRitual(mockRitualSpell, mockCaster, [], 0);

    const damageEvent: RitualEvent = {
      type: 'damage',
      targetId: 'wizard-1',
      value: 10
    };

    const result = RitualManager.checkInterruption(ritual, damageEvent);

    expect(result.interrupted).toBe(true);
    expect(result.canSave).toBe(true);
    expect(result.saveDC).toBe(10); // Floor(10/2) = 5, min 10
  });

  it('should ignore events for other characters', () => {
    const ritual = RitualManager.startRitual(mockRitualSpell, mockCaster, [], 0);

    const damageEvent: RitualEvent = {
      type: 'damage',
      targetId: 'fighter-2', // Not the caster
      value: 50
    };

    const result = RitualManager.checkInterruption(ritual, damageEvent);
    expect(result.interrupted).toBe(false);
  });

  it('should handle interruptions from incapacitation (no save)', () => {
    const ritual = RitualManager.startRitual(mockRitualSpell, mockCaster, [], 0);

    const event: RitualEvent = {
      type: 'incapacitated', // status_change really, but mapped in manager
      targetId: 'wizard-1'
    };
    // The manager expects 'incapacitated' as a type in its default list for simplicity
    // or mapped from status_change. In the mock implementation, I used 'incapacitated' as a type.

    const result = RitualManager.checkInterruption(ritual, event);
    expect(result.interrupted).toBe(true);
    expect(result.canSave).toBe(false);
  });
});
