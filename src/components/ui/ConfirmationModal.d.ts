/**
 * @file ConfirmationModal.tsx
 *
 * This file renders the shared yes/no confirmation dialog used when a player is
 * about to erase, overwrite, abandon, or otherwise commit to a risky action.
 * It can be opened from plain page content or from a resizable WindowFrame, so
 * it owns its own blocking overlay and focus trap instead of relying on the
 * caller's layout.
 *
 * @component-owner UI Team / Core UI
 */
import React from 'react';
interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    confirmLabel?: string;
    cancelLabel?: string;
    children: React.ReactNode;
}
/**
 * The shared yes/no confirmation dialog. Now a thin wrapper over the shared
 * {@link ModalDialog} blocking-dialog shell — this component only supplies the
 * confirm/cancel button row; the portal, dim backdrop, focus trap, and centered
 * panel all live in ModalDialog.
 */
export declare const ConfirmationModal: React.FC<ConfirmationModalProps>;
export {};
