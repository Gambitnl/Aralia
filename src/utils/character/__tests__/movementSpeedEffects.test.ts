import {describe, expect, it} from 'vitest';
import {sumMovementSpeedEffects} from '../movementSpeedEffects';

describe('shared speed riders', () => {
    it('retains existing stat and legacy movement fields without changing them', () => {
        const effects = [{effect:{type:'stat_modifier',stat:'speed',value:5}}, {modifiers:{movementSpeed:3}}];
        const before = structuredClone(effects);
        expect(sumMovementSpeedEffects(effects)).toBe(8);
        expect(effects).toEqual(before);
    });

    it('keeps both sources but grants one overlapping Longstrider bonus', () => {
        const effects = [
            {name:'Longstrider',source:'Longstrider',effect:{type:'stat_modifier',stat:'speed',value:10}},
            {name:'Longstrider',source:'Longstrider',effect:{type:'stat_modifier',stat:'speed',value:10}},
        ];
        expect(sumMovementSpeedEffects(effects)).toBe(10);
        expect(effects).toHaveLength(2);
    });

    it('preserves a separate slow and unrelated equipment bonus', () => {
        expect(sumMovementSpeedEffects([
            {name:'Longstrider',source:'Longstrider',effect:{type:'stat_modifier',stat:'speed',value:10}},
            {name:'Ray of Frost',source:'Ray of Frost',effect:{type:'stat_modifier',stat:'speed',value:-10}},
            {name:'Boots',source:'Boots',modifiers:{movementSpeed:5}},
        ])).toBe(5);
    });
});
