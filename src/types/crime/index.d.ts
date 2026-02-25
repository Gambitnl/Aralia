import { Item } from '../items';
export declare enum CrimeType {
    Theft = "Theft",
    Assault = "Assault",
    Murder = "Murder",
    Trespassing = "Trespassing",
    Vandalism = "Vandalism",
    Smuggling = "Smuggling",
    Forgery = "Forgery"
}
export declare enum HeatLevel {
    Unknown = 0,// No one knows you
    Suspected = 1,// Rumors, guards watch you
    Wanted = 2,// Active arrest on sight
    Hunted = 3
}
export interface StolenItem extends Item {
    originalOwnerId: string;
    stolenAt: number;
    value: number;
}
export interface Crime {
    id: string;
    type: CrimeType;
    locationId: string;
    timestamp: number;
    severity: number;
    witnessed: boolean;
    stolenItems?: StolenItem[];
    victimId?: string;
    bountyId?: string;
}
export interface Bounty {
    id: string;
    targetId: string;
    issuerId: string;
    amount: number;
    conditions: 'Dead' | 'Alive' | 'DeadOrAlive';
    expiration?: number;
    isActive: boolean;
}
export declare enum HunterTier {
    Thug = "Thug",// Level 1-3, poorly equipped
    Mercenary = "Mercenary",// Level 4-7, organized
    Elite = "Elite"
}
export interface HunterProfile {
    id: string;
    name: string;
    tier: HunterTier;
    className: string;
    level: number;
    specialAbilities: string[];
}
export interface AmbushEvent {
    hunter: HunterProfile;
    tier: HunterTier;
    bountiesChased: string[];
    locationId: string;
}
export interface HeistIntel {
    id: string;
    locationId: string;
    type: 'GuardPatrol' | 'Trap' | 'SecretEntrance' | 'VaultCombination' | 'MagicWard';
    description: string;
    accuracy: number;
    expiration?: number;
}
export declare enum HeistPhase {
    Recon = "Recon",
    Planning = "Planning",
    Infiltration = "Infiltration",
    Execution = "Execution",
    Escape = "Escape",
    Complete = "Complete",
    Getaway = "Getaway",
    Cooldown = "Cooldown"
}
export declare enum HeistRole {
    Leader = "Leader",
    Infiltrator = "Infiltrator",// Locks, Traps
    Muscle = "Muscle",// Guards, Intimidation
    Face = "Face",// Distraction, Social
    Lookout = "Lookout",// Alert reduction
    Driver = "Driver"
}
export interface HeistCrewMember {
    characterId: string;
    role: HeistRole;
}
export declare enum HeistActionType {
    PickLock = "PickLock",
    DisableTrap = "DisableTrap",
    KnockoutGuard = "KnockoutGuard",
    Distract = "Distract",
    Sneak = "Sneak",
    Combat = "Combat",
    Hack = "Hack",
    SecureLoot = "SecureLoot"
}
export interface HeistAction {
    type: HeistActionType;
    difficulty: number;
    requiredRole?: HeistRole;
    risk: number;
    noise: number;
    description: string;
}
export interface HeistApproach {
    type: string;
    riskModifier: number;
    timeModifier: number;
    requiredSkills: string[];
}
export interface HeistPlan {
    id: string;
    targetLocationId: string;
    phase: HeistPhase | `${HeistPhase}`;
    leaderId: string;
    participants?: string[];
    crew: HeistCrewMember[];
    entryPoint?: string;
    escapeRoute?: string;
    collectedIntel: HeistIntel[];
    intelGathered?: HeistIntel[];
    approaches?: HeistApproach[];
    selectedApproach?: HeistApproach | null;
    complications?: string[];
    lootSecured: StolenItem[];
    alertLevel: number;
    turnsElapsed: number;
    guildJobId?: string;
    maxAlertLevel: number;
}
export interface BlackMarketListing {
    id: string;
    sellerId: string;
    item: Item;
    price: number;
    isIllegal: boolean;
    heatGenerated: number;
}
export interface Fence {
    id: string;
    npcId: string;
    locationId: string;
    gold: number;
    acceptedCategories: string[];
    cut: number;
}
export declare enum ContrabandCategory {
    Narcotics = "narcotics",
    DarkMagic = "dark_magic",
    StolenGoods = "stolen_goods",// Bulk
    ForbiddenTech = "forbidden_tech",
    ExoticCreatures = "exotic_creatures",
    Slaves = "slaves"
}
export interface ContrabandDefinition {
    id: string;
    name: string;
    category: ContrabandCategory;
    baseValue: number;
    legality: Record<string, boolean>;
    weight: number;
    volume: number;
}
export interface SmugglingRoute {
    id: string;
    originLocationId: string;
    destinationLocationId: string;
    baseRisk: number;
    patrolFrequency: number;
    inspectionStrictness: number;
    lengthKm: number;
    controlledByFactionId?: string;
}
export declare enum InspectionResult {
    Pass = "Pass",
    BribeSuccess = "BribeSuccess",
    BribeFailure = "BribeFailure",
    Confiscation = "Confiscation",
    Combat = "Combat",
    Flee = "Flee"
}
export interface InspectionEvent {
    routeId: string;
    difficulty: number;
    guardsCount: number;
    canBribe: boolean;
    bribeCost: number;
}
export declare enum GuildJobType {
    Burglary = "Burglary",// Steal specific item
    Smuggling = "Smuggling",// Move contraband
    Assassination = "Assassination",// Eliminate target
    Espionage = "Espionage",// Gather intel
    Intimidation = "Intimidation",// Send a message
    Protection = "Protection"
}
export interface GuildJob {
    id: string;
    guildId: string;
    title: string;
    description: string;
    type: GuildJobType;
    difficulty: number;
    requiredRank: number;
    targetLocationId: string;
    targetId?: string;
    deadline?: number;
    rewardGold: number;
    rewardReputation: number;
    rewardItem?: Item;
    status: 'Available' | 'Active' | 'Completed' | 'Failed';
    assignedTo?: string;
}
export interface GuildService {
    id: string;
    name: string;
    description: string;
    type: 'Fence' | 'Forgery' | 'Safehouse' | 'Intel' | 'HeatReduction' | 'Training';
    requiredRank: number;
    costGold: number;
    cooldownHours: number;
}
export interface GuildMembership {
    memberId: string;
    guildId: string;
    rank: number;
    reputation: number;
    activeJobs: GuildJob[];
    availableJobs: GuildJob[];
    completedJobs: string[];
    servicesUnlocked: string[];
}
