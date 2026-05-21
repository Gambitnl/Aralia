// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 20/05/2026, 23:12:25
 * Dependents: None (Orphan)
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Standalone React entry point for the Documentation Library Tool.
 *
 * Bootstraps the Markdown Library component in strict mode. Renders within
 * the standalone misc/md_library.html shell, decoupled from the main game bundle.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { PreviewMdLibrary } from './components/DesignPreview/steps/PreviewMdLibrary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element for the Documentation Library');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <PreviewMdLibrary />
  </React.StrictMode>,
);
