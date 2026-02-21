// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 20/02/2026, 01:51:21
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

export const ROOT_SIZE = 144;
export const PROJECT_SIZE = 108;
export const BRANCH_WIDTH = 288;
export const BRANCH_MIN_HEIGHT = 72;
export const BRANCH_MAX_HEIGHT = 216;
export const GRID_SIZE = 36;

export const TRUNK_X = 1080;
export const ROOT_Y = 72;
export const PROJECT_START_Y = 250;
export const PROJECT_GAP_Y = 198;

export const BRANCH_BASE_DISTANCE = 432;
export const BRANCH_COL_DISTANCE = 432;
export const BRANCH_ROW_GAP = GRID_SIZE;
export const THEME_STORAGE_KEY = 'aralia_roadmap_theme_v1';

export const statusPillClass = (status: 'done' | 'active' | 'planned', isDark: boolean) => {
  if (status === 'done') return isDark ? 'border-emerald-400 bg-emerald-950/50 text-emerald-300' : 'border-emerald-500 bg-emerald-50 text-emerald-700';
  if (status === 'active') return isDark ? 'border-amber-400 bg-amber-950/50 text-amber-300' : 'border-amber-500 bg-amber-50 text-amber-700';
  return isDark ? 'border-slate-500 bg-slate-800 text-slate-300' : 'border-slate-400 bg-slate-100 text-slate-600';
};

export const nextThemeMode = (current: ThemeMode): ThemeMode => (current === 'dark' ? 'light' : 'dark');
