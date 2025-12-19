
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

const LawfulEvilAlignmentTrait: PlanarTrait = {
  id: 'lawful_evil_alignment',
  name: 'Pervasive Evil',
  type: 'alignment',
  description: 'The plane is imbued with lawful evil energy.',
  mechanics: 'Good-aligned creatures feel a constant sense of dread and unease. Charisma checks to interact with natives have disadvantage for Good creatures.'
};

const ExtremeHeatTrait: PlanarTrait = {
  id: 'extreme_heat',
  name: 'Extreme Heat',
  type: 'environmental',
  description: 'The air is searing hot.',
  mechanics: 'Creatures without resistance or immunity to fire take 1d10 fire damage at the start of every minute.'
};

const TimelessBodyTrait: PlanarTrait = {
  id: 'timeless_body',
  name: 'Timeless Nature',
  type: 'time',
  description: 'Creatures do not age or suffer from hunger/thirst while on this plane.',
  mechanics: 'Aging stops. Natural healing is halted.'
};

const LawfulNeutralAlignmentTrait: PlanarTrait = {
    id: 'lawful_neutral_alignment',
    name: 'Absolute Order',
    type: 'alignment',
    description: 'The plane is driven by clockwork precision.',
    mechanics: 'Damage rolls are always average (rounded down). Randomness is suppressed.'
};

const ChaoticNeutralAlignmentTrait: PlanarTrait = {
    id: 'chaotic_neutral_alignment',
    name: 'Pure Chaos',
    type: 'alignment',
    description: 'Matter and energy are in constant flux.',
    mechanics: 'You must make an Intelligence check to stabilize terrain around you.'
};

