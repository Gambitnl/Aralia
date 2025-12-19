/**
 * @file src/types/visuals.ts
 * Defines contracts for visual assets and representations in the game.
 * Used to standardize how entities (Spells, Items, NPCs, Terrain) are displayed
 * and to provide specifications for AI asset generation.
 */

import { SpellSchool, DamageType } from './spells';
import { Item } from './items';
import { Race } from './character';
import { BattleMapTerrain, BattleMapDecoration } from './combat';

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
 * Defines the visual requirements for an NPC.
 * Includes data for both static display and AI generation.
 */
export interface NPCVisualSpec {
  /** Text description for players (physical appearance). */
  description: string;

  /**
   * Prompt string used for AI image generation.
   * Should include details like race, age, features, style, lighting.
   */
  portraitPrompt?: string;

  /** Path to pre-generated portrait asset. */
  portraitPath?: string;

  /** Key visual features for recognition (e.g., "scar on left cheek", "glowing eyes"). */
  distinguishingFeatures?: string[];

  /**
   * General artistic style if generating new assets.
   * e.g., "oil painting", "pencil sketch", "pixel art"
   */
  style?: string;

  /**
   * Fallback emoji or icon if no portrait is available.
   * e.g., "👮" for a guard, "🧙‍♂️" for a wizard.
   */
  fallbackIcon?: string;

  /**
   * Primary color theme for UI elements (borders, nameplates).
   * Often derived from Faction or Role.
   */
  themeColor?: string;
}

/**
 * Defines the visual requirements for a Battle Map Terrain.
 */
export interface TerrainVisualSpec {
  /** The terrain type this visual applies to. */
  terrain: BattleMapTerrain;

  /** Tailwind CSS class for the background color (e.g., 'bg-green-800'). */
  colorClass: string;

  /** Optional overlay icon or texture character. */
  icon?: string;

  /** Optional border color class. */
  borderClass?: string;
}

/**
 * Defines the visual requirements for a Battle Map Decoration.
 */
export interface DecorationVisualSpec {
  /** The decoration type this visual applies to. */
  decoration: BattleMapDecoration;

  /** The emoji or character to display. */
  icon: string;

  /** Optional Tailwind text color class (e.g., 'text-green-500'). */
  colorClass?: string;

  /** Optional scaling factor (default 1.0). */
  scale?: number;
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
