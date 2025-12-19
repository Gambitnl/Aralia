
import { describe, it, expect } from 'vitest';
import {
    initializeLegacy,
    grantTitle,
    recordMonument,
    registerHeir,
    calculateLegacyScore
} from '../legacyService';
import { PlayerLegacy } from '../../types/legacy';

describe('legacyService', () => {

    it('initializes a legacy correctly', () => {
        const legacy = initializeLegacy('Stark');
        expect(legacy.familyName).toBe('Stark');
        expect(legacy.legacyScore).toBe(0);
        expect(legacy.reputation.fame).toBe(0);
        expect(legacy.titles).toEqual([]);
    });

    it('grants a title and updates score/reputation', () => {
        let legacy = initializeLegacy('Lannister');
        const initialScore = calculateLegacyScore(legacy);

        legacy = grantTitle(legacy, 'Hand of the King', 'Advisor to the King', 'King Robert');

        expect(legacy.titles.length).toBe(1);
        expect(legacy.titles[0].name).toBe('Hand of the King');
        expect(legacy.reputation.fame).toBeGreaterThan(0);
        expect(legacy.legacyScore).toBeGreaterThan(initialScore);
    });

    it('records a monument and increases fame based on cost', () => {
        let legacy = initializeLegacy('Targaryen');
        const cost = 10000;

        legacy = recordMonument(legacy, 'The Dragon Pit', 'A massive arena', 'Kings Landing', cost);

        expect(legacy.monuments.length).toBe(1);
        expect(legacy.reputation.fame).toBe(cost / 100); // 100
        expect(legacy.legacyScore).toBeGreaterThan(0);
    });

    it('registers an heir', () => {
        let legacy = initializeLegacy('Baratheon');

        legacy = registerHeir(legacy, 'Gendry', 'Bastard Son', 18, 'Blacksmith');

        expect(legacy.heirs.length).toBe(1);
        expect(legacy.heirs[0].name).toBe('Gendry');
        expect(legacy.heirs[0].isDesignatedHeir).toBe(true); // First heir is designated

        legacy = registerHeir(legacy, 'Edric', 'Nephew', 12);
        expect(legacy.heirs[1].isDesignatedHeir).toBe(false); // Second is not
    });

    it('calculates complex legacy score correctly', () => {
        let legacy = initializeLegacy('Tyrell');

        // Add 2 titles (2 * 50 = 100)
        legacy = grantTitle(legacy, 'Title 1', 'desc');
        legacy = grantTitle(legacy, 'Title 2', 'desc');

        // Add 1 monument cost 500 (5 fame + score from monument count?)
        // calculateLegacyScore adds fame + monument cost/100?
        // Let's check logic:
        // Score += titles * 50
        // Score += monuments cost / 100
        // Score += fame

        // Current state:
        // Titles: 2 * 50 = 100
        // Fame from titles: 2 * 10 = 20

        // Add monument: cost 500
        legacy = recordMonument(legacy, 'Garden', 'desc', 'Highgarden', 500);

        // Fame from monument: 500/100 = 5
        // Total Fame: 20 + 5 = 25

        // Score breakdown:
        // Titles (2): 100
        // Strongholds (0): 0
        // Orgs (0): 0
        // Monuments (1): 5 (cost/100)
        // Reputation (Fame): 25
        // Heirs (0): 0

        // Total expected: 130

        const score = calculateLegacyScore(legacy);
        expect(score).toBe(130);
    });
});
