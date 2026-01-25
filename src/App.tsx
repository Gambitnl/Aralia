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

// React hooks - useReducer for complex state management, useCallback for memoized functions,
// useEffect for side effects
import React, { useReducer, useCallback, useEffect, lazy, Suspense, useState } from 'react';
// Framer Motion - provides animation components like AnimatePresence for smooth UI transitions
import { AnimatePresence } from 'framer-motion';

// Core TypeScript types/interfaces used throughout the application
// These define the structure of locations, messages, NPCs, items, characters, game phases, etc.
import { Location, GameMessage, NPC, MapTile, Item, PlayerCharacter, GamePhase, Notification } from './types';
// State management - appReducer handles all state updates via actions, initialGameState provides defaults
import { appReducer, initialGameState } from './state/appState';
// Custom hooks - encapsulate reusable logic for audio, game actions, and initialization
import { useAudio } from './hooks/useAudio';
import { useGameActions } from './hooks/useGameActions';
import { useGameInitialization } from './hooks/useGameInitialization';
import { useHistorySync } from './hooks/useHistorySync';
import { useCompanionCommentary } from './hooks/useCompanionCommentary';
import { useCompanionBanter } from './hooks/useCompanionBanter';
import { useMissingChoice } from './hooks/useMissingChoice';
import { useOllamaCheck } from './hooks/useOllamaCheck';
import { determineSettlementInfo } from './utils/settlementGeneration';
import { t } from './utils/i18n';
import { generateCompanion } from './services/CompanionGenerator';

// Utility functions
import { determineActiveDynamicNpcsForLocation } from './utils/locationUtils';

// Context providers - wrap the app to provide glossary and spell data to all child components
import { AppProviders } from './components/providers/AppProviders';
import {
  STARTING_LOCATION_ID,
  LOCATIONS,
  ITEMS,
  NPCS,
  BIOMES,
} from './constants';
import { getDummyParty } from './data/dev/dummyCharacter';
import { SUBMAP_DIMENSIONS } from './config/mapConfig';
import { canUseDevTools } from './utils/permissions';
import { validateEnv } from './config/env';
import { DiceOverlay } from './components/dice/DiceOverlay';
import { Z_INDEX } from './styles/zIndex';

import { NotificationSystem } from './components/ui/NotificationSystem';
import { GameProvider } from './state/GameContext';
import { CompanionReaction } from './components/ui/CompanionReaction';
import GameModals from './components/layout/GameModals';
import MainMenu from './components/layout/MainMenu';
import ErrorBoundary from './components/ui/ErrorBoundary';
import * as SaveLoadService from './services/saveLoadService';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { ConversationPanel } from './components/ConversationPanel';

import { CollapsibleBanterPanel } from './components/ui/CollapsibleBanterPanel';

// Lazy load large components to reduce initial bundle size
const TownCanvas = lazy(() => import('./components/Town/TownCanvas'));
const BattleMapDemo = lazy(() => import('./components/BattleMap/BattleMapDemo'));
const CombatView = lazy(() => import('./components/Combat').then(module => ({ default: module.CombatView })));
const CharacterCreator = lazy(() => import('./components/CharacterCreator/CharacterCreator'));
const GameLayout = lazy(() => import('./components/layout/GameLayout'));
const LoadGameTransition = lazy(() => import('./components/SaveLoad').then(module => ({ default: module.LoadGameTransition })));
const NotFound = lazy(() => import('./components/ui/NotFound'));
// --- Decoupled Developer Tools Registry ---
// Some developer tools have been decoupled from the main application bundle to 
// optimize production builds and prevent build-time dependencies on local-only files.
// 
// Access these tools directly via their entry points:
// - Design Preview: /Aralia/misc/design.html
// - Developer Hub:  /Aralia/misc/dev_hub.html (Central landing page)
// -------------------------------------------


