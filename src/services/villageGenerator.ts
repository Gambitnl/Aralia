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

export type VillageTileType =
  | 'grass'
  | 'path'
  | 'plaza'
  | 'market'
  | 'well'
  | 'guard_post'
  | 'house_small'
  | 'house_medium'
  | 'house_large'
  | 'shop_blacksmith'
  | 'shop_general'
  | 'shop_tavern'
  | 'shop_temple';

export interface VillageBuildingFootprint {
  id: string;
  type: VillageTileType;
  footprint: { x: number; y: number; width: number; height: number };
  color: string;
  accent: string;
}

export interface VillagePersonality {
  wealth: 'poor' | 'comfortable' | 'rich';
  culture: 'stoic' | 'festive' | 'scholarly' | 'martial';
  biomeStyle: 'temperate' | 'arid' | 'coastal' | 'swampy';
  population: 'small' | 'medium' | 'large';
}

export interface VillageLayout {
  width: number;
  height: number;
  tiles: VillageTileType[][];
  buildings: VillageBuildingFootprint[];
  personality: VillagePersonality;
  integrationProfile: VillageIntegrationProfile;
}

interface GenerationOptions {
  worldSeed: number;
  worldX: number;
  worldY: number;
  biomeId: string;
}

const TILE_TYPES_PRIORITY: VillageTileType[] = [
  'plaza',
  'market',
  'well',
  'guard_post',
  'shop_blacksmith',
  'shop_general',
  'shop_tavern',
  'shop_temple',
  'house_large',
  'house_medium',
  'house_small',
  'path',
  'grass'
];

/**
 * Keeps all tile writes consistent by comparing against a single priority list.
 * Using an explicit helper prevents later tile stamping (for example, guard
 * posts or houses) from accidentally overwriting the plaza or civic core. That
 * bug previously caused plaza tiles to flip to whatever the last building write
 * was, creating confusing hit testing results for the UI. Centralising the
 * comparison also reduces the chance of new placement code forgetting about the
 * intended layering rules.
 */
const getPriorityIndex = (type: VillageTileType): number => {
  const idx = TILE_TYPES_PRIORITY.indexOf(type);
  return idx === -1 ? TILE_TYPES_PRIORITY.length : idx;
};

const setTileWithPriority = (tiles: VillageTileType[][], x: number, y: number, type: VillageTileType) => {
  const row = tiles[y];
  if (!row || typeof row[x] === 'undefined') return;

  const current = row[x];
  const incomingPriority = getPriorityIndex(type);
  const currentPriority = getPriorityIndex(current);

  // Lower index means higher priority. Only replace when we know the newcomer
  // outranks what is already there. This keeps roads from overrunning civic
  // structures while still allowing high-priority features to reclaim space.
  if (incomingPriority <= currentPriority) {
    row[x] = type;
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

const rollPersonality = (rng: () => number, biomeId: string): VillagePersonality => {
  const wealthRoll = rng();
  const wealth: VillagePersonality['wealth'] = wealthRoll > 0.7 ? 'rich' : wealthRoll > 0.35 ? 'comfortable' : 'poor';

  const cultureRoll = rng();
  const culture: VillagePersonality['culture'] =
    cultureRoll > 0.75 ? 'martial' : cultureRoll > 0.5 ? 'scholarly' : cultureRoll > 0.25 ? 'festive' : 'stoic';

  const populationRoll = rng();
  const population: VillagePersonality['population'] = populationRoll > 0.7 ? 'large' : populationRoll > 0.35 ? 'medium' : 'small';

  return {
    wealth,
    culture,
    biomeStyle: inferBiomeStyle(biomeId),
    population
  };
};

const createGrid = (width: number, height: number, defaultTile: VillageTileType): VillageTileType[][] => {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => defaultTile));
};

