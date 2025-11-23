/**
 * @file src/services/villageGenerator.ts
 * Procedural village generation service that creates varied villages
 * with biome-appropriate surroundings using the existing submap generation patterns.
 */
import { SeededFeatureConfig } from '../types';

// Enhanced tile types for larger village maps
export const VILLAGE_TILE_TYPES = {
  // Basic terrain
  GRASS: 0,
  PATH: 1,
  WATER: 2,
  
  // Village core buildings
  INN: 10,
  HOUSE_SMALL: 11,
  HOUSE_MEDIUM: 12,
  HOUSE_LARGE: 13,
  BLACKSMITH: 14,
  GENERAL_STORE: 15,
  TEMPLE: 16,
  WELL: 17,
  MARKET_SQUARE: 18,
  GUARD_POST: 19,
  
  // Village infrastructure
  VILLAGE_WALL: 20,
  VILLAGE_GATE: 21,
  WATCHTOWER: 22,
  FARM_PLOT: 23,
  STABLE: 24,
  STORAGE_BARN: 25,
  
  // Biome-specific surroundings
  FOREST_TREES: 30,
  DESERT_SAND: 31,
  MOUNTAIN_ROCKS: 32,
  SWAMP_MARSH: 33,
  PLAINS_FLOWERS: 34,
  OCEAN_BEACH: 35,
  HILLS_SLOPE: 36,
  
  // Defensive structures
  PALISADE: 40,
  MOAT: 41,
  BRIDGE: 42,
} as const;

export interface VillageGenerationConfig {
  size: 'tiny' | 'small' | 'medium' | 'large';
  biome: string;
  worldX: number;
  worldY: number;
  worldSeed: number;
  wealth: 'poor' | 'modest' | 'prosperous' | 'wealthy';
  specialty: 'farming' | 'mining' | 'trading' | 'fishing' | 'military' | 'religious' | 'general';
}

export interface GeneratedVillage {
  layout: number[][];
  width: number;
  height: number;
  villageCore: { centerX: number; centerY: number; radius: number };
  buildings: VillageBuilding[];
  gates: { x: number; y: number }[];
  metadata: VillageMetadata;
}

export interface VillageBuilding {
  x: number;
  y: number;
  type: number;
  name: string;
  description: string;
}

export interface VillageMetadata {
  name: string;
  population: number;
  founded: string;
  culture: string;
  defenses: string;
  economy: string;
}

// Simple hash function matching the submap system pattern
const villageHash = (worldSeed: number, worldX: number, worldY: number, suffix: string): number => {
  let h = 0;
  const str = `${worldSeed},${worldX},${worldY},village,${suffix}`;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
};

// Generate biome-appropriate surrounding terrain
const generateSurroundingTerrain = (
  layout: number[][],
  biome: string,
  config: VillageGenerationConfig,
  coreArea: { centerX: number; centerY: number; radius: number }
): void => {
  const width = layout[0].length;
  const height = layout.length;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Skip if already part of village core
      const distanceFromCore = Math.sqrt(
        Math.pow(x - coreArea.centerX, 2) + Math.pow(y - coreArea.centerY, 2)
      );
      
      if (distanceFromCore <= coreArea.radius + 2) continue;
      
      // Generate biome-specific terrain
      const terrainSeed = villageHash(config.worldSeed, config.worldX, config.worldY, `terrain_${x}_${y}`);
      const terrainType = terrainSeed % 100;
      
      switch (biome) {
        case 'forest':
          if (terrainType < 70) layout[y][x] = VILLAGE_TILE_TYPES.FOREST_TREES;
          else if (terrainType < 85) layout[y][x] = VILLAGE_TILE_TYPES.GRASS;
          else if (terrainType < 95) layout[y][x] = VILLAGE_TILE_TYPES.PATH;
          else layout[y][x] = VILLAGE_TILE_TYPES.WATER;
          break;
          
        case 'desert':
          if (terrainType < 80) layout[y][x] = VILLAGE_TILE_TYPES.DESERT_SAND;
          else if (terrainType < 95) layout[y][x] = VILLAGE_TILE_TYPES.GRASS;
          else layout[y][x] = VILLAGE_TILE_TYPES.MOUNTAIN_ROCKS;
          break;
          
        case 'mountain':
          if (terrainType < 60) layout[y][x] = VILLAGE_TILE_TYPES.MOUNTAIN_ROCKS;
          else if (terrainType < 80) layout[y][x] = VILLAGE_TILE_TYPES.GRASS;
          else layout[y][x] = VILLAGE_TILE_TYPES.PATH;
          break;
          
        case 'swamp':
          if (terrainType < 50) layout[y][x] = VILLAGE_TILE_TYPES.SWAMP_MARSH;
          else if (terrainType < 70) layout[y][x] = VILLAGE_TILE_TYPES.WATER;
          else layout[y][x] = VILLAGE_TILE_TYPES.GRASS;
          break;
          
        case 'ocean':
          if (terrainType < 40) layout[y][x] = VILLAGE_TILE_TYPES.WATER;
          else if (terrainType < 70) layout[y][x] = VILLAGE_TILE_TYPES.OCEAN_BEACH;
          else layout[y][x] = VILLAGE_TILE_TYPES.GRASS;
          break;
          
        case 'hills':
          if (terrainType < 50) layout[y][x] = VILLAGE_TILE_TYPES.HILLS_SLOPE;
          else if (terrainType < 80) layout[y][x] = VILLAGE_TILE_TYPES.GRASS;
          else layout[y][x] = VILLAGE_TILE_TYPES.PLAINS_FLOWERS;
          break;
          
        default: // plains
          if (terrainType < 60) layout[y][x] = VILLAGE_TILE_TYPES.GRASS;
          else if (terrainType < 80) layout[y][x] = VILLAGE_TILE_TYPES.PLAINS_FLOWERS;
          else layout[y][x] = VILLAGE_TILE_TYPES.PATH;
      }
    }
  }
};

