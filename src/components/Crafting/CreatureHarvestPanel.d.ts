/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 14:31:44
 * Dependents: components/Combat/CombatView.tsx, components/Crafting/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/components/Crafting/CreatureHarvestPanel.tsx
 * UI component for harvesting parts from defeated creatures using Poisoner's Kit.
 */
import React from 'react';
import './CreatureHarvestPanel.css';
interface CreatureHarvestPanelProps {
    creatureId: string;
    onClose?: () => void;
}
export declare const CreatureHarvestPanel: React.FC<CreatureHarvestPanelProps>;
export default CreatureHarvestPanel;
