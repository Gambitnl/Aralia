// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/08/2026, 13:55:58
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/BattleMapTokens.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {
  BattleMapData,
  CombatCharacter,
  BattleMapTile as BattleMapTileData,
  Position,
} from "../../../types/combat";
import {
  useBattleMap,
  type ControlledActionMode,
} from "../../../hooks/useBattleMap";
import type { useTurnManager } from "../../../hooks/combat/useTurnManager";
import type { useAbilitySystem } from "../../../hooks/useAbilitySystem";
import { TILE_SIZE_PX } from "../../../config/mapConfig";

/**
 * This hook manages pointer gestures, tile hover/click interactions, board zooming,
 * and camera tracking for the 2D tactical battle map.
 *
 * When a player hovers over tiles, clicks on combatants, uses the mouse wheel to zoom,
 * or tracks active combatants across rounds, this hook calculates focal anchors, validates
 * whether actions target creatures or movable map objects, and centers the viewport smoothly.
 *
 * Called by: BattleMap.tsx
 * Depends on: useBattleMap for core move/attack modes, map dimensions for zoom bounds.
 */

// ============================================================================
// Layout and Zoom Constants
// ============================================================================
// Width of the row-letter gutter and height of column numbers, used to align
// camera scroll targets accurately over tile centers.
const RULER_GUTTER_PX = 20;
const COLUMN_RULER_HEIGHT_PX = 16;

// Tactical board zoom constraints. We protect token usability by not shrinking
// below 70% in normal combat unless a full fit is explicitly requested.
const MIN_USABLE_BOARD_SCALE = 0.7;

export interface ObjectInteractionProps {
  activeObjectId: string | null;
  movableObjectIds: string[];
  onObjectSelect: (objectId: string) => void;
  onObjectMove: (objectId: string, destination: Position) => void;
}

export interface UseBattleMapPointerParams {
  mapData: BattleMapData | null;
  characters: CombatCharacter[];
  turnManager: ReturnType<typeof useTurnManager>;
  turnState: ReturnType<typeof useTurnManager>["turnState"];
  abilitySystem: ReturnType<typeof useAbilitySystem>;
  controlledActionMode?: ControlledActionMode;
  objectInteraction?: ObjectInteractionProps;
  cameraFocusRequest?: { characterId: string; requestId: number } | null;
  preferFullMapFit?: boolean;
  openingSceneCameraFocus?: { receiptId: string; position: Position } | null;
}

