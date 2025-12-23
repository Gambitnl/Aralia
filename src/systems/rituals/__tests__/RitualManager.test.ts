
import { describe, it, expect } from 'vitest';
import { startRitual, advanceRitual, checkRitualInterrupt, isRitualComplete } from '../RitualManager';
import { CombatCharacter } from '../../../types/combat';
import { Spell } from '../../../types/spells';

// Mocks
const mockCaster: CombatCharacter = {
  id: 'caster-1',
  name: 'Mage',
  level: 5,
  class: { name: 'Wizard', level: 5, subclass: 'Evocation', hitDie: 'd6', proficiencyBonus: 3, features: [], spellsKnown: [], spellSlots: {} },
  position: { x: 0, y: 0 },
  stats: { strength: 10, dexterity: 12, constitution: 14, intelligence: 18, wisdom: 10, charisma: 8, baseInitiative: 1, speed: 30, cr: '5' },
  abilities: [],
  team: 'player',
  currentHP: 30,
  maxHP: 30,
  initiative: 10,
  statusEffects: [],
  actionEconomy: { action: { used: false, remaining: 1 }, bonusAction: { used: false, remaining: 1 }, reaction: { used: false, remaining: 1 }, movement: { used: 0, total: 30 }, freeActions: 1 }
};

const mockSpellStandard: Spell = {
  id: 'identify',
  name: 'Identify',
  level: 1,
  school: 'Divination',
  classes: ['Wizard'],
  description: 'You choose an object...',
  castingTime: { value: 1, unit: 'minute' },
  range: { type: 'touch' },
  components: { verbal: true, somatic: true, material: true },
  duration: { type: 'instantaneous', concentration: false },
  targeting: { type: 'single', range: 5, validTargets: ['objects'] },
  effects: []
};

const mockSpellRitual: Spell = {
  ...mockSpellStandard,
  id: 'alarm',
  name: 'Alarm',
  ritual: true,
  castingTime: { value: 1, unit: 'minute' }
};

const mockSpellActionRitual: Spell = {
  ...mockSpellStandard,
  id: 'detect-magic',
  name: 'Detect Magic',
  ritual: true,
  castingTime: { value: 1, unit: 'action' }
};

describe('RitualManager', () => {
  it('should start a standard cast with correct duration (1 minute)', () => {
    const ritual = startRitual(mockCaster, mockSpellStandard, 1, false);

    expect(ritual.durationTotal).toBe(10); // 1 minute = 10 rounds
    expect(ritual.progress).toBe(0);
  });

  it('should start a ritual cast (1 minute base + 10 mins ritual)', () => {
    const ritual = startRitual(mockCaster, mockSpellRitual, 1, true);

    // 10 rounds (1 min) + 100 rounds (10 mins) = 110 rounds
    expect(ritual.durationTotal).toBe(110);
  });

  it('should start an action ritual cast (1 action base + 10 mins ritual)', () => {
    const ritual = startRitual(mockCaster, mockSpellActionRitual, 1, true);

    // 0 rounds (action) + 100 rounds (10 mins) = 100 rounds
    expect(ritual.durationTotal).toBe(100);
  });

  it('should NOT add ritual time if asRitual is false', () => {
    const ritual = startRitual(mockCaster, mockSpellRitual, 1, false);

    // Standard cast of Alarm is 1 minute = 10 rounds
    expect(ritual.durationTotal).toBe(10);
  });

  it('should advance ritual progress', () => {
    let ritual = startRitual(mockCaster, mockSpellStandard, 1);
    ritual = advanceRitual(ritual, 1);

    expect(ritual.progress).toBe(1);
    expect(isRitualComplete(ritual)).toBe(false);

    ritual = advanceRitual(ritual, 9);
    expect(ritual.progress).toBe(10);
    expect(isRitualComplete(ritual)).toBe(true);
  });

  it('should detect interruption from damage', () => {
    const ritual = startRitual(mockCaster, mockSpellStandard, 1);

    // Damage interrupt
    const result = checkRitualInterrupt(ritual, 'damage', 10);
    expect(result.interrupted).toBe(true);
    expect(result.saveRequired).toBe(true);
    expect(result.saveDC).toBe(10); // Floor(10/2) = 5, min 10
  });

  it('should handle movement interruption if configured', () => {
    const ritual = startRitual(mockCaster, mockSpellStandard, 1);
    // Default config breaksOnMove is false
    const result = checkRitualInterrupt(ritual, 'movement');
    expect(result.interrupted).toBe(false);

    // Test with updated config
    const strictRitual = { ...ritual, config: { ...ritual.config, breaksOnMove: true } };
    const resultStrict = checkRitualInterrupt(strictRitual, 'movement');
    expect(resultStrict.interrupted).toBe(true);
    expect(resultStrict.ritualBroken).toBe(true);
  });
});
