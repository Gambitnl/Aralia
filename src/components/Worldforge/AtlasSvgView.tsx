// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 05/07/2026, 09:48:09
 * Dependents: components/DesignPreview/steps/PreviewStartSelect.tsx, components/MapPane.tsx, components/Worldforge/SpawnPreview.tsx, components/Worldforge/StartPointSelection.tsx
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FmgAtlasResult } from '../../systems/worldforge/fmg/generateAtlas';
import { buildAtlasSvgModel, declutterLabels, findCellAtPoint, cellTraits, cellPolygonPoints, buildProvisionRingPath, forestGlyphRampOpacity, type CellTraits, type BurgTier, type AtlasLegendEntry } from './atlasSvg';
import { FOREST_LABEL_COLOR, FOREST_LABEL_OUTLINE } from '../../systems/worldforge/forests/forestTunables';
import { PEAK_LABEL_COLOR, RANGE_LABEL_COLOR, RANGE_LABEL_LETTER_SPACING_EM, RANGE_LABEL_OUTLINE } from '../../systems/worldforge/mountains/mountainTunables';
import type { DungeonDangerSite } from '../../systems/worldforge/overlays/dangerField';
import AtlasLayers from './AtlasLayers';
import { consumeMapCenterOnPlayer } from './mapFocusSignal';
import type { RoutePlan } from '../../systems/travel/routePlanning';
import type { MultiModalRoute } from '../../systems/travel/multiModalRoute';
import { formatRouteSummary, dangerRating, formatMultiModalSummary } from '../../systems/travel/travelReadout';
import { directionalAtlasNeighbor, type AtlasKeyboardDirection } from './AtlasMapView';

/** How much detail the hover info panel shows. */
type InfoVerbosity = 'off' | 'minimal' | 'standard' | 'full';
const INFO_VERBOSITY_OPTIONS: Array<{ id: InfoVerbosity; label: string }> = [
  { id: 'off', label: 'Off' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'standard', label: 'Standard' },
  { id: 'full', label: 'Full' },
];

export interface AtlasSvgViewProps {
  atlas: FmgAtlasResult;
  width?: number;
  height?: number;
  /** Always-on "you are here" marker, in graph coords (SP0 T7). */
  marker?: { x: number; y: number } | null;
  /**
   * Bump this to fire a short "look here!" pulse around the marker (e.g. when a
   * town is selected on the start screen). Each new value restarts the pulse, so
   * switching markers stops the old one and starts a fresh one at the new spot.
   */
  pulseToken?: number | null;
  /** Discovered-place pins, in graph coords (SP4 atlas pins). */
  markers?: Array<{ x: number; y: number; label?: string }>;
  /** Fired with the picked cell's traits on click (SP0 T7). */
  onPickCell?: (info: CellTraits) => void;
  /** Travel mode: when true, hovering a cell previews the fastest route to it. */
  travelActive?: boolean;
  /** Plan the fastest route from the player to a hovered cell id (MapPane supplies). */
  planRoute?: (toCell: number) => RoutePlan | null;
  /** Plan a pre-segmented mixed land/sea route for the hovered cell. */
  planMultiModalRoute?: (toCell: number) => MultiModalRoute | null;
  /**
   * Hired-ferry fare (gp) for a previewed multimodal route, appended to the
   * readout so the player sees the cost before committing (travel G15). Returns
   * null when no fare applies (owned ship, all-land trip, or non-ferry mode).
   */
  ferryFareForRoute?: (route: MultiModalRoute) => number | null;
  /**
   * Faint-path warning for a previewed land route: true when the route follows
   * a faint forest path, so the readout warns the player the trail can fade
   * (a get-lost risk) BEFORE they commit. MapPane owns the atlas nav info and
   * supplies the check; this just renders the appended warning.
   */
  faintPathForRoute?: (route: RoutePlan) => boolean;
  /**
   * Name of the largest named forest a previewed land route crosses, or null
   * when it crosses none. MapPane owns the atlas forests and supplies the
   * lookup; this just renders the appended "through the <Name>" piece.
   */
  forestNameForRoute?: (route: RoutePlan) => string | null;
  /**
   * Name of the FIRST named mountain pass a previewed land route crests, or
   * null when it crests none. MapPane owns the atlas passes and supplies the
   * lookup; this just threads the value into the readout ("via <Name>" —
   * formatRouteSummary owns the pass-beats-forest one-flavor-clause rule).
   */
  passNameForRoute?: (route: RoutePlan) => string | null;
  /** Transport label for the travel readout (e.g. "on foot", "by horse"). */
  transportLabel?: string;
  /**
   * Provisioning rings (travel logistics): one glowing contour per resource
   * horizon. MapPane passes the in-range cell set for each binding resource
   * (food, water) so the player sees how far current supplies reach BEFORE
   * clicking. Two rings appear only when the food and water horizons differ.
   */
  provisionRings?: Array<{ cellIds: number[]; color: string; label?: string }>;
  /**
   * Provisions readout for the hovered route's duration (minutes): the line of
   * supply the trip would cost ("Food: 6 days" / "Water: 2 days · short 1 day").
   * MapPane owns the provisioning math; this just renders the returned string.
   */
  provisionLineForMinutes?: (minutes: number) => { text: string; color: string } | null;
  /**
   * Scope for persisted layer prefs (map coloring + feature toggles). Pass a
   * stable per-world/per-save id (e.g. the world seed) so different campaigns
   * remember different views; omit for a single shared/global scope.
   */
  prefsScope?: string | number;
  /**
   * How the world is fitted into the (width × height) viewport when the box
   * aspect ratio differs from the world's.
   *  - `'contain'` (default): scale by the tighter axis so the WHOLE world is
   *    visible. The leftover area along the looser axis is painted as continuous
   *    ocean (a full-viewport sea backdrop), NOT a flat dark letterbox band, so
   *    a non-aspect-matched container (e.g. a full panel) reads as one seamless
   *    map rather than a map sandwiched between empty bars.
   *  - `'cover'`: scale by the looser axis so the world FILLS the viewport with
   *    no margins, cropping the overflowing edge. Opt-in — callers that hand an
   *    aspect-matched box (StartPointSelection) are unaffected either way, since
   *    contain == cover when the aspects already match.
   */
  fitMode?: 'contain' | 'cover';
  /**
   * Pillar 2, Task 8 (living ecology): live dungeon-site states for the danger
   * overlay. Each UNCLEARED site bumps the danger field around its cell, so the
   * overlay visibly reacts to nearby uncleared dungeons. Omit for the pre-Task-8
   * field (the danger term is flag-gated — no sites means byte-identical output).
   */
  dungeonSites?: ReadonlyArray<DungeonDangerSite>;
}

/** Read the persisted layer prefs for a given storage key (scoped per save). */
function loadLayerPrefs(key: string): { mapMode?: string; features?: Partial<Record<string, boolean>> } {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}

/**
 * Native SVG atlas (SP0): ocean depth bands + merged per-biome land regions
 * (soften-filtered, no facets) + rivers + routes + state borders + burgs +
 * decluttered labels, with manual wheel-zoom / drag-pan. Click picks the cell
 * under the cursor (owned nearest-site lookup) and an always-on marker shows the
 * current location. No iframe.
 */
// ── Map coloring (mutually exclusive base) ────────────────────────────────────
// These all tint the WHOLE land area, so only one can read at a time. Modelling
// them as independent checkboxes (the old design) let a player stack several
// semi-transparent fills into an unreadable, meaningless soup — and turning the
// one base (Biomes) off blanked the land entirely. They are now a single radio:
// pick what the land is colored BY. A neutral land base is always drawn beneath.
type AreaModeId =
  | 'biomes' | 'states' | 'cultures' | 'religions' | 'provinces'
  | 'population' | 'temperature' | 'precipitation' | 'none';
type LegendKind = 'biomes' | 'discrete' | 'ramp' | 'none';
interface AreaModeDef {
  id: AreaModeId;
  label: string;
  desc: string;
  legend: LegendKind;
  /** 3-stop gradient (matches the renderer's ramp) + end labels, for ramp legends. */
  ramp?: [string, string, string];
  ends?: [string, string];
  /** Model key whose emptiness disables this mode (undefined ⇒ always available). */
  dataKey?: keyof import('./atlasSvg').AtlasSvgModel;
  /** Discrete-legend noun for the "each color = one ___" caption. */
  noun?: string;
  /** Model key holding the named legend entries (color↔name swatches). */
  legendKey?: keyof import('./atlasSvg').AtlasSvgModel;
}
const AREA_MODES: AreaModeDef[] = [
  { id: 'biomes', label: 'Biomes', desc: 'Natural terrain type (forest, desert, tundra…)', legend: 'biomes' },
  { id: 'states', label: 'States', desc: 'Which state controls each region (political)', legend: 'discrete', dataKey: 'stateRegions', noun: 'state', legendKey: 'stateLegend' },
  { id: 'cultures', label: 'Cultures', desc: 'Which culture inhabits each region', legend: 'discrete', dataKey: 'cultureRegions', noun: 'culture', legendKey: 'cultureLegend' },
  { id: 'religions', label: 'Religions', desc: 'Dominant faith of each region', legend: 'discrete', dataKey: 'religionRegions', noun: 'religion', legendKey: 'religionLegend' },
  { id: 'provinces', label: 'Provinces', desc: 'Administrative provinces within states', legend: 'discrete', dataKey: 'provinceRegions', noun: 'province', legendKey: 'provinceLegend' },
  { id: 'population', label: 'Population', desc: 'How densely each area is settled', legend: 'ramp', ramp: ['#ffffcc', '#fd8d3c', '#800026'], ends: ['Sparse', 'Dense'], dataKey: 'populationCells' },
  { id: 'temperature', label: 'Temperature', desc: 'Average temperature, cold to hot', legend: 'ramp', ramp: ['#2c7bb6', '#ffffbf', '#d7191c'], ends: ['Cold', 'Hot'], dataKey: 'temperatureCells' },
  { id: 'precipitation', label: 'Precipitation', desc: 'Rainfall, dry to wet', legend: 'ramp', ramp: ['#f6e8c3', '#80cdc1', '#01665e'], ends: ['Dry', 'Wet'], dataKey: 'precipitationCells' },
  { id: 'none', label: 'None (plain land)', desc: 'Flat parchment land — features only', legend: 'none' },
];

