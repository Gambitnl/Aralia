/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/utils/combatUtils.ts
 * Utility functions for the combat system.
 */
import { BattleMapData, CombatAction, CombatCharacter, Position, CharacterStats, Ability, DamageNumber, StatusEffect, AreaOfEffect, AbilityEffect } from '../types/combat';
import { PlayerCharacter, Monster, Item } from '../types';
import { Spell } from '../types/spells'; // Explicit import to avoid conflicts
import { CLASSES_DATA, MONSTERS_DATA } from '../constants';
import { createAbilityFromSpell } from './spellAbilityFactory';
import { isWeaponProficient } from './weaponUtils';
import { generateId } from './idGenerator';
import { getAbilityModifierValue } from './statUtils';

import { bresenhamLine } from './lineOfSight';

// Re-export for consumers
export { createAbilityFromSpell, generateId };

/**
 * Calculates cover bonus for a target from a specific origin.
 * @param origin - The attacker's position.
 * @param target - The target's position.
 * @param mapData - The battle map data.
 * @returns The cover bonus to AC (0, 2, or 5).
 */
export function calculateCover(origin: Position, target: Position, mapData: BattleMapData): number {
  if (!mapData) return 0;

  // Get the line of tiles between attacker and target
  const line = bresenhamLine(origin.x, origin.y, target.x, target.y);

  // Check each tile along the path, excluding start and end
  // If any tile provides cover, grant +2 AC (Half Cover)
  // TODO: Add logic for Three-Quarters Cover (+5) if we have height/obstacle type data
  for (let i = 1; i < line.length - 1; i++) {
    const point = line[i];
    const tile = mapData.tiles.get(`${point.x}-${point.y}`);

    if (tile && tile.providesCover) {
      // Found an obstacle that provides cover
      return 2;
    }
  }

  return 0;
}

/**
 * Parses a dice notation string (e.g., '2d8', '3d6+5') and returns the rolled total.
 * Supports complex formulas like '1d8 + 1d6 + 2'.
 * @param diceString The dice notation to roll (e.g., '2d8+3')
 * @returns The total rolled value
 */
export function rollDice(diceString: string): number {
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
    // Avoid infinite loops if regex matches empty string (though ours shouldn't)
    if (match.index === regex.lastIndex) {
      regex.lastIndex++;
    }

    const sign = match[1] === '-' ? -1 : 1;

    if (match[2] && match[3]) {
      // It's a dice roll: XdY
      const numDice = parseInt(match[2], 10);
      const dieSize = parseInt(match[3], 10);
      let subTotal = 0;
      for (let i = 0; i < numDice; i++) {
        subTotal += Math.floor(Math.random() * dieSize) + 1;
      }
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
    case 'ability':
      const ability = character.abilities.find(a => a.id === action.abilityId);
      return `${character.name} casts ${ability?.name || 'a spell'}`;
    case 'end_turn':
      return `${character.name} ends their turn`;
    default:
      return `${character.name} performs an action`;
  }
}

/**
 * Calculates the distance between two positions in tiles.
 * Uses Chebyshev distance (5-5-5 rule) to support 8-way movement on the grid.
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
 * A simple damage calculation placeholder.
 * @param baseDamage The base damage of the ability.
 * @param caster The character using the ability.
 * @param target The character being targeted.
 * @returns The calculated damage number.
 */
export function calculateDamage(baseDamage: number, caster: CombatCharacter, target: CombatCharacter): number {
  // In a real system, we would check for resistance/vulnerability here
  // based on damageType vs target.stats or target.tags
  return baseDamage;
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
 * @param player - The PlayerCharacter object.
 * @param allSpells - Dictionary of all spell data, needed to hydrate the spellbook.
 * @returns A CombatCharacter object.
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
        const ability = createAbilityFromSpell(spellData as any, player);
        ability.spell = spellData; // Link original spell data
        abilities.push(ability);
      } else {
        // Fallback if spell data isn't loaded or available in allSpells
        // console.warn(`CombatUtils: Spell data for '${spellId}' not found in context.`);
      }
    });
  }

  return {
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
  };
}

/**
 * Converts a Monster from the encounter generator into a CombatCharacter for the battle map.
 * @param monster - The Monster object from the generated encounter.
 * @param index - A unique index for this monster instance.
 * @returns A CombatCharacter object representing an enemy.
 */
export function createEnemyFromMonster(monster: Monster, index: number): CombatCharacter {
  const monsterId = monster.name.toLowerCase().replace(/\s+/g, '_');
  const monsterData = MONSTERS_DATA[monsterId];

  if (!monsterData) {
    console.warn(`No data found for monster: ${monster.name}. Creating a generic enemy.`);
    const fallbackStats: CharacterStats = { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, speed: 30, cr: monster.cr || '1/4' };
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
  };
}
