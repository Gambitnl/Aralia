import { PlayerCharacter } from '../types';
export interface CharacterProficiencies {
    armor: string;
    weapons: string;
    tools: string[];
    languages: string[];
}
export declare const useCharacterProficiencies: (character: PlayerCharacter | null) => CharacterProficiencies;
