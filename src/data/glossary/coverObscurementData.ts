/**
 * @file src/data/glossary/coverObscurementData.ts
 *
 * This file contains the complete structured dataset of PHB 2024 Cover and
 * Obscurement rules.
 *
 * Why it exists:
 * Tactical positioning in D&D 5e relies heavily on physical obstructions (Cover)
 * and visual impairments (Obscurement). This dataset provides exact mechanical
 * numbers (such as AC bonuses, Dexterity saving throw modifiers, and perception
 * penalties) formatted for the Compendium table view and tactical decision tools.
 *
 * Connects to:
 * - src/data/glossary/types.ts for CoverObscurementEntry
 * - src/components/Compendium/CoverObscurementTable.tsx for table rendering
 * - src/data/glossary/searchIndex.ts for search indexing
 */

import { CoverObscurementEntry } from './types';

// ============================================================================
// Cover & Obscurement Dataset
// ============================================================================
// Contains all three degrees of physical Cover and two levels of sensory
// Obscurement defined in the 2024 Player's Handbook.
// ============================================================================

export const COVER_OBSCUREMENT_DATA: CoverObscurementEntry[] = [
  {
    id: 'half_cover',
    name: 'Half Cover',
    type: 'cover',
    acBonus: 2,
    dexSaveBonus: 2,
    targetingRestriction: 'No restriction, but target is harder to hit.',
    description: 'A target with half cover has a +2 bonus to Armor Class and Dexterity saving throws. An obstacle provides half cover if it covers at least half of the target’s body.',
    examples: [
      'Low wall or waist-high barricade',
      'Large piece of furniture (tables, chairs)',
      'Narrow tree trunk',
      'Another creature, whether that creature is an enemy or a friend',
    ],
    seeAlso: ['armor_class', 'dexterity', 'saving_throw', 'three_quarters_cover', 'total_cover'],
  },
  {
    id: 'three_quarters_cover',
    name: 'Three-Quarters Cover',
    type: 'cover',
    acBonus: 5,
    dexSaveBonus: 5,
    targetingRestriction: 'No restriction, but target has substantial defensive protection.',
    description: 'A target with three-quarters cover has a +5 bonus to Armor Class and Dexterity saving throws. An obstacle provides three-quarters cover if it covers at least three-quarters of the target’s body.',
    examples: [
      'Portcullis or sturdy iron grate',
      'Arrow slit or embrasure in a stone fortress',
      'Thick tree trunk covering most of the creature',
      'Peeking around a heavy stone pillar or corner',
    ],
    seeAlso: ['armor_class', 'dexterity', 'saving_throw', 'half_cover', 'total_cover'],
  },
  {
    id: 'total_cover',
    name: 'Total Cover',
    type: 'cover',
    acBonus: null,
    dexSaveBonus: null,
    targetingRestriction: 'Cannot be targeted directly by an attack or a spell.',
    description: 'A target with total cover is completely concealed by an obstacle and cannot be targeted directly by an attack or spell. However, some spells can reach a target by including it in an area of effect that extends around obstacles.',
    examples: [
      'Solid wall or completely closed door',
      'Being entirely inside an enclosed bunker or container',
      'Standing fully behind a solid stone cliff corner',
    ],
    seeAlso: ['area_of_effect', 'line_of_sight', 'half_cover', 'three_quarters_cover'],
  },
  {
    id: 'lightly_obscured',
    name: 'Lightly Obscured',
    type: 'obscurement',
    acBonus: null,
    dexSaveBonus: null,
    perceptionEffect: 'Disadvantage on Wisdom (Perception) checks that rely on sight.',
    description: 'In a lightly obscured area, creatures have Disadvantage on Wisdom (Perception) checks that rely on sight. The area does not prevent line of sight or block attacks, but makes spotting hidden foes or subtle details more difficult.',
    examples: [
      'Dim light (such as moonlight or twilight)',
      'Patchy or drifting fog',
      'Moderate foliage, light canopy, or vines',
    ],
    seeAlso: ['dim_light', 'perception', 'disadvantage', 'heavily_obscured', 'hide_action'],
  },
  {
    id: 'heavily_obscured',
    name: 'Heavily Obscured',
    type: 'obscurement',
    acBonus: null,
    dexSaveBonus: null,
    targetingRestriction: 'Line of sight is blocked. Attacks made into or through the area rely on unseen attacker rules.',
    perceptionEffect: 'Creatures in or looking into the area effectively suffer from the Blinded condition.',
    description: 'A heavily obscured area blocks vision entirely. A creature effectively suffers from the Blinded condition when trying to see something in that area. Attacks against unseen creatures have Disadvantage, while attacks by unseen creatures have Advantage.',
    examples: [
      'Darkness (for creatures without Darkvision)',
      'Magical darkness (blocks even normal Darkvision)',
      'Dense smoke, heavy fog, or torrential blizzard',
      'Opaque foliage, heavy vines, or jungle canopy',
    ],
    seeAlso: ['darkness', 'blinded', 'invisible', 'darkvision', 'blindsight', 'truesight'],
  },
];
