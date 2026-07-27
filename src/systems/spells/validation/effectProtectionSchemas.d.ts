/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 06:33:35
 * Dependents: systems/spells/validation/spellValidator.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { z } from 'zod';
/**
 * This file validates effect-local protection and damage-interaction rules.
 *
 * These shapes are shared by several effect families, but they are not the core
 * spell identity, targeting, or damage packet themselves. Keeping them here
 * prevents `spellValidator.ts` from becoming a single oversized file while
 * preserving the same runtime JSON contract.
 *
 * Called by: `spellValidator.ts`.
 * Depends on: Zod only; it does not load spell data or runtime systems.
 */
export declare const BarrierDamagePrevention: z.ZodObject<{
    blockDirections: z.ZodArray<z.ZodEnum<{
        both: "both";
        outside_to_inside: "outside_to_inside";
        inside_to_outside: "inside_to_outside";
    }>>;
    sourceCategories: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        object: "object";
        spell: "spell";
        effect: "effect";
        attack: "attack";
        energy: "energy";
    }>>>;
    protectedSubjects: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        inside_creature_or_object: "inside_creature_or_object";
        outside_targets: "outside_targets";
        barrier_itself: "barrier_itself";
    }>>>;
}, z.core.$strip>;
export declare const SpellEffectPrevention: z.ZodObject<{
    sourceSide: z.ZodEnum<{
        any: "any";
        inside: "inside";
        outside: "outside";
    }>;
    maxSpellLevel: z.ZodNumber;
    affectedSubjects: z.ZodArray<z.ZodEnum<{
        creatures: "creatures";
        objects: "objects";
        areas: "areas";
        anything_inside: "anything_inside";
    }>>;
    excludesAreaOfEffect: z.ZodOptional<z.ZodBoolean>;
    scaling: z.ZodOptional<z.ZodObject<{
        type: z.ZodEnum<{
            slot_level_threshold_bonus: "slot_level_threshold_bonus";
        }>;
        baseSlotLevel: z.ZodNumber;
        bonusPerSlotLevel: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const DeathPrevention: z.ZodObject<{
    triggers: z.ZodArray<z.ZodEnum<{
        drop_to_0_hp: "drop_to_0_hp";
        instant_death_no_damage: "instant_death_no_damage";
    }>>;
    dropToHitPoints: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
    negatesInstantDeathWithoutDamage: z.ZodBoolean;
    consumption: z.ZodEnum<{
        not_applicable: "not_applicable";
        first_trigger_ends_spell: "first_trigger_ends_spell";
    }>;
    scope: z.ZodEnum<{
        target: "target";
        not_applicable: "not_applicable";
    }>;
}, z.core.$strip>;
export declare const LinkedDamage: z.ZodObject<{
    trigger: z.ZodEnum<{
        target_takes_damage: "target_takes_damage";
    }>;
    recipient: z.ZodEnum<{
        target: "target";
        caster: "caster";
        linked_creature: "linked_creature";
    }>;
    amount: z.ZodEnum<{
        same_amount: "same_amount";
    }>;
    amountBasis: z.ZodOptional<z.ZodEnum<{
        post_target_mitigation: "post_target_mitigation";
    }>>;
    damageTypeSource: z.ZodOptional<z.ZodEnum<{
        triggering_damage_type: "triggering_damage_type";
        untyped: "untyped";
    }>>;
    recipientMitigation: z.ZodOptional<z.ZodEnum<{
        not_reapplied: "not_reapplied";
        apply_recipient_mitigation: "apply_recipient_mitigation";
    }>>;
}, z.core.$strip>;
export declare const ResistanceSuppression: z.ZodObject<{
    damageType: z.ZodArray<z.ZodString>;
    damageTypeSource: z.ZodEnum<{
        triggering_damage_type: "triggering_damage_type";
        listed: "listed";
        chosen_damage_type: "chosen_damage_type";
    }>;
}, z.core.$strip>;
export declare const DamageInteraction: z.ZodObject<{
    modes: z.ZodArray<z.ZodEnum<{
        resistance: "resistance";
        vulnerability: "vulnerability";
    }>>;
    damageType: z.ZodArray<z.ZodString>;
    damageTypeSource: z.ZodEnum<{
        triggering_damage_type: "triggering_damage_type";
        listed: "listed";
        chosen_damage_type: "chosen_damage_type";
    }>;
    subjectScope: z.ZodOptional<z.ZodEnum<{
        not_applicable: "not_applicable";
        all_targets: "all_targets";
        chosen_creature_types: "chosen_creature_types";
    }>>;
    durationScope: z.ZodOptional<z.ZodEnum<{
        permanent: "permanent";
        while_active: "while_active";
        while_in_area: "while_in_area";
    }>>;
}, z.core.$strip>;
