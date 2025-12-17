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
    },
    {
      id: 'wandering_trader',
      description: 'You meet a wandering trader on the road.',
      weight: 1,
    },
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
    }
  ],
  forest: [
    {
      id: 'fallen_tree',
      description: 'A massive fallen tree blocks the path.',
      effect: { type: 'delay', amount: 1, description: '1 hour delay' },
      weight: 2,
    },
    {
      id: 'mysterious_lights',
      description: 'Strange lights dance in the trees, leading you astray.',
      effect: { type: 'delay', amount: 3, description: '3 hour delay' },
      weight: 1,
    },
  ],
  mountain: [
    {
      id: 'rockslide',
      description: 'A rockslide blocks the pass.',
      effect: { type: 'delay', amount: 4, description: '4 hour delay' },
      weight: 2,
    },
    {
      id: 'high_winds',
      description: 'High winds make progress slow and dangerous.',
      effect: { type: 'delay', amount: 2, description: '2 hour delay' },
      weight: 2,
    },
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
    },
  ],
  desert: [
    {
      id: 'sandstorm',
      description: 'A blinding sandstorm forces you to halt.',
      effect: { type: 'delay', amount: 6, description: '6 hour delay' },
      weight: 1,
    },
    {
      id: 'heat_exhaustion',
      description: 'The intense heat forces frequent rest breaks.',
      effect: { type: 'delay', amount: 2, description: '2 hour delay' },
      weight: 2,
    },
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
        weight: 1
    },
    {
        id: 'drow_patrol',
        description: 'You spot the purple glow of Drow faerie fire in the distance. You hide in a crevice for hours until they pass.',
        effect: { type: 'delay', amount: 6, description: '6 hour delay' },
        weight: 1
    },
    {
        id: 'bioluminescent_spores',
        description: 'A cloud of glowing spores illuminates a shortcut.',
        effect: { type: 'buff', amount: 0, description: 'Travel speed increased' },
        weight: 2
    }
  ]
};
