import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MainMenu from '../layout/MainMenu';
import * as Permissions from '../../utils/permissions';

// Mock child components
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

vi.mock('../services/saveLoadService', () => ({
    getSaveSlots: vi.fn(() => []),
    deleteSaveGame: vi.fn(),
    getLatestSaveTimestamp: vi.fn(() => null),
    hasSaveGame: vi.fn(() => false),
}));

// Mock i18n
vi.mock('../../utils/i18n', () => ({
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

// Mock permissions
vi.mock('../../utils/permissions', () => ({
    canUseDevTools: vi.fn(),
}));

describe('MainMenu Dev Button', () => {
    const defaultProps = {
        onNewGame: vi.fn(),
        onLoadGame: vi.fn(),
        onShowCompendium: vi.fn(),
        hasSaveGame: false,
        latestSaveTimestamp: null,
        isDevDummyActive: false,
        onSkipCharacterCreator: vi.fn(),
        onOpenDevMenu: vi.fn(),
        onSaveGame: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders "Dev Menu" button when canUseDevTools returns true', () => {
        vi.mocked(Permissions.canUseDevTools).mockReturnValue(true);
        render(<MainMenu {...defaultProps} />);
        expect(screen.getByText('Dev Menu')).toBeInTheDocument();
    });

    it('does NOT render "Dev Menu" button when canUseDevTools returns false', () => {
        vi.mocked(Permissions.canUseDevTools).mockReturnValue(false);
        render(<MainMenu {...defaultProps} />);
        expect(screen.queryByText('Dev Menu')).not.toBeInTheDocument();
    });

    it('calls onOpenDevMenu when "Dev Menu" button is clicked', () => {
        vi.mocked(Permissions.canUseDevTools).mockReturnValue(true);
        render(<MainMenu {...defaultProps} />);
        fireEvent.click(screen.getByText('Dev Menu'));
        expect(defaultProps.onOpenDevMenu).toHaveBeenCalledTimes(1);
    });
});
