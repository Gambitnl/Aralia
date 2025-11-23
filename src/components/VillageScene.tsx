
/**
 * @file VillageScene.tsx
 * Renders an interactive, procedurally generated village map using HTML5 Canvas.
 * Uses the village generation service for unique, biome-appropriate villages.
 * Now includes dynamic merchant interactions and resource harvesting.
 */
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Action, Location, NPC, Item } from '../types';
import { generateVillage, determineVillageConfig, VILLAGE_TILE_TYPES, GeneratedVillage } from '../services/villageGenerator';
import ActionPane from './ActionPane';

interface VillageSceneProps {
  onAction: (action: Action) => void;
  worldX?: number;
  worldY?: number;
  biome?: string;
  worldSeed?: number;
  gameTime?: Date;
  // Props required for ActionPane
  currentLocation: Location;
  npcsInLocation: NPC[];
  itemsInLocation: Item[];
  disabled: boolean;
  geminiGeneratedActions: Action[] | null;
  isDevDummyActive: boolean;
  unreadDiscoveryCount: number;
  hasNewRateLimitError: boolean;
}

const TILE_SIZE = 24; // Smaller tiles for larger maps

// Simple hash function matching the submap system pattern, used for procedural variety
const villageHash = (worldSeed: number, x: number, y: number, suffix: string): number => {
  let h = 0;
  const str = `${worldSeed},${x},${y},village,${suffix}`;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
};


