
/**
 * @file src/types/combat.ts
 * This file contains all combat-related TypeScript type definitions and interfaces
 * used throughout the Aralia RPG application's battle map feature.
 */
import { Class, SpellbookData, SpellSlots } from './index';

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
}

export interface ActionEconomyState {
  action: { used: boolean; remaining: number };
  bonusAction: { used: boolean; remaining: number };
  reaction: { used: boolean; remaining: number };
  movement: { used: number; total: number }; // in feet
  freeActions: number; 
}

export type Direction = 'north' | 'south' | 'east' | 'west' | 'northeast' | 'northwest' | 'southeast' | 'southwest';

export interface CombatCharacter {
  id: string;
  name: string;
  class: Class;
  position: Position;
  stats: CharacterStats;
  abilities: Ability[];
  team: 'player' | 'enemy';
  currentHP: number;
  maxHP: number;
  initiative: number;
  statusEffects: StatusEffect[];
  facing?: Direction; // For directional abilities
  actionEconomy: ActionEconomyState;
  spellbook?: SpellbookData;
  spellSlots?: SpellSlots;
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
    type: 'stat_modifier' | 'damage_per_turn' | 'heal_per_turn' | 'skip_turn';
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
  areaOfEffect?: AreaOfEffect;
  effects: AbilityEffect[];
  cooldown?: number;
  currentCooldown?: number;
  icon?: string;
}

export interface TurnState {
  currentTurn: number;
  turnOrder: string[]; // character IDs in initiative order
  currentCharacterId: string | null;
  phase: 'planning' | 'action' | 'resolution' | 'end_turn';
  actionsThisTurn: CombatAction[];
}

export interface CombatAction {
  id: string;
  characterId: string;
  type: 'move' | 'ability' | 'end_turn';
  abilityId?: string;
  targetPosition?: Position;
  targetCharacterIds?: string[];
  movementUsed?: number;
  cost: AbilityCost;
  timestamp: number;
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


// Battle Map Types
export type BattleMapTerrain = 'grass' | 'rock' | 'water' | 'difficult' | 'wall' | 'floor' | 'sand' | 'mud';
export type BattleMapDecoration = 'tree' | 'boulder' | 'stalagmite' | 'pillar' | 'cactus' | 'mangrove' | null;

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
  environmentalEffect?: {
    type: 'fire' | 'ice' | 'poison' | 'difficult_terrain';
    duration: number;
    effect: StatusEffect;
  };
}

export interface BattleMapData {
  dimensions: { width: number; height: number };
  tiles: Map<string, BattleMapTile>;
  theme: 'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp';
  seed: number;
}

export interface CharacterPosition {
    characterId: string;
    coordinates: { x: number; y: number };
}
