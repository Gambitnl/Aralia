/**
 * @file src/services/strongholdService.ts
 * Service for managing player strongholds, staff, and daily resource updates.
 */
import { Stronghold, StrongholdType, StrongholdStaff, StaffRole, DailyUpdateSummary, StrongholdUpgrade, ActiveThreat, MissionType, StrongholdMission, MissionReward } from '../types/stronghold';
import { GameMessage } from '../types/world';
export declare const ROLE_EFFECTS: Record<StaffRole, string>;
export declare const UPGRADE_CATALOG: Record<string, StrongholdUpgrade>;
/**
 * Creates a new stronghold with initial resources.
 */
export declare const createStronghold: (name: string, type: StrongholdType, locationId: string) => Stronghold;
/**
 * Recruits a new staff member.
 */
export declare const recruitStaff: (stronghold: Stronghold, name: string, role: StaffRole) => Stronghold;
/**
 * Fires a staff member by ID.
 */
export declare const fireStaff: (stronghold: Stronghold, staffId: string) => Stronghold;
/**
 * Returns a list of upgrades available for purchase.
 * Filters out already owned upgrades and those with unmet prerequisites.
 */
export declare const getAvailableUpgrades: (stronghold: Stronghold) => StrongholdUpgrade[];
/**
 * Purchases an upgrade, deducting resources and adding it to the stronghold.
 * Currently instant build for simplicity, but designed to support queues.
 */
export declare const purchaseUpgrade: (stronghold: Stronghold, upgradeId: string) => Stronghold;
/**
 * Calculates the total defense rating of a stronghold.
 * Base defense (10) + Upgrade bonuses + Staff bonuses (Guards).
 */
export declare const calculateDefense: (stronghold: Stronghold) => number;
/**
 * Generates a random threat based on stronghold wealth and level.
 * Chance is currently fixed at 10% per call (usually daily).
 */
export declare const generateThreat: (stronghold: Stronghold) => ActiveThreat | null;
/**
 * Resolves a threat, checking defense vs severity.
 */
export declare const resolveThreat: (stronghold: Stronghold, threat: ActiveThreat) => {
    success: boolean;
    logs: string[];
};
/**
 * Starts a new mission for a staff member.
 */
export declare const startMission: (stronghold: Stronghold, staffId: string, type: MissionType, difficulty: number, description: string) => Stronghold;
/**
 * Resolves a completed mission.
 */
export declare const resolveMission: (mission: StrongholdMission, staff: StrongholdStaff) => {
    success: boolean;
    log: string;
    rewards?: MissionReward;
};
/**
 * Processes daily updates for a stronghold:
 * - Calculates income and expenses (including Upgrade effects)
 * - Pays staff (or reduces morale if unable)
 * - Processes staff departures due to low morale
 * - Handles Threats (generation and resolution)
 * - Processes Missions (progress and completion)
 */
export declare const processDailyUpkeep: (stronghold: Stronghold) => {
    updatedStronghold: Stronghold;
    summary: DailyUpdateSummary;
};
/**
 * Processes daily upkeep for all player strongholds.
 */
export declare const processAllStrongholds: (strongholds: Record<string, Stronghold>) => {
    updatedStrongholds: Record<string, Stronghold>;
    summaries: DailyUpdateSummary[];
};
/**
 * Converts stronghold daily update summaries into game messages for the log.
 */
export declare const strongholdSummariesToMessages: (summaries: DailyUpdateSummary[], gameTime: Date) => GameMessage[];
