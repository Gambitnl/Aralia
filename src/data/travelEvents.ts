/**
 * @file src/data/travelEvents.ts
 *
 * Travel event definitions for the procedural exploration system.
 *
 * This file was recreated because PR #296 (feat(exploration): Add procedural travel event system)
 * claimed to create it but the file was never actually committed.
 *
 * Events are organized by biome type. When the player travels through a biome,
 * the travelEventService randomly selects from:
 * 1. Biome-specific events (if the biome matches)
 * 2. General events (always available as fallback)
 *
 * Event types:
 * - Flavor events: Just descriptive text, no gameplay effect
 * - Delay events: Add travel time (effect.type === 'delay', amount in minutes)
 *
 * To add new events:
 * 1. Add to the appropriate biome array, or 'general' for universal events
 * 2. Use unique id format: '{biome}_{description}'
 * 3. Optionally add effect for gameplay impact
 * 4. Optionally add weight to adjust probability (default: 1)
 */

import { BiomeEventMap } from '../types/exploration';

export const TRAVEL_EVENTS: BiomeEventMap = {
  forest: [
    {
      id: 'forest_fallen_tree',
      description: 'A massive fallen tree blocks the path ahead. You must carefully navigate around it.',
      effect: { type: 'delay', amount: 5 }
    },
    {
      id: 'forest_deer_sighting',
      description: 'A majestic deer watches you from a clearing before bounding away into the undergrowth.',
    },
    {
      id: 'forest_mushroom_circle',
      description: 'You stumble upon a circle of unusually colorful mushrooms. Local folklore warns against disturbing such rings.',
    },
    {
      id: 'forest_ancient_tree',
      description: 'An ancient tree towers above the canopy, its trunk wider than a house. Carvings of forgotten symbols mark its bark.',
    },
    {
      id: 'forest_stream_crossing',
      description: 'A swift stream cuts across your path. The stones are slippery but crossable.',
      effect: { type: 'delay', amount: 3 }
    }
  ],
  mountain: [
    {
      id: 'mountain_loose_rocks',
      description: 'The path becomes treacherous with loose rocks. You proceed with extra caution.',
      effect: { type: 'delay', amount: 10 }
    },
    {
      id: 'mountain_eagle_cry',
      description: 'An eagle cries overhead, circling on thermal currents high above the peaks.',
    },
    {
      id: 'mountain_cave_entrance',
      description: 'You notice a dark cave entrance partially hidden by rocky outcroppings. Who knows what lies within.',
    },
    {
      id: 'mountain_mountain_spring',
      description: 'Crystal-clear water bubbles up from a mountain spring. The water is cold and refreshing.',
    },
    {
      id: 'mountain_thin_air',
      description: 'The air grows thin as you climb higher. Your pace slows as you adjust to the altitude.',
      effect: { type: 'delay', amount: 5 }
    }
  ],
  swamp: [
    {
      id: 'swamp_quicksand',
      description: 'The ground beneath your feet begins to give way! You barely escape a patch of quicksand.',
      effect: { type: 'delay', amount: 8 }
    },
    {
      id: 'swamp_will_o_wisp',
      description: 'Ethereal lights dance between the twisted trees. Will-o-wisps, or something else entirely?',
    },
    {
      id: 'swamp_foul_smell',
      description: 'A terrible stench rises from a bubbling pool of murky water. You hurry past, covering your nose.',
    },
    {
      id: 'swamp_ancient_ruin',
      description: 'Stone pillars rise from the muck - remnants of some long-forgotten structure now swallowed by the swamp.',
    },
    {
      id: 'swamp_difficult_terrain',
      description: 'The muck and tangled roots make every step a struggle.',
      effect: { type: 'delay', amount: 7 }
    }
  ],
  plains: [
    {
      id: 'plains_grazing_herd',
      description: 'A herd of wild horses grazes peacefully in the distance, their manes flowing in the wind.',
    },
    {
      id: 'plains_wildflowers',
      description: 'Fields of colorful wildflowers stretch to the horizon, swaying gently in the breeze.',
    },
    {
      id: 'plains_old_road',
      description: 'You discover traces of an old road, now mostly reclaimed by grass. It seems to head in your general direction.',
    },
    {
      id: 'plains_hawk_hunting',
      description: 'A hawk dives from the sky, snatching something from the tall grass before soaring away.',
    }
  ],
  desert: [
    {
      id: 'desert_sandstorm',
      description: 'A wall of sand approaches on the horizon. You hunker down and wait for the storm to pass.',
      effect: { type: 'delay', amount: 15 }
    },
    {
      id: 'desert_oasis_mirage',
      description: 'Shimmering in the distance, an oasis beckons - but as you approach, it fades away. Just a mirage.',
    },
    {
      id: 'desert_ancient_bones',
      description: 'Bleached bones of some massive creature protrude from the sand, half-buried by time.',
    },
    {
      id: 'desert_scorpion_nest',
      description: 'You narrowly avoid stepping on a nest of desert scorpions hidden beneath a rock.',
    }
  ],
  general: [
    {
      id: 'general_weather_change',
      description: 'The weather shifts unexpectedly. Clouds gather on the horizon.',
    },
    {
      id: 'general_old_campsite',
      description: 'You come across an abandoned campsite. The ashes are cold, but recent.',
    },
    {
      id: 'general_strange_tracks',
      description: 'Unusual tracks cross your path. Whatever made them was large and moving quickly.',
    },
    {
      id: 'general_beautiful_view',
      description: 'You pause to take in a breathtaking view of the surrounding landscape.',
    },
    {
      id: 'general_lost_item',
      description: 'Something glints in the undergrowth - a lost trinket, perhaps dropped by a previous traveler.',
    },
    {
      id: 'general_bird_song',
      description: 'The melodious song of an unseen bird accompanies your journey.',
    }
  ]
};
