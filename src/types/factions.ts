/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/types/factions.ts
 * Defines types for the Faction and Reputation system, enabling nuanced political gameplay.
 */

export type FactionType =
  | 'NOBLE_HOUSE'
  | 'GUILD'
  | 'RELIGIOUS_ORDER'
  | 'CRIMINAL_SYNDICATE'
  | 'GOVERNMENT'
  | 'MILITARY'
  | 'SECRET_SOCIETY';

export type FactionRankId = string;

export interface FactionRank {
  id: FactionRankId;
  name: string;
  level: number; // 0 is outsider/initiate, higher is better
  description: string;
  perks: string[]; // IDs of perks or text descriptions
}

export interface FactionAsset {
  id: string;
  name: string;
  type: 'territory' | 'resource' | 'information' | 'personnel';
  value: number;
}

export interface Faction {
  id: string;
  name: string;
  description: string;
  type: FactionType;
  motto?: string;
  symbolIcon?: string; // Icon name
  colors: {
    primary: string;
    secondary: string;
  };
  ranks: FactionRank[];

  // Relationships with other factions
  allies: string[]; // Faction IDs
  enemies: string[]; // Faction IDs
  rivals: string[]; // Faction IDs (competitors but not open war)

  // Dynamic relationship standing with other factions (-100 to 100)
  relationships: Record<string, number>;

  // What this faction values/hates (for reputation changes)
  values: string[];
  hates: string[];
  services?: string[]; // Services offered (e.g., 'fence', 'forgery')

  // Dynamic state
  power: number; // 0-100, represents overall influence/strength
  assets: FactionAsset[]; // Territories, resources, etc.
}

export interface ReputationEvent {
  id: string;
  timestamp: number; // Game time
  change: number; // The amount changed
  newStanding: number; // Snapshot of standing after change
  reason: string;
  source?: string; // e.g. "Quest: The Big Heist"
}

export interface PlayerFactionStanding {
  factionId: string;
  publicStanding: number; // -100 to 100. visible to everyone.
  secretStanding: number; // -100 to 100. true feelings/secret deeds.
  rankId: FactionRankId;
  favorsOwed: number; // Positive: They owe player. Negative: Player owes them.
  joinedDate?: number; // Timestamp
  renown: number; // General fame within the faction
  history: ReputationEvent[]; // Chronological log of reputation changes
}

// TODO(Intriguer): Display this reputation history in the Faction Detail UI.

export interface FactionReputationChange {
  factionId: string;
  amount: number;
  type: 'public' | 'secret' | 'both';
  reason: string;
  source: string; // e.g., 'quest_completion', 'bribe', 'betrayal'
}
