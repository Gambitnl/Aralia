/**
 * @file src/data/biomes.ts
 * Defines biome data for the Aralia RPG map system.
 * Now expanded to 10 families × 5 variants (50 total) with gameplay hooks.
 */
import { Biome } from '../types';

type BiomePreset = Partial<Biome>;

const FAMILY_PRESETS: Record<string, BiomePreset> = {
  forest: {
    climate: 'temperate',
    moisture: 'temperate',
    elevation: 'low',
    waterFrequency: 'medium',
    spawnWeight: 4,
    icon: '🌲',
    tags: ['trees', 'cover'],
    movementModifiers: { speedMultiplier: 0.9 },
    visibilityModifiers: { fog: 'light', canopyShade: true },
    hazards: ['falling-branches', 'thorny-underbrush'],
    elementalInteractions: ['fire-spreads-fast'],
    encounterWeights: { beasts: 3, fey: 2, undead: 1 },
    resourceWeights: { wood: 3, herbs: 2, forage: 2 },
  },
  plains: {
    climate: 'temperate',
    moisture: 'temperate',
    elevation: 'low',
    waterFrequency: 'medium',
    spawnWeight: 4,
    icon: '🌾',
    tags: ['open', 'windy'],
    movementModifiers: { speedMultiplier: 1 },
    visibilityModifiers: { haze: false },
    hazards: ['grassfire'],
    elementalInteractions: ['fire-spreads-fast'],
    encounterWeights: { beasts: 2, bandits: 2 },
    resourceWeights: { forage: 2, mounts: 1 },
  },
  wetland: {
    climate: 'temperate',
    moisture: 'saturated',
    elevation: 'low',
    waterFrequency: 'high',
    spawnWeight: 2,
    icon: '🌿',
    tags: ['waterlogged', 'foggy'],
    movementModifiers: { speedMultiplier: 0.7, difficultTerrain: true },
    visibilityModifiers: { fog: 'medium' },
    hazards: ['quicksand', 'deep-mud', 'bog-sinkhole', 'leeches'],
    elementalInteractions: ['lightning-conductive'],
    encounterWeights: { beasts: 2, undead: 2, fey: 1 },
    resourceWeights: { herbs: 3, fish: 2, forage: 1 },
  },
  jungle: {
    climate: 'tropical',
    moisture: 'wet',
    elevation: 'low',
    waterFrequency: 'high',
    spawnWeight: 2,
    icon: '🌴',
    tags: ['dense', 'canopy'],
    movementModifiers: { speedMultiplier: 0.75, difficultTerrain: true },
    visibilityModifiers: { fog: 'light', canopyShade: true },
    hazards: ['thorny-underbrush', 'aggressive-vines', 'leeches'],
    elementalInteractions: ['lightning-conductive', 'fire-spreads-fast'],
    encounterWeights: { beasts: 3, fey: 1, insects: 2 },
    resourceWeights: { herbs: 2, forage: 2, wood: 2 },
  },
  coastal: {
    climate: 'temperate',
    moisture: 'temperate',
    elevation: 'low',
    waterFrequency: 'high',
    spawnWeight: 2,
    icon: '🌊',
    tags: ['shore', 'windy'],
    movementModifiers: { speedMultiplier: 0.9 },
    visibilityModifiers: { haze: true },
    hazards: ['undertow', 'slippery-banks'],
    elementalInteractions: ['lightning-conductive'],
    encounterWeights: { beasts: 1, pirates: 2, beasts_aquatic: 2 },
    resourceWeights: { fish: 3, salt: 1, salvage: 1 },
  },
  desert: {
    climate: 'arid',
    moisture: 'arid',
    elevation: 'low',
    waterFrequency: 'rare',
    spawnWeight: 2,
    icon: '🏜️',
    tags: ['open', 'hot'],
    movementModifiers: { speedMultiplier: 0.8, difficultTerrain: true },
    visibilityModifiers: { haze: true },
    hazards: ['sandstorm', 'heat-exhaustion', 'quicksand'],
    elementalInteractions: ['fire-spreads-fast'],
    encounterWeights: { beasts: 1, raiders: 2, undead: 1 },
    resourceWeights: { ore: 1, forage: 0, water: 0 },
  },
  mountain: {
    climate: 'temperate',
    moisture: 'dry',
    elevation: 'high',
    waterFrequency: 'medium',
    spawnWeight: 2,
    icon: '⛰️',
    tags: ['elevation', 'cliffs'],
    movementModifiers: { speedMultiplier: 0.75, difficultTerrain: true, requiresClimb: true },
    visibilityModifiers: { haze: true },
    hazards: ['falling-rock', 'avalanche'],
    elementalInteractions: ['lightning-conductive'],
    encounterWeights: { beasts: 2, giants: 1, bandits: 1 },
    resourceWeights: { ore: 3, stone: 2 },
  },
  tundra: {
    climate: 'polar',
    moisture: 'dry',
    elevation: 'mid',
    waterFrequency: 'low',
    spawnWeight: 1,
    icon: '❄️',
    tags: ['cold', 'windy'],
    movementModifiers: { speedMultiplier: 0.8, difficultTerrain: true },
    visibilityModifiers: { snowBlindness: true, fog: 'light' },
    hazards: ['thin-ice', 'blizzard'],
    elementalInteractions: ['water-freezes-night', 'ice-cracks'],
    encounterWeights: { beasts: 1, undead: 1, spirits: 1 },
    resourceWeights: { forage: 0, fish: 1, fur: 2 },
  },
  volcanic: {
    climate: 'arid',
    moisture: 'dry',
    elevation: 'high',
    waterFrequency: 'rare',
    spawnWeight: 1,
    icon: '🌋',
    tags: ['heat', 'ash'],
    magic: 'elemental',
    movementModifiers: { speedMultiplier: 0.8, difficultTerrain: true },
    visibilityModifiers: { haze: true },
    hazards: ['lava', 'toxic-vent', 'ashfall'],
    elementalInteractions: ['fire-spreads-fast'],
    encounterWeights: { elementals: 2, undead: 1, beasts: 1 },
    resourceWeights: { ore: 2, gems: 1 },
  },
  blight: {
    climate: 'temperate',
    moisture: 'dry',
    elevation: 'low',
    waterFrequency: 'low',
    spawnWeight: 1,
    icon: '☣️',
    tags: ['tainted', 'ruins'],
    magic: 'necrotic',
    movementModifiers: { speedMultiplier: 0.85, difficultTerrain: true },
    visibilityModifiers: { fog: 'light', haze: true, darkness: true },
    hazards: ['cursed-ground', 'wild-magic', 'toxic-fog', 'spore-cloud'],
    elementalInteractions: ['lightning-conductive'],
    encounterWeights: { undead: 3, cultists: 1, beasts: 1 },
    resourceWeights: { salvage: 2, herbs: 1 },
  },
};

