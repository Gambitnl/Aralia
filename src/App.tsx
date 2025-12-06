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

// Utility functions
import { determineActiveDynamicNpcsForLocation } from './utils/locationUtils';

// Context providers - wrap the app to provide glossary and spell data to all child components
import { GlossaryProvider } from './context/GlossaryContext';
import { SpellProvider } from './context/SpellContext';

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

import WorldPane from './components/WorldPane';
import ActionPane from './components/ActionPane';
import CompassPane from './components/CompassPane';
import CharacterCreator from './components/CharacterCreator/CharacterCreator';
import MainMenu from './components/MainMenu';
import MapPane from './components/MapPane';
import SubmapPane from './components/SubmapPane';
import TownCanvas from './components/TownCanvas';
import ErrorBoundary from './components/ErrorBoundary';
import * as SaveLoadService from './services/saveLoadService';
import LoadingSpinner from './components/LoadingSpinner';
import CharacterSheetModal from './components/CharacterSheetModal';
import DevMenu from './components/DevMenu';
import GeminiLogViewer from './components/GeminiLogViewer';
import DiscoveryLogPane from './components/DiscoveryLogPane';
import Glossary from './components/Glossary';
import BattleMapDemo from './components/BattleMapDemo';
import CombatView from './components/CombatView'; // Import CombatView
import EncounterModal from './components/EncounterModal';
import PartyEditorModal from './components/PartyEditorModal';
import PartyOverlay from './components/PartyOverlay';
import NpcInteractionTestModal from './components/NpcInteractionTestModal';
import LogbookPane from './components/LogbookPane';
import MerchantModal from './components/MerchantModal';
import GameGuideModal from './components/GameGuideModal';
import MissingChoiceModal from './components/MissingChoiceModal'; // New Import
import LoadGameTransition from './components/LoadGameTransition';
import { NotificationSystem } from './components/NotificationSystem';
import QuestLog from './components/QuestLog';
import Minimap from './components/Minimap';
import { VersionDisplay } from './components/VersionDisplay';


