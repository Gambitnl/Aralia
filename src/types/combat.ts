
/**
 * @file src/types/combat.ts
 * This file contains all combat-related TypeScript type definitions and interfaces
 * used throughout the Aralia RPG application's battle map feature.
 */
import type { AbilityScoreName } from './core';
import type { Class, SpellbookData, SpellSlots } from './character';
import type { Item } from './items';
import type { Spell, DamageType, SavingThrowAbility, ConditionName, EffectDuration, SpellEffect } from './spells'; // Import Spell

export type { SpellSlots };

// --- NEW COMBAT SYSTEM TYPES ---

export interface Position {
  x: number;
  y: number;
}

export interface CharacterStats {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  baseInitiative: number;
  speed: number; // in feet
  cr: string;
  size?: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
}

export interface ActionEconomyState {
  action: { used: boolean; remaining: number };
  bonusAction: { used: boolean; remaining: number };
  reaction: { used: boolean; remaining: number };
  movement: { used: number; total: number }; // in feet
  freeActions: number;
}

export type Direction = 'north' | 'south' | 'east' | 'west' | 'northeast' | 'northwest' | 'southeast' | 'southwest';

/** Tracks 5e conditions (prone, restrained, custom, etc.) currently affecting a character. */
export interface ActiveCondition {
  name: ConditionName | string;
  duration: EffectDuration | { type: 'permanent'; value?: number };
  appliedTurn: number;
  source?: string; // Spell or effect that applied the condition
}

export interface CombatCharacter {
  id: string;
  name: string;
  level: number; // For scaling calculations (CR for monsters, Level for PCs)
  creatureTypes?: string[]; // e.g., ['Undead', 'Humanoid']
  alignment?: string; // e.g., 'Chaotic Evil', 'Lawful Good'
  class: Class;
  savingThrowProficiencies?: AbilityScoreName[]; // For characters that have additional saving throw proficiencies (e.g. from feats)
  position: Position;
  stats: CharacterStats;
  abilities: Ability[];
  team: 'player' | 'enemy';
  currentHP: number;
  maxHP: number;
  initiative: number;
  statusEffects: StatusEffect[];
  conditions?: ActiveCondition[];
  facing?: Direction; // For directional abilities
  actionEconomy: ActionEconomyState;
  spellbook?: SpellbookData;
  spellSlots?: SpellSlots;
  concentratingOn?: ConcentrationState;

  // Summoning fields
  isSummon?: boolean;
  summonMetadata?: {
    casterId: string;
    spellId: string;
    durationRemaining?: number;
    dismissable: boolean;
  };

  // Defensive tracking (for DefensiveCommand)
  armorClass?: number;      // Current AC (including bonuses)
  baseAC?: number;          // Base AC before temporary bonuses
  resistances?: DamageType[];
  vulnerabilities?: DamageType[]; // Added for full 5e mechanics support
  immunities?: DamageType[];
  tempHP?: number;          // Temporary hit points
  activeEffects?: ActiveEffect[];  // Active spell effects
  riders?: ActiveRider[];   // Active damage riders (smites, hex, etc)
  damagedThisTurn?: boolean; // Track if character took damage this turn (for concentration/repeat saves)
  savePenaltyRiders?: SavePenaltyRider[]; // Save penalties from Mind Sliver etc.
}

export interface ActiveEffect {
  type: 'ac_bonus' | 'advantage_on_saves' | 'disadvantage_on_attacks' | 'set_base_ac' | 'ac_minimum' | 'other';
  name: string;
  value?: number;  // For numeric effects like AC bonus
  duration: {
    type: 'rounds' | 'until_condition' | 'permanent' | 'minutes' | 'hours' | 'special';
    value?: number;
  };
  appliedTurn: number;
  source: string;  // Spell ID or effect name
  description?: string;
  savingThrows?: SavingThrowAbility[];  // For advantage_on_saves
  attackerFilter?: any; // TargetConditionFilter
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
  size: number; // radius for circle, length for line/cone, side for square
  angle?: number; // for cone abilities
}

export interface StatusEffect {
  id: string;
  name: string;
  type: 'buff' | 'debuff' | 'dot' | 'hot'; // damage/heal over time
  duration: number; // in turns
  effect: {
    type: 'stat_modifier' | 'damage_per_turn' | 'heal_per_turn' | 'skip_turn' | 'condition';
    value?: number;
    stat?: keyof CharacterStats;
  };
  icon?: string;
}

export interface AbilityEffect {
  type: 'damage' | 'heal' | 'status' | 'movement' | 'teleport';
  value?: number;
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
  spell?: Spell; // Reference to the original spell data for AI arbitration
  weapon?: Item; // Reference to the source weapon for proficiency checks
  isProficient?: boolean; // Whether caster is proficient with this ability/weapon
  mastery?: string; // Active weapon mastery property (e.g., 'Topple', 'Sap') if unlocked and proficient
}

export interface TurnState {
  currentTurn: number;
  turnOrder: string[]; // character IDs in initiative order
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
  spellLevel: number; // The slot level used to cast the spell (important for dispelling/countering)
  startedTurn: number; // The combat turn index when concentration began
  effectIds: string[]; // IDs of any active temporary effects (buffs/debuffs) tied to this concentration
  canDropAsFreeAction: boolean; // Whether the player can voluntarily end this (standard D&D rule: yes)
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
  targetEffectId?: string; // ID of the status effect to break free from
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
  effect: SpellEffect; // Changed to SpellEffect to be more generic, though usually DamageEffect
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
  dice?: string;         // e.g. "1d4" - rolled and subtracted from save
  flat?: number;         // e.g. -2 - flat penalty
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
  sourceSpellId: string;       // ID of the spell that created this light
  casterId: string;            // Character ID of the caster
  brightRadius: number;        // Radius of bright light in feet
  dimRadius: number;           // Additional radius of dim light in feet
  attachedTo: "caster" | "target" | "point";
  attachedToCharacterId?: string;  // If attached to caster or target
  position?: Position;         // Fixed position if attachedTo is "point"
  color?: string;              // Optional color tint
  createdTurn: number;         // Turn when this was created
  expiresAtRound?: number;     // Optional expiration (for concentration tracking)
}

// Battle Map Types
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
  id: string; // "x-y"
  coordinates: { x: number; y: number };
  terrain: BattleMapTerrain;
  elevation: number;
  movementCost: number;
  blocksLoS: boolean;
  blocksMovement: boolean;
  decoration: BattleMapDecoration;
  effects: string[]; // IDs of active effects
  providesCover?: boolean;
  environmentalEffects?: EnvironmentalEffect[];
}

export interface BattleMapData {
  dimensions: { width: number; height: number };
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
  activeLightSources: LightSource[];    // Active light sources on the map
  mapData?: BattleMapData;
}

export interface Animation {
  id: string;
  type: 'move' | 'attack' | 'spell_effect' | 'damage_number' | 'status_effect';
  characterId?: string;
  startPosition?: Position;
  endPosition?: Position;
  duration: number;
  startTime: number;
  data?: any; // Animation-specific data
}

export interface DamageNumber {
  id: string;
  value: number;
  position: Position;
  type: 'damage' | 'heal' | 'miss';
  startTime: number;
  duration: number;
}

export interface CombatLogEntry {
  id: string;
  timestamp: number;
  type: 'action' | 'damage' | 'heal' | 'status' | 'turn_start' | 'turn_end';
  message: string;
  characterId?: string;
  targetIds?: string[];
  data?: any;
}

export interface CharacterPosition {
  characterId: string;
  coordinates: { x: number; y: number };
}
