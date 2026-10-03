/**
 * This window presents every recoverable moment in a saved journey.
 *
 * It separates short-lived rapid autosaves, longer checkpoint history, and
 * player-created chronicles so players understand what each record protects.
 * The main menu supplies slot metadata and owns the actual load/delete work;
 * this file only organizes the choices and confirms destructive deletion.
 */
import React from 'react';
import { SaveSlotSummary } from '../../services/saveLoadService';
interface LoadGameModalProps {
    slots: SaveSlotSummary[];
    onClose: () => void;
    onLoadSlot: (slotId: string) => void;
    onDeleteSlot: (slotId: string) => void;
}
/**
 * Modal for browsing and loading saves. This component focuses purely on
 * presentation/selection; persistence and side-effects remain in the caller.
 */
declare const LoadGameModal: React.FC<LoadGameModalProps>;
export default LoadGameModal;
