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
import type { Item } from '@/types/items';
import {
  daysOfFood,
  daysOfWater,
  foodRangeDays,
  tripDaysFromMinutes,
  provisionStatusMulti,
  type RationMode,
} from '@/systems/travel/provisioning';
import { formatProvisionLine } from '@/systems/travel/travelReadout';
import { decideTravelProvision } from '@/systems/travel/travelProvisionDecision';
import { forage } from '@/systems/travel/forage';
import { cellTraits, findCellAtPoint } from './Worldforge/atlasSvg';
import { wfBiomeIndexToLegacyId } from '@/systems/worldforge/local/wfBiomeToLegacy';
import { SeededRandom } from '@/utils/random';
import type { TravelMeta, TravelProvisionEffect } from '@/types/travelMeta';
import { BIOMES } from '../constants';
import { WindowFrame } from './ui/WindowFrame';
import { WINDOW_KEYS } from '../styles/uiIds';
import oldPaperBg from '../assets/images/old-paper.svg';
import type { PlayerWorldPosition, DiscoveredHiddenSite } from '../types';
import AtlasSvgView from './Worldforge/AtlasSvgView';
import type { CellTraits } from './Worldforge/atlasSvg';
import SubmapSvgView from './Worldforge/SubmapSvgView';
import TownPlanView from './Worldforge/TownPlanView';
import NeighbourhoodSvgView from './Worldforge/NeighbourhoodSvgView';
import { consumeMapDrillToPlayerTown } from './Worldforge/mapFocusSignal';
import { atlasCellToSubmapContext } from '@/systems/worldforge/submap/l0Adapter';
import { buildAtlasNeighbourhood, type AtlasNeighbourhood } from '@/systems/worldforge/submap/neighbourhood';
import { generateSubmap, submapCellToChildContext, polygonBounds, pointInPolygon, type SubmapModel, type SubmapParentContext, type Pt } from '@/systems/worldforge/submap/submapEngine';
import { type TownPlan } from '@/systems/worldforge/town/townEngine';
import { getCanonicalTownPlan } from '@/systems/worldforge/town/canonicalTown';
import { rootSeedPath } from '@/systems/worldforge/seedPath';
import { gridCellToAtlasSite, spreadColocatedPoints, entry3DAnchorForCell, atlasCellToLegacyGrid, snapToLandCell } from '@/systems/worldforge/local/gridAtlasBridge';
import type { Entry3DAnchor } from '@/types/state';
import { getBridgeAtlas } from '@/systems/worldforge/bridge/legacySubmapBridge';
import { buildAtlasTravelGraph, atlasMilesPerUnit, nearestLandCell, transportMobility } from '@/systems/worldforge/travel/atlasTravelGraph';
import { buildMultiModalAtlasGraph } from '@/systems/worldforge/travel/multiModalAtlasGraph';
import { buildSubmapTravelGraph } from '@/systems/worldforge/travel/submapTravelGraph';
import { planRoutesFrom, transportSpeedMph } from '@/systems/travel/routePlanning';
import { segmentRoute } from '@/systems/travel/multiModalRoute';
import { availableTransports } from '@/systems/travel/availableTransports';
import { rollTravelEncounter } from '@/systems/travel/travelEncounter';
import { formatTravelTime } from '@/systems/travel/travelReadout';
import { generateFmgWorld } from '@/systems/worldforge/fmg/generateWorld';
import { shipTravelAvailability, shipVoyageFromDestination } from '@/systems/worldforge/travel/shipEmbark';
import { shipSpeedMph } from '@/utils/naval/navalUtils';
import type { Ship } from '@/types/naval';

interface MapPaneProps {
  mapData: MapData;
  worldSeed?: number;
  onTileClick: (x: number, y: number, tile: MapTileType, travelMeta?: TravelMeta) => void;
  /** When set, clicking a discovered cell in Enter 3D mode starts streamed world entry. */
  onEnter3DAtCell?: (x: number, y: number, tile: MapTileType, anchor?: Entry3DAnchor) => void;
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
  /**
   * Shared party inventory — feeds the travel-mode provisioning rings + readout
   * (how far current rations/water reach). Omit to hide the provisioning UI.
   */
  provisionInventory?: Item[];
  /** Number of party members consuming rations/water (provisioning consumers). */
  partySize?: number;
  /** Best forager's Survival modifier (Wis mod + proficiency) — for the forage choice. */
  partySurvivalModifier?: number;
  /**
   * The player's currently active owned ship. When provided and the ship is
   * docked at the player's current port, the 'Ship (owned)' sea-travel option
   * becomes selectable. Omit (or pass null) when no active ship is available.
   */
  activeShip?: Ship | null;
  /**
   * Called instead of onTileClick when the player commits a port→port voyage in
   * an owned ship. It notifies the caller that a voyage was committed (with the
   * destination port burg id and the sea-miles distance) so the caller can start
   * the voyage and open the voyage UI. No teleport happens for ship travel.
   */
  onSetSail?: (destinationBurgId: number, seaMiles: number) => void;
  /**
   * The player's canonical atlas cell (`gameState.playerCell.cellId`) — the
   * source-of-truth Voronoi cell they occupy. When present it drives the
   * "you are here" pin EXACTLY, instead of reverse-deriving the cell from the
   * coarse 30×20 grid tile. This matters at spawn: a chosen start town's exact
   * cell is carried here, so the pin sits ON the town rather than drifting to a
   * neighbouring cell (the grid-center round-trip rounds ~16 fine cells per grid
   * square to whichever is nearest the square's centre). After grid movement the
   * id is re-derived from the tile via the same mapping the pin would have used,
   * so there is no post-spawn regression. Omit ⇒ fall back to the grid round-trip.
   */
  playerAtlasCellId?: number | null;
}

