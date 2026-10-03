/**
 * @file MissingChoiceModal.tsx
 * A modal that prompts the user to make a specific missing choice for a character.
 *
 * Now a thin wrapper over the shared {@link ModalDialog} blocking-dialog shell —
 * this component only supplies the choice body and the confirm/cancel button row;
 * the portal, dim backdrop, focus trap, and centered panel all live in ModalDialog.
 *
 * @component-owner Gameplay Team / Core UI
 */
import React from 'react';
import { MissingChoice } from '../types';
interface MissingChoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    characterName: string;
    missingChoice: MissingChoice | null;
    onConfirm: (choiceId: string, extraData?: unknown) => void;
}
declare const MissingChoiceModal: React.FC<MissingChoiceModalProps>;
export default MissingChoiceModal;
