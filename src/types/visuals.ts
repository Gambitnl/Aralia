/**
 * @file src/types/visuals.ts
 * Defines contracts for visual assets and representations in the game.
 * Used to standardize how entities (Spells, Items, NPCs, Classes) are displayed
 * and to provide specifications for AI asset generation.
 */

import { SpellSchool, DamageType } from './spells';
import { Race } from './character';
import { FactionType } from './factions';

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
 * Defines the visual requirements for a Faction.
 * Used for UI, map markers, and heraldry generation.
 */
export interface FactionVisualSpec {
  /** Path to the faction's logo or crest image. */
  logoPath?: string;

  /**
   * Text description of the faction's heraldry.
   * Useful for tooltips and AI generation (e.g., "A golden lion on a crimson field").
   */
  heraldryDescription: string;

  /**
   * Primary color for UI themes and territory borders.
   */
  primaryColor: string;

  /**
   * Secondary color for accents.
   */
  secondaryColor: string;

  /**
   * Fallback emoji or icon if no logo is available.
   */
  fallbackIcon: string;

  /**
   * Artistic style for generated assets.
   * e.g., "minimalist", "ornate", "grunge"
   */
  style?: string;
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

/**
 * Standard default visuals for faction types.
 */
export const FACTION_TYPE_DEFAULTS: Record<FactionType, Partial<FactionVisualSpec>> = {
  NOBLE_HOUSE: {
    fallbackIcon: '👑',
    primaryColor: '#7C3AED', // violet-600
    secondaryColor: '#FCD34D', // amber-300
    heraldryDescription: 'A noble crest featuring heraldic beasts.'
  },
  GUILD: {
    fallbackIcon: '⚖️',
    primaryColor: '#2563EB', // blue-600
    secondaryColor: '#9CA3AF', // gray-400
    heraldryDescription: 'A symbol representing the trade or craft.'
  },
  RELIGIOUS_ORDER: {
    fallbackIcon: '☀️',
    primaryColor: '#F59E0B', // amber-500
    secondaryColor: '#FEF3C7', // amber-100
    heraldryDescription: 'A divine symbol radiating light.'
  },
  CRIMINAL_SYNDICATE: {
    fallbackIcon: '🗡️',
    primaryColor: '#1F2937', // gray-800
    secondaryColor: '#DC2626', // red-600
    heraldryDescription: 'A subtle mark hidden in shadows.'
  },
  GOVERNMENT: {
    fallbackIcon: '🏛️',
    primaryColor: '#4B5563', // gray-600
    secondaryColor: '#E5E7EB', // gray-200
    heraldryDescription: 'A formal seal of authority.'
  },
  MILITARY: {
    fallbackIcon: '🛡️',
    primaryColor: '#991B1B', // red-800
    secondaryColor: '#D1D5DB', // gray-300
    heraldryDescription: 'A martial emblem on a shield.'
  },
  SECRET_SOCIETY: {
    fallbackIcon: '👁️',
    primaryColor: '#111827', // gray-900
    secondaryColor: '#4C1D95', // violet-900
    heraldryDescription: 'An esoteric symbol with hidden meaning.'
  }
};

/**
 * Resolves the visual specification for a faction, applying defaults based on type.
 * @param type The faction type.
 * @param customSpec Any custom visual data available.
 */
export function getFactionVisual(type: FactionType, customSpec?: Partial<FactionVisualSpec>): FactionVisualSpec {
  const defaults = FACTION_TYPE_DEFAULTS[type];
  return {
    logoPath: customSpec?.logoPath,
    heraldryDescription: customSpec?.heraldryDescription || defaults.heraldryDescription || 'Unknown heraldry',
    primaryColor: customSpec?.primaryColor || defaults.primaryColor || '#000000',
    secondaryColor: customSpec?.secondaryColor || defaults.secondaryColor || '#FFFFFF',
    fallbackIcon: customSpec?.fallbackIcon || defaults.fallbackIcon || '🏳️',
    style: customSpec?.style || 'standard'
  };
}

// TODO(Materializer): Refactor `CharacterToken.tsx` and `InitiativeTracker.tsx` to use `getClassVisual` instead of hardcoded `getClassIcon` switch statements.
