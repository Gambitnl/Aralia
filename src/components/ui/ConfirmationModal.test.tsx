import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfirmationModal } from './ConfirmationModal';

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

    it('focuses the Confirm button by default', () => {
        render(<ConfirmationModal {...defaultProps} />);
        expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();
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
