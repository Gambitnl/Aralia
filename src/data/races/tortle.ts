/**
 * @file tortle.ts
 * Defines the Tortle race.
 */
import { Race } from '../../types';

export const TORTLE_DATA: Race = {
  id: 'tortle',
  name: 'Tortle',
  baseRace: 'beastfolk',
  description:
    'Tortles are turtle-like humanoids who carry their homes on their backs and favor a nomadic, resilient lifestyle.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium or Small',
    'Speed: 30 feet',
    'Claws: Your claws deal 1d6 + Strength modifier slashing damage when you hit with an unarmed strike.',
    'Hold Breath: You can hold your breath for up to 1 hour.',
    'Natural Armor (Tortle): Your shell grants you a base AC of 17; you can still gain the benefit of a shield but not wear armor.',
    'Shell Defense: As an action, you can withdraw into your shell to gain +4 bonus to AC and advantage on Strength and Constitution saves until you emerge.',
  ],
  visual: {
    id: 'tortle',
    color: '#2e8b57',
    maleIllustrationPath: 'assets/images/races/Tortle_Male.png',
    femaleIllustrationPath: 'assets/images/races/Tortle_Female.png',
  },
};
