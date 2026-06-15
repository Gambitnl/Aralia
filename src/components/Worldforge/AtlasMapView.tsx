// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 09:06:27
 * Dependents: components/Worldforge/AtlasDemo.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This component provides an interactive map viewer for the procedural atlas.
 *
 * It embeds a 2D canvas, handles user interactions for panning and zooming,
 * and calls the pure draw core to redraw the map cells, coastlines, and rivers.
 * To optimize rendering performance during pan actions, it caches the drawn
 * layers onto an offscreen canvas. Panning simply copies the offscreen canvas,
 * whereas zooming invalidates the cache and triggers a redraw.
 *
 * Called by: Game screens displaying the world map.
 * Depends on: atlasDraw.ts (for map rendering), generateAtlas.ts (supplies the data prop)
 */

import React, { useRef, useEffect, useState } from "react";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { drawAtlas, isCacheValid, drawScaleBar, type AtlasOverlayMode, type AtlasView, type CacheView } from "./atlasDraw";

// Zoom scale at which scroll-zoom hands off to the L1 region layer.
// Raised 4.0 â†’ 16.0 (Remy, 2026-06-11): deep atlas browsing first.
const DESCEND_SCALE = 16.0;

// Up to this scale the whole map is cached at scale (cheap: â‰¤ 3840Ã—2160).
// Beyond it a full-map cache would explode (16Ã— â‰ˆ 530 MB of canvas), so the
// draw effect switches to a viewport-anchored cache instead.
const FULL_CACHE_MAX_SCALE = 4.0;

