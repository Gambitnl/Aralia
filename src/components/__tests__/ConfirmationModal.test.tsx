import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConfirmationModal from '../ConfirmationModal';

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

    it('calls onConfirm when Enter key is pressed', () => {
        render(<ConfirmationModal {...defaultProps} />);
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});
