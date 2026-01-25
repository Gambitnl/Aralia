/**
 * @file src/types/visuals.ts
 * Defines contracts for visual assets and representations in the game.
 * Used to standardize how entities (Spells, Items, NPCs, Classes, Status Effects) are displayed
 * and to provide specifications for AI asset generation.
 */

import { SpellSchool, DamageType } from './spells';
// TODO(lint-intent): 'Race' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { Race as _Race } from './character';
import { FactionType } from './factions';
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
 * Defines the visual effect of casting a spell or using an ability.
 * Supports particle systems, projectiles, and impact effects.
 */
export interface SpellEffectVisualSpec {
  /**
   * The animation triggered on the caster during preparation/casting.
   * e.g., "glow_hands", "rune_circle_ground", "energy_gather"
   */
  castingAnimation?: 'none' | 'glow_hands' | 'raise_arms' | 'channel_sky' | 'push_forward' | 'stomp' | 'shout';

  /**
   * The visual form of the spell travel.
   */
  projectile?: {
    type: 'arrow' | 'bolt' | 'beam' | 'orb' | 'lobbed_projectile' | 'instant_line' | 'cone_wave';
    speed: 'slow' | 'medium' | 'fast' | 'instant';
    color: string;
    /** Trail effect behind the projectile */
    trailEffect?: 'smoke' | 'sparkle' | 'glow' | 'fire' | 'ice';
  };

  /**
   * The visual effect at the target location or impact point.
   */
  impact?: {
    type: 'explosion' | 'shatter' | 'splash' | 'flash' | 'implosion' | 'rising_pillar' | 'ground_crack';
    size: 'small' | 'medium' | 'large' | 'massive'; // Relative to grid
    color: string;
    sound?: string; // ID of the sound asset
    duration: number; // Duration of the lingering effect in ms
  };

  /**
   * For Area of Effect spells, how the area is visualized.
   */
  area?: {
    /** How the tiles are highlighted */
    style: 'outline' | 'solid_fill' | 'grid_pattern' | 'pulsing';
    /** Color of the area highlight (often translucent) */
    color: string;
    /** Border color of the area */
    borderColor: string;
    /** Texture/pattern overlay (e.g., "web", "ice", "fire_ground") */
    texture?: string;
  };
}

/**
 * Composite visual specification for a Spell.
 * Combines static icon data with dynamic effect data.
 */
export interface SpellVisualSpec {
  /** Static icon representation for UI. */
  icon: SpellIconSpec;

  /** Dynamic visual effects for casting/impact. */
  animation?: SpellEffectVisualSpec;
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
 * Defines the visual requirements for a Playable Race.
 * Standardizes illustrations, icons, and AI generation data.
 */
export interface RaceVisualSpec {
  /** Unique ID for the race visual (usually matches race ID). */
  id: string;

  /** Theme color (hex code). */
  color: string;

  /** Path to the main illustration (formerly imageUrl). */
  illustrationPath?: string;

  /** Path to male character illustration for race selection. */
  maleIllustrationPath?: string;

  /** Path to female character illustration for race selection. */
  femaleIllustrationPath?: string;

  /** Path to a top-down token for map representation. */
  tokenPath?: string;

  /** Description for AI generation contexts. */
  description?: string;
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
 * Defines the visual requirements for a Status Condition.
 * Standardizes icons, colors, and descriptions for buffs, debuffs, and conditions.
 */
export interface StatusVisualSpec {
  /** Unique ID for the condition (e.g., 'blinded', 'charmed'). */
  id: string;

  /** Human-readable label for tooltips and logs. */
  label: string;

  /** Primary icon (emoji or character). */
  icon: string;

  /**
   * Theme color (hex code).
   * Used for badge backgrounds, borders, or text highlights.
   */
  color: string;

  /** Short description of the mechanical effect or flavor. */
  description: string;
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
 * Defines the visual requirements for Battle Map Terrain.
 * Used by the map renderer to display tiles.
 */
export interface TerrainVisualSpec {
  /** The terrain ID matching BattleMapTerrain types. */
  id: BattleMapTerrain;

  /** Hex color for simple rendering or minimaps. */
  color: string;

  /** Path to the primary texture asset. */
  texturePath?: string;

  /** Fallback ASCII/Emoji symbol for text-based or low-res display. */
  symbol: string;

  /** Optional array of texture variant paths to break repetition. */
  variants?: string[];

