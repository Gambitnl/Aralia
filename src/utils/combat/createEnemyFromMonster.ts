// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 01:25:32
 * Dependents: hooks/actions/handleEncounter.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file turns a lightweight encounter monster into a combat-ready enemy.
 *
 * The generated bestiary is large, so this adapter lives outside combatUtils.ts.
 * Most systems only need dice, distance, or damage helpers; they should not load
 * the whole monster registry unless a battle is actually being started.
 *
 * Called by: encounter start handlers and crime systems that need live enemies.
 * Depends on: runtimeMonsterRegistry for bestiary lookup, class data for fallback shape.
 */
import { CombatCharacter, CharacterStats } from '../../types/combat';
import { Monster } from '../../types';
import { ConditionName } from '../../types/spells';
import { CreatureType, CreatureTypeTraits } from '../../types/creatures';
import { CLASSES_DATA } from '../../data/classes';
import { getMonster } from '../../data/adapters/runtimeMonsterRegistry';

// ============================================================================
// Creature Trait Helpers
// ============================================================================
// This section turns broad creature tags such as "undead" into the combat
// immunities the spawned enemy should carry.
// ============================================================================

function computeConditionImmunities(tags: string[]): ConditionName[] {
  const immunities = new Set<ConditionName>();
  for (const tag of tags) {
    const type = (tag.charAt(0).toUpperCase() + tag.slice(1)) as CreatureType;
    const traits = CreatureTypeTraits[type];
    if (traits?.conditionImmunities) {
      traits.conditionImmunities.forEach(c => immunities.add(c));
    }
  }
  return Array.from(immunities);
}

// ============================================================================
// Enemy Conversion
// ============================================================================
// This section creates the temporary combat character used by the battle map.
// It prefers full bestiary data, but falls back to a generic enemy so a content
// mismatch does not crash the whole encounter.
// ============================================================================

export function createEnemyFromMonster(monster: Monster, index: number): CombatCharacter {
  const monsterData = getMonster(monster.name);

  if (!monsterData) {
    console.warn(`No data found for monster: ${monster.name}. Creating a generic enemy.`);
    const fallbackStats: CharacterStats = { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, speed: 30, cr: monster.cr || '1/4', senses: { darkvision: 0, blindsight: 0, tremorsense: 0, truesight: 0 } };
    const fallbackId = monster.name.toLowerCase().replace(/\s+/g, '_');
    return {
      id: `enemy_${fallbackId}_${index}`,
      name: `${monster.name} ${index + 1}`,
      level: parseFloat(monster.cr) || 1,
      class: CLASSES_DATA['fighter'],
      position: { x: 0, y: 0 },
      stats: fallbackStats,
      abilities: [
        { id: 'basic_attack', name: 'Attack', description: 'A basic attack.', type: 'attack', cost: { type: 'action' }, targeting: 'single_enemy', range: 1, effects: [{ type: 'damage', value: 4, damageType: 'bludgeoning' }], icon: 'Attack', isProficient: true },
        { id: 'stand_up', name: 'Stand Up', description: 'Right yourself from a Prone position. Costs half your Speed.', type: 'movement', cost: { type: 'movement-only', movementCost: Math.floor(fallbackStats.speed / 2) }, targeting: 'self', range: 0, effects: [], icon: 'Stand' }
      ],
      team: 'enemy',
      maxHP: 10,
      currentHP: 10,
      armorClass: 10,
      baseAC: 10,
      initiative: 0,
      statusEffects: [],
      actionEconomy: {
        action: { used: false, remaining: 1 },
        bonusAction: { used: false, remaining: 1 },
        reaction: { used: false, remaining: 1 },
        legendary: { used: 0, total: 0 },
        movement: { used: 0, total: 30 },
        freeActions: 1,
      },
    };
  }

  // Merge type-inferred immunities with explicit 5eTools conditionImmune entries.
  const typeInferred = computeConditionImmunities(monsterData.tags);
  const explicit: ConditionName[] = (monsterData.conditionImmunities || []) as ConditionName[];
  const conditionImmunities = Array.from(new Set([...typeInferred, ...explicit]));

  // Convert challenge rating into the numeric level-like field combat UI expects.
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
    id: `enemy_${monsterData.id}_${index}`,
    name: `${monsterData.name} ${index + 1}`,
    level: level || 1,
    class: CLASSES_DATA['fighter'],
    position: { x: 0, y: 0 },
    stats: monsterData.baseStats,
    abilities: [
      ...(monsterData.abilities || []),
      { id: 'stand_up', name: 'Stand Up', description: 'Right yourself from a Prone position. Costs half your Speed.', type: 'movement', cost: { type: 'movement-only', movementCost: Math.floor(monsterData.baseStats.speed / 2) }, targeting: 'self', range: 0, effects: [], icon: 'Stand' }
    ],
    team: 'enemy',
    maxHP: monsterData.maxHP,
    currentHP: monsterData.maxHP,
    armorClass: monsterData.armorClass || 10,
    baseAC: monsterData.armorClass || 10,
    initiative: 0,
    statusEffects: [],
    actionEconomy: {
      action: { used: false, remaining: 1 },
      bonusAction: { used: false, remaining: 1 },
      reaction: { used: false, remaining: 1 },
      legendary: {
        used: 0,
        total: monsterData.baseStats.legendaryActionsPerRound || 0
      },
      movement: { used: 0, total: monsterData.baseStats.speed },
      freeActions: 1,
    },
    resistances: monsterData.resistances,
    vulnerabilities: monsterData.vulnerabilities,
    immunities: monsterData.immunities,
    ...(monsterData.nonMagicalResistances && { nonMagicalResistances: monsterData.nonMagicalResistances }),
    ...(monsterData.nonMagicalImmunities && { nonMagicalImmunities: monsterData.nonMagicalImmunities }),
    ...(conditionImmunities.length > 0 && { conditionImmunities }),
  };
}
