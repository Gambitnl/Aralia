/**
 * @file src/types/visuals.ts
 * Defines contracts for visual assets and representations in the game.
 * Used to standardize how entities (Spells, Items, NPCs) are displayed
 * and to provide specifications for AI asset generation.
 */

import { SpellSchool, DamageType } from './spells';
import { Item } from './items';

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
