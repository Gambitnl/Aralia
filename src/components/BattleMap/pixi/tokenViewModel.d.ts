import type { CombatCharacter } from '../../../types/combat';
/** Everything the Pixi token needs to draw, matching CharacterToken.tsx:
 *  blue-400 ally / red-500 hostile rings, amber-400 selection, and the
 *  green→amber→red HP arc. Colors are Pixi hex numbers. */
export interface TokenViewModel {
    ringColor: number;
    hpPct: number;
    hpColor: number;
    label: string;
    sizeMultiplier: number;
    isDown: boolean;
}
export declare const buildTokenViewModel: (character: CombatCharacter, flags: {
    isSelected: boolean;
    isTurn: boolean;
}) => TokenViewModel;
