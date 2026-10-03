/**
 * @file GameGuideModal.tsx
 * A modal containing a chatbot powered by Gemini-3-Pro.
 *
 * @component-owner Narrative Team / Core UI
 */
import React from 'react';
import { AppAction } from '../../state/actionTypes';
interface GameGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
    gameContext: string;
    devModelOverride: string | null;
    onAction?: (action: AppAction) => void;
}
declare const GameGuideModal: React.FC<GameGuideModalProps>;
export default GameGuideModal;
