import { resolveVillageIntegrationProfile, VillageIntegrationProfile } from '../data/villagePersonalityProfiles';
import { villageBuildingVisuals } from '../config/submapVisualsConfig';
import { createSeededRandom } from '../utils/submapUtils';

/**
 * Deterministic village generation pipeline.
 *
 * Steps:
 * 1. Seed an RNG using world coords + biome so the same tile always yields the same layout.
 * 2. Roll a "personality" profile that influences population and wealth distributions.
 * 3. Carve axial roads and winding side streets to avoid a strict grid.
 * 4. Stamp civic core (plaza + well + market + guard posts) near the centre.
 * 5. Place shops around the plaza with soft collision checks to keep lanes clear.
 * 6. Scatter houses outward with distance bias so outskirts feel residential.
 * 7. Return both a tile matrix and building footprints for hit-testing.
 */

// Base terrain types
type TerrainTileType = 'grass' | 'path' | 'dirt' | 'stone' | 'water' | 'trees';

// Civic structures
type CivicTileType = 'plaza' | 'market' | 'well' | 'fountain' | 'statue' | 'guard_post' | 'watchtower' | 'gatehouse';

// Residential buildings
type ResidentialTileType = 'house_small' | 'house_medium' | 'house_large' | 'apartment' | 'manor' | 'estate';

// Commercial buildings
type CommercialTileType = 'shop_blacksmith' | 'shop_general' | 'shop_tavern' | 'shop_temple' | 'inn' | 'bank' | 'guildhall' | 'stable';

// Cultural/Architectural variants
type CulturalTileType =
  // Elven
  | 'treehouse_small' | 'treehouse_large' | 'ancient_circle' | 'weaver_hall'
  // Dwarven
  | 'stone_hall_small' | 'stone_hall_large' | 'forge_temple' | 'underground_entrance'
  // Orcish
  | 'hide_tent' | 'longhouse' | 'totem_pole' | 'war_memorial'
  // Aquatic/Marine
  | 'dock' | 'lighthouse' | 'shipwright' | 'fish_market'
  // Magical
  | 'magic_academy' | 'arcane_tower' | 'healers_hut' | 'alchemist_shop'
  // Exotic
  | 'caravan_stop' | 'nomad_yurt' | 'trading_post' | 'shrine';

export type VillageTileType = TerrainTileType | CivicTileType | ResidentialTileType | CommercialTileType | CulturalTileType;

export interface VillageBuildingFootprint {
  id: string;
  type: VillageTileType;
  footprint: { x: number; y: number; width: number; height: number };
  fill: string;
  accent: string;
  pattern?: 'stripe' | 'check' | 'dot';
}

import { VillagePersonality, VillageIntegrationProfile } from '../types';

export interface VillageLayout {
  width: number;
  height: number;
  tiles: VillageTileType[][];
  buildings: VillageBuildingFootprint[];
  personality: VillagePersonality;
  integrationProfile: VillageIntegrationProfile;
}

// TODO(FEATURES): Emit town metadata (name, population, cultural tags) alongside layout for the Town Description System (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).
interface GenerationOptions {
  worldSeed: number;
  worldX: number;
  worldY: number;
  biomeId: string;
}

// Dynamic priority list based on personality
const getTilePriorityList = (personality: VillagePersonality): VillageTileType[] => {
  const basePriorities: VillageTileType[] = [];

  // Add cultural civic buildings first
  if (personality.architecturalStyle === 'magical') {
    basePriorities.push('ancient_circle', 'arcane_tower', 'healers_hut');
  } else if (personality.architecturalStyle === 'tribal') {
    basePriorities.push('totem_pole', 'war_memorial');
  } else if (personality.architecturalStyle === 'aquatic') {
    basePriorities.push('dock', 'lighthouse');
  }

  // Add standard civic buildings
  basePriorities.push('plaza', 'market', 'well', 'fountain', 'guard_post', 'watchtower');

  // Add commercial buildings based on primary industry
  if (personality.primaryIndustry === 'mining' || personality.primaryIndustry === 'crafting') {
    basePriorities.push('shop_blacksmith', 'forge_temple');
  } else if (personality.primaryIndustry === 'fishing') {
    basePriorities.push('fish_market', 'dock');
  } else if (personality.primaryIndustry === 'trade') {
    basePriorities.push('caravan_stop', 'trading_post');
  } else if (personality.primaryIndustry === 'military') {
    basePriorities.push('guard_post', 'watchtower');
  } else if (personality.primaryIndustry === 'scholarship') {
    basePriorities.push('magic_academy', 'shop_temple');
  }

  basePriorities.push('shop_general', 'shop_tavern', 'inn', 'shop_temple', 'guildhall', 'bank');

  // Add residential buildings
  if (personality.architecturalStyle === 'magical') {
    basePriorities.push('treehouse_large', 'treehouse_small');
  } else if (personality.architecturalStyle === 'industrial') {
    basePriorities.push('stone_hall_large', 'stone_hall_small');
  } else if (personality.architecturalStyle === 'tribal') {
    basePriorities.push('longhouse', 'hide_tent');
  } else {
    basePriorities.push('manor', 'estate', 'house_large', 'house_medium', 'house_small', 'apartment');
  }

  // Terrain and paths
  basePriorities.push('path', 'stone', 'dirt', 'water', 'trees', 'grass');

  return [...new Set(basePriorities)]; // Remove duplicates
};

