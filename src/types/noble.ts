/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/types/noble.ts
 * Defines types for Noble Houses and their members, extending the Faction system.
 */

import { Faction } from './factions';
import { Secret } from './identity';

export type NobleRole = 'head' | 'heir' | 'spouse' | 'scion' | 'advisor' | 'bastard';

export interface NobleMember {
  id: string;
  firstName: string;
  lastName: string;
  role: NobleRole;
  age: number;

  // Stats (1-10 scale)
  stats: {
    intrigue: number;     // Ability to plot and perceive plots
    warfare: number;      // Military command and personal combat
    stewardship: number;  // Management of wealth and lands
    charm: number;        // Social influence and diplomacy
  };

  /**
   * Traits that define personality and behavior
   * e.g., "Ambitious", "Paranoid", "Hedonistic"
   */
  traits: string[];

  /**
   * ID of a secret specifically about this person.
   * Could be personal (adultery) or political (treason).
   */
  personalSecretIds: string[];
}

export interface NobleHouse extends Faction {
  type: 'NOBLE_HOUSE';

  /**
   * The family name (e.g. "Stark" for "House Stark")
   */
  familyName: string;

  /**
   * The house motto (e.g., "Winter is Coming").
   * Overrides Faction.motto to be required.
   */
  motto: string;

  /**
   * 1-10 Scale
   */
  wealth: number;
  militaryPower: number;
  politicalInfluence: number;

  members: NobleMember[];

  /**
   * Secrets HELD by the house (leverage against others).
   */
  heldSecrets: Secret[];

  /**
   * Secrets ABOUT the house (vulnerabilities).
   * These might be known by rivals or completely hidden.
   */
  houseSecrets: Secret[];
}
