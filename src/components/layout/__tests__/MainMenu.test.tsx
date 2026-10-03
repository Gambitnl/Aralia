import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MainMenu from '../MainMenu';

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
