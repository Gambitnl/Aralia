import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LoadingSpinner from '../LoadingSpinner';

describe('LoadingSpinner', () => {
    it('renders with default message', () => {
        render(<LoadingSpinner />);
        expect(screen.getByText('Aralia is weaving fate...')).toBeInTheDocument();
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('renders with custom message', () => {
        const customMessage = 'Generating world...';
        render(<LoadingSpinner message={customMessage} />);
        expect(screen.getByText(customMessage)).toBeInTheDocument();
    });
});
