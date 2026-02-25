/**
 * Core ability and phase primitives shared across game domains.
 */
export declare enum GamePhase {
    MAIN_MENU = 0,
    CHARACTER_CREATION = 1,
    PLAYING = 2,
    GAME_OVER = 3,
    BATTLE_MAP_DEMO = 4,
    LOAD_TRANSITION = 5,
    VILLAGE_VIEW = 6,
    COMBAT = 7,
    NOT_FOUND = 8
}
export type AbilityScoreName = 'Strength' | 'Dexterity' | 'Constitution' | 'Intelligence' | 'Wisdom' | 'Charisma';
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
    darkvision: number;
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
    speed: number;
    cr: string;
    size?: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
    alignment?: string;
    creatureTypes?: string[];
    senses?: CharacterSenses;
}
