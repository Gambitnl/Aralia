/**
 * @file src/types/visuals.ts
 * Defines contracts for visual assets and representations in the game.
 * Used to standardize how entities (Spells, Items, NPCs, Classes, Status Effects) are displayed
 * and to provide specifications for AI asset generation.
 */
import { SpellSchool, DamageType } from './spells';
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
        size: 'small' | 'medium' | 'large' | 'massive';
        color: string;
        sound?: string;
        duration: number;
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
    /** Primary icon for the race (emoji or character). */
    icon?: string;
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
/**
 * Registry of standard visuals for character classes.
 * Centralizes the hardcoded switch statements previously found in UI components.
 */
export declare const CLASS_VISUALS: Record<string, ClassVisualSpec>;
/**
 * Default fallback visual for unknown classes.
 */
export declare const DEFAULT_CLASS_VISUAL: ClassVisualSpec;
/**
 * Retrieves the visual specification for a given class ID.
 * Returns a default spec if the class ID is not found.
 *
 * @param classId - The ID of the class (case-insensitive).
 * @returns The ClassVisualSpec for the class.
 */
export declare function getClassVisual(classId: string): ClassVisualSpec;
/**
 * Registry of standard visuals for status conditions.
 * Replaces the simple string map in `src/config/statusIcons.ts`.
 */
export declare const STATUS_VISUALS: Record<string, StatusVisualSpec>;
/**
 * Default visual for unknown conditions.
 */
export declare const DEFAULT_STATUS_VISUAL: StatusVisualSpec;
/**
 * Retrieves the visual specification for a given status condition ID.
 *
 * @param conditionId - The ID of the condition (case-insensitive).
 * @returns The StatusVisualSpec for the condition.
 */
export declare function getStatusVisual(conditionId: string): StatusVisualSpec;
/**
 * Standard default visuals for faction types.
 */
export declare const FACTION_TYPE_DEFAULTS: Record<FactionType, Partial<FactionVisualSpec>>;
/**
 * Resolves the visual specification for a faction, applying defaults based on type.
 * @param type The faction type.
 * @param customSpec Any custom visual data available.
 */
export declare function getFactionVisual(type: FactionType, customSpec?: Partial<FactionVisualSpec>): FactionVisualSpec;
/**
 * Registry of standard visuals for terrain types.
 */
export declare const TERRAIN_VISUALS: Record<BattleMapTerrain, TerrainVisualSpec>;
/**
 * Registry of standard visuals for decorations.
 */
export declare const DECORATION_VISUALS: Record<string, DecorationVisualSpec>;
/**
 * Default visual for unknown terrain.
 */
export declare const DEFAULT_TERRAIN_VISUAL: TerrainVisualSpec;
/**
 * Default visual for unknown decorations.
 */
export declare const DEFAULT_DECORATION_VISUAL: DecorationVisualSpec;
/**
 * Retrieves the visual specification for a given terrain ID.
 * @param terrainId The ID of the terrain.
 */
export declare function getTerrainVisual(terrainId: BattleMapTerrain): TerrainVisualSpec;
/**
 * Retrieves the visual specification for a given decoration ID.
 * @param decorationId The ID of the decoration.
 */
export declare function getDecorationVisual(decorationId: BattleMapDecoration): DecorationVisualSpec;
