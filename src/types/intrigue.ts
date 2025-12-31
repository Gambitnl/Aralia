/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/types/intrigue.ts
 * Defines types for the Intrigue domain: Secrets, Rumors, Disguises, and Leverage.
 */

import { FactionType } from './factions';

export type SecretVerificationStatus = 'rumor' | 'verified' | 'disproven';
export type SecretType = 'political' | 'criminal' | 'personal' | 'military' | 'supernatural' | 'financial';
export type SecretSeverity = 'trivial' | 'damaging' | 'ruinous' | 'existential';

/**
 * Represents a piece of hidden information.
 * If verificationStatus is 'rumor', the content may be partially incorrect.
 */
export interface Secret {
  id: string;
  subjectId: string; // ID of the Entity (NPC, Faction, Location) the secret is about
  subjectName: string; // Cache for display
  type: SecretType;
  severity: SecretSeverity;

  content: string; // The actual text of the secret

  verificationStatus: SecretVerificationStatus;
  knownBy: string[]; // IDs of entities (including player) who know this

  // Metadata for the rumor mill
  originId?: string; // Who started the rumor
  creationTimestamp: number;
  lastUpdatedTimestamp: number;

  // If true, this secret can be used as leverage
  isLeverage?: boolean;
  value: number; // Gold value or Influence weight (1-100)
}

/**
 * Represents the active application of a Secret to coerce an entity.
 */
export interface Leverage {
  id: string;
  secretId: string;
  targetId: string; // Who is being blackmailed (might be different from subject)
  demand: string; // What is being asked for
  threatLevel: number; // How likely the target is to cave (derived from Secret value)
  status: 'active' | 'spent' | 'failed' | 'countered';
}

/**
 * Represents a constructed identity used to deceive others.
 */
export interface Disguise {
  id: string;
  name: string; // The fake name
  description: string;

  // The persona being mimicked
  assumedIdentity: {
    type: 'specific_npc' | 'generic_role'; // e.g., "Countess Vane" or "A City Guard"
    factionId?: string;
    rank?: string;
  };

  quality: number; // 0-100, determines DC to spot
  vulnerabilities: string[]; // Specific triggers that might expose the disguise (e.g. "Can't speak Elvish")

  // Tracks reputation specific to this mask
  reputation: {
    [factionId: string]: number;
  };
}

/**
 * Represents a rumor currently circulating in a location.
 */
export interface ActiveRumor {
  id: string;
  secretId: string; // The underlying secret (which might be false)
  locationId: string; // Where this rumor is spreading
  virality: number; // 0-100, how fast it spreads
  credibility: number; // 0-100, how many people believe it
  modifiers: string[]; // IDs of events/actions boosting or dampening it
}
