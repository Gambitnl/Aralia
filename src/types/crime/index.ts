
import { Item } from '../items';
// TODO(lint-intent): 'Location' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { Location as _Location } from '../index';

export enum CrimeType {
  Theft = 'Theft',
  Assault = 'Assault',
  Murder = 'Murder',
  Trespassing = 'Trespassing',
  Vandalism = 'Vandalism',
  Smuggling = 'Smuggling',
  Forgery = 'Forgery',
}

export enum HeatLevel {
  Unknown = 0,    // No one knows you
  Suspected = 1,  // Rumors, guards watch you
  Wanted = 2,     // Active arrest on sight
  Hunted = 3,     // Bounty hunters dispatched
}

export interface StolenItem extends Item {
  originalOwnerId: string;
  stolenAt: number; // Timestamp
  value: number; // Market value
}

export interface Crime {
  id: string;
  type: CrimeType;
  locationId: string;
  timestamp: number;
  severity: number; // 1-100 scale (rescaled from 1-10 for granularity)
  witnessed: boolean;
  stolenItems?: StolenItem[];
  victimId?: string; // NPC ID
  bountyId?: string; // Linked bounty if one was issued
}

export interface Bounty {
  id: string;
  targetId: string; // Player ID (usually)
  issuerId: string; // Faction or NPC ID
  amount: number;
  conditions: 'Dead' | 'Alive' | 'DeadOrAlive';
  expiration?: number;
  isActive: boolean;
}

// --- Bounty Hunter Types ---

export enum HunterTier {
    Thug = 'Thug',           // Level 1-3, poorly equipped
    Mercenary = 'Mercenary', // Level 4-7, organized
    Elite = 'Elite'          // Level 8+, deadly, unique abilities
}

export interface HunterProfile {
    id: string;
    name: string;
    tier: HunterTier;
    className: string; // "Ranger", "Rogue", etc.
    level: number;
    specialAbilities: string[];
}

export interface AmbushEvent {
    hunter: HunterProfile;
    tier: HunterTier;
    bountiesChased: string[]; // IDs of bounties triggering this
    locationId: string;
}

export interface HeistIntel {
  id: string;
  locationId: string;
  type: 'GuardPatrol' | 'Trap' | 'SecretEntrance' | 'VaultCombination' | 'MagicWard';
  description: string;
  accuracy: number; // 0-1, how reliable this intel is
  expiration?: number; // Some intel goes stale
}

export enum HeistPhase {
  Recon = 'Recon',
  Planning = 'Planning',
  Execution = 'Execution',
  Getaway = 'Getaway',
  Cooldown = 'Cooldown'
}

export enum HeistRole {
  Leader = 'Leader',
  Infiltrator = 'Infiltrator', // Locks, Traps
  Muscle = 'Muscle',           // Guards, Intimidation
  Face = 'Face',               // Distraction, Social
  Lookout = 'Lookout',         // Alert reduction
  Driver = 'Driver'            // Getaway speed
}

export interface HeistCrewMember {
  characterId: string;
  role: HeistRole;
}

export enum HeistActionType {
  PickLock = 'PickLock',
  DisableTrap = 'DisableTrap',
  KnockoutGuard = 'KnockoutGuard',
  Distract = 'Distract',
  Hack = 'Hack',
  SecureLoot = 'SecureLoot'
}

export interface HeistAction {
  type: HeistActionType;
  difficulty: number;
  requiredRole?: HeistRole; // If performed by this role, huge bonus
  risk: number; // Alert generated on fail
  noise: number; // Alert generated on success (some actions are loud)
  description: string;
}

export interface HeistPlan {
  id: string;
  targetLocationId: string;
  phase: HeistPhase;
  leaderId: string;
  crew: HeistCrewMember[]; // Character IDs with Roles
  entryPoint?: string; // Location Exit ID
  escapeRoute?: string;
  collectedIntel: HeistIntel[];
  lootSecured: StolenItem[];
  alertLevel: number; // 0-100 during the heist
  turnsElapsed: number;
  guildJobId?: string; // Linked guild job if applicable
  maxAlertLevel: number; // Threshold for automatic failure/alarm
}

export interface BlackMarketListing {
  id: string;
  sellerId: string; // NPC ID
  item: Item;
  price: number;
  isIllegal: boolean;
  heatGenerated: number; // Risk of buying this
}

export interface Fence {
  id: string;
  npcId: string;
  locationId: string;
  gold: number;
  acceptedCategories: string[]; // e.g., "gem", "art", "weapon"
  cut: number; // 0.1 to 0.5 (percentage taken)
}

// --- Smuggling & Contraband Types ---

export enum ContrabandCategory {
  Narcotics = 'narcotics',
  DarkMagic = 'dark_magic',
  StolenGoods = 'stolen_goods', // Bulk
  ForbiddenTech = 'forbidden_tech',
  ExoticCreatures = 'exotic_creatures',
  Slaves = 'slaves'
}

export interface ContrabandDefinition {
    id: string;
    name: string;
    category: ContrabandCategory;
    baseValue: number;
    legality: Record<string, boolean>; // FactionID -> IsLegal
    weight: number;
    volume: number; // Affects concealment
}

export interface SmugglingRoute {
    id: string;
    originLocationId: string;
    destinationLocationId: string;
    baseRisk: number; // 0-100
    patrolFrequency: number; // 0-10
    inspectionStrictness: number; // 0-10 (DC modifier)
    lengthKm: number;
    controlledByFactionId?: string;
}

export enum InspectionResult {
    Pass = 'Pass',
    BribeSuccess = 'BribeSuccess',
    BribeFailure = 'BribeFailure',
    Confiscation = 'Confiscation',
    Combat = 'Combat',
    Flee = 'Flee'
}

export interface InspectionEvent {
    routeId: string;
    difficulty: number;
    guardsCount: number;
    canBribe: boolean;
    bribeCost: number;
}

// --- Thieves Guild Types ---

export enum GuildJobType {
  Burglary = 'Burglary',        // Steal specific item
  Smuggling = 'Smuggling',      // Move contraband
  Assassination = 'Assassination', // Eliminate target
  Espionage = 'Espionage',      // Gather intel
  Intimidation = 'Intimidation', // Send a message
  Protection = 'Protection'     // Guard a shipment/person
}

export interface GuildJob {
  id: string;
  guildId: string;
  title: string;
  description: string;
  type: GuildJobType;
  difficulty: number; // 1-10 scale
  requiredRank: number; // Minimum rank level to accept

  // Mission parameters
  targetLocationId: string;
  targetId?: string; // Item or NPC ID
  deadline?: number; // Timestamp

  // Rewards
  rewardGold: number;
  rewardReputation: number;
  rewardItem?: Item;

  // State
  status: 'Available' | 'Active' | 'Completed' | 'Failed';
  assignedTo?: string; // Player ID
}

export interface GuildService {
  id: string;
  name: string;
  description: string;
  type: 'Fence' | 'Forgery' | 'Safehouse' | 'Intel' | 'HeatReduction' | 'Training';
  requiredRank: number;
  costGold: number;
  cooldownHours: number; // How often it can be used
}

export interface GuildMembership {
  memberId: string; // Player ID
  guildId: string; // 'shadow_hands' etc.
  rank: number;
  reputation: number;
  activeJobs: GuildJob[];
  availableJobs: GuildJob[]; // Jobs offered but not taken
  completedJobs: string[]; // IDs of completed jobs
  servicesUnlocked: string[]; // IDs of services
}
