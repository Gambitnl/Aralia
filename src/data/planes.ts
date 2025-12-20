
import { Plane, PlanarTrait, PlanarHazard, PlanarEffect } from '../types/planes';

// -----------------------------------------------------------------------------
// Common Planar Traits
// -----------------------------------------------------------------------------

const TRAIT_MEMORY_LOSS: PlanarTrait = {
  id: 'memory_loss',
  name: 'Memory Loss',
  description: 'Creatures who leave this plane may lose all memory of their time spent here.',
  type: 'memory',
  mechanics: 'DC 15 Wisdom save upon leaving. Failure wipes memories of the visit.'
};

const TRAIT_DESPAIR: PlanarTrait = {
  id: 'despair',
  name: 'Shadowfell Despair',
  description: 'A pervasive melancholy that saps the will to live.',
  type: 'environmental',
  mechanics: 'DC 10 Wisdom save after Long Rest. Failure results in Disadvantage on ability checks/attacks until next Long Rest.'
};

const TRAIT_INFERNAL_HIERARCHY: PlanarTrait = {
  id: 'infernal_hierarchy',
  name: 'Infernal Hierarchy',
  description: 'Devils instantly know the relative rank of all other devils.',
  type: 'alignment',
  mechanics: 'Social checks against Devils have DC based on rank difference.'
};

const TRAIT_WILD_MAGIC: PlanarTrait = {
  id: 'wild_magic',
  name: 'Wild Magic Surge',
  description: 'Magic here is untamed and explosive.',
  type: 'magic',
  mechanics: 'Casting a spell of 1st level or higher triggers a Wild Magic Surge check (d20, on 1 surge happens).'
};

const TRAIT_TIMELESS: PlanarTrait = {
  id: 'timeless',
  name: 'Timeless',
  description: 'Time does not pass for creatures here.',
  type: 'time',
  mechanics: 'Creatures do not age or feel hunger/thirst. Effects occur upon leaving.'
};

const TRAIT_PSYCHIC_WIND: PlanarTrait = {
  id: 'psychic_wind',
  name: 'Psychic Wind',
  description: 'Mental storms that buffet the minds of travelers.',
  type: 'environmental',
  mechanics: 'Random encounters with storms that cause Psychic damage or transport travelers.'
};

// -----------------------------------------------------------------------------
// Plane Definitions
// -----------------------------------------------------------------------------

export const MATERIAL_PLANE: Plane = {
  id: 'material',
  name: 'The Material Plane',
  description: 'The nexus of the multiverse, where elemental forces meet. A world of balance, nature, and civilizations.',
  traits: [],
  natives: ['Humanoid', 'Beast', 'Monstrosity', 'Dragon', 'Giant'],
  hazards: [],
  emotionalValence: 'neutral',
  timeFlow: 'normal',
  atmosphereDescription: 'The air tastes of dust and rain. The sun rises and sets with comforting regularity.',
  alignment: 'Neutral'
};

export const FEYWILD: Plane = {
  id: 'feywild',
  name: 'The Feywild',
  description: 'A place of soft lights, vivid colors, and heightened emotions. The echo of the world created by the Fey.',
  traits: [TRAIT_MEMORY_LOSS],
  natives: ['Fey', 'Elf', 'Giant Owl', 'Blink Dog', 'Satyr'],
  hazards: [
    {
      name: 'Time Warp',
      description: 'Time flows strangely here.',
      saveDC: 0, // Narrative hazard mostly
      effect: 'Time spent may be minutes or years in the Material Plane.'
    }
  ],
  emotionalValence: 'chaotic',
  timeFlow: 'erratic',
  atmosphereDescription: 'The colors are too bright, the shadows too purple. Every emotion feels like a shouting match.',
  alignment: 'Chaotic Neutral',
  effects: {
    affectsMagic: [
      {
        school: 'Illusion',
        effect: 'empowered',
        description: 'Illusion spells last twice as long.'
      },
      {
        school: 'Enchantment',
        effect: 'empowered',
        description: 'Enchantment spells are cast with Advantage on the attack or Disadvantage on the save.'
      }
    ]
  }
};

