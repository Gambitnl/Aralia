
import React, { useEffect, useRef, useMemo } from 'react';
import { MapData, MapTile, Biome } from '../types';
import { BIOMES } from '../constants';

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

    // Calculate render bounds based on current location
    const startX = currentLocationCoords.x - halfViewport;
    const startY = currentLocationCoords.y - halfViewport;

    for (let y = 0; y < VIEWPORT_TILES; y++) {
      for (let x = 0; x < VIEWPORT_TILES; x++) {
        const mapX = startX + x;
        const mapY = startY + y;

        // Check bounds
        if (
          mapX >= 0 &&
          mapX < mapData.gridSize.cols &&
          mapY >= 0 &&
          mapY < mapData.gridSize.rows
        ) {
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

  }, [mapData, currentLocationCoords, visible]);

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
