/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 23/07/2026, 18:56:17
 * Dependents: components/Glossary/spellGateChecker/buckets/castingTime.ts, components/Glossary/spellGateChecker/buckets/classes.ts, components/Glossary/spellGateChecker/buckets/components.ts, components/Glossary/spellGateChecker/buckets/description.ts, components/Glossary/spellGateChecker/buckets/duration.ts, components/Glossary/spellGateChecker/buckets/higherLevels.ts, components/Glossary/spellGateChecker/buckets/material.ts, components/Glossary/spellGateChecker/buckets/rangeArea.ts, components/Glossary/spellGateChecker/buckets/subClasses.ts, components/Glossary/spellGateChecker/spellGateSelectedRefresh.ts, components/Glossary/spellGateChecker/useSpellGateChecks.ts, data/summonTemplates.ts, utils/validation/spellAuditor.ts
 * Imports: 13 files
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
    accessGrants: z.ZodOptional<z.ZodArray<z.ZodObject<{
        sourceType: z.ZodEnum<{
            other: "other";
            item: "item";
            class_feature: "class_feature";
            subclass_feature: "subclass_feature";
            species_trait: "species_trait";
            feat: "feat";
            background: "background";
        }>;
        className: z.ZodOptional<z.ZodEnum<{
            [x: string]: string;
        }>>;
        sourceName: z.ZodString;
        accessType: z.ZodEnum<{
            known: "known";
            prepared: "prepared";
            always_prepared: "always_prepared";
            cast: "cast";
        }>;
        automatic: z.ZodBoolean;
        consumesSelection: z.ZodOptional<z.ZodBoolean>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
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
            reaction: "reaction";
            bonus_action: "bonus_action";
            minute: "minute";
            hour: "hour";
            special: "special";
            free: "free";
        }>;
        combatCost: z.ZodObject<{
            type: z.ZodEnum<{
                action: "action";
                reaction: "reaction";
                bonus_action: "bonus_action";
                free: "free";
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
            sight: "sight";
            unlimited: "unlimited";
        }>;
        distance: z.ZodNumber;
        distanceUnit: z.ZodOptional<z.ZodEnum<{
            feet: "feet";
            miles: "miles";
            inches: "inches";
        }>>;
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
            round: "round";
            minute: "minute";
            hour: "hour";
            day: "day";
        }>;
        concentration: z.ZodBoolean;
    }, z.core.$strip>;
    targeting: z.ZodObject<{
        type: z.ZodEnum<{
            point: "point";
            single: "single";
            area: "area";
            multi: "multi";
            self: "self";
            ranged: "ranged";
            melee: "melee";
        }>;
        range: z.ZodNumber;
        rangeUnit: z.ZodOptional<z.ZodEnum<{
            feet: "feet";
            miles: "miles";
            inches: "inches";
        }>>;
        maxTargets: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"unlimited">, z.ZodLiteral<"any_number">, z.ZodObject<{
            base: z.ZodNumber;
            scaling: z.ZodObject<{
                type: z.ZodEnum<{
                    slot_level: "slot_level";
                    character_level: "character_level";
                }>;
                thresholds: z.ZodRecord<z.ZodString, z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>]>;
        validTargets: z.ZodArray<z.ZodString>;
        lineOfSight: z.ZodBoolean;
        acquisition: z.ZodOptional<z.ZodObject<{
            mode: z.ZodEnum<{
                line_of_sight: "line_of_sight";
                sight_or_hearing: "sight_or_hearing";
            }>;
        }, z.core.$strip>>;
        areaOfEffect: z.ZodOptional<z.ZodObject<{
            shape: z.ZodEnum<{
                Wall: "Wall";
                Cone: "Cone";
                Cube: "Cube";
                Cylinder: "Cylinder";
                Line: "Line";
                Sphere: "Sphere";
                Square: "Square";
                Circle: "Circle";
                Emanation: "Emanation";
                Hemisphere: "Hemisphere";
                Ring: "Ring";
            }>;
            size: z.ZodNumber;
            sizeType: z.ZodOptional<z.ZodEnum<{
                length: "length";
                radius: "radius";
                diameter: "diameter";
                edge: "edge";
                side: "side";
                square: "square";
            }>>;
            sizeUnit: z.ZodOptional<z.ZodEnum<{
                feet: "feet";
                miles: "miles";
                inches: "inches";
            }>>;
            height: z.ZodOptional<z.ZodNumber>;
            heightUnit: z.ZodOptional<z.ZodEnum<{
                feet: "feet";
                miles: "miles";
                inches: "inches";
            }>>;
            followsCaster: z.ZodOptional<z.ZodBoolean>;
            thickness: z.ZodOptional<z.ZodNumber>;
            thicknessUnit: z.ZodOptional<z.ZodEnum<{
                feet: "feet";
                miles: "miles";
                inches: "inches";
            }>>;
            width: z.ZodOptional<z.ZodNumber>;
            widthUnit: z.ZodOptional<z.ZodEnum<{
                feet: "feet";
                miles: "miles";
                inches: "inches";
            }>>;
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
                    both: "both";
                    one: "one";
                    inside: "inside";
                }>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        filter: z.ZodObject<{
            willing: z.ZodUnion<readonly [z.ZodEnum<{
                required: "required";
                not_applicable: "not_applicable";
            }>, z.ZodBoolean, z.ZodString]>;
            objectEligibility: z.ZodObject<{
                wornOrCarried: z.ZodString;
                magicalStatus: z.ZodEnum<{
                    any: "any";
                    not_applicable: "not_applicable";
                    nonmagical: "nonmagical";
                }>;
                fixedToSurface: z.ZodEnum<{
                    not_applicable: "not_applicable";
                    excluded: "excluded";
                }>;
                maxSize: z.ZodString;
                maxWeightPounds: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                maxWeightScaling: z.ZodString;
            }, z.core.$strip>;
            placementEligibility: z.ZodOptional<z.ZodObject<{
                unoccupied: z.ZodOptional<z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>>;
                surface: z.ZodOptional<z.ZodEnum<{
                    ground: "ground";
                    not_applicable: "not_applicable";
                    liquid: "liquid";
                    any_solid: "any_solid";
                }>>;
                destination: z.ZodOptional<z.ZodString>;
                notes: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            specialIdentity: z.ZodOptional<z.ZodObject<{
                corpseOrRemains: z.ZodOptional<z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>>;
                reactionTriggeringCreature: z.ZodOptional<z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>>;
                summonedByCaster: z.ZodOptional<z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>>;
                notes: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            communicationPrerequisites: z.ZodObject<{
                canHearCaster: z.ZodUnion<readonly [z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>, z.ZodBoolean, z.ZodString]>;
                canUnderstandCaster: z.ZodUnion<readonly [z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>, z.ZodBoolean, z.ZodString]>;
                canSeeCaster: z.ZodUnion<readonly [z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>, z.ZodBoolean, z.ZodString]>;
            }, z.core.$strip>;
            abilityThreshold: z.ZodObject<{
                ability: z.ZodEnum<{
                    not_applicable: "not_applicable";
                    Strength: "Strength";
                    Dexterity: "Dexterity";
                    Constitution: "Constitution";
                    Intelligence: "Intelligence";
                    Wisdom: "Wisdom";
                    Charisma: "Charisma";
                }>;
                operator: z.ZodEnum<{
                    not_applicable: "not_applicable";
                    greater_than: "greater_than";
                    greater_than_or_equal: "greater_than_or_equal";
                    less_than: "less_than";
                    less_than_or_equal: "less_than_or_equal";
                }>;
                value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            }, z.core.$strip>;
            selfRelation: z.ZodEnum<{
                not_applicable: "not_applicable";
                must_be_self: "must_be_self";
                must_be_other: "must_be_other";
                self_allowed: "self_allowed";
            }>;
            creatureTypes: z.ZodArray<z.ZodString>;
            excludeCreatureTypes: z.ZodArray<z.ZodString>;
            sizes: z.ZodArray<z.ZodString>;
            alignments: z.ZodArray<z.ZodString>;
            hasCondition: z.ZodArray<z.ZodString>;
            isNativeToPlane: z.ZodBoolean;
        }, z.core.$strip>;
        spatialDetails: z.ZodOptional<z.ZodObject<{
            forms: z.ZodOptional<z.ZodArray<z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                shape: z.ZodString;
                size: z.ZodOptional<z.ZodNumber>;
                sizeType: z.ZodOptional<z.ZodEnum<{
                    length: "length";
                    radius: "radius";
                    diameter: "diameter";
                    edge: "edge";
                    side: "side";
                    square: "square";
                }>>;
                sizeUnit: z.ZodOptional<z.ZodEnum<{
                    feet: "feet";
                    miles: "miles";
                    inches: "inches";
                }>>;
                height: z.ZodOptional<z.ZodNumber>;
                heightUnit: z.ZodOptional<z.ZodEnum<{
                    feet: "feet";
                    miles: "miles";
                    inches: "inches";
                }>>;
                width: z.ZodOptional<z.ZodNumber>;
                widthUnit: z.ZodOptional<z.ZodEnum<{
                    feet: "feet";
                    miles: "miles";
                    inches: "inches";
                }>>;
                thickness: z.ZodOptional<z.ZodNumber>;
                thicknessUnit: z.ZodOptional<z.ZodEnum<{
                    feet: "feet";
                    miles: "miles";
                    inches: "inches";
                }>>;
                segmentCount: z.ZodOptional<z.ZodNumber>;
                segmentWidth: z.ZodOptional<z.ZodNumber>;
                segmentWidthUnit: z.ZodOptional<z.ZodEnum<{
                    feet: "feet";
                    miles: "miles";
                    inches: "inches";
                }>>;
                segmentHeight: z.ZodOptional<z.ZodNumber>;
                segmentHeightUnit: z.ZodOptional<z.ZodEnum<{
                    feet: "feet";
                    miles: "miles";
                    inches: "inches";
                }>>;
                notes: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
            measuredDetails: z.ZodOptional<z.ZodArray<z.ZodObject<{
                label: z.ZodString;
                kind: z.ZodEnum<{
                    count: "count";
                    time: "time";
                    special: "special";
                    diameter: "diameter";
                    distance: "distance";
                    blocker: "blocker";
                    opening: "opening";
                    thickness: "thickness";
                    depth: "depth";
                    size_change: "size_change";
                    volume: "volume";
                }>;
                subject: z.ZodOptional<z.ZodString>;
                value: z.ZodOptional<z.ZodNumber>;
                unit: z.ZodOptional<z.ZodEnum<{
                    feet: "feet";
                    miles: "miles";
                    inches: "inches";
                    minutes: "minutes";
                    gallons: "gallons";
                }>>;
                qualifier: z.ZodOptional<z.ZodString>;
                notes: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        shape: z.ZodOptional<z.ZodEnum<{
            line: "line";
            cube: "cube";
            cone: "cone";
            sphere: "sphere";
            cylinder: "cylinder";
        }>>;
        radius: z.ZodOptional<z.ZodNumber>;
        areaTargetSelection: z.ZodOptional<z.ZodObject<{
            mode: z.ZodEnum<{
                not_applicable: "not_applicable";
                all_valid_targets: "all_valid_targets";
                caster_choice: "caster_choice";
                random: "random";
            }>;
            scope: z.ZodEnum<{
                not_applicable: "not_applicable";
                creatures_in_area: "creatures_in_area";
            }>;
            count: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"all_chosen">, z.ZodLiteral<"not_applicable">]>;
            excludesUnchosen: z.ZodBoolean;
            requiresLineOfSight: z.ZodOptional<z.ZodBoolean>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        allocation: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<{
                choice: "choice";
                random: "random";
                all: "all";
                pool: "pool";
            }>;
            pool: z.ZodOptional<z.ZodObject<{
                resource: z.ZodEnum<{
                    hp: "hp";
                    hit_dice: "hit_dice";
                }>;
                dice: z.ZodString;
                sortOrder: z.ZodEnum<{
                    ascending: "ascending";
                    descending: "descending";
                }>;
                strictLimit: z.ZodOptional<z.ZodBoolean>;
                scaling: z.ZodOptional<z.ZodObject<{}, z.core.$loose>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        instanceAllocation: z.ZodOptional<z.ZodObject<{
            instanceType: z.ZodEnum<{
                light: "light";
                not_applicable: "not_applicable";
                dart: "dart";
                beam: "beam";
                ray: "ray";
                projectile: "projectile";
                animated_tree: "animated_tree";
                controlled_undead: "controlled_undead";
            }>;
            baseCount: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            scalingRule: z.ZodOptional<z.ZodString>;
            assignment: z.ZodEnum<{
                not_applicable: "not_applicable";
                same_or_different_targets: "same_or_different_targets";
                unique_targets: "unique_targets";
                single_target_only: "single_target_only";
                independent_positions: "independent_positions";
            }>;
            resolution: z.ZodEnum<{
                not_applicable: "not_applicable";
                simultaneous: "simultaneous";
                sequential: "sequential";
                persistent: "persistent";
            }>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        targetCluster: z.ZodOptional<z.ZodObject<{
            requirement: z.ZodEnum<{
                required: "required";
                not_applicable: "not_applicable";
            }>;
            maxDistance: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            distanceUnit: z.ZodUnion<readonly [z.ZodEnum<{
                feet: "feet";
                miles: "miles";
                inches: "inches";
            }>, z.ZodLiteral<"not_applicable">]>;
            scope: z.ZodEnum<{
                not_applicable: "not_applicable";
                all_targets: "all_targets";
            }>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        perTargetChoice: z.ZodOptional<z.ZodObject<{
            choiceType: z.ZodEnum<{
                not_applicable: "not_applicable";
                ability: "ability";
            }>;
            scope: z.ZodEnum<{
                not_applicable: "not_applicable";
                each_target: "each_target";
            }>;
            options: z.ZodArray<z.ZodString>;
            differentChoicesAllowed: z.ZodBoolean;
            required: z.ZodBoolean;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        targetParticipation: z.ZodOptional<z.ZodObject<{
            requiresWithinRangeForFullCasting: z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    modeChoice: z.ZodOptional<z.ZodObject<{
        type: z.ZodString;
        timing: z.ZodString;
        optionCount: z.ZodNumber;
        optionsSource: z.ZodString;
        maxActiveNonInstantaneous: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>>;
        canDismissActive: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>>;
        options: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            summary: z.ZodString;
            effectIndices: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
            controlOptionIndices: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
            effectTypes: z.ZodOptional<z.ZodArray<z.ZodString>>;
            duration: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    castingTrigger: z.ZodOptional<z.ZodObject<{
        type: z.ZodEnum<{
            after_attack_hit: "after_attack_hit";
            when_visible_creature_casts_spell: "when_visible_creature_casts_spell";
        }>;
        timing: z.ZodOptional<z.ZodString>;
        requiredCost: z.ZodOptional<z.ZodEnum<{
            action: "action";
            reaction: "reaction";
            bonus_action: "bonus_action";
            free: "free";
        }>>;
        attackFilter: z.ZodOptional<z.ZodObject<{
            weaponType: z.ZodOptional<z.ZodEnum<{
                any: "any";
                ranged: "ranged";
                melee: "melee";
                melee_weapon: "melee_weapon";
                ranged_weapon: "ranged_weapon";
                unarmed: "unarmed";
            }>>;
            attackType: z.ZodOptional<z.ZodEnum<{
                any: "any";
                spell: "spell";
                unarmed: "unarmed";
                weapon: "weapon";
            }>>;
        }, z.core.$strip>>;
        targetBinding: z.ZodOptional<z.ZodString>;
        maxRangeFeet: z.ZodOptional<z.ZodNumber>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    pendingAttackTrigger: z.ZodOptional<z.ZodObject<{
        type: z.ZodEnum<{
            next_attack: "next_attack";
        }>;
        attackFilter: z.ZodOptional<z.ZodObject<{
            attackType: z.ZodOptional<z.ZodEnum<{
                any: "any";
                spell: "spell";
                unarmed: "unarmed";
                weapon: "weapon";
            }>>;
            weaponType: z.ZodOptional<z.ZodEnum<{
                any: "any";
                ranged: "ranged";
                melee: "melee";
                melee_weapon: "melee_weapon";
                ranged_weapon: "ranged_weapon";
                unarmed: "unarmed";
            }>>;
        }, z.core.$strip>>;
        resolvesOn: z.ZodEnum<{
            hit: "hit";
            hit_or_miss: "hit_or_miss";
            miss: "miss";
        }>;
        primaryTargetBinding: z.ZodOptional<z.ZodString>;
        consumption: z.ZodOptional<z.ZodEnum<{
            first_matching_attack: "first_matching_attack";
            every_matching_attack: "every_matching_attack";
        }>>;
        missResolution: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    interruptionState: z.ZodOptional<z.ZodObject<{
        event: z.ZodEnum<{
            visible_creature_casts_spell: "visible_creature_casts_spell";
        }>;
        saveType: z.ZodEnum<{
            Strength: "Strength";
            Dexterity: "Dexterity";
            Constitution: "Constitution";
            Intelligence: "Intelligence";
            Wisdom: "Wisdom";
            Charisma: "Charisma";
        }>;
        failureOutcome: z.ZodOptional<z.ZodEnum<{
            spell_has_no_effect: "spell_has_no_effect";
        }>>;
        failedSaveOutcome: z.ZodString;
        slotPolicy: z.ZodString;
        preservesInterruptedSlot: z.ZodOptional<z.ZodBoolean>;
        actionPolicy: z.ZodString;
        visibilityRequired: z.ZodBoolean;
        rangeFeet: z.ZodNumber;
        runtimeBoundary: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    effectSchedule: z.ZodOptional<z.ZodObject<{
        timing: z.ZodEnum<{
            caster_later_turn_start: "caster_later_turn_start";
        }>;
        entries: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            timing: z.ZodEnum<{
                caster_turn_start: "caster_turn_start";
            }>;
            turnStart: z.ZodNumber;
            turnEnd: z.ZodOptional<z.ZodNumber>;
            effectIndices: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
            effectTypes: z.ZodArray<z.ZodString>;
            targeting: z.ZodOptional<z.ZodObject<{
                count: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"all">]>;
                validTargets: z.ZodEnum<{
                    creature_or_object: "creature_or_object";
                    creatures: "creatures";
                    objects: "objects";
                }>;
                selection: z.ZodEnum<{
                    all_valid_targets: "all_valid_targets";
                    caster_choice: "caster_choice";
                }>;
                mustBeDifferent: z.ZodOptional<z.ZodBoolean>;
                notes: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            summary: z.ZodString;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    effects: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        trigger: z.ZodObject<{
            type: z.ZodString;
            frequency: z.ZodOptional<z.ZodEnum<{
                every_time: "every_time";
                first_per_turn: "first_per_turn";
                once_per_creature: "once_per_creature";
                once: "once";
            }>>;
            consumption: z.ZodOptional<z.ZodEnum<{
                unlimited: "unlimited";
                first_hit: "first_hit";
                per_turn: "per_turn";
                per_instance_hit_or_miss: "per_instance_hit_or_miss";
            }>>;
            attackFilter: z.ZodOptional<z.ZodObject<{
                weaponType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    ranged: "ranged";
                    melee: "melee";
                    melee_weapon: "melee_weapon";
                    ranged_weapon: "ranged_weapon";
                    unarmed: "unarmed";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    spell: "spell";
                    unarmed: "unarmed";
                    weapon: "weapon";
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
            areaTiming: z.ZodOptional<z.ZodArray<z.ZodString>>;
            repeatAction: z.ZodOptional<z.ZodObject<{}, z.core.$loose>>;
            onlyIf: z.ZodOptional<z.ZodString>;
            oncePerTurn: z.ZodOptional<z.ZodBoolean>;
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
                negates: "negates";
                negates_effect: "negates_effect";
            }>>;
            targetFilter: z.ZodOptional<z.ZodObject<{
                willing: z.ZodUnion<readonly [z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>, z.ZodBoolean, z.ZodString]>;
                objectEligibility: z.ZodObject<{
                    wornOrCarried: z.ZodString;
                    magicalStatus: z.ZodEnum<{
                        any: "any";
                        not_applicable: "not_applicable";
                        nonmagical: "nonmagical";
                    }>;
                    fixedToSurface: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        excluded: "excluded";
                    }>;
                    maxSize: z.ZodString;
                    maxWeightPounds: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                    maxWeightScaling: z.ZodString;
                }, z.core.$strip>;
                placementEligibility: z.ZodOptional<z.ZodObject<{
                    unoccupied: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    surface: z.ZodOptional<z.ZodEnum<{
                        ground: "ground";
                        not_applicable: "not_applicable";
                        liquid: "liquid";
                        any_solid: "any_solid";
                    }>>;
                    destination: z.ZodOptional<z.ZodString>;
                    notes: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                specialIdentity: z.ZodOptional<z.ZodObject<{
                    corpseOrRemains: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    reactionTriggeringCreature: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    summonedByCaster: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    notes: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                communicationPrerequisites: z.ZodObject<{
                    canHearCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    canUnderstandCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    canSeeCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                }, z.core.$strip>;
                abilityThreshold: z.ZodObject<{
                    ability: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        Strength: "Strength";
                        Dexterity: "Dexterity";
                        Constitution: "Constitution";
                        Intelligence: "Intelligence";
                        Wisdom: "Wisdom";
                        Charisma: "Charisma";
                    }>;
                    operator: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        greater_than: "greater_than";
                        greater_than_or_equal: "greater_than_or_equal";
                        less_than: "less_than";
                        less_than_or_equal: "less_than_or_equal";
                    }>;
                    value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                }, z.core.$strip>;
                selfRelation: z.ZodEnum<{
                    not_applicable: "not_applicable";
                    must_be_self: "must_be_self";
                    must_be_other: "must_be_other";
                    self_allowed: "self_allowed";
                }>;
                creatureTypes: z.ZodArray<z.ZodString>;
                excludeCreatureTypes: z.ZodArray<z.ZodString>;
                sizes: z.ZodArray<z.ZodString>;
                alignments: z.ZodArray<z.ZodString>;
                hasCondition: z.ZodArray<z.ZodString>;
                isNativeToPlane: z.ZodBoolean;
            }, z.core.$strip>>;
            requiresStatus: z.ZodOptional<z.ZodArray<z.ZodString>>;
            saveModifiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodOptional<z.ZodString>;
                modifier: z.ZodOptional<z.ZodString>;
                value: z.ZodOptional<z.ZodNumber>;
                appliesTo: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
                    willing: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    objectEligibility: z.ZodObject<{
                        wornOrCarried: z.ZodString;
                        magicalStatus: z.ZodEnum<{
                            any: "any";
                            not_applicable: "not_applicable";
                            nonmagical: "nonmagical";
                        }>;
                        fixedToSurface: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            excluded: "excluded";
                        }>;
                        maxSize: z.ZodString;
                        maxWeightPounds: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                        maxWeightScaling: z.ZodString;
                    }, z.core.$strip>;
                    placementEligibility: z.ZodOptional<z.ZodObject<{
                        unoccupied: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        surface: z.ZodOptional<z.ZodEnum<{
                            ground: "ground";
                            not_applicable: "not_applicable";
                            liquid: "liquid";
                            any_solid: "any_solid";
                        }>>;
                        destination: z.ZodOptional<z.ZodString>;
                        notes: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    specialIdentity: z.ZodOptional<z.ZodObject<{
                        corpseOrRemains: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        reactionTriggeringCreature: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        summonedByCaster: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        notes: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    communicationPrerequisites: z.ZodObject<{
                        canHearCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                        canUnderstandCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                        canSeeCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                    }, z.core.$strip>;
                    abilityThreshold: z.ZodObject<{
                        ability: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            Strength: "Strength";
                            Dexterity: "Dexterity";
                            Constitution: "Constitution";
                            Intelligence: "Intelligence";
                            Wisdom: "Wisdom";
                            Charisma: "Charisma";
                        }>;
                        operator: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            greater_than: "greater_than";
                            greater_than_or_equal: "greater_than_or_equal";
                            less_than: "less_than";
                            less_than_or_equal: "less_than_or_equal";
                        }>;
                        value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                    }, z.core.$strip>;
                    selfRelation: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        must_be_self: "must_be_self";
                        must_be_other: "must_be_other";
                        self_allowed: "self_allowed";
                    }>;
                    creatureTypes: z.ZodArray<z.ZodString>;
                    excludeCreatureTypes: z.ZodArray<z.ZodString>;
                    sizes: z.ZodArray<z.ZodString>;
                    alignments: z.ZodArray<z.ZodString>;
                    hasCondition: z.ZodArray<z.ZodString>;
                    isNativeToPlane: z.ZodBoolean;
                }, z.core.$strip>, z.ZodString]>>;
                reason: z.ZodOptional<z.ZodString>;
                condition: z.ZodOptional<z.ZodString>;
                source: z.ZodOptional<z.ZodString>;
                options: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    label: z.ZodString;
                    modifier: z.ZodNumber;
                }, z.core.$loose>>>;
                advantageOnDamage: z.ZodOptional<z.ZodBoolean>;
                sizeAdvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                sizeDisadvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                ignoredCover: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    total: "total";
                    half: "half";
                    three_quarters: "three_quarters";
                }>>>;
            }, z.core.$loose>>>;
            saveOutcomeOverrides: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
                outcome: z.ZodString;
                condition: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{}, z.core.$loose>]>>>;
        }, z.core.$strip>;
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
        secondaryTargeting: z.ZodOptional<z.ZodObject<{
            trigger: z.ZodEnum<{
                primary_hit: "primary_hit";
                duplicate_damage_die: "duplicate_damage_die";
            }>;
            origin: z.ZodEnum<{
                primary_target: "primary_target";
                previous_target: "previous_target";
            }>;
            range: z.ZodNumber;
            rangeUnit: z.ZodEnum<{
                feet: "feet";
                miles: "miles";
                inches: "inches";
            }>;
            validTargets: z.ZodEnum<{
                creature: "creature";
                creature_or_object: "creature_or_object";
            }>;
            selection: z.ZodEnum<{
                caster_choice: "caster_choice";
            }>;
            mustBeDifferent: z.ZodBoolean;
            requiresLineOfSight: z.ZodBoolean;
            requiresAttackRoll: z.ZodBoolean;
            requiresDamageRoll: z.ZodBoolean;
            repeatRule: z.ZodOptional<z.ZodEnum<{
                none: "none";
                slot_level_max_leaps: "slot_level_max_leaps";
            }>>;
            maxLeaps: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"slot_level">]>>;
            uniquePerCasting: z.ZodOptional<z.ZodBoolean>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        soundEmission: z.ZodOptional<z.ZodObject<{
            audibleRadius: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            radiusUnit: z.ZodEnum<{
                not_applicable: "not_applicable";
                feet: "feet";
                miles: "miles";
            }>;
            source: z.ZodEnum<{
                target: "target";
                not_applicable: "not_applicable";
                caster: "caster";
                target_object: "target_object";
                origin_space: "origin_space";
                spell_area: "spell_area";
            }>;
            trigger: z.ZodEnum<{
                not_applicable: "not_applicable";
                on_cast: "on_cast";
                on_hit: "on_hit";
                after_teleport: "after_teleport";
                on_trigger: "on_trigger";
            }>;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        conditionalEndings: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
        }, z.core.$strip>>>;
        fallControl: z.ZodOptional<z.ZodObject<{
            descentRate: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            descentRateUnit: z.ZodEnum<{
                not_applicable: "not_applicable";
                feet_per_round: "feet_per_round";
            }>;
            fallDamageOnLanding: z.ZodEnum<{
                not_applicable: "not_applicable";
                prevented: "prevented";
                normal: "normal";
            }>;
            endingTrigger: z.ZodOptional<z.ZodEnum<{
                not_applicable: "not_applicable";
                target_lands: "target_lands";
            }>>;
            endingScope: z.ZodOptional<z.ZodEnum<{
                spell: "spell";
                effect: "effect";
                not_applicable: "not_applicable";
            }>>;
        }, z.core.$strip>>;
        conditionRemoval: z.ZodOptional<z.ZodArray<z.ZodString>>;
        barrierDamagePrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        spellEffectPrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        deathPrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        endCleanup: z.ZodOptional<z.ZodUnion<readonly [z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$loose>]>>, z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$loose>]>]>>;
        sustainRequirement: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        linkedDamage: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        resistanceSuppression: z.ZodOptional<z.ZodObject<{
            damageType: z.ZodArray<z.ZodString>;
            damageTypeSource: z.ZodEnum<{
                triggering_damage_type: "triggering_damage_type";
                listed: "listed";
                chosen_damage_type: "chosen_damage_type";
            }>;
        }, z.core.$strip>>;
        damageInteraction: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        recurringMechanics: z.ZodOptional<z.ZodUnion<readonly [z.ZodArray<z.ZodObject<{
            timing: z.ZodOptional<z.ZodString>;
            frequency: z.ZodOptional<z.ZodString>;
            saveType: z.ZodOptional<z.ZodString>;
            saveEffect: z.ZodOptional<z.ZodString>;
            damage: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                type: z.ZodString;
                mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    resistance: "resistance";
                    immunity: "immunity";
                    damage_reduction: "damage_reduction";
                    damage_prevention: "damage_prevention";
                }>>>;
            }, z.core.$strip>>;
            healing: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                isTemporaryHp: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            successOutcome: z.ZodOptional<z.ZodString>;
            failureOutcome: z.ZodOptional<z.ZodString>;
            restriction: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>>, z.ZodObject<{
            timing: z.ZodOptional<z.ZodString>;
            frequency: z.ZodOptional<z.ZodString>;
            saveType: z.ZodOptional<z.ZodString>;
            saveEffect: z.ZodOptional<z.ZodString>;
            damage: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                type: z.ZodString;
                mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    resistance: "resistance";
                    immunity: "immunity";
                    damage_reduction: "damage_reduction";
                    damage_prevention: "damage_prevention";
                }>>>;
            }, z.core.$strip>>;
            healing: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                isTemporaryHp: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            successOutcome: z.ZodOptional<z.ZodString>;
            failureOutcome: z.ZodOptional<z.ZodString>;
            restriction: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>]>>;
        sensoryManifestation: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        illusion: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        description: z.ZodString;
        type: z.ZodLiteral<"DAMAGE">;
        damage: z.ZodObject<{
            dice: z.ZodString;
            type: z.ZodString;
            mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                resistance: "resistance";
                immunity: "immunity";
                damage_reduction: "damage_reduction";
                damage_prevention: "damage_prevention";
            }>>>;
            disintegration: z.ZodOptional<z.ZodObject<{
                creatureAtZeroHp: z.ZodBoolean;
                includesNonmagicalWornAndCarried: z.ZodBoolean;
                revivalOnlyBy: z.ZodArray<z.ZodString>;
                automaticTargetTypes: z.ZodArray<z.ZodString>;
                maxAutomaticTargetSize: z.ZodString;
                hugeOrLargerPortionCubeFeet: z.ZodNumber;
                residueName: z.ZodString;
                residueDescription: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        missDamageMultiplier: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        trigger: z.ZodObject<{
            type: z.ZodString;
            frequency: z.ZodOptional<z.ZodEnum<{
                every_time: "every_time";
                first_per_turn: "first_per_turn";
                once_per_creature: "once_per_creature";
                once: "once";
            }>>;
            consumption: z.ZodOptional<z.ZodEnum<{
                unlimited: "unlimited";
                first_hit: "first_hit";
                per_turn: "per_turn";
                per_instance_hit_or_miss: "per_instance_hit_or_miss";
            }>>;
            attackFilter: z.ZodOptional<z.ZodObject<{
                weaponType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    ranged: "ranged";
                    melee: "melee";
                    melee_weapon: "melee_weapon";
                    ranged_weapon: "ranged_weapon";
                    unarmed: "unarmed";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    spell: "spell";
                    unarmed: "unarmed";
                    weapon: "weapon";
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
            areaTiming: z.ZodOptional<z.ZodArray<z.ZodString>>;
            repeatAction: z.ZodOptional<z.ZodObject<{}, z.core.$loose>>;
            onlyIf: z.ZodOptional<z.ZodString>;
            oncePerTurn: z.ZodOptional<z.ZodBoolean>;
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
                negates: "negates";
                negates_effect: "negates_effect";
            }>>;
            targetFilter: z.ZodOptional<z.ZodObject<{
                willing: z.ZodUnion<readonly [z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>, z.ZodBoolean, z.ZodString]>;
                objectEligibility: z.ZodObject<{
                    wornOrCarried: z.ZodString;
                    magicalStatus: z.ZodEnum<{
                        any: "any";
                        not_applicable: "not_applicable";
                        nonmagical: "nonmagical";
                    }>;
                    fixedToSurface: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        excluded: "excluded";
                    }>;
                    maxSize: z.ZodString;
                    maxWeightPounds: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                    maxWeightScaling: z.ZodString;
                }, z.core.$strip>;
                placementEligibility: z.ZodOptional<z.ZodObject<{
                    unoccupied: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    surface: z.ZodOptional<z.ZodEnum<{
                        ground: "ground";
                        not_applicable: "not_applicable";
                        liquid: "liquid";
                        any_solid: "any_solid";
                    }>>;
                    destination: z.ZodOptional<z.ZodString>;
                    notes: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                specialIdentity: z.ZodOptional<z.ZodObject<{
                    corpseOrRemains: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    reactionTriggeringCreature: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    summonedByCaster: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    notes: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                communicationPrerequisites: z.ZodObject<{
                    canHearCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    canUnderstandCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    canSeeCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                }, z.core.$strip>;
                abilityThreshold: z.ZodObject<{
                    ability: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        Strength: "Strength";
                        Dexterity: "Dexterity";
                        Constitution: "Constitution";
                        Intelligence: "Intelligence";
                        Wisdom: "Wisdom";
                        Charisma: "Charisma";
                    }>;
                    operator: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        greater_than: "greater_than";
                        greater_than_or_equal: "greater_than_or_equal";
                        less_than: "less_than";
                        less_than_or_equal: "less_than_or_equal";
                    }>;
                    value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                }, z.core.$strip>;
                selfRelation: z.ZodEnum<{
                    not_applicable: "not_applicable";
                    must_be_self: "must_be_self";
                    must_be_other: "must_be_other";
                    self_allowed: "self_allowed";
                }>;
                creatureTypes: z.ZodArray<z.ZodString>;
                excludeCreatureTypes: z.ZodArray<z.ZodString>;
                sizes: z.ZodArray<z.ZodString>;
                alignments: z.ZodArray<z.ZodString>;
                hasCondition: z.ZodArray<z.ZodString>;
                isNativeToPlane: z.ZodBoolean;
            }, z.core.$strip>>;
            requiresStatus: z.ZodOptional<z.ZodArray<z.ZodString>>;
            saveModifiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodOptional<z.ZodString>;
                modifier: z.ZodOptional<z.ZodString>;
                value: z.ZodOptional<z.ZodNumber>;
                appliesTo: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
                    willing: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    objectEligibility: z.ZodObject<{
                        wornOrCarried: z.ZodString;
                        magicalStatus: z.ZodEnum<{
                            any: "any";
                            not_applicable: "not_applicable";
                            nonmagical: "nonmagical";
                        }>;
                        fixedToSurface: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            excluded: "excluded";
                        }>;
                        maxSize: z.ZodString;
                        maxWeightPounds: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                        maxWeightScaling: z.ZodString;
                    }, z.core.$strip>;
                    placementEligibility: z.ZodOptional<z.ZodObject<{
                        unoccupied: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        surface: z.ZodOptional<z.ZodEnum<{
                            ground: "ground";
                            not_applicable: "not_applicable";
                            liquid: "liquid";
                            any_solid: "any_solid";
                        }>>;
                        destination: z.ZodOptional<z.ZodString>;
                        notes: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    specialIdentity: z.ZodOptional<z.ZodObject<{
                        corpseOrRemains: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        reactionTriggeringCreature: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        summonedByCaster: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        notes: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    communicationPrerequisites: z.ZodObject<{
                        canHearCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                        canUnderstandCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                        canSeeCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                    }, z.core.$strip>;
                    abilityThreshold: z.ZodObject<{
                        ability: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            Strength: "Strength";
                            Dexterity: "Dexterity";
                            Constitution: "Constitution";
                            Intelligence: "Intelligence";
                            Wisdom: "Wisdom";
                            Charisma: "Charisma";
                        }>;
                        operator: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            greater_than: "greater_than";
                            greater_than_or_equal: "greater_than_or_equal";
                            less_than: "less_than";
                            less_than_or_equal: "less_than_or_equal";
                        }>;
                        value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                    }, z.core.$strip>;
                    selfRelation: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        must_be_self: "must_be_self";
                        must_be_other: "must_be_other";
                        self_allowed: "self_allowed";
                    }>;
                    creatureTypes: z.ZodArray<z.ZodString>;
                    excludeCreatureTypes: z.ZodArray<z.ZodString>;
                    sizes: z.ZodArray<z.ZodString>;
                    alignments: z.ZodArray<z.ZodString>;
                    hasCondition: z.ZodArray<z.ZodString>;
                    isNativeToPlane: z.ZodBoolean;
                }, z.core.$strip>, z.ZodString]>>;
                reason: z.ZodOptional<z.ZodString>;
                condition: z.ZodOptional<z.ZodString>;
                source: z.ZodOptional<z.ZodString>;
                options: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    label: z.ZodString;
                    modifier: z.ZodNumber;
                }, z.core.$loose>>>;
                advantageOnDamage: z.ZodOptional<z.ZodBoolean>;
                sizeAdvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                sizeDisadvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                ignoredCover: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    total: "total";
                    half: "half";
                    three_quarters: "three_quarters";
                }>>>;
            }, z.core.$loose>>>;
            saveOutcomeOverrides: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
                outcome: z.ZodString;
                condition: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{}, z.core.$loose>]>>>;
        }, z.core.$strip>;
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
        secondaryTargeting: z.ZodOptional<z.ZodObject<{
            trigger: z.ZodEnum<{
                primary_hit: "primary_hit";
                duplicate_damage_die: "duplicate_damage_die";
            }>;
            origin: z.ZodEnum<{
                primary_target: "primary_target";
                previous_target: "previous_target";
            }>;
            range: z.ZodNumber;
            rangeUnit: z.ZodEnum<{
                feet: "feet";
                miles: "miles";
                inches: "inches";
            }>;
            validTargets: z.ZodEnum<{
                creature: "creature";
                creature_or_object: "creature_or_object";
            }>;
            selection: z.ZodEnum<{
                caster_choice: "caster_choice";
            }>;
            mustBeDifferent: z.ZodBoolean;
            requiresLineOfSight: z.ZodBoolean;
            requiresAttackRoll: z.ZodBoolean;
            requiresDamageRoll: z.ZodBoolean;
            repeatRule: z.ZodOptional<z.ZodEnum<{
                none: "none";
                slot_level_max_leaps: "slot_level_max_leaps";
            }>>;
            maxLeaps: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"slot_level">]>>;
            uniquePerCasting: z.ZodOptional<z.ZodBoolean>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        soundEmission: z.ZodOptional<z.ZodObject<{
            audibleRadius: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            radiusUnit: z.ZodEnum<{
                not_applicable: "not_applicable";
                feet: "feet";
                miles: "miles";
            }>;
            source: z.ZodEnum<{
                target: "target";
                not_applicable: "not_applicable";
                caster: "caster";
                target_object: "target_object";
                origin_space: "origin_space";
                spell_area: "spell_area";
            }>;
            trigger: z.ZodEnum<{
                not_applicable: "not_applicable";
                on_cast: "on_cast";
                on_hit: "on_hit";
                after_teleport: "after_teleport";
                on_trigger: "on_trigger";
            }>;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        conditionalEndings: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
        }, z.core.$strip>>>;
        fallControl: z.ZodOptional<z.ZodObject<{
            descentRate: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            descentRateUnit: z.ZodEnum<{
                not_applicable: "not_applicable";
                feet_per_round: "feet_per_round";
            }>;
            fallDamageOnLanding: z.ZodEnum<{
                not_applicable: "not_applicable";
                prevented: "prevented";
                normal: "normal";
            }>;
            endingTrigger: z.ZodOptional<z.ZodEnum<{
                not_applicable: "not_applicable";
                target_lands: "target_lands";
            }>>;
            endingScope: z.ZodOptional<z.ZodEnum<{
                spell: "spell";
                effect: "effect";
                not_applicable: "not_applicable";
            }>>;
        }, z.core.$strip>>;
        conditionRemoval: z.ZodOptional<z.ZodArray<z.ZodString>>;
        barrierDamagePrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        spellEffectPrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        deathPrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        endCleanup: z.ZodOptional<z.ZodUnion<readonly [z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$loose>]>>, z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$loose>]>]>>;
        sustainRequirement: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        linkedDamage: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        resistanceSuppression: z.ZodOptional<z.ZodObject<{
            damageType: z.ZodArray<z.ZodString>;
            damageTypeSource: z.ZodEnum<{
                triggering_damage_type: "triggering_damage_type";
                listed: "listed";
                chosen_damage_type: "chosen_damage_type";
            }>;
        }, z.core.$strip>>;
        damageInteraction: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        recurringMechanics: z.ZodOptional<z.ZodUnion<readonly [z.ZodArray<z.ZodObject<{
            timing: z.ZodOptional<z.ZodString>;
            frequency: z.ZodOptional<z.ZodString>;
            saveType: z.ZodOptional<z.ZodString>;
            saveEffect: z.ZodOptional<z.ZodString>;
            damage: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                type: z.ZodString;
                mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    resistance: "resistance";
                    immunity: "immunity";
                    damage_reduction: "damage_reduction";
                    damage_prevention: "damage_prevention";
                }>>>;
            }, z.core.$strip>>;
            healing: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                isTemporaryHp: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            successOutcome: z.ZodOptional<z.ZodString>;
            failureOutcome: z.ZodOptional<z.ZodString>;
            restriction: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>>, z.ZodObject<{
            timing: z.ZodOptional<z.ZodString>;
            frequency: z.ZodOptional<z.ZodString>;
            saveType: z.ZodOptional<z.ZodString>;
            saveEffect: z.ZodOptional<z.ZodString>;
            damage: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                type: z.ZodString;
                mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    resistance: "resistance";
                    immunity: "immunity";
                    damage_reduction: "damage_reduction";
                    damage_prevention: "damage_prevention";
                }>>>;
            }, z.core.$strip>>;
            healing: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                isTemporaryHp: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            successOutcome: z.ZodOptional<z.ZodString>;
            failureOutcome: z.ZodOptional<z.ZodString>;
            restriction: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>]>>;
        sensoryManifestation: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        illusion: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        description: z.ZodString;
        type: z.ZodLiteral<"HEALING">;
        healing: z.ZodObject<{
            dice: z.ZodOptional<z.ZodString>;
            isTemporaryHp: z.ZodOptional<z.ZodBoolean>;
            pool: z.ZodOptional<z.ZodNumber>;
            distribution: z.ZodOptional<z.ZodString>;
            amount: z.ZodOptional<z.ZodString>;
            target: z.ZodOptional<z.ZodString>;
            exclusions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            cannotAffect: z.ZodOptional<z.ZodArray<z.ZodString>>;
            trigger: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>;
    }, z.core.$strip>, z.ZodObject<{
        trigger: z.ZodObject<{
            type: z.ZodString;
            frequency: z.ZodOptional<z.ZodEnum<{
                every_time: "every_time";
                first_per_turn: "first_per_turn";
                once_per_creature: "once_per_creature";
                once: "once";
            }>>;
            consumption: z.ZodOptional<z.ZodEnum<{
                unlimited: "unlimited";
                first_hit: "first_hit";
                per_turn: "per_turn";
                per_instance_hit_or_miss: "per_instance_hit_or_miss";
            }>>;
            attackFilter: z.ZodOptional<z.ZodObject<{
                weaponType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    ranged: "ranged";
                    melee: "melee";
                    melee_weapon: "melee_weapon";
                    ranged_weapon: "ranged_weapon";
                    unarmed: "unarmed";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    spell: "spell";
                    unarmed: "unarmed";
                    weapon: "weapon";
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
            areaTiming: z.ZodOptional<z.ZodArray<z.ZodString>>;
            repeatAction: z.ZodOptional<z.ZodObject<{}, z.core.$loose>>;
            onlyIf: z.ZodOptional<z.ZodString>;
            oncePerTurn: z.ZodOptional<z.ZodBoolean>;
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
                negates: "negates";
                negates_effect: "negates_effect";
            }>>;
            targetFilter: z.ZodOptional<z.ZodObject<{
                willing: z.ZodUnion<readonly [z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>, z.ZodBoolean, z.ZodString]>;
                objectEligibility: z.ZodObject<{
                    wornOrCarried: z.ZodString;
                    magicalStatus: z.ZodEnum<{
                        any: "any";
                        not_applicable: "not_applicable";
                        nonmagical: "nonmagical";
                    }>;
                    fixedToSurface: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        excluded: "excluded";
                    }>;
                    maxSize: z.ZodString;
                    maxWeightPounds: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                    maxWeightScaling: z.ZodString;
                }, z.core.$strip>;
                placementEligibility: z.ZodOptional<z.ZodObject<{
                    unoccupied: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    surface: z.ZodOptional<z.ZodEnum<{
                        ground: "ground";
                        not_applicable: "not_applicable";
                        liquid: "liquid";
                        any_solid: "any_solid";
                    }>>;
                    destination: z.ZodOptional<z.ZodString>;
                    notes: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                specialIdentity: z.ZodOptional<z.ZodObject<{
                    corpseOrRemains: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    reactionTriggeringCreature: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    summonedByCaster: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    notes: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                communicationPrerequisites: z.ZodObject<{
                    canHearCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    canUnderstandCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    canSeeCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                }, z.core.$strip>;
                abilityThreshold: z.ZodObject<{
                    ability: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        Strength: "Strength";
                        Dexterity: "Dexterity";
                        Constitution: "Constitution";
                        Intelligence: "Intelligence";
                        Wisdom: "Wisdom";
                        Charisma: "Charisma";
                    }>;
                    operator: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        greater_than: "greater_than";
                        greater_than_or_equal: "greater_than_or_equal";
                        less_than: "less_than";
                        less_than_or_equal: "less_than_or_equal";
                    }>;
                    value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                }, z.core.$strip>;
                selfRelation: z.ZodEnum<{
                    not_applicable: "not_applicable";
                    must_be_self: "must_be_self";
                    must_be_other: "must_be_other";
                    self_allowed: "self_allowed";
                }>;
                creatureTypes: z.ZodArray<z.ZodString>;
                excludeCreatureTypes: z.ZodArray<z.ZodString>;
                sizes: z.ZodArray<z.ZodString>;
                alignments: z.ZodArray<z.ZodString>;
                hasCondition: z.ZodArray<z.ZodString>;
                isNativeToPlane: z.ZodBoolean;
            }, z.core.$strip>>;
            requiresStatus: z.ZodOptional<z.ZodArray<z.ZodString>>;
            saveModifiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodOptional<z.ZodString>;
                modifier: z.ZodOptional<z.ZodString>;
                value: z.ZodOptional<z.ZodNumber>;
                appliesTo: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
                    willing: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    objectEligibility: z.ZodObject<{
                        wornOrCarried: z.ZodString;
                        magicalStatus: z.ZodEnum<{
                            any: "any";
                            not_applicable: "not_applicable";
                            nonmagical: "nonmagical";
                        }>;
                        fixedToSurface: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            excluded: "excluded";
                        }>;
                        maxSize: z.ZodString;
                        maxWeightPounds: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                        maxWeightScaling: z.ZodString;
                    }, z.core.$strip>;
                    placementEligibility: z.ZodOptional<z.ZodObject<{
                        unoccupied: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        surface: z.ZodOptional<z.ZodEnum<{
                            ground: "ground";
                            not_applicable: "not_applicable";
                            liquid: "liquid";
                            any_solid: "any_solid";
                        }>>;
                        destination: z.ZodOptional<z.ZodString>;
                        notes: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    specialIdentity: z.ZodOptional<z.ZodObject<{
                        corpseOrRemains: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        reactionTriggeringCreature: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        summonedByCaster: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        notes: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    communicationPrerequisites: z.ZodObject<{
                        canHearCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                        canUnderstandCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                        canSeeCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                    }, z.core.$strip>;
                    abilityThreshold: z.ZodObject<{
                        ability: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            Strength: "Strength";
                            Dexterity: "Dexterity";
                            Constitution: "Constitution";
                            Intelligence: "Intelligence";
                            Wisdom: "Wisdom";
                            Charisma: "Charisma";
                        }>;
                        operator: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            greater_than: "greater_than";
                            greater_than_or_equal: "greater_than_or_equal";
                            less_than: "less_than";
                            less_than_or_equal: "less_than_or_equal";
                        }>;
                        value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                    }, z.core.$strip>;
                    selfRelation: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        must_be_self: "must_be_self";
                        must_be_other: "must_be_other";
                        self_allowed: "self_allowed";
                    }>;
                    creatureTypes: z.ZodArray<z.ZodString>;
                    excludeCreatureTypes: z.ZodArray<z.ZodString>;
                    sizes: z.ZodArray<z.ZodString>;
                    alignments: z.ZodArray<z.ZodString>;
                    hasCondition: z.ZodArray<z.ZodString>;
                    isNativeToPlane: z.ZodBoolean;
                }, z.core.$strip>, z.ZodString]>>;
                reason: z.ZodOptional<z.ZodString>;
                condition: z.ZodOptional<z.ZodString>;
                source: z.ZodOptional<z.ZodString>;
                options: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    label: z.ZodString;
                    modifier: z.ZodNumber;
                }, z.core.$loose>>>;
                advantageOnDamage: z.ZodOptional<z.ZodBoolean>;
                sizeAdvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                sizeDisadvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                ignoredCover: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    total: "total";
                    half: "half";
                    three_quarters: "three_quarters";
                }>>>;
            }, z.core.$loose>>>;
            saveOutcomeOverrides: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
                outcome: z.ZodString;
                condition: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{}, z.core.$loose>]>>>;
        }, z.core.$strip>;
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
        secondaryTargeting: z.ZodOptional<z.ZodObject<{
            trigger: z.ZodEnum<{
                primary_hit: "primary_hit";
                duplicate_damage_die: "duplicate_damage_die";
            }>;
            origin: z.ZodEnum<{
                primary_target: "primary_target";
                previous_target: "previous_target";
            }>;
            range: z.ZodNumber;
            rangeUnit: z.ZodEnum<{
                feet: "feet";
                miles: "miles";
                inches: "inches";
            }>;
            validTargets: z.ZodEnum<{
                creature: "creature";
                creature_or_object: "creature_or_object";
            }>;
            selection: z.ZodEnum<{
                caster_choice: "caster_choice";
            }>;
            mustBeDifferent: z.ZodBoolean;
            requiresLineOfSight: z.ZodBoolean;
            requiresAttackRoll: z.ZodBoolean;
            requiresDamageRoll: z.ZodBoolean;
            repeatRule: z.ZodOptional<z.ZodEnum<{
                none: "none";
                slot_level_max_leaps: "slot_level_max_leaps";
            }>>;
            maxLeaps: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"slot_level">]>>;
            uniquePerCasting: z.ZodOptional<z.ZodBoolean>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        soundEmission: z.ZodOptional<z.ZodObject<{
            audibleRadius: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            radiusUnit: z.ZodEnum<{
                not_applicable: "not_applicable";
                feet: "feet";
                miles: "miles";
            }>;
            source: z.ZodEnum<{
                target: "target";
                not_applicable: "not_applicable";
                caster: "caster";
                target_object: "target_object";
                origin_space: "origin_space";
                spell_area: "spell_area";
            }>;
            trigger: z.ZodEnum<{
                not_applicable: "not_applicable";
                on_cast: "on_cast";
                on_hit: "on_hit";
                after_teleport: "after_teleport";
                on_trigger: "on_trigger";
            }>;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        conditionalEndings: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
        }, z.core.$strip>>>;
        fallControl: z.ZodOptional<z.ZodObject<{
            descentRate: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            descentRateUnit: z.ZodEnum<{
                not_applicable: "not_applicable";
                feet_per_round: "feet_per_round";
            }>;
            fallDamageOnLanding: z.ZodEnum<{
                not_applicable: "not_applicable";
                prevented: "prevented";
                normal: "normal";
            }>;
            endingTrigger: z.ZodOptional<z.ZodEnum<{
                not_applicable: "not_applicable";
                target_lands: "target_lands";
            }>>;
            endingScope: z.ZodOptional<z.ZodEnum<{
                spell: "spell";
                effect: "effect";
                not_applicable: "not_applicable";
            }>>;
        }, z.core.$strip>>;
        conditionRemoval: z.ZodOptional<z.ZodArray<z.ZodString>>;
        barrierDamagePrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        spellEffectPrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        deathPrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        endCleanup: z.ZodOptional<z.ZodUnion<readonly [z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$loose>]>>, z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$loose>]>]>>;
        sustainRequirement: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        linkedDamage: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        resistanceSuppression: z.ZodOptional<z.ZodObject<{
            damageType: z.ZodArray<z.ZodString>;
            damageTypeSource: z.ZodEnum<{
                triggering_damage_type: "triggering_damage_type";
                listed: "listed";
                chosen_damage_type: "chosen_damage_type";
            }>;
        }, z.core.$strip>>;
        damageInteraction: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        recurringMechanics: z.ZodOptional<z.ZodUnion<readonly [z.ZodArray<z.ZodObject<{
            timing: z.ZodOptional<z.ZodString>;
            frequency: z.ZodOptional<z.ZodString>;
            saveType: z.ZodOptional<z.ZodString>;
            saveEffect: z.ZodOptional<z.ZodString>;
            damage: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                type: z.ZodString;
                mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    resistance: "resistance";
                    immunity: "immunity";
                    damage_reduction: "damage_reduction";
                    damage_prevention: "damage_prevention";
                }>>>;
            }, z.core.$strip>>;
            healing: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                isTemporaryHp: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            successOutcome: z.ZodOptional<z.ZodString>;
            failureOutcome: z.ZodOptional<z.ZodString>;
            restriction: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>>, z.ZodObject<{
            timing: z.ZodOptional<z.ZodString>;
            frequency: z.ZodOptional<z.ZodString>;
            saveType: z.ZodOptional<z.ZodString>;
            saveEffect: z.ZodOptional<z.ZodString>;
            damage: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                type: z.ZodString;
                mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    resistance: "resistance";
                    immunity: "immunity";
                    damage_reduction: "damage_reduction";
                    damage_prevention: "damage_prevention";
                }>>>;
            }, z.core.$strip>>;
            healing: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                isTemporaryHp: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            successOutcome: z.ZodOptional<z.ZodString>;
            failureOutcome: z.ZodOptional<z.ZodString>;
            restriction: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>]>>;
        sensoryManifestation: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        illusion: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        description: z.ZodString;
        type: z.ZodLiteral<"STATUS_CONDITION">;
        statusCondition: z.ZodObject<{
            name: z.ZodString;
            duration: z.ZodObject<{
                type: z.ZodString;
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
                abilityOptions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                skill: z.ZodOptional<z.ZodString>;
                dc: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
                actionCost: z.ZodString;
                success: z.ZodOptional<z.ZodString>;
                eligibleActors: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    affected_creature: "affected_creature";
                    creature_that_can_reach_affected_creature: "creature_that_can_reach_affected_creature";
                }>>>;
            }, z.core.$loose>>;
            repeatSave: z.ZodOptional<z.ZodObject<{
                timing: z.ZodEnum<{
                    turn_start: "turn_start";
                    turn_end: "turn_end";
                    on_damage: "on_damage";
                    on_action: "on_action";
                    after_forced_movement: "after_forced_movement";
                }>;
                additionalTimings: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    turn_start: "turn_start";
                    turn_end: "turn_end";
                    on_damage: "on_damage";
                    on_action: "on_action";
                    after_forced_movement: "after_forced_movement";
                }>>>;
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
                prerequisites: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    no_line_of_sight_to_caster: "no_line_of_sight_to_caster";
                }>>>;
                modifiers: z.ZodOptional<z.ZodObject<{
                    advantageOnDamage: z.ZodOptional<z.ZodBoolean>;
                    sizeAdvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    sizeDisadvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                }, z.core.$strip>>;
                progression: z.ZodOptional<z.ZodObject<{
                    successThreshold: z.ZodOptional<z.ZodNumber>;
                    failureThreshold: z.ZodOptional<z.ZodNumber>;
                    consecutiveRequired: z.ZodOptional<z.ZodBoolean>;
                    successOutcome: z.ZodOptional<z.ZodString>;
                    failureOutcome: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            breakTriggers: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                target_takes_damage: "target_takes_damage";
                adjacent_creature_action_shakes_awake: "adjacent_creature_action_shakes_awake";
                caster_makes_attack_roll: "caster_makes_attack_roll";
                caster_deals_damage: "caster_deals_damage";
                caster_forces_save: "caster_forces_save";
                concentration_ends: "concentration_ends";
                duration_expires: "duration_expires";
            }>>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        trigger: z.ZodObject<{
            type: z.ZodString;
            frequency: z.ZodOptional<z.ZodEnum<{
                every_time: "every_time";
                first_per_turn: "first_per_turn";
                once_per_creature: "once_per_creature";
                once: "once";
            }>>;
            consumption: z.ZodOptional<z.ZodEnum<{
                unlimited: "unlimited";
                first_hit: "first_hit";
                per_turn: "per_turn";
                per_instance_hit_or_miss: "per_instance_hit_or_miss";
            }>>;
            attackFilter: z.ZodOptional<z.ZodObject<{
                weaponType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    ranged: "ranged";
                    melee: "melee";
                    melee_weapon: "melee_weapon";
                    ranged_weapon: "ranged_weapon";
                    unarmed: "unarmed";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    spell: "spell";
                    unarmed: "unarmed";
                    weapon: "weapon";
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
            areaTiming: z.ZodOptional<z.ZodArray<z.ZodString>>;
            repeatAction: z.ZodOptional<z.ZodObject<{}, z.core.$loose>>;
            onlyIf: z.ZodOptional<z.ZodString>;
            oncePerTurn: z.ZodOptional<z.ZodBoolean>;
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
                negates: "negates";
                negates_effect: "negates_effect";
            }>>;
            targetFilter: z.ZodOptional<z.ZodObject<{
                willing: z.ZodUnion<readonly [z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>, z.ZodBoolean, z.ZodString]>;
                objectEligibility: z.ZodObject<{
                    wornOrCarried: z.ZodString;
                    magicalStatus: z.ZodEnum<{
                        any: "any";
                        not_applicable: "not_applicable";
                        nonmagical: "nonmagical";
                    }>;
                    fixedToSurface: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        excluded: "excluded";
                    }>;
                    maxSize: z.ZodString;
                    maxWeightPounds: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                    maxWeightScaling: z.ZodString;
                }, z.core.$strip>;
                placementEligibility: z.ZodOptional<z.ZodObject<{
                    unoccupied: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    surface: z.ZodOptional<z.ZodEnum<{
                        ground: "ground";
                        not_applicable: "not_applicable";
                        liquid: "liquid";
                        any_solid: "any_solid";
                    }>>;
                    destination: z.ZodOptional<z.ZodString>;
                    notes: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                specialIdentity: z.ZodOptional<z.ZodObject<{
                    corpseOrRemains: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    reactionTriggeringCreature: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    summonedByCaster: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    notes: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                communicationPrerequisites: z.ZodObject<{
                    canHearCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    canUnderstandCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    canSeeCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                }, z.core.$strip>;
                abilityThreshold: z.ZodObject<{
                    ability: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        Strength: "Strength";
                        Dexterity: "Dexterity";
                        Constitution: "Constitution";
                        Intelligence: "Intelligence";
                        Wisdom: "Wisdom";
                        Charisma: "Charisma";
                    }>;
                    operator: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        greater_than: "greater_than";
                        greater_than_or_equal: "greater_than_or_equal";
                        less_than: "less_than";
                        less_than_or_equal: "less_than_or_equal";
                    }>;
                    value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                }, z.core.$strip>;
                selfRelation: z.ZodEnum<{
                    not_applicable: "not_applicable";
                    must_be_self: "must_be_self";
                    must_be_other: "must_be_other";
                    self_allowed: "self_allowed";
                }>;
                creatureTypes: z.ZodArray<z.ZodString>;
                excludeCreatureTypes: z.ZodArray<z.ZodString>;
                sizes: z.ZodArray<z.ZodString>;
                alignments: z.ZodArray<z.ZodString>;
                hasCondition: z.ZodArray<z.ZodString>;
                isNativeToPlane: z.ZodBoolean;
            }, z.core.$strip>>;
            requiresStatus: z.ZodOptional<z.ZodArray<z.ZodString>>;
            saveModifiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodOptional<z.ZodString>;
                modifier: z.ZodOptional<z.ZodString>;
                value: z.ZodOptional<z.ZodNumber>;
                appliesTo: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
                    willing: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    objectEligibility: z.ZodObject<{
                        wornOrCarried: z.ZodString;
                        magicalStatus: z.ZodEnum<{
                            any: "any";
                            not_applicable: "not_applicable";
                            nonmagical: "nonmagical";
                        }>;
                        fixedToSurface: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            excluded: "excluded";
                        }>;
                        maxSize: z.ZodString;
                        maxWeightPounds: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                        maxWeightScaling: z.ZodString;
                    }, z.core.$strip>;
                    placementEligibility: z.ZodOptional<z.ZodObject<{
                        unoccupied: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        surface: z.ZodOptional<z.ZodEnum<{
                            ground: "ground";
                            not_applicable: "not_applicable";
                            liquid: "liquid";
                            any_solid: "any_solid";
                        }>>;
                        destination: z.ZodOptional<z.ZodString>;
                        notes: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    specialIdentity: z.ZodOptional<z.ZodObject<{
                        corpseOrRemains: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        reactionTriggeringCreature: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        summonedByCaster: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        notes: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    communicationPrerequisites: z.ZodObject<{
                        canHearCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                        canUnderstandCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                        canSeeCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                    }, z.core.$strip>;
                    abilityThreshold: z.ZodObject<{
                        ability: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            Strength: "Strength";
                            Dexterity: "Dexterity";
                            Constitution: "Constitution";
                            Intelligence: "Intelligence";
                            Wisdom: "Wisdom";
                            Charisma: "Charisma";
                        }>;
                        operator: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            greater_than: "greater_than";
                            greater_than_or_equal: "greater_than_or_equal";
                            less_than: "less_than";
                            less_than_or_equal: "less_than_or_equal";
                        }>;
                        value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                    }, z.core.$strip>;
                    selfRelation: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        must_be_self: "must_be_self";
                        must_be_other: "must_be_other";
                        self_allowed: "self_allowed";
                    }>;
                    creatureTypes: z.ZodArray<z.ZodString>;
                    excludeCreatureTypes: z.ZodArray<z.ZodString>;
                    sizes: z.ZodArray<z.ZodString>;
                    alignments: z.ZodArray<z.ZodString>;
                    hasCondition: z.ZodArray<z.ZodString>;
                    isNativeToPlane: z.ZodBoolean;
                }, z.core.$strip>, z.ZodString]>>;
                reason: z.ZodOptional<z.ZodString>;
                condition: z.ZodOptional<z.ZodString>;
                source: z.ZodOptional<z.ZodString>;
                options: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    label: z.ZodString;
                    modifier: z.ZodNumber;
                }, z.core.$loose>>>;
                advantageOnDamage: z.ZodOptional<z.ZodBoolean>;
                sizeAdvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                sizeDisadvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                ignoredCover: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    total: "total";
                    half: "half";
                    three_quarters: "three_quarters";
                }>>>;
            }, z.core.$loose>>>;
            saveOutcomeOverrides: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
                outcome: z.ZodString;
                condition: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{}, z.core.$loose>]>>>;
        }, z.core.$strip>;
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
        secondaryTargeting: z.ZodOptional<z.ZodObject<{
            trigger: z.ZodEnum<{
                primary_hit: "primary_hit";
                duplicate_damage_die: "duplicate_damage_die";
            }>;
            origin: z.ZodEnum<{
                primary_target: "primary_target";
                previous_target: "previous_target";
            }>;
            range: z.ZodNumber;
            rangeUnit: z.ZodEnum<{
                feet: "feet";
                miles: "miles";
                inches: "inches";
            }>;
            validTargets: z.ZodEnum<{
                creature: "creature";
                creature_or_object: "creature_or_object";
            }>;
            selection: z.ZodEnum<{
                caster_choice: "caster_choice";
            }>;
            mustBeDifferent: z.ZodBoolean;
            requiresLineOfSight: z.ZodBoolean;
            requiresAttackRoll: z.ZodBoolean;
            requiresDamageRoll: z.ZodBoolean;
            repeatRule: z.ZodOptional<z.ZodEnum<{
                none: "none";
                slot_level_max_leaps: "slot_level_max_leaps";
            }>>;
            maxLeaps: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"slot_level">]>>;
            uniquePerCasting: z.ZodOptional<z.ZodBoolean>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        soundEmission: z.ZodOptional<z.ZodObject<{
            audibleRadius: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            radiusUnit: z.ZodEnum<{
                not_applicable: "not_applicable";
                feet: "feet";
                miles: "miles";
            }>;
            source: z.ZodEnum<{
                target: "target";
                not_applicable: "not_applicable";
                caster: "caster";
                target_object: "target_object";
                origin_space: "origin_space";
                spell_area: "spell_area";
            }>;
            trigger: z.ZodEnum<{
                not_applicable: "not_applicable";
                on_cast: "on_cast";
                on_hit: "on_hit";
                after_teleport: "after_teleport";
                on_trigger: "on_trigger";
            }>;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        conditionalEndings: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
        }, z.core.$strip>>>;
        fallControl: z.ZodOptional<z.ZodObject<{
            descentRate: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            descentRateUnit: z.ZodEnum<{
                not_applicable: "not_applicable";
                feet_per_round: "feet_per_round";
            }>;
            fallDamageOnLanding: z.ZodEnum<{
                not_applicable: "not_applicable";
                prevented: "prevented";
                normal: "normal";
            }>;
            endingTrigger: z.ZodOptional<z.ZodEnum<{
                not_applicable: "not_applicable";
                target_lands: "target_lands";
            }>>;
            endingScope: z.ZodOptional<z.ZodEnum<{
                spell: "spell";
                effect: "effect";
                not_applicable: "not_applicable";
            }>>;
        }, z.core.$strip>>;
        conditionRemoval: z.ZodOptional<z.ZodArray<z.ZodString>>;
        barrierDamagePrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        spellEffectPrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        deathPrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        endCleanup: z.ZodOptional<z.ZodUnion<readonly [z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$loose>]>>, z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$loose>]>]>>;
        sustainRequirement: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        linkedDamage: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        resistanceSuppression: z.ZodOptional<z.ZodObject<{
            damageType: z.ZodArray<z.ZodString>;
            damageTypeSource: z.ZodEnum<{
                triggering_damage_type: "triggering_damage_type";
                listed: "listed";
                chosen_damage_type: "chosen_damage_type";
            }>;
        }, z.core.$strip>>;
        damageInteraction: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        recurringMechanics: z.ZodOptional<z.ZodUnion<readonly [z.ZodArray<z.ZodObject<{
            timing: z.ZodOptional<z.ZodString>;
            frequency: z.ZodOptional<z.ZodString>;
            saveType: z.ZodOptional<z.ZodString>;
            saveEffect: z.ZodOptional<z.ZodString>;
            damage: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                type: z.ZodString;
                mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    resistance: "resistance";
                    immunity: "immunity";
                    damage_reduction: "damage_reduction";
                    damage_prevention: "damage_prevention";
                }>>>;
            }, z.core.$strip>>;
            healing: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                isTemporaryHp: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            successOutcome: z.ZodOptional<z.ZodString>;
            failureOutcome: z.ZodOptional<z.ZodString>;
            restriction: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>>, z.ZodObject<{
            timing: z.ZodOptional<z.ZodString>;
            frequency: z.ZodOptional<z.ZodString>;
            saveType: z.ZodOptional<z.ZodString>;
            saveEffect: z.ZodOptional<z.ZodString>;
            damage: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                type: z.ZodString;
                mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    resistance: "resistance";
                    immunity: "immunity";
                    damage_reduction: "damage_reduction";
                    damage_prevention: "damage_prevention";
                }>>>;
            }, z.core.$strip>>;
            healing: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                isTemporaryHp: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            successOutcome: z.ZodOptional<z.ZodString>;
            failureOutcome: z.ZodOptional<z.ZodString>;
            restriction: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>]>>;
        sensoryManifestation: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        illusion: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        description: z.ZodString;
        type: z.ZodLiteral<"ATTACK_ROLL_MODIFIER">;
        attackRollModifier: z.ZodObject<{
            modifier: z.ZodEnum<{
                bonus: "bonus";
                penalty: "penalty";
                advantage: "advantage";
                disadvantage: "disadvantage";
            }>;
            direction: z.ZodEnum<{
                incoming: "incoming";
                outgoing: "outgoing";
            }>;
            attackKind: z.ZodEnum<{
                any: "any";
                spell: "spell";
                melee_weapon: "melee_weapon";
                ranged_weapon: "ranged_weapon";
                weapon: "weapon";
            }>;
            consumption: z.ZodEnum<{
                while_active: "while_active";
                next_attack: "next_attack";
                first_attack: "first_attack";
            }>;
            duration: z.ZodObject<{
                type: z.ZodString;
                value: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
            dice: z.ZodOptional<z.ZodString>;
            value: z.ZodOptional<z.ZodNumber>;
            attackerFilter: z.ZodOptional<z.ZodObject<{
                willing: z.ZodUnion<readonly [z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>, z.ZodBoolean, z.ZodString]>;
                objectEligibility: z.ZodObject<{
                    wornOrCarried: z.ZodString;
                    magicalStatus: z.ZodEnum<{
                        any: "any";
                        not_applicable: "not_applicable";
                        nonmagical: "nonmagical";
                    }>;
                    fixedToSurface: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        excluded: "excluded";
                    }>;
                    maxSize: z.ZodString;
                    maxWeightPounds: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                    maxWeightScaling: z.ZodString;
                }, z.core.$strip>;
                placementEligibility: z.ZodOptional<z.ZodObject<{
                    unoccupied: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    surface: z.ZodOptional<z.ZodEnum<{
                        ground: "ground";
                        not_applicable: "not_applicable";
                        liquid: "liquid";
                        any_solid: "any_solid";
                    }>>;
                    destination: z.ZodOptional<z.ZodString>;
                    notes: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                specialIdentity: z.ZodOptional<z.ZodObject<{
                    corpseOrRemains: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    reactionTriggeringCreature: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    summonedByCaster: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    notes: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                communicationPrerequisites: z.ZodObject<{
                    canHearCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    canUnderstandCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    canSeeCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                }, z.core.$strip>;
                abilityThreshold: z.ZodObject<{
                    ability: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        Strength: "Strength";
                        Dexterity: "Dexterity";
                        Constitution: "Constitution";
                        Intelligence: "Intelligence";
                        Wisdom: "Wisdom";
                        Charisma: "Charisma";
                    }>;
                    operator: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        greater_than: "greater_than";
                        greater_than_or_equal: "greater_than_or_equal";
                        less_than: "less_than";
                        less_than_or_equal: "less_than_or_equal";
                    }>;
                    value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                }, z.core.$strip>;
                selfRelation: z.ZodEnum<{
                    not_applicable: "not_applicable";
                    must_be_self: "must_be_self";
                    must_be_other: "must_be_other";
                    self_allowed: "self_allowed";
                }>;
                creatureTypes: z.ZodArray<z.ZodString>;
                excludeCreatureTypes: z.ZodArray<z.ZodString>;
                sizes: z.ZodArray<z.ZodString>;
                alignments: z.ZodArray<z.ZodString>;
                hasCondition: z.ZodArray<z.ZodString>;
                isNativeToPlane: z.ZodBoolean;
            }, z.core.$strip>>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>;
        damage: z.ZodOptional<z.ZodObject<{
            dice: z.ZodString;
            type: z.ZodString;
            mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                resistance: "resistance";
                immunity: "immunity";
                damage_reduction: "damage_reduction";
                damage_prevention: "damage_prevention";
            }>>>;
            disintegration: z.ZodOptional<z.ZodObject<{
                creatureAtZeroHp: z.ZodBoolean;
                includesNonmagicalWornAndCarried: z.ZodBoolean;
                revivalOnlyBy: z.ZodArray<z.ZodString>;
                automaticTargetTypes: z.ZodArray<z.ZodString>;
                maxAutomaticTargetSize: z.ZodString;
                hugeOrLargerPortionCubeFeet: z.ZodNumber;
                residueName: z.ZodString;
                residueDescription: z.ZodString;
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
            colorChoice: z.ZodOptional<z.ZodEnum<{
                fixed: "fixed";
                not_applicable: "not_applicable";
                caster_choice: "caster_choice";
            }>>;
            opaqueCoverBlocks: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>>;
            emitsHeat: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>>;
            ignitesObjects: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>>;
            consumesFuel: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>>;
            canBeCoveredOrHidden: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>>;
            canBeSmotheredOrQuenched: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>>;
        }, z.core.$strip>>;
        invisibilitySuppression: z.ZodOptional<z.ZodObject<{
            suppressesConditionBenefit: z.ZodUnion<readonly [z.ZodLiteral<"Invisible">, z.ZodString]>;
            scope: z.ZodOptional<z.ZodString>;
            duration: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        trigger: z.ZodObject<{
            type: z.ZodString;
            frequency: z.ZodOptional<z.ZodEnum<{
                every_time: "every_time";
                first_per_turn: "first_per_turn";
                once_per_creature: "once_per_creature";
                once: "once";
            }>>;
            consumption: z.ZodOptional<z.ZodEnum<{
                unlimited: "unlimited";
                first_hit: "first_hit";
                per_turn: "per_turn";
                per_instance_hit_or_miss: "per_instance_hit_or_miss";
            }>>;
            attackFilter: z.ZodOptional<z.ZodObject<{
                weaponType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    ranged: "ranged";
                    melee: "melee";
                    melee_weapon: "melee_weapon";
                    ranged_weapon: "ranged_weapon";
                    unarmed: "unarmed";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    spell: "spell";
                    unarmed: "unarmed";
                    weapon: "weapon";
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
            areaTiming: z.ZodOptional<z.ZodArray<z.ZodString>>;
            repeatAction: z.ZodOptional<z.ZodObject<{}, z.core.$loose>>;
            onlyIf: z.ZodOptional<z.ZodString>;
            oncePerTurn: z.ZodOptional<z.ZodBoolean>;
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
                negates: "negates";
                negates_effect: "negates_effect";
            }>>;
            targetFilter: z.ZodOptional<z.ZodObject<{
                willing: z.ZodUnion<readonly [z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>, z.ZodBoolean, z.ZodString]>;
                objectEligibility: z.ZodObject<{
                    wornOrCarried: z.ZodString;
                    magicalStatus: z.ZodEnum<{
                        any: "any";
                        not_applicable: "not_applicable";
                        nonmagical: "nonmagical";
                    }>;
                    fixedToSurface: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        excluded: "excluded";
                    }>;
                    maxSize: z.ZodString;
                    maxWeightPounds: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                    maxWeightScaling: z.ZodString;
                }, z.core.$strip>;
                placementEligibility: z.ZodOptional<z.ZodObject<{
                    unoccupied: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    surface: z.ZodOptional<z.ZodEnum<{
                        ground: "ground";
                        not_applicable: "not_applicable";
                        liquid: "liquid";
                        any_solid: "any_solid";
                    }>>;
                    destination: z.ZodOptional<z.ZodString>;
                    notes: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                specialIdentity: z.ZodOptional<z.ZodObject<{
                    corpseOrRemains: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    reactionTriggeringCreature: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    summonedByCaster: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    notes: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                communicationPrerequisites: z.ZodObject<{
                    canHearCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    canUnderstandCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    canSeeCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                }, z.core.$strip>;
                abilityThreshold: z.ZodObject<{
                    ability: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        Strength: "Strength";
                        Dexterity: "Dexterity";
                        Constitution: "Constitution";
                        Intelligence: "Intelligence";
                        Wisdom: "Wisdom";
                        Charisma: "Charisma";
                    }>;
                    operator: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        greater_than: "greater_than";
                        greater_than_or_equal: "greater_than_or_equal";
                        less_than: "less_than";
                        less_than_or_equal: "less_than_or_equal";
                    }>;
                    value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                }, z.core.$strip>;
                selfRelation: z.ZodEnum<{
                    not_applicable: "not_applicable";
                    must_be_self: "must_be_self";
                    must_be_other: "must_be_other";
                    self_allowed: "self_allowed";
                }>;
                creatureTypes: z.ZodArray<z.ZodString>;
                excludeCreatureTypes: z.ZodArray<z.ZodString>;
                sizes: z.ZodArray<z.ZodString>;
                alignments: z.ZodArray<z.ZodString>;
                hasCondition: z.ZodArray<z.ZodString>;
                isNativeToPlane: z.ZodBoolean;
            }, z.core.$strip>>;
            requiresStatus: z.ZodOptional<z.ZodArray<z.ZodString>>;
            saveModifiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodOptional<z.ZodString>;
                modifier: z.ZodOptional<z.ZodString>;
                value: z.ZodOptional<z.ZodNumber>;
                appliesTo: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
                    willing: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    objectEligibility: z.ZodObject<{
                        wornOrCarried: z.ZodString;
                        magicalStatus: z.ZodEnum<{
                            any: "any";
                            not_applicable: "not_applicable";
                            nonmagical: "nonmagical";
                        }>;
                        fixedToSurface: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            excluded: "excluded";
                        }>;
                        maxSize: z.ZodString;
                        maxWeightPounds: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                        maxWeightScaling: z.ZodString;
                    }, z.core.$strip>;
                    placementEligibility: z.ZodOptional<z.ZodObject<{
                        unoccupied: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        surface: z.ZodOptional<z.ZodEnum<{
                            ground: "ground";
                            not_applicable: "not_applicable";
                            liquid: "liquid";
                            any_solid: "any_solid";
                        }>>;
                        destination: z.ZodOptional<z.ZodString>;
                        notes: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    specialIdentity: z.ZodOptional<z.ZodObject<{
                        corpseOrRemains: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        reactionTriggeringCreature: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        summonedByCaster: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        notes: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    communicationPrerequisites: z.ZodObject<{
                        canHearCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                        canUnderstandCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                        canSeeCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                    }, z.core.$strip>;
                    abilityThreshold: z.ZodObject<{
                        ability: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            Strength: "Strength";
                            Dexterity: "Dexterity";
                            Constitution: "Constitution";
                            Intelligence: "Intelligence";
                            Wisdom: "Wisdom";
                            Charisma: "Charisma";
                        }>;
                        operator: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            greater_than: "greater_than";
                            greater_than_or_equal: "greater_than_or_equal";
                            less_than: "less_than";
                            less_than_or_equal: "less_than_or_equal";
                        }>;
                        value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                    }, z.core.$strip>;
                    selfRelation: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        must_be_self: "must_be_self";
                        must_be_other: "must_be_other";
                        self_allowed: "self_allowed";
                    }>;
                    creatureTypes: z.ZodArray<z.ZodString>;
                    excludeCreatureTypes: z.ZodArray<z.ZodString>;
                    sizes: z.ZodArray<z.ZodString>;
                    alignments: z.ZodArray<z.ZodString>;
                    hasCondition: z.ZodArray<z.ZodString>;
                    isNativeToPlane: z.ZodBoolean;
                }, z.core.$strip>, z.ZodString]>>;
                reason: z.ZodOptional<z.ZodString>;
                condition: z.ZodOptional<z.ZodString>;
                source: z.ZodOptional<z.ZodString>;
                options: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    label: z.ZodString;
                    modifier: z.ZodNumber;
                }, z.core.$loose>>>;
                advantageOnDamage: z.ZodOptional<z.ZodBoolean>;
                sizeAdvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                sizeDisadvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                ignoredCover: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    total: "total";
                    half: "half";
                    three_quarters: "three_quarters";
                }>>>;
            }, z.core.$loose>>>;
            saveOutcomeOverrides: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
                outcome: z.ZodString;
                condition: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{}, z.core.$loose>]>>>;
        }, z.core.$strip>;
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
        secondaryTargeting: z.ZodOptional<z.ZodObject<{
            trigger: z.ZodEnum<{
                primary_hit: "primary_hit";
                duplicate_damage_die: "duplicate_damage_die";
            }>;
            origin: z.ZodEnum<{
                primary_target: "primary_target";
                previous_target: "previous_target";
            }>;
            range: z.ZodNumber;
            rangeUnit: z.ZodEnum<{
                feet: "feet";
                miles: "miles";
                inches: "inches";
            }>;
            validTargets: z.ZodEnum<{
                creature: "creature";
                creature_or_object: "creature_or_object";
            }>;
            selection: z.ZodEnum<{
                caster_choice: "caster_choice";
            }>;
            mustBeDifferent: z.ZodBoolean;
            requiresLineOfSight: z.ZodBoolean;
            requiresAttackRoll: z.ZodBoolean;
            requiresDamageRoll: z.ZodBoolean;
            repeatRule: z.ZodOptional<z.ZodEnum<{
                none: "none";
                slot_level_max_leaps: "slot_level_max_leaps";
            }>>;
            maxLeaps: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"slot_level">]>>;
            uniquePerCasting: z.ZodOptional<z.ZodBoolean>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        soundEmission: z.ZodOptional<z.ZodObject<{
            audibleRadius: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            radiusUnit: z.ZodEnum<{
                not_applicable: "not_applicable";
                feet: "feet";
                miles: "miles";
            }>;
            source: z.ZodEnum<{
                target: "target";
                not_applicable: "not_applicable";
                caster: "caster";
                target_object: "target_object";
                origin_space: "origin_space";
                spell_area: "spell_area";
            }>;
            trigger: z.ZodEnum<{
                not_applicable: "not_applicable";
                on_cast: "on_cast";
                on_hit: "on_hit";
                after_teleport: "after_teleport";
                on_trigger: "on_trigger";
            }>;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        conditionalEndings: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
        }, z.core.$strip>>>;
        fallControl: z.ZodOptional<z.ZodObject<{
            descentRate: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            descentRateUnit: z.ZodEnum<{
                not_applicable: "not_applicable";
                feet_per_round: "feet_per_round";
            }>;
            fallDamageOnLanding: z.ZodEnum<{
                not_applicable: "not_applicable";
                prevented: "prevented";
                normal: "normal";
            }>;
            endingTrigger: z.ZodOptional<z.ZodEnum<{
                not_applicable: "not_applicable";
                target_lands: "target_lands";
            }>>;
            endingScope: z.ZodOptional<z.ZodEnum<{
                spell: "spell";
                effect: "effect";
                not_applicable: "not_applicable";
            }>>;
        }, z.core.$strip>>;
        conditionRemoval: z.ZodOptional<z.ZodArray<z.ZodString>>;
        barrierDamagePrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        spellEffectPrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        deathPrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        endCleanup: z.ZodOptional<z.ZodUnion<readonly [z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$loose>]>>, z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$loose>]>]>>;
        sustainRequirement: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        linkedDamage: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        resistanceSuppression: z.ZodOptional<z.ZodObject<{
            damageType: z.ZodArray<z.ZodString>;
            damageTypeSource: z.ZodEnum<{
                triggering_damage_type: "triggering_damage_type";
                listed: "listed";
                chosen_damage_type: "chosen_damage_type";
            }>;
        }, z.core.$strip>>;
        damageInteraction: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        recurringMechanics: z.ZodOptional<z.ZodUnion<readonly [z.ZodArray<z.ZodObject<{
            timing: z.ZodOptional<z.ZodString>;
            frequency: z.ZodOptional<z.ZodString>;
            saveType: z.ZodOptional<z.ZodString>;
            saveEffect: z.ZodOptional<z.ZodString>;
            damage: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                type: z.ZodString;
                mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    resistance: "resistance";
                    immunity: "immunity";
                    damage_reduction: "damage_reduction";
                    damage_prevention: "damage_prevention";
                }>>>;
            }, z.core.$strip>>;
            healing: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                isTemporaryHp: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            successOutcome: z.ZodOptional<z.ZodString>;
            failureOutcome: z.ZodOptional<z.ZodString>;
            restriction: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>>, z.ZodObject<{
            timing: z.ZodOptional<z.ZodString>;
            frequency: z.ZodOptional<z.ZodString>;
            saveType: z.ZodOptional<z.ZodString>;
            saveEffect: z.ZodOptional<z.ZodString>;
            damage: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                type: z.ZodString;
                mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    resistance: "resistance";
                    immunity: "immunity";
                    damage_reduction: "damage_reduction";
                    damage_prevention: "damage_prevention";
                }>>>;
            }, z.core.$strip>>;
            healing: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                isTemporaryHp: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            successOutcome: z.ZodOptional<z.ZodString>;
            failureOutcome: z.ZodOptional<z.ZodString>;
            restriction: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>]>>;
        sensoryManifestation: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        illusion: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        description: z.ZodString;
        type: z.ZodLiteral<"MOVEMENT">;
        movementType: z.ZodEnum<{
            push: "push";
            stop: "stop";
            pull: "pull";
            teleport: "teleport";
            speed_change: "speed_change";
        }>;
        distance: z.ZodOptional<z.ZodNumber>;
        speedChange: z.ZodOptional<z.ZodObject<{
            stat: z.ZodLiteral<"speed">;
            value: z.ZodNumber;
            unit: z.ZodLiteral<"feet">;
        }, z.core.$strip>>;
        duration: z.ZodObject<{
            type: z.ZodString;
            value: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        forcedMovement: z.ZodOptional<z.ZodObject<{
            usesReaction: z.ZodOptional<z.ZodBoolean>;
            direction: z.ZodOptional<z.ZodEnum<{
                caster_choice: "caster_choice";
                away_from_caster: "away_from_caster";
                toward_caster: "toward_caster";
                safest_route: "safest_route";
            }>>;
            maxDistance: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        trigger: z.ZodObject<{
            type: z.ZodString;
            frequency: z.ZodOptional<z.ZodEnum<{
                every_time: "every_time";
                first_per_turn: "first_per_turn";
                once_per_creature: "once_per_creature";
                once: "once";
            }>>;
            consumption: z.ZodOptional<z.ZodEnum<{
                unlimited: "unlimited";
                first_hit: "first_hit";
                per_turn: "per_turn";
                per_instance_hit_or_miss: "per_instance_hit_or_miss";
            }>>;
            attackFilter: z.ZodOptional<z.ZodObject<{
                weaponType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    ranged: "ranged";
                    melee: "melee";
                    melee_weapon: "melee_weapon";
                    ranged_weapon: "ranged_weapon";
                    unarmed: "unarmed";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    spell: "spell";
                    unarmed: "unarmed";
                    weapon: "weapon";
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
            areaTiming: z.ZodOptional<z.ZodArray<z.ZodString>>;
            repeatAction: z.ZodOptional<z.ZodObject<{}, z.core.$loose>>;
            onlyIf: z.ZodOptional<z.ZodString>;
            oncePerTurn: z.ZodOptional<z.ZodBoolean>;
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
                negates: "negates";
                negates_effect: "negates_effect";
            }>>;
            targetFilter: z.ZodOptional<z.ZodObject<{
                willing: z.ZodUnion<readonly [z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>, z.ZodBoolean, z.ZodString]>;
                objectEligibility: z.ZodObject<{
                    wornOrCarried: z.ZodString;
                    magicalStatus: z.ZodEnum<{
                        any: "any";
                        not_applicable: "not_applicable";
                        nonmagical: "nonmagical";
                    }>;
                    fixedToSurface: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        excluded: "excluded";
                    }>;
                    maxSize: z.ZodString;
                    maxWeightPounds: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                    maxWeightScaling: z.ZodString;
                }, z.core.$strip>;
                placementEligibility: z.ZodOptional<z.ZodObject<{
                    unoccupied: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    surface: z.ZodOptional<z.ZodEnum<{
                        ground: "ground";
                        not_applicable: "not_applicable";
                        liquid: "liquid";
                        any_solid: "any_solid";
                    }>>;
                    destination: z.ZodOptional<z.ZodString>;
                    notes: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                specialIdentity: z.ZodOptional<z.ZodObject<{
                    corpseOrRemains: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    reactionTriggeringCreature: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    summonedByCaster: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    notes: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                communicationPrerequisites: z.ZodObject<{
                    canHearCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    canUnderstandCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    canSeeCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                }, z.core.$strip>;
                abilityThreshold: z.ZodObject<{
                    ability: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        Strength: "Strength";
                        Dexterity: "Dexterity";
                        Constitution: "Constitution";
                        Intelligence: "Intelligence";
                        Wisdom: "Wisdom";
                        Charisma: "Charisma";
                    }>;
                    operator: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        greater_than: "greater_than";
                        greater_than_or_equal: "greater_than_or_equal";
                        less_than: "less_than";
                        less_than_or_equal: "less_than_or_equal";
                    }>;
                    value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                }, z.core.$strip>;
                selfRelation: z.ZodEnum<{
                    not_applicable: "not_applicable";
                    must_be_self: "must_be_self";
                    must_be_other: "must_be_other";
                    self_allowed: "self_allowed";
                }>;
                creatureTypes: z.ZodArray<z.ZodString>;
                excludeCreatureTypes: z.ZodArray<z.ZodString>;
                sizes: z.ZodArray<z.ZodString>;
                alignments: z.ZodArray<z.ZodString>;
                hasCondition: z.ZodArray<z.ZodString>;
                isNativeToPlane: z.ZodBoolean;
            }, z.core.$strip>>;
            requiresStatus: z.ZodOptional<z.ZodArray<z.ZodString>>;
            saveModifiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodOptional<z.ZodString>;
                modifier: z.ZodOptional<z.ZodString>;
                value: z.ZodOptional<z.ZodNumber>;
                appliesTo: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
                    willing: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    objectEligibility: z.ZodObject<{
                        wornOrCarried: z.ZodString;
                        magicalStatus: z.ZodEnum<{
                            any: "any";
                            not_applicable: "not_applicable";
                            nonmagical: "nonmagical";
                        }>;
                        fixedToSurface: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            excluded: "excluded";
                        }>;
                        maxSize: z.ZodString;
                        maxWeightPounds: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                        maxWeightScaling: z.ZodString;
                    }, z.core.$strip>;
                    placementEligibility: z.ZodOptional<z.ZodObject<{
                        unoccupied: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        surface: z.ZodOptional<z.ZodEnum<{
                            ground: "ground";
                            not_applicable: "not_applicable";
                            liquid: "liquid";
                            any_solid: "any_solid";
                        }>>;
                        destination: z.ZodOptional<z.ZodString>;
                        notes: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    specialIdentity: z.ZodOptional<z.ZodObject<{
                        corpseOrRemains: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        reactionTriggeringCreature: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        summonedByCaster: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        notes: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    communicationPrerequisites: z.ZodObject<{
                        canHearCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                        canUnderstandCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                        canSeeCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                    }, z.core.$strip>;
                    abilityThreshold: z.ZodObject<{
                        ability: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            Strength: "Strength";
                            Dexterity: "Dexterity";
                            Constitution: "Constitution";
                            Intelligence: "Intelligence";
                            Wisdom: "Wisdom";
                            Charisma: "Charisma";
                        }>;
                        operator: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            greater_than: "greater_than";
                            greater_than_or_equal: "greater_than_or_equal";
                            less_than: "less_than";
                            less_than_or_equal: "less_than_or_equal";
                        }>;
                        value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                    }, z.core.$strip>;
                    selfRelation: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        must_be_self: "must_be_self";
                        must_be_other: "must_be_other";
                        self_allowed: "self_allowed";
                    }>;
                    creatureTypes: z.ZodArray<z.ZodString>;
                    excludeCreatureTypes: z.ZodArray<z.ZodString>;
                    sizes: z.ZodArray<z.ZodString>;
                    alignments: z.ZodArray<z.ZodString>;
                    hasCondition: z.ZodArray<z.ZodString>;
                    isNativeToPlane: z.ZodBoolean;
                }, z.core.$strip>, z.ZodString]>>;
                reason: z.ZodOptional<z.ZodString>;
                condition: z.ZodOptional<z.ZodString>;
                source: z.ZodOptional<z.ZodString>;
                options: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    label: z.ZodString;
                    modifier: z.ZodNumber;
                }, z.core.$loose>>>;
                advantageOnDamage: z.ZodOptional<z.ZodBoolean>;
                sizeAdvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                sizeDisadvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                ignoredCover: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    total: "total";
                    half: "half";
                    three_quarters: "three_quarters";
                }>>>;
            }, z.core.$loose>>>;
            saveOutcomeOverrides: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
                outcome: z.ZodString;
                condition: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{}, z.core.$loose>]>>>;
        }, z.core.$strip>;
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
        secondaryTargeting: z.ZodOptional<z.ZodObject<{
            trigger: z.ZodEnum<{
                primary_hit: "primary_hit";
                duplicate_damage_die: "duplicate_damage_die";
            }>;
            origin: z.ZodEnum<{
                primary_target: "primary_target";
                previous_target: "previous_target";
            }>;
            range: z.ZodNumber;
            rangeUnit: z.ZodEnum<{
                feet: "feet";
                miles: "miles";
                inches: "inches";
            }>;
            validTargets: z.ZodEnum<{
                creature: "creature";
                creature_or_object: "creature_or_object";
            }>;
            selection: z.ZodEnum<{
                caster_choice: "caster_choice";
            }>;
            mustBeDifferent: z.ZodBoolean;
            requiresLineOfSight: z.ZodBoolean;
            requiresAttackRoll: z.ZodBoolean;
            requiresDamageRoll: z.ZodBoolean;
            repeatRule: z.ZodOptional<z.ZodEnum<{
                none: "none";
                slot_level_max_leaps: "slot_level_max_leaps";
            }>>;
            maxLeaps: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"slot_level">]>>;
            uniquePerCasting: z.ZodOptional<z.ZodBoolean>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        soundEmission: z.ZodOptional<z.ZodObject<{
            audibleRadius: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            radiusUnit: z.ZodEnum<{
                not_applicable: "not_applicable";
                feet: "feet";
                miles: "miles";
            }>;
            source: z.ZodEnum<{
                target: "target";
                not_applicable: "not_applicable";
                caster: "caster";
                target_object: "target_object";
                origin_space: "origin_space";
                spell_area: "spell_area";
            }>;
            trigger: z.ZodEnum<{
                not_applicable: "not_applicable";
                on_cast: "on_cast";
                on_hit: "on_hit";
                after_teleport: "after_teleport";
                on_trigger: "on_trigger";
            }>;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        conditionalEndings: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
        }, z.core.$strip>>>;
        fallControl: z.ZodOptional<z.ZodObject<{
            descentRate: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            descentRateUnit: z.ZodEnum<{
                not_applicable: "not_applicable";
                feet_per_round: "feet_per_round";
            }>;
            fallDamageOnLanding: z.ZodEnum<{
                not_applicable: "not_applicable";
                prevented: "prevented";
                normal: "normal";
            }>;
            endingTrigger: z.ZodOptional<z.ZodEnum<{
                not_applicable: "not_applicable";
                target_lands: "target_lands";
            }>>;
            endingScope: z.ZodOptional<z.ZodEnum<{
                spell: "spell";
                effect: "effect";
                not_applicable: "not_applicable";
            }>>;
        }, z.core.$strip>>;
        conditionRemoval: z.ZodOptional<z.ZodArray<z.ZodString>>;
        barrierDamagePrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        spellEffectPrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        deathPrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        endCleanup: z.ZodOptional<z.ZodUnion<readonly [z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$loose>]>>, z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$loose>]>]>>;
        sustainRequirement: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        linkedDamage: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        resistanceSuppression: z.ZodOptional<z.ZodObject<{
            damageType: z.ZodArray<z.ZodString>;
            damageTypeSource: z.ZodEnum<{
                triggering_damage_type: "triggering_damage_type";
                listed: "listed";
                chosen_damage_type: "chosen_damage_type";
            }>;
        }, z.core.$strip>>;
        damageInteraction: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        recurringMechanics: z.ZodOptional<z.ZodUnion<readonly [z.ZodArray<z.ZodObject<{
            timing: z.ZodOptional<z.ZodString>;
            frequency: z.ZodOptional<z.ZodString>;
            saveType: z.ZodOptional<z.ZodString>;
            saveEffect: z.ZodOptional<z.ZodString>;
            damage: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                type: z.ZodString;
                mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    resistance: "resistance";
                    immunity: "immunity";
                    damage_reduction: "damage_reduction";
                    damage_prevention: "damage_prevention";
                }>>>;
            }, z.core.$strip>>;
            healing: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                isTemporaryHp: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            successOutcome: z.ZodOptional<z.ZodString>;
            failureOutcome: z.ZodOptional<z.ZodString>;
            restriction: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>>, z.ZodObject<{
            timing: z.ZodOptional<z.ZodString>;
            frequency: z.ZodOptional<z.ZodString>;
            saveType: z.ZodOptional<z.ZodString>;
            saveEffect: z.ZodOptional<z.ZodString>;
            damage: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                type: z.ZodString;
                mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    resistance: "resistance";
                    immunity: "immunity";
                    damage_reduction: "damage_reduction";
                    damage_prevention: "damage_prevention";
                }>>>;
            }, z.core.$strip>>;
            healing: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                isTemporaryHp: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            successOutcome: z.ZodOptional<z.ZodString>;
            failureOutcome: z.ZodOptional<z.ZodString>;
            restriction: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>]>>;
        sensoryManifestation: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        illusion: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        description: z.ZodString;
        type: z.ZodLiteral<"SUMMONING">;
        summon: z.ZodObject<{
            entityType: z.ZodEnum<{
                object: "object";
                creature: "creature";
                servant: "servant";
                familiar: "familiar";
                construct: "construct";
                undead: "undead";
                mount: "mount";
            }>;
            persistent: z.ZodBoolean;
            dismissAction: z.ZodOptional<z.ZodEnum<{
                none: "none";
                action: "action";
                bonus_action: "bonus_action";
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
            lifecycle: z.ZodOptional<z.ZodObject<{
                hitPointMaximum: z.ZodOptional<z.ZodString>;
                repairOnly: z.ZodOptional<z.ZodString>;
                zeroHpEnding: z.ZodOptional<z.ZodString>;
                recastEnding: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            control: z.ZodOptional<z.ZodObject<{
                entityType: z.ZodOptional<z.ZodString>;
                source: z.ZodOptional<z.ZodString>;
                allegiance: z.ZodOptional<z.ZodString>;
                obedience: z.ZodOptional<z.ZodString>;
                initiative: z.ZodOptional<z.ZodString>;
                restrictions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                destruction: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            commandCost: z.ZodEnum<{
                none: "none";
                action: "action";
                bonus_action: "bonus_action";
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
                none: "none";
                action: "action";
                bonus_action: "bonus_action";
                free: "free";
            }>>;
            specialActions: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                description: z.ZodString;
                cost: z.ZodEnum<{
                    action: "action";
                    reaction: "reaction";
                    bonus_action: "bonus_action";
                    free: "free";
                }>;
                damage: z.ZodOptional<z.ZodObject<{
                    dice: z.ZodString;
                    type: z.ZodString;
                }, z.core.$strip>>;
            }, z.core.$strip>>>;
            actionPermissions: z.ZodOptional<z.ZodObject<{
                canAttack: z.ZodOptional<z.ZodBoolean>;
                canDeliverTouchSpells: z.ZodOptional<z.ZodBoolean>;
                touchDeliveryRangeFeet: z.ZodOptional<z.ZodNumber>;
                touchDeliveryCost: z.ZodOptional<z.ZodEnum<{
                    none: "none";
                    action: "action";
                    reaction: "reaction";
                    bonus_action: "bonus_action";
                    free: "free";
                }>>;
                independentInitiative: z.ZodOptional<z.ZodBoolean>;
                obeysCasterCommands: z.ZodOptional<z.ZodBoolean>;
                commandCost: z.ZodOptional<z.ZodEnum<{
                    none: "none";
                    action: "action";
                    reaction: "reaction";
                    bonus_action: "bonus_action";
                    free: "free";
                }>>;
                defaultUncommandedAction: z.ZodOptional<z.ZodString>;
                notes: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            formTraits: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                appliesToForms: z.ZodOptional<z.ZodArray<z.ZodString>>;
                opportunityAttackPolicy: z.ZodOptional<z.ZodEnum<{
                    normal: "normal";
                    does_not_provoke_when_flying_out_of_reach: "does_not_provoke_when_flying_out_of_reach";
                }>>;
                movementModeRequired: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    fly: "fly";
                    swim: "swim";
                    climb: "climb";
                    walk: "walk";
                }>>;
                notes: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        trigger: z.ZodObject<{
            type: z.ZodString;
            frequency: z.ZodOptional<z.ZodEnum<{
                every_time: "every_time";
                first_per_turn: "first_per_turn";
                once_per_creature: "once_per_creature";
                once: "once";
            }>>;
            consumption: z.ZodOptional<z.ZodEnum<{
                unlimited: "unlimited";
                first_hit: "first_hit";
                per_turn: "per_turn";
                per_instance_hit_or_miss: "per_instance_hit_or_miss";
            }>>;
            attackFilter: z.ZodOptional<z.ZodObject<{
                weaponType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    ranged: "ranged";
                    melee: "melee";
                    melee_weapon: "melee_weapon";
                    ranged_weapon: "ranged_weapon";
                    unarmed: "unarmed";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    spell: "spell";
                    unarmed: "unarmed";
                    weapon: "weapon";
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
            areaTiming: z.ZodOptional<z.ZodArray<z.ZodString>>;
            repeatAction: z.ZodOptional<z.ZodObject<{}, z.core.$loose>>;
            onlyIf: z.ZodOptional<z.ZodString>;
            oncePerTurn: z.ZodOptional<z.ZodBoolean>;
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
                negates: "negates";
                negates_effect: "negates_effect";
            }>>;
            targetFilter: z.ZodOptional<z.ZodObject<{
                willing: z.ZodUnion<readonly [z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>, z.ZodBoolean, z.ZodString]>;
                objectEligibility: z.ZodObject<{
                    wornOrCarried: z.ZodString;
                    magicalStatus: z.ZodEnum<{
                        any: "any";
                        not_applicable: "not_applicable";
                        nonmagical: "nonmagical";
                    }>;
                    fixedToSurface: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        excluded: "excluded";
                    }>;
                    maxSize: z.ZodString;
                    maxWeightPounds: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                    maxWeightScaling: z.ZodString;
                }, z.core.$strip>;
                placementEligibility: z.ZodOptional<z.ZodObject<{
                    unoccupied: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    surface: z.ZodOptional<z.ZodEnum<{
                        ground: "ground";
                        not_applicable: "not_applicable";
                        liquid: "liquid";
                        any_solid: "any_solid";
                    }>>;
                    destination: z.ZodOptional<z.ZodString>;
                    notes: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                specialIdentity: z.ZodOptional<z.ZodObject<{
                    corpseOrRemains: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    reactionTriggeringCreature: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    summonedByCaster: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    notes: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                communicationPrerequisites: z.ZodObject<{
                    canHearCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    canUnderstandCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    canSeeCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                }, z.core.$strip>;
                abilityThreshold: z.ZodObject<{
                    ability: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        Strength: "Strength";
                        Dexterity: "Dexterity";
                        Constitution: "Constitution";
                        Intelligence: "Intelligence";
                        Wisdom: "Wisdom";
                        Charisma: "Charisma";
                    }>;
                    operator: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        greater_than: "greater_than";
                        greater_than_or_equal: "greater_than_or_equal";
                        less_than: "less_than";
                        less_than_or_equal: "less_than_or_equal";
                    }>;
                    value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                }, z.core.$strip>;
                selfRelation: z.ZodEnum<{
                    not_applicable: "not_applicable";
                    must_be_self: "must_be_self";
                    must_be_other: "must_be_other";
                    self_allowed: "self_allowed";
                }>;
                creatureTypes: z.ZodArray<z.ZodString>;
                excludeCreatureTypes: z.ZodArray<z.ZodString>;
                sizes: z.ZodArray<z.ZodString>;
                alignments: z.ZodArray<z.ZodString>;
                hasCondition: z.ZodArray<z.ZodString>;
                isNativeToPlane: z.ZodBoolean;
            }, z.core.$strip>>;
            requiresStatus: z.ZodOptional<z.ZodArray<z.ZodString>>;
            saveModifiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodOptional<z.ZodString>;
                modifier: z.ZodOptional<z.ZodString>;
                value: z.ZodOptional<z.ZodNumber>;
                appliesTo: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
                    willing: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    objectEligibility: z.ZodObject<{
                        wornOrCarried: z.ZodString;
                        magicalStatus: z.ZodEnum<{
                            any: "any";
                            not_applicable: "not_applicable";
                            nonmagical: "nonmagical";
                        }>;
                        fixedToSurface: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            excluded: "excluded";
                        }>;
                        maxSize: z.ZodString;
                        maxWeightPounds: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                        maxWeightScaling: z.ZodString;
                    }, z.core.$strip>;
                    placementEligibility: z.ZodOptional<z.ZodObject<{
                        unoccupied: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        surface: z.ZodOptional<z.ZodEnum<{
                            ground: "ground";
                            not_applicable: "not_applicable";
                            liquid: "liquid";
                            any_solid: "any_solid";
                        }>>;
                        destination: z.ZodOptional<z.ZodString>;
                        notes: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    specialIdentity: z.ZodOptional<z.ZodObject<{
                        corpseOrRemains: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        reactionTriggeringCreature: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        summonedByCaster: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        notes: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    communicationPrerequisites: z.ZodObject<{
                        canHearCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                        canUnderstandCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                        canSeeCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                    }, z.core.$strip>;
                    abilityThreshold: z.ZodObject<{
                        ability: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            Strength: "Strength";
                            Dexterity: "Dexterity";
                            Constitution: "Constitution";
                            Intelligence: "Intelligence";
                            Wisdom: "Wisdom";
                            Charisma: "Charisma";
                        }>;
                        operator: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            greater_than: "greater_than";
                            greater_than_or_equal: "greater_than_or_equal";
                            less_than: "less_than";
                            less_than_or_equal: "less_than_or_equal";
                        }>;
                        value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                    }, z.core.$strip>;
                    selfRelation: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        must_be_self: "must_be_self";
                        must_be_other: "must_be_other";
                        self_allowed: "self_allowed";
                    }>;
                    creatureTypes: z.ZodArray<z.ZodString>;
                    excludeCreatureTypes: z.ZodArray<z.ZodString>;
                    sizes: z.ZodArray<z.ZodString>;
                    alignments: z.ZodArray<z.ZodString>;
                    hasCondition: z.ZodArray<z.ZodString>;
                    isNativeToPlane: z.ZodBoolean;
                }, z.core.$strip>, z.ZodString]>>;
                reason: z.ZodOptional<z.ZodString>;
                condition: z.ZodOptional<z.ZodString>;
                source: z.ZodOptional<z.ZodString>;
                options: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    label: z.ZodString;
                    modifier: z.ZodNumber;
                }, z.core.$loose>>>;
                advantageOnDamage: z.ZodOptional<z.ZodBoolean>;
                sizeAdvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                sizeDisadvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                ignoredCover: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    total: "total";
                    half: "half";
                    three_quarters: "three_quarters";
                }>>>;
            }, z.core.$loose>>>;
            saveOutcomeOverrides: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
                outcome: z.ZodString;
                condition: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{}, z.core.$loose>]>>>;
        }, z.core.$strip>;
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
        secondaryTargeting: z.ZodOptional<z.ZodObject<{
            trigger: z.ZodEnum<{
                primary_hit: "primary_hit";
                duplicate_damage_die: "duplicate_damage_die";
            }>;
            origin: z.ZodEnum<{
                primary_target: "primary_target";
                previous_target: "previous_target";
            }>;
            range: z.ZodNumber;
            rangeUnit: z.ZodEnum<{
                feet: "feet";
                miles: "miles";
                inches: "inches";
            }>;
            validTargets: z.ZodEnum<{
                creature: "creature";
                creature_or_object: "creature_or_object";
            }>;
            selection: z.ZodEnum<{
                caster_choice: "caster_choice";
            }>;
            mustBeDifferent: z.ZodBoolean;
            requiresLineOfSight: z.ZodBoolean;
            requiresAttackRoll: z.ZodBoolean;
            requiresDamageRoll: z.ZodBoolean;
            repeatRule: z.ZodOptional<z.ZodEnum<{
                none: "none";
                slot_level_max_leaps: "slot_level_max_leaps";
            }>>;
            maxLeaps: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"slot_level">]>>;
            uniquePerCasting: z.ZodOptional<z.ZodBoolean>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        soundEmission: z.ZodOptional<z.ZodObject<{
            audibleRadius: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            radiusUnit: z.ZodEnum<{
                not_applicable: "not_applicable";
                feet: "feet";
                miles: "miles";
            }>;
            source: z.ZodEnum<{
                target: "target";
                not_applicable: "not_applicable";
                caster: "caster";
                target_object: "target_object";
                origin_space: "origin_space";
                spell_area: "spell_area";
            }>;
            trigger: z.ZodEnum<{
                not_applicable: "not_applicable";
                on_cast: "on_cast";
                on_hit: "on_hit";
                after_teleport: "after_teleport";
                on_trigger: "on_trigger";
            }>;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        conditionalEndings: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
        }, z.core.$strip>>>;
        fallControl: z.ZodOptional<z.ZodObject<{
            descentRate: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            descentRateUnit: z.ZodEnum<{
                not_applicable: "not_applicable";
                feet_per_round: "feet_per_round";
            }>;
            fallDamageOnLanding: z.ZodEnum<{
                not_applicable: "not_applicable";
                prevented: "prevented";
                normal: "normal";
            }>;
            endingTrigger: z.ZodOptional<z.ZodEnum<{
                not_applicable: "not_applicable";
                target_lands: "target_lands";
            }>>;
            endingScope: z.ZodOptional<z.ZodEnum<{
                spell: "spell";
                effect: "effect";
                not_applicable: "not_applicable";
            }>>;
        }, z.core.$strip>>;
        conditionRemoval: z.ZodOptional<z.ZodArray<z.ZodString>>;
        barrierDamagePrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        spellEffectPrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        deathPrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        endCleanup: z.ZodOptional<z.ZodUnion<readonly [z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$loose>]>>, z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$loose>]>]>>;
        sustainRequirement: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        linkedDamage: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        resistanceSuppression: z.ZodOptional<z.ZodObject<{
            damageType: z.ZodArray<z.ZodString>;
            damageTypeSource: z.ZodEnum<{
                triggering_damage_type: "triggering_damage_type";
                listed: "listed";
                chosen_damage_type: "chosen_damage_type";
            }>;
        }, z.core.$strip>>;
        damageInteraction: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        recurringMechanics: z.ZodOptional<z.ZodUnion<readonly [z.ZodArray<z.ZodObject<{
            timing: z.ZodOptional<z.ZodString>;
            frequency: z.ZodOptional<z.ZodString>;
            saveType: z.ZodOptional<z.ZodString>;
            saveEffect: z.ZodOptional<z.ZodString>;
            damage: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                type: z.ZodString;
                mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    resistance: "resistance";
                    immunity: "immunity";
                    damage_reduction: "damage_reduction";
                    damage_prevention: "damage_prevention";
                }>>>;
            }, z.core.$strip>>;
            healing: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                isTemporaryHp: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            successOutcome: z.ZodOptional<z.ZodString>;
            failureOutcome: z.ZodOptional<z.ZodString>;
            restriction: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>>, z.ZodObject<{
            timing: z.ZodOptional<z.ZodString>;
            frequency: z.ZodOptional<z.ZodString>;
            saveType: z.ZodOptional<z.ZodString>;
            saveEffect: z.ZodOptional<z.ZodString>;
            damage: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                type: z.ZodString;
                mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    resistance: "resistance";
                    immunity: "immunity";
                    damage_reduction: "damage_reduction";
                    damage_prevention: "damage_prevention";
                }>>>;
            }, z.core.$strip>>;
            healing: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                isTemporaryHp: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            successOutcome: z.ZodOptional<z.ZodString>;
            failureOutcome: z.ZodOptional<z.ZodString>;
            restriction: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>]>>;
        sensoryManifestation: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        illusion: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        description: z.ZodString;
        type: z.ZodLiteral<"TERRAIN">;
        terrainType: z.ZodEnum<{
            wall: "wall";
            difficult: "difficult";
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
            type: z.ZodString;
            value: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        damage: z.ZodOptional<z.ZodObject<{
            dice: z.ZodString;
            type: z.ZodString;
            mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                resistance: "resistance";
                immunity: "immunity";
                damage_reduction: "damage_reduction";
                damage_prevention: "damage_prevention";
            }>>>;
            disintegration: z.ZodOptional<z.ZodObject<{
                creatureAtZeroHp: z.ZodBoolean;
                includesNonmagicalWornAndCarried: z.ZodBoolean;
                revivalOnlyBy: z.ZodArray<z.ZodString>;
                automaticTargetTypes: z.ZodArray<z.ZodString>;
                maxAutomaticTargetSize: z.ZodString;
                hugeOrLargerPortionCubeFeet: z.ZodNumber;
                residueName: z.ZodString;
                residueDescription: z.ZodString;
            }, z.core.$strip>>;
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
                normal: "normal";
                excavate: "excavate";
                cosmetic: "cosmetic";
                reshape: "reshape";
            }>;
            volume: z.ZodOptional<z.ZodObject<{
                shape: z.ZodEnum<{
                    Cube: "Cube";
                    Square: "Square";
                }>;
                size: z.ZodNumber;
                depth: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            materialOptions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            excludedMaterials: z.ZodOptional<z.ZodArray<z.ZodString>>;
            formOptions: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                wall: "wall";
                not_applicable: "not_applicable";
                pillar: "pillar";
                elevation: "elevation";
                trench: "trench";
            }>>>;
            maxChangeFeet: z.ZodOptional<z.ZodNumber>;
            completionTimeMinutes: z.ZodOptional<z.ZodNumber>;
            canChooseNewAreaAfterCompletion: z.ZodOptional<z.ZodBoolean>;
            slowTransformationPreventsTrappingOrInjury: z.ZodOptional<z.ZodBoolean>;
            rocksAndStructuresShift: z.ZodOptional<z.ZodBoolean>;
            unstableStructuresMayCollapse: z.ZodOptional<z.ZodBoolean>;
            carriesPlantsWithoutAffectingGrowth: z.ZodOptional<z.ZodBoolean>;
            duration: z.ZodOptional<z.ZodObject<{
                type: z.ZodString;
                value: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            depositDistance: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        trigger: z.ZodObject<{
            type: z.ZodString;
            frequency: z.ZodOptional<z.ZodEnum<{
                every_time: "every_time";
                first_per_turn: "first_per_turn";
                once_per_creature: "once_per_creature";
                once: "once";
            }>>;
            consumption: z.ZodOptional<z.ZodEnum<{
                unlimited: "unlimited";
                first_hit: "first_hit";
                per_turn: "per_turn";
                per_instance_hit_or_miss: "per_instance_hit_or_miss";
            }>>;
            attackFilter: z.ZodOptional<z.ZodObject<{
                weaponType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    ranged: "ranged";
                    melee: "melee";
                    melee_weapon: "melee_weapon";
                    ranged_weapon: "ranged_weapon";
                    unarmed: "unarmed";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    spell: "spell";
                    unarmed: "unarmed";
                    weapon: "weapon";
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
            areaTiming: z.ZodOptional<z.ZodArray<z.ZodString>>;
            repeatAction: z.ZodOptional<z.ZodObject<{}, z.core.$loose>>;
            onlyIf: z.ZodOptional<z.ZodString>;
            oncePerTurn: z.ZodOptional<z.ZodBoolean>;
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
                negates: "negates";
                negates_effect: "negates_effect";
            }>>;
            targetFilter: z.ZodOptional<z.ZodObject<{
                willing: z.ZodUnion<readonly [z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>, z.ZodBoolean, z.ZodString]>;
                objectEligibility: z.ZodObject<{
                    wornOrCarried: z.ZodString;
                    magicalStatus: z.ZodEnum<{
                        any: "any";
                        not_applicable: "not_applicable";
                        nonmagical: "nonmagical";
                    }>;
                    fixedToSurface: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        excluded: "excluded";
                    }>;
                    maxSize: z.ZodString;
                    maxWeightPounds: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                    maxWeightScaling: z.ZodString;
                }, z.core.$strip>;
                placementEligibility: z.ZodOptional<z.ZodObject<{
                    unoccupied: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    surface: z.ZodOptional<z.ZodEnum<{
                        ground: "ground";
                        not_applicable: "not_applicable";
                        liquid: "liquid";
                        any_solid: "any_solid";
                    }>>;
                    destination: z.ZodOptional<z.ZodString>;
                    notes: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                specialIdentity: z.ZodOptional<z.ZodObject<{
                    corpseOrRemains: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    reactionTriggeringCreature: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    summonedByCaster: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    notes: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                communicationPrerequisites: z.ZodObject<{
                    canHearCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    canUnderstandCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    canSeeCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                }, z.core.$strip>;
                abilityThreshold: z.ZodObject<{
                    ability: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        Strength: "Strength";
                        Dexterity: "Dexterity";
                        Constitution: "Constitution";
                        Intelligence: "Intelligence";
                        Wisdom: "Wisdom";
                        Charisma: "Charisma";
                    }>;
                    operator: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        greater_than: "greater_than";
                        greater_than_or_equal: "greater_than_or_equal";
                        less_than: "less_than";
                        less_than_or_equal: "less_than_or_equal";
                    }>;
                    value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                }, z.core.$strip>;
                selfRelation: z.ZodEnum<{
                    not_applicable: "not_applicable";
                    must_be_self: "must_be_self";
                    must_be_other: "must_be_other";
                    self_allowed: "self_allowed";
                }>;
                creatureTypes: z.ZodArray<z.ZodString>;
                excludeCreatureTypes: z.ZodArray<z.ZodString>;
                sizes: z.ZodArray<z.ZodString>;
                alignments: z.ZodArray<z.ZodString>;
                hasCondition: z.ZodArray<z.ZodString>;
                isNativeToPlane: z.ZodBoolean;
            }, z.core.$strip>>;
            requiresStatus: z.ZodOptional<z.ZodArray<z.ZodString>>;
            saveModifiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodOptional<z.ZodString>;
                modifier: z.ZodOptional<z.ZodString>;
                value: z.ZodOptional<z.ZodNumber>;
                appliesTo: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
                    willing: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    objectEligibility: z.ZodObject<{
                        wornOrCarried: z.ZodString;
                        magicalStatus: z.ZodEnum<{
                            any: "any";
                            not_applicable: "not_applicable";
                            nonmagical: "nonmagical";
                        }>;
                        fixedToSurface: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            excluded: "excluded";
                        }>;
                        maxSize: z.ZodString;
                        maxWeightPounds: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                        maxWeightScaling: z.ZodString;
                    }, z.core.$strip>;
                    placementEligibility: z.ZodOptional<z.ZodObject<{
                        unoccupied: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        surface: z.ZodOptional<z.ZodEnum<{
                            ground: "ground";
                            not_applicable: "not_applicable";
                            liquid: "liquid";
                            any_solid: "any_solid";
                        }>>;
                        destination: z.ZodOptional<z.ZodString>;
                        notes: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    specialIdentity: z.ZodOptional<z.ZodObject<{
                        corpseOrRemains: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        reactionTriggeringCreature: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        summonedByCaster: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        notes: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    communicationPrerequisites: z.ZodObject<{
                        canHearCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                        canUnderstandCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                        canSeeCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                    }, z.core.$strip>;
                    abilityThreshold: z.ZodObject<{
                        ability: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            Strength: "Strength";
                            Dexterity: "Dexterity";
                            Constitution: "Constitution";
                            Intelligence: "Intelligence";
                            Wisdom: "Wisdom";
                            Charisma: "Charisma";
                        }>;
                        operator: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            greater_than: "greater_than";
                            greater_than_or_equal: "greater_than_or_equal";
                            less_than: "less_than";
                            less_than_or_equal: "less_than_or_equal";
                        }>;
                        value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                    }, z.core.$strip>;
                    selfRelation: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        must_be_self: "must_be_self";
                        must_be_other: "must_be_other";
                        self_allowed: "self_allowed";
                    }>;
                    creatureTypes: z.ZodArray<z.ZodString>;
                    excludeCreatureTypes: z.ZodArray<z.ZodString>;
                    sizes: z.ZodArray<z.ZodString>;
                    alignments: z.ZodArray<z.ZodString>;
                    hasCondition: z.ZodArray<z.ZodString>;
                    isNativeToPlane: z.ZodBoolean;
                }, z.core.$strip>, z.ZodString]>>;
                reason: z.ZodOptional<z.ZodString>;
                condition: z.ZodOptional<z.ZodString>;
                source: z.ZodOptional<z.ZodString>;
                options: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    label: z.ZodString;
                    modifier: z.ZodNumber;
                }, z.core.$loose>>>;
                advantageOnDamage: z.ZodOptional<z.ZodBoolean>;
                sizeAdvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                sizeDisadvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                ignoredCover: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    total: "total";
                    half: "half";
                    three_quarters: "three_quarters";
                }>>>;
            }, z.core.$loose>>>;
            saveOutcomeOverrides: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
                outcome: z.ZodString;
                condition: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{}, z.core.$loose>]>>>;
        }, z.core.$strip>;
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
        secondaryTargeting: z.ZodOptional<z.ZodObject<{
            trigger: z.ZodEnum<{
                primary_hit: "primary_hit";
                duplicate_damage_die: "duplicate_damage_die";
            }>;
            origin: z.ZodEnum<{
                primary_target: "primary_target";
                previous_target: "previous_target";
            }>;
            range: z.ZodNumber;
            rangeUnit: z.ZodEnum<{
                feet: "feet";
                miles: "miles";
                inches: "inches";
            }>;
            validTargets: z.ZodEnum<{
                creature: "creature";
                creature_or_object: "creature_or_object";
            }>;
            selection: z.ZodEnum<{
                caster_choice: "caster_choice";
            }>;
            mustBeDifferent: z.ZodBoolean;
            requiresLineOfSight: z.ZodBoolean;
            requiresAttackRoll: z.ZodBoolean;
            requiresDamageRoll: z.ZodBoolean;
            repeatRule: z.ZodOptional<z.ZodEnum<{
                none: "none";
                slot_level_max_leaps: "slot_level_max_leaps";
            }>>;
            maxLeaps: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"slot_level">]>>;
            uniquePerCasting: z.ZodOptional<z.ZodBoolean>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        soundEmission: z.ZodOptional<z.ZodObject<{
            audibleRadius: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            radiusUnit: z.ZodEnum<{
                not_applicable: "not_applicable";
                feet: "feet";
                miles: "miles";
            }>;
            source: z.ZodEnum<{
                target: "target";
                not_applicable: "not_applicable";
                caster: "caster";
                target_object: "target_object";
                origin_space: "origin_space";
                spell_area: "spell_area";
            }>;
            trigger: z.ZodEnum<{
                not_applicable: "not_applicable";
                on_cast: "on_cast";
                on_hit: "on_hit";
                after_teleport: "after_teleport";
                on_trigger: "on_trigger";
            }>;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        conditionalEndings: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
        }, z.core.$strip>>>;
        fallControl: z.ZodOptional<z.ZodObject<{
            descentRate: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            descentRateUnit: z.ZodEnum<{
                not_applicable: "not_applicable";
                feet_per_round: "feet_per_round";
            }>;
            fallDamageOnLanding: z.ZodEnum<{
                not_applicable: "not_applicable";
                prevented: "prevented";
                normal: "normal";
            }>;
            endingTrigger: z.ZodOptional<z.ZodEnum<{
                not_applicable: "not_applicable";
                target_lands: "target_lands";
            }>>;
            endingScope: z.ZodOptional<z.ZodEnum<{
                spell: "spell";
                effect: "effect";
                not_applicable: "not_applicable";
            }>>;
        }, z.core.$strip>>;
        conditionRemoval: z.ZodOptional<z.ZodArray<z.ZodString>>;
        barrierDamagePrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        spellEffectPrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        deathPrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        endCleanup: z.ZodOptional<z.ZodUnion<readonly [z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$loose>]>>, z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$loose>]>]>>;
        sustainRequirement: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        linkedDamage: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        resistanceSuppression: z.ZodOptional<z.ZodObject<{
            damageType: z.ZodArray<z.ZodString>;
            damageTypeSource: z.ZodEnum<{
                triggering_damage_type: "triggering_damage_type";
                listed: "listed";
                chosen_damage_type: "chosen_damage_type";
            }>;
        }, z.core.$strip>>;
        damageInteraction: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        recurringMechanics: z.ZodOptional<z.ZodUnion<readonly [z.ZodArray<z.ZodObject<{
            timing: z.ZodOptional<z.ZodString>;
            frequency: z.ZodOptional<z.ZodString>;
            saveType: z.ZodOptional<z.ZodString>;
            saveEffect: z.ZodOptional<z.ZodString>;
            damage: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                type: z.ZodString;
                mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    resistance: "resistance";
                    immunity: "immunity";
                    damage_reduction: "damage_reduction";
                    damage_prevention: "damage_prevention";
                }>>>;
            }, z.core.$strip>>;
            healing: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                isTemporaryHp: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            successOutcome: z.ZodOptional<z.ZodString>;
            failureOutcome: z.ZodOptional<z.ZodString>;
            restriction: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>>, z.ZodObject<{
            timing: z.ZodOptional<z.ZodString>;
            frequency: z.ZodOptional<z.ZodString>;
            saveType: z.ZodOptional<z.ZodString>;
            saveEffect: z.ZodOptional<z.ZodString>;
            damage: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                type: z.ZodString;
                mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    resistance: "resistance";
                    immunity: "immunity";
                    damage_reduction: "damage_reduction";
                    damage_prevention: "damage_prevention";
                }>>>;
            }, z.core.$strip>>;
            healing: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                isTemporaryHp: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            successOutcome: z.ZodOptional<z.ZodString>;
            failureOutcome: z.ZodOptional<z.ZodString>;
            restriction: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>]>>;
        sensoryManifestation: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        illusion: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        type: z.ZodLiteral<"UTILITY">;
        utilityType: z.ZodString;
        description: z.ZodString;
        attackAugments: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
        }, z.core.$loose>>>;
        abilityCheckModifier: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
            appliesTo: z.ZodString;
            bonusDice: z.ZodOptional<z.ZodString>;
            flatModifier: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
            skillSelection: z.ZodString;
            skillChooser: z.ZodOptional<z.ZodString>;
            skillPool: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
            frequency: z.ZodString;
            durationScope: z.ZodString;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>, z.ZodObject<{}, z.core.$loose>]>>;
        controlledEntity: z.ZodOptional<z.ZodObject<{
            entityType: z.ZodOptional<z.ZodString>;
            count: z.ZodOptional<z.ZodNumber>;
            appearsAt: z.ZodOptional<z.ZodString>;
            durationScope: z.ZodOptional<z.ZodString>;
            controlActionType: z.ZodOptional<z.ZodString>;
            initialUseOnCast: z.ZodOptional<z.ZodBoolean>;
            laterControlTiming: z.ZodOptional<z.ZodString>;
            movementDistance: z.ZodOptional<z.ZodNumber>;
            movementUnit: z.ZodOptional<z.ZodString>;
            maxDistanceFromCaster: z.ZodOptional<z.ZodNumber>;
            canAttack: z.ZodOptional<z.ZodBoolean>;
            canActivateMagicItems: z.ZodOptional<z.ZodBoolean>;
            carryCapacityPounds: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
            allowedInteractions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            endingTriggers: z.ZodOptional<z.ZodArray<z.ZodString>>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>>;
        animatedObjectState: z.ZodOptional<z.ZodObject<{
            creatureType: z.ZodOptional<z.ZodString>;
            size: z.ZodOptional<z.ZodString>;
            sourceObject: z.ZodOptional<z.ZodString>;
            damageImmunities: z.ZodOptional<z.ZodArray<z.ZodString>>;
            conditionImmunities: z.ZodOptional<z.ZodArray<z.ZodString>>;
            description: z.ZodOptional<z.ZodString>;
            armorClass: z.ZodOptional<z.ZodNumber>;
            hitPointsBySize: z.ZodOptional<z.ZodObject<{}, z.core.$loose>>;
            lifecycle: z.ZodOptional<z.ZodObject<{}, z.core.$loose>>;
            communication: z.ZodOptional<z.ZodObject<{}, z.core.$loose>>;
            control: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{}, z.core.$loose>]>>;
        }, z.core.$loose>>;
        summonControl: z.ZodOptional<z.ZodObject<{
            entityType: z.ZodOptional<z.ZodString>;
            mode: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>>;
        createdObjects: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
            kind: z.ZodOptional<z.ZodString>;
            objectType: z.ZodString;
            name: z.ZodString;
            count: z.ZodNumber;
            countScaling: z.ZodOptional<z.ZodObject<{
                type: z.ZodLiteral<"slot_level">;
                bonusPerLevel: z.ZodNumber;
            }, z.core.$strip>>;
            countUnit: z.ZodString;
            appearsIn: z.ZodString;
            shapeOptions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            materialOptions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            nonlivingObjectOnly: z.ZodOptional<z.ZodBoolean>;
            requiresSeenFormAndMaterial: z.ZodOptional<z.ZodBoolean>;
            materialSource: z.ZodOptional<z.ZodString>;
            maxCreatedObjectCubeFeet: z.ZodOptional<z.ZodNumber>;
            maxCreatedObjectCubeScaling: z.ZodOptional<z.ZodObject<{
                type: z.ZodLiteral<"slot_level">;
                bonusPerLevel: z.ZodNumber;
            }, z.core.$strip>>;
            durationByMaterial: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            mixedMaterialsUseShortestDuration: z.ZodOptional<z.ZodBoolean>;
            cannotServeAsMaterialComponent: z.ZodOptional<z.ZodBoolean>;
            requiresVisibleRawMaterials: z.ZodOptional<z.ZodBoolean>;
            consumesSourceMaterials: z.ZodOptional<z.ZodBoolean>;
            outputSameMaterialAsSource: z.ZodOptional<z.ZodBoolean>;
            maxFabricatedObjectCubeFeet: z.ZodOptional<z.ZodNumber>;
            maxConnectedFiveFootCubes: z.ZodOptional<z.ZodNumber>;
            maxMineralObjectCubeFeet: z.ZodOptional<z.ZodNumber>;
            qualityLimitedByMaterials: z.ZodOptional<z.ZodBoolean>;
            cannotCreateCreatures: z.ZodOptional<z.ZodBoolean>;
            cannotCreateMagicItems: z.ZodOptional<z.ZodBoolean>;
            skilledGoodsRequireToolProficiency: z.ZodOptional<z.ZodBoolean>;
            maxStoneDimensionFeet: z.ZodOptional<z.ZodNumber>;
            maxHinges: z.ZodOptional<z.ZodNumber>;
            canIncludeLatch: z.ZodOptional<z.ZodBoolean>;
            canCreateFineMechanicalDetail: z.ZodOptional<z.ZodBoolean>;
            levels: z.ZodOptional<z.ZodNumber>;
            levelScaling: z.ZodOptional<z.ZodObject<{
                type: z.ZodLiteral<"slot_level">;
                bonusPerLevel: z.ZodNumber;
            }, z.core.$strip>>;
            levelHeightFeet: z.ZodOptional<z.ZodNumber>;
            areaPerLevelSquareFeet: z.ZodOptional<z.ZodNumber>;
            accessBetweenLevels: z.ZodOptional<z.ZodBoolean>;
            secureOpenings: z.ZodOptional<z.ZodBoolean>;
            furnished: z.ZodOptional<z.ZodBoolean>;
            weatherProtected: z.ZodOptional<z.ZodBoolean>;
            dedicationSource: z.ZodOptional<z.ZodString>;
            appearanceChosenByCaster: z.ZodOptional<z.ZodBoolean>;
            interiorFeatures: z.ZodOptional<z.ZodArray<z.ZodString>>;
            doorCount: z.ZodOptional<z.ZodNumber>;
            doorControlledByCasterAndDesignates: z.ZodOptional<z.ZodBoolean>;
            windowsCasterChoice: z.ZodOptional<z.ZodBoolean>;
            illuminationOptions: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                not_applicable: "not_applicable";
                bright: "bright";
                dim: "dim";
                unlit: "unlit";
            }>>>;
            ambientScent: z.ZodOptional<z.ZodString>;
            ambientTemperature: z.ZodOptional<z.ZodEnum<{
                not_applicable: "not_applicable";
                normal: "normal";
                mild: "mild";
            }>>;
            portalWidthFeet: z.ZodOptional<z.ZodNumber>;
            portalHeightFeet: z.ZodOptional<z.ZodNumber>;
            extradimensionalSpace: z.ZodOptional<z.ZodBoolean>;
            capacityCreatures: z.ZodOptional<z.ZodNumber>;
            capacityCreatureMaxSize: z.ZodOptional<z.ZodString>;
            blocksCrossBoundaryEffects: z.ZodOptional<z.ZodBoolean>;
            occupantsCanSeeOut: z.ZodOptional<z.ZodBoolean>;
            contentsDropOutOnEnd: z.ZodOptional<z.ZodBoolean>;
            safelyEjectsContentsOnEnd: z.ZodOptional<z.ZodBoolean>;
            preservesStructuralStability: z.ZodOptional<z.ZodBoolean>;
            requiresAnchoring: z.ZodOptional<z.ZodBoolean>;
            anchoringOptions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            collapsesIfUnsupported: z.ZodOptional<z.ZodBoolean>;
            collapseTiming: z.ZodOptional<z.ZodString>;
            obscuresArea: z.ZodOptional<z.ZodEnum<{
                not_applicable: "not_applicable";
                lightly: "lightly";
                heavily: "heavily";
            }>>;
            providesCover: z.ZodOptional<z.ZodEnum<{
                total: "total";
                not_applicable: "not_applicable";
                half: "half";
                three_quarters: "three_quarters";
            }>>;
            spaceIsDifficultTerrain: z.ZodOptional<z.ZodBoolean>;
            rangedWeaponAttacksThroughHaveDisadvantage: z.ZodOptional<z.ZodBoolean>;
            reducesPassingDamageType: z.ZodOptional<z.ZodString>;
            passingDamageMultiplier: z.ZodOptional<z.ZodNumber>;
            canFreezeFromDamageType: z.ZodOptional<z.ZodString>;
            frozenSectionSizeFeet: z.ZodOptional<z.ZodNumber>;
            frozenSectionArmorClass: z.ZodOptional<z.ZodNumber>;
            frozenSectionHitPoints: z.ZodOptional<z.ZodNumber>;
            destroyedFrozenSectionsDoNotRefill: z.ZodOptional<z.ZodBoolean>;
            wallLengthFeet: z.ZodOptional<z.ZodNumber>;
            wallHeightFeet: z.ZodOptional<z.ZodNumber>;
            wallThickness: z.ZodOptional<z.ZodNumber>;
            wallThicknessUnit: z.ZodOptional<z.ZodEnum<{
                not_applicable: "not_applicable";
                feet: "feet";
                inches: "inches";
            }>>;
            panelCount: z.ZodOptional<z.ZodNumber>;
            panelWidthFeet: z.ZodOptional<z.ZodNumber>;
            panelHeightFeet: z.ZodOptional<z.ZodNumber>;
            panelContiguityRequired: z.ZodOptional<z.ZodBoolean>;
            orientationOptions: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                horizontal: "horizontal";
                not_applicable: "not_applicable";
                caster_choice: "caster_choice";
                vertical: "vertical";
                diagonal: "diagonal";
                angled: "angled";
            }>>>;
            freeFloating: z.ZodOptional<z.ZodBoolean>;
            blocksPhysicalPassage: z.ZodOptional<z.ZodBoolean>;
            blocksLineOfSight: z.ZodOptional<z.ZodBoolean>;
            blocksEtherealTravel: z.ZodOptional<z.ZodBoolean>;
            blocksSpellEffects: z.ZodOptional<z.ZodBoolean>;
            blocksEnergyEffects: z.ZodOptional<z.ZodBoolean>;
            breathableInside: z.ZodOptional<z.ZodBoolean>;
            immuneToDamage: z.ZodOptional<z.ZodBoolean>;
            objectArmorClass: z.ZodOptional<z.ZodNumber>;
            hitPointsPerInchThickness: z.ZodOptional<z.ZodNumber>;
            sectionHitPoints: z.ZodOptional<z.ZodNumber>;
            damageImmunities: z.ZodOptional<z.ZodArray<z.ZodString>>;
            damageVulnerabilities: z.ZodOptional<z.ZodArray<z.ZodString>>;
            immuneToDispelMagic: z.ZodOptional<z.ZodBoolean>;
            immuneToAntimagicField: z.ZodOptional<z.ZodBoolean>;
            blocksDivinationSensorsInside: z.ZodOptional<z.ZodBoolean>;
            blocksDivinationTargetingInside: z.ZodOptional<z.ZodBoolean>;
            opposedCreatureTypeOptions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            opposedCreatureEntrySaveType: z.ZodOptional<z.ZodEnum<{
                Strength: "Strength";
                Dexterity: "Dexterity";
                Constitution: "Constitution";
                Intelligence: "Intelligence";
                Wisdom: "Wisdom";
                Charisma: "Charisma";
            }>>;
            opposedCreatureEntryBlockedDurationHours: z.ZodOptional<z.ZodNumber>;
            opposedCreaturePenaltyDice: z.ZodOptional<z.ZodString>;
            healingBonusAbilityModifier: z.ZodOptional<z.ZodEnum<{
                not_applicable: "not_applicable";
                Wisdom: "Wisdom";
                spellcasting_ability: "spellcasting_ability";
            }>>;
            healingBonusMinimum: z.ZodOptional<z.ZodNumber>;
            healingBonusTrigger: z.ZodOptional<z.ZodString>;
            permanenceRequiresDailyCasts: z.ZodOptional<z.ZodNumber>;
            permanenceSameLocationRequired: z.ZodOptional<z.ZodBoolean>;
            createdEntityKind: z.ZodOptional<z.ZodEnum<{
                other: "other";
                clone_body: "clone_body";
                inert_duplicate: "inert_duplicate";
                suspended_body: "suspended_body";
                astral_form: "astral_form";
            }>>;
            growthDurationDays: z.ZodOptional<z.ZodNumber>;
            maturesInVessel: z.ZodOptional<z.ZodBoolean>;
            vesselRequired: z.ZodOptional<z.ZodBoolean>;
            vesselMinimumValueGp: z.ZodOptional<z.ZodNumber>;
            vesselMustRemainUndisturbed: z.ZodOptional<z.ZodBoolean>;
            inertUntilTrigger: z.ZodOptional<z.ZodBoolean>;
            activationTrigger: z.ZodOptional<z.ZodString>;
            soulMustBeFreeAndWilling: z.ZodOptional<z.ZodBoolean>;
            soulTransferConsumesOriginalRevival: z.ZodOptional<z.ZodBoolean>;
            duplicateRetainsPersonalityMemoriesAbilities: z.ZodOptional<z.ZodBoolean>;
            duplicateHasOriginalEquipment: z.ZodOptional<z.ZodBoolean>;
            casterChoosesFinalAge: z.ZodOptional<z.ZodBoolean>;
            enduresIndefinitelyAfterMature: z.ZodOptional<z.ZodBoolean>;
            needsFoodOrAir: z.ZodOptional<z.ZodBoolean>;
            agesWhileSuspended: z.ZodOptional<z.ZodBoolean>;
            linkedToCounterpartForm: z.ZodOptional<z.ZodBoolean>;
            silverCordLink: z.ZodOptional<z.ZodBoolean>;
            silverCordVisibleDistanceFeet: z.ZodOptional<z.ZodNumber>;
            silverCordCutEffect: z.ZodOptional<z.ZodString>;
            damageSharedWithCounterpart: z.ZodOptional<z.ZodBoolean>;
            effectsSharedWithCounterpart: z.ZodOptional<z.ZodBoolean>;
            planarExitTransfersBodyAndPossessions: z.ZodOptional<z.ZodBoolean>;
            endsWhenBodyOrFormDropsToZeroHp: z.ZodOptional<z.ZodBoolean>;
            returnsToBodyOnEndIfAlive: z.ZodOptional<z.ZodBoolean>;
            permanentAfterFullDuration: z.ZodOptional<z.ZodBoolean>;
            nonDispellableWhenPermanent: z.ZodOptional<z.ZodBoolean>;
            destroyedBySpells: z.ZodOptional<z.ZodArray<z.ZodString>>;
            pushesCreaturesToChosenSide: z.ZodOptional<z.ZodBoolean>;
            enclosureEscapeSaveType: z.ZodOptional<z.ZodEnum<{
                Strength: "Strength";
                Dexterity: "Dexterity";
                Constitution: "Constitution";
                Intelligence: "Intelligence";
                Wisdom: "Wisdom";
                Charisma: "Charisma";
            }>>;
            enclosureEscapeUsesReaction: z.ZodOptional<z.ZodBoolean>;
            enclosureEscapeMoveDistance: z.ZodOptional<z.ZodEnum<{
                speed: "speed";
                not_applicable: "not_applicable";
            }>>;
            leavesHazardOnSectionDestroyed: z.ZodOptional<z.ZodBoolean>;
            lingeringHazardName: z.ZodOptional<z.ZodString>;
            lingeringHazardDamage: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                type: z.ZodString;
                mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    resistance: "resistance";
                    immunity: "immunity";
                    damage_reduction: "damage_reduction";
                    damage_prevention: "damage_prevention";
                }>>>;
                disintegration: z.ZodOptional<z.ZodObject<{
                    creatureAtZeroHp: z.ZodBoolean;
                    includesNonmagicalWornAndCarried: z.ZodBoolean;
                    revivalOnlyBy: z.ZodArray<z.ZodString>;
                    automaticTargetTypes: z.ZodArray<z.ZodString>;
                    maxAutomaticTargetSize: z.ZodString;
                    hugeOrLargerPortionCubeFeet: z.ZodNumber;
                    residueName: z.ZodString;
                    residueDescription: z.ZodString;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            lingeringHazardSaveType: z.ZodOptional<z.ZodEnum<{
                Strength: "Strength";
                Dexterity: "Dexterity";
                Constitution: "Constitution";
                Intelligence: "Intelligence";
                Wisdom: "Wisdom";
                Charisma: "Charisma";
            }>>;
            lingeringHazardSaveEffect: z.ZodOptional<z.ZodEnum<{
                none: "none";
                half: "half";
                negates_condition: "negates_condition";
                negates: "negates";
            }>>;
            lingeringHazardFrequency: z.ZodOptional<z.ZodEnum<{
                every_time: "every_time";
                first_per_turn: "first_per_turn";
                once_per_creature: "once_per_creature";
            }>>;
            diameterFeet: z.ZodOptional<z.ZodNumber>;
            objectLengthFeet: z.ZodOptional<z.ZodNumber>;
            moveDistanceFeet: z.ZodOptional<z.ZodNumber>;
            attackReachFeet: z.ZodOptional<z.ZodNumber>;
            attacksPerActivation: z.ZodOptional<z.ZodNumber>;
            criticalHitThreshold: z.ZodOptional<z.ZodNumber>;
            passesHarmlesslyThroughBarriers: z.ZodOptional<z.ZodBoolean>;
            canTargetLooseObjects: z.ZodOptional<z.ZodBoolean>;
            canTargetStructures: z.ZodOptional<z.ZodBoolean>;
            prisonModeOptions: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                not_applicable: "not_applicable";
                burial: "burial";
                chaining: "chaining";
                hedged_prison: "hedged_prison";
                minimus_containment: "minimus_containment";
                slumber: "slumber";
            }>>>;
            demiplaneFormOptions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            blocksTeleportation: z.ZodOptional<z.ZodBoolean>;
            blocksPlanarTravel: z.ZodOptional<z.ZodBoolean>;
            lightPassesThroughOnly: z.ZodOptional<z.ZodBoolean>;
            containedCreatureSizeInches: z.ZodOptional<z.ZodNumber>;
            observableEndingTriggerRequired: z.ZodOptional<z.ZodBoolean>;
            endingTriggerExpectedWithinYears: z.ZodOptional<z.ZodNumber>;
            dispelMagicMinimumSlotLevel: z.ZodOptional<z.ZodNumber>;
            dispelMagicTargetOptions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            failsIfPlacedInOccupiedSpace: z.ZodOptional<z.ZodBoolean>;
            safePassageAllowedFor: z.ZodOptional<z.ZodArray<z.ZodString>>;
            proximityTriggerRadiusFeet: z.ZodOptional<z.ZodNumber>;
            layerCount: z.ZodOptional<z.ZodNumber>;
            layerOrder: z.ZodOptional<z.ZodArray<z.ZodString>>;
            layersDestroyedInOrder: z.ZodOptional<z.ZodBoolean>;
            destroyedLayersRemainGone: z.ZodOptional<z.ZodBoolean>;
            dispelMagicAffectsOnlyLayer: z.ZodOptional<z.ZodString>;
            requiresLayerEffectTable: z.ZodOptional<z.ZodBoolean>;
            movableByOccupants: z.ZodOptional<z.ZodBoolean>;
            movableByExternalCreatures: z.ZodOptional<z.ZodBoolean>;
            occupantRollSpeedMultiplier: z.ZodOptional<z.ZodNumber>;
            hoverMaxHeightFeet: z.ZodOptional<z.ZodNumber>;
            safelyDescendsOverDrops: z.ZodOptional<z.ZodBoolean>;
            barrierHeightFeet: z.ZodOptional<z.ZodNumber>;
            pitJumpWidthFeet: z.ZodOptional<z.ZodNumber>;
            hazardRadiusFeet: z.ZodOptional<z.ZodNumber>;
            hazardSide: z.ZodOptional<z.ZodEnum<{
                not_applicable: "not_applicable";
                caster_choice: "caster_choice";
                inside: "inside";
                outside: "outside";
                all_sides: "all_sides";
            }>>;
            hazardTriggers: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                first_per_turn: "first_per_turn";
                enter: "enter";
                end_turn_inside: "end_turn_inside";
                end_turn_within_radius: "end_turn_within_radius";
            }>>>;
            affectedVolumeShape: z.ZodOptional<z.ZodString>;
            affectedVolumeSizeFeet: z.ZodOptional<z.ZodNumber>;
            maxManipulationDistanceFeet: z.ZodOptional<z.ZodNumber>;
            manipulationOptions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            waterLevelChangeFeet: z.ZodOptional<z.ZodNumber>;
            vehicleCapsizeChancePercent: z.ZodOptional<z.ZodNumber>;
            maxAffectedVehicleSize: z.ZodOptional<z.ZodString>;
            repeatsOnCasterTurn: z.ZodOptional<z.ZodBoolean>;
            pullDistanceFeet: z.ZodOptional<z.ZodNumber>;
            escapeCheck: z.ZodOptional<z.ZodString>;
            canAnimateSimpleShapes: z.ZodOptional<z.ZodBoolean>;
            canChangeColorOrOpacity: z.ZodOptional<z.ZodBoolean>;
            canFreeze: z.ZodOptional<z.ZodBoolean>;
            freezeRequiresNoCreatures: z.ZodOptional<z.ZodBoolean>;
            waveLengthFeet: z.ZodOptional<z.ZodNumber>;
            waveWidthFeet: z.ZodOptional<z.ZodNumber>;
            waveHeightFeet: z.ZodOptional<z.ZodNumber>;
            extinguishesUnprotectedFlamesRadiusFeet: z.ZodOptional<z.ZodNumber>;
            vanishesAfterEffect: z.ZodOptional<z.ZodBoolean>;
            capacityMediumOrSmallerCreatures: z.ZodOptional<z.ZodNumber>;
            capacityLargeCreatures: z.ZodOptional<z.ZodNumber>;
            occupantsMoveWithObject: z.ZodOptional<z.ZodBoolean>;
            overflowEjectionRule: z.ZodOptional<z.ZodEnum<{
                not_applicable: "not_applicable";
                random_existing_occupant: "random_existing_occupant";
                newest_creature: "newest_creature";
            }>>;
            successfulSaveEjectsCreature: z.ZodOptional<z.ZodBoolean>;
            ejectionDistanceFeet: z.ZodOptional<z.ZodNumber>;
            occupantsProneOnEnd: z.ZodOptional<z.ZodBoolean>;
            trapsCreaturesOnSurface: z.ZodOptional<z.ZodBoolean>;
            trappedCondition: z.ZodOptional<z.ZodString>;
            ignitesTouchedObjects: z.ZodOptional<z.ZodBoolean>;
            depthFeet: z.ZodOptional<z.ZodNumber>;
            flammable: z.ZodOptional<z.ZodBoolean>;
            burnUnitSizeFeet: z.ZodOptional<z.ZodNumber>;
            burnDurationRounds: z.ZodOptional<z.ZodNumber>;
            burnDamage: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                type: z.ZodString;
                mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    resistance: "resistance";
                    immunity: "immunity";
                    damage_reduction: "damage_reduction";
                    damage_prevention: "damage_prevention";
                }>>>;
            }, z.core.$strip>>;
            orbitsCaster: z.ZodOptional<z.ZodBoolean>;
            expendable: z.ZodOptional<z.ZodBoolean>;
            maxExpendedPerAction: z.ZodOptional<z.ZodNumber>;
            consumeAction: z.ZodOptional<z.ZodEnum<{
                action: "action";
                reaction: "reaction";
                not_applicable: "not_applicable";
                bonus_action: "bonus_action";
                free: "free";
            }>>;
            healingPerItem: z.ZodOptional<z.ZodNumber>;
            nourishmentDaysPerItem: z.ZodOptional<z.ZodNumber>;
            harvestYieldMultiplier: z.ZodOptional<z.ZodNumber>;
            harvestYieldRadiusFeet: z.ZodOptional<z.ZodNumber>;
            harvestYieldDurationDays: z.ZodOptional<z.ZodNumber>;
            harvestYieldAppliesTo: z.ZodOptional<z.ZodEnum<{
                not_applicable: "not_applicable";
                plants: "plants";
                food_plants: "food_plants";
            }>>;
            harvestBenefitLimit: z.ZodOptional<z.ZodString>;
            inventoryItemId: z.ZodOptional<z.ZodString>;
            inventoryQuantity: z.ZodOptional<z.ZodNumber>;
            inventoryQuantityScaling: z.ZodOptional<z.ZodObject<{
                type: z.ZodLiteral<"slot_level">;
                bonusPerLevel: z.ZodNumber;
            }, z.core.$strip>>;
            perishable: z.ZodOptional<z.ZodBoolean>;
            expiresWithSpell: z.ZodOptional<z.ZodBoolean>;
            shelfLife: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodString;
        }, z.core.$loose>]>>>;
        objectAccessChange: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
            eligibleObjectTypes: z.ZodArray<z.ZodString>;
            mundaneStateChanges: z.ZodArray<z.ZodEnum<{
                unlock: "unlock";
                unstick: "unstick";
                unbar: "unbar";
            }>>;
            maxLocksAffected: z.ZodNumber;
            suppressesMagicalClosure: z.ZodOptional<z.ZodString>;
            suppressionDuration: z.ZodOptional<z.ZodObject<{
                type: z.ZodString;
                value: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            targetOperableDuringSuppression: z.ZodOptional<z.ZodBoolean>;
            soundEmission: z.ZodOptional<z.ZodObject<{
                audibleRadius: z.ZodNumber;
                radiusUnit: z.ZodEnum<{
                    feet: "feet";
                    miles: "miles";
                }>;
                source: z.ZodEnum<{
                    point: "point";
                    caster: "caster";
                    target_object: "target_object";
                }>;
                trigger: z.ZodEnum<{
                    on_cast: "on_cast";
                    on_change: "on_change";
                }>;
                description: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            targetObjects: z.ZodArray<z.ZodString>;
            newState: z.ZodString;
        }, z.core.$loose>]>>;
        controlOptions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodOptional<z.ZodString>;
            effect: z.ZodOptional<z.ZodString>;
            mode: z.ZodOptional<z.ZodString>;
            label: z.ZodOptional<z.ZodString>;
            details: z.ZodOptional<z.ZodString>;
            summary: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>>>;
        taunt: z.ZodOptional<z.ZodObject<{
            disadvantageAgainstOthers: z.ZodOptional<z.ZodBoolean>;
            leashRangeFeet: z.ZodOptional<z.ZodNumber>;
            breakEvents: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                caster_attacks_other: "caster_attacks_other";
                caster_casts_spell_on_other_enemy: "caster_casts_spell_on_other_enemy";
                caster_ally_damages_target: "caster_ally_damages_target";
                caster_ends_turn_outside_leash: "caster_ends_turn_outside_leash";
            }>>>;
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
                type: z.ZodString;
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
            colorChoice: z.ZodOptional<z.ZodEnum<{
                fixed: "fixed";
                not_applicable: "not_applicable";
                caster_choice: "caster_choice";
            }>>;
            opaqueCoverBlocks: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>>;
            emitsHeat: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>>;
            ignitesObjects: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>>;
            consumesFuel: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>>;
            canBeCoveredOrHidden: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>>;
            canBeSmotheredOrQuenched: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>>;
        }, z.core.$strip>>;
        invisibilitySuppression: z.ZodOptional<z.ZodObject<{
            suppressesConditionBenefit: z.ZodUnion<readonly [z.ZodLiteral<"Invisible">, z.ZodString]>;
            scope: z.ZodOptional<z.ZodString>;
            duration: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        trigger: z.ZodObject<{
            type: z.ZodString;
            frequency: z.ZodOptional<z.ZodEnum<{
                every_time: "every_time";
                first_per_turn: "first_per_turn";
                once_per_creature: "once_per_creature";
                once: "once";
            }>>;
            consumption: z.ZodOptional<z.ZodEnum<{
                unlimited: "unlimited";
                first_hit: "first_hit";
                per_turn: "per_turn";
                per_instance_hit_or_miss: "per_instance_hit_or_miss";
            }>>;
            attackFilter: z.ZodOptional<z.ZodObject<{
                weaponType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    ranged: "ranged";
                    melee: "melee";
                    melee_weapon: "melee_weapon";
                    ranged_weapon: "ranged_weapon";
                    unarmed: "unarmed";
                }>>;
                attackType: z.ZodOptional<z.ZodEnum<{
                    any: "any";
                    spell: "spell";
                    unarmed: "unarmed";
                    weapon: "weapon";
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
            areaTiming: z.ZodOptional<z.ZodArray<z.ZodString>>;
            repeatAction: z.ZodOptional<z.ZodObject<{}, z.core.$loose>>;
            onlyIf: z.ZodOptional<z.ZodString>;
            oncePerTurn: z.ZodOptional<z.ZodBoolean>;
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
                negates: "negates";
                negates_effect: "negates_effect";
            }>>;
            targetFilter: z.ZodOptional<z.ZodObject<{
                willing: z.ZodUnion<readonly [z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>, z.ZodBoolean, z.ZodString]>;
                objectEligibility: z.ZodObject<{
                    wornOrCarried: z.ZodString;
                    magicalStatus: z.ZodEnum<{
                        any: "any";
                        not_applicable: "not_applicable";
                        nonmagical: "nonmagical";
                    }>;
                    fixedToSurface: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        excluded: "excluded";
                    }>;
                    maxSize: z.ZodString;
                    maxWeightPounds: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                    maxWeightScaling: z.ZodString;
                }, z.core.$strip>;
                placementEligibility: z.ZodOptional<z.ZodObject<{
                    unoccupied: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    surface: z.ZodOptional<z.ZodEnum<{
                        ground: "ground";
                        not_applicable: "not_applicable";
                        liquid: "liquid";
                        any_solid: "any_solid";
                    }>>;
                    destination: z.ZodOptional<z.ZodString>;
                    notes: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                specialIdentity: z.ZodOptional<z.ZodObject<{
                    corpseOrRemains: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    reactionTriggeringCreature: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    summonedByCaster: z.ZodOptional<z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>>;
                    notes: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                communicationPrerequisites: z.ZodObject<{
                    canHearCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    canUnderstandCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    canSeeCaster: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                }, z.core.$strip>;
                abilityThreshold: z.ZodObject<{
                    ability: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        Strength: "Strength";
                        Dexterity: "Dexterity";
                        Constitution: "Constitution";
                        Intelligence: "Intelligence";
                        Wisdom: "Wisdom";
                        Charisma: "Charisma";
                    }>;
                    operator: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        greater_than: "greater_than";
                        greater_than_or_equal: "greater_than_or_equal";
                        less_than: "less_than";
                        less_than_or_equal: "less_than_or_equal";
                    }>;
                    value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                }, z.core.$strip>;
                selfRelation: z.ZodEnum<{
                    not_applicable: "not_applicable";
                    must_be_self: "must_be_self";
                    must_be_other: "must_be_other";
                    self_allowed: "self_allowed";
                }>;
                creatureTypes: z.ZodArray<z.ZodString>;
                excludeCreatureTypes: z.ZodArray<z.ZodString>;
                sizes: z.ZodArray<z.ZodString>;
                alignments: z.ZodArray<z.ZodString>;
                hasCondition: z.ZodArray<z.ZodString>;
                isNativeToPlane: z.ZodBoolean;
            }, z.core.$strip>>;
            requiresStatus: z.ZodOptional<z.ZodArray<z.ZodString>>;
            saveModifiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodOptional<z.ZodString>;
                modifier: z.ZodOptional<z.ZodString>;
                value: z.ZodOptional<z.ZodNumber>;
                appliesTo: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
                    willing: z.ZodUnion<readonly [z.ZodEnum<{
                        required: "required";
                        not_applicable: "not_applicable";
                    }>, z.ZodBoolean, z.ZodString]>;
                    objectEligibility: z.ZodObject<{
                        wornOrCarried: z.ZodString;
                        magicalStatus: z.ZodEnum<{
                            any: "any";
                            not_applicable: "not_applicable";
                            nonmagical: "nonmagical";
                        }>;
                        fixedToSurface: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            excluded: "excluded";
                        }>;
                        maxSize: z.ZodString;
                        maxWeightPounds: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                        maxWeightScaling: z.ZodString;
                    }, z.core.$strip>;
                    placementEligibility: z.ZodOptional<z.ZodObject<{
                        unoccupied: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        surface: z.ZodOptional<z.ZodEnum<{
                            ground: "ground";
                            not_applicable: "not_applicable";
                            liquid: "liquid";
                            any_solid: "any_solid";
                        }>>;
                        destination: z.ZodOptional<z.ZodString>;
                        notes: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    specialIdentity: z.ZodOptional<z.ZodObject<{
                        corpseOrRemains: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        reactionTriggeringCreature: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        summonedByCaster: z.ZodOptional<z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>>;
                        notes: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                    communicationPrerequisites: z.ZodObject<{
                        canHearCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                        canUnderstandCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                        canSeeCaster: z.ZodUnion<readonly [z.ZodEnum<{
                            required: "required";
                            not_applicable: "not_applicable";
                        }>, z.ZodBoolean, z.ZodString]>;
                    }, z.core.$strip>;
                    abilityThreshold: z.ZodObject<{
                        ability: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            Strength: "Strength";
                            Dexterity: "Dexterity";
                            Constitution: "Constitution";
                            Intelligence: "Intelligence";
                            Wisdom: "Wisdom";
                            Charisma: "Charisma";
                        }>;
                        operator: z.ZodEnum<{
                            not_applicable: "not_applicable";
                            greater_than: "greater_than";
                            greater_than_or_equal: "greater_than_or_equal";
                            less_than: "less_than";
                            less_than_or_equal: "less_than_or_equal";
                        }>;
                        value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                    }, z.core.$strip>;
                    selfRelation: z.ZodEnum<{
                        not_applicable: "not_applicable";
                        must_be_self: "must_be_self";
                        must_be_other: "must_be_other";
                        self_allowed: "self_allowed";
                    }>;
                    creatureTypes: z.ZodArray<z.ZodString>;
                    excludeCreatureTypes: z.ZodArray<z.ZodString>;
                    sizes: z.ZodArray<z.ZodString>;
                    alignments: z.ZodArray<z.ZodString>;
                    hasCondition: z.ZodArray<z.ZodString>;
                    isNativeToPlane: z.ZodBoolean;
                }, z.core.$strip>, z.ZodString]>>;
                reason: z.ZodOptional<z.ZodString>;
                condition: z.ZodOptional<z.ZodString>;
                source: z.ZodOptional<z.ZodString>;
                options: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    label: z.ZodString;
                    modifier: z.ZodNumber;
                }, z.core.$loose>>>;
                advantageOnDamage: z.ZodOptional<z.ZodBoolean>;
                sizeAdvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                sizeDisadvantage: z.ZodOptional<z.ZodArray<z.ZodString>>;
                ignoredCover: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    total: "total";
                    half: "half";
                    three_quarters: "three_quarters";
                }>>>;
            }, z.core.$loose>>>;
            saveOutcomeOverrides: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
                outcome: z.ZodString;
                condition: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{}, z.core.$loose>]>>>;
        }, z.core.$strip>;
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
        secondaryTargeting: z.ZodOptional<z.ZodObject<{
            trigger: z.ZodEnum<{
                primary_hit: "primary_hit";
                duplicate_damage_die: "duplicate_damage_die";
            }>;
            origin: z.ZodEnum<{
                primary_target: "primary_target";
                previous_target: "previous_target";
            }>;
            range: z.ZodNumber;
            rangeUnit: z.ZodEnum<{
                feet: "feet";
                miles: "miles";
                inches: "inches";
            }>;
            validTargets: z.ZodEnum<{
                creature: "creature";
                creature_or_object: "creature_or_object";
            }>;
            selection: z.ZodEnum<{
                caster_choice: "caster_choice";
            }>;
            mustBeDifferent: z.ZodBoolean;
            requiresLineOfSight: z.ZodBoolean;
            requiresAttackRoll: z.ZodBoolean;
            requiresDamageRoll: z.ZodBoolean;
            repeatRule: z.ZodOptional<z.ZodEnum<{
                none: "none";
                slot_level_max_leaps: "slot_level_max_leaps";
            }>>;
            maxLeaps: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"slot_level">]>>;
            uniquePerCasting: z.ZodOptional<z.ZodBoolean>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        soundEmission: z.ZodOptional<z.ZodObject<{
            audibleRadius: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            radiusUnit: z.ZodEnum<{
                not_applicable: "not_applicable";
                feet: "feet";
                miles: "miles";
            }>;
            source: z.ZodEnum<{
                target: "target";
                not_applicable: "not_applicable";
                caster: "caster";
                target_object: "target_object";
                origin_space: "origin_space";
                spell_area: "spell_area";
            }>;
            trigger: z.ZodEnum<{
                not_applicable: "not_applicable";
                on_cast: "on_cast";
                on_hit: "on_hit";
                after_teleport: "after_teleport";
                on_trigger: "on_trigger";
            }>;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        conditionalEndings: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
        }, z.core.$strip>>>;
        fallControl: z.ZodOptional<z.ZodObject<{
            descentRate: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            descentRateUnit: z.ZodEnum<{
                not_applicable: "not_applicable";
                feet_per_round: "feet_per_round";
            }>;
            fallDamageOnLanding: z.ZodEnum<{
                not_applicable: "not_applicable";
                prevented: "prevented";
                normal: "normal";
            }>;
            endingTrigger: z.ZodOptional<z.ZodEnum<{
                not_applicable: "not_applicable";
                target_lands: "target_lands";
            }>>;
            endingScope: z.ZodOptional<z.ZodEnum<{
                spell: "spell";
                effect: "effect";
                not_applicable: "not_applicable";
            }>>;
        }, z.core.$strip>>;
        conditionRemoval: z.ZodOptional<z.ZodArray<z.ZodString>>;
        barrierDamagePrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        spellEffectPrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        deathPrevention: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        endCleanup: z.ZodOptional<z.ZodUnion<readonly [z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$loose>]>>, z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$loose>]>]>>;
        sustainRequirement: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        linkedDamage: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        resistanceSuppression: z.ZodOptional<z.ZodObject<{
            damageType: z.ZodArray<z.ZodString>;
            damageTypeSource: z.ZodEnum<{
                triggering_damage_type: "triggering_damage_type";
                listed: "listed";
                chosen_damage_type: "chosen_damage_type";
            }>;
        }, z.core.$strip>>;
        damageInteraction: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        recurringMechanics: z.ZodOptional<z.ZodUnion<readonly [z.ZodArray<z.ZodObject<{
            timing: z.ZodOptional<z.ZodString>;
            frequency: z.ZodOptional<z.ZodString>;
            saveType: z.ZodOptional<z.ZodString>;
            saveEffect: z.ZodOptional<z.ZodString>;
            damage: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                type: z.ZodString;
                mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    resistance: "resistance";
                    immunity: "immunity";
                    damage_reduction: "damage_reduction";
                    damage_prevention: "damage_prevention";
                }>>>;
            }, z.core.$strip>>;
            healing: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                isTemporaryHp: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            successOutcome: z.ZodOptional<z.ZodString>;
            failureOutcome: z.ZodOptional<z.ZodString>;
            restriction: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>>, z.ZodObject<{
            timing: z.ZodOptional<z.ZodString>;
            frequency: z.ZodOptional<z.ZodString>;
            saveType: z.ZodOptional<z.ZodString>;
            saveEffect: z.ZodOptional<z.ZodString>;
            damage: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                type: z.ZodString;
                mitigationBypass: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    resistance: "resistance";
                    immunity: "immunity";
                    damage_reduction: "damage_reduction";
                    damage_prevention: "damage_prevention";
                }>>>;
            }, z.core.$strip>>;
            healing: z.ZodOptional<z.ZodObject<{
                dice: z.ZodString;
                isTemporaryHp: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            successOutcome: z.ZodOptional<z.ZodString>;
            failureOutcome: z.ZodOptional<z.ZodString>;
            restriction: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>]>>;
        sensoryManifestation: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        illusion: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        description: z.ZodString;
        type: z.ZodLiteral<"DEFENSIVE">;
        defenseType: z.ZodEnum<{
            resistance: "resistance";
            immunity: "immunity";
            damage_reduction: "damage_reduction";
            ac_bonus: "ac_bonus";
            set_base_ac: "set_base_ac";
            ac_minimum: "ac_minimum";
            temporary_hp: "temporary_hp";
            advantage_on_saves: "advantage_on_saves";
            disadvantage_on_attacks: "disadvantage_on_attacks";
        }>;
        value: z.ZodOptional<z.ZodNumber>;
        baseACFormula: z.ZodOptional<z.ZodString>;
        acMinimum: z.ZodOptional<z.ZodNumber>;
        damageType: z.ZodOptional<z.ZodArray<z.ZodString>>;
        damageTypeSource: z.ZodOptional<z.ZodEnum<{
            triggering_damage_type: "triggering_damage_type";
            listed: "listed";
            chosen_damage_type: "chosen_damage_type";
        }>>;
        excludedDamageType: z.ZodOptional<z.ZodArray<z.ZodString>>;
        damageReduction: z.ZodOptional<z.ZodObject<{
            dice: z.ZodString;
            flat: z.ZodOptional<z.ZodNumber>;
            appliesTo: z.ZodEnum<{
                damage_taken: "damage_taken";
            }>;
            frequency: z.ZodOptional<z.ZodEnum<{
                every_time: "every_time";
                once_per_turn: "once_per_turn";
            }>>;
        }, z.core.$strip>>;
        preventionImmunity: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            hit_point_maximum_reduction: "hit_point_maximum_reduction";
        }>>>;
        conditionImmunity: z.ZodOptional<z.ZodArray<z.ZodString>>;
        conditionSuppression: z.ZodOptional<z.ZodArray<z.ZodString>>;
        savingThrow: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodEnum<{
            Strength: "Strength";
            Dexterity: "Dexterity";
            Constitution: "Constitution";
            Intelligence: "Intelligence";
            Wisdom: "Wisdom";
            Charisma: "Charisma";
        }>, z.ZodString, z.ZodObject<{}, z.core.$loose>]>>>;
        duration: z.ZodObject<{
            type: z.ZodString;
            value: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        attackerFilter: z.ZodOptional<z.ZodObject<{
            willing: z.ZodUnion<readonly [z.ZodEnum<{
                required: "required";
                not_applicable: "not_applicable";
            }>, z.ZodBoolean, z.ZodString]>;
            objectEligibility: z.ZodObject<{
                wornOrCarried: z.ZodString;
                magicalStatus: z.ZodEnum<{
                    any: "any";
                    not_applicable: "not_applicable";
                    nonmagical: "nonmagical";
                }>;
                fixedToSurface: z.ZodEnum<{
                    not_applicable: "not_applicable";
                    excluded: "excluded";
                }>;
                maxSize: z.ZodString;
                maxWeightPounds: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
                maxWeightScaling: z.ZodString;
            }, z.core.$strip>;
            placementEligibility: z.ZodOptional<z.ZodObject<{
                unoccupied: z.ZodOptional<z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>>;
                surface: z.ZodOptional<z.ZodEnum<{
                    ground: "ground";
                    not_applicable: "not_applicable";
                    liquid: "liquid";
                    any_solid: "any_solid";
                }>>;
                destination: z.ZodOptional<z.ZodString>;
                notes: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            specialIdentity: z.ZodOptional<z.ZodObject<{
                corpseOrRemains: z.ZodOptional<z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>>;
                reactionTriggeringCreature: z.ZodOptional<z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>>;
                summonedByCaster: z.ZodOptional<z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>>;
                notes: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            communicationPrerequisites: z.ZodObject<{
                canHearCaster: z.ZodUnion<readonly [z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>, z.ZodBoolean, z.ZodString]>;
                canUnderstandCaster: z.ZodUnion<readonly [z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>, z.ZodBoolean, z.ZodString]>;
                canSeeCaster: z.ZodUnion<readonly [z.ZodEnum<{
                    required: "required";
                    not_applicable: "not_applicable";
                }>, z.ZodBoolean, z.ZodString]>;
            }, z.core.$strip>;
            abilityThreshold: z.ZodObject<{
                ability: z.ZodEnum<{
                    not_applicable: "not_applicable";
                    Strength: "Strength";
                    Dexterity: "Dexterity";
                    Constitution: "Constitution";
                    Intelligence: "Intelligence";
                    Wisdom: "Wisdom";
                    Charisma: "Charisma";
                }>;
                operator: z.ZodEnum<{
                    not_applicable: "not_applicable";
                    greater_than: "greater_than";
                    greater_than_or_equal: "greater_than_or_equal";
                    less_than: "less_than";
                    less_than_or_equal: "less_than_or_equal";
                }>;
                value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            }, z.core.$strip>;
            selfRelation: z.ZodEnum<{
                not_applicable: "not_applicable";
                must_be_self: "must_be_self";
                must_be_other: "must_be_other";
                self_allowed: "self_allowed";
            }>;
            creatureTypes: z.ZodArray<z.ZodString>;
            excludeCreatureTypes: z.ZodArray<z.ZodString>;
            sizes: z.ZodArray<z.ZodString>;
            alignments: z.ZodArray<z.ZodString>;
            hasCondition: z.ZodArray<z.ZodString>;
            isNativeToPlane: z.ZodBoolean;
        }, z.core.$strip>>;
        defenseSourceFilter: z.ZodOptional<z.ZodObject<{
            sourceCategories: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                spell: "spell";
                effect: "effect";
                environment: "environment";
                attack: "attack";
            }>>>;
            attackMagicalStatus: z.ZodOptional<z.ZodEnum<{
                any: "any";
                not_applicable: "not_applicable";
                nonmagical: "nonmagical";
                magical: "magical";
            }>>;
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
    higherLevelScaling: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"character_level_tiers">;
        tiers: z.ZodRecord<z.ZodString, z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"slot_level_bonus">;
        baseSpellLevel: z.ZodNumber;
        bonusPerLevel: z.ZodString;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"slot_level_table">;
        baseSpellLevel: z.ZodNumber;
        entries: z.ZodRecord<z.ZodString, z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"target_count_bonus">;
        baseSpellLevel: z.ZodNumber;
        additionalTargetsPerLevel: z.ZodNumber;
        targetLabel: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"area_size_bonus">;
        baseSpellLevel: z.ZodNumber;
        increasePerLevel: z.ZodNumber;
        unit: z.ZodLiteral<"feet">;
        dimension: z.ZodEnum<{
            radius: "radius";
            diameter: "diameter";
            cube_size: "cube_size";
            line_length: "line_length";
            wall_length: "wall_length";
            wall_height: "wall_height";
        }>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"multiple">;
        rules: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
            type: z.ZodLiteral<"character_level_tiers">;
            tiers: z.ZodRecord<z.ZodString, z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"slot_level_bonus">;
            baseSpellLevel: z.ZodNumber;
            bonusPerLevel: z.ZodString;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"slot_level_table">;
            baseSpellLevel: z.ZodNumber;
            entries: z.ZodRecord<z.ZodString, z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"target_count_bonus">;
            baseSpellLevel: z.ZodNumber;
            additionalTargetsPerLevel: z.ZodNumber;
            targetLabel: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"area_size_bonus">;
            baseSpellLevel: z.ZodNumber;
            increasePerLevel: z.ZodNumber;
            unit: z.ZodLiteral<"feet">;
            dimension: z.ZodEnum<{
                radius: "radius";
                diameter: "diameter";
                cube_size: "cube_size";
                line_length: "line_length";
                wall_length: "wall_length";
                wall_height: "wall_height";
            }>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>], "type">>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"special_text_only">;
        referenceText: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>], "type">>;
    durationProgression: z.ZodOptional<z.ZodArray<z.ZodObject<{
        trigger: z.ZodEnum<{
            not_applicable: "not_applicable";
            repeated_casts: "repeated_casts";
            recast_while_active: "recast_while_active";
            full_duration_concentration: "full_duration_concentration";
        }>;
        requiredCasts: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
        cadence: z.ZodEnum<{
            not_applicable: "not_applicable";
            daily: "daily";
        }>;
        sameTargetRequired: z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>;
        sameLocationRequired: z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>;
        sameConfigurationRequired: z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>;
        requiresFullConcentration: z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>;
        extension: z.ZodOptional<z.ZodObject<{
            value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
            unit: z.ZodEnum<{
                not_applicable: "not_applicable";
                hour: "hour";
                day: "day";
            }>;
        }, z.core.$strip>>;
        outcomeDuration: z.ZodEnum<{
            not_applicable: "not_applicable";
            until_dispelled: "until_dispelled";
            permanent: "permanent";
            extend_current_duration: "extend_current_duration";
            non_dispellable_permanent: "non_dispellable_permanent";
        }>;
        dispellable: z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    tags: z.ZodArray<z.ZodString>;
    classes: z.ZodArray<z.ZodEnum<{
        [x: string]: string;
    }>>;
    subClasses: z.ZodArray<z.ZodString>;
    subClassesVerification: z.ZodOptional<z.ZodEnum<{
        unverified: "unverified";
        verified: "verified";
    }>>;
    id: z.ZodString;
    name: z.ZodString;
    aliases: z.ZodArray<z.ZodString>;
    level: z.ZodNumber;
    school: z.ZodEnum<{
        Illusion: "Illusion";
        Abjuration: "Abjuration";
        Conjuration: "Conjuration";
        Divination: "Divination";
        Enchantment: "Enchantment";
        Evocation: "Evocation";
        Necromancy: "Necromancy";
        Transmutation: "Transmutation";
    }>;
    legacy: z.ZodBoolean;
}, z.core.$strip>;
