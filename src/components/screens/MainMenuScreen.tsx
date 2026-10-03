// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/08/2026, 13:55:29
 * Dependents: components/screens/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file renders the game's title and main menu screen.
 *
 * When the player starts the game or returns from an active session, this screen displays
 * options to start a new adventure, load an existing save, open the lore compendium / glossary,
 * manage saved data, or configure developer options. It acts as the primary entry point
 * before entering character creation or active gameplay.
 *
 * Called by: App.tsx (when GamePhase is MAIN_MENU)
 * Depends on: MainMenu.tsx for the menu layout, ErrorBoundary for crash containment
 */

// ============================================================================
// Imports
// ============================================================================
// React core library for building the UI component
import React from 'react';
// Error boundary component to catch and display UI errors without crashing the whole app
import ErrorBoundary from '../ui/ErrorBoundary';
// MainMenu layout component containing the interactive menu buttons and dialogs
import MainMenu from '../layout/MainMenu';
import type { RulesEdition } from '../../config/rulesEdition';

// ============================================================================
// Props & Types
// ============================================================================
// Defines all the callbacks and configuration needed by the main menu screen
export interface MainMenuScreenProps {
  // Triggered when the player clicks "New Game"
  onNewGame: () => void;
  // Triggered when the player selects a save slot to load
  onLoadGame: (slotId?: string) => void;
  // Triggered when opening the compendium / rules glossary
  onShowCompendium: () => void;
  // Whether any stored save game exists on disk or in browser storage
  hasSaveGame: boolean;
  // Timestamp of the most recent save file, used for display
  latestSaveTimestamp?: number | null;
  // Whether developer tools / quick-start options are accessible
  isDevDummyActive?: boolean;
  // Handler to skip character creation directly into gameplay (developer feature)
  onSkipCharacterCreator?: () => void;
  // Handler to delete all save data
  onClearAllSaves?: () => void | Promise<void>;
  // Whether there is currently an ongoing in-memory game run
  hasActiveRun?: boolean;
  // Handler to discard the current in-memory run and start fresh
  onAbandonRun?: () => void;
  // Handler to open procedural world generation preview from menu
  onOpenWorldGeneration?: () => void;
  // Whether world generation is temporarily disabled or locked
  isWorldGenerationLocked?: boolean;
  // Explanatory reason if world generation is locked
  worldGenerationLockedReason?: string;
  // Handler to open the shared developer menu modal
  onOpenDevMenu?: () => void;
  // Handler to navigate back to an ongoing game session if one exists
  onGoBack?: () => void;
  // Flag indicating if returning back to a previous screen is allowed
  canGoBack?: boolean;
  // Which Player's Handbook the next campaign is played under (agora-18ab)
  rulesEdition?: RulesEdition;
  allowSaveScum?: boolean;
  // Handler to switch the campaign between the 2014 and 2024 rules
  onCycleRulesEdition?: () => void;
  onToggleSaveScum?: () => void;
}

// ============================================================================
// Main Component
// ============================================================================
// Renders the main menu wrapped in a protective error boundary
export const MainMenuScreen: React.FC<MainMenuScreenProps> = ({
  onNewGame,
  onLoadGame,
  onShowCompendium,
  hasSaveGame,
  latestSaveTimestamp = null,
  isDevDummyActive = false,
  onSkipCharacterCreator = () => {},
  onClearAllSaves,
  hasActiveRun = false,
  onAbandonRun,
  onOpenWorldGeneration,
  isWorldGenerationLocked,
  worldGenerationLockedReason,
  onOpenDevMenu,
  onGoBack,
  canGoBack = false,
  rulesEdition,
  allowSaveScum,
  onCycleRulesEdition,
  onToggleSaveScum,
}) => {
  return (
    // Wrap in ErrorBoundary so any menu layout crashes don't bring down the app
    <ErrorBoundary fallbackMessage="An error occurred in the Main Menu.">
      <MainMenu
        onNewGame={onNewGame}
        onLoadGame={onLoadGame}
        onShowCompendium={onShowCompendium}
        hasSaveGame={hasSaveGame}
        latestSaveTimestamp={latestSaveTimestamp}
        isDevDummyActive={isDevDummyActive}
        onSkipCharacterCreator={onSkipCharacterCreator}
        onClearAllSaves={onClearAllSaves}
        hasActiveRun={hasActiveRun}
        onAbandonRun={onAbandonRun}
        onOpenWorldGeneration={onOpenWorldGeneration}
        isWorldGenerationLocked={isWorldGenerationLocked}
        worldGenerationLockedReason={worldGenerationLockedReason}
        onOpenDevMenu={onOpenDevMenu}
        onGoBack={canGoBack ? onGoBack : undefined}
        canGoBack={canGoBack}
        rulesEdition={rulesEdition}
        allowSaveScum={allowSaveScum}
        onCycleRulesEdition={onCycleRulesEdition}
        onToggleSaveScum={onToggleSaveScum}
      />
    </ErrorBoundary>
  );
};

export default MainMenuScreen;
