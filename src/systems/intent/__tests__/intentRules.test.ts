/**
 * @file src/systems/intent/__tests__/intentRules.test.ts
 * Pins the three pure rules the intent reader leans on: how a proposed DC is
 * clamped, when a failure turns a scene violent, and how the people present
 * become a fightable roster.
 */
import { describe, expect, it } from 'vitest';
import { clampCheckDc, normalizeStakes, STAKES_DC_BANDS } from '../clampCheckDc';
import { shouldEscalateToCombat, HARD_FAILURE_MARGIN } from '../escalationRule';
import {
    archetypeForRole,
    crToNumber,
    deEscalationDcForRoster,
    sceneRosterToThreat,
} from '../sceneRosterToThreat';

describe('clampCheckDc', () => {
    it('keeps a sensible proposal untouched', () => {
        expect(clampCheckDc(13, 'moderate')).toBe(13);
    });

    it('pulls a wild proposal back into its stakes band', () => {
        // The model asking for DC 30 to juggle is exactly the drift this prevents.
        expect(clampCheckDc(30, 'trivial')).toBe(STAKES_DC_BANDS.trivial[1]);
        expect(clampCheckDc(2, 'serious')).toBe(STAKES_DC_BANDS.serious[0]);
    });

    it('never lets a proposal escape the authored 5..25 range', () => {
        for (const stakes of ['trivial', 'moderate', 'serious'] as const) {
            for (const proposed of [-100, 0, 1000, 26]) {
                const dc = clampCheckDc(proposed, stakes);
                expect(dc).toBeGreaterThanOrEqual(5);
                expect(dc).toBeLessThanOrEqual(25);
            }
        }
    });

    it('accepts a numeric string, because models emit them', () => {
        expect(clampCheckDc('14', 'moderate')).toBe(14);
    });

    it('falls to the band default when the proposal is unusable', () => {
        expect(clampCheckDc(undefined, 'moderate')).toBe(13);
        expect(clampCheckDc('hard', 'trivial')).toBe(8);
        expect(clampCheckDc(NaN, 'serious')).toBe(18);
    });

    it('reads the stakes word, and treats anything unrecognized as moderate', () => {
        expect(normalizeStakes('SERIOUS')).toBe('serious');
        expect(normalizeStakes(' trivial ')).toBe('trivial');
        expect(normalizeStakes('catastrophic')).toBe('moderate');
        expect(normalizeStakes(undefined)).toBe('moderate');
    });
});

describe('shouldEscalateToCombat', () => {
    it('never escalates a check that passed', () => {
        expect(shouldEscalateToCombat({
            sceneHostile: true, skill: 'Intimidation', stakes: 'serious', margin: 0,
        }).escalates).toBe(false);
    });

    it('escalates any failure in a scene that was already hostile', () => {
        expect(shouldEscalateToCombat({
            sceneHostile: true, skill: 'Persuasion', stakes: 'trivial', margin: -1,
        }).escalates).toBe(true);
    });

    it('escalates a serious provocative attempt that misses badly', () => {
        expect(shouldEscalateToCombat({
            sceneHostile: false, skill: 'Sleight of Hand', stakes: 'serious',
            margin: HARD_FAILURE_MARGIN,
        }).escalates).toBe(true);
    });

    it('spares a near miss', () => {
        expect(shouldEscalateToCombat({
            sceneHostile: false, skill: 'Intimidation', stakes: 'serious', margin: -4,
        }).escalates).toBe(false);
    });

    it('spares a hard miss on a harmless skill', () => {
        expect(shouldEscalateToCombat({
            sceneHostile: false, skill: 'Performance', stakes: 'serious', margin: -15,
        }).escalates).toBe(false);
    });

    it('spares a hard miss when nothing much was at stake', () => {
        expect(shouldEscalateToCombat({
            sceneHostile: false, skill: 'Deception', stakes: 'moderate', margin: -15,
        }).escalates).toBe(false);
    });
});

describe('sceneRosterToThreat', () => {
    it('maps a role to a real bestiary archetype', () => {
        expect(archetypeForRole('a city guard').monster).toBe('Guard');
        expect(archetypeForRole('a hired thug').monster).toBe('Thug');
        expect(archetypeForRole('the watch captain').monster).toBe('Guard Captain');
    });

    it('prefers the specific rank over the general one', () => {
        // "guard captain" contains "guard"; order in the table must settle it.
        expect(archetypeForRole('guard captain').monster).toBe('Guard Captain');
        expect(archetypeForRole('bandit captain').monster).toBe('Bandit Captain');
    });

    it('treats an ordinary townsperson as a Commoner', () => {
        expect(archetypeForRole('a flustered festival organizer').monster).toBe('Commoner');
        expect(archetypeForRole('').monster).toBe('Commoner');
        expect(archetypeForRole('an entertainer').monster).toBe('Commoner');
    });

    it('reads fractional challenge ratings', () => {
        expect(crToNumber('1/8')).toBeCloseTo(0.125);
        expect(crToNumber('3')).toBe(3);
        expect(crToNumber('')).toBe(0);
    });

    it('stacks identical archetypes into one entry', () => {
        const threat = sceneRosterToThreat(
            [
                { name: 'A', role: 'townsfolk' },
                { name: 'B', role: 'townsfolk' },
                { name: 'C', role: 'a guard' },
            ],
            'a brawl',
        );
        expect(threat?.enemies).toEqual([
            { name: 'Commoner', quantity: 2, cr: '0' },
            { name: 'Guard', quantity: 1, cr: '1/8' },
        ]);
    });

    it('returns null when nobody is present', () => {
        expect(sceneRosterToThreat([], 'x')).toBeNull();
        expect(sceneRosterToThreat([{ name: '  ', role: 'guard' }], 'x')).toBeNull();
    });

    it('scales the de-escalation DC off the toughest enemy, inside the authored band', () => {
        expect(deEscalationDcForRoster([{ name: 'Commoner', quantity: 1, cr: '0' }])).toBe(10);
        expect(deEscalationDcForRoster([{ name: 'Veteran', quantity: 1, cr: '3' }])).toBe(16);
        // A Mage at CR 6 would compute to 22, still inside 5..25.
        expect(deEscalationDcForRoster([{ name: 'Mage', quantity: 1, cr: '6' }])).toBe(22);
    });

    it('always carries a tension line, even when handed an empty one', () => {
        const threat = sceneRosterToThreat([{ name: 'A', role: 'guard' }], '   ');
        expect(threat?.tension).toBe('Violence has broken out.');
    });
});
