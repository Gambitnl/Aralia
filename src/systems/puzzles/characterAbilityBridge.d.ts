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
import type { CharacterStats } from '../../types/core';
export declare function getPuzzleCharacterStats(character: PlayerCharacter): CharacterStats;
