/**
 * @file src/components/Worldforge/MapSurfaceToggle.tsx
 * Floating toggle that swaps the 2D exploration surface between the legacy
 * "Classic" map (GameLayout: MapPane iframe + Submap) and the native
 * "Worldforge" cartographer (ported-FMG L0→L1→L2 zoom chain).
 *
 * Mounted as a fixed overlay in the PLAYING phase so it is reachable from
 * either surface. Dispatches SET_MAP_SURFACE via the useMapSurface hook.
 */

import React from 'react';
import { useMapSurface } from '../../hooks/useWorldViewMode';
import type { MapSurface } from '../../types';

const OPTIONS: Array<{ value: MapSurface; label: string }> = [
  { value: 'classic', label: 'Classic' },
  { value: 'worldforge', label: 'Worldforge' },
];

const MapSurfaceToggle: React.FC = () => {
  const { surface, setSurface } = useMapSurface();

  return (
    <div
      data-testid="map-surface-toggle"
      style={{
        display: 'flex',
        gap: '4px',
        padding: '4px',
        backgroundColor: 'var(--bg-surface-alt, #1e2e3e)',
        border: '1px solid var(--border-color, #3a4a5a)',
        borderRadius: '6px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
    >
      {OPTIONS.map(({ value, label }) => {
        const active = surface === value;
        return (
          <button
            key={value}
            type="button"
            data-testid={`map-surface-${value}`}
            aria-pressed={active}
            onClick={() => setSurface(value)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--text-primary, #e8e8e8)' : 'var(--text-secondary, #8a9aaa)',
              backgroundColor: active ? 'var(--bg-active, #3a5a7a)' : 'transparent',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};

export default MapSurfaceToggle;
