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
  // TODO(lint-intent): 'RelationshipEvent' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  RelationshipEvent as _RelationshipEvent,
  NPCIdentity,
  // TODO(lint-intent): 'ApprovalEvent' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  ApprovalEvent as _ApprovalEvent,
  CompanionReactionRule,
  RelationshipUnlock
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
  sex: 'Male',
  age: 'Late 20s',
  physicalDescription: 'Lean and wiry with charcoal-grey skin and small, swept-back obsidian horns. He has a jagged scar across his jaw and intense amber eyes that never stop scanning. He wears dark, practical leathers that have seen better days.',
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

const KAELEN_PROGRESSION: RelationshipUnlock[] = [
  {
    id: 'kaelen_streetwise',
    type: 'passive',
    description: 'Streetwise: +5% Gold found in loot.',
    isUnlocked: false,
    requiredLevel: 'acquaintance'
  },
  {
    id: 'kaelen_cheap_shot',
    type: 'ability',
    description: 'Cheap Shot: Once per combat, Kaelen deals bonus damage to distracted foes.',
    isUnlocked: false,
    requiredLevel: 'friend'
  },
  {
    id: 'kaelen_underdark_path',
    type: 'quest',
    description: 'Quest: The Smuggler\'s Route (Unlocks hidden travel paths)',
    isUnlocked: false,
    requiredLevel: 'close'
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
  },
  // CRIME TRIGGERS
  {
    triggerType: 'crime_committed',
    triggerTags: ['theft', 'burglary'],
    approvalChange: 2,
    dialoguePool: [
      "Nice sleight of hand.",
      "Five finger discount?",
      "Just don't get caught."
    ]
  },
  {
    triggerType: 'crime_committed',
    triggerTags: ['murder', 'severe'],
    approvalChange: -2,
    dialoguePool: [
      "Woah, easy there Chief.",
      "That was... excessive.",
      "I'm all for profit, but that's just messy."
    ]
  },
  {
    triggerType: 'crime_committed',
    triggerTags: ['witnessed'],
    approvalChange: -1,
    dialoguePool: [
      "Great. Now we have heat.",
      "You were supposed to be subtle!",
      "Run now, explain later!"
    ]
  }
];


const ELARA_ID: NPCIdentity = {
  id: 'elara_vance',
  name: 'Elara Vance',
  race: 'Human',
  class: 'Cleric',
  background: 'Acolyte',
  sex: 'Female',
  age: 32,
  physicalDescription: 'Tall and athletic with a posture that commands respect. She has silver-blonde hair kept in a strict braid and striking sea-blue eyes. She wears polished half-plate armor emblazoned with the sun-disk of her order, looking every bit the disciplined soldier of the faith.',
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

const ELARA_PROGRESSION: RelationshipUnlock[] = [
  {
    id: 'elara_blessed_water',
    type: 'item',
    description: 'Blessed Water: Elara gifts you a potion of healing.',
    isUnlocked: false,
    requiredLevel: 'acquaintance'
  },
  {
    id: 'elara_guardians_prayer',
    type: 'passive',
    description: 'Guardian\'s Prayer: +1 AC to nearby allies.',
    isUnlocked: false,
    requiredLevel: 'friend'
  },
  {
    id: 'elara_divine_intervention',
    type: 'ability',
    description: 'Ability: Divine Intervention (Once per week)',
    isUnlocked: false,
    requiredLevel: 'devoted'
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
  },
  // CRIME TRIGGERS
  {
    triggerType: 'crime_committed',
    triggerTags: ['theft', 'burglary'],
    approvalChange: -3,
    dialoguePool: [
      "Thou shalt not steal.",
      "Return that at once!",
      "This is beneath us."
    ]
  },
  {
    triggerType: 'crime_committed',
    triggerTags: ['murder', 'assault', 'severe'],
    approvalChange: -10,
    dialoguePool: [
      "By the Light... what have you done?!",
      "I cannot walk with a murderer.",
      "You have blood on your hands."
    ]
  }
];

export const COMPANIONS: Record<string, Companion> = {
  [KAELEN_ID.id]: {
    id: KAELEN_ID.id,
    identity: KAELEN_ID,
    personality: KAELEN_PERSONALITY,
    goals: KAELEN_GOALS,
    progression: KAELEN_PROGRESSION,
    relationships: {
      player: createInitialRelationship()
    },
    loyalty: 50,
    approvalHistory: [],
    memories: [],
    // TODO(2026-01-03 pass 6 Codex-CLI): Keep discoveredFacts as a placeholder until companion lore tracking is fully typed.
    discoveredFacts: [],
    reactionRules: KAELEN_REACTIONS
  },
  [ELARA_ID.id]: {
    id: ELARA_ID.id,
    identity: ELARA_ID,
    personality: ELARA_PERSONALITY,
    goals: ELARA_GOALS,
    progression: ELARA_PROGRESSION,
    relationships: {
      player: createInitialRelationship()
    },
    loyalty: 80, // Starts higher due to duty
    approvalHistory: [],
    memories: [],
    // TODO(2026-01-03 pass 6 Codex-CLI): Keep discoveredFacts as a placeholder until companion lore tracking is fully typed.
    discoveredFacts: [],
    reactionRules: ELARA_REACTIONS
  }
};
