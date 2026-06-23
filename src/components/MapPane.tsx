// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 22/06/2026, 23:30:15
 * Dependents: components/layout/GameModals.tsx
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file MapPane.tsx
 * World map modal surface. The player-facing map is now the Azgaar atlas, with
 * an optional World Forge render-port for native cartography work.
 *
 * The pane still receives legacy `MapData`, but discovery/current-player reads
 * now pass through the World geography adapter before the atlas click overlay
 * consumes them. That preserves today's travel, discovery, and 3D-entry
 * contracts while the old square-grid renderer is deprecated from the UI.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapData, MapTile as MapTileType } from '../types';
import { BIOMES } from '../constants';
import type { AzgaarAtlasTransform } from '@/utils/spatial';
import {
  getCellOverlayPercentRect,
} from '@/utils/spatial';
import oldPaperBg from '../assets/images/old-paper.svg';
import { WindowFrame } from './ui/WindowFrame';
import { WINDOW_KEYS } from '../styles/uiIds';
import AtlasPlayerMarker from './World3D/AtlasPlayerMarker';
import type { PlayerWorldPosition } from '../types';
import {
  fromMapData,
  resolveLegacyTile,
  type WorldGeographySnapshot,
} from '@/utils/world/worldGeographyAdapter';
import AtlasSvgView from './Worldforge/AtlasSvgView';
import { generateFmgAtlas } from '@/systems/worldforge/fmg/generateAtlas';

interface MapPaneProps {
  mapData: MapData;
  worldSeed?: number;
  onTileClick: (x: number, y: number, tile: MapTileType) => void;
  /** When set, clicking a discovered cell in Enter 3D mode starts streamed world entry. */
  onEnter3DAtCell?: (x: number, y: number, tile: MapTileType) => void;
  /** Last known 3D position — draws AtlasPlayerMarker on the Azgaar overlay. */
  playerWorldPos?: PlayerWorldPosition | null;
  onClose: () => void;
  allowTravel?: boolean;
  /** Show Enter 3D interaction mode (PLAYING phase atlas click-to-travel). */
  allow3DEntry?: boolean;
  showGenerationControls?: boolean;
  canRegenerateWorld?: boolean;
  generationLockedReason?: string | null;
  onRegenerateWorld?: (seed?: number) => void;
}

type WorldMapViewMode = 'azgaar' | 'worldforge';
type WorldMapInteractionMode = 'pan' | 'travel' | 'enter3d';

const AZGAAR_EMBED_STYLE_ID = 'aralia-azgaar-embed-style';
const AZGAAR_EMBED_SCRIPT_ID = 'aralia-azgaar-embed-bridge';
function getAzgaarBasePath(): string {
  const baseUrl = import.meta.env.BASE_URL || '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}vendor/azgaar/index.html`;
}

const AZGAAR_RUNTIME_REV = '20260212-r2';

function clampIndex(value: number, maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  return Math.max(0, Math.min(maxExclusive - 1, value));
}

function hashText(seed: number, text: string): number {
  let hash = seed;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = (hash * 16777619) >>> 0;
  }
  return hash;
}

