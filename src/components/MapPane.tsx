// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/06/2026, 19:32:16
 * Dependents: components/layout/GameModals.tsx
 * Imports: 27 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file MapPane.tsx
 * World map modal surface. Worldforge native renderers (SVG/canvas) are the sole
 * cartography system. The Azgaar iframe has been retired (2026-06-24).
 *
 * The pane receives legacy `MapData` for player position/discovery tracking.
 * These reads pass through the World geography adapter, preserving travel,
 * discovery, and 3D-entry contracts during the Submap → Worldforge transition.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapData, MapTile as MapTileType } from '../types';
import { BIOMES } from '../constants';
import { WindowFrame } from './ui/WindowFrame';
import { WINDOW_KEYS } from '../styles/uiIds';
import oldPaperBg from '../assets/images/old-paper.svg';
import type { PlayerWorldPosition, DiscoveredHiddenSite } from '../types';
import {
  fromMapData,
  resolveLegacyTile,
  type WorldGeographySnapshot,
} from '@/utils/world/worldGeographyAdapter';
import AtlasSvgView from './Worldforge/AtlasSvgView';
import type { CellTraits } from './Worldforge/atlasSvg';
import SubmapSvgView from './Worldforge/SubmapSvgView';
import TownPlanView from './Worldforge/TownPlanView';
import NeighbourhoodSvgView from './Worldforge/NeighbourhoodSvgView';
import { atlasCellToSubmapContext } from '@/systems/worldforge/submap/l0Adapter';
import { buildAtlasNeighbourhood, type AtlasNeighbourhood } from '@/systems/worldforge/submap/neighbourhood';
import { generateSubmap, submapCellToChildContext, polygonBounds, pointInPolygon, type SubmapModel, type SubmapParentContext, type Pt } from '@/systems/worldforge/submap/submapEngine';
import { generateTownPlan, type TownPlan } from '@/systems/worldforge/town/townEngine';
import { rootSeedPath, streamPath } from '@/systems/worldforge/seedPath';
import { legacyGridToAtlasCell, gridCellToAtlasSite, spreadColocatedPoints } from '@/systems/worldforge/local/gridAtlasBridge';
import { getTownTilesForGrid } from '@/systems/worldforge/bridge/legacySubmapBridge';
import { buildAtlasTravelGraph, atlasMilesPerUnit, nearestLandCell, transportMobility } from '@/systems/worldforge/travel/atlasTravelGraph';
import { buildMultiModalAtlasGraph } from '@/systems/worldforge/travel/multiModalAtlasGraph';
import { buildSubmapTravelGraph } from '@/systems/worldforge/travel/submapTravelGraph';
import { planRoutesFrom, transportSpeedMph } from '@/systems/travel/routePlanning';
import { segmentRoute } from '@/systems/travel/multiModalRoute';
import { availableTransports } from '@/systems/travel/availableTransports';
import { rollTravelEncounter } from '@/systems/travel/travelEncounter';
import { formatTravelTime } from '@/systems/travel/travelReadout';
import { generateFmgWorld } from '@/systems/worldforge/fmg/generateWorld';

interface MapPaneProps {
  mapData: MapData;
  worldSeed?: number;
  onTileClick: (x: number, y: number, tile: MapTileType, travelMeta?: { seconds: number; encounterMessage?: string | null }) => void;
  /** When set, clicking a discovered cell in Enter 3D mode starts streamed world entry. */
  onEnter3DAtCell?: (x: number, y: number, tile: MapTileType) => void;
  /** Last known 3D position — draws AtlasPlayerMarker on the Worldforge atlas. */
  playerWorldPos?: PlayerWorldPosition | null;
  /** SP4 discovered hidden places — pinned on the World Forge atlas. */
  discoveredHiddenSites?: DiscoveredHiddenSite[];
  onClose: () => void;
  allowTravel?: boolean;
  /** Show Enter 3D interaction mode (PLAYING phase atlas click-to-travel). */
  allow3DEntry?: boolean;
  showGenerationControls?: boolean;
  canRegenerateWorld?: boolean;
  generationLockedReason?: string | null;
  onRegenerateWorld?: (seed?: number) => void;
  /**
   * Optional maritime proof/generation flag. Default-off preserves the frozen
   * FMG world topology; proof harnesses can enable it to test generated island
   * harbor reachability without changing normal gameplay saves yet.
   */
  enableIslandHarbors?: boolean;
}

type WorldMapInteractionMode = 'pan' | 'travel' | 'enter3d';
type SeaPreference = 'none' | 'ferry';

/**
 * Each drill tier renders fit-to-view, but the SP1 engine + clipping degrade at
 * sub-unit coordinate scales (a sub-cell of a sub-cell is tiny in graph units →
 * sliver/degenerate Voronoi cells, near-empty local tiers). Normalize every tier's
 * context to a canonical span before generating so each tier has healthy geometry,
 * independent of how deep the drill is. Position is irrelevant (fit-to-view).
 */
