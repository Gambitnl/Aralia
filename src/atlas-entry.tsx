import React from 'react';
import ReactDOM from 'react-dom/client';
import { AtlasExplorer } from './components/Atlas/AtlasExplorer';
import { applyZIndexCssVariables } from './styles/zIndex';

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


/* The game app defines the --z-index-* variables in App.tsx, which this page
 * never mounts. Without them every `z-[var(--z-index-*)]` class computes
 * `z-index: auto`, so a layered element silently sits under the content it
 * should cover. Cheap and idempotent, so it runs whether or not this page's
 * tree happens to use one today (Remy 2026-08-31). */
applyZIndexCssVariables();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Could not find root element for the Aralia Atlas explorer.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AtlasExplorer />
  </React.StrictMode>,
);
