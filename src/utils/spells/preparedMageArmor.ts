/** Projects an actual, timed Mage Armor cast into the existing AC owners.
 * The saved event supplies identity and lifetime; canonical spell data supplies
 * the formula. Reading it never spends a second slot or restarts its clock.
 * Similar names and custom status markers are deliberately left alone. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 02/11/2026, 19:20:11
 * Dependents: components/CharacterSheet/Overview/CharacterOverview.tsx, state/reducers/characterReducer.ts, utils/character/statUtils.ts, utils/combat/combatUtils.ts, utils/spells/outOfCombatCasting.ts, utils/spells/preparedCombatEffects.ts, utils/spells/worldTimedEffects.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import mageArmor from '../../../public/data/spells/level-1/mage-armor.json';
import type { PlayerCharacter } from '../../types';
import type { StatusEffect } from '../../types/effects';

const defense = mageArmor.effects.find(effect => effect.type === 'DEFENSIVE'
  && effect.defenseType === 'set_base_ac' && effect.condition.type === 'always');

export function isPreparedMageArmor(effect: StatusEffect): boolean {
  const clock = effect.worldTime;
  return effect.type === 'buff' && effect.duration > 0
    && effect.sourceSpellId === mageArmor.id && effect.name === mageArmor.name
    && effect.source === mageArmor.name && !!effect.sourceCasterId
    && effect.id === `ooc-${mageArmor.id}-${effect.sourceCasterId}`
    && effect.sourceCastLevel !== undefined && Number.isInteger(effect.sourceCastLevel)
    && effect.sourceCastLevel >= mageArmor.level && effect.sourceCastLevel <= 9
    && effect.requiresConcentration === false && !!clock
    && Number.isFinite(clock.appliedAtMs) && Number.isFinite(clock.expiresAtMs)
    && clock.expiresAtMs > clock.appliedAtMs;
}

export function preparedMageArmorMechanics(character: PlayerCharacter):
  { baseAC: number; baseACFormula: string } | undefined {
  if (character.equippedItems?.Torso?.type === 'armor'
    || !character.statusEffects?.some(isPreparedMageArmor)
    || !defense || !Number.isFinite(defense.value) || defense.value <= 0) return undefined;
  return {baseAC: defense.value, baseACFormula: defense.baseACFormula};
}