/**
 * Keeps all tile writes consistent by comparing against a personality-based priority list.
 * Using an explicit helper prevents later tile stamping from accidentally overwriting
 * important structures. The priority list is now dynamic based on settlement personality.
 */
const getPriorityIndex = (type: VillageTileType, personality: VillagePersonality): number => {
  const priorityList = getTilePriorityList(personality);
  const idx = priorityList.indexOf(type);
  return idx === -1 ? priorityList.length : idx;
};

const setTileWithPriority = (tiles: VillageTileType[][], x: number, y: number, type: VillageTileType, personality: VillagePersonality) => {
  if (!tiles[y] || typeof tiles[y][x] === 'undefined') return;

  const current = tiles[y][x];
  const incomingPriority = getPriorityIndex(type, personality);
  const currentPriority = getPriorityIndex(current, personality);

  // Lower index means higher priority. Only replace when we know the newcomer
  // outranks what is already there. This keeps roads from overrunning civic
  // structures while still allowing high-priority features to reclaim space.
  if (incomingPriority <= currentPriority) {
    tiles[y][x] = type;
  }
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const pickColor = (type: VillageTileType, rng: () => number): { fill: string; accent: string; pattern?: 'stripe' | 'check' | 'dot' } => {
  const visuals = villageBuildingVisuals[type] || villageBuildingVisuals.path;
  const colorIndex = Math.floor(rng() * visuals.colors.length) % visuals.colors.length;
  return { fill: visuals.colors[colorIndex], accent: visuals.accent, pattern: visuals.pattern };
};

const inferBiomeStyle = (biomeId: string): VillagePersonality['biomeStyle'] => {
  if (biomeId === 'desert') return 'arid';
  if (biomeId === 'ocean') return 'coastal';
  if (biomeId === 'swamp') return 'swampy';
  return 'temperate';
};

const inferArchitecturalStyle = (biomeId: string, dominantRace?: string): VillagePersonality['architecturalStyle'] => {
  // Race takes precedence over biome for architectural style
  if (dominantRace) {
    switch (dominantRace) {
      case 'elf': return 'magical';
      case 'dwarf': return 'industrial'; // Mining/industrial aesthetic
      case 'orc': return 'tribal';
      case 'halfling': return 'colonial'; // Cozy, settled feel
      case 'gnome': return 'magical';
      case 'dragonborn': return 'martial'; // Fortified, military
      case 'tiefling': return 'magical'; // Infernal influences
    }
  }

  // Fallback to biome-based styles
  switch (biomeId) {
    case 'forest': return 'magical';
    case 'mountain': return 'industrial';
    case 'desert': return 'nomadic';
    case 'ocean': return 'aquatic';
    case 'swamp': return 'tribal';
    default: return 'medieval';
  }
};

const getShopTypesForPersonality = (personality: VillagePersonality): VillageTileType[] => {
  const shops: VillageTileType[] = [];

  // Base shops that appear in most settlements
  shops.push('shop_general', 'shop_tavern');

  // Add culturally specific shops
  if (personality.architecturalStyle === 'magical') {
    shops.push('alchemist_shop', 'magic_academy', 'healers_hut');
  } else if (personality.architecturalStyle === 'industrial') {
    shops.push('shop_blacksmith', 'forge_temple');
  } else if (personality.architecturalStyle === 'aquatic') {
    shops.push('fish_market', 'shipwright');
  } else if (personality.architecturalStyle === 'nomadic') {
    shops.push('caravan_stop', 'trading_post');
  } else {
    shops.push('shop_blacksmith', 'shop_temple');
  }

  // Add industry-specific shops
  if (personality.primaryIndustry === 'military') {
    shops.push('guard_post');
  } else if (personality.primaryIndustry === 'trade') {
    shops.push('bank', 'caravan_stop');
  }

  return shops.slice(0, 4); // Limit to 4 shop types per settlement
};

const getHouseTypesForPersonality = (personality: VillagePersonality): VillageTileType[] => {
  if (personality.architecturalStyle === 'magical') {
    return ['treehouse_large', 'treehouse_small'];
  } else if (personality.architecturalStyle === 'industrial') {
    return ['stone_hall_large', 'stone_hall_small'];
  } else if (personality.architecturalStyle === 'tribal') {
    return ['longhouse', 'hide_tent'];
  } else if (personality.architecturalStyle === 'aquatic') {
    return ['house_large', 'house_medium']; // Elevated or waterfront homes
  } else {
    return ['house_large', 'house_medium', 'house_small'];
  }
};

const rollPersonality = (rng: () => number, biomeId: string, dominantRace?: string, isStartingSettlement = false): VillagePersonality => {
  // For starting settlements: Character-driven with high engagement
  if (isStartingSettlement && dominantRace) {
    return generateCharacterDrivenPersonality(rng, biomeId, dominantRace);
  }

  // For regular settlements: Natural variation with occasional cultural influence
  return generateNaturalPersonality(rng, biomeId, dominantRace);
};

const generateCharacterDrivenPersonality = (rng: () => number, biomeId: string, dominantRace: string): VillagePersonality => {
  // High character engagement: Settlement strongly reflects character's culture
  const personality = generateNaturalPersonality(rng, biomeId, dominantRace);

  // Override with character-appropriate traits for maximum engagement
  switch (dominantRace) {
    case 'elf':
      return {
        ...personality,
        dominantRace: 'elf',
        architecturalStyle: 'magical',
        culture: rng() > 0.6 ? 'scholarly' : 'stoic',
        governingBody: 'council',
        primaryIndustry: rng() > 0.5 ? 'crafting' : 'scholarship'
      };
    case 'dwarf':
      return {
        ...personality,
        dominantRace: 'dwarf',
        architecturalStyle: 'industrial',
        culture: 'stoic',
        governingBody: 'elder',
        primaryIndustry: rng() > 0.7 ? 'mining' : 'crafting'
      };
    case 'orc':
      return {
        ...personality,
        dominantRace: 'orc',
        architecturalStyle: 'tribal',
        culture: 'martial',
        governingBody: 'warlord',
        primaryIndustry: rng() > 0.6 ? 'military' : 'agriculture'
      };
    case 'halfling':
      return {
        ...personality,
        dominantRace: 'halfling',
        architecturalStyle: 'colonial',
        culture: 'festive',
        governingBody: 'mayor',
        primaryIndustry: 'agriculture'
      };
    // Add more races as needed
    default:
      return personality;
  }
};

const generateNaturalPersonality = (rng: () => number, biomeId: string, dominantRace?: string): VillagePersonality => {
  // Natural variation: More organic world generation
  const wealthRoll = rng();
  const wealth: VillagePersonality['wealth'] = wealthRoll > 0.7 ? 'rich' : wealthRoll > 0.35 ? 'comfortable' : 'poor';

  const cultureRoll = rng();
  const culture: VillagePersonality['culture'] =
    cultureRoll > 0.75 ? 'martial' : cultureRoll > 0.5 ? 'scholarly' : cultureRoll > 0.25 ? 'festive' : 'stoic';

  const populationRoll = rng();
  const population: VillagePersonality['population'] = populationRoll > 0.7 ? 'large' : populationRoll > 0.35 ? 'medium' : 'small';

  // Natural governing body determination
  const governingRoll = rng();
  let governingBody: VillagePersonality['governingBody'];
  if (culture === 'martial') {
    governingBody = governingRoll > 0.6 ? 'warlord' : governingRoll > 0.3 ? 'council' : 'mayor';
  } else if (culture === 'scholarly') {
    governingBody = governingRoll > 0.5 ? 'council' : 'guild';
  } else if (wealth === 'rich') {
    governingBody = governingRoll > 0.6 ? 'monarch' : governingRoll > 0.3 ? 'council' : 'mayor';
  } else {
    governingBody = governingRoll > 0.5 ? 'mayor' : governingRoll > 0.25 ? 'elder' : 'council';
  }

  // Natural industry determination
  const industryRoll = rng();
  let primaryIndustry: VillagePersonality['primaryIndustry'];
  switch (biomeId) {
    case 'mountain':
      primaryIndustry = industryRoll > 0.6 ? 'mining' : 'crafting';
      break;
    case 'forest':
      primaryIndustry = industryRoll > 0.5 ? 'crafting' : 'agriculture';
      break;
    case 'ocean':
      primaryIndustry = industryRoll > 0.7 ? 'fishing' : 'trade';
      break;
    case 'desert':
      primaryIndustry = industryRoll > 0.5 ? 'trade' : 'crafting';
      break;
    default:
      if (culture === 'scholarly') primaryIndustry = 'scholarship';
      else if (culture === 'martial') primaryIndustry = 'military';
      else primaryIndustry = industryRoll > 0.5 ? 'agriculture' : 'trade';
  }

  // Occasional cultural influence for flavor (but not dominant)
  const hasCulturalInfluence = rng() > 0.7; // 30% chance
  const actualDominantRace = hasCulturalInfluence ? dominantRace : undefined;

  return {
    wealth,
    culture,
    biomeStyle: inferBiomeStyle(biomeId),
    population,
    dominantRace: actualDominantRace as VillagePersonality['dominantRace'],
    architecturalStyle: inferArchitecturalStyle(biomeId, actualDominantRace),
    governingBody,
    primaryIndustry
  };
};

const createGrid = (width: number, height: number, defaultTile: VillageTileType): VillageTileType[][] => {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => defaultTile));
};

