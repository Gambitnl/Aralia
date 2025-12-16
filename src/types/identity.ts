/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/types/identity.ts
 * Defines types for the Identity, Disguise, and Alias system.
 * Enables players to assume different personas, impacting how factions and NPCs perceive them.
 */

export type DisguiseQuality = 'poor' | 'average' | 'good' | 'masterwork' | 'magical';

export interface DisguiseVulnerability {
  id: string;
  description: string;
  trigger: 'speech' | 'combat' | 'magic' | 'inspection' | 'time';
  detectionBonus: number; // Bonus to NPC's Perception/Insight when triggered
}

export interface Alias {
  id: string;
  name: string;
  background: string; // Brief backstory/cover
  reputation: Record<string, number>; // Faction ID -> Standing (specific to this alias)
  isExposed: boolean; // If true, this alias is known to be the player
  createdAt: number;
}

export interface Disguise {
  id: string;
  aliasId: string; // The persona being adopted
  quality: DisguiseQuality;
  visualDescription: string;
  vulnerabilities: DisguiseVulnerability[];
  timeDonned: number;
  timeLimit?: number; // In minutes, optional (e.g., for magical disguises)
}

export interface PlayerIdentityState {
  currentIdentityId: string; // 'true_self' or an aliasId
  aliases: Alias[];
  activeDisguise: Disguise | null;
  knownTo: Record<string, string[]>; // NPC ID -> List of Identity IDs they know belong to the player
}

export interface DisguiseCheckResult {
  success: boolean;
  detectedBy: string[]; // IDs of NPCs who saw through it
  roll: number;
  dc: number;
  consequences?: string[];
}