type VariantConfig = {
  id: string;
  name: string;
  variant: string;
  description: string;
  color: string;
  rgbaColor: string;
  passable?: boolean;
  waterFrequency?: Biome['waterFrequency'];
  spawnWeight?: number;
  movementModifiers?: Biome['movementModifiers'];
  visibilityModifiers?: Biome['visibilityModifiers'];
  hazards?: string[];
  elementalInteractions?: string[];
  encounterWeights?: Record<string, number>;
  resourceWeights?: Record<string, number>;
  tags?: string[];
  magic?: Biome['magic'];
  icon?: string;
  climate?: Biome['climate'];
  moisture?: Biome['moisture'];
  elevation?: Biome['elevation'];
};

const VARIANTS: Record<string, VariantConfig[]> = {
  forest: [
    { id: 'forest_temperate', name: 'Temperate Forest', variant: 'temperate', color: 'bg-green-700', rgbaColor: 'rgba(34, 109, 72, 0.7)', description: 'Mixed conifers and broadleaf trees with dappled light.', spawnWeight: 3 },
    { id: 'forest_boreal', name: 'Boreal Forest', variant: 'boreal', color: 'bg-emerald-800', rgbaColor: 'rgba(12, 83, 53, 0.7)', description: 'Cold, evergreen stands with mossy ground.', climate: 'polar', spawnWeight: 2, hazards: ['snow-load'] },
    { id: 'forest_ancient', name: 'Ancient Forest', variant: 'ancient', color: 'bg-green-900', rgbaColor: 'rgba(10, 68, 45, 0.7)', description: 'Massive trunks, thick undergrowth, and hidden groves.', hazards: ['falling-branches', 'dense-roots'], visibilityModifiers: { fog: 'medium', canopyShade: true }, resourceWeights: { wood: 3, herbs: 3 } },
    { id: 'forest_haunted', name: 'Haunted Forest', variant: 'haunted', color: 'bg-emerald-950', rgbaColor: 'rgba(6, 46, 36, 0.7)', description: 'Eerie silence, twisted trees, and ghostly lights.', magic: 'necrotic', hazards: ['cursed-ground'], encounterWeights: { undead: 3, beasts: 1 }, elementalInteractions: ['darkness'] },
    { id: 'forest_fey', name: 'Fey-Touched Forest', variant: 'fey', color: 'bg-green-600', rgbaColor: 'rgba(40, 120, 90, 0.7)', description: 'Vivid flora, motes of light, and subtle enchantments.', magic: 'fey', hazards: ['wild-magic'], encounterWeights: { fey: 3, beasts: 2 } },
  ],
  plains: [
    { id: 'plains_prairie', name: 'Prairie', variant: 'prairie', color: 'bg-yellow-500', rgbaColor: 'rgba(210, 170, 70, 0.7)', description: 'Open grassland with gentle hills.', spawnWeight: 3 },
    { id: 'plains_savanna', name: 'Savanna', variant: 'savanna', color: 'bg-amber-500', rgbaColor: 'rgba(214, 159, 64, 0.7)', description: 'Warm plains with scattered trees and tall grasses.', climate: 'subtropical', hazards: ['grassfire'], encounterWeights: { beasts: 2, predators: 1 } },
    { id: 'plains_meadow', name: 'Meadow', variant: 'meadow', color: 'bg-lime-500', rgbaColor: 'rgba(158, 194, 60, 0.7)', description: 'Flowering fields, low brush, and clear skies.', resourceWeights: { forage: 3, herbs: 2 } },
    { id: 'steppe_windswept', name: 'Windswept Steppe', variant: 'windswept', color: 'bg-yellow-400', rgbaColor: 'rgba(225, 188, 80, 0.7)', description: 'Dry, rolling grasslands with strong gusts.', moisture: 'dry', hazards: ['wind-gusts'], movementModifiers: { speedMultiplier: 0.95 } },
    { id: 'floodplain', name: 'Floodplain', variant: 'flooded', color: 'bg-lime-400', rgbaColor: 'rgba(170, 200, 95, 0.7)', description: 'Flat lowlands with seasonal floods and rich soil.', waterFrequency: 'high', movementModifiers: { speedMultiplier: 0.85, difficultTerrain: true }, hazards: ['mudslide'], resourceWeights: { forage: 3, fish: 1 } },
  ],
  wetland: [
    { id: 'wetland_marsh', name: 'Marsh', variant: 'marsh', color: 'bg-teal-700', rgbaColor: 'rgba(26, 94, 92, 0.7)', description: 'Shallow water with reeds and grasses.', spawnWeight: 2 },
    { id: 'wetland_bog', name: 'Bog', variant: 'bog', color: 'bg-teal-800', rgbaColor: 'rgba(22, 83, 78, 0.7)', description: 'Peat-rich ground with acidic pools.', hazards: ['bog-sinkhole'], visibilityModifiers: { fog: 'heavy' } },
    { id: 'wetland_swamp', name: 'Swamp', variant: 'swamp', color: 'bg-green-800', rgbaColor: 'rgba(19, 78, 74, 0.7)', description: 'Murky waters, hanging moss, and gnarled trees.' },
    { id: 'wetland_mangrove', name: 'Mangrove', variant: 'mangrove', color: 'bg-emerald-700', rgbaColor: 'rgba(24, 120, 98, 0.7)', description: 'Tidal roots and brackish water.', hazards: ['undertow'], waterFrequency: 'high', movementModifiers: { requiresSwim: true, speedMultiplier: 0.6 } },
    { id: 'wetland_fen', name: 'Fen', variant: 'fen', color: 'bg-cyan-700', rgbaColor: 'rgba(34, 115, 122, 0.7)', description: 'Mineral-rich wetland with open water channels.', resourceWeights: { fish: 2, herbs: 2 } },
  ],
  jungle: [
    { id: 'jungle_tropical', name: 'Tropical Jungle', variant: 'tropical', color: 'bg-green-700', rgbaColor: 'rgba(35, 120, 70, 0.7)', description: 'Humid canopy, broad leaves, and vibrant life.' },
    { id: 'jungle_monsoon', name: 'Monsoon Jungle', variant: 'monsoon', color: 'bg-green-800', rgbaColor: 'rgba(30, 105, 68, 0.7)', description: 'Sudden downpours, muddy ground, and swollen rivers.', hazards: ['quicksand', 'aggressive-vines'], waterFrequency: 'high' },
    { id: 'jungle_bamboo', name: 'Bamboo Jungle', variant: 'bamboo', color: 'bg-emerald-700', rgbaColor: 'rgba(33, 130, 84, 0.7)', description: 'Dense bamboo stands with narrow sightlines.', movementModifiers: { difficultTerrain: true, speedMultiplier: 0.8 } },
    { id: 'jungle_cloud', name: 'Cloud Jungle', variant: 'cloud', color: 'bg-green-900', rgbaColor: 'rgba(24, 88, 60, 0.7)', description: 'High-elevation jungle shrouded in mist.', elevation: 'mid', visibilityModifiers: { fog: 'heavy', canopyShade: true }, hazards: ['slippery-banks'] },
    { id: 'jungle_ruins', name: 'Overgrown Ruins', variant: 'ruins', color: 'bg-lime-700', rgbaColor: 'rgba(90, 146, 70, 0.7)', description: 'Ancient stone swallowed by roots and vines.', magic: 'arcane', hazards: ['wild-magic', 'traps'], resourceWeights: { salvage: 2 } },
  ],
  coastal: [
    { id: 'coastal_beach', name: 'Sandy Beach', variant: 'beach', color: 'bg-yellow-300', rgbaColor: 'rgba(235, 203, 140, 0.7)', description: 'Wide sands and gentle surf.', hazards: ['undertow'], movementModifiers: { speedMultiplier: 0.9, difficultTerrain: true } },
    { id: 'coastal_rocky', name: 'Rocky Coast', variant: 'rocky', color: 'bg-slate-500', rgbaColor: 'rgba(110, 125, 140, 0.7)', description: 'Jagged cliffs, tidepools, and crashing waves.', hazards: ['falling-rock', 'slippery-banks'], movementModifiers: { speedMultiplier: 0.85, difficultTerrain: true } },
    { id: 'coastal_delta', name: 'River Delta', variant: 'delta', color: 'bg-teal-600', rgbaColor: 'rgba(44, 125, 120, 0.7)', description: 'Braided channels and rich silt flats.', waterFrequency: 'high', resourceWeights: { fish: 3, forage: 2 } },
    { id: 'coastal_archipelago', name: 'Archipelago', variant: 'archipelago', color: 'bg-cyan-600', rgbaColor: 'rgba(60, 145, 175, 0.7)', description: 'Strings of islets and narrow straits.', hazards: ['undertow'], movementModifiers: { requiresSwim: true, speedMultiplier: 0.7 } },
    { id: 'coastal_reef', name: 'Coral Reef', variant: 'reef', color: 'bg-teal-500', rgbaColor: 'rgba(70, 170, 160, 0.7)', description: 'Shallow waters with bright coral.', hazards: ['slippery-banks'], movementModifiers: { requiresSwim: true, speedMultiplier: 0.6 } },
  ],
  desert: [
    { id: 'desert_dune', name: 'Dune Sea', variant: 'dune', color: 'bg-amber-300', rgbaColor: 'rgba(242, 202, 129, 0.7)', description: 'Shifting dunes and scarce shade.', spawnWeight: 2 },
    { id: 'desert_rocky', name: 'Rocky Desert', variant: 'rocky', color: 'bg-amber-400', rgbaColor: 'rgba(226, 176, 106, 0.7)', description: 'Stone mesas and hardpack flats.', movementModifiers: { speedMultiplier: 0.9, difficultTerrain: true }, resourceWeights: { ore: 2 } },
    { id: 'desert_badlands', name: 'Badlands', variant: 'badlands', color: 'bg-orange-500', rgbaColor: 'rgba(210, 120, 80, 0.7)', description: 'Eroded gullies and hoodoos.', hazards: ['falling-rock'], resourceWeights: { ore: 2, salvage: 1 } },
    { id: 'desert_salt_flat', name: 'Salt Flats', variant: 'salt', color: 'bg-zinc-300', rgbaColor: 'rgba(200, 196, 186, 0.7)', description: 'Blinding white pans and mirages.', visibilityModifiers: { haze: true }, hazards: ['mirage'], movementModifiers: { speedMultiplier: 1 } },
    { id: 'desert_oasis', name: 'Oasis', variant: 'oasis', color: 'bg-teal-400', rgbaColor: 'rgba(80, 170, 150, 0.7)', description: 'Rare water pocket with palms.', waterFrequency: 'medium', spawnWeight: 1, hazards: ['quicksand'], resourceWeights: { forage: 2, water: 2 }, movementModifiers: { speedMultiplier: 0.95 } },
  ],
  mountain: [
    { id: 'mountain_alpine', name: 'Alpine Peaks', variant: 'alpine', color: 'bg-slate-600', rgbaColor: 'rgba(95, 115, 130, 0.7)', description: 'Snow-dusted ridges and sharp drops.', climate: 'polar', hazards: ['thin-ice', 'avalanche'], spawnWeight: 2 },
    { id: 'mountain_crag', name: 'Craggy Mountains', variant: 'crag', color: 'bg-slate-700', rgbaColor: 'rgba(80, 100, 115, 0.7)', description: 'Steep cliffs, scree slopes, and narrow passes.', hazards: ['falling-rock'], movementModifiers: { requiresClimb: true } },
    { id: 'mountain_glacier', name: 'Glacial Heights', variant: 'glacier', color: 'bg-blue-800', rgbaColor: 'rgba(60, 90, 130, 0.7)', description: 'Glaciers, crevasses, and icy winds.', waterFrequency: 'medium', hazards: ['thin-ice'], movementModifiers: { speedMultiplier: 0.7, difficultTerrain: true } },
    { id: 'highland_plateau', name: 'Highland Plateau', variant: 'plateau', color: 'bg-lime-700', rgbaColor: 'rgba(110, 150, 75, 0.7)', description: 'Flat highlands with sparse grass.', elevation: 'mid', movementModifiers: { speedMultiplier: 0.9 }, spawnWeight: 2 },
    { id: 'highland_vale', name: 'Green Vale', variant: 'vale', color: 'bg-lime-600', rgbaColor: 'rgba(125, 170, 90, 0.7)', description: 'Rolling highland hills and valleys.', elevation: 'mid', hazards: ['fog-bank'], spawnWeight: 2 },
  ],
  tundra: [
    { id: 'tundra_icefield', name: 'Icefield', variant: 'icefield', color: 'bg-cyan-200', rgbaColor: 'rgba(200, 235, 245, 0.7)', description: 'Endless ice sheets and bitter winds.', movementModifiers: { speedMultiplier: 0.7 }, hazards: ['thin-ice'] },
    { id: 'tundra_permafrost', name: 'Permafrost Plain', variant: 'permafrost', color: 'bg-blue-200', rgbaColor: 'rgba(185, 220, 240, 0.7)', description: 'Frozen ground with sparse scrub.', hazards: ['frostbite'], resourceWeights: { forage: 0, fur: 2 } },
    { id: 'tundra_blizzard', name: 'Blizzard Flats', variant: 'blizzard', color: 'bg-blue-300', rgbaColor: 'rgba(170, 210, 235, 0.7)', description: 'Whiteout conditions and driving snow.', visibilityModifiers: { fog: 'heavy', snowBlindness: true }, hazards: ['blizzard'] },
    { id: 'tundra_aurora', name: 'Aurora Expanse', variant: 'aurora', color: 'bg-indigo-300', rgbaColor: 'rgba(170, 190, 230, 0.7)', description: 'Clear nights with shimmering skies.', visibilityModifiers: { darkness: true }, elementalInteractions: ['water-freezes-night'] },
    { id: 'tundra_froststeppe', name: 'Frost Steppe', variant: 'froststeppe', color: 'bg-cyan-300', rgbaColor: 'rgba(160, 215, 230, 0.7)', description: 'Frozen grassland with icy crust.', hazards: ['thin-ice'], movementModifiers: { speedMultiplier: 0.85 } },
  ],
  volcanic: [
    { id: 'volcanic_lava_fields', name: 'Lava Fields', variant: 'lava', color: 'bg-red-700', rgbaColor: 'rgba(170, 60, 40, 0.7)', description: 'Cooling lava flows and heat shimmer.', hazards: ['lava'] },
    { id: 'volcanic_ashlands', name: 'Ashlands', variant: 'ashlands', color: 'bg-stone-700', rgbaColor: 'rgba(90, 80, 70, 0.7)', description: 'Ash-choked plains and drifting cinders.', hazards: ['ashfall'], visibilityModifiers: { haze: true } },
    { id: 'volcanic_obsidian_plain', name: 'Obsidian Plain', variant: 'obsidian', color: 'bg-slate-800', rgbaColor: 'rgba(60, 60, 70, 0.7)', description: 'Razor-sharp glassy ground.', hazards: ['cuts'], movementModifiers: { speedMultiplier: 0.7, difficultTerrain: true } },
    { id: 'volcanic_fumaroles', name: 'Fumarole Field', variant: 'fumaroles', color: 'bg-amber-700', rgbaColor: 'rgba(170, 120, 60, 0.7)', description: 'Steam vents and sulfur plumes.', hazards: ['toxic-vent'], visibilityModifiers: { fog: 'light' } },
    { id: 'volcanic_sulfur_vents', name: 'Sulfur Vents', variant: 'sulfur', color: 'bg-yellow-700', rgbaColor: 'rgba(190, 150, 40, 0.7)', description: 'Bubbling pools and choking fumes.', hazards: ['toxic-vent'], resourceWeights: { ore: 2, gems: 1 } },
  ],
  blight: [
    { id: 'blight_ashen_waste', name: 'Ashen Waste', variant: 'ashen', color: 'bg-gray-600', rgbaColor: 'rgba(110, 105, 105, 0.7)', description: 'Charred remains and lifeless soil.', hazards: ['cursed-ground'] },
    { id: 'blight_cursed_land', name: 'Cursed Land', variant: 'cursed', color: 'bg-purple-800', rgbaColor: 'rgba(80, 60, 110, 0.7)', description: 'Whispers on the wind and sickly glow.', hazards: ['cursed-ground', 'fear-aura'], elementalInteractions: ['darkness'], visibilityModifiers: { darkness: true } },
    { id: 'blight_necrotic_marsh', name: 'Necrotic Marsh', variant: 'necrotic', color: 'bg-emerald-900', rgbaColor: 'rgba(30, 70, 50, 0.7)', description: 'Rotten water and drifting will-o-wisps.', hazards: ['toxic-fog', 'cursed-ground'], waterFrequency: 'medium' },
    { id: 'blight_crystal_barrens', name: 'Crystal Barrens', variant: 'crystal', color: 'bg-indigo-600', rgbaColor: 'rgba(90, 80, 150, 0.7)', description: 'Shattered arcane crystals jut from the earth.', magic: 'arcane', hazards: ['wild-magic'] },
    { id: 'blight_shattered_ruins', name: 'Shattered Ruins', variant: 'ruins', color: 'bg-stone-800', rgbaColor: 'rgba(70, 65, 70, 0.7)', description: 'Collapsed cities with lingering wards.', hazards: ['cursed-ground', 'traps'], resourceWeights: { salvage: 3 } },
  ],
};