// TODO: Add service worker and offline functionality to allow basic gameplay without internet connection for core features
// PROGRESS: Most AI functions (location descriptions, NPC interactions, etc.) now use local Ollama instead of Gemini,
// significantly reducing internet dependency. Merchant inventories still require Gemini. Need service worker for caching
// static assets and handling offline fallbacks when Ollama server is unavailable.
const App: React.FC = () => {
  // Validate environment variables on startup
  useEffect(() => {
    validateEnv();
  }, []);

  const [gameState, dispatch] = useReducer(appReducer, initialGameState);

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
    secondsUntilNextLine,
    playerInterrupt,
    endBanter,
    banterHistory
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
        .map(npcId => NPCS[npcId])
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
  }, [getCurrentLocation, gameState.currentLocationActiveDynamicNpcIds]);

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
    handleNewGame,
    handleSkipCharacterCreator,
    handleLoadGameFlow,
    startGame,
    initializeDummyPlayerState,
  } = useGameInitialization({
    dispatch,
    addMessage,
    currentMapData: gameState.mapData,
  });

  const handleBattleMapDemo = useCallback(() => {
    dispatch({ type: 'SETUP_BATTLE_MAP_DEMO' });
  }, [dispatch]);

  useEffect(() => {
    return () => {
      cleanupAudioContext();
    };
  }, [cleanupAudioContext]);

  useEffect(() => {
    if (
      canUseDevTools() &&
      getDummyParty().length > 0 &&
      gameState.phase === GamePhase.PLAYING &&
      gameState.party.length > 0 &&
      gameState.messages.length === 0 &&
      !SaveLoadService.hasSaveGame()
    ) {
      initializeDummyPlayerState();
    }
  }, [
    gameState.phase,
    gameState.party,
    gameState.messages.length,
    initializeDummyPlayerState,
  ]);

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

    const shouldClockRun =
      gameState.phase === GamePhase.PLAYING &&
      !gameState.isLoading &&
      !gameState.isImageLoading &&
      !gameState.characterSheetModal.isOpen &&
      !gameState.isMapVisible &&
      !gameState.isSubmapVisible &&
      !gameState.isDevMenuVisible &&
      !gameState.isGeminiLogViewerVisible &&
      !gameState.isDiscoveryLogVisible &&
      !gameState.isGlossaryVisible &&
      !gameState.isNpcTestModalVisible &&
      !gameState.isLogbookVisible &&
      !gameState.isGameGuideVisible &&
      !gameState.merchantModal.isOpen &&
      !missingChoiceModal.isOpen; // Pause for missing choice modal


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
    gameState.isNpcTestModalVisible,
    gameState.isLogbookVisible,
    gameState.isGameGuideVisible,
    gameState.merchantModal.isOpen,
    missingChoiceModal.isOpen,
    dispatch
  ]);


  const handleOpenGlossary = useCallback((initialTermId?: string) => {
    if (initialTermId) {
      dispatch({ type: 'SET_GLOSSARY_TERM_FOR_MODAL', payload: initialTermId });
    }
    processAction({ type: 'TOGGLE_GLOSSARY_VISIBILITY', label: 'Toggle Glossary', payload: { initialTermId } });
  }, [dispatch, processAction]);


  const handleExitCharacterCreatorToMainMenu = useCallback(() => {
    dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.MAIN_MENU });
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

  const handleOpenCharacterSheet = useCallback((character: PlayerCharacter) => {
    dispatch({ type: 'OPEN_CHARACTER_SHEET', payload: character });
  }, [dispatch]);

  const handleCloseCharacterSheet = useCallback(() => {
    dispatch({ type: 'CLOSE_CHARACTER_SHEET' });
  }, [dispatch]);

  const handleClosePartyOverlay = useCallback(() => {
    dispatch({ type: 'TOGGLE_PARTY_OVERLAY' });
  }, [dispatch]);

  const handleDevMenuAction = useCallback(async (actionType: string) => {
    const actionsThatNeedMenuToggle = ['save', 'battle_map_demo', 'generate_encounter', 'restart_dynamic_party'];

    if (actionsThatNeedMenuToggle.includes(actionType)) {
      dispatch({ type: 'TOGGLE_DEV_MENU' });
    }

    switch (actionType as typeof actionsThatNeedMenuToggle[number] | 'main_menu' | 'char_creator' | 'toggle_log_viewer' | 'toggle_party_editor' | 'toggle_npc_test_plan' | 'inspect_noble_houses' | 'load' | 'toggle_naval_dashboard' | 'toggle_trade_route_dashboard') {
      case 'restart_dynamic_party':
        dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: "Generating new party..." } });
        try {
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
    }
  }, [dispatch, handleNewGame, processAction, handleLoadGameFlow, handleBattleMapDemo]);

  const handleModelChange = useCallback((model: string | null) => {
    dispatch({ type: 'SET_DEV_MODEL_OVERRIDE', payload: model });
  }, [dispatch]);


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
    (!currentLocationData.id.startsWith('coord_') && currentLocationData.itemIds
      ?.map((id) => ITEMS[id])
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
    !gameState.merchantModal.isOpen &&
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
          hasSaveGame={SaveLoadService.hasSaveGame()}
          latestSaveTimestamp={SaveLoadService.getLatestSaveTimestamp()}
          isDevDummyActive={canUseDevTools()}
          onSkipCharacterCreator={handleSkipCharacterCreator}
          // Handler to toggle the dev menu visibility when requested by the Main Menu
          onOpenDevMenu={() => dispatch({ type: 'TOGGLE_DEV_MENU' })}
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
    mainContent = (
      <ErrorBoundary fallbackMessage="An error occurred in the main game view.">
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
          isDevDummyActive={canUseDevTools()}
          isDevModeEnabled={gameState.isDevModeEnabled ?? false}
          disabled={!isUIInteractive}
          onAction={processAction}
        />
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
  } else if (gameState.phase === GamePhase.LOAD_TRANSITION) {
    mainContent = <LoadGameTransition character={gameState.party[0]} />;
  } else if (gameState.phase === GamePhase.NOT_FOUND) {
    mainContent = (
      <NotFound
        onReturnToMainMenu={() => dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.MAIN_MENU })}
      />
    );
  }

  const notifications = (gameState.notifications as Notification[]) || [];

  // --- Root Render ---
  // Wraps the application in <AppProviders> for context access.
  // Renders global notifications, the computed 'mainContent', and the manager for <GameModals>.
  return (
    <AppProviders>
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
            {mainContent}
          </Suspense>

          {/* Interactive Companion Conversation Panel */}
          {gameState.phase === GamePhase.PLAYING && gameState.activeConversation && (
            <ConversationPanel gameState={gameState} dispatch={dispatch} />
          )}

          {/* Modal Manager: Handles all overlays (Inventory, Map, Logs, etc.) */}
          <GameModals
            gameState={gameState}
            dispatch={dispatch}
            onAction={processAction}
            onTileClick={handleTileClick}
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
              secondsRemaining={secondsUntilNextLine}
              history={banterHistory}
              archivedBanters={gameState.archivedBanters}
              companions={gameState.companions}
              onInterrupt={playerInterrupt}
              onEndBanter={endBanter}
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
