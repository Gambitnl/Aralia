
import { describe, it, expect } from 'vitest';
import { RitualManager } from '../RitualManager';
import { Spell } from '../../types/spells';
import { CombatCharacter } from '../../types/combat';
import { RitualRequirement, RitualContext } from '../../types/rituals';

// Mock data
const mockRitualSpell: Spell = {
  id: 'ceremony-spell',
  name: 'Sacred Ceremony',
  level: 1,
  school: 'Abjuration',
  castingTime: { value: 1, unit: 'hour' }, // 60 min
  range: { type: 'touch', distance: 0 },
  components: { verbal: true, somatic: true, material: false },
  duration: { type: 'instantaneous' },
  effects: [],
  description: 'A sacred rite.',
  ritual: true,
};

const mockCaster: CombatCharacter = {
  id: 'cleric-1',
  name: 'Cleric',
  properties: {},
  stats: {} as any,
  hp: 10,
  maxHp: 10,
  ac: 15,
  initiative: 0,
  speed: 30,
  abilities: {},
  conditions: [],
  position: { x: 0, y: 0 }
};

describe('RitualManager - Ceremony Requirements', () => {
  it('should allow ritual start when requirements are met', () => {
    const requirements: RitualRequirement[] = [
      { type: 'time_of_day', value: 'night' },
      { type: 'location', value: 'outdoors' }
    ];

    const context: RitualContext = {
      isDaytime: false,
      locationType: 'outdoors'
    };

    const ritual = RitualManager.startRitual(mockRitualSpell, mockCaster, [], 1000, { requirements, context });

    expect(ritual).toBeDefined();
    expect(ritual.durationMinutes).toBe(70); // 60 + 10
  });

  it('should throw error when time requirement is not met', () => {
    const requirements: RitualRequirement[] = [
      { type: 'time_of_day', value: 'night', description: 'Must be night' }
    ];

    const context: RitualContext = {
      isDaytime: true, // It is day
      locationType: 'outdoors'
    };

    expect(() => {
      RitualManager.startRitual(mockRitualSpell, mockCaster, [], 1000, { requirements, context });
    }).toThrow('Ritual requirements not met: Must be night');
  });

  it('should throw error when location requirement is not met', () => {
    const requirements: RitualRequirement[] = [
      { type: 'location', value: 'indoors' }
    ];

    const context: RitualContext = {
      isDaytime: false,
      locationType: 'outdoors' // Wrong location
    };

    expect(() => {
      RitualManager.startRitual(mockRitualSpell, mockCaster, [], 1000, { requirements, context });
    }).toThrow(/Ritual must be performed indoors/);
  });

  it('should validate participant count', () => {
    const requirements: RitualRequirement[] = [
      { type: 'participants_count', value: 3 }
    ];

    const context: RitualContext = {};

    // Only 1 participant (plus caster? No, participants array usually excludes caster in this API, but let's assume length check is on the array passed)
    const participants: CombatCharacter[] = [mockCaster]; // Actually passed as 'participants' arg

    expect(() => {
      RitualManager.startRitual(mockRitualSpell, mockCaster, participants, 1000, { requirements, context });
    }).toThrow(/Ritual requires at least 3 participants/);

    // Pass with 3
    const group = [mockCaster, mockCaster, mockCaster];
    const ritual = RitualManager.startRitual(mockRitualSpell, mockCaster, group, 1000, { requirements, context });
    expect(ritual).toBeDefined();
  });
});
