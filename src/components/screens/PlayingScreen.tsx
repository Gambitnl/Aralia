// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/08/2026, 13:56:58
 * Dependents: components/screens/index.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file renders the primary exploration and gameplay screen (Playing Screen).
 *
 * When the party is in the active world (GamePhase.PLAYING), this screen manages the
 * viewport representation:
 * 1. 2D GameLayout: HUD, compass, action pane, minimap, messages, party summary.
 * 2. 3D World Scene: Streamed cell-native 3D terrain, procedural buildings, characters, and locomotion.
 * 3. Worldforge Atlas Demo: Canonical SVG/interactive regional map viewer and cartography layer.
 * 4. Opening Situation Backdrop: Clean entry gate while narrative context is generating.
 *
 * Called by: App.tsx (when GamePhase is PLAYING)
 * Depends on: GameLayout, TransitionController, World3DWrapper, WorldforgeAtlasDemo, ErrorBoundary
 */

// ============================================================================
// Imports
// ============================================================================
// React core library and lazy loading utilities
import React, { lazy, Suspense } from 'react';
// Error boundary component to prevent UI faults in 3D/world views from breaking the app
import ErrorBoundary from '../ui/ErrorBoundary';
// Loading spinner displayed when lazy components or terrain assets are resolving
import { LoadingSpinner } from '../ui/LoadingSpinner';
// Global game state definitions and domain entity types
import type { GameState } from '../../types/state';
import type { RulesEdition } from '../../config/rulesEdition';
import type { Location, NPC, Item } from '../../types';
import type { AtlasGroundDrilldown } from '@/systems/worldforge/leaf3d/atlasGroundDrilldown';
// World configuration for cell dimensions and meters-per-cell scaling
import { WORLD3D_CONFIG } from '../../systems/world3d/config';

// Lazy load world components to avoid heavy module execution during initial load
const GameLayout = lazy(() => import('../layout/GameLayout'));
const WorldforgeAtlasDemo = lazy(() => import('../Worldforge/AtlasDemo'));
const MapSurfaceToggle = lazy(() => import('../Worldforge/MapSurfaceToggle'));
const TransitionController = lazy(() => import('../World3D/TransitionController'));
const World3DWrapper = lazy(() => import('../World3D/World3DWrapper'));

// ============================================================================
// Props & Types
// ============================================================================
// Defines all state and action bindings required by the active exploration screen
export interface PlayingScreenProps {
  // Current game state snapshot
  gameState: GameState;
  // Resolved current location data for the party
  currentLocation: Location;
  // List of active NPCs present in the current location or sector
  npcs: NPC[];
  // Resolved items available for picking up at the current location
  itemsInCurrentLocation: Item[];
  // Whether the user interface allows interaction (not blocked by modal or loading state)
  isUIInteractive: boolean;
  // Current preference flag for auto-saving progress
  autoSaveEnabled: boolean;
  combatDifficulty?: 'easy' | 'normal' | 'hard';
  rulesEdition?: RulesEdition;
  allowSaveScum?: boolean;
  // Drilldown receipt for the active 3D atlas ground session
  activeAtlasGroundDrilldown: AtlasGroundDrilldown | null;
  // Current sanitized world view mode ('2d' | '3d' | 'atlas' | 'town3d')
  safeWorldViewMode: GameState['worldViewMode'];
  // Global action dispatcher for player interactions (travel, examine, take, talk)
  onAction: (action: any) => void;
  // Callback to open glossary / lore compendium for a clicked term
  onNavigateToGlossary: (termId: string) => void;
  // Callback when transitioning into 3D ground view from the Atlas map
  onEnterPlayingGroundFromAtlas: (ground: any) => void;
  // Callback when view transition animation finishes
  onTransitionComplete: () => void;
  // Callback when atlas view restoration completes (clearing transient drilldown)
  onAtlasRestored: () => void;
  // Optional custom handler for initiating conversation with an in-world NPC
  onTalkToNpc?: (npcId: string) => void;
}