const biomeList: Biome[] = Object.entries(VARIANTS).flatMap(([family, variants]) => {
  const preset = FAMILY_PRESETS[family] || {};
  return variants.map((variant) => ({
    passable: variant.passable ?? preset.passable ?? true,
    ...preset,
    ...variant,
    id: variant.id,
    name: variant.name,
    family,
    variant: variant.variant,
    description: variant.description,
    color: variant.color,
    rgbaColor: variant.rgbaColor,
    magic: variant.magic ?? preset.magic,
    waterFrequency: variant.waterFrequency ?? preset.waterFrequency,
    spawnWeight: variant.spawnWeight ?? preset.spawnWeight ?? 1,
    movementModifiers: { ...(preset.movementModifiers || {}), ...(variant.movementModifiers || {}) },
    visibilityModifiers: { ...(preset.visibilityModifiers || {}), ...(variant.visibilityModifiers || {}) },
    hazards: Array.from(new Set([...(preset.hazards || []), ...(variant.hazards || [])])),
    elementalInteractions: Array.from(new Set([...(preset.elementalInteractions || []), ...(variant.elementalInteractions || [])])),
    encounterWeights: { ...(preset.encounterWeights || {}), ...(variant.encounterWeights || {}) },
    resourceWeights: { ...(preset.resourceWeights || {}), ...(variant.resourceWeights || {}) },
    tags: Array.from(new Set([...(preset.tags || []), ...(variant.tags || [])])),
    icon: variant.icon ?? preset.icon,
  }));
});

