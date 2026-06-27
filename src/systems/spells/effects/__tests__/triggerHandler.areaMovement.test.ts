import { describe, expect, it } from 'vitest';
import { processAreaMoveWithinTriggers, type ActiveSpellZone } from '../triggerHandler';
import type { CombatCharacter } from '../../../../types/combat';
import type { SpellEffect } from '../../../../types/spells';

// These tests cover movement-through-zone behavior for spells such as Spike
// Growth. The important rule is that entering the area through an explicit
// movement path still counts as movement in the spell zone, not only movement
// that starts and ends fully inside it.

const movingCharacter: CombatCharacter = {
    id: 'traveler',
    name: 'Traveler',
    level: 1,
    class: {} as CombatCharacter['class'],
    position: { x: 0, y: 0 },
    stats: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
        baseInitiative: 0,
        speed: 30,
        cr: '0'
    },
    abilities: [],
    team: 'enemy',
    currentHP: 10,
    maxHP: 10,
    initiative: 0,
    statusEffects: [],
    actionEconomy: {
        action: { used: false, remaining: 1 },
        bonusAction: { used: false, remaining: 1 },
        reaction: { used: false, remaining: 1 },
        legendary: { used: 0, total: 0 },
        movement: { used: 0, total: 30 },
        freeActions: 1
    },
    activeEffects: []
};

const spikeGrowthEffect: SpellEffect = {
    type: 'DAMAGE',
    damage: {
        dice: '2d4',
        type: 'piercing'
    },
    trigger: {
        type: 'on_move_in_area'
    },
    condition: {
        type: 'always'
    },
    duration: {
        type: 'rounds',
        value: 10
    }
};

const spikeGrowthZone: ActiveSpellZone = {
    id: 'spike-growth-zone',
    spellId: 'spike-growth',
    casterId: 'druid',
    position: { x: 1, y: 0 },
    areaOfEffect: {
        shape: 'square',
        size: 15
    },
    effects: [spikeGrowthEffect],
    triggeredThisTurn: new Set(),
    triggeredEver: new Set()
};

describe('processAreaMoveWithinTriggers', () => {
    it('counts the first path step that enters a movement-triggered spell zone', () => {
        const results = processAreaMoveWithinTriggers(
            [spikeGrowthZone],
            movingCharacter,
            { x: 2, y: 0 },
            { x: 0, y: 0 },
            [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 2, y: 0 }
            ]
        );

        expect(results).toHaveLength(2);
        expect(results.every(result => result.triggerType === 'on_move_in_area')).toBe(true);
        expect(results[0].effects[0]).toMatchObject({
            type: 'damage',
            dice: '2d4',
            damageType: 'piercing',
            sourceContext: {
                spellId: 'spike-growth',
                casterId: 'druid'
            }
        });
    });
});
