/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 30/03/2026, 01:18:41
 * Dependents: data/summonTemplates.ts, hooks/useSpellGateChecks.ts, utils/validation/spellAuditor.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file spellValidator.ts
 *
 * PURPOSE:
 * This file defines the Zod schema used for validating every Spell JSON file in the codebase.
 * It ensures that our "Gold Standard" data remains structuraly sound and consistent.
 *
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Preservationist] Added an explicit 'any' type to
 * the 'cls' parameter in the 'BASE_CLASS_NAMES' mapping to resolve
 * implicit any warnings in the script environment.
 *
 * WHO USES THIS:
 * 1. Data Validation Script (`scripts/validate-data.ts`): Runs during `npm run validate`.
 * 2. Spell Migration Service: Used by the AI agents when converting new spells to JSON.
 * 3. Combat Engine: Relies on these keys existing to avoid runtime undefined errors.
 */
import { z } from 'zod';
export declare const SummonedEntityStatBlock: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodString>;
    size: z.ZodOptional<z.ZodEnum<{
        Tiny: "Tiny";
        Small: "Small";
        Medium: "Medium";
        Large: "Large";
        Huge: "Huge";
        Gargantuan: "Gargantuan";
    }>>;
    ac: z.ZodOptional<z.ZodNumber>;
    hp: z.ZodOptional<z.ZodNumber>;
    speed: z.ZodOptional<z.ZodNumber>;
    flySpeed: z.ZodOptional<z.ZodNumber>;
    climbSpeed: z.ZodOptional<z.ZodNumber>;
    swimSpeed: z.ZodOptional<z.ZodNumber>;
    abilities: z.ZodOptional<z.ZodObject<{
        str: z.ZodNumber;
        dex: z.ZodNumber;
        con: z.ZodNumber;
        int: z.ZodNumber;
        wis: z.ZodNumber;
        cha: z.ZodNumber;
    }, z.core.$strip>>;
    senses: z.ZodOptional<z.ZodArray<z.ZodString>>;
    skills: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    cr: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
}, z.core.$strip>;
/**
 * MAIN SPELL VALIDATOR
 * The root schema for a Spell JSON file.
 *
 * Key Pillars:
 * - arbitrationType: Determines if the engine (mechanical) or DM (ai_dm) handles it.
 * - aiContext: Instructions for the AI DM for non-mechanical outcomes.
 * - effects: Array of structured mechanical results.
 * - description: Flavor text for the Glossary.
 * - source: intentionally not part of the live schema anymore. The spell JSON files
 *   no longer carry a top-level source field, so validation should not keep enforcing
 *   a dead requirement that the dataset has already moved away from.
 */