const DRILL_CANON_SPAN = 1000;
function normalizeCtxScale(ctx: SubmapParentContext): SubmapParentContext {
  const b = polygonBounds(ctx.polygon);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const k = DRILL_CANON_SPAN / (Math.max(b.maxX - b.minX, b.maxY - b.minY) || 1);
  const sc = (p: Pt): Pt => [(p[0] - cx) * k + cx, (p[1] - cy) * k + cy];
  return {
    ...ctx,
    polygon: ctx.polygon.map(sc),
    features: ctx.features?.map((f) => ({ ...f, x: (f.x - cx) * k + cx, y: (f.y - cy) * k + cy })),
    polylines: ctx.polylines?.map((pl) => ({ ...pl, points: pl.points.map(sc) })),
  };
}

function clampIndex(value: number, maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  return Math.max(0, Math.min(maxExclusive - 1, value));
}

/**
 * The sub-cell index a player occupies within a submap tier. The player spawns
 * at the burg, which the submap engine places (Bomnogorvan contract), so the
 * burg sub-cell is the player's sub-cell. With no burg, fall back to the sub-cell
 * at the tier's centroid. Frame-safe (model-internal indices, not raw coords).
 */
function playerSubCellIndex(model: SubmapModel): number | null {
  if (model.cells.length === 0) return null;
  if (model.burgCellIndex != null) return model.burgCellIndex;
  const b = polygonBounds(model.boundary);
  const c: Pt = [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
  const idx = model.cells.findIndex((cell) => pointInPolygon(c, cell.polygon));
  return idx >= 0 ? idx : 0;
}

function hashText(seed: number, text: string): number {
  let hash = seed;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = (hash * 16777619) >>> 0;
  }
  return hash;
}

function deriveWorldSeed(mapData: MapData): number {
  let hash = 2166136261;
  hash = hashText(hash, `${mapData.gridSize.rows}x${mapData.gridSize.cols}`);

  for (let y = 0; y < mapData.tiles.length; y++) {
    const row = mapData.tiles[y];
    for (let x = 0; x < row.length; x++) {
      const tile = row[x];
      // Include only stable world layout data; exclude discovery/current flags.
      hash = hashText(hash, `${tile.x},${tile.y},${tile.biomeId},${tile.locationId || ''};`);
    }
  }

  const bounded = hash % 999_999_999;
  return bounded > 0 ? bounded : bounded + 999_999_999;
}

// -----------------------------------------------------------------------------
// World geography read adapter bridge
// -----------------------------------------------------------------------------
// MapPane still renders and emits legacy tiles. These helpers make the read side
// depend on the World geography snapshot first, then fall back to the original
// tile if a future non-tile geography point has not been bridged yet.
// -----------------------------------------------------------------------------

function projectTileFromGeographySnapshot(
  tile: MapTileType,
  snapshot: WorldGeographySnapshot,
): MapTileType {
  const projectedPoint = resolveLegacyTile(snapshot, { x: tile.x, y: tile.y });
  if (!projectedPoint) {
    return tile;
  }
  if (
    projectedPoint.discovered === tile.discovered &&
    projectedPoint.isPlayerCurrent === tile.isPlayerCurrent
  ) {
    return tile;
  }
  return {
    ...tile,
    discovered: projectedPoint.discovered,
    isPlayerCurrent: projectedPoint.isPlayerCurrent,
  };
}

function projectMapDataForRead(mapData: MapData): MapData {
  const snapshot = fromMapData(mapData);
  return {
    ...mapData,
    gridSize: { ...mapData.gridSize },
    tiles: mapData.tiles.map((row) =>
      row.map((tile) => projectTileFromGeographySnapshot(tile, snapshot)),
    ),
  };
}

