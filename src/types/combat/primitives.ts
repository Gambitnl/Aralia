/**
 * @file combat/primitives.ts
 * Coordinates, lighting vocabulary and independent action-economy flags.
 *
 * Declarations moved unchanged from combat.ts. That file remains the public
 * compatibility entry; direct type imports here make ownership explicit.
 * Reciprocal type references are erased at runtime, not new state owners.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 24/10/2026, 21:16:06
 * Dependents: None (Orphan)
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// --- NEW COMBAT SYSTEM TYPES ---

export interface Position {
  x: number;
  y: number;
}


export type LightLevel = "bright" | "dim" | "darkness" | "magical_darkness";


export interface ActionEconomyState {
  action: { used: boolean; remaining: number };
  bonusAction: { used: boolean; remaining: number };
  reaction: { used: boolean; remaining: number };
  legendary: { used: number; total: number }; // Tracks legendary actions per round
  movement: { used: number; total: number }; // in feet
  freeActions: number;
}


export type Direction =
  | "north"
  | "south"
  | "east"
  | "west"
  | "northeast"
  | "northwest"
  | "southeast"
  | "southwest";