// ============================================================================
// Main Component
// ============================================================================
// Container screen rendering the active world view and HUD
export const PlayingScreen: React.FC<PlayingScreenProps> = ({
  gameState,
  currentLocation,
  npcs,
  itemsInCurrentLocation,
  isUIInteractive,
  autoSaveEnabled,
  combatDifficulty,
  rulesEdition,
  allowSaveScum,
  activeAtlasGroundDrilldown,
  safeWorldViewMode,
  onAction,
  onNavigateToGlossary,
  onEnterPlayingGroundFromAtlas,
  onTransitionComplete,
  onAtlasRestored,
  onTalkToNpc,
}) => {
  // Check if the opening narrative generator is currently working or unavailable
  const openingGateOwnsMainView =
    gameState.gameEntry?.status === 'generating' ||
    gameState.gameEntry?.status === 'model-unavailable';

  // Determine whether to show the full SVG Atlas cartography or standard 2D HUD panes
  const useWorldforgeSurface =
    (gameState.mapSurface ?? 'classic') === 'worldforge';

  // Build the 2D surface content (either the Atlas demo viewer or the standard GameLayout)
  const atlasContent = useWorldforgeSurface ? (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Suspense fallback={<LoadingSpinner />}>
        <WorldforgeAtlasDemo
          embeddedInGame
          worldSeed={gameState.worldSeed}
          onEnterPlayingGround={onEnterPlayingGroundFromAtlas}
          groundReturnReceipt={activeAtlasGroundDrilldown}
          discoveredHiddenSites={gameState.discoveredHiddenSites}
        />
      </Suspense>
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 40,
        }}
      >
        <MapSurfaceToggle />
      </div>
    </div>
  ) : (
    <div className="relative h-full w-full">
      <GameLayout
        currentLocation={currentLocation}
        gameTime={gameState.gameTime}
        messages={gameState.messages}
        openingStatus={gameState.gameEntry?.status}
        onNavigateToGlossary={onNavigateToGlossary}
        npcsInLocation={npcs}
        itemsInLocation={itemsInCurrentLocation}
        party={gameState.party}
        geminiGeneratedActions={gameState.geminiGeneratedActions}
        unreadDiscoveryCount={gameState.unreadDiscoveryCount}
        hasNewRateLimitError={gameState.hasNewRateLimitError}
        worldSeed={gameState.worldSeed}
        isDevModeEnabled={gameState.isDevModeEnabled ?? false}
        autoSaveEnabled={autoSaveEnabled}
        combatDifficulty={combatDifficulty}
        rulesEdition={rulesEdition}
        allowSaveScum={allowSaveScum}
        disabled={!isUIInteractive}
        onAction={onAction}
        playerWorldPos={gameState.playerWorldPos}
        surfaceToggle={<MapSurfaceToggle />}
      />
    </div>
  );

  // Compute 3D entry coordinates from player world position or cell coordinates
  const entryCellId = gameState.playerCell?.cellId ?? 0;
  const entryPosition = gameState.playerWorldPos ?? {
    x: (entryCellId + 0.5) * WORLD3D_CONFIG.METERS_PER_CELL,
    y: 0,
    z: 0.5 * WORLD3D_CONFIG.METERS_PER_CELL,
  };

  // If the opening situation generator is actively running, show a neutral dark backdrop
  // instead of mounting world panes that depend on generated opening context
  if (openingGateOwnsMainView) {
    return (
      <div
        data-testid="opening-gate-backdrop"
        className="min-h-screen bg-gray-950"
      />
    );
  }

  // Render the primary exploration view with smooth transitions between 2D and 3D scenes
  return (
    <ErrorBoundary fallbackMessage="An error occurred in the main game view.">
      <Suspense fallback={<LoadingSpinner />}>
        <TransitionController
          mode={safeWorldViewMode}
          onComplete={onTransitionComplete}
          onAtlasRestored={onAtlasRestored}
          atlasContent={atlasContent}
          sceneContent={
            <World3DWrapper
              entryPosition={entryPosition}
              atlasGroundDrilldown={activeAtlasGroundDrilldown}
              onTalkToNpc={
                onTalkToNpc ??
                ((npcId: string) =>
                  onAction({
                    type: 'talk',
                    label: 'Talk',
                    payload: { targetNpcId: npcId },
                    targetId: npcId,
                  }))
              }
            />
          }
        />
      </Suspense>
    </ErrorBoundary>
  );
};

export default PlayingScreen;
