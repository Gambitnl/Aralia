// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 17/07/2026, 21:43:47
 * Dependents: components/Worldforge/AtlasDemo.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useEffect, useMemo } from 'react';
import { ArrowLeft, MapPin } from 'lucide-react';
import World3DScene from '../World3D/World3DScene';
import { createGroundChunkLoader } from '../../systems/worldforge/bridge/groundChunkLoader';
import { heightToMeters } from '../../systems/world3d/config';
import {
  artifactsForAtlasGroundDrilldown,
  groundStartForFocus,
  type AtlasGroundDrilldown,
} from '../../systems/worldforge/leaf3d/atlasGroundDrilldown';

/**
 * This file renders the ground-level continuation of an Atlas drilldown.
 *
 * It accepts the exact Region and Local objects retained by Atlas, verifies their seed
 * lineage against the navigation receipt, and gives those objects to the shared World3D
 * loader. It also owns the visible return control so ascending restores the preserved map.
 */

interface Props {
  drilldown: AtlasGroundDrilldown;
  onAscend: () => void;
}

const WorldforgeGroundDrilldown: React.FC<Props> = ({ drilldown, onAscend }) => {
  // The standalone developer cartographer still needs a ground renderer. It now
  // consumes the same self-contained receipt as PLAYING, so this harness cannot
  // accidentally establish a second artifact handoff contract.
  const scene = useMemo(() => {
    const { local, region } = artifactsForAtlasGroundDrilldown(drilldown);
    const { ground, loader } = createGroundChunkLoader(local, drilldown.worldSeed, region);
    const [xM, zM] = groundStartForFocus(local, drilldown.focus);
    const gx = Math.max(0, Math.min(ground.cols - 1, Math.round((xM / ground.extentMetersX) * (ground.cols - 1))));
    const gy = Math.max(0, Math.min(ground.rows - 1, Math.round((zM / ground.extentMetersZ) * (ground.rows - 1))));
    return {
      ground,
      loader,
      start: [xM, 0, zM] as const,
      startSurfaceY: heightToMeters(ground.heights[gy * ground.cols + gx] ?? 0),
    };
  }, [drilldown]);

  // Escape follows the same single-level ascent rule as the cartographic tiers.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onAscend();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onAscend]);

  // Keep the selected Atlas-space position legible beside its human label. This gives
  // players and proof captures a visible correspondence between map selection and scene.
  const focusCoordinates = `${Math.round(drilldown.focus.xFt).toLocaleString()}, ${Math.round(drilldown.focus.yFt).toLocaleString()} ft`;

  return (
    <div className="absolute inset-0 bg-slate-950" data-testid="worldforge-ground-drilldown">
      <div className="absolute inset-0">
        <World3DScene
          loader={scene.loader}
          start={scene.start}
          startSurfaceY={scene.startSurfaceY}
          viewProfile="ground"
          groundWorld={scene.ground}
        />
      </div>
      <div className="pointer-events-none absolute bottom-2 left-2 right-2 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-amber-300/30 bg-slate-950/90 px-3 py-2 text-xs text-slate-200 shadow-2xl backdrop-blur sm:bottom-auto sm:left-auto sm:right-4 sm:top-4 sm:max-w-[calc(100%-22rem)] sm:justify-end">
        <button type="button" onClick={onAscend} className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 font-semibold hover:bg-slate-700">
          <ArrowLeft size={16} /> Return to local map
        </button>
        <MapPin size={15} className="text-amber-300" />
        <span className="font-semibold text-amber-200">{drilldown.focus.label}</span>
        <span className="font-mono text-slate-400">{focusCoordinates}</span>
        <span className="basis-full text-right font-mono text-[10px] text-slate-500">World {drilldown.worldSeed} / Cell {drilldown.atlasCellId} / {drilldown.localSeedPath}</span>
      </div>
    </div>
  );
};

export default WorldforgeGroundDrilldown;
