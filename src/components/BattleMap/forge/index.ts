// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 19:18:29
 * Dependents: components/DesignPreview/steps/PreviewAssetForge.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file index.ts
 * Registry of procedural asset sets for the forge. Each set draws a showcase
 * sheet onto a canvas at a logical size, seeded. Add a new set (dungeon,
 * swamp, …) by writing its `<name>Forge.ts` and appending one entry here.
 */

// ============================================================================
// Showcase Drawers
// ============================================================================
// Each registered set supplies one full-sheet drawer. Keeping discovery here
// lets PreviewAssetForge add tabs without knowing individual biome modules.
// ============================================================================
import { drawCaveSheet } from './caveForge';
import { drawDungeonSheet } from './dungeonForge';

// ============================================================================
// Public Registry Contract
// ============================================================================
// A registry entry pairs display copy and authored canvas dimensions with the
// seeded drawer that paints that set.
// ============================================================================
export interface AssetSet {
  id: string;
  label: string;
  /** One-line description shown on the showcase page. */
  description: string;
  /** Logical canvas size the sheet is authored at. */
  width: number;
  height: number;
  /** Draw the whole showcase sheet, seeded. */
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) => void;
}

// ============================================================================
// Available Asset Sets
// ============================================================================
// Cave remains the original approved set. Dungeon extends the same owned style
// and appears automatically in the design-preview selector.
// ============================================================================
export const ASSET_SETS: AssetSet[] = [
  {
    id: 'cave',
    label: 'Cave',
    description:
      'Ore rocks, crystal-ore nodes, chunky crystal clusters, stalagmites, and glowing mushrooms — one owned stylized language (light upper-left, ink outlines).',
    width: 1480,
    height: 1040,
    draw: drawCaveSheet,
  },
  {
    id: 'dungeon',
    label: 'Dungeon',
    description:
      'Flagstone slabs, fluted pillars, banded doors, wooden crates and chests, and lit braziers — the same owned stylized language (light upper-left, ink outlines).',
    width: 1480,
    height: 1120,
    draw: drawDungeonSheet,
  },
];

// ============================================================================
// Public Drawing API
// ============================================================================
// Consumers may use the registry for discovery or import an individual drawer
// when a battle-map biome is ready to place these props directly.
// ============================================================================
export * from './caveForge';
export * from './dungeonForge';
