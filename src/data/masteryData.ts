/**
 * @file src/data/masteryData.ts
 * Defines the data for weapon mastery properties.
 */
import { Mastery } from '../types';

export const MASTERY_DATA: Record<string, Mastery> = {
  Slow: { id: 'Slow', name: 'Slow', description: "On hit, you can reduce the target's Speed by 10 feet until the start of your next turn." },
  Nick: { id: 'Nick', name: 'Nick', description: 'When you attack with this Light weapon, you can make one extra attack with a different Light weapon as part of the same action (not a Bonus Action). This can be done once per turn.' },
  Push: { id: 'Push', name: 'Push', description: 'On hit, you can push the target up to 10 feet straight away from you if it is Large or smaller.' },
  Vex: { id: 'Vex', name: 'Vex', description: 'On hit, you gain Advantage on your next attack roll against the target before the end of your next turn.' },
  Sap: { id: 'Sap', name: 'Sap', description: "On hit, the target has Disadvantage on its next attack roll before the start of your next turn." },
  Topple: { id: 'Topple', name: 'Topple', description: 'On hit against a Large or smaller creature, you can force it to make a Constitution saving throw or be knocked Prone.' },
  Graze: { id: 'Graze', name: 'Graze', description: 'If your attack roll misses, you can deal damage equal to the ability modifier used for the attack.' },
  Cleave: { id: 'Cleave', name: 'Cleave', description: 'On hit, you can make an attack roll against a second creature within 5 feet of the first. This extra attack deals weapon damage only. Once per turn.' },
};