// Generate village defenses based on size and wealth
const generateDefenses = (
  layout: number[][],
  config: VillageGenerationConfig,
  coreArea: { centerX: number; centerY: number; radius: number }
): { x: number; y: number }[] => {
  const gates: { x: number; y: number }[] = [];
  
  if (config.size === 'tiny') return gates; // No defenses for tiny villages
  
  const wallRadius = coreArea.radius + 1;
  const defenseType = config.wealth === 'wealthy' ? VILLAGE_TILE_TYPES.VILLAGE_WALL : VILLAGE_TILE_TYPES.PALISADE;
  
  // Create circular defensive perimeter
  for (let angle = 0; angle < 360; angle += 15) {
    const radian = (angle * Math.PI) / 180;
    const wallX = Math.round(coreArea.centerX + wallRadius * Math.cos(radian));
    const wallY = Math.round(coreArea.centerY + wallRadius * Math.sin(radian));
    
    if (wallX >= 0 && wallX < layout[0].length && wallY >= 0 && wallY < layout.length) {
      // Place gates at cardinal directions
      if (angle % 90 === 0) {
        layout[wallY][wallX] = VILLAGE_TILE_TYPES.VILLAGE_GATE;
        gates.push({ x: wallX, y: wallY });
      } else {
        layout[wallY][wallX] = defenseType;
      }
    }
  }
  
  return gates;
};

