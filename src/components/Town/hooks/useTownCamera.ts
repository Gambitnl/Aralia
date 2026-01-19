import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { TownMap } from '../../../types/realmsmith';
import type { TownPosition } from '../../../types/town';
import { CAMERA_LERP_FACTOR, lerp, TOWN_TILE_SIZE_PX } from '../townUtils';

type Pan = { x: number; y: number };

type UseTownCameraArgs = {
    animatedPosition: TownPosition | null;
    effectivePlayerPosition: TownPosition | null;
    mapData: TownMap | null;
    canvasRef: RefObject<HTMLCanvasElement>;
    zoom: number;
    setPan: (action: Pan | ((prev: Pan) => Pan)) => void;
    resetView: () => void;
};

export const useTownCamera = ({
    animatedPosition,
    effectivePlayerPosition,
    mapData,
    canvasRef,
    zoom,
    setPan,
    resetView,
}: UseTownCameraArgs) => {
    const [isCameraLocked, setIsCameraLocked] = useState(true);

    // Camera follow effect - smooth pan to keep player centered
    useEffect(() => {
        if (!isCameraLocked) return;
        if (!animatedPosition || !mapData || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const containerWidth = canvas.parentElement?.clientWidth || canvas.width;
        const containerHeight = canvas.parentElement?.clientHeight || canvas.height;

        // Calculate target pan to center player
        const playerPixelX = animatedPosition.x * TOWN_TILE_SIZE_PX + TOWN_TILE_SIZE_PX / 2;
        const playerPixelY = animatedPosition.y * TOWN_TILE_SIZE_PX + TOWN_TILE_SIZE_PX / 2;

        // Center the player in the viewport
        const targetPanX = (containerWidth / 2) / zoom - playerPixelX;
        const targetPanY = (containerHeight / 2) / zoom - playerPixelY;

        // Smooth lerp toward target
        setPan(currentPan => ({
            x: lerp(currentPan.x, targetPanX, CAMERA_LERP_FACTOR),
            y: lerp(currentPan.y, targetPanY, CAMERA_LERP_FACTOR),
        }));
    }, [animatedPosition, isCameraLocked, mapData, canvasRef, setPan, zoom]);

    // Center camera on player position
    const jumpToPlayer = useCallback(() => {
        if (!effectivePlayerPosition || !canvasRef.current || !mapData) return;

        const canvas = canvasRef.current;
        const containerWidth = canvas.parentElement?.clientWidth || canvas.width;
        const containerHeight = canvas.parentElement?.clientHeight || canvas.height;

        const playerPixelX = effectivePlayerPosition.x * TOWN_TILE_SIZE_PX + TOWN_TILE_SIZE_PX / 2;
        const playerPixelY = effectivePlayerPosition.y * TOWN_TILE_SIZE_PX + TOWN_TILE_SIZE_PX / 2;

        setIsCameraLocked(true);
        setPan({
            x: (containerWidth / 2) / zoom - playerPixelX,
            y: (containerHeight / 2) / zoom - playerPixelY,
        });
    }, [effectivePlayerPosition, mapData, canvasRef, setIsCameraLocked, setPan, zoom]);

    const handleResetView = useCallback(() => {
        setIsCameraLocked(true);
        resetView();
    }, [resetView, setIsCameraLocked]);

    return {
        isCameraLocked,
        setIsCameraLocked,
        jumpToPlayer,
        handleResetView,
    };
};