export declare const SpellValidator: z.ZodObject<{
    ritual: z.ZodBoolean;
    rarity: z.ZodEnum<{
        common: "common";
        uncommon: "uncommon";
        rare: "rare";
        very_rare: "very_rare";
        legendary: "legendary";
    }>;
    attackType: z.ZodString;
    castingTime: z.ZodObject<{
        value: z.ZodNumber;
        unit: z.ZodEnum<{
            action: "action";
            bonus_action: "bonus_action";
            reaction: "reaction";
            minute: "minute";
            hour: "hour";
            special: "special";
        }>;
        combatCost: z.ZodObject<{
            type: z.ZodEnum<{
                action: "action";
                bonus_action: "bonus_action";
                reaction: "reaction";
            }>;
            condition: z.ZodString;
        }, z.core.$strip>;
        explorationCost: z.ZodObject<{
            value: z.ZodNumber;
            unit: z.ZodEnum<{
                minute: "minute";
                hour: "hour";
            }>;
        }, z.core.$strip>;
    }, z.core.$strip>;
    range: z.ZodObject<{
        type: z.ZodEnum<{
            special: "special";
            self: "self";
            touch: "touch";
            ranged: "ranged";
        }>;
        distance: z.ZodNumber;
    }, z.core.$strip>;
    components: z.ZodObject<{
        verbal: z.ZodBoolean;
        somatic: z.ZodBoolean;
        material: z.ZodBoolean;
        materialDescription: z.ZodString;
        materialCost: z.ZodNumber;
        isConsumed: z.ZodBoolean;
    }, z.core.$strip>;
    duration: z.ZodObject<{
        type: z.ZodEnum<{
            special: "special";
            instantaneous: "instantaneous";
            timed: "timed";
            until_dispelled: "until_dispelled";
            until_dispelled_or_triggered: "until_dispelled_or_triggered";
        }>;
        value: z.ZodNumber;
        unit: z.ZodEnum<{
            minute: "minute";
            hour: "hour";
            round: "round";
            day: "day";
        }>;
        concentration: z.ZodBoolean;
    }, z.core.$strip>;
    targeting: z.ZodObject<{
        type: z.ZodEnum<{
            self: "self";
            ranged: "ranged";
            single: "single";
            multi: "multi";
            area: "area";
            melee: "melee";
            point: "point";
        }>;
        range: z.ZodNumber;
        maxTargets: z.ZodUnion<readonly [z.ZodNumber, z.ZodObject<{
            base: z.ZodNumber;
            scaling: z.ZodObject<{
                type: z.ZodEnum<{
                    character_level: "character_level";
                    slot_level: "slot_level";
                }>;
                thresholds: z.ZodRecord<z.ZodString, z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>]>;
        validTargets: z.ZodArray<z.ZodEnum<{
            self: "self";
            point: "point";
            creatures: "creatures";
            allies: "allies";
            enemies: "enemies";
            objects: "objects";
            ground: "ground";
        }>>;
        lineOfSight: z.ZodBoolean;
        areaOfEffect: z.ZodObject<{
            shape: z.ZodEnum<{
                Cone: "Cone";
                Cube: "Cube";
                Cylinder: "Cylinder";
                Line: "Line";
                Sphere: "Sphere";
                Square: "Square";
                Emanation: "Emanation";
                Wall: "Wall";
                Hemisphere: "Hemisphere";
                Ring: "Ring";
            }>;
            size: z.ZodNumber;
            height: z.ZodOptional<z.ZodNumber>;
            followsCaster: z.ZodOptional<z.ZodBoolean>;
            thickness: z.ZodOptional<z.ZodNumber>;
            width: z.ZodOptional<z.ZodNumber>;
            shapeVariant: z.ZodOptional<z.ZodObject<{
                options: z.ZodArray<z.ZodEnum<{
                    Line: "Line";
                    Sphere: "Sphere";
                    Hemisphere: "Hemisphere";
                    Ring: "Ring";
                }>>;
                default: z.ZodString;
            }, z.core.$strip>>;
            wallStats: z.ZodOptional<z.ZodObject<{
                ac: z.ZodNumber;
                hpPerSection: z.ZodNumber;
                sectionSize: z.ZodNumber;
            }, z.core.$strip>>;
            triggerZone: z.ZodOptional<z.ZodObject<{
                triggerDistance: z.ZodOptional<z.ZodNumber>;
                triggerSide: z.ZodOptional<z.ZodEnum<{
                    one: "one";
                    both: "both";
                    inside: "inside";
                }>>;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        filter: z.ZodObject<{
            creatureTypes: z.ZodArray<z.ZodString>;
            excludeCreatureTypes: z.ZodArray<z.ZodString>;
            sizes: z.ZodArray<z.ZodString>;
            alignments: z.ZodArray<z.ZodString>;
            hasCondition: z.ZodArray<z.ZodString>;
            isNativeToPlane: z.ZodBoolean;
        }, z.core.$strip>;
        shape: z.ZodOptional<z.ZodEnum<{
            sphere: "sphere";
            cone: "cone";
            cube: "cube";
            line: "line";
            cylinder: "cylinder";
        }>>;
        radius: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    effects: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        trigger: z.ZodObject<{
            type: z.ZodEnum<{
                immediate: "immediate";
                after_primary: "after_primary";
                turn_start: "turn_start";
                turn_end: "turn_end";
                on_enter_area: "on_enter_area";
                on_exit_area: "on_exit_area";
                on_end_turn_in_area: "on_end_turn_in_area";
                on_target_move: "on_target_move";
                on_attack_hit: "on_attack_hit";
                on_target_attack: "on_target_attack";
                on_target_cast: "on_target_cast";
                on_caster_action: "on_caster_action";
            }>;
            frequency: z.ZodOptional<z.ZodEnum<{
                every_time: "every_time";
                first_per_turn: "first_per_turn";
                once: "once";
                once_per_creature: "once_per_creature";
            }>>;
            consumption: z.ZodOptional<z.ZodEnum<{
                unlimited: "unlimited";
                first_hit: "first_hit";
                per_turn: "per_turn";
            }>>;
            attackFilter: z.ZodOptional<z.ZodObject<{
                weaponType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    ranged: "ranged";
                    melee: "melee";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    weapon: "weapon";
                    spell: "spell";
                }>>;
            }, z.core.$strip>>;
            movementType: z.ZodOptional<z.ZodEnum<{
                any: "any";
                willing: "willing";
                forced: "forced";
            }>>;
            sustainCost: z.ZodOptional<z.ZodObject<{
                actionType: z.ZodEnum<{
                    action: "action";
                    bonus_action: "bonus_action";
                    reaction: "reaction";
                }>;
                optional: z.ZodBoolean;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        condition: z.ZodObject<{
            type: z.ZodEnum<{
                hit: "hit";
                save: "save";
                always: "always";
            }>;
            saveType: z.ZodOptional<z.ZodEnum<{
                Strength: "Strength";
                Dexterity: "Dexterity";
                Constitution: "Constitution";
                Intelligence: "Intelligence";
                Wisdom: "Wisdom";
                Charisma: "Charisma";
            }>>;
            saveEffect: z.ZodOptional<z.ZodEnum<{
                none: "none";
                half: "half";
                negates_condition: "negates_condition";
            }>>;
            targetFilter: z.ZodOptional<z.ZodObject<{
                creatureTypes: z.ZodArray<z.ZodString>;
                excludeCreatureTypes: z.ZodArray<z.ZodString>;
                sizes: z.ZodArray<z.ZodString>;
                alignments: z.ZodArray<z.ZodString>;
                hasCondition: z.ZodArray<z.ZodString>;
                isNativeToPlane: z.ZodBoolean;
            }, z.core.$strip>>;
            requiresStatus: z.ZodOptional<z.ZodArray<z.ZodString>>;
            saveModifiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<{
                    advantage: "advantage";
                    disadvantage: "disadvantage";
                    bonus: "bonus";
                    penalty: "penalty";
                }>;
                value: z.ZodOptional<z.ZodNumber>;
                appliesTo: z.ZodOptional<z.ZodObject<{
                    creatureTypes: z.ZodArray<z.ZodString>;
                    excludeCreatureTypes: z.ZodArray<z.ZodString>;
                    sizes: z.ZodArray<z.ZodString>;
                    alignments: z.ZodArray<z.ZodString>;
                    hasCondition: z.ZodArray<z.ZodString>;
                    isNativeToPlane: z.ZodBoolean;
                }, z.core.$strip>>;
                reason: z.ZodOptional<z.ZodString>;
                advantageOnDamage: z.ZodOptional<z.ZodBoolean>;
                sizeAdvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                sizeDisadvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
        scaling: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<{
                custom: "custom";
                character_level: "character_level";
                slot_level: "slot_level";
            }>;
            bonusPerLevel: z.ZodOptional<z.ZodString>;
            customFormula: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        description: z.ZodString;
        type: z.ZodLiteral<"DAMAGE">;
        damage: z.ZodObject<{
            dice: z.ZodString;
            type: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        trigger: z.ZodObject<{
            type: z.ZodEnum<{
                immediate: "immediate";
                after_primary: "after_primary";
                turn_start: "turn_start";
                turn_end: "turn_end";
                on_enter_area: "on_enter_area";
                on_exit_area: "on_exit_area";
                on_end_turn_in_area: "on_end_turn_in_area";
                on_target_move: "on_target_move";
                on_attack_hit: "on_attack_hit";
                on_target_attack: "on_target_attack";
                on_target_cast: "on_target_cast";
                on_caster_action: "on_caster_action";
            }>;
            frequency: z.ZodOptional<z.ZodEnum<{
                every_time: "every_time";
                first_per_turn: "first_per_turn";
                once: "once";
                once_per_creature: "once_per_creature";
            }>>;
            consumption: z.ZodOptional<z.ZodEnum<{
                unlimited: "unlimited";
                first_hit: "first_hit";
                per_turn: "per_turn";
            }>>;
            attackFilter: z.ZodOptional<z.ZodObject<{
                weaponType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    ranged: "ranged";
                    melee: "melee";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    weapon: "weapon";
                    spell: "spell";
                }>>;
            }, z.core.$strip>>;
            movementType: z.ZodOptional<z.ZodEnum<{
                any: "any";
                willing: "willing";
                forced: "forced";
            }>>;
            sustainCost: z.ZodOptional<z.ZodObject<{
                actionType: z.ZodEnum<{
                    action: "action";
                    bonus_action: "bonus_action";
                    reaction: "reaction";
                }>;
                optional: z.ZodBoolean;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        condition: z.ZodObject<{
            type: z.ZodEnum<{
                hit: "hit";
                save: "save";
                always: "always";
            }>;
            saveType: z.ZodOptional<z.ZodEnum<{
                Strength: "Strength";
                Dexterity: "Dexterity";
                Constitution: "Constitution";
                Intelligence: "Intelligence";
                Wisdom: "Wisdom";
                Charisma: "Charisma";
            }>>;
            saveEffect: z.ZodOptional<z.ZodEnum<{
                none: "none";
                half: "half";
                negates_condition: "negates_condition";
            }>>;
            targetFilter: z.ZodOptional<z.ZodObject<{
                creatureTypes: z.ZodArray<z.ZodString>;
                excludeCreatureTypes: z.ZodArray<z.ZodString>;
                sizes: z.ZodArray<z.ZodString>;
                alignments: z.ZodArray<z.ZodString>;
                hasCondition: z.ZodArray<z.ZodString>;
                isNativeToPlane: z.ZodBoolean;
            }, z.core.$strip>>;
            requiresStatus: z.ZodOptional<z.ZodArray<z.ZodString>>;
            saveModifiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<{
                    advantage: "advantage";
                    disadvantage: "disadvantage";
                    bonus: "bonus";
                    penalty: "penalty";
                }>;
                value: z.ZodOptional<z.ZodNumber>;
                appliesTo: z.ZodOptional<z.ZodObject<{
                    creatureTypes: z.ZodArray<z.ZodString>;
                    excludeCreatureTypes: z.ZodArray<z.ZodString>;
                    sizes: z.ZodArray<z.ZodString>;
                    alignments: z.ZodArray<z.ZodString>;
                    hasCondition: z.ZodArray<z.ZodString>;
                    isNativeToPlane: z.ZodBoolean;
                }, z.core.$strip>>;
                reason: z.ZodOptional<z.ZodString>;
                advantageOnDamage: z.ZodOptional<z.ZodBoolean>;
                sizeAdvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                sizeDisadvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
        scaling: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<{
                custom: "custom";
                character_level: "character_level";
                slot_level: "slot_level";
            }>;
            bonusPerLevel: z.ZodOptional<z.ZodString>;
            customFormula: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        description: z.ZodString;
        type: z.ZodLiteral<"HEALING">;
        healing: z.ZodObject<{
            dice: z.ZodString;
            isTemporaryHp: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        trigger: z.ZodObject<{
            type: z.ZodEnum<{
                immediate: "immediate";
                after_primary: "after_primary";
                turn_start: "turn_start";
                turn_end: "turn_end";
                on_enter_area: "on_enter_area";
                on_exit_area: "on_exit_area";
                on_end_turn_in_area: "on_end_turn_in_area";
                on_target_move: "on_target_move";
                on_attack_hit: "on_attack_hit";
                on_target_attack: "on_target_attack";
                on_target_cast: "on_target_cast";
                on_caster_action: "on_caster_action";
            }>;
            frequency: z.ZodOptional<z.ZodEnum<{
                every_time: "every_time";
                first_per_turn: "first_per_turn";
                once: "once";
                once_per_creature: "once_per_creature";
            }>>;
            consumption: z.ZodOptional<z.ZodEnum<{
                unlimited: "unlimited";
                first_hit: "first_hit";
                per_turn: "per_turn";
            }>>;
            attackFilter: z.ZodOptional<z.ZodObject<{
                weaponType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    ranged: "ranged";
                    melee: "melee";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    weapon: "weapon";
                    spell: "spell";
                }>>;
            }, z.core.$strip>>;
            movementType: z.ZodOptional<z.ZodEnum<{
                any: "any";
                willing: "willing";
                forced: "forced";
            }>>;
            sustainCost: z.ZodOptional<z.ZodObject<{
                actionType: z.ZodEnum<{
                    action: "action";
                    bonus_action: "bonus_action";
                    reaction: "reaction";
                }>;
                optional: z.ZodBoolean;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        condition: z.ZodObject<{
            type: z.ZodEnum<{
                hit: "hit";
                save: "save";
                always: "always";
            }>;
            saveType: z.ZodOptional<z.ZodEnum<{
                Strength: "Strength";
                Dexterity: "Dexterity";
                Constitution: "Constitution";
                Intelligence: "Intelligence";
                Wisdom: "Wisdom";
                Charisma: "Charisma";
            }>>;
            saveEffect: z.ZodOptional<z.ZodEnum<{
                none: "none";
                half: "half";
                negates_condition: "negates_condition";
            }>>;
            targetFilter: z.ZodOptional<z.ZodObject<{
                creatureTypes: z.ZodArray<z.ZodString>;
                excludeCreatureTypes: z.ZodArray<z.ZodString>;
                sizes: z.ZodArray<z.ZodString>;
                alignments: z.ZodArray<z.ZodString>;
                hasCondition: z.ZodArray<z.ZodString>;
                isNativeToPlane: z.ZodBoolean;
            }, z.core.$strip>>;
            requiresStatus: z.ZodOptional<z.ZodArray<z.ZodString>>;
            saveModifiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<{
                    advantage: "advantage";
                    disadvantage: "disadvantage";
                    bonus: "bonus";
                    penalty: "penalty";
                }>;
                value: z.ZodOptional<z.ZodNumber>;
                appliesTo: z.ZodOptional<z.ZodObject<{
                    creatureTypes: z.ZodArray<z.ZodString>;
                    excludeCreatureTypes: z.ZodArray<z.ZodString>;
                    sizes: z.ZodArray<z.ZodString>;
                    alignments: z.ZodArray<z.ZodString>;
                    hasCondition: z.ZodArray<z.ZodString>;
                    isNativeToPlane: z.ZodBoolean;
                }, z.core.$strip>>;
                reason: z.ZodOptional<z.ZodString>;
                advantageOnDamage: z.ZodOptional<z.ZodBoolean>;
                sizeAdvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                sizeDisadvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
        scaling: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<{
                custom: "custom";
                character_level: "character_level";
                slot_level: "slot_level";
            }>;
            bonusPerLevel: z.ZodOptional<z.ZodString>;
            customFormula: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        description: z.ZodString;
        type: z.ZodLiteral<"STATUS_CONDITION">;
        statusCondition: z.ZodObject<{
            name: z.ZodString;
            duration: z.ZodObject<{
                type: z.ZodEnum<{
                    special: "special";
                    rounds: "rounds";
                    minutes: "minutes";
                }>;
                value: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
            level: z.ZodOptional<z.ZodNumber>;
            escapeCheck: z.ZodOptional<z.ZodObject<{
                ability: z.ZodOptional<z.ZodEnum<{
                    Strength: "Strength";
                    Dexterity: "Dexterity";
                    Constitution: "Constitution";
                    Intelligence: "Intelligence";
                    Wisdom: "Wisdom";
                    Charisma: "Charisma";
                }>>;
                skill: z.ZodOptional<z.ZodString>;
                dc: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"spell_save_dc">]>;
                actionCost: z.ZodEnum<{
                    action: "action";
                    bonus_action: "bonus_action";
                }>;
            }, z.core.$strip>>;
            repeatSave: z.ZodOptional<z.ZodObject<{
                timing: z.ZodEnum<{
                    turn_start: "turn_start";
                    turn_end: "turn_end";
                    on_damage: "on_damage";
                    on_action: "on_action";
                }>;
                saveType: z.ZodEnum<{
                    Strength: "Strength";
                    Dexterity: "Dexterity";
                    Constitution: "Constitution";
                    Intelligence: "Intelligence";
                    Wisdom: "Wisdom";
                    Charisma: "Charisma";
                    strength_check: "strength_check";
                    wisdom_check: "wisdom_check";
                }>;
                successEnds: z.ZodBoolean;
                useOriginalDC: z.ZodBoolean;
                modifiers: z.ZodOptional<z.ZodObject<{
                    advantageOnDamage: z.ZodOptional<z.ZodBoolean>;
                    sizeAdvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    sizeDisadvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        trigger: z.ZodObject<{
            type: z.ZodEnum<{
                immediate: "immediate";
                after_primary: "after_primary";
                turn_start: "turn_start";
                turn_end: "turn_end";
                on_enter_area: "on_enter_area";
                on_exit_area: "on_exit_area";
                on_end_turn_in_area: "on_end_turn_in_area";
                on_target_move: "on_target_move";
                on_attack_hit: "on_attack_hit";
                on_target_attack: "on_target_attack";
                on_target_cast: "on_target_cast";
                on_caster_action: "on_caster_action";
            }>;
            frequency: z.ZodOptional<z.ZodEnum<{
                every_time: "every_time";
                first_per_turn: "first_per_turn";
                once: "once";
                once_per_creature: "once_per_creature";
            }>>;
            consumption: z.ZodOptional<z.ZodEnum<{
                unlimited: "unlimited";
                first_hit: "first_hit";
                per_turn: "per_turn";
            }>>;
            attackFilter: z.ZodOptional<z.ZodObject<{
                weaponType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    ranged: "ranged";
                    melee: "melee";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    weapon: "weapon";
                    spell: "spell";
                }>>;
            }, z.core.$strip>>;
            movementType: z.ZodOptional<z.ZodEnum<{
                any: "any";
                willing: "willing";
                forced: "forced";
            }>>;
            sustainCost: z.ZodOptional<z.ZodObject<{
                actionType: z.ZodEnum<{
                    action: "action";
                    bonus_action: "bonus_action";
                    reaction: "reaction";
                }>;
                optional: z.ZodBoolean;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        condition: z.ZodObject<{
            type: z.ZodEnum<{
                hit: "hit";
                save: "save";
                always: "always";
            }>;
            saveType: z.ZodOptional<z.ZodEnum<{
                Strength: "Strength";
                Dexterity: "Dexterity";
                Constitution: "Constitution";
                Intelligence: "Intelligence";
                Wisdom: "Wisdom";
                Charisma: "Charisma";
            }>>;
            saveEffect: z.ZodOptional<z.ZodEnum<{
                none: "none";
                half: "half";
                negates_condition: "negates_condition";
            }>>;
            targetFilter: z.ZodOptional<z.ZodObject<{
                creatureTypes: z.ZodArray<z.ZodString>;
                excludeCreatureTypes: z.ZodArray<z.ZodString>;
                sizes: z.ZodArray<z.ZodString>;
                alignments: z.ZodArray<z.ZodString>;
                hasCondition: z.ZodArray<z.ZodString>;
                isNativeToPlane: z.ZodBoolean;
            }, z.core.$strip>>;
            requiresStatus: z.ZodOptional<z.ZodArray<z.ZodString>>;
            saveModifiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<{
                    advantage: "advantage";
                    disadvantage: "disadvantage";
                    bonus: "bonus";
                    penalty: "penalty";
                }>;
                value: z.ZodOptional<z.ZodNumber>;
                appliesTo: z.ZodOptional<z.ZodObject<{
                    creatureTypes: z.ZodArray<z.ZodString>;
                    excludeCreatureTypes: z.ZodArray<z.ZodString>;
                    sizes: z.ZodArray<z.ZodString>;
                    alignments: z.ZodArray<z.ZodString>;
                    hasCondition: z.ZodArray<z.ZodString>;
                    isNativeToPlane: z.ZodBoolean;
                }, z.core.$strip>>;
                reason: z.ZodOptional<z.ZodString>;
                advantageOnDamage: z.ZodOptional<z.ZodBoolean>;
                sizeAdvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                sizeDisadvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
        scaling: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<{
                custom: "custom";
                character_level: "character_level";
                slot_level: "slot_level";
            }>;
            bonusPerLevel: z.ZodOptional<z.ZodString>;
            customFormula: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        description: z.ZodString;
        type: z.ZodLiteral<"MOVEMENT">;
        movementType: z.ZodEnum<{
            push: "push";
            pull: "pull";
            teleport: "teleport";
            speed_change: "speed_change";
            stop: "stop";
        }>;
        distance: z.ZodOptional<z.ZodNumber>;
        speedChange: z.ZodOptional<z.ZodObject<{
            stat: z.ZodLiteral<"speed">;
            value: z.ZodNumber;
            unit: z.ZodLiteral<"feet">;
        }, z.core.$strip>>;
        duration: z.ZodObject<{
            type: z.ZodEnum<{
                special: "special";
                rounds: "rounds";
                minutes: "minutes";
            }>;
            value: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        forcedMovement: z.ZodOptional<z.ZodObject<{
            usesReaction: z.ZodOptional<z.ZodBoolean>;
            direction: z.ZodOptional<z.ZodEnum<{
                away_from_caster: "away_from_caster";
                toward_caster: "toward_caster";
                caster_choice: "caster_choice";
                safest_route: "safest_route";
            }>>;
            maxDistance: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        trigger: z.ZodObject<{
            type: z.ZodEnum<{
                immediate: "immediate";
                after_primary: "after_primary";
                turn_start: "turn_start";
                turn_end: "turn_end";
                on_enter_area: "on_enter_area";
                on_exit_area: "on_exit_area";
                on_end_turn_in_area: "on_end_turn_in_area";
                on_target_move: "on_target_move";
                on_attack_hit: "on_attack_hit";
                on_target_attack: "on_target_attack";
                on_target_cast: "on_target_cast";
                on_caster_action: "on_caster_action";
            }>;
            frequency: z.ZodOptional<z.ZodEnum<{
                every_time: "every_time";
                first_per_turn: "first_per_turn";
                once: "once";
                once_per_creature: "once_per_creature";
            }>>;
            consumption: z.ZodOptional<z.ZodEnum<{
                unlimited: "unlimited";
                first_hit: "first_hit";
                per_turn: "per_turn";
            }>>;
            attackFilter: z.ZodOptional<z.ZodObject<{
                weaponType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    ranged: "ranged";
                    melee: "melee";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    weapon: "weapon";
                    spell: "spell";
                }>>;
            }, z.core.$strip>>;
            movementType: z.ZodOptional<z.ZodEnum<{
                any: "any";
                willing: "willing";
                forced: "forced";
            }>>;
            sustainCost: z.ZodOptional<z.ZodObject<{
                actionType: z.ZodEnum<{
                    action: "action";
                    bonus_action: "bonus_action";
                    reaction: "reaction";
                }>;
                optional: z.ZodBoolean;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        condition: z.ZodObject<{
            type: z.ZodEnum<{
                hit: "hit";
                save: "save";
                always: "always";
            }>;
            saveType: z.ZodOptional<z.ZodEnum<{
                Strength: "Strength";
                Dexterity: "Dexterity";
                Constitution: "Constitution";
                Intelligence: "Intelligence";
                Wisdom: "Wisdom";
                Charisma: "Charisma";
            }>>;
            saveEffect: z.ZodOptional<z.ZodEnum<{
                none: "none";
                half: "half";
                negates_condition: "negates_condition";
            }>>;
            targetFilter: z.ZodOptional<z.ZodObject<{
                creatureTypes: z.ZodArray<z.ZodString>;
                excludeCreatureTypes: z.ZodArray<z.ZodString>;
                sizes: z.ZodArray<z.ZodString>;
                alignments: z.ZodArray<z.ZodString>;
                hasCondition: z.ZodArray<z.ZodString>;
                isNativeToPlane: z.ZodBoolean;
            }, z.core.$strip>>;
            requiresStatus: z.ZodOptional<z.ZodArray<z.ZodString>>;
            saveModifiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<{
                    advantage: "advantage";
                    disadvantage: "disadvantage";
                    bonus: "bonus";
                    penalty: "penalty";
                }>;
                value: z.ZodOptional<z.ZodNumber>;
                appliesTo: z.ZodOptional<z.ZodObject<{
                    creatureTypes: z.ZodArray<z.ZodString>;
                    excludeCreatureTypes: z.ZodArray<z.ZodString>;
                    sizes: z.ZodArray<z.ZodString>;
                    alignments: z.ZodArray<z.ZodString>;
                    hasCondition: z.ZodArray<z.ZodString>;
                    isNativeToPlane: z.ZodBoolean;
                }, z.core.$strip>>;
                reason: z.ZodOptional<z.ZodString>;
                advantageOnDamage: z.ZodOptional<z.ZodBoolean>;
                sizeAdvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                sizeDisadvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
        scaling: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<{
                custom: "custom";
                character_level: "character_level";
                slot_level: "slot_level";
            }>;
            bonusPerLevel: z.ZodOptional<z.ZodString>;
            customFormula: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        description: z.ZodString;
        type: z.ZodLiteral<"SUMMONING">;
        summon: z.ZodObject<{
            entityType: z.ZodEnum<{
                object: "object";
                familiar: "familiar";
                servant: "servant";
                construct: "construct";
                creature: "creature";
                undead: "undead";
                mount: "mount";
            }>;
            persistent: z.ZodBoolean;
            dismissAction: z.ZodOptional<z.ZodEnum<{
                action: "action";
                bonus_action: "bonus_action";
                none: "none";
                free: "free";
            }>>;
            count: z.ZodOptional<z.ZodNumber>;
            countByCR: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
            formOptions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            statBlock: z.ZodOptional<z.ZodObject<{
                name: z.ZodOptional<z.ZodString>;
                type: z.ZodOptional<z.ZodString>;
                size: z.ZodOptional<z.ZodEnum<{
                    Tiny: "Tiny";
                    Small: "Small";
                    Medium: "Medium";
                    Large: "Large";
                    Huge: "Huge";
                    Gargantuan: "Gargantuan";
                }>>;
                ac: z.ZodOptional<z.ZodNumber>;
                hp: z.ZodOptional<z.ZodNumber>;
                speed: z.ZodOptional<z.ZodNumber>;
                flySpeed: z.ZodOptional<z.ZodNumber>;
                climbSpeed: z.ZodOptional<z.ZodNumber>;
                swimSpeed: z.ZodOptional<z.ZodNumber>;
                abilities: z.ZodOptional<z.ZodObject<{
                    str: z.ZodNumber;
                    dex: z.ZodNumber;
                    con: z.ZodNumber;
                    int: z.ZodNumber;
                    wis: z.ZodNumber;
                    cha: z.ZodNumber;
                }, z.core.$strip>>;
                senses: z.ZodOptional<z.ZodArray<z.ZodString>>;
                skills: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
                cr: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
            }, z.core.$strip>>;
            objectDescription: z.ZodOptional<z.ZodString>;
            commandCost: z.ZodEnum<{
                action: "action";
                bonus_action: "bonus_action";
                none: "none";
                free: "free";
            }>;
            commandsPerTurn: z.ZodOptional<z.ZodNumber>;
            initiative: z.ZodOptional<z.ZodEnum<{
                immediate: "immediate";
                rolled: "rolled";
                shared: "shared";
            }>>;
            followDistance: z.ZodOptional<z.ZodNumber>;
            hoverHeight: z.ZodOptional<z.ZodNumber>;
            terrainRestrictions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            carryCapacity: z.ZodOptional<z.ZodNumber>;
            telepathyRange: z.ZodOptional<z.ZodNumber>;
            sharedSenses: z.ZodOptional<z.ZodBoolean>;
            sharedSensesCost: z.ZodOptional<z.ZodEnum<{
                action: "action";
                bonus_action: "bonus_action";
            }>>;
            specialActions: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                description: z.ZodString;
                cost: z.ZodEnum<{
                    action: "action";
                    bonus_action: "bonus_action";
                    reaction: "reaction";
                    free: "free";
                }>;
                damage: z.ZodOptional<z.ZodObject<{
                    dice: z.ZodString;
                    type: z.ZodString;
                }, z.core.$strip>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        trigger: z.ZodObject<{
            type: z.ZodEnum<{
                immediate: "immediate";
                after_primary: "after_primary";
                turn_start: "turn_start";
                turn_end: "turn_end";
                on_enter_area: "on_enter_area";
                on_exit_area: "on_exit_area";
                on_end_turn_in_area: "on_end_turn_in_area";
                on_target_move: "on_target_move";
                on_attack_hit: "on_attack_hit";
                on_target_attack: "on_target_attack";
                on_target_cast: "on_target_cast";
                on_caster_action: "on_caster_action";
            }>;
            frequency: z.ZodOptional<z.ZodEnum<{
                every_time: "every_time";
                first_per_turn: "first_per_turn";
                once: "once";
                once_per_creature: "once_per_creature";
            }>>;
            consumption: z.ZodOptional<z.ZodEnum<{
                unlimited: "unlimited";
                first_hit: "first_hit";
                per_turn: "per_turn";
            }>>;
            attackFilter: z.ZodOptional<z.ZodObject<{
                weaponType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    ranged: "ranged";
                    melee: "melee";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    weapon: "weapon";
                    spell: "spell";
                }>>;
            }, z.core.$strip>>;
            movementType: z.ZodOptional<z.ZodEnum<{
                any: "any";
                willing: "willing";
                forced: "forced";
            }>>;
            sustainCost: z.ZodOptional<z.ZodObject<{
                actionType: z.ZodEnum<{
                    action: "action";
                    bonus_action: "bonus_action";
                    reaction: "reaction";
                }>;
                optional: z.ZodBoolean;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        condition: z.ZodObject<{
            type: z.ZodEnum<{
                hit: "hit";
                save: "save";
                always: "always";
            }>;
            saveType: z.ZodOptional<z.ZodEnum<{
                Strength: "Strength";
                Dexterity: "Dexterity";
                Constitution: "Constitution";
                Intelligence: "Intelligence";
                Wisdom: "Wisdom";
                Charisma: "Charisma";
            }>>;
            saveEffect: z.ZodOptional<z.ZodEnum<{
                none: "none";
                half: "half";
                negates_condition: "negates_condition";
            }>>;
            targetFilter: z.ZodOptional<z.ZodObject<{
                creatureTypes: z.ZodArray<z.ZodString>;
                excludeCreatureTypes: z.ZodArray<z.ZodString>;
                sizes: z.ZodArray<z.ZodString>;
                alignments: z.ZodArray<z.ZodString>;
                hasCondition: z.ZodArray<z.ZodString>;
                isNativeToPlane: z.ZodBoolean;
            }, z.core.$strip>>;
            requiresStatus: z.ZodOptional<z.ZodArray<z.ZodString>>;
            saveModifiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<{
                    advantage: "advantage";
                    disadvantage: "disadvantage";
                    bonus: "bonus";
                    penalty: "penalty";
                }>;
                value: z.ZodOptional<z.ZodNumber>;
                appliesTo: z.ZodOptional<z.ZodObject<{
                    creatureTypes: z.ZodArray<z.ZodString>;
                    excludeCreatureTypes: z.ZodArray<z.ZodString>;
                    sizes: z.ZodArray<z.ZodString>;
                    alignments: z.ZodArray<z.ZodString>;
                    hasCondition: z.ZodArray<z.ZodString>;
                    isNativeToPlane: z.ZodBoolean;
                }, z.core.$strip>>;
                reason: z.ZodOptional<z.ZodString>;
                advantageOnDamage: z.ZodOptional<z.ZodBoolean>;
                sizeAdvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                sizeDisadvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
        scaling: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<{
                custom: "custom";
                character_level: "character_level";
                slot_level: "slot_level";
            }>;
            bonusPerLevel: z.ZodOptional<z.ZodString>;
            customFormula: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        description: z.ZodString;
        type: z.ZodLiteral<"TERRAIN">;
        terrainType: z.ZodEnum<{
            difficult: "difficult";
            obscuring: "obscuring";
            damaging: "damaging";
            blocking: "blocking";
            wall: "wall";
        }>;
        areaOfEffect: z.ZodObject<{
            shape: z.ZodEnum<{
                Cone: "Cone";
                Cube: "Cube";
                Cylinder: "Cylinder";
                Line: "Line";
                Sphere: "Sphere";
                Square: "Square";
            }>;
            size: z.ZodNumber;
            height: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        duration: z.ZodObject<{
            type: z.ZodEnum<{
                special: "special";
                rounds: "rounds";
                minutes: "minutes";
            }>;
            value: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        damage: z.ZodOptional<z.ZodObject<{
            dice: z.ZodString;
            type: z.ZodString;
        }, z.core.$strip>>;
        wallProperties: z.ZodOptional<z.ZodObject<{
            hp: z.ZodNumber;
            ac: z.ZodNumber;
        }, z.core.$strip>>;
        dispersedByStrongWind: z.ZodOptional<z.ZodBoolean>;
        manipulation: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<{
                fill: "fill";
                difficult: "difficult";
                excavate: "excavate";
                normal: "normal";
                cosmetic: "cosmetic";
            }>;
            volume: z.ZodOptional<z.ZodObject<{
                shape: z.ZodLiteral<"Cube">;
                size: z.ZodNumber;
                depth: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            duration: z.ZodOptional<z.ZodObject<{
                type: z.ZodEnum<{
                    special: "special";
                    rounds: "rounds";
                    minutes: "minutes";
                }>;
                value: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            depositDistance: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        trigger: z.ZodObject<{
            type: z.ZodEnum<{
                immediate: "immediate";
                after_primary: "after_primary";
                turn_start: "turn_start";
                turn_end: "turn_end";
                on_enter_area: "on_enter_area";
                on_exit_area: "on_exit_area";
                on_end_turn_in_area: "on_end_turn_in_area";
                on_target_move: "on_target_move";
                on_attack_hit: "on_attack_hit";
                on_target_attack: "on_target_attack";
                on_target_cast: "on_target_cast";
                on_caster_action: "on_caster_action";
            }>;
            frequency: z.ZodOptional<z.ZodEnum<{
                every_time: "every_time";
                first_per_turn: "first_per_turn";
                once: "once";
                once_per_creature: "once_per_creature";
            }>>;
            consumption: z.ZodOptional<z.ZodEnum<{
                unlimited: "unlimited";
                first_hit: "first_hit";
                per_turn: "per_turn";
            }>>;
            attackFilter: z.ZodOptional<z.ZodObject<{
                weaponType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    ranged: "ranged";
                    melee: "melee";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    weapon: "weapon";
                    spell: "spell";
                }>>;
            }, z.core.$strip>>;
            movementType: z.ZodOptional<z.ZodEnum<{
                any: "any";
                willing: "willing";
                forced: "forced";
            }>>;
            sustainCost: z.ZodOptional<z.ZodObject<{
                actionType: z.ZodEnum<{
                    action: "action";
                    bonus_action: "bonus_action";
                    reaction: "reaction";
                }>;
                optional: z.ZodBoolean;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        condition: z.ZodObject<{
            type: z.ZodEnum<{
                hit: "hit";
                save: "save";
                always: "always";
            }>;
            saveType: z.ZodOptional<z.ZodEnum<{
                Strength: "Strength";
                Dexterity: "Dexterity";
                Constitution: "Constitution";
                Intelligence: "Intelligence";
                Wisdom: "Wisdom";
                Charisma: "Charisma";
            }>>;
            saveEffect: z.ZodOptional<z.ZodEnum<{
                none: "none";
                half: "half";
                negates_condition: "negates_condition";
            }>>;
            targetFilter: z.ZodOptional<z.ZodObject<{
                creatureTypes: z.ZodArray<z.ZodString>;
                excludeCreatureTypes: z.ZodArray<z.ZodString>;
                sizes: z.ZodArray<z.ZodString>;
                alignments: z.ZodArray<z.ZodString>;
                hasCondition: z.ZodArray<z.ZodString>;
                isNativeToPlane: z.ZodBoolean;
            }, z.core.$strip>>;
            requiresStatus: z.ZodOptional<z.ZodArray<z.ZodString>>;
            saveModifiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<{
                    advantage: "advantage";
                    disadvantage: "disadvantage";
                    bonus: "bonus";
                    penalty: "penalty";
                }>;
                value: z.ZodOptional<z.ZodNumber>;
                appliesTo: z.ZodOptional<z.ZodObject<{
                    creatureTypes: z.ZodArray<z.ZodString>;
                    excludeCreatureTypes: z.ZodArray<z.ZodString>;
                    sizes: z.ZodArray<z.ZodString>;
                    alignments: z.ZodArray<z.ZodString>;
                    hasCondition: z.ZodArray<z.ZodString>;
                    isNativeToPlane: z.ZodBoolean;
                }, z.core.$strip>>;
                reason: z.ZodOptional<z.ZodString>;
                advantageOnDamage: z.ZodOptional<z.ZodBoolean>;
                sizeAdvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                sizeDisadvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
        scaling: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<{
                custom: "custom";
                character_level: "character_level";
                slot_level: "slot_level";
            }>;
            bonusPerLevel: z.ZodOptional<z.ZodString>;
            customFormula: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        type: z.ZodLiteral<"UTILITY">;
        utilityType: z.ZodEnum<{
            light: "light";
            communication: "communication";
            creation: "creation";
            information: "information";
            control: "control";
            sensory: "sensory";
            other: "other";
        }>;
        description: z.ZodString;
        grantedActions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<{
                action: "action";
                bonus_action: "bonus_action";
                reaction: "reaction";
            }>;
            action: z.ZodString;
            frequency: z.ZodEnum<{
                once: "once";
                each_turn: "each_turn";
                while_active: "while_active";
            }>;
            rangeLimit: z.ZodOptional<z.ZodNumber>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        attackAugments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            attackType: z.ZodEnum<{
                weapon: "weapon";
                melee_weapon: "melee_weapon";
                ranged_weapon: "ranged_weapon";
            }>;
            additionalDamage: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                type: z.ZodString;
            }, z.core.$strip>>;
            appliesOn: z.ZodOptional<z.ZodEnum<{
                hit: "hit";
            }>>;
        }, z.core.$strip>>>;
        controlOptions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            effect: z.ZodString;
            details: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        taunt: z.ZodOptional<z.ZodObject<{
            disadvantageAgainstOthers: z.ZodOptional<z.ZodBoolean>;
            leashRangeFeet: z.ZodOptional<z.ZodNumber>;
            breakConditions: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        savePenalty: z.ZodOptional<z.ZodObject<{
            dice: z.ZodOptional<z.ZodString>;
            flat: z.ZodOptional<z.ZodNumber>;
            applies: z.ZodEnum<{
                next_save: "next_save";
                all_saves: "all_saves";
            }>;
            duration: z.ZodOptional<z.ZodObject<{
                type: z.ZodEnum<{
                    special: "special";
                    rounds: "rounds";
                    minutes: "minutes";
                }>;
                value: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        light: z.ZodOptional<z.ZodObject<{
            brightRadius: z.ZodNumber;
            dimRadius: z.ZodOptional<z.ZodNumber>;
            attachedTo: z.ZodOptional<z.ZodEnum<{
                point: "point";
                caster: "caster";
                target: "target";
            }>>;
            color: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        trigger: z.ZodObject<{
            type: z.ZodEnum<{
                immediate: "immediate";
                after_primary: "after_primary";
                turn_start: "turn_start";
                turn_end: "turn_end";
                on_enter_area: "on_enter_area";
                on_exit_area: "on_exit_area";
                on_end_turn_in_area: "on_end_turn_in_area";
                on_target_move: "on_target_move";
                on_attack_hit: "on_attack_hit";
                on_target_attack: "on_target_attack";
                on_target_cast: "on_target_cast";
                on_caster_action: "on_caster_action";
            }>;
            frequency: z.ZodOptional<z.ZodEnum<{
                every_time: "every_time";
                first_per_turn: "first_per_turn";
                once: "once";
                once_per_creature: "once_per_creature";
            }>>;
            consumption: z.ZodOptional<z.ZodEnum<{
                unlimited: "unlimited";
                first_hit: "first_hit";
                per_turn: "per_turn";
            }>>;
            attackFilter: z.ZodOptional<z.ZodObject<{
                weaponType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    ranged: "ranged";
                    melee: "melee";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    weapon: "weapon";
                    spell: "spell";
                }>>;
            }, z.core.$strip>>;
            movementType: z.ZodOptional<z.ZodEnum<{
                any: "any";
                willing: "willing";
                forced: "forced";
            }>>;
            sustainCost: z.ZodOptional<z.ZodObject<{
                actionType: z.ZodEnum<{
                    action: "action";
                    bonus_action: "bonus_action";
                    reaction: "reaction";
                }>;
                optional: z.ZodBoolean;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        condition: z.ZodObject<{
            type: z.ZodEnum<{
                hit: "hit";
                save: "save";
                always: "always";
            }>;
            saveType: z.ZodOptional<z.ZodEnum<{
                Strength: "Strength";
                Dexterity: "Dexterity";
                Constitution: "Constitution";
                Intelligence: "Intelligence";
                Wisdom: "Wisdom";
                Charisma: "Charisma";
            }>>;
            saveEffect: z.ZodOptional<z.ZodEnum<{
                none: "none";
                half: "half";
                negates_condition: "negates_condition";
            }>>;
            targetFilter: z.ZodOptional<z.ZodObject<{
                creatureTypes: z.ZodArray<z.ZodString>;
                excludeCreatureTypes: z.ZodArray<z.ZodString>;
                sizes: z.ZodArray<z.ZodString>;
                alignments: z.ZodArray<z.ZodString>;
                hasCondition: z.ZodArray<z.ZodString>;
                isNativeToPlane: z.ZodBoolean;
            }, z.core.$strip>>;
            requiresStatus: z.ZodOptional<z.ZodArray<z.ZodString>>;
            saveModifiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<{
                    advantage: "advantage";
                    disadvantage: "disadvantage";
                    bonus: "bonus";
                    penalty: "penalty";
                }>;
                value: z.ZodOptional<z.ZodNumber>;
                appliesTo: z.ZodOptional<z.ZodObject<{
                    creatureTypes: z.ZodArray<z.ZodString>;
                    excludeCreatureTypes: z.ZodArray<z.ZodString>;
                    sizes: z.ZodArray<z.ZodString>;
                    alignments: z.ZodArray<z.ZodString>;
                    hasCondition: z.ZodArray<z.ZodString>;
                    isNativeToPlane: z.ZodBoolean;
                }, z.core.$strip>>;
                reason: z.ZodOptional<z.ZodString>;
                advantageOnDamage: z.ZodOptional<z.ZodBoolean>;
                sizeAdvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                sizeDisadvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
        scaling: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<{
                custom: "custom";
                character_level: "character_level";
                slot_level: "slot_level";
            }>;
            bonusPerLevel: z.ZodOptional<z.ZodString>;
            customFormula: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        description: z.ZodString;
        type: z.ZodLiteral<"DEFENSIVE">;
        defenseType: z.ZodEnum<{
            ac_bonus: "ac_bonus";
            set_base_ac: "set_base_ac";
            ac_minimum: "ac_minimum";
            resistance: "resistance";
            immunity: "immunity";
            temporary_hp: "temporary_hp";
            advantage_on_saves: "advantage_on_saves";
        }>;
        value: z.ZodOptional<z.ZodNumber>;
        baseACFormula: z.ZodOptional<z.ZodString>;
        acMinimum: z.ZodOptional<z.ZodNumber>;
        damageType: z.ZodOptional<z.ZodArray<z.ZodString>>;
        savingThrow: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            Strength: "Strength";
            Dexterity: "Dexterity";
            Constitution: "Constitution";
            Intelligence: "Intelligence";
            Wisdom: "Wisdom";
            Charisma: "Charisma";
        }>>>;
        duration: z.ZodObject<{
            type: z.ZodEnum<{
                special: "special";
                rounds: "rounds";
                minutes: "minutes";
            }>;
            value: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        attackerFilter: z.ZodOptional<z.ZodObject<{
            creatureTypes: z.ZodArray<z.ZodString>;
            excludeCreatureTypes: z.ZodArray<z.ZodString>;
            sizes: z.ZodArray<z.ZodString>;
            alignments: z.ZodArray<z.ZodString>;
            hasCondition: z.ZodArray<z.ZodString>;
            isNativeToPlane: z.ZodBoolean;
        }, z.core.$strip>>;
        reactionTrigger: z.ZodOptional<z.ZodObject<{
            event: z.ZodEnum<{
                when_hit: "when_hit";
                when_targeted: "when_targeted";
                when_damaged: "when_damaged";
            }>;
            includesSpells: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        restrictions: z.ZodOptional<z.ZodObject<{
            noArmor: z.ZodOptional<z.ZodBoolean>;
            noShield: z.ZodOptional<z.ZodBoolean>;
            targetSelf: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>], "type">>;
    arbitrationType: z.ZodEnum<{
        mechanical: "mechanical";
        ai_assisted: "ai_assisted";
        ai_dm: "ai_dm";
    }>;
    aiContext: z.ZodObject<{
        prompt: z.ZodString;
        playerInputRequired: z.ZodBoolean;
    }, z.core.$strip>;
    description: z.ZodString;
    higherLevels: z.ZodString;
    tags: z.ZodArray<z.ZodString>;
    classes: z.ZodArray<z.ZodEnum<{
        [x: string]: string;
    }>>;
    subClasses: z.ZodArray<z.ZodString>;
    subClassesVerification: z.ZodEnum<{
        unverified: "unverified";
        verified: "verified";
    }>;
    id: z.ZodString;
    name: z.ZodString;
    aliases: z.ZodArray<z.ZodString>;
    level: z.ZodNumber;
    school: z.ZodEnum<{
        Abjuration: "Abjuration";
        Conjuration: "Conjuration";
        Divination: "Divination";
        Enchantment: "Enchantment";
        Evocation: "Evocation";
        Illusion: "Illusion";
        Necromancy: "Necromancy";
        Transmutation: "Transmutation";
    }>;
    legacy: z.ZodBoolean;
}, z.core.$strip>;