// ── Feature layers (independent toggles, drawn on top of the coloring) ─────────
type FeatureLayerId =
  | 'rivers' | 'routes' | 'borders' | 'coast' | 'ice' | 'zones' | 'danger' | 'military'
  | 'burgs' | 'markers' | 'labels' | 'cells' | 'grid' | 'vignette';
interface FeatureLayerDef {
  id: FeatureLayerId;
  label: string;
  group: 'Features' | 'Places' | 'Reference';
  desc: string;
  /** Model key whose emptiness disables this toggle (undefined ⇒ always available). */
  dataKey?: keyof import('./atlasSvg').AtlasSvgModel;
}
const FEATURE_LAYERS: FeatureLayerDef[] = [
  { id: 'rivers', label: 'Rivers', group: 'Features', desc: 'Watercourses, widening downstream' },
  { id: 'routes', label: 'Routes', group: 'Features', desc: 'Roads, trails and sea lanes' },
  { id: 'borders', label: 'State borders', group: 'Features', desc: 'Political boundaries between states' },
  { id: 'coast', label: 'Coastline', group: 'Features', desc: 'Inked shore between land and sea' },
  { id: 'ice', label: 'Ice', group: 'Features', desc: 'Glaciers and frozen sea', dataKey: 'iceCells' },
  { id: 'zones', label: 'Zones', group: 'Features', desc: 'Event/danger areas: wars, plagues, disasters', dataKey: 'zoneCells' },
  { id: 'danger', label: 'Danger', group: 'Features', desc: 'Where is it risky to travel? Threat from wars, plagues and hostile terrain (blends over any coloring)', dataKey: 'dangerCells' },
  { id: 'military', label: 'Military', group: 'Features', desc: 'State regiments and fleets', dataKey: 'regiments' },
  { id: 'burgs', label: 'Burgs', group: 'Places', desc: 'Towns and cities (★ = capital)' },
  { id: 'markers', label: 'Markers', group: 'Places', desc: 'Points of interest', dataKey: 'poiMarkers' },
  { id: 'labels', label: 'Labels', group: 'Places', desc: 'State and settlement names' },
  { id: 'cells', label: 'Cells', group: 'Reference', desc: 'Voronoi cell mesh — the clickable grid' },
  { id: 'grid', label: 'Grid', group: 'Reference', desc: 'Latitude/longitude reference lines' },
  { id: 'vignette', label: 'Vignette', group: 'Reference', desc: 'Darkened map edges (cosmetic)' },
];
const FEATURE_GROUPS: Array<FeatureLayerDef['group']> = ['Features', 'Places', 'Reference'];

const DEFAULT_FEATURES: Record<FeatureLayerId, boolean> = {
  rivers: true, routes: true, borders: true, coast: true, ice: false, zones: false, danger: false, military: false,
  burgs: true, markers: false, labels: true, cells: false, grid: false, vignette: false,
};
const DEFAULT_AREA_MODE: AreaModeId = 'biomes';
const LAYER_PREFS_KEY = 'aralia.atlas.layerPrefs.v1';
const MIN_LAYER_PANEL_HEIGHT = 120;
const LAYER_PANEL_BELOW_COMFORT_PX = 240;
/**
 * Phone-sized atlas panes cannot carry multiple state labels over dense burg
 * glyphs. Keep one orienting overview label at the smallest sizes, then let the
 * normal declutterer expand as soon as the map has enough room.
 */
export function labelBudgetForViewport(width: number, height: number): number | undefined {
  if (width < 360 || height < 260) return 1;
  if (width < 420 || height < 320) {
    return Math.max(2, Math.floor((width * height) / 36_000));
  }
  return undefined;
}
/** Max named swatches shown in a discrete-coloring legend before "+N more". */
const LEGEND_SWATCH_CAP = 14;
/** How long the "look here!" marker pulse plays before it fades out (ms). */
const PULSE_MS = 3000;

// Settlement glyphs (screen-space, constant size). Parchment-map ink-on-cream so
// they read as little towns rather than facet-sized dots on the Voronoi. Capitals
// carry the only color accent (a red pennant). Drawn centered on the origin and
// translated to the burg's screen position by the view transform.
const BURG_INK = '#2b2622';
const BURG_FILL = '#f7f0df';
const BURG_FLAG = '#b3322a';
const BURG_STROKE = 0.9;
// Below these zoom scales a tier is hidden, so the overview stays uncluttered:
// capitals + cities always show; towns and villages reveal as you zoom in.
const BURG_MIN_K: Record<BurgTier, number> = { capital: 0, city: 0, town: 1.4, village: 2.4 };

/** The inner glyph paths for a settlement tier (origin-centered, ~10–18px). */
function burgGlyph(tier: BurgTier): React.ReactNode {
  const ink = { fill: BURG_FILL, stroke: BURG_INK, strokeWidth: BURG_STROKE, strokeLinejoin: 'round' as const };
  switch (tier) {
    case 'capital':
      return (
        <>
          {/* flanking towers + curtain wall */}
          <rect x={-7} y={-4} width={3.2} height={10} {...ink} />
          <rect x={3.8} y={-4} width={3.2} height={10} {...ink} />
          <rect x={-4.6} y={-1} width={9.2} height={7} {...ink} />
          {/* merlons (crenellations) */}
          <rect x={-7} y={-5.4} width={3.2} height={1.4} fill={BURG_INK} />
          <rect x={3.8} y={-5.4} width={3.2} height={1.4} fill={BURG_INK} />
          <rect x={-4.6} y={-2.4} width={1.7} height={1.4} fill={BURG_INK} />
          <rect x={-0.85} y={-2.4} width={1.7} height={1.4} fill={BURG_INK} />
          <rect x={2.9} y={-2.4} width={1.7} height={1.4} fill={BURG_INK} />
          {/* gate */}
          <path d="M-1.5,6 L-1.5,2.6 A1.5,1.5 0 0 1 1.5,2.6 L1.5,6 Z" fill={BURG_INK} />
          {/* pennant */}
          <line x1={0} y1={-2.4} x2={0} y2={-9} stroke={BURG_INK} strokeWidth={BURG_STROKE} />
          <path d="M0,-9 L4.2,-7.9 L0,-6.5 Z" fill={BURG_FLAG} stroke={BURG_INK} strokeWidth={0.5} strokeLinejoin="round" />
        </>
      );
    case 'city':
      return (
        <>
          {/* left, center (tall), right buildings — a little skyline */}
          <rect x={-7} y={2} width={4} height={4} {...ink} />
          <path d="M-7.4,2 L-5,-0.9 L-2.6,2 Z" {...ink} />
          <rect x={3} y={0.5} width={4} height={5.5} {...ink} />
          <path d="M2.6,0.5 L5,-2.4 L7.4,0.5 Z" {...ink} />
          <rect x={-2} y={-2} width={4} height={8} {...ink} />
          <path d="M-3,-2 L0,-6.6 L3,-2 Z" {...ink} />
        </>
      );
    case 'town':
      return (
        <>
          {/* house with chimney + door */}
          <rect x={2} y={-4.6} width={1.4} height={2.4} {...ink} />
          <rect x={-3.4} y={-0.5} width={6.8} height={6} {...ink} />
          <path d="M-4.4,-0.5 L0,-5.6 L4.4,-0.5 Z" {...ink} />
          <rect x={-0.9} y={2.4} width={1.8} height={3.1} fill={BURG_INK} />
        </>
      );
    case 'village':
    default:
      return (
        <>
          {/* single small cottage */}
          <rect x={-2.6} y={-0.3} width={5.2} height={4.6} {...ink} />
          <path d="M-3.4,-0.3 L0,-4 L3.4,-0.3 Z" {...ink} />
        </>
      );
  }
}

const SECTION_HEADER: React.CSSProperties = {
  color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: 0.5, marginBottom: 3,
};
const LAYER_CHOICE_ROW_STYLE: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 44,
  fontSize: 12,
  padding: '8px 6px',
  borderRadius: 4,
};
// Keep native radios/checkboxes in the form tree while expanding their hit area
// across each row, so the cramped atlas menu remains usable without losing state.
const LAYER_CHOICE_INPUT_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  margin: 0,
  opacity: 0,
  cursor: 'inherit',
};
const LAYER_CHOICE_TEXT_STYLE: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
};
const LAYER_CHOICE_MARK_STYLE: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  width: 16,
  height: 16,
  flex: '0 0 16px',
  border: '1px solid #94a3b8',
  background: 'rgba(15,23,42,0.9)',
};

