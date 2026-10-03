/**
 * @file src/systems/spells/effects/__tests__/spikeGrowthMoveTrigger.test.ts
 *
 * Proof for GG-204 / TODO #952: the Spike Growth per-five-feet damage now reaches
 * the runtime.
 *
 * WHY THIS EXISTS: the movement-within runtime (`processAreaMoveWithinTriggers`)
 * has always measured travel inside a zone tile by tile, but
 * `public/data/spells/level-2/spike-growth.json` carried no `on_move_in_area`
 * effect, so the spell never damaged anyone. This test drives the REAL spell
 * record off disk through the REAL `AreaEffectTracker`, so it fails again the
 * moment that data row is removed or renamed.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { AreaEffectTracker } from '../AreaEffectTracker';
import { rollDice } from '../../../dice/rollers';
import type { CombatCharacter, Position } from '../../../../types/combat';
import type { Spell, SpellEffect } from '../../../../types/spells';

const spikeGrowth: Spell = JSON.parse(
    readFileSync('public/data/spells/level-2/spike-growth.json', 'utf8')
) as Spell;

/** Every die shows its maximum face, so 2d4 resolves to 8 and 4d4 to 16. */
const maxRollRng = () => 0.999999;

function makeTraveler(position: Position): CombatCharacter {
    return {
        id: 'traveler',
        name: 'Traveler',
        level: 1,
        class: {} as CombatCharacter['class'],
        position,
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
        currentHP: 20,
        maxHP: 20,
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
    } as CombatCharacter;
}

/** Register the real spell's effects as a live zone centered on the grid origin. */
function makeTracker(): AreaEffectTracker {
    const targeting = spikeGrowth.targeting;
    // The zone geometry comes from the spell's own record, not a test constant,
    // so a future retarget of Spike Growth is caught here instead of silently
    // shrinking the proof's area.
    if (targeting.type !== 'area') {
        throw new Error(`Spike Growth must keep area targeting; found "${targeting.type}"`);
    }
    const area = targeting.areaOfEffect;

    return new AreaEffectTracker([{
        id: 'spike-growth-zone',
        spellId: spikeGrowth.id,
        casterId: 'druid',
        position: { x: 0, y: 0 },
        areaOfEffect: { shape: area.shape, size: area.size },
        effects: spikeGrowth.effects as SpellEffect[],
        triggeredThisTurn: new Set<string>(),
        triggeredEver: new Set<string>()
    }]);
}

describe('Spike Growth movement damage (GG-204 data half)', () => {
    it('carries an on_move_in_area DAMAGE row for 2d4 Piercing', () => {
        const moveRows = (spikeGrowth.effects as SpellEffect[]).filter(
            effect => effect.trigger?.type === 'on_move_in_area'
        );

        expect(moveRows).toHaveLength(1);
        expect(moveRows[0].type).toBe('DAMAGE');
        expect((moveRows[0] as { damage?: { dice: string; type: string } }).damage).toEqual({
            dice: '2d4',
            type: 'Piercing'
        });
    });

    it('leaves both original TERRAIN rows on their immediate cast trigger', () => {
        const terrainRows = (spikeGrowth.effects as SpellEffect[]).filter(
            effect => effect.type === 'TERRAIN'
        );

        expect(terrainRows).toHaveLength(2);
        for (const row of terrainRows) {
            expect(row.trigger?.type).toBe('immediate');
        }
    });

    it('deals 4d4 Piercing when a token moves 10 feet inside the area', () => {
        const tracker = makeTracker();
        const previousPosition: Position = { x: -1, y: 0 };
        const newPosition: Position = { x: 1, y: 0 };

        // Two five-foot steps, both starting and ending inside the 20-foot sphere.
        const results = tracker.processMovementWithin(
            makeTraveler(newPosition),
            newPosition,
            previousPosition,
            [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }]
        );

        const damagePackets = results
            .flatMap(result => result.effects)
            .filter(effect => effect.type === 'damage');

        // One 2d4 packet per five feet traveled == 4d4 across the ten-foot move.
        expect(damagePackets).toHaveLength(2);
        for (const packet of damagePackets) {
            expect(packet.dice).toBe('2d4');
            expect(packet.damageType).toBe('Piercing');
            expect(packet.requiresSave).toBe(false);
            expect(packet.sourceContext?.spellId).toBe('spike-growth');
        }

        const total = damagePackets.reduce(
            (sum, packet) => sum + rollDice(packet.dice!, { rng: maxRollRng }),
            0
        );

        // 4d4 at maximum is 16; the same four dice rolled as one string must match.
        expect(total).toBe(16);
        expect(total).toBe(rollDice('4d4', { rng: maxRollRng }));
    });

    it('does not charge movement that never touches the area', () => {
        const tracker = makeTracker();
        const farPosition: Position = { x: 20, y: 20 };

        const results = tracker.processMovementWithin(
            makeTraveler(farPosition),
            farPosition,
            { x: 18, y: 20 },
            [{ x: 18, y: 20 }, { x: 19, y: 20 }, { x: 20, y: 20 }]
        );

        expect(results).toHaveLength(0);
    });
});
