// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 08:14:57
 * Dependents: types/spells.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file defines AI arbitration metadata for spells.
 *
 * Most spells are purely mechanical, but some canonical effects intentionally
 * leave room for judgment or player-authored intent. These types keep that
 * runtime handoff explicit without making the main spell contract absorb the
 * arbitration policy details.
 *
 * Called by: `spells.ts`.
 * Depends on: no runtime data; this is a type-only metadata module.
 */

/** Determines how ambiguous or complex spell effects are resolved. */
export type ArbitrationType = "mechanical" | "ai_assisted" | "ai_dm";

/** Provides the prompt and player-input requirement for AI-assisted spell handling. */
export interface AIContext {
  /** Prompt fragment or instruction passed to the AI model for this spell. */
  prompt: string;
  /** Whether the AI arbitrator needs fresh player input before resolving the spell. */
  playerInputRequired: boolean;
}
