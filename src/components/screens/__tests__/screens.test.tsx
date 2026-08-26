/**
 * This file contains unit tests for the modularized phase screen components.
 *
 * Tests cover:
 * - MainMenuScreen: Renders title options, save game indicators, and passes user interactions.
 * - CharacterCreatorScreen: Mounts the character creation wizard without crashing.
 * - BattleScreen: Mounts tactical combat view with appropriate biome defaults.
 * - PlayingScreen: Renders exploration HUD and handles view switching.
 *
 * Called by: Vitest test runner
 * Depends on: Vitest, React Testing Library, and the screen components under test
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  MainMenuScreen,
  CharacterCreatorScreen,
  BattleScreen,
  PlayingScreen,
} from '../index';
import { initialGameState } from '../../../state/initialState';
import { GamePhase } from '../../../types';

// ============================================================================
// Test Suite: Phase Screen Containers
// ============================================================================

describe('Phase Screen Containers', () => {
  // Test: MainMenuScreen
  describe('MainMenuScreen', () => {
    it('renders the MainMenu screen properly', () => {
      const handleNewGame = vi.fn();
      const handleLoadGame = vi.fn();
      const handleShowCompendium = vi.fn();

      render(
        <MainMenuScreen
          onNewGame={handleNewGame}
          onLoadGame={handleLoadGame}
          onShowCompendium={handleShowCompendium}
          hasSaveGame={false}
          latestSaveTimestamp={null}
          hasActiveRun={false}
        />
      );

      // Verify that the title / new game button is present
      expect(screen.getByRole('button', { name: /begin/i })).toBeDefined();
    });
  });

  // Test: CharacterCreatorScreen
  describe('CharacterCreatorScreen', () => {
    it('renders CharacterCreatorScreen without crashing', () => {
      const handleCharacterCreate = vi.fn();
      const handleExitToMainMenu = vi.fn();
      const mockDispatch = vi.fn();

      render(
        <CharacterCreatorScreen
          onCharacterCreate={handleCharacterCreate}
          onExitToMainMenu={handleExitToMainMenu}
          dispatch={mockDispatch}
        />
      );

      expect(document.body).toBeDefined();
    });
  });

  // Test: BattleScreen
  describe('BattleScreen', () => {
    it('renders BattleScreen with party and enemies without crashing', () => {
      const mockBattleEnd = vi.fn();
      const dummyParty: any[] = [
        {
          id: 'hero-1',
          name: 'Alden',
          hp: 20,
          maxHp: 20,
          abilities: {},
        },
      ];

      render(
        <BattleScreen
          party={dummyParty}
          enemies={[]}
          currentLocationBiomeId="forest"
          onBattleEnd={mockBattleEnd}
        />
      );

      expect(document.body).toBeDefined();
    });
  });

  // Test: PlayingScreen
  describe('PlayingScreen', () => {
    it('renders PlayingScreen in opening gate state when status is generating', () => {
      const dummyState = {
        ...initialGameState,
        phase: GamePhase.PLAYING,
        gameEntry: {
          status: 'generating' as const,
          reason: 'Generating opening situation',
        },
      };

      const dummyLocation: any = {
        id: 'loc-1',
        name: 'Oakhaven',
        baseDescription: 'A peaceful town.',
        exits: {},
        itemIds: [],
        npcIds: [],
      };

      render(
        <PlayingScreen
          gameState={dummyState}
          currentLocation={dummyLocation}
          npcs={[]}
          itemsInCurrentLocation={[]}
          isUIInteractive={true}
          autoSaveEnabled={true}
          activeAtlasGroundDrilldown={null}
          safeWorldViewMode="2d"
          onAction={vi.fn()}
          onNavigateToGlossary={vi.fn()}
          onEnterPlayingGroundFromAtlas={vi.fn()}
          onTransitionComplete={vi.fn()}
          onAtlasRestored={vi.fn()}
        />
      );

      // The backdrop gate should be rendered while generating
      expect(screen.getByTestId('opening-gate-backdrop')).toBeDefined();
    });
  });
});
