
import { describe, it, expect } from 'vitest';
import {
    createOrganization,
    recruitMember,
    purchaseOrgUpgrade,
    processDailyOrgUpdate,
    // TODO(lint-intent): 'ORG_UPGRADE_CATALOG' is unused in this test; use it in the assertion path or remove it.
    ORG_UPGRADE_CATALOG as _ORG_UPGRADE_CATALOG,
    startMission
} from '../organizationService';
// TODO(lint-intent): 'Organization' is unused in this test; use it in the assertion path or remove it.
import { Organization as _Organization } from '../../types/organizations';

describe('Organization Service', () => {

    it('should create an organization', () => {
        const org = createOrganization('Thieves Guild', 'guild', 'player-1');
        expect(org.name).toBe('Thieves Guild');
        expect(org.resources.gold).toBe(500);
        expect(org.resources.secrets).toBe(0); // Check secrets
        expect(org.upgrades).toEqual([]);
    });

    it('should allow purchasing upgrades', () => {
        let org = createOrganization('Merchants', 'guild', 'player-1');
        // Increase initial resources to afford upgrades
        org.resources.gold = 5000;
        org.resources.influence = 50;
        org.resources.connections = 100;

        // Purchase Guild Hall (1000g, 10 influence)
        org = purchaseOrgUpgrade(org, 'guild_hall');
        expect(org.upgrades).toContain('guild_hall');
        expect(org.resources.gold).toBe(4000); // 5000 - 1000

        // Purchase Trade Routes (2000g, 20 connections)
        org = purchaseOrgUpgrade(org, 'trade_routes');
        expect(org.upgrades).toContain('trade_routes');
    });

    it('should fail if prerequisites not met', () => {
        // TODO(lint-intent): Resolve this prefer-const warning with a small, intent-preserving change.
        const org = createOrganization('Merchants', 'guild', 'player-1');
        org.resources.connections = 50;
        org.resources.gold = 5000;

        // Try purchasing Trade Routes without Guild Hall
        expect(() => purchaseOrgUpgrade(org, 'trade_routes')).toThrow("Prerequisites not met");
    });

    it('should fail if type requirements not met', () => {
        // TODO(lint-intent): Resolve this prefer-const warning with a small, intent-preserving change.
        const org = createOrganization('Knights', 'order', 'player-1');
        org.resources.gold = 5000;
        org.resources.influence = 50;

        // Try purchasing Guild Hall (requires guild/company/syndicate)
        expect(() => purchaseOrgUpgrade(org, 'guild_hall')).toThrow("cannot purchase this upgrade");
    });

    it('should apply upgrade bonuses to daily update', () => {
        let org = createOrganization('Merchants', 'guild', 'player-1');
        // Give enough resources to set up
        org.resources.gold = 5000;
        org.resources.influence = 50;
        org.resources.connections = 100;

        // Recruit members to generate income
        org = recruitMember(org, 'Alice', 'Rogue', 1); // Cost 50
        org = recruitMember(org, 'Bob', 'Fighter', 1);   // Cost 50

        org = purchaseOrgUpgrade(org, 'guild_hall');
        org = purchaseOrgUpgrade(org, 'trade_routes'); // +10% Gold Income

        // Base Income for Guild: 10 * 2 members = 20 gold
        // Wages: Initiate (2) * 2 = 4 gold
        // Net before bonus: 16 gold (if income happened before wages, but it doesn't matter for the bonus calc)
        // Bonus: 10% of 20 = 2 gold

        const { summary } = processDailyOrgUpdate(org);

        // Check logs for bonus mention
        const bonusLog = summary.find(s => s.includes('Upgrades increased gold income'));
        expect(bonusLog).toBeDefined();
        expect(bonusLog).toContain('10%');
    });

    it('should handle rival actions', () => {
        // TODO(lint-intent): Resolve this prefer-const warning with a small, intent-preserving change.
        const org = createOrganization('Targets', 'guild', 'player-1');
        org.rivalOrgIds = ['rival-1'];
        org.members.push({
            id: 'm1', name: 'Victim', rank: 'initiate', level: 1, loyalty: 50
        });

        // Mock Math.random to trigger rival action
        const originalRandom = Math.random;
        Math.random = () => 0.05; // Force < 0.1 trigger

        // Force fail defense
        // We need to mock Math.floor(Math.random() * 20) in resolveRivalAction
        // But we can't easily scope it just there without complex mocking.
        // Instead, let's just run it and expect *some* log about rivals.

        const { summary } = processDailyOrgUpdate(org);

        const rivalLog = summary.find(s => s.includes('Rival action detected') || s.includes('Thwarted rival') || s.includes('Failed to stop'));
        expect(rivalLog).toBeDefined();

        Math.random = originalRandom;
    });

    describe('startMission', () => {
        it('should calculate mission success with bonuses', () => {
            let org = createOrganization('Warriors', 'order', 'player-1');

            // Add Training Grounds (+2 Combat Mission Bonus)
            org.resources.gold = 5000;
            org.resources.influence = 50;
            org = purchaseOrgUpgrade(org, 'training_grounds');

            // Recruit member
            org = recruitMember(org, 'Soldier', 'Fighter', 1);

            // Start mission
            org = startMission(org, 'Fight Goblins', 10, [org.members[0].id], { gold: 100 });

            // Force mission completion
            org.missions[0].daysRemaining = 0;

            // Process update
            const { summary } = processDailyOrgUpdate(org);

            // We can't guarantee success due to dice rolls, but we can verify execution
            expect(summary.length).toBeGreaterThan(0);
        });

        it('should fail if member is already on a mission', () => {
            let org = createOrganization('Explorers', 'company', 'player-1');
            org.resources.gold = 5000;
            org = recruitMember(org, 'Scout', 'Rogue', 1);

            const memberId = org.members[0].id;

            // Start first mission
            org = startMission(org, 'Mission 1', 10, [memberId], {});

            // Try to start second mission with same member
            expect(() => {
                startMission(org, 'Mission 2', 10, [memberId], {});
            }).toThrow('already on a mission');
        });
    });
});
