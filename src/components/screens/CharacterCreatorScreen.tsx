// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/08/2026, 13:55:55
 * Dependents: components/screens/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file renders the character creation screen.
 *
 * When a player starts a new game (or enters character creation mode), this screen
 * guides them through choosing their race, class, ability scores, background, age, feats,
 * skills, and appearance. Once the player confirms their character, it delegates the newly
 * assembled character data to the game system.
 *
 * Called by: App.tsx (when GamePhase is CHARACTER_CREATION)
 * Depends on: CharacterCreator.tsx for the creation wizard steps, ErrorBoundary for crash containment
 */

// ============================================================================
// Imports
// ============================================================================
// React core library and lazy loading utilities
import React, { lazy, Suspense } from 'react';
// Error boundary component to catch and display UI errors safely
import ErrorBoundary from '../ui/ErrorBoundary';
// Loading spinner displayed while the heavy character creation bundle is loading
import { LoadingSpinner } from '../ui/LoadingSpinner';
// Type definitions for character structures, items, and global actions
import type { PlayerCharacter, Item, Action } from '../../types';
import type { AppAction } from '../../state/actionTypes';

// Lazy-load the comprehensive CharacterCreator component to keep initial bundle size lean
const CharacterCreator = lazy(
  () => import('../CharacterCreator/CharacterCreator')
);

// ============================================================================
// Props & Types
// ============================================================================
// Defines the properties and callback handlers for the character creation screen
export interface CharacterCreatorScreenProps {
  // Callback invoked when the user finishes creating a character with starting items
  onCharacterCreate: (character: PlayerCharacter, inventory: Item[]) => void;
  // Callback to return back to the main title screen
  onExitToMainMenu: () => void;
  // Global action dispatcher for state modifications during creation
  dispatch: React.Dispatch<AppAction | Action>;
}

// ============================================================================
// Main Component
// ============================================================================
// Screen container wrapping the character creation wizard in error boundary and suspense
export const CharacterCreatorScreen: React.FC<CharacterCreatorScreenProps> = ({
  onCharacterCreate,
  onExitToMainMenu,
  dispatch,
}) => {
  return (
    // Isolate character creation errors so the user can safely recover if an asset fails to load
    <ErrorBoundary fallbackMessage="An error occurred during Character Creation.">
      <Suspense fallback={<LoadingSpinner />}>
        <CharacterCreator
          onCharacterCreate={onCharacterCreate}
          onExitToMainMenu={onExitToMainMenu}
          dispatch={dispatch}
        />
      </Suspense>
    </ErrorBoundary>
  );
};

export default CharacterCreatorScreen;
