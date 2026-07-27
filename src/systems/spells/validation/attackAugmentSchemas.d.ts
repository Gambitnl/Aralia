/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 03:25:09
 * Dependents: systems/spells/validation/spellValidator.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file validates spell effects that change weapon attacks.
 *
 * It exists because attack-augment mechanics are growing beyond a tiny
 * additional-damage rider. Shillelagh and True Strike need to preserve weapon
 * prerequisites, spellcasting ability substitution, damage die changes, and
 * caster damage-type choices without making the central spell validator harder
 * to review.
 *
 * Called by: `spellValidator.ts` when validating utility effects.
 * Depends on: only Zod, so this validator slice can be changed independently.
 */
import { z } from 'zod';
export declare const AttackAugment: z.ZodObject<{
    attackType: z.ZodOptional<z.ZodString>;
    weaponRequirement: z.ZodOptional<z.ZodObject<{
        weaponTypes: z.ZodArray<z.ZodEnum<{
            club: "club";
            quarterstaff: "quarterstaff";
            pebble: "pebble";
            sling: "sling";
            any_weapon: "any_weapon";
            proficient_weapon: "proficient_weapon";
        }>>;
        proficiencyRequired: z.ZodOptional<z.ZodBoolean>;
        minimumValueCp: z.ZodOptional<z.ZodNumber>;
        heldByCaster: z.ZodOptional<z.ZodBoolean>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    grantedAttack: z.ZodOptional<z.ZodObject<{
        timing: z.ZodEnum<{
            during_cast: "during_cast";
            while_active: "while_active";
        }>;
        count: z.ZodLiteral<1>;
        usesCastingWeapon: z.ZodBoolean;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    abilitySubstitution: z.ZodOptional<z.ZodObject<{
        attackRoll: z.ZodOptional<z.ZodEnum<{
            spellcasting_ability: "spellcasting_ability";
        }>>;
        damageRoll: z.ZodOptional<z.ZodEnum<{
            spellcasting_ability: "spellcasting_ability";
        }>>;
        replaces: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            Strength: "Strength";
            Dexterity: "Dexterity";
        }>>>;
    }, z.core.$strip>>;
    damageDieOverride: z.ZodOptional<z.ZodObject<{
        dice: z.ZodString;
        scaling: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<{
                custom: "custom";
                slot_level: "slot_level";
                character_level: "character_level";
            }>;
            bonusPerLevel: z.ZodOptional<z.ZodString>;
            customFormula: z.ZodOptional<z.ZodString>;
            scalingTiers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, z.core.$strip>>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    damageTypeChoice: z.ZodOptional<z.ZodObject<{
        timing: z.ZodEnum<{
            on_damage: "on_damage";
        }>;
        chooser: z.ZodEnum<{
            caster: "caster";
        }>;
        appliesTo: z.ZodEnum<{
            attack_damage: "attack_damage";
        }>;
        options: z.ZodArray<z.ZodObject<{
            type: z.ZodUnion<readonly [z.ZodString, z.ZodLiteral<"weapon_normal">]>;
            label: z.ZodString;
        }, z.core.$strip>>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    additionalDamage: z.ZodOptional<z.ZodObject<{
        dice: z.ZodString;
        type: z.ZodString;
    }, z.core.$strip>>;
    appliesOn: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
