/**
 * Bootstrap for the standalone Spell Pipeline Atlas page.
 *
 * Why this exists as its own entry:
 * - the atlas needs the whole viewport to display the coverage matrix
 *   comfortably, but the DesignPreview hosts it inside a resizable WindowFrame
 *   that clips rows off.
 * - a dedicated entry also means the Dev Hub can deep-link to the atlas the
 *   same way it already links to spell_data_validation.html.
 *
 * Reached by: misc/spell_pipeline_atlas.html
 * Dev-hub link: misc/dev_hub.html
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { SpellPipelineAtlasPage } from './components/SpellPipelineAtlas/SpellPipelineAtlasPage';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <SpellPipelineAtlasPage />
    </React.StrictMode>
  );
}
