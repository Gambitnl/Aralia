import { Feat } from '../../types';

export const FEATS_DATA: Feat[] = [
  {
    id: 'actor',
    name: 'Actor',
    description: 'Skilled at mimicry and dramatics.',
    benefits: {
        abilityScoreIncrease: { Charisma: 1 },
    }
  },
  {
    id: 'alert',
    name: 'Alert',
    description: 'Always on the lookout for danger.',
    benefits: {
        initiativeBonus: 5,
    }
  },
  {
    id: 'athlete',
    name: 'Athlete',
    description: 'Undergone extensive physical training.',
    benefits: {
        abilityScoreIncrease: { Strength: 1 }, // or Dexterity
    }
  },
  {
    id: 'charger',
    name: 'Charger',
    description: 'When you use your action to Dash, you can use a bonus action to make one melee weapon attack or to shove a creature.',
  },
  {
      id: 'dungeon_delver',
      name: 'Dungeon Delver',
      description: 'Alert to the hidden traps and secret doors found in many dungeons.',
      benefits: {
          resistance: ['traps'], // Simplified for data
      }
  },
  {
      id: 'durable',
      name: 'Durable',
      description: 'Hardy and resilient, you gain benefits when you roll Hit Dice.',
      benefits: {
          abilityScoreIncrease: { Constitution: 1 }
      }
  },
  {
      id: 'healer',
      name: 'Healer',
      description: 'You are an able physician, allowing you to mend wounds quickly and get your allies back in the fight.',
  },
  {
      id: 'lucky',
      name: 'Lucky',
      description: 'You have inexplicable luck that seems to kick in at just the right moment.',
  },
  {
      id: 'mobile',
      name: 'Mobile',
      description: 'You are exceptionally speedy and agile.',
      benefits: {
          speedIncrease: 10
      }
  },
  {
      id: 'observer',
      name: 'Observer',
      description: 'Quick to notice details of your environment.',
      benefits: {
          abilityScoreIncrease: { Intelligence: 1 }, // or Wisdom
      }
  },
  {
      id: 'resilient',
      name: 'Resilient',
      description: 'Choose one ability score. You gain proficiency in saving throws using the chosen ability.',
      benefits: {
          abilityScoreIncrease: { Constitution: 1 } // Placeholder, usually requires choice
      }
  },
  {
      id: 'tough',
      name: 'Tough',
      description: 'Your hit point maximum increases by an amount equal to twice your level when you gain this feat.',
      benefits: {
          hpMaxIncreasePerLevel: 2
      }
  }
];
