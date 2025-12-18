import { describe, it, expect } from 'vitest';
import { getSpellWeatherModifiers } from '../weatherService';
import { WeatherState } from '../../types/weather';
import { Spell } from '../../types/spells';

describe('weatherService', () => {
    const heavyRain: WeatherState = {
        precipitation: 'heavy_rain',
        temperature: 'moderate',
        wind: { direction: 'N', speed: 'calm' },
        visibility: 'lightly_obscured'
    };

    const strongWind: WeatherState = {
        precipitation: 'none',
        temperature: 'moderate',
        wind: { direction: 'N', speed: 'strong' },
        visibility: 'clear'
    };

    const fireSpell: Spell = {
        id: 'firebolt',
        name: 'Fire Bolt',
        level: 0,
        school: 'Evocation',
        range: { type: 'ranged', distance: 120 },
        components: { verbal: true, somatic: true },
        duration: { type: 'instantaneous' },
        castingTime: { value: 1, unit: 'action' },
        effects: [{ type: 'DAMAGE', damage: { dice: '1d10', type: 'fire' }, trigger: { type: 'on_cast' }, condition: { type: 'always' } }],
        description: 'Hurts',
        classes: ['Wizard'],
        source: 'PHB'
    };

    const iceSpell: Spell = {
        id: 'ray-of-frost',
        name: 'Ray of Frost',
        level: 0,
        school: 'Evocation',
        range: { type: 'ranged', distance: 60 },
        components: { verbal: true, somatic: true },
        duration: { type: 'instantaneous' },
        castingTime: { value: 1, unit: 'action' },
        effects: [{ type: 'DAMAGE', damage: { dice: '1d8', type: 'cold' }, trigger: { type: 'on_cast' }, condition: { type: 'always' } }],
        description: 'Chilly',
        classes: ['Wizard'],
        source: 'PHB'
    };

    it('should reduce fire damage in heavy rain', () => {
        const modifiers = getSpellWeatherModifiers(fireSpell, heavyRain);
        const damageMod = modifiers.find(m => m.type === 'damage_multiplier');
        expect(damageMod).toBeDefined();
        expect(damageMod?.value).toBe(0.5);
    });

    it('should not reduce cold damage in heavy rain', () => {
        const modifiers = getSpellWeatherModifiers(iceSpell, heavyRain);
        const damageMod = modifiers.find(m => m.type === 'damage_multiplier');
        expect(damageMod).toBeUndefined();
    });

    it('should penalize ranged attacks in strong wind', () => {
        const modifiers = getSpellWeatherModifiers(fireSpell, strongWind);
        const attackMod = modifiers.find(m => m.type === 'attack_roll');
        expect(attackMod).toBeDefined();
        expect(attackMod?.value).toBe(-2);
    });
});
