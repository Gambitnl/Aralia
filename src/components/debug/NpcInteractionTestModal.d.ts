/**
 * @file NpcInteractionTestModal.tsx
 * This component displays a guided test plan for the "Living NPC" system.
 */
import React from 'react';
import { Action } from '../types';
interface NpcInteractionTestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAction: (action: Action) => void;
}
declare const NpcInteractionTestModal: React.FC<NpcInteractionTestModalProps>;
export default NpcInteractionTestModal;
