/**
 * @file loxodon.ts
 * Defines the Loxodon race.
 */
import { Race } from '../../types';

export const LOXODON_DATA: Race = {
  id: 'loxodon',
  name: 'Loxodon',
  baseRace: 'beastfolk',
  description:
    'Loxodon are elephant-like humanoids from Ravnica, noted for their calm demeanor, strong communities, and unflappable intuition.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Loxodon Serenity: You have advantage on saving throws against being charmed or frightened.',
    'Natural Armor: While not wearing armor, your Armor Class is 12 + your Constitution modifier. You can benefit from a shield.',
    'Trunk: Your trunk can lift objects, open doors, or act as a snorkel with a 5-foot reach and five times your Strength in pounds.',
    'Keen Smell: You have advantage on Wisdom (Perception and Survival) checks that rely on scent.',
  ],
  visual: {
    id: 'loxodon',
    icon: '🐘',
    color: '#7f7f7f',
    maleIllustrationPath: 'assets/images/Placeholder.jpg',
    femaleIllustrationPath: 'assets/images/Placeholder.jpg',
  },
};
