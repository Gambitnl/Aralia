
import { describe, it, expect, beforeEach } from 'vitest';
import { RitualManager } from '../RitualManager';
import { RitualBacklash, RitualConfig, RitualState } from '../../types/rituals';
import { Spell } from '../../types/spells';
import { CombatCharacter } from '../../types/combat';
import { createMockCombatCharacter } from '../../../utils/factories';

describe('RitualManager - Backlash', () => {
  const mockSpell: Spell = {
    id: 'test-spell',
    name: 'Summon Demon',
    level: 5,
    school: 'Conjuration',
    castingTime: { value: 1, unit: 'hour' },
    range: { value: 60, unit: 'feet' },
    components: { verbal: true, somatic: true },
    duration: { value: 1, unit: 'hour' },
    description: 'Summons a demon.',
    ritual: true,
  };

  const mockCaster = createMockCombatCharacter({ id: 'caster-1', name: 'Wizard' });

  const backlashConfig: RitualBacklash[] = [
    {
      type: 'damage',
      value: '4d6',
      damageType: 'necrotic',
      minProgress: 0.5,
      description: 'The pentagram flares with necrotic energy.'
    },
    {
      type: 'status',
      value: 'stunned',
      description: 'The psychic feedback stuns you.',
      minProgress: 0.0 // Always happens
    }
  ];

  it('should store backlash config in ritual state', () => {
    const ritual = RitualManager.startRitual(mockSpell, mockCaster, [], 0, { backlash: backlashConfig });
    expect(ritual.backlash).toBeDefined();
    expect(ritual.backlash?.length).toBe(2);
  });

  it('should return no backlash if none configured', () => {
    const ritual = RitualManager.startRitual(mockSpell, mockCaster, [], 0);
    const effects = RitualManager.getBacklashOnFailure(ritual);
    expect(effects).toEqual([]);
  });

  it('should return all applicable backlash effects based on progress', () => {
    // Start ritual (Total duration = 60 + 10 = 70 mins)
    let ritual = RitualManager.startRitual(mockSpell, mockCaster, [], 0, { backlash: backlashConfig });

    // Check at 0 progress
    let effects = RitualManager.getBacklashOnFailure(ritual);
    expect(effects.length).toBe(1); // Only the status effect (minProgress 0)
    expect(effects[0].type).toBe('status');

    // Advance to 30 mins (approx 42%)
    ritual = RitualManager.advanceRitual(ritual, 30);
    effects = RitualManager.getBacklashOnFailure(ritual);
    expect(effects.length).toBe(1); // Still only status

    // Advance to 40 mins (approx 57%)
    ritual = RitualManager.advanceRitual(ritual, 10);
    effects = RitualManager.getBacklashOnFailure(ritual);
    expect(effects.length).toBe(2); // Now both damage and status
    expect(effects.some(e => e.type === 'damage')).toBe(true);
  });

  it('should handle edge cases with empty backlash array', () => {
    const ritual = RitualManager.startRitual(mockSpell, mockCaster, [], 0, { backlash: [] });
    const effects = RitualManager.getBacklashOnFailure(ritual);
    expect(effects).toEqual([]);
  });
});
