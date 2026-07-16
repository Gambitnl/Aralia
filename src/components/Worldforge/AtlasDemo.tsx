// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/07/2026, 22:43:05
 * Dependents: App.tsx
 * Imports: 18 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This component provides an interactive developer dashboard to test and explore
 * the procedural world generation engine.
 *
 * It provides inputs for configuring world seed, heightmap template, and cell density,
 * triggers the procedural generation pipeline synchronously, and displays the map output
 * inside the interactive AtlasMapView viewport. It also supports descending (clicking)
 * into a refined L1 local region view for any selected land cell.
 *
 * Called by: Dev sandbox, orchestrator proof rigs, or game setup screens.
 * Depends on:
 *   - generateAtlas.ts (L0 atlas generator)
 *   - generateRegion.ts (L1 region generator)
 *   - regionDraw.ts (pure L1 region renderer)
 *   - AtlasMapView.tsx (interactive L0 viewport)
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Sparkles, Dices, Settings, Activity, Layers, Map, ArrowLeft, Info, HelpCircle, Menu, PanelLeftClose, MapPin } from "lucide-react";
import { generateFmgAtlas, type FmgAtlasResult } from "../../systems/worldforge/fmg/generateAtlas";
import { generateFmgWorld } from "../../systems/worldforge/fmg/generateWorld";
import { heightmapTemplates } from "../../systems/worldforge/fmg/heightmap-templates";
import { generateRegion } from "../../systems/worldforge/region/generateRegion";
import { generateLocal } from "../../systems/worldforge/local/generateLocal";
import { rootSeedPath } from "../../systems/worldforge/seedPath";
import { FEET_PER_FMG_PIXEL } from "../../systems/worldforge/adapter/atlasArtifact";
import type { LocalArtifact, RegionArtifact } from "../../systems/worldforge/artifacts";
import type { AtlasOverlayMode, AtlasView } from "./atlasDraw";
import AtlasMapView from "./AtlasMapView";
import RegionMapView from "./RegionMapView";
import LocalMapView from "./LocalMapView";
import WorldforgeGroundDrilldown from "./WorldforgeGroundDrilldown";
import CellInfoPanel from "./CellInfoPanel";
import { describeCell } from "../../systems/worldforge/cellInfo";
import { type OverlayMarker } from "./overlay";
import { getBridgeAtlas, worldforgeSeedString } from "../../systems/worldforge/bridge/legacySubmapBridge";
import { buildAtlasGroundDrilldown, type AtlasGroundDrilldown, type GroundFocus } from "../../systems/worldforge/leaf3d/atlasGroundDrilldown";

// ============================================================================
// L1 Region Viewport Sub-Component
// ============================================================================
// Draws the refined local region and listens for global ESC presses to ascend.
// ============================================================================

// RegionViewport was removed and replaced by the zoomable/pannable RegionMapView component.

// ============================================================================
// Main Dashboard Component
// ============================================================================

/**
 * Convert the measured Worldforge workspace into a canvas size. Width follows
 * the real container so phone viewports do not receive a 480px-wide canvas that
 * spills offscreen; height keeps a small floor so hidden/initial measurements
 * still produce a drawable surface.
 */
export function measureAtlasDemoMapSize(rect: { width: number; height: number }): { width: number; height: number } {
  return {
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(260, Math.floor(rect.height)),
  };
}

/**
 * Shared breadcrumb overlay classes. Phone layouts need explicit left and
 * right bounds plus wrapping because local-view coordinates can be longer than
 * the available map width; desktop keeps the original compact top-right strip.
 */
export const atlasDemoBreadcrumbClassName =
  "absolute top-20 left-2 right-2 z-20 flex max-w-[calc(100%-1rem)] flex-col items-start gap-1 px-3 py-2 bg-gray-900/85 backdrop-blur-md border border-gray-800 rounded-lg text-xs select-none shadow-xl sm:top-3 sm:left-auto sm:right-3 sm:max-w-[calc(100%-1.5rem)] sm:flex-row sm:items-center sm:gap-4";

export const atlasDemoBreadcrumbIdentityClassName =
  "flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 font-mono text-gray-400";

export const atlasDemoBreadcrumbHintClassName =
  "flex max-w-full items-start gap-1.5 text-[10px] text-gray-500 sm:items-center";

interface AtlasDemoProps {
  /** Bind the atlas to the active run instead of exposing the standalone generator. */
  embeddedInGame?: boolean;
  /** Canonical game seed used by start selection, travel, 3D, and persistence. */
  worldSeed?: number;
}

