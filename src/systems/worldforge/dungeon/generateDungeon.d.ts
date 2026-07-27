/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 05:57:29
 * Dependents: components/DesignPreview/steps/PreviewDungeon.tsx, systems/worldforge/dungeon/world/deriveIdentity.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { type DungeonInput, type DungeonPlan } from './types';
/**
 * Generate a full dungeon plan. Deterministic in `input.seed` + params; re-rolls
 * internally (max 5 derived attempts) if the builder places too few rooms or the
 * assembled layout fails the 100% connectivity check, and throws honestly if none
 * succeed (Aralia no-fallback directive).
 */
export declare function generateDungeon(input: DungeonInput): DungeonPlan;
