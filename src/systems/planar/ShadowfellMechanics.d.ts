import { PlayerCharacter, GameState } from '../../types';
export interface DespairCheckResult {
    hasDespair: boolean;
    saveRoll: number;
    dc: number;
    effect?: ShadowfellDespairEffect;
    message: string;
}
export interface ShadowfellDespairEffect {
    id: string;
    name: string;
    description: string;
    mechanicalEffect: string;
}
export declare const DESPAIR_EFFECTS: ShadowfellDespairEffect[];
export declare class ShadowfellMechanics {
    static DESPAIR_DC: number;
    /**
     * Checks if a character succumbs to Shadowfell Despair after a long rest.
     * Rules: DC 15 Wisdom save.
     * On failure: Roll 1d6 (simplified to 1d3 for 3 effects) to determine effect.
     * Effect lasts until the next long rest outside the Shadowfell or Calm Emotions.
     */
    static checkDespair(character: PlayerCharacter): DespairCheckResult;
    /**
     * Applies the mechanical effect of Despair.
     * Adds the condition to the character's condition list if not present.
     */
    static applyDespairEffect(gameState: GameState, characterId: string, effect: ShadowfellDespairEffect): void;
    /**
     * Clears Despair effects from a character (e.g., after Long Rest outside Shadowfell).
     */
    static clearDespair(gameState: GameState, characterId: string): void;
}
