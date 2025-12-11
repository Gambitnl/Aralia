import { describe, it, expect } from 'vitest';
import { ResistanceCalculator } from '../ResistanceCalculator';
import { CombatCharacter } from '@/types/combat';
import { DamageType } from '@/types/spells';

describe('Elemental Adept Mechanics', () => {
  // Mock Characters
  const attacker: CombatCharacter = {
    id: 'attacker-1',
    name: 'Wizard',
    featChoices: {
      'elemental_adept': {
        selectedDamageType: 'Fire'
      }
    }
  } as any;

  const attackerWithoutFeat: CombatCharacter = {
    id: 'attacker-2',
    name: 'Novice',
    featChoices: {}
  } as any;

  const resistantTarget: CombatCharacter = {
    id: 'target-1',
    name: 'Fire Demon',
    resistances: ['Fire', 'Cold'],
    immunities: ['Poison']
  } as any;

  const normalTarget: CombatCharacter = {
    id: 'target-2',
    name: 'Dummy',
    resistances: [],
    immunities: []
  } as any;

  describe('ResistanceCalculator', () => {
    it('should halve damage for resistant target normally', () => {
      const damage = ResistanceCalculator.applyResistances(
        20,
        'Fire',
        resistantTarget,
        attackerWithoutFeat
      );
      expect(damage).toBe(10); // 20 / 2 = 10
    });

    it('should bypass resistance if attacker has Elemental Adept (Fire) and deals Fire damage', () => {
      const damage = ResistanceCalculator.applyResistances(
        20,
        'Fire',
        resistantTarget,
        attacker
      );
      expect(damage).toBe(20); // Ignored resistance
    });

    it('should NOT bypass resistance if attacker has Elemental Adept (Fire) but deals Cold damage', () => {
      const damage = ResistanceCalculator.applyResistances(
        20,
        'Cold',
        resistantTarget,
        attacker
      );
      expect(damage).toBe(10); // 20 / 2 = 10 (Resistance applies)
    });

    it('should still respect immunity even with Elemental Adept', () => {
      // Assuming attacker somehow had Elemental Adept (Poison) for this test case
      const poisonAttacker: CombatCharacter = {
        ...attacker,
        featChoices: {
          'elemental_adept': { selectedDamageType: 'Poison' }
        }
      } as any;

      const damage = ResistanceCalculator.applyResistances(
        20,
        'Poison',
        resistantTarget, // Immune to Poison
        poisonAttacker
      );
      expect(damage).toBe(0); // Immunity wins
    });

    it('should handle case insensitive damage types', () => {
      const damage = ResistanceCalculator.applyResistances(
        20,
        'fire' as DamageType, // lowercase
        resistantTarget,
        attacker
      );
      expect(damage).toBe(20);
    });

    it('should handle missing caster gracefully', () => {
        const damage = ResistanceCalculator.applyResistances(
            20,
            'Fire',
            resistantTarget,
            undefined
        );
        expect(damage).toBe(10);
    });
  });
});