const carvePath = (tiles: VillageTileType[][], points: { x: number; y: number }[], personality: VillagePersonality) => {
  points.forEach(({ x, y }) => {
    setTileWithPriority(tiles, x, y, 'path', personality);
  });
};

const areaIsFree = (tiles: VillageTileType[][], x: number, y: number, width: number, height: number): boolean => {
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const px = x + dx;
      const py = y + dy;
      if (!tiles[py] || !tiles[py][px]) return false;
      const tile = tiles[py][px];
      if (tile !== 'grass' && tile !== 'path') return false;
    }
  }
  return true;
};

const stampBuilding = (
  tiles: VillageTileType[][],
  building: VillageBuildingFootprint,
  personality: VillagePersonality,
  plazaBoost = false
) => {
  const { footprint, type } = building;
  for (let dy = 0; dy < footprint.height; dy++) {
    for (let dx = 0; dx < footprint.width; dx++) {
      const x = footprint.x + dx;
      const y = footprint.y + dy;
      if (!tiles[y] || typeof tiles[y][x] === 'undefined') continue;

      // plazaBoost: make market tiles appear as plaza tiles for visual cohesion
      const targetType = plazaBoost && type === 'market' ? 'plaza' : type;
      setTileWithPriority(tiles, x, y, targetType, personality);
    }
  }
};

