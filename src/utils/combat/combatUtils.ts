// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file is part of a complex dependency web.
 * 
 * Last Sync: 26/01/2026, 01:38:12
 * Dependents: DiceService.ts, PreviewCombatSandbox.tsx, combat/index.ts, combatUtils.ts, mechanicsUtils.ts, quickCharacterGenerator.ts, savingThrowUtils.ts
 * Imports: 12 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/utils/combatUtils.ts
 * Central utility module for the combat system ("God Object").
 *
 * This module aggregates logic for:
 * 1. Dice rolling and damage calculation (D&D 5e rules).
 * 2. Grid geometry (Cover, AoE, Distance).
 * 3. Entity conversion (Player/Monster -> CombatCharacter).
 *
 * @see src/utils/physicsUtils.ts - For movement physics (jumping, falling).
 * @see src/types/combat.ts - For core combat type definitions.
 * @see src/commands/base/SpellCommand.ts - For the Command pattern consuming these utilities.
 */
import { BattleMapData, CombatAction, CombatCharacter, Position, CharacterStats, Ability, DamageNumber, StatusEffect, AreaOfEffect, AbilityEffect } from '../../types/combat';
import { PlayerCharacter, Monster, Item } from '../../types';
// TODO(lint-intent): 'ConditionName' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
//
// IMPROVEMENT OPPORTUNITY: This unused import suggests incomplete integration of condition handling.
// Consider either:
// 1. Implementing condition-based combat mechanics that utilize ConditionName type
// 2. Removing the import to reduce module surface area and potential confusion
// 3. Creating a dedicated conditions module that handles status effect processing
import { Spell, DamageType, ConditionName as _ConditionName } from '../../types/spells'; // Explicit import to avoid conflicts
import { CLASSES_DATA } from '../../data/classes';
import { MONSTERS_DATA } from '../../data/monsters';
import { createAbilityFromSpell } from '../character/spellAbilityFactory';
import { isWeaponProficient } from '../character/weaponUtils';
import { generateId } from '../core/idGenerator';
import { getAbilityModifierValue } from '../character/statUtils';
import { buildHitPointDicePools } from '../character/characterUtils';
import { ResistanceCalculator } from './resistanceUtils';

import { bresenhamLine } from '../spatial/lineOfSight';

// Re-export for consumers
export { createAbilityFromSpell, generateId, ResistanceCalculator };

