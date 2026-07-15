// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 15/07/2026, 01:31:22
 * Dependents: None (Orphan)
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import BuildingIdentityLab from './devtools/buildingIdentityLab/BuildingIdentityLab';

/**
 * This is the standalone browser entry for the procedural building identity workbench.
 * Vite loads it from building-identity-lab.html so the tool remains available
 * independently of the main game and the larger Design Preview router.
 */

// Mount the workbench only when its dedicated HTML entry supplied a root.
// StrictMode helps expose accidental non-determinism during development.
const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <BuildingIdentityLab />
    </React.StrictMode>,
  );
}
