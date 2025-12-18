/**
 * @file src/types/visuals.ts
 * Defines contracts for visual assets and representations in the game.
 * Used to standardize how entities (Spells, Items, NPCs) are displayed
 * and to provide specifications for AI asset generation.
 */

import { SpellSchool, DamageType } from './spells';
import { Item } from './items';
import { Position } from './combat';

/**
 * Standard sizes for icons in the UI.
 */
export type IconSize = 'small' | 'medium' | 'large' | 'xl';

/**
 * Defines the visual requirements for a Spell icon.
 * Used by UI components to render spells and by generation systems to create new assets.
 */
export interface SpellIconSpec {
  /** The primary school of magic, determining the base color palette. */
  school: SpellSchool;

  /** Spell level (0-9). Higher levels may require more complex or ornate visuals. */
  level: number;

  /** The primary damage type, if any. Can override school colors (e.g., Fireball is Evocation but Red/Fire). */
  damageType?: DamageType;

  /**
   * Specific path to a static asset (e.g., /assets/icons/spells/fireball.png).
   * If provided, this takes precedence over generation/fallbacks.
   */
  iconPath?: string;

  /**
   * Fallback character or emoji if no image is available.
   * e.g., "🔥" for Fireball.
   */
  fallbackIcon?: string;

  /**
   * Base color hex code derived from school or damage type.
   * Useful for borders, backgrounds, or particle effects.
   */
  baseColor?: string;
}

/**
 * Defines the visual requirements for an Item.
 */
export interface ItemVisualSpec {
  /** Path to the item's icon image. */
  iconPath?: string;

  /** Fallback emoji or character. */
  fallbackIcon?: string;

  /**
   * Rarity determines border colors and visual effects.
   * (Mapping to common RPG rarities: Common, Uncommon, Rare, Epic, Legendary)
   */
  rarity?: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary';
}

/**
 * Result of resolving a visual request.
 * Contains everything a UI component needs to render the entity.
 */
export interface VisualAsset {
  /** The source URL or data URI for the image. */
  src?: string;

  /** The text content (emoji/char) if src is missing. */
  fallbackContent: string;

  /** CSS color string for borders/glows. */
  primaryColor: string;

  /** CSS color string for secondary accents. */
  secondaryColor?: string;

  /** accessible label for screen readers */
  label: string;
}

// --- Animation Types ---

/**
 * Base properties shared by all combat animations.
 */
interface BaseAnimation {
  id: string;
  /** Duration of the animation in milliseconds */
  duration: number;
  /** Timestamp when the animation was created/started */
  startTime: number;
}

/**
 * Animation representing a character moving between tiles.
 * (Note: Often handled by interpolation, but can be explicit)
 */
export interface MoveAnimation extends BaseAnimation {
  type: 'move';
  characterId: string;
  startPosition: Position;
  endPosition: Position;
  data?: never; // No extra data needed
}

/**
 * Animation for a physical attack (weapon swing, arrow flight).
 */
export interface AttackAnimation extends BaseAnimation {
  type: 'attack';
  attackerId: string;
  targetId?: string; // Optional if targeting a position/empty space
  startPosition?: Position;
  endPosition?: Position;
  data?: never;
}

/**
 * Animation for a spell effect (projectiles, explosions, rays).
 */
export interface SpellEffectAnimation extends BaseAnimation {
  type: 'spell_effect';
  characterId?: string; // Caster ID
  startPosition?: Position;
  endPosition?: Position;
  /**
   * Specific data required to render spell effects.
   * Replaces the untyped `any` field.
   */
  data: {
    /** Multiple target positions for AoE or multi-target spells */
    targetPositions?: Position[];
    /** Single target position if simpler */
    targetPosition?: Position;
    /** Color override for the effect */
    color?: string;
  };
}

/**
 * Animation for floating numbers (damage, heal, miss).
 */
export interface DamageNumberAnimation extends BaseAnimation {
  type: 'damage_number';
  value: number;
  position: Position;
  damageType: 'damage' | 'heal' | 'miss';
  data?: never;
}

/**
 * Animation for status effect icons popping up or applying.
 */
export interface StatusEffectAnimation extends BaseAnimation {
  type: 'status_effect';
  characterId: string;
  effectId: string;
  data?: never;
}

/**
 * Discriminated union of all possible combat animations.
 * Used by the renderer to determine how to draw the event.
 */
export type CombatAnimation =
  | MoveAnimation
  | AttackAnimation
  | SpellEffectAnimation
  | DamageNumberAnimation
  | StatusEffectAnimation;
