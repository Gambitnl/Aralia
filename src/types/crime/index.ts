
import { Item } from '../items';
import { Location } from '../index';

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

export interface HeistPlan {
  id: string;
  targetLocationId: string;
  phase: HeistPhase;
  leaderId: string;
  crew: string[]; // Character IDs
  entryPoint?: string; // Location Exit ID
  escapeRoute?: string;
  collectedIntel: HeistIntel[];
  lootSecured: StolenItem[];
  alertLevel: number; // 0-100 during the heist
  turnsElapsed: number;
  guildJobId?: string; // Linked guild job if applicable
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