const getConnectionPath = (
  start: { x: number; y: number },
  target: { x: number; y: number }
): { x: number; y: number }[] => {
  const points: { x: number; y: number }[] = [];
  let cx = start.x;
  let cy = start.y;
  while (cx !== target.x || cy !== target.y) {
    if (cx !== target.x) cx += cx < target.x ? 1 : -1;
    if (cy !== target.y) cy += cy < target.y ? 1 : -1;
    points.push({ x: cx, y: cy });
  }
  return points;
};

const addWindingRoads = (tiles: VillageTileType[][], rng: () => number, personality: VillagePersonality) => {
  const height = tiles.length;
  const width = tiles[0]?.length || 0;
  // Lay subtle curvature so roads feel organic instead of perfectly orthogonal.
  for (let y = 4; y < height; y += 6) {
    const wobble = Math.floor(rng() * 3) - 1;
    for (let x = 0; x < width; x++) {
      const rowY = clamp(y + wobble, 1, height - 2);
      setTileWithPriority(tiles, x, rowY, 'path', personality);
    }
  }
};

interface ExtendedGenerationOptions extends GenerationOptions {
  dominantRace?: string; // For character-driven starting settlements
  isStartingSettlement?: boolean; // Flag for high-engagement starting areas
}

export const generateVillageLayout = ({
  worldSeed,
  worldX,
  worldY,
  biomeId,
  dominantRace,
  isStartingSettlement = false
}: ExtendedGenerationOptions): VillageLayout => {
  const width = 48;
  const height = 32;
  const biomeSeedText = `${biomeId}_village${dominantRace ? `_${dominantRace}` : ''}`;
  const rng = createSeededRandom(worldSeed, { x: worldX, y: worldY }, biomeSeedText, 'village_rng');
  const personality = rollPersonality(rng, biomeId, dominantRace, isStartingSettlement);
  // Keep a ready-made integration profile so UI layers and AI hooks can share
  // the same narrative cues without recomputing or duplicating logic.
  const integrationProfile = resolveVillageIntegrationProfile(personality);

  const tiles = createGrid(width, height, 'grass');
  const buildings: VillageBuildingFootprint[] = [];

  const center = { x: Math.floor(width / 2), y: Math.floor(height / 2) };

  // Carve main axial roads touching every edge to guarantee connectivity
  carvePath(
    tiles,
    Array.from({ length: width }, (_, x) => ({ x, y: center.y })),
    personality
  );
  carvePath(
    tiles,
    Array.from({ length: height }, (_, y) => ({ x: center.x, y })),
    personality
  );

  // Winding secondary roads create neighborhoods and variety
  addWindingRoads(tiles, rng, personality);

  // Central plaza anchors civic life
  const plazaSize = 6;
  const plazaTopLeft = { x: center.x - Math.floor(plazaSize / 2), y: center.y - Math.floor(plazaSize / 2) };
  const plazaBuilding: VillageBuildingFootprint = {
    id: 'plaza-core',
    type: 'plaza',
    footprint: { x: plazaTopLeft.x, y: plazaTopLeft.y, width: plazaSize, height: plazaSize },
    ...pickColor('plaza', rng)
  };
  stampBuilding(tiles, plazaBuilding, personality, false);
  buildings.push(plazaBuilding);

  // Well sits in the heart of the plaza, deterministic placement for player cues
  const well: VillageBuildingFootprint = {
    id: 'village-well',
    type: 'well',
    footprint: { x: center.x - 1, y: center.y - 1, width: 2, height: 2 },
    ...pickColor('well', rng)
  };
  stampBuilding(tiles, well, personality, false);
  buildings.push(well);

  // Market covers most of the plaza, leaving breathing room for paths
  const market: VillageBuildingFootprint = {
    id: 'market-square',
    type: 'market',
    footprint: { x: plazaTopLeft.x + 1, y: plazaTopLeft.y + 1, width: plazaSize - 2, height: plazaSize - 2 },
    ...pickColor('market', rng)
  };
  stampBuilding(tiles, market, personality, true); // plazaBoost for visual cohesion
  buildings.push(market);

  // Guard posts watch over northern and southern gates
  const guardOffsets = [-1, 1];
  guardOffsets.forEach((offset, idx) => {
    const guard: VillageBuildingFootprint = {
      id: `guard-post-${idx}`,
      type: 'guard_post',
      footprint: { x: center.x - 1, y: center.y + offset * (Math.floor(height / 2) - 3), width: 2, height: 2 },
      ...pickColor('guard_post', rng)
    };
    stampBuilding(tiles, guard, personality, false);
    carvePath(tiles, getConnectionPath({ x: center.x, y: center.y }, { x: guard.footprint.x, y: guard.footprint.y }), personality);
    buildings.push(guard);
  });

  // Shops cluster close to the plaza for foot traffic - culturally appropriate
  const shopTypes: VillageTileType[] = getShopTypesForPersonality(personality);
  shopTypes.forEach((type, idx) => {
    const radius = 4 + idx;
    const angle = rng() * Math.PI * 2;
    const posX = clamp(Math.floor(center.x + Math.cos(angle) * radius), 2, width - 6);
    const posY = clamp(Math.floor(center.y + Math.sin(angle) * radius), 2, height - 6);
    const footprint = { x: posX, y: posY, width: 4, height: 3 };
    if (!areaIsFree(tiles, footprint.x, footprint.y, footprint.width, footprint.height)) return;
    const shop: VillageBuildingFootprint = {
      id: `${type}-${idx}`,
      type,
      footprint,
      ...pickColor(type, rng)
    };
    stampBuilding(tiles, shop, personality, false);
    carvePath(tiles, getConnectionPath({ x: shop.footprint.x, y: shop.footprint.y }, center), personality);
    buildings.push(shop);
  });

  // Residential districts radiate outward, size based on population / wealth
  const houseBudget = personality.population === 'large' ? 22 : personality.population === 'medium' ? 16 : 10;
  const wealthBias = personality.wealth === 'rich' ? 0.7 : personality.wealth === 'comfortable' ? 0.5 : 0.3;
  // TODO(lint-intent): 'houseTypes' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  const _houseTypes: VillageTileType[] = getHouseTypesForPersonality(personality);

  for (let i = 0; i < houseBudget; i++) {
    const typeRoll = rng();
    let chosenType: VillageTileType = 'house_small';
    if (typeRoll > wealthBias + 0.2) chosenType = 'house_large';
    else if (typeRoll > wealthBias - 0.1) chosenType = 'house_medium';

    const dist = 8 + Math.floor(rng() * (Math.min(width, height) / 3));
    const angle = rng() * Math.PI * 2;
    const posX = clamp(Math.floor(center.x + Math.cos(angle) * dist), 1, width - 6);
    const posY = clamp(Math.floor(center.y + Math.sin(angle) * dist), 1, height - 6);
    const baseSize = chosenType === 'house_large' ? 5 : chosenType === 'house_medium' ? 4 : 3;
    const footprint = { x: posX, y: posY, width: baseSize, height: baseSize - 1 };

    if (!areaIsFree(tiles, footprint.x, footprint.y, footprint.width, footprint.height)) continue;

    const house: VillageBuildingFootprint = {
      id: `${chosenType}-${i}`,
      type: chosenType,
      footprint,
      ...pickColor(chosenType, rng)
    };
    stampBuilding(tiles, house, personality, false);
    carvePath(tiles, getConnectionPath({ x: footprint.x, y: footprint.y }, center), personality);
    buildings.push(house);
  }

  // Final sanity pass: if a tile ever slipped through with an unknown type,
  // nudge it back to grass so renderers never choke on unexpected strings.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = tiles[y][x];
      if (getPriorityIndex(tile, personality) === getTilePriorityList(personality).length) {
        tiles[y][x] = 'grass';
      }
    }
  }

  return {
    width,
    height,
    tiles,
    buildings,
    personality,
    integrationProfile
  };
};

