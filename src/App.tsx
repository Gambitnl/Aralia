/**
 * @file App.tsx
 * EXECUTION FLOW SEGMENT 2: Root Application Component
 * 
 * This is the root component of the Aralia RPG application, loaded by index.tsx.
 * It manages all game state, phases (menu, character creation, gameplay), and orchestrates
 * the rendering of all other components.
 */

// React hooks - useReducer for complex state management, useCallback for memoized functions,
// useEffect for side effects, useState for local component state
import React, { useReducer, useCallback, useEffect, useState } from 'react';
// Framer Motion - provides animation components like AnimatePresence for smooth UI transitions
import { AnimatePresence } from 'framer-motion';

// Core TypeScript types/interfaces used throughout the application
// These define the structure of locations, messages, NPCs, items, characters, game phases, etc.
import { Location, GameMessage, NPC, MapTile, Item, PlayerCharacter, GamePhase, MissingChoice } from './types';
// State management - appReducer handles all state updates via actions, initialGameState provides defaults
import { appReducer, initialGameState } from './state/appState';
// Custom hooks - encapsulate reusable logic for audio, game actions, and initialization
import { useAudio } from './hooks/useAudio';
import { useGameActions } from './hooks/useGameActions';
import { useGameInitialization } from './hooks/useGameInitialization';
import { useHistorySync } from './hooks/useHistorySync';
import { determineSettlementInfo } from './utils/settlementGeneration';

// Utility functions
import { determineActiveDynamicNpcsForLocation } from './utils/locationUtils';

// Context providers - wrap the app to provide glossary and spell data to all child components
import { AppProviders } from './components/providers/AppProviders';
import {
  STARTING_LOCATION_ID,
  LOCATIONS,
  ITEMS,
  NPCS,
  DUMMY_PARTY_FOR_DEV,
  USE_DUMMY_CHARACTER_FOR_DEV,
  BIOMES,
} from './constants';
import { SUBMAP_DIMENSIONS } from './config/mapConfig';

import { NotificationSystem } from './components/NotificationSystem';
import GameLayout from './components/layout/GameLayout';
import GameModals from './components/layout/GameModals';
import CharacterCreator from './components/CharacterCreator/CharacterCreator';
import MainMenu from './components/MainMenu';
import TownCanvas from './components/TownCanvas';
import ErrorBoundary from './components/ErrorBoundary';
import * as SaveLoadService from './services/saveLoadService';
import LoadingSpinner from './components/LoadingSpinner';
import BattleMapDemo from './components/BattleMapDemo';
import CombatView from './components/CombatView';
import LoadGameTransition from './components/LoadGameTransition';


