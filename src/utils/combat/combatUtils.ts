// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 09/06/2026, 03:54:07
 * Dependents: components/BattleMap/characters/CharacterActor.tsx, components/DesignPreview/steps/PreviewCombatSandbox.tsx, services/DiceService.ts, state/reducers/characterReducer.ts, systems/spells/mechanics/DiceRoller.ts, utils/character/checkUtils.ts, utils/character/savingThrowUtils.ts, utils/combat/index.ts, utils/combat/mechanicsUtils.ts, utils/combatUtils.ts, utils/sandbox/quickCharacterGenerator.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
import { BattleMapData, CombatAction, CombatCharacter, Position, CharacterStats, Ability, DamageNumber, StatusEffect, AreaOfEffect, AbilityEffect } from '../../types/combat';
import { PlayerCharacter, Item } from '../../types';
import { Spell, DamageType } from '../../types/spells';
import { createAbilityFromSpell } from '../character/spellAbilityFactory';
import { isWeaponProficient } from '../character/weaponUtils';
import { generateId } from '../core/idGenerator';
import { getAbilityModifierValue } from '../character/statUtils';
import { buildHitPointDicePools } from '../character/characterUtils';
import { ResistanceCalculator } from './resistanceUtils';

import { bresenhamLine } from '../spatial/lineOfSight';

type DiceRandomSource = () => number;

// Re-export for consumers
export { createAbilityFromSpell, generateId, ResistanceCalculator };

// TODO #1312(Mechanist): Wire up physicsUtils (fall damage, jumping) into movement logic.
// TODO #1313(Mechanist): Wire up `calculateExhaustionEffects` from `physicsUtils.ts` to `createPlayerCombatCharacter` (apply speed/d20 penalties).
//
// IMPROVEMENT OPPORTUNITY: Missing physics integration creates inconsistency between combat and exploration mechanics.
// Current implementation lacks:
// 1. Fall damage calculation during forced movement/teleportation
// 2. Exhaustion effect application that should modify combat stats
// 3. Jumping mechanics that could affect positioning and opportunity attacks
// Consider creating a unified physics adapter that bridges combat and exploration systems.

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
export function canTakeReaction(character: CombatCharacter): boolean {
  // 1. Must be alive and conscious
  if (character.currentHP <= 0) return false;

  // 2. Must have reaction available in action economy
  if (character.actionEconomy.reaction.used) return false;

  // 3. Must not be incapacitated or have a condition explicitly preventing reactions
  // Conditions that prevent reactions: Incapacitated, Paralyzed, Petrified, Stunned, Unconscious, Slowed, Confused, Reactions Suppressed
  // Note: Sleep (Unconscious) and Hypnotic Pattern (Incapacitated) are covered here.
  const incapacitatedConditions: string[] = [
    'Incapacitated',
    'Paralyzed',
    'Petrified',
    'Stunned',
    'Unconscious',
    'Slowed',
    'Confused',
    'Reactions Suppressed'
  ];

  // Check legacy statusEffects
  const hasIncapacitatingEffect = character.statusEffects.some(effect => {
    const name = effect.name || effect.id; // Fallback
    return incapacitatedConditions.some(cond =>
      name.toLowerCase() === cond.toLowerCase() ||
      effect.id.toLowerCase().includes(cond.toLowerCase())
    );
  });

  if (hasIncapacitatingEffect) return false;

  // Check new conditions array (if populated)
  if (character.conditions) {
    const hasIncapacitatingCondition = character.conditions.some(cond =>
      incapacitatedConditions.includes(cond.name as string)
    );
    if (hasIncapacitatingCondition) return false;
  }

  return true;
}

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
export function calculateCover(origin: Position, target: Position, mapData: BattleMapData): number {
  if (!mapData) return 0;

  // Get the line of tiles between attacker and target
  const line = bresenhamLine(origin.x, origin.y, target.x, target.y);

  // Check each tile along the path, excluding start and end
  // If any tile provides cover, we determine the cover bonus (Half: +2 or Three-Quarters: +5)
  // and apply the highest bonus found along the path.
  let maxCover = 0;

  for (let i = 1; i < line.length - 1; i++) {
    const point = line[i];
    const tile = mapData.tiles.get(`${point.x}-${point.y}`) as any;

    if (tile && tile.providesCover) {
      // Default to Half Cover (+2)
      let currentCover = 2;

      // Pillars provide Three-Quarters Cover (+5) due to their width and solidity
      if (tile.decoration === 'pillar') {
        currentCover = 5;
      }

      if (currentCover > maxCover) {
        maxCover = currentCover;
      }
    }
  }

  return maxCover;
}

