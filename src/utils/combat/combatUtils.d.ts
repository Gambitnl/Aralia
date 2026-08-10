/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 19/07/2026, 23:52:35
 * Dependents: App.tsx, components/BattleMap/characters/characterActor/CharacterActor.tsx, services/DiceService.ts, state/reducers/characterReducer.ts, systems/spells/mechanics/DiceRoller.ts, utils/character/checkUtils.ts, utils/character/savingThrowUtils.ts, utils/combat/index.ts, utils/combat/mechanicsUtils.ts, utils/combatUtils.ts, utils/sandbox/quickCharacterGenerator.ts, utils/spells/outOfCombatCasting.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * ARCHITECTURAL CONTEXT:
 * This file is the 'Combat engine God Object'. It handles everything
 * from distance math and cover calculations to entity conversion.
 *
 * Recent updates focus on 'Combat Feature Parity'. Specifically,
 * `createPlayerCombatCharacter` now maps `feats` from the persistent
 * `PlayerCharacter` state into the transient `CombatCharacter`. This
 * allows the combat execution layer to check for IDs like `great_weapon_master`
 * or `lucky` when calculating damage and re-rolls.
 *
 * @file src/utils/combatUtils.ts
 */
import { BattleMapData, CombatAction, CombatCharacter, Position, Ability, DamageNumber, StatusEffect, AreaOfEffect, CombatEquipmentState } from '../../types/combat';
import { PlayerCharacter } from '../../types';
import { Spell } from '../../types/spells';
import { createAbilityFromSpell } from '../character/spellAbilityFactory';
import { generateId } from '../core/idGenerator';
import { ResistanceCalculator } from './resistanceUtils';
type DiceRandomSource = () => number;
export { createAbilityFromSpell, generateId, ResistanceCalculator };
/**
 * Builds the reusable tactical equipment view from a character's equipped items.
 *
 * Returning undefined for an empty projection keeps monsters, summons and old
 * saves compatible while allowing future equip-in-combat flows to call the same
 * function when they refresh a combatant.
 */
export declare function createCombatEquipmentState(equippedItems: PlayerCharacter['equippedItems']): CombatEquipmentState | undefined;
/**
 * Checks if a character can take a reaction.
 * Verifies HP, reaction resource availability, and incapacitating conditions.
 *
 * CURRENT FUNCTIONALITY:
 * - Validates character is alive (HP > 0)
 * - Checks reaction resource availability in action economy
 * - Evaluates incapacitating conditions (Incapacitated, Paralyzed, Petrified, Stunned, Unconscious)
 * - Handles both legacy statusEffects and new conditions array formats
 *
 * IMPROVEMENT OPPORTUNITIES:
 * 1. PERFORMANCE: The dual checking of statusEffects and conditions creates redundancy
 *    - Consider normalizing data structure to eliminate duplicate condition checking
 * 2. MAINTAINABILITY: Hard-coded condition names could be centralized in a constants file
 * 3. EXTENSIBILITY: Add support for conditional reactions (e.g., Opportunity Attacks based on movement type)
 * 4. TESTABILITY: Extract condition checking logic into separate pure function for easier unit testing
 *
 * @param character The character to check.
 * @returns True if the character can take a reaction.
 */
export declare function canTakeReaction(character: CombatCharacter): boolean;
/**
 * Calculates cover bonus for a target from a specific origin.
 * @param origin - The attacker's position.
 * @param target - The target's position.
 * @param mapData - The battle map data.
 * @returns The cover bonus to AC (0, 2, or 5).
 *
 * CURRENT FUNCTIONALITY:
 * - Uses Bresenham's line algorithm to trace path between attacker and target
 * - Evaluates each intermediate tile for cover-providing properties
 * - Applies standard D&D 5e cover bonuses (Half Cover: +2, Three-Quarters Cover: +5)
 * - Special handling for pillars providing superior cover
 *
 * IMPROVEMENT OPPORTUNITIES:
 * 1. PERFORMANCE: Line tracing for every attack could be expensive in complex battles
 *    - Consider pre-calculating cover maps for static environments
 *    - Implement spatial indexing for faster tile lookups
 * 2. ACCURACY: Current implementation may not handle complex terrain correctly
 *    - Add support for partial cover from multiple sources
 *    - Implement height-based cover calculations
 * 3. EXTENSIBILITY: Support for cover-modifying spells/items
 *    - Add callback system for dynamic cover effects
 *    - Integrate with spell system for cover-granting abilities
 */
