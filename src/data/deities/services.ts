/**
 * @file src/data/deities/services.ts
 * Defines the standard services available at temples in Aralia.
 */
import { TempleService } from '../../types/religion';

export const TEMPLE_SERVICES: TempleService[] = [
  {
    id: 'healing_word',
    name: 'Minor Healing',
    description: 'A simple prayer to restore vitality.',
    requirement: { goldCost: 10 },
    effect: { type: 'heal', value: 10, description: 'Restores 10 HP' },
  },
  {
    id: 'cure_disease',
    name: 'Purify Body',
    description: 'Removes common diseases and poisons.',
    requirement: { goldCost: 50, minFavor: 10 },
    effect: { type: 'cure', description: 'Removes all diseases and poisons' },
  },
  {
    id: 'blessing_strength',
    name: 'Strength of the Bear',
    description: 'Grants temporary strength.',
    requirement: { goldCost: 100, minFavor: 20 },
    effect: { type: 'buff', stat: 'Strength', value: 2, duration: 60, description: '+2 STR for 1 hour' },
  },
  {
    id: 'divine_guidance',
    name: 'Divine Guidance',
    description: 'Ask the deity for a hint about your current quest.',
    requirement: { goldCost: 25, minFavor: 5 },
    effect: { type: 'quest', description: 'Reveals a clue' },
  },
  {
    id: 'identify_magic',
    name: 'Identify Artifact',
    description: 'Reveal the properties of a magical item.',
    requirement: { goldCost: 100 },
    effect: { type: 'identify', description: 'Identifies one item' },
  },
  {
    id: 'restoration',
    name: 'Greater Restoration',
    description: 'End charmed, petrified, cursed, or attribute reducing effects.',
    requirement: { goldCost: 450, minFavor: 50 },
    effect: { type: 'restoration', description: 'Restores ability scores and removes severe conditions' },
  }
];
