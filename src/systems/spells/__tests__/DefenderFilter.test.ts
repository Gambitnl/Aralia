
import { describe, it, expect } from 'vitest';
import { ActiveEffect } from '../../types/combat';

// A minimal test to verify that the ActiveEffect type is correct and usable.
describe('Defender Filter', () => {
    it('should correctly type ActiveEffect', () => {
        const effect: ActiveEffect = {
            id: 'test-effect',
            spellId: 'spell-1',
            casterId: 'caster-1',
            sourceName: 'Test Shield',
            type: 'buff',
            duration: { type: 'rounds', value: 10 },
            startTime: 1,
            mechanics: {
                acBonus: 2,
                attackerFilter: {
                    creatureTypes: ['Undead'],
                    conditions: ['Prone']
                }
            }
        };

        expect(effect.mechanics?.acBonus).toBe(2);
        expect(effect.mechanics?.attackerFilter?.creatureTypes).toContain('Undead');
        expect(effect.mechanics?.attackerFilter?.conditions).toContain('Prone');
    });
});