export declare function calculateCover(origin: Position, target: Position, mapData: BattleMapData): number;
/**
 * Parses a dice notation string (e.g., '2d8', '3d6+5') and returns the rolled total.
 * Supports complex formulas like '1d8 + 1d6 + 2'.
 * @param diceString The dice notation to roll (e.g., '2d8+3')
 * @returns The total rolled value
 *
 * CURRENT FUNCTIONALITY:
 * - Handles standard dice notation (XdY+Z format)
 * - Supports complex formulas with multiple dice types
 * - Processes positive and negative modifiers
 * - Removes whitespace for consistent parsing
 *
 * IMPROVEMENT OPPORTUNITIES:
 * 1. ROBUSTNESS: Regex-based parsing can be fragile with malformed input
 *    - Add input validation and sanitization
 *    - Implement graceful error handling for invalid notation
 * 2. PERFORMANCE: Regex evaluation for each roll adds overhead
 *    - Consider compiled parsers for frequently used formulas
 *    - Cache parsed results for repeated identical rolls
 * 3. FEATURE GAP: Missing advanced D&D mechanics
 *    - No support for advantage/disadvantage
 *    - Cannot handle complex conditional dice (e.g., "reroll 1s")
 *    - Lacks integration with character-specific modifiers
 * 4. MAINTAINABILITY: Parsing logic mixed with rolling logic
 *    - Separate parsing from execution for better testability
 *    - Create dedicated dice expression AST for complex operations
 */
export declare function rollDice(diceString: string, options?: {
    rng?: DiceRandomSource;
}): number;
/**
 * Rolls a d20, optionally with advantage or disadvantage.
 */
export declare function rollD20(options?: {
    advantage?: boolean;
    disadvantage?: boolean;
    rng?: DiceRandomSource;
}): number;
/**
 * Rolls damage, optionally doubling the dice for a critical hit.
 *
 * Safety:
 * - Returns 0 for invalid/empty strings.
 * - Handles complex formulas like "1d8 + 1d6 + 2".
 * - Ignores spaces.
 *
 * @param diceString The dice notation (e.g., '2d6+3').
 * @param isCritical Whether this is a critical hit (doubles dice).
 * @param minRoll Optional minimum value for each die (e.g. for Elemental Adept).
 * @returns The total damage.
 *
 * CURRENT FUNCTIONALITY:
 * - Implements D&D 5e critical hit rules (double dice count, not multiply result)
 * - Supports complex damage formulas with multiple dice types
 * - Handles minimum roll values for specific game mechanics
 * - Uses global regex for parsing dice notation
 *
 * IMPROVEMENT OPPORTUNITIES:
 * 1. CORRECTNESS: Global regex state can cause issues in concurrent environments
 *    - Use local regex instances to avoid state sharing
 *    - Implement proper regex reset between parses
 * 2. PERFORMANCE: Regex re-evaluation for each damage roll
 *    - Pre-compile common damage formulas
 *    - Cache parsed expressions for frequently used weapons/spells
 * 3. EXTENSIBILITY: Limited damage type integration
 *    - No built-in support for damage type modifiers
 *    - Missing integration with resistance/vulnerability calculations
 * 4. DEBUGGING: Difficult to trace individual dice rolls
 *    - Add roll breakdown reporting for transparency
 *    - Implement detailed logging for critical game moments
 *
 * @example
 * rollDamage('2d6+3', false) // Returns 5-15
 * rollDamage('2d6', true)    // Returns 4-24 (4d6)
 */