function deriveAzgaarSeed(mapData: MapData): number {
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

/**
 * Description of an actual Azgaar Voronoi cell (returned by the iframe bridge's
 * describeCell). Replaces the old square-grid tile readout on hover.
 */
interface AzgaarCellInfo {
  i: number;
  height: number;
  land: boolean;
  biome?: string;
  state?: string;
  province?: string;
  culture?: string;
  religion?: string;
  burg?: { name: string; population: number; capital: boolean; port: boolean };
  population?: number;
}

const MapPane: React.FC<MapPaneProps> = ({
  mapData,
  worldSeed,
  onTileClick,
  onEnter3DAtCell,
  playerWorldPos = null,
  onClose,
  allowTravel = true,
  allow3DEntry = false,
  showGenerationControls = false,
  canRegenerateWorld = false,
  generationLockedReason = null,
  onRegenerateWorld,
}) => {
  const { gridSize } = mapData;
  const geographySnapshot = useMemo(() => fromMapData(mapData), [mapData]);
  const projectedMapData = useMemo(() => projectMapDataForRead(mapData), [mapData]);
  const projectedTiles = projectedMapData.tiles;
  const [viewMode, setViewMode] = useState<WorldMapViewMode>('azgaar');
  const [interactionMode, setInteractionMode] = useState<WorldMapInteractionMode>(allowTravel ? 'travel' : 'pan');
  const [isFrameReady, setIsFrameReady] = useState(false);
  const [frameError, setFrameError] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);
  const [atlasTransform, setAtlasTransform] = useState<AzgaarAtlasTransform | null>(null);
  const [showPrecisionOverlay, setShowPrecisionOverlay] = useState(true);
  const [seedInput, setSeedInput] = useState('');
  // Voronoi cell polygon under the cursor in Travel mode (graph-space vertices),
  // queried live from the Azgaar iframe bridge. Drives the reddish highlight.
  const [hoveredVoronoiPoly, setHoveredVoronoiPoly] = useState<Array<[number, number]> | null>(null);
  // Description of the Azgaar Voronoi cell under the cursor (Travel mode).
  const [hoveredAzgaarCell, setHoveredAzgaarCell] = useState<AzgaarCellInfo | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const embedOverlayRef = useRef<HTMLDivElement>(null);
  const readinessTimersRef = useRef<number[]>([]);

  const azgaarSeed = useMemo(() => worldSeed ?? deriveAzgaarSeed(mapData), [mapData, worldSeed]);
  const azgaarSrc = useMemo(() => {
    const azgaarBasePath = getAzgaarBasePath();
    return `${azgaarBasePath}?seed=${azgaarSeed}&options=default&runtime=${AZGAAR_RUNTIME_REV}`;
  }, [azgaarSeed]);

  // Native Worldforge SVG render-port (SP0). Generated lazily from the same seed
  // the Azgaar embed uses, only while the World Forge view is active. A throw
  // here surfaces honestly via the surrounding ErrorBoundary (no silent fallback).
  const worldforgeAtlas = useMemo(
    () => (viewMode === 'worldforge' ? generateFmgAtlas(String(azgaarSeed)) : null),
    [viewMode, azgaarSeed],
  );

  const applyReadOnlyAzgaarMode = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const iframeWindow = iframe.contentWindow;
    const iframeDocument = iframe.contentDocument;
    if (!iframeWindow || !iframeDocument) return;

    if (!iframeDocument.getElementById(AZGAAR_EMBED_STYLE_ID)) {
      const styleTag = iframeDocument.createElement('style');
      styleTag.id = AZGAAR_EMBED_STYLE_ID;
      styleTag.textContent = `
        /* Keep Azgaar UI available for option triage, but disable destructive controls in JS. */
        #exitCustomization { display: none !important; }
        #sticked > button:not(#zoomReset) { display: none !important; }
        #regenerate { display: none !important; }

        /* Ensure the SVG remains interactive for pan/zoom in Pan mode. */
        #map {
          position: fixed !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          user-select: none !important;
        }
        body { margin: 0 !important; overflow: hidden !important; }
      `;
      iframeDocument.head.appendChild(styleTag);
    }

    // Install a bridge script into the iframe so the parent can do accurate click->cell mapping
    // even after Azgaar pan/zoom transforms are applied. Also disable destructive generator actions.
    if (!iframeDocument.getElementById(AZGAAR_EMBED_SCRIPT_ID)) {
      const scriptTag = iframeDocument.createElement('script');
      scriptTag.id = AZGAAR_EMBED_SCRIPT_ID;
      scriptTag.type = 'text/javascript';
      scriptTag.text = `
        (function () {
          try {
            if (!window.__araliaAzgaar) window.__araliaAzgaar = {};

            window.__araliaAzgaar.getTransform = function () {
              try {
                return { graphWidth: graphWidth, graphHeight: graphHeight, viewX: viewX, viewY: viewY, scale: scale };
              } catch (e) {
                return null;
              }
            };

            window.__araliaAzgaar.resetZoom = function (d) {
              try { resetZoom(typeof d === 'number' ? d : 1000); return true; } catch (e) { return false; }
            };

            // Turn Azgaar's "Cells" layer (the Voronoi mesh) on or off. Mirrors
            // the Layers panel toggle; used to auto-show cells in Travel mode.
            window.__araliaAzgaar.setCellsLayer = function (on) {
              try {
                var isOn = (typeof layerIsOn === 'function') ? layerIsOn('toggleCells') : false;
                if (isOn !== !!on && typeof toggleCells === 'function') toggleCells();
                return true;
              } catch (e) { return false; }
            };

            // Biome name lookup, cached lazily (getDefault rebuilds the table).
            window.__araliaAzgaar._biomeNames = null;
            function biomeNames() {
              if (!window.__araliaAzgaar._biomeNames) {
                try {
                  if (typeof Biomes !== 'undefined' && Biomes.getDefault) {
                    window.__araliaAzgaar._biomeNames = Biomes.getDefault().name || null;
                  }
                } catch (e) { /* ignore */ }
              }
              return window.__araliaAzgaar._biomeNames;
            }

            // Describe an actual Azgaar Voronoi cell: terrain, biome, and the
            // political/cultural ownership the generator assigned. Used for the
            // hover readout (replacing the old square-grid tile description).
            window.__araliaAzgaar.describeCell = function (i) {
              try {
                var cells = pack.cells;
                var h = cells.h[i];
                var info = { i: i, height: h, land: h >= 20 };
                var bn = biomeNames();
                if (bn && cells.biome) info.biome = bn[cells.biome[i]];
                var sId = cells.state ? cells.state[i] : 0;
                if (sId && pack.states && pack.states[sId] && !pack.states[sId].removed) {
                  info.state = pack.states[sId].fullName || pack.states[sId].name;
                }
                var prId = cells.province ? cells.province[i] : 0;
                if (prId && pack.provinces && pack.provinces[prId] && pack.provinces[prId].i) {
                  info.province = pack.provinces[prId].fullName || pack.provinces[prId].name;
                }
                var cuId = cells.culture ? cells.culture[i] : 0;
                if (cuId && pack.cultures && pack.cultures[cuId] && pack.cultures[cuId].i) {
                  info.culture = pack.cultures[cuId].name;
                }
                var reId = cells.religion ? cells.religion[i] : 0;
                if (reId && pack.religions && pack.religions[reId] && pack.religions[reId].i) {
                  info.religion = pack.religions[reId].name;
                }
                var bId = cells.burg ? cells.burg[i] : 0;
                if (bId && pack.burgs && pack.burgs[bId] && !pack.burgs[bId].removed) {
                  var b = pack.burgs[bId];
                  info.burg = {
                    name: b.name,
                    population: Math.round((b.population || 0) * 1000),
                    capital: !!b.capital,
                    port: !!b.port
                  };
                }
                if (cells.pop && cells.pop[i] > 0) info.population = Math.round(cells.pop[i] * 1000);
                return info;
              } catch (e) { return { i: i }; }
            };

            // Hit-test a graph-space point to its Voronoi cell and return the
            // cell's polygon vertices (graph coords), centroid, and a content
            // description so the parent can draw the cursor-following highlight
            // and show the real cell's details outside the iframe.
            window.__araliaAzgaar.getCellPolygonAt = function (xWorld, yWorld) {
              try {
                if (typeof findCell !== 'function' || typeof pack === 'undefined') return null;
                var i = findCell(xWorld, yWorld);
                if (i === undefined || i === null || i < 0) return null;
                var vIds = pack.cells.v[i];
                if (!vIds || vIds.length < 3) return null;
                var pts = [];
                for (var k = 0; k < vIds.length; k++) {
                  var p = pack.vertices.p[vIds[k]];
                  if (p) pts.push([p[0], p[1]]);
                }
                var c = pack.cells.p[i] || null; // cell centroid (graph coords)
                return { i: i, points: pts, c: c, info: window.__araliaAzgaar.describeCell(i) };
              } catch (e) { return null; }
            };

            // Hard-disable actions that would desync the embedded generator from Aralia gameplay.
            var blockedFns = ['regeneratePrompt', 'showSavePane', 'showExportPane', 'showLoadPane'];
            blockedFns.forEach(function (name) {
              if (typeof window[name] === 'function') {
                window[name] = function () { try { if (window.tip) tip('Disabled in Aralia embed', false, 'error', 4000); } catch (e) {} };
              }
            });

            // Block clicks on known destructive controls (defense in depth).
            var blockedIds = ['newMapButton','saveButton','exportButton','loadButton','regenerate'];
            document.addEventListener('click', function (ev) {
              var t = ev.target;
              if (!t || !t.id) return;
              if (blockedIds.indexOf(t.id) !== -1) {
                ev.preventDefault();
                ev.stopPropagation();
                try { if (window.tip) tip('Disabled in Aralia embed', false, 'error', 4000); } catch (e) {}
              }
            }, true);

            blockedIds.forEach(function (id) {
              var el = document.getElementById(id);
              if (!el) return;
              try { el.setAttribute('aria-disabled', 'true'); } catch (e) {}
              try { el.style.pointerEvents = 'none'; el.style.opacity = '0.45'; } catch (e) {}
              try { el.title = 'Disabled in Aralia embed'; } catch (e) {}
            });

            // Force the SVG to stretch-fill the iframe viewport instead of
            // letterboxing via the default preserveAspectRatio="xMidYMid meet"
            // (the black dead-zone Remy hit 2026-06-12; CSS on the SVG element
            // cannot fix this — it is viewBox-to-viewport mapping). Cell
            // targeting is normalized over overlay bounds, so stretch is safe.
            var mapSvg = document.getElementById('map');
            if (mapSvg) {
              mapSvg.setAttribute('preserveAspectRatio', 'none');
            }
          } catch (e) {
            // ignore
          }
        })();
      `;
      iframeDocument.body.appendChild(scriptTag);
    }

    setIsFrameReady(true);
    setFrameError(null);
  }, []);

  const clearReadinessTimers = useCallback(() => {
    readinessTimersRef.current.forEach(timerId => window.clearTimeout(timerId));
    readinessTimersRef.current = [];
  }, []);

  const scheduleReadOnlyInitialization = useCallback(() => {
    clearReadinessTimers();
    const delays = [0, 300, 1000, 2000];
    delays.forEach(delay => {
      const timerId = window.setTimeout(() => {
        try {
          applyReadOnlyAzgaarMode();
        } catch (error) {
          setFrameError(`Azgaar embed initialization failed: ${String(error)}`);
        }
      }, delay);
      readinessTimersRef.current.push(timerId);
    });
  }, [applyReadOnlyAzgaarMode, clearReadinessTimers]);

  useEffect(() => {
    return () => {
      clearReadinessTimers();
    };
  }, [clearReadinessTimers]);

  useEffect(() => {
    if (viewMode !== 'azgaar') return;
    setIsFrameReady(false);
    setFrameError(null);
  }, [azgaarSrc, viewMode]);

  useEffect(() => {
    if (!allowTravel && interactionMode === 'travel') {
      setInteractionMode('pan');
    }
    if (!allow3DEntry && interactionMode === 'enter3d') {
      setInteractionMode('pan');
    }
  }, [allow3DEntry, allowTravel, interactionMode]);

  useEffect(() => {
    setSeedInput(String(azgaarSeed));
  }, [azgaarSeed]);

  const readAtlasTransform = useCallback((): AzgaarAtlasTransform | null => {
    // Read the live pan/zoom transform from the Azgaar iframe bridge when it is
    // available. The bridge is installed dynamically inside the embedded atlas.
    // DEBT: Cast to any to probe dynamic Azgaar bridge object on the iframe content window.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bridge = (iframeRef.current?.contentWindow as any)?.__araliaAzgaar;
    const transform = bridge?.getTransform?.() as AzgaarAtlasTransform | null | undefined;
    if (
      !transform
      || transform.graphWidth <= 0
      || transform.graphHeight <= 0
      || transform.scale <= 0
    ) {
      return null;
    }
    return transform;
  }, []);

  const resolveCellFromPointer = useCallback((clientX: number, clientY: number) => {
    const overlay = embedOverlayRef.current;
    if (!overlay) return null;

    const bounds = overlay.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;

    const fallbackNormalizedX = (clientX - bounds.left) / bounds.width;
    const fallbackNormalizedY = (clientY - bounds.top) / bounds.height;

    const transform = readAtlasTransform();

    let normalizedX = fallbackNormalizedX;
    let normalizedY = fallbackNormalizedY;

    if (transform && transform.graphWidth > 0 && transform.graphHeight > 0 && transform.scale > 0) {
      const xSvg = fallbackNormalizedX * transform.graphWidth;
      const ySvg = fallbackNormalizedY * transform.graphHeight;
      const xWorld = (xSvg - transform.viewX) / transform.scale;
      const yWorld = (ySvg - transform.viewY) / transform.scale;
      normalizedX = xWorld / transform.graphWidth;
      normalizedY = yWorld / transform.graphHeight;
    }

    const x = clampIndex(Math.floor(normalizedX * gridSize.cols), gridSize.cols);
    const y = clampIndex(Math.floor(normalizedY * gridSize.rows), gridSize.rows);

    const tile = projectedTiles[y]?.[x];
    if (!tile) return null;
    return { x, y, tile };
  }, [gridSize.cols, gridSize.rows, readAtlasTransform, projectedTiles]);

  const resolveWorldFromPointer = useCallback((clientX: number, clientY: number) => {
    // Map a screen point to Azgaar graph-space coordinates (the same space the
    // iframe's Voronoi pack uses), accounting for the live pan/zoom transform.
    const overlay = embedOverlayRef.current;
    if (!overlay) return null;
    const bounds = overlay.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    const transform = readAtlasTransform();
    if (!transform) return null;
    const fx = (clientX - bounds.left) / bounds.width;
    const fy = (clientY - bounds.top) / bounds.height;
    const xSvg = fx * transform.graphWidth;
    const ySvg = fy * transform.graphHeight;
    return {
      xWorld: (xSvg - transform.viewX) / transform.scale,
      yWorld: (ySvg - transform.viewY) / transform.scale,
    };
  }, [readAtlasTransform]);

  const gridTileFromWorld = useCallback((xWorld: number, yWorld: number) => {
    // Map an Azgaar graph-space point (e.g. a Voronoi cell centroid) to the
    // Aralia grid tile that contains it — the same normalize→grid step that
    // resolveCellFromPointer applies to a pointer's world coords.
    const transform = readAtlasTransform();
    if (!transform || transform.graphWidth <= 0 || transform.graphHeight <= 0) return null;
    const x = clampIndex(Math.floor((xWorld / transform.graphWidth) * gridSize.cols), gridSize.cols);
    const y = clampIndex(Math.floor((yWorld / transform.graphHeight) * gridSize.rows), gridSize.rows);
    const tile = projectedTiles[y]?.[x];
    if (!tile) return null;
    return { x, y, tile };
  }, [gridSize.cols, gridSize.rows, readAtlasTransform, projectedTiles]);

  const handleOverlayClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const resolved = resolveCellFromPointer(event.clientX, event.clientY);
    if (!resolved) return;

    if (interactionMode === 'enter3d' && allow3DEntry && onEnter3DAtCell) {
      onEnter3DAtCell(resolved.x, resolved.y, resolved.tile);
      return;
    }

    if (!allowTravel || interactionMode !== 'travel') return;

    // Travel to the highlighted Voronoi cell: resolve the cell under the click
    // and travel to the grid tile at its centroid, so movement matches the
    // reddish highlight rather than the raw pointer pixel. Falls back to the
    // direct pointer→grid mapping if the iframe bridge is unavailable.
    const world = resolveWorldFromPointer(event.clientX, event.clientY);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bridge = (iframeRef.current?.contentWindow as any)?.__araliaAzgaar;
    const cell = world ? bridge?.getCellPolygonAt?.(world.xWorld, world.yWorld) : null;
    if (cell?.c && Array.isArray(cell.c)) {
      const centroidTile = gridTileFromWorld(cell.c[0], cell.c[1]);
      if (centroidTile) {
        onTileClick(centroidTile.x, centroidTile.y, centroidTile.tile);
        return;
      }
    }

    onTileClick(resolved.x, resolved.y, resolved.tile);
  }, [allow3DEntry, allowTravel, interactionMode, onEnter3DAtCell, onTileClick, resolveCellFromPointer, resolveWorldFromPointer, gridTileFromWorld]);

  const handleOverlayMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (interactionMode !== 'travel' && interactionMode !== 'enter3d') return;
    setAtlasTransform(readAtlasTransform());
    const resolved = resolveCellFromPointer(event.clientX, event.clientY);
    if (!resolved) {
      setHoveredCell(null);
    } else {
      setHoveredCell({ x: resolved.x, y: resolved.y });
    }

    // Travel mode: ask the iframe bridge which Voronoi cell sits under the
    // cursor and remember its polygon so the highlight follows the mouse from
    // cell to cell. (Enter-3D keeps the legacy rectangular precision overlay.)
    if (interactionMode === 'travel') {
      const world = resolveWorldFromPointer(event.clientX, event.clientY);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bridge = (iframeRef.current?.contentWindow as any)?.__araliaAzgaar;
      const cell = world ? bridge?.getCellPolygonAt?.(world.xWorld, world.yWorld) : null;
      setHoveredVoronoiPoly(cell?.points && cell.points.length >= 3 ? cell.points : null);
      setHoveredAzgaarCell((cell?.info as AzgaarCellInfo | undefined) ?? null);
    }
  }, [interactionMode, readAtlasTransform, resolveCellFromPointer, resolveWorldFromPointer]);

  const overlayCapturesClicks =
    (allowTravel && interactionMode === 'travel')
    || (allow3DEntry && interactionMode === 'enter3d');

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

  const playerCellRect = useMemo(() => {
    // Convert the player's current cell into the same overlay coordinate space as
    // the destination highlight so travel origin and target are visually paired.
    if (!playerCell) return null;
    return getCellOverlayPercentRect(
      playerCell.x,
      playerCell.y,
      gridSize.cols,
      gridSize.rows,
      atlasTransform,
    );
  }, [atlasTransform, gridSize.cols, gridSize.rows, playerCell]);

  const hoveredVoronoiPercentPoints = useMemo(() => {
    // Project the hovered Voronoi polygon (graph coords) into overlay-percent
    // space using the live pan/zoom transform, matching the iframe's mapping.
    if (!hoveredVoronoiPoly || !atlasTransform) return null;
    const { graphWidth, graphHeight, viewX, viewY, scale } = atlasTransform;
    if (graphWidth <= 0 || graphHeight <= 0 || scale <= 0) return null;
    return hoveredVoronoiPoly
      .map(([px, py]) => {
        const sx = ((px * scale + viewX) / graphWidth) * 100;
        const sy = ((py * scale + viewY) / graphHeight) * 100;
        return `${sx.toFixed(3)},${sy.toFixed(3)}`;
      })
      .join(' ');
  }, [hoveredVoronoiPoly, atlasTransform]);

  useEffect(() => {
    // Refresh the transform once the iframe is ready so the player-cell outline
    // appears correctly even before the first mouse move in Travel mode.
    if (viewMode !== 'azgaar' || !isFrameReady) return;
    setAtlasTransform(readAtlasTransform());
  }, [isFrameReady, readAtlasTransform, viewMode]);

  useEffect(() => {
    // Re-project the 3D player marker when position updates (e.g. after exiting 3D).
    if (viewMode !== 'azgaar' || !playerWorldPos) return;
    setAtlasTransform(readAtlasTransform());
  }, [playerWorldPos, readAtlasTransform, viewMode]);

  useEffect(() => {
    // Auto-show Azgaar's Cells layer (Voronoi mesh) while Travel mode is active,
    // and hide it again on leaving travel — so the cells you can highlight and
    // travel across are visible without manually opening the Layers panel.
    if (viewMode !== 'azgaar' || !isFrameReady) return;
    const wantCells = interactionMode === 'travel';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setCells = () => (iframeRef.current?.contentWindow as any)?.__araliaAzgaar?.setCellsLayer?.(wantCells);
    setCells();
    // The generator's layer functions can lag the bridge install; retry briefly.
    const t = window.setTimeout(setCells, 400);
    if (!wantCells) {
      setHoveredVoronoiPoly(null);
      setHoveredAzgaarCell(null);
    }
    return () => window.clearTimeout(t);
  }, [interactionMode, isFrameReady, viewMode]);

  const handleIframeError = useCallback(() => {
    // The legacy square-grid fallback is intentionally gone. Keeping the player
    // on the atlas surface makes map failures honest and prevents the deprecated
    // renderer from remaining a hidden gameplay path.
    setFrameError('Azgaar world map could not be loaded.');
    setIsFrameReady(false);
  }, []);

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
              onClick={() => setViewMode('azgaar')}
              className={`px-2 py-1 rounded ${viewMode === 'azgaar' ? 'bg-blue-700 text-white' : 'bg-gray-600 text-gray-100'}`}
              type="button"
            >
              Azgaar Atlas
            </button>
            <button
              onClick={() => setViewMode('worldforge')}
              className={`px-2 py-1 rounded ${viewMode === 'worldforge' ? 'bg-blue-700 text-white' : 'bg-gray-600 text-gray-100'}`}
              type="button"
              title="Native Worldforge SVG render-port (replaces the Azgaar embed)"
            >
              World Forge
            </button>
            {viewMode === 'azgaar' && (
              <>
                <button
                  onClick={() => setInteractionMode('pan')}
                  className={`px-2 py-1 rounded ${interactionMode === 'pan' ? 'bg-emerald-700 text-white' : 'bg-gray-600 text-gray-100'}`}
                  type="button"
                >
                  Pan/Zoom
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
              </>
            )}
            <span className="ml-2 text-gray-800">Seed: {azgaarSeed}</span>
            {frameError && <span className="text-red-700">{frameError}</span>}
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

        {viewMode === 'azgaar' ? (
          <div className="relative overflow-hidden flex-grow rounded bg-slate-950 border border-slate-700">
            <iframe
              ref={iframeRef}
              title="Azgaar World Atlas"
              src={azgaarSrc}
              className="absolute inset-0 h-full w-full border-0"
              onLoad={scheduleReadOnlyInitialization}
              onError={handleIframeError}
              onErrorCapture={handleIframeError}
            />

            <div
              ref={embedOverlayRef}
              className={`absolute inset-0 ${overlayCapturesClicks ? 'cursor-crosshair' : 'pointer-events-none'}`}
              onClick={handleOverlayClick}
              onMouseMove={handleOverlayMouseMove}
              onMouseLeave={() => {
                setHoveredCell(null);
                setHoveredVoronoiPoly(null);
                setHoveredAzgaarCell(null);
              }}
              aria-label="World map click overlay"
              role="button"
              tabIndex={0}
            />

            {playerWorldPos && viewMode === 'azgaar' && (
              <AtlasPlayerMarker
                playerWorldPos={playerWorldPos}
                gridCols={gridSize.cols}
                gridRows={gridSize.rows}
                atlasTransform={atlasTransform}
              />
            )}

            {interactionMode === 'travel' && hoveredVoronoiPercentPoints && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-[1]"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
                data-testid="azgaar-voronoi-highlight"
              >
                <polygon
                  points={hoveredVoronoiPercentPoints}
                  fill="rgba(248,113,113,0.16)"
                  stroke="rgba(248,113,113,0.95)"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}

            {overlayCapturesClicks && showPrecisionOverlay && (
              <div className="absolute inset-0 pointer-events-none z-[1]" aria-hidden="true">
                {playerCellRect && (
                  <div
                    className="absolute border-2 border-sky-300/90 shadow-[0_0_10px_rgba(56,189,248,0.55)]"
                    style={{
                      left: `${playerCellRect.left}%`,
                      top: `${playerCellRect.top}%`,
                      width: `${playerCellRect.width}%`,
                      height: `${playerCellRect.height}%`,
                    }}
                  />
                )}
                {/* The amber hovered-cell square was the old square-grid target;
                    deprecated in favor of the reddish Voronoi-cell highlight. */}
              </div>
            )}

            {!isFrameReady && (
              <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center text-slate-100 text-sm pointer-events-none">
                Loading Azgaar atlas...
              </div>
            )}

            {/* Travel mode: describe the ACTUAL Azgaar Voronoi cell under the
                cursor (biome + political/cultural ownership the generator
                assigned), replacing the deprecated square-grid tile readout. */}
            {interactionMode === 'travel' && hoveredAzgaarCell && (
              <div className="absolute bottom-3 left-3 rounded bg-black/75 text-white px-2.5 py-1.5 pointer-events-none z-[2] max-w-[300px] leading-tight">
                <div className="text-xs font-semibold text-amber-200">
                  {hoveredAzgaarCell.burg
                    ? `${hoveredAzgaarCell.burg.capital ? '★ ' : ''}${hoveredAzgaarCell.burg.name}`
                    : hoveredAzgaarCell.state || (hoveredAzgaarCell.land ? 'Wildlands' : 'Open Water')}
                </div>
                <div className="text-[11px] text-gray-300">
                  {hoveredAzgaarCell.land ? (hoveredAzgaarCell.biome || 'Land') : 'Water'}
                  {hoveredAzgaarCell.burg && hoveredAzgaarCell.state ? ` · ${hoveredAzgaarCell.state}` : ''}
                  {hoveredAzgaarCell.province ? ` · ${hoveredAzgaarCell.province}` : ''}
                </div>
                {(hoveredAzgaarCell.culture || hoveredAzgaarCell.religion) && (
                  <div className="text-[10px] text-gray-400">
                    {[hoveredAzgaarCell.culture, hoveredAzgaarCell.religion].filter(Boolean).join(' · ')}
                  </div>
                )}
                {(hoveredAzgaarCell.burg || hoveredAzgaarCell.population != null) && (
                  <div className="text-[10px] text-gray-400">
                    {hoveredAzgaarCell.burg
                      ? `Pop ${hoveredAzgaarCell.burg.population.toLocaleString()}${hoveredAzgaarCell.burg.port ? ' · Port' : ''}`
                      : `Rural pop ${hoveredAzgaarCell.population!.toLocaleString()}`}
                  </div>
                )}
              </div>
            )}

            {/* Enter-3D keeps the grid readout (discovery status drives 3D entry). */}
            {interactionMode === 'enter3d' && hoveredCell && hoveredTile && (
              <div className="absolute bottom-3 left-3 rounded bg-black/70 text-white text-xs px-2 py-1 pointer-events-none z-[2]">
                Cell {hoveredCell.x},{hoveredCell.y} - {hoveredBiome?.name || hoveredTile.biomeId}
                {!hoveredTile.discovered ? ' (undiscovered)' : ''}
              </div>
            )}
          </div>
        ) : (
          <div className="relative overflow-hidden flex-grow rounded bg-slate-950 border border-slate-700 flex items-center justify-center">
            {worldforgeAtlas ? (
              <AtlasSvgView atlas={worldforgeAtlas} />
            ) : (
              <div className="text-slate-100 text-sm">Forging world…</div>
            )}
          </div>
        )}

        <p className="text-xs text-center mt-2 text-gray-700">
          {allowTravel || allow3DEntry
            ? 'In Azgaar Atlas: use Pan/Zoom to explore. Travel moves on the world grid; Enter 3D jumps into the streamed world at a discovered cell. Enable Precision for cell overlays.'
            : 'In Azgaar Atlas: use Pan/Zoom and layer controls to inspect world generation before starting a game.'}
        </p>
      </div>
    </WindowFrame>
  );
};

export default MapPane;
