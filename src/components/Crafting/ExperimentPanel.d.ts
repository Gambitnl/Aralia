/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 14:52:38
 * Dependents: components/Crafting/AlchemyBenchPanel.tsx, components/Crafting/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/components/Crafting/ExperimentPanel.tsx
 * UI for experimental alchemy - mix random ingredients to discover recipes.
 */
import React from 'react';
import { CrafterProgression } from '../../systems/crafting/crafterProgression';
import './ExperimentPanel.css';
interface ExperimentPanelProps {
    onClose?: () => void;
    progression: CrafterProgression;
    onProgressionUpdate: (prog: CrafterProgression) => void;
}
export declare const ExperimentPanel: React.FC<ExperimentPanelProps>;
export default ExperimentPanel;
