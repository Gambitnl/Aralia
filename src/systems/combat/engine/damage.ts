/**
 * @file systems/combat/engine/damage.ts
 * Applies one damage packet: defense, death saves, concentration, zones and repeat saves.
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
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { CombatCharacter } from '../../../types/combat';
import { generateId, calculateDamageWithDefense } from '../../../utils/combat';
import { rollDice } from '../../../systems/dice/rollers';
import { checkConcentration } from '../../../utils/character';
import { applyDamageAndCheckDowned } from '../../../utils/combat/deathSaveUtils';
import { resolveOnDamageSpellEffect } from '../../../systems/spells/effects/onDamageSpellEffects';
import type { DamageResolutionContext } from './engineContextTypes';

export function resolveDamage(
    ctx: DamageResolutionContext,
    character: CombatCharacter,
    amount: number,
    source: string,
    damageType?: string,
    currentTurnNumber = 0,
    sourceCharacter?: CombatCharacter,
    damageTrigger?: 'turn_start' | 'turn_end' | 'on_start_turn_in_area' | 'on_end_turn_in_area',
): CombatCharacter {
    const { addDamageNumber, breakConcentrationThroughCommandLayer, characters, concentrationSaveRng, onLogEntry, processRepeatSaves, spellZones } = ctx;
    let updatedCharacter = { ...character };

    // The same defense calculator serves immediate, environmental, and
    // scheduled packets. A known owner is passed through for source feats;
    // environmental callers remain source-less through the optional field.
    // CMB-GAP-002 (2026-09-09): switched from `calculateDamage` to
    // `calculateDamageWithDefense`. Both call the same ResistanceCalculator
    // breakdown, so `finalDamage` is identical and behavior is preserved;
    // the wider return also carries the resistance/vulnerability/immunity
    // flags and structured tags that used to be computed and thrown away
    // here, leaving the combat log with no defense metadata to show.
    const triggeringDefense = calculateDamageWithDefense(amount, sourceCharacter ?? null, character, damageType, {
        spellZones,
        characters
    });
    const triggeringDamage = triggeringDefense.finalDamage;
    const onDamageResolution = resolveOnDamageSpellEffect(
        character,
        damageType,
        currentTurnNumber,
        triggeringDamage
    );
    const extraDamage = onDamageResolution.damageDice
        ? rollDice(onDamageResolution.damageDice)
        : 0;

    // Fold any matching rider into the same typed damage packet. This lets
    // Elemental Bane suppress resistance and lets vulnerability or immunity
    // affect both the triggering and extra damage consistently.
    updatedCharacter = onDamageResolution.character;
    // The rider-folded recomputation is the packet actually applied, so its
    // breakdown is the one the log should describe. When no rider fired we
    // reuse the triggering breakdown rather than recomputing it.
    const finalDefense = extraDamage > 0
        ? calculateDamageWithDefense(amount + extraDamage, sourceCharacter ?? null, updatedCharacter, damageType, {
            spellZones,
            characters
        })
        : triggeringDefense;
    const finalAmount = finalDefense.finalDamage;
    const defenseTagSuffix = finalDefense.tags.length > 0 ? ` ${finalDefense.tags.join(' ')}` : '';

    const updatedTarget = applyDamageAndCheckDowned(updatedCharacter, finalAmount);
    updatedCharacter = {
        ...updatedCharacter,
        currentHP: updatedTarget.currentHP,
        tempHP: updatedTarget.tempHP,
        temporaryHitPointSource: updatedTarget.temporaryHitPointSource,
        deathSaves: updatedTarget.deathSaves,
        statusEffects: updatedTarget.statusEffects,
        conditions: updatedTarget.conditions,
        damagedThisTurn: updatedTarget.damagedThisTurn
    };

    addDamageNumber(finalAmount, updatedCharacter.position, 'damage');

    // Check for death
    const isDeath = updatedCharacter.currentHP === 0 && character.currentHP > 0;

    onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'damage',
        // CMB-GAP-002: defense tags are appended to the text so the legacy
        // (non-rich) log still renders "[Resisted: Fire (-50%)]" pills via
        // the existing tokenizer. The suffix is empty when no defense
        // applied, so ordinary damage lines are unchanged.
        message: `${character.name} takes ${finalAmount} ${damageType || ''} damage from ${source}${defenseTagSuffix}${isDeath ? ' and is defeated!' : ''}`,
        characterId: character.id,
        data: {
            damage: amount,
            damageType,
            source,
            damageDealt: finalAmount,
            trigger: damageTrigger,
            // CMB-GAP-002: structured defense metadata. The adapter copies
            // these into DamageMessageData, and CombatLog renders them as
            // Resisted / Vulnerable / Immune badges in rich display mode.
            isResisted: finalDefense.effectiveResistance,
            resistanceApplied: finalDefense.effectiveResistance,
            resistedDamageType: finalDefense.effectiveResistance ? damageType : undefined,
            isVulnerable: finalDefense.isVulnerable,
            vulnerabilityApplied: finalDefense.isVulnerable,
            vulnerableDamageType: finalDefense.isVulnerable ? damageType : undefined,
            isImmune: finalDefense.isImmune,
            immunityApplied: finalDefense.isImmune,
            immuneDamageType: finalDefense.isImmune ? damageType : undefined,
            defenseTags: finalDefense.tags.length > 0 ? finalDefense.tags : undefined,
            // Delayed and area-phase callers pass the owning spell id as
            // `source`. Preserve that provenance even when no on-damage
            // rider fired during this packet.
            spellId: onDamageResolution.sourceSpellId
                ?? (damageTrigger ? source : undefined),
            isDeath,
            targetTags: character.creatureTypes
        }
    });

    // --- Concentration ---
    // Any damage can break concentration, not only damage a command
    // delivered. The DC is 10 or half the damage actually taken, whichever
    // is higher, measured after defenses exactly as the command path
    // measures it.
    //
    // The 0 HP case is deliberately NOT handled here. `useTurnManager`
    // already ends concentration for a creature that drops, and it logs and
    // cleans as it does so; rolling here as well would clean twice and log
    // twice for one packet.
    if (character.concentratingOn && finalAmount > 0 && updatedCharacter.currentHP > 0) {
        const check = concentrationSaveRng
            ? checkConcentration(updatedCharacter, finalAmount, undefined, concentrationSaveRng)
            : checkConcentration(updatedCharacter, finalAmount);

        onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'status',
            message: check.success
                ? `${character.name} maintains concentration (${check.roll} vs DC ${check.dc})`
                : `${character.name} fails concentration save (${check.roll} vs DC ${check.dc})`,
            characterId: character.id,
            data: {
                spellId: character.concentratingOn.spellId,
                saveDC: check.dc,
                rollResult: check.roll,
                saveResult: check.success,
            },
        });

        if (!check.success) {
            updatedCharacter = breakConcentrationThroughCommandLayer(updatedCharacter);
        }
    }

    updatedCharacter = processRepeatSaves(updatedCharacter, 'on_damage');

    return updatedCharacter;
}
