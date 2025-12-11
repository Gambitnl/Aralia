// Core D&D Attributes
export type AbilityScoreName =
  | 'Strength'
  | 'Dexterity'
  | 'Constitution'
  | 'Intelligence'
  | 'Wisdom'
  | 'Charisma';

export interface AbilityScores {
  Strength: number;
  Dexterity: number;
  Constitution: number;
  Intelligence: number;
  Wisdom: number;
  Charisma: number;
}

export interface Skill {
  id: string;
  name: string;
  ability: AbilityScoreName;
}

export interface RacialAbilityBonus {
  ability: AbilityScoreName;
  bonus: number;
}