const carvePath = (tiles: VillageTileType[][], points: { x: number; y: number }[]) => {
  points.forEach(({ x, y }) => {
    setTileWithPriority(tiles, x, y, 'path');
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
  plazaBoost = false
) => {
  const { footprint, type } = building;
  for (let dy = 0; dy < footprint.height; dy++) {
    for (let dx = 0; dx < footprint.width; dx++) {
      const x = footprint.x + dx;
      const y = footprint.y + dy;
      if (!tiles[y] || typeof tiles[y][x] === 'undefined') continue;
      // Plaza tiles keep highest priority to make the square obvious while still
      // storing the market footprint for hit testing. The helper ensures we only
      // downgrade a tile when the placement belongs higher in the priority list.
      const targetType: VillageTileType = plazaBoost && type === 'market' ? 'plaza' : type;
      setTileWithPriority(tiles, x, y, targetType);
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

const addWindingRoads = (tiles: VillageTileType[][], rng: () => number) => {
  const height = tiles.length;
  const width = tiles[0]?.length || 0;
  // Lay subtle curvature so roads feel organic instead of perfectly orthogonal.
  for (let y = 4; y < height; y += 6) {
    const wobble = Math.floor(rng() * 3) - 1;
    for (let x = 0; x < width; x++) {
      const rowY = clamp(y + wobble, 1, height - 2);
      setTileWithPriority(tiles, x, rowY, 'path');
    }
  }
};

export const generateVillageLayout = ({ worldSeed, worldX, worldY, biomeId }: GenerationOptions): VillageLayout => {
  const width = 48;
  const height = 32;
  const biomeSeedText = `${biomeId}_village`;
  const rng = createSeededRandom(worldSeed, { x: worldX, y: worldY }, biomeSeedText, 'village_rng');
  const personality = rollPersonality(rng, biomeId);
  // Keep a ready-made integration profile so UI layers and AI hooks can share
  // the same narrative cues without recomputing or duplicating logic.
  const integrationProfile = resolveVillageIntegrationProfile(personality);

  const tiles = createGrid(width, height, 'grass');
  const buildings: VillageBuildingFootprint[] = [];

  const center = { x: Math.floor(width / 2), y: Math.floor(height / 2) };

  // Carve main axial roads touching every edge to guarantee connectivity
  carvePath(
    tiles,
    Array.from({ length: width }, (_, x) => ({ x, y: center.y }))
  );
  carvePath(
    tiles,
    Array.from({ length: height }, (_, y) => ({ x: center.x, y }))
  );

  // Winding secondary roads create neighborhoods and variety
  addWindingRoads(tiles, rng);

  // Central plaza anchors civic life
  const plazaSize = 6;
  const plazaTopLeft = { x: center.x - Math.floor(plazaSize / 2), y: center.y - Math.floor(plazaSize / 2) };
  const plazaBuilding: VillageBuildingFootprint = {
    id: 'plaza-core',
    type: 'plaza',
    footprint: { x: plazaTopLeft.x, y: plazaTopLeft.y, width: plazaSize, height: plazaSize },
    ...pickColor('plaza', rng)
  };
  stampBuilding(tiles, plazaBuilding, true);
  buildings.push(plazaBuilding);

  // Well sits in the heart of the plaza, deterministic placement for player cues
  const well: VillageBuildingFootprint = {
    id: 'village-well',
    type: 'well',
    footprint: { x: center.x - 1, y: center.y - 1, width: 2, height: 2 },
    ...pickColor('well', rng)
  };
  stampBuilding(tiles, well);
  buildings.push(well);

  // Market covers most of the plaza, leaving breathing room for paths
  const market: VillageBuildingFootprint = {
    id: 'market-square',
    type: 'market',
    footprint: { x: plazaTopLeft.x + 1, y: plazaTopLeft.y + 1, width: plazaSize - 2, height: plazaSize - 2 },
    ...pickColor('market', rng)
  };
  stampBuilding(tiles, market);
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
    stampBuilding(tiles, guard);
    carvePath(tiles, getConnectionPath({ x: center.x, y: center.y }, { x: guard.footprint.x, y: guard.footprint.y }));
    buildings.push(guard);
  });

  // Shops cluster close to the plaza for foot traffic
  const shopTypes: VillageTileType[] = ['shop_blacksmith', 'shop_general', 'shop_tavern', 'shop_temple'];
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
    stampBuilding(tiles, shop);
    carvePath(tiles, getConnectionPath({ x: shop.footprint.x, y: shop.footprint.y }, center));
    buildings.push(shop);
  });

  // Residential districts radiate outward, size based on population / wealth
  const houseBudget = personality.population === 'large' ? 22 : personality.population === 'medium' ? 16 : 10;
  const wealthBias = personality.wealth === 'rich' ? 0.7 : personality.wealth === 'comfortable' ? 0.5 : 0.3;
  const houseTypes: VillageTileType[] = ['house_large', 'house_medium', 'house_small'];

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
    stampBuilding(tiles, house);
    carvePath(tiles, getConnectionPath({ x: footprint.x, y: footprint.y }, center));
    buildings.push(house);
  }

  // Final sanity pass: if a tile ever slipped through with an unknown type,
  // nudge it back to grass so renderers never choke on unexpected strings.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = tiles[y][x];
      if (getPriorityIndex(tile) === TILE_TYPES_PRIORITY.length) {
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
  let chosen: VillageBuildingFootprint | undefined;
  let bestPriority = TILE_TYPES_PRIORITY.length;

  layout.buildings.forEach(b => {
    const { footprint } = b;
    const withinBounds = x >= footprint.x && x < footprint.x + footprint.width && y >= footprint.y && y < footprint.y + footprint.height;
    if (!withinBounds) return;

    const buildingPriority = getPriorityIndex(b.type);
    // Pick the most prominent building that owns the tile so that overlapping
    // civic structures (well inside plaza, market over plaza) resolve
    // deterministically for UI interactions.
    if (buildingPriority <= bestPriority) {
      chosen = b;
      bestPriority = buildingPriority;
    }
  });

  return chosen;
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
