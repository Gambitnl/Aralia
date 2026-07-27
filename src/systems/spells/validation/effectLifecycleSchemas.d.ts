/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 01:57:32
 * Dependents: systems/spells/validation/spellValidator.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { z } from 'zod';
export declare const EffectEndCleanup: z.ZodUnion<readonly [z.ZodObject<{
    trigger: z.ZodEnum<{
        not_applicable: "not_applicable";
        spell_ends: "spell_ends";
        effect_ends: "effect_ends";
        item_effect_ends: "item_effect_ends";
    }>;
    removes: z.ZodEnum<{
        not_applicable: "not_applicable";
        temporary_hit_points: "temporary_hit_points";
        spell_granted_flying_speed: "spell_granted_flying_speed";
        extradimensional_space: "extradimensional_space";
        created_ammunition: "created_ammunition";
        spell_material_container: "spell_material_container";
    }>;
    source: z.ZodEnum<{
        not_applicable: "not_applicable";
        this_spell: "this_spell";
        this_effect: "this_effect";
    }>;
    scope: z.ZodEnum<{
        target: "target";
        contents: "contents";
        not_applicable: "not_applicable";
        caster: "caster";
        affected_creatures: "affected_creatures";
        created_objects: "created_objects";
        spell_component: "spell_component";
    }>;
    amount: z.ZodEnum<{
        not_applicable: "not_applicable";
        all_remaining: "all_remaining";
    }>;
    consequence: z.ZodOptional<z.ZodEnum<{
        not_applicable: "not_applicable";
        fall_if_aloft: "fall_if_aloft";
        contents_drop_out: "contents_drop_out";
        disintegrate: "disintegrate";
        destroy: "destroy";
    }>>;
    destination: z.ZodOptional<z.ZodEnum<{
        not_applicable: "not_applicable";
        space_exit_anchor: "space_exit_anchor";
    }>>;
    preventedBy: z.ZodOptional<z.ZodEnum<{
        not_applicable: "not_applicable";
        can_prevent_fall: "can_prevent_fall";
    }>>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    trigger: z.ZodString;
    result: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$loose>]>;
export declare const ConditionalEnding: z.ZodObject<{
    trigger: z.ZodString;
    scope: z.ZodString;
    distanceFeet: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>>;
    durationValue: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>>;
    durationUnit: z.ZodOptional<z.ZodEnum<{
        round: "round";
        not_applicable: "not_applicable";
        minute: "minute";
        hour: "hour";
        day: "day";
    }>>;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const SustainRequirement: z.ZodObject<{
    timing: z.ZodEnum<{
        not_applicable: "not_applicable";
        later_turns: "later_turns";
    }>;
    actor: z.ZodEnum<{
        target: "target";
        not_applicable: "not_applicable";
        caster: "caster";
        affected_creature: "affected_creature";
    }>;
    actionKind: z.ZodEnum<{
        reaction: "reaction";
        not_applicable: "not_applicable";
        bonus_action: "bonus_action";
        magic_action: "magic_action";
        standard_action: "standard_action";
    }>;
    actionCost: z.ZodEnum<{
        action: "action";
        reaction: "reaction";
        not_applicable: "not_applicable";
        bonus_action: "bonus_action";
    }>;
    failureOutcome: z.ZodEnum<{
        not_applicable: "not_applicable";
        spell_ends: "spell_ends";
        effect_ends: "effect_ends";
    }>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
