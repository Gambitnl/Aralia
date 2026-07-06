/**
 * This test file protects the shared confirmation dialog used for risky player
 * actions like deleting save slots or overwriting records.
 *
 * These checks focus on the visible contract: the dialog appears only when
 * requested, traps focus through the shared hook, calls the right callbacks, and
 * stays above resizable game windows so confirmations do not blend into the
 * surface that opened them.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfirmationModal } from './ConfirmationModal';
import { Z_INDEX } from '../../styles/zIndex';

describe('ConfirmationModal', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const defaultProps = {
        isOpen: true,
        onClose,
        onConfirm,
        title: 'Confirm Action',
        children: 'Are you sure?',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly when open', () => {
        render(<ConfirmationModal {...defaultProps} />);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByTestId('confirmation-modal')).toHaveStyle({ zIndex: String(Z_INDEX.CONFIRMATION_MODAL) });
        expect(screen.getByText('Confirm Action')).toBeInTheDocument();
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
        expect(screen.getByText('Confirm')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        render(<ConfirmationModal {...defaultProps} isOpen={false} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('calls onConfirm when confirm button is clicked', () => {
        render(<ConfirmationModal {...defaultProps} />);
        fireEvent.click(screen.getByText('Confirm'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when cancel button is clicked', () => {
        render(<ConfirmationModal {...defaultProps} />);
        fireEvent.click(screen.getByText('Cancel'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', () => {
        render(<ConfirmationModal {...defaultProps} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('focuses the Cancel button by default', () => {
        render(<ConfirmationModal {...defaultProps} />);
        expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    });

    it('does not call onConfirm when Enter key is pressed globally if focus is elsewhere', () => {
        render(<ConfirmationModal {...defaultProps} />);
        const cancelButton = screen.getByText('Cancel');
        cancelButton.focus();

        // Fire Enter on the document (simulating the previous global listener behavior)
        fireEvent.keyDown(document, { key: 'Enter' });

        // Should NOT trigger onConfirm because global listener is gone
        expect(onConfirm).not.toHaveBeenCalled();
    });
});
