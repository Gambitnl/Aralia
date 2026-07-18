// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 17/07/2026, 22:34:53
 * Dependents: components/Worldforge/AtlasDemo.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useRef, useEffect, useState } from "react";
import { ZoomIn, ZoomOut, Maximize, Footprints } from "lucide-react";
import { drawLocalFeatures, rasterizeLocalTerrain } from "./localDraw";
import { computeRegionFitView } from "./regionDraw";
import type { LocalArtifact } from "../../systems/worldforge/artifacts";
import { groundFocusesForLocal, type GroundFocus } from "../../systems/worldforge/leaf3d/atlasGroundDrilldown";
import { drawOverlay, type OverlayMarker } from "./overlay";

/**
 * Interactive viewport for the L2 LOCAL layer (3,000 ft / 600×600 5-ft
 * cells) — the third step of the Worldforge zoom chain (Atlas → Region →
 * LOCAL) and the visual quality bar for replacing the legacy Submap
 * (Remy's 2026-06-11 focus). Mirrors RegionMapView's interaction grammar:
 * drag-pan, wheel zoom toward cursor, zoom-out-past-floor or Esc to ascend.
 *
 * Terrain caching: the artifact rasterizes ONCE per seedPath into a
 * native-resolution (600×600) offscreen canvas; pans/zooms blit it scaled.
 * Feature glyphs redraw at view scale each frame so they stay crisp.
 */

export interface LocalMapViewProps {
  local: LocalArtifact;
  width?: number;
  height?: number;
  onAscend: () => void;
  /** Atlas biome hue — carries the L0→L1→L2 coherence chain (localDraw). */
  biomeColor?: string;
  onEnterGround?: (focus: GroundFocus) => void;
  /** Exact-feet discoveries belonging to this canonical world/Local. */
  markers?: OverlayMarker[];
}

/**
 * L2 map readout placement. The Worldforge shell owns the top-left mobile
 * controls, so the local identity chip drops below that stack on phone widths
 * while preserving the original top-left position on desktop.
 */
export const localMapInfoChipClassName =
  "absolute top-40 left-2 right-2 z-10 bg-gray-900/80 backdrop-blur-md px-3 py-2 rounded-lg border border-gray-800 pointer-events-none select-none font-mono sm:top-4 sm:left-4 sm:right-auto";

interface LocalView {
  offsetX: number;
  offsetY: number;
  scale: number;
}

