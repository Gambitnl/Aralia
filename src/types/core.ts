/**
 * Core ability and phase primitives shared across game domains.
 */
export enum GamePhase {
  MAIN_MENU,
  CHARACTER_CREATION,
  PLAYING,
  GAME_OVER,
  BATTLE_MAP_DEMO,
  LOAD_TRANSITION,
  VILLAGE_VIEW,
  COMBAT,
  NOT_FOUND,
}

// Core D&D attributes
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

export interface CharacterSenses {
  darkvision: number; // Radius in feet (0 if none)
  blindsight: number;
  tremorsense: number;
  truesight: number;
}

export interface CharacterStats {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  baseInitiative: number;
  speed: number; // in feet
  cr: string;
  size?: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
  senses?: CharacterSenses;
}
