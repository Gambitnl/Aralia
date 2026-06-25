import React from 'react';
import { createRoot } from 'react-dom/client';
import TravelPreviewApp from './TravelPreviewApp';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TravelPreviewApp />
  </React.StrictMode>,
);
