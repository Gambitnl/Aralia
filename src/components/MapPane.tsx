/**
 * @file MapPane.tsx
 * World map modal surface. Stage R1 default is an embedded, read-only Azgaar
 * atlas with a click-to-hidden-cell bridge to preserve existing travel logic.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapData, MapMarker, MapTile as MapTileType } from '../types';
import { BIOMES } from '../constants';
import { POIS } from '../data/world/pois';
import { buildPoiMarkers } from '@/utils/spatial';
import MapTile from './MapTile';
import oldPaperBg from '../assets/images/old-paper.svg';
import { WindowFrame } from './ui/WindowFrame';
import { WINDOW_KEYS } from '../styles/uiIds';

interface MapPaneProps {
  mapData: MapData;
  worldSeed?: number;
  onTileClick: (x: number, y: number, tile: MapTileType) => void;
  onClose: () => void;
  allowTravel?: boolean;
  showGenerationControls?: boolean;
  canRegenerateWorld?: boolean;
  generationLockedReason?: string | null;
  onRegenerateWorld?: (seed?: number) => void;
}

type WorldMapViewMode = 'azgaar' | 'grid';
type WorldMapInteractionMode = 'pan' | 'travel';

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

const MapPane: React.FC<MapPaneProps> = ({
  mapData,
  worldSeed,
  onTileClick,
  onClose,
  allowTravel = true,
  showGenerationControls = false,
  canRegenerateWorld = false,
  generationLockedReason = null,
  onRegenerateWorld,
}) => {
  const { gridSize, tiles } = mapData;
  const [viewMode, setViewMode] = useState<WorldMapViewMode>('azgaar');
  const [interactionMode, setInteractionMode] = useState<WorldMapInteractionMode>(allowTravel ? 'travel' : 'pan');
  const [isFrameReady, setIsFrameReady] = useState(false);
  const [frameError, setFrameError] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);
  const [seedInput, setSeedInput] = useState('');

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const embedOverlayRef = useRef<HTMLDivElement>(null);
  const readinessTimersRef = useRef<number[]>([]);

  const azgaarSeed = useMemo(() => worldSeed ?? deriveAzgaarSeed(mapData), [mapData, worldSeed]);
  const azgaarSrc = useMemo(() => {
    const azgaarBasePath = getAzgaarBasePath();
    return `${azgaarBasePath}?seed=${azgaarSeed}&options=default&runtime=${AZGAAR_RUNTIME_REV}`;
  }, [azgaarSeed]);

  const flattenedTiles = useMemo(() => tiles.flat(), [tiles]);

  const poiMarkers: MapMarker[] = useMemo(() => buildPoiMarkers(POIS, mapData), [mapData]);

  const markersByCoordinate = useMemo(() => {
    const markerMap = new Map<string, MapMarker[]>();
    poiMarkers.forEach(marker => {
      if (!marker.isDiscovered) return;
      const key = `${marker.coordinates.x}-${marker.coordinates.y}`;
      if (!markerMap.has(key)) {
        markerMap.set(key, []);
      }
      markerMap.get(key)?.push(marker);
    });
    return markerMap;
  }, [poiMarkers]);

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
          } catch (e) {
            // ignore
          }
        })();
      `;
      iframeDocument.body.appendChild(scriptTag);
    }

    setIsFrameReady(true);
    setFrameError(null);
  }, [azgaarSeed]);

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
  }, [allowTravel, interactionMode]);

  useEffect(() => {
    setSeedInput(String(azgaarSeed));
  }, [azgaarSeed]);

  const resolveCellFromPointer = useCallback((clientX: number, clientY: number) => {
    const overlay = embedOverlayRef.current;
    if (!overlay) return null;

    const bounds = overlay.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;

    const fallbackNormalizedX = (clientX - bounds.left) / bounds.width;
    const fallbackNormalizedY = (clientY - bounds.top) / bounds.height;

    // Prefer transform-aware mapping once the iframe bridge is installed.
    const bridge = (iframeRef.current?.contentWindow as any)?.__araliaAzgaar;
    const transform = bridge?.getTransform?.() as
      | { graphWidth: number; graphHeight: number; viewX: number; viewY: number; scale: number }
      | null
      | undefined;

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

    const tile = tiles[y]?.[x];
    if (!tile) return null;
    return { x, y, tile };
  }, [gridSize.cols, gridSize.rows, tiles]);

  const handleOverlayClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!allowTravel || interactionMode !== 'travel') return;
    const resolved = resolveCellFromPointer(event.clientX, event.clientY);
    if (!resolved) return;
    onTileClick(resolved.x, resolved.y, resolved.tile);
  }, [allowTravel, interactionMode, onTileClick, resolveCellFromPointer]);

  const handleOverlayMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!allowTravel || interactionMode !== 'travel') return;
    const resolved = resolveCellFromPointer(event.clientX, event.clientY);
    if (!resolved) {
      setHoveredCell(null);
      return;
    }
    setHoveredCell({ x: resolved.x, y: resolved.y });
  }, [allowTravel, interactionMode, resolveCellFromPointer]);

  const hoveredTile = useMemo(() => {
    if (!hoveredCell) return null;
    return tiles[hoveredCell.y]?.[hoveredCell.x] || null;
  }, [hoveredCell, tiles]);

  const hoveredBiome = hoveredTile ? BIOMES[hoveredTile.biomeId] : undefined;

  const handleIframeError = useCallback(() => {
    setFrameError('Azgaar world map could not be loaded. Switched to legacy grid view.');
    setViewMode('grid');
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

  const renderLegacyGrid = () => (
    <div className="overflow-auto flex-grow p-2 bg-black bg-opacity-10 rounded relative">
      <div
        className="grid gap-0.5"
        style={{
          gridTemplateColumns: `repeat(${gridSize.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${gridSize.rows}, minmax(0, 1fr))`,
        }}
        role="grid"
      >
        {flattenedTiles.map((tile, index) => {
          const markers = markersByCoordinate.get(`${tile.x}-${tile.y}`);
          return (
            <MapTile
              key={`${tile.x}-${tile.y}-${index}`}
              tile={tile}
              isFocused={tile.isPlayerCurrent}
              markers={markers}
              onClick={onTileClick}
            />
          );
        })}
      </div>
    </div>
  );

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
              onClick={() => setViewMode('grid')}
              className={`px-2 py-1 rounded ${viewMode === 'grid' ? 'bg-blue-700 text-white' : 'bg-gray-600 text-gray-100'}`}
              type="button"
            >
              Legacy Grid
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
            />

            <div
              ref={embedOverlayRef}
              className={`absolute inset-0 ${allowTravel && interactionMode === 'travel' ? 'cursor-crosshair' : 'pointer-events-none'}`}
              onClick={handleOverlayClick}
              onMouseMove={handleOverlayMouseMove}
              onMouseLeave={() => setHoveredCell(null)}
              aria-label="World map click overlay"
              role="button"
              tabIndex={0}
            />

            {!isFrameReady && (
              <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center text-slate-100 text-sm pointer-events-none">
                Loading Azgaar atlas...
              </div>
            )}

            {allowTravel && interactionMode === 'travel' && hoveredCell && hoveredTile && (
              <div className="absolute bottom-3 left-3 rounded bg-black/70 text-white text-xs px-2 py-1 pointer-events-none">
                Cell {hoveredCell.x},{hoveredCell.y} - {hoveredBiome?.name || hoveredTile.biomeId}
              </div>
            )}
          </div>
        ) : (
          renderLegacyGrid()
        )}

        <p className="text-xs text-center mt-2 text-gray-700">
          {allowTravel
            ? 'In Azgaar Atlas: use Pan/Zoom to explore layers and zoom. Switch to Travel to click a destination.'
            : 'In Azgaar Atlas: use Pan/Zoom and layer controls to inspect world generation before starting a game.'}
        </p>
      </div>
    </WindowFrame>
  );
};

export default MapPane;
