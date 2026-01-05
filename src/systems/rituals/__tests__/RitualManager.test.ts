
import { describe, it, expect } from 'vitest';
import { startRitual, advanceRitual, checkRitualInterrupt, isRitualComplete } from '../RitualManager';
import { CombatCharacter } from '../../../types/combat';
import { Spell } from '../../../types/spells';

// Mocks
const mockCaster: CombatCharacter = {
  id: 'caster-1',
  name: 'Mage',
  level: 5,
  // TODO(2026-01-03 pass 4 Codex-CLI): ritual test class stubbed; fill full class data from fixtures.
  class: {
    id: 'wizard',
    name: 'Wizard',
    description: '',
    hitDie: 6,
    primaryAbility: ['Intelligence'],
    savingThrowProficiencies: ['Intelligence', 'Wisdom'],
    skillProficienciesAvailable: [],
    numberOfSkillProficiencies: 0,
    armorProficiencies: [],
    weaponProficiencies: [],
    features: [],
  },
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

const mockSpell: Spell = {
  id: 'identify',
  name: 'Identify',
  level: 1,
  // TODO(2026-01-03 pass 4 Codex-CLI): spell school cast until test data aligns with enum casing.
  school: 'Divination' as unknown as Spell['school'],
  classes: ['Wizard'],
  description: 'You choose an object...',
  castingTime: { value: 1, unit: 'minute' },
  range: { type: 'touch' },
  components: { verbal: true, somatic: true, material: true },
  duration: { type: 'instantaneous', concentration: false },
  targeting: { type: 'single', range: 5, validTargets: ['objects'] },
  effects: []
};

describe('RitualManager', () => {
  it('should start a ritual with correct duration', () => {
    const ritual = startRitual(mockCaster, mockSpell, 1);

    expect(ritual.casterId).toBe('caster-1');
    expect(ritual.spellName).toBe('Identify');
    expect(ritual.durationTotal).toBe(10); // 1 minute = 10 rounds
    expect(ritual.progress).toBe(0);
    expect(ritual.isPaused).toBe(false);
  });

  it('should advance ritual progress', () => {
    let ritual = startRitual(mockCaster, mockSpell, 1);
    ritual = advanceRitual(ritual, 1);

    expect(ritual.progress).toBe(1);
    expect(isRitualComplete(ritual)).toBe(false);

    ritual = advanceRitual(ritual, 9);
    expect(ritual.progress).toBe(10);
    expect(isRitualComplete(ritual)).toBe(true);
  });

  it('should detect interruption from damage', () => {
    const ritual = startRitual(mockCaster, mockSpell, 1);

    // Damage interrupt
    const result = checkRitualInterrupt(ritual, 'damage', 10);
    expect(result.interrupted).toBe(true);
    expect(result.saveRequired).toBe(true);
    expect(result.saveDC).toBe(10); // Floor(10/2) = 5, min 10
  });

  it('should handle movement interruption if configured', () => {
    const ritual = startRitual(mockCaster, mockSpell, 1);
    // Default config breaksOnMove is false in our impl
    const result = checkRitualInterrupt(ritual, 'movement');
    expect(result.interrupted).toBe(false);

    // Test with updated config
    const strictRitual = { ...ritual, config: { ...ritual.config, breaksOnMove: true } };
    const resultStrict = checkRitualInterrupt(strictRitual, 'movement');
    expect(resultStrict.interrupted).toBe(true);
    expect(resultStrict.ritualBroken).toBe(true);
  });
});
