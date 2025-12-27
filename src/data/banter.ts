/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/data/banter.ts
 * Defines the banter dialogues between companions.
 */

import { BanterDefinition } from '../types/companions';

export const BANTER_DEFINITIONS: BanterDefinition[] = [
  // ---------------------------------------------------------------------------
  // GENERAL TRAVEL (KAELEN & ELARA)
  // ---------------------------------------------------------------------------
  {
    id: 'kaelen_elara_boots',
    participants: ['kaelen_thorne', 'elara_vance'],
    conditions: {
      chance: 0.1, // Rare
      cooldown: 60 // 1 hour
    },
    lines: [
      {
        speakerId: 'kaelen_thorne',
        text: "You know, for a holy woman, you walk louder than an ogre in plate armor.",
        delay: 3000
      },
      {
        speakerId: 'elara_vance',
        text: "The Light does not require stealth, Kaelen. It requires presence.",
        delay: 3000
      },
      {
        speakerId: 'kaelen_thorne',
        text: "Right. Well, 'The Light' is going to get us eaten by wolves if you don't pick up your feet.",
        delay: 3000
      }
    ]
  },
  {
    id: 'kaelen_elara_prayers',
    participants: ['kaelen_thorne', 'elara_vance'],
    conditions: {
      chance: 0.1,
      cooldown: 120 // 2 hours
    },
    lines: [
      {
        speakerId: 'kaelen_thorne',
        text: "Do you ever stop mumbling? It's distracting.",
        delay: 3000
      },
      {
        speakerId: 'elara_vance',
        text: "I am reciting the Verses of Protection. You should be grateful.",
        delay: 3000
      },
      {
        speakerId: 'kaelen_thorne',
        text: "I'd be more grateful for a bit of quiet. Or wine. Ideally both.",
        delay: 3000
      }
    ]
  },
  {
    id: 'kaelen_elara_ethics',
    participants: ['kaelen_thorne', 'elara_vance'],
    conditions: {
      chance: 0.1,
      cooldown: 240
    },
    lines: [
      {
        speakerId: 'elara_vance',
        text: "I saw you eyeing that merchant's purse back in town.",
        delay: 3000
      },
      {
        speakerId: 'kaelen_thorne',
        text: "I was merely assessing the local economy. Professional curiosity.",
        delay: 3000
      },
      {
        speakerId: 'elara_vance',
        text: "Theft is a sin, Kaelen.",
        delay: 2000
      },
      {
        speakerId: 'kaelen_thorne',
        text: "And hunger is a tragedy. I prefer the sin.",
        delay: 3000
      }
    ]
  },
  // ---------------------------------------------------------------------------
  // LOCATION SPECIFIC (FOREST)
  // ---------------------------------------------------------------------------
  {
    id: 'kaelen_forest_spiders',
    participants: ['kaelen_thorne'],
    conditions: {
      locationId: 'forest_clearing', // Example ID, might need to match biome in future
      chance: 0.3
    },
    lines: [
      {
        speakerId: 'kaelen_thorne',
        text: "Webs. Why is it always webs? If I see one giant spider, I'm burning this whole forest down.",
        delay: 4000
      }
    ]
  },
  // ---------------------------------------------------------------------------
  // SITUATIONAL
  // ---------------------------------------------------------------------------
  {
    id: 'elara_ruins_history',
    participants: ['elara_vance'],
    conditions: {
      locationId: 'ancient_ruins_entrance',
      chance: 1.0, // Always triggers first time (handled by cooldown logic usually)
      cooldown: 99999 // Once per game essentially
    },
    lines: [
      {
        speakerId: 'elara_vance',
        text: "This stone... it dates back to the Second Era. Before the Fall.",
        delay: 3000
      },
      {
        speakerId: 'elara_vance',
        text: "We must tread carefully. The spirits here have not slept well.",
        delay: 3000
      }
    ]
  },
  {
    id: 'kaelen_ruins_treasure',
    participants: ['kaelen_thorne'],
    conditions: {
      locationId: 'ruins_courtyard',
      chance: 0.5
    },
    lines: [
      {
        speakerId: 'kaelen_thorne',
        text: "Smell that? Dust, mold, and... yes. Definitely gold. Somewhere.",
        delay: 3000
      }
    ]
  }
];
