/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file useMissingChoice.ts
 * @description Hook to manage missing character choices modal logic.
 */
import { PlayerCharacter, MissingChoice, AppAction } from '../types';
interface UseMissingChoiceReturn {
    missingChoiceModal: {
        isOpen: boolean;
        character: PlayerCharacter | null;
        missingChoice: MissingChoice | null;
    };
    setMissingChoiceModal: React.Dispatch<React.SetStateAction<{
        isOpen: boolean;
        character: PlayerCharacter | null;
        missingChoice: MissingChoice | null;
    }>>;
    handleFixMissingChoice: (character: PlayerCharacter, missing: MissingChoice) => void;
    handleConfirmMissingChoice: (choiceId: string, extraData?: unknown) => void;
}
export declare const useMissingChoice: (dispatch: React.Dispatch<AppAction>, addMessage: (text: string, sender?: "system" | "player" | "npc") => void) => UseMissingChoiceReturn;
export {};
