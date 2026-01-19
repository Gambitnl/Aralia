import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { Building, TownMap } from '../../../types/realmsmith';
import type { AmbientNPC } from '../../../hooks/useAmbientLife';
import { DRAG_THRESHOLD_PX, TOWN_TILE_SIZE_PX } from '../townUtils';

type Point = { x: number; y: number };
type Pan = { x: number; y: number };

type UseTownPointerHandlersArgs = {
    canvasRef: RefObject<HTMLCanvasElement>;
    mapData: TownMap | null;
    ambientNpcs: AmbientNPC[];
    pan: Pan;
    zoom: number;
    hoveredBuilding: Building | null;
    setHoveredBuilding: (building: Building | null) => void;
    setHoverPos: (pos: Point | null) => void;
    setPan: (action: Pan | ((prev: Pan) => Pan)) => void;
    setIsCameraLocked: (locked: boolean) => void;
};

export const useTownPointerHandlers = ({
    canvasRef,
    mapData,
    ambientNpcs,
    pan,
    zoom,
    hoveredBuilding,
    setHoveredBuilding,
    setHoverPos,
    setPan,
    setIsCameraLocked,
}: UseTownPointerHandlersArgs) => {
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<Point | null>(null);
    const dragStartPanRef = useRef<Point>({ x: 0, y: 0 });
    const didDragRef = useRef(false);

    const getBuildingAtClientPos = useCallback((clientX: number, clientY: number): Building | null => {
        if (!canvasRef.current || !mapData) return null;
        const rect = canvasRef.current.getBoundingClientRect();

        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
            return null;
        }

        // Map screen coordinates to internal canvas coordinates
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;

        const canvasX = (clientX - rect.left) * scaleX;
        const canvasY = (clientY - rect.top) * scaleY;

        const tileX = Math.floor(canvasX / TOWN_TILE_SIZE_PX);
        const tileY = Math.floor(canvasY / TOWN_TILE_SIZE_PX);

        if (tileX < 0 || tileX >= mapData.width || tileY < 0 || tileY >= mapData.height) {
            return null;
        }

        const tile = mapData.tiles[tileX][tileY];
        if (!tile.buildingId) return null;

        return mapData.buildings.find(b => b.id === tile.buildingId) ?? null;
    }, [canvasRef, mapData]);

    const getNpcAtClientPos = useCallback((clientX: number, clientY: number): string | null => {
        if (!canvasRef.current || !ambientNpcs?.length) return null;
        const rect = canvasRef.current.getBoundingClientRect();

        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        const canvasX = (clientX - rect.left) * scaleX;
        const canvasY = (clientY - rect.top) * scaleY;

        // Check if click is near any NPC (within half a tile)
        for (const npc of ambientNpcs) {
            const npcPxX = npc.x * TOWN_TILE_SIZE_PX + TOWN_TILE_SIZE_PX / 2;
            const npcPxY = npc.y * TOWN_TILE_SIZE_PX + TOWN_TILE_SIZE_PX / 2;

            const dist = Math.sqrt(Math.pow(canvasX - npcPxX, 2) + Math.pow(canvasY - npcPxY, 2));
            if (dist < TOWN_TILE_SIZE_PX / 2) {
                return npc.id;
            }
        }
        return null;
    }, [canvasRef, ambientNpcs]);

    const handlePointerDown = useCallback((e: ReactPointerEvent) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement | null;
        if (target?.closest?.('[data-no-pan]')) return;

        // Capture the pointer so pan continues even if the cursor leaves the canvas area
        // while the mouse button remains pressed.
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDragging(true);
        didDragRef.current = false;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        dragStartPanRef.current = { x: pan.x, y: pan.y };
    }, [pan, setIsDragging]);

    const handlePointerMove = useCallback((e: ReactPointerEvent) => {
        if (dragStartRef.current) {
            const dxPx = e.clientX - dragStartRef.current.x;
            const dyPx = e.clientY - dragStartRef.current.y;

            // Small movements during click are common; require a tiny threshold
            // before we treat the gesture as an intentional pan.
            const hasExceededThreshold = Math.abs(dxPx) > DRAG_THRESHOLD_PX || Math.abs(dyPx) > DRAG_THRESHOLD_PX;
            if (!didDragRef.current && hasExceededThreshold) {
                didDragRef.current = true;
                setIsCameraLocked(false);
                setHoveredBuilding(null);
            }

            if (didDragRef.current) {
                setPan({
                    x: dragStartPanRef.current.x + dxPx / zoom,
                    y: dragStartPanRef.current.y + dyPx / zoom,
                });
            }
            return;
        }

        // Hover Logic (NPCs prioritize over buildings)
        const npcId = getNpcAtClientPos(e.clientX, e.clientY);
        if (npcId) {
            // TODO: Set hovered NPC state for tooltip
            setHoveredBuilding(null);
            document.body.style.cursor = 'pointer'; // Feedback
            return;
        } else {
            document.body.style.cursor = 'default';
        }

        // Hover (Building Detection)
        const building = getBuildingAtClientPos(e.clientX, e.clientY);
        if (building && building !== hoveredBuilding) {
            setHoveredBuilding(building);
            setHoverPos({ x: e.clientX, y: e.clientY });
            return;
        }
        if (building) {
            setHoverPos({ x: e.clientX, y: e.clientY });
            return;
        }
        setHoveredBuilding(null);
    }, [getNpcAtClientPos, getBuildingAtClientPos, hoveredBuilding, setHoverPos, setHoveredBuilding, setIsCameraLocked, setPan, zoom]);

    const handlePointerUp = useCallback((e: ReactPointerEvent) => {
        if (!dragStartRef.current) return;
        setIsDragging(false);
        dragStartRef.current = null;
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
            // Ignore if capture isn't held.
        }
    }, [setIsDragging]);

    return {
        isDragging,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        didDragRef,
        getBuildingAtClientPos,
        getNpcAtClientPos,
    };
};