const MapPane: React.FC<MapPaneProps> = ({
  mapData,
  worldSeed,
  onTileClick,
  onEnter3DAtCell,
  playerWorldPos = null,
  discoveredHiddenSites = [],
  onClose,
  allowTravel = true,
  allow3DEntry = false,
  showGenerationControls = false,
  canRegenerateWorld = false,
  generationLockedReason = null,
  onRegenerateWorld,
  enableIslandHarbors = false,
}) => {
  const { gridSize } = mapData;
  const geographySnapshot = useMemo(() => fromMapData(mapData), [mapData]);
  const projectedMapData = useMemo(() => projectMapDataForRead(mapData), [mapData]);
  const projectedTiles = projectedMapData.tiles;
  const [interactionMode, setInteractionMode] = useState<WorldMapInteractionMode>(allowTravel ? 'travel' : 'pan');
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);
  const [showPrecisionOverlay, setShowPrecisionOverlay] = useState(true);
  const [seedInput, setSeedInput] = useState('');

  const worldforgeViewportRef = useRef<HTMLDivElement>(null);
  const [worldforgeViewportSize, setWorldforgeViewportSize] = useState({ width: 960, height: 540 });

  const worldforgeSeed = useMemo(() => worldSeed ?? deriveWorldSeed(mapData), [mapData, worldSeed]);

  // Native Worldforge SVG render-port (SP0). Generated from the world seed.
  // A throw here surfaces honestly via the surrounding ErrorBoundary (no silent fallback).
  // Full world (civilization layer: burgs/routes/states/labels), not atlas-only.
  // Island harbors are explicit opt-in until saved-world topology changes are approved.
  const worldforgeAtlas = useMemo(
    () => generateFmgWorld(String(worldforgeSeed), { ensureIslandHarbors: enableIslandHarbors }),
    [enableIslandHarbors, worldforgeSeed],
  );

  useEffect(() => {
    const viewport = worldforgeViewportRef.current;
    if (!viewport) return;

    const measureViewport = () => {
      const rect = viewport.getBoundingClientRect();
      const nextSize = {
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(240, Math.floor(rect.height)),
      };

      // The native atlas renderer needs numeric SVG dimensions for pointer math.
      // Measuring the actual panel keeps it fitted to resized WindowFrame space.
      setWorldforgeViewportSize((currentSize) => (
        currentSize.width === nextSize.width && currentSize.height === nextSize.height
          ? currentSize
          : nextSize
      ));
    };

    measureViewport();

    const observer = new ResizeObserver(measureViewport);
    observer.observe(viewport);

    return () => observer.disconnect();
  }, []);


  useEffect(() => {
    if (!allowTravel && interactionMode === 'travel') {
      setInteractionMode('pan');
    }
    if (!allow3DEntry && interactionMode === 'enter3d') {
      setInteractionMode('pan');
    }
  }, [allow3DEntry, allowTravel, interactionMode]);

  useEffect(() => {
    setSeedInput(String(worldforgeSeed));
  }, [worldforgeSeed]);

  const hoveredTile = useMemo(() => {
    if (!hoveredCell) return null;
    return projectedTiles[hoveredCell.y]?.[hoveredCell.x] || null;
  }, [hoveredCell, projectedTiles]);

  const hoveredBiome = hoveredTile ? BIOMES[hoveredTile.biomeId] : undefined;

  const playerCell = useMemo(() => {
    // Find the current player position so precision mode can anchor the starting
    // cell even before the player hovers over a destination.
    for (const point of geographySnapshot.points) {
      if (point.isPlayerCurrent && point.legacyTile) {
        return { x: point.legacyTile.x, y: point.legacyTile.y };
      }
    }
    return null;
  }, [geographySnapshot]);

  // The atlas Voronoi cell the player currently occupies (their grid cell mapped
  // back through the grid↔atlas bridge). Drives the centered marker + the drill
  // player sub-cell highlight.
  const playerAtlasCell = useMemo(() => {
    if (!worldforgeAtlas || !playerCell) return null;
    return legacyGridToAtlasCell(
      worldforgeAtlas,
      { x: playerCell.x, y: playerCell.y },
      { cols: gridSize.cols, rows: gridSize.rows },
    );
  }, [worldforgeAtlas, playerCell, gridSize.cols, gridSize.rows]);

  // "You are here" marker for the native World Forge atlas: centered on the
  // player's actual VORONOI CELL (the atlas cell's site) rather than the coarse
  // grid-cell-center projection — so the indicator sits inside the cell the
  // player occupies, not adrift near a coastline.
  const worldforgeMarker = useMemo(() => {
    if (!worldforgeAtlas || !playerCell) return null;
    const [x, y] = gridCellToAtlasSite(
      worldforgeAtlas,
      { x: playerCell.x, y: playerCell.y },
      { cols: gridSize.cols, rows: gridSize.rows },
    );
    return { x, y };
  }, [worldforgeAtlas, playerCell, gridSize.cols, gridSize.rows]);

  // Travel mode: a single-source fastest-route field from the player's atlas cell
  // (computed ONCE per origin, on foot for now), so hovering any cell reconstructs
  // a route instantly for the preview line + readout. Null outside travel mode.
  // Transport picker: the player chooses per trip; the route field rebuilds with
  // the chosen speed + mobility (foot/horse today; ownership-gating arrives when
  // the party is threaded in). Walking + riding horse are the modeled choices.
  const transportChoices = useMemo(() => availableTransports([{ transportMode: 'mounted' }]), []);
  const [transportId, setTransportId] = useState('walking');
  const [seaPref, setSeaPref] = useState<SeaPreference>('none');
  const selectedTransport = transportChoices.find((t) => t.id === transportId) ?? transportChoices[0];

  const travelField = useMemo(() => {
    if (interactionMode !== 'travel' || !worldforgeAtlas || playerAtlasCell == null) return null;
    const graph = buildAtlasTravelGraph(worldforgeAtlas, { mobility: transportMobility(selectedTransport.option) });
    // Snap the origin to land if the player's mapped cell reads as sea/coastal,
    // so a land route can be planned from a coastal start.
    const origin = nearestLandCell(worldforgeAtlas, playerAtlasCell);
    return planRoutesFrom(graph, origin, {
      milesPerUnit: atlasMilesPerUnit(worldforgeAtlas),
      speedMph: transportSpeedMph(selectedTransport.option),
    });
  }, [interactionMode, worldforgeAtlas, playerAtlasCell, selectedTransport]);
  const planAtlasRoute = useCallback((toCell: number) => travelField?.to(toCell) ?? null, [travelField]);

  // Maritime travel mode: when the player hires a ferry, build one mixed graph
  // that can walk to a port, cross a generated sea lane, and walk away from the
  // destination harbor. This stays separate from `travelField` so "No sea
  // travel" preserves the original land-only route behavior.
  const travelMmField = useMemo(() => {
    if (interactionMode !== 'travel' || seaPref === 'none' || !worldforgeAtlas || playerAtlasCell == null) return null;
    const graph = buildMultiModalAtlasGraph(worldforgeAtlas, {
      landSpeedMph: transportSpeedMph(selectedTransport.option),
      sea: { kind: 'ferry', speedMph: 8 },
    });
    const origin = nearestLandCell(worldforgeAtlas, playerAtlasCell);
    return planRoutesFrom(graph, origin, {
      milesPerUnit: atlasMilesPerUnit(worldforgeAtlas),
      speedMph: transportSpeedMph(selectedTransport.option),
    });
  }, [interactionMode, seaPref, worldforgeAtlas, playerAtlasCell, selectedTransport]);

  const isAtlasLandCell = useCallback((cell: number): boolean => {
    const height = (worldforgeAtlas?.pack as unknown as { cells?: { h?: ArrayLike<number> } } | undefined)
      ?.cells?.h?.[cell] ?? 0;
    return height >= 20;
  }, [worldforgeAtlas]);

  const planAtlasMultiModal = useCallback((toCell: number) => {
    if (!worldforgeAtlas) return null;
    const plan = travelMmField?.to(toCell);
    if (!plan) return null;
    return segmentRoute(
      plan,
      (cell) => (isAtlasLandCell(cell) ? 'land' : 'sea'),
      atlasMilesPerUnit(worldforgeAtlas),
    );
  }, [travelMmField, isAtlasLandCell, worldforgeAtlas]);

  const planSelectedAtlasRoute = useCallback((toCell: number) => {
    return travelMmField?.to(toCell) ?? planAtlasRoute(toCell);
  }, [travelMmField, planAtlasRoute]);

  // SP4 atlas pins: place each discovered hidden place at the Voronoi SITE of the
  // atlas cell its grid tile maps to (the same grid↔atlas bridge the player marker
  // uses), so a pin sits inside its actual cell instead of drifting near a coast.
  // Falls back to the proportional grid-cell center if the cell/site is missing.
  const worldforgeDiscoveryPins = useMemo(() => {
    if (!worldforgeAtlas) return [];
    const pins = discoveredHiddenSites.map((s) => {
      const offset = s.offsetX != null && s.offsetY != null ? { x: s.offsetX, y: s.offsetY } : undefined;
      const [x, y] = gridCellToAtlasSite(
        worldforgeAtlas,
        { x: s.tileX, y: s.tileY },
        { cols: gridSize.cols, rows: gridSize.rows },
        offset,
      );
      return { x, y, label: s.name };
    });
    // Several sites in one tile snap to the same Voronoi site — fan them out so
    // each discovered place stays individually visible/clickable on the atlas.
    return spreadColocatedPoints(pins);
  }, [worldforgeAtlas, discoveredHiddenSites, gridSize.cols, gridSize.rows]);

  // Native-atlas cell pick → map the cell centroid to the legacy grid tile and
  // route to Enter-3D (preferred) or Travel to maintain travel contracts.
  // SP2 tiered drill-down: clicking a World Forge cell descends into its submap
  // (SP1 engine), and clicking a sub-cell recurses (world → region → local → …).
  // A stack of {model, ctx} tiers; "Ascend" pops back up. Reset on view/seed change.
  const SUBMAP_COUNT = 160;
  // A drill tier is a Voronoi submap, a generated SP-T town plan (the deepest 2D
  // tier), or — at the region tier — a neighbourhood (focus cell + atlas
  // neighbours with fog-of-war). For a neighbourhood tier, `model`/`ctx` are the
  // focus cell's submap so deeper drilling flows through the same handler.
  type DrillTier = { ctx: SubmapParentContext; model?: SubmapModel; town?: TownPlan; neighbourhood?: AtlasNeighbourhood;
    /** Sub-cell index the player occupies in this tier (drill player indicator), or null if the player isn't on this drill path. */
    playerCellIndex?: number | null };
  const [submapStack, setSubmapStack] = useState<DrillTier[]>([]);

  useEffect(() => { setSubmapStack([]); }, [worldforgeSeed]);

  // An atlas cell is "explored" if the world tile under its centroid has been
  // traveled into (tile.discovered). Drives the neighbourhood fog-of-war.
  const isExploredCell = useCallback((cellId: number): boolean => {
    if (!worldforgeAtlas) return false;
    const p = worldforgeAtlas.pack.cells.p?.[cellId];
    if (!p) return false;
    const tx = clampIndex(Math.floor((p[0] / worldforgeAtlas.graphWidth) * gridSize.cols), gridSize.cols);
    const ty = clampIndex(Math.floor((p[1] / worldforgeAtlas.graphHeight) * gridSize.rows), gridSize.rows);
    return projectedTiles[ty]?.[tx]?.discovered === true;
  }, [worldforgeAtlas, gridSize.cols, gridSize.rows, projectedTiles]);

  // Build a region-tier neighbourhood centered on an atlas cell.
  const buildNeighbourTier = useCallback((cellId: number): DrillTier | null => {
    if (!worldforgeAtlas) return null;
    const nbh = buildAtlasNeighbourhood(worldforgeAtlas, cellId, isExploredCell, rootSeedPath(worldforgeSeed), { submapCount: SUBMAP_COUNT });
    if (nbh.cells.length === 0) return null;
    const focusModel = nbh.cells.find((c) => c.isFocus)?.model;
    // If this region IS the player's atlas cell, mark the sub-cell they occupy.
    const playerCellIndex = cellId === playerAtlasCell && focusModel ? playerSubCellIndex(focusModel) : null;
    return { ctx: nbh.focusCtx, model: focusModel, neighbourhood: nbh, playerCellIndex };
  }, [worldforgeAtlas, worldforgeSeed, isExploredCell, playerAtlasCell]);

  const handleAtlasDrill = useCallback((info: CellTraits) => {
    const tier = buildNeighbourTier(info.i);
    if (tier) setSubmapStack([tier]);
  }, [buildNeighbourTier]);

  // Click a neighbour in the neighbourhood view → recenter on it, but only if
  // explored (unexplored cells stay grey/info-only until physically traveled to).
  const handleRecenter = useCallback((cellId: number) => {
    if (!isExploredCell(cellId)) return;
    const tier = buildNeighbourTier(cellId);
    if (tier) setSubmapStack((stack) => [...stack.slice(0, -1), tier]);
  }, [buildNeighbourTier, isExploredCell]);

  // Worldforge cell pick routes by interaction mode:
  // Explore (pan) drills into the recursive submap.
  // Travel / Enter-3D resolve the cell to its legacy grid tile for movement contracts.
  const handleWorldforgePick = useCallback((info: CellTraits) => {
    if (interactionMode === 'pan') { handleAtlasDrill(info); return; }
    if (!worldforgeAtlas) return;
    const p = worldforgeAtlas.pack.cells.p?.[info.i];
    if (!p) return;
    let tx = clampIndex(Math.floor((p[0] / worldforgeAtlas.graphWidth) * gridSize.cols), gridSize.cols);
    let ty = clampIndex(Math.floor((p[1] / worldforgeAtlas.graphHeight) * gridSize.rows), gridSize.rows);
    if (interactionMode === 'enter3d' && allow3DEntry && onEnter3DAtCell) {
      // The 3D ground generator places towns on tiles chosen by getTownTilesForGrid,
      // which uses a different burg→tile mapping than this proportional projection.
      // Landing on the proportional tile drops the player in wilderness next to the
      // town. If the picked cell carries a burg, snap to the exact tile that burg
      // generates on so "click a town, enter that town" actually holds.
      const burgId = worldforgeAtlas.pack.cells.burg?.[info.i];
      if (burgId && worldforgeSeed != null) {
        const townTiles = getTownTilesForGrid(worldforgeSeed, gridSize.cols, gridSize.rows);
        const exact = townTiles.filter((t) => t.burgId === burgId);
        const pool = exact.length ? exact : townTiles;
        if (pool.length) {
          const snapped = pool.reduce((best, t) =>
            Math.hypot(t.x - tx, t.y - ty) < Math.hypot(best.x - tx, best.y - ty) ? t : best,
          );
          tx = snapped.x;
          ty = snapped.y;
        }
      }
      const tile = projectedTiles[ty]?.[tx];
      if (!tile) return;
      onEnter3DAtCell(tx, ty, tile);
      return;
    }
    const tile = projectedTiles[ty]?.[tx];
    if (!tile) return;
    if (interactionMode === 'travel' && allowTravel) {
      // Resolve the planned route to the picked cell → real trip duration + a
      // pre-rolled "danger on the road" encounter, handed to the world-move
      // contract so the game clock advances by travel time, not a flat hour.
      const route = planSelectedAtlasRoute(info.i);
      let travelMeta: { seconds: number; encounterMessage?: string | null } | undefined;
      if (route) {
        const roll = rollTravelEncounter(route, rootSeedPath(worldforgeSeed));
        travelMeta = {
          seconds: Math.round(route.minutes * 60),
          encounterMessage: roll.encounter
            ? `After ${formatTravelTime(route.minutes)} on the road, danger finds you — an encounter!`
            : `You travel for ${formatTravelTime(route.minutes)} and arrive without incident.`,
        };
      }
      onTileClick(tx, ty, tile, travelMeta);
    }
  }, [interactionMode, handleAtlasDrill, worldforgeAtlas, gridSize.cols, gridSize.rows, projectedTiles, allow3DEntry, onEnter3DAtCell, allowTravel, onTileClick, planSelectedAtlasRoute, worldforgeSeed]);

  // Enter 3D from inside the drill: the leaf rung of World ▸ Region ▸ Local ▸ Town
  // ▸ 3D. Resolves the region's focus atlas cell (drill base) → world tile and
  // hands off via the existing onEnter3DAtCell contract.
  const handleEnter3DHere = useCallback(() => {
    if (!worldforgeAtlas || !onEnter3DAtCell) return;
    const cellId = submapStack[0]?.neighbourhood?.focusCellId;
    if (cellId == null) return;
    const p = worldforgeAtlas.pack.cells.p?.[cellId];
    if (!p) return;
    const tx = clampIndex(Math.floor((p[0] / worldforgeAtlas.graphWidth) * gridSize.cols), gridSize.cols);
    const ty = clampIndex(Math.floor((p[1] / worldforgeAtlas.graphHeight) * gridSize.rows), gridSize.rows);
    const tile = projectedTiles[ty]?.[tx];
    if (tile) onEnter3DAtCell(tx, ty, tile);
  }, [worldforgeAtlas, onEnter3DAtCell, submapStack, gridSize.cols, gridSize.rows, projectedTiles]);

  const handleSubmapDrill = useCallback((siteIndex: number) => {
    setSubmapStack((stack) => {
      // Cap drill depth at L3 (Locale 1): World → Region → Local → Locale 1 (stop).
      // L3 is the leaf rung — drill into a burg here for the town, or Enter 3D.
      if (stack.length >= 3) return stack;

      const top = stack[stack.length - 1];
      if (!top || !top.model) return stack; // town tiers are leaves — no deeper drill
      const cellIdx = top.model.cells.findIndex((c) => c.siteIndex === siteIndex);
      const cell = top.model.cells[cellIdx];
      if (!cell) return stack;
      // The drill stays on the player's path only if they drilled INTO the very
      // sub-cell they occupy. Then the child's player sub-cell is re-derived.
      const onPlayerPath = top.playerCellIndex != null && cellIdx === top.playerCellIndex;
      const childRaw = submapCellToChildContext(cell, top.ctx);
      if (childRaw.polygon.length < 3) return stack;
      // Normalize the sub-cell to a canonical span so each tier has healthy
      // geometry (a sub-cell is tiny → sliver wards/cells otherwise). Fit-to-view
      // means absolute scale is irrelevant to display.
      const childCtx = normalizeCtxScale(childRaw);
      // Settled (burg) cell → bottom out into a generated SP-T town plan.
      if (cell.feature?.kind === 'burg') {
        const water = (childCtx.polylines ?? []).filter((p) => p.kind === 'river').map((p) => p.points as Pt[]);
        const roads = (childCtx.polylines ?? []).filter((p) => p.kind === 'road').map((p) => p.points as Pt[]);
        const town = generateTownPlan(childCtx.polygon, streamPath(childCtx.seedPath, 'town'), {
          population: 4000, water, roads,
        });
        return [...stack, { ctx: childCtx, town, playerCellIndex: onPlayerPath ? 0 : null }];
      }
      const childModel = generateSubmap(childCtx, { count: SUBMAP_COUNT });
      return [...stack, { model: childModel, ctx: childCtx, playerCellIndex: onPlayerPath ? playerSubCellIndex(childModel) : null }];
    });
  }, []);

  const handleAscend = useCallback(() => setSubmapStack((stack) => stack.slice(0, -1)), []);
  // Pop the drill stack to a given depth (0 = back to the atlas / World tier).
  const handleAscendTo = useCallback((depth: number) => {
    setSubmapStack((stack) => (depth <= 0 ? [] : stack.slice(0, depth)));
  }, []);

  // Human tier name by drill depth (1-based): region → local → then locale.
  const tierName = (depth: number): string =>
    depth === 1 ? 'Region' : depth === 2 ? 'Local' : `Locale ${depth - 2}`;

  // Submap-tier travel: a route field over the drilled tier's Voronoi cells from
  // the player's sub-cell, so the same route preview works inside the drill.
  const submapTravelField = useMemo(() => {
    if (interactionMode !== 'travel') return null;
    const top = submapStack[submapStack.length - 1];
    if (!top?.model || top.playerCellIndex == null) return null;
    return planRoutesFrom(buildSubmapTravelGraph(top.model), top.playerCellIndex, {
      milesPerUnit: 0.02, // ~20 miles across a normalized region tier
      speedMph: transportSpeedMph(selectedTransport.option),
    });
  }, [interactionMode, submapStack, selectedTransport]);
  const planSubmapRoute = useCallback((idx: number) => submapTravelField?.to(idx) ?? null, [submapTravelField]);

  const handleRegenerateWithSeed = useCallback(() => {
    if (!onRegenerateWorld) return;
    const parsedSeed = Number.parseInt(seedInput.trim(), 10);
    if (Number.isFinite(parsedSeed)) {
      onRegenerateWorld(Math.abs(parsedSeed));
      return;
    }
    onRegenerateWorld();
  }, [onRegenerateWorld, seedInput]);

  const handleRerollSeed = useCallback(() => {
    if (!onRegenerateWorld) return;
    onRegenerateWorld();
  }, [onRegenerateWorld]);

  return (
    <WindowFrame
      title="World Map"
      onClose={onClose}
      storageKey={WINDOW_KEYS.WORLD_MAP}
    >
      <div
        className="bg-gray-800 p-4 md:p-6 flex flex-col h-full w-full"
        style={{ backgroundImage: `url(${oldPaperBg})`, backgroundSize: 'cover' }}
      >
        <div className="mb-3 space-y-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setInteractionMode('pan')}
              className={`px-2 py-1 rounded ${interactionMode === 'pan' ? 'bg-emerald-700 text-white' : 'bg-gray-600 text-gray-100'}`}
              type="button"
              title="Click a cell to drill into its submap"
            >
              Explore
            </button>
            {allowTravel && (
              <button
                onClick={() => setInteractionMode('travel')}
                className={`px-2 py-1 rounded ${interactionMode === 'travel' ? 'bg-amber-700 text-white' : 'bg-gray-600 text-gray-100'}`}
                type="button"
              >
                Travel
              </button>
            )}
            {allowTravel && interactionMode === 'travel' && (
              <select
                value={transportId}
                onChange={(e) => setTransportId(e.target.value)}
                className="px-2 py-1 rounded bg-gray-700 text-gray-100 border border-gray-500"
                title="Transport for this trip — affects travel time"
                aria-label="Transport"
              >
                {transportChoices.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            )}
            {allowTravel && interactionMode === 'travel' && (
              <select
                data-testid="travel-sea-pref"
                value={seaPref}
                onChange={(e) => setSeaPref(e.target.value as SeaPreference)}
                className="px-2 py-1 rounded bg-gray-700 text-gray-100 border border-gray-500"
                title="Sea travel: hire a ferry to cross water"
                aria-label="Sea travel"
              >
                <option value="none">No sea travel</option>
                <option value="ferry">Ferry (hired)</option>
              </select>
            )}
            {allow3DEntry && (
              <button
                onClick={() => setInteractionMode('enter3d')}
                className={`px-2 py-1 rounded ${interactionMode === 'enter3d' ? 'bg-rose-700 text-white' : 'bg-gray-600 text-gray-100'}`}
                type="button"
                title="Click a discovered cell to enter the streamed 3D world there"
              >
                Enter 3D
              </button>
            )}
            {(allowTravel && interactionMode === 'travel') || (allow3DEntry && interactionMode === 'enter3d') ? (
              <button
                onClick={() => setShowPrecisionOverlay(current => !current)}
                className={`px-2 py-1 rounded ${showPrecisionOverlay ? 'bg-cyan-800 text-white' : 'bg-gray-600 text-gray-100'}`}
                type="button"
                title="Show cell targeting overlays for precise travel"
              >
                Precision
              </button>
            ) : null}
            <span className="ml-2 text-gray-800">Seed: {worldforgeSeed}</span>
          </div>

          {showGenerationControls && (
            <div className="flex items-center gap-2 flex-wrap">
              <label htmlFor="world-seed-input" className="text-gray-800 font-semibold">
                World Seed
              </label>
              <input
                id="world-seed-input"
                type="number"
                value={seedInput}
                onChange={(event) => setSeedInput(event.target.value)}
                className="w-40 rounded border border-gray-500 bg-white/90 px-2 py-1 text-gray-900"
              />
              <button
                onClick={handleRegenerateWithSeed}
                className={`px-2 py-1 rounded text-white ${canRegenerateWorld ? 'bg-indigo-700 hover:bg-indigo-600' : 'bg-gray-500'}`}
                type="button"
                title={canRegenerateWorld ? 'Generate world using this seed' : generationLockedReason || 'Generation is currently locked'}
              >
                Apply Seed
              </button>
              <button
                onClick={handleRerollSeed}
                className={`px-2 py-1 rounded text-white ${canRegenerateWorld ? 'bg-violet-700 hover:bg-violet-600' : 'bg-gray-500'}`}
                type="button"
                title={canRegenerateWorld ? 'Generate a fresh random world seed' : generationLockedReason || 'Generation is currently locked'}
              >
                Reroll World
              </button>
              {!canRegenerateWorld && generationLockedReason && (
                <span className="text-amber-700">{generationLockedReason}</span>
              )}
            </div>
          )}
        </div>

        <div
          ref={worldforgeViewportRef}
          className="relative min-h-0 overflow-hidden flex-grow rounded bg-slate-950 border border-slate-700"
          data-testid="worldforge-map-viewport"
          data-island-harbors-enabled={enableIslandHarbors ? 'true' : 'false'}
        >
            {!worldforgeAtlas ? (
              <div className="text-slate-100 text-sm">Forging world…</div>
            ) : submapStack.length > 0 ? (
              <>
                {submapStack[submapStack.length - 1].town ? (
                  <TownPlanView
                    plan={submapStack[submapStack.length - 1].town!}
                    width={worldforgeViewportSize.width}
                    height={worldforgeViewportSize.height}
                    prefsScope={worldforgeSeed}
                  />
                ) : submapStack[submapStack.length - 1].neighbourhood ? (
                  <NeighbourhoodSvgView
                    neighbourhood={submapStack[submapStack.length - 1].neighbourhood!}
                    width={worldforgeViewportSize.width}
                    height={worldforgeViewportSize.height}
                    playerCellId={playerAtlasCell}
                    playerCellIndex={submapStack[submapStack.length - 1].playerCellIndex ?? null}
                    prefsScope={worldforgeSeed}
                    onPickCell={handleSubmapDrill}
                    onPickNeighbour={handleRecenter}
                  />
                ) : (
                  <SubmapSvgView
                    model={submapStack[submapStack.length - 1].model!}
                    width={worldforgeViewportSize.width}
                    height={worldforgeViewportSize.height}
                    onPickCell={handleSubmapDrill}
                    playerCellIndex={submapStack[submapStack.length - 1].playerCellIndex ?? null}
                    prefsScope={worldforgeSeed}
                    travelActive={interactionMode === 'travel'}
                    planRoute={planSubmapRoute}
                    transportLabel={selectedTransport.readoutLabel}
                  />
                )}
                <div className="absolute top-2 left-2 flex flex-col gap-1 z-[2]">
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      onClick={handleAscend}
                      className="px-2 py-1 rounded bg-slate-800/90 text-slate-100 text-xs border border-slate-600 hover:bg-slate-700"
                      type="button"
                    >
                      ◀ Ascend
                    </button>
                    {allow3DEntry && onEnter3DAtCell
                      && submapStack[0]?.neighbourhood
                      && isExploredCell(submapStack[0].neighbourhood!.focusCellId) && (
                      <button
                        onClick={handleEnter3DHere}
                        className="px-2 py-1 rounded bg-rose-700 text-white text-xs border border-rose-900 hover:bg-rose-600"
                        type="button"
                        title="Enter the streamed 3D world at this region"
                      >
                        Enter 3D here
                      </button>
                    )}
                    {/* Breadcrumb: World ▸ Region ▸ Local … — click a crumb to ascend to it. */}
                    <nav className="flex items-center gap-0.5 px-2 py-1 rounded bg-black/60 text-xs" aria-label="Submap tier path">
                      <button
                        type="button"
                        onClick={() => handleAscendTo(0)}
                        className="text-sky-300 hover:underline"
                      >
                        World
                      </button>
                      {submapStack.map((tier, i) => {
                        const depth = i + 1;
                        const isLast = depth === submapStack.length;
                        const burg = tier.town
                          ? tier.ctx.features?.find((f) => f.kind === 'burg')?.name
                          : tier.model && tier.model.burgCellIndex != null
                            ? tier.model.cells[tier.model.burgCellIndex]?.feature?.name
                            : undefined;
                        const label = tier.town
                          ? `Town${burg ? ` · ${burg}` : ''}`
                          : burg ? `${tierName(depth)} · ${burg}` : tierName(depth);
                        return (
                          <span key={depth} className="flex items-center gap-0.5">
                            <span className="text-slate-500">▸</span>
                            {isLast ? (
                              <span className="text-slate-100 font-medium">{label}</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAscendTo(depth)}
                                className="text-sky-300 hover:underline"
                              >
                                {label}
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </nav>
                  </div>
                  <span className="px-2 py-1 rounded bg-black/60 text-slate-200 text-xs self-start">
                    {submapStack[submapStack.length - 1].town
                      ? 'Town plan — pan/zoom to explore'
                      : `${submapStack[submapStack.length - 1].model?.biome ?? 'Unknown biome'} — click a cell to drill deeper`}
                  </span>
                </div>
              </>
            ) : (
              <AtlasSvgView
                atlas={worldforgeAtlas}
                width={worldforgeViewportSize.width}
                height={worldforgeViewportSize.height}
                marker={worldforgeMarker}
                markers={worldforgeDiscoveryPins}
                onPickCell={handleWorldforgePick}
                travelActive={interactionMode === 'travel'}
                planRoute={planAtlasRoute}
                planMultiModalRoute={planAtlasMultiModal}
                transportLabel={selectedTransport.readoutLabel}
                prefsScope={worldforgeSeed}
              />
            )}
          </div>

        <p className="text-xs text-center mt-2 text-gray-700">
          {allowTravel || allow3DEntry
            ? 'World map: use Pan/Zoom to explore. Travel moves on the world grid; Enter 3D jumps into the streamed world at a discovered cell. Click a cell to drill into the submap.'
            : 'World map: use Pan/Zoom and layer controls to inspect world generation before starting a game. Click cells to drill deeper.'}
        </p>
      </div>
    </WindowFrame>
  );
};

export default MapPane;
