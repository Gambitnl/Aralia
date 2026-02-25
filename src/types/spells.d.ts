/**
 * @file src/types/spells.ts
 * This file contains all the new TypeScript type definitions and interfaces
 * for the component-based spell system.
 */
import type { SpellVisualSpec } from './visuals';
/**
 * Represents a D&D 5e spell with a complete mechanical definition, designed
 * for a component-based, machine-readable system.
 */
export interface Spell {
    id: string;
    name: string;
    aliases?: string[];
    level: number;
    school: SpellSchool;
    source?: string;
    legacy?: boolean;
    classes: string[];
    description: string;
    higherLevels?: string;
    tags?: string[];
    ritual?: boolean;
    rarity?: SpellRarity;
    attackType?: SpellAttackType;
    castingTime: CastingTime;
    range: Range;
    components: Components;
    duration: Duration;
    targeting: SpellTargeting;
    effects: SpellEffect[];
    visual?: SpellVisualSpec;
    arbitrationType?: ArbitrationType;
    aiContext?: AIContext;
    /** @deprecated Use targeting.areaOfEffect instead */
    areaOfEffect?: AreaOfEffect;
    /** @deprecated Use effects[].damage.type instead */
    damageType?: DamageType;
}
/**
 * The eight schools of magic in D&D 5e.
 */
export declare enum SpellSchool {
    Abjuration = "Abjuration",
    Conjuration = "Conjuration",
    Divination = "Divination",
    Enchantment = "Enchantment",
    Evocation = "Evocation",
    Illusion = "Illusion",
    Necromancy = "Necromancy",
    Transmutation = "Transmutation"
}
/** Legacy alias for SpellSchool */
export type MagicSchool = SpellSchool;
export declare const MagicSchool: typeof SpellSchool;
export interface SpellSchoolTraits {
    /** A brief description of what the school encompasses. */
    description: string;
    /** Thematic keywords associated with the school. */
    themes: string[];
}
/**
 * Standard traits associated with each school of magic.
 */
export declare const SpellSchoolDefinitions: Record<SpellSchool, SpellSchoolTraits>;
/** The rarity of a spell. */
export type SpellRarity = "common" | "uncommon" | "rare" | "very_rare" | "legendary";
/** Defines the type of attack roll required, if any. */
export type SpellAttackType = "melee" | "ranged" | "none";
/**
 * Defines the time required to cast a spell.
 */
export interface CastingTime {
    value: number;
    unit: "action" | "bonus_action" | "reaction" | "minute" | "hour" | "special";
    reactionCondition?: string;
    combatCost?: {
        type: "action" | "bonus_action" | "reaction";
        condition?: string;
    };
    explorationCost?: {
        value: number;
        unit: "minute" | "hour";
    };
}
/**
 * Defines the spell's effective range.
 */
export interface Range {
    type: "self" | "touch" | "ranged" | "special";
    distance?: number;
}
/**
 * Defines the components required to cast a spell.
 */
export interface Components {
    verbal: boolean;
    somatic: boolean;
    material: boolean;
    materialDescription?: string;
    materialCost?: number;
    isConsumed?: boolean;
}
/**
 * Defines how long a spell's effects last.
 */
export interface Duration {
    type: "instantaneous" | "timed" | "special" | "until_dispelled" | "until_dispelled_or_triggered";
    value?: number;
    unit?: "round" | "minute" | "hour" | "day";
    concentration: boolean;
}
/** A discriminated union representing all possible targeting schemes for a spell. */
export type SpellTargeting = SingleTargeting | MultiTargeting | AreaTargeting | SelfTargeting | HybridTargeting;
/** Specifies filters for what can be targeted by a spell. */
export type TargetFilter = "creatures" | "objects" | "allies" | "enemies" | "self" | "point" | "ground";
/** Defines how complex target selection (e.g., Sleep/Color Spray pools) is allocated. */
export interface TargetAllocation {
    type: 'all' | 'pool' | 'random' | 'choice';
    pool?: {
        resource: 'hp' | 'hit_dice';
        dice: string;
        sortOrder: 'ascending' | 'descending';
        strictLimit?: boolean;
        scaling?: ScalingFormula;
    };
}
/** Defines the shape and size of an area of effect. */
export interface AreaOfEffect {
    /**
     * Shape of the area of effect.
     * Basic shapes: Cone, Cube, Cylinder, Line, Sphere, Square
     * Extended shapes:
     * - Emanation: Centered on caster, optionally moves with caster
     * - Wall: Linear barrier with length/height/thickness
     * - Hemisphere: Dome shape (half-sphere)
     * - Ring: Hollow circle/cylinder
     */
    shape: "Cone" | "Cube" | "Cylinder" | "Line" | "Sphere" | "Square" | "Emanation" | "Wall" | "Hemisphere" | "Ring";
    /** Primary dimension in feet (radius for spheres/emanations, length for lines/walls). */
    size: number;
    /** Optional vertical dimension for planar effects like squares on the ground. */
    height?: number;
    /**
     * For Emanation: whether the AoE moves with the caster.
     * If true, the zone re-centers on the caster at the start of their turn.
     */
    followsCaster?: boolean;
    /** For Wall/Line shapes: thickness in feet (default 1 if not specified). */
    thickness?: number;
    /** For Wall shapes: width of each segment in feet. */
    width?: number;
    /**
     * For spells that allow shape choice at cast time (e.g., Wall of Fire: line or ring).
     * The caster selects one of the options when the spell is cast.
     */
    shapeVariant?: {
        options: ("Line" | "Ring" | "Hemisphere" | "Sphere")[];
        default: string;
    };
    /**
     * For destructible walls: AC and HP per section.
     * Used by terrain/wall destruction logic.
     */
    wallStats?: {
        ac: number;
        hpPerSection: number;
        sectionSize: number;
    };
    /**
     * For zones that trigger damage on entry/proximity.
     * E.g., Wall of Fire deals damage within 10 feet of one side.
     */
    triggerZone?: {
        /** Distance from the wall/area that still triggers the effect. */
        triggerDistance?: number;
        /** Which side(s) of the wall trigger the effect. */
        triggerSide?: "one" | "both" | "inside";
    };
}
/**
 * A number that can scale based on character level or slot level.
 * Used for effects like Eldritch Blast (1 beam at 1st, 2 at 5th, 3 at 11th, 4 at 17th).
 */
export type ScalableNumber = number | ScalableNumberObject;
/** Object form of ScalableNumber with explicit scaling thresholds. */
export interface ScalableNumberObject {
    base: number;
    scaling: {
        type: "character_level" | "slot_level";
        /** Maps level thresholds to values. E.g., { "1": 1, "5": 2, "11": 3, "17": 4 } */
        thresholds: Record<string, number>;
    };
}
/**
 * Resolves a ScalableNumber to its actual numeric value based on the given level.
 * @param value - The ScalableNumber (either a plain number or a scaling object)
 * @param level - The character level or slot level to evaluate against
 * @returns The resolved numeric value
 * @example
 * // Eldritch Blast: { base: 1, scaling: { type: "character_level", thresholds: { "1": 1, "5": 2, "11": 3, "17": 4 } } }
 * resolveScalableNumber(eldritchBlast.targeting.maxTargets, 5) // returns 2
 * resolveScalableNumber(eldritchBlast.targeting.maxTargets, 11) // returns 3
 */
export declare function resolveScalableNumber(value: ScalableNumber, level: number): number;
/**
 * Type guard to check if a ScalableNumber is a scaling object (not a plain number).
 */
export declare function isScalableNumberObject(value: ScalableNumber): value is ScalableNumberObject;
/** Base interface for all targeting types. */
interface BaseTargeting {
    validTargets: TargetFilter[];
    lineOfSight?: boolean;
    /**
     * Constraints on what can be targeted.
     * Checked at cast time (unlike effect conditions which are checked at resolution).
     */
    filter?: TargetConditionFilter;
}
/** Targets a single entity. Example: Chromatic Orb. */
export interface SingleTargeting extends BaseTargeting {
    type: "single";
    range: number;
}
/** Targets multiple specific entities. Example: Magic Missile, Eldritch Blast. */
export interface MultiTargeting extends BaseTargeting {
    type: "multi";
    range: number;
    /** Can be a fixed number or scale with level (e.g., Eldritch Blast beams) */
    maxTargets: ScalableNumber;
}
/** Targets an area, affecting all valid entities within. Example: Fireball. */
export interface AreaTargeting extends BaseTargeting {
    type: "area";
    range: number;
    areaOfEffect: AreaOfEffect;
}
/** Targets only the caster. Example: Shield. */
export interface SelfTargeting extends BaseTargeting {
    type: "self";
}
/**
 * A complex targeting scheme with an initial target and a secondary area effect.
 * Example: Ice Knife (hits one target, then explodes).
 */
export interface HybridTargeting extends BaseTargeting {
    type: "hybrid";
    primary: SingleTargeting;
    secondary: AreaTargeting;
}
/** A discriminated union representing all possible spell effects. */
export type SpellEffect = DamageEffect | HealingEffect | StatusConditionEffect | MovementEffect | SummoningEffect | TerrainEffect | UtilityEffect | DefensiveEffect | ReactiveEffect;
/** The six primary ability scores used for saving throws. */
export type SavingThrowAbility = "Strength" | "Dexterity" | "Constitution" | "Intelligence" | "Wisdom" | "Charisma";
/**
 * The thirteen types of damage in D&D 5e.
 */
export declare const DamageType: {
    readonly Acid: "Acid";
    readonly Bludgeoning: "Bludgeoning";
    readonly Cold: "Cold";
    readonly Fire: "Fire";
    readonly Force: "Force";
    readonly Lightning: "Lightning";
    readonly Necrotic: "Necrotic";
    readonly Piercing: "Piercing";
    readonly Poison: "Poison";
    readonly Psychic: "Psychic";
    readonly Radiant: "Radiant";
    readonly Slashing: "Slashing";
    readonly Thunder: "Thunder";
};
export type DamageType = typeof DamageType[keyof typeof DamageType] | string;
export interface DamageTypeTraits {
    description: string;
}
/**
 * Standard traits associated with each damage type.
 */
export declare const DamageTypeDefinitions: Record<DamageType, DamageTypeTraits>;
/** The fourteen status conditions in D&D 5e plus custom game conditions. */
export type ConditionName = "Blinded" | "Charmed" | "Deafened" | "Exhaustion" | "Frightened" | "Grappled" | "Incapacitated" | "Invisible" | "Paralyzed" | "Petrified" | "Poisoned" | "Prone" | "Restrained" | "Stunned" | "Unconscious" | "Ignited" | "Slowed" | "Slasher Slow";
/** Modifiers that adjust how a saving throw is made. */
export interface SaveModifier {
    type: "advantage" | "disadvantage" | "bonus" | "penalty";
    value?: number;
    appliesTo?: TargetConditionFilter;
    reason?: string;
}
/** Defines the trigger for an effect. */
export interface EffectTrigger {
    type: "immediate" | "after_primary" | "turn_start" | "turn_end" | "on_enter_area" | "on_exit_area" | "on_end_turn_in_area" | "on_target_move" | "on_target_attack" | "on_target_cast" | "on_caster_action" | "on_attack_hit";
    /**
     * Controls how often this trigger can fire.
     * Defaults to 'every_time' if not specified.
     */
    frequency?: "every_time" | "first_per_turn" | "once" | "once_per_creature";
    /**
     * For rider effects (on_attack_hit), controls consumption.
     */
    consumption?: "unlimited" | "first_hit" | "per_turn";
    /**
     * For rider effects, filters which attacks trigger the effect.
     */
    attackFilter?: {
        weaponType?: "melee" | "ranged" | "any";
        attackType?: "weapon" | "spell" | "any";
    };
    /**
     * For on_target_move triggers, specifies if it triggers on willing or forced movement.
     */
    movementType?: "any" | "willing" | "forced";
    /**
     * For on_caster_action triggers, specifies the cost to sustain the effect.
     */
    sustainCost?: {
        actionType: "action" | "bonus_action" | "reaction";
        optional: boolean;
    };
}
/** Defines the condition under which an effect applies. */
export interface EffectCondition {
    type: "hit" | "save" | "always";
    saveType?: SavingThrowAbility;
    saveEffect?: "none" | "half" | "negates_condition";
    /** Filter to apply effect only to specific target types. */
    targetFilter?: TargetConditionFilter;
    /** Require that the target already has certain conditions for this effect to apply. */
    requiresStatus?: ConditionName[];
    /** Adjustments applied when making a saving throw. */
    saveModifiers?: SaveModifier[];
}
/** Filter for conditional effects based on target properties. */
export interface TargetConditionFilter {
    /** Creature types this effect applies to (e.g., ["Undead", "Construct"]) */
    creatureType?: string[];
    /** Preferred plural field for creature types (e.g., ["Undead", "Construct"]) */
    creatureTypes?: string[];
    /** Creature types excluded from the effect */
    excludeCreatureTypes?: string[];
    /** Size categories this effect applies to (e.g., ["Large", "Huge"]) */
    size?: string[];
    /** Preferred plural field for sizes */
    sizes?: string[];
    /** Alignments this effect applies to (e.g., ["Evil"]) */
    alignment?: string[];
    /** Preferred plural field for alignments */
    alignments?: string[];
    /** Conditions the target must have (e.g., ["Prone", "Charmed"]) */
    hasCondition?: string[];
}
/** Base interface for all spell effects. */
export interface BaseEffect {
    trigger: EffectTrigger;
    condition: EffectCondition;
    scaling?: ScalingFormula;
    description?: string;
}
/** An effect that deals damage. */
export interface DamageEffect extends BaseEffect {
    type: "DAMAGE";
    damage: DamageData;
}
/** Contains the details of the damage dealt. */
export interface DamageData {
    dice: string;
    type: DamageType;
}
/** An effect that restores hit points. */
export interface HealingEffect extends BaseEffect {
    type: "HEALING";
    healing: HealingData;
}
/** Contains the details of the healing done. */
export interface HealingData {
    dice: string;
    isTemporaryHp?: boolean;
}
/** An effect that applies a status condition. */
export interface StatusConditionEffect extends BaseEffect {
    type: "STATUS_CONDITION";
    statusCondition: StatusCondition;
}
/** Defines the applied status condition and its duration. */
export interface StatusCondition {
    name: ConditionName;
    duration: EffectDuration;
    level?: number;
    escapeCheck?: EscapeCheck;
    /**
     * Optional mechanical effect associated with this status.
     * Allows encapsulating numeric modifiers (e.g. Speed -10) directly within the condition object.
     * This structure mirrors the `effect` property of `StatusEffect` in `combat.ts`.
     */
    effect?: {
        type: 'stat_modifier' | 'damage_per_turn' | 'heal_per_turn' | 'skip_turn' | 'condition';
        value?: number;
        stat?: string;
    };
}
/** Defines how long an effect-specific condition lasts. */
export interface EffectDuration {
    type: "rounds" | "minutes" | "special";
    value?: number;
}
/** Requirements to end a condition through an action or check. */
export interface EscapeCheck {
    ability?: SavingThrowAbility;
    skill?: string;
    dc: number | "spell_save_dc";
    actionCost: "action" | "bonus_action";
}
/** A temporary or permanent modification to a character's stats. */
export interface StatModifier {
    stat: string;
    value: number;
    type: "bonus" | "penalty";
}
/** An effect that alters movement (e.g., reduces speed, forces movement). */
export interface MovementEffect extends BaseEffect {
    type: "MOVEMENT";
    movementType: "push" | "pull" | "teleport" | "speed_change" | "stop";
    distance?: number;
    speedChange?: {
        stat: "speed";
        value: number;
        unit: "feet";
    };
    /** Explicit destination for teleport effects (if known at design time) */
    destination?: {
        x: number;
        y: number;
    };
    /** Alternative field for target position */
    targetPosition?: {
        x: number;
        y: number;
    };
    duration: EffectDuration;
    forcedMovement?: ForcedMovement;
}
/** An effect that summons creatures or objects. */
export interface SummoningEffect extends BaseEffect {
    type: "SUMMONING";
    summonType: "creature" | "object";
    creatureId?: string;
    objectDescription?: string;
    count: number;
    duration: EffectDuration;
    familiarContract?: FamiliarContract;
}
/** Structured terrain manipulation for spells like Mold Earth */
export interface TerrainManipulation {
    /** Type of manipulation: excavate/fill dirt, toggle difficult terrain, or cosmetic changes */
    type: "excavate" | "fill" | "difficult" | "normal" | "cosmetic";
    /** Volume of terrain affected */
    volume?: {
        shape: "Cube";
        size: number;
        depth?: number;
    };
    /** How long the manipulation lasts (for difficult/cosmetic) */
    duration?: EffectDuration;
    /** Distance excavated material can be deposited, in feet */
    depositDistance?: number;
}
/** An effect that creates or alters terrain. */
export interface TerrainEffect extends BaseEffect {
    type: "TERRAIN";
    terrainType: "difficult" | "obscuring" | "damaging" | "blocking" | "wall";
    areaOfEffect: AreaOfEffect;
    duration: EffectDuration;
    damage?: DamageData;
    wallProperties?: {
        hp: number;
        ac: number;
    };
    dispersedByStrongWind?: boolean;
    /** Structured manipulation action for spells like Mold Earth */
    manipulation?: TerrainManipulation;
}
/** A non-combat or miscellaneous effect (e.g., creating light, communicating). */
export interface UtilityEffect extends BaseEffect {
    type: "UTILITY";
    utilityType: "light" | "communication" | "creation" | "information" | "control" | "sensory" | "other";
    description: string;
    grantedActions?: GrantedAction[];
    attackAugments?: AttackAugment[];
    controlOptions?: ControlOption[];
    taunt?: TauntEffect;
    /** Structured light source configuration for utilityType: "light" */
    light?: {
        brightRadius: number;
        dimRadius?: number;
        attachedTo?: "caster" | "target" | "point";
        color?: string;
    };
    /** Structured save penalty for debuff effects like Mind Sliver */
    savePenalty?: SavePenalty;
}
/** Defines a penalty applied to future saving throws (e.g., Mind Sliver's -1d4). */
export interface SavePenalty {
    dice: string;
    applies: "next_save";
    duration: EffectDuration;
}
/** An effect that provides defensive bonuses (e.g., AC boost, resistance). */
export interface DefensiveEffect extends BaseEffect {
    type: "DEFENSIVE";
    defenseType: "ac_bonus" | "set_base_ac" | "ac_minimum" | "resistance" | "immunity" | "temporary_hp" | "advantage_on_saves" | "disadvantage_on_attacks";
    value?: number;
    acBonus?: number;
    baseACFormula?: string;
    acMinimum?: number;
    damageType?: DamageType[];
    savingThrow?: SavingThrowAbility[];
    duration: EffectDuration;
    attackerFilter?: TargetConditionFilter;
    reactionTrigger?: {
        event: "when_hit" | "when_targeted" | "when_damaged";
        includesSpells?: string[];
    };
    restrictions?: {
        noArmor?: boolean;
        noShield?: boolean;
        targetSelf?: boolean;
    };
}
/**
 * Reactive triggers and sustain-style effects (e.g., Shield, Glyph of Warding).
 * TODO(preserve-lint): Formalize trigger/movement vocab and costs once reactive spells are data-driven.
 */
export interface ReactiveEffect extends Omit<BaseEffect, 'trigger'> {
    type: "REACTIVE";
    trigger: {
        type: 'on_target_move' | 'on_target_attack' | 'on_any_cast' | 'on_caster_action';
        movementType?: string;
        sustainCost?: number;
    };
    duration?: {
        type?: 'rounds' | 'minutes' | 'hours' | 'special';
        value?: number;
    };
    description?: string;
}
/** Describes an action, bonus action, or reaction option granted while a spell is active. */
export interface GrantedAction {
    type: "action" | "bonus_action" | "reaction";
    action: string;
    frequency: "once" | "each_turn" | "while_active";
    rangeLimit?: number;
    notes?: string;
}
/** Adds structured rider effects to weapon attacks (e.g., extra radiant damage). */
export interface AttackAugment {
    attackType: "weapon" | "melee_weapon" | "ranged_weapon";
    additionalDamage?: DamageData;
    appliesOn?: "hit";
}
/** Models specific one-word command options for spells like Command. */
export interface ControlOption {
    name: string;
    effect: "approach" | "drop" | "flee" | "grovel" | "halt" | string;
    details?: string;
}
/** Captures taunt/leash mechanics such as Compelled Duel. */
export interface TauntEffect {
    disadvantageAgainstOthers?: boolean;
    leashRangeFeet?: number;
    breakConditions?: string[];
}
/** Defines forced movement parameters (e.g., reaction-based fleeing). */
export interface ForcedMovement {
    usesReaction?: boolean;
    direction?: "away_from_caster" | "toward_caster" | "caster_choice" | "safest_route";
    maxDistance?: string;
}
/** Provides machine-readable details for familiars created by spells. */
export interface FamiliarContract {
    forms: string[];
    telepathyRange: number;
    actionEconomy: {
        actsIndependently: boolean;
        canAttack: boolean;
    };
    sensesSharing?: {
        actionType: "action" | "bonus_action" | "reaction";
        range: number;
    };
    touchDelivery?: {
        enabled: boolean;
        range: number;
        usesReactionOf: "familiar" | "caster";
    };
    dismissal?: {
        method: "pocket_dimension";
        actionType: "action" | "bonus_action";
    };
    notes?: string;
}
/** Defines how a spell's effects improve when cast at higher levels. */
export interface ScalingFormula {
    type: "slot_level" | "character_level" | "custom";
    bonusPerLevel?: string;
    customFormula?: string;
    /**
     * Explicitly maps character/slot levels to new dice values (or flat values).
     * Key is the level threshold (e.g., "5"), Value is the new damage string (e.g., "2d10").
     * Used for tiered scaling like cantrips (5th, 11th, 17th).
     */
    scalingTiers?: Record<string, string>;
}
/**
 * Determines how ambiguous or complex spell effects are resolved.
 * - `mechanical`: Fully defined by the rules, no AI needed.
 * - `ai_assisted`: Requires AI interpretation of player input (e.g., Phantasmal Force).
 * - `ai_dm`: Requires the AI to act as a Dungeon Master to determine outcomes (e.g., Wish).
 */
export type ArbitrationType = "mechanical" | "ai_assisted" | "ai_dm";
/** Provides the necessary context for the AI to make a ruling on a spell's effect. */
export interface AIContext {
    prompt: string;
    playerInputRequired: boolean;
}
/**
 * A type guard that checks if an object is a valid `Spell`.
 * @param obj The object to check.
 * @returns `true` if the object is a `Spell`, `false` otherwise.
 */
export declare function isSpell(obj: unknown): obj is Spell;
/** A type guard to check if a `SpellEffect` is a `DamageEffect`. */
export declare function isDamageEffect(effect: SpellEffect): effect is DamageEffect;
/** A type guard to check if a `SpellEffect` is a `HealingEffect`. */
export declare function isHealingEffect(effect: SpellEffect): effect is HealingEffect;
/** A type guard to check if a `SpellEffect` is a `StatusConditionEffect`. */
export declare function isStatusConditionEffect(effect: SpellEffect): effect is StatusConditionEffect;
/** A type guard to check if a `SpellEffect` is a `MovementEffect`. */
export declare function isMovementEffect(effect: SpellEffect): effect is MovementEffect;
/** A type guard to check if a `SpellEffect` is a `SummoningEffect`. */
export declare function isSummoningEffect(effect: SpellEffect): effect is SummoningEffect;
/** A type guard to check if a `SpellEffect` is a `TerrainEffect`. */
export declare function isTerrainEffect(effect: SpellEffect): effect is TerrainEffect;
/** A type guard to check if a `SpellEffect` is a `UtilityEffect`. */
export declare function isUtilityEffect(effect: SpellEffect): effect is UtilityEffect;
/** A type guard to check if a `SpellEffect` is a `DefensiveEffect`. */
export declare function isDefensiveEffect(effect: SpellEffect): effect is DefensiveEffect;
export {};
