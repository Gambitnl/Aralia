// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/06/2026, 09:47:18
 * Dependents: components/Worldforge/AtlasDemo.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useRef, useEffect, useState } from "react";
import { ZoomIn, ZoomOut, Maximize, ArrowLeft } from "lucide-react";
import { drawRegion, computeRegionFitView } from "./regionDraw";
import type { RegionArtifact } from "../../systems/worldforge/artifacts";
import { drawOverlay, type OverlayMarker } from "./overlay";


export interface RegionMapViewProps {
  region: RegionArtifact;
  width?: number;
  height?: number;
  onAscend: () => void;
  markers?: OverlayMarker[];
  /**
   * Click-to-descend into the L2 LOCAL layer (zoom chain step 3). Called
   * with the clicked point in FEET (region/world space) when the pointer
   * travels < 5 px between down and up (i.e., a click, not a pan).
   */
  onDescend?: (xFt: number, yFt: number) => void;
  /** Anchor cell's atlas biome color — see RegionDrawOptions.biomeColor. */
  biomeColor?: string;
}

interface RegionView {
  offsetX: number;
  offsetY: number;
  scale: number;
}

// WF-G4: the offscreen cache is rendered ONCE per region at a fixed
// resolution and blitted with scaling. The previous cache was sized
// bounds.width × view.scale — at the initial scale of 1 that meant a
// 25,000+ px canvas, silently exceeding the browser's canvas area cap and
// blitting nothing (black view). A fixed-resolution cache can never exceed
// the cap, at any zoom level.
const CACHE_MAX_SIDE = 2048;

interface RegionCacheView {
  seedPath: string;
  biomeColor?: string;
}

