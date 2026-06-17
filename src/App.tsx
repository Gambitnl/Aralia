// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 09/06/2026, 02:06:29
 * Dependents: None (Orphan)
 * Imports: 54 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file App.tsx
 * EXECUTION FLOW SEGMENT 2: Root Application Component
 * 
 * This is the root component of the Aralia RPG application, loaded by index.tsx.
 * It manages all game state, phases (menu, character creation, gameplay), and orchestrates
 * the rendering of all other components.
 */

/**
 * This is the master coordinator for the entire game UI.
 * 
 * It holds the primary game state (via useReducer) and chooses which "view"
 * the player sees — whether it's the main menu, the character creator, or 
 * the world map. It also manages global overlays like the dice roller and 
 * notification systems.
 *
 * Called by: index.tsx (entry point)
 * Depends on: appReducer.ts for logic, useGameInitialization for boot sequence,
 * and dozens of specialized UI components.
 */

// ============================================================================
// Imports
// ============================================================================
// React hooks - useReducer for complex state management, useCallback for memoized functions,
// useEffect for side effects
import React, { useReducer, useCallback, useEffect, useRef, lazy, Suspense, useState } from 'react';
import { resolveWorldDataFor3D } from './utils/mapDataToWorldData';
// Framer Motion - provides animation components like AnimatePresence for smooth UI transitions
import { AnimatePresence } from 'framer-motion';

// Core TypeScript types/interfaces used throughout the application
// These define the structure of locations, messages, NPCs, items, characters, game phases, etc.
import { Location, GameMessage, NPC, MapTile, Item, PlayerCharacter, GamePhase, Notification } from './types';
// State management - appReducer handles all state updates via actions, initialGameState provides defaults
import { appReducer } from './state/appState';
import { initialGameState } from './state/initialState';
// Custom hooks - encapsulate reusable logic for audio, game actions, and initialization
import { useAudio } from './hooks/useAudio';
import { useGameActions } from './hooks/useGameActions';
import { useGameInitialization } from './hooks/useGameInitialization';
import { useHistorySync } from './hooks/useHistorySync';
import { useCompanionCommentary } from './hooks/useCompanionCommentary';
import { useCompanionBanter } from './hooks/useCompanionBanter';
import { useMissingChoice } from './hooks/useMissingChoice';
import { useOllamaCheck } from './hooks/useOllamaCheck';
import { useAutoSave } from './hooks/useAutoSave';
import { determineSettlementInfo } from './utils/settlementGeneration';
import { t } from './utils/i18n';

// Utility functions
import { determineActiveDynamicNpcsForLocation } from '@/utils/spatial';

// Context providers - wrap the app to provide glossary and spell data to all child components
import { AppProviders } from './components/providers/AppProviders';
import { DataLoaderGate } from './components/providers/DataLoaderGate';
import {
  STARTING_LOCATION_ID,
  LOCATIONS,
} from './data/world/locations';
import { NPCS } from './data/world/npcs';
import { BIOMES } from './data/biomes';
import { MAP_GRID_SIZE, SUBMAP_DIMENSIONS } from './config/mapConfig';
import { gridCellCenterToWorldMeters, getTerrainHeight } from './utils/worldCoords';
import { canUseDevTools } from './utils/permissions';
import { validateEnv } from './config/env';
import { DiceOverlay } from './components/dice/DiceOverlay';
import { Z_INDEX, applyZIndexCssVariables } from './styles/zIndex';

import { NotificationSystem } from './components/ui/NotificationSystem';
import { GameProvider } from './state/GameContext';
import { WORLD3D_CONFIG } from './systems/world3d/config';
import { CompanionReaction } from './components/ui/CompanionReaction';
import GameModals from './components/layout/GameModals';
import MainMenu from './components/layout/MainMenu';
import ErrorBoundary from './components/ui/ErrorBoundary';
import * as SaveLoadService from './services/saveLoadService';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { ConversationPanel } from './components/ConversationPanel';
import { OpeningSituationGate } from './components/gameEntry/OpeningSituationGate';
import { SafeStorage } from './utils/core/storageUtils';
import { shouldPassiveGameClockRun } from './utils/core/timekeeperUtils';

import { CollapsibleBanterPanel } from './components/ui/CollapsibleBanterPanel';
import { BanterAttentionBanner } from './components/ui/BanterAttentionBanner';
import { generateMap } from './services/mapService';
import { generateWorldSeed } from './utils/random/generateWorldSeed';

// Lazy load large components to reduce initial bundle size
const TownCanvas = lazy(() => import('./components/Town/TownCanvas'));
const BattleMapDemo = lazy(() => import('./components/BattleMap/BattleMapDemo'));
const CombatView = lazy(() => import('./components/Combat').then(module => ({ default: module.CombatView })));
const CharacterCreator = lazy(() => import('./components/CharacterCreator/CharacterCreator'));
const GameLayout = lazy(() => import('./components/layout/GameLayout'));
const LoadGameTransition = lazy(() => import('./components/SaveLoad').then(module => ({ default: module.LoadGameTransition })));
const NotFound = lazy(() => import('./components/ui/NotFound'));
const World3DDemo = lazy(() => import('./components/World3D/World3DDemo'));
// Worldforge atlas cartographer demo (?phase=worldforge) — lazy: pulls the
// whole ported-FMG generation stack, which the main bundle must not pay for.
const WorldforgeAtlasDemo = lazy(() => import('./components/Worldforge/AtlasDemo'));
const TransitionController = lazy(() => import('./components/World3D/TransitionController'));
const World3DWrapper = lazy(() => import('./components/World3D/World3DWrapper'));
// Classic ↔ Worldforge 2D-surface toggle (small, eager — no generation stack).
const MapSurfaceToggle = lazy(() => import('./components/Worldforge/MapSurfaceToggle'));
// Combat Messaging Demo handles mock logging events to visualize unified messages in dev mode.
const CombatMessagingDemo = lazy(() => import('./components/demo/CombatMessagingDemo').then(module => ({ default: module.CombatMessagingDemo })));
// --- Decoupled Developer Tools Registry ---
// Some developer tools have been decoupled from the main application bundle to 
// optimize production builds and prevent build-time dependencies on local-only files.
// 
// Access these tools directly via their entry points:
// - Design Preview: /Aralia/misc/design.html
// - Developer Hub:  /Aralia/misc/dev_hub.html (Central landing page)
// -------------------------------------------


// TODO: Add AI model OPTIONALITY settings to allow players to choose between local (Ollama) or cloud (Gemini) models
// PROGRESS: Most AI functions (location descriptions, NPC interactions, etc.) now use local Ollama instead of Gemini,
// significantly reducing internet dependency. Players should be able to configure their preferred AI model in settings
// and have the system gracefully fall back between local and cloud models based on availability and preference.