const specialBiomes: Biome[] = [
  {
    id: 'ocean',
    name: 'Ocean',
    family: 'special',
    variant: 'ocean',
    climate: 'temperate',
    moisture: 'saturated',
    elevation: 'aquatic',
    waterFrequency: 'high',
    color: 'bg-blue-700',
    rgbaColor: 'rgba(29, 78, 216, 0.7)',
    icon: '🌊',
    description: 'Vast expanse of water, requires a vessel to cross.',
    passable: false,
    impassableReason: 'The vast ocean is too dangerous to cross without a sturdy vessel.',
    hazards: ['undertow'],
    movementModifiers: { requiresSwim: true },
    resourceWeights: { fish: 4, salvage: 1 },
  },
  {
    id: 'cave',
    name: 'Cave',
    family: 'special',
    variant: 'cave',
    climate: 'temperate',
    moisture: 'temperate',
    elevation: 'subterranean',
    waterFrequency: 'low',
    color: 'bg-gray-800',
    rgbaColor: 'rgba(31, 41, 55, 0.7)',
    icon: '🌑',
    description: 'A dark, natural subterranean chamber or series of passages.',
    passable: true,
    hazards: ['darkness', 'falling-rock'],
    visibilityModifiers: { darkness: true },
  },
  {
    id: 'dungeon',
    name: 'Dungeon',
    family: 'special',
    variant: 'dungeon',
    climate: 'temperate',
    moisture: 'dry',
    elevation: 'subterranean',
    waterFrequency: 'low',
    color: 'bg-stone-900',
    rgbaColor: 'rgba(28, 25, 23, 0.7)',
    icon: '⛓️',
    description: 'An underground labyrinth of constructed corridors and rooms, often ancient and dangerous.',
    passable: true,
    hazards: ['traps', 'cursed-ground'],
    visibilityModifiers: { darkness: true },
  },
];

const baseBiomes = [...biomeList, ...specialBiomes];

export const BIOMES: Record<string, Biome> = baseBiomes.reduce((acc, biome) => {
  acc[biome.id] = biome;
  return acc;
}, {} as Record<string, Biome>);

// Legacy aliases to keep existing references working
const LEGACY_ALIASES: Record<string, string> = {
  forest: 'forest_temperate',
  plains: 'plains_prairie',
  desert: 'desert_dune',
  swamp: 'wetland_swamp',
  hills: 'highland_vale',
  mountain: 'mountain_alpine',
};

Object.entries(LEGACY_ALIASES).forEach(([alias, targetId]) => {
  const target = BIOMES[targetId];
  if (target && !BIOMES[alias]) {
    BIOMES[alias] = { ...target, id: alias, name: target.name };
  }
});
