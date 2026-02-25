import React from 'react';
import { CombatCharacter, CharacterStats } from './combat';
import { DamageType } from './spells';
export interface GlossaryDisplayItem {
    icon: string;
    meaning: string;
    category?: string;
}
export interface GlossaryEntry {
    id: string;
    title: string;
    category: string;
    tags?: string[];
    excerpt?: string;
    aliases?: string[];
    seeAlso?: string[];
    filePath?: string | null;
    subEntries?: GlossaryEntry[];
    /**
     * Data-First Architecture Fields
     * These fields support structured glossary entries (especially for races)
     * that can be rendered without relying on markdown files.
     */
    entryLore?: string;
    /** @deprecated Use maleImageUrl/femaleImageUrl instead for race entries. Single image fallback for legacy entries. */
    imageUrl?: string;
    /**
     * Path to male character illustration for race entries.
     * Used by GlossaryEntryTemplate to render clickable dual-image gallery.
     * Example: "/assets/images/races/dwarf_male.png"
     */
    maleImageUrl?: string;
    /**
     * Path to female character illustration for race entries.
     * Used by GlossaryEntryTemplate to render clickable dual-image gallery.
     * Example: "/assets/images/races/dwarf_female.png"
     */
    femaleImageUrl?: string;
    source?: string;
    characteristics?: {
        label: string;
        value: string;
    }[];
    traits?: {
        name: string;
        icon: string;
        description: string;
    }[];
    spellsOfTheMark?: {
        minLevel: number;
        spells: string[];
    }[];
}
export interface SeededFeatureConfig {
    id: string;
    name?: string;
    icon: string;
    color: string;
    sizeRange: [number, number];
    numSeedsRange: [number, number];
    adjacency?: {
        icon?: string;
        color?: string;
    };
    zOffset?: number;
    scatterOverride?: Array<{
        icon: string;
        density: number;
        color?: string;
        allowedOn?: string[];
    }>;
    generatesEffectiveTerrainType?: string;
    shapeType?: 'circular' | 'rectangular';
}
export interface MicroFeatureVisual {
    icon: string;
    color?: string;
    density: number;
    allowedOn?: string[];
}
export interface BiomeVisuals {
    baseColors: string[];
    pathColor: string;
    pathIcon?: string;
    pathAdjacency?: {
        color?: string;
        scatter?: MicroFeatureVisual[];
    };
    seededFeatures?: SeededFeatureConfig[];
    scatterFeatures: MicroFeatureVisual[];
    caTileVisuals?: {
        wall: {
            color: string;
            icon: string | null;
        };
        floor: {
            color: string;
            icon: string | null;
        };
    };
}
export interface PathDetails {
    mainPathCoords: Set<string>;
    pathAdjacencyCoords: Set<string>;
    riverCoords?: Set<string>;
    riverBankCoords?: Set<string>;
    cliffCoords?: Set<string>;
    cliffAdjacencyCoords?: Set<string>;
}
export interface GlossaryTooltipProps {
    termId: string;
    children: React.ReactElement<unknown>;
    onNavigateToGlossary?: (termId: string) => void;
}
export type NotificationType = 'success' | 'error' | 'info' | 'warning';
export declare enum UIToggleAction {
    MAP = "toggle_map",
    SUBMAP = "toggle_submap_visibility",
    THREE_D = "toggle_three_d",
    AUTO_SAVE = "toggle_auto_save",
    DEV_MENU = "toggle_dev_menu",
    GEMINI_LOG = "toggle_gemini_log_viewer",
    DISCOVERY_LOG = "TOGGLE_DISCOVERY_LOG",
    GLOSSARY = "TOGGLE_GLOSSARY_VISIBILITY",
    ENCOUNTER_MODAL = "HIDE_ENCOUNTER_MODAL",
    PARTY_EDITOR = "toggle_party_editor",
    PARTY_OVERLAY = "toggle_party_overlay",
    CHARACTER_SHEET = "CLOSE_CHARACTER_SHEET",
    NPC_TEST = "TOGGLE_NPC_TEST_MODAL",
    LOGBOOK = "TOGGLE_LOGBOOK",
    MERCHANT = "CLOSE_MERCHANT",
    GAME_GUIDE = "TOGGLE_GAME_GUIDE",
    QUEST_LOG = "TOGGLE_QUEST_LOG"
}
export interface Notification {
    id: string;
    message: string;
    type: NotificationType;
    duration?: number;
}
export interface MonsterData {
    id: string;
    name: string;
    baseStats: CharacterStats;
    maxHP: number;
    abilities: CombatCharacter['abilities'];
    tags: string[];
    resistances?: DamageType[];
    vulnerabilities?: DamageType[];
    immunities?: DamageType[];
}
