
import { describe, it, expect } from 'vitest';
import { startRitual, advanceRitual, checkRitualInterrupt, isRitualComplete } from '../RitualManager';
import { CombatCharacter } from '../../../types/combat';
import { Spell } from '../../types/spells';

const mockCaster: CombatCharacter = {
  id: 'caster-1',
  name: 'Merlin',
  level: 5,
  class: {
    id: 'wizard', name: 'Wizard', hitDie: 'd6', proficiencyBonuses: [],
    savingThrows: [], features: [], subclass: { id: 'evocation', name: 'Evocation', features: [] }
  },
  stats: {
    strength: 10, dexterity: 12, constitution: 14, intelligence: 18, wisdom: 12, charisma: 10,
    baseInitiative: 1, speed: 30, cr: '5'
  },
  abilities: [],
  team: 'player',
  currentHP: 30,
  maxHP: 30,
  initiative: 15,
  statusEffects: [],
  actionEconomy: {
    action: { used: false, remaining: 1 },
    bonusAction: { used: false, remaining: 1 },
    reaction: { used: false, remaining: 1 },
    movement: { used: 0, total: 30 },
    freeActions: 1
  },
  position: { x: 0, y: 0 }
};

const mockSpell: Spell = {
  id: 'alarm',
  name: 'Alarm',
  level: 1,
  school: 'Abjuration',
  classes: ['Wizard'],
  description: 'Sets an alarm.',
  castingTime: { value: 1, unit: 'minute' },
  range: { type: 'ranged', distance: 30 },
  components: { verbal: true, somatic: true, material: false },
  duration: { type: 'timed', value: 8, unit: 'hour', concentration: false },
  targeting: { type: 'area', range: 30, areaOfEffect: { shape: 'Cube', size: 20 }, validTargets: ['creatures'] },
  effects: []
};

describe('RitualManager', () => {
  it('should start a standard cast correctly (no ritual extension)', () => {
    // Normal cast: 1 minute = 10 rounds
    const ritual = startRitual(mockCaster, mockSpell, 1, false);

    expect(ritual.spellName).toBe('Alarm');
    expect(ritual.durationTotal).toBe(10);
    expect(ritual.progress).toBe(0);
    expect(ritual.casterId).toBe(mockCaster.id);
  });

  it('should start a ritual cast correctly (adds 10 minutes)', () => {
    // Ritual cast: 1 minute + 10 minutes = 11 minutes = 110 rounds
    const ritual = startRitual(mockCaster, mockSpell, 1, true);

    expect(ritual.durationTotal).toBe(110);
  });

  it('should calculate duration correctly for hours', () => {
    const hourSpell = { ...mockSpell, castingTime: { value: 1, unit: 'hour' as const } };
    const ritual = startRitual(mockCaster, hourSpell, 1, false);
    expect(ritual.durationTotal).toBe(600); // 1 hour = 600 rounds
  });

  it('should advance progress', () => {
    let ritual = startRitual(mockCaster, mockSpell, 1);
    ritual = advanceRitual(ritual, 1);
    expect(ritual.progress).toBe(1);

    ritual = advanceRitual(ritual, 5);
    expect(ritual.progress).toBe(6);
  });

  it('should detect completion', () => {
    let ritual = startRitual(mockCaster, mockSpell, 1, false); // 10 rounds
    ritual = advanceRitual(ritual, 10);
    expect(isRitualComplete(ritual)).toBe(true);
  });

  it('should handle damage interruption', () => {
    const ritual = startRitual(mockCaster, mockSpell, 1);

    const result = checkRitualInterrupt(ritual, 'damage', 20);
    expect(result.interrupted).toBe(true);
    expect(result.saveRequired).toBe(true);
    expect(result.saveDC).toBe(10); // Floor(20/2) = 10, min 10
  });

  it('should handle movement interruption if configured via override', () => {
      // Override default config to break on move
      const ritual = startRitual(mockCaster, mockSpell, 1, false, { breaksOnMove: true });
      const result = checkRitualInterrupt(ritual, 'move');
      expect(result.interrupted).toBe(true);

      // Default should be false
      const ritualDefault = startRitual(mockCaster, mockSpell, 1, false);
      const resultDefault = checkRitualInterrupt(ritualDefault, 'move');
      expect(resultDefault.interrupted).toBe(false);
  });
});
