
import { Plane, PlanarTrait } from '../types/planes';

const FeywildTimeTrait: PlanarTrait = {
  id: 'time_warp',
  name: 'Timeless',
  type: 'time',
  description: 'Time flows strangely here. A day in the Feywild might be a minute or a year in the Material Plane.',
  mechanics: 'Long rests feel instant but might pass days in the material world.'
};

const FeywildMagicTrait: PlanarTrait = {
  id: 'feywild_magic',
  name: 'Wild Magic',
  type: 'magic',
  description: 'Magic is amplified and unpredictable.',
  mechanics: 'Illusion and Enchantment spells are cast as if one level higher.'
};

const ShadowfellDespairTrait: PlanarTrait = {
  id: 'shadowfell_despair',
  name: 'Shadowfell Despair',
  type: 'environmental',
  description: 'A weighing melancholy that saps the will to live.',
  mechanics: 'Wisdom saving throws at disadvantage. Long rests require a Wisdom save to gain benefits.'
};

const PsychicStaticTrait: PlanarTrait = {
  id: 'psychic_static',
  name: 'Psychic Static',
  type: 'environmental',
  description: 'The chaos of this plane assaults the mind.',
  mechanics: 'Take 1d4 psychic damage every minute.'
};

const PervasiveEvilTrait: PlanarTrait = {
  id: 'pervasive_evil',
  name: 'Pervasive Evil',
  type: 'alignment',
  description: 'The very land is infused with tyranny and malice.',
  mechanics: 'Good-aligned creatures feel a constant spiritual weight.'
};

