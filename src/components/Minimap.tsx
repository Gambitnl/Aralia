
import React, { useEffect, useMemo, useRef } from 'react';
import { MapData, MapMarker } from '../types';
import { BIOMES } from '../constants';
import { POIS } from '../data/world/pois';
import { buildPoiMarkers, isCoordinateWithinMap } from '../utils/locationUtils';

interface MinimapProps {
  mapData: MapData | null;
  currentLocationCoords: { x: number; y: number };
  submapCoords: { x: number; y: number } | null;
  visible: boolean;
  toggleMap: () => void;
}

const MINIMAP_SIZE = 150; // Pixels
const VIEWPORT_TILES = 15; // Number of tiles to show in width/height

const Minimap: React.FC<MinimapProps> = ({
  mapData,
  currentLocationCoords,
  submapCoords,
  visible,
  toggleMap
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /**
   * Derive static map markers from the POI table, flagging which ones should
   * be visible based on discovered tiles. Using useMemo keeps the canvas draw
   * cycle lean and ensures the coordinates are recalculated only when mapData
   * changes (i.e., discovery updates or a new map is loaded).
   */
  const poiMarkers: MapMarker[] = useMemo(() => buildPoiMarkers(POIS, mapData), [mapData]);

  useEffect(() => {
    if (!visible || !mapData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    // Fill background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    const tileSize = MINIMAP_SIZE / VIEWPORT_TILES;
    const halfViewport = Math.floor(VIEWPORT_TILES / 2);

    // Calculate render bounds based on current location. All map math happens
    // in tile space first (startX/startY) and only converts to pixels when
    // we know a tile is actually on the minimap viewport. This keeps both the
    // minimap and the main map aligned to the same coordinate system.
    const startX = currentLocationCoords.x - halfViewport;
    const startY = currentLocationCoords.y - halfViewport;

    for (let y = 0; y < VIEWPORT_TILES; y++) {
      for (let x = 0; x < VIEWPORT_TILES; x++) {
        const mapX = startX + x;
        const mapY = startY + y;

        // Check bounds once to avoid array access errors when the camera pans
        if (isCoordinateWithinMap({ x: mapX, y: mapY }, mapData)) {
          const tile = mapData.tiles[mapY][mapX];
          if (tile.discovered) {
            const biome = BIOMES[tile.biomeId];
            ctx.fillStyle = biome?.rgbaColor || '#555';
            ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          } else {
            ctx.fillStyle = '#333'; // Fog of war
            ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          }
        }
      }
    }

    // Draw discovered POI markers that fall inside the viewport. Marker math
    // mirrors the tile loop: we translate from tile coordinates to canvas
    // pixels using the same startX/startY offsets so the icons stay perfectly
    // aligned with the grid squares.
    poiMarkers.forEach(marker => {
      if (!marker.isDiscovered) return;
      const deltaX = marker.coordinates.x - startX;
      const deltaY = marker.coordinates.y - startY;
      if (deltaX < 0 || deltaX >= VIEWPORT_TILES || deltaY < 0 || deltaY >= VIEWPORT_TILES) return;

      const centerX = deltaX * tileSize + tileSize / 2;
      const centerY = deltaY * tileSize + tileSize / 2;

      ctx.font = `${Math.max(10, tileSize * 0.6)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#111';
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 3;
      // Stroke a soft glow under the icon to keep it legible over noisy biomes
      ctx.strokeText(marker.icon, centerX, centerY);
      ctx.fillText(marker.icon, centerX, centerY);
    });

    // Draw player marker
    const centerX = halfViewport * tileSize + tileSize / 2;
    const centerY = halfViewport * tileSize + tileSize / 2;

    ctx.beginPath();
    ctx.arc(centerX, centerY, tileSize / 1.5, 0, 2 * Math.PI);
    ctx.fillStyle = '#FBBF24'; // Amber-400
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw border
    ctx.strokeStyle = '#A16207'; // Amber-800
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

  }, [mapData, currentLocationCoords, visible, poiMarkers]);

  if (!visible || !mapData) return null;

  return (
    <div
      className="absolute top-4 right-4 z-30 shadow-lg rounded-lg overflow-hidden border-2 border-amber-700 bg-black cursor-pointer hover:opacity-90 transition-opacity"
      onClick={toggleMap}
      title="Click to open World Map"
    >
      <canvas
        ref={canvasRef}
        width={MINIMAP_SIZE}
        height={MINIMAP_SIZE}
        className="block"
      />
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-center text-[10px] text-amber-200 font-cinzel py-0.5 pointer-events-none">
        {currentLocationCoords.x}, {currentLocationCoords.y}
      </div>
    </div>
  );
};

export default Minimap;
