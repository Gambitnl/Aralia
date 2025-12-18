/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/data/companions.ts
 * Defines the initial data for game companions.
 */

import {
  Companion,
  CompanionGoal,
  PersonalityTraits,
  Relationship,
  RelationshipEvent,
  NPCIdentity,
  ApprovalEvent,
  CompanionReactionRule
} from '../types/companions';

const createInitialRelationship = (targetId: string = 'player'): Relationship => ({
  targetId,
  level: 'stranger',
  approval: 0,
  history: [],
  unlocks: [],
});

const KAELEN_ID: NPCIdentity = {
  id: 'kaelen_thorne',
  name: 'Kaelen "Drift" Thorne',
  race: 'Tiefling',
  class: 'Rogue',
  background: 'Criminal',
  avatarUrl: '/avatars/kaelen.png' // Placeholder
};

const KAELEN_PERSONALITY: PersonalityTraits = {
  openness: 80,       // Loves new experiences, hates routine
  conscientiousness: 20, // Very impulsive, dislikes rules
  extraversion: 60,   // Charming but guarded
  agreeableness: 30,  // Cynical, sarcastic, self-interested
  neuroticism: 40,    // Generally cool, but hides deep paranoia
  values: ['Freedom', 'Survival', 'Profit', 'Loyalty to the few'],
  fears: ['Imprisonment', 'Being controlled', 'Betrayal'],
  quirks: ['Flipping a coin when undecided', 'Checking exits constantly', 'Calls everyone "Chief"']
};

const KAELEN_GOALS: CompanionGoal[] = [
  {
    id: 'pay_debt',
    description: 'Pay off a massive debt to the Zhentarim',
    isSecret: true,
    status: 'active',
    progress: 0
  },
  {
    id: 'find_sister',
    description: 'Find out what happened to his sister in the Underdark',
    isSecret: true,
    status: 'active',
    progress: 0
  }
];

const KAELEN_REACTIONS: CompanionReactionRule[] = [
  // DECISION TRIGGERS
  {
    triggerType: 'decision',
    triggerTags: ['crime', 'theft', 'trickery'],
    approvalChange: 2,
    dialoguePool: [
      "Smooth. I like that.",
      "Five finger discount? My favorite price.",
      "Just don't get caught, Chief."
    ]
  },
  {
    triggerType: 'decision',
    triggerTags: ['charity', 'selfless'],
    approvalChange: -1,
    dialoguePool: [
      "You're giving it away? Seriously?",
      "Heroism doesn't pay the bills.",
      "Hope they remember that when you're starving."
    ]
  },
  {
    triggerType: 'decision',
    triggerTags: ['authority', 'law', 'arrest'],
    approvalChange: -3,
    dialoguePool: [
      "I smell bacon. Let's move.",
      "Never trust a badge.",
      "We shouldn't be helping them."
    ]
  },
  {
    triggerType: 'decision',
    triggerTags: ['profit', 'negotiation'],
    approvalChange: 1,
    dialoguePool: [
      "Now we're talking business.",
      "Gold talks.",
      "Smart move."
    ]
  },
  // COMBAT TRIGGERS
  {
    triggerType: 'combat_hit',
    triggerTags: ['crit', 'kill'],
    approvalChange: 0,
    dialoguePool: [
      "Bullseye!",
      "Down you go.",
      "Messy. I like it."
    ],
    chance: 0.3,
    cooldown: 5 // minutes
  },
  {
    triggerType: 'combat_hurt',
    triggerTags: ['low_hp'],
    approvalChange: 0,
    dialoguePool: [
      "Hey! Watch the merchandise!",
      "I'm bleeding here!",
      "This wasn't in the contract!"
    ],
    priority: 10
  },
  // LOOT TRIGGERS
  {
    triggerType: 'loot',
    triggerTags: ['gold', 'gem', 'jewelry'],
    approvalChange: 0,
    dialoguePool: [
      "Shiny.",
      "We splitting that 50/50?",
      "That'll fetch a nice price."
    ],
    chance: 0.5
  }
];


