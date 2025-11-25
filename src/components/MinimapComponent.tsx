import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapData } from '../types';
import { BIOMES } from '../constants';

interface MinimapComponentProps {
  mapData: MapData | null;
  playerCoords: { x: number; y: number };
  isVisible?: boolean;
  onToggle?: () => void;
  onPan?: (coords: { x: number; y: number }) => void;
}

const CANVAS_SIZE = 180;

const MinimapComponent: React.FC<MinimapComponentProps> = ({ mapData, playerCoords, isVisible = true, onToggle, onPan }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [internalVisible, setInternalVisible] = useState<boolean>(isVisible);

  useEffect(() => setInternalVisible(isVisible), [isVisible]);

  const tileSize = useMemo(() => {
    if (!mapData) return 0;
    const maxDimension = Math.max(mapData.width, mapData.height);
    return maxDimension ? CANVAS_SIZE / maxDimension : 0;
  }, [mapData]);

  useEffect(() => {
    if (!internalVisible || !mapData || !canvasRef.current || tileSize === 0) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    canvasRef.current.width = CANVAS_SIZE;
    canvasRef.current.height = CANVAS_SIZE;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        const tile = mapData.tiles[y][x];
        const biome = BIOMES[tile.biomeId];
        ctx.fillStyle = biome?.rgbaColor || '#334155';
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }

    // Player indicator
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc((playerCoords.x + 0.5) * tileSize, (playerCoords.y + 0.5) * tileSize, Math.max(3, tileSize / 3), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0b1722';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }, [internalVisible, mapData, tileSize, playerCoords]);

  const handleToggle = () => {
    setInternalVisible(prev => !prev);
    onToggle?.();
  };

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!mapData || !canvasRef.current || tileSize === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / tileSize);
    const y = Math.floor((event.clientY - rect.top) / tileSize);
    if (x < 0 || y < 0 || x >= mapData.width || y >= mapData.height) return;
    onPan?.({ x, y });
  };

  if (!internalVisible || !mapData) return (
    <button className="px-3 py-1 text-xs rounded bg-amber-900 text-amber-100" onClick={handleToggle}>
      Show Minimap
    </button>
  );

  return (
    <div className="flex flex-col gap-1 items-end">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        onClick={handleClick}
        className="rounded-lg shadow-lg border border-amber-700 cursor-pointer"
      />
      <button className="px-3 py-1 text-xs rounded bg-amber-900 text-amber-100" onClick={handleToggle}>
        Hide Minimap
      </button>
    </div>
  );
};

export default MinimapComponent;
