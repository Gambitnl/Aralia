import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MainMenu from '../MainMenu';

// Mock child components
vi.mock('../LoadGameModal', () => ({
    default: ({ onClose }: { onClose: () => void }) => (
        <div role="dialog" aria-label="Load Game Modal">
            <button onClick={onClose}>Close</button>
        </div>
    ),
}));

vi.mock('../SaveSlotSelector', () => ({
    default: ({ onClose }: { onClose: () => void }) => (
        <div role="dialog" aria-label="Save Slot Selector">
            <button onClick={onClose}>Close</button>
        </div>
    ),
}));

vi.mock('../VersionDisplay', () => ({
    VersionDisplay: () => <div>Version 1.0</div>,
}));

vi.mock('../services/saveLoadService', () => ({
    getSaveSlots: vi.fn(() => []),
    deleteSaveGame: vi.fn(),
}));

describe('MainMenu', () => {
    const defaultProps = {
        onNewGame: vi.fn(),
        onLoadGame: vi.fn(),
        onShowCompendium: vi.fn(),
        hasSaveGame: false,
        latestSaveTimestamp: null,
        isDevDummyActive: false,
        onSkipCharacterCreator: vi.fn(),
        onSaveGame: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the title and basic buttons', () => {
        render(<MainMenu {...defaultProps} />);
        expect(screen.getByText('Aralia RPG')).toBeInTheDocument();
        expect(screen.getByText('New Game')).toBeInTheDocument();
        expect(screen.getByText('Load Game')).toBeInTheDocument();
        expect(screen.getByText('Glossary')).toBeInTheDocument();
    });

    it('calls onNewGame when New Game button is clicked', () => {
        render(<MainMenu {...defaultProps} />);
        fireEvent.click(screen.getByText('New Game'));
        expect(defaultProps.onNewGame).toHaveBeenCalledTimes(1);
    });

    it('calls onShowCompendium when Glossary button is clicked', () => {
        render(<MainMenu {...defaultProps} />);
        fireEvent.click(screen.getByText('Glossary'));
        expect(defaultProps.onShowCompendium).toHaveBeenCalledTimes(1);
    });

    it('shows Continue button when a save exists', () => {
        render(<MainMenu {...defaultProps} hasSaveGame={true} latestSaveTimestamp={Date.now()} />);
        expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    it('calls onLoadGame when Continue button is clicked', () => {
        render(<MainMenu {...defaultProps} hasSaveGame={true} latestSaveTimestamp={Date.now()} />);
        fireEvent.click(screen.getByText('Continue'));
        expect(defaultProps.onLoadGame).toHaveBeenCalledTimes(1);
    });

    it('shows Skip Character Creator button when in dev mode', () => {
        render(<MainMenu {...defaultProps} isDevDummyActive={true} />);
        expect(screen.getByText('Skip Character Creator (Dev)')).toBeInTheDocument();
    });

    it('opens LoadGameModal when Load Game button is clicked', () => {
        render(<MainMenu {...defaultProps} hasSaveGame={true} />); // Enable button
        fireEvent.click(screen.getByText('Load Game'));
        expect(screen.getByRole('dialog', { name: 'Load Game Modal' })).toBeInTheDocument();
    });

    it('opens SaveSlotSelector when Save to Slot button is clicked', () => {
        render(<MainMenu {...defaultProps} />);
        fireEvent.click(screen.getByText('Save to Slot'));
        expect(screen.getByRole('dialog', { name: 'Save Slot Selector' })).toBeInTheDocument();
    });
});
