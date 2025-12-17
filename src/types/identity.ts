/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/types/identity.ts
 * Defines types for the Identity, Disguise, and Secret systems.
 * Supports multi-layered identity, espionage, and information warfare.
 */

import type { FactionReputationChange } from './factions';

export type IdentityType = 'true' | 'alias';

/**
 * Represents a persona within the world.
 * A player has one true identity, but may have multiple aliases.
 */
export interface Identity {
  id: string;
  name: string;
  type: IdentityType;

  /**
   * The backstory or cover story for this identity.
   * For true identity, it's their actual history.
   * For aliases, it's the fabricated history.
   */
  history: string;

  /**
   * How widely known/recognized this identity is.
   * 0: Unknown/Stranger
   * 100: Famous/Infamous everywhere
   */
  fame: number;
}

/**
 * A fabricated identity with a specific cover level.
 */
export interface Alias extends Identity {
  type: 'alias';

  /**
   * How solid is the paperwork/backstory?
   * 0-100. Higher means harder to investigate.
   */
  credibility: number;

  /**
   * Regions or factions where this alias is established.
   */
  establishedIn: string[];
}

/**
 * A temporary physical alteration to appear as someone else.
 */
export interface Disguise {
  id: string;

  /**
   * The name/description of the persona being mimicked.
   * Could be "Guard Captain" (generic) or "King Alaric" (specific).
   */
  targetAppearance: string;

  /**
   * Base DC to spot the disguise.
   * Modified by situational factors.
   */
  quality: number;

  /**
   * Specific conditions that weaken or break the disguise.
   * e.g., "Speaking Elvish", "Getting wet", "Bright light"
   */
  vulnerabilities: string[];

  /**
   * If the disguise consumes resources or degrades over time.
   * null = permanent until removed.
   */
  durationRemaining?: number;
}

/**
 * Information that acts as currency in intrigue.
 */
export interface Secret {
  id: string;

  /**
   * The entity (person, faction, location) this secret is about.
   */
  subjectId: string;

  /**
   * The actual information.
   */
  content: string;

  /**
   * How reliable is this information?
   * true = confirmed fact.
   * false = rumor/hearsay.
   */
  verified: boolean;

  /**
   * The leverage value (1-10).
   * 1: Minor embarrassment.
   * 10: Kingdom-toppling scandal.
   */
  value: number;

  /**
   * IDs of entities who are known to possess this secret.
   * Important for "who leaked this?" mechanics.
   */
  knownBy: string[];

  /**
   * Categories for filtering/bonuses.
   */
  tags: ('political' | 'military' | 'personal' | 'criminal' | 'supernatural')[];
}

/**
 * The complete identity state of a player character.
 */
export interface PlayerIdentityState {
  characterId: string;

  /**
   * The character's real name and history.
   */
  trueIdentity: Identity;

  /**
   * The currently active physical disguise, if any.
   */
  activeDisguise: Disguise | null;

  /**
   * Currently assumed name/persona (could be true identity or an alias).
   * This is who NPCs think they are talking to (unless they see through it).
   */
  currentPersonaId: string;

  /**
   * List of established false identities.
   */
  aliases: Alias[];

  /**
   * Secrets the player has collected.
   */
  knownSecrets: Secret[];

  /**
   * Secrets about the player that could be used against them.
   */
  exposedSecrets: Secret[];
}

/**
 * Result of an attempt to maintain a disguise or lie.
 */
export interface IntrigueCheckResult {
  success: boolean;
  detected: boolean; // Did they realize you were lying/disguised?
  margin: number; // How much you passed/failed by
  consequences?: string[]; // Narrative consequences
  reputationChange?: FactionReputationChange;
}
