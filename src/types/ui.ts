// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 08/06/2026, 19:55:02
 * Dependents: data/adapters/5eTools/index.ts, data/adapters/runtimeMonsterRegistry.ts, hooks/data/useBestiary.ts, hooks/useGameActions.ts, services/geminiServiceFallback.ts, types/index.ts, utils/world/bestiaryEncounterGenerator.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from 'react';
import { CombatCharacter, CharacterStats } from './combat.js';
import { DamageType } from './spells.js';

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
  modernizationStatus?: 'official_2024' | 'modified_legacy';
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
  
  /** 
   * Used for visually rendering premium item stat blocks and adapting
   * glossary items into mechanical engine items.
   */
  itemMetadata?: {
    type?: string;
    cost?: number; // In gp
    weight?: number; // In lb.
    damage?: string;
    properties?: string[];
    ac?: number;
    rarity?: string;
    tier?: string;
    reqAttune?: string;
  };
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
  riverCoords?: Set<string>;
  riverBankCoords?: Set<string>;
  cliffCoords?: Set<string>;
  cliffAdjacencyCoords?: Set<string>;
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

export enum UIToggleAction {
  MAP = 'toggle_map',
  SUBMAP = 'toggle_submap_visibility',
  THREE_D = 'toggle_three_d',
  AUTO_SAVE = 'toggle_auto_save',
  DEV_MENU = 'toggle_dev_menu',
  GEMINI_LOG = 'toggle_gemini_log_viewer',
  DISCOVERY_LOG = 'TOGGLE_DISCOVERY_LOG',
  GLOSSARY = 'TOGGLE_GLOSSARY_VISIBILITY',
  ENCOUNTER_MODAL = 'HIDE_ENCOUNTER_MODAL',
  PARTY_EDITOR = 'toggle_party_editor',
  PARTY_OVERLAY = 'toggle_party_overlay',
  CHARACTER_SHEET = 'CLOSE_CHARACTER_SHEET',
  NPC_TEST = 'TOGGLE_NPC_TEST_MODAL',
  LOGBOOK = 'TOGGLE_LOGBOOK',
  MERCHANT = 'CLOSE_MERCHANT',
  GAME_GUIDE = 'TOGGLE_GAME_GUIDE',
  QUEST_LOG = 'TOGGLE_QUEST_LOG',
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
  /** The HP dice formula from 5eTools (e.g., '3d8', '2d8 + 4'). Preserved for potential future hit dice mechanics. */
  hpFormula?: string;
  abilities: CombatCharacter['abilities'];
  tags: string[];
  /** Armor class (e.g. from Natural Armor, Mage Armor, etc.) */
  armorClass?: number;
  /** Descriptive source of the AC value (e.g. 'Natural Armor', 'Mage Armor'). */
  armorSource?: string;
  resistances?: DamageType[];
  vulnerabilities?: DamageType[];
  immunities?: DamageType[];
  /** Damage types resisted only against nonmagical attacks (e.g. lycanthropes). */
  nonMagicalResistances?: string[];
  /** Damage types immune only against nonmagical attacks. */
  nonMagicalImmunities?: string[];
  /**
   * Status conditions this creature is immune to, extracted directly from the
   * 5eTools `conditionImmune` array (e.g. Zombie: ["exhaustion","poisoned"]).
   * Merged with type-inferred immunities at spawn time.
   */
  conditionImmunities?: string[];
}
