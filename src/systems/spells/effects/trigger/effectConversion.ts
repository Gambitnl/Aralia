/**
 * @file src/systems/spells/effects/trigger/effectConversion.ts
 *
 * Effect-type guards and SpellEffect -> ProcessedEffect conversion.
 *
 * WHY THIS EXISTS: split out of triggerHandler.ts (MOD-3.3). This is the leaf of
 * the trigger module graph - it depends only on the shared record shapes, so both
 * area trigger processing and any future trigger source can convert effects
 * without pulling in zone geometry. Behavior is unchanged from the original file.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 14:28:33
 * Dependents: systems/spells/effects/trigger/areaTriggerProcessing.ts, systems/spells/effects/triggerHandler.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { SpellEffect } from '../../../../types/spells';
import type { RecurringMechanic, DamageEffect, HealingEffect, StatusConditionEffect } from '../../../../types/spellEffectTypes';
import type { ProcessedEffect, ProcessedEffectSourceContext } from './types';

/**
 * Normalize effect type casing to handle both uppercase and lowercase inputs.
 * This prevents silent failures when scheduled effects are created with wrong casing.
 */
function normalizeEffectType(type: string): string {
    if (!type) return type;
    // Convert to uppercase for the switch statement
    const normalized = type.toUpperCase();
    // Warn if the input was already uppercase (no-op) or if it's an unrecognized type
    if (type !== normalized && !['DAMAGE', 'HEALING', 'STATUS_CONDITION', 'SUMMONING'].includes(normalized)) {
        console.warn(`[convertSpellEffectToProcessed] Unrecognized effect type: "${type}" normalized to "${normalized}"`);
    }
    return normalized;
}

/**
 * Discriminated-union guards for the canonical uppercase spell-effect
 * discriminants. Spell data and the `SpellEffect` union use uppercase `type`
 * literals; `normalizeEffectType` above tolerates legacy lowercase producers
 * for the switch, while these guards give the compiler the narrowing it needs
 * to validate property access without `as any` casts.
 */
function isDamageEffect(effect: SpellEffect): effect is DamageEffect {
    return normalizeEffectType(effect.type) === 'DAMAGE';
}

function isHealingEffect(effect: SpellEffect): effect is HealingEffect {
    return normalizeEffectType(effect.type) === 'HEALING';
}

function isStatusConditionEffect(effect: SpellEffect): effect is StatusConditionEffect {
    return normalizeEffectType(effect.type) === 'STATUS_CONDITION';
}

/**
 * Convert a SpellEffect to a ProcessedEffect for the combat system
 */
export function convertSpellEffectToProcessed(
    effect: SpellEffect,
    sourceContext?: ProcessedEffectSourceContext,
    recurringMechanic?: RecurringMechanic
): ProcessedEffect[] {
    const processed: ProcessedEffect[] = [];
    const damage = recurringMechanic?.damage ?? (isDamageEffect(effect) ? effect.damage : undefined);
    const healing = recurringMechanic?.healing ?? (isHealingEffect(effect) ? effect.healing : undefined);
    const saveType = recurringMechanic?.saveType ?? effect.condition?.saveType;
    const saveEffect = recurringMechanic?.saveEffect ?? effect.condition?.saveEffect;
    const requiresSave = effect.condition?.type === 'save' || Boolean(recurringMechanic?.saveType);

    // Normalize effect type to handle both uppercase and lowercase inputs
    const normalizedType = normalizeEffectType(effect.type);

    // Some ongoing spells store their future damage beside a status effect
    // rather than on a second DAMAGE row. Emit that recurring payload before
    // interpreting the base row so registration through useAbilitySystem does
    // not silently lose canonical start/end-turn damage.
    if (
        recurringMechanic?.damage
        && normalizedType !== 'DAMAGE'
        && normalizedType !== 'SUMMONING'
    ) {
        processed.push({
            type: 'damage',
            dice: recurringMechanic.damage.dice,
            damageType: recurringMechanic.damage.type,
            requiresSave,
            saveType,
            saveEffect,
            sourceContext
        });
    }

    if (recurringMechanic?.healing && normalizedType !== 'HEALING') {
        processed.push({
            type: 'heal',
            dice: recurringMechanic.healing.dice,
            sourceContext
        });
    }

    switch (normalizedType) {
        case 'DAMAGE':
            processed.push({
                type: 'damage',
                dice: damage?.dice,
                damageType: damage?.type,
                requiresSave,
                saveType,
                saveEffect,
                sourceContext
            });
            break;

        case 'SUMMONING':
            // Summoned actors can own a recurring threat radius, such as
            // Conjure Animals. Preserve that delayed damage packet at the
            // trigger boundary while leaving ordinary summon creation on its
            // existing immediate command path.
            if (damage) {
                processed.push({
                    type: 'damage',
                    dice: damage.dice,
                    damageType: damage.type,
                    requiresSave,
                    saveType,
                    saveEffect,
                    sourceContext
                });
            }
            break;

        case 'HEALING':
            processed.push({
                type: 'heal',
                dice: healing?.dice,
                sourceContext
            });
            break;

        case 'STATUS_CONDITION': {
            // A recurring mechanic describes what an already-applied condition
            // does on later turns. Reapplying the base condition here would
            // refresh it every tick and create a second source of duration truth.
            // The scheduled combat engine resolves any recurring save after
            // these damage/healing payloads, then removes the exact owned
            // schedule and source-linked condition on a successful outcome.
            if (recurringMechanic) {
                break;
            }

            // The spell-effect union narrows on the uppercase discriminant, so a
            // STATUS_CONDITION row that reaches this branch through the normalizer
            // but does not structurally carry a statusCondition payload is malformed
            // data. Skip it loudly instead of emitting a condition-less packet.
            if (!isStatusConditionEffect(effect)) {
                console.warn(`[convertSpellEffectToProcessed] STATUS_CONDITION type without a statusCondition payload; skipped.`);
                break;
            }

            const status = effect.statusCondition;
            processed.push({
                type: 'status_condition',
                statusName: status.name,
                duration: status.duration,
                requiresSave: effect.condition?.type === 'save',
                saveType: effect.condition?.saveType,
                saveEffect: effect.condition?.saveEffect,
                // Status-condition metadata appears in more than one declaration
                // shape while the spell-data migration is still in flight. Preserve
                // all known locations so delayed effects and area triggers keep the
                // ongoing-resolution rules that immediate status commands already use.
                repeatSave: status.repeatSave,
                escapeCheck: status.escapeCheck,
                breakTriggers: status.breakTriggers,
                sourceContext
            });
            break;
        }

        default:
            console.warn(`[convertSpellEffectToProcessed] Unrecognized effect type: "${effect.type}" (normalized: "${normalizedType}"). No processed effect generated.`);
            break;
    }

    return processed;
}