const LawfulGoodAlignmentTrait: PlanarTrait = {
    id: 'lawful_good_alignment',
    name: 'Divine Light',
    type: 'alignment',
    description: 'The plane radiates hope and justice.',
    mechanics: 'Good creatures gain temporary HP daily. Evil creatures take radiant damage.'
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
    atmosphereDescription: "The air feels stable and familiar.",
    alignment: 'Unaligned'
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
    alignment: 'Chaotic Neutral',
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
    timeFlow: 'normal',
    atmosphereDescription: "The world is drained of color, appearing in shades of gray. A heavy gloom weighs on your spirit, making every step feel like a chore.",
    alignment: 'Neutral Evil',
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
  ethereal: {
    id: 'ethereal',
    name: 'Ethereal Plane',
    description: 'A misty, fog-bound dimension that overlaps the Material Plane.',
    traits: [],
    natives: ['Ghost', 'Phase Spider'],
    hazards: [],
    emotionalValence: 'neutral',
    timeFlow: 'normal',
    atmosphereDescription: "Swirling mists obscure your vision. The world you left is visible as a muted, translucent echo.",
    alignment: 'Unaligned'
  },
  astral: {
    id: 'astral',
    name: 'Astral Plane',
    description: 'The space between the planes, a silvery void of thought and timelessness.',
    traits: [TimelessBodyTrait],
    natives: ['Githyanki', 'Astral Dreadnought'],
    hazards: [
      {
        name: 'Psychic Wind',
        description: 'Storms of raw thought that can blow travelers off course.',
        saveDC: 15,
        effect: 'Disoriented / Lost'
      }
    ],
    emotionalValence: 'neutral',
    timeFlow: 'timeless',
    atmosphereDescription: "You float in a silvery void. There is no air, yet you breathe. Distant color pools swirl like stars.",
    alignment: 'Unaligned',
    effects: {
      affectsMortality: {
        deathSavingThrows: 'normal',
        resurrectionPossible: true,
        ghosts: true
      },
      affectsRest: {
        shortRestAllowed: true,
        longRestAllowed: false,
        effects: ['Natural healing is suspended.']
      }
    }
  },
  elemental_fire: {
    id: 'elemental_fire',
    name: 'Elemental Plane of Fire',
    description: 'A landscape of burning flame, volcanic ash, and liquid fire.',
    traits: [ExtremeHeatTrait],
    natives: ['Fire Elemental', 'Efreeti', 'Salamander'],
    hazards: [
      {
        name: 'Searing Atmosphere',
        description: 'The air itself burns.',
        saveDC: 0,
        damage: '1d10 fire per minute'
      }
    ],
    emotionalValence: 'chaotic',
    timeFlow: 'normal',
    atmosphereDescription: "The heat is oppressive, singeing your hair and skin. Everything is bright, orange, and constantly moving.",
    alignment: 'Neutral',
    effects: {
       affectsMagic: [
        {
          school: 'Evocation', // Fire spells
          effect: 'empowered',
          description: 'Fire spells deal maximum damage or have increased DC.'
        },
        {
           school: 'Transmutation', // Water/Ice
           effect: 'impeded',
           description: 'Water and ice spells sizzle and evaporate instantly.'
        }
      ]
    }
  },
  elemental_air: {
    id: 'elemental_air',
    name: 'Elemental Plane of Air',
    description: 'An endless sky filled with floating islands and eternal winds.',
    traits: [
        {
            id: 'subjective_gravity',
            name: 'Subjective Gravity',
            type: 'gravity',
            description: 'Gravity pulls in whichever direction you decide is down.',
            mechanics: 'Make an Intelligence check to change your gravity direction.'
        }
    ],
    natives: ['Air Elemental', 'Djinn', 'Invisible Stalker'],
    hazards: [
      {
        name: 'Unending Fall',
        description: 'If you fail to fly or land, you fall forever.',
        saveDC: 0
      }
    ],
    emotionalValence: 'neutral',
    timeFlow: 'normal',
    atmosphereDescription: "A boundless blue sky stretches in all directions. Clouds form islands, and the wind never stops blowing.",
    alignment: 'Neutral',
    effects: {
        affectsMagic: [
             {
                 school: 'Transmutation', // Fly?
                 effect: 'empowered',
                 description: 'Flight magic lasts twice as long.'
             }
        ]
    }
  },
  elemental_water: {
    id: 'elemental_water',
    name: 'Elemental Plane of Water',
    description: 'An endless ocean without surface or floor, filled with currents and life.',
    traits: [],
    natives: ['Water Elemental', 'Marid', 'Kraken'],
    hazards: [
      {
        name: 'Pressure',
        description: 'Deep currents can crush the unprepared.',
        saveDC: 15,
        damage: '1d6 bludgeoning'
      },
      {
          name: 'Drowning',
          description: 'There is no air, only water.',
          saveDC: 0,
          effect: 'Suffocation'
      }
    ],
    emotionalValence: 'neutral',
    timeFlow: 'normal',
    atmosphereDescription: "You are suspended in cool, blue-green water. Light filters from an unknown source. Bubbles drift lazily.",
    alignment: 'Neutral',
    effects: {
         affectsMagic: [
            {
                school: 'Evocation', // Fire
                effect: 'nullified',
                description: 'Fire spells cannot be cast.'
            }
         ]
    }
  },
  elemental_earth: {
    id: 'elemental_earth',
    name: 'Elemental Plane of Earth',
    description: 'An infinite expanse of stone, soil, and ores, crisscrossed by tunnels.',
    traits: [],
    natives: ['Earth Elemental', 'Dao', 'Xorn'],
    hazards: [
      {
        name: 'Cave-in',
        description: 'Unstable tunnels collapse.',
        saveDC: 15,
        damage: '4d6 bludgeoning'
      }
    ],
    emotionalValence: 'neutral',
    timeFlow: 'normal',
    atmosphereDescription: "The scent of dust and minerals is everywhere. It is dark, close, and solid.",
    alignment: 'Neutral',
    effects: {
        affectsMagic: [
            {
                school: 'Transmutation', // Passwall etc
                effect: 'empowered',
                description: 'Earth-shaping magic requires no material components.'
            }
        ]
    }
  },
  nine_hells: {
    id: 'nine_hells',
    name: 'The Nine Hells',
    description: 'Nine layers of lawful evil tyranny, ruled by Asmodeus and his archdevils.',
    traits: [LawfulEvilAlignmentTrait],
    natives: ['Devil', 'Hell Hound', 'Imp'],
    hazards: [
      {
        name: 'Infernal Hierarchy',
        description: 'Orders given by superiors carry magical weight.',
        saveDC: 15,
        effect: 'Charmed (Compelled)'
      }
    ],
    emotionalValence: 'negative',
    timeFlow: 'normal',
    atmosphereDescription: "A reddish hue permeates the sky. The air smells of brimstone and order. Every structure is imposing and severe.",
    alignment: 'Lawful Evil',
    effects: {
      affectsMagic: [
        {
          school: 'Enchantment',
          effect: 'empowered',
          description: 'Spells that compel or dominate are harder to resist.'
        }
      ]
    }
  },
  abyss: {
    id: 'abyss',
    name: 'The Abyss',
    description: 'Infinite layers of chaos and evil, home to demons.',
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
    alignment: 'Chaotic Evil',
    effects: {
      psychicDamagePerMinute: 3
    }
  },
  mechanus: {
    id: 'mechanus',
    name: 'Mechanus',
    description: 'The plane of absolute law, a world of giant interlocking gears.',
    traits: [LawfulNeutralAlignmentTrait],
    natives: ['Modron', 'Inevitable'],
    hazards: [],
    emotionalValence: 'neutral',
    timeFlow: 'normal',
    atmosphereDescription: "The ticking of giant gears is the heartbeat of this world. Everything is perfectly calculated.",
    alignment: 'Lawful Neutral'
  },
  limbo: {
    id: 'limbo',
    name: 'Limbo',
    description: 'A churning soup of matter and energy, shaped by the will of intelligent beings.',
    traits: [ChaoticNeutralAlignmentTrait],
    natives: ['Slaad', 'Githzerai'],
    hazards: [
        {
            name: 'Unstable Terrain',
            description: 'The ground may turn to fire or water beneath you.',
            saveDC: 15,
            damage: '1d10 variable'
        }
    ],
    emotionalValence: 'chaotic',
    timeFlow: 'normal',
    atmosphereDescription: "Gravity shifts, rocks melt into air, and fire freezes. Nothing stays the same for long.",
    alignment: 'Chaotic Neutral'
  },
  mount_celestia: {
    id: 'mount_celestia',
    name: 'Mount Celestia',
    description: 'The seven heavens of goodness and law, a single infinite mountain rising from a silver sea.',
    traits: [LawfulGoodAlignmentTrait],
    natives: ['Angel', 'Archon'],
    hazards: [],
    emotionalValence: 'positive',
    timeFlow: 'normal',
    atmosphereDescription: "The air is sweet and clean. A golden light bathes the mountain slopes. You feel a profound sense of peace.",
    alignment: 'Lawful Good'
  }
};
