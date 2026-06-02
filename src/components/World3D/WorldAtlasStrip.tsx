/**
 * @file src/components/World3D/WorldAtlasStrip.tsx
 * Compact always-visible world-map strip for PLAYING exploration layout (W3DUI-23).
 *
 * The full Azgaar atlas lives in MapPane modal; this strip shows where `playerWorldPos`
 * sits on the world grid without opening the map. Click opens the world map modal.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { MapData, PlayerWorldPosition } from '../../types';
import { BIOMES } from '../../constants';
import AtlasPlayerMarker from './AtlasPlayerMarker';
import { Z_INDEX } from '../../styles/zIndex';
import { UI_ID } from '../../styles/uiIds';

const STRIP_WIDTH = 200;
const STRIP_HEIGHT = 134;

export interface WorldAtlasStripProps {
  mapData: MapData | null;
  playerWorldPos: PlayerWorldPosition | null;
  /** Opens the full world map (MapPane) when the strip is clicked. */
  onOpenWorldMap: () => void;
}

const WorldAtlasStrip: React.FC<WorldAtlasStripProps> = ({
  mapData,
  playerWorldPos,
  onOpenWorldMap,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const gridSize = useMemo(
    () => ({
      cols: mapData?.gridSize?.cols ?? 60,
      rows: mapData?.gridSize?.rows ?? 40,
    }),
    [mapData?.gridSize?.cols, mapData?.gridSize?.rows],
  );

  const paintStrip = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapData?.tiles?.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { cols, rows } = gridSize;
    const tileW = STRIP_WIDTH / cols;
    const tileH = STRIP_HEIGHT / rows;

    ctx.clearRect(0, 0, STRIP_WIDTH, STRIP_HEIGHT);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, STRIP_WIDTH, STRIP_HEIGHT);

    for (let y = 0; y < rows; y++) {
      const row = mapData.tiles[y];
      if (!row) continue;
      for (let x = 0; x < cols; x++) {
        const tile = row[x];
        if (!tile) continue;
        const biome = BIOMES[tile.biomeId];
        if (tile.discovered && biome?.rgbaColor) {
          ctx.fillStyle = biome.rgbaColor;
        } else {
          ctx.fillStyle = 'rgba(55, 65, 81, 0.85)';
        }
        ctx.fillRect(x * tileW, y * tileH, Math.ceil(tileW), Math.ceil(tileH));
      }
    }
  }, [gridSize, mapData]);

  useEffect(() => {
    paintStrip();
  }, [paintStrip]);

  if (!playerWorldPos) {
    return null;
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenWorldMap();
    }
  };

  return (
    <button
      type="button"
      id={UI_ID.WORLD_ATLAS_STRIP}
      data-testid={UI_ID.WORLD_ATLAS_STRIP}
      className="absolute bottom-4 right-4 z-[var(--z-index-minimap)] rounded-lg overflow-hidden border-2 border-sky-800/90 bg-slate-950 shadow-lg cursor-pointer hover:opacity-90 transition-opacity text-left"
      style={{ width: STRIP_WIDTH, zIndex: Z_INDEX.MINIMAP }}
      onClick={onOpenWorldMap}
      onKeyDown={handleKeyDown}
      title="Open world map — red dot is your 3D position"
      aria-label="World map position strip. Open full map."
    >
      <canvas
        ref={canvasRef}
        width={STRIP_WIDTH}
        height={STRIP_HEIGHT}
        className="block pointer-events-none"
        aria-hidden="true"
      />
      {/* DOM marker matches MapPane math (identity transform until Azgaar bridge loads). */}
      <div className="absolute inset-0 pointer-events-none">
        <AtlasPlayerMarker
          playerWorldPos={playerWorldPos}
          gridCols={gridSize.cols}
          gridRows={gridSize.rows}
          atlasTransform={null}
        />
      </div>
      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-sky-100 px-1 py-0.5 text-center pointer-events-none">
        3D position
      </span>
    </button>
  );
};

export default WorldAtlasStrip;
