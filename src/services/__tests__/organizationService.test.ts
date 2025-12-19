
import { describe, it, expect } from 'vitest';
import {
    createOrganization,
    recruitMember,
    promoteMember,
    startMission,
    processDailyOrgUpdate
} from '../organizationService';
import { Organization } from '../../types/organizations';

describe('OrganizationService', () => {

    it('should create a new organization correctly', () => {
        const org = createOrganization('Thieves Guild', 'guild', 'player-1', 'stronghold-1');

        expect(org.name).toBe('Thieves Guild');
        expect(org.type).toBe('guild');
        expect(org.leaderId).toBe('player-1');
        expect(org.headquartersId).toBe('stronghold-1');
        expect(org.members).toHaveLength(0);
        expect(org.resources.gold).toBe(500);
    });

    it('should recruit a member if funds allow', () => {
        let org = createOrganization('My Org', 'company', 'p1');
        // Initial gold 500, cost 50
        org = recruitMember(org, 'Alice', 'Rogue', 3);

        expect(org.members).toHaveLength(1);
        expect(org.members[0].name).toBe('Alice');
        expect(org.members[0].rank).toBe('initiate');
        expect(org.resources.gold).toBe(450);
    });

    it('should fail to recruit if insufficient funds', () => {
        let org = createOrganization('Poor Org', 'company', 'p1');
        org.resources.gold = 10;

        expect(() => {
            recruitMember(org, 'Bob', 'Fighter');
        }).toThrow(/Not enough gold/);
    });

    it('should promote a member', () => {
        let org = createOrganization('Org', 'company', 'p1');
        org = recruitMember(org, 'Alice', 'Rogue');
        const memberId = org.members[0].id;

        org = promoteMember(org, memberId);
        expect(org.members[0].rank).toBe('member');

        org = promoteMember(org, memberId);
        expect(org.members[0].rank).toBe('officer');
    });

    it('should start a mission', () => {
        let org = createOrganization('Org', 'company', 'p1');
        org = recruitMember(org, 'Alice', 'Rogue');
        const memberId = org.members[0].id;

        org = startMission(org, 'Heist', 10, [memberId], { gold: 100 });

        expect(org.missions).toHaveLength(1);
        expect(org.missions[0].description).toBe('Heist');
        expect(org.missions[0].assignedMemberIds).toContain(memberId);
    });

    it('should fail to assign busy member to new mission', () => {
        let org = createOrganization('Org', 'company', 'p1');
        org = recruitMember(org, 'Alice', 'Rogue');
        const memberId = org.members[0].id;

        org = startMission(org, 'Heist 1', 10, [memberId], { gold: 100 });

        expect(() => {
            startMission(org, 'Heist 2', 10, [memberId], { gold: 100 });
        }).toThrow(/already on a mission/);
    });

    it('should process daily updates: wages and missions', () => {
        let org = createOrganization('Org', 'guild', 'p1'); // Guild generates income
        org = recruitMember(org, 'Alice', 'Rogue'); // Wage: 2
        const memberId = org.members[0].id;

        // Start a short mission (hack: manually set days to 1 for testing)
        org = startMission(org, 'Quick Job', 0, [memberId], { gold: 50 });
        org.missions[0].daysRemaining = 1;

        const { updatedOrg, summary } = processDailyOrgUpdate(org);

        // Wages: -2
        // Guild Income: +10 (1 member * 10)
        // Mission Reward: +50
        // Net: +58
        // Initial gold was 450 (after recruitment cost 50)
        // Expected: 450 + 58 = 508

        expect(updatedOrg.missions).toHaveLength(0); // Mission completed
        expect(updatedOrg.resources.gold).toBe(508);
        expect(summary).toContain('Gained 50 gold.');
        expect(summary).toContain('Guild business generated 10gp.');
    });
});