export const PLANES: Record<string, Plane> = {
  material: {
    id: 'material',
    name: 'Material Plane',
    description: 'The nexus of the multiverse, where worlds exist in balance.',
    traits: [],
    natives: ['Humanoid', 'Beast', 'Monstrosity'],
    hazards: [],
    emotionalValence: 'neutral',
    timeFlow: 'normal',
    effects: {},
    atmosphereDescription: "The air feels stable and familiar."
  },
  feywild: {
    id: 'feywild',
    name: 'The Feywild',
    description: 'A place of unrestrained nature and emotion, an echo of the Material Plane.',
    traits: [FeywildTimeTrait, FeywildMagicTrait],
    natives: ['Fey', 'Elf', 'Satyr', 'Hag'],
    hazards: [
      {
        name: 'Memory Loss',
        description: 'Visitors may forget their time here upon leaving.',
        saveDC: 15
      }
    ],
    emotionalValence: 'chaotic',
    timeFlow: 'erratic',
    atmosphereDescription: "Colors seem more vivid here, and the air hums with an unseen melody. Your emotions feel closer to the surface.",
    effects: {
      affectsMagic: [
        {
          school: 'Illusion',
          effect: 'empowered',
          description: 'Illusion spells are more potent.'
        },
        {
          school: 'Enchantment',
          effect: 'empowered',
          description: 'Enchantment spells are more potent.'
        }
      ]
    }
  },
  shadowfell: {
    id: 'shadowfell',
    name: 'The Shadowfell',
    description: 'A dark echo of the Material Plane, a place of decay and death.',
    traits: [ShadowfellDespairTrait],
    natives: ['Undead', 'Shadar-kai', 'Shadow'],
    hazards: [
      {
        name: 'Gloom',
        description: 'Non-magical light sources illuminate half as far.',
        saveDC: 0
      }
    ],
    emotionalValence: 'negative',
    timeFlow: 'normal', // Usually normal but gloomy
    atmosphereDescription: "The world is drained of color, appearing in shades of gray. A heavy gloom weighs on your spirit, making every step feel like a chore.",
    effects: {
      affectsMagic: [
        {
          school: 'Necromancy',
          effect: 'empowered',
          description: 'Necromancy spells are more potent.'
        },
        {
          school: 'Evocation', // specifically light
          effect: 'impeded',
          description: 'Light spells are dimmed.'
        }
      ],
      affectsRest: {
        shortRestAllowed: true,
        longRestAllowed: true,
        effects: ['Must succeed on DC 15 Wisdom save to gain Long Rest benefits']
      }
    }
  },
  nine_hells: {
    id: 'nine_hells',
    name: 'The Nine Hells',
    description: 'A plane of rigid order, tyranny, and fire, ruled by devils.',
    alignment: 'Lawful Evil',
    traits: [PervasiveEvilTrait],
    natives: ['Devil', 'Imp', 'Tiefling'],
    hazards: [
      {
        name: 'Infernal Heat',
        description: 'The heat is oppressive and drains vitality.',
        saveDC: 10,
        damage: '1d4 fire', // Example implementation
        effect: 'exhaustion'
      }
    ],
    emotionalValence: 'negative',
    timeFlow: 'normal',
    atmosphereDescription: "The air smells of brimstone and burning iron. The heat is oppressive, and a sense of rigid, malicious order permeates everything.",
    effects: {
      affectsMagic: [
        {
          school: 'Evocation', // Fire spells
          effect: 'empowered',
          description: 'Fire spells burn hotter here.'
        },
        {
          school: 'Divination',
          effect: 'impeded',
          description: 'The gods have difficulty seeing into this realm.'
        }
      ]
    }
  },
  abyss: {
    id: 'abyss',
    name: 'The Abyss',
    description: 'Infinite layers of chaos and evil, home to demons.',
    alignment: 'Chaotic Evil',
    traits: [PsychicStaticTrait],
    natives: ['Demon'],
    hazards: [
      {
        name: 'Corrupting Chaos',
        description: 'The plane warps the mind and body.',
        saveDC: 15,
        damage: '1d4 psychic'
      }
    ],
    emotionalValence: 'chaotic',
    timeFlow: 'normal',
    atmosphereDescription: "The air tastes of copper and sulfur. Distant screams echo constantly, and the geometry of the world feels wrong.",
    effects: {
      psychicDamagePerMinute: 3 // Average of 1d4 approx, simplified
    }
  },
  ethereal: {
    id: 'ethereal',
    name: 'The Ethereal Plane',
    description: 'A misty realm that overlaps the Material Plane, used for travel between worlds.',
    traits: [],
    natives: ['Ghost', 'Phase Spider'],
    hazards: [],
    emotionalValence: 'neutral',
    timeFlow: 'normal',
    atmosphereDescription: "Everything appears shrouded in silvery mist. The Material Plane is visible but distant and muted.",
    effects: {}
  },
  astral: {
    id: 'astral',
    name: 'The Astral Plane',
    description: 'A silvery void connecting all planes, where thoughts become reality.',
    traits: [],
    natives: ['Githyanki', 'Astral Dreadnought'],
    hazards: [],
    emotionalValence: 'neutral',
    timeFlow: 'timeless',
    atmosphereDescription: "An endless silver expanse. Color pools dot the void, each a portal to another plane.",
    effects: {}
  },
  elemental_fire: {
    id: 'elemental_fire',
    name: 'Elemental Plane of Fire',
    description: 'A realm of burning heat and flames that sustain no mortal life.',
    traits: [],
    natives: ['Fire Elemental', 'Efreeti', 'Salamander'],
    hazards: [
      {
        name: 'Extreme Heat',
        description: 'The plane itself burns all mortal flesh.',
        saveDC: 15,
        damage: '1d10 fire'
      }
    ],
    emotionalValence: 'chaotic',
    timeFlow: 'normal',
    atmosphereDescription: "Rivers of lava flow beneath skies of flame. The heat is unrelenting.",
    effects: {}
  },
  elemental_water: {
    id: 'elemental_water',
    name: 'Elemental Plane of Water',
    description: 'An endless ocean with no surface, where light filters through impossible depths.',
    traits: [],
    natives: ['Water Elemental', 'Marid', 'Sea Elf'],
    hazards: [
      {
        name: 'Crushing Depths',
        description: 'Pressure increases as you descend.',
        saveDC: 10
      }
    ],
    emotionalValence: 'neutral',
    timeFlow: 'normal',
    atmosphereDescription: "Water in every direction, with bioluminescent creatures providing distant light.",
    effects: {}
  },
  mechanus: {
    id: 'mechanus',
    name: 'Mechanus',
    description: 'The plane of absolute law, made of interlocking gears and clockwork precision.',
    alignment: 'Lawful Neutral',
    traits: [],
    natives: ['Modron', 'Inevitable'],
    hazards: [],
    emotionalValence: 'neutral',
    timeFlow: 'normal',
    atmosphereDescription: "Infinite interlocking gears turn in perfect harmony. Everything here follows an exact schedule.",
    effects: {}
  },
  limbo: {
    id: 'limbo',
    name: 'Limbo',
    description: 'A plane of pure chaos where reality is shaped by will alone.',
    alignment: 'Chaotic Neutral',
    traits: [PsychicStaticTrait],
    natives: ['Slaad', 'Githzerai'],
    hazards: [
      {
        name: 'Unstable Reality',
        description: 'The plane shifts constantly without conscious control.',
        saveDC: 15
      }
    ],
    emotionalValence: 'chaotic',
    timeFlow: 'erratic',
    atmosphereDescription: "Reality churns and shifts. Solid ground may become water or fire without warning.",
    effects: {}
  },
  mount_celestia: {
    id: 'mount_celestia',
    name: 'Mount Celestia',
    description: 'The realm of law and good, a mountain rising through seven heavenly layers.',
    alignment: 'Lawful Good',
    traits: [],
    natives: ['Angel', 'Archon'],
    hazards: [],
    emotionalValence: 'positive',
    timeFlow: 'normal',
    atmosphereDescription: "Golden light bathes a majestic mountain. Peace and order flow from every stone.",
    effects: {}
  }
};