type WorldMapInteractionMode = 'pan' | 'travel' | 'enter3d';
type SeaPreference = 'none' | 'ferry' | 'ship';

/**
 * Each drill tier renders fit-to-view, but the SP1 engine + clipping degrade at
 * sub-unit coordinate scales (a sub-cell of a sub-cell is tiny in graph units →
 * sliver/degenerate Voronoi cells, near-empty local tiers). Normalize every tier's
 * context to a canonical span before generating so each tier has healthy geometry,
 * independent of how deep the drill is. Position is irrelevant (fit-to-view).
 */
/** localStorage flag: has the player seen the one-time underprovisioned-travel risk explainer? */
const PROVISION_RISK_INFO_KEY = 'aralia.travel.provisionRiskInfo.v1';

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

// Grid retirement: the legacy "project mapData.tiles through the geography snapshot"
// read adapter is removed — MapPane reads atlas cells directly (synthCellTile).

// Grid retirement: a click/travel target tile synthesized from an atlas CELL (its
// biome), treated as explored — replaces reading the legacy 30x20 mapData.tiles.
// The x,y are bookkeeping coords carried for the still-present coord_X_Y interface.
function synthCellTile(
  atlas: { pack: { cells: { biome?: ArrayLike<number> } } },
  cellId: number,
  x: number,
  y: number,
): MapTileType {
  const biomeIdx = (atlas.pack.cells as unknown as { biome?: ArrayLike<number> }).biome?.[cellId];
  return { x, y, biomeId: wfBiomeIndexToLegacyId(biomeIdx), discovered: true, isPlayerCurrent: false } as MapTileType;
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
  provisionInventory = [],
  partySize = 0,
  partySurvivalModifier = 0,
  activeShip = null,
  onSetSail,
  playerAtlasCellId = null,
}) => {
  const { gridSize } = mapData;
  // Pre-game world-generation PREVIEW: the generation controls are shown but there
  // is no player to travel/enter-3D with. In this context the map is a pure world
  // viewer — there's no "me" to find, so the player marker + Find Me are meaningless
  // (WG1/WG4). Distinguish it from the in-game World Map so the chrome reads right.
  const isPreviewOnly = showGenerationControls && !allowTravel && !allow3DEntry;
  const [interactionMode, setInteractionMode] = useState<WorldMapInteractionMode>(allowTravel ? 'travel' : 'pan');
  // The map opens in Travel mode for an in-game player (WM8). Until the player
  // manually picks a mode, auto-default follows `allowTravel` even if it settles a
  // frame after mount (so a late phase flip doesn't leave the map stuck in Pan with
  // the travel/provisioning affordances hidden behind a switch they never make).
  const userPickedModeRef = useRef(false);
  // A brief, self-clearing notice for actions that would otherwise be silent no-ops
  // (clicking a non-drillable cell in Explore, or an unreachable/ocean cell in
  // Travel) — closes the feedback loop (WM6/WM9).
  const [mapNotice, setMapNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showMapNotice = useCallback((text: string) => {
    setMapNotice(text);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setMapNotice(null), 2600);
  }, []);
  useEffect(() => () => { if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current); }, []);
  // An underprovisioned travel pick awaiting the player's choice (turn back /
  // half-rations / forage / push on). Holds the route geometry so a push-on can
  // halt at the last sustainable point.
  const [pendingTravel, setPendingTravel] = useState<{
    cellId: number; tx: number; ty: number; minutes: number; points: Array<[number, number]>;
  } | null>(null);
  // One-time explainer: the FIRST time the player tries to set out underprovisioned
  // we teach the risk (halt-short, starvation, companion fallout) + the mitigations,
  // then never show it again (persisted). Subsequent shortfalls jump straight to the
  // choice panel.
  const [riskInfoDismissed, setRiskInfoDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(PROVISION_RISK_INFO_KEY) === '1'; } catch { return false; }
  });
  const dismissRiskInfo = useCallback(() => {
    try { localStorage.setItem(PROVISION_RISK_INFO_KEY, '1'); } catch { /* ignore */ }
    setRiskInfoDismissed(true);
  }, []);
  const [showPrecisionOverlay, setShowPrecisionOverlay] = useState(true);
  const [seedInput, setSeedInput] = useState('');

  const worldforgeViewportRef = useRef<HTMLDivElement>(null);
  const [worldforgeViewportSize, setWorldforgeViewportSize] = useState({ width: 960, height: 540 });

  const worldforgeSeed = useMemo(() => worldSeed ?? deriveWorldSeed(mapData), [mapData, worldSeed]);

  // Native Worldforge SVG render-port (SP0). The 2D map and the 3D ground bake
  // MUST share ONE atlas, or a burgId means a different burg in each view and
  // towns can't be identical (Worldforge Option B). `getBridgeAtlas` is the
  // shared, cached canonical world — the same one the 3D pipeline + town tiles
  // already use — so the map you see is the world you walk. (Island harbors are
  // off in the live app; folding them into the canonical world is a follow-up.)
  const worldforgeAtlas = useMemo(
    () => getBridgeAtlas(worldforgeSeed),
    [worldforgeSeed],
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
    // WM8: snap to Travel as soon as it becomes allowed, but only while the player
    // hasn't deliberately chosen a mode yet — so an in-game map always opens with
    // the travel + provisioning UI visible, even if `allowTravel` settles late.
    if (allowTravel && interactionMode === 'pan' && !userPickedModeRef.current) {
      setInteractionMode('travel');
    }
  }, [allow3DEntry, allowTravel, interactionMode]);

  useEffect(() => {
    setSeedInput(String(worldforgeSeed));
  }, [worldforgeSeed]);


  // The atlas Voronoi cell the player currently occupies (their grid cell mapped
  // back through the grid↔atlas bridge). Drives the centered marker + the drill
  // player sub-cell highlight.
  const playerAtlasCell = useMemo(() => {
    // Cell-native: the player's atlas cell IS the canonical playerCell.cellId
    // (Stage 6: no grid-tile -> atlas-cell round-trip).
    return playerAtlasCellId ?? null;
  }, [playerAtlasCellId]);

  // "You are here" marker for the native World Forge atlas: centered on the
  // player's actual VORONOI CELL (the atlas cell's site) rather than the coarse
  // grid-cell-center projection — so the indicator sits inside the cell the
  // player occupies, not adrift near a coastline.
  //
  // PIN FIDELITY: when the canonical `playerAtlasCellId` (source of truth) is
  // known, anchor on THAT cell's site directly. At spawn this is the chosen start
  // town's EXACT cell, so the pin lands on the town instead of drifting ~1 cell
  // to a neighbour (the 30×20 grid buckets ~16 fine cells per square and the
  // grid-center round-trip rounds to whichever is nearest the square's centre).
  // Only fall back to the grid round-trip when no canonical cell / site exists.
  const worldforgeMarker = useMemo(() => {
    if (!worldforgeAtlas || playerAtlasCellId == null) return null;
    // Cell-native: anchor on the player's canonical atlas cell site (Stage 6: the
    // grid-tile round-trip fallback is removed).
    const site = worldforgeAtlas.pack.cells.p?.[playerAtlasCellId];
    return site ? { x: site[0], y: site[1] } : null;
  }, [worldforgeAtlas, playerAtlasCellId]);

  // The FMG burg id of the port at the player's current atlas cell, or null if
  // the player is not standing at a port. Used as the embark-gate check for
  // owned-ship travel: the ship must be docked at this exact burg.
  const playerPortBurgId = useMemo((): number | null => {
    if (!worldforgeAtlas || playerAtlasCell == null) return null;
    const pack = worldforgeAtlas.pack as unknown as {
      cells: { burg?: ArrayLike<number> };
      burgs?: Array<{ cell?: number; port?: number } | undefined>;
    };
    const burgId = pack.cells.burg?.[playerAtlasCell];
    if (!burgId) return null;
    const burg = pack.burgs?.[burgId];
    return burg?.port ? burgId : null;
  }, [worldforgeAtlas, playerAtlasCell]);

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

  // Provisioning rings (R1): the contour of cells reachable before the binding
  // resource runs out. The travel field already holds minutes-from-player to every
  // cell, so a horizon is just the cell set whose trip-days fit a resource's range.
  // Food and water draw as separate labeled rings only when their horizons differ
  // (E1: two resources); otherwise one binding "supply reach" ring.
  const FOOD_RING_COLOR = '#eab308';
  const WATER_RING_COLOR = '#38bdf8';
  const provisionRings = useMemo<Array<{ cellIds: number[]; color: string; label?: string }>>(() => {
    if (interactionMode !== 'travel' || !travelField || partySize <= 0) return [];
    const foodRange = foodRangeDays(daysOfFood(provisionInventory), partySize, 'full');
    const waterRange = foodRangeDays(daysOfWater(provisionInventory), partySize, 'full');
    // Cells within a given travel-day range, read off the single-source field.
    const cellsWithin = (range: number): number[] => {
      if (!Number.isFinite(range)) return [];
      const out: number[] = [];
      for (const [cell, minutes] of travelField.dist) {
        if (tripDaysFromMinutes(minutes) <= range) out.push(cell);
      }
      return out;
    };
    const haveFood = Number.isFinite(foodRange);
    const haveWater = Number.isFinite(waterRange);
    // PRV3: at a 0-day horizon (no provisions) the "ring" collapses to the player's
    // own cell — a meaningless dot that reads like a render bug. Suppress every ring
    // when the binding horizon is 0; the explicit "No provisions" cue (below) carries
    // the message instead.
    const bindingHorizon = Math.min(haveFood ? foodRange : Infinity, haveWater ? waterRange : Infinity);
    if (Number.isFinite(bindingHorizon) && bindingHorizon <= 0) return [];
    // Both resources tracked and their horizons differ → two labeled rings.
    if (haveFood && haveWater && foodRange !== waterRange) {
      return [
        { cellIds: cellsWithin(foodRange), color: FOOD_RING_COLOR, label: `Food reach (${foodRange}d)` },
        { cellIds: cellsWithin(waterRange), color: WATER_RING_COLOR, label: `Water reach (${waterRange}d)` },
      ];
    }
    // Otherwise one ring at the binding (smaller) horizon, colored by what binds.
    const binding = bindingHorizon;
    if (!Number.isFinite(binding)) return [];
    const waterBinds = haveWater && waterRange <= (haveFood ? foodRange : Infinity);
    return [{
      cellIds: cellsWithin(binding),
      color: waterBinds ? WATER_RING_COLOR : FOOD_RING_COLOR,
      label: `Supply reach (${binding}d)`,
    }];
  }, [interactionMode, travelField, partySize, provisionInventory]);

  // PRV3: the party is carrying no provisions (a fresh party's default) — the
  // supply-reach ring is suppressed above; surface an explicit cue in the travel
  // toolbar so the zero-horizon reads as "you have no provisions", not a missing ring.
  const noProvisions = useMemo(() => {
    if (interactionMode !== 'travel' || partySize <= 0) return false;
    return daysOfFood(provisionInventory) <= 0 || daysOfWater(provisionInventory) <= 0;
  }, [interactionMode, partySize, provisionInventory]);

  // Provisions readout line for the hovered route: "Food: 6 days" / "Water: 2
  // days · short 1 day", colored by severity, with the binding resource labeled.
  const provisionLineForMinutes = useCallback((minutes: number): { text: string; color: string } | null => {
    if (partySize <= 0) return null;
    const status = provisionStatusMulti({
      tripDays: tripDaysFromMinutes(minutes),
      consumers: partySize,
      mode: 'full',
      supplies: [
        { resource: 'food', days: daysOfFood(provisionInventory) },
        { resource: 'water', days: daysOfWater(provisionInventory) },
      ],
    });
    const line = formatProvisionLine(status);
    return { text: line.text, color: line.color };
  }, [partySize, provisionInventory]);

  // Maritime travel mode: when the player hires a ferry or sails an owned ship,
  // build one mixed graph that can walk to a port, cross sea, and walk away from
  // the destination harbor. This stays separate from `travelField` so "No sea
  // travel" preserves the original land-only route behavior.
  const travelMmField = useMemo(() => {
    if (interactionMode !== 'travel' || seaPref === 'none' || !worldforgeAtlas || playerAtlasCell == null) return null;
    let seaOption: { kind: 'ferry' | 'ship'; speedMph: number };
    if (seaPref === 'ship' && activeShip) {
      seaOption = { kind: 'ship', speedMph: shipSpeedMph(activeShip) };
    } else {
      seaOption = { kind: 'ferry', speedMph: 8 };
    }
    const graph = buildMultiModalAtlasGraph(worldforgeAtlas, {
      landSpeedMph: transportSpeedMph(selectedTransport.option),
      sea: seaOption,
    });
    const origin = nearestLandCell(worldforgeAtlas, playerAtlasCell);
    return planRoutesFrom(graph, origin, {
      milesPerUnit: atlasMilesPerUnit(worldforgeAtlas),
      speedMph: transportSpeedMph(selectedTransport.option),
    });
  }, [interactionMode, seaPref, worldforgeAtlas, playerAtlasCell, selectedTransport, activeShip]);

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

  // Cell-native (Stage 6): land cells are explorable on the atlas. The legacy
  // grid-tile fog (mapData.tiles[].discovered via a proportional projection) is
  // removed; the owned atlas is the world view and drives the drill neighbourhood.
  const isExploredCell = useCallback((cellId: number): boolean => {
    if (!worldforgeAtlas) return false;
    return (worldforgeAtlas.pack.cells.h?.[cellId] ?? 0) >= 20;
  }, [worldforgeAtlas]);

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
    if (tier) {
      setSubmapStack([tier]);
      return;
    }
    // WM6: clicking a non-drillable cell (open water / edge / empty region) used to
    // do nothing silently — give an explicit cue so Explore doesn't feel broken.
    showMapNotice("Nothing to explore here — try a cell on land.");
  }, [buildNeighbourTier, showMapNotice]);

  // Build the drill stack [Region, Town] that lands directly on a burg's town
  // plan — the same two tiers a manual World → cell → burg drill produces,
  // assembled from the existing helpers so the result is byte-identical. Drills
  // to the burg's OWN atlas cell (`pack.burgs[burgId].cell`), NOT the player's
  // cell: the player commonly stands in a cell adjacent to the town's, since the
  // 3D ground window spans several atlas cells. Returns null if the burg can't
  // be resolved to a settled cell.
  const buildTownDrillStack = useCallback((burgId: number): DrillTier[] | null => {
    if (!worldforgeAtlas) return null;
    const pack = worldforgeAtlas.pack as unknown as { burgs?: Array<{ cell?: number } | undefined> };
    const burgCell = pack.burgs?.[burgId]?.cell;
    if (burgCell == null) return null;
    const regionTier = buildNeighbourTier(burgCell);
    if (!regionTier || !regionTier.model) return null;
    // Prefer the model's own burg index; fall back to the matching burg subcell,
    // then to any burg subcell (a one-burg focus cell has exactly one).
    let burgIdx = regionTier.model.burgCellIndex ?? -1;
    if (burgIdx < 0) burgIdx = regionTier.model.cells.findIndex((c) => c.feature?.kind === 'burg' && c.feature.id === burgId);
    if (burgIdx < 0) burgIdx = regionTier.model.cells.findIndex((c) => c.feature?.kind === 'burg' && c.feature.id != null);
    if (burgIdx < 0) return null;
    const cell = regionTier.model.cells[burgIdx];
    if (!cell || cell.feature?.kind !== 'burg' || cell.feature.id == null) return null;
    const childCtx = normalizeCtxScale(submapCellToChildContext(cell, regionTier.ctx));
    if (childCtx.polygon.length < 3) return null;
    const town = getCanonicalTownPlan(worldforgeAtlas, worldforgeSeed, cell.feature.id);
    return [regionTier, { ctx: childCtx, town, playerCellIndex: 0 }];
  }, [worldforgeAtlas, worldforgeSeed, buildNeighbourTier]);

  // One-shot: when the 3D HUD's "Town Plan" button opens the map, drill straight
  // to the 3D world's town instead of the fit-to-world atlas. Mirrors AtlasSvgView's
  // consumeMapCenterOnPlayer mount-consume; MapPane mounts fresh per map open, so
  // we capture the flag (+ target burg) once, then seed the stack as soon as the
  // atlas is ready (runs after the [worldforgeSeed] reset above, so it isn't clobbered).
  // Capture the one-shot request exactly once per mount. The guard + "never
  // re-apply null" matters under React StrictMode, whose double-invoke would
  // otherwise consume the (already-cleared) signal a second time and wipe the
  // captured burg. We deliberately do NOT clear the target on success: the
  // sibling [worldforgeSeed] reset effect re-runs on StrictMode's second pass
  // and empties the stack, so the drill effect must be free to re-seed it. The
  // target only changes on a real remount (a fresh map open), where refs reset.
  const wantDrillBurgRef = useRef<number | null>(null);
  const drillConsumedRef = useRef(false);
  useEffect(() => {
    if (drillConsumedRef.current) return;
    drillConsumedRef.current = true;
    const req = consumeMapDrillToPlayerTown();
    if (req.wanted) wantDrillBurgRef.current = req.burgId;
  }, []);
  useEffect(() => {
    const burgId = wantDrillBurgRef.current;
    if (burgId == null || !worldforgeAtlas) return;
    const stack = buildTownDrillStack(burgId);
    if (stack) setSubmapStack(stack);
  }, [worldforgeAtlas, buildTownDrillStack]);

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
      // Cell-native entry: carry the EXACT clicked cell (burg-centered when the
      // cell is settled, so the Locale frames the town instead of dropping the
      // player in wilderness next to it). The grid tile is bookkeeping only,
      // derived from the anchor cell — replaces the old getTownTilesForGrid snap hack.
      const anchor = entry3DAnchorForCell(worldforgeAtlas, info.i);
      const bk = atlasCellToLegacyGrid(worldforgeAtlas, anchor.cellId, gridSize) ?? { x: tx, y: ty };
      onEnter3DAtCell(bk.x, bk.y, synthCellTile(worldforgeAtlas, anchor.cellId, bk.x, bk.y), anchor);
      return;
    }
    const tile = synthCellTile(worldforgeAtlas, info.i, tx, ty);
    if (interactionMode === 'travel' && allowTravel) {
      // ── Ship voyage branch ────────────────────────────────────────────────
      // When the player is sailing an owned ship, clicking the map picks a
      // destination port. The ship must already be at the player's current port
      // (embark gate). If the destination is not a port, reject honestly.
      if (seaPref === 'ship') {
        const mmRoute = planAtlasMultiModal(info.i);
        if (!mmRoute) { showMapNotice("Can't sail there — no route from your port."); return; }
        const voyage = shipVoyageFromDestination(
          info.i,
          worldforgeAtlas.pack,
          mmRoute,
        );
        if (!voyage) {
          // Destination is not a port — reject without teleporting (WM9 cue).
          showMapNotice("That isn't a port — pick a harbour to sail to.");
          return;
        }
        if (onSetSail) {
          onSetSail(voyage.destinationBurgId, voyage.seaMiles);
        }
        return;
      }
      // ── Ordinary land/ferry travel ────────────────────────────────────────
      // Resolve the planned route to the picked cell → real trip duration + a
      // pre-rolled "danger on the road" encounter, handed to the world-move
      // contract so the game clock advances by travel time, not a flat hour.
      const route = planSelectedAtlasRoute(info.i);
      if (!route) {
        // WM9: no land/ferry route to the picked cell (unreachable / across open
        // water). The hover readout already reads "No route to here"; mirror it on
        // click with a brief cue instead of a silent no-op.
        showMapNotice("Can't travel there — no route.");
        return;
      }
      const roll = rollTravelEncounter(route, rootSeedPath(worldforgeSeed));
      const encounterMessage = roll.encounter
        ? `After ${formatTravelTime(route.minutes)} on the road, danger finds you — an encounter!`
        : `You travel for ${formatTravelTime(route.minutes)} and arrive without incident.`;
      // Cell-native arrival (Stage 4): carry the EXACT destination cell + its 3D-entry
      // anchor so arrival lands that cell (not the lossy tx/ty reverse-derive), resets
      // Locale feet, and frames the destination town on a later Enter-3D. The tx/ty
      // above stay lossy bookkeeping only. Reuses the protected Stage-1 helpers; no new
      // mapping, no cell→tile→cell round-trip.
      const destinationCell = {
        cellId: snapToLandCell(worldforgeAtlas, info.i),
        anchor: entry3DAnchorForCell(worldforgeAtlas, info.i),
      };
      // Provisioning gate: does the party carry enough food + water for the trip?
      const decision = decideTravelProvision({
        foodDays: daysOfFood(provisionInventory),
        waterDays: daysOfWater(provisionInventory),
        partySize,
        tripDays: tripDaysFromMinutes(route.minutes),
        mode: 'full',
      });
      // Ungated (no consumers) or in range → travel now, spending the supplies used.
      if (partySize <= 0 || decision.status.inRange) {
        const provision: TravelProvisionEffect | undefined = partySize > 0
          ? { rationsToSpend: decision.rationsToSpend, waterToSpend: decision.waterToSpend }
          : undefined;
        onTileClick(tx, ty, tile, { seconds: Math.round(route.minutes * 60), encounterMessage, provision, destinationCell });
        return;
      }
      // Underprovisioned → open the choice flow instead of moving.
      setPendingTravel({ cellId: info.i, tx, ty, minutes: route.minutes, points: route.points });
    }
  }, [interactionMode, handleAtlasDrill, worldforgeAtlas, gridSize.cols, gridSize.rows, allow3DEntry, onEnter3DAtCell, allowTravel, onTileClick, planSelectedAtlasRoute, planAtlasMultiModal, worldforgeSeed, provisionInventory, partySize, seaPref, onSetSail, showMapNotice]);

  // ── Underprovisioned travel choice resolution ──────────────────────────────
  // Map a graph-space point to a world grid tile (the same proportional bridge
  // ordinary picks use) — for resolving a partial-stop's halt point to a move.
  const pointToTile = useCallback((gx: number, gy: number) => {
    if (!worldforgeAtlas) return null;
    // Cell-native (Stage 6): the picked atlas cell at this graph point. The legacy
    // tx,ty are bookkeeping derived from that cell (no mapData.tiles read); the tile
    // is synthesized from the cell's biome and treated as explored (cell fog).
    const cellId = findCellAtPoint(worldforgeAtlas, gx, gy);
    if (cellId == null || cellId < 0) return null;
    const grid = atlasCellToLegacyGrid(worldforgeAtlas, cellId, gridSize) ?? {
      x: clampIndex(Math.floor((gx / worldforgeAtlas.graphWidth) * gridSize.cols), gridSize.cols),
      y: clampIndex(Math.floor((gy / worldforgeAtlas.graphHeight) * gridSize.rows), gridSize.rows),
    };
    const biomeIdx = (worldforgeAtlas.pack.cells as unknown as { biome?: ArrayLike<number> }).biome?.[cellId];
    const tile = { x: grid.x, y: grid.y, biomeId: wfBiomeIndexToLegacyId(biomeIdx), discovered: true, isPlayerCurrent: false } as MapTileType;
    return { tx: grid.x, ty: grid.y, tile };
  }, [worldforgeAtlas, gridSize.cols, gridSize.rows]);

  // Resolve the player's choice on an underprovisioned trip. `half`/`push` commit
  // immediately; `forage` first rolls the biome-yield forage loop (extra food-days
  // + time cost + a possible tainted/wasted outcome) and then commits. If supplies
  // (after foraging/half-rations) still don't cover the trip, the party PUSHES ON
  // and auto-halts at the last sustainable point on the route, arriving starving.
  const resolvePendingTravel = useCallback((choice: 'half' | 'push' | 'forage') => {
    const pt = pendingTravel;
    if (!pt || !worldforgeAtlas) return;
    const foodDays = daysOfFood(provisionInventory);
    const waterDays = daysOfWater(provisionInventory);
    const tripDays = tripDaysFromMinutes(pt.minutes);
    const mode: RationMode = choice === 'half' ? 'half' : 'full';

    let forageFoodDays = 0;
    let extraSeconds = 0;
    const extraConditions: string[] = [];
    let forageNote: string | null = null;
    if (choice === 'forage') {
      const biome = cellTraits(worldforgeAtlas, pt.cellId).biome ?? 'Grassland';
      const rng = new SeededRandom((worldforgeSeed ?? 0) + pt.cellId * 7919 + 13);
      const out = forage({ resource: 'food', biome, partySize, survivalModifier: partySurvivalModifier }, rng);
      forageFoodDays = out.resourceDaysGained;
      extraSeconds += out.timeCostMinutes * 60;
      if (out.hazard === 'tainted') {
        extraConditions.push('poisoned');
        forageNote = 'You forage as you travel, but some of what you gather is tainted — the party falls ill.';
      } else if (out.hazard === 'wasted') {
        forageNote = 'You spend time foraging but return nearly empty-handed.';
      } else if (forageFoodDays > 0) {
        forageNote = `You forage along the way, gathering about ${forageFoodDays} day${forageFoodDays === 1 ? '' : 's'} of food.`;
      }
    }

    const decision = decideTravelProvision({ foodDays, waterDays, partySize, tripDays, mode, forageFoodDays });

    if (decision.status.inRange) {
      const conditions = [...(mode === 'half' ? ['fatigued'] : []), ...extraConditions];
      const provision: TravelProvisionEffect = {
        rationsToSpend: decision.rationsToSpend,
        waterToSpend: decision.waterToSpend,
        ...(conditions.length ? { conditions } : {}),
        note: forageNote,
      };
      const target = synthCellTile(worldforgeAtlas, pt.cellId, pt.tx, pt.ty); // cell-synthesized tile (Stage 6)
      // Cell-native arrival (Stage 4): the trip completes at the destination cell, so
      // carry it intact (same as the ungated commit). A partial-stop (below) halts at
      // an intermediate point that is NOT the picked cell, so it stays a legacy tile
      // move — re-deriving a cell from the lossy halt point would reintroduce the
      // Stage-1 trap.
      const destinationCell = {
        cellId: snapToLandCell(worldforgeAtlas, pt.cellId),
        anchor: entry3DAnchorForCell(worldforgeAtlas, pt.cellId),
      };
      if (target) onTileClick(pt.tx, pt.ty, target, { seconds: Math.round(pt.minutes * 60 + extraSeconds), provision, destinationCell });
      setPendingTravel(null);
      return;
    }

    // Still short → partial-stop at the last sustainable point along the route.
    const n = pt.points.length;
    const frac = tripDays > 0 ? Math.max(0, Math.min(1, decision.sustainableDays / tripDays)) : 1;
    const haltIndex = Math.max(1, Math.min(n - 1, Math.round(frac * (n - 1))));
    const haltPoint = pt.points[haltIndex];
    const target = haltPoint ? pointToTile(haltPoint[0], haltPoint[1]) : null;
    if (!target) { setPendingTravel(null); return; }
    const haltSeconds = Math.round(pt.minutes * 60 * (haltIndex / Math.max(1, n - 1)) + extraSeconds);
    const provision: TravelProvisionEffect = {
      rationsToSpend: decision.rationsToSpend,
      waterToSpend: decision.waterToSpend,
      conditions: ['starving', ...extraConditions],
      companionLoyaltyDelta: -15,
      note: `${forageNote ? forageNote + ' ' : ''}Your supplies run out on the road. The party halts, starving.`,
    };
    onTileClick(target.tx, target.ty, target.tile, { seconds: haltSeconds, provision });
    setPendingTravel(null);
  }, [pendingTravel, worldforgeAtlas, provisionInventory, partySize, partySurvivalModifier, worldforgeSeed, onTileClick, pointToTile]);

  // Display status for the pending choice panel (binding resource + shortfall).
  const pendingStatus = useMemo(() => {
    if (!pendingTravel) return null;
    return decideTravelProvision({
      foodDays: daysOfFood(provisionInventory),
      waterDays: daysOfWater(provisionInventory),
      partySize,
      tripDays: tripDaysFromMinutes(pendingTravel.minutes),
      mode: 'full',
    }).status;
  }, [pendingTravel, provisionInventory, partySize]);

  // Enter 3D from inside the drill: the leaf rung of World ▸ Region ▸ Local ▸ Town
  // ▸ 3D. Resolves the region's focus atlas cell (drill base) → world tile and
  // hands off via the existing onEnter3DAtCell contract.
  const handleEnter3DHere = useCallback(() => {
    if (!worldforgeAtlas || !onEnter3DAtCell) return;
    const cellId = submapStack[0]?.neighbourhood?.focusCellId;
    if (cellId == null) return;
    // Cell-native entry: the focus cell IS a real atlas cell — anchor on it
    // directly (burg-centered if settled) so the leaf enters exactly here.
    const anchor = entry3DAnchorForCell(worldforgeAtlas, cellId);
    const bk = atlasCellToLegacyGrid(worldforgeAtlas, anchor.cellId, gridSize);
    const fallbackP = worldforgeAtlas.pack.cells.p?.[cellId];
    const tx = bk ? bk.x : clampIndex(Math.floor(((fallbackP?.[0] ?? 0) / worldforgeAtlas.graphWidth) * gridSize.cols), gridSize.cols);
    const ty = bk ? bk.y : clampIndex(Math.floor(((fallbackP?.[1] ?? 0) / worldforgeAtlas.graphHeight) * gridSize.rows), gridSize.rows);
    onEnter3DAtCell(tx, ty, synthCellTile(worldforgeAtlas, cellId, tx, ty), anchor);
  }, [worldforgeAtlas, onEnter3DAtCell, submapStack, gridSize.cols, gridSize.rows]);

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
      // Settled (burg) cell → bottom out into the CANONICAL town plan, keyed by
      // (atlas, burgId), so the 2D town is byte-identical to the 3D ground town
      // for the same burg (Worldforge Option B). The burgId rides on the leaf
      // feature (l0Adapter sets it from the FMG burg).
      if (cell.feature?.kind === 'burg' && cell.feature.id != null) {
        const town = getCanonicalTownPlan(worldforgeAtlas, worldforgeSeed, cell.feature.id);
        return [...stack, { ctx: childCtx, town, playerCellIndex: onPlayerPath ? 0 : null }];
      }
      const childModel = generateSubmap(childCtx, { count: SUBMAP_COUNT });
      return [...stack, { model: childModel, ctx: childCtx, playerCellIndex: onPlayerPath ? playerSubCellIndex(childModel) : null }];
    });
  }, [worldforgeAtlas, worldforgeSeed]);

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
      title={isPreviewOnly ? 'World Preview' : 'World Map'}
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
              onClick={() => { userPickedModeRef.current = true; setInteractionMode('pan'); }}
              className={`px-2 py-1 rounded ${interactionMode === 'pan' ? 'bg-emerald-700 text-white' : 'bg-gray-600 text-gray-100'}`}
              type="button"
              title="Click a cell to drill into its submap"
            >
              Explore
            </button>
            {allowTravel && (
              <button
                onClick={() => { userPickedModeRef.current = true; setInteractionMode('travel'); }}
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
                title="Sea travel: hire a ferry or sail your own ship"
                aria-label="Sea travel"
              >
                <option value="none">No sea travel</option>
                <option value="ferry">Ferry (hired)</option>
                {(() => {
                  const embark = shipTravelAvailability(activeShip, playerPortBurgId);
                  return (
                    <option
                      value="ship"
                      disabled={!embark.available}
                      title={embark.reason ?? undefined}
                      data-testid="sea-pref-ship-option"
                    >
                      {embark.available ? 'Ship (owned)' : `Ship (owned) — ${embark.reason}`}
                    </option>
                  );
                })()}
              </select>
            )}
            {allowTravel && interactionMode === 'travel' && noProvisions && (
              <span
                data-testid="travel-no-provisions"
                className="px-2 py-1 rounded bg-rose-900/80 text-rose-100 border border-rose-600 font-semibold"
                title="Your party carries no rations or water — stock up before a long journey."
              >
                ⚠ No provisions — can't sustain travel
              </span>
            )}
            {allow3DEntry && (
              <button
                onClick={() => { userPickedModeRef.current = true; setInteractionMode('enter3d'); }}
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
            {showGenerationControls && (
              <span className="ml-2 text-gray-800">Seed: {worldforgeSeed}</span>
            )}
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
                /* WG4: in the pre-game generation preview there is no player — pass a
                   null marker so neither the "you are here" indicator nor the "Find Me"
                   control (gated on `marker` in AtlasSvgView) appears. */
                marker={isPreviewOnly ? null : worldforgeMarker}
                markers={worldforgeDiscoveryPins}
                onPickCell={handleWorldforgePick}
                travelActive={interactionMode === 'travel'}
                planRoute={planAtlasRoute}
                planMultiModalRoute={planAtlasMultiModal}
                transportLabel={selectedTransport.readoutLabel}
                provisionRings={provisionRings}
                provisionLineForMinutes={provisionLineForMinutes}
                prefsScope={worldforgeSeed}
              />
            )}
            {/* One-time risk explainer — shown the FIRST time the player would set
                out underprovisioned, before the choice panel. Teaches the stakes +
                the ways to go farther, then never appears again. */}
            {pendingTravel && pendingStatus && !riskInfoDismissed ? (
              <div
                data-testid="travel-provision-risk-info"
                style={{
                  position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
                  width: 'min(460px, 94%)', background: 'rgba(15,30,45,0.98)',
                  border: '1px solid #eab308', borderRadius: 8, padding: '14px 16px',
                  fontFamily: 'sans-serif', color: '#e2e8f0', boxShadow: '0 6px 24px rgba(0,0,0,0.6)', zIndex: 21,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: '#fde047' }}>
                  ⚠️ Traveling beyond your supplies
                </div>
                <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 10 }}>
                  Every day on the road, each traveler eats <strong>one ration</strong> and drinks <strong>one day of water</strong>.
                  This destination lies farther than your supplies can carry you.
                  <br />
                  If you set out anyway and take no action to find more along the way, your party will march until the
                  food or water runs out, then <strong>halt short of where you were headed</strong> — stranded and
                  <strong> starving</strong>. Starvation wears the party down and erodes companion loyalty; pushed far
                  enough, a companion may <strong>abandon you</strong>.
                  <br />
                  To travel farther safely: <strong>carry more rations and water</strong>, set out on
                  <strong> half rations</strong> (slower, wearying), or <strong>forage en route</strong> (an uncertain
                  survival gamble).
                </div>
                <button
                  type="button"
                  data-testid="prov-risk-info-ack"
                  onClick={dismissRiskInfo}
                  style={{ width: '100%', padding: '7px 0', cursor: 'pointer', background: '#eab308', color: '#1c1409', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 700 }}
                >
                  Got it — show my options
                </button>
              </div>
            ) : null}
            {/* Underprovisioned travel choice — an inline panel over the atlas
                (not a separate modal), consistent with the travel readout. */}
            {pendingTravel && pendingStatus && riskInfoDismissed ? (
              <div
                data-testid="travel-provision-choice"
                style={{
                  position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
                  width: 'min(420px, 92%)', background: 'rgba(15,30,45,0.96)',
                  border: `1px solid ${pendingStatus.severity === 'major' ? '#ef4444' : '#eab308'}`,
                  borderRadius: 8, padding: '12px 14px', fontFamily: 'sans-serif', color: '#e2e8f0',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.5)', zIndex: 20,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4, color: pendingStatus.severity === 'major' ? '#fca5a5' : '#fde047' }}>
                  {pendingStatus.severity === 'major' ? 'You do not have nearly enough supplies.' : "You're a little short on supplies."}
                </div>
                <div style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 10 }}>
                  {pendingStatus.binding === 'water' ? 'Water' : 'Food'} runs out {pendingStatus.shortfallDays} day{pendingStatus.shortfallDays === 1 ? '' : 's'} before you'd arrive. Press on and you'll halt short, starving.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button type="button" data-testid="prov-turn-back" onClick={() => setPendingTravel(null)}
                    style={{ flex: '1 1 auto', padding: '6px 10px', cursor: 'pointer', background: '#1e293b', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 5, fontSize: 12, fontWeight: 600 }}>
                    Turn back
                  </button>
                  <button type="button" data-testid="prov-half" onClick={() => resolvePendingTravel('half')}
                    style={{ flex: '1 1 auto', padding: '6px 10px', cursor: 'pointer', background: '#1e293b', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 5, fontSize: 12, fontWeight: 600 }}>
                    Half rations
                  </button>
                  <button type="button" data-testid="prov-forage" onClick={() => resolvePendingTravel('forage')}
                    style={{ flex: '1 1 auto', padding: '6px 10px', cursor: 'pointer', background: '#1e293b', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 5, fontSize: 12, fontWeight: 600 }}>
                    Forage en route
                  </button>
                  <button type="button" data-testid="prov-push" onClick={() => resolvePendingTravel('push')}
                    style={{ flex: '1 1 auto', padding: '6px 10px', cursor: 'pointer', background: '#7f1d1d', color: '#fee2e2', border: '1px solid #b91c1c', borderRadius: 5, fontSize: 12, fontWeight: 700 }}>
                    Push on
                  </button>
                </div>
              </div>
            ) : null}
            {/* WM6/WM9: brief, self-clearing cue for clicks that would otherwise be
                silent no-ops (non-drillable cell in Explore, unreachable/ocean cell
                in Travel). Sits top-center, clear of the drill chrome + choice panels. */}
            {mapNotice ? (
              <div
                data-testid="map-action-notice"
                role="status"
                aria-live="polite"
                style={{
                  position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
                  maxWidth: 'min(360px, 90%)', background: 'rgba(15,23,42,0.95)',
                  border: '1px solid #475569', borderRadius: 8, padding: '8px 14px',
                  fontFamily: 'sans-serif', fontSize: 12, color: '#e2e8f0', textAlign: 'center',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.5)', zIndex: 22, pointerEvents: 'none',
                }}
              >
                {mapNotice}
              </div>
            ) : null}
          </div>

        {/* WG3: the helper line previously rendered gray-700 on a near-black panel
            (~1.6:1, far below WCAG AA). Give it its own dark pill + light text so it
            reads at AA-passing contrast regardless of the parchment/panel behind it. */}
        <p
          className="text-xs text-center mt-2 mx-auto max-w-3xl rounded bg-black/70 px-3 py-1.5 text-slate-100"
        >
          {allowTravel || allow3DEntry
            ? 'World map: use Pan/Zoom to explore. Travel moves on the world grid; Enter 3D jumps into the streamed world at a discovered cell. Click a cell to drill into the submap.'
            : 'World preview: use Pan/Zoom and layer controls to inspect world generation before starting a game. Click cells to drill deeper.'}
        </p>
      </div>
    </WindowFrame>
  );
};

export default MapPane;
