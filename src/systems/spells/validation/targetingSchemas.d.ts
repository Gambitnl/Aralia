/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/07/2026, 18:56:12
 * Dependents: systems/spells/validation/spellValidator.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { z } from 'zod';
export declare const TargetConditionFilter: z.ZodObject<{
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
export declare const Targeting: z.ZodObject<{
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
