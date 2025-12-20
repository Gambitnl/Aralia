/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/data/banter.ts
 * Defines the banter conversations between companions.
 */

import { BanterDefinition } from '../types/companions';

export const BANTER_DEFINITIONS: BanterDefinition[] = [
  // 1. Kaelen & Elara: Stealth vs Prayer
  {
    id: 'kaelen_elara_stealth',
    participants: ['kaelen_thorne', 'elara_vance'],
    conditions: {
      chance: 0.1, // Rare random trigger
      cooldown: 60 // 1 hour
    },
    lines: [
      {
        speakerId: 'kaelen_thorne',
        text: "You know, your armor clanks louder than a dwarf in a brewery. We're trying to be subtle here.",
        delay: 3000
      },
      {
        speakerId: 'elara_vance',
        text: "The Light does not hide, Kaelen. Nor should its champions.",
        delay: 3000
      },
      {
        speakerId: 'kaelen_thorne',
        text: "Right. Well, when the 'Light' attracts a dragon, don't ask me to hide you.",
        delay: 3000
      }
    ]
  },
  // 2. Kaelen & Elara: About Gold
  {
    id: 'kaelen_elara_gold',
    participants: ['kaelen_thorne', 'elara_vance'],
    conditions: {
      chance: 0.2,
      cooldown: 120
    },
    lines: [
      {
        speakerId: 'elara_vance',
        text: "Do you ever think of anything other than coin?",
        delay: 3000
      },
      {
        speakerId: 'kaelen_thorne',
        text: "Sure. I think about what the coin buys. Ale, beds, silence.",
        delay: 3000
      },
      {
        speakerId: 'elara_vance',
        text: "It cannot buy peace of mind.",
        delay: 2000
      },
      {
        speakerId: 'kaelen_thorne',
        text: "You clearly haven't stayed at the Gilded Rose. The pillows there? Pure peace.",
        delay: 4000
      }
    ]
  },
  // 3. Elara & Kaelen: Moral Dilemma (Triggered after a fight maybe)
  {
    id: 'kaelen_elara_violence',
    participants: ['kaelen_thorne', 'elara_vance'],
    conditions: {
        chance: 0.1,
        cooldown: 60
    },
    lines: [
        {
            speakerId: 'kaelen_thorne',
            text: "That was... messy.",
            delay: 2000
        },
        {
            speakerId: 'elara_vance',
            text: "It was necessary. Evil cannot be allowed to fester.",
            delay: 3000
        },
        {
            speakerId: 'kaelen_thorne',
            text: "Just saying, usually people pay me to do that kind of work. We're doing it for free.",
            delay: 4000
        }
    ]
  }
];