// Generate village buildings using weighted placement
const generateBuildings = (
  layout: number[][],
  config: VillageGenerationConfig,
  coreArea: { centerX: number; centerY: number; radius: number }
): VillageBuilding[] => {
  const buildings: VillageBuilding[] = [];
  
  // Define building types based on village specialty and wealth
  const buildingPools = {
    essential: [
      { type: VILLAGE_TILE_TYPES.INN, name: 'Village Inn', weight: 1.0 },
      { type: VILLAGE_TILE_TYPES.WELL, name: 'Village Well', weight: 1.0 },
      { type: VILLAGE_TILE_TYPES.GENERAL_STORE, name: 'General Store', weight: 0.8 },
    ],
    residential: [
      { type: VILLAGE_TILE_TYPES.HOUSE_SMALL, name: 'Cottage', weight: 1.0 },
      { type: VILLAGE_TILE_TYPES.HOUSE_MEDIUM, name: 'Family Home', weight: 0.7 },
      { type: VILLAGE_TILE_TYPES.HOUSE_LARGE, name: 'Manor House', weight: 0.3 },
    ],
    specialty: {
      farming: [
        { type: VILLAGE_TILE_TYPES.FARM_PLOT, name: 'Farm Plot', weight: 0.8 },
        { type: VILLAGE_TILE_TYPES.STABLE, name: 'Stable', weight: 0.6 },
        { type: VILLAGE_TILE_TYPES.STORAGE_BARN, name: 'Storage Barn', weight: 0.7 },
      ],
      mining: [
        { type: VILLAGE_TILE_TYPES.BLACKSMITH, name: 'Blacksmith', weight: 1.0 },
        { type: VILLAGE_TILE_TYPES.STORAGE_BARN, name: 'Ore Storage', weight: 0.6 },
      ],
      trading: [
        { type: VILLAGE_TILE_TYPES.MARKET_SQUARE, name: 'Market Square', weight: 1.0 },
        { type: VILLAGE_TILE_TYPES.STORAGE_BARN, name: 'Warehouse', weight: 0.8 },
      ],
      religious: [
        { type: VILLAGE_TILE_TYPES.TEMPLE, name: 'Temple', weight: 1.0 },
      ],
      military: [
        { type: VILLAGE_TILE_TYPES.GUARD_POST, name: 'Guard Barracks', weight: 1.0 },
        { type: VILLAGE_TILE_TYPES.WATCHTOWER, name: 'Watchtower', weight: 0.8 },
      ],
    }
  };
  
  // Place essential buildings first (center area)
  buildingPools.essential.forEach((building, index) => {
    const placementSeed = villageHash(config.worldSeed, config.worldX, config.worldY, `essential_${index}`);
    if ((placementSeed % 100) < building.weight * 100) {
      const angle = (index * 120 + (placementSeed % 60)) * Math.PI / 180;
      const distance = 2 + (placementSeed % 3);
      const x = Math.round(coreArea.centerX + distance * Math.cos(angle));
      const y = Math.round(coreArea.centerY + distance * Math.sin(angle));
      
      if (x >= 0 && x < layout[0].length && y >= 0 && y < layout.length) {
        layout[y][x] = building.type;
        buildings.push({ x, y, type: building.type, name: building.name, description: `The village ${building.name.toLowerCase()}.` });
      }
    }
  });
  
  // Add specialty buildings
  const specialtyBuildings = buildingPools.specialty[config.specialty] || [];
  specialtyBuildings.forEach((building, index) => {
    const placementSeed = villageHash(config.worldSeed, config.worldX, config.worldY, `specialty_${index}`);
    if ((placementSeed % 100) < building.weight * 100) {
      const angle = (index * 90 + (placementSeed % 45)) * Math.PI / 180;
      const distance = 3 + (placementSeed % 4);
      const x = Math.round(coreArea.centerX + distance * Math.cos(angle));
      const y = Math.round(coreArea.centerY + distance * Math.sin(angle));
      
      if (x >= 0 && x < layout[0].length && y >= 0 && y < layout.length) {
        layout[y][x] = building.type;
        buildings.push({ x, y, type: building.type, name: building.name, description: `A ${building.name.toLowerCase()} serving the village.` });
      }
    }
  });
  
  // Add residential buildings (outer ring)
  const residentialCount = config.size === 'tiny' ? 2 : config.size === 'small' ? 4 : config.size === 'medium' ? 8 : 12;
  for (let i = 0; i < residentialCount; i++) {
    const placementSeed = villageHash(config.worldSeed, config.worldX, config.worldY, `residential_${i}`);
    const buildingType = buildingPools.residential[placementSeed % buildingPools.residential.length];
    
    if ((placementSeed % 100) < buildingType.weight * 100) {
      const angle = (i * (360 / residentialCount) + (placementSeed % 30)) * Math.PI / 180;
      const distance = 5 + (placementSeed % 3);
      const x = Math.round(coreArea.centerX + distance * Math.cos(angle));
      const y = Math.round(coreArea.centerY + distance * Math.sin(angle));
      
      if (x >= 0 && x < layout[0].length && y >= 0 && y < layout.length && layout[y][x] === VILLAGE_TILE_TYPES.GRASS) {
        layout[y][x] = buildingType.type;
        buildings.push({ x, y, type: buildingType.type, name: buildingType.name, description: `A ${buildingType.name.toLowerCase()} where villagers live.` });
      }
    }
  }
  
  return buildings;
};

// Generate connecting paths between buildings
const generatePaths = (layout: number[][], buildings: VillageBuilding[], coreArea: { centerX: number; centerY: number; radius: number }): void => {
  const width = layout[0].length;
  const height = layout.length;
  
  // Create main cross paths
  for (let x = 0; x < width; x++) {
    if (layout[coreArea.centerY][x] === VILLAGE_TILE_TYPES.GRASS) {
      layout[coreArea.centerY][x] = VILLAGE_TILE_TYPES.PATH;
    }
  }
  
  for (let y = 0; y < height; y++) {
    if (layout[y][coreArea.centerX] === VILLAGE_TILE_TYPES.GRASS) {
      layout[y][coreArea.centerX] = VILLAGE_TILE_TYPES.PATH;
    }
  }
  
  // Connect buildings to main paths with simple pathfinding
  buildings.forEach(building => {
    const steps = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
    ];
    
    let currentX = building.x;
    let currentY = building.y;
    let attempts = 0;
    
    while (attempts < 20) {
      const found = steps.some(step => {
        const nextX = currentX + step.dx;
        const nextY = currentY + step.dy;
        
        if (nextX >= 0 && nextX < width && nextY >= 0 && nextY < height) {
          if (layout[nextY][nextX] === VILLAGE_TILE_TYPES.PATH) {
            return true; // Found existing path
          }
          
          if (layout[nextY][nextX] === VILLAGE_TILE_TYPES.GRASS) {
            layout[nextY][nextX] = VILLAGE_TILE_TYPES.PATH;
            currentX = nextX;
            currentY = nextY;
            return false; // Continue building path
          }
        }
        return false;
      });
      
      if (found) break;
      attempts++;
    }
  });
};