export const SHADOWFELL: Plane = {
  id: 'shadowfell',
  name: 'The Shadowfell',
  description: 'A desolate, grayscale reflection of the world. A place of decay, death, and memory.',
  traits: [TRAIT_DESPAIR],
  natives: ['Undead', 'Shadar-Kai', 'Shadow Mastiff', 'Darkmantle'],
  hazards: [
    {
      name: 'Gloom',
      description: 'Visibility is reduced.',
      saveDC: 0,
      effect: 'Light sources shed light for only half their normal radius.'
    }
  ],
  emotionalValence: 'negative',
  timeFlow: 'normal',
  atmosphereDescription: 'The air is cold and still. Colors are muted to greys. You feel a weight on your soul.',
  alignment: 'Neutral Evil',
  effects: {
    affectsRest: {
      shortRestAllowed: true,
      longRestAllowed: true,
      effects: ['Despair check required after Long Rest.']
    },
    affectsMortality: {
      deathSavingThrows: 'disadvantage',
      resurrectionPossible: true,
      ghosts: true
    },
    affectsMagic: [
      {
        school: 'Necromancy',
        effect: 'empowered',
        description: 'Necromancy spells roll damage dice twice and take the higher total.'
      },
      {
        school: 'Evocation',
        effect: 'impeded',
        description: 'Spells that create light have their radius halved.'
      }
    ]
  }
};

export const NINE_HELLS: Plane = {
  id: 'nine_hells',
  name: 'The Nine Hells',
  description: 'A plane of rigid order and tyranny, ruled by Devils under the iron fist of Asmodeus.',
  traits: [TRAIT_INFERNAL_HIERARCHY],
  natives: ['Devil', 'Imp', 'Hell Hound'],
  hazards: [
    {
      name: 'River Styx',
      description: 'The river of lost memories.',
      saveDC: 15, // Int save
      effect: 'Total amnesia (Feeblemind effect).'
    },
    {
      name: 'Hellfire',
      description: 'Fire that burns even the soul.',
      saveDC: 15,
      damage: '2d10 fire + 2d10 necrotic'
    }
  ],
  emotionalValence: 'negative',
  timeFlow: 'normal',
  atmosphereDescription: 'The sky is a bruised purple or fiery red. The smell of brimstone is omnipresent.',
  alignment: 'Lawful Evil'
};

export const ASTRAL_PLANE: Plane = {
  id: 'astral_plane',
  name: 'The Astral Plane',
  description: 'The space between the planes. A silvery void where thought is motion.',
  traits: [TRAIT_TIMELESS, TRAIT_PSYCHIC_WIND],
  natives: ['Githyanki', 'Astral Dreadnought'],
  hazards: [],
  emotionalValence: 'neutral',
  timeFlow: 'timeless',
  atmosphereDescription: 'A silver void stretches infinitely. Distant color pools swirl like stars.',
  alignment: 'Neutral',
  effects: {
    affectsRest: {
      shortRestAllowed: true,
      longRestAllowed: false, // You don't get tired? Or cannot sleep? Rules vary, but "Time doesn't pass" usually means no resting benefits for age/hunger.
      effects: ['No aging or hunger.']
    }
  }
};

// -----------------------------------------------------------------------------
// Registry
// -----------------------------------------------------------------------------

export const PLANES: Record<string, Plane> = {
  [MATERIAL_PLANE.id]: MATERIAL_PLANE,
  [FEYWILD.id]: FEYWILD,
  [SHADOWFELL.id]: SHADOWFELL,
  [NINE_HELLS.id]: NINE_HELLS,
  [ASTRAL_PLANE.id]: ASTRAL_PLANE
};

export const getPlane = (id: string): Plane | undefined => PLANES[id];

export const getAllPlanes = (): Plane[] => Object.values(PLANES);
