
/**
 * @file src/data/travelEvents.ts
 *
 * Travel event definitions mapped by biome.
 * Used by src/services/travelEventService.ts to generate random encounters during world travel.
 *
 * Each event can have:
 * - A descriptive string
 * - A 'delay' effect (in hours)
 * - A 'weight' for probability (default 1)
 * - Optional skill checks for interactive resolution
 */

import { BiomeEventMap } from '../types/exploration';

export const TRAVEL_EVENTS: BiomeEventMap = {
  general: [
    {
      id: 'fine_weather',
      description: 'The weather is clear and travel is easy.',
      effect: { type: 'buff', amount: 0, description: 'No delay' },
      weight: 3,
    },
    {
      id: 'minor_storm',
      description: 'A sudden storm forces you to seek shelter for a few hours.',
      effect: { type: 'delay', amount: 2, description: '2 hour delay' },
      weight: 1,
      skillCheck: {
        check: { skill: 'survival', dc: 12 },
        successEffect: { type: 'delay', amount: 0, description: 'You found a dry cave and waited it out comfortably.' },
        successDescription: 'You spot a dry cave just before the rain hits! (Survival Success)',
        failureDescription: 'You fail to find shelter in time and are soaked. (Survival Fail)'
      }
    },
    {
      id: 'wandering_trader',
      description: 'You meet a wandering trader on the road.',
      weight: 1,
    },
    {
      id: 'found_coins',
      description: 'You spot a small pouch dropped by a previous traveler.',
      effect: { type: 'gold_gain', amount: 5, description: 'Found 5 Gold' },
      weight: 1,
      skillCheck: {
        check: { skill: 'investigation', dc: 13 },
        successEffect: { type: 'gold_gain', amount: 15, description: 'Found 15 Gold' },
        successDescription: 'You notice the pouch has a hidden compartment with more coins! (Investigation Success)',
        failureEffect: { type: 'gold_gain', amount: 5, description: 'Found 5 Gold' }, // Default behavior
        failureDescription: 'You check the pouch but find nothing else.'
      }
    }
  ],
  plains: [
    {
        id: 'wild_horses',
        description: 'A herd of wild horses gallops past.',
        weight: 2
    },
    {
        id: 'merchant_caravan',
        description: 'You encounter a merchant caravan and exchange news.',
        weight: 1
    },
    {
        id: 'herb_patch',
        description: 'You spot a patch of medicinal herbs swaying in the breeze.',
        effect: { type: 'item_gain', amount: 2, itemId: 'wild_herbs', description: 'Harvested Wild Herbs x2' },
        weight: 2,
        skillCheck: {
            check: { skill: 'nature', dc: 14 },
            successEffect: { type: 'item_gain', amount: 4, itemId: 'wild_herbs', description: 'Harvested Wild Herbs x4' },
            successDescription: 'You recognize the rare variants in the center of the patch. (Nature Success)',
            failureDescription: 'You harvest what you can identify.'
        }
    },
    {
        id: 'berry_bushes',
        description: 'You find a thicket of ripe berry bushes.',
        effect: { type: 'item_gain', amount: 1, itemId: 'healing_potion', description: 'Found herbal ingredients (Potions)' }, // Simulating finding components/potions
        weight: 1
    }
  ],
  forest: [
    {
      id: 'fallen_tree',
      description: 'A massive fallen tree blocks the path.',
      effect: { type: 'delay', amount: 1, description: '1 hour delay' },
      weight: 2,
      skillCheck: {
        check: { skill: 'athletics', dc: 13 },
        successEffect: { type: 'delay', amount: 0, description: 'No delay' },
        successDescription: 'You easily vault over the blockage, keeping your pace. (Athletics Success)',
        failureDescription: 'It takes time to scramble over the tangled branches.'
      }
    },
    {
      id: 'mysterious_lights',
      description: 'Strange lights dance in the trees, leading you astray.',
      effect: { type: 'delay', amount: 3, description: '3 hour delay' },
      weight: 1,
      skillCheck: {
        check: { skill: 'arcana', dc: 14 },
        successEffect: { type: 'xp_gain', amount: 25, description: 'Gained 25 XP' },
        successDescription: 'You recognize them as harmless will-o\'-wisps and observe them for study. (Arcana Success)',
        failureDescription: 'You follow them in circles for hours. (Arcana Fail)'
      }
    },
    {
      id: 'thorny_thicket',
      description: 'You are forced to push through a dense wall of thorns, scratching everyone.',
      effect: { type: 'health_change', amount: -2, description: 'Took 2 damage' },
      weight: 1,
      skillCheck: {
        check: { skill: 'survival', dc: 12 },
        successEffect: { type: 'delay', amount: 1, description: '1 hour delay' }, // Trade damage for small delay
        successDescription: 'You find a game trail that bypasses the worst of it, though it takes a bit longer. (Survival Success)',
        failureDescription: 'You have no choice but to force your way through.'
      }
    },
    {
      id: 'healing_spring',
      description: 'You discover a crystal-clear spring that invigorates your spirit.',
      effect: { type: 'health_change', amount: 5, description: 'Healed 5 HP' },
      weight: 1,
    },
    {
      id: 'rare_fungi',
      description: 'A patch of bioluminescent fungi grows on a rotting stump.',
      effect: { type: 'item_gain', amount: 1, itemId: 'glowing_moss', description: 'Harvested Glowing Moss' },
      weight: 1
    }
  ],
  mountain: [
    {
      id: 'rockslide',
      description: 'A rockslide blocks the pass.',
      effect: { type: 'delay', amount: 4, description: '4 hour delay' },
      weight: 2,
      skillCheck: {
          check: { skill: 'athletics', dc: 15 },
          successEffect: { type: 'delay', amount: 1, description: '1 hour delay' },
          successDescription: 'Your team manages to clear enough debris to squeeze through quickly. (Athletics Success)',
          failureDescription: 'You have to backtrack and find a way around.'
      }
    },
    {
      id: 'high_winds',
      description: 'High winds make progress slow and dangerous.',
      effect: { type: 'delay', amount: 2, description: '2 hour delay' },
      weight: 2,
    },
    {
      id: 'falling_rocks',
      description: 'Loose rocks tumble down the cliff face!',
      effect: { type: 'health_change', amount: -5, description: 'Took 5 damage' },
      weight: 1,
      skillCheck: {
          check: { skill: 'perception', dc: 14 },
          successEffect: { type: 'delay', amount: 0, description: 'Dodged!' },
          successDescription: 'You spot the tumbling rocks in time and shout a warning! (Perception Success)',
          failureDescription: 'The rocks catch you by surprise.'
      }
    },
    {
      id: 'iron_vein',
      description: 'A surface vein of iron ore is exposed near the path.',
      effect: { type: 'item_gain', amount: 2, itemId: 'iron_ore', description: 'Mined Iron Ore x2' },
      weight: 1
    },
    {
      id: 'exposed_silver',
      description: 'Gleaming silver catches your eye in a ravine wall.',
      effect: { type: 'item_gain', amount: 1, itemId: 'silver_ore', description: 'Mined Silver Ore' },
      weight: 0.5
    }
  ],
  swamp: [
    {
      id: 'thick_fog',
      description: 'Thick fog rolls in, obscuring the path.',
      effect: { type: 'delay', amount: 2, description: '2 hour delay' },
      weight: 2,
    },
    {
      id: 'stuck_in_mud',
      description: 'The cart gets stuck in deep mud.',
      effect: { type: 'delay', amount: 3, description: '3 hour delay' },
      weight: 1,
      skillCheck: {
          check: { skill: 'animal_handling', dc: 13 },
          successEffect: { type: 'delay', amount: 1, description: '1 hour delay' },
          successDescription: 'You calm the beasts and guide them firmly to firmer ground. (Animal Handling Success)',
          failureDescription: 'It takes hours of digging to free the wheels.'
      }
    },
    {
      id: 'leech_infested_waters',
      description: 'You have to wade through leech-infested waters.',
      effect: { type: 'health_change', amount: -3, description: 'Took 3 damage' },
      weight: 1,
      skillCheck: {
          check: { skill: 'medicine', dc: 12 },
          successEffect: { type: 'health_change', amount: -1, description: 'Took 1 damage' },
          successDescription: 'You carefully remove the leeches before they do serious harm. (Medicine Success)',
          failureDescription: 'They latch on tight.'
      }
    },
    {
      id: 'venomous_remains',
      description: 'You find the remains of a venomous beast.',
      effect: { type: 'item_gain', amount: 1, itemId: 'monster_venom', description: 'Harvested Monster Venom' },
      weight: 1
    }
  ],
  desert: [
    {
      id: 'sandstorm',
      description: 'A blinding sandstorm forces you to halt.',
      effect: { type: 'delay', amount: 6, description: '6 hour delay' },
      weight: 1,
      skillCheck: {
          check: { skill: 'survival', dc: 15 },
          successEffect: { type: 'delay', amount: 2, description: '2 hour delay' },
          successDescription: 'You quickly construct a makeshift shelter against a dune. (Survival Success)',
          failureDescription: 'You are forced to huddle and wait it out, buried in sand.'
      }
    },
    {
      id: 'heat_exhaustion',
      description: 'The intense heat forces frequent rest breaks.',
      effect: { type: 'delay', amount: 2, description: '2 hour delay' },
      weight: 2,
      skillCheck: {
        check: { skill: 'nature', dc: 12 },
        successEffect: { type: 'delay', amount: 1, description: '1 hour delay' },
        successDescription: 'You know which plants contain cooling sap to apply to your skin. (Nature Success)',
        failureDescription: 'The heat is relentless.'
      }
    },
    {
      id: 'sun_scorch',
      description: 'The relentless sun blisters your skin.',
      effect: { type: 'health_change', amount: -4, description: 'Took 4 damage' },
      weight: 1,
    },
    {
      id: 'oasis',
      description: 'You stumble upon a hidden oasis.',
      effect: { type: 'health_change', amount: 10, description: 'Healed 10 HP' },
      weight: 0.5,
    },
    {
      id: 'rare_bloom',
      description: 'A vibrant desert flower blooms in the shadow of a dune.',
      effect: { type: 'item_gain', amount: 1, itemId: 'desert_flower', description: 'Harvested Desert Flower' },
      weight: 1
    }
  ],
  underdark: [
    {
        id: 'absolute_darkness',
        description: 'Your light source flickers and dies. The crushing weight of absolute darkness halts your progress until you can relight it.',
        effect: { type: 'delay', amount: 4, description: '4 hour delay' },
        weight: 3
    },
    {
        id: 'faerzress_pocket',
        description: 'You stumble into a pocket of Faerzress (magical radiation). Visions of alien cities flood your mind.',
        effect: { type: 'delay', amount: 2, description: '2 hour delay, Wisdom save required (flavor)' },
        weight: 1,
        skillCheck: {
            check: { skill: 'arcana', dc: 15 },
            successEffect: { type: 'xp_gain', amount: 50, description: 'Gained 50 XP' },
            successDescription: 'You channel the chaotic magic, gaining insight into the weave. (Arcana Success)',
            failureDescription: 'The visions leave you disoriented and lost.'
        }
    },
    {
        id: 'drow_patrol',
        description: 'You spot the purple glow of Drow faerie fire in the distance. You hide in a crevice for hours until they pass.',
        effect: { type: 'delay', amount: 6, description: '6 hour delay' },
        weight: 1,
        skillCheck: {
            check: { skill: 'stealth', dc: 14 },
            successEffect: { type: 'delay', amount: 2, description: '2 hour delay' },
            successDescription: 'You slip past them like a shadow, moving while they are distracted. (Stealth Success)',
            failureDescription: 'You are forced to wait, barely breathing, until they are long gone.'
        }
    },
    {
        id: 'bioluminescent_spores',
        description: 'A cloud of glowing spores illuminates a shortcut.',
        effect: { type: 'buff', amount: 0, description: 'Travel speed increased' },
        weight: 2
    },
    {
        id: 'hook_horror_ambush',
        description: 'A Hook Horror drops from the ceiling!',
        effect: { type: 'health_change', amount: -8, description: 'Took 8 damage' },
        weight: 0.5,
        skillCheck: {
            check: { skill: 'perception', dc: 16 },
            successEffect: { type: 'health_change', amount: 0, description: 'Dodged!' },
            successDescription: 'You hear the scraping of claws above and dive away just in time! (Perception Success)',
            failureDescription: 'It lands on you before you can react.'
        }
    },
    {
        id: 'mithral_vein',
        description: 'A rare vein of mithral sparkles in the torchlight.',
        effect: { type: 'item_gain', amount: 1, itemId: 'silver_ore', description: 'Mined Silver Ore (Mithral substitute)' },
        weight: 0.2
    }
  ]
};
