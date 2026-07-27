/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 03:46:37
 * Dependents: systems/spells/validation/spellValidator.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { z } from 'zod';
export declare const SensoryManifestation: z.ZodObject<{
    modeSource: z.ZodEnum<{
        effect: "effect";
        not_applicable: "not_applicable";
        "modeChoice.options": "modeChoice.options";
    }>;
    variants: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        allowedSenses: z.ZodArray<z.ZodEnum<{
            light: "light";
            sound: "sound";
            sight: "sight";
            smell: "smell";
            other_sensory_effect: "other_sensory_effect";
        }>>;
        excludedSenses: z.ZodArray<z.ZodEnum<{
            light: "light";
            sound: "sound";
            sight: "sight";
            smell: "smell";
            other_sensory_effect: "other_sensory_effect";
        }>>;
        volumeRange: z.ZodOptional<z.ZodEnum<{
            not_applicable: "not_applicable";
            whisper_to_scream: "whisper_to_scream";
        }>>;
        timing: z.ZodOptional<z.ZodEnum<{
            not_applicable: "not_applicable";
            continuous: "continuous";
            discrete_before_spell_end: "discrete_before_spell_end";
            continuous_or_discrete_before_spell_end: "continuous_or_discrete_before_spell_end";
        }>>;
        maxSize: z.ZodOptional<z.ZodObject<{
            shape: z.ZodEnum<{
                not_applicable: "not_applicable";
                Cone: "Cone";
                Cube: "Cube";
                Cylinder: "Cylinder";
                Line: "Line";
                Sphere: "Sphere";
            }>;
            size: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            unit: z.ZodEnum<{
                not_applicable: "not_applicable";
                feet: "feet";
            }>;
        }, z.core.$strip>>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const IllusionMetadata: z.ZodObject<{
    revealScope: z.ZodEnum<{
        not_applicable: "not_applicable";
        per_creature: "per_creature";
        global: "global";
    }>;
    revealRules: z.ZodArray<z.ZodObject<{
        method: z.ZodEnum<{
            study_action: "study_action";
            physical_interaction: "physical_interaction";
        }>;
        actionCost: z.ZodOptional<z.ZodEnum<{
            action: "action";
            not_applicable: "not_applicable";
        }>>;
        ability: z.ZodOptional<z.ZodEnum<{
            not_applicable: "not_applicable";
            Intelligence: "Intelligence";
        }>>;
        skill: z.ZodOptional<z.ZodEnum<{
            not_applicable: "not_applicable";
            Investigation: "Investigation";
        }>>;
        dc: z.ZodOptional<z.ZodEnum<{
            not_applicable: "not_applicable";
            spell_save_dc: "spell_save_dc";
        }>>;
        appliesTo: z.ZodArray<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    discernedState: z.ZodEnum<{
        not_applicable: "not_applicable";
        faint_to_discerning_creature: "faint_to_discerning_creature";
        transparent_to_discerning_creature: "transparent_to_discerning_creature";
    }>;
    phantasmalInteraction: z.ZodOptional<z.ZodObject<{
        perceivedOnlyByTarget: z.ZodBoolean;
        targetTreatsAsReal: z.ZodBoolean;
        rationalizesIllogicalOutcomes: z.ZodBoolean;
        phenomenonOptions: z.ZodArray<z.ZodString>;
        hazardousPhantasm: z.ZodOptional<z.ZodObject<{
            damageDice: z.ZodString;
            damageType: z.ZodString;
            perceivedDamageTypeSource: z.ZodEnum<{
                fixed: "fixed";
                appropriate_to_illusion: "appropriate_to_illusion";
            }>;
            damageTiming: z.ZodEnum<{
                not_applicable: "not_applicable";
                each_caster_turn: "each_caster_turn";
            }>;
            damageAreaCondition: z.ZodEnum<{
                not_applicable: "not_applicable";
                in_area_or_within_proximity: "in_area_or_within_proximity";
            }>;
            proximityFeet: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    terrainIllusion: z.ZodOptional<z.ZodObject<{
        areaShape: z.ZodEnum<{
            not_applicable: "not_applicable";
            Square: "Square";
            Circle: "Circle";
        }>;
        areaSize: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
        areaUnit: z.ZodEnum<{
            not_applicable: "not_applicable";
            feet: "feet";
            miles: "miles";
        }>;
        sensoryElements: z.ZodArray<z.ZodEnum<{
            light: "light";
            sound: "sound";
            sight: "sight";
            smell: "smell";
            other_sensory_effect: "other_sensory_effect";
        }>>;
        terrainAppearanceOptions: z.ZodArray<z.ZodString>;
        canAlterStructures: z.ZodBoolean;
        canAddStructures: z.ZodBoolean;
        cannotDisguiseConcealOrAddCreatures: z.ZodBoolean;
        canChangeDifficultTerrain: z.ZodBoolean;
        canOtherwiseImpedeMovement: z.ZodBoolean;
        removedPiecesDisappearImmediately: z.ZodBoolean;
        truesightRevealsTrueTerrain: z.ZodBoolean;
        truesightStillPhysicallyInteracts: z.ZodBoolean;
    }, z.core.$strip>>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
