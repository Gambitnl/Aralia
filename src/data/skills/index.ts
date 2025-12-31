/**
 * @file src/data/skills/index.ts
 * Defines all skill data for the Aralia RPG.
 */
// TODO(lint-intent): 'AbilityScoreName' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { Skill, AbilityScoreName as _AbilityScoreName } from '../../types';

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