  /** How edges should be handled (e.g., blending). */
  edgeHandling?: 'smooth' | 'hard' | 'border';
}

/**
 * Defines the visual requirements for Battle Map Decorations.
 * Used by the map renderer to display objects like trees and rocks.
 */
export interface DecorationVisualSpec {
  /** The decoration ID matching BattleMapDecoration types. */
  id: BattleMapDecoration;

  /** Path to the sprite or model asset. */
  modelPath?: string;

  /** Fallback emoji or icon. */
  icon: string;

  /** Visual scale multiplier (default 1.0). */
  scale?: number;

  /** Base tint color. */
  color?: string;
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
 * Registry of standard visuals for status conditions.
 * Replaces the simple string map in `src/config/statusIcons.ts`.
 */
export const STATUS_VISUALS: Record<string, StatusVisualSpec> = {
  blinded: { id: 'blinded', label: 'Blinded', icon: '👁️', color: '#9CA3AF', description: 'Can’t see and automatically fails any ability check that requires sight.' }, // gray-400
  charmed: { id: 'charmed', label: 'Charmed', icon: '💕', color: '#EC4899', description: 'Can’t attack the charmer or target the charmer with harmful abilities or magical effects.' }, // pink-500
  deafened: { id: 'deafened', label: 'Deafened', icon: '🙉', color: '#9CA3AF', description: 'Can’t hear and automatically fails any ability check that requires hearing.' }, // gray-400
  frightened: { id: 'frightened', label: 'Frightened', icon: '😱', color: '#F59E0B', description: 'Has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight.' }, // amber-500
  grappled: { id: 'grappled', label: 'Grappled', icon: '✊', color: '#D97706', description: 'Speed becomes 0, and it can’t benefit from any bonus to its speed.' }, // amber-600
  incapacitated: { id: 'incapacitated', label: 'Incapacitated', icon: '🤕', color: '#DC2626', description: 'Can’t take actions or reactions.' }, // red-600
  invisible: { id: 'invisible', label: 'Invisible', icon: '👻', color: '#E5E7EB', description: 'Impossible to see without the aid of magic or a special sense.' }, // gray-200
  paralyzed: { id: 'paralyzed', label: 'Paralyzed', icon: '⚡', color: '#FBBF24', description: 'Incapacitated and can’t move or speak. Attacks against the creature have advantage.' }, // amber-400
  petrified: { id: 'petrified', label: 'Petrified', icon: '🗿', color: '#4B5563', description: 'Transformed into a solid inanimate substance (usually stone).' }, // gray-600
  poisoned: { id: 'poisoned', label: 'Poisoned', icon: '🤢', color: '#10B981', description: 'Has disadvantage on attack rolls and ability checks.' }, // emerald-500
  prone: { id: 'prone', label: 'Prone', icon: '🛌', color: '#6B7280', description: 'Only movement option is to crawl. Attack rolls have disadvantage.' }, // gray-500
  restrained: { id: 'restrained', label: 'Restrained', icon: '⛓️', color: '#B91C1C', description: 'Speed becomes 0. Attack rolls against the creature have advantage, and the creature’s attack rolls have disadvantage.' }, // red-700
  stunned: { id: 'stunned', label: 'Stunned', icon: '💫', color: '#FCD34D', description: 'Incapacitated, can’t move, and can speak only falteringly.' }, // amber-300
  unconscious: { id: 'unconscious', label: 'Unconscious', icon: '💤', color: '#1F2937', description: 'Incapacitated, can’t move or speak, and is unaware of its surroundings.' }, // gray-800
  exhaustion: { id: 'exhaustion', label: 'Exhaustion', icon: '😫', color: '#7C2D12', description: 'Effects vary by level of exhaustion.' }, // orange-900
  ignited: { id: 'ignited', label: 'Ignited', icon: '🔥', color: '#EF4444', description: 'Taking fire damage over time.' }, // red-500
  taunted: { id: 'taunted', label: 'Taunted', icon: '🤬', color: '#7F1D1D', description: 'Must attack the taunter.' }, // red-900
  blessed: { id: 'blessed', label: 'Blessed', icon: '✨', color: '#FBBF24', description: 'Adds 1d4 to attack rolls and saving throws.' }, // amber-400
  bane: { id: 'bane', label: 'Bane', icon: '📉', color: '#4C1D95', description: 'Subtracts 1d4 from attack rolls and saving throws.' } // violet-900
};

/**
 * Default visual for unknown conditions.
 */
export const DEFAULT_STATUS_VISUAL: StatusVisualSpec = {
  id: 'unknown',
  label: 'Effect',
  icon: '💀',
  color: '#9CA3AF',
  description: 'Unknown status effect.'
};

/**
 * Retrieves the visual specification for a given status condition ID.
 *
 * @param conditionId - The ID of the condition (case-insensitive).
 * @returns The StatusVisualSpec for the condition.
 */
export function getStatusVisual(conditionId: string): StatusVisualSpec {
  if (!conditionId) return DEFAULT_STATUS_VISUAL;

  // Normalize key: keys in registry are lowercase.
  const normalizedId = conditionId.toLowerCase();

  // Handle the 'baned' to 'bane' mapping for legacy compatibility if needed,
  // though typically we should rely on the correct ID.
  // The registry now has 'bane'.

  return STATUS_VISUALS[normalizedId] || DEFAULT_STATUS_VISUAL;
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

/**
 * Registry of standard visuals for terrain types.
 */
export const TERRAIN_VISUALS: Record<BattleMapTerrain, TerrainVisualSpec> = {
  grass: { id: 'grass', color: '#10B981', symbol: '🌱', edgeHandling: 'smooth' }, // emerald-500
  rock: { id: 'rock', color: '#6B7280', symbol: '🪨', edgeHandling: 'hard' }, // gray-500
  water: { id: 'water', color: '#3B82F6', symbol: '💧', edgeHandling: 'smooth' }, // blue-500
  difficult: { id: 'difficult', color: '#D97706', symbol: '⚠️', edgeHandling: 'border' }, // amber-600
  wall: { id: 'wall', color: '#1F2937', symbol: '🧱', edgeHandling: 'hard' }, // gray-800
  floor: { id: 'floor', color: '#D1D5DB', symbol: '⬜', edgeHandling: 'hard' }, // gray-300
  sand: { id: 'sand', color: '#FCD34D', symbol: '🏜️', edgeHandling: 'smooth' }, // amber-300
  mud: { id: 'mud', color: '#78350F', symbol: '💩', edgeHandling: 'smooth' }, // amber-900
};

/**
 * Registry of standard visuals for decorations.
 */
export const DECORATION_VISUALS: Record<string, DecorationVisualSpec> = {
  tree: { id: 'tree', icon: '🌲', color: '#065F46', scale: 1.5 }, // emerald-800
  boulder: { id: 'boulder', icon: '🪨', color: '#4B5563', scale: 1.0 }, // gray-600
  stalagmite: { id: 'stalagmite', icon: '🏔️', color: '#374151', scale: 0.8 }, // gray-700
  pillar: { id: 'pillar', icon: '🏛️', color: '#9CA3AF', scale: 1.2 }, // gray-400
  cactus: { id: 'cactus', icon: '🌵', color: '#047857', scale: 1.0 }, // emerald-700
  mangrove: { id: 'mangrove', icon: '🌳', color: '#064E3B', scale: 1.3 }, // emerald-900
};

/**
 * Default visual for unknown terrain.
 */
export const DEFAULT_TERRAIN_VISUAL: TerrainVisualSpec = {
  id: 'floor',
  color: '#D1D5DB',
  symbol: '⬜',
  edgeHandling: 'hard'
};

/**
 * Default visual for unknown decorations.
 */
export const DEFAULT_DECORATION_VISUAL: DecorationVisualSpec = {
  id: 'boulder', // Fallback to a generic obstacle
  icon: '❓',
  color: '#9CA3AF'
};

/**
 * Retrieves the visual specification for a given terrain ID.
 * @param terrainId The ID of the terrain.
 */
export function getTerrainVisual(terrainId: BattleMapTerrain): TerrainVisualSpec {
  return TERRAIN_VISUALS[terrainId] || DEFAULT_TERRAIN_VISUAL;
}

/**
 * Retrieves the visual specification for a given decoration ID.
 * @param decorationId The ID of the decoration.
 */
export function getDecorationVisual(decorationId: BattleMapDecoration): DecorationVisualSpec {
  if (!decorationId) return DEFAULT_DECORATION_VISUAL;
  return DECORATION_VISUALS[decorationId] || DEFAULT_DECORATION_VISUAL;
}

// TODO(Materializer): Refactor `BattleMapTile` component to use `getTerrainVisual` and `getDecorationVisual` for consistent rendering across the app.
// TODO(Illusionist): Implement a `SpellVisualRenderer` component that uses `SpellEffectVisualSpec` to render particles and animations.
