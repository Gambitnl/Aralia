/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/07/2026, 01:26:02
 * Dependents: building-identity-lab.tsx, components/DesignPreview/DesignPreviewPage.tsx
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import React from 'react';
import './buildingIdentityLab.css';
declare const BuildingIdentityLab: React.FC;
declare global {
    interface Window {
        __buildingIdentityLab?: Record<string, unknown>;
    }
}
export default BuildingIdentityLab;
