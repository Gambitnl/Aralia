
/**
 * @file src/utils/combatUtils.ts
 * Utility functions for the combat system.
 */
import { CombatAction, CombatCharacter, Position, CharacterStats, Ability } from '../types/combat';
import { PlayerCharacter, Monster, Spell } from '../types';
import { CLASSES_DATA, MONSTERS_DATA } from '../constants';
import { createAbilityFromSpell } from './spellAbilityFactory';

// Re-export for consumers
export { createAbilityFromSpell };

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
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

export function getDistance(pos1: Position, pos2: Position): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  // Use Chebyshev distance (moves on a grid including diagonals)
  return Math.max(Math.abs(dx), Math.abs(dy));
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
        baseInitiative: Math.floor((player.finalAbilityScores.Dexterity - 10) / 2),
        speed: player.speed,
        cr: 'N/A',
    };
    
    // 1. Basic Physical Abilities
    const abilities: Ability[] = [
        { id: 'melee_attack', name: 'Attack', description: 'A basic melee strike.', type: 'attack', cost: { type: 'action' }, targeting: 'single_enemy', range: 1, effects: [{type: 'damage', value: 5, damageType: 'physical'}], icon: '⚔️' },
        { id: 'dash', name: 'Dash', description: 'Gain extra movement for the turn.', type: 'movement', cost: { type: 'action' }, targeting: 'self', range: 0, effects: [{type: 'movement', value: stats.speed}], icon: '🏃' },
         { id: 'disengage', name: 'Disengage', description: 'Prevent opportunity attacks.', type: 'utility', cost: { type: 'action' }, targeting: 'self', range: 0, effects: [], icon: '🛡️' },
    ];
    
    if (player.class.id === 'rogue') {
         abilities.push({ id: 'cunning_dash', name: 'Cunning Dash', description: 'Dash as a bonus action.', type: 'movement', cost: { type: 'bonus' }, targeting: 'self', range: 0, effects: [{type: 'movement', value: stats.speed}], icon: '🏃' });
    }
    
    if (player.class.id === 'fighter') {
        abilities.push({ id: 'second_wind', name: 'Second Wind', description: 'Regain hit points.', type: 'utility', cost: { type: 'bonus', limitations: { oncePerTurn: true } }, targeting: 'self', range: 0, effects: [{type: 'heal', value: 10 + (player.level || 1)}], icon: '➕' });
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
                const ability = createAbilityFromSpell(spellData, player);
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
        class: player.class,
        position: {x: 0, y: 0}, 
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
            class: CLASSES_DATA['fighter'], 
            position: {x: 0, y: 0},
            stats: fallbackStats,
            abilities: [{ id: 'basic_attack', name: 'Attack', description: 'A basic attack.', type: 'attack', cost: { type: 'action' }, targeting: 'single_enemy', range: 1, effects: [{type: 'damage', value: 4, damageType: 'physical'}], icon: '⚔️' }],
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
    
    return {
        id: `enemy_${monsterId}_${index}`,
        name: `${monsterData.name} ${index + 1}`,
        class: CLASSES_DATA['fighter'], // Needs a class for structure
        position: {x: 0, y: 0},
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