const AtlasSvgView: React.FC<AtlasSvgViewProps> = ({ atlas, width = 960, height = 540, marker = null, markers = [], pulseToken = null, onPickCell, travelActive = false, planRoute, planMultiModalRoute, ferryFareForRoute, faintPathForRoute, forestNameForRoute, passNameForRoute, transportLabel = 'on foot', provisionRings = [], provisionLineForMinutes, prefsScope, fitMode = 'contain', dungeonSites }) => {
  const model = useMemo(() => buildAtlasSvgModel(atlas, dungeonSites), [atlas, dungeonSites]);

  // Map coloring is a single exclusive choice; feature layers are independent
  // toggles. Persisted across map opens, scoped per save (prefsScope) so a
  // player's preferred view sticks per-campaign.
  const prefsKey = `${LAYER_PREFS_KEY}:${prefsScope ?? 'global'}`;
  const prefsKeyRef = useRef(prefsKey);
  const readMode = (key: string): AreaModeId => {
    const s = loadLayerPrefs(key).mapMode;
    return s && AREA_MODES.some((m) => m.id === s) ? (s as AreaModeId) : DEFAULT_AREA_MODE;
  };
  const readFeatures = (key: string): Record<FeatureLayerId, boolean> => {
    const f = loadLayerPrefs(key).features;
    return f ? { ...DEFAULT_FEATURES, ...f } : { ...DEFAULT_FEATURES };
  };
  const [mapMode, setMapMode] = useState<AreaModeId>(() => readMode(prefsKey));
  const [features, setFeatures] = useState<Record<FeatureLayerId, boolean>>(() => readFeatures(prefsKey));

  // Reload prefs when the scope (save/world) changes after mount, so switching
  // campaigns restores that campaign's view instead of bleeding the old one.
  const prefsMounted = useRef(false);
  useEffect(() => {
    if (!prefsMounted.current) { prefsMounted.current = true; return; }
    if (prefsKeyRef.current === prefsKey) return;
    prefsKeyRef.current = prefsKey;
    setMapMode(readMode(prefsKey));
    setFeatures(readFeatures(prefsKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsKey]);

  // Persist to the CURRENT scope's key. (prefsKeyRef trails the reload effect so
  // a scope change loads-then-saves, never overwriting the new save with old state.)
  useEffect(() => {
    try { localStorage.setItem(prefsKeyRef.current, JSON.stringify({ mapMode, features })); } catch { /* ignore */ }
  }, [mapMode, features]);

  const [layersOpen, setLayersOpen] = useState(false);
  const [layersViewportFit, setLayersViewportFit] = useState<{
    maxHeight: number;
    top: number;
    right: number;
  } | null>(null);
  const layersMenuRef = useRef<HTMLDivElement>(null);
  const toggleFeature = (id: FeatureLayerId) => setFeatures((f) => ({ ...f, [id]: !f[id] }));
  const resetLayers = () => { setMapMode(DEFAULT_AREA_MODE); setFeatures({ ...DEFAULT_FEATURES }); };

  const updateLayersViewportMaxHeight = useCallback(() => {
    const menu = layersMenuRef.current;
    const toggle = menu?.querySelector('[data-testid="atlas-layers-toggle"]') as HTMLElement | null;
    if (!toggle) return;

    // The atlas may be embedded below other controls inside a floating window.
    // Anchor the open menu in viewport coordinates so it can escape the atlas
    // viewport's overflow clipping while staying aligned to the trigger.
    const toggleRect = toggle.getBoundingClientRect();
    const viewportHeight = Math.floor(Math.min(window.innerHeight, window.visualViewport?.height ?? window.innerHeight));
    const viewportWidth = Math.floor(Math.min(window.innerWidth, window.visualViewport?.width ?? window.innerWidth));
    const availableBelow = Math.floor(viewportHeight - toggleRect.bottom - 12);
    const availableAbove = Math.floor(toggleRect.top - 12);
    const shouldOpenAbove = availableBelow < LAYER_PANEL_BELOW_COMFORT_PX && availableAbove > availableBelow;
    const nominalMaxHeight = Math.max(MIN_LAYER_PANEL_HEIGHT, height - 52);
    const sideMaxHeight = Math.max(MIN_LAYER_PANEL_HEIGHT, shouldOpenAbove ? availableAbove : availableBelow);
    const maxHeight = Math.min(nominalMaxHeight, sideMaxHeight);
    setLayersViewportFit({
      maxHeight,
      top: shouldOpenAbove ? Math.max(12, Math.floor(toggleRect.top - maxHeight - 4)) : Math.floor(toggleRect.bottom + 4),
      right: Math.max(12, Math.floor(viewportWidth - toggleRect.right)),
    });
  }, [height]);

  useEffect(() => {
    if (!layersOpen) return;

    updateLayersViewportMaxHeight();
    const frame = window.requestAnimationFrame(updateLayersViewportMaxHeight);
    window.addEventListener('resize', updateLayersViewportMaxHeight);
    window.visualViewport?.addEventListener('resize', updateLayersViewportMaxHeight);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateLayersViewportMaxHeight);
      window.visualViewport?.removeEventListener('resize', updateLayersViewportMaxHeight);
    };
  }, [layersOpen, updateLayersViewportMaxHeight]);

  useEffect(() => {
    if (!layersOpen) return;

    // The atlas layer menu is a transient overlay. Let players dismiss it with
    // Escape or by clicking/tapping away so it does not stay stacked over other
    // start-town or map controls after focus has moved elsewhere.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setLayersOpen(false);
    };
    const handlePointerDown = (event: PointerEvent) => {
      const menu = layersMenuRef.current;
      if (!menu || menu.contains(event.target as Node)) return;
      setLayersOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [layersOpen]);

  // How many features each potentially-empty layer actually has — drives the
  // "(none on this map)" affordance so toggling an empty layer isn't read as a bug.
  const layerCounts = useMemo(() => {
    const count = (key?: keyof typeof model): number => {
      if (!key) return Infinity; // always-available layer
      const v = model[key] as unknown;
      return Array.isArray(v) ? v.length : Infinity;
    };
    const area: Partial<Record<AreaModeId, number>> = {};
    for (const m of AREA_MODES) area[m.id] = count(m.dataKey);
    const feat: Partial<Record<FeatureLayerId, number>> = {};
    for (const f of FEATURE_LAYERS) feat[f.id] = count(f.dataKey);
    return { area, feat };
  }, [model]);

  // The flat visibility map AtlasLayers expects, derived from the exclusive
  // mapMode + the feature toggles. Identity changes only when a real choice
  // changes (not on hover/pan), preserving the memoized layer subtree.
  const visible = useMemo<Record<string, boolean>>(() => ({
    biomes: mapMode === 'biomes',
    states: mapMode === 'states',
    cultures: mapMode === 'cultures',
    religions: mapMode === 'religions',
    provinces: mapMode === 'provinces',
    population: mapMode === 'population',
    temperature: mapMode === 'temperature',
    precipitation: mapMode === 'precipitation',
    ...features,
  }), [mapMode, features]);

  const activeMode = AREA_MODES.find((m) => m.id === mapMode) ?? AREA_MODES[0];
  // Phone-sized atlas panes cannot carry every state name at the default zoom:
  // labels crowd into town glyphs and each other. Keep the labels toggle on, but
  // give the declutterer a viewport-based budget until the player zooms in or
  // opens the map in a larger WindowFrame.
  const smallLabelViewport = width < 420 || height < 320;
  const labelBudget = labelBudgetForViewport(width, height);
  const labelPad = smallLabelViewport ? (labelBudget === 1 ? 12 : 8) : 2;
  // Named swatches for the active discrete coloring (which color = which group).
  const discreteLegend = useMemo<AtlasLegendEntry[]>(() => {
    if (activeMode.legend !== 'discrete' || !activeMode.legendKey) return [];
    const arr = model[activeMode.legendKey];
    return Array.isArray(arr) ? (arr as AtlasLegendEntry[]) : [];
  }, [activeMode, model]);
  // Hover read-out: the cell under the cursor (highlighted + described), and how
  // much of its info the bottom-left panel shows.
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);
  // Index into model.burgs when the cursor is over a settlement glyph — its info
  // panel takes over from the generic cell readout while hovered.
  const [hoveredBurg, setHoveredBurg] = useState<number | null>(null);
  // Index into model.burgs when a settlement glyph has been CLICKED — opens a
  // pinned town detail card (deeper than the transient hover readout).
  const [selectedBurg, setSelectedBurg] = useState<number | null>(null);
  const [infoVerbosity, setInfoVerbosity] = useState<InfoVerbosity>('standard');
  const fitView = useCallback(() => {
    // 'contain' fits the whole world (tighter axis); 'cover' fills the viewport
    // and crops the overflow (looser axis). When the box already matches the
    // world aspect both reduce to the same k, so aspect-matched parents are
    // unaffected by the mode.
    const sx = width / model.width;
    const sy = height / model.height;
    const k = fitMode === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy);
    return {
      k,
      x: (width - model.width * k) / 2,
      y: (height - model.height * k) / 2,
    };
  }, [fitMode, height, model.height, model.width, width]);
  const [view, setView] = useState(fitView);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const downPos = useRef<{ x: number; y: number } | null>(null);
  // True once the pointer has moved beyond DRAG_SLOP while pressed — marks the
  // gesture a PAN so the release is never treated as a cell click (which, in
  // Travel mode, would travel + close the map). Reset on each mousedown.
  const draggedRef = useRef(false);
  // Touch has no hover. The first tap previews/inspects a cell; a second tap on
  // that same cell commits the existing pick callback. This prevents a finger
  // from starting travel before the player can read the route and supplies.
  const lastPointerTypeRef = useRef<string>('mouse');
  const touchArmedCellRef = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hasKeyboardFocus, setHasKeyboardFocus] = useState(false);
  // True once the player has manually zoomed/panned (or used Find Me). After that
  // we stop auto-refitting on viewport-size changes, so toggling Travel↔Explore —
  // which grows/shrinks the toolbar and therefore the measured map area — no
  // longer snaps the player back out to the fully zoomed-out world. Cleared when
  // the world itself changes (below), so a brand-new atlas still fits fresh.
  const hasUserAdjustedRef = useRef(false);

  // A genuinely different world should fit fresh, so forget any prior manual zoom.
  useEffect(() => { hasUserAdjustedRef.current = false; }, [atlas]);

  useEffect(() => {
    // The parent MapPane measures the available panel space. Refit the atlas
    // whenever that space changes so the SVG fills the visible window area — but
    // only until the player has taken control of the view, so a layout change
    // (e.g. the Travel/Explore toggle) preserves their current zoom and pan.
    if (hasUserAdjustedRef.current) return;
    setView(fitView());
  }, [fitView]);

  // Wheel-zoom must call preventDefault to stop the page from scrolling, but
  // React's onWheel prop registers a PASSIVE listener (preventDefault is a no-op
  // and warns). Attach a native non-passive listener on the svg via the ref.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      hasUserAdjustedRef.current = true; // player took control of the zoom
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setView((v) => {
        const nextK = Math.max(0.05, Math.min(64, v.k * factor));
        // Anchor the zoom on the cursor: keep the map point under the pointer
        // fixed by solving translate' = p - worldPointUnderCursor * nextK.
        const rect = el.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) {
          return { ...v, k: nextK };
        }
        // Map the pointer into SVG user units (viewBox is 0 0 width height).
        const px = (e.clientX - rect.left) * (width / rect.width);
        const py = (e.clientY - rect.top) * (height / rect.height);
        const wx = (px - v.x) / v.k;
        const wy = (py - v.y) / v.k;
        return { k: nextK, x: px - wx * nextK, y: py - wy * nextK };
      });
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [width, height]);
  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    lastPointerTypeRef.current = e.pointerType;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX - view.x, y: e.clientY - view.y };
    downPos.current = { x: e.clientX, y: e.clientY };
    draggedRef.current = false;
  };
  // Pointer (client) → atlas graph coords, accounting for pan/zoom + svg scaling.
  const pointerToGraph = (clientX: number, clientY: number): { gx: number; gy: number } | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    const sx = (clientX - rect.left) * (width / rect.width);
    const sy = (clientY - rect.top) * (height / rect.height);
    return { gx: (sx - view.x) / view.k, gy: (sy - view.y) / view.k };
  };
  const DRAG_SLOP = 4; // px of movement before a press is treated as a pan
  // The visible burg under a graph-space point (within a ~16px screen radius), or
  // null. Shared by hover (info takeover) and click (open detail panel).
  const findBurgAt = (gx: number, gy: number): number | null => {
    if (!visible.burgs) return null;
    const rGraph = 16 / view.k;
    let best = rGraph * rGraph;
    let hit: number | null = null;
    const burgs = model.burgs ?? [];
    for (let bi = 0; bi < burgs.length; bi++) {
      const b = burgs[bi];
      if (view.k < BURG_MIN_K[b.tier]) continue; // hidden at this zoom → not pickable
      const dx = b.x - gx;
      const dy = b.y - gy;
      const dd = dx * dx + dy * dy;
      if (dd < best) { best = dd; hit = bi; }
    }
    return hit;
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (d) {
      const dp = downPos.current;
      if (dp && Math.hypot(e.clientX - dp.x, e.clientY - dp.y) > DRAG_SLOP) {
        draggedRef.current = true; // any real movement → this gesture is a pan
        hasUserAdjustedRef.current = true; // player took control of the pan
      }
      // Capture the drag origin locally: the setView updater runs later, by which
      // time onUp/onLeave may have nulled drag.current (→ "reading 'x' of null").
      setView((v) => ({ ...v, x: e.clientX - d.x, y: e.clientY - d.y }));
      return;
    }
    // A touch drag has no stable hover position. Its eventual tap is armed in
    // onClick, while a real drag only changes the view.
    if (e.pointerType === 'touch') return;
    // Hover: resolve and highlight the cell under the cursor (always, even when
    // the Cells layer is off). setState with the same index is a no-op re-render.
    const p = pointerToGraph(e.clientX, e.clientY);
    if (!p) return;
    const i = findCellAtPoint(atlas, p.gx, p.gy);
    setHoveredCell(i >= 0 ? i : null);
    // Prefer a settlement under the cursor: if a visible burg glyph is within a
    // small screen-space radius, the town info panel takes over from the cell one.
    setHoveredBurg(findBurgAt(p.gx, p.gy));
  };
  const onUp = (e: React.PointerEvent<SVGSVGElement>) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture?.(e.pointerId);
  };
  const onLeave = (e: React.PointerEvent<SVGSVGElement>) => {
    drag.current = null;
    if (e.pointerType !== 'touch') {
      setHoveredCell(null);
      setHoveredBurg(null);
    }
  };
  const onClick = (e: React.MouseEvent) => {
    // Suppress the pick when the gesture was a pan — either the press moved during
    // the drag (draggedRef), or net down→up displacement exceeds the slop. This
    // stops a grab-and-pan from being read as a cell click (which travels + closes
    // the map in Travel mode).
    if (draggedRef.current) return;
    const dp = downPos.current;
    if (dp && Math.hypot(e.clientX - dp.x, e.clientY - dp.y) > DRAG_SLOP) return;
    const p = pointerToGraph(e.clientX, e.clientY);
    if (!p) return;
    // A click on a settlement glyph opens its pinned detail card instead of
    // picking the underlying cell (towns are inspected before you commit travel).
    const b = findBurgAt(p.gx, p.gy);
    if (b != null) { setSelectedBurg(b); return; }
    setSelectedBurg(null);
    if (!onPickCell) return;
    const i = findCellAtPoint(atlas, p.gx, p.gy);
    if (i < 0) return;
    if (lastPointerTypeRef.current === 'touch' && touchArmedCellRef.current !== i) {
      touchArmedCellRef.current = i;
      setHoveredCell(i);
      setHoveredBurg(null);
      return;
    }
    touchArmedCellRef.current = null;
    onPickCell(cellTraits(atlas, i));
  };

  const handleAtlasKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    const direction: AtlasKeyboardDirection | null =
      event.key === 'ArrowLeft' ? 'left'
        : event.key === 'ArrowRight' ? 'right'
          : event.key === 'ArrowUp' ? 'up'
            : event.key === 'ArrowDown' ? 'down'
              : null;
    if (direction) {
      event.preventDefault();
      const markerCell = marker ? findCellAtPoint(atlas, marker.x, marker.y) : -1;
      const firstLand = Array.from(atlas.pack.cells.h).findIndex((cellHeight) => cellHeight >= 20);
      const current = hoveredCell ?? (markerCell >= 0 ? markerCell : Math.max(0, firstLand));
      const next = directionalAtlasNeighbor(current, direction, atlas.pack.cells.p, atlas.pack.cells.c);
      setHoveredCell(next);
      setHoveredBurg(null);
      touchArmedCellRef.current = null;
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && hoveredCell != null && onPickCell) {
      event.preventDefault();
      onPickCell(cellTraits(atlas, hoveredCell));
    }
  };

  // Full trait readout for the hovered cell (computed regardless of layer toggles).
  const hoveredTraits = useMemo(
    () => (hoveredCell != null ? cellTraits(atlas, hoveredCell) : null),
    [atlas, hoveredCell],
  );
  // Town readout for a hovered settlement glyph: resolve the burg's cell and
  // reuse cellTraits (which carries the burg name, state, culture, etc.).
  const hoveredBurgInfo = useMemo(() => {
    if (hoveredBurg == null) return null;
    const b = (model.burgs ?? [])[hoveredBurg];
    if (!b) return null;
    // Use the burg's own FMG cell (exact) rather than the nearest cell center,
    // which can snap a coastal burg onto a neighbouring water cell.
    const cell = b.cell != null && b.cell >= 0 ? b.cell : findCellAtPoint(atlas, b.x, b.y);
    const traits = cell >= 0 ? cellTraits(atlas, cell) : null;
    return { tier: b.tier, capital: b.capital, name: b.name, traits };
  }, [hoveredBurg, model.burgs, atlas]);
  // The clicked settlement's full readout + its cell traits, for the pinned card.
  const selectedBurgInfo = useMemo(() => {
    if (selectedBurg == null) return null;
    const b = (model.burgs ?? [])[selectedBurg];
    if (!b) return null;
    const cell = b.cell != null && b.cell >= 0 ? b.cell : findCellAtPoint(atlas, b.x, b.y);
    const traits = cell >= 0 ? cellTraits(atlas, cell) : null;
    return { tier: b.tier, capital: b.capital, name: b.name, traits };
  }, [selectedBurg, model.burgs, atlas]);
  const hoveredOutline = hoveredCell != null ? cellPolygonPoints(atlas, hoveredCell) : '';

  // Travel preview: the fastest route from the player to the hovered cell. null
  // when not in travel mode, no hover, or the cell is unreachable (→ "No route").
  const travelRoute = useMemo<RoutePlan | null>(
    () => (travelActive && planRoute && hoveredCell != null ? planRoute(hoveredCell) : null),
    [travelActive, planRoute, hoveredCell],
  );
  const multiModalRoute = useMemo<MultiModalRoute | null>(
    () => (travelActive && planMultiModalRoute && hoveredCell != null ? planMultiModalRoute(hoveredCell) : null),
    [travelActive, planMultiModalRoute, hoveredCell],
  );
  const displayedRoute = multiModalRoute ?? travelRoute;

  // Provisioning rings: precompute the contour path per resource horizon. Memoized
  // on (atlas, provisionRings) so panning/hover/zoom never re-extract the boundary
  // (a per-edge sweep over the in-range set, not free at thousands of cells).
  const provisionRingPaths = useMemo(
    () => provisionRings
      .map((r) => ({ d: buildProvisionRingPath(atlas, r.cellIds), color: r.color, label: r.label }))
      .filter((r) => r.d.length > 0),
    [atlas, provisionRings],
  );

  // "Find Me": zoom in on the player's marker and surface their current cell in
  // the info panel (the red outline + readout answer "which cell am I at?").
  const centerOnPlayer = useCallback(() => {
    if (!marker) return;
    hasUserAdjustedRef.current = true; // a deliberate view choice — keep it across layout changes
    const k = Math.min(64, Math.max(view.k, (8 * width) / model.width)); // ~1/8 of the map wide
    setView({ k, x: width / 2 - marker.x * k, y: height / 2 - marker.y * k });
    const i = findCellAtPoint(atlas, marker.x, marker.y);
    setHoveredCell(i >= 0 ? i : null);
  }, [marker, view.k, width, height, model.width, atlas]);

  // One-shot "open centered on the player's cell" (the 3D HUD "Cell Map"
  // button). Consumed once at mount so a normal map open still uses fit-view;
  // deferred until the player marker is available (it may not be on the first
  // render), then centered exactly once.
  const wantCenterOnPlayer = useRef(false);
  useEffect(() => {
    wantCenterOnPlayer.current = consumeMapCenterOnPlayer();
  }, []);
  useEffect(() => {
    if (wantCenterOnPlayer.current && marker) {
      wantCenterOnPlayer.current = false;
      centerOnPlayer();
    }
  }, [marker, centerOnPlayer]);

  // A short "look here!" pulse around the marker — the small yellow indicator is
  // easy to lose on a fully zoomed-out world. The parent bumps `pulseToken` to
  // (re)trigger it (town selected/changed, or a manual Locate button). A finite
  // timer hides it after PULSE_MS; a new token clears the prior timer and
  // restarts, so switching towns stops the old pulse and begins one at the new
  // marker location.
  const [pulseActive, setPulseActive] = useState(false);
  useEffect(() => {
    if (pulseToken == null) return;
    setPulseActive(true);
    const id = window.setTimeout(() => setPulseActive(false), PULSE_MS);
    return () => window.clearTimeout(id);
  }, [pulseToken]);

  // The biome softening filter lives INSIDE the zoom transform, so a fixed
  // map-unit blur magnifies with zoom and smears biomes when zoomed in. Scale
  // stdDeviation by the fit ratio (fitK / view.k) so the on-screen blur holds at
  // its overview amount (~1 unit at fit) regardless of zoom — facet-hiding at
  // overview, crisp biome edges when zoomed in. Clamped for safety.
  const fitK = Math.min(width / model.width, height / model.height);
  // On a degenerate first frame (model dims or view.k not yet measured) the ratio
  // can be NaN/±Infinity — feGaussianBlur would then warn "Received NaN for
  // stdDeviation". Fall back to the overview blur amount until real values land.
  const softenRatio = fitK / view.k;
  // P1 perf: the soften filter (≈8 filtered biome/overlay groups, ~1900 nodes)
  // re-rasterizes whenever stdDeviation changes, so a smoothly-varying value
  // invalidates the filter cache on EVERY zoom frame. Two cheap mitigations,
  // both fully inside this file (the `filter=` attributes themselves live in
  // AtlasLayers — see the cross-file follow-up note):
  //   1. QUANTIZE the blur to coarse steps so small zoom nudges (and panning,
  //      which doesn't change k at all) reuse the cached raster instead of
  //      re-blurring. The zoom-compensation (memory: stdDev ∝ fitK/view.k, or it
  //      smears when zoomed in) is preserved — we still track zoom, just in steps.
  //   2. DROP the blur entirely once zoomed in past ~2× the fit scale. There the
  //      facets are already crisp (the blur would only smear, per the memory),
  //      and stdDeviation 0 lets the browser short-circuit the Gaussian pass.
  const ZOOM_SOFTEN_CUTOFF = 2; // view.k ≥ fitK * cutoff ⇒ no softening needed
  const rawStd = Number.isFinite(softenRatio) ? Math.min(2, Math.max(0.05, softenRatio)) : 1;
  const zoomedIn = Number.isFinite(softenRatio) && view.k >= fitK * ZOOM_SOFTEN_CUTOFF;
  // Quantize to 0.25-unit steps (0.05 floor preserved) so the raster is stable
  // across pans and micro-zooms.
  const softenStdDev = zoomedIn ? 0 : Math.max(0.05, Math.round(rawStd * 4) / 4);
  // The layer menu is positioned inside the atlas viewport. Its wrapper is
  // auto-sized, so percentage max-heights do not resolve reliably; derive a
  // concrete cap from the atlas height and from the chosen viewport side so
  // cramped previews keep a scrollable menu instead of clipping controls.
  const nominalLayersPanelMaxHeight = Math.max(MIN_LAYER_PANEL_HEIGHT, height - 52);
  const layersPanelMaxHeight = Math.max(
    MIN_LAYER_PANEL_HEIGHT,
    Math.min(nominalLayersPanelMaxHeight, layersViewportFit?.maxHeight ?? nominalLayersPanelMaxHeight),
  );
  const layersPanelPositionStyle: React.CSSProperties = layersViewportFit
    ? { position: 'fixed', top: layersViewportFit.top, right: layersViewportFit.right, zIndex: 80 }
    : { marginTop: 4 };
  const compactTownCard = width < 300 || height < 220;
  const selectedTownCardStyle: React.CSSProperties = compactTownCard
    ? {
        position: 'absolute',
        top: 8,
        left: 8,
        right: 8,
        maxHeight: Math.max(180, Math.min(320, height + 120)),
        background: 'rgb(28,20,12)',
        border: '1px solid #b3892f',
        borderRadius: 5,
        padding: '8px 10px',
        fontFamily: 'sans-serif',
        fontSize: 12,
        color: '#f5ecd8',
        boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
        pointerEvents: 'auto',
        overflowY: 'auto',
        zIndex: 60,
      }
    : {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 210,
        background: 'rgb(28,20,12)',
        border: '1px solid #b3892f',
        borderRadius: 5,
        padding: '8px 10px',
        fontFamily: 'sans-serif',
        fontSize: 12,
        color: '#f5ecd8',
        boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
        pointerEvents: 'auto',
        zIndex: 60,
      };

  return (
    <div style={{ position: 'relative', width, height }}>
    <svg
      ref={svgRef}
      width={width} height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="application"
      tabIndex={0}
      aria-label={travelActive
        ? 'World atlas travel map. Use arrow keys to inspect neighboring cells and Enter or Space to choose a destination.'
        : 'World atlas. Use arrow keys to inspect neighboring cells and Enter or Space to select a cell.'}
      style={{
        background: '#1f4a73',
        userSelect: 'none',
        touchAction: 'none',
        cursor: drag.current ? 'grabbing' : 'grab',
        outline: hasKeyboardFocus ? '3px solid #f5c542' : 'none',
        outlineOffset: -3,
      }}
      onFocus={() => setHasKeyboardFocus(true)}
      onBlur={() => setHasKeyboardFocus(false)}
      onKeyDown={handleAtlasKeyDown}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onLeave}
      onClick={onClick}
      data-testid="atlas-svg-view"
    >
      <defs>
        {/* Seam-free softening of the raw-Voronoi biome edges (SP0 T6, Azgaar's
            blur technique). Coast/rivers/borders/labels draw crisp on top.
            stdDeviation is zoom-compensated (see softenStdDev) so it doesn't
            smear when zoomed in. */}
        <filter id="atlas-soften" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation={softenStdDev} />
        </filter>
        {/* Vignette: darkened edges (Azgaar "vignette" overlay). */}
        <radialGradient id="atlas-vignette" cx="50%" cy="50%" r="75%">
          <stop offset="55%" stopColor="#000000" stopOpacity={0} />
          <stop offset="100%" stopColor="#000000" stopOpacity={0.55} />
        </radialGradient>
        {/* PROTOTYPE: diagonal red hatch for the derived danger overlay. A pattern
            (not a flat tint) so threat reads as a warning texture layered OVER the
            base coloring. userSpaceOnUse keeps the hatch pitch constant in map units. */}
        <pattern id="danger-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="none" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="#b91c1c" strokeWidth="2" />
        </pattern>
      </defs>
      {/* Full-viewport ocean backdrop (screen space, BELOW the zoom group). In
          'contain' mode the world rarely matches the container aspect, leaving
          a margin along one axis; painting that margin as continuous sea (the
          same deep-ocean tone as the base rect) makes the off-world area read as
          open water instead of an empty dark letterbox band (WG2 / S3). It sits
          under everything, so the world, depth bands and coast still draw on top
          exactly as before. In 'cover' mode the world covers the viewport and
          this is simply hidden. */}
      <rect x={0} y={0} width={width} height={height} fill="#1f4a73" pointerEvents="none" />
      {/* The forest glyph layer's zoom ramp rides in as a CSS custom property:
          AtlasLayers is memoized with no zoom access (the freeze fix), so its
          glyph group reads var(--forest-glyph-opacity) instead of a prop —
          zooming re-renders only this <g>'s style, never the layer subtree. */}
      <g
        transform={`translate(${view.x},${view.y}) scale(${view.k})`}
        style={{ '--forest-glyph-opacity': forestGlyphRampOpacity(view.k) } as React.CSSProperties}
      >
        {/* Deep base ocean; shallow depth bands (T3b) layer on top near coasts. */}
        <rect x={0} y={0} width={model.width} height={model.height} fill="#1f4a73" />
        {/* Heavy static layers, memoized so hover/pan/zoom don't reconcile the
            whole (4k–18k node) subtree — the World Map freeze fix. */}
        <AtlasLayers model={model} visible={visible} softenActive={softenStdDev > 0} />
        {/* Provisioning rings — glowing contour of how far current supplies reach.
            Wide soft underlay + crisp colored line per resource horizon (food /
            water). Drawn above the base coloring but below routes + hover so the
            travel line and cursor outline stay legible on top. */}
        {provisionRingPaths.map((ring, idx) => (
          <g key={`prov-ring-${idx}`} data-testid="atlas-provision-ring" data-ring-label={ring.label ?? ''} style={{ pointerEvents: 'none' }}>
            <path d={ring.d} fill="none" stroke={ring.color} strokeOpacity={0.22} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <path d={ring.d} fill="none" stroke={ring.color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </g>
        ))}
        {/* Hover highlight — reddish outline on the cell under the cursor. Cheap
            sibling: re-renders on hover without touching AtlasLayers. */}
        {hoveredOutline ? (
          <polygon points={hoveredOutline} fill="none" stroke="#ef4444" strokeWidth={1.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />
        ) : null}
        {/* Travel route preview — fastest path from player to hovered cell. */}
        {multiModalRoute && multiModalRoute.segments.length > 0 ? (
          <>
            {multiModalRoute.segments.map((segment, index) => {
              const points = segment.points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
              // Tender = the short "rowed ashore" hop between ship and land (G14).
              // Give it its own read: a muted, fine-dotted line, distinct from the
              // cyan dashed sea leg and the danger-tinted land leg.
              const stroke = segment.kind === 'sea'
                ? '#38bdf8'
                : segment.kind === 'tender'
                  ? '#cbb48f'
                  : dangerRating(multiModalRoute.danger).color;
              const strokeWidth = segment.kind === 'sea' ? 2.4 : segment.kind === 'tender' ? 1.6 : 2.2;
              const strokeDasharray = segment.kind === 'sea' ? '2 5' : segment.kind === 'tender' ? '0.5 3' : '6 4';
              return (
                <polyline
                  key={`${segment.kind}-${index}`}
                  data-testid={`atlas-travel-segment-${segment.kind}`}
                  points={points}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              );
            })}
          </>
        ) : travelRoute && travelRoute.points.length > 1 ? (
          <>
            <polyline
              points={travelRoute.points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}
              fill="none" stroke="#0f172a" strokeOpacity={0.5} strokeWidth={4.5}
              strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none"
            />
            <polyline
              points={travelRoute.points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}
              fill="none" stroke={dangerRating(travelRoute.danger).color} strokeWidth={2.2}
              strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none"
            />
          </>
        ) : null}
      </g>
      {/* Labels overlay — screen space (constant size), zoom-thresholded + decluttered (T5c).
          Burg names (capital/town) are nudged below their point so the settlement
          glyph (drawn after this block) sits ABOVE the name without overlapping.
          State, forest, range and peak names sit ON their anchor (dy 0). Forest
          names read as physical geography: italic, muted green, dark outline
          (forests T4). Range names are spaced small-caps in stony ink — SVG has
          no text-transform, so the STRING is uppercased at render — and peaks
          are tiny "▲ Name" landmarks in the same ink family (mountains T3). */}
      {visible.labels ? declutterLabels(model.labels ?? [], view, { bounds: { width, height }, pad: labelPad, maxLabels: labelBudget }).map((l, i) => (
        <text
          key={`lb${i}`}
          x={l.sx}
          y={l.sy + (l.kind === 'capital' || l.kind === 'town' ? 15 : 0)}
          textAnchor="middle"
          fontFamily={l.kind === 'capital' || l.kind === 'town' ? 'sans-serif' : 'Georgia, serif'}
          fontStyle={l.kind === 'forest' ? 'italic' : undefined}
          fontSize={l.fontSize}
          fontWeight={l.kind === 'state' || l.kind === 'capital' ? 700 : 400}
          letterSpacing={l.kind === 'range' ? `${RANGE_LABEL_LETTER_SPACING_EM}em` : undefined}
          fill={
            l.kind === 'range' ? RANGE_LABEL_COLOR
            : l.kind === 'peak' ? PEAK_LABEL_COLOR
            : l.kind === 'forest' ? FOREST_LABEL_COLOR
            : l.kind === 'state' ? '#2d1b38' : '#111827'
          }
          stroke={
            l.kind === 'range' || l.kind === 'peak' ? RANGE_LABEL_OUTLINE
            : l.kind === 'forest' ? FOREST_LABEL_OUTLINE : '#ffffff'
          }
          strokeWidth={l.kind === 'state' ? 3 : 2}
          paintOrder="stroke"
          style={{ pointerEvents: 'none' }}
        >
          {l.kind === 'range' ? l.text.toUpperCase() : l.text}
        </text>
      )) : null}
      {/* Burg settlement glyphs — screen space (constant size), tier-distinct,
          zoom-thresholded so the overview shows only capitals + cities. Drawn
          AFTER labels so the icon sits on top of (and just above) its name. */}
      {visible.burgs ? (model.burgs ?? [])
        .map((b, i) => ({ b, i }))
        .filter(({ b }) => view.k >= BURG_MIN_K[b.tier])
        .map(({ b, i }) => (
          <g
            key={`burg${i}`}
            transform={`translate(${b.x * view.k + view.x},${b.y * view.k + view.y})`}
            style={{ pointerEvents: 'none' }}
            data-testid="atlas-burg"
            data-tier={b.tier}
          >
            {selectedBurg === i ? (
              <circle r={15} fill="none" stroke="#f5c542" strokeWidth={2.5} opacity={0.95} />
            ) : hoveredBurg === i ? (
              <circle r={13} fill="none" stroke="#f5c542" strokeWidth={1.5} opacity={0.9} />
            ) : null}
            {burgGlyph(b.tier)}
          </g>
        )) : null}
      {/* Discovered hidden-place pins (SP4) — screen space, constant size. */}
      {markers.map((m, i) => (
        <g key={`disc${i}`} transform={`translate(${m.x * view.k + view.x},${m.y * view.k + view.y})`} style={{ pointerEvents: 'none' }} data-testid="atlas-discovery-pin">
          <path d="M0,-7 L5,0 L0,7 L-5,0 Z" fill="#2dd4bf" stroke="#0f766e" strokeWidth={1.5} />
          {m.label ? (
            <text x={0} y={-10} textAnchor="middle" fontFamily="Georgia, serif" fontSize={11} fill="#0f766e" stroke="#ffffff" strokeWidth={2.5} paintOrder="stroke">{m.label}</text>
          ) : null}
        </g>
      ))}
      {/* Travel route overlays below live in screen space, so harbor markers and
          the destination pin stay readable instead of ballooning with zoom. */}
      {/* Harbor markers live in screen space so embark/disembark points stay
          readable while the player zooms. Each marker uses the shared boundary
          point where one land/sea segment hands off to the next segment. */}
      {multiModalRoute ? multiModalRoute.segments.slice(0, -1).map((segment, index) => {
        const boundary = segment.points[segment.points.length - 1];
        return (
          <g
            key={`harbor${index}`}
            transform={`translate(${boundary[0] * view.k + view.x},${boundary[1] * view.k + view.y})`}
            style={{ pointerEvents: 'none' }}
            data-testid="atlas-harbor-marker"
          >
            <circle r={5} fill="#0ea5e9" stroke="#0f172a" strokeWidth={1.5} />
            <path d="M0,-3 L0,3 M-2.5,0.5 a2.5,2.5 0 0 0 5,0" fill="none" stroke="#e0f2fe" strokeWidth={1} />
          </g>
        );
      }) : null}
      {/* Destination flag for the hovered travel target. */}
      {displayedRoute && displayedRoute.points.length > 1 ? (() => {
        const end = displayedRoute.points[displayedRoute.points.length - 1];
        const c = dangerRating(displayedRoute.danger).color;
        return (
          <g
            transform={`translate(${end[0] * view.k + view.x},${end[1] * view.k + view.y})`}
            style={{ pointerEvents: 'none' }}
            data-testid="atlas-travel-destination"
          >
            {/* target ring centred on the cell */}
            <circle r={9} fill="none" stroke={c} strokeWidth={2} opacity={0.9} />
            <circle r={2} fill={c} />
            {/* flag pole rising from the cell */}
            <line x1={0} y1={0} x2={0} y2={-26} stroke="#0f172a" strokeWidth={2} />
            <path d="M0,-26 L15,-22 L0,-15 Z" fill={c} stroke="#0f172a" strokeWidth={1} strokeLinejoin="round" />
            <text x={0} y={-30} textAnchor="middle" fontFamily="sans-serif" fontSize={10} fontWeight={700} fill="#e2e8f0" stroke="#0f172a" strokeWidth={2.5} paintOrder="stroke">Travel to</text>
          </g>
        );
      })() : null}
      {/* Always-on "you are here" marker (SP0 T7) — screen space, constant size. */}
      {marker ? (
        <g
          transform={`translate(${marker.x * view.k + view.x},${marker.y * view.k + view.y})`}
          style={{ pointerEvents: 'none' }}
          data-testid="atlas-player-marker"
        >
          {/* "Look here!" pulse — an expanding, fading red ring drawn under the
              yellow indicator. Keyed on pulseToken so each trigger remounts the
              SMIL animation and restarts from frame 0. */}
          {pulseActive ? (
            <g key={pulseToken ?? 'pulse'} data-testid="atlas-marker-pulse">
              <circle r={9} fill="none" stroke="#ef4444" strokeWidth={3}>
                <animate attributeName="r" values="9;40" dur="1s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.85;0" dur="1s" repeatCount="indefinite" />
              </circle>
            </g>
          ) : null}
          <circle r={9} fill="none" stroke="#f5c542" strokeWidth={2} opacity={0.9} />
          <circle r={3.5} fill="#f5c542" stroke="#5a3e00" strokeWidth={1} />
        </g>
      ) : null}
      {/* Vignette overlay — screen space, covers the whole viewport. */}
      {visible.vignette ? (
        <rect x={0} y={0} width={width} height={height} fill="url(#atlas-vignette)" style={{ pointerEvents: 'none' }} />
      ) : null}
    </svg>
    {/* Find Me — zoom to the player's current cell (top-left). */}
    {marker ? (
      <button
        type="button"
        onClick={centerOnPlayer}
        title="Zoom to your current location"
        data-testid="atlas-center-player"
        style={{
          position: 'absolute', top: 8, left: 8, fontFamily: 'sans-serif',
          background: 'rgba(15,30,45,0.85)', color: '#f5c542', border: '1px solid #475569',
          borderRadius: 4, minHeight: 44, padding: '8px 12px', fontSize: 12, cursor: 'pointer',
        }}
      >
        ⌖ Find Me
      </button>
    ) : null}
    {/* Provisioning ring legend — labels each resource horizon (food / water) so
        the contours read as "how far my supplies reach", not abstract lines.
        Only shown when rings are drawn (travel mode + a finite supply horizon). */}
    {provisionRingPaths.length > 0 ? (
      <div
        data-testid="atlas-provision-ring-legend"
        style={{
          position: 'absolute', top: marker ? 40 : 8, left: 8, fontFamily: 'sans-serif',
          background: 'rgba(15,30,45,0.85)', border: '1px solid #475569', borderRadius: 4,
          padding: '4px 8px', fontSize: 11, color: '#e2e8f0', pointerEvents: 'none',
          display: 'flex', flexDirection: 'column', gap: 3,
        }}
      >
        {provisionRingPaths.map((ring, idx) => (
          <span key={`prov-legend-${idx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
            <span style={{ width: 14, height: 0, borderTop: `2px solid ${ring.color}`, flex: '0 0 auto' }} />
            <span>{ring.label ?? 'Supply reach'}</span>
          </span>
        ))}
      </div>
    ) : null}
    {/* Travel readout — shows the previewed route's time/distance/danger (bottom-center). */}
    {travelActive && hoveredCell != null ? (
      <div
        data-testid="atlas-travel-readout"
        style={{
          position: 'absolute', bottom: 44, left: '50%', transform: 'translateX(-50%)',
          fontFamily: 'sans-serif', fontSize: 12, whiteSpace: 'nowrap',
          background: 'rgba(15,30,45,0.9)', border: '1px solid #475569', borderRadius: 6,
          padding: '5px 12px', color: '#e2e8f0', pointerEvents: 'none',
        }}
      >
        {multiModalRoute
          ? formatMultiModalSummary(multiModalRoute, { fareGp: ferryFareForRoute ? ferryFareForRoute(multiModalRoute) : null })
          : travelRoute
          ? formatRouteSummary(travelRoute, transportLabel, {
              faintPath: faintPathForRoute ? faintPathForRoute(travelRoute) : false,
              forestName: forestNameForRoute?.(travelRoute) ?? undefined,
              // Both flavor values thread plainly — formatRouteSummary owns
              // the pass-beats-forest one-flavor-clause rule.
              passName: passNameForRoute?.(travelRoute) ?? undefined,
            })
          : <span style={{ color: '#f87171' }}>No route to here</span>}
        {/* Provisions line: how much food/water the trip would cost vs what's
            carried (binding resource labeled). Only when a route is previewed. */}
        {displayedRoute && provisionLineForMinutes ? (() => {
          const prov = provisionLineForMinutes(displayedRoute.minutes);
          return prov ? (
            <div data-testid="atlas-provision-line" style={{ marginTop: 3, color: prov.color, fontWeight: 600 }}>
              {prov.text}
            </div>
          ) : null;
        })() : null}
      </div>
    ) : null}
    {/* Layers panel — owned atlas's equivalent of Azgaar's Layers toggle menu. */}
    <div ref={layersMenuRef} style={{ position: 'absolute', top: 8, right: 8, fontFamily: 'sans-serif' }}>
      <button
        type="button"
        onClick={() => {
          if (!layersOpen) updateLayersViewportMaxHeight();
          setLayersOpen((o) => !o);
        }}
        style={{
          background: 'rgba(15,30,45,0.85)', color: '#e2e8f0', border: '1px solid #475569',
          borderRadius: 4, minHeight: 44, padding: '8px 12px', fontSize: 12, cursor: 'pointer',
        }}
        data-testid="atlas-layers-toggle"
      >
        ☰ Menu
      </button>
      {layersOpen ? (
        <div
          style={{
            ...layersPanelPositionStyle,
            background: 'rgba(15,30,45,0.92)', border: '1px solid #475569',
            borderRadius: 4, padding: '8px 10px', minWidth: 184, maxHeight: layersPanelMaxHeight, overflowY: 'auto',
          }}
          data-testid="atlas-layers-panel"
        >
          {/* Map coloring — exclusive radio. Only one base coloring at a time. */}
          <div style={SECTION_HEADER}>Map coloring</div>
          {AREA_MODES.map((m) => {
            const empty = (layerCounts.area[m.id] ?? Infinity) === 0;
            const selected = mapMode === m.id;
            return (
              <label
                key={m.id}
                title={empty ? `${m.desc} (no data on this map)` : m.desc}
                style={{ ...LAYER_CHOICE_ROW_STYLE, cursor: empty ? 'not-allowed' : 'pointer', color: empty ? '#64748b' : '#e2e8f0' }}
              >
                <input
                  type="radio"
                  name="atlas-map-mode"
                  checked={selected}
                  disabled={empty}
                  onChange={() => setMapMode(m.id)}
                  style={LAYER_CHOICE_INPUT_STYLE}
                />
                <span
                  aria-hidden="true"
                  style={{
                    ...LAYER_CHOICE_MARK_STYLE,
                    borderRadius: 999,
                    borderColor: selected ? '#7dd3fc' : '#94a3b8',
                    boxShadow: selected ? 'inset 0 0 0 4px rgba(15,23,42,0.95)' : undefined,
                    background: selected ? '#38bdf8' : 'rgba(15,23,42,0.9)',
                  }}
                />
                <span style={LAYER_CHOICE_TEXT_STYLE}>{m.label}{empty ? ' — none' : ''}</span>
              </label>
            );
          })}

          {/* Feature toggles, grouped. */}
          {FEATURE_GROUPS.map((group) => (
            <React.Fragment key={group}>
              <div style={{ height: 1, background: '#475569', margin: '7px 0 5px' }} />
              <div style={SECTION_HEADER}>{group}</div>
              {FEATURE_LAYERS.filter((l) => l.group === group).map((layer) => {
                const empty = (layerCounts.feat[layer.id] ?? Infinity) === 0;
                const selected = !!features[layer.id] && !empty;
                return (
                  <label
                    key={layer.id}
                    title={empty ? `${layer.desc} (none on this map)` : layer.desc}
                    style={{ ...LAYER_CHOICE_ROW_STYLE, cursor: empty ? 'not-allowed' : 'pointer', color: empty ? '#64748b' : '#e2e8f0' }}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={empty}
                      onChange={() => toggleFeature(layer.id)}
                      style={LAYER_CHOICE_INPUT_STYLE}
                    />
                    <span
                      aria-hidden="true"
                      style={{
                        ...LAYER_CHOICE_MARK_STYLE,
                        borderRadius: 3,
                        borderColor: selected ? '#7dd3fc' : '#94a3b8',
                        background: selected ? '#38bdf8' : 'rgba(15,23,42,0.9)',
                      }}
                    >
                      {selected ? (
                        <span style={{ display: 'block', color: '#0f172a', fontSize: 12, lineHeight: '14px', textAlign: 'center', fontWeight: 800 }}>✓</span>
                      ) : null}
                    </span>
                    <span style={LAYER_CHOICE_TEXT_STYLE}>{layer.label}{empty ? ' — none' : ''}</span>
                  </label>
                );
              })}
            </React.Fragment>
          ))}

          <div style={{ height: 1, background: '#475569', margin: '7px 0 5px' }} />
          <div style={SECTION_HEADER}>Info panel</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 44, color: '#e2e8f0', fontSize: 12 }}>
            Detail
            <select
              value={infoVerbosity}
              onChange={(e) => setInfoVerbosity(e.target.value as InfoVerbosity)}
              style={{ minHeight: 44, background: '#1e293b', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 4, fontSize: 12, padding: '8px 10px' }}
              data-testid="atlas-info-verbosity"
            >
              {INFO_VERBOSITY_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={resetLayers}
            style={{ marginTop: 8, width: '100%', minHeight: 44, background: '#1e293b', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 4, padding: '8px 10px', fontSize: 12, cursor: 'pointer' }}
            data-testid="atlas-layers-reset"
          >
            ↺ Reset to defaults
          </button>
        </div>
      ) : null}
    </div>
    {/* Legend / active-coloring caption — tells the player what the colors MEAN.
        Bottom-center, clear of Find Me (TL), Layers (TR), cell info (BL). */}
    {activeMode.legend !== 'none' ? (
      <div
        style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15,30,45,0.9)', border: '1px solid #475569', borderRadius: 4,
          padding: '5px 10px', fontFamily: 'sans-serif', fontSize: 11, color: '#e2e8f0',
          pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 8, maxWidth: '78%', flexWrap: 'wrap',
        }}
        data-testid="atlas-legend"
      >
        <span style={{ color: '#94a3b8' }}>Coloring:</span>
        <span style={{ fontWeight: 600 }}>{activeMode.label}</span>
        {activeMode.legend === 'ramp' && activeMode.ramp && activeMode.ends ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>{activeMode.ends[0]}</span>
            <span style={{ width: 80, height: 9, borderRadius: 2, border: '1px solid #334155', background: `linear-gradient(to right, ${activeMode.ramp[0]}, ${activeMode.ramp[1]}, ${activeMode.ramp[2]})` }} />
            <span>{activeMode.ends[1]}</span>
          </span>
        ) : null}
        {activeMode.legend === 'discrete' ? (
          discreteLegend.length > 0 ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }} data-testid="atlas-legend-swatches">
              {discreteLegend.slice(0, LEGEND_SWATCH_CAP).map((e) => (
                <span key={e.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 2, border: '1px solid #1e293b', background: e.color, flex: '0 0 auto' }} />
                  <span style={{ color: '#e2e8f0', whiteSpace: 'nowrap' }}>{e.name}</span>
                </span>
              ))}
              {discreteLegend.length > LEGEND_SWATCH_CAP ? (
                <span style={{ color: '#94a3b8' }}>+{discreteLegend.length - LEGEND_SWATCH_CAP} more</span>
              ) : null}
            </span>
          ) : (
            <span style={{ color: '#cbd5e1' }}>each tint = one {activeMode.noun}</span>
          )
        ) : null}
        {activeMode.legend === 'biomes' ? (
          <span style={{ color: '#cbd5e1' }}>natural terrain type</span>
        ) : null}
      </div>
    ) : null}
    {/* Hover info panel — bottom-left. A hovered settlement glyph shows TOWN info
        (name, tier, state…); otherwise the generic cell readout. */}
    {infoVerbosity !== 'off' && hoveredBurgInfo ? (
      <div
        style={{
          position: 'absolute', bottom: 8, left: 8, maxWidth: 240,
          background: 'rgba(28,20,12,0.92)', border: '1px solid #b3892f', borderRadius: 4,
          padding: '6px 9px', fontFamily: 'sans-serif', fontSize: 12, color: '#f5ecd8',
          pointerEvents: 'none',
        }}
        data-testid="atlas-town-info"
      >
        {renderTownInfo(hoveredBurgInfo, infoVerbosity)}
      </div>
    ) : infoVerbosity !== 'off' && hoveredTraits ? (
      <div
        style={{
          position: 'absolute', bottom: 8, left: 8, maxWidth: 240,
          background: 'rgba(15,30,45,0.9)', border: '1px solid #475569', borderRadius: 4,
          padding: '6px 9px', fontFamily: 'sans-serif', fontSize: 12, color: '#e2e8f0',
          pointerEvents: 'none',
        }}
        data-testid="atlas-cell-info"
      >
        {renderCellInfo(hoveredTraits, infoVerbosity)}
      </div>
    ) : null}
    {/* Pinned town detail card — opens on CLICKING a settlement glyph. Deeper than
        the hover readout and actionable (go here / close). */}
    {selectedBurgInfo ? (
      <div
        style={selectedTownCardStyle}
        data-testid="atlas-town-card"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <strong style={{ fontSize: 14, color: '#fbf3e0' }}>
            {selectedBurgInfo.name ?? selectedBurgInfo.traits?.burg?.name ?? 'Settlement'}
          </strong>
          <button
            type="button"
            onClick={() => setSelectedBurg(null)}
            aria-label="Close town details"
            style={{
              background: 'transparent', border: 'none', color: '#cdb588', cursor: 'pointer',
              fontSize: 16, lineHeight: 1, minWidth: 44, minHeight: 44, padding: 0,
            }}
          >×</button>
        </div>
        {renderTownInfo(selectedBurgInfo, 'full')}
        {onPickCell && selectedBurgInfo.traits ? (
          <button
            type="button"
            onClick={() => {
              if (selectedBurgInfo.traits) onPickCell(selectedBurgInfo.traits);
              setSelectedBurg(null);
            }}
            style={{
              marginTop: 8, width: '100%', minHeight: 44, padding: '8px 12px', cursor: 'pointer',
              background: '#b3892f', border: 'none', borderRadius: 4,
              color: '#1c1409', fontWeight: 700, fontSize: 12,
            }}
          >{travelActive ? 'Travel here →' : 'Go here →'}</button>
        ) : null}
      </div>
    ) : null}
    </div>
  );
};

const TIER_LABEL: Record<BurgTier, string> = { capital: 'Capital', city: 'City', town: 'Town', village: 'Village' };

/** Render the hover info rows for a hovered settlement glyph, gated by verbosity. */
function renderTownInfo(
  info: { tier: BurgTier; capital: boolean; name?: string; traits: CellTraits | null },
  level: InfoVerbosity,
): React.ReactNode {
  const { tier, capital, traits } = info;
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div style={{ display: 'flex', gap: 6, lineHeight: 1.5 }}>
      <span style={{ color: '#cdb588', minWidth: 64 }}>{k}</span>
      <span style={{ color: '#fbf3e0' }}>{v}</span>
    </div>
  );
  const name = info.name ?? traits?.burg?.name ?? 'Settlement';
  const rows: React.ReactNode[] = [];
  rows.push(<Row key="name" k="Town" v={<strong>{name}</strong>} />);
  rows.push(<Row key="type" k="Type" v={capital ? `${TIER_LABEL[tier]} (capital)` : TIER_LABEL[tier]} />);
  if (traits?.state) rows.push(<Row key="state" k={capital ? 'Capital of' : 'State'} v={traits.state} />);
  if (level === 'minimal') return rows;
  if (traits?.culture) rows.push(<Row key="culture" k="Culture" v={traits.culture} />);
  if (traits?.biome) rows.push(<Row key="terrain" k="Terrain" v={traits.biome} />);
  if (level === 'full') {
    if (traits?.province) rows.push(<Row key="prov" k="Province" v={traits.province} />);
    if (traits?.religion) rows.push(<Row key="rel" k="Religion" v={traits.religion} />);
    if (traits?.population != null) rows.push(<Row key="pop" k="Cell pop." v={traits.population.toLocaleString()} />);
  }
  return rows;
}

/** Render the hover info rows for a cell, gated by the verbosity level. */
function renderCellInfo(t: CellTraits, level: InfoVerbosity): React.ReactNode {
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div style={{ display: 'flex', gap: 6, lineHeight: 1.5 }}>
      <span style={{ color: '#94a3b8', minWidth: 64 }}>{k}</span>
      <span style={{ color: '#f1f5f9' }}>{v}</span>
    </div>
  );
  const rows: React.ReactNode[] = [];
  // Headline: the burg if present, else the terrain.
  if (t.burg) rows.push(<Row key="burg" k={t.burg.capital ? 'Capital' : 'Burg'} v={t.burg.name} />);
  rows.push(<Row key="terrain" k="Terrain" v={t.land ? (t.biome ?? 'Land') : 'Ocean'} />);
  if (level === 'minimal') return rows;
  // standard + full
  if (t.state) rows.push(<Row key="state" k="State" v={t.state} />);
  if (t.culture) rows.push(<Row key="culture" k="Culture" v={t.culture} />);
  rows.push(<Row key="elev" k="Elevation" v={`${t.height}${t.land ? '' : ' (sea)'}`} />);
  if (level === 'full') {
    if (t.province) rows.push(<Row key="prov" k="Province" v={t.province} />);
    if (t.religion) rows.push(<Row key="rel" k="Religion" v={t.religion} />);
    if (t.population != null) rows.push(<Row key="pop" k="Population" v={t.population.toLocaleString()} />);
    rows.push(<Row key="cell" k="Cell #" v={t.i} />);
  }
  return rows;
}

export default AtlasSvgView;