/**
 * Helper to roll a single group of dice (e.g., "2d8").
 *
 * @param count Number of dice to roll.
 * @param sides Number of sides per die.
 * @param minRoll Minimum value per die (default 1).
 * @returns Total rolled value.
 *
 * @internal This is a helper for `rollDamage` and should not be used directly.
 *
 * CURRENT FUNCTIONALITY:
 * - Implements basic dice rolling with Math.random()
 * - Enforces minimum roll values (useful for feats like Elemental Adept)
 * - Simple loop-based implementation for reliability
 *
 * IMPROVEMENT OPPORTUNITIES:
 * 1. SECURITY: Client-side Math.random() is predictable and manipulable
 *    - Implement server-side validation for critical rolls
 *    - Add cryptographic randomness for important game events
 * 2. PERFORMANCE: Loop-based approach is inefficient for large dice pools
 *    - Consider batch processing for multiple dice of same type
 *    - Implement lookup tables for common dice combinations
 * 3. EXTENSIBILITY: Limited customization options
 *    - Add support for advantage/disadvantage mechanics
 *    - Implement roll history tracking for analytics
 * 4. TESTABILITY: Difficult to test due to random nature
 *    - Add deterministic mode for testing purposes
 *    - Implement seedable random number generator
 */
function rollDieGroup(
  count: number,
  sides: number,
  minRoll: number = 1,
  random: DiceRandomSource = Math.random
): number {
    // TODO #1314(FEATURES): Route dice rolls through a secure or server-validated RNG to prevent client-side manipulation.
    // (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).
    let subTotal = 0;
  for (let i = 0; i < count; i++) {
    let roll = Math.floor(random() * sides) + 1;
    if (roll < minRoll) roll = minRoll;
    subTotal += roll;
  }
  return subTotal;
}

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
export function rollDice(
  diceString: string,
  options: { rng?: DiceRandomSource } = {}
): number {
  return rollDamage(diceString, false, 1, options?.rng);
}

/**
 * Rolls a d20, optionally with advantage or disadvantage.
 */
export function rollD20(
  options: { advantage?: boolean; disadvantage?: boolean; rng?: DiceRandomSource } = {}
): number {
  const { advantage, disadvantage, rng = Math.random } = options;
  const roll1 = Math.floor(rng() * 20) + 1;
  if (!advantage && !disadvantage) return roll1;

  if (advantage && !disadvantage) {
    const roll2 = Math.floor(rng() * 20) + 1;
    return Math.max(roll1, roll2);
  }
  if (disadvantage && !advantage) {
    const roll2 = Math.floor(rng() * 20) + 1;
    return Math.min(roll1, roll2);
  }
  return roll1;
}

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
export function rollDamage(
  diceString: string,
  isCritical: boolean,
  minRoll: number = 1,
  random: DiceRandomSource = Math.random
): number {
  // RALPH: Damage Resolver.
  // Uses a global regex to scan the formula for dice (XdY) and flat numbers (Z).
  // Doubling dice for Critical Hits happens BEFORE the roll to ensure consistent 5e logic.
  if (!diceString || diceString === '0') return 0;

  // Remove spaces for easier parsing
  const formula = diceString.replace(/\s+/g, '');

  // Regex to match terms:
  // Group 1: Optional sign ([+-]?)
  // Group 2, 3: Dice notation (\d+)d(\d+)
  // Group 4: Flat number (\d+)
  const regex = /([+-]?)(?:(\d+)d(\d+)|(\d+))/g;

  let total = 0;
  let match;

  while ((match = regex.exec(formula)) !== null) {
    // Avoid infinite loops
    if (match.index === regex.lastIndex) {
      regex.lastIndex++;
    }

    const sign = match[1] === '-' ? -1 : 1;

    if (match[2] && match[3]) {
      // It's a dice roll: XdY
      const numDice = parseInt(match[2], 10);
      const dieSize = parseInt(match[3], 10);

      // CRITICAL HIT LOGIC: Roll dice twice
      // RALPH: 5e rule - double the NUMBER of dice rolled, not the total result.
      const actualNumDice = isCritical ? numDice * 2 : numDice;

      const subTotal = rollDieGroup(actualNumDice, dieSize, minRoll, random);
      total += sign * subTotal;
    } else if (match[4]) {
      // It's a flat number
      const val = parseInt(match[4], 10);
      total += sign * val;
    }
  }

  return total;
}

