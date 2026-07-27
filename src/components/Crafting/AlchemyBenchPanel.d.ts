/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 16:13:35
 * Dependents: components/Crafting/index.ts
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/components/Crafting/AlchemyBenchPanel.tsx
 * UI component for the alchemy crafting bench with tabs for Recipe Browser,
 * Experimental Alchemy, and Ingredient Glossary.
 *
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Preservationist] Replaced multiple 'as any' casts
 * with proper type-safe 'CrafterProgression' objects and updated
 * 'handleProgressionUpdate' function signature to improve type safety
 * and maintainability.
 */
import React from 'react';
import './AlchemyBenchPanel.css';
interface AlchemyBenchPanelProps {
    onClose?: () => void;
}
export declare const AlchemyBenchPanel: React.FC<AlchemyBenchPanelProps>;
export default AlchemyBenchPanel;