// Main village generation function
export const generateVillage = (config: VillageGenerationConfig): GeneratedVillage => {
  // Determine village dimensions based on size
  const dimensions = {
    tiny: { width: 16, height: 16 },
    small: { width: 20, height: 20 },
    medium: { width: 24, height: 24 },
    large: { width: 28, height: 28 },
  }[config.size];
  
  // Initialize empty layout with grass
  const layout: number[][] = Array(dimensions.height).fill(null).map(() => 
    Array(dimensions.width).fill(VILLAGE_TILE_TYPES.GRASS)
  );
  
  // Define village core area
  const coreArea = {
    centerX: Math.floor(dimensions.width / 2),
    centerY: Math.floor(dimensions.height / 2),
    radius: config.size === 'tiny' ? 4 : config.size === 'small' ? 6 : config.size === 'medium' ? 8 : 10
  };
  
  // Generate surrounding terrain based on biome
  generateSurroundingTerrain(layout, config.biome, config, coreArea);
  
  // Generate buildings
  const buildings = generateBuildings(layout, config, coreArea);
  
  // Generate paths
  generatePaths(layout, buildings, coreArea);
  
  // Generate defenses
  const gates = generateDefenses(layout, config, coreArea);
  
  // Generate village metadata
  const villageNameSeed = villageHash(config.worldSeed, config.worldX, config.worldY, 'name');
  const namePool = ['Haven', 'Ford', 'Vale', 'Hollow', 'Ridge', 'Brook', 'Mill', 'Cross', 'Gate', 'Hill'];
  const villageName = `${namePool[villageNameSeed % namePool.length]}${config.specialty === 'general' ? '' : ` ${config.specialty.charAt(0).toUpperCase() + config.specialty.slice(1)}`}`;
  
  const metadata: VillageMetadata = {
    name: villageName,
    population: config.size === 'tiny' ? 25 : config.size === 'small' ? 50 : config.size === 'medium' ? 150 : 300,
    founded: `${1200 + (villageNameSeed % 400)} years ago`,
    culture: `${config.biome} dwellers`,
    defenses: config.size === 'tiny' ? 'None' : config.wealth === 'wealthy' ? 'Stone walls' : 'Wooden palisade',
    economy: `Primarily ${config.specialty}`
  };
  
  return {
    layout,
    width: dimensions.width,
    height: dimensions.height,
    villageCore: coreArea,
    buildings,
    gates,
    metadata
  };
};

// Determine village configuration based on world position and biome
export const determineVillageConfig = (worldX: number, worldY: number, biome: string, worldSeed: number): VillageGenerationConfig => {
  const configSeed = villageHash(worldSeed, worldX, worldY, 'config');
  
  // Determine size (weighted toward smaller villages)
  const sizeRoll = configSeed % 100;
  const size = sizeRoll < 40 ? 'tiny' : sizeRoll < 70 ? 'small' : sizeRoll < 90 ? 'medium' : 'large';
  
  // Determine wealth (usually modest)
  const wealthRoll = (configSeed >> 8) % 100;
  const wealth = wealthRoll < 10 ? 'poor' : wealthRoll < 70 ? 'modest' : wealthRoll < 90 ? 'prosperous' : 'wealthy';
  
  // Determine specialty based on biome
  const specialtyOptions = {
    forest: ['farming', 'general'],
    plains: ['farming', 'trading', 'general'],
    mountain: ['mining', 'military'],
    desert: ['trading', 'general'],
    swamp: ['fishing', 'general'],
    ocean: ['fishing', 'trading'],
    hills: ['farming', 'military', 'general']
  };
  
  const options = specialtyOptions[biome as keyof typeof specialtyOptions] || ['general'];
  const specialty = options[(configSeed >> 16) % options.length] as VillageGenerationConfig['specialty'];
  
  return {
    size,
    biome,
    worldX,
    worldY,
    worldSeed,
    wealth,
    specialty
  };
};