/**
 * Generates a human-readable message for a combat action.
 * Distinguishes between "attacks with" (physical), "casts" (spells), and "uses" (generic).
 */
export function getActionMessage(action: CombatAction, character: CombatCharacter): string {
  const abilityName = action.abilityId || 'an ability';
  
  switch (action.type) {
    case 'move':
      return `${character.name} moves.`;
    case 'ability': {
      const ability = character.abilities.find(a => a.id === action.abilityId);
      const name = ability?.name || abilityName;
      
      // Use descriptive verbs based on ability type
      if (ability?.type === 'attack') {
        return `${character.name} attacks with ${name}`;
      } else if (ability?.spell) {
        return `${character.name} casts ${name}`;
      }
      return `${character.name} uses ${name}`;
    }
    case 'end_turn':
      return `${character.name} ends their turn`;
    default:
      return `${character.name} performs an action`;
  }
}

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
export function getDistance(pos1: Position, pos2: Position): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return Math.max(Math.abs(dx), Math.abs(dy));
}

/**
 * Returns the width/height of a creature in tiles based on its size category.
 * - Tiny/Small/Medium: 1x1 (1 tile)
 * - Large: 2x2 (2 tiles)
 * - Huge: 3x3 (3 tiles)
 * - Gargantuan: 4x4+ (4 tiles)
 */
export function getCharacterSizeMultiplier(size?: string): number {
  switch (size) {
    case 'Large': return 2;
    case 'Huge': return 3;
    case 'Gargantuan': return 4;
    default: return 1;
  }
}

/**
 * Calculates all tiles occupied by a character based on their size.
 * Large creatures occupy 2x2, Huge 3x3, etc.
 * The 'position' field always represents the top-left corner tile.
 *
 * @param character - The character to check.
 * @returns An array of positions occupied by the character.
 */
export function getOccupiedTiles(character: CombatCharacter): Position[] {
  const size = character.stats.size;
  const multiplier = getCharacterSizeMultiplier(size);
  
  if (multiplier === 1) return [character.position];

  const tiles: Position[] = [];
  for (let dx = 0; dx < multiplier; dx++) {
    for (let dy = 0; dy < multiplier; dy++) {
      tiles.push({
        x: character.position.x + dx,
        y: character.position.y + dy
      });
    }
  }
  return tiles;
}

/**
 * Calculates the shortest distance between two characters, accounting for their sizes.
 * Distance is measured from the closest pair of occupied tiles.
 */
export function getCharacterDistance(char1: CombatCharacter, char2: CombatCharacter): number {
  const tiles1 = getOccupiedTiles(char1);
  const tiles2 = getOccupiedTiles(char2);
  
  let minDist = Infinity;
  for (const t1 of tiles1) {
    for (const t2 of tiles2) {
      const d = getDistance(t1, t2);
      if (d < minDist) minDist = d;
      if (minDist === 0) return 0; // Optimized: adjacent or overlapping
    }
  }
  return minDist;
}

/**
 * Normalizes AoE information on an ability into a concrete AreaOfEffect object.
 * This keeps older abilities that only set areaOfEffect working while supporting
 * the newer areaShape/areaSize fields described in the combat types.
 */
