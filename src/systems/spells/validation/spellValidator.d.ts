/**
 * @file spellValidator.ts
 *
 * PURPOSE:
 * This file defines the Zod schema used for validating every Spell JSON file in the codebase.
 * It ensures that our "Gold Standard" data remains structuraly sound and consistent.
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
 */
export declare const SpellValidator: z.ZodObject<{
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
    source: z.ZodString;
    legacy: z.ZodBoolean;
    classes: z.ZodArray<z.ZodEnum<{
        [x: string]: string;
    }>>;
    ritual: z.ZodBoolean;
    rarity: z.ZodEnum<{
        rare: "rare";
        common: "common";
        uncommon: "uncommon";
        very_rare: "very_rare";
        legendary: "legendary";
    }>;
    attackType: z.ZodString;
    castingTime: z.ZodObject<{
        value: z.ZodNumber;
        unit: z.ZodEnum<{
            action: "action";
            special: "special";
            reaction: "reaction";
            bonus_action: "bonus_action";
            minute: "minute";
            hour: "hour";
        }>;
        combatCost: z.ZodObject<{
            type: z.ZodEnum<{
                action: "action";
                reaction: "reaction";
                bonus_action: "bonus_action";
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
            ranged: "ranged";
            touch: "touch";
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
            area: "area";
            point: "point";
            self: "self";
            melee: "melee";
            ranged: "ranged";
            single: "single";
            multi: "multi";
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
            point: "point";
            self: "self";
            creatures: "creatures";
            objects: "objects";
            allies: "allies";
            enemies: "enemies";
            ground: "ground";
        }>>;
        lineOfSight: z.ZodBoolean;
        areaOfEffect: z.ZodObject<{
            shape: z.ZodEnum<{
                Ring: "Ring";
                Cone: "Cone";
                Cube: "Cube";
                Cylinder: "Cylinder";
                Line: "Line";
                Sphere: "Sphere";
                Square: "Square";
                Emanation: "Emanation";
                Wall: "Wall";
                Hemisphere: "Hemisphere";
            }>;
            size: z.ZodNumber;
            height: z.ZodOptional<z.ZodNumber>;
            followsCaster: z.ZodOptional<z.ZodBoolean>;
            thickness: z.ZodOptional<z.ZodNumber>;
            width: z.ZodOptional<z.ZodNumber>;
            shapeVariant: z.ZodOptional<z.ZodObject<{
                options: z.ZodArray<z.ZodEnum<{
                    Ring: "Ring";
                    Line: "Line";
                    Sphere: "Sphere";
                    Hemisphere: "Hemisphere";
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
                    both: "both";
                    one: "one";
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
            line: "line";
            cone: "cone";
            sphere: "sphere";
            cube: "cube";
            cylinder: "cylinder";
        }>>;
        radius: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    effects: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        trigger: z.ZodObject<{
            type: z.ZodEnum<{
                turn_start: "turn_start";
                turn_end: "turn_end";
                immediate: "immediate";
                after_primary: "after_primary";
                on_enter_area: "on_enter_area";
                on_exit_area: "on_exit_area";
                on_end_turn_in_area: "on_end_turn_in_area";
                on_target_move: "on_target_move";
                on_target_attack: "on_target_attack";
                on_target_cast: "on_target_cast";
                on_caster_action: "on_caster_action";
                on_attack_hit: "on_attack_hit";
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
                    melee: "melee";
                    ranged: "ranged";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    spell: "spell";
                    weapon: "weapon";
                    any: "any";
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
                    reaction: "reaction";
                    bonus_action: "bonus_action";
                }>;
                optional: z.ZodBoolean;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        condition: z.ZodObject<{
            type: z.ZodEnum<{
                save: "save";
                hit: "hit";
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
                    disadvantage: "disadvantage";
                    advantage: "advantage";
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
                turn_start: "turn_start";
                turn_end: "turn_end";
                immediate: "immediate";
                after_primary: "after_primary";
                on_enter_area: "on_enter_area";
                on_exit_area: "on_exit_area";
                on_end_turn_in_area: "on_end_turn_in_area";
                on_target_move: "on_target_move";
                on_target_attack: "on_target_attack";
                on_target_cast: "on_target_cast";
                on_caster_action: "on_caster_action";
                on_attack_hit: "on_attack_hit";
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
                    melee: "melee";
                    ranged: "ranged";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    spell: "spell";
                    weapon: "weapon";
                    any: "any";
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
                    reaction: "reaction";
                    bonus_action: "bonus_action";
                }>;
                optional: z.ZodBoolean;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        condition: z.ZodObject<{
            type: z.ZodEnum<{
                save: "save";
                hit: "hit";
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
                    disadvantage: "disadvantage";
                    advantage: "advantage";
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
                turn_start: "turn_start";
                turn_end: "turn_end";
                immediate: "immediate";
                after_primary: "after_primary";
                on_enter_area: "on_enter_area";
                on_exit_area: "on_exit_area";
                on_end_turn_in_area: "on_end_turn_in_area";
                on_target_move: "on_target_move";
                on_target_attack: "on_target_attack";
                on_target_cast: "on_target_cast";
                on_caster_action: "on_caster_action";
                on_attack_hit: "on_attack_hit";
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
                    melee: "melee";
                    ranged: "ranged";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    spell: "spell";
                    weapon: "weapon";
                    any: "any";
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
                    reaction: "reaction";
                    bonus_action: "bonus_action";
                }>;
                optional: z.ZodBoolean;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        condition: z.ZodObject<{
            type: z.ZodEnum<{
                save: "save";
                hit: "hit";
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
                    disadvantage: "disadvantage";
                    advantage: "advantage";
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
                    rounds: "rounds";
                    minutes: "minutes";
                    special: "special";
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
                turn_start: "turn_start";
                turn_end: "turn_end";
                immediate: "immediate";
                after_primary: "after_primary";
                on_enter_area: "on_enter_area";
                on_exit_area: "on_exit_area";
                on_end_turn_in_area: "on_end_turn_in_area";
                on_target_move: "on_target_move";
                on_target_attack: "on_target_attack";
                on_target_cast: "on_target_cast";
                on_caster_action: "on_caster_action";
                on_attack_hit: "on_attack_hit";
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
                    melee: "melee";
                    ranged: "ranged";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    spell: "spell";
                    weapon: "weapon";
                    any: "any";
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
                    reaction: "reaction";
                    bonus_action: "bonus_action";
                }>;
                optional: z.ZodBoolean;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        condition: z.ZodObject<{
            type: z.ZodEnum<{
                save: "save";
                hit: "hit";
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
                    disadvantage: "disadvantage";
                    advantage: "advantage";
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
            stop: "stop";
            teleport: "teleport";
            pull: "pull";
            speed_change: "speed_change";
        }>;
        distance: z.ZodOptional<z.ZodNumber>;
        speedChange: z.ZodOptional<z.ZodObject<{
            stat: z.ZodLiteral<"speed">;
            value: z.ZodNumber;
            unit: z.ZodLiteral<"feet">;
        }, z.core.$strip>>;
        duration: z.ZodObject<{
            type: z.ZodEnum<{
                rounds: "rounds";
                minutes: "minutes";
                special: "special";
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
                turn_start: "turn_start";
                turn_end: "turn_end";
                immediate: "immediate";
                after_primary: "after_primary";
                on_enter_area: "on_enter_area";
                on_exit_area: "on_exit_area";
                on_end_turn_in_area: "on_end_turn_in_area";
                on_target_move: "on_target_move";
                on_target_attack: "on_target_attack";
                on_target_cast: "on_target_cast";
                on_caster_action: "on_caster_action";
                on_attack_hit: "on_attack_hit";
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
                    melee: "melee";
                    ranged: "ranged";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    spell: "spell";
                    weapon: "weapon";
                    any: "any";
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
                    reaction: "reaction";
                    bonus_action: "bonus_action";
                }>;
                optional: z.ZodBoolean;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        condition: z.ZodObject<{
            type: z.ZodEnum<{
                save: "save";
                hit: "hit";
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
                    disadvantage: "disadvantage";
                    advantage: "advantage";
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
                creature: "creature";
                familiar: "familiar";
                servant: "servant";
                construct: "construct";
                undead: "undead";
                mount: "mount";
            }>;
            persistent: z.ZodBoolean;
            dismissAction: z.ZodOptional<z.ZodEnum<{
                action: "action";
                none: "none";
                free: "free";
                bonus_action: "bonus_action";
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
                none: "none";
                free: "free";
                bonus_action: "bonus_action";
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
                    reaction: "reaction";
                    free: "free";
                    bonus_action: "bonus_action";
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
                turn_start: "turn_start";
                turn_end: "turn_end";
                immediate: "immediate";
                after_primary: "after_primary";
                on_enter_area: "on_enter_area";
                on_exit_area: "on_exit_area";
                on_end_turn_in_area: "on_end_turn_in_area";
                on_target_move: "on_target_move";
                on_target_attack: "on_target_attack";
                on_target_cast: "on_target_cast";
                on_caster_action: "on_caster_action";
                on_attack_hit: "on_attack_hit";
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
                    melee: "melee";
                    ranged: "ranged";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    spell: "spell";
                    weapon: "weapon";
                    any: "any";
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
                    reaction: "reaction";
                    bonus_action: "bonus_action";
                }>;
                optional: z.ZodBoolean;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        condition: z.ZodObject<{
            type: z.ZodEnum<{
                save: "save";
                hit: "hit";
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
                    disadvantage: "disadvantage";
                    advantage: "advantage";
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
            wall: "wall";
            obscuring: "obscuring";
            damaging: "damaging";
            blocking: "blocking";
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
                rounds: "rounds";
                minutes: "minutes";
                special: "special";
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
                normal: "normal";
                difficult: "difficult";
                excavate: "excavate";
                cosmetic: "cosmetic";
            }>;
            volume: z.ZodOptional<z.ZodObject<{
                shape: z.ZodLiteral<"Cube">;
                size: z.ZodNumber;
                depth: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            duration: z.ZodOptional<z.ZodObject<{
                type: z.ZodEnum<{
                    rounds: "rounds";
                    minutes: "minutes";
                    special: "special";
                }>;
                value: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            depositDistance: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        trigger: z.ZodObject<{
            type: z.ZodEnum<{
                turn_start: "turn_start";
                turn_end: "turn_end";
                immediate: "immediate";
                after_primary: "after_primary";
                on_enter_area: "on_enter_area";
                on_exit_area: "on_exit_area";
                on_end_turn_in_area: "on_end_turn_in_area";
                on_target_move: "on_target_move";
                on_target_attack: "on_target_attack";
                on_target_cast: "on_target_cast";
                on_caster_action: "on_caster_action";
                on_attack_hit: "on_attack_hit";
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
                    melee: "melee";
                    ranged: "ranged";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    spell: "spell";
                    weapon: "weapon";
                    any: "any";
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
                    reaction: "reaction";
                    bonus_action: "bonus_action";
                }>;
                optional: z.ZodBoolean;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        condition: z.ZodObject<{
            type: z.ZodEnum<{
                save: "save";
                hit: "hit";
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
                    disadvantage: "disadvantage";
                    advantage: "advantage";
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
            other: "other";
            information: "information";
            communication: "communication";
            creation: "creation";
            control: "control";
            sensory: "sensory";
        }>;
        description: z.ZodString;
        grantedActions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<{
                action: "action";
                reaction: "reaction";
                bonus_action: "bonus_action";
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
                    rounds: "rounds";
                    minutes: "minutes";
                    special: "special";
                }>;
                value: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        light: z.ZodOptional<z.ZodObject<{
            brightRadius: z.ZodNumber;
            dimRadius: z.ZodOptional<z.ZodNumber>;
            attachedTo: z.ZodOptional<z.ZodEnum<{
                target: "target";
                point: "point";
                caster: "caster";
            }>>;
            color: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        trigger: z.ZodObject<{
            type: z.ZodEnum<{
                turn_start: "turn_start";
                turn_end: "turn_end";
                immediate: "immediate";
                after_primary: "after_primary";
                on_enter_area: "on_enter_area";
                on_exit_area: "on_exit_area";
                on_end_turn_in_area: "on_end_turn_in_area";
                on_target_move: "on_target_move";
                on_target_attack: "on_target_attack";
                on_target_cast: "on_target_cast";
                on_caster_action: "on_caster_action";
                on_attack_hit: "on_attack_hit";
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
                    melee: "melee";
                    ranged: "ranged";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    spell: "spell";
                    weapon: "weapon";
                    any: "any";
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
                    reaction: "reaction";
                    bonus_action: "bonus_action";
                }>;
                optional: z.ZodBoolean;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        condition: z.ZodObject<{
            type: z.ZodEnum<{
                save: "save";
                hit: "hit";
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
                    disadvantage: "disadvantage";
                    advantage: "advantage";
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
            resistance: "resistance";
            ac_bonus: "ac_bonus";
            advantage_on_saves: "advantage_on_saves";
            set_base_ac: "set_base_ac";
            ac_minimum: "ac_minimum";
            immunity: "immunity";
            temporary_hp: "temporary_hp";
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
                rounds: "rounds";
                minutes: "minutes";
                special: "special";
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
}, z.core.$strip>;
