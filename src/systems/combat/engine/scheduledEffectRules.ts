/**
 * @file systems/combat/engine/scheduledEffectRules.ts
 * Pure rules for scheduled spell effects: source-link cleanup and keep-after-trigger.
 *
 * C2 (agora-9ed9.2): moved out of hooks/combat/engine/useCombatEngine.ts so the
 * rules can be read and tested without React. Bodies are unchanged; values the
 * hook used to close over now arrive through a context object under the same
 * names. The hook keeps a useCallback wrapper with the original dependency list,
 * so callback identity and phase ownership do not change.
 *
 * Called by: hooks/combat/engine/useCombatEngine.ts
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 22:14:42
 * Dependents: hooks/combat/engine/useCombatEngine.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { CombatCharacter } from '../../../types/combat';
import { ScheduledSpellEffect } from '../../../systems/spells/effects';
import { removeRepeatSaveLinkedEffects } from '../../../utils/combat/repeatSaveUtils';

export function removeScheduledSourceLinks(
    character: CombatCharacter,
    scheduledEffect: ScheduledSpellEffect,
): CombatCharacter {
    const ownedStatusIds = character.statusEffects
        .filter(status => (
            status.sourceSpellId === scheduledEffect.spellId
            && status.sourceCasterId === scheduledEffect.casterId
        ))
        .map(status => status.id);

    return removeRepeatSaveLinkedEffects(character, ownedStatusIds).character;
}

export function shouldKeepScheduledEffectAfterTrigger(
    scheduledEffect: ScheduledSpellEffect,
    currentTurnNumber: number,
): boolean {
    if (scheduledEffect.expiresAtRound && scheduledEffect.expiresAtRound <= currentTurnNumber) {
        return false;
    }

    return scheduledEffect.effects.some(effect => {
        const trigger = effect.trigger as { frequency?: string } | undefined;
        const frequency = scheduledEffect.recurringMechanic?.frequency ?? trigger?.frequency;
        return !frequency || frequency === 'every_time' || frequency === 'first_per_turn';
    });
}
