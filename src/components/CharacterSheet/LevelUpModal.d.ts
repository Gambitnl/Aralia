/**
 * @file LevelUpModal.tsx
 * Modal UI for confirming level-ups, including class selection and ASI/feat choices.
 */
import React from 'react';
import { LevelUpChoices, PlayerCharacter } from '../../types';
interface LevelUpModalProps {
    isOpen: boolean;
    character: PlayerCharacter | null;
    onClose: () => void;
    onConfirm: (choices: LevelUpChoices) => void;
}
declare const LevelUpModal: React.FC<LevelUpModalProps>;
export default LevelUpModal;