const App: React.FC = () => {
  const [gameState, dispatch] = useReducer(appReducer, initialGameState);

  // 🏹 Ranger: Sync GamePhase with URL history
  useHistorySync(gameState, dispatch);

  // State for Missing Choice Modal
  const [missingChoiceModal, setMissingChoiceModal] = useState<{
    isOpen: boolean;
    character: PlayerCharacter | null;
    missingChoice: MissingChoice | null;
  }>({ isOpen: false, character: null, missingChoice: null });

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

  const { playPcmAudio, cleanupAudioContext } = useAudio(addMessage);

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
        Object.keys(USE_DUMMY_CHARACTER_FOR_DEV ? {} : {}).forEach(dir => {
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
      return `Undiscovered area (${worldMapTile.x}, ${worldMapTile.y}). Potential biome: ${biome?.name || 'Unknown'}.`;
    }
    let tooltip = `${biome?.name || 'Unknown Area'} at world map coordinates (${worldMapTile.x}, ${worldMapTile.y})`;
    if (worldMapTile.locationId && LOCATIONS[worldMapTile.locationId]) {
      tooltip += ` - Location: ${LOCATIONS[worldMapTile.locationId].name}.`;
    } else {
      tooltip += ".";
    }
    if (biome?.description) {
      tooltip += ` General description: ${biome.description}`;
    }
    return tooltip;
  }, []);

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
      USE_DUMMY_CHARACTER_FOR_DEV &&
      DUMMY_PARTY_FOR_DEV.length > 0 &&
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

  const handleDevMenuAction = useCallback((actionType: 'main_menu' | 'char_creator' | 'save' | 'load' | 'toggle_log_viewer' | 'battle_map_demo' | 'generate_encounter' | 'toggle_party_editor' | 'toggle_npc_test_plan') => {
    const actionsThatNeedMenuToggle = ['save', 'battle_map_demo', 'generate_encounter'];

    if (actionsThatNeedMenuToggle.includes(actionType)) {
      dispatch({ type: 'TOGGLE_DEV_MENU' });
    }

    switch (actionType) {
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


  // Handler for missing choice selection
  const handleFixMissingChoice = useCallback((character: PlayerCharacter, missing: MissingChoice) => {
    setMissingChoiceModal({
      isOpen: true,
      character,
      missingChoice: missing
    });
  }, []);

  const handleConfirmMissingChoice = useCallback((choiceId: string, extraData?: any) => {
    if (missingChoiceModal.character && missingChoiceModal.missingChoice) {
      dispatch({
        type: 'UPDATE_CHARACTER_CHOICE',
        payload: {
          characterId: missingChoiceModal.character.id!,
          choiceType: missingChoiceModal.missingChoice.id, // e.g., 'dragonborn_ancestry' or 'missing_racial_spell'
          choiceId: choiceId, // e.g., 'Red' or 'druidcraft'
          secondaryValue: extraData, // Pass extra data like isCantrip
        }
      });
      addMessage(`Updated ${missingChoiceModal.character.name}: Selected ${choiceId}.`, 'system');
    }
  }, [missingChoiceModal, dispatch, addMessage]);


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
    if (gameState.previousPhase && gameState.previousPhase !== GamePhase.MAIN_MENU) {
      dispatch({ type: 'SET_GAME_PHASE', payload: gameState.previousPhase });
    }
  }, [gameState.previousPhase, dispatch]);

  // --- Phase-Based Rendering ---

  if (gameState.phase === GamePhase.MAIN_MENU) {
    // Render the Main Menu: New Game, Load Game, etc.
    const canGoBack = !!gameState.previousPhase && gameState.previousPhase !== GamePhase.MAIN_MENU;
    mainContent = (
      <ErrorBoundary fallbackMessage="An error occurred in the Main Menu.">
        <MainMenu
          onNewGame={handleNewGame}
          onLoadGame={handleLoadGameFlow}
          onShowCompendium={handleOpenGlossary}
          hasSaveGame={SaveLoadService.hasSaveGame()}
          latestSaveTimestamp={SaveLoadService.getLatestSaveTimestamp()}
          isDevDummyActive={USE_DUMMY_CHARACTER_FOR_DEV}
          onSkipCharacterCreator={handleSkipCharacterCreator}
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
    const combatBiome = (currentLocationData.biomeId && ['forest', 'cave', 'dungeon', 'desert', 'swamp'].includes(currentLocationData.biomeId))
      ? (currentLocationData.biomeId as any)
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
          isDevDummyActive={USE_DUMMY_CHARACTER_FOR_DEV}
          unreadDiscoveryCount={gameState.unreadDiscoveryCount}
          hasNewRateLimitError={gameState.hasNewRateLimitError}
          // Player navigation props
          playerPosition={gameState.townState?.playerPosition}
          onPlayerMove={(direction) => {
            dispatch({ type: 'MOVE_IN_TOWN', payload: { direction } });
          }}
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
      <GameLayout
        currentLocation={currentLocationData}
        subMapCoordinates={gameState.subMapCoordinates}
        mapData={gameState.mapData}
        gameTime={gameState.gameTime}
        messages={gameState.messages}
        npcsInLocation={npcs}
        itemsInLocation={itemsInCurrentLocation}
        geminiGeneratedActions={gameState.geminiGeneratedActions}
        unreadDiscoveryCount={gameState.unreadDiscoveryCount}
        hasNewRateLimitError={gameState.hasNewRateLimitError}
        worldSeed={gameState.worldSeed}
        isDevDummyActive={USE_DUMMY_CHARACTER_FOR_DEV}
        disabled={!isUIInteractive}
        onAction={processAction}
      />
    );
  } else if (gameState.phase === GamePhase.GAME_OVER) {
    mainContent = (
      <div className="flex items-center justify-center h-screen bg-black text-red-600 text-4xl font-serif">
        GAME OVER
      </div>
    );
  } else if (gameState.phase === GamePhase.LOAD_TRANSITION) {
    mainContent = <LoadGameTransition character={gameState.party[0]} />;
  }

  // --- Root Render ---
  // Wraps the application in <AppProviders> for context access.
  // Renders global notifications, the computed 'mainContent', and the manager for <GameModals>.
  return (
    <AppProviders>
      <div className="App min-h-screen bg-gray-900">
        <NotificationSystem notifications={gameState.notifications} dispatch={dispatch} />

        {/* Global Loading Spinner */}
        <AnimatePresence>
          {(gameState.isLoading || gameState.isImageLoading) && <LoadingSpinner message={gameState.loadingMessage || (gameState.isImageLoading ? "A vision forms in the æther..." : "Aralia is weaving fate...")} />}
        </AnimatePresence>

        {/* Global Error Message Banner */}
        {gameState.error && (
          <div className="bg-red-800 text-white p-4 fixed top-0 left-0 right-0 z-[100] text-center">
            Error: {gameState.error}
            <button onClick={() => dispatch({ type: 'SET_ERROR', payload: null })} className="ml-4 bg-red-600 px-2 py-1 rounded">Dismiss</button>
          </div>
        )}

        {/* Primary View */}
        {mainContent}

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
        />
      </div>
    </AppProviders>
  );
};

export default App;
