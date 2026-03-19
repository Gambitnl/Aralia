import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RoadmapVisualizer } from './components/debug/RoadmapVisualizer';
import { SpellBranchNavigator } from './spell-branch/SpellBranchNavigator';
import '../../../src/index.css';

/**
 * This file mounts the standalone roadmap UI when `roadmap.html` is opened.
 *
 * It exists so the roadmap tool can run as an isolated dev profile without loading the
 * main app entry point. Vite serves this file directly from `devtools/roadmap/src`.
 *
 * Tabs:
 *   - Roadmap: the main interactive feature roadmap (RoadmapVisualizer)
 *   - Spell Branch: axis-based spell navigator (SpellBranchNavigator)
 */

type TabId = 'roadmap' | 'spell-branch';

const TABS: { id: TabId; label: string }[] = [
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'spell-branch', label: 'Spell Branch' },
];

function RoadmapApp() {
  const [activeTab, setActiveTab] = useState<TabId>('roadmap');

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Tab bar — only visible on Spell Branch tab to avoid cluttering the roadmap canvas */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          zIndex: 200,
          display: 'flex',
          gap: 4,
          padding: '8px 16px',
          background: 'rgba(5, 8, 16, 0.88)',
          borderBottomLeftRadius: 10,
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(100,116,139,0.25)',
          borderLeft: '1px solid rgba(100,116,139,0.25)',
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '4px 14px',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === tab.id ? '#0e7490' : 'transparent',
              color: activeTab === tab.id ? '#e0f2fe' : '#94a3b8',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panels — only the active one is rendered */}
      {activeTab === 'roadmap' && <RoadmapVisualizer />}
      {activeTab === 'spell-branch' && (
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 48, background: '#050810', color: '#e2e8f0', minHeight: '100vh' }}>
          <SpellBranchNavigator />
        </div>
      )}
    </div>
  );
}

// Render the roadmap UI into the standalone page root.
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <RoadmapApp />
    </React.StrictMode>
  );
}
