/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/07/2026, 11:21:04
 * Dependents: utils/character/index.ts, utils/combat/combatUtils.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/spellAbilityFactory.ts
 * A factory service that converts static Spell JSON data (from src/types)
 * into functional Ability objects for the Combat System (from src/types/combat).
 *
 * Strategy:
 * 1. "Gold Standard": Prefer explicit structured data from the spell JSON (e.g., `effects` array).
 * 2. "Silver Standard": Fallback to parsing the description text for legacy spells or simple mechanics.
 *
 * This allows us to define a spell ONCE in the JSON data, and have it automatically
 * work in the BattleMap without writing manual code for every single spell.
 */
import { Spell, PlayerCharacter } from '../../types';
import { Ability } from '../../types/combat';
/**
 * Main Factory Function
 *
 * Bridges static Spell Data (JSON) with the dynamic Combat Engine (Ability).
 * Converts cost, range, and effects into a format the BattleMap can execute.
 */
export declare function createAbilityFromSpell(spell: Spell, caster: PlayerCharacter): Ability;