export function resolveAreaDefinition(ability: Ability): AreaOfEffect | null {
  if (ability.areaOfEffect) return ability.areaOfEffect;
  if (ability.areaShape && ability.areaSize) {
    return { shape: ability.areaShape, size: ability.areaSize };
  }
  return null;
}

/**
 * Calculates all map coordinates touched by a given area template. The geometry
 * intentionally mirrors D&D 5e templates: cones spread in a 90° arc by default,
 * circles use Chebyshev distance (5 ft squares), and lines extend from the caster
 * toward the selected center.
 */
export function computeAoETiles(
  area: AreaOfEffect,
  center: Position,
  mapData: BattleMapData,
  origin?: Position
): Position[] {
  const tiles = new Map<string, Position>();
  const clampWithinMap = (pos: Position) =>
    pos.x >= 0 && pos.y >= 0 && pos.x < mapData.dimensions.width && pos.y < mapData.dimensions.height;

  const addTile = (pos: Position) => {
    if (clampWithinMap(pos)) {
      tiles.set(`${pos.x}-${pos.y}`, pos);
    }
  };

  switch (area.shape) {
    case 'circle': {
      for (let x = center.x - area.size; x <= center.x + area.size; x++) {
        for (let y = center.y - area.size; y <= center.y + area.size; y++) {
          const pos = { x, y };
          if (getDistance(center, pos) <= area.size) {
            addTile(pos);
          }
        }
      }
      break;
    }
    case 'square': {
      const half = Math.floor(area.size / 2);
      for (let x = center.x - half; x <= center.x + half; x++) {
        for (let y = center.y - half; y <= center.y + half; y++) {
          addTile({ x, y });
        }
      }
      break;
    }
    case 'line': {
      const originPos = origin || center;
      const dx = center.x - originPos.x;
      const dy = center.y - originPos.y;
      const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
      const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;

      let current: Position = { x: originPos.x, y: originPos.y };
      for (let i = 0; i < area.size; i++) {
        current = { x: current.x + stepX, y: current.y + stepY };
        addTile(current);
      }
      break;
    }
    case 'cone': {
      const originPos = origin || center;
      const baseDir = {
        x: center.x - originPos.x,
        y: center.y - originPos.y,
      };
      const magnitude = Math.max(1, Math.hypot(baseDir.x, baseDir.y));
      const dir = { x: baseDir.x / magnitude, y: baseDir.y / magnitude };
      const angleLimit = (area.angle ?? 90) * (Math.PI / 180);

      for (let x = originPos.x - area.size; x <= originPos.x + area.size; x++) {
        for (let y = originPos.y - area.size; y <= originPos.y + area.size; y++) {
          const pos = { x, y };
          const dist = getDistance(originPos, pos);
          if (dist === 0 || dist > area.size) continue;

          const vec = { x: pos.x - originPos.x, y: pos.y - originPos.y };
          const vecMag = Math.max(1, Math.hypot(vec.x, vec.y));
          const normVec = { x: vec.x / vecMag, y: vec.y / vecMag };
          const dot = dir.x * normVec.x + dir.y * normVec.y;
          const theta = Math.acos(Math.min(1, Math.max(-1, dot)));

          if (theta <= angleLimit / 2) {
            addTile(pos);
          }
        }
      }
      break;
    }
    default:
      break;
  }

  return Array.from(tiles.values());
}

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
export function calculateDamage(
  baseDamage: number,
  caster: CombatCharacter | null,
  target: CombatCharacter,
  damageType?: string,
  zoneContext?: Parameters<typeof ResistanceCalculator.applyResistances>[5]
): number {
  if (!damageType || baseDamage <= 0) return Math.max(0, baseDamage);

  return ResistanceCalculator.applyResistances(
    baseDamage,
    damageType as DamageType,
    target,
    caster,
    undefined,
    zoneContext
  );
}

/**
 * Builds a DamageNumber payload that the BattleMap overlay can consume.
 * Centralizing this logic ensures all floating numbers share timing and styling metadata.
 */