export declare function rollDamage(diceString: string, isCritical: boolean, minRoll?: number, random?: DiceRandomSource): number;
/**
 * Generates a human-readable message for a combat action.
 * Distinguishes between "attacks with" (physical), "casts" (spells), and "uses" (generic).
 */
export declare function getActionMessage(action: CombatAction, character: CombatCharacter): string;
/**
 * Calculates the distance between two positions in tiles.
 * Uses Chebyshev distance (5-5-5 rule) to support 8-way movement on the grid.
 * This is primarily used for AoE calculations and simple range checks.
 *
 * NOTE: For strict movement cost calculation (5-10-5 rule), use `getTargetDistance`
 * from `movementUtils.ts` or `findPath` from `pathfinding.ts`.
 *
 * @param pos1 - The first position.
 * @param pos2 - The second position.
 * @returns The distance in tiles (maximum coordinate difference).
 */
export declare function getDistance(pos1: Position, pos2: Position): number;
/**
 * Returns the width/height of a creature in tiles based on its size category.
 * - Tiny/Small/Medium: 1x1 (1 tile)
 * - Large: 2x2 (2 tiles)
 * - Huge: 3x3 (3 tiles)
 * - Gargantuan: 4x4+ (4 tiles)
 */
export declare function getCharacterSizeMultiplier(size?: string): number;
/**
 * Calculates all tiles occupied by a character based on their size.
 * Large creatures occupy 2x2, Huge 3x3, etc.
 * The 'position' field always represents the top-left corner tile.
 *
 * @param character - The character to check.
 * @returns An array of positions occupied by the character.
 */
export declare function getOccupiedTiles(character: CombatCharacter): Position[];
/**
 * Calculates the shortest distance between two characters, accounting for their sizes.
 * Distance is measured from the closest pair of occupied tiles.
 */
export declare function getCharacterDistance(char1: CombatCharacter, char2: CombatCharacter): number;
/**
 * Normalizes AoE information on an ability into a concrete AreaOfEffect object.
 * This keeps older abilities that only set areaOfEffect working while supporting
 * the newer areaShape/areaSize fields described in the combat types.
 */
export declare function resolveAreaDefinition(ability: Ability): AreaOfEffect | null;
/**
 * Calculates all map coordinates touched by a given area template. The geometry
 * intentionally mirrors D&D 5e templates: cones spread in a 90° arc by default,
 * circles use Chebyshev distance (5 ft squares), and lines extend from the caster
 * toward the selected center.
 */
export declare function computeAoETiles(area: AreaOfEffect, center: Position, mapData: BattleMapData, origin?: Position): Position[];
/**
 * Calculates final damage by applying 5e rules for Resistance, Vulnerability, and Immunity.
 *
 * Logic:
 * 1. Immunity: Reduces damage to 0.
 * 2. Vulnerability: Doubles damage.
 * 3. Resistance: Halves damage (rounded down).
 *
 * @param baseDamage The base rolled damage.
 * @param caster The source of the damage (for future feat checks like Elemental Adept).
 * @param target The character receiving the damage.
 * @param damageType The type of damage (fire, cold, etc.).
 * @returns The final damage integer.
 */
export declare function calculateDamage(baseDamage: number, caster: CombatCharacter | null, target: CombatCharacter, damageType?: string, zoneContext?: Parameters<typeof ResistanceCalculator.applyResistances>[5]): number;
/**
 * Builds a DamageNumber payload that the BattleMap overlay can consume.
 * Centralizing this logic ensures all floating numbers share timing and styling metadata.
 */
export declare function createDamageNumber(value: number, position: Position, type: DamageNumber['type']): DamageNumber;
/**
 * Returns a consistent icon for a status effect so the UI can visualize buffs/debuffs.
 * If a custom icon is provided on the effect we prefer that, otherwise fallback emojis.
 */
