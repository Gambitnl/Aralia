import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MainMenu from '../MainMenu';
import * as saves from '../../../services/saveLoadService';

/**
 * Tests for the MainMenu component.
 *
 * The MainMenu is the primary title screen for Aralia. It hosts the options
 * for New Game, Continue / Load Game, Compendium / Glossary, and Credits.
 * It also supports developer menu triggers when dev tools are enabled.
 *
 * Connected to: MainMenuScreen, App, SaveLoad
 * Tests: Title rendering, New Game click, Load Game modal trigger, Glossary open, Credits modal open.
 */

// ============================================================================
// Setup and Render Tests
// ============================================================================

describe('MainMenu', () => {
  it('refreshes delayed storage metadata and continues the actual newest slot', async () => {
    const metadata = vi.spyOn(saves, 'getSaveSlots').mockReturnValue([]);
    const onLoadGame = vi.fn();
    const props = { onNewGame: vi.fn(), onLoadGame, onShowCompendium: vi.fn(), isDevDummyActive: false, onSkipCharacterCreator: vi.fn() };
    const { rerender } = render(<MainMenu {...props} hasSaveGame={false} latestSaveTimestamp={null} />);
    metadata.mockReturnValue([{ slotId: 'aralia_rpg_autosave', slotName: 'Auto-Save', isAutoSave: true, lastSaved: 1000 }]);
    rerender(<MainMenu {...props} hasSaveGame latestSaveTimestamp={1000} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Continue Journey/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Continue Journey/ }));
    expect(onLoadGame).toHaveBeenCalledWith('aralia_rpg_autosave');
    metadata.mockRestore();
  });

  it('renders title and primary menu options', () => {
    const onNewGame = vi.fn();
    const onLoadGame = vi.fn();
    const onShowCompendium = vi.fn();

    render(
      <MainMenu
        onNewGame={onNewGame}
        onLoadGame={onLoadGame}
        onShowCompendium={onShowCompendium}
        hasSaveGame={false}
        latestSaveTimestamp={null}
        isDevDummyActive={false}
        onSkipCharacterCreator={vi.fn()}
      />
    );

    // Verify title is displayed
    expect(screen.getByText('Aralia RPG')).toBeInTheDocument();

    // Verify primary buttons exist
    expect(screen.getByRole('button', { name: /Begin a new legend/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View game glossary/i })).toBeInTheDocument();
  });

  // ============================================================================
  // Action Callback Tests
  // ============================================================================

  it('triggers onNewGame callback when New Game button is clicked', () => {
    const onNewGame = vi.fn();
    const onLoadGame = vi.fn();
    const onShowCompendium = vi.fn();

    render(
      <MainMenu
        onNewGame={onNewGame}
        onLoadGame={onLoadGame}
        onShowCompendium={onShowCompendium}
        hasSaveGame={false}
        latestSaveTimestamp={null}
        isDevDummyActive={false}
        onSkipCharacterCreator={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Begin a new legend/i }));
    expect(onNewGame).toHaveBeenCalledTimes(1);
  });

  it('triggers onShowCompendium callback when Compendium button is clicked', () => {
    const onNewGame = vi.fn();
    const onLoadGame = vi.fn();
    const onShowCompendium = vi.fn();

    render(
      <MainMenu
        onNewGame={onNewGame}
        onLoadGame={onLoadGame}
        onShowCompendium={onShowCompendium}
        hasSaveGame={false}
        latestSaveTimestamp={null}
        isDevDummyActive={false}
        onSkipCharacterCreator={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /View game glossary/i }));
    expect(onShowCompendium).toHaveBeenCalledTimes(1);
  });
});