/**
 * Helper that produces a building info object for UI layers based on tile
 * content. Canvas hit-testing in the VillageScene asks the generator for the
 * top-most building that occupies a tile so interactions stay deterministic.
 */
export const findBuildingAt = (layout: VillageLayout, x: number, y: number): VillageBuildingFootprint | undefined => {
  return layout.buildings.reduce((chosen: VillageBuildingFootprint | undefined, b) => {
    const { footprint } = b;
    const withinBounds = x >= footprint.x && x < footprint.x + footprint.width && y >= footprint.y && y < footprint.y + footprint.height;
    if (!withinBounds) return chosen;

    // Using priority comparison here keeps overlapping civic structures
    // deterministic for UI hit-testing (e.g., plaza beneath market).
    const buildingPriority = getPriorityIndex(b.type, layout.personality);
    const chosenPriority = chosen ? getPriorityIndex(chosen.type, layout.personality) : getTilePriorityList(layout.personality).length;

    return buildingPriority <= chosenPriority ? b : chosen;
  }, undefined);
};

/**
 * Simple deterministic utility for choosing a description string without
 * requiring any additional type imports. This keeps the generator entirely
 * self-contained and usable by both UI and gameplay hooks.
 */
export const describeBuilding = (building: VillageBuildingFootprint, personality: VillagePersonality): string => {
  const cultureFlavor: Record<VillagePersonality['culture'], string> = {
    stoic: 'practical lines and modest decor',
    festive: 'banners and ribbons fluttering in the breeze',
    scholarly: 'neatly painted signage and tidy facades',
    martial: 'reinforced shutters and watchful eyes'
  };

  const typeName: Record<VillageTileType, string> = {
    grass: 'Open Ground',
    path: 'Path',
    plaza: 'Central Plaza',
    market: 'Market Square',
    well: 'Village Well',
    guard_post: 'Guard Post',
    house_small: 'Small House',
    house_medium: 'Family Home',
    house_large: 'Estate House',
    shop_blacksmith: 'Blacksmith',
    shop_general: 'General Store',
    shop_tavern: 'Tavern',
    shop_temple: 'Temple'
  };

  const wealthFlavor = personality.wealth === 'rich' ? 'well-kept and prosperous' : personality.wealth === 'comfortable' ? 'orderly and welcoming' : 'weathered but lively';

  return `${typeName[building.type]} with ${cultureFlavor[personality.culture]}; the settlement feels ${wealthFlavor}.`;
};
