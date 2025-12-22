/**
 * @file src/data/skills/index.ts
 * Defines all skill data for the Aralia RPG.
 */
import { Skill, AbilityScoreName } from '../../types';

export const SKILLS_DATA: Record<string, Skill> = {
  'acrobatics': { id: 'acrobatics', name: 'Acrobatics', ability: 'Dexterity' },
  'animal_handling': { id: 'animal_handling', name: 'Animal Handling', ability: 'Wisdom' },
  'arcana': { id: 'arcana', name: 'Arcana', ability: 'Intelligence' },
  'athletics': { id: 'athletics', name: 'Athletics', ability: 'Strength' },
  'deception': { id: 'deception', name: 'Deception', ability: 'Charisma' },
  'history': { id: 'history', name: 'History', ability: 'Intelligence' },
  'insight': { id: 'insight', name: 'Insight', ability: 'Wisdom' },
  'intimidation': { id: 'intimidation', name: 'Intimidation', ability: 'Charisma' },
  'investigation': { id: 'investigation', name: 'Investigation', ability: 'Intelligence' },
  'medicine': { id: 'medicine', name: 'Medicine', ability: 'Wisdom' },
  'nature': { id: 'nature', name: 'Nature', ability: 'Intelligence' },
  'perception': { id: 'perception', name: 'Perception', ability: 'Wisdom' },
  'performance': { id: 'performance', name: 'Performance', ability: 'Charisma' },
  'persuasion': { id: 'persuasion', name: 'Persuasion', ability: 'Charisma' },
  'religion': { id: 'religion', name: 'Religion', ability: 'Intelligence' },
  'sleight_of_hand': { id: 'sleight_of_hand', name: 'Sleight of Hand', ability: 'Dexterity' },
  'stealth': { id: 'stealth', name: 'Stealth', ability: 'Dexterity' },
  'survival': { id: 'survival', name: 'Survival', ability: 'Wisdom' },
};
