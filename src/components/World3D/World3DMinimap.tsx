/**
 * @file src/components/World3D/World3DMinimap.tsx
 * In-3D minimap overlay (Plan 4 deferred UX) — composited inside InWorldHUD.
 *
 * While exploring the streamed 3D world you lose the bird's-eye sense of where you
 * are. This paints a compact top-down view of the world straight from `WorldData`
 * (the same source the 3D scene streams from) and tracks the live player position
 * with the shared `AtlasPlayerMarker`. Unlike `WorldAtlasStrip` (which reads the
 * Azgaar `MapData` tiles on the 2D layout) this reads worldsim's flat `biomeIds`
 * grid, so it works inside the 3D view where only `WorldData` is available.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { WorldData } from '../../services/worldSim/types';
import type { PlayerWorldPosition } from '../../types';
import { BIOMES } from '../../constants';
import AtlasPlayerMarker from './AtlasPlayerMarker';

const MINIMAP_SIZE = 132;
const FALLBACK_BG = 'rgba(55, 65, 81, 0.85)';

export interface World3DMinimapProps {
  /** World source the 3D scene streams from; null hides the minimap. */
  worldData: WorldData | null;
  /** Live player position; null hides the minimap until movement starts. */
  playerWorldPos: PlayerWorldPosition | null;
}

const World3DMinimap: React.FC<World3DMinimapProps> = ({ worldData, playerWorldPos }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const gridSize = useMemo(
    () => ({
      cols: worldData?.gridSize?.cols ?? 0,
      rows: worldData?.gridSize?.rows ?? 0,
    }),
    [worldData?.gridSize?.cols, worldData?.gridSize?.rows],
  );

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !worldData) return;
    const { cols, rows } = gridSize;
    if (cols <= 0 || rows <= 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tileW = MINIMAP_SIZE / cols;
    const tileH = MINIMAP_SIZE / rows;
    const { biomeIds } = worldData;

    ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const biomeId = biomeIds[y * cols + x];
        const biome = biomeId ? BIOMES[biomeId] : undefined;
        ctx.fillStyle = biome?.rgbaColor ?? FALLBACK_BG;
        ctx.fillRect(x * tileW, y * tileH, Math.ceil(tileW), Math.ceil(tileH));
      }
    }
  }, [gridSize, worldData]);

  useEffect(() => {
    paint();
  }, [paint]);

  if (!worldData || !playerWorldPos || gridSize.cols <= 0 || gridSize.rows <= 0) {
    return null;
  }

  return (
    <div
      data-testid="world-3d-minimap"
      className="relative rounded-lg overflow-hidden border-2 border-sky-800/90 bg-slate-950 shadow-lg"
      style={{ width: MINIMAP_SIZE, pointerEvents: 'none' }}
      aria-label="Minimap of your position in the 3D world"
    >
      <canvas
        ref={canvasRef}
        width={MINIMAP_SIZE}
        height={MINIMAP_SIZE}
        className="block"
        aria-hidden="true"
      />
      {/* Marker uses the same world→grid math as the 2D atlas marker. */}
      <div className="absolute inset-0">
        <AtlasPlayerMarker
          playerWorldPos={playerWorldPos}
          gridCols={gridSize.cols}
          gridRows={gridSize.rows}
          atlasTransform={null}
        />
      </div>
    </div>
  );
};

export default World3DMinimap;
