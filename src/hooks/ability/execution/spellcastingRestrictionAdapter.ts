/**
 * Effectful pre-cast save adapter. Pure DC and receipt rules live in systems;
 * rolls, optional logs and failure notification remain in their original order.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 22:14:42
 * Dependents: hooks/ability/execution/spellExecutionFlow.ts, hooks/ability/useAbilityExecution.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { CombatCharacter, CombatLogEntry } from "../../../types/combat";
import type { Spell } from "../../../types/spells";
import { getSpellcastingRestrictionContext, getSpellcastingRestrictionDC, resolveSpellcastingRestrictionAttempt, getSpellcastingRestrictionFailureMessage } from "../../../systems/combat/spellcastingRestrictionResolution";
import { generateId } from "../../../utils/combat";
import { rollSavingThrow } from "../../../utils/character";
export const resolveSpellcastingRestrictions = (
  caster: CombatCharacter,
  characters: CombatCharacter[],
  spell: Spell,
  onLogEntry?: (entry: CombatLogEntry) => void,
  onNotification?: (message: string, type: 'info' | 'error' | 'warning' | 'success') => void
): boolean => {
  const { liveCaster, restrictions } = getSpellcastingRestrictionContext(caster, characters);
  for (const restriction of restrictions) {
    const saveDC = getSpellcastingRestrictionDC(liveCaster, characters, restriction);
    // Source metadata permits free-form save labels. Keep the existing roll
    // adapter behavior for those labels; do not normalize or discard them here.
    const saveResult = rollSavingThrow(liveCaster, restriction.saveType as Parameters<typeof rollSavingThrow>[1], saveDC);
    const attempt = resolveSpellcastingRestrictionAttempt(liveCaster, spell, restriction, saveDC, saveResult);
    onLogEntry?.({ id: generateId(), timestamp: Date.now(), ...attempt.saveLog });
    if (!saveResult.success) {
      // A log callback can update the roster; calculate failure text afterwards.
      const message = getSpellcastingRestrictionFailureMessage(liveCaster, spell, restriction);
      onNotification?.(message, 'warning');
      const data = { spellId: spell.id, preCastRestriction: true, castingFailed: true };
      onLogEntry?.({
        id: generateId(), timestamp: Date.now(), type: 'action', message,
        characterId: liveCaster.id, targetIds: [liveCaster.id], data
      });
      return false;
    }
  }
  return true;
};
