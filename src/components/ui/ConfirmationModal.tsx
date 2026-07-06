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
import { Button } from './Button';
import { ModalDialog } from './ModalDialog';
import { UI_ID } from '../../styles/uiIds';

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
export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  children,
}) => (
  <ModalDialog
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    size="md"
    id={UI_ID.CONFIRMATION_MODAL}
    testId={UI_ID.CONFIRMATION_MODAL}
    footer={
      <>
        <Button onClick={onClose} variant="secondary" size="md">
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm} variant="action" size="md">
          {confirmLabel}
        </Button>
      </>
    }
  >
    {children}
  </ModalDialog>
);