// Overscan around the viewport in the deep-zoom cache: panning within this
// margin blits from cache; exiting it re-renders at the new anchor.
const DEEP_CACHE_MARGIN_PX = 512;
import type { FmgAtlasResult } from "../../systems/worldforge/fmg/generateAtlas";
import { drawOverlay, type OverlayMarker } from "./overlay";


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
  /** Toggle scale bar rendering. Default is true. */
  showScaleBar?: boolean;
  /** Toggle graticule grid rendering. Default is false. */
  showGraticule?: boolean;
  /** Toggle political overlay rendering. Default is false. */
  showPolitical?: boolean;
  /** Mutually exclusive atlas cell tint source. Political remains the default mode. */
  overlayMode?: AtlasOverlayMode;
  showMarkers?: boolean;
  showZones?: boolean;
  showMilitary?: boolean;
  /** Voronoi cell mesh overlay (Azgaar "Cells" layer). Default false. */
  showCells?: boolean;
  /** Callback triggered when a Voronoi cell is clicked (scroll auto-descend). */
  onCellClick?: (cellId: number) => void;
  /** Callback triggered when a cell is selected by a pointer click (inspect). */
  onCellSelect?: (cellId: number) => void;
  /** Currently selected cell id to highlight, or null for none. */
  selectedCellId?: number | null;
  /** Travel mode: shows the cell mesh and highlights the cell under the cursor. */
  travelMode?: boolean;
  /** Optional viewport parameters to restore. */
  initialView?: AtlasView;
  /** Optional callback to notify viewport parameter updates. */
  onViewChange?: (view: AtlasView) => void;
  /** If true, zoom auto-descent is disabled. */
  cooldownActive?: boolean;
  /** Optional array of live overlay markers. */
  markers?: OverlayMarker[];
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
  showScaleBar = true,
  showGraticule = false,
  showPolitical = false,
  overlayMode = "political",
  showMarkers = false,
  showZones = false,
  showMilitary = false,
  showCells = false,
  onCellClick,
  onCellSelect,
  selectedCellId = null,
  travelMode = false,
  initialView,
  onViewChange,
  cooldownActive,
  markers = [],
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Offscreen canvas for rendering cache
  const cacheCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Records the zoom scale, seed, graticule, and political status of the current cache
  const cacheViewRef = useRef<CacheView | null>(null);
  // Deep-zoom cache anchor: the view offsets + canvas size the viewport cache
  // was rendered at (null = shallow-zoom full-map cache is active). Size is
  // part of validity since the autofit layout resizes the canvas live.
  const deepAnchorRef = useRef<{ offsetX: number; offsetY: number; width: number; height: number } | null>(null);

  // Panning offset (pixels) and scale factor
  const [view, setView] = useState<AtlasView>({
    offsetX: 0,
    offsetY: 0,
    scale: 1,
  });

  // Track mouse coordinates on canvas for NPC tooltip hovers
  const [hoverPos, setHoverPos] = useState<{ x?: number; y?: number }>({});

  // Cell under the cursor in travel mode (drives the cursor-following highlight).
  const [hoveredCellId, setHoveredCellId] = useState<number | null>(null);

  // Nearest-centroid hit test: map a screen point to the cell whose centroid is
  // closest (Voronoi cells own the region nearest their centroid). Shared by
  // click-select and travel hover. Returns -1 when no cell qualifies.
  const cellAtScreenPoint = (screenX: number, screenY: number, v: AtlasView): number => {
    const mapX = (screenX - v.offsetX) / v.scale;
    const mapY = (screenY - v.offsetY) / v.scale;
    const { cells } = atlas.pack;
    let nearest = -1;
    let minDistSq = Infinity;
    for (let i = 0; i < cells.p.length; i++) {
      const p = cells.p[i];
      if (!p) continue;
      const dx = mapX - p[0];
      const dy = mapY - p[1];
      const distSq = dx * dx + dy * dy;
      if (distSq < minDistSq) {
        minDistSq = distSq;
        nearest = i;
      }
    }
    return nearest;
  };

  // Track if mouse/pointer is currently dragging
  const isDraggingRef = useRef(false);
  // Store the last coordinates of the pointer to compute movement delta
  const lastPointerPos = useRef({ x: 0, y: 0 });

  // Click tracking refs to distinguish click from drag
  const clickStartPos = useRef({ x: 0, y: 0 });
  const clickStartTime = useRef(0);

  // Store a reference to the latest view state for use in the wheel event listener.
  // This avoids re-registering the non-passive event listener on every redraw.
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Notify parent of view updates
  useEffect(() => {
    if (onViewChange) {
      onViewChange(view);
    }
  }, [view, onViewChange]);

  // --------------------------------------------------------------------------
  // Reset and Centering Viewport
  // --------------------------------------------------------------------------
  // Automatically centers and fits the atlas to the canvas when dimensions or
  // the atlas itself changes.
  // --------------------------------------------------------------------------
  // Fit the whole map into the viewport, centered. Used by the reset button
  // fallback AND the lost-in-the-abyss recenter pill (Remy, 2026-06-11) â€”
  // the pill must ALWAYS fit, never restore a saved (possibly lost) view.
  const fitView = () => {
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

  const resetView = () => {
    if (initialView) {
      setView(initialView);
      return;
    }
    fitView();
  };

  useEffect(() => {
    resetView();
  }, [width, height, atlas.graphWidth, atlas.graphHeight, initialView]);

  // --------------------------------------------------------------------------
  // Pointer Drag-Pan Interaction Handlers
  // --------------------------------------------------------------------------
  // Listens to pointer down, move, and up to drag and pan across the map.
  // --------------------------------------------------------------------------
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    lastPointerPos.current = { x: e.clientX, y: e.clientY };

    // Record click start characteristics
    clickStartPos.current = { x: e.clientX, y: e.clientY };
    clickStartTime.current = performance.now();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Record current mouse cursor coordinate relative to the canvas bounding box
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setHoverPos({ x: mx, y: my });

    // Travel mode: track the cell under the cursor so the highlight follows the
    // mouse from cell to cell. Skipped while dragging (panning) to avoid churn.
    if (travelMode && !isDraggingRef.current) {
      const id = cellAtScreenPoint(mx, my, view);
      setHoveredCellId((prev) => (prev === id ? prev : id));
    }

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
    // Reset hover coordinates when mouse pointer leaves canvas bounds
    setHoverPos({});
    setHoveredCellId(null);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      isDraggingRef.current = false;
    }

    // Click detection: short duration and minimal distance movement
    const dx = e.clientX - clickStartPos.current.x;
    const dy = e.clientY - clickStartPos.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const duration = performance.now() - clickStartTime.current;

    // A genuine click (not a drag) SELECTS the cell for inspection — including
    // water cells (the info panel reports "Ocean/Lake"). Descent is an explicit
    // action from the info panel, or the scroll-zoom auto-descent below.
    if (dist < 6 && duration < 350 && (onCellSelect || onCellClick)) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Translate click coordinates from screen space back to map graph space
      const mapX = (clickX - view.offsetX) / view.scale;
      const mapY = (clickY - view.offsetY) / view.scale;

      // Find the nearest cell centroid (Voronoi cell containing coordinates)
      const { cells } = atlas.pack;
      let nearestCellId = -1;
      let minDistanceSq = Infinity;

      for (let i = 0; i < cells.p.length; i++) {
        const p = cells.p[i];
        if (!p) continue;
        const cdx = mapX - p[0];
        const cdy = mapY - p[1];
        const distSq = cdx * cdx + cdy * cdy;
        if (distSq < minDistanceSq) {
          minDistanceSq = distSq;
          nearestCellId = i;
        }
      }

      if (nearestCellId !== -1) {
        if (onCellSelect) onCellSelect(nearestCellId);
        else if (onCellClick) onCellClick(nearestCellId);
      }
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

      // Translate cursor position to map graph space to find cell under mouse
      const mapX = (mx - currentView.offsetX) / currentView.scale;
      const mapY = (my - currentView.offsetY) / currentView.scale;

      const { cells } = atlas.pack;
      let nearestCellId = -1;
      let minDistanceSq = Infinity;
      for (let i = 0; i < cells.p.length; i++) {
        const p = cells.p[i];
        if (!p) continue;
        const cdx = mapX - p[0];
        const cdy = mapY - p[1];
        const distSq = cdx * cdx + cdy * cdy;
        if (distSq < minDistanceSq) {
          minDistanceSq = distSq;
          nearestCellId = i;
        }
      }

      const height = nearestCellId !== -1 ? cells.h[nearestCellId] : 0;

      // Auto-descent check when zooming in past the descend threshold.
      // Raised 4.0 â†’ 16.0 (Remy, 2026-06-11): the atlas itself should be
      // browsable at depth â€” state borders, burg clusters, river detail â€”
      // before the zoom gesture hands off to the L1 region layer. Deep zoom
      // is affordable because the draw cache below switches to a
      // viewport-anchored strategy past FULL_CACHE_MAX_SCALE.
      if (isZoomIn && nextScale >= DESCEND_SCALE && !cooldownActive) {
        if (height >= 20 && nearestCellId !== -1 && onCellClick) {
          onCellClick(nearestCellId);
          return;
        } else {
          // Clamp over water
          const boundedScale = DESCEND_SCALE - 0.01;
          const scaleRatio = boundedScale / currentView.scale;
          setView({
            scale: boundedScale,
            offsetX: mx - (mx - currentView.offsetX) * scaleRatio,
            offsetY: my - (my - currentView.offsetY) * scaleRatio,
          });
          if (nearestCellId !== -1 && onCellClick) {
            onCellClick(nearestCellId); // Trigger water hint message
          }
          return;
        }
      }

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
  }, [atlas, onCellClick, cooldownActive]);

  // --------------------------------------------------------------------------
  // Draw Redraw Effect (with Offscreen Canvas Cache)
  // --------------------------------------------------------------------------
  // Renders static map layers onto an offscreen canvas at the current scale,
  // then blits it to the main canvas. If only panning occurs, the cached
  // canvas is immediately blitted, skipping redraws of 10,000+ polygons.
  // --------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const atlasWidth = atlas.graphWidth ?? 960;
    const atlasHeight = atlas.graphHeight ?? 540;

    // Cache metadata validity (scale + seed + layer toggles) â€” shared by both
    // cache strategies below.
    const metaValid =
      cacheCanvasRef.current &&
      cacheViewRef.current &&
      isCacheValid(
        cacheViewRef.current,
        view.scale,
        atlas.seed,
        showGraticule,
        showPolitical,
        showMarkers,
        showZones,
        showMilitary,
        overlayMode,
        showCells
      );

    if (view.scale <= FULL_CACHE_MAX_SCALE) {
      // â”€â”€ Shallow zoom: cache the WHOLE map at scale (pan = free blit) â”€â”€â”€â”€
      deepAnchorRef.current = null;
      if (!metaValid) {
        if (!cacheCanvasRef.current) {
          cacheCanvasRef.current = document.createElement("canvas");
        }
        const cacheCanvas = cacheCanvasRef.current;
        cacheCanvas.width = atlasWidth * view.scale;
        cacheCanvas.height = atlasHeight * view.scale;

        const cacheCtx = cacheCanvas.getContext("2d");
        if (cacheCtx) {
          // Draw the static layers once onto the offscreen canvas at scale, with 0 offset.
          // We pass showScaleBar: false since the scale bar is a viewport-space element drawn on the main canvas.
          drawAtlas(cacheCtx, atlas, {
            scale: view.scale,
            offsetX: 0,
            offsetY: 0,
            showScaleBar: false,
            showGraticule,
            showPolitical,
            overlayMode,
            showMarkers,
            showZones,
            showMilitary,
            showCells,
          });
          cacheViewRef.current = {
            scale: view.scale,
            seed: atlas.seed,
            showGraticule,
            showPolitical,
            overlayMode,
            showMarkers,
            showZones,
            showMilitary,
            showCells,
          };
        }
      }

      ctx.clearRect(0, 0, width, height);
      if (cacheCanvasRef.current) {
        ctx.drawImage(cacheCanvasRef.current, view.offsetX, view.offsetY);
      }
    } else {
      // â”€â”€ Deep zoom: viewport-anchored cache with overscan margin â”€â”€â”€â”€â”€â”€â”€â”€
      // A full-map cache at 16Ã— would be a ~530 MB canvas (and silently break
      // past the browser's canvas area cap â€” the WF-G4 lesson). Instead,
      // render only viewport+margin at the current offsets; panning within
      // the margin blits, panning past it re-anchors and re-renders.
      const anchor = deepAnchorRef.current;
      const anchorValid =
        anchor &&
        anchor.width === width &&
        anchor.height === height &&
        Math.abs(view.offsetX - anchor.offsetX) <= DEEP_CACHE_MARGIN_PX &&
        Math.abs(view.offsetY - anchor.offsetY) <= DEEP_CACHE_MARGIN_PX;

      if (!metaValid || !anchorValid) {
        if (!cacheCanvasRef.current) {
          cacheCanvasRef.current = document.createElement("canvas");
        }
        const cacheCanvas = cacheCanvasRef.current;
        cacheCanvas.width = width + DEEP_CACHE_MARGIN_PX * 2;
        cacheCanvas.height = height + DEEP_CACHE_MARGIN_PX * 2;

        const cacheCtx = cacheCanvas.getContext("2d");
        if (cacheCtx) {
          // Same worldâ†’pixel transform as the screen, shifted by the margin:
          // cacheX = mapXÂ·scale + view.offsetX + MARGIN.
          drawAtlas(cacheCtx, atlas, {
            scale: view.scale,
            offsetX: view.offsetX + DEEP_CACHE_MARGIN_PX,
            offsetY: view.offsetY + DEEP_CACHE_MARGIN_PX,
            showScaleBar: false,
            showGraticule,
            showPolitical,
            overlayMode,
            showMarkers,
            showZones,
            showMilitary,
            showCells,
          });
          cacheViewRef.current = {
            scale: view.scale,
            seed: atlas.seed,
            showGraticule,
            showPolitical,
            overlayMode,
            showMarkers,
            showZones,
            showMilitary,
            showCells,
          };
          deepAnchorRef.current = { offsetX: view.offsetX, offsetY: view.offsetY, width, height };
        }
      }

      ctx.clearRect(0, 0, width, height);
      const liveAnchor = deepAnchorRef.current;
      if (cacheCanvasRef.current && liveAnchor) {
        ctx.drawImage(
          cacheCanvasRef.current,
          (view.offsetX - liveAnchor.offsetX) - DEEP_CACHE_MARGIN_PX,
          (view.offsetY - liveAnchor.offsetY) - DEEP_CACHE_MARGIN_PX
        );
      }
    }

    // Render dynamic live overlay markers above the cached terrain layers
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
        }
      );
    }

    // Trace a cell's Voronoi polygon in screen space above the cached terrain
    // (the cache is shared across selections/hovers, so highlights must be live
    // overlays rather than baked in).
    const traceCell = (cellId: number) => {
      const vIdx = atlas.pack.cells.v?.[cellId];
      const vPts = atlas.pack.vertices?.p;
      if (!vIdx || vIdx.length < 3 || !vPts) return false;
      ctx.beginPath();
      for (let i = 0; i < vIdx.length; i++) {
        const pt = vPts[vIdx[i]];
        if (!pt) continue;
        const sx = pt[0] * view.scale + view.offsetX;
        const sy = pt[1] * view.scale + view.offsetY;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      return true;
    };

    // Travel-mode hover: a light reddish border on the cell under the cursor,
    // following the mouse from cell to cell. Drawn beneath the selection ring.
    if (travelMode && hoveredCellId != null && hoveredCellId >= 0 && hoveredCellId !== selectedCellId) {
      if (traceCell(hoveredCellId)) {
        ctx.fillStyle = "rgba(248, 113, 113, 0.16)";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(248, 113, 113, 0.9)";
        ctx.stroke();
      }
    }

    // Selected cell: a firmer indigo ring (persists across hovers).
    if (selectedCellId != null && selectedCellId >= 0) {
      if (traceCell(selectedCellId)) {
        ctx.fillStyle = "rgba(99, 102, 241, 0.22)";
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "rgba(165, 180, 252, 0.95)";
        ctx.stroke();
      }
    }

    // Draw the scale bar directly on the main canvas at the correct screen position
    if (showScaleBar) {
      drawScaleBar(ctx, atlas, {
        scale: view.scale,
        offsetX: view.offsetX,
        offsetY: view.offsetY,
        showScaleBar,
        showGraticule,
        showPolitical,
        overlayMode,
      });
    }
  }, [atlas, view, width, height, showScaleBar, showGraticule, showPolitical, overlayMode, showMarkers, showZones, showMilitary, showCells, markers, hoverPos, selectedCellId, travelMode, hoveredCellId]);

  // Clear the hover highlight when travel mode is switched off.
  useEffect(() => {
    if (!travelMode) setHoveredCellId(null);
  }, [travelMode]);

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

  // Lost-in-the-abyss detection (Remy, 2026-06-11): if the map's screen rect
  // barely (or not at all) intersects the viewport, surface a recenter pill.
  const mapScreenW = (atlas.graphWidth ?? 960) * view.scale;
  const mapScreenH = (atlas.graphHeight ?? 540) * view.scale;
  const visibleW = Math.min(view.offsetX + mapScreenW, width) - Math.max(view.offsetX, 0);
  const visibleH = Math.min(view.offsetY + mapScreenH, height) - Math.max(view.offsetY, 0);
  const mapLost = visibleW < 80 || visibleH < 80;

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
        onPointerLeave={handlePointerLeave}
        className="cursor-grab active:cursor-grabbing block"
      />

      {/* Recenter pill â€” shown when the map has been panned out of view */}
      {mapLost && (
        <button
          type="button"
          onClick={fitView}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-2xl shadow-indigo-900/50 transition-all active:scale-95 animate-pulse"
        >
          <Maximize size={16} />
          Recenter Map
        </button>
      )}

      {/* Floating Info Overlay (bottom-left â€” top-left belongs to the demo's
          options panel since the autofit layout change) */}
      <div className="absolute bottom-4 left-4 z-10 bg-gray-900/80 backdrop-blur-md px-3 py-2 rounded-lg border border-gray-800 pointer-events-none select-none">
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
          title="Recenter / Fit Map"
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

