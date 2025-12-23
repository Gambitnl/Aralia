/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/provenanceUtils.ts
 * Utility functions for managing item history and provenance.
 * "If they don't remember, it didn't happen." - Recorder
 */

import { Item } from '../types/items';
import { ItemProvenance, ProvenanceEventType } from '../types/provenance';
import { GameDate } from '../types/memory';

/**
 * Creates an empty provenance record for a newly created item.
 * @param creator The ID of the creator (e.g., "player_1", "npc_blacksmith").
 * @param date The current game date.
 * @returns A new ItemProvenance object.
 */
export function createProvenance(creator: string, date: GameDate): ItemProvenance {
  return {
    creator,
    createdDate: date,
    previousOwners: [],
    history: [
      {
        date,
        type: 'CRAFTED',
        description: `Created by ${creator}`,
        actorId: creator
      }
    ]
  };
}

/**
 * Adds a new event to an item's history.
 * @param item The item to update.
 * @param type The type of event.
 * @param description What happened.
 * @param date The current game date.
 * @param actorId Optional ID of the actor involved.
 * @returns A new Item object with the updated provenance.
 */
export function addProvenanceEvent(
  item: Item,
  type: ProvenanceEventType,
  description: string,
  date: GameDate,
  actorId?: string
): Item {
  const newEvent = {
    date,
    type,
    description,
    actorId
  };

  if (!item.provenance) {
      // Instead, initialize a fresh provenance object with just this new event.
      const initialProvenance: ItemProvenance = {
          creator: 'Unknown',
          createdDate: date, // Best guess
          previousOwners: [],
          history: [newEvent]
      };

      return {
          ...item,
          provenance: initialProvenance
      };
  }

  return {
    ...item,
    provenance: {
      ...item.provenance,
      history: [...item.provenance.history, newEvent]
    }
  };
}

/**
 * Generates a legendary history for a found item.
 * @param item The item to generate history for.
 * @param date The current game date (to backtrack from).
 * @returns A new Item object with a rich history.
 */
export function generateLegendaryHistory(item: Item, date: GameDate): Item {
  // Simple placeholder logic for now.
  // In the future, this could use procedural generation or AI.
  const oneYear = 1000 * 60 * 60 * 24 * 365;
  const ancientDate = date - (oneYear * 100); // 100 years ago (approx)

  const provenance: ItemProvenance = {
    creator: 'Ancient Smith',
    createdDate: ancientDate,
    previousOwners: ['The Lost King', 'General Thorne'],
    history: [
      {
        date: ancientDate,
        type: 'CRAFTED',
        description: 'Forged in the fires of the deep earth.',
        actorId: 'Ancient Smith'
      },
      {
        date: ancientDate + (oneYear * 10), // 10 years later
        type: 'USED_IN_COMBAT',
        description: 'Wielded during the Fall of the West.',
        actorId: 'The Lost King'
      },
      {
        date: date - (oneYear * 1), // 1 year ago
        type: 'FOUND',
        description: 'Discovered in the ruins.',
        actorId: 'Unknown Scavenger'
      }
    ]
  };

  return {
    ...item,
    provenance
  };
}
