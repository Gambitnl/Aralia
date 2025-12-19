/**
 * @file src/types/visuals.ts
 * Defines contracts for visual assets and representations in the game.
 * Used to standardize how entities (Spells, Items, NPCs, Classes) are displayed
 * and to provide specifications for AI asset generation.
 */

import { SpellSchool, DamageType } from './spells';
import { Item } from './items';
import { Race } from './character';

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
 * Defines the visual requirements for a Character Class.
 * Provides standard icons and colors for UI consistency.
 */
export interface ClassVisualSpec {
  /** The ID of the class (e.g., 'fighter', 'wizard'). */
  id: string;

  /** Primary icon for the class (emoji or character). */
  icon: string;

  /** Primary theme color for the class (hex code). */
  color: string;

  /** Description for tooltips or AI generation context. */
  description?: string;
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

// -----------------------------------------------------------------------------
// Registries & Helpers
// -----------------------------------------------------------------------------

/**
 * Registry of standard visuals for character classes.
 * Centralizes the hardcoded switch statements previously found in UI components.
 */
export const CLASS_VISUALS: Record<string, ClassVisualSpec> = {
  fighter: {
    id: 'fighter',
    icon: '⚔️',
    color: '#D97706', // amber-600
    description: 'A master of martial combat.'
  },
  wizard: {
    id: 'wizard',
    icon: '🧙',
    color: '#3B82F6', // blue-500
    description: 'A scholarly magic-user.'
  },
  cleric: {
    id: 'cleric',
    icon: '✝️',
    color: '#E5E7EB', // gray-200
    description: 'A priestly champion who wields divine magic.'
  },
  rogue: {
    id: 'rogue',
    icon: '🗡️',
    color: '#1F2937', // gray-800
    description: 'A scoundrel who uses stealth and trickery.'
  },
  ranger: {
    id: 'ranger',
    icon: '🏹',
    color: '#10B981', // emerald-500
    description: 'A warrior who uses martial prowess and nature magic.'
  },
  paladin: {
    id: 'paladin',
    icon: '🛡️',
    color: '#F59E0B', // amber-500
    description: 'A holy warrior bound to a sacred oath.'
  },
  barbarian: {
    id: 'barbarian',
    icon: '🪓',
    color: '#DC2626', // red-600
    description: 'A fierce warrior of primitive background.'
  },
  bard: {
    id: 'bard',
    icon: '🎻',
    color: '#EC4899', // pink-500
    description: 'An inspiring magician whose power echoes the music of creation.'
  },
  druid: {
    id: 'druid',
    icon: '🌿',
    color: '#059669', // emerald-600
    description: 'A priest of the Old Faith, wielding the powers of nature.'
  },
  monk: {
    id: 'monk',
    icon: '🧘',
    color: '#60A5FA', // blue-400
    description: 'A master of martial arts, harnessing the power of the body.'
  },
  sorcerer: {
    id: 'sorcerer',
    icon: '🔮',
    color: '#8B5CF6', // violet-500
    description: 'A spellcaster who draws on inherent magic from a gift or bloodline.'
  },
  warlock: {
    id: 'warlock',
    icon: '👁️',
    color: '#7C3AED', // violet-600
    description: 'A wielder of magic that is derived from a bargain with an extraplanar entity.'
  },
  artificer: {
    id: 'artificer',
    icon: '🔧',
    color: '#F472B6', // pink-400
    description: 'A master of unlocking magic in everyday objects.'
  }
};

/**
 * Default fallback visual for unknown classes.
 */
export const DEFAULT_CLASS_VISUAL: ClassVisualSpec = {
  id: 'unknown',
  icon: '●',
  color: '#6B7280', // gray-500
  description: 'Unknown class.'
};

/**
 * Retrieves the visual specification for a given class ID.
 * Returns a default spec if the class ID is not found.
 *
 * @param classId - The ID of the class (case-insensitive).
 * @returns The ClassVisualSpec for the class.
 */
export function getClassVisual(classId: string): ClassVisualSpec {
  if (!classId) return DEFAULT_CLASS_VISUAL;
  return CLASS_VISUALS[classId.toLowerCase()] || DEFAULT_CLASS_VISUAL;
}

// TODO(Materializer): Refactor `CharacterToken.tsx` and `InitiativeTracker.tsx` to use `getClassVisual` instead of hardcoded `getClassIcon` switch statements.
