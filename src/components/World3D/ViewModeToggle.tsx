/**
 * @file src/components/World3D/ViewModeToggle.tsx
 * Toggle switch between 3D and Atlas view modes.
 *
 * MVP scope: simple button group, flat design, CSS variable colors.
 * Clicking "Atlas" or "Open Map" dispatches SET_WORLD_VIEW_MODE('atlas').
 */

import React from 'react';
import { useWorldViewMode } from '../../hooks/useWorldViewMode';

interface ViewModeToggleProps {
  /** Callback when switching to atlas mode. */
  onOpenMap: () => void;
}

const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ onOpenMap }) => {
  const { mode, setMode } = useWorldViewMode();

  const handleSwitchToAtlas = () => {
    setMode('atlas');
    onOpenMap();
  };

  const handleSwitchTo3D = () => {
    setMode('3d');
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: '4px',
        padding: '4px',
        backgroundColor: 'var(--bg-surface-alt, #1e2e3e)',
        border: '1px solid var(--border-color, #3a4a5a)',
        borderRadius: '4px',
      }}
    >
      <button
        onClick={handleSwitchTo3D}
        style={{
          padding: '6px 12px',
          fontSize: '12px',
          fontFamily: 'Outfit, sans-serif',
          fontWeight: mode === '3d' ? 600 : 400,
          color: mode === '3d' ? 'var(--text-primary, #e8e8e8)' : 'var(--text-secondary, #8a9aaa)',
          backgroundColor: mode === '3d' ? 'var(--bg-active, #3a5a7a)' : 'transparent',
          border: 'none',
          borderRadius: '3px',
          cursor: 'pointer',
        }}
      >
        3D
      </button>
      <button
        type="button"
        data-testid="hud-atlas-toggle"
        onClick={handleSwitchToAtlas}
        style={{
          padding: '6px 12px',
          fontSize: '12px',
          fontFamily: 'Outfit, sans-serif',
          fontWeight: mode === 'atlas' ? 600 : 400,
          color: mode === 'atlas' ? 'var(--text-primary, #e8e8e8)' : 'var(--text-secondary, #8a9aaa)',
          backgroundColor: mode === 'atlas' ? 'var(--bg-active, #3a5a7a)' : 'transparent',
          border: 'none',
          borderRadius: '3px',
          cursor: 'pointer',
        }}
      >
        Atlas
      </button>
    </div>
  );
};

export default ViewModeToggle;
