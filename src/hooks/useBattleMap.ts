/**
 * @file useBattleMap.ts
 * Custom hook to manage the state and logic of a procedural battle map.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { BattleMapData, BattleMapTile, CombatCharacter, CharacterPosition, AbilityCost } from '../types/combat';
import { Action } from '../types';
import { BATTLE_MAP_DIMENSIONS } from '../config/mapConfig';
import { BattleMapGenerator } from '../services/battleMapGenerator';
import { findPath } from '../utils/pathfinding';
import { hasLineOfSight } from '../utils/lineOfSight';

type SpawnConfig = 'left-right' | 'top-bottom' | 'corners-tl-br' | 'corners-tr-bl';

const getSpawnTiles = (mapData: BattleMapData, config: SpawnConfig): { playerTiles: BattleMapTile[], enemyTiles: BattleMapTile[] } => {
    const playerSpawnTiles: BattleMapTile[] = [];
    const enemySpawnTiles: BattleMapTile[] = [];
    const { width, height } = mapData.dimensions;
    const cornerSize = 8; // How large the corner spawn areas are

    const addTilesFromRect = (tiles: BattleMapTile[], x1: number, y1: number, x2: number, y2: number) => {
        for (let y = y1; y < y2; y++) {
            for (let x = x1; x < x2; x++) {
                const tile = mapData.tiles.get(`${x}-${y}`);
                if (tile && !tile.blocksMovement) tiles.push(tile);
            }
        }
    };

    switch(config) {
        case 'top-bottom':
            addTilesFromRect(playerSpawnTiles, 0, 0, width, 5); // Top 5 rows
            addTilesFromRect(enemySpawnTiles, 0, height - 5, width, height); // Bottom 5 rows
            break;
        case 'corners-tl-br':
            addTilesFromRect(playerSpawnTiles, 0, 0, cornerSize, cornerSize); // Top-left
            addTilesFromRect(enemySpawnTiles, width - cornerSize, height - cornerSize, width, height); // Bottom-right
            break;
        case 'corners-tr-bl':
            addTilesFromRect(playerSpawnTiles, width - cornerSize, 0, width, cornerSize); // Top-right
            addTilesFromRect(enemySpawnTiles, 0, height - cornerSize, 0 + cornerSize, height); // Bottom-left
            break;
        case 'left-right':
        default:
            addTilesFromRect(playerSpawnTiles, 0, 0, 5, height); // Left 5 columns
            addTilesFromRect(enemySpawnTiles, width - 5, 0, width, height); // Right 5 columns
            break;
    }

    // Shuffle results
    const shuffle = (array: BattleMapTile[]) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    return { playerTiles: shuffle([...playerSpawnTiles]), enemyTiles: shuffle([...enemySpawnTiles]) };
}

interface UseBattleMapReturn {
    mapData: BattleMapData | null;
    characterPositions: Map<string, CharacterPosition>;
    selectedCharacterId: string | null;
    validMoves: Set<string>;
    activePath: BattleMapTile[];
    actionMode: 'move' | 'ability' | null;
    attackableTargets: Set<string>;
    setActionMode: React.Dispatch<React.SetStateAction<'move' | 'ability' | null>>;
    handleTileClick: (tile: BattleMapTile) => void;
    handleCharacterClick: (character: CombatCharacter) => void;
}

export function useBattleMap(
    biome: 'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp', 
    seed: number, 
    characters: CombatCharacter[],
    setCharacters: React.Dispatch<React.SetStateAction<CombatCharacter[]>>,
    turnManager: any, // TurnManager Hook
    abilitySystem: any,
): UseBattleMapReturn {
  const [mapData, setMapData] = useState<BattleMapData | null>(null);
  const [characterPositions, setCharacterPositions] = useState<Map<string, CharacterPosition>>(new Map());
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<Set<string>>(new Set());
  const [activePath, setActivePath] = useState<BattleMapTile[]>([]);
  const [actionMode, setActionMode] = useState<'move' | 'ability' | null>(null);
  const [attackableTargets, setAttackableTargets] = useState<Set<string>>(new Set());

  // Generate map and place characters
  useEffect(() => {
    const generator = new BattleMapGenerator(BATTLE_MAP_DIMENSIONS.width, BATTLE_MAP_DIMENSIONS.height);
    const newMapData = generator.generate(biome, seed);
    setMapData(newMapData);

    const newPositions = new Map<string, CharacterPosition>();
    
    // Choose a random spawn configuration
    const spawnConfigs: SpawnConfig[] = ['left-right', 'top-bottom', 'corners-tl-br', 'corners-tr-bl'];
    const randomConfig = spawnConfigs[Math.floor(Math.random() * spawnConfigs.length)];

    // Get spawn tiles based on the random configuration
    const { playerTiles, enemyTiles } = getSpawnTiles(newMapData, randomConfig);
    
    let playerSpawnIndex = 0;
    let enemySpawnIndex = 0;

    const updatedCharacters = characters.map(char => {
        let spawnTile;
        if(char.team === 'player' && playerSpawnIndex < playerTiles.length) {
            spawnTile = playerTiles[playerSpawnIndex++];
        } else if (char.team === 'enemy' && enemySpawnIndex < enemyTiles.length) {
            spawnTile = enemyTiles[enemySpawnIndex++];
        }

        if(spawnTile) {
            newPositions.set(char.id, { characterId: char.id, coordinates: spawnTile.coordinates });
            return {...char, position: spawnTile.coordinates};
        }
        return char;
    });

    setCharacters(updatedCharacters);
    setCharacterPositions(newPositions);
    turnManager.initializeCombat(updatedCharacters); // Initialize combat with correctly positioned characters

    setSelectedCharacterId(null);
    setValidMoves(new Set());
    setActivePath([]);
    setActionMode(null);
  }, [biome, seed]);

  // Sync character positions when the characters prop changes
  useEffect(() => {
    const newPositions = new Map<string, CharacterPosition>();
    characters.forEach(char => {
        newPositions.set(char.id, { characterId: char.id, coordinates: char.position });
    });
    setCharacterPositions(newPositions);
  }, [characters]);


  const calculateValidMoves = useCallback((character: CombatCharacter) => {
    if (!mapData) return new Set<string>();
    const startPos = characterPositions.get(character.id)?.coordinates;
    if (!startPos) return new Set<string>();
    const startNode = mapData.tiles.get(`${startPos.x}-${startPos.y}`);
    if (!startNode) return new Set<string>();

    const reachableTiles = new Set<string>();
    const queue: { tile: BattleMapTile; cost: number }[] = [{ tile: startNode, cost: 0 }];
    const visited = new Set<string>([startNode.id]);
    
    const movementRemaining = character.actionEconomy.movement.total - character.actionEconomy.movement.used;

    while (queue.length > 0) {
      const { tile, cost } = queue.shift()!;
      reachableTiles.add(tile.id);
      
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          
          const newX = tile.coordinates.x + dx;
          const newY = tile.coordinates.y + dy;
          const neighborId = `${newX}-${newY}`;
          const neighbor = mapData.tiles.get(neighborId);
          
          if (neighbor && !neighbor.blocksMovement && !visited.has(neighborId)) {
            const newCost = cost + neighbor.movementCost;
            if (newCost <= movementRemaining) {
              visited.add(neighborId);
              queue.push({ tile: neighbor, cost: newCost });
            }
          }
        }
      }
    }
    return reachableTiles;
  }, [mapData, characterPositions]);
  
  const selectCharacter = useCallback((character: CombatCharacter) => {
    if (character.team !== 'player') return; // Prevent selecting enemy characters
    if (turnManager.turnState.currentCharacterId !== character.id) return;
    
    setSelectedCharacterId(character.id);
    setActionMode('move');

    const moves = calculateValidMoves(character);
    setValidMoves(moves);
    setActivePath([]);
  }, [turnManager.turnState.currentCharacterId, calculateValidMoves]);
  
  const handleCharacterClick = useCallback((character: CombatCharacter) => {
    if (abilitySystem.targetingMode) {
      if(abilitySystem.isValidTarget(abilitySystem.selectedAbility, turnManager.getCurrentCharacter(), character.position)) {
        abilitySystem.selectTarget(character.position, turnManager.getCurrentCharacter());
      }
    } else {
        selectCharacter(character);
    }
  }, [abilitySystem, selectCharacter, turnManager]);

  const handleTileClick = useCallback((tile: BattleMapTile) => {
    if (!selectedCharacterId || !mapData) return;
    
    const character = characters.find(c => c.id === selectedCharacterId);
    if (!character) return;

    if (actionMode === 'ability' && abilitySystem.targetingMode) {
        if(abilitySystem.isValidTarget(abilitySystem.selectedAbility, character, tile.coordinates)) {
           abilitySystem.selectTarget(tile.coordinates, character);
        } else {
           abilitySystem.cancelTargeting();
        }
    } else if (actionMode === 'move' && validMoves.has(tile.id)) {
      const startPos = characterPositions.get(selectedCharacterId)?.coordinates;
      const startTile = startPos ? mapData.tiles.get(`${startPos.x}-${startPos.y}`) : null;
      
      if (startTile) {
        const path = findPath(startTile, tile, mapData);
        setActivePath(path);

        const moveCost = path.reduce((acc, t) => acc + t.movementCost, 0) - startTile.movementCost;
        const moveActionCost: AbilityCost = { type: 'movement-only', movementCost: moveCost };
        
        if (turnManager.executeAction({
            id: Math.random().toString(),
            characterId: selectedCharacterId,
            type: 'move',
            cost: moveActionCost,
            targetPosition: tile.coordinates,
            timestamp: Date.now()
        })) {
             setValidMoves(new Set());
             setActivePath([]);
        }
      }
    }
  }, [selectedCharacterId, mapData, characters, actionMode, validMoves, abilitySystem, turnManager, characterPositions]);

  return {
    mapData,
    characterPositions,
    selectedCharacterId,
    validMoves,
    activePath,
    actionMode,
    attackableTargets,
    setActionMode,
    handleTileClick,
    handleCharacterClick,
  };
}