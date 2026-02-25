/**
 * @file src/types/combat.ts
 * This file contains all combat-related TypeScript type definitions and interfaces
 * used throughout the Aralia RPG application's battle map feature.
 */
import type { AbilityScoreName, CharacterStats } from './core';
import type { Class, SpellbookData, SpellSlots, FeatChoice, HitPointDicePool } from './character';
import type { Item } from './items';
import type { Spell, DamageType, ConditionName, EffectDuration, SpellEffect } from './spells';
import { StateTag } from './elemental';
import { Plane } from './planes';
import { RitualState } from './ritual';
export type { CharacterStats };
/**
 * Filter criteria for selecting targets for an effect.
 * Strictly typed to avoid 'any'.
 */
export interface TargetConditionFilter {
    conditions?: ConditionName[];
    creatureTypes?: string[];
    hpStatus?: 'full' | 'bloodied' | 'unconscious';
    stats?: Partial<CharacterStats>;
    alignment?: string[];
}
/**
 * Represents a status effect applied to a character.
 */
export interface StatusEffect {
    id: string;
    name: ConditionName | string;
    type: 'buff' | 'debuff' | 'neutral' | 'dot' | 'hot';
    description?: string;
    duration: number;
    source?: string;
    icon?: string;
    effect?: {
        type: 'stat_modifier' | 'damage_per_turn' | 'heal_per_turn' | 'skip_turn' | 'condition';
        value?: number;
        stat?: string;
    };
    modifiers?: {
        stat?: AbilityScoreName;
        value?: number;
        skill?: string;
        attackBonus?: number;
        acBonus?: number;
        movementSpeed?: number;
        advantage?: ('attack' | 'save' | 'check')[];
        disadvantage?: ('attack' | 'save' | 'check')[];
        resistance?: DamageType[];
        vulnerability?: DamageType[];
        immunity?: DamageType[];
    };
    visualEffect?: string;
}
/**
 * Represents an active, ongoing effect on a character (e.g., from a spell like Shield of Faith or Mage Armor).
 * These are distinct from Conditions (Prone, Stunned) as they often carry specific mechanics or durations.
 */
export interface ActiveEffect {
    id: string;
    spellId: string;
    casterId: string;
    sourceName: string;
    type: "buff" | "debuff" | "utility";
    duration: EffectDuration;
    startTime: number;
    /**
     * Mechanical impacts of this effect.
     * Can be used to modify AC, saving throws, etc.
     */
    mechanics?: {
        acBonus?: number;
        savingThrowBonus?: number;
        damageResistance?: DamageType[];
        damageImmunity?: DamageType[];
        damageVulnerability?: DamageType[];
        attackBonus?: number;
        damageBonus?: {
            amount: number;
            type: DamageType;
        };
        triggerCondition?: "on_hit" | "on_damaged" | "on_save";
        /**
         * Filter to determine if the effect applies against a specific attacker.
         * Replaces 'any' with strict typing.
         */
        attackerFilter?: TargetConditionFilter;
        planarPhase?: string;
        planarVision?: string[];
        /** When true, this effect imposes disadvantage on attack rolls */
        disadvantageOnAttacks?: boolean;
        /** When true, this effect grants advantage on attack rolls */
        advantageOnAttacks?: boolean;
    };
}
export type { SpellSlots };
export interface Position {
    x: number;
    y: number;
}
export type LightLevel = 'bright' | 'dim' | 'darkness' | 'magical_darkness';
export interface ActionEconomyState {
    action: {
        used: boolean;
        remaining: number;
    };
    bonusAction: {
        used: boolean;
        remaining: number;
    };
    reaction: {
        used: boolean;
        remaining: number;
    };
    movement: {
        used: number;
        total: number;
    };
    freeActions: number;
}
export type Direction = 'north' | 'south' | 'east' | 'west' | 'northeast' | 'northwest' | 'southeast' | 'southwest';
/** Tracks 5e conditions (prone, restrained, custom, etc.) currently affecting a character. */
export interface ActiveCondition {
    name: ConditionName | string;
    duration: EffectDuration | {
        type: 'permanent';
        value?: number;
    };
    appliedTurn: number;
    source?: string;
}
export interface CombatCharacter {
    id: string;
    name: string;
    level: number;
    /**
     * Creature types for targeting (e.g., ['Humanoid', 'Elf']).
     * Used by spells like Charm Person or Hold Person.
     * TODO(Taxonomist): Migrate string[] to CreatureType[] from src/types/creatures.ts
     */
    creatureTypes?: string[];
    alignment?: string;
    class: Class;
    savingThrowProficiencies?: AbilityScoreName[];
    position: Position;
    stats: CharacterStats;
    abilities: Ability[];
    team: 'player' | 'enemy';
    currentHP: number;
    maxHP: number;
    /** Optional: tracks remaining/total Hit Point Dice for rest-like mechanics. */
    hitPointDice?: HitPointDicePool[];
    initiative: number;
    statusEffects: StatusEffect[];
    conditions?: ActiveCondition[];
    facing?: Direction;
    actionEconomy: ActionEconomyState;
    spellbook?: SpellbookData;
    spellSlots?: SpellSlots;
    concentratingOn?: ConcentrationState;
    currentRitual?: RitualState;
    /**
     * List of feats the character possesses (e.g., "Slasher", "Sentinel").
     * Used for conditional logic in commands (e.g., Slasher slows on hit).
     */
    feats?: string[];
    featChoices?: Record<string, FeatChoice>;
    /** Elemental states (Wet, Frozen, etc.) affecting the character */
    stateTags?: StateTag[];
    isSummon?: boolean;
    summonMetadata?: {
        casterId: string;
        spellId: string;
        durationRemaining?: number;
        dismissable: boolean;
    };
    armorClass?: number;
    baseAC?: number;
    resistances?: DamageType[];
    vulnerabilities?: DamageType[];
    immunities?: DamageType[];
    tempHP?: number;
    activeEffects?: ActiveEffect[];
    riders?: ActiveRider[];
    damagedThisTurn?: boolean;
    savePenaltyRiders?: SavePenaltyRider[];
    /** Tracks which feat effects have been used this turn (e.g., 'slasher_slow' for once-per-turn limit) */
    featUsageThisTurn?: string[];
    damageDealt?: unknown[];
    healingDone?: unknown[];
    additionalSavingThrowProficiencies?: AbilityScoreName[];
}
export type AbilityType = 'attack' | 'spell' | 'skill' | 'movement' | 'utility';
export type TargetingType = 'single_enemy' | 'single_ally' | 'single_any' | 'area' | 'self' | 'all_enemies' | 'all_allies';
export type ActionCostType = 'action' | 'bonus' | 'reaction' | 'free' | 'movement-only';
export interface AbilityCost {
    type: ActionCostType;
    movementCost?: number;
    spellSlotLevel?: number;
    quantity?: number;
    limitations?: {
        oncePerTurn?: boolean;
        oncePerRound?: boolean;
        requiresOtherAction?: ActionCostType;
    };
}
export interface AreaOfEffect {
    shape: 'circle' | 'cone' | 'line' | 'square';
    size: number;
    angle?: number;
}
export interface AbilityEffect {
    type: 'damage' | 'heal' | 'status' | 'movement' | 'teleport';
    value?: number;
    dice?: string;
    damageType?: 'physical' | 'magical' | 'fire' | 'ice' | 'lightning' | 'acid' | 'poison' | 'necrotic' | 'radiant' | 'force' | 'psychic' | 'thunder';
    statusEffect?: StatusEffect;
    duration?: number;
}
export interface Ability {
    id: string;
    name: string;
    description: string;
    type: AbilityType;
    cost: AbilityCost;
    alternativeCosts?: AbilityCost[];
    prerequisites?: {
        position?: 'adjacent' | 'range';
        otherAbilityUsed?: string;
        minimumMovement?: number;
    };
    movementType?: 'before' | 'after' | 'integrated';
    interruptsMovement?: boolean;
    tags?: string[];
    targeting: TargetingType;
    range: number;
    /**
     * AoE metadata flattened onto the ability for quick inspection by AI/preview UIs.
     * areaShape/areaSize mirror AreaOfEffect but remain optional so single-target
     * abilities do not need to specify them. When present they should always align
     * with D&D 5e templates (5 ft grid squares). size is expressed in tiles.
     */
    areaShape?: 'circle' | 'cone' | 'line' | 'square';
    areaSize?: number;
    areaOfEffect?: AreaOfEffect;
    effects: AbilityEffect[];
    cooldown?: number;
    currentCooldown?: number;
    icon?: string;
    spell?: Spell;
    weapon?: Item;
    isProficient?: boolean;
    mastery?: string;
}
export interface TurnState {
    currentTurn: number;
    turnOrder: string[];
    currentCharacterId: string | null;
    phase: 'planning' | 'action' | 'resolution' | 'end_turn';
    actionsThisTurn: CombatAction[];
}
/**
 * Represents the state of a character concentrating on a spell.
 * Tracks which spell is active, when it started, and related effects.
 */
export interface ConcentrationState {
    spellId: string;
    spellName: string;
    spellLevel: number;
    startedTurn: number;
    effectIds: string[];
    canDropAsFreeAction: boolean;
    sustainCost?: {
        actionType: "action" | "bonus_action" | "reaction";
        optional: boolean;
    };
    sustainedThisTurn?: boolean;
}
export interface CombatAction {
    id: string;
    characterId: string;
    type: 'move' | 'ability' | 'end_turn' | 'sustain' | 'break_free';
    abilityId?: string;
    targetEffectId?: string;
    targetPosition?: Position;
    targetCharacterIds?: string[];
    movementUsed?: number;
    cost: AbilityCost;
    timestamp: number;
}
export interface ReactiveTrigger {
    id: string;
    sourceEffect: SpellEffect;
    casterId: string;
    targetId?: string;
    createdTurn: number;
    expiresAtRound?: number;
}
export interface ActiveRider {
    id: string;
    spellId: string;
    casterId: string;
    sourceName: string;
    targetId?: string;
    effect: SpellEffect;
    consumption: "unlimited" | "first_hit" | "per_turn";
    attackFilter: {
        weaponType?: "melee" | "ranged" | "any";
        attackType?: "weapon" | "spell" | "any";
    };
    usedThisTurn: boolean;
    duration: {
        type: "rounds" | "minutes" | "special";
        value?: number;
    };
}
/**
 * Save penalty rider applied to a target from effects like Mind Sliver.
 * Stored on the target character (not caster) since it modifies their saves.
 */
export interface SavePenaltyRider {
    id: string;
    spellId: string;
    casterId: string;
    sourceName: string;
    dice?: string;
    flat?: number;
    applies: "next_save" | "all_saves";
    duration: {
        type: "rounds" | "minutes" | "special";
        value?: number;
    };
    appliedTurn: number;
}
/**
 * Represents an active light source on the map, created by spells or items.
 * Light sources can be attached to characters or fixed at a point.
 */
