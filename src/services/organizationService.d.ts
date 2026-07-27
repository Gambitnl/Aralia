/**
 * @file src/services/organizationService.ts
 * Service for managing player-led organizations, members, and missions.
 */
import { Organization, OrgType, OrgResources, OrgUpgrade } from '../types/organizations';
export declare const ORG_UPGRADE_CATALOG: Record<string, OrgUpgrade>;
/**
 * Creates a new organization.
 */
export declare const createOrganization: (name: string, type: OrgType, leaderId: string, headquartersId?: string) => Organization;
/**
 * Returns available upgrades for an organization.
 */
export declare const getAvailableOrgUpgrades: (org: Organization) => OrgUpgrade[];
/**
 * Purchases an organization upgrade.
 */
export declare const purchaseOrgUpgrade: (org: Organization, upgradeId: string) => Organization;
/**
 * Recruits a new member to the organization.
 */
export declare const recruitMember: (org: Organization, name: string, memberClass: string, level?: number) => Organization;
/**
 * Promotes a member to the next rank.
 */
export declare const promoteMember: (org: Organization, memberId: string) => Organization;
/**
 * Starts a mission with assigned members.
 */
export declare const startMission: (org: Organization, description: string, difficulty: number, assignedMemberIds: string[], rewards: Partial<OrgResources>) => Organization;
/**
 * Processes daily updates for an organization.
 */
export declare const processDailyOrgUpdate: (org: Organization) => {
    updatedOrg: Organization;
    summary: string[];
};
