// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 27/06/2026, 02:17:59
 * Dependents: systems/puzzles/arcaneGlyphSystem.ts, systems/puzzles/lockSystem.ts, systems/puzzles/pressurePlateSystem.ts, systems/puzzles/secretDoorSystem.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file translates a player character's ability scores into the lowercase
 * stat shape still used by older puzzle checks.
 *
 * Puzzle systems are being moved toward the modern character sheet fields
 * (`finalAbilityScores` first, then `abilityScores`). The legacy
 * `character.stats` field remains supported here only so older fixtures and
 * saved puzzle callers keep working while that migration finishes.
 *
 * Called by: lockSystem.ts, pressurePlateSystem.ts, secretDoorSystem.ts,
 * arcaneGlyphSystem.ts
 * Depends on: PlayerCharacter and CharacterStats type shapes
 */

import type { PlayerCharacter } from '../../types/character';
import type { AbilityScores, CharacterStats } from '../../types/core';

// ============================================================================
// Ability Score Mapping
// ============================================================================
// This section defines the single translation table between the modern
// uppercase ability-score names and the older lowercase puzzle stat names.
// ============================================================================

type LegacyAbilityKey = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';

const MODERN_TO_LEGACY_ABILITIES: Array<[keyof AbilityScores, LegacyAbilityKey]> = [
  ['Strength', 'strength'],
  ['Dexterity', 'dexterity'],
  ['Constitution', 'constitution'],
  ['Intelligence', 'intelligence'],
  ['Wisdom', 'wisdom'],
  ['Charisma', 'charisma'],
];

// ============================================================================
// Puzzle Stat Resolution
// ============================================================================
// This section chooses the ability source used by puzzle checks. Modern final
// scores are preferred because they include character-build modifiers; base
// ability scores are the next best modern source; legacy stats are last.
// ============================================================================

function getModernAbilityScore(character: PlayerCharacter, ability: keyof AbilityScores): number | undefined {
  // Final scores are the active sheet values after race, feat, and other build
  // modifiers. These should drive puzzle DC checks whenever they are present.
  return character.finalAbilityScores?.[ability] ?? character.abilityScores?.[ability];
}

export function getPuzzleCharacterStats(character: PlayerCharacter): CharacterStats {
  // Start with legacy non-ability metadata so callers that still expect speed
  // or CR do not lose those fields during the ability migration.
  const legacyStats = character.stats;
  const resolvedStats: CharacterStats = {
    strength: legacyStats?.strength ?? 10,
    dexterity: legacyStats?.dexterity ?? 10,
    constitution: legacyStats?.constitution ?? 10,
    intelligence: legacyStats?.intelligence ?? 10,
    wisdom: legacyStats?.wisdom ?? 10,
    charisma: legacyStats?.charisma ?? 10,
    baseInitiative: legacyStats?.baseInitiative ?? 0,
    speed: legacyStats?.speed ?? character.speed,
    cr: legacyStats?.cr ?? String(character.level ?? 0),
  };

  // Overlay each ability from modern character data when available. This keeps
  // the shim compatible while making modern scores the explicit source of truth.
  for (const [modernAbility, legacyAbility] of MODERN_TO_LEGACY_ABILITIES) {
    const modernScore = getModernAbilityScore(character, modernAbility);
    if (modernScore !== undefined) {
      resolvedStats[legacyAbility] = modernScore;
    }
  }

  return resolvedStats;
}
