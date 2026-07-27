/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 14:31:44
 * Dependents: components/Crafting/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/components/Crafting/GatheringPanel.tsx
 * UI component for the herbalism gathering system.
 * Allows players to identify and harvest ingredients from the current biome.
 */
import React from 'react';
import './GatheringPanel.css';
interface GatheringPanelProps {
    onClose?: () => void;
}
export declare const GatheringPanel: React.FC<GatheringPanelProps>;
export default GatheringPanel;
