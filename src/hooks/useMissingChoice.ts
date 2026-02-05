/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file useMissingChoice.ts
 * @description Hook to manage missing character choices modal logic.
 */

import { useState, useCallback } from 'react';
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

export const useMissingChoice = (
  dispatch: React.Dispatch<AppAction>,
  addMessage: (text: string, sender?: 'system' | 'player' | 'npc') => void
): UseMissingChoiceReturn => {
  const [missingChoiceModal, setMissingChoiceModal] = useState<{
    isOpen: boolean;
    character: PlayerCharacter | null;
    missingChoice: MissingChoice | null;
  }>({ isOpen: false, character: null, missingChoice: null });

  const handleFixMissingChoice = useCallback((character: PlayerCharacter, missing: MissingChoice) => {
    setMissingChoiceModal({
      isOpen: true,
      character,
      missingChoice: missing
    });
  }, []);

  const handleConfirmMissingChoice = useCallback((choiceId: string, extraData?: unknown) => {
    if (missingChoiceModal.character && missingChoiceModal.missingChoice) {
      dispatch({
        type: 'UPDATE_CHARACTER_CHOICE',
        payload: {
          characterId: missingChoiceModal.character.id!,
          choiceType: missingChoiceModal.missingChoice.id,
          choiceId: choiceId,
          secondaryValue: extraData as { choices?: import('../types').LevelUpChoices; xpGained?: number; isCantrip?: boolean } | undefined,
        }
      });
      addMessage(`Updated ${missingChoiceModal.character.name}: Selected ${choiceId}.`, 'system');
    }
  }, [missingChoiceModal, dispatch, addMessage]);

  return {
    missingChoiceModal,
    setMissingChoiceModal,
    handleFixMissingChoice,
    handleConfirmMissingChoice,
  };
};
