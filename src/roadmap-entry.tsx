import React from 'react';
import { createRoot } from 'react-dom/client';
import { RoadmapVisualizer } from './components/debug/RoadmapVisualizer';
import './index.css'; // Reuse existing styles

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <div className="min-h-screen bg-gray-950">
        <RoadmapVisualizer />
      </div>
    </React.StrictMode>
  );
}
