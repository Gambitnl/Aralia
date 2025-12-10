
import { CombatCharacter, CombatState, ActiveEffect } from '@/types/combat';
import { SpellCommandFactory } from '@/commands/factory/SpellCommandFactory';

describe('Defender Filters Verification', () => {

    // Mock checking logic
    it('should correctly identify disadvantage based on attacker filter', () => {
        const caster = {
            id: 'caster',
            name: 'Undead Attacker',
            creatureTypes: ['Undead']
        } as CombatCharacter;

        const nonMatchingCaster = {
            id: 'normal',
            name: 'Beast Attacker',
            creatureTypes: ['Beast']
        } as CombatCharacter;

        const target = {
            id: 'target',
            name: 'Protected Defender',
            activeEffects: [{
                type: 'disadvantage_on_attacks',
                attackerFilter: { creatureTypes: ['Undead'] }
            }] as ActiveEffect[]
        } as CombatCharacter;

        // Test Match
        const shouldDisadvantage = target.activeEffects?.some(e =>
            e.type === 'disadvantage_on_attacks' &&
            SpellCommandFactory.matchesFilter(caster, e.attackerFilter)
        );
        expect(shouldDisadvantage).toBe(true);

        // Test Non-Match
        const shouldNotDisadvantage = target.activeEffects?.some(e =>
            e.type === 'disadvantage_on_attacks' &&
            SpellCommandFactory.matchesFilter(nonMatchingCaster, e.attackerFilter)
        );
        expect(shouldNotDisadvantage).toBe(false);
    });
});
