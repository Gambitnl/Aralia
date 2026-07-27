/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/05/2026, 15:10:43
 * Dependents: components/CharacterSheet/Overview/InventoryList.tsx, utils/visualUtils.ts, utils/visuals/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/visualUtils.ts
 * Utility functions for resolving visual assets for game entities.
 * Implements the "Pipeline" part of the Asset Requirement Standards.
 */
import { NPC, Race, Item } from '../../types';
import { NPCVisualSpec, VisualAsset } from '../../types/visuals';
/**
 * Resolves the visual representation for an NPC, handling fallbacks.
 *
 * @param npc - The NPC entity
 * @param visualSpec - Optional specific visual spec (if attached to NPC or separate)
 * @param race - Optional race data for additional context
 * @returns A fully resolved VisualAsset ready for UI rendering
 */
export declare function resolveNPCVisual(npc: NPC, visualSpec?: NPCVisualSpec, _race?: Race): VisualAsset;
/**
 * Resolves the visual representation for an Item, handling legacy icons and fallbacks.
 *
 * @param item - The item entity
 * @returns A fully resolved VisualAsset ready for UI rendering
 */
export declare function resolveItemVisual(item: Item): VisualAsset;
