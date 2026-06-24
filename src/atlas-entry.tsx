import React from 'react';
import ReactDOM from 'react-dom/client';
import { AtlasExplorer } from './components/Atlas/AtlasExplorer';

/**
 * Standalone browser entry point for Aralia Atlas.
 *
 * This file boots the Knowledge Tree explorer inside `misc/aralia_atlas.html`.
 * Keeping the entry separate from the main game prevents tooling state and
 * nightly documentation reports from entering the player-facing bundle.
 *
 * Called by: misc/aralia_atlas.html
 * Depends on: AtlasExplorer for the visible document/branch browser
 */

// ============================================================================
// Browser Mount
// ============================================================================
// This section finds the HTML root and renders the Atlas explorer. A missing root
// is a page wiring error, so it fails loudly instead of rendering a blank tool.
// ============================================================================

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Could not find root element for the Aralia Atlas explorer.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AtlasExplorer />
  </React.StrictMode>,
);