const ELARA_ID: NPCIdentity = {
  id: 'elara_vance',
  name: 'Elara Vance',
  race: 'Human',
  class: 'Cleric',
  background: 'Acolyte',
  avatarUrl: '/avatars/elara.png'
};

const ELARA_PERSONALITY: PersonalityTraits = {
  openness: 40,       // Prefers tradition and established lore
  conscientiousness: 90, // Extremely disciplined and dutiful
  extraversion: 70,   // Warm, community-focused
  agreeableness: 80,  // Compassionate, seeks harmony
  neuroticism: 60,    // Worries about failure and sin
  values: ['Compassion', 'Order', 'Truth', 'Redemption'],
  fears: ['Falling from grace', 'The undead', 'Chaos'],
  quirks: ['Prays at every sunrise', 'Cleans her armor obsessively', 'Cannot lie effectively']
};

const ELARA_GOALS: CompanionGoal[] = [
  {
    id: 'restore_temple',
    description: 'Restore the desecrated Temple of the Morning',
    isSecret: false,
    status: 'active',
    progress: 0
  },
  {
    id: 'save_lost_soul',
    description: 'Redeem a fallen paladin friend',
    isSecret: true,
    status: 'active',
    progress: 0
  }
];

const ELARA_REACTIONS: CompanionReactionRule[] = [
  // DECISION TRIGGERS
  {
    triggerType: 'decision',
    triggerTags: ['charity', 'healing', 'kindness'],
    approvalChange: 3,
    dialoguePool: [
      "The Light smiles upon such deeds.",
      "Thank you for showing mercy.",
      "This is what we are fighting for."
    ]
  },
  {
    triggerType: 'decision',
    triggerTags: ['crime', 'theft', 'murder'],
    approvalChange: -5,
    dialoguePool: [
      "This is wrong, and you know it.",
      "I cannot condone this.",
      "Have we lost our way?"
    ]
  },
  {
    triggerType: 'decision',
    triggerTags: ['undead', 'necromancy'],
    approvalChange: -10,
    dialoguePool: [
      "Abomination!",
      "The dead must rest.",
      "This magic is a stain on the world."
    ]
  },
  {
    triggerType: 'decision',
    triggerTags: ['prayer', 'religion'],
    approvalChange: 2,
    dialoguePool: [
      "Faith is our shield.",
      "May the gods guide us.",
      "Peace be with you."
    ]
  },
  // COMBAT TRIGGERS
  {
    triggerType: 'combat_hurt',
    triggerTags: ['low_hp'],
    approvalChange: 0,
    dialoguePool: [
      "Light preserve me...",
      "I need aid!",
      "I will not fall today!"
    ],
    priority: 10
  },
  {
    triggerType: 'combat_end',
    triggerTags: ['victory'],
    approvalChange: 0,
    dialoguePool: [
      "The dawn comes again.",
      "It is over. Are you hurt?",
      "We prevailed, thank the gods."
    ],
    chance: 0.4
  }
];

export const COMPANIONS: Record<string, Companion> = {
  [KAELEN_ID.id]: {
    id: KAELEN_ID.id,
    identity: KAELEN_ID,
    personality: KAELEN_PERSONALITY,
    goals: KAELEN_GOALS,
    relationships: {
      player: createInitialRelationship()
    },
    loyalty: 50,
    approvalHistory: [],
    reactionRules: KAELEN_REACTIONS
  },
  [ELARA_ID.id]: {
    id: ELARA_ID.id,
    identity: ELARA_ID,
    personality: ELARA_PERSONALITY,
    goals: ELARA_GOALS,
    relationships: {
      player: createInitialRelationship()
    },
    loyalty: 80, // Starts higher due to duty
    approvalHistory: [],
    reactionRules: ELARA_REACTIONS
  }
};
