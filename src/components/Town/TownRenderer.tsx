import React, { useEffect, useRef } from 'react';
import { AssetPainter } from '../../services/RealmSmithAssetPainter';
import { TownMap } from '../../types/realmsmith';
import { TownPosition, TownDirection } from '../../types/town';

interface TownRendererProps {
    mapData: TownMap | null;
    isNight: boolean;
    showGrid: boolean;
    animatedPosition: TownPosition | null;
    effectivePlayerPosition: TownPosition | null;
    playerFacing: TownDirection;
    isAnimating: boolean;
    zoom: number;
    pan: { x: number, y: number };
    isDragging: boolean;
    onCanvasRef: (ref: HTMLCanvasElement | null) => void;
}

export const TownRenderer: React.FC<TownRendererProps> = ({
    mapData,
    isNight,
    showGrid,
    animatedPosition,
    effectivePlayerPosition,
    playerFacing,
    isAnimating,
    zoom,
    pan,
    isDragging,
    onCanvasRef,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Painting Effect
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !mapData) {
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error("Could not get 2D rendering context.");
            return;
        }

        const TILE_SIZE = 32;
        canvas.width = mapData.width * TILE_SIZE;
        canvas.height = mapData.height * TILE_SIZE;

        // Clear canvas
        ctx.fillStyle = '#111827'; // Tailwind gray-900
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        try {
            const painter = new AssetPainter(ctx);
            painter.drawMap(mapData.tiles, mapData.buildings, mapData.biome, {
                isNight,
                showGrid,
                // Use animated position for smooth movement, fall back to effectivePlayerPosition
                playerPosition: animatedPosition ?? effectivePlayerPosition ?? undefined,
                playerFacing,
                isMoving: isAnimating,
            });
        } catch (err) {
            console.error("AssetPainter failed:", err);
            ctx.fillStyle = '#ef4444'; // Red error for visibility
            ctx.font = '16px sans-serif';
            ctx.fillText("Rendering Error. Check console for details.", 20, 30);
        }

    }, [mapData, isNight, showGrid, effectivePlayerPosition, animatedPosition, playerFacing, isAnimating]);

    // Expose ref to parent
    useEffect(() => {
        onCanvasRef(canvasRef.current);
    }, [onCanvasRef]);

    return (
        <div className="w-full h-full flex items-center justify-center cursor-default overflow-hidden">
            <div
                style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center',
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
            >
                <canvas
                    ref={canvasRef}
                    className="max-w-none shadow-2xl rounded-sm"
                    style={{ imageRendering: 'pixelated' }}
                />
            </div>
        </div>
    );
};
