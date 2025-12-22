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
  children: React.ReactElement<any>;
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
