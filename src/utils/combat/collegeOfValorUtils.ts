// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 12:39:45
 * Dependents: utils/combat/index.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * College of Valor (Bard) Combat Inspiration and Martial Training.
 *
 * Combat Inspiration lets the bard hand one Bardic Inspiration die to an ally,
 * who can then spend it to add the d6 to a damage roll or to their AC against an
 * attack. This file owns that hand-off and spend as two transactions so the
 * resource belongs to the bard while the outcome belongs to the ally, and it
 * applies the subclass's medium armor, shield, and martial weapon proficiencies
 * through the character's own proficiency lists.
 */

import type { ActiveCondition, CombatCharacter, StatusEffect } from '../../types/combat';
import { applyRuntimeStatusCondition } from './statusConditionUtils';
import { BARDIC_INSPIRATION_KEY } from './collegeOfLoreUtils';
import { rollDice } from './combatUtils';

export const COMBAT_INSPIRATION_STATUS_ID = 'combat_inspiration';
export const COMBAT_INSPIRATION_DIE = '1d6';

// ============================================================================
// Combat Inspiration Hand-off
// ============================================================================
// The bard pays one Bardic Inspiration die now, and the ally receives a
// Combat Inspiration status that later spend reads. Debit happens only when the
// hand-off is legal, so a grant never consumes a die without producing a die.
// ============================================================================

export interface CombatInspirationGrant {
  bard: CombatCharacter;
  ally: CombatCharacter;
  granted: boolean;
  failure?: 'no_bardic_inspiration';
}

export function grantCombatInspiration(
  bard: CombatCharacter,
  ally: CombatCharacter,
): CombatInspirationGrant {
  const pool = bard.limitedUses?.[BARDIC_INSPIRATION_KEY];
  if (!pool || (typeof pool.current === 'number' && pool.current <= 0)) {
    return { bard, ally, granted: false, failure: 'no_bardic_inspiration' };
  }

  const remaining = typeof pool.current === 'number' ? Math.max(0, pool.current - 1) : 0;
  const nextBard: CombatCharacter = {
    ...bard,
    limitedUses: {
      ...(bard.limitedUses ?? {}),
      [BARDIC_INSPIRATION_KEY]: { ...pool, current: remaining },
    },
  };

  const statusEffect: StatusEffect = {
    id: COMBAT_INSPIRATION_STATUS_ID,
    name: 'Combat Inspiration',
    type: 'buff',
    duration: 10,
    source: 'Combat Inspiration',
    sourceCasterId: bard.id,
    effect: { type: 'condition' },
  };
  const condition: ActiveCondition = {
    name: 'Combat Inspiration',
    duration: { type: 'rounds', value: 10 },
    appliedTurn: 0,
    source: 'Combat Inspiration',
    sourceCasterId: bard.id,
  };
  const nextAlly = applyRuntimeStatusCondition(ally, statusEffect, condition).character;

  return { bard: nextBard, ally: nextAlly, granted: true };
}

// ============================================================================
// Combat Inspiration Spend
// ============================================================================
// The ally consumes their held inspiration for one authored outcome: add the d6
// to a damage roll, or add it to their AC against an attack. The status is
// removed in the same transaction so a die cannot be spent twice.
// ============================================================================

export interface CombatInspirationSpend {
  ally: CombatCharacter;
  resolved: boolean;
  failure?: 'no_combat_inspiration';
  dieRolled?: number;
  bonus?: number;
}

export function hasCombatInspiration(ally: CombatCharacter): boolean {
  return (
    ally.statusEffects.some(effect => effect.id === COMBAT_INSPIRATION_STATUS_ID)
    || (ally.conditions ?? []).some(condition => condition.name === 'Combat Inspiration')
  );
}

export function resolveCombatInspirationSpend(
  ally: CombatCharacter,
  mode: 'damage' | 'ac',
  rng?: () => number,
): CombatInspirationSpend {
  if (!hasCombatInspiration(ally)) {
    return { ally, resolved: false, failure: 'no_combat_inspiration' };
  }

  const statusEffects = ally.statusEffects.filter(effect => effect.id !== COMBAT_INSPIRATION_STATUS_ID);
  const conditions = (ally.conditions ?? []).filter(condition => condition.name !== 'Combat Inspiration');
  const nextAlly: CombatCharacter = { ...ally, statusEffects, conditions };

  const dieRolled = rollDice(COMBAT_INSPIRATION_DIE, { rng });

  return {
    ally: nextAlly,
    resolved: true,
    dieRolled,
    bonus: dieRolled,
  };
}

// ============================================================================
// Martial Training Proficiencies
// ============================================================================
// The subclass grants medium armor, shields, and martial weapons. These are
// merged into the character's own proficiency lists so equipment validation
// reads the same lists the rest of the character sheet owns.
// ============================================================================

export const VALOR_MEDIUM_ARMOR = 'medium';
export const VALOR_SHIELD = 'shield';
export const VALOR_MARTIAL_WEAPONS = [
  'battleaxe',
  'glaive',
  'greataxe',
  'greatsword',
  'halberd',
  'lance',
  'longsword',
  'maul',
  'morningstar',
  'pike',
  'rapier',
  'scimitar',
  'shortsword',
  'trident',
  'warhammer',
  'war_pick',
];

export interface ValorProficiencies {
  armorProficiencies: string[];
  weaponProficiencies: string[];
}

export function applyValorMartialTraining(
  character: ValorProficiencies,
): ValorProficiencies {
  const armor = new Set((character.armorProficiencies ?? []).map(prof => prof.toLowerCase()));
  armor.add(VALOR_MEDIUM_ARMOR);
  armor.add(VALOR_SHIELD);

  const weapons = new Set((character.weaponProficiencies ?? []).map(prof => prof.toLowerCase()));
  for (const weapon of VALOR_MARTIAL_WEAPONS) {
    weapons.add(weapon);
  }

  return {
    armorProficiencies: Array.from(armor),
    weaponProficiencies: Array.from(weapons),
  };
}
