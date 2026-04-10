/**
 * @file MainMenu.test.tsx
 * This test file covers the player-facing main menu surface.
 *
 * The important session-specific change recorded here is that the old standalone
 * "Quick Start (Dev)" button is no longer expected on the main menu itself.
 * That action was folded into the shared Dev Menu, so this test now protects the
 * visible rule that the main menu only exposes one developer entry point.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MainMenu from '../layout/MainMenu';

// ============================================================================
// Mocked Child Surfaces
// ============================================================================
// The main menu delegates save/load dialogs and the version badge to other UI
// components. These tests replace them with small stand-ins so the assertions
// can stay focused on the menu's own button surface and wiring.
// ============================================================================
vi.mock('../SaveLoad', () => ({
    LoadGameModal: ({ onClose }: { onClose: () => void }) => (
        <div role="dialog" aria-label="Resume Journey Modal">
            <button onClick={onClose}>Close</button>
        </div>
    ),
    SaveSlotSelector: ({ onClose }: { onClose: () => void }) => (
        <div role="dialog" aria-label="Chronicle Journey Selector">
            <button onClick={onClose}>Close</button>
        </div>
    ),
}));

vi.mock('../VersionDisplay', () => ({
    VersionDisplay: () => <div>Version 1.0</div>,
}));

// The save service is mocked because these tests only care about what the menu
// renders when save metadata exists, not about exercising persistence itself.
vi.mock('../services/saveLoadService', () => ({
    getSaveSlots: vi.fn(() => []),
    deleteSaveGame: vi.fn(),
}));
// TODO: Add test case where getSaveSlots returns actual save data to verify
// Continue button text formatting and latestSlot sorting logic.

// ============================================================================
// Text Fixture Layer
// ============================================================================
// The menu uses translated labels, but the tests need stable English text so the
// assertions do not depend on the full i18n pipeline.
// ============================================================================
vi.mock('../utils/i18n', () => ({
    t: (key: string) => {
        const translations: Record<string, string> = {
            'main_menu.title': 'Aralia RPG',
            'main_menu.new_game': 'New Game',
            'main_menu.load_game': 'Load Game',
            'main_menu.load_game_aria': 'Load Game',
            'main_menu.load_game_empty_aria': 'Load Game (Empty)',
            'main_menu.save_to_slot': 'Save Game',
            'main_menu.glossary': 'Lore & Rules',
            'main_menu.continue': 'Continue',
            'main_menu.skip_character_creator': 'Quick Start (Dev)',
            'main_menu.back': 'Back',
            'main_menu.powered_by': 'Powered by Gemini',
            'main_menu.last_played': 'Last played: {date}'
        };
        return translations[key] || key;
    }
}));

// ============================================================================
// Main Menu Behavior Coverage
// ============================================================================
// These tests lock the visible button surface and action wiring. This is where
// we protect session decisions like "Quick Start moves into Dev Menu" so that a
// future refactor does not silently drift the main menu back into two separate
// developer entry points.
// ============================================================================
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
        // The regular player-facing buttons should still appear regardless of the
        // dev-only restructuring that happened in this session.
        render(<MainMenu {...defaultProps} />);
        expect(screen.getByText('Aralia RPG')).toBeInTheDocument();
        expect(screen.getByText('Begin Legend')).toBeInTheDocument();
        expect(screen.getByText('Resume Journey')).toBeInTheDocument();
        expect(screen.getByText('Lore & Rules')).toBeInTheDocument();
    });

    it('calls onNewGame when Begin Legend button is clicked', () => {
        render(<MainMenu {...defaultProps} />);
        fireEvent.click(screen.getByText('Begin Legend'));
        expect(defaultProps.onNewGame).toHaveBeenCalledTimes(1);
    });

    it('calls onShowCompendium when Lore & Rules button is clicked', () => {
        render(<MainMenu {...defaultProps} />);
        fireEvent.click(screen.getByText('Lore & Rules'));
        expect(defaultProps.onShowCompendium).toHaveBeenCalledTimes(1);
    });

    it('shows Continue button when a save exists', () => {
        render(<MainMenu {...defaultProps} hasSaveGame={true} latestSaveTimestamp={Date.now()} />);
        // Use regex to match text that might be split across elements or have extra whitespace
        expect(screen.getByRole('button', { name: /Continue Journey/i })).toBeInTheDocument();
    });

    it('calls onLoadGame when Continue button is clicked', () => {
        render(<MainMenu {...defaultProps} hasSaveGame={true} latestSaveTimestamp={Date.now()} />);
        fireEvent.click(screen.getByRole('button', { name: /Continue Journey/i }));
        expect(defaultProps.onLoadGame).toHaveBeenCalledTimes(1);
    });

    it('does not render Quick Start directly on the main menu anymore', () => {
        // Quick Start now belongs to the shared Dev Menu, so the main menu should
        // no longer show it as a peer button next to the normal player actions.
        render(<MainMenu {...defaultProps} isDevDummyActive={true} />);
        expect(screen.queryByText('Quick Start (Dev)')).not.toBeInTheDocument();
    });

    it('opens LoadGameModal when Resume Journey button is clicked', () => {
        render(<MainMenu {...defaultProps} hasSaveGame={true} />); // Enable button
        fireEvent.click(screen.getByText('Resume Journey'));
        expect(screen.getByRole('dialog', { name: 'Resume Journey Modal' })).toBeInTheDocument();
    });

    it('opens SaveSlotSelector when Chronicle Journey button is clicked', () => {
        render(<MainMenu {...defaultProps} />);
        fireEvent.click(screen.getByText('Chronicle Journey'));
        expect(screen.getByRole('dialog', { name: 'Chronicle Journey Selector' })).toBeInTheDocument();
    });
});
