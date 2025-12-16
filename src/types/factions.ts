/**
 * @file src/types/factions.ts
 * Type definitions for the Faction and Reputation system.
 */

export type FactionCategory =
  | 'Kingdom'
  | 'NobleHouse'
  | 'Guild'
  | 'ReligiousOrder'
  | 'Cult'
  | 'CriminalSyndicate'
  | 'MilitaryCompany'
  | 'DruidicCircle'
  | 'Academy'
  | 'Tribe'
  | 'MonsterClan';

export type FactionRelationshipType =
  | 'Ally'       // +50 to +100
  | 'Friendly'   // +20 to +50
  | 'Neutral'    // -20 to +20
  | 'Unfriendly' // -50 to -20
  | 'Hostile'    // -100 to -50
  | 'War';       // Active conflict

export interface FactionRelationship {
  targetFactionId: string;
  type: FactionRelationshipType;
  score: number; // -100 to 100
  reason?: string;
}

export interface FactionAsset {
  type: 'Stronghold' | 'Ship' | 'Relic' | 'Territory' | 'Wealth' | 'Influence';
  name: string;
  description: string;
  value: number;
}

export interface Faction {
  id: string;
  name: string;
  description: string;
  category: FactionCategory;
  leaderId?: string; // NPC ID
  homeRegionId?: string; // Location ID or Region name

  // Power & Reach
  power: number; // 0-100, abstract measure of strength
  influence: number; // 0-100, abstract measure of political sway
  wealth: number; // 0-100

  // Relationships
  relationships: Record<string, FactionRelationship>; // Key is other faction ID

  // Goals & Beliefs
  motto?: string;
  goals: string[];
  beliefs: string[];

  // Assets
  assets: FactionAsset[];

  // Color/Symbol for UI
  color: string;
  symbolIcon?: string;
}

export type PlayerReputationRank =
  | 'Nemesis'      // -100
  | 'Enemy'        // -75
  | 'Outlaw'       // -50
  | 'Untrusted'    // -25
  | 'Unknown'      // 0
  | 'Acquaintance' // 10
  | 'Associate'    // 25
  | 'Ally'         // 50
  | 'Trusted'      // 75
  | 'Champion';    // 100

export interface KnownDeed {
  id: string;
  description: string;
  date: number; // Game timestamp
  impact: number; // Reputation change amount
  witnesses?: string[]; // NPC IDs
}

export interface PlayerFactionStanding {
  factionId: string;
  reputation: number; // -100 to 100
  rank: PlayerReputationRank;
  knownDeeds: KnownDeed[];
  favorsOwed: number; // Positive means faction owes player, negative means player owes faction
}

export type WorldEventType =
  | 'WarDeclaration'
  | 'PeaceTreaty'
  | 'AllianceFormed'
  | 'Betrayal'
  | 'LeaderDeath'
  | 'NewLeader'
  | 'TerritoryChange'
  | 'EconomicBoom'
  | 'EconomicCrash'
  | 'NaturalDisaster'
  | 'Festival'
  | 'Plague'
  | 'MagicalCataclysm';

export interface WorldEvent {
  id: string;
  type: WorldEventType;
  title: string;
  description: string;
  date: number; // Game timestamp

  initiatorFactionId?: string;
  targetFactionId?: string;
  affectedRegionId?: string;

  // Impact
  powerChange?: number;
  influenceChange?: number;
  wealthChange?: number;

  // Status
  isActive: boolean;
  duration?: number; // Days
}
