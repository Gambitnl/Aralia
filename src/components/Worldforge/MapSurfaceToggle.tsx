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

const COMPACT_LABELS: Record<MapSurface, string> = {
  classic: '2D',
  worldforge: 'Forge',
};

const MapSurfaceToggle: React.FC = () => {
  const { surface, setSurface } = useMapSurface();

  return (
    <div
      data-testid="map-surface-toggle"
      className="flex gap-1 rounded-md border border-gray-600 bg-gray-800 p-1 shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
    >
      {OPTIONS.map(({ value, label }) => {
        const active = surface === value;
        return (
          <button
            key={value}
            type="button"
            data-testid={`map-surface-${value}`}
            aria-pressed={active}
            aria-label={`Switch to ${label} map surface`}
            title={label}
            onClick={() => setSurface(value)}
            className={`flex min-h-11 min-w-11 items-center justify-center rounded px-2 font-outfit text-[11px] transition-colors sm:px-3 sm:text-xs ${
              active
                ? 'bg-slate-600 font-semibold text-gray-100'
                : 'bg-transparent font-normal text-gray-400 hover:text-gray-200'
            }`}
          >
            {/* Phone-width play screens keep the toggle compact so it does not cover the primary map button. */}
            <span className="sm:hidden">{COMPACT_LABELS[value]}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default MapSurfaceToggle;
