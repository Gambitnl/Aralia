/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/types/provenance.ts
 * Defines the types for tracking the history and origin of items.
 * "If they don't remember, it didn't happen." - Recorder
 */

import { GameDate } from './memory';

export type ProvenanceEventType =
  | 'CRAFTED'
  | 'FOUND'
  | 'STOLEN'
  | 'SOLD'
  | 'USED_IN_COMBAT' // e.g., "Killed the Goblin King"
  | 'ENCHANTED'
  | 'DAMAGED'
  | 'REPAIRED'
  | 'GIFTED';

export interface ProvenanceEvent {
  date: GameDate; // Game timestamp
  type: ProvenanceEventType;
  description: string;
  actorId?: string; // Who did this?
  locationId?: string; // Where did it happen?
}

export interface ItemProvenance {
  /** Who originally created this item */
  creator: string;
  /** When it was created (game timestamp) */
  createdDate: GameDate;
  /** The original name given by the creator */
  originalName?: string;
  /** List of previous notable owners */
  previousOwners: string[];
  /** Chronological history of the item */
  history: ProvenanceEvent[];
}