// ============================================================================
// Hook Implementation
// ============================================================================
export function useBattleMapPointer({
  mapData,
  characters,
  turnManager,
  turnState,
  abilitySystem,
  controlledActionMode,
  objectInteraction,
  cameraFocusRequest = null,
  preferFullMapFit = false,
  openingSceneCameraFocus = null,
}: UseBattleMapPointerParams) {
  // Underlying movement and combat interaction state.
  // Note: Only supply the controlled mode argument when defined to preserve
  // exact call arity expected by test harnesses and standalone preview modes.
  const battleMapState =
    controlledActionMode !== undefined
      ? useBattleMap(
          mapData,
          characters,
          turnManager,
          abilitySystem,
          controlledActionMode,
        )
      : useBattleMap(mapData, characters, turnManager, abilitySystem);

  const {
    handleTileClick,
  } = battleMapState;

  // Track the tile currently underneath the player's pointer for elevation
  // readout and live area-of-effect spell previews.
  const [hoveredTile, setHoveredTile] = useState<BattleMapTileData | null>(null);

  // Active movable object selection if supplied by scenario sandbox.
  const activeObjectId = objectInteraction?.activeObjectId ?? null;
  const activeObject = activeObjectId
    ? (mapData?.targetableObjects?.find(
        (targetObject) => targetObject.id === activeObjectId,
      ) ?? null)
    : null;

  // Intercept tile clicks when a movable object (e.g. sandbox torch) is selected
  const handleObjectAwareTileClick = useCallback(
    (tile: BattleMapTileData) => {
      // When a movable object is selected, a tile click moves that object
      // instead of commanding creature movement or casting an ability.
      if (activeObject && objectInteraction && !tile.blocksMovement) {
        objectInteraction.onObjectMove(activeObject.id, tile.coordinates);
        return;
      }

      handleTileClick(tile);
    },
    [activeObject, handleTileClick, objectInteraction],
  );

  // Live AoE preview when hovering tiles while targeting
  const handleTileHover = useCallback(
    (tile: BattleMapTileData) => {
      setHoveredTile(tile);
      if (
        !abilitySystem?.previewAoE ||
        !abilitySystem.targetingMode ||
        !mapData
      )
        return;
      const caster = characters.find(
        (c) => c.id === turnState.currentCharacterId,
      );
      if (caster) {
        abilitySystem.previewAoE(tile.coordinates, caster);
      }
    },
    [abilitySystem, characters, mapData, turnState.currentCharacterId],
  );

  // ============================================================================
  // Fit-to-Container Scaling & Zoom Management
  // ============================================================================
  const fitWrapRef = useRef<HTMLDivElement>(null);
  const fitFrameRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  const [userZoom, setUserZoom] = useState<number | null>(null);

  const autoScale =
    preferFullMapFit || fitScale >= MIN_USABLE_BOARD_SCALE ? fitScale : 1;
  const boardScale = userZoom ?? autoScale;
  const isBoardScrollable = boardScale > fitScale * 1.02;

  useLayoutEffect(() => {
    const recompute = () => {
      const wrap = fitWrapRef.current;
      const frame = fitFrameRef.current;
      if (!wrap || !frame) return;
      const fw = frame.offsetWidth;
      const fh = frame.offsetHeight;
      if (fw === 0 || fh === 0) return;
      setFrameSize((prev) =>
        prev.w === fw && prev.h === fh ? prev : { w: fw, h: fh },
      );
      const s = Math.min(wrap.clientWidth / fw, wrap.clientHeight / fh, 1);
      setFitScale(s > 0 && Number.isFinite(s) ? s : 1);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    if (fitWrapRef.current) ro.observe(fitWrapRef.current);
    return () => ro.disconnect();
  }, [mapData?.dimensions.width, mapData?.dimensions.height]);

  const clampZoom = (z: number) => Math.min(3, Math.max(0.15, z));

  // Focal-point zoom anchor to keep the cursor's content point stable during wheel zoom.
  const zoomAnchorRef = useRef<{
    boardX: number;
    boardY: number;
    frameOffsetX: number;
    frameOffsetY: number;
    vx: number;
    vy: number;
  } | null>(null);

  const skipCombatantCenterAfterZoomRef = useRef(false);
  const openingSceneCenteredReceiptRef = useRef<string | null>(null);
  const boardScaleRef = useRef(boardScale);

  useLayoutEffect(() => {
    boardScaleRef.current = boardScale;
  }, [boardScale]);

  const zoomBy = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      const wrap = fitWrapRef.current;
      const frame = fitFrameRef.current;
      if (wrap && frame) {
        const wrapRect = wrap.getBoundingClientRect();
        const frameRect = frame.getBoundingClientRect();
        const vx =
          clientX !== undefined
            ? clientX - wrapRect.left
            : wrap.clientWidth / 2;
        const vy =
          clientY !== undefined
            ? clientY - wrapRect.top
            : wrap.clientHeight / 2;
        const scale = boardScaleRef.current;
        const frameOffsetX = wrap.scrollLeft + frameRect.left - wrapRect.left;
        const frameOffsetY = wrap.scrollTop + frameRect.top - wrapRect.top;
        zoomAnchorRef.current = {
          boardX: (wrap.scrollLeft + vx - frameOffsetX) / scale,
          boardY: (wrap.scrollTop + vy - frameOffsetY) / scale,
          frameOffsetX,
          frameOffsetY,
          vx,
          vy,
        };
      }
      setUserZoom((prev) =>
        clampZoom((prev ?? boardScaleRef.current) * factor),
      );
    },
    [],
  );

  // ============================================================================
  // Camera Centering on Characters and Points
  // ============================================================================
  const [pendingCameraCenterCharacterId, setPendingCameraCenterCharacterId] =
    useState<string | null>(null);

  const requestCameraCenter = useCallback((characterId: string) => {
    setUserZoom(null);
    setPendingCameraCenterCharacterId(characterId);
  }, []);

  const centerBoardOnPosition = useCallback(
    (position: Position, viewportOffsetY = 0) => {
      if (!mapData || !fitWrapRef.current) return;

      const wrap = fitWrapRef.current;
      const targetLeft =
        (RULER_GUTTER_PX + position.x * TILE_SIZE_PX + TILE_SIZE_PX / 2) *
          boardScale -
        wrap.clientWidth / 2;
      const targetTop =
        (COLUMN_RULER_HEIGHT_PX +
          position.y * TILE_SIZE_PX +
          TILE_SIZE_PX / 2) *
          boardScale -
        wrap.clientHeight / 2 -
        viewportOffsetY;

      window.requestAnimationFrame(() => {
        wrap.scrollTo({
          left: Math.max(0, targetLeft),
          top: Math.max(0, targetTop),
        });
      });
    },
    [boardScale, mapData],
  );

  const centerBoardOnCharacter = useCallback(
    (character: CombatCharacter) => {
      centerBoardOnPosition(character.position);
    },
    [centerBoardOnPosition],
  );

  // Listen for explicit camera focus prop requests from parent views.
  useEffect(() => {
    if (!cameraFocusRequest) return;
    requestCameraCenter(cameraFocusRequest.characterId);
  }, [cameraFocusRequest, requestCameraCenter]);

  // Listen for global custom event requests (e.g. from roster clicks).
  useEffect(() => {
    const handleRosterCameraRequest = (event: Event) => {
      const characterId = (event as CustomEvent<{ characterId?: string }>)
        .detail?.characterId;
      if (characterId) requestCameraCenter(characterId);
    };

    window.addEventListener(
      "aralia:battle-map-center-character",
      handleRosterCameraRequest,
    );
    return () =>
      window.removeEventListener(
        "aralia:battle-map-center-character",
        handleRosterCameraRequest,
      );
  }, [requestCameraCenter]);

  // Correct scroll position following zoom gestures.
  useLayoutEffect(() => {
    const wrap = fitWrapRef.current;
    const anchor = zoomAnchorRef.current;
    if (!wrap || !anchor) return;
    zoomAnchorRef.current = null;
    wrap.scrollLeft =
      anchor.frameOffsetX + anchor.boardX * boardScale - anchor.vx;
    wrap.scrollTop =
      anchor.frameOffsetY + anchor.boardY * boardScale - anchor.vy;
    skipCombatantCenterAfterZoomRef.current = true;
  }, [boardScale]);

  // Native wheel listener to prevent default page scrolling while zooming the map.
  useEffect(() => {
    const wrap = fitWrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  // Focus on pending requested character when requested from roster or prop.
  useLayoutEffect(() => {
    if (!pendingCameraCenterCharacterId) return;

    const requestedCharacter = characters.find(
      (character) => character.id === pendingCameraCenterCharacterId,
    );
    setPendingCameraCenterCharacterId(null);
    if (!requestedCharacter || !isBoardScrollable) return;

    skipCombatantCenterAfterZoomRef.current = true;
    centerBoardOnCharacter(requestedCharacter);
  }, [
    centerBoardOnCharacter,
    characters,
    isBoardScrollable,
    pendingCameraCenterCharacterId,
  ]);

  // Initial establishing shot on opening scenes or active turn owner.
  const currentCharacter = characters.find(
    (c) => c.id === turnState.currentCharacterId,
  );

  useLayoutEffect(() => {
    if (
      !isBoardScrollable &&
      typeof fitWrapRef.current?.scrollTo === "function"
    ) {
      fitWrapRef.current.scrollTo(0, 0);
    }
    if (
      !mapData ||
      !isBoardScrollable ||
      !currentCharacter ||
      !fitWrapRef.current
    )
      return;

    if (skipCombatantCenterAfterZoomRef.current) {
      skipCombatantCenterAfterZoomRef.current = false;
      return;
    }

    if (
      openingSceneCameraFocus &&
      openingSceneCenteredReceiptRef.current !==
        openingSceneCameraFocus.receiptId
    ) {
      openingSceneCenteredReceiptRef.current =
        openingSceneCameraFocus.receiptId;
      centerBoardOnPosition(openingSceneCameraFocus.position, 56);
      return;
    }

    centerBoardOnCharacter(currentCharacter);
  }, [
    centerBoardOnCharacter,
    centerBoardOnPosition,
    currentCharacter,
    isBoardScrollable,
    mapData,
    openingSceneCameraFocus,
  ]);

  return {
    ...battleMapState,
    fitWrapRef,
    fitFrameRef,
    fitScale,
    frameSize,
    userZoom,
    setUserZoom,
    boardScale,
    isBoardScrollable,
    zoomBy,
    hoveredTile,
    setHoveredTile,
    handleObjectAwareTileClick,
    handleTileHover,
    requestCameraCenter,
    centerBoardOnPosition,
    centerBoardOnCharacter,
  };
}

export default useBattleMapPointer;