const RegionMapView: React.FC<RegionMapViewProps> = ({
  region,
  width = 960,
  height = 540,
  onAscend,
  markers = [],
  onDescend,
  biomeColor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cacheCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cacheViewRef = useRef<RegionCacheView | null>(null);

  // View state: scale and offsets in pixels. Lazily initialized to the
  // fitted view (WF-G4) — the old `scale: 1` initial state meant the first
  // paint rendered the region at 1 px per FOOT before the reset effect ran.
  const [view, setView] = useState<RegionView>(() =>
    computeRegionFitView(region.bounds, width, height)
  );

  // Track hover coordinates for NPC tooltips
  const [hoverPos, setHoverPos] = useState<{ x?: number; y?: number }>({});

  const isDraggingRef = useRef(false);
  const lastPointerPos = useRef({ x: 0, y: 0 });

  // Store the fitted initial scale as a ref to establish the floor threshold for auto-ascent
  const initialScaleRef = useRef(1);

  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const resetView = () => {
    // Fit to 95% of canvas size to preserve padding (pure helper, WF-G4)
    const fitted = computeRegionFitView(region.bounds, width, height);
    initialScaleRef.current = fitted.scale;
    setView(fitted);
  };

  useEffect(() => {
    resetView();
  }, [region, width, height]);

  // Pointer drag panning (+ click detection for descend)
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Capture can throw for non-standard pointers (and synthetic test
    // events) — drag/click bookkeeping must not depend on it succeeding.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch { /* uncaptured pointers still pan via move events */ }
    isDraggingRef.current = true;
    lastPointerPos.current = { x: e.clientX, y: e.clientY };
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Record current mouse cursor coordinate relative to the canvas bounding box
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setHoverPos({ x: mx, y: my });

    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastPointerPos.current.x;
    const dy = e.clientY - lastPointerPos.current.y;

    setView((v) => ({
      ...v,
      offsetX: v.offsetX + dx,
      offsetY: v.offsetY + dy,
    }));

    lastPointerPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerLeave = () => {
    setHoverPos({});
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch { /* pointer was never captured */ }
      isDraggingRef.current = false;
    }

    // Click (not pan) → descend into the local layer at the clicked point
    if (onDescend && pointerDownPos.current) {
      const travel = Math.hypot(
        e.clientX - pointerDownPos.current.x,
        e.clientY - pointerDownPos.current.y
      );
      if (travel < 5) {
        const rect = e.currentTarget.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const v = viewRef.current;
        const xFt = region.bounds.x + (mx - v.offsetX) / v.scale;
        const yFt = region.bounds.y + (my - v.offsetY) / v.scale;
        // Only inside the region window
        if (
          xFt >= region.bounds.x && xFt <= region.bounds.x + region.bounds.width &&
          yFt >= region.bounds.y && yFt <= region.bounds.y + region.bounds.height
        ) {
          onDescend(xFt, yFt);
        }
      }
    }
    pointerDownPos.current = null;
  };

  // Keyboard accessibility: Escape ascends
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onAscend();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onAscend]);

  // Mouse wheel scroll zoom with auto-ascent on floor threshold boundary
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const zoomFactor = 1.15;
      const isZoomIn = e.deltaY < 0;

      const currentView = viewRef.current;
      const nextScale = isZoomIn
        ? currentView.scale * zoomFactor
        : currentView.scale / zoomFactor;

      // Auto-ascent check: if zooming out past floor (85% of fitted initial scale)
      const floorThreshold = initialScaleRef.current * 0.85;
      if (!isZoomIn && nextScale < floorThreshold) {
        onAscend();
        return;
      }

      const boundedScale = Math.min(Math.max(floorThreshold * 0.99, nextScale), 30);
      const scaleRatio = boundedScale / currentView.scale;

      setView({
        scale: boundedScale,
        offsetX: mx - (mx - currentView.offsetX) * scaleRatio,
        offsetY: my - (my - currentView.offsetY) * scaleRatio,
      });
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [onAscend]);

  // Render redraw with caching
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const regionWidth = region.bounds.width;
    const regionHeight = region.bounds.height;
    if (!(regionWidth > 0) || !(regionHeight > 0)) return; // degenerate guard (WF-G4)

    // WF-G4: cache is rendered once per region at a FIXED resolution
    // (≤ CACHE_MAX_SIDE per side), then blitted with scaling. Zoom/pan never
    // re-rasterizes and the cache can never exceed the browser canvas cap.
    const cacheValid =
      cacheCanvasRef.current &&
      cacheViewRef.current &&
      cacheViewRef.current.seedPath === region.seedPath &&
      cacheViewRef.current.biomeColor === biomeColor;

    if (!cacheValid) {
      if (!cacheCanvasRef.current) {
        cacheCanvasRef.current = document.createElement("canvas");
      }
      const cacheCanvas = cacheCanvasRef.current;
      const cacheScale = Math.min(CACHE_MAX_SIDE / regionWidth, CACHE_MAX_SIDE / regionHeight);
      cacheCanvas.width = Math.max(1, Math.round(regionWidth * cacheScale));
      cacheCanvas.height = Math.max(1, Math.round(regionHeight * cacheScale));

      const cacheCtx = cacheCanvas.getContext("2d");
      if (cacheCtx) {
        drawRegion(cacheCtx, region, {
          width: cacheCanvas.width,
          height: cacheCanvas.height,
          scale: cacheScale,
          offsetX: 0,
          offsetY: 0,
          biomeColor,
        });
        cacheViewRef.current = { seedPath: region.seedPath, biomeColor };
      }
    }

    ctx.clearRect(0, 0, width, height);
    const cache = cacheCanvasRef.current;
    if (cache && cache.width > 0 && cache.height > 0) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        cache,
        0, 0, cache.width, cache.height,
        view.offsetX, view.offsetY,
        regionWidth * view.scale, regionHeight * view.scale
      );
    }

    // Render live markers overlay above cached region heightfield
    if (markers.length > 0) {
      drawOverlay(
        ctx,
        markers,
        {
          scale: view.scale,
          offsetX: view.offsetX,
          offsetY: view.offsetY,
          mouseX: hoverPos.x,
          mouseY: hoverPos.y,
        },
        region.bounds
      );
    }
  }, [region, view, width, height, markers, hoverPos, biomeColor]);

  const zoomAtCenter = (zoomIn: boolean) => {
    const cx = width / 2;
    const cy = height / 2;
    const zoomFactor = 1.25;
    const currentView = view;
    const nextScale = zoomIn
      ? currentView.scale * zoomFactor
      : currentView.scale / zoomFactor;

    const floorThreshold = initialScaleRef.current * 0.85;
    if (!zoomIn && nextScale < floorThreshold) {
      onAscend();
      return;
    }

    const boundedScale = Math.min(Math.max(floorThreshold * 0.99, nextScale), 30);
    const scaleRatio = boundedScale / currentView.scale;

    setView({
      scale: boundedScale,
      offsetX: cx - (cx - currentView.offsetX) * scaleRatio,
      offsetY: cy - (cy - currentView.offsetY) * scaleRatio,
    });
  };

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center bg-gray-950 border border-gray-800 rounded-xl overflow-hidden shadow-2xl transition-all duration-300 hover:border-gray-700"
      style={{ width, height }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        className="cursor-grab active:cursor-grabbing block"
      />

      {/* Floating Info Overlay (Left) */}
      <div className="absolute top-4 left-4 z-10 bg-gray-900/80 backdrop-blur-md px-3 py-2 rounded-lg border border-gray-800 pointer-events-none select-none font-mono">
        <div className="text-xs text-gray-400">
          Region Size: <span className="text-white font-bold">{Math.round(region.bounds.width).toLocaleString()} × {Math.round(region.bounds.height).toLocaleString()} ft</span>
        </div>
        <div className="text-[10px] text-gray-400 mt-0.5">
          Resolution: {region.heightfield.resolutionFt} ft | Grid: {region.heightfield.width}×{region.heightfield.height}
        </div>
      </div>

      <div className="absolute bottom-4 left-4 z-10 bg-gray-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-gray-800 text-[10px] text-gray-400 font-mono select-none">
        Press <span className="text-indigo-400 font-bold bg-gray-950 px-1 py-0.5 rounded border border-gray-800">ESC</span> or zoom out past floor to ascend
      </div>

      {/* Zoom Controls Overlay (Right) */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2 bg-gray-900/80 backdrop-blur-md p-1.5 rounded-lg border border-gray-800 shadow-lg">
        <button
          type="button"
          onClick={() => zoomAtCenter(true)}
          className="p-1.5 hover:bg-gray-800 text-gray-300 hover:text-white rounded transition-all active:scale-95"
          title="Zoom In"
        >
          <ZoomIn size={18} />
        </button>
        <button
          type="button"
          onClick={resetView}
          className="p-1.5 hover:bg-gray-800 text-gray-300 hover:text-white rounded transition-all active:scale-95"
          title="Reset View"
        >
          <Maximize size={18} />
        </button>
        <button
          type="button"
          onClick={() => zoomAtCenter(false)}
          className="p-1.5 hover:bg-gray-800 text-gray-300 hover:text-white rounded transition-all active:scale-95"
          title="Zoom Out"
        >
          <ZoomOut size={18} />
        </button>
      </div>
    </div>
  );
};

export default React.memo(RegionMapView);
