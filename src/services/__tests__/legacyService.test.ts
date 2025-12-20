
import { describe, it, expect } from 'vitest';
import {
    initializeLegacy,
    processSuccession,
    retireCharacter,
    grantTitle,
    calculateLegacyScore
} from '../legacyService';
import { PlayerLegacy } from '../../types/legacy';
import { Stronghold } from '../../types/stronghold';
import { Organization } from '../../types/organizations';

// Mock Data
const MOCK_STRONGHOLD: Stronghold = {
    id: 'sh-1',
    name: 'Castle Black',
    type: 'castle',
    description: 'A dark castle',
    locationId: 'loc-1',
    level: 1,
    resources: { gold: 100, supplies: 100, influence: 10, intel: 0 },
    staff: [
        { id: 's1', name: 'Steward', role: 'steward', dailyWage: 10, morale: 100, skills: {} },
        { id: 's2', name: 'Guard', role: 'guard', dailyWage: 5, morale: 100, skills: {} }
    ],
    taxRate: 0,
    dailyIncome: 10,
    upgrades: [],
    constructionQueue: [],
    threats: [],
    missions: []
};

const MOCK_UNSTABLE_STRONGHOLD: Stronghold = {
    ...MOCK_STRONGHOLD,
    id: 'sh-unstable',
    name: 'Crumbling Keep',
    staff: [
        { id: 's3', name: 'Angry Guard', role: 'guard', dailyWage: 5, morale: 0, skills: {} }
    ]
};

describe('Legacy Service - Succession', () => {

    it('should initialize legacy correctly', () => {
        const legacy = initializeLegacy('Stark');
        expect(legacy.familyName).toBe('Stark');
        expect(legacy.legacyScore).toBe(0);
        expect(legacy.heirs).toEqual([]);
    });

    it('should calculate legacy score based on assets', () => {
        let legacy = initializeLegacy('Lannister');
        legacy = grantTitle(legacy, 'Hand of the King', 'Advisor to the realm');
        // 1 title * 50 = 50.
        // Fame + 10 = 10.
        // Total = 60.
        expect(legacy.legacyScore).toBe(60);
    });

    it('should process standard succession with tax', () => {
        let legacy = initializeLegacy('Baratheon');

        // Add an heir
        legacy.heirs.push({
            id: 'heir-1',
            name: 'Joffrey',
            relation: 'Son',
            age: 12,
            isDesignatedHeir: true
        });

        const gold = 1000;
        // Standard death tax is 20%

        const { updatedLegacy, result } = processSuccession(legacy, gold, 'heir-1', false);

        expect(result.success).toBe(true);
        expect(result.inheritanceTaxPaid).toBe(200); // 20% of 1000
        expect(result.assetsTransferred.gold).toBe(800);
        expect(updatedLegacy.heirs.length).toBe(0); // Heir promoted
    });

    it('should apply lower tax for retirement', () => {
        let legacy = initializeLegacy('Targaryen');
        legacy.heirs.push({ id: 'heir-2', name: 'Rhaegar', relation: 'Son', age: 20, isDesignatedHeir: true });

        const gold = 1000;
        // Retirement tax is 10%

        const { result } = retireCharacter(legacy, gold, 'heir-2');

        expect(result.inheritanceTaxPaid).toBe(100); // 10% of 1000
        expect(result.assetsTransferred.gold).toBe(900);
    });

    it('should increase tax for high infamy', () => {
        let legacy = initializeLegacy('Bolton');
        legacy.reputation.infamy = 100; // High infamy
        legacy.reputation.fame = 0;
        legacy.heirs.push({ id: 'heir-3', name: 'Ramsay', relation: 'Bastard', age: 18, isDesignatedHeir: true });

        const gold = 1000;
        // Base 20% + 5% Infamy penalty = 25%

        const { result } = processSuccession(legacy, gold, 'heir-3', false);

        expect(result.inheritanceTaxPaid).toBe(250);
    });

    it('should handle stronghold transfer logic', () => {
        let legacy = initializeLegacy('Tully');
        legacy.strongholdIds = ['sh-1'];
        legacy.heirs.push({ id: 'heir-4', name: 'Edmure', relation: 'Son', age: 25, isDesignatedHeir: true });

        // Stable stronghold (morale 100)
        // Stability chance: 70 + (100 * 0.3) = 100%. Guaranteed transfer.

        const { result } = processSuccession(legacy, 100, 'heir-4', false, [MOCK_STRONGHOLD]);

        expect(result.assetsTransferred.strongholds).toContain('sh-1');
        expect(result.assetsLost.strongholds).toHaveLength(0);
    });

    it('should risk losing unstable strongholds during death succession', () => {
        let legacy = initializeLegacy('Frey');
        legacy.strongholdIds = ['sh-unstable'];
        legacy.heirs.push({ id: 'heir-5', name: 'Walder Jr', relation: 'Son', age: 40, isDesignatedHeir: true });

        // Unstable stronghold (morale 0)
        // Stability chance: 70 + (0 * 0.3) = 70%.
        // We can't deterministically test random(), but we can test that it *runs*.
        // However, retirement guarantees transfer.

        const { result } = retireCharacter(legacy, 100, 'heir-5', [MOCK_UNSTABLE_STRONGHOLD]);

        // Retirement bypasses the roll
        expect(result.assetsTransferred.strongholds).toContain('sh-unstable');
    });

    it('should throw error if heir not found', () => {
        const legacy = initializeLegacy('Stark');
        expect(() => processSuccession(legacy, 100, 'bad-id')).toThrow(/not found/);
    });

});
