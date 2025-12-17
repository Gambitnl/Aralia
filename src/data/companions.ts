/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/data/companions.ts
 * Defines the initial data for game companions.
 */

import { Companion, CompanionGoal, PersonalityTraits, Relationship, RelationshipEvent, NPCIdentity, ApprovalEvent } from '../types/companions';

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
    approvalHistory: []
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
    approvalHistory: []
  }
};
