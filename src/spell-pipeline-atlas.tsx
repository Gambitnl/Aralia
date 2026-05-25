import React from 'react';
import { createRoot } from 'react-dom/client';
import { PreviewSpellDataFlow } from './components/DesignPreview/steps/PreviewSpellDataFlow';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <PreviewSpellDataFlow />
    </React.StrictMode>
  );
}
