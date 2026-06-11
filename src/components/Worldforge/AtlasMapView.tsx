/**
 * This component provides an interactive map viewer for the procedural atlas.
 *
 * It embeds a 2D canvas, handles user interactions for panning and zooming,
 * and calls the pure draw core to redraw the map cells, coastlines, and rivers.
 * The zoom logic is centered around the user's cursor position for a smooth feel.
 *
 * Called by: Game screens displaying the world map.
 * Depends on: atlasDraw.ts (for map rendering), generateAtlas.ts (supplies the data prop)
 */

import React, { useRef, useEffect, useState } from "react";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { drawAtlas, type AtlasView } from "./atlasDraw";
import type { FmgAtlasResult } from "../../systems/worldforge/fmg/generateAtlas";

// ============================================================================
// Props & Types
// ============================================================================
// Defines input props. Sane defaults are provided for size (960x540 aspect).
// ============================================================================

export interface AtlasMapViewProps {
  /** The generated atlas data from the FMG procedural engine. */
  atlas: FmgAtlasResult;
  /** Width of the map canvas container in pixels. Default is 960. */
  width?: number;
  /** Height of the map canvas container in pixels. Default is 540. */
  height?: number;
}

// ============================================================================
// React Component
// ============================================================================
// Owns the canvas and manages the zoom/pan view coordinates.
// ============================================================================

const AtlasMapView: React.FC<AtlasMapViewProps> = ({
  atlas,
  width = 960,
  height = 540,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Panning offset (pixels) and scale factor
  const [view, setView] = useState<AtlasView>({
    offsetX: 0,
    offsetY: 0,
    scale: 1,
  });

  // Track if mouse/pointer is currently dragging
  const isDraggingRef = useRef(false);
  // Store the last coordinates of the pointer to compute movement delta
  const lastPointerPos = useRef({ x: 0, y: 0 });

  // Store a reference to the latest view state for use in the wheel event listener.
  // This avoids re-registering the non-passive event listener on every redraw.
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // --------------------------------------------------------------------------
  // Reset and Centering Viewport
  // --------------------------------------------------------------------------
  // Automatically centers and fits the atlas to the canvas when dimensions or
  // the atlas itself changes.
  // --------------------------------------------------------------------------
  const resetView = () => {
    const atlasWidth = atlas.graphWidth ?? 960;
    const atlasHeight = atlas.graphHeight ?? 540;
    const scaleX = width / atlasWidth;
    const scaleY = height / atlasHeight;
    const initialScale = Math.min(scaleX, scaleY);

    setView({
      scale: initialScale,
      offsetX: (width - atlasWidth * initialScale) / 2,
      offsetY: (height - atlasHeight * initialScale) / 2,
    });
  };

  useEffect(() => {
    resetView();
  }, [width, height, atlas.graphWidth, atlas.graphHeight]);

  // --------------------------------------------------------------------------
  // Pointer Drag-Pan Interaction Handlers
  // --------------------------------------------------------------------------
  // Listens to pointer down, move, and up to drag and pan across the map.
  // --------------------------------------------------------------------------
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    lastPointerPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
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

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      isDraggingRef.current = false;
    }
  };

  // --------------------------------------------------------------------------
  // Wheel Zoom Interaction
  // --------------------------------------------------------------------------
  // Listens to non-passive wheel events to adjust scale (zoom) toward the cursor coordinates.
  // --------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      // Prevent default page scroll
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();
      // Calculate mouse position relative to canvas coordinate space
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Adjust zoom multiplier based on scroll delta direction
      const zoomFactor = 1.15;
      const isZoomIn = e.deltaY < 0;

      const currentView = viewRef.current;
      const nextScale = isZoomIn
        ? currentView.scale * zoomFactor
        : currentView.scale / zoomFactor;

      // Bound scale factor between 0.1x and 20x to avoid extreme render errors
      const boundedScale = Math.min(Math.max(0.1, nextScale), 20);
      const scaleRatio = boundedScale / currentView.scale;

      setView({
        scale: boundedScale,
        offsetX: mx - (mx - currentView.offsetX) * scaleRatio,
        offsetY: my - (my - currentView.offsetY) * scaleRatio,
      });
    };

    // Attach listener with passive: false so preventDefault() works reliably
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  // --------------------------------------------------------------------------
  // Draw Redraw Effect
  // --------------------------------------------------------------------------
  // Triggers the canvas rendering loop when the atlas data or view state changes.
  // --------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawAtlas(ctx, atlas, view);
  }, [atlas, view]);

  // --------------------------------------------------------------------------
  // Button-Triggered Zoom Helpers
  // --------------------------------------------------------------------------
  // Triggers zoom actions centered on the current canvas center coordinate.
  // --------------------------------------------------------------------------
  const zoomAtCenter = (zoomIn: boolean) => {
    const cx = width / 2;
    const cy = height / 2;
    const zoomFactor = 1.25;
    const currentView = view;
    const nextScale = zoomIn
      ? currentView.scale * zoomFactor
      : currentView.scale / zoomFactor;
    const boundedScale = Math.min(Math.max(0.1, nextScale), 20);
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
      {/* Interactive Canvas Surface */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="cursor-grab active:cursor-grabbing block"
      />

      {/* Floating Info Overlay (Left) */}
      <div className="absolute top-4 left-4 z-10 bg-gray-900/80 backdrop-blur-md px-3 py-2 rounded-lg border border-gray-800 pointer-events-none select-none">
        <div className="text-xs text-gray-400 font-mono">
          Seed: <span className="text-white font-bold">{atlas.seed}</span>
        </div>
        <div className="text-[10px] text-gray-500 font-mono mt-0.5">
          Cells: {atlas.pack.cells.h.length} | Rivers: {atlas.pack.rivers?.length ?? 0}
        </div>
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

export default React.memo(AtlasMapView);
