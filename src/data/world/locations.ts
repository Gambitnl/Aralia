/**
 * @file src/data/world/locations.ts
 * Defines all location data for the Aralia RPG.
 */
import { Location } from '../../types';

// STARTING_LOCATION_ID is tightly coupled with LOCATIONS definition
export const STARTING_LOCATION_ID = 'clearing';

export const LOCATIONS: Record<string, Location> = {
  'clearing': {
    id: 'clearing',
    name: 'Forest Clearing',
    baseDescription: 'You are in a sun-dappled clearing. Paths lead north, east, south, and a well-trodden one heads west towards Aralia Town Center.',
    exits: { 'North': 'forest_path', 'East': 'ancient_ruins_entrance', 'South': 'hidden_grove', 'West': 'aralia_town_center' },
    itemIds: ['old_map_fragment'],
    biomeId: 'plains',
    gossipLinks: ['aralia_town_center', 'forest_path', 'ancient_ruins_entrance'],
  },
  'aralia_town_center': {
    id: 'aralia_town_center',
    name: 'Aralia Town Center',
    baseDescription: 'The bustling heart of Aralia. Market stalls, a central fountain, and various townsfolk fill the square. Paths lead outward from here. The main road east leads back to the forest clearing.',
    exits: { 'East': 'clearing' /* Add more exits as town expands */ },
    // itemIds: [], // Example: Could have a 'notice_board_flyer'
    biomeId: 'plains', // Or a new 'settlement' biome if desired
    dynamicNpcConfig: {
      possibleNpcIds: ['villager_generic', 'merchant_generic', 'guard_generic'],
      maxSpawnCount: 3,
      baseSpawnChance: 0.95, // 95% chance to spawn dynamic NPCs
    },
    gossipLinks: ['clearing'],
  },
  'forest_path': {
    id: 'forest_path',
    name: 'Winding Forest Path',
    baseDescription: 'A narrow path winds through dense trees. The air is cool and smells of pine. You can go south back to the clearing or continue north deeper into the woods.',
    exits: { 'South': 'clearing', 'North': 'dark_woods' },
    npcIds: ['nervous_scout'],
    biomeId: 'forest',
    gossipLinks: ['clearing', 'dark_woods'],
  },
  'dark_woods': {
    id: 'dark_woods',
    name: 'Dark Woods',
    baseDescription: 'The trees here are tall and block out most of the light. Strange sounds echo around you. The path continues north, or you can return south.',
    exits: { 'South': 'forest_path', 'North': 'cave_entrance' },
    itemIds: ['rusty_sword'],
    biomeId: 'forest',
  },
  'ancient_ruins_entrance': {
    id: 'ancient_ruins_entrance',
    name: 'Entrance to Ancient Ruins',
    baseDescription: 'Before you stands a crumbling stone archway, hinting at forgotten structures beyond. A path leads west back to the clearing. The air here feels heavy.',
    exits: { 'West': 'clearing', 'East': 'ruins_courtyard' },
    biomeId: 'hills', 
  },
  'ruins_courtyard': {
    id: 'ruins_courtyard',
    name: 'Ruins Courtyard',
    baseDescription: 'A dilapidated courtyard, overgrown with vines. Broken statues lie scattered. Passages lead west and deeper into the ruins to the east.',
    exits: { 'West': 'ancient_ruins_entrance', 'East': 'ruins_library' },
    itemIds: ['shiny_coin'],
    npcIds: ['old_hermit'],
    biomeId: 'hills',
  },
  'ruins_library': {
    id: 'ruins_library',
    name: 'Ruined Library',
    baseDescription: 'This was once a library. Rotten shelves and tattered books are everywhere. A faint magical energy lingers. You can return west.',
    exits: { 'West': 'ruins_courtyard' },
    biomeId: 'hills',
  },
  'hidden_grove': {
    id: 'hidden_grove',
    name: 'Hidden Grove',
    baseDescription: 'A secluded, peaceful grove with a small, clear pond. Fireflies dance in the air. A path leads north back to the clearing.',
    exits: { 'North': 'clearing' },
    itemIds: ['healing_potion'],
    biomeId: 'forest',
  },
  'cave_entrance': {
    id: 'cave_entrance',
    name: 'Cave Entrance',
    baseDescription: 'A dark cave mouth gapes in the side of a rocky hill. A chill emanates from within. You can go south back into the woods or venture into the cave.',
    exits: { 'South': 'dark_woods', 'East': 'cave_tunnel' },
    interactableFeatures: [
      {
        id: 'cave-entrance-lock',
        type: 'lock',
        label: 'Open Cave Entrance Lock',
        lock: {
          id: 'lock-cave-entrance',
          dc: 14,
          breakDC: 20,
          isLocked: true,
          isBroken: false,
          isTrapped: true,
          trap: {
            id: 'trap-poison-mist',
            name: 'Poison Mist Spray',
            detectionDC: 12,
            disarmDC: 14,
            triggerCondition: 'interaction',
            effect: { damage: { count: 1, sides: 6, bonus: 0 }, damageType: 'poison' },
            resetable: false,
            isDisarmed: false,
            isTriggered: false,
          },
        },
      },
    ],
    biomeId: 'mountain',
  },
  'cave_tunnel': {
    id: 'cave_tunnel',
    name: 'Dark Cave Tunnel',
    baseDescription: 'The tunnel is damp and narrow. Water drips from the ceiling. It continues east, or you can go west to exit.',
    exits: { 'West': 'cave_entrance', 'East': 'cave_chamber' },
    biomeId: 'mountain',
  },
  'cave_chamber': {
    id: 'cave_chamber',
    name: 'Echoing Cave Chamber',
    baseDescription: 'A large chamber opens up. The sound of dripping water echoes. There might be something valuable here, or dangerous.',
    exits: { 'West': 'cave_tunnel' },
    interactableFeatures: [
      {
        id: 'moon-gate-riddle',
        type: 'puzzle',
        label: 'Study Moon Gate Riddle',
        puzzle: {
          id: 'puzzle-moon-gate',
          name: 'Moon Gate Riddle',
          type: 'riddle',
          description: 'A silver door asks what grows brighter in darkness.',
          hint: 'Think about moonlight.',
          hintDC: 12,
          acceptedAnswers: ['moon'],
          isSolved: false,
          isFailed: false,
          currentAttempts: 0,
          currentInputSequence: [],
          onSuccess: { message: 'The moon gate opens.' },
          onFailure: { message: 'The silver door remains shut.' },
        },
      },
    ],
    biomeId: 'mountain',
  },
};
