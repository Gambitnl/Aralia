import { PlayerCharacter, GameState } from '../../types/index';
export interface AbyssalCorruptionResult {
    isCorrupted: boolean;
    saveRoll: number;
    dc: number;
    effect?: AbyssalCorruptionEffect;
    message: string;
}
export interface AbyssalCorruptionEffect {
    id: string;
    name: string;
    description: string;
    mechanicalEffect: string;
    flaw: string;
}
export declare const ABYSSAL_CORRUPTION_EFFECTS: AbyssalCorruptionEffect[];
export declare class AbyssalMechanics {
    static CORRUPTION_DC: number;
    /**
     * Checks if a character succumbs to Abyssal Corruption after a long rest.
     * Rules: DC 15 Charisma save.
     * On failure: Character gains a random form of Abyssal Corruption.
     */
    static checkCorruption(character: PlayerCharacter): AbyssalCorruptionResult;
    /**
     * Applies the mechanical effect of Corruption.
     * Adds the condition to the character's condition list.
     */
    static applyCorruptionEffect(gameState: GameState, characterId: string, effect: AbyssalCorruptionEffect): void;
    /**
     * Clears Corruption effects from a character.
     * Typically happens after a Long Rest outside the Abyss or a Greater Restoration spell.
     */
    static clearCorruption(gameState: GameState, characterId: string): void;
}