const LocalMapView: React.FC<LocalMapViewProps> = ({
  local,
  width = 960,
  height = 540,
  onAscend,
  biomeColor,
  onEnterGround,
  markers = [],
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const terrainCacheRef = useRef<{ seedPath: string; biomeColor?: string; canvas: HTMLCanvasElement } | null>(null);

  const [view, setView] = useState<LocalView>(() =>
    computeRegionFitView(local.bounds, width, height)
  );

  const isDraggingRef = useRef(false);
  const lastPointerPos = useRef({ x: 0, y: 0 });
  const initialScaleRef = useRef(1);
  const viewRef = useRef(view);
  const townIdentity = local.townPlan?.identity;
  const townRelationships = townIdentity
    ? [
        townIdentity.settlementType,
        townIdentity.hasRoadAccess ? 'road-linked' : null,
        townIdentity.hasRiverAccess ? 'river-linked' : null,
        townIdentity.isCoastal ? 'coastal' : null,
      ].filter((label): label is string => label !== null)
    : [];
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const resetView = () => {
    const fitted = computeRegionFitView(local.bounds, width, height);
    initialScaleRef.current = fitted.scale;
    setView(fitted);
  };

  useEffect(() => {
    resetView();
  }, [local, width, height]);

  // Esc ascends (back to the region view)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onAscend();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onAscend]);

  // Pointer drag panning
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch { /* uncaptured pointers still pan via move events */ }
    isDraggingRef.current = true;
    lastPointerPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastPointerPos.current.x;
    const dy = e.clientY - lastPointerPos.current.y;
    setView((v) => ({ ...v, offsetX: v.offsetX + dx, offsetY: v.offsetY + dy }));
    lastPointerPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch { /* pointer was never captured */ }
      isDraggingRef.current = false;
    }
  };

  // Wheel zoom with auto-ascent on the floor threshold (RegionMapView grammar)
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

      const floorThreshold = initialScaleRef.current * 0.85;
      if (!isZoomIn && nextScale < floorThreshold) {
        onAscend();
        return;
      }

      // Ceiling: ~4 px per FOOT (≈20 px per 5-ft cell) — plenty for
      // inspecting individual cells without runaway blit sizes.
      const boundedScale = Math.min(Math.max(floorThreshold * 0.99, nextScale), 4);
      const scaleRatio = boundedScale / currentView.scale;

      setView({
        scale: boundedScale,
        offsetX: mx - (mx - currentView.offsetX) * scaleRatio,
        offsetY: my - (my - currentView.offsetY) * scaleRatio,
      });
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [onAscend]);

  // Render: cached native-res terrain blit + live feature glyphs
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // (Re)build the terrain cache once per artifact (+ biome tint)
    if (
      !terrainCacheRef.current ||
      terrainCacheRef.current.seedPath !== local.seedPath ||
      terrainCacheRef.current.biomeColor !== biomeColor
    ) {
      const stage = document.createElement("canvas");
      stage.width = local.terrain.widthCells;
      stage.height = local.terrain.heightCells;
      const stageCtx = stage.getContext("2d");
      if (stageCtx) {
        stageCtx.putImageData(rasterizeLocalTerrain(local, biomeColor), 0, 0);
        terrainCacheRef.current = { seedPath: local.seedPath, biomeColor, canvas: stage };
      }
    }

    ctx.fillStyle = "#0c1824";
    ctx.fillRect(0, 0, width, height);

    const cache = terrainCacheRef.current;
    if (cache) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        cache.canvas,
        0, 0, cache.canvas.width, cache.canvas.height,
        view.offsetX, view.offsetY,
        local.bounds.width * view.scale, local.bounds.height * view.scale
      );
    }

    // Features draw at view scale so glyphs stay crisp when zoomed
    drawLocalFeatures(ctx, local, {
      scale: view.scale,
      offsetX: view.offsetX,
      offsetY: view.offsetY,
    });
    // Persistent discoveries share the same absolute-feet coordinate space as
    // Local features, so the overlay lands on the precise ground source.
    drawOverlay(ctx, markers, {
      scale: view.scale,
      offsetX: view.offsetX,
      offsetY: view.offsetY,
    }, local.bounds);
  }, [local, view, width, height, biomeColor, markers]);

  const zoomAtCenter = (zoomIn: boolean) => {
    const cx = width / 2;
    const cy = height / 2;
    const zoomFactor = 1.25;
    const currentView = view;
    const nextScale = zoomIn ? currentView.scale * zoomFactor : currentView.scale / zoomFactor;

    const floorThreshold = initialScaleRef.current * 0.85;
    if (!zoomIn && nextScale < floorThreshold) {
      onAscend();
      return;
    }

    const boundedScale = Math.min(Math.max(floorThreshold * 0.99, nextScale), 4);
    const scaleRatio = boundedScale / currentView.scale;
    setView({
      scale: boundedScale,
      offsetX: cx - (cx - currentView.offsetX) * scaleRatio,
      offsetY: cy - (cy - currentView.offsetY) * scaleRatio,
    });
  };

  return (
    <div
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
        className="cursor-grab active:cursor-grabbing block"
      />

      {/* Info chip — L2 identity */}
      <div className={localMapInfoChipClassName}>
        {local.townPlan && (
          <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-bold text-amber-100">
              {townIdentity?.name ?? `Town ${local.townPlan.burgId}`}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-amber-400/80">
              {townIdentity
                ? `${townIdentity.sourceKind} #${townIdentity.sourceId}`
                : `burg #${local.townPlan.burgId}`}
            </span>
          </div>
        )}
        <div className="text-xs text-gray-400">
          Local Area: <span className="text-white font-bold">{Math.round(local.bounds.width).toLocaleString()} × {Math.round(local.bounds.height).toLocaleString()} ft</span>
        </div>
        <div className="text-[10px] text-gray-400 mt-0.5">
          Grid: {local.terrain.widthCells}×{local.terrain.heightCells} @ 5 ft | Features: {local.features.length}
        </div>
        {townIdentity && (
          <div className="mt-1 text-[10px] capitalize text-sky-200/80">
            Biome #{townIdentity.biomeId} / {townRelationships.join(' / ')}
          </div>
        )}
      </div>

      <div className="absolute bottom-4 left-4 z-10 bg-gray-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-gray-800 text-[10px] text-gray-400 font-mono select-none">
        Press <span className="text-indigo-400 font-bold bg-gray-950 px-1 py-0.5 rounded border border-gray-800">ESC</span> or zoom out past floor to ascend
      </div>

      {onEnterGround && (
        <div className="absolute bottom-20 left-2 right-2 z-20 flex flex-wrap gap-2 rounded-xl border border-amber-400/30 bg-gray-950/90 p-2 shadow-xl backdrop-blur sm:left-4 sm:right-auto sm:max-w-[70%]">
          {groundFocusesForLocal(local).map((focus) => (
            <button
              key={`${focus.kind}:${String(focus.id)}`}
              type="button"
              onClick={() => onEnterGround(focus)}
              aria-label={`Enter ${focus.label} on Ground`}
              className="flex min-h-11 items-center gap-2 rounded-lg border border-amber-300/40 bg-amber-950/80 px-3 text-xs font-semibold text-amber-100 hover:bg-amber-900"
            >
              <Footprints size={16} />
              <span className="flex flex-col items-start leading-tight">
                <span>Enter Ground</span>
                <span className="text-[10px] font-normal text-amber-200/80">{focus.label}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Zoom controls. Keep icon-only map controls at the shared 44px target
          size so cramped panes remain usable without changing map behavior. */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2 bg-gray-900/80 backdrop-blur-md p-1.5 rounded-lg border border-gray-800 shadow-lg">
        <button
          type="button"
          onClick={() => zoomAtCenter(true)}
          className="flex min-h-11 min-w-11 items-center justify-center p-2 hover:bg-gray-800 text-gray-300 hover:text-white rounded transition-all active:scale-95"
          title="Zoom In"
        >
          <ZoomIn size={18} />
        </button>
        <button
          type="button"
          onClick={resetView}
          className="flex min-h-11 min-w-11 items-center justify-center p-2 hover:bg-gray-800 text-gray-300 hover:text-white rounded transition-all active:scale-95"
          title="Recenter / Fit Map"
        >
          <Maximize size={18} />
        </button>
        <button
          type="button"
          onClick={() => zoomAtCenter(false)}
          className="flex min-h-11 min-w-11 items-center justify-center p-2 hover:bg-gray-800 text-gray-300 hover:text-white rounded transition-all active:scale-95"
          title="Zoom Out"
        >
          <ZoomOut size={18} />
        </button>
      </div>
    </div>
  );
};

export default React.memo(LocalMapView);