// TODO(Mechanist): Wire up physicsUtils (fall damage, jumping) into movement logic.
// TODO(Mechanist): Wire up `calculateExhaustionEffects` from `physicsUtils.ts` to `createPlayerCombatCharacter` (apply speed/d20 penalties).
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

  // 3. Must not be incapacitated
  // Conditions that prevent reactions: Incapacitated, Paralyzed, Petrified, Stunned, Unconscious
  // Note: Sleep (Unconscious) and Hypnotic Pattern (Incapacitated) are covered here.
  const incapacitatedConditions: string[] = ['Incapacitated', 'Paralyzed', 'Petrified', 'Stunned', 'Unconscious'];

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
function rollDieGroup(count: number, sides: number, minRoll: number = 1): number {
    // TODO(FEATURES): Route dice rolls through a secure or server-validated RNG to prevent client-side manipulation.
    // (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).
    let subTotal = 0;
  for (let i = 0; i < count; i++) {
    let roll = Math.floor(Math.random() * sides) + 1;
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
export function rollDice(diceString: string): number {
  return rollDamage(diceString, false);
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
export function rollDamage(diceString: string, isCritical: boolean, minRoll: number = 1): number {
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

      const subTotal = rollDieGroup(actualNumDice, dieSize, minRoll);
      total += sign * subTotal;
    } else if (match[4]) {
      // It's a flat number
      const val = parseInt(match[4], 10);
      total += sign * val;
    }
  }

  return total;
}

export function getActionMessage(action: CombatAction, character: CombatCharacter): string {
  switch (action.type) {
    case 'move':
      return `${character.name} moves to (${action.targetPosition?.x}, ${action.targetPosition?.y})`;
    case 'ability': {
      const ability = character.abilities.find(a => a.id === action.abilityId);
      return `${character.name} casts ${ability?.name || 'a spell'}`;
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
  damageType?: string
): number {
  if (!damageType || baseDamage <= 0) return Math.max(0, baseDamage);

  return ResistanceCalculator.applyResistances(
    baseDamage,
    damageType as DamageType,
    target,
    caster
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
    baseInitiative: getAbilityModifierValue(player.finalAbilityScores.Dexterity),
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
      range: (weapon.properties?.some((p) => p === 'reach')) ? 2 : 1, // Simple reach check
      // For ranged weapons, we'd check properties too
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
      description: 'A basic punch or kick.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 1,
      effects: [{ type: 'damage', value: 1 + getAbilityModifierValue(stats.strength), damageType: 'physical' }],
      icon: '✊'
    });
  }

  if (offHand && offHand.category && offHand.category.includes('Weapon')) {
    abilities.push(createWeaponAbility(offHand, 'off', true));
  }

  // Universal Actions
  abilities.push(
    { id: 'dash', name: 'Dash', description: 'Gain extra movement for the turn.', type: 'movement', cost: { type: 'action' }, targeting: 'self', range: 0, effects: [{ type: 'movement', value: stats.speed }], icon: '🏃' },
    { id: 'disengage', name: 'Disengage', description: 'Prevent opportunity attacks.', type: 'utility', cost: { type: 'action' }, targeting: 'self', range: 0, effects: [], icon: '🛡️' }
  );

  if (player.class.id === 'rogue') {
    abilities.push({ id: 'cunning_dash', name: 'Cunning Dash', description: 'Dash as a bonus action.', type: 'movement', cost: { type: 'bonus' }, targeting: 'self', range: 0, effects: [{ type: 'movement', value: stats.speed }], icon: '🏃' });
  }

  if (player.class.id === 'fighter') {
    abilities.push({ id: 'second_wind', name: 'Second Wind', description: 'Regain hit points.', type: 'utility', cost: { type: 'bonus', limitations: { oncePerTurn: true } }, targeting: 'self', range: 0, effects: [{ type: 'heal', value: 10 + (player.level || 1) }], icon: '➕' });
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
        // console.warn(`CombatUtils: Spell data for '${spellId}' not found in context.`);
      }
    });
  }

  const combatChar: CombatCharacter = {
    id: player.id || `player_${player.name.toLowerCase().replace(' ', '_')}`,
    name: player.name,
    level: player.level || 1,
    class: player.class,
    position: { x: 0, y: 0 },
    stats,
    abilities,
	    team: 'player',
	    currentHP: player.hp,
	    maxHP: player.maxHp,
	    // Carry Hit Dice pools into combat so pool-based targeting can use them.
	    hitPointDice: buildHitPointDicePools(player),
	    initiative: 0,
	    statusEffects: [],
	    actionEconomy: {
	      action: { used: false, remaining: 1 },
      bonusAction: { used: false, remaining: 1 },
      reaction: { used: false, remaining: 1 },
      movement: { used: 0, total: stats.speed },
      freeActions: 1,
    },
    spellbook: player.spellbook,
    spellSlots: player.spellSlots,
    savingThrowProficiencies: player.savingThrowProficiencies,
    feats: (player.featChoices ? Object.values(player.featChoices).map((f: any) => f.featId) : []) as string[], // Map player feats to combat character
    resistances: (player.race as any).resistance as import('../../types').DamageType[] | undefined, // TODO(lint-intent): Align Race.resistances shape with DamageType[]
  };

  // Basic Darkvision inference
  // TODO(Depthcrawler): Replace with robust feature mapping from Race traits
  if (combatChar.stats.senses) {
      if (player.race.name.includes("Drow") || player.race.name.includes("Deep Gnome")) {
          combatChar.stats.senses.darkvision = 120;
      } else if (player.race.name.includes("Elf") || player.race.name.includes("Dwarf") || player.race.name.includes("Gnome") || player.race.name.includes("Tiefling")) {
          combatChar.stats.senses.darkvision = 60;
      }
  }

  return combatChar;
}