export declare function getStatusEffectIcon(effect: StatusEffect): string;
/**
 * Converts a PlayerCharacter from the main game state into a CombatCharacter for the battle map.
 *
 * ## Architecture Note: Persistent vs Transient State
 * The game maintains two separate character representations:
 * 1. **PlayerCharacter (Persistent):** Stores long-term state (inventory, XP, all known spells) in Redux/LocalStorage.
 * 2. **CombatCharacter (Transient):** Optimized for the turn-based combat engine (flat ability list, position) and discarded after combat.
 *
 * This factory acts as the bridge (Adapter Pattern), ensuring the combat engine receives a standardized interface
 * regardless of whether the source is a Player or a Monster.
 *
 * ## Key Transformations
 * - **Weapons -> Abilities:** Equipped weapons are converted into 'Attack' abilities.
 *   - Note: We set `value: 0` in the damage effect as a SENTINEL. The combat system detects this and
 *     dynamically rolls the weapon's damage dice at runtime.
 * - **Spells -> Abilities:** Hydrates the spellbook using the global spell dictionary.
 * - **Stats:** Flattens nested stat objects for easier access by combat systems.
 *
 * CURRENT FUNCTIONALITY:
 * - Maps player stats to combat-ready format
 * - Converts equipped weapons to combat abilities with proper damage calculations
 * - Integrates spellbook with combat ability system
 * - Handles class-specific combat features (Second Wind, Cunning Dash, etc.)
 * - Applies racial traits like darkvision
 * - Manages hit point dice pools for combat use
 *
 * IMPROVEMENT OPPORTUNITIES:
 * 1. PERFORMANCE: Expensive transformation process called frequently
 *    - Implement caching for unchanged character state
 *    - Consider incremental updates instead of full recreation
 * 2. MAINTAINABILITY: Monolithic function with multiple responsibilities
 *    - Extract weapon conversion to separate helper function
 *    - Separate spell processing from core character creation
 *    - Break down class feature handling into modular components
 * 3. ROBUSTNESS: Missing error handling for data inconsistencies
 *    - Add validation for missing spell data
 *    - Handle malformed weapon/equipment data gracefully
 *    - Implement fallback behaviors for incomplete character data
 * 4. EXTENSIBILITY: Hard-coded class features limit flexibility
 *    - Create plugin system for class-specific combat abilities
 *    - Add support for temporary combat modifiers/buffs
 *    - Integrate with condition system for combat-specific effects
 *
 * @param player - The persistent PlayerCharacter object.
 * @param allSpells - Dictionary of all spell data, used to resolve spell IDs into full ability objects.
 * @returns A fully hydrated CombatCharacter ready for the BattleMap.
 */
export declare function createPlayerCombatCharacter(player: PlayerCharacter, allSpells?: Record<string, Spell>): CombatCharacter;
/** Preview-only combat intersection used to carry the explicit Dev Player exception. */
export type DevPlaytestCombatant = CombatCharacter & {
    devPlaytest?: {
        unlimitedSpellSlots: boolean;
    };
};
/** Returns true only for the explicit Design Preview unlimited-slot marker. */
export declare function isUnlimitedSpellSlotCombatant(character: CombatCharacter): character is DevPlaytestCombatant & {
    devPlaytest: {
        unlimitedSpellSlots: true;
    };
};
export interface AttackResult {
    isHit: boolean;
    isCritical: boolean;
    isAutoMiss: boolean;
    total: number;
}
/**
 * Resolves an attack roll against a target's Armor Class according to 5e rules.
 * Handles Natural 1 (Auto Miss), Natural 20 (Auto Hit/Crit), and Critical Ranges.
 *
 * @param d20Roll - The raw d20 roll (before modifiers).
 * @param modifiers - Total attack bonus (ability mod + proficiency + others).
 * @param targetAC - The target's Armor Class.
 * @param critThreshold - The minimum die roll required for a critical hit (default 20).
 * @returns An object containing hit/miss status and critical details.
 */
export declare function resolveAttack(d20Roll: number, modifiers: number, targetAC: number, critThreshold?: number): AttackResult;