// ============================================================================
// Main Component
// ============================================================================
const App: React.FC = () => {
  const AUTO_SAVE_PREF_KEY = 'aralia_rpg_pref_auto_save_enabled';
  // Validate environment variables on startup
  useEffect(() => {
    validateEnv();
  }, []);

  useEffect(() => {
    applyZIndexCssVariables();
  }, []);

  const [gameState, dispatch] = useReducer(appReducer, initialGameState);

  // ── Storage initialization (GAP-001) ──────────────────────────────────
  // Initializes IndexedDB, recovers emergency saves, and migrates legacy
  // localStorage payloads to IDB. Runs once on mount, before any save/load
  // UI checks can read stale data. Safe to call multiple times (idempotent).
  useEffect(() => {
    SaveLoadService.initializeStorage();
  }, []);

  const autoSaveEnabled = gameState.autoSaveEnabled ?? true;
  const [isAutoSavePrefHydrated, setIsAutoSavePrefHydrated] = useState(false);
  const [itemsById, setItemsById] = useState<Record<string, Item> | null>(null);

  useEffect(() => {
    if (gameState.phase === GamePhase.MAIN_MENU || itemsById) return;
    let cancelled = false;

    // The item registry includes generated glossary-backed items, so keep it
    // out of the main-menu startup path and load it only for playable screens
    // that can actually show location item interactions.
    import('./data/items').then(({ ITEMS: loadedItems }) => {
      if (!cancelled) {
        setItemsById(loadedItems);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [gameState.phase, itemsById]);

  // Load persisted preference once (default is ON if absent).
  useEffect(() => {
    const stored = SafeStorage.getItem(AUTO_SAVE_PREF_KEY);
    if (stored) {
      const normalized = stored.trim().toLowerCase();
      const enabled = normalized === '1' || normalized === 'true' || normalized === 'on';
      dispatch({ type: 'SET_AUTO_SAVE_ENABLED', payload: enabled });
    }
    setIsAutoSavePrefHydrated(true);
  }, []);

  // Persist preference any time the user toggles it.
  useEffect(() => {
    if (!isAutoSavePrefHydrated) return;
    SafeStorage.trySetItem(AUTO_SAVE_PREF_KEY, autoSaveEnabled ? '1' : '0');
  }, [autoSaveEnabled, isAutoSavePrefHydrated]);

  // Best-effort autosave for refresh safety.
  // Gate on preference hydration so we don't accidentally autosave if the user
  // previously disabled the feature.
  useAutoSave(gameState, isAutoSavePrefHydrated ? autoSaveEnabled : false);

  // 🏹 Ranger: Sync GamePhase with URL history
  useHistorySync(gameState, dispatch);

  // 💕 Heartkeeper: Companion Commentary (Reactions 2.0)
  useCompanionCommentary(gameState, dispatch);
  // Companion Banter
  const [isBanterPaused, setIsBanterPaused] = useState(false);
  const {
    forceBanter,
    isBanterActive,
    isWaitingForNextLine,
    isGenerating,
    generatingSpeakerName,
    secondsUntilNextLine,
    playerInterrupt,
    endBanter,
    banterHistory,
    isPlayerDirected,
    isWaitingForPlayerResponse,
    playerResponseDeadlineSeconds,
    extendPlayerResponseDeadline,
    extendNpcLineDelay,
  } = useCompanionBanter(gameState, dispatch, isBanterPaused);
  // Ollama Dependency Check
  // Keep the check side-effect active; UI wiring can consume this state later.
  const {
    ollamaWarningDismissed: _ollamaWarningDismissed,
    setOllamaWarningDismissed: _setOllamaWarningDismissed
  } = useOllamaCheck(dispatch);


  const addMessage = useCallback(
    (text: string, sender: 'system' | 'player' | 'npc' = 'system') => {
      const newMessage: GameMessage = {
        id: Date.now() + Math.random(),
        text,
        sender,
        timestamp: new Date(),
      };
      dispatch({ type: 'ADD_MESSAGE', payload: newMessage });
    },
    [],
  );

  // State for Missing Choice Modal
  const {
    missingChoiceModal,
    setMissingChoiceModal,
    handleFixMissingChoice,
    handleConfirmMissingChoice
  } = useMissingChoice(dispatch, addMessage);

  const { playPcmAudio, cleanupAudioContext } = useAudio(addMessage);

  // Cleanup effect: This ensures that when the component unmounts (e.g., user closes the app),
  // we properly clean up the audio context to prevent memory leaks.
  // Memory leaks happen when resources like audio contexts aren't properly released,
  // causing the browser to hold onto memory that can't be used anymore.
  useEffect(() => {
    // The return function here is the "cleanup function" - React calls it when the component unmounts
    return () => {
      cleanupAudioContext();
    };
  }, [cleanupAudioContext]); // Only re-run if cleanupAudioContext function changes

  const getCurrentLocation = useCallback((): Location => {
    const currentId = gameState.currentLocationId;
    if (LOCATIONS[currentId]) {
      const baseLocation = LOCATIONS[currentId];
      return {
        ...baseLocation,
        itemIds: gameState.dynamicLocationItemIds[currentId] || baseLocation.itemIds || []
      };
    }

    if (currentId.startsWith('coord_') && gameState.mapData && gameState.subMapCoordinates) {
      const parts = currentId.split('_');
      const worldX = parseInt(parts[1]);
      const worldY = parseInt(parts[2]);

      if (gameState.mapData.tiles[worldY] && gameState.mapData.tiles[worldY][worldX]) {
        const worldTile = gameState.mapData.tiles[worldY][worldX];
        const biome = BIOMES[worldTile.biomeId];

        const subMapExits: { [direction: string]: string } = {};
        Object.keys(canUseDevTools() ? {} : {}).forEach(dir => {
          subMapExits[dir] = dir;
        });

        return {
          id: currentId,
          name: `${biome?.name || 'Unknown Biome'} sector (${worldX},${worldY}), sub-tile (${gameState.subMapCoordinates.x},${gameState.subMapCoordinates.y})`,
          baseDescription: `You are at sub-tile (${gameState.subMapCoordinates.x},${gameState.subMapCoordinates.y}) within the ${biome?.name || 'unknown terrain'} world sector at (${worldX},${worldY}). ${biome?.description || ''}`,
          exits: subMapExits,
          itemIds: gameState.dynamicLocationItemIds[currentId] || [],
          npcIds: [],
          mapCoordinates: { x: worldX, y: worldY },
          biomeId: worldTile.biomeId,
        };
      }
    }
    const fallbackLoc = LOCATIONS[STARTING_LOCATION_ID];
    return {
      ...fallbackLoc,
      itemIds: gameState.dynamicLocationItemIds[STARTING_LOCATION_ID] || fallbackLoc.itemIds || []
    };
  }, [gameState.currentLocationId, gameState.mapData, gameState.subMapCoordinates, gameState.dynamicLocationItemIds]);

  const getCurrentNPCs = useCallback((): NPC[] => {
    const location = getCurrentLocation();
    let npcList: NPC[] = [];

    if (location?.npcIds && !location.id.startsWith('coord_')) {
      npcList = location.npcIds.map((npcId) => NPCS[npcId]).filter(Boolean) as NPC[];
    }

    if (gameState.currentLocationActiveDynamicNpcIds) {
      const dynamicNpcs = gameState.currentLocationActiveDynamicNpcIds
        // Resolve static NPCs first, then runtime-generated ones (situational
        // opening NPCs, town-gen NPCs) so they render in the scene too.
        .map(npcId => NPCS[npcId] || gameState.generatedNpcs?.[npcId])
        .filter(Boolean) as NPC[];
      npcList = [...npcList, ...dynamicNpcs];
    }

    const uniqueNpcList = npcList.reduce((acc, current) => {
      if (!acc.find(item => item.id === current.id)) {
        acc.push(current);
      }
      return acc;
    }, [] as NPC[]);

    return uniqueNpcList;
  }, [getCurrentLocation, gameState.currentLocationActiveDynamicNpcIds, gameState.generatedNpcs]);

  const getTileTooltipText = useCallback((worldMapTile: MapTile): string => {
    const biome = BIOMES[worldMapTile.biomeId];
    if (!worldMapTile.discovered) {
      return t('app.tooltip.undiscovered', {
        x: worldMapTile.x,
        y: worldMapTile.y,
        biome: biome?.name || t('app.tooltip.undiscovered_biome_unknown')
      });
    }
    let tooltip = t('app.tooltip.discovered', {
      biome: biome?.name || t('app.tooltip.biome_unknown'),
      x: worldMapTile.x,
      y: worldMapTile.y
    });

    if (worldMapTile.locationId && LOCATIONS[worldMapTile.locationId]) {
      tooltip += t('app.tooltip.location', { locationName: LOCATIONS[worldMapTile.locationId].name });
    } else {
      tooltip += t('app.tooltip.dot');
    }
    if (biome?.description) {
      tooltip += t('app.tooltip.description', { description: biome.description });
    }
    return tooltip;
  }, []);

  // TODO(QOL): If re-render hotspots appear, profile callback dependencies here and in useGameActions/useGameInitialization (see docs/QOL_TODO.md; if this block is moved/refactored/modularized, update the QOL_TODO entry path).
// TODO(FEATURES): Add AI model optionality settings to allow players to choose between local (Ollama) or cloud (Gemini) models in settings, with graceful fallback between models based on availability and preference.
  const { processAction } = useGameActions({
    gameState,
    dispatch,
    addMessage,
    playPcmAudio,
    getCurrentLocation,
    getCurrentNPCs,
    getTileTooltipText,
  });

  const {
    handleNewGame: initializeNewGame,
    handleSkipCharacterCreator,
    handleLoadGameFlow,
    startGame,
    handleLegacyDummyAutoStart,
  } = useGameInitialization({
    dispatch,
    addMessage,
    currentMapData: gameState.mapData,
    worldSeed: gameState.worldSeed,
  });

  const handleBattleMapDemo = useCallback(() => {
    dispatch({ type: 'SETUP_BATTLE_MAP_DEMO' });
  }, [dispatch]);

  useEffect(() => {
    return () => {
      cleanupAudioContext();
    };
  }, [cleanupAudioContext]);

  // Dev-only read-only state probe for the resume-journey audit rig: lets the
  // headless harness compare the live state against the saved payload without
  // reaching into React internals. Summary fields only — never mutate.
  useEffect(() => {
    if (typeof window === 'undefined' || !canUseDevTools()) return;
    (window as unknown as { __araliaState?: unknown }).__araliaState = {
      phase: GamePhase[gameState.phase],
      worldViewMode: gameState.worldViewMode ?? null,
      currentLocationId: gameState.currentLocationId,
      subMapCoordinates: gameState.subMapCoordinates,
      playerWorldPos: gameState.playerWorldPos ?? null,
      partySize: gameState.party.length,
      partyNames: gameState.party.map(p => p.name),
      gold: gameState.gold,
      inventoryCount: gameState.inventory.length,
      gameTime: gameState.gameTime instanceof Date
        ? gameState.gameTime.toISOString()
        : String(gameState.gameTime),
      isMapVisible: gameState.isMapVisible,
      isSubmapVisible: gameState.isSubmapVisible,
      isThreeDVisible: gameState.isThreeDVisible ?? false,
      saveTimestamp: gameState.saveTimestamp ?? null,
      error: gameState.error ?? null,
      isLoading: gameState.isLoading,
    };
  }, [gameState]);

  // Dev dummy auto-start: only fire when there's no URL phase override.
  // This prevents the legacy auto-start from hijacking deep links like ?phase=world3d
  // during the initial mount race between useHistorySync and this effect.
  useEffect(() => {
    if (!canUseDevTools()) return;
    if (gameState.phase !== GamePhase.MAIN_MENU) return;
    if (gameState.party.length > 0 || gameState.messages.length > 0) return;
    if (SaveLoadService.hasSaveGame()) return;
    
    // Guard: if the URL specifies a phase, let useHistorySync handle it instead
    // of auto-starting the dummy party. This fixes the cold-load bounce where
    // ?phase=world3d would intermittently get overridden to MAIN_MENU → PLAYING.
    const urlParams = new URLSearchParams(window.location.search);
    const urlPhase = urlParams.get('phase');
    if (urlPhase) return; // URL phase takes precedence
    
    handleLegacyDummyAutoStart();
  }, [
    gameState.phase,
    gameState.party,
    gameState.messages.length,
    handleLegacyDummyAutoStart,
  ]);

  // Dev combat fixture (?dev_combat=1): once the save is loaded into PLAYING,
  // start a deterministic battle-map encounter directly (bestiary monsters,
  // no AI generation). Exists for headless combat proofs — 3d-combat-map G7:
  // the autosave lands on the exploration surface, leaving CombatView
  // unreachable without UI driving. Decision Blitz "items converted to work".
  const devCombatFiredRef = useRef(false);
  useEffect(() => {
    if (!canUseDevTools() || devCombatFiredRef.current) return;
    if (gameState.phase !== GamePhase.PLAYING) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('dev_combat') !== '1') return;
    devCombatFiredRef.current = true;
    processAction({
      type: 'START_BATTLE_MAP_ENCOUNTER',
      label: 'Dev Combat Fixture',
      payload: {
        startBattleMapEncounterData: {
          monsters: [
            { name: 'Goblin', quantity: 3, cr: '1/4', description: 'Dev fixture goblin' },
            { name: 'Orc', quantity: 2, cr: '1/2', description: 'Dev fixture orc' },
          ],
        },
      },
    });
  }, [gameState.phase, processAction]);

  useEffect(() => {
    // This effect handles the timed transition from the welcome screen to the main game.
    if (gameState.phase === GamePhase.LOAD_TRANSITION) {
      const timer = setTimeout(() => {
        dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.PLAYING });
      }, 2000); // 2-second duration for the welcome screen
      return () => clearTimeout(timer);
    }
  }, [gameState.phase, dispatch]);


  useEffect(() => {
    let timerId: number | undefined;

    // Passive time belongs to free exploration only. Combat time now advances
    // through round-completion callbacks, and blocking modals such as encounter
    // prep pause the ticker because the player is not taking world actions.
    const shouldClockRun = shouldPassiveGameClockRun({
      phase: gameState.phase,
      isLoading: gameState.isLoading,
      isImageLoading: gameState.isImageLoading,
      isCharacterSheetOpen: gameState.characterSheetModal.isOpen,
      isMapVisible: gameState.isMapVisible,
      isSubmapVisible: gameState.isSubmapVisible,
      isDevMenuVisible: gameState.isDevMenuVisible,
      isGeminiLogViewerVisible: gameState.isGeminiLogViewerVisible,
      isDiscoveryLogVisible: gameState.isDiscoveryLogVisible,
      isGlossaryVisible: gameState.isGlossaryVisible,
      isEncounterModalVisible: gameState.isEncounterModalVisible,
      isNpcTestModalVisible: gameState.isNpcTestModalVisible,
      isLogbookVisible: gameState.isLogbookVisible,
      isGameGuideVisible: gameState.isGameGuideVisible,
      isInvestmentBoardVisible: gameState.isInvestmentBoardVisible,
      isMerchantModalOpen: gameState.merchantModal.isOpen,
      isMissingChoiceModalOpen: missingChoiceModal.isOpen,
    });


    if (shouldClockRun) {
      timerId = window.setInterval(() => {
        dispatch({ type: 'ADVANCE_TIME', payload: { seconds: 1 } });
      }, 1000);
    }

    return () => {
      if (timerId) {
        window.clearInterval(timerId);
      }
    };
  }, [
    gameState.phase,
    gameState.isLoading,
    gameState.isImageLoading,
    gameState.characterSheetModal.isOpen,
    gameState.isMapVisible,
    gameState.isSubmapVisible,
    gameState.isDevMenuVisible,
    gameState.isGeminiLogViewerVisible,
    gameState.isDiscoveryLogVisible,
    gameState.isGlossaryVisible,
    gameState.isEncounterModalVisible,
    gameState.isNpcTestModalVisible,
    gameState.isLogbookVisible,
    gameState.isGameGuideVisible,
    gameState.isInvestmentBoardVisible,
    gameState.merchantModal.isOpen,
    missingChoiceModal.isOpen,
    dispatch
  ]);

  const handleCombatRoundElapsed = useCallback((seconds: number) => {
    // Combat reports elapsed time in completed D&D rounds, but the world still
    // changes through the same ADVANCE_TIME action used by waiting, travel,
    // resting, crafting, and passive exploration.
    dispatch({ type: 'ADVANCE_TIME', payload: { seconds } });
  }, [dispatch]);


  const handleOpenGlossary = useCallback((initialTermId?: string) => {
    if (initialTermId) {
      dispatch({ type: 'SET_GLOSSARY_TERM_FOR_MODAL', payload: initialTermId });
    }
    processAction({ type: 'TOGGLE_GLOSSARY_VISIBILITY', label: 'Toggle Glossary', payload: { initialTermId } });
  }, [dispatch, processAction]);


  const handleExitCharacterCreatorToMainMenu = useCallback(() => {
    dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.MAIN_MENU });
  }, [dispatch]);

  const handleClearAllSaves = useCallback(() => {
    SaveLoadService.clearAllSaves();
    // Force a re-render of the Main Menu by updating a local state if necessary,
    // or just rely on the fact that MainMenu calls refreshSlots which calls getSaveSlots.
    // However, App needs to know that hasSaveGame might have changed.
    dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.MAIN_MENU });
  }, [dispatch]);

  const handleAbandonRun = useCallback(() => {
    dispatch({ type: 'ABANDON_RUN' });
  }, [dispatch]);

  const handleTileClick = useCallback((x: number, y: number, tile: MapTile) => {
    const targetBiome = BIOMES[tile.biomeId];

    if (!targetBiome) {
      addMessage("The nature of this terrain is unknown.", 'system');
      return;
    }

    if (!targetBiome.passable) {
      const reason = targetBiome.impassableReason || `You cannot travel to the ${targetBiome.name}. It is impassable by normal means.`;
      addMessage(reason, 'system');
      return;
    }

    if (tile.discovered && tile.locationId && tile.locationId !== gameState.currentLocationId) {
      // Check if this is a town location - prevent direct quick travel to towns
      const townKeywords = ['town', 'village', 'city', 'settlement', 'hamlet'];
      const targetLocation = LOCATIONS[tile.locationId];
      const isTownLocation = targetLocation && townKeywords.some(keyword =>
        targetLocation.name.toLowerCase().includes(keyword) ||
        targetLocation.id.toLowerCase().includes(keyword)
      );

      if (isTownLocation) {
        addMessage(`You cannot quick travel directly into ${targetLocation.name}. Towns must be approached carefully on foot.`, 'system');
        return;
      }

      const newSubMapCoordinates = { x: Math.floor(SUBMAP_DIMENSIONS.cols / 2), y: Math.floor(SUBMAP_DIMENSIONS.rows / 2) };
      let newMapDataForDispatch = gameState.mapData;
      if (newMapDataForDispatch) {
        const newTiles = newMapDataForDispatch.tiles.map(row => row.map(t => ({ ...t, isPlayerCurrent: false })));
        if (newTiles[y] && newTiles[y][x]) {
          newTiles[y][x].isPlayerCurrent = true;
          newTiles[y][x].discovered = true;
          for (let y_offset = -1; y_offset <= 1; y_offset++) {
            for (let x_offset = -1; x_offset <= 1; x_offset++) {
              const adjY = y + y_offset;
              const adjX = x + x_offset;
              if (adjY >= 0 && adjY < newMapDataForDispatch.gridSize.rows && adjX >= 0 && adjX < newMapDataForDispatch.gridSize.cols) {
                newTiles[adjY][adjX].discovered = true;
              }
            }
          }
        }
        newMapDataForDispatch = { ...newMapDataForDispatch, tiles: newTiles };
      }
      dispatch({ type: 'MOVE_PLAYER', payload: { newLocationId: tile.locationId, newSubMapCoordinates, mapData: newMapDataForDispatch || undefined, activeDynamicNpcIds: determineActiveDynamicNpcsForLocation(tile.locationId, LOCATIONS) } });
      dispatch({ type: 'ADVANCE_TIME', payload: { seconds: 3600 } });
      dispatch({ type: 'TOGGLE_MAP_VISIBILITY' });
    } else if (tile.discovered && !tile.locationId) {
      const targetCoordId = `coord_${x}_${y}`;
      if (targetCoordId !== gameState.currentLocationId) {
        const newSubMapCoordinates = { x: Math.floor(SUBMAP_DIMENSIONS.cols / 2), y: Math.floor(SUBMAP_DIMENSIONS.rows / 2) };
        let newMapDataForDispatch = gameState.mapData;
        if (newMapDataForDispatch) {
          const newTiles = newMapDataForDispatch.tiles.map(row => row.map(t => ({ ...t, isPlayerCurrent: false })));
          if (newTiles[y] && newTiles[y][x]) {
            newTiles[y][x].isPlayerCurrent = true;
            newTiles[y][x].discovered = true;
          }
          newMapDataForDispatch = { ...newMapDataForDispatch, tiles: newTiles };
        }
        dispatch({ type: 'MOVE_PLAYER', payload: { newLocationId: targetCoordId, newSubMapCoordinates, mapData: newMapDataForDispatch || undefined, activeDynamicNpcIds: determineActiveDynamicNpcsForLocation(targetCoordId, LOCATIONS) } });
        dispatch({ type: 'ADVANCE_TIME', payload: { seconds: 3600 } });
        dispatch({ type: 'TOGGLE_MAP_VISIBILITY' });
      } else {
        addMessage(`This is your current world map area: ${targetBiome.name} at (${x},${y}).`, 'system');
      }
    } else if (tile.discovered) {
      addMessage(`This is the ${targetBiome.name} at world coordinates (${x},${y}). ${targetBiome.description}`, 'system');
    }

  }, [gameState.currentLocationId, gameState.mapData, addMessage, dispatch]);

  /**
   * Atlas "Enter 3D" mode: place the player in the streamed world at the clicked cell.
   */
  const handleEnter3DAtCell = useCallback((x: number, y: number, tile: MapTile) => {
    if (!tile.discovered) {
      addMessage('You cannot enter the 3D world in undiscovered areas.', 'system');
      return;
    }

    const mapData = gameState.mapData;
    if (!mapData) {
      addMessage('World map data is not ready for 3D entry.', 'system');
      return;
    }

    const { cols, rows } = mapData.gridSize;
    const { x: wx, z: wz } = gridCellCenterToWorldMeters(x, y, cols, rows);
    let terrainY = 0;
    const worldDataForHeight = resolveWorldDataFor3D(mapData, gameState.worldSeed ?? 0);
    if (worldDataForHeight) {
      terrainY = getTerrainHeight(wx, wz, worldDataForHeight);
    }

    dispatch({
      type: 'SET_PLAYER_WORLD_POS',
      payload: { x: wx, y: terrainY, z: wz },
    });
    dispatch({ type: 'SET_WORLD_VIEW_MODE', payload: '3d' });
    if (gameState.isMapVisible) {
      dispatch({ type: 'TOGGLE_MAP_VISIBILITY' });
    }
    addMessage(`Entering 3D world at map cell (${x}, ${y}).`, 'system');
  }, [addMessage, dispatch, gameState.isMapVisible, gameState.mapData]);

  const handleOpenCharacterSheet = useCallback((character: PlayerCharacter) => {
    dispatch({ type: 'OPEN_CHARACTER_SHEET', payload: character });
  }, [dispatch]);

  const handleCloseCharacterSheet = useCallback(() => {
    dispatch({ type: 'CLOSE_CHARACTER_SHEET' });
  }, [dispatch]);

  const handleClosePartyOverlay = useCallback(() => {
    dispatch({ type: 'TOGGLE_PARTY_OVERLAY' });
  }, [dispatch]);

  const handleTransitionComplete = useCallback(() => {
    // Transition complete — player now has control in 3D world.
  }, []);

  const hasStoredSaveGame = SaveLoadService.hasSaveGame();
  const hasActiveRunInMemory = gameState.party.length > 0;
  const canRegenerateWorldMap = !hasStoredSaveGame && !hasActiveRunInMemory;
  const worldGenerationLockedReason = hasActiveRunInMemory
    ? 'World generation is locked while an active game session is in memory.'
    : hasStoredSaveGame
      ? 'World generation is locked because save data exists. Clear saves to unlock it.'
      : null;

  const buildDynamicLocationItemSnapshot = useCallback((): Record<string, string[]> => {
    const snapshot: Record<string, string[]> = {};
    Object.values(LOCATIONS).forEach(loc => {
      snapshot[loc.id] = loc.itemIds ? [...loc.itemIds] : [];
    });
    return snapshot;
  }, []);

  const createWorldFromSeed = useCallback((seed: number) => {
    const normalizedSeed = Number.isFinite(seed) && seed > 0 ? Math.floor(seed) : generateWorldSeed();
    const nextMapData = generateMap(MAP_GRID_SIZE.rows, MAP_GRID_SIZE.cols, LOCATIONS, BIOMES, normalizedSeed);
    dispatch({ type: 'SET_WORLD_SEED', payload: normalizedSeed });
    dispatch({ type: 'SET_MAP_DATA', payload: nextMapData });
    return { seed: normalizedSeed, mapData: nextMapData };
  }, [dispatch]);

  const handleRegenerateWorldMap = useCallback((requestedSeed?: number) => {
    if (!canRegenerateWorldMap) {
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'warning',
          message: worldGenerationLockedReason || 'World generation is currently locked.',
        },
      });
      return;
    }

    const seedToUse = Number.isFinite(requestedSeed) && (requestedSeed ?? 0) > 0
      ? Math.floor(requestedSeed as number)
      : generateWorldSeed();
    const { seed } = createWorldFromSeed(seedToUse);
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        type: 'success',
        message: `World regenerated with seed ${seed}.`,
      },
    });
  }, [canRegenerateWorldMap, createWorldFromSeed, dispatch, worldGenerationLockedReason]);

  const handleOpenWorldGenerationFromMainMenu = useCallback(() => {
    if (!gameState.mapData) {
      const previewSeed = Number.isFinite(gameState.worldSeed) && gameState.worldSeed > 0
        ? Math.floor(gameState.worldSeed)
        : generateWorldSeed();
      createWorldFromSeed(previewSeed);
    }

    if (!gameState.isMapVisible) {
      dispatch({ type: 'TOGGLE_MAP_VISIBILITY' });
    }
    if (!canRegenerateWorldMap && worldGenerationLockedReason) {
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'warning',
          message: worldGenerationLockedReason,
        },
      });
    }
  }, [
    canRegenerateWorldMap,
    createWorldFromSeed,
    dispatch,
    gameState.isMapVisible,
    gameState.mapData,
    gameState.worldSeed,
    worldGenerationLockedReason,
  ]);

  const handleNewGame = useCallback(() => {
    if (canRegenerateWorldMap && gameState.mapData) {
      dispatch({
        type: 'START_NEW_GAME_SETUP',
        payload: {
          mapData: gameState.mapData,
          dynamicLocationItemIds: buildDynamicLocationItemSnapshot(),
          worldSeed: gameState.worldSeed,
        },
      });
      return;
    }

    initializeNewGame();
  }, [
    buildDynamicLocationItemSnapshot,
    canRegenerateWorldMap,
    dispatch,
    gameState.mapData,
    gameState.worldSeed,
    initializeNewGame,
  ]);

  const handleDevMenuAction = useCallback(async (actionType: string) => {
    const actionsThatNeedMenuToggle = ['save', 'battle_map_demo', 'combat_messaging_demo', 'generate_encounter', 'restart_dynamic_party', 'quick_start_dev', 'test_village'];

    if (actionsThatNeedMenuToggle.includes(actionType)) {
      dispatch({ type: 'TOGGLE_DEV_MENU' });
    }

    switch (actionType as typeof actionsThatNeedMenuToggle[number] | 'main_menu' | 'char_creator' | 'toggle_log_viewer' | 'toggle_party_editor' | 'toggle_npc_test_plan' | 'inspect_noble_houses' | 'load' | 'toggle_naval_dashboard' | 'toggle_trade_route_dashboard' | 'toggle_economy_ledger' | 'toggle_courier_pouch' | 'combat_messaging_demo') {
      case 'restart_dynamic_party':
        dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: "Generating new party..." } });
        try {
          // Load the procedural companion generator only for this dev action.
          // It pulls in character, NPC, and local-AI helpers that the main menu
          // does not need during normal startup.
          const { generateCompanion } = await import('./services/CompanionGenerator');
          const newParty: PlayerCharacter[] = [];
          // Generate a party of 3 for now
          const configs = [
            { level: 1, classId: 'fighter', raceId: 'human' },
            { level: 1, classId: 'rogue', raceId: 'tiefling' },
            { level: 1, classId: 'wizard', raceId: 'elf' },
          ];

          for (const config of configs) {
            const companion = await generateCompanion(config);
            if (companion) {
              newParty.push(companion);
            }
          }

          if (newParty.length === configs.length) {
            dispatch({ type: 'RESTART_WITH_PROCEDURAL_PARTY', payload: newParty });
          } else {
            throw new Error("Failed to generate one or more companions.");
          }

        } catch (error) {
          console.error("Failed to restart with procedural party:", error);
          window.alert(`Failed to restart with procedural party: ${error}`);
          dispatch({ type: 'SET_ERROR', payload: "Failed to generate a new party. Check the console for details." });
        } finally {
          dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
        }
        break;
      case 'main_menu':
        dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.MAIN_MENU });
        break;
      case 'char_creator':
        handleNewGame();
        break;
      case 'quick_start_dev':
        // This route used to be a standalone main-menu button. It now lives inside the
        // shared Dev Menu so all developer-only start flows are grouped in one place.
        await handleSkipCharacterCreator();
        break;
      case 'save':
        processAction({ type: 'save_game', label: 'Force Save' });
        break;
      case 'load':
        handleLoadGameFlow();
        break;
      case 'toggle_log_viewer':
        dispatch({ type: 'TOGGLE_GEMINI_LOG_VIEWER' });
        break;
      case 'toggle_unified_log_viewer':
        dispatch({ type: 'TOGGLE_UNIFIED_LOG_VIEWER' });
        break;
      // 'design_preview' removed - access via /Aralia/misc/design.html
      case 'battle_map_demo':
        handleBattleMapDemo();
        break;
      case 'combat_messaging_demo':
        dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.COMBAT_MESSAGING_DEMO });
        break;
      case 'toggle_party_editor':
        dispatch({ type: 'TOGGLE_PARTY_EDITOR_MODAL' });
        break;
      case 'generate_encounter':
        processAction({ type: 'GENERATE_ENCOUNTER', label: 'Generate Encounter' });
        break;
      case 'toggle_npc_test_plan':
        processAction({ type: 'TOGGLE_NPC_TEST_MODAL', label: 'Toggle NPC Test Plan' });
        break;
      case 'inspect_noble_houses':
        dispatch({ type: 'TOGGLE_NOBLE_HOUSE_LIST' });
        break;
      case 'toggle_naval_dashboard':
        dispatch({ type: 'TOGGLE_NAVAL_DASHBOARD' });
        break;
      case 'toggle_trade_route_dashboard':
        dispatch({ type: 'TOGGLE_TRADE_ROUTE_DASHBOARD' });
        break;
      case 'toggle_economy_ledger':
        dispatch({ type: 'TOGGLE_ECONOMY_LEDGER' });
        break;
      case 'toggle_courier_pouch':
        dispatch({ type: 'TOGGLE_COURIER_POUCH' });
        break;
      case 'test_lockpicking':
        // Open lockpicking modal with a sample test lock
        dispatch({
          type: 'OPEN_LOCKPICKING_MODAL',
          payload: {
            id: 'test-lock-1',
            dc: 15,
            breakDC: 20,
            isLocked: true,
            isBroken: false,
            isTrapped: true,
            trap: {
              id: 'test-trap-1',
              name: 'Poison Needle Trap',
              detectionDC: 12,
              disarmDC: 14,
              triggerCondition: 'touch',
              effect: { damage: { count: 1, sides: 4, bonus: 0 }, damageType: 'poison' },
              resetable: false,
              isDisarmed: false,
              isTriggered: false,
            },
          },
        });
        break;
      case 'test_dice_roller':
        dispatch({ type: 'TOGGLE_DICE_ROLLER' });
        break;
      case 'test_village':
        dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.VILLAGE_VIEW });
        break;
    }
  }, [dispatch, handleNewGame, processAction, handleLoadGameFlow, handleBattleMapDemo, handleSkipCharacterCreator]);

  const handleModelChange = useCallback((model: string | null) => {
    dispatch({ type: 'SET_DEV_MODEL_OVERRIDE', payload: model });
  }, [dispatch]);

  // The main-menu dev entry now opens the same shared developer modal that gameplay uses,
  // but it should not silently change the user's Dev Mode choice just because the modal
  // was reopened. The modal itself exposes the real toggle, so this handler only opens
  // the shared surface and preserves whatever state the user last chose.
  const handleOpenDevMenuFromMainMenu = useCallback(() => {
    if (!gameState.isDevMenuVisible) {
      dispatch({ type: 'TOGGLE_DEV_MENU' });
    }
  }, [dispatch, gameState.isDevMenuVisible]);


  const handleNavigateToGlossaryFromTooltip = useCallback((termId: string) => {
    if (!gameState.isGlossaryVisible) {
      dispatch({ type: 'SET_GLOSSARY_TERM_FOR_MODAL', payload: termId });
      processAction({ type: 'TOGGLE_GLOSSARY_VISIBILITY', label: 'Open Glossary' });
    } else {
      dispatch({ type: 'SET_GLOSSARY_TERM_FOR_MODAL', payload: termId });
    }
  }, [dispatch, processAction, gameState.isGlossaryVisible]);


  // --- Main Content Rendering Logic ---
  // The 'mainContent' variable determines the primary view of the application based on the current 'gamePhase'.
  // This approach keeps the return statement clean and focused on high-level structure.
  let mainContent: React.ReactNode = null;
  const currentLocationData = getCurrentLocation();
  const npcs = getCurrentNPCs();
  const itemsInCurrentLocation =
    (itemsById && !currentLocationData.id.startsWith('coord_') && currentLocationData.itemIds
      ?.map((id) => itemsById[id])
      .filter(Boolean) as Item[]) || [];

  // Determine if the UI should be interactive based on modal/loading states.
  // This boolean is passed down to disable controls when overlays are active.
  const isUIInteractive = !gameState.isLoading &&
    !gameState.isImageLoading &&
    !gameState.characterSheetModal.isOpen &&
    !gameState.isMapVisible &&
    !gameState.isSubmapVisible &&
    !gameState.isDevMenuVisible &&
    !gameState.isGeminiLogViewerVisible &&
    !gameState.isDiscoveryLogVisible &&
    !gameState.isGlossaryVisible &&
    !gameState.isPartyEditorVisible &&
    !gameState.isPartyOverlayVisible &&
    !gameState.isEncounterModalVisible &&
    !gameState.isNpcTestModalVisible &&
    !gameState.isLogbookVisible &&
    !gameState.isQuestLogVisible &&
    !gameState.isGameGuideVisible &&
    !gameState.isInvestmentBoardVisible &&
    !gameState.merchantModal.isOpen &&
    !gameState.isEconomyLedgerVisible &&
    !gameState.isCourierPouchVisible &&
    !missingChoiceModal.isOpen;

  // Specific check for Submap interaction disabling
  const submapPaneDisabled = gameState.isLoading ||
    gameState.isImageLoading ||
    gameState.characterSheetModal.isOpen ||
    gameState.isMapVisible ||
    gameState.isDevMenuVisible ||
    gameState.isGeminiLogViewerVisible ||
    gameState.isDiscoveryLogVisible ||
    gameState.isGlossaryVisible ||
    gameState.isNpcTestModalVisible ||
    gameState.isLogbookVisible ||
    gameState.isQuestLogVisible ||
    gameState.isGameGuideVisible ||
    gameState.isInvestmentBoardVisible ||
    gameState.merchantModal.isOpen ||
    missingChoiceModal.isOpen;


  const handleGoBackFromMainMenu = useCallback(() => {
    const prevPhase: GamePhase | undefined = gameState.previousPhase;
    if (prevPhase !== undefined && prevPhase !== GamePhase.MAIN_MENU) {
      dispatch({ type: 'SET_GAME_PHASE', payload: prevPhase });
    }
  }, [gameState.previousPhase, dispatch]);

  // --- Phase-Based Rendering ---

  if (gameState.phase === GamePhase.MAIN_MENU) {
    // Render the Main Menu: New Game, Load Game, etc.
    const prevPhase: GamePhase | undefined = gameState.previousPhase;
    const canGoBack = prevPhase !== undefined && prevPhase !== GamePhase.MAIN_MENU;
    mainContent = (
      <ErrorBoundary fallbackMessage="An error occurred in the Main Menu.">
        <MainMenu
          onNewGame={handleNewGame}
          onLoadGame={handleLoadGameFlow}
          // Arrow function wrapper prevents React's onClick event from being passed as initialTermId
          onShowCompendium={() => handleOpenGlossary()}
          hasSaveGame={hasStoredSaveGame}
          latestSaveTimestamp={SaveLoadService.getLatestSaveTimestamp()}
          isDevDummyActive={canUseDevTools()}
          onSkipCharacterCreator={handleSkipCharacterCreator}
          onClearAllSaves={handleClearAllSaves}
          hasActiveRun={hasActiveRunInMemory}
          onAbandonRun={handleAbandonRun}
          onOpenWorldGeneration={handleOpenWorldGenerationFromMainMenu}
          isWorldGenerationLocked={!canRegenerateWorldMap}
          worldGenerationLockedReason={worldGenerationLockedReason}
          // The main-menu Dev Menu button now reuses the same shared modal as gameplay,
          // but it preserves the current Dev Mode flag instead of force-enabling it.
          onOpenDevMenu={handleOpenDevMenuFromMainMenu}
          onGoBack={canGoBack ? handleGoBackFromMainMenu : undefined}
          canGoBack={canGoBack}
        />
      </ErrorBoundary>
    );
  } else if (gameState.phase === GamePhase.CHARACTER_CREATION) {
    // Render the Character Creator interface
    mainContent = (
      <ErrorBoundary fallbackMessage="An error occurred during Character Creation.">
        <CharacterCreator
          onCharacterCreate={(character, inventory) => startGame(character, inventory, gameState.worldSeed)}
          onExitToMainMenu={handleExitCharacterCreatorToMainMenu}
          dispatch={dispatch}
        />
      </ErrorBoundary>
    );
  } else if (gameState.phase === GamePhase.BATTLE_MAP_DEMO) {
    // Render the standalone Battle Map Demo
    mainContent = (
      <ErrorBoundary fallbackMessage="An error occurred in the Battle Map.">
        <BattleMapDemo
          onExit={() => dispatch({ type: 'END_BATTLE' })}
          initialCharacters={gameState.currentEnemies || []}
          party={gameState.party}
        />
      </ErrorBoundary>
    );
  } else if (gameState.phase === GamePhase.WORLD3D_DEMO) {
    // Render the 3D Sandbox Demo
    mainContent = (
      <ErrorBoundary fallbackMessage="An error occurred in the 3D Sandbox.">
        <World3DDemo />
      </ErrorBoundary>
    );
  } else if (gameState.phase === GamePhase.WORLDFORGE_DEMO) {
    // Worldforge atlas cartographer (?phase=worldforge): the native
    // ported-FMG map surface (docs/projects/worldforge, orchestration Lane A).
    mainContent = (
      <ErrorBoundary fallbackMessage="An error occurred in the Worldforge cartographer.">
        <WorldforgeAtlasDemo />
      </ErrorBoundary>
    );
  } else if (gameState.phase === GamePhase.COMBAT_MESSAGING_DEMO) {
    // Render the unified Combat Messaging System Demo
    mainContent = (
      <ErrorBoundary fallbackMessage="An error occurred in the Combat Messaging Demo.">
        <CombatMessagingDemo onExit={() => dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.MAIN_MENU })} />
      </ErrorBoundary>
    );
  } else if (gameState.phase === GamePhase.COMBAT) {
    // Render the full Combat View
    const allowedBiomes: Array<'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp'> = ['forest', 'cave', 'dungeon', 'desert', 'swamp'];
    const combatBiome: 'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp' = (currentLocationData.biomeId && allowedBiomes.includes(currentLocationData.biomeId as typeof allowedBiomes[number]))
      ? (currentLocationData.biomeId as typeof allowedBiomes[number])
      : 'forest';

    mainContent = (
      <ErrorBoundary fallbackMessage="An error occurred during Combat.">
        <CombatView
          party={gameState.party}
          enemies={gameState.currentEnemies || []}
          biome={combatBiome}
          onRoundElapsed={handleCombatRoundElapsed}
          onBattleEnd={(result, rewards) => {
            addMessage(result === 'victory' ? 'Victory! The enemies are defeated.' : 'Defeat! The party has fallen.', 'system');
            if (result === 'victory' && rewards) {
              dispatch({ type: 'END_BATTLE', payload: { rewards } });
            } else {
              dispatch({ type: 'END_BATTLE' });
            }
          }}
        />
      </ErrorBoundary>
    );
  } else if (gameState.phase === GamePhase.VILLAGE_VIEW) {
    // Render the Town/Village View Canvas
    const currentLocationData = getCurrentLocation();
    const worldCoords = currentLocationData.mapCoordinates;
    const biome = currentLocationData.biomeId || 'plains';

    // Determine settlement characteristics for culturally appropriate generation
    const settlementInfo = determineSettlementInfo(currentLocationData, gameState);

    mainContent = (
      <ErrorBoundary fallbackMessage="An error occurred in the Village Scene.">
        <TownCanvas
          worldSeed={gameState.worldSeed}
          worldX={worldCoords?.x || 50}
          worldY={worldCoords?.y || 50}
          biome={biome}
          settlementInfo={settlementInfo}
          onAction={processAction}
          gameTime={gameState.gameTime}
          currentLocation={currentLocationData}
          disabled={!isUIInteractive}
          npcsInLocation={npcs}
          itemsInLocation={itemsInCurrentLocation}
          geminiGeneratedActions={gameState.geminiGeneratedActions || []}
          isDevDummyActive={canUseDevTools()}
          unreadDiscoveryCount={gameState.unreadDiscoveryCount}
          hasNewRateLimitError={gameState.hasNewRateLimitError}
          playerCharacter={gameState.party[0]}
          // Player navigation props
          // Only pass external handlers when townState exists (otherwise TownCanvas uses local state)
          playerPosition={gameState.townState?.playerPosition}
          entryDirection={gameState.townEntryDirection}
          onPlayerMove={gameState.townState ? (direction) => {
            dispatch({ type: 'MOVE_IN_TOWN', payload: { direction } });
          } : undefined}
          onExitTown={() => {
            dispatch({ type: 'EXIT_TOWN' });
            dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.PLAYING });
          }}
        />
      </ErrorBoundary>
    );
  } else if (gameState.phase === GamePhase.PLAYING && gameState.party.length > 0 && gameState.subMapCoordinates) {
    // Render the Main Game Layout (Exploration Mode)
    // <GameLayout> extracts the complexity of the Compass, Action, World, and Minimap panes.
    // When worldViewMode === '3d', render the 3D world instead of the 2D atlas.
    // mapSurface ('classic' | 'worldforge') swaps the 2D surface between the
    // legacy GameLayout and the native ported-FMG Worldforge cartographer.
    const useWorldforgeSurface = (gameState.mapSurface ?? 'classic') === 'worldforge';

    const atlasContent = useWorldforgeSurface ? (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <Suspense fallback={<LoadingSpinner />}>
          <WorldforgeAtlasDemo />
        </Suspense>
        <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 40 }}>
          <MapSurfaceToggle />
        </div>
      </div>
    ) : (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <GameLayout
          currentLocation={currentLocationData}
          subMapCoordinates={gameState.subMapCoordinates}
          mapData={gameState.mapData}
          gameTime={gameState.gameTime}
          messages={gameState.messages}
          npcsInLocation={npcs}
          itemsInLocation={itemsInCurrentLocation}
          party={gameState.party}
          geminiGeneratedActions={gameState.geminiGeneratedActions}
          unreadDiscoveryCount={gameState.unreadDiscoveryCount}
          hasNewRateLimitError={gameState.hasNewRateLimitError}
          worldSeed={gameState.worldSeed}
          isDevModeEnabled={gameState.isDevModeEnabled ?? false}
          autoSaveEnabled={autoSaveEnabled}
          disabled={!isUIInteractive}
          onAction={processAction}
          playerWorldPos={gameState.playerWorldPos}
        />
        <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 40 }}>
          <MapSurfaceToggle />
        </div>
      </div>
    );

    // Entry position: use saved 3D position, or default to current location center.
    // Grid → world meters uses METERS_PER_CELL (the chunk geometry's mapping);
    // the old ×128 (CHUNK_WORLD_SIZE) constant put the camera at ~1/8 scale,
    // spawning everyone in the map's top-left corner regardless of location.
    const entryPosition = gameState.playerWorldPos ?? {
      x: (currentLocationData.mapCoordinates?.x ?? 30) * WORLD3D_CONFIG.METERS_PER_CELL,
      y: 0,
      z: (currentLocationData.mapCoordinates?.y ?? 20) * WORLD3D_CONFIG.METERS_PER_CELL,
    };

    mainContent = (
      <ErrorBoundary fallbackMessage="An error occurred in the main game view.">
        <Suspense fallback={<LoadingSpinner />}>
          <TransitionController
            mode={gameState.worldViewMode}
            onComplete={handleTransitionComplete}
            atlasContent={atlasContent}
            sceneContent={(
              <World3DWrapper
                entryPosition={entryPosition}
                worldData={resolveWorldDataFor3D(gameState.mapData, gameState.worldSeed ?? 0)}
              />
            )}
          />
        </Suspense>
      </ErrorBoundary>
    );
  } else if (gameState.phase === GamePhase.GAME_OVER) {
    mainContent = (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-red-600 font-serif gap-8">
        <h1 className="text-6xl tracking-wider">{t('app.game_over')}</h1>
        <button
          onClick={() => dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.MAIN_MENU })}
          className="px-8 py-3 bg-red-900/50 hover:bg-red-800/80 border border-red-700 rounded text-xl text-red-100 transition-colors"
        >
          Return to Main Menu
        </button>
      </div>
    );
  } else if (gameState.phase === GamePhase.LOAD_TRANSITION && gameState.party[0]) {
    mainContent = <LoadGameTransition character={gameState.party[0]} />;
  } else if (gameState.phase === GamePhase.NOT_FOUND) {
    mainContent = (
      <NotFound
        onReturnToMainMenu={() => dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.MAIN_MENU })}
      />
    );
  }

  const notifications = (gameState.notifications as Notification[]) || [];
  const shouldLoadGlossaryData = gameState.phase !== GamePhase.MAIN_MENU || gameState.isGlossaryVisible;
  const shouldLoadSpellData = gameState.phase !== GamePhase.MAIN_MENU;

  // --- Root Render ---
  // Wraps the application in <AppProviders> for context access.
  // Renders global notifications, the computed 'mainContent', and the manager for <GameModals>.
  return (
    <AppProviders loadGlossaryData={shouldLoadGlossaryData} loadSpellData={shouldLoadSpellData}>
      <GameProvider state={gameState} dispatch={dispatch}>
        <div className="App min-h-screen bg-gray-900">
          <NotificationSystem notifications={notifications} dispatch={dispatch} />

          {/* Global Loading Spinner */}
          <AnimatePresence>
            {(gameState.isLoading || gameState.isImageLoading) && <LoadingSpinner message={gameState.loadingMessage || (gameState.isImageLoading ? t('app.ui.loading.image') : t('app.ui.loading.default'))} />}
          </AnimatePresence>

          {/* Global Error Message Banner */}
          {gameState.error && (
            <div className={`bg-red-800 text-white p-4 fixed top-0 left-0 right-0 z-[${Z_INDEX.ERROR_OVERLAY}] text-center`}>
              {t('app.ui.error.message', { message: gameState.error })}
              <button onClick={() => dispatch({ type: 'SET_ERROR', payload: null })} className="ml-4 bg-red-600 px-2 py-1 rounded">{t('app.ui.error.dismiss')}</button>
            </div>
          )}

          {/* Primary View */}
          <Suspense fallback={<LoadingSpinner />}>
            {gameState.phase === GamePhase.MAIN_MENU ? (
              mainContent
            ) : (
              <DataLoaderGate>
                {mainContent}
              </DataLoaderGate>
            )}
          </Suspense>

          {/* Interactive Companion Conversation Panel */}
          {gameState.phase === GamePhase.PLAYING && gameState.activeConversation && (
            <ConversationPanel gameState={gameState} dispatch={dispatch} />
          )}

          {/* Opening-situation entry gate (GAME-ENTRY-SITUATION): runs the
              generator and renders the generating overlay / honest model block. */}
          {gameState.phase === GamePhase.PLAYING && (
            <OpeningSituationGate gameState={gameState} dispatch={dispatch} />
          )}

          {/* Modal Manager: Handles all overlays (Inventory, Map, Logs, etc.) */}
          <GameModals
            gameState={gameState}
            dispatch={dispatch}
            onAction={processAction}
            onTileClick={handleTileClick}
            onEnter3DAtCell={handleEnter3DAtCell}
            playerWorldPos={gameState.playerWorldPos}
            allow3DEntry={gameState.phase === GamePhase.PLAYING}
            currentLocation={currentLocationData}
            npcsInLocation={npcs}
            itemsInLocation={itemsInCurrentLocation}
            isUIInteractive={isUIInteractive}
            submapPaneDisabled={!!submapPaneDisabled}
            missingChoiceModal={missingChoiceModal}
            onCloseMissingChoice={() => setMissingChoiceModal({ isOpen: false, character: null, missingChoice: null })}
            onConfirmMissingChoice={handleConfirmMissingChoice}
            onFixMissingChoice={handleFixMissingChoice}
            handleCloseCharacterSheet={handleCloseCharacterSheet}
            handleClosePartyOverlay={handleClosePartyOverlay}
            handleDevMenuAction={handleDevMenuAction}
            handleModelChange={handleModelChange}
            handleNavigateToGlossaryFromTooltip={handleNavigateToGlossaryFromTooltip}
            handleOpenGlossary={handleOpenGlossary}
            handleOpenCharacterSheet={handleOpenCharacterSheet}

            onForceBanterTrigger={forceBanter}
            onClearBanterLogs={() => dispatch({ type: 'CLEAR_BANTER_DEBUG_LOG' })}
            isBanterPaused={isBanterPaused}
            toggleBanterPause={() => setIsBanterPaused(prev => !prev)}
            canRegenerateWorldMap={canRegenerateWorldMap}
            worldGenerationLockedReason={worldGenerationLockedReason}
            onRegenerateWorldMap={handleRegenerateWorldMap}
          />

          {/* Global Companion Reactions (hidden in the main exploration interface where log is visible) */}
          {(gameState.phase !== GamePhase.PLAYING || !isUIInteractive) && (
            <CompanionReaction
              companions={gameState.companions}
              latestMessage={gameState.messages[gameState.messages.length - 1]}
            />
          )}

          {/* Banter Panel */}
          {gameState.phase === GamePhase.PLAYING && (
            <CollapsibleBanterPanel
              isActive={isBanterActive}
              isWaiting={isWaitingForNextLine}
              isGenerating={isGenerating}
              generatingSpeakerName={generatingSpeakerName}
              secondsRemaining={secondsUntilNextLine}
              history={banterHistory}
              archivedBanters={gameState.archivedBanters}
              companions={gameState.companions}
              onInterrupt={playerInterrupt}
              onEndBanter={endBanter}
              isPlayerDirected={isPlayerDirected}
              isWaitingForPlayerResponse={isWaitingForPlayerResponse}
              playerResponseDeadlineSeconds={playerResponseDeadlineSeconds}
              forceExpand={isPlayerDirected && isWaitingForPlayerResponse}
              onExtendDeadline={extendPlayerResponseDeadline}
              onExtendNpcDelay={extendNpcLineDelay}
            />
          )}

          {/* Attention banner — floats at bottom-centre when an NPC addresses the player */}
          {/* WHAT CHANGED: Added the BanterAttentionBanner component. */}
          {/* WHY IT CHANGED: When an NPC speaks directly to the player, it's easy to miss 
              if the chat panel is collapsed. This banner provides a high-visibility 
              "call to action" that alerts the player they need to respond before 
               the deadline expires. */}
          {gameState.phase === GamePhase.PLAYING &&
            isBanterActive &&
            isPlayerDirected &&
            isWaitingForPlayerResponse && (
              <BanterAttentionBanner
                speakerName={banterHistory[banterHistory.length - 1]?.speakerName}
                lastLine={banterHistory[banterHistory.length - 1]?.text}
                deadlineSeconds={playerResponseDeadlineSeconds}
                onExtendDeadline={extendPlayerResponseDeadline}
                onOpenChat={() => {
                  /* forceExpand already auto-opens the panel via its useEffect;
                     nothing extra needed here. */
                }}
              />
            )}

          {/* Global Dice Roller Overlay */}
          <DiceOverlay />
        </div>
      </GameProvider>
    </AppProviders>
  );
};

export default App;