/**
 * Converts a Monster from the encounter generator into a CombatCharacter for the battle map.
 *
 * WHY:
 * Encounters are generated as lightweight `Monster` templates. The combat engine requires
 * unique instances with tracking for HP, status effects, and position.
 *
 * HOW:
 * - Looks up the full monster statistics in `MONSTERS_DATA` using the name.
 * - If data is missing (e.g., content mismatch), falls back to a generic "Fighter" template
 *   to prevent the game from crashing.
 * - Assigns a unique ID incorporating the index to distinguish identical enemies (e.g., "Goblin 1", "Goblin 2").
 *
 * CURRENT FUNCTIONALITY:
 * - Creates unique combat instances from monster templates
 * - Handles missing monster data with graceful fallbacks
 * - Supports Challenge Rating conversion to level equivalents
 * - Assigns unique identifiers for multi-enemy encounters
 * - Provides basic combat stats and abilities from monster data
 *
 * IMPROVEMENT OPPORTUNITIES:
 * 1. DATA INTEGRITY: Fallback system masks underlying data issues
 *    - Add logging/alerting for missing monster data
 *    - Implement data validation during encounter generation
 *    - Create better fallback templates based on monster category
 * 2. PERFORMANCE: Lookup-based approach doesn't scale well
 *    - Consider pre-loading monster data into memory
 *    - Implement lazy loading with caching strategy
 *    - Add bulk creation methods for large encounters
 * 3. CUSTOMIZATION: Limited support for monster variants
 *    - Add support for elite/weak monster modifiers
 *    - Implement dynamic stat scaling based on party size
 *    - Support for temporary monster buffs/debuffs
 * 4. MAINTAINABILITY: Hard-coded class assignment ('fighter') is inflexible
 *    - Create monster-type specific combat behaviors
 *    - Implement proper monster AI integration
 *    - Add support for legendary actions and lair actions
 *
 * @param monster - The lightweight Monster template.
 * @param index - Unique index for this instance (0-based).
 * @returns A CombatCharacter object representing an enemy.
 */
export function createEnemyFromMonster(monster: Monster, index: number): CombatCharacter {
  const monsterId = monster.name.toLowerCase().replace(/\s+/g, '_');
  const monsterData = MONSTERS_DATA[monsterId];

  if (!monsterData) {
    console.warn(`No data found for monster: ${monster.name}. Creating a generic enemy.`);
    const fallbackStats: CharacterStats = { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, speed: 30, cr: monster.cr || '1/4', senses: { darkvision: 0, blindsight: 0, tremorsense: 0, truesight: 0 } };
    return {
      id: `enemy_${monsterId}_${index}`,
      name: `${monster.name} ${index + 1}`,
      level: parseFloat(monster.cr) || 1,
      class: CLASSES_DATA['fighter'],
      position: { x: 0, y: 0 },
      stats: fallbackStats,
      abilities: [{ id: 'basic_attack', name: 'Attack', description: 'A basic attack.', type: 'attack', cost: { type: 'action' }, targeting: 'single_enemy', range: 1, effects: [{ type: 'damage', value: 4, damageType: 'physical' }], icon: '⚔️', isProficient: true }],
      team: 'enemy',
      maxHP: 10,
      currentHP: 10,
      initiative: 0,
      statusEffects: [],
      actionEconomy: {
        action: { used: false, remaining: 1 },
        bonusAction: { used: false, remaining: 1 },
        reaction: { used: false, remaining: 1 },
        movement: { used: 0, total: 30 },
        freeActions: 1,
      },
    };
  }

  // Parse CR to number for level
  let level = 1;
  if (monsterData.baseStats.cr) {
    if (monsterData.baseStats.cr.includes('/')) {
      const [n, d] = monsterData.baseStats.cr.split('/');
      level = parseInt(n) / parseInt(d);
    } else {
      level = parseFloat(monsterData.baseStats.cr);
    }
  }

  return {
    id: `enemy_${monsterId}_${index}`,
    name: `${monsterData.name} ${index + 1}`,
    level: level || 1,
    class: CLASSES_DATA['fighter'], // Needs a class for structure
    position: { x: 0, y: 0 },
    stats: monsterData.baseStats,
    abilities: monsterData.abilities,
    team: 'enemy',
    maxHP: monsterData.maxHP,
    currentHP: monsterData.maxHP,
    initiative: 0,
    statusEffects: [],
    actionEconomy: {
      action: { used: false, remaining: 1 },
      bonusAction: { used: false, remaining: 1 },
      reaction: { used: false, remaining: 1 },
      movement: { used: 0, total: monsterData.baseStats.speed },
      freeActions: 1,
    },
    resistances: monsterData.resistances,
    vulnerabilities: monsterData.vulnerabilities,
    immunities: monsterData.immunities,
  };
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
