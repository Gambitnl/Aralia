
/**
 * @file src/data/glossaryData.ts
 * Defines predefined meanings for common icons used in submap visuals.
 */

export const SUBMAP_ICON_MEANINGS: Record<string, string> = {
  // General Terrain & Flora
  '🌲': 'Tree / Forest Element',
  '🌳': 'Tree / Copse / Small Forest Patch',
  '🌿': 'Undergrowth / Plants / Reeds / Kelp',
  '🍄': 'Mushroom / Fungi',
  '🌼': 'Flower / Wildflower',
  '🌷': 'Flower / Wildflower',
  '🌸': 'Flowering Plant / Wildflower Patch',
  '🌾': 'Grass / Grain / Plains Vegetation',
  '🌵': 'Cactus / Desert Plant',
  '🌴': 'Palm Tree',
  '🥥': 'Coconut / Fruit',
  '🌱': 'Sapling / New Growth',


  // Fauna
  '🦋': 'Butterfly / Flying Insect',
  '🐿️': 'Squirrel / Small Mammal',
  '🐜': 'Ant / Small Ground Insect',
  '🐰': 'Rabbit / Small Mammal',
  '🐸': 'Frog / Amphibian',
  '🐟': 'Fish',
  '🦅': 'Eagle / Bird of Prey',
  '🐐': 'Goat / Mountain Animal',
  '🐑': 'Sheep / Livestock',
  '🦂': 'Scorpion / Desert Creature',
  '🐍': 'Snake / Reptile',
  '🦟': 'Mosquito / Swarming Insect',
  '🐊': 'Alligator / Large Reptile',
  '🐙': 'Octopus / Cephalopod',
  '🐡': 'Pufferfish / Marine Creature',
  '🐬': 'Dolphin / Marine Mammal',
  '🦗': 'Cricket / Grasshopper',
  '🐞': 'Ladybug',
  '🪱': 'Worm / Grub',
  
  // Features & Structures
  '💧': 'Water Feature / Pond / Oasis / Murky Pool',
  '🗿': 'Stone Structure / Monolith / Ancient Stone',
  '✨': 'Magical Effect / Sparkle / Glimmer',
  '🏘️': 'Village / Settlement / Buildings',
  '🏕️': 'Campsite / Remains of Camp',
  '⛰️': 'Rocky Outcrop / Peak Detail',
  '❄️': 'Snow / Ice Patch',
  '💎': 'Mineral Vein / Gemstone Deposit',
  '♨️': 'Geothermal Vent / Hot Spring / Steam',
  '🪨': 'Rock / Boulder / Boulder Field',
  '🏛️': 'Ruin Fragment / Ancient Structure',
  '🏝️': 'Island / Landmass in Water',
  ' M ': 'Burial Mound / Earthen Structure', // Assuming M is for Mound
  '·': 'Dirt Patch / Sparse Ground',
  '〃': 'Pebbles / Gravel',


  // Path & Travel Related
  '🐾': 'Animal Trail / Path Marker',
  '👣': 'Footprints / Path',
  '🪵': 'Log Bridge / Swamp Path Element',
  '🧗': 'Climbing Path / Steep Trail Marker',
  '▫️': 'Path Marker / Simple Structure Detail', // Used for dirt roads, village buildings
  '〰️': 'Small Animal Trail / Disturbed Earth',


  // Misc & Other
  '⚠️': 'Hazard / Warning Sign',
  '🦴': 'Bones / Skeletal Remains',
  '🌊': 'Water Surface / Waves / Coral Reef Area',
  '🚢': 'Ship / Wreckage',
  '⭐': 'Sparkle / Reflection (on water)',
  '🥶': 'Cold Area / Freezing Effect', // from snow_patch scatter
  
  // Specific Player Icons (Can be overridden for context)
  '🧍': 'Player / Humanoid Figure',
  
  // Default/Generic - if an icon isn't specifically mapped
  '?': 'Unknown Feature / Object',
};