export function createDamageNumber(
  value: number,
  position: Position,
  type: DamageNumber['type']
): DamageNumber {
  return {
    id: generateId(),
    value,
    position,
    type,
    startTime: Date.now(),
    duration: 1500,
  };
}

/**
 * Returns a consistent icon for a status effect so the UI can visualize buffs/debuffs.
 * If a custom icon is provided on the effect we prefer that, otherwise fallback emojis.
 */
export function getStatusEffectIcon(effect: StatusEffect): string {
  if (effect.icon) return effect.icon;
  switch (effect.type) {
    case 'buff':
      return '✨';
    case 'debuff':
      return '☠️';
    case 'dot':
      return '🔥';
    case 'hot':
      return '➕';
    default:
      return '◼️';
  }
}

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
export function createPlayerCombatCharacter(player: PlayerCharacter, allSpells: Record<string, Spell> = {}): CombatCharacter {
  const stats: CharacterStats = {
    strength: player.finalAbilityScores.Strength,
    dexterity: player.finalAbilityScores.Dexterity,
    constitution: player.finalAbilityScores.Constitution,
    intelligence: player.finalAbilityScores.Intelligence,
    wisdom: player.finalAbilityScores.Wisdom,
    charisma: player.finalAbilityScores.Charisma,
    baseInitiative: getAbilityModifierValue(player.finalAbilityScores.Dexterity) + (player.initiativeBonus || 0) + (player.initiativeProficiency ? (player.proficiencyBonus || 2) : 0),
    speed: player.speed,
    cr: 'N/A',
    senses: { darkvision: 0, blindsight: 0, tremorsense: 0, truesight: 0 },
  };

  // 1. Basic Physical Abilities
  const abilities: Ability[] = [];

  // Generate Attack Actions from Equipped Weapons
  const mainHand = player.equippedItems?.MainHand;
  const offHand = player.equippedItems?.OffHand;

  /**
   * Creates a combat Ability from an equipped weapon item.
   * Handles damage type defaults, reach properties, and Weapon Mastery validation.
   */
  const createWeaponAbility = (weapon: Item, idSuffix: string, isOffHand: boolean = false): Ability => {
    // Default to physical damage. Future expansion can parse damage types from item data.
    const damageType: AbilityEffect['damageType'] = 'physical';

    const isProficient = isWeaponProficient(player, weapon);

    const ability: Ability = {
      id: `attack_${idSuffix}`,
      name: weapon.name,
      description: `Attack with ${weapon.name}.`,
      type: 'attack',
      cost: { type: isOffHand ? 'bonus' : 'action' },
      targeting: 'single_enemy',
      range: (() => {
        let baseRange = 1;
        if (weapon.properties?.some(p => p === 'reach')) baseRange = 2;
        const rangeProp = weapon.properties?.find(p => p.startsWith('range:'));
        if (rangeProp) {
          const match = rangeProp.match(/range:(\d+)/);
          if (match && match[1]) {
            baseRange = Math.max(baseRange, Math.floor(parseInt(match[1]) / 5));
          }
        }
        return baseRange;
      })(),
      effects: [{
        type: 'damage',
        value: 0, // Value 0 signals "roll weapon damage" to the system
        dice: weapon.damageDice || '1d4', // Default fallback if missing
        damageType: damageType
      }],
      icon: '⚔️',
      weapon: weapon, // Link source weapon
      isProficient: isProficient
    };

    // Attach Weapon Mastery if the character is proficient, has unlocked it, and the weapon supports it.
    if (isProficient && weapon.mastery && player.selectedWeaponMasteries?.includes(weapon.id)) {
      ability.mastery = weapon.mastery;
    }

    return ability;
  };

  if (mainHand) {
    abilities.push(createWeaponAbility(mainHand, 'main'));
  } else {
    // Unarmed Strike
    abilities.push({
      id: 'unarmed_strike',
      name: 'Unarmed Strike',
      description: 'A basic punch or kick. Melee Range (5 ft).',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 1,
      effects: [{ type: 'damage', value: 1 + getAbilityModifierValue(stats.strength), damageType: 'bludgeoning' }],
      icon: '✊'
    });
  }

  if (offHand && offHand.category && offHand.category.includes('Weapon')) {
    abilities.push(createWeaponAbility(offHand, 'off', true));
  }

  // ------------------------------------------------------------------
  // Universal Actions — available to all player characters
  // ------------------------------------------------------------------
  // These are standard D&D actions that every character can take regardless
  // of class or equipment. They're added after weapon abilities so they
  // appear at the end of the ability palette in the combat UI.
  //
  // - Dash: Doubles your movement for the turn (costs your Action).
  // - Disengage: Prevents opportunity attacks when you move away (costs Action).
  // - Stand Up: Rights yourself from the Prone condition. Per the 2024 PHB,
  //   this costs half your total Speed (not an Action). The 'movement-only'
  //   cost type deducts from remaining movement without consuming any action.
  //   The actual Prone removal happens in useActionExecutor.ts.
  // ------------------------------------------------------------------
  abilities.push(
    { id: 'dash', name: 'Dash', description: 'Gain extra movement for the turn.', type: 'movement', cost: { type: 'action' }, targeting: 'self', range: 0, effects: [{ type: 'movement', value: stats.speed }], icon: '🏃' },
    { id: 'disengage', name: 'Disengage', description: 'Prevent opportunity attacks.', type: 'utility', cost: { type: 'action' }, targeting: 'self', range: 0, effects: [], icon: '🛡️' },
    { id: 'stand_up', name: 'Stand Up', description: 'Right yourself from a Prone position. Costs half your Speed.', type: 'movement', cost: { type: 'movement-only', movementCost: Math.floor(stats.speed / 2) }, targeting: 'self', range: 0, effects: [], icon: '⬆️' }
  );

  const addClassFeatureAbility = (ability: Ability, limitedUseId?: string): void => {
    if (limitedUseId) {
      const limitedUse = player.limitedUses?.[limitedUseId];
      if (limitedUse) {
        const maxUses = typeof limitedUse.max === 'number' ? limitedUse.max : undefined;
        if (typeof maxUses === 'number') {
          ability.maxUses = maxUses;
        }
        if (typeof limitedUse.current === 'number') {
          ability.usesRemaining = limitedUse.current;
        }
      }
    }

    abilities.push(ability);
  };

  if (player.class.id === 'rogue') {
    abilities.push({ id: 'cunning_dash', name: 'Cunning Dash', description: 'Dash as a bonus action.', type: 'movement', cost: { type: 'bonus' }, targeting: 'self', range: 0, effects: [{ type: 'movement', value: stats.speed }], icon: '🏃' });
  }

  if (player.class.id === 'fighter') {
    abilities.push({ id: 'second_wind', name: 'Second Wind', description: 'Regain hit points.', type: 'utility', cost: { type: 'bonus', limitations: { oncePerTurn: true } }, targeting: 'self', range: 0, effects: [{ type: 'heal', value: 10 + (player.level || 1) }], icon: '➕' });
  }

  if (player.class.id === 'barbarian') {
    addClassFeatureAbility({
      id: 'rage',
      name: 'Rage',
      description: 'Enter a Rage as a bonus action.',
      type: 'utility',
      cost: { type: 'bonus' },
      targeting: 'self',
      range: 0,
      effects: [],
      icon: '🔥'
    }, 'rage');
  }

  if (player.class.id === 'monk' && (player.level || 1) >= 2) {
    addClassFeatureAbility({
      id: 'flurry_of_blows',
      name: 'Flurry of Blows',
      description: 'Use a bonus action to make additional unarmed strikes.',
      type: 'utility',
      cost: { type: 'bonus' },
      targeting: 'self',
      range: 0,
      effects: [],
      icon: '👊'
    });
  }

  if (player.class.id === 'bard') {
    addClassFeatureAbility({
      id: 'bardic_inspiration',
      name: 'Bardic Inspiration',
      description: 'Grant inspiration dice as a bonus action.',
      type: 'utility',
      cost: { type: 'bonus' },
      targeting: 'self',
      range: 0,
      effects: [],
      icon: '🎶'
    }, 'bardic_inspiration');
  }

  if (player.class.id === 'paladin' && (player.level || 1) >= 2) {
    addClassFeatureAbility({
      id: 'divine_smite',
      name: 'Divine Smite',
      description: 'Augment your next melee weapon hit with radiant damage.',
      type: 'utility',
      cost: { type: 'bonus' },
      targeting: 'self',
      range: 0,
      effects: [],
      icon: '✨'
    });
  }

  if (player.class.id === 'warlock') {
    addClassFeatureAbility({
      id: 'pact_magic',
      name: 'Pact Magic',
      description: 'Use your pact magic resource.',
      type: 'utility',
      cost: { type: 'free' },
      targeting: 'self',
      range: 0,
      effects: [],
      icon: '🕯️'
    });
  }

  // 2. Convert Spells to Combat Abilities using the Factory
  // THIS IS THE WIRING POINT: We iterate the known spell IDs, find the JSON data, and convert it.
  if (player.spellbook) {
    const spellsToCheck = [
      ...(player.spellbook.preparedSpells || []),
      ...(player.spellbook.cantrips || []),
      ...(player.spellbook.knownSpells || []) // For known casters like Bards/Sorcerers
    ];

    const uniqueSpellIds = Array.from(new Set(spellsToCheck));

    uniqueSpellIds.forEach(spellId => {
      const spellData = allSpells[spellId];
      if (spellData) {
        // Here we pass the JSON data to the factory.
        // The factory reads 'effects' array from the JSON (Gold Standard)
        // and returns an executable 'Ability' for the combat engine.
        const ability = createAbilityFromSpell(spellData as unknown as Spell, player);
        ability.spell = spellData; // Link original spell data
        abilities.push(ability);
      } else {
        // Fallback if spell data isn't loaded or available in allSpells
        console.warn(`CombatUtils: Spell data for '${spellId}' not found in allSpells context.`);
      }
    });
  }

  const combatChar: CombatCharacter = {
    id: player.id || `player_${player.name.toLowerCase().replace(' ', '_')}`,
    name: player.name,
    level: player.level || 1,
    // Carry the race so combat surfaces can use it — drives 3D race-specific
    // character visuals (CharacterActor) and makes race-gated targeting (e.g.
    // Hold/Charm Person, Sleep) correct. Shape matches the documented intent
    // (`['Humanoid', 'Elf']`).
    creatureTypes: ['Humanoid', player.race?.name].filter((s): s is string => !!s),
    class: player.class,
    position: { x: 0, y: 0 },
    stats,
    abilities,
    team: 'player',
    currentHP: player.hp,
    maxHP: player.maxHp,
    armorClass: player.armorClass || 10,
    baseAC: player.armorClass || 10,
    // Carry Hit Dice pools into combat so pool-based targeting can use them.
    hitPointDice: buildHitPointDicePools(player),
    initiative: 0,
    statusEffects: [],
    actionEconomy: {
      action: { used: false, remaining: 1 },
      bonusAction: { used: false, remaining: 1 },
      reaction: { used: false, remaining: 1 },
      legendary: { used: 0, total: 0 },
      movement: { used: 0, total: stats.speed },
      freeActions: 1,
    },
    spellbook: player.spellbook,
    spellSlots: player.spellSlots,    savingThrowProficiencies: player.savingThrowProficiencies,
    // WHAT CHANGED: Added feats array mapping.
    // WHY IT CHANGED: To support feat-based mechanics in the combat loop. 
    // By passing the feat IDs (e.g., ['great_weapon_master']) to the 
    // CombatCharacter, we allow the damage calculators and action 
    // handlers to apply bonus damage or special effects during a battle.
    feats: player.feats || [], // feat IDs (e.g. ['slasher', 'great_weapon_master'])
    resistances: player.resistances ?? player.race?.resistance,
    immunities: player.immunities,
    vulnerabilities: player.vulnerabilities,
    modifiers: player.modifiers ? {
      advantage: [...player.modifiers.advantage],
      disadvantage: [...player.modifiers.disadvantage],
      bonuses: [...player.modifiers.bonuses],
      baseArmorClass: player.modifiers.baseArmorClass,
      acBonus: player.modifiers.acBonus,
      reachBonus: player.modifiers.reachBonus,
      powerfulBuild: player.modifiers.powerfulBuild,
      unendingBreath: player.modifiers.unendingBreath,
      languages: player.modifiers.languages ? [...player.modifiers.languages] : undefined,
      skillProficiencies: player.modifiers.skillProficiencies ? [...player.modifiers.skillProficiencies] : [],
      weaponProficiencies: player.modifiers.weaponProficiencies ? [...player.modifiers.weaponProficiencies] : [],
      armorProficiencies: player.modifiers.armorProficiencies ? [...player.modifiers.armorProficiencies] : [],
      initiativeBonus: player.modifiers.initiativeBonus,
      initiativeProficiency: player.modifiers.initiativeProficiency,
      ignoreDifficultTerrain: player.modifiers.ignoreDifficultTerrain,
      breathWeapon: player.modifiers.breathWeapon ? { ...player.modifiers.breathWeapon } : undefined,
      savageAttacks: player.modifiers.savageAttacks,
    } : undefined,
    initiativeBonus: player.initiativeBonus,
    initiativeProficiency: player.initiativeProficiency,
    ignoreDifficultTerrain: player.ignoreDifficultTerrain,
  };

  // Add Breath Weapon as a Combat Ability
  if (player.modifiers?.breathWeapon) {
    const bw = player.modifiers.breathWeapon;
    let damageDice = bw.damageDice;
    bw.scaling.forEach(s => {
      if (player.level && player.level >= s.level) {
        damageDice = s.dice;
      }
    });

    const resourceKey = `racial_feature_${player.race.id}__breath_weapon__resource`;
    const limitedUse = player.limitedUses?.[resourceKey];

    combatChar.abilities.push({
      id: 'racial_breath_weapon',
      name: 'Breath Weapon',
      description: `Exhale destructive energy in a ${bw.areaSize}-foot ${bw.areaShape}.`,
      type: 'attack',
      targeting: 'area',
      range: bw.areaSize,
      areaShape: bw.areaShape,
      areaSize: bw.areaSize / 5, // Convert feet to grid tiles
      cost: { type: 'action' },
      saveDC: 8 + (player.proficiencyBonus || 2) + getAbilityModifierValue(player.finalAbilityScores.Constitution),
      saveAbility: bw.saveAbility,
      effects: [{
        type: 'damage',
        dice: damageDice,
        damageType: bw.damageType as any,
      }],
      usesRemaining: limitedUse?.current,
      maxUses: typeof limitedUse?.max === 'number' ? limitedUse.max : (player.proficiencyBonus || 2),
    });
  }

  // Basic Darkvision inference
  // TODO #1316(Depthcrawler): Replace with robust feature mapping from Race traits
  if (combatChar.stats.senses) {
      if (player.race.name.includes("Drow") || player.race.name.includes("Deep Gnome")) {
          combatChar.stats.senses.darkvision = 120;
      } else if (player.race.name.includes("Elf") || player.race.name.includes("Dwarf") || player.race.name.includes("Gnome") || player.race.name.includes("Tiefling")) {
          combatChar.stats.senses.darkvision = 60;
      }
  }

  return combatChar;
}

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
export function resolveAttack(
  d20Roll: number,
  modifiers: number,
  targetAC: number,
  critThreshold: number = 20
): AttackResult {
  const total = d20Roll + modifiers;
  let isHit = false;
  let isCritical = false;
  let isAutoMiss = false;

  if (d20Roll === 1) {
    isAutoMiss = true;
    isHit = false;
  } else if (d20Roll >= critThreshold) {
    isCritical = true;
    isHit = true;
  } else {
    isHit = total >= targetAC;
  }

  return { isHit, isCritical, isAutoMiss, total };
}
