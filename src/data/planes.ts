
import { Plane, PlanarTrait } from '../types/planes';

const FeywildTimeTrait: PlanarTrait = {
  id: 'feywild_time',
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
  }
};
