import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { PreviewSpellDataFlow } from './components/DesignPreview/steps/PreviewSpellDataFlow';

/**
 * This file opens the standalone Spell Pipeline Atlas page.
 *
 * The Atlas is a developer checkpoint for the Spell Phase work. It lets agents
 * and humans inspect which spell-data buckets are live, which ones are still
 * partial, and which ones should not be used as proof yet. The static HTML page
 * in misc/spell_pipeline_atlas.html loads this entry point, and this entry
 * point renders the tracked PreviewSpellDataFlow component below.
 */

// ============================================================================
// Standalone Atlas Mount
// ============================================================================
// This section connects the standalone HTML shell to React. Failing loudly when
// the root element is absent keeps Atlas proof honest: a page that cannot mount
// should not count as a usable checkpoint for later spell packages.
// ============================================================================

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Could not find root element for the Spell Pipeline Atlas');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <PreviewSpellDataFlow />
  </React.StrictMode>,
);
