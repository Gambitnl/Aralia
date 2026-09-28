// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 29/08/2026, 15:54:44
 * Dependents: None (Orphan)
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file compatibilityFixtures.ts — Mock fixtures for Aralia game integrations.
 *
 * This file defines minimal, structurally-compatible mock data structures and concrete
 * instances representing the inputs that Aralia's gameplay systems feed into the 3D entity engine.
 * These fixtures prove that game-side entities (Combatants, Characters, and Occupants)
 * remain compatible with the engine's public schema. Since this file is copied to the
 * standalone Entity Studio repository, it remains entirely decoupled from Aralia's gameplay imports.
 *
 * Called by: src/systems/entities3d/__tests__/compatibilityFixtures.test.ts (and standalone tests)
 * Depends on: src/systems/entities3d/types.ts
 */

import type { SizeCategory } from './types';

// ============================================================================
// Structurally Compatible Contract Interfaces
// ============================================================================
// These interfaces mimic the shapes of real Aralia gameplay types (CombatCharacter,
// PlayerCharacter, OccupantIdentity) without importing any gameplay code. This
// guarantees that this file can compile and run inside a standalone environment.
// ============================================================================

/** Structurally matches the Item interface from the game's equipment inventory. */
export interface CompatibilityItem {
  name: string;
  category?: string;
  armorCategory?: string;
  type?: string;
}

/** Structurally matches the CombatCharacter interface used on the Battle Map. */
export interface CompatibilityCombatant {
  id: string;
  name: string;
  creatureTypes?: string[];
  class?: {
    id: string;
  };
  stats?: {
    size?: SizeCategory;
  };
}

/** Structurally matches the PlayerCharacter interface used for the main party members. */
export interface CompatibilityCharacter {
  id: string;
  name: string;
  race: {
    id: string;
  };
  class: {
    id: string;
  };
  equippedItems: {
    MainHand?: CompatibilityItem;
    OffHand?: CompatibilityItem;
    Torso?: CompatibilityItem;
    Head?: CompatibilityItem;
    Cloak?: CompatibilityItem;
  };
}

/** Structurally matches the OccupantIdentity interface used for townsfolk inside buildings. */
export interface CompatibilityOccupant {
  id: number;
  ageBand: string;
  race?: string;
}

// ============================================================================
// Concrete Mock Integration Fixtures
// ============================================================================
// Reusable test objects representing common character configurations in the game.
// These are passed to adapters in tests to prove boundary stability.
// ============================================================================

/** Standard Human Fighter combatant. Maps to a humanoid procedurally. */
export const MOCK_COMBATANT_HUMAN: CompatibilityCombatant = {
  id: 'combatant-human-101',
  name: 'Valen the Brave',
  creatureTypes: ['Humanoid'],
  class: { id: 'fighter' },
};

/** Orc Barbarian monster. Maps to a humanoid procedurally using racial tags. */
export const MOCK_COMBATANT_ORC_MONSTER: CompatibilityCombatant = {
  id: 'combatant-orc-102',
  name: 'Gromm the Orc',
  creatureTypes: ['Humanoid', 'Orc'],
  stats: { size: 'Medium' },
};

/** Non-humanoid monster whose name matches an approved creature in the library database. */
export const MOCK_COMBATANT_ACCEPTED_MONSTER: CompatibilityCombatant = {
  id: 'combatant-cube-103',
  name: 'Gelatinous Cube',
  creatureTypes: ['Ooze'],
  stats: { size: 'Large' },
};

/** Generic monster with no library match. Maps procedurally based on tags. */
export const MOCK_COMBATANT_UNKNOWN_MONSTER: CompatibilityCombatant = {
  id: 'combatant-beast-104',
  name: 'Wild Bear',
  creatureTypes: ['Beast'],
  stats: { size: 'Large' },
};

/** Elf Fighter PC wearing heavy armor and wielding a sword and shield. */
export const MOCK_CHARACTER_ELF_FIGHTER: CompatibilityCharacter = {
  id: 'pc-elf-fighter-201',
  name: 'Aeliana Sunstar',
  race: { id: 'wood_elf' },
  class: { id: 'fighter' },
  equippedItems: {
    MainHand: { name: 'Iron Longsword', category: 'melee' },
    OffHand: { name: 'Steel Shield', armorCategory: 'Shield' },
    Torso: { name: 'Splint Mail', armorCategory: 'Heavy' },
    Head: { name: 'Great Helmet' },
  },
};

/** Wizard PC with light armor, cloak, and staff. */
export const MOCK_CHARACTER_WIZARD: CompatibilityCharacter = {
  id: 'pc-wizard-202',
  name: 'Elidor the Grey',
  race: { id: 'high_elf' },
  class: { id: 'wizard' },
  equippedItems: {
    MainHand: { name: 'Oak Quarterstaff', category: 'melee' }, // melee category prevents matching as bow
    Torso: { name: 'Leather Jerkin', armorCategory: 'Light' },
    Cloak: { name: 'Mantle of Spell Protection' },
  },
};

/** Standard Human Commoner adult occupant inside a tavern. */
export const MOCK_OCCUPANT_HUMAN_ADULT: CompatibilityOccupant = {
  id: 301,
  ageBand: 'adult',
  race: 'Human',
};

/** Dwarf Child occupant. Deterministically resolves to a dwarf subrace. */
export const MOCK_OCCUPANT_DWARF_CHILD: CompatibilityOccupant = {
  id: 302,
  ageBand: 'child',
  race: 'Dwarf',
};

/** Occupant from older map saves with missing race details. */
export const MOCK_OCCUPANT_LEGACY: CompatibilityOccupant = {
  id: 303,
  ageBand: 'adult',
};
