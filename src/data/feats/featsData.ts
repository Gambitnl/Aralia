import { Feat } from '../../types';

/**
 * Central feat catalogue. These entries intentionally focus on the
 * mechanical pieces the character builder and level-up systems need
 * (prerequisites + numerical benefits) rather than full rule text.
 */
export const FEATS_DATA: Feat[] = [
  {
    id: 'ability_score_improvement',
    name: 'Ability Score Improvement',
    description: 'Increase one ability score by 2, or two ability scores by 1 (to a max of 20).',
    benefits: {
      abilityScoreIncrease: {},
    },
  },
  {
    id: 'actor',
    name: 'Actor',
    description: 'Gain advantage on Performance and Deception checks made to adopt a persona and learn mimicry.',
    prerequisites: { abilityScores: { Charisma: 13 } },
    benefits: {
      abilityScoreIncrease: { Charisma: 1 },
      skillProficiencies: ['deception', 'performance'],
    },
  },
  {
    id: 'alert',
    name: 'Alert',
    description: 'You stay wary at all times, improving your initiative and awareness.',
    benefits: {
      initiativeBonus: 5,
    },
  },
  {
    id: 'athlete',
    name: 'Athlete',
    description: 'Conditioning improves your balance, agility, and stamina.',
    benefits: {
      abilityScoreIncrease: { Strength: 1, Dexterity: 1 },
    },
  },
  {
    id: 'charger',
    name: 'Charger',
    description: 'Harness your momentum to hit harder when dashing into melee.',
    prerequisites: { minLevel: 4 },
    benefits: {
      abilityScoreIncrease: { Strength: 1 },
    },
  },
  {
    id: 'chef',
    name: 'Chef',
    description: 'Culinary training grants you hearty meals and better stamina.',
    prerequisites: { minLevel: 4 },
    benefits: {
      abilityScoreIncrease: { Constitution: 1, Wisdom: 1 },
      hpMaxIncreasePerLevel: 1,
    },
  },
  {
    id: 'dungeon_delver',
    name: 'Dungeon Delver',
    description: 'Heightened senses help you avoid traps and hidden dangers underground.',
    prerequisites: { minLevel: 4 },
    benefits: {
      resistance: ['traps'],
      skillProficiencies: ['investigation', 'perception'],
    },
  },
  {
    id: 'durable',
    name: 'Durable',
    description: 'Hardy and resilient, you recover more health when resting.',
    benefits: {
      abilityScoreIncrease: { Constitution: 1 },
      hpMaxIncreasePerLevel: 1,
    },
  },
  {
    id: 'healer',
    name: 'Healer',
    description: 'Battlefield medicine keeps your allies in the fight.',
    benefits: {
      abilityScoreIncrease: { Wisdom: 1 },
      skillProficiencies: ['medicine'],
    },
  },
  {
    id: 'lucky',
    name: 'Lucky',
    description: 'Fortune favors you when the stakes are high.',
  },
  {
    id: 'mobile',
    name: 'Mobile',
    description: 'Exceptional speed and footwork let you dart around the battlefield.',
    benefits: {
      speedIncrease: 10,
      abilityScoreIncrease: { Dexterity: 1 },
    },
  },
  {
    id: 'observant',
    name: 'Observant',
    description: 'Attentive eyes and ears sharpen your awareness of your surroundings.',
    benefits: {
      abilityScoreIncrease: { Intelligence: 1, Wisdom: 1 },
      skillProficiencies: ['investigation', 'insight'],
    },
  },
  {
    id: 'resilient',
    name: 'Resilient',
    description: 'Bolster a saving throw of your choice.',
    benefits: {
      abilityScoreIncrease: { Constitution: 1 },
      savingThrowProficiencies: ['Constitution'],
    },
  },
  {
    id: 'skilled',
    name: 'Skilled',
    description: 'You gain proficiency in three skills of your choice.',
    benefits: {
      skillProficiencies: ['athletics', 'perception', 'insight'],
    },
  },
  {
    id: 'tough',
    name: 'Tough',
    description: 'Each time you gain this feat, your hit point maximum increases by twice your level.',
    benefits: {
      hpMaxIncreasePerLevel: 2,
    },
  },
];
