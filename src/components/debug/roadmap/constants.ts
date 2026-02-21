// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 21/02/2026, 18:13:21
 * Dependents: RoadmapVisualizer.tsx, graph.ts, utils.ts
 * Imports: 1 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { ThemeMode } from './types';

/**
 * Technical:
 * Central constant table for roadmap rendering sizes, spacing, and static UI keys.
 *
 * Layman:
 * This file is the "measurement sheet" for the roadmap screen. It stores fixed numbers
 * like card sizes, spacing, and the browser key used for saving theme preference.
 */

// ============================================================================
// Node Size Constants
// ============================================================================
// Technical: pixel dimensions used by graph layout + renderer.
// Layman: how big root circles and branch cards should be.
// ============================================================================
export const ROOT_SIZE = 144;
export const PROJECT_SIZE = 108;
export const BRANCH_WIDTH = 288;
export const BRANCH_MIN_HEIGHT = 72;
export const BRANCH_MAX_HEIGHT = 216;
export const GRID_SIZE = 36;

// ============================================================================
// Base Anchor Coordinates
// ============================================================================
// Technical: default anchor point for root/trunk origin.
// Layman: where the roadmap starts from before user dragging/zooming.
// ============================================================================
export const TRUNK_X = 1080;
export const ROOT_Y = 72;
export const PROJECT_START_Y = 250;
export const PROJECT_GAP_Y = 198;

// ============================================================================
// Branch Spacing
// ============================================================================
// Technical: horizontal and vertical spacing for branch columns and rows.
// Layman: how far child cards sit from each other on the map.
// ============================================================================
export const BRANCH_BASE_DISTANCE = 432;
export const BRANCH_COL_DISTANCE = 432;
export const BRANCH_ROW_GAP = GRID_SIZE;
export const THEME_STORAGE_KEY = 'aralia_roadmap_theme_v1';

// ============================================================================
// Small UI Helpers
// ============================================================================
// Technical: returns Tailwind class string for status badge based on state/theme.
// Layman: picks the right color style for Done / Active / Planned chips.
// ============================================================================
export const statusPillClass = (status: 'done' | 'active' | 'planned', isDark: boolean) => {
  if (status === 'done') return isDark ? 'border-emerald-400 bg-emerald-950/50 text-emerald-300' : 'border-emerald-500 bg-emerald-50 text-emerald-700';
  if (status === 'active') return isDark ? 'border-amber-400 bg-amber-950/50 text-amber-300' : 'border-amber-500 bg-amber-50 text-amber-700';
  return isDark ? 'border-slate-500 bg-slate-800 text-slate-300' : 'border-slate-400 bg-slate-100 text-slate-600';
};

// Technical: flips between dark/light theme enum values.
// Layman: toggles the roadmap theme button to the next mode.
export const nextThemeMode = (current: ThemeMode): ThemeMode => (current === 'dark' ? 'light' : 'dark');