const VillageScene: React.FC<VillageSceneProps> = ({ 
  onAction, 
  worldX = 50, 
  worldY = 50, 
  biome = 'plains', 
  worldSeed = 12345,
  gameTime,
  currentLocation,
  npcsInLocation,
  itemsInLocation,
  disabled,
  geminiGeneratedActions,
  isDevDummyActive,
  unreadDiscoveryCount,
  hasNewRateLimitError,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; content: string; x: number; y: number } | null>(null);
  const lastHoveredTileRef = useRef<string | null>(null);

  // Generate village data using memoization for performance
  const villageData = useMemo(() => {
    const config = determineVillageConfig(worldX, worldY, biome, worldSeed);
    return generateVillage(config);
  }, [worldX, worldY, biome, worldSeed]);

  // Deterministically place NPCs on valid tiles
  const npcPositions = useMemo(() => {
    const positions: { npc: NPC, x: number, y: number }[] = [];
    if (!villageData || !npcsInLocation) return positions;

    // Gather valid tiles (Market Square, Paths) where NPCs can logically stand
    const validTiles: { x: number, y: number }[] = [];
    villageData.layout.forEach((row, y) => {
        row.forEach((tileType, x) => {
            if (tileType === VILLAGE_TILE_TYPES.MARKET_SQUARE || tileType === VILLAGE_TILE_TYPES.PATH) {
                validTiles.push({ x, y });
            }
        });
    });

    if (validTiles.length === 0) return positions;

    npcsInLocation.forEach((npc) => {
        // Hash NPC ID + World Seed + NPC Name to pick a consistent spot for this specific NPC
        let h = 0;
        const str = `${worldSeed},${npc.id},${npc.name}`;
        for (let i = 0; i < str.length; i++) {
            h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
        }
        const index = Math.abs(h) % validTiles.length;
        
        positions.push({ npc, ...validTiles[index] });
    });

    return positions;
  }, [villageData, npcsInLocation, worldSeed]);

  const getBuildingTooltipContent = useMemo(() => (tileType: number, x: number, y: number): string | null => {
    const buildingHash = (suffix: string) => villageHash(worldSeed, worldX + x, worldY + y, suffix);
    const tileInfo = VILLAGE_TILE_TYPES;

    switch (tileType) {
      case tileInfo.INN: {
        const prefixes = ["The Prancing", "The Sleeping", "The Golden", "The Rusty", "The Tipsy", "The Laughing"];
        const suffixes = ["Pony", "Dragon", "Flagon", "Mug", "Dryad", "Goblin"];
        const name = `${prefixes[buildingHash('inn_prefix') % prefixes.length]} ${suffixes[buildingHash('inn_suffix') % suffixes.length]}`;
        const details = ["Faint music drifts from within.", "Laughter can be heard through the walls.", "The smell of roasting meat wafts out.", "A sign depicts a frothing mug."];
        return `${name}\n${details[buildingHash('inn_detail') % details.length]}`;
      }
      case tileInfo.BLACKSMITH: {
        const names = ["Grimbold's", "Ironhand's", "Stonebreaker's", "Firebeard's", "Blackhammer", "Anvilmar"];
        const name = `${names[buildingHash('smith_name') % names.length]} Forge`;
        const details = ["The clang of a hammer rings out.", "The air smells of soot and hot metal.", "Sparks fly from a ventilation shaft."];
        return `${name}\n${details[buildingHash('smith_detail') % details.length]}`;
      }
      case tileInfo.HOUSE_SMALL:
      case tileInfo.HOUSE_MEDIUM:
      case tileInfo.HOUSE_LARGE: {
        const adjectives = ["A modest", "A well-kept", "A slightly rundown", "A cozy", "A sturdy-looking"];
        const buildingType = tileType === tileInfo.HOUSE_SMALL ? "cottage" : tileType === tileInfo.HOUSE_MEDIUM ? "home" : "house";
        const details = ["A thin plume of smoke rises from the chimney.", "Flowering vines creep up the walls.", "The windows are dark and quiet.", "Children's toys are scattered in the yard.", "A small vegetable garden is tended nearby."];
        return `${adjectives[buildingHash('house_adj') % adjectives.length]} ${buildingType}.\n${details[buildingHash('house_detail') % details.length]}`;
      }
      case tileInfo.GENERAL_STORE:
          return "General Store\nA place for supplies and trade.";
      case tileInfo.TEMPLE:
          return "Village Temple\nA quiet place for reflection and worship.";
      case tileInfo.GUARD_POST:
          return "Guard Post\nThe local militia keeps watch here.";
      case tileInfo.WATCHTOWER:
          return "Watchtower\nProvides a view of the surrounding area.";
      case tileInfo.STABLE:
          return "Village Stables\nHorses and other animals are kept here.";
       case tileInfo.MARKET_SQUARE:
          return "Market Square\nThe heart of the village's commerce.";
      case tileInfo.FARM_PLOT:
           return "Farm Plot\nCrops are grown here to feed the village.";
      default:
        return null;
    }
  }, [worldSeed, worldX, worldY]);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const hour = gameTime ? new Date(gameTime).getHours() : 12; 
    const isNight = hour >= 20 || hour < 6;

    const dayPalette = {
      GRASS: '#3a8f52', GRASS_TEXTURE: ['#4caf50', '#5cb85c'],
      PATH: '#d2b48c', PATH_TEXTURE: ['#c1a97e', '#e0cfa8'],
      WATER: '#4682B4',
      INN_WALL: '#a1887f', INN_ROOF: '#6d4c41',
      HOUSE_WALL: '#e0cfa8', HOUSE_ROOFS: ['#c62828', '#a1887f', '#607d8b'],
      BLACKSMITH_WALL: '#78909c', BLACKSMITH_ROOF: '#37474f',
      GENERAL_STORE_WALL: '#d2b48c', GENERAL_STORE_ROOF: '#a1887f',
      TEMPLE_WALL: '#eceff1', TEMPLE_ROOF: '#ffd700',
      WELL_STONE: '#90a4ae', WELL_WATER: '#42a5f5',
      MARKET_SQUARE: '#fffde7',
      GUARD_POST_WALL: '#a1887f', GUARD_POST_ROOF: '#5d4037',
      VILLAGE_WALL: '#b0bec5',
      FARM_PLOT_SOIL: '#8d6e63', FARM_PLOT_PLANTS: '#689f38',
      FOREST_TREES: '#1b5e20',
      DEFAULT_BUILDING_WALL: '#DEB887', DEFAULT_BUILDING_ROOF: '#A0522D',
    };

    const nightPalette = {
      GRASS: '#2c5f3a', GRASS_TEXTURE: ['#388e3c', '#43a047'],
      PATH: '#6a5f7a', PATH_TEXTURE: ['#5a4f6a', '#7d718a'],
      WATER: '#2c3e50',
      INN_WALL: '#5d4037', INN_ROOF: '#3e2723',
      HOUSE_WALL: '#9e8a71', HOUSE_ROOFS: ['#7f1d1d', '#5d4037', '#37474f'],
      BLACKSMITH_WALL: '#455a64', BLACKSMITH_ROOF: '#263238',
      GENERAL_STORE_WALL: '#8d6e63', GENERAL_STORE_ROOF: '#5d4037',
      TEMPLE_WALL: '#90a4ae', TEMPLE_ROOF: '#bca100',
      WELL_STONE: '#546e7a', WELL_WATER: '#2980b9',
      MARKET_SQUARE: '#b0a88f',
      GUARD_POST_WALL: '#5d4037', GUARD_POST_ROOF: '#3e2723',
      VILLAGE_WALL: '#546e7a',
      FARM_PLOT_SOIL: '#4e342e', FARM_PLOT_PLANTS: '#33691e',
      FOREST_TREES: '#103e13',
      DEFAULT_BUILDING_WALL: '#ab9a7a', DEFAULT_BUILDING_ROOF: '#6d4031',
    };

    const palette = isNight ? nightPalette : dayPalette;

    canvas.width = villageData.width * TILE_SIZE;
    canvas.height = villageData.height * TILE_SIZE;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    villageData.layout.forEach((row, y) => {
      row.forEach((tileType, x) => {
        const tileX = x * TILE_SIZE;
        const tileY = y * TILE_SIZE;
        
        let color = palette.GRASS;
        let roofColor = null;
        let doorColor = null;

        const tileInfo = VILLAGE_TILE_TYPES;
        switch (tileType) {
          case tileInfo.GRASS: color = palette.GRASS; break;
          case tileInfo.PATH: color = palette.PATH; break;
          case tileInfo.WATER: color = palette.WATER; break;
          case tileInfo.INN: color = palette.INN_WALL; roofColor = palette.INN_ROOF; doorColor = '#8B0000'; break;
          case tileInfo.HOUSE_SMALL:
          case tileInfo.HOUSE_MEDIUM:
          case tileInfo.HOUSE_LARGE:
            color = palette.HOUSE_WALL;
            roofColor = palette.HOUSE_ROOFS[villageHash(worldSeed, x, y, 'roof_color') % palette.HOUSE_ROOFS.length];
            break;
          case tileInfo.BLACKSMITH: color = palette.BLACKSMITH_WALL; roofColor = palette.BLACKSMITH_ROOF; doorColor = '#FF4500'; break;
          case tileInfo.GENERAL_STORE: color = palette.GENERAL_STORE_WALL; roofColor = palette.GENERAL_STORE_ROOF; doorColor = '#228B22'; break;
          case tileInfo.TEMPLE: color = palette.TEMPLE_WALL; roofColor = palette.TEMPLE_ROOF; doorColor = '#4B0082'; break;
          case tileInfo.WELL: color = palette.WELL_STONE; break;
          case tileInfo.MARKET_SQUARE: color = palette.MARKET_SQUARE; break;
          case tileInfo.GUARD_POST: color = palette.GUARD_POST_WALL; roofColor = palette.GUARD_POST_ROOF; break;
          case tileInfo.VILLAGE_WALL: case tileInfo.PALISADE: color = palette.VILLAGE_WALL; break;
          case tileInfo.FARM_PLOT: color = palette.FARM_PLOT_SOIL; break;
          case tileInfo.FOREST_TREES: color = palette.FOREST_TREES; break;
          default: color = palette.DEFAULT_BUILDING_WALL; roofColor = palette.DEFAULT_BUILDING_ROOF;
        }
        
        ctx.fillStyle = color;
        ctx.fillRect(tileX, tileY, TILE_SIZE, TILE_SIZE);

        if (tileType === tileInfo.GRASS || tileType === tileInfo.PATH) {
            const textureColors = tileType === tileInfo.GRASS ? palette.GRASS_TEXTURE : palette.PATH_TEXTURE;
            for(let i=0; i < 8; i++) {
                const tx = tileX + Math.random() * TILE_SIZE;
                const ty = tileY + Math.random() * TILE_SIZE;
                ctx.fillStyle = textureColors[Math.floor(Math.random() * textureColors.length)];
                ctx.fillRect(tx, ty, 2, 2);
            }
        }
        
        if (roofColor) {
          ctx.fillStyle = roofColor;
          ctx.fillRect(tileX + 2, tileY + 2, TILE_SIZE - 4, TILE_SIZE / 2);
        }
        if (doorColor) {
          ctx.fillStyle = doorColor;
          ctx.fillRect(tileX + TILE_SIZE/2 - 3, tileY + TILE_SIZE - 8, 6, 8);
        }
        if (tileType === tileInfo.WELL) {
          ctx.fillStyle = palette.WELL_WATER;
          ctx.beginPath(); ctx.arc(tileX + TILE_SIZE/2, tileY + TILE_SIZE/2, 6, 0, 2 * Math.PI); ctx.fill();
        }
        if (tileType === tileInfo.MARKET_SQUARE) {
          ctx.fillStyle = '#8B4513';
          ctx.fillRect(tileX + 2, tileY + 2, 6, 6);
          ctx.fillRect(tileX + TILE_SIZE - 8, tileY + TILE_SIZE - 8, 6, 6);
        }
        if (tileType === tileInfo.FARM_PLOT) {
          ctx.strokeStyle = palette.FARM_PLOT_PLANTS; ctx.lineWidth = 2;
          for (let i = 0; i < 3; i++) {
            const lineY = tileY + 5 + (i * 5);
            ctx.beginPath(); ctx.moveTo(tileX + 2, lineY); ctx.lineTo(tileX + TILE_SIZE - 2, lineY); ctx.stroke();
          }
        }
        
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.5;
        ctx.strokeRect(tileX, tileY, TILE_SIZE, TILE_SIZE);
      });
    });

    let overlayColor = '';
    if (hour >= 21 || hour < 5) { overlayColor = 'rgba(25, 25, 112, 0.3)'; } 
    else if (hour >= 18 && hour < 21) { overlayColor = 'rgba(255, 140, 0, 0.15)'; } 
    else if (hour >= 5 && hour < 7) { overlayColor = 'rgba(255, 215, 0, 0.1)'; }

    if (overlayColor) {
        ctx.fillStyle = overlayColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    if (isNight) {
        villageData.layout.forEach((row, y) => {
            row.forEach((tileType, x) => {
                const isBuildingWithWindows = ([
                    VILLAGE_TILE_TYPES.INN, VILLAGE_TILE_TYPES.HOUSE_SMALL,
                    VILLAGE_TILE_TYPES.HOUSE_MEDIUM, VILLAGE_TILE_TYPES.HOUSE_LARGE,
                    VILLAGE_TILE_TYPES.GENERAL_STORE, VILLAGE_TILE_TYPES.TEMPLE,
                    VILLAGE_TILE_TYPES.GUARD_POST,
                ] as number[]).includes(tileType);

                if (isBuildingWithWindows) {
                    const tileX = x * TILE_SIZE;
                    const tileY = y * TILE_SIZE;
                    ctx.fillStyle = 'rgba(255, 223, 100, 0.9)';
                    ctx.fillRect(tileX + 5, tileY + TILE_SIZE / 2, 4, 5);
                    ctx.fillRect(tileX + TILE_SIZE - 9, tileY + TILE_SIZE / 2, 4, 5);
                }
                
                if (tileType === VILLAGE_TILE_TYPES.BLACKSMITH) {
                    const tileX = x * TILE_SIZE;
                    const tileY = y * TILE_SIZE;
                    ctx.fillStyle = `rgba(255, ${100 + Math.sin(Date.now()/200)*30}, 0, 0.6)`;
                    ctx.beginPath();
                    ctx.arc(tileX + TILE_SIZE/2, tileY + TILE_SIZE - 4, 8, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        });
    }

    npcPositions.forEach(pos => {
        const tileX = pos.x * TILE_SIZE;
        const tileY = pos.y * TILE_SIZE;
        
        let color = '#FFD700';
        if (pos.npc.role === 'guard') color = '#A9A9A9';
        else if (pos.npc.role === 'merchant') color = '#FFA500';
        else if (pos.npc.role === 'quest_giver') color = '#9370DB';
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(tileX + TILE_SIZE / 2, tileY + TILE_SIZE / 2, TILE_SIZE / 3, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = isNight ? '#FFFFFF' : '#000000';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    });

    const handleClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const tileX = Math.floor(x / TILE_SIZE);
      const tileY = Math.floor(y / TILE_SIZE);
      
      const clickedNpc = npcPositions.find(p => p.x === tileX && p.y === tileY);
      if (clickedNpc) {
          onAction({ type: 'talk', label: `Talk to ${clickedNpc.npc.name}`, targetId: clickedNpc.npc.id });
          return;
      }

      const tileType = villageData.layout[tileY]?.[tileX];
      // Pass village context to these actions for dynamic generation
      const context = villageData.metadata;
      
      switch (tileType) {
        case VILLAGE_TILE_TYPES.INN: onAction({ type: 'OPEN_DYNAMIC_MERCHANT', label: 'Visit Inn', payload: { merchantType: 'Inn', villageContext: context } }); break;
        case VILLAGE_TILE_TYPES.BLACKSMITH: onAction({ type: 'OPEN_DYNAMIC_MERCHANT', label: 'Visit Blacksmith', payload: { merchantType: 'Blacksmith', villageContext: context } }); break;
        case VILLAGE_TILE_TYPES.GENERAL_STORE: onAction({ type: 'OPEN_DYNAMIC_MERCHANT', label: 'Visit General Store', payload: { merchantType: 'General Store', villageContext: context } }); break;
        case VILLAGE_TILE_TYPES.MARKET_SQUARE: onAction({ type: 'OPEN_DYNAMIC_MERCHANT', label: 'Browse Market', payload: { merchantType: 'Market Stall', villageContext: context } }); break;
        case VILLAGE_TILE_TYPES.STABLE: onAction({ type: 'OPEN_DYNAMIC_MERCHANT', label: 'Visit Stable', payload: { merchantType: 'Stable Master', villageContext: context } }); break;
        
        case VILLAGE_TILE_TYPES.FARM_PLOT: onAction({ type: 'HARVEST_RESOURCE', label: 'Harvest Crops', payload: { harvestContext: 'cultivated crops', villageContext: context } }); break;
        
        case VILLAGE_TILE_TYPES.HOUSE_SMALL: onAction({ type: 'custom', label: 'Visit Small House' }); break;
        case VILLAGE_TILE_TYPES.HOUSE_MEDIUM: onAction({ type: 'custom', label: 'Visit Medium House' }); break;
        case VILLAGE_TILE_TYPES.HOUSE_LARGE: onAction({ type: 'custom', label: 'Visit Large House' }); break;
        case VILLAGE_TILE_TYPES.TEMPLE: onAction({ type: 'custom', label: 'Visit Temple' }); break;
        case VILLAGE_TILE_TYPES.WELL: onAction({ type: 'custom', label: 'Examine Well' }); break;
        case VILLAGE_TILE_TYPES.GUARD_POST: onAction({ type: 'custom', label: 'Speak with Guards' }); break;
        case VILLAGE_TILE_TYPES.STORAGE_BARN: onAction({ type: 'custom', label: 'Examine Storage' }); break;
        case VILLAGE_TILE_TYPES.WATCHTOWER: onAction({ type: 'custom', label: 'Climb Watchtower' }); break;
        case VILLAGE_TILE_TYPES.VILLAGE_GATE: onAction({ type: 'custom', label: 'Examine Gate' }); break;
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const tileX = Math.floor(mouseX / TILE_SIZE);
      const tileY = Math.floor(mouseY / TILE_SIZE);
      const currentTileKey = `${tileX}-${tileY}`;
      
      if(lastHoveredTileRef.current === currentTileKey) return;
      lastHoveredTileRef.current = currentTileKey;
      
      const hoveredNpc = npcPositions.find(p => p.x === tileX && p.y === tileY);
      if (hoveredNpc) {
         setTooltip({ visible: true, content: `${hoveredNpc.npc.name}\n(${hoveredNpc.npc.role})`, x: event.clientX, y: event.clientY });
         return;
      }

      const tileType = villageData.layout[tileY]?.[tileX];
      if (tileType !== undefined) {
        const content = getBuildingTooltipContent(tileType, tileX, tileY);
        if (content) {
          setTooltip({ visible: true, content, x: event.clientX, y: event.clientY });
        } else {
          setTooltip(null);
        }
      } else {
        setTooltip(null);
      }
    };

    const handleMouseLeave = () => {
      setTooltip(null);
      lastHoveredTileRef.current = null;
    };

    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onAction({ type: 'custom', label: 'Exit Village' });
    };

    document.addEventListener('keydown', handleKeyPress);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [onAction, villageData, gameTime, worldSeed, getBuildingTooltipContent, worldX, worldY, npcPositions]);

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col md:flex-row">
        {/* Left/Main: Canvas area */}
        <div className="flex-grow relative overflow-hidden flex items-center justify-center bg-gray-950">
             <div className="absolute top-4 left-4 z-10 pointer-events-none">
                 <h2 className="text-3xl font-cinzel text-amber-400 drop-shadow-md">{villageData.metadata.name}</h2>
                 <p className="text-sm text-gray-300 drop-shadow-md">{villageData.metadata.economy} • Pop: {villageData.metadata.population}</p>
            </div>
            
            <canvas 
              ref={canvasRef} 
              className="border-4 border-amber-600 rounded-lg shadow-2xl"
              style={{ imageRendering: 'pixelated', cursor: 'pointer' }}
            />
             {tooltip && tooltip.visible && (
              <div
                style={{
                  position: 'fixed',
                  top: tooltip.y + 20,
                  left: tooltip.x + 20,
                  transform: 'translate(-50%, 0)',
                  zIndex: 100,
                }}
                className="bg-gray-800 text-white p-2.5 rounded-lg shadow-xl border border-gray-600 max-w-xs text-sm pointer-events-none transition-opacity duration-200"
                role="tooltip"
              >
                {tooltip.content.split('\n').map((line, i) => <p key={i} className={i === 0 ? 'font-bold text-amber-300' : 'text-gray-300'}>{line}</p>)}
              </div>
            )}
        </div>

        {/* Right: Sidebar with ActionPane */}
        <div className="w-full md:w-1/3 lg:w-1/4 bg-gray-800 border-l border-gray-700 flex flex-col z-20 shadow-xl">
             <div className="p-4 border-b border-gray-700 bg-gray-800">
                 <h3 className="text-xl text-sky-300 font-cinzel">Village Actions</h3>
                 <p className="text-xs text-gray-400 mt-1">Click on buildings or NPCs to interact, or use the actions below.</p>
             </div>
             <div className="flex-grow overflow-y-auto scrollable-content">
                 <div className="p-4 space-y-3">
                    <button
                        onClick={() => onAction({ type: 'HARVEST_RESOURCE', label: 'Forage Area', payload: { harvestContext: 'surrounding village outskirts', villageContext: villageData.metadata } })}
                        className="w-full bg-teal-700 hover:bg-teal-600 text-white px-4 py-2 rounded-lg font-semibold shadow-sm"
                    >
                        Forage / Harvest
                    </button>
                    {/* Separator */}
                    <div className="h-px bg-gray-700 my-2"></div>
                 </div>

                 <ActionPane
                    currentLocation={currentLocation}
                    npcsInLocation={npcsInLocation}
                    itemsInLocation={itemsInLocation}
                    onAction={onAction}
                    disabled={disabled}
                    geminiGeneratedActions={geminiGeneratedActions}
                    isDevDummyActive={isDevDummyActive}
                    unreadDiscoveryCount={unreadDiscoveryCount}
                    hasNewRateLimitError={hasNewRateLimitError}
                 />
             </div>
             <div className="p-4 border-t border-gray-700 bg-gray-800">
                  <button
                    onClick={() => onAction({ type: 'custom', label: 'Exit Village' })}
                    className="w-full bg-red-700 hover:bg-red-600 text-white px-4 py-3 rounded-lg text-lg font-semibold transition-colors shadow-md"
                  >
                    Exit Village
                  </button>
             </div>
        </div>
    </div>
  );
};

export default VillageScene;