const AtlasDemo: React.FC<AtlasDemoProps> = ({ embeddedInGame = false, worldSeed }) => {
  // Navigation & View Mode — the full zoom chain: L0 atlas → L1 region → L2 local
  const [viewMode, setViewMode] = useState<"atlas" | "region" | "local" | "ground">("atlas");
  const [selectedCellId, setSelectedCellId] = useState<number | null>(null);
  // Cell selected for inspection on the atlas (drives the CellInfoPanel). Kept
  // distinct from selectedCellId, which tracks the descended region cell.
  const [inspectCellId, setInspectCellId] = useState<number | null>(null);
  const [regionArtifact, setRegionArtifact] = useState<RegionArtifact | null>(null);
  const [localArtifact, setLocalArtifact] = useState<LocalArtifact | null>(null);
  const [isGeneratingLocal, setIsGeneratingLocal] = useState<boolean>(false);
  const [groundDrilldown, setGroundDrilldown] = useState<AtlasGroundDrilldown | null>(null);

  // Generation configurations
  // The standalone harness keeps its editable demo seed. In live play, reuse
  // the exact bridge atlas that selected the starting town and anchors travel;
  // generating a parallel `world-42` here displayed a different world.
  const canonicalGameSeed = embeddedInGame && worldSeed != null ? worldforgeSeedString(worldSeed) : null;
  const [seed, setSeed] = useState<string>(canonicalGameSeed ?? "world-42");
  const [template, setTemplate] = useState<string>("continents");
  const [cellsDesired, setCellsDesired] = useState<number>(10000);

  // Render options (L0 viewport)
  const [showScaleBar, setShowScaleBar] = useState<boolean>(true);
  const [showGraticule, setShowGraticule] = useState<boolean>(false);
  // The atlas base tint can show only one cell-owned domain at a time. The
  // radio keeps state/culture/religion/province colors mutually exclusive,
  // while markers, zones and military remain independent detail layers above.
  const [overlayMode, setOverlayMode] = useState<AtlasOverlayMode>("political");
  // Detail-density layers (2026-06-11): the ported Markers/Zones/Military
  // data finally drawn. Markers + zones default ON — they are the "Azgaar
  // richness" Remy asked after; military badges are opt-in (72 diamonds
  // clutter the fit zoom).
  const [showMarkers, setShowMarkers] = useState<boolean>(true);
  const [showZones, setShowZones] = useState<boolean>(true);
  const [showMilitary, setShowMilitary] = useState<boolean>(false);
  // Voronoi cell mesh (Azgaar "Cells" layer): thin edges on every cell so the
  // individual cells the map is built from are visible. Default off (clutter at
  // fit zoom); most useful when browsing/selecting cells at depth.
  const [showCells, setShowCells] = useState<boolean>(false);
  // Travel mode: forces the cell mesh on and highlights the cell under the
  // cursor (parity with the Azgaar world map's Travel button).
  const [travelMode, setTravelMode] = useState<boolean>(false);
  const [showDemoOverlay, setShowDemoOverlay] = useState<boolean>(false);
  const [demoTime, setDemoTime] = useState<number>(0);

  // Telemetry & progress
  const [atlas, setAtlas] = useState<FmgAtlasResult | null>(() =>
    embeddedInGame && worldSeed != null ? getBridgeAtlas(worldSeed) : null,
  );
  const [genTimeMs, setGenTimeMs] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isGeneratingRegion, setIsGeneratingRegion] = useState<boolean>(false);
  
  // Hover & selection notifications
  const [hintMessage, setHintMessage] = useState<string | null>(null);

  // View state tracking & cooldown for scroll-to-descend
  const lastAtlasViewRef = useRef<AtlasView | undefined>(undefined);
  const [initialAtlasView, setInitialAtlasView] = useState<AtlasView | undefined>(undefined);
  const [cooldownActive, setCooldownActive] = useState<boolean>(false);

  // Autofit viewport (Remy, 2026-06-11): the map canvas tracks the available
  // window space instead of a fixed 960×540. Measured via ResizeObserver on
  // the workspace element; the options panel floats OVER the map (Azgaar
  // style) so the canvas gets the full area.
  const workspaceRef = useRef<HTMLElement | null>(null);
  const [mapSize, setMapSize] = useState<{ width: number; height: number }>({ width: 960, height: 540 });
  const [panelOpen, setPanelOpen] = useState<boolean>(true);

  useEffect(() => {
    const el = workspaceRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setMapSize(measureAtlasDemoMapSize(rect));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // requestAnimationFrame loop to tick time for marker movements
  useEffect(() => {
    if (!showDemoOverlay) return;

    let animId: number;
    const tick = () => {
      setDemoTime((t) => t + 0.035); // smooth tick increments
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [showDemoOverlay]);

  // Generates animated mock entities centered on the first land cell
  const getDemoMarkers = (): OverlayMarker[] => {
    if (!showDemoOverlay || !atlas) return [];

    // Find the first land cell to anchor our demo markers
    const cellsN = atlas.pack.cells.h.length;
    let anchorCellId = 0;
    for (let i = 0; i < cellsN; i++) {
      if (atlas.pack.cells.h[i] >= 20) {
        anchorCellId = i;
        break;
      }
    }

    const p = atlas.pack.cells.p[anchorCellId];
    if (!p) return [];

    const baseX = p[0] * FEET_PER_FMG_PIXEL;
    const baseY = p[1] * FEET_PER_FMG_PIXEL;

    // WF-G4: marker offsets are REAL feet at entity scale, not FMG-pixel
    // multiples. The old offsets (10–45 px × ~9,842 ft/px ≈ 100k–440k ft)
    // could never appear inside a 25,000 ft region window. Entities that
    // share a cell now cluster to one point at atlas zoom — which is the
    // honest "live overlay" reading — and spread out in the region view.
    // Party moves in a circle
    const radius = 6_000;
    const partyX = baseX + radius * Math.cos(demoTime);
    const partyY = baseY + radius * Math.sin(demoTime);
    const partyFacing = demoTime + Math.PI / 2; // tangent facing direction

    return [
      {
        kind: "party",
        x: partyX,
        y: partyY,
        label: "Party",
        facing: partyFacing,
      },
      {
        kind: "npc",
        x: baseX - 5_000,
        y: baseY - 3_500,
        label: "Merchant Remy",
      },
      {
        kind: "npc",
        x: baseX + 5_500,
        y: baseY - 2_000,
        label: "Guard Sha'ek Mindfa'ek",
      },
      {
        kind: "npc",
        x: baseX - 2_000,
        y: baseY + 5_500,
        label: "Scholar Lucan",
      },
      {
        kind: "quest",
        x: baseX + 1_500,
        y: baseY + 3_000,
        label: "Explore the Ruins",
      },
    ];
  };

  const demoMarkers = getDemoMarkers();

  // Atlas-coherence: the descended region tints with the SAME biome color
  // the atlas shows at the clicked cell (drawRegion options.biomeColor).
  const anchorBiomeColor = useMemo(() => {
    if (!atlas || selectedCellId === null) return undefined;
    const biome = (atlas.pack.cells as unknown as { biome?: ArrayLike<number> }).biome?.[selectedCellId];
    if (biome == null) return undefined;
    const colors = (atlas as unknown as { biomesData?: { color?: string[] } }).biomesData?.color;
    return colors?.[Number(biome)];
  }, [atlas, selectedCellId]);

  const randomizeSeed = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let randomSeed = "";
    for (let i = 0; i < 8; i++) {
      randomSeed += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSeed(randomSeed);
    // Ascend back if randomizing a new seed
    handleAscend();
  };

  // Run world generation
  const handleGenerate = () => {
    setIsGenerating(true);
    handleAscend(); // Clear region artifact
    setTimeout(() => {
      const t0 = performance.now();
      try {
        const options = {
          width: 960,
          height: 540,
          cellsDesired,
          template,
        };
        // ALWAYS generate the full world (2026-06-11, Remy's detail-density
        // question): the atlas-only fast path starved every layer below —
        // descended regions had no burgs/routes to inherit, so town sites
        // and roads were empty by construction. ~1 s extra, paid once.
        const result = generateFmgWorld(seed, options);
        const t1 = performance.now();
        setAtlas(result);
        setGenTimeMs(t1 - t0);
      } catch (err) {
        console.error("Error generating FMG world/atlas:", err);
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  };

  // Trigger world civilization generation when a generated overlay is selected,
  // if a caller ever supplies an atlas-only artifact. The demo normally uses
  // generateFmgWorld already, but this keeps the old lazy-generation safety net.
  useEffect(() => {
    if (atlas && !atlas.pack.states) {
      setIsGenerating(true);
      setTimeout(() => {
        const t0 = performance.now();
        try {
          const result = generateFmgWorld(seed, {
            width: 960,
            height: 540,
            cellsDesired,
            template,
          });
          const t1 = performance.now();
          setAtlas(result);
          setGenTimeMs(t1 - t0);
        } catch (err) {
          console.error("Error generating FMG world dynamically:", err);
        } finally {
          setIsGenerating(false);
        }
      }, 50);
    }
  }, [atlas, seed, cellsDesired, template]);

  // Click handler to descend into region (L0 -> L1)
  const handleCellClick = (cellId: number) => {
    if (!atlas) return;
    const height = atlas.pack.cells.h[cellId];
    if (height < 20) {
      // Water cell selection blocked
      setHintMessage("Water cell clicked. Please select a land cell to descend.");
      setTimeout(() => setHintMessage(null), 3000);
      return;
    }

    setIsGeneratingRegion(true);
    setTimeout(() => {
      try {
        const seedNum = parseInt(seed.replace(/\D/g, "")) || 42;
        // Pass the civilization world through so the region inherits town
        // sites + roads (it clips them to its window like rivers).
        const worldResult = (atlas.pack as unknown as { states?: unknown[] }).states
          ? (atlas as Parameters<typeof generateRegion>[3]["world"])
          : undefined;
        const regionData = generateRegion(atlas, cellId, rootSeedPath(seedNum), {
          feetPerPixel: FEET_PER_FMG_PIXEL,
          resolutionFt: 100, // L1 standard target
          world: worldResult,
        });
        setRegionArtifact(regionData);
        setSelectedCellId(cellId);
        setInspectCellId(null); // descending supersedes the inspect panel
        setViewMode("region");
      } catch (err) {
        console.error("Error generating L1 region:", err);
      } finally {
        setIsGeneratingRegion(false);
      }
    }, 50);
  };

  // Descend region → L2 local: click point (feet) anchors a 3,000 ft window
  const handleRegionDescend = (xFt: number, yFt: number) => {
    if (!regionArtifact || selectedCellId === null) return;

    setIsGeneratingLocal(true);
    setTimeout(() => {
      try {
        const biomeId =
          (atlas?.pack.cells as unknown as { biome?: ArrayLike<number> }).biome?.[selectedCellId] ?? 6;
        const localData = generateLocal(
          regionArtifact,
          { x: xFt, y: yFt },
          regionArtifact.seedPath,
          { biomeId: Number(biomeId) },
        );
        setLocalArtifact(localData);
        setViewMode("local");
      } catch (err) {
        console.error("Error generating L2 local area:", err);
      } finally {
        setIsGeneratingLocal(false);
      }
    }, 50);
  };

  // Ascend local → L1 region
  const handleLocalAscend = () => {
    setViewMode("region");
    setLocalArtifact(null);
  };

  const handleEnterGround = (focus: GroundFocus) => {
    if (!regionArtifact || !localArtifact || selectedCellId === null) return;
    const canonicalWorldSeed = worldSeed ?? (parseInt(seed.replace(/\D/g, "")) || 42);
    setGroundDrilldown(buildAtlasGroundDrilldown({
      worldSeed: canonicalWorldSeed,
      atlasCellId: selectedCellId,
      region: regionArtifact,
      local: localArtifact,
      focus,
    }));
    setViewMode("ground");
  };

  const handleGroundAscend = () => {
    setViewMode("local");
    setGroundDrilldown(null);
  };

  // Ascend back to L0 world map
  const handleAscend = () => {
    // Restore previous view below the descend threshold (hysteresis) + cooldown.
    // Clamp tracks DESCEND_SCALE (16 since the deep-zoom change) — the old 3.5
    // clamp threw users back to near-fit zoom after every ascend.
    if (lastAtlasViewRef.current) {
      setInitialAtlasView({
        ...lastAtlasViewRef.current,
        scale: Math.min(15.5, lastAtlasViewRef.current.scale),
      });
    }
    setCooldownActive(true);
    setTimeout(() => {
      setCooldownActive(false);
    }, 500); // 500ms transition cooldown

    setViewMode("atlas");
    setSelectedCellId(null);
    setInspectCellId(null);
    setRegionArtifact(null);
    setLocalArtifact(null);
    setGroundDrilldown(null);
  };

  useEffect(() => {
    // Live runs already own a canonical, cached atlas. Regeneration belongs to
    // the standalone cartographer and pre-run setup, never an active journey.
    if (embeddedInGame) return;
    handleGenerate();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header Bar: on phone widths, stack the title and readouts while reserving room for the floating surface toggle. */}
      <header className="sticky top-0 z-20 flex flex-col gap-3 border-b border-gray-900 bg-gray-950/80 px-4 py-4 pr-28 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="bg-indigo-600/20 text-indigo-400 p-2 rounded-lg border border-indigo-500/30">
            <Map size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {viewMode !== "atlas" && (
                <span className="text-xs font-mono font-bold bg-indigo-900/60 text-indigo-300 px-2 py-0.5 rounded border border-indigo-700/40">
                  {viewMode === "region" ? "L1 REGION" : viewMode === "local" ? "L2 LOCAL" : "L3 GROUND"}
                </span>
              )}
              <h1 className="text-lg font-bold leading-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                {embeddedInGame ? "Worldforge Atlas" : "Worldforge Atlas Cartographer"}
              </h1>
            </div>
            <p className="text-xs text-gray-500">
              {viewMode === "atlas"
                ? embeddedInGame
                  ? "The canonical atlas for this journey"
                  : "Procedural World Generation & Interactive Render Harness"
                : `Zoom descent slice centered on Cell #${selectedCellId}`}
            </p>
          </div>
        </div>

        {/* Readout Strip */}
        <div className="flex w-full max-w-full flex-wrap items-center gap-3 rounded-lg border border-gray-800/60 bg-gray-900/40 px-3 py-1.5 sm:w-auto sm:flex-nowrap sm:gap-6 sm:px-4">
          {viewMode === "atlas" ? (
            atlas && (
              <>
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-emerald-400" />
                  <div className="text-xs">
                    <span className="text-gray-500 mr-1">Gen Time:</span>
                    <span className="font-mono font-bold text-emerald-400">{genTimeMs.toFixed(1)}ms</span>
                  </div>
                </div>
                <div className="hidden h-4 w-[1px] bg-gray-800 sm:block" />
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-blue-400" />
                  <div className="text-xs">
                    <span className="text-gray-500 mr-1">Cells:</span>
                    <span className="font-mono font-bold text-blue-400">
                      {atlas.pack.cells.h.length.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="hidden h-4 w-[1px] bg-gray-800 sm:block" />
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-purple-400" />
                  <div className="text-xs">
                    <span className="text-gray-500 mr-1">Rivers:</span>
                    <span className="font-mono font-bold text-purple-400">
                      {atlas.pack.rivers?.length ?? 0}
                    </span>
                  </div>
                </div>
                {atlas.pack.states && (
                  <>
                    <div className="hidden h-4 w-[1px] bg-gray-800 sm:block" />
                    <div className="flex items-center gap-2">
                      <div className="text-xs">
                        <span className="text-gray-500 mr-1">States:</span>
                        <span className="font-mono font-bold text-indigo-400">
                          {atlas.pack.states.filter((s) => s && s.i > 0 && !s.removed).length}
                        </span>
                      </div>
                    </div>
                    <div className="hidden h-4 w-[1px] bg-gray-800 sm:block" />
                    <div className="flex items-center gap-2">
                      <div className="text-xs">
                        <span className="text-gray-500 mr-1">Burgs:</span>
                        <span className="font-mono font-bold text-rose-400">
                          {atlas.pack.burgs ? atlas.pack.burgs.filter((b) => b && (b.i ?? 0) > 0 && !b.removed).length : 0}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </>
            )
          ) : (
            regionArtifact && (
              <>
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-blue-400" />
                  <div className="text-xs">
                    <span className="text-gray-500 mr-1">Grid Area:</span>
                    <span className="font-mono font-bold text-blue-400">
                      {regionArtifact.heightfield.width} × {regionArtifact.heightfield.height}
                    </span>
                  </div>
                </div>
                <div className="hidden h-4 w-[1px] bg-gray-800 sm:block" />
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-purple-400" />
                  <div className="text-xs">
                    <span className="text-gray-500 mr-1">River Channels:</span>
                    <span className="font-mono font-bold text-purple-400">
                      {regionArtifact.rivers?.length ?? 0}
                    </span>
                  </div>
                </div>
              </>
            )
          )}
        </div>
      </header>

      {/* Main Workspace Layout — the map fills the window; controls float
          over it Azgaar-style (Remy, 2026-06-11) */}
      <main ref={workspaceRef} className="flex-1 relative bg-gray-950 overflow-hidden">
        {/* Foldable Options Panel — pinned top-left INSIDE the viewport */}
        <section className="absolute top-2 left-2 right-2 z-30 flex max-h-[calc(100%-1rem)] flex-col gap-2 pointer-events-none sm:top-3 sm:left-3 sm:right-auto sm:w-80 sm:max-h-[calc(100%-1.5rem)]">
          <button
            type="button"
            onClick={() => setPanelOpen((o) => !o)}
            className="pointer-events-auto self-start flex min-h-11 items-center gap-2 bg-gray-900/85 backdrop-blur-md border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white px-3 py-2 rounded-lg shadow-xl transition-all active:scale-95"
            title={panelOpen ? "Collapse options" : "Expand options"}
          >
            {panelOpen ? <PanelLeftClose size={16} /> : <Menu size={16} />}
            <span className="text-xs font-bold tracking-wide">{panelOpen ? "HIDE OPTIONS" : "OPTIONS"}</span>
          </button>

          {panelOpen && (
            <div className="pointer-events-auto flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1 pb-16 sm:pb-1">
          {viewMode === "atlas" ? (
            <>
              {/* L0 generation is a standalone harness capability. Active runs
                  must keep the same world used by spawn, travel, saves, and 3D. */}
              {!embeddedInGame && (
              <div className="bg-gray-900/85 backdrop-blur-md border border-gray-800 rounded-xl p-3 flex flex-col gap-2 shadow-xl sm:p-5 sm:gap-4">
                <div className="flex items-center gap-2 border-b border-gray-800 pb-2 sm:pb-3">
                  <Settings size={16} className="text-indigo-400" />
                  <h2 className="text-sm font-bold tracking-wide text-gray-300">WORLD GENERATOR</h2>
                </div>

                <div className="flex flex-col gap-1 sm:gap-1.5">
                  <label htmlFor="seedInput" className="text-xs font-semibold text-gray-400">World Seed</label>
                  <div className="flex gap-2">
                    <input
                      id="seedInput"
                      type="text"
                      value={seed}
                      onChange={(e) => setSeed(e.target.value)}
                      className="min-h-11 flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm font-mono text-indigo-300 focus:outline-none focus:border-indigo-500 transition-colors"
                      placeholder="Enter seed..."
                    />
                    <button
                      type="button"
                      onClick={randomizeSeed}
                      className="flex min-h-11 min-w-11 items-center justify-center bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 hover:text-white p-2 rounded-lg transition-all active:scale-95"
                      title="Randomize Seed"
                    >
                      <Dices size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1 sm:gap-1.5">
                  <label htmlFor="templateSelect" className="text-xs font-semibold text-gray-400">Heightmap Template</label>
                  <select
                    id="templateSelect"
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    className="min-h-11 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                  >
                    {Object.entries(heightmapTemplates).map(([key, t]) => (
                      <option key={key} value={key}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1 sm:gap-1.5">
                  <span className="text-xs font-semibold text-gray-400">Cell Density</span>
                  <div className="grid grid-cols-2 gap-2 bg-gray-950 p-1 rounded-lg border border-gray-800">
                    <button
                      type="button"
                      onClick={() => setCellsDesired(1000)}
                      className={`min-h-11 py-2 text-xs font-mono font-bold rounded-md transition-all ${
                        cellsDesired === 1000
                          ? "bg-indigo-600 text-white shadow-md"
                          : "text-gray-500 hover:text-gray-300 hover:bg-gray-900/50"
                      }`}
                    >
                      1K Cells
                    </button>
                    <button
                      type="button"
                      onClick={() => setCellsDesired(10000)}
                      className={`min-h-11 py-2 text-xs font-mono font-bold rounded-md transition-all ${
                        cellsDesired === 10000
                          ? "bg-indigo-600 text-white shadow-md"
                          : "text-gray-500 hover:text-gray-300 hover:bg-gray-900/50"
                      }`}
                    >
                      10K Cells
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full min-h-11 mt-1 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:from-indigo-700 active:to-indigo-800 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer sm:mt-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Generate World
                    </>
                  )}
                </button>
              </div>
              )}

              {/* Render Options Panel */}
              <div className="bg-gray-900/85 backdrop-blur-md border border-gray-800 rounded-xl p-5 flex flex-col gap-4 shadow-xl">
                <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
                  <Layers size={16} className="text-indigo-400" />
                  <h2 className="text-sm font-bold tracking-wide text-gray-300">CARTOGRAPHY OPTIONS</h2>
                </div>

                <label className="flex items-center justify-between cursor-pointer group py-1">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">
                      Display Scale Bar
                    </span>
                    <span className="text-[10px] text-gray-500">Alternating miles & feet bar</span>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={showScaleBar}
                      onChange={(e) => setShowScaleBar(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-gray-950 rounded-full border border-gray-800 peer-checked:bg-indigo-600 transition-colors after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-gray-400 after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-white" />
                  </div>
                </label>

                <label className="flex items-center justify-between cursor-pointer group py-1">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">
                      Display Cells
                    </span>
                    <span className="text-[10px] text-gray-500">Voronoi cell mesh — the cells you click to inspect</span>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={showCells}
                      onChange={(e) => setShowCells(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-gray-950 rounded-full border border-gray-800 peer-checked:bg-indigo-600 transition-colors after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-gray-400 after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-white" />
                  </div>
                </label>

                <label className="flex items-center justify-between cursor-pointer group py-1">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">
                      Display Graticule Grid
                    </span>
                    <span className="text-[10px] text-gray-500">Latitude & longitude grid lines</span>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={showGraticule}
                      onChange={(e) => setShowGraticule(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-gray-950 rounded-full border border-gray-800 peer-checked:bg-indigo-600 transition-colors after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-gray-400 after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-white" />
                  </div>
                </label>

                <div className="flex flex-col gap-2 py-1">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-300">Atlas Cell Tint</span>
                    <span className="text-[10px] text-gray-500">State, culture, religion or province ownership</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 bg-gray-950 p-1 rounded-lg border border-gray-800">
                    {([
                      ["political", "State"],
                      ["culture", "Culture"],
                      ["religion", "Faith"],
                      ["province", "Province"],
                    ] as Array<[AtlasOverlayMode, string]>).map(([mode, label]) => (
                      <label
                        key={mode}
                        className={`cursor-pointer rounded-md px-2 py-1 text-center text-[10px] font-semibold transition-all ${
                          overlayMode === mode
                            ? "bg-indigo-600 text-white shadow-md"
                            : "text-gray-500 hover:bg-gray-900/50 hover:text-gray-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="atlasOverlayMode"
                          value={mode}
                          checked={overlayMode === mode}
                          onChange={() => setOverlayMode(mode)}
                          className="sr-only"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <label className="flex items-center justify-between cursor-pointer group py-1">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">
                      Display Markers
                    </span>
                    <span className="text-[10px] text-gray-500">Points of interest: volcanoes, mines, inns, dungeons…</span>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={showMarkers}
                      onChange={(e) => setShowMarkers(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-gray-950 rounded-full border border-gray-800 peer-checked:bg-indigo-600 transition-colors after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-gray-400 after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-white" />
                  </div>
                </label>

                <label className="flex items-center justify-between cursor-pointer group py-1">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">
                      Display Zones
                    </span>
                    <span className="text-[10px] text-gray-500">Invasions, plagues, eruptions & other live events</span>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={showZones}
                      onChange={(e) => setShowZones(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-gray-950 rounded-full border border-gray-800 peer-checked:bg-indigo-600 transition-colors after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-gray-400 after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-white" />
                  </div>
                </label>

                <label className="flex items-center justify-between cursor-pointer group py-1">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">
                      Display Military
                    </span>
                    <span className="text-[10px] text-gray-500">State regiments & fleets (state-colored badges)</span>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={showMilitary}
                      onChange={(e) => setShowMilitary(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-gray-950 rounded-full border border-gray-800 peer-checked:bg-indigo-600 transition-colors after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-gray-400 after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-white" />
                  </div>
                </label>

                <label className="flex items-center justify-between cursor-pointer group py-1">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">
                      Display Demo Overlay
                    </span>
                    <span className="text-[10px] text-gray-500">Pulsing party, NPCs & quest markers</span>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={showDemoOverlay}
                      onChange={(e) => setShowDemoOverlay(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-gray-950 rounded-full border border-gray-800 peer-checked:bg-indigo-600 transition-colors after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-gray-400 after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-white" />
                  </div>
                </label>
              </div>
            </>
          ) : (
            /* The hierarchy panel changes with the active tier so ground never
                masquerades as a region while the same artifacts remain mounted. */
            <div className="bg-gray-900/85 backdrop-blur-md border border-gray-800 rounded-xl p-5 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
                <ArrowLeft size={16} className="text-indigo-400 cursor-pointer" onClick={viewMode === "ground" ? handleGroundAscend : viewMode === "local" ? handleLocalAscend : handleAscend} />
                <h2 className="text-sm font-bold tracking-wide text-gray-300">
                  {viewMode === "region" ? "REGION VIEW" : viewMode === "local" ? "LOCAL MAP" : "GROUND 3D"}
                </h2>
              </div>

              <div className="flex flex-col gap-3 font-sans text-xs text-gray-400 leading-relaxed bg-gray-950/40 p-3.5 rounded-lg border border-gray-800/40">
                <div className="flex items-center gap-2 text-indigo-300 font-semibold mb-1">
                  <Info size={14} />
                  <span>{viewMode === "ground" ? "Exact Artifact Continuity" : viewMode === "local" ? "Playable Local Artifact" : "Sub-Cell Geography"}</span>
                </div>
                {viewMode === "ground" && groundDrilldown ? (
                  <>
                    <p>You are standing at <strong className="text-amber-200">{groundDrilldown.focus.label}</strong>, selected from Atlas cell <strong>#{selectedCellId}</strong>.</p>
                    <p>The scene is streaming the same Local artifact shown one level up. Its seed lineage and selected feet coordinates remain preserved for return navigation.</p>
                  </>
                ) : viewMode === "local" && localArtifact ? (
                  <>
                    <p>This 3,000 × 3,000 ft map is the shared L2 artifact for both cartography and ground 3D.</p>
                    <p>Choose a town or site below; entering 3D keeps this map in memory so return restores the same place.</p>
                  </>
                ) : (
                  <>
                    <p>You have zoomed into the refined sub-cell heightfield map for <strong>Cell #{selectedCellId}</strong>.</p>
                    <p>This terrain did not exist at the world level. It has been procedurally generated at L1 resolution (100 ft spacing) using hydraulic erosion and value noise.</p>
                    <p>Solid dark bands indicate refined river banks width-scaled by local upstream flux.</p>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={viewMode === "ground" ? handleGroundAscend : viewMode === "local" ? handleLocalAscend : handleAscend}
                className="w-full mt-2 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <ArrowLeft size={16} />
                {viewMode === "ground" ? "Return to Local Map" : viewMode === "local" ? "Ascend to Region" : "Ascend to World Map"}
              </button>
            </div>
          )}
            </div>
          )}
        </section>

        {/* Viewport Area — fills the workspace; panels float above */}
        <section className="absolute inset-0">
          {/* Progress / Loading Overlay */}
          {(isGenerating || isGeneratingRegion || isGeneratingLocal) && (
            <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-10">
              <div className="h-10 w-10 border-4 border-indigo-600/30 border-t-indigo-500 rounded-full animate-spin shadow-lg shadow-indigo-500/20" />
              <div className="flex flex-col items-center">
                <p className="text-sm font-bold text-gray-200">
                  {isGenerating
                    ? "Forging World Geometry..."
                    : isGeneratingRegion
                    ? "Interpolating Local Region..."
                    : "Detailing Local Area..."}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {isGenerating
                    ? "Running heightmap templates and hydraulic erosion"
                    : isGeneratingRegion
                    ? "Computing IDW cell weights and relief noise"
                    : "Upsampling terrain to 5 ft cells and placing features"}
                </p>
              </div>
            </div>
          )}

          {/* Breadcrumb Navigation Strip — floats top-right over the map */}
          {atlas && (
            <div className={atlasDemoBreadcrumbClassName}>
              <div className={atlasDemoBreadcrumbIdentityClassName}>
                <span className="text-indigo-400 font-semibold">Seed:</span> {seed}
                {viewMode !== "atlas" && (
                  <>
                    <span className="text-gray-600">/</span>
                    <span className="text-indigo-400 font-semibold">Cell:</span> #{selectedCellId}
                  </>
                )}
                {(viewMode === "local" || viewMode === "ground") && localArtifact && (
                  <>
                    <span className="text-gray-600">/</span>
                    <span className="text-indigo-400 font-semibold">Local:</span>{" "}
                    {Math.round(localArtifact.bounds.x + localArtifact.bounds.width / 2).toLocaleString()},
                    {Math.round(localArtifact.bounds.y + localArtifact.bounds.height / 2).toLocaleString()} ft
                  </>
                )}
              </div>
              <div className={atlasDemoBreadcrumbHintClassName}>
                <HelpCircle size={12} className="mt-0.5 shrink-0 sm:mt-0" />
                <span className="min-w-0">
                  {viewMode === "atlas"
                    ? "Click any land cell to zoom-descend into region details"
                    : viewMode === "region"
                    ? "Click anywhere to descend into the 5 ft local area; Esc ascends"
                    : viewMode === "local"
                    ? "Choose the exact town or site to enter ground 3D"
                    : "Ground renders this Local artifact; Esc returns to its map"}
                </span>
              </div>
            </div>
          )}

          {/* Toast/Hint popup */}
          {hintMessage && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-indigo-900 border border-indigo-700 text-indigo-100 text-xs px-4 py-2 rounded-lg shadow-xl animate-bounce">
              {hintMessage}
            </div>
          )}

          {/* Travel-mode toggle — floats top-center; mirrors the Azgaar world
              map's Travel button. Forces the cell mesh on and enables the
              cursor-following cell highlight. */}
          {viewMode === "atlas" && atlas && (
            <button
              type="button"
              data-testid="worldforge-travel-toggle"
              aria-pressed={travelMode}
              onClick={() => setTravelMode((t) => !t)}
              className={`absolute top-3 left-1/2 -translate-x-1/2 z-20 flex min-h-11 items-center gap-2 px-4 py-2 rounded-full text-xs font-bold shadow-xl transition-all active:scale-95 border ${
                travelMode
                  ? "bg-rose-600 hover:bg-rose-500 text-white border-rose-400"
                  : "bg-gray-900/85 backdrop-blur-md hover:bg-gray-800 text-gray-200 border-gray-700"
              }`}
              title="Travel mode: show the cell mesh and highlight the cell under the cursor"
            >
              <MapPin size={14} />
              {travelMode ? "Travel: ON" : "Travel"}
            </button>
          )}

          {/* Cell inspection panel — floats top-right (below the breadcrumb)
              whenever a cell is selected on the atlas. */}
          {viewMode === "atlas" && atlas && inspectCellId != null && (
            <div className="absolute top-16 right-3 z-20">
              <CellInfoPanel
                info={describeCell(atlas, inspectCellId)}
                onClose={() => setInspectCellId(null)}
                onDescend={handleCellClick}
              />
            </div>
          )}

          {/* Main Visualizer Views — sized to the measured workspace */}
          <div className="w-full h-full flex items-center justify-center">
            {viewMode === "atlas" ? (
              atlas ? (
                <AtlasMapView
                  atlas={atlas}
                  width={mapSize.width}
                  height={mapSize.height}
                  showScaleBar={showScaleBar}
                  showGraticule={showGraticule}
                  showPolitical={overlayMode === "political"}
                  overlayMode={overlayMode}
                  showMarkers={showMarkers}
                  showZones={showZones}
                  showMilitary={showMilitary}
                  showCells={showCells || travelMode}
                  travelMode={travelMode}
                  onCellClick={handleCellClick}
                  onCellSelect={setInspectCellId}
                  selectedCellId={inspectCellId}
                  initialView={initialAtlasView}
                  onViewChange={(v) => { lastAtlasViewRef.current = v; }}
                  cooldownActive={cooldownActive}
                  markers={demoMarkers}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-500 gap-2">
                  <Activity className="animate-pulse text-indigo-500/40" size={32} />
                  <p className="text-sm">Click "Generate World" to start rendering</p>
                </div>
              )
            ) : viewMode === "region" ? (
              regionArtifact && (
                <RegionMapView
                  region={regionArtifact}
                  width={mapSize.width}
                  height={mapSize.height}
                  onAscend={handleAscend}
                  markers={demoMarkers}
                  onDescend={handleRegionDescend}
                  biomeColor={anchorBiomeColor}
                />
              )
            ) : viewMode === "local" ? (
              localArtifact && (
                <LocalMapView
                  local={localArtifact}
                  width={mapSize.width}
                  height={mapSize.height}
                  onAscend={handleLocalAscend}
                  biomeColor={anchorBiomeColor}
                  onEnterGround={handleEnterGround}
                />
              )
            ) : (
              groundDrilldown && localArtifact && regionArtifact && (
                <WorldforgeGroundDrilldown
                  drilldown={groundDrilldown}
                  local={localArtifact}
                  region={regionArtifact}
                  onAscend={handleGroundAscend}
                />
              )
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default AtlasDemo;
