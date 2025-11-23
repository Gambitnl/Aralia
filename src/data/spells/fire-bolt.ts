import { Spell } from '../../types';

export const FIRE_BOLT: Spell = {
  id: 'fire-bolt',
  name: 'Fire Bolt',
  level: 0,
  school: 'Evocation',
  castingTime: '1 Action',
  range: '120 feet',
  components: {
    verbal: true,
    somatic: true,
    material: false,
  },
  duration: 'Instantaneous',
  description: "You hurl a mote of fire at a creature or an object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 fire damage. A flammable object hit by this spell ignites if it isn't being worn or carried.",
  higherLevelsDescription: "The spell's damage increases by 1d10 when you reach 5th level (2d10), 11th level (3d10), and 17th level (4d10).",
  classes: ['Artificer', 'Sorcerer', 'Warlock', 'Wizard'],
};
