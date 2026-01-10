import React from 'react';
import { CombatCharacter, CharacterStats } from './combat';
import { DamageType } from './spells';

// -----------------------------------------------------------------------------
// UI & Visuals
// -----------------------------------------------------------------------------

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
  characteristics?: { label: string; value: string }[];
  traits?: { name: string; icon: string; description: string }[];
  spellsOfTheMark?: { minLevel: number; spells: string[] }[];
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
  scatterOverride?: Array<{ icon: string; density: number; color?: string; allowedOn?: string[] }>;
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
    wall: { color: string; icon: string | null };
    floor: { color: string; icon: string | null };
  };
}

export interface PathDetails {
  mainPathCoords: Set<string>;
  pathAdjacencyCoords: Set<string>;
}

export interface GlossaryTooltipProps {
  termId: string;
  // TODO(lint-intent): The any on this value hides the intended shape of this data.
  // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
  // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
  children: React.ReactElement<unknown>;
  onNavigateToGlossary?: (termId: string) => void;
}

// Notifications
export type NotificationType = 'success' | 'error' | 'info' | 'warning';

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