const App: React.FC = () => {
  const [gameState, dispatch] = useReducer(appReducer, initialGameState);

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
  let mainContent: React.ReactNode = null;
  const currentLocationData = getCurrentLocation();
  const npcs = getCurrentNPCs();
  const itemsInCurrentLocation =
    (!currentLocationData.id.startsWith('coord_') && currentLocationData.itemIds
      ?.map((id) => ITEMS[id])
      .filter(Boolean) as Item[]) || [];
  const currentBiome = currentLocationData ? BIOMES[currentLocationData.biomeId] : null;

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

  if (gameState.phase === GamePhase.MAIN_MENU) {
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
    // --- COMBAT PHASE ---
    // Deriving biome for combat based on current location
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
    const currentLocationData = getCurrentLocation();
    const worldCoords = currentLocationData.mapCoordinates;
    const biome = currentLocationData.biomeId || 'plains';

    mainContent = (
      <ErrorBoundary fallbackMessage="An error occurred in the Village Scene.">
        <TownCanvas
          worldSeed={gameState.worldSeed}
          worldX={worldCoords?.x || 50}
          worldY={worldCoords?.y || 50}
          biome={biome}
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
        />
      </ErrorBoundary>
    );
  } else if (gameState.phase === GamePhase.LOAD_TRANSITION && gameState.party.length > 0) {
    mainContent = (
      <LoadGameTransition character={gameState.party[0]} />
    );
  } else if (gameState.phase === GamePhase.PLAYING && gameState.party.length > 0 && gameState.subMapCoordinates) {
    mainContent = (
      <div className="flex flex-col md:flex-row h-screen p-2 sm:p-4 gap-2 sm:gap-4 bg-gray-900 text-gray-200">
        <VersionDisplay position="game-screen" />
        <div className="md:w-2/5 lg:w-1/3 flex flex-col gap-2 sm:gap-4 min-h-0">
          <ErrorBoundary fallbackMessage="Error in Compass Pane.">
            <CompassPane
              currentLocation={currentLocationData}
              currentSubMapCoordinates={gameState.subMapCoordinates}
              worldMapCoords={currentLocationData.mapCoordinates}
              subMapCoords={gameState.subMapCoordinates}
              onAction={processAction}
              disabled={!isUIInteractive}
              mapData={gameState.mapData}
              gameTime={gameState.gameTime}
            />
          </ErrorBoundary>
          <ErrorBoundary fallbackMessage="Error in Action Pane.">
            <ActionPane
              currentLocation={currentLocationData}
              npcsInLocation={npcs}
              itemsInLocation={itemsInCurrentLocation}
              onAction={processAction}
              disabled={!isUIInteractive}
              geminiGeneratedActions={gameState.geminiGeneratedActions || []}
              isDevDummyActive={USE_DUMMY_CHARACTER_FOR_DEV}
              unreadDiscoveryCount={gameState.unreadDiscoveryCount}
              hasNewRateLimitError={gameState.hasNewRateLimitError}
              subMapCoordinates={gameState.subMapCoordinates}
              worldSeed={gameState.worldSeed}
            />
          </ErrorBoundary>
        </div>

        <div className="md:w-3/5 lg:w-2/3 flex flex-col gap-2 sm:gap-4 min-h-0 relative">
          <ErrorBoundary fallbackMessage="Error in World Pane.">
            <WorldPane messages={gameState.messages} />
          </ErrorBoundary>
          <Minimap
            mapData={gameState.mapData}
            currentLocationCoords={currentLocationData.mapCoordinates}
            submapCoords={gameState.subMapCoordinates}
            visible={true} // Always visible in this layout
            toggleMap={() => processAction({ type: 'toggle_map', label: 'Open Map' })}
          />
        </div>
      </div>
    );
  } else if (gameState.phase === GamePhase.GAME_OVER) {
    mainContent = (
      <div className="text-center p-8">
        <h1 className="text-4xl text-red-500 mb-4">Game Over</h1>
        <button onClick={handleNewGame} className="bg-blue-500 text-white px-4 py-2 rounded">New Game</button>
      </div>
    );
  } else {
    mainContent = <LoadingSpinner message={gameState.loadingMessage} />;
  }

  return (
    <GlossaryProvider>
      <SpellProvider>
        <div className="App min-h-screen bg-gray-900">
          <NotificationSystem notifications={gameState.notifications} dispatch={dispatch} />
          <AnimatePresence>
            {(gameState.isLoading || gameState.isImageLoading) && <LoadingSpinner message={gameState.loadingMessage || (gameState.isImageLoading ? "A vision forms in the æther..." : "Aralia is weaving fate...")} />}
          </AnimatePresence>
          {gameState.error && (
            <div className="bg-red-800 text-white p-4 fixed top-0 left-0 right-0 z-[100] text-center">
              Error: {gameState.error}
              <button onClick={() => dispatch({ type: 'SET_ERROR', payload: null })} className="ml-4 bg-red-600 px-2 py-1 rounded">Dismiss</button>
            </div>
          )}
          {mainContent}
          <AnimatePresence>
            {gameState.isMapVisible && gameState.mapData && (
              <ErrorBoundary fallbackMessage="Error displaying the World Map.">
                <MapPane
                  mapData={gameState.mapData}
                  onTileClick={handleTileClick}
                  onClose={() => processAction({ type: 'toggle_map', label: 'Close Map' })}
                />
              </ErrorBoundary>
            )}
            {gameState.isQuestLogVisible && (
              <ErrorBoundary fallbackMessage="Error in Quest Log.">
                <QuestLog
                  isOpen={gameState.isQuestLogVisible}
                  onClose={() => dispatch({ type: 'TOGGLE_QUEST_LOG' })}
                  quests={gameState.questLog}
                />
              </ErrorBoundary>
            )}
            {gameState.isSubmapVisible && gameState.party[0] && gameState.mapData && gameState.subMapCoordinates && currentBiome && (
              <ErrorBoundary fallbackMessage="Error displaying the Submap.">
                <SubmapPane
                  currentLocation={currentLocationData}
                  currentWorldBiomeId={currentLocationData.biomeId}
                  playerSubmapCoords={gameState.subMapCoordinates}
                  onClose={() => processAction({ type: 'toggle_submap_visibility', label: 'Close Submap' })}
                  submapDimensions={SUBMAP_DIMENSIONS}
                  parentWorldMapCoords={currentLocationData.mapCoordinates}
                  onAction={processAction}
                  disabled={submapPaneDisabled}
                  inspectedTileDescriptions={gameState.inspectedTileDescriptions}
                  mapData={gameState.mapData}
                  gameTime={gameState.gameTime}
                  playerCharacter={gameState.party[0]}
                  worldSeed={gameState.worldSeed}
                  npcsInLocation={npcs}
                  itemsInLocation={itemsInCurrentLocation}
                  geminiGeneratedActions={gameState.geminiGeneratedActions}
                  isDevDummyActive={USE_DUMMY_CHARACTER_FOR_DEV}
                  unreadDiscoveryCount={gameState.unreadDiscoveryCount}
                  hasNewRateLimitError={gameState.hasNewRateLimitError}
                />
              </ErrorBoundary>
            )}
            {gameState.characterSheetModal.isOpen && gameState.characterSheetModal.character && (
              <ErrorBoundary fallbackMessage="Error displaying Character Sheet.">
                <CharacterSheetModal
                  isOpen={gameState.characterSheetModal.isOpen}
                  character={gameState.characterSheetModal.character}
                  inventory={gameState.inventory}
                  gold={gameState.gold}
                  onClose={handleCloseCharacterSheet}
                  onAction={processAction}
                  onNavigateToGlossary={handleNavigateToGlossaryFromTooltip}
                />
              </ErrorBoundary>
            )}
            {gameState.isDevMenuVisible && USE_DUMMY_CHARACTER_FOR_DEV && (
              <ErrorBoundary fallbackMessage="Error in Developer Menu.">
                <DevMenu
                  isOpen={gameState.isDevMenuVisible}
                  onClose={() => dispatch({ type: 'TOGGLE_DEV_MENU' })}
                  onDevAction={handleDevMenuAction}
                  hasNewRateLimitError={gameState.hasNewRateLimitError}
                  currentModelOverride={gameState.devModelOverride}
                  onModelChange={handleModelChange}
                />
              </ErrorBoundary>
            )}
            {gameState.isPartyOverlayVisible && (
              <ErrorBoundary fallbackMessage="Error displaying Party Overlay.">
                <PartyOverlay
                  isOpen={gameState.isPartyOverlayVisible}
                  onClose={handleClosePartyOverlay}
                  party={gameState.party}
                  onViewCharacterSheet={handleOpenCharacterSheet}
                  onFixMissingChoice={handleFixMissingChoice}
                />
              </ErrorBoundary>
            )}
            {gameState.isPartyEditorVisible && USE_DUMMY_CHARACTER_FOR_DEV && (
              <ErrorBoundary fallbackMessage="Error in Party Editor.">
                <PartyEditorModal
                  isOpen={gameState.isPartyEditorVisible}
                  onClose={() => dispatch({ type: 'TOGGLE_PARTY_EDITOR_MODAL' })}
                  initialParty={gameState.party}
                  onSave={(newParty) => dispatch({ type: 'SET_PARTY_COMPOSITION', payload: newParty })}
                />
              </ErrorBoundary>
            )}
            {gameState.isGeminiLogViewerVisible && USE_DUMMY_CHARACTER_FOR_DEV && (
              <ErrorBoundary fallbackMessage="Error in Gemini Log Viewer.">
                <GeminiLogViewer
                  isOpen={gameState.isGeminiLogViewerVisible}
                  onClose={() => dispatch({ type: 'TOGGLE_GEMINI_LOG_VIEWER' })}
                  logEntries={gameState.geminiInteractionLog}
                />
              </ErrorBoundary>
            )}
            {gameState.isNpcTestModalVisible && USE_DUMMY_CHARACTER_FOR_DEV && (
              <ErrorBoundary fallbackMessage="Error in NPC Test Plan Modal.">
                <NpcInteractionTestModal
                  isOpen={gameState.isNpcTestModalVisible}
                  onClose={() => dispatch({ type: 'TOGGLE_NPC_TEST_MODAL' })}
                  onAction={processAction}
                />
              </ErrorBoundary>
            )}
            {gameState.isLogbookVisible && (
              <ErrorBoundary fallbackMessage="Error in Character Logbook.">
                <LogbookPane
                  isOpen={gameState.isLogbookVisible}
                  onClose={() => processAction({ type: 'TOGGLE_LOGBOOK', label: 'Close Logbook' })}
                  metNpcIds={gameState.metNpcIds}
                  npcMemory={gameState.npcMemory}
                  allNpcs={NPCS}
                />
              </ErrorBoundary>
            )}
            {gameState.isDiscoveryLogVisible && (
              <ErrorBoundary fallbackMessage="Error in Discovery Journal.">
                <DiscoveryLogPane
                  isOpen={gameState.isDiscoveryLogVisible}
                  entries={gameState.discoveryLog}
                  unreadCount={gameState.unreadDiscoveryCount}
                  onClose={() => dispatch({ type: 'TOGGLE_DISCOVERY_LOG_VISIBILITY' })}
                  onMarkRead={(entryId) => dispatch({ type: 'MARK_DISCOVERY_READ', payload: { entryId } })}
                  onMarkAllRead={() => dispatch({ type: 'MARK_ALL_DISCOVERIES_READ' })}
                  npcMemory={gameState.npcMemory}
                  allNpcs={NPCS}
                />
              </ErrorBoundary>
            )}
            {gameState.isGlossaryVisible && (
              <ErrorBoundary fallbackMessage="Error in Glossary.">
                <Glossary
                  isOpen={gameState.isGlossaryVisible}
                  onClose={handleOpenGlossary}
                  initialTermId={gameState.selectedGlossaryTermForModal}
                />
              </ErrorBoundary>
            )}
            {gameState.isEncounterModalVisible && (
              <ErrorBoundary fallbackMessage="Error in Encounter Modal.">
                <EncounterModal
                  isOpen={gameState.isEncounterModalVisible}
                  onClose={() => dispatch({ type: 'HIDE_ENCOUNTER_MODAL' })}
                  encounter={gameState.generatedEncounter}
                  sources={gameState.encounterSources}
                  error={gameState.encounterError}
                  isLoading={gameState.isLoading}
                  onAction={processAction}
                  partyUsed={gameState.tempParty || undefined}
                />
              </ErrorBoundary>
            )}
            {/* Merchant Modal */}
            {gameState.merchantModal.isOpen && (
              <ErrorBoundary fallbackMessage="Error in Merchant Interface.">
                <MerchantModal
                  isOpen={gameState.merchantModal.isOpen}
                  merchantName={gameState.merchantModal.merchantName}
                  merchantInventory={gameState.merchantModal.merchantInventory}
                  playerInventory={gameState.inventory}
                  playerGold={gameState.gold}
                  onClose={() => dispatch({ type: 'CLOSE_MERCHANT' })}
                  onAction={processAction}
                />
              </ErrorBoundary>
            )}
            {/* Game Guide Modal */}
            {gameState.isGameGuideVisible && (
              <ErrorBoundary fallbackMessage="Error in Game Guide.">
                <GameGuideModal
                  isOpen={gameState.isGameGuideVisible}
                  onClose={() => processAction({ type: 'TOGGLE_GAME_GUIDE', label: 'Close Game Guide' })}
                  gameContext={`Current Location: ${currentLocationData.name}. Game Time: ${gameState.gameTime.toLocaleString()}.`}
                  devModelOverride={gameState.devModelOverride}
                  onAction={dispatch}
                />
              </ErrorBoundary>
            )}
            {/* Missing Choice Modal */}
            {missingChoiceModal.isOpen && missingChoiceModal.character && missingChoiceModal.missingChoice && (
              <ErrorBoundary fallbackMessage="Error in Selection Modal.">
                <MissingChoiceModal
                  isOpen={missingChoiceModal.isOpen}
                  characterName={missingChoiceModal.character.name}
                  missingChoice={missingChoiceModal.missingChoice}
                  onClose={() => setMissingChoiceModal({ isOpen: false, character: null, missingChoice: null })}
                  onConfirm={handleConfirmMissingChoice}
                />
              </ErrorBoundary>
            )}
          </AnimatePresence>
        </div>
      </SpellProvider>
    </GlossaryProvider>
  );
};

export default App;
