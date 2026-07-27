// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/07/2026, 14:18:09
 * Dependents: App.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/components/Worldforge/MapSurfaceToggle.tsx
 * Floating toggle between the normal game view and the full atlas explorer.
 * Both routes use the same canonical AtlasSvgView at world level; the saved
 * `classic` and `worldforge` values remain unchanged for compatibility.
 *
 * Mounted as a fixed overlay in the PLAYING phase so it is reachable from
 * either surface. Dispatches SET_MAP_SURFACE via the useMapSurface hook.
 */

import React from 'react';
import { useMapSurface } from '../../hooks/useWorldViewMode';
import type { MapSurface } from '../../types';

const OPTIONS: Array<{ value: MapSurface; label: string; accessibleName: string }> = [
  { value: 'classic', label: 'Play', accessibleName: 'Show game view' },
  { value: 'worldforge', label: 'Atlas explorer', accessibleName: 'Show atlas explorer' },
];

const COMPACT_LABELS: Record<MapSurface, string> = {
  classic: 'Play',
  worldforge: 'Atlas',
};

const MapSurfaceToggle: React.FC = () => {
  const { surface, setSurface } = useMapSurface();

  return (
    <div
      data-testid="map-surface-toggle"
      className="flex gap-1 rounded-md border border-gray-600 bg-gray-800 p-1 shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
    >
      {OPTIONS.map(({ value, label, accessibleName }) => {
        const active = surface === value;
        return (
          <button
            key={value}
            type="button"
            data-testid={`map-surface-${value}`}
            aria-pressed={active}
            aria-label={accessibleName}
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