export interface LightSource {
    id: string;
    sourceSpellId: string;
    casterId: string;
    brightRadius: number;
    dimRadius: number;
    attachedTo: "caster" | "target" | "point";
    attachedToCharacterId?: string;
    position?: Position;
    color?: string;
    createdTurn: number;
    expiresAtRound?: number;
}
export type BattleMapTerrain = 'grass' | 'rock' | 'water' | 'difficult' | 'wall' | 'floor' | 'sand' | 'mud';
export type BattleMapDecoration = 'tree' | 'boulder' | 'stalagmite' | 'pillar' | 'cactus' | 'mangrove' | null;
export interface EnvironmentalEffect {
    id: string;
    type: 'fire' | 'ice' | 'poison' | 'difficult_terrain' | 'web' | 'fog';
    duration: number;
    effect: StatusEffect;
    sourceSpellId?: string;
    casterId?: string;
}
export interface BattleMapTile {
    id: string;
    coordinates: {
        x: number;
        y: number;
    };
    terrain: BattleMapTerrain;
    elevation: number;
    movementCost: number;
    blocksLoS: boolean;
    blocksMovement: boolean;
    decoration: BattleMapDecoration;
    effects: string[];
    providesCover?: boolean;
    environmentalEffects?: EnvironmentalEffect[];
}
export interface BattleMapData {
    dimensions: {
        width: number;
        height: number;
    };
    tiles: Map<string, BattleMapTile>;
    theme: 'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp';
    seed: number;
}
export interface CombatState {
    isActive: boolean;
    characters: CombatCharacter[];
    turnState: TurnState;
    selectedCharacterId: string | null;
    selectedAbilityId: string | null;
    actionMode: 'select' | 'move' | 'target_ability' | 'preview_aoe';
    validTargets: Position[];
    validMoves: Position[];
    aoePreview?: {
        center: Position;
        affectedTiles: Position[];
        ability: Ability;
    };
    combatLog: CombatLogEntry[];
    reactiveTriggers: ReactiveTrigger[];
    activeLightSources: LightSource[];
    mapData?: BattleMapData;
    currentPlane?: Plane;
}
export interface MoveAnimationData {
    path?: Position[];
    teleport?: boolean;
}
export interface AttackAnimationData {
    targetId: string;
    weaponId?: string;
    isCrit?: boolean;
    isMiss?: boolean;
    damage?: number;
}
export interface SpellEffectAnimationData {
    spellId?: string;
    effectType?: string;
    color?: string;
    areaOfEffect?: AreaOfEffect;
    targetPositions?: Position[];
}
export interface DamageNumberAnimationData {
    value: number;
    type: 'physical' | 'magical' | 'heal' | 'miss';
    isCrit?: boolean;
}
export interface StatusEffectAnimationData {
    statusId: string;
    action: 'apply' | 'remove' | 'tick';
    icon?: string;
}
/**
 * Discriminated union of all possible animation data payloads.
 * Used to enforce strict typing on the `data` field of Animations.
 */
export type AnimationData = MoveAnimationData | AttackAnimationData | SpellEffectAnimationData | DamageNumberAnimationData | StatusEffectAnimationData;
export interface Animation {
    id: string;
    type: 'move' | 'attack' | 'spell_effect' | 'damage_number' | 'status_effect';
    characterId?: string;
    startPosition?: Position;
    endPosition?: Position;
    duration: number;
    startTime: number;
    data?: AnimationData;
}
export interface DamageNumber {
    id: string;
    value: number;
    position: Position;
    type: 'damage' | 'heal' | 'miss';
    startTime: number;
    duration: number;
}
export interface CombatLogData {
    damageAmount?: number;
    damageType?: string;
    healAmount?: number;
    heal?: number;
    statusEffectName?: string;
    abilityName?: string;
    rollResult?: number;
    isDeath?: boolean;
    targetTags?: string[];
    spellSchool?: string;
    spellName?: string;
    source?: string;
    [key: string]: string | number | boolean | undefined | object;
}
export interface CombatLogEntry {
    id: string;
    timestamp: number;
    type: 'action' | 'damage' | 'heal' | 'status' | 'turn_start' | 'turn_end';
    message: string;
    characterId?: string;
    targetIds?: string[];
    data?: CombatLogData;
}
export interface CharacterPosition {
    characterId: string;
    coordinates: {
        x: number;
        y: number;
    };
}
