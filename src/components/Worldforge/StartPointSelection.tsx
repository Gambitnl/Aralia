// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/07/2026, 14:16:43
 * Dependents: App.tsx, components/DesignPreview/steps/PreviewStartSelect.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file StartPointSelection.tsx — "where will your journey begin?" step.
 *
 * Shown after character creation and before play starts. The player surveys the
 * generated world and chooses a *town* to begin in — the design constraint is
 * that a new game always starts inside a settlement, never open wilderness or
 * (the old bug) an ocean tile. Towns come from the real WF/FMG world
 * (`listSelectableTowns`), grouped by country/region, and the chosen town's
 * `burg.cell` is handed to `applyWfSpawnToMap` so the spawn is exactly where the
 * player pointed.
 *
 * The atlas (left) gives geographic context with a marker on the selected town;
 * clicking the map snaps to the nearest town. The panel (right) lets the player
 * narrow by region and pick a specific town, then confirm.
 *
 * `window.__startSelect` exposes `towns()`, `select(burgIndex)`, `selected()`,
 * and `confirm()` for headless verification.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AtlasSvgView from './AtlasSvgView';
import type { CellTraits } from './atlasSvg';
import type { FmgWorldResult } from '../../systems/worldforge/fmg/generateWorld';
import { getBridgeAtlas } from '../../systems/worldforge/bridge/legacySubmapBridge';
import { listSelectableTowns, groupTownsByState, type SelectableTown } from '../../systems/worldforge/local/startTowns';

export interface StartPointSelectionProps {
  /** Seed of the world the player will begin in (same seed play uses). */
  worldSeed: number;
  /** Called with the chosen town when the player confirms their start. */
  onConfirm: (town: SelectableTown) => void;
  /** Optional: return to character creation / main menu. */
  onBack?: () => void;
  /** Optional hero name for the heading. */
  characterName?: string;
}

const ALL_REGIONS = '__all__';
/** Cap the rendered rows so an unfiltered 700+ town world stays responsive. */
const MAX_VISIBLE_TOWNS = 150;
const COMPACT_LAYOUT_MAX_WIDTH = 640;
/**
 * S3: the world atlas is a fixed 16:9 (960×540) image. The left pane at common
 * desktop sizes (e.g. 1440×900 → ~1060×900) is taller than 16:9, so handing the
 * whole pane to the atlas letterboxes the map and shows large dark-blue bands
 * above/below. Instead we fit a 16:9 box to the pane and let the atlas fill it
 * exactly — no wasted vertical space. Mirrors the world's FMG dimensions.
 */
const MAP_ASPECT = 960 / 540;

function formatPopulation(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

/** Nearest town to a clicked atlas cell, by graph-space distance to its site. */
function nearestTown(
  world: FmgWorldResult,
  towns: SelectableTown[],
  cellIndex: number,
): SelectableTown | null {
  const site = world.pack.cells.p?.[cellIndex];
  if (!site || towns.length === 0) return null;
  let best: SelectableTown | null = null;
  let bestD = Infinity;
  for (const t of towns) {
    const dx = t.x - site[0];
    const dy = t.y - site[1];
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

const StartPointSelection: React.FC<StartPointSelectionProps> = ({ worldSeed, onConfirm, onBack, characterName }) => {
  // WM1: the start-selection world MUST be the SAME world the player plays in.
  // `getBridgeAtlas(worldSeed)` is the single canonical world — the same atlas the
  // in-game MapPane, town tiles, spawn resolver, and 3D bake all consume (seed
  // string "aralia-<seed>" + the fixed 960×540/10k/continents options). Using the
  // bare `generateFmgWorld(String(seed))` here produced a DIFFERENT world, so the
  // town the player picked did not exist in the world they spawned into.
  const world = useMemo(() => getBridgeAtlas(worldSeed), [worldSeed]);
  const towns = useMemo(() => listSelectableTowns(world), [world]);
  const regions = useMemo(() => groupTownsByState(towns), [towns]);

  const [regionFilter, setRegionFilter] = useState<string>(ALL_REGIONS);
  const [search, setSearch] = useState<string>('');
  const [townPage, setTownPage] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(() => towns[0]?.burgIndex ?? null);
  const [isCompactLayout, setIsCompactLayout] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < COMPACT_LAYOUT_MAX_WIDTH : false,
  );

  useEffect(() => {
    // The start picker combines map context and town decision controls. On
    // cramped viewports, stack them so the fixed-width panel does not shove the
    // map into a competing sliver beside the form.
    const updateLayout = () => setIsCompactLayout(window.innerWidth < COMPACT_LAYOUT_MAX_WIDTH);
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  // Bumped to fire the map's "look here!" pulse around the selected town. The
  // tiny yellow marker is hard to spot on a fully zoomed-out world, so we pulse
  // it whenever the selection changes (default mount, list/map click, surprise)
  // and on demand via the Highlight button.
  const [pulseToken, setPulseToken] = useState(0);
  const triggerPulse = useCallback(() => setPulseToken((t) => t + 1), []);
  useEffect(() => {
    if (selectedIndex == null) return;
    setPulseToken((t) => t + 1);
  }, [selectedIndex]);

  // A world can have 700+ towns, so the list is filtered by both the region
  // dropdown and a free-text name search (either town or region name).
  const visibleTowns = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = towns;
    if (regionFilter !== ALL_REGIONS) {
      const idx = Number(regionFilter);
      list = list.filter((t) => t.stateIndex === idx);
    }
    if (q) list = list.filter((t) => t.name.toLowerCase().includes(q) || t.stateName.toLowerCase().includes(q));
    return list;
  }, [towns, regionFilter, search]);

  const selectTown = useCallback((town: SelectableTown | null) => {
    if (town) setSelectedIndex(town.burgIndex);
  }, []);

  // A11y (GG-40): the town list is a single ARIA listbox — one tab stop with
  // roving `aria-activedescendant`, not hundreds of sibling buttons — so the
  // start-selection accessibility tree stays bounded regardless of world size.
  // Search results remain complete through fixed-size pages: broad queries do
  // not recreate an 888-option tree, while exact towns remain reachable.
  const townPageCount = Math.max(1, Math.ceil(visibleTowns.length / MAX_VISIBLE_TOWNS));
  const safeTownPage = Math.min(townPage, townPageCount - 1);
  const renderedTowns = useMemo(
    () => visibleTowns.slice(
      safeTownPage * MAX_VISIBLE_TOWNS,
      (safeTownPage + 1) * MAX_VISIBLE_TOWNS,
    ),
    [visibleTowns, safeTownPage],
  );
  const renderedRangeStart = visibleTowns.length === 0 ? 0 : safeTownPage * MAX_VISIBLE_TOWNS + 1;
  const renderedRangeEnd = Math.min((safeTownPage + 1) * MAX_VISIBLE_TOWNS, visibleTowns.length);

  // A filtered or paged list must never retain a hidden active town. Without
  // this guard, Enter could confirm the pre-filter selection even though no
  // option in the current results represented it.
  const activeTown = useMemo(
    () => renderedTowns.find((town) => town.burgIndex === selectedIndex) ?? null,
    [renderedTowns, selectedIndex],
  );
  useEffect(() => {
    if (activeTown) return;
    setSelectedIndex(renderedTowns[0]?.burgIndex ?? null);
  }, [activeTown, renderedTowns]);

  const confirm = useCallback(() => {
    if (activeTown) onConfirm(activeTown);
  }, [activeTown, onConfirm]);

  const listRef = useRef<HTMLDivElement>(null);
  const activeOptionId = useMemo(
    () =>
      activeTown
        ? `start-town-opt-${selectedIndex}`
        : undefined,
    [selectedIndex, activeTown],
  );

  const showTownPage = useCallback((nextPage: number) => {
    const boundedPage = Math.max(0, Math.min(townPageCount - 1, nextPage));
    const firstTown = visibleTowns[boundedPage * MAX_VISIBLE_TOWNS] ?? null;
    setTownPage(boundedPage);
    setSelectedIndex(firstTown?.burgIndex ?? null);
    triggerPulse();
    requestAnimationFrame(() => listRef.current?.focus());
  }, [townPageCount, visibleTowns, triggerPulse]);

  // Move the active option within the rendered list and keep it scrolled into view.
  const moveActive = useCallback((delta: number) => {
    setSelectedIndex((cur) => {
      const list = renderedTowns;
      if (list.length === 0) return cur;
      const curPos = list.findIndex((t) => t.burgIndex === cur);
      const nextPos = curPos < 0
        ? (delta > 0 ? 0 : list.length - 1)
        : Math.max(0, Math.min(list.length - 1, curPos + delta));
      const town = list[nextPos];
      requestAnimationFrame(() => {
        listRef.current
          ?.querySelector(`#start-town-opt-${town.burgIndex}`)
          ?.scrollIntoView({ block: 'nearest' });
      });
      return town.burgIndex;
    });
    triggerPulse();
  }, [renderedTowns, triggerPulse]);

  const handleListKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); moveActive(1); break;
      case 'ArrowUp': e.preventDefault(); moveActive(-1); break;
      case 'Home': e.preventDefault(); moveActive(-renderedTowns.length); break;
      case 'End': e.preventDefault(); moveActive(renderedTowns.length); break;
      case 'Enter':
      case ' ': e.preventDefault(); confirm(); break;
      default: break;
    }
  }, [moveActive, renderedTowns.length, confirm]);

  // Quick-start: select a random town (clearing the filters so it's visible) —
  // the explicit, in-fiction equivalent of "just drop me somewhere sensible".
  const surpriseMe = useCallback(() => {
    if (towns.length === 0) return;
    const pick = towns[Math.floor(Math.random() * towns.length)];
    setSearch('');
    setRegionFilter(ALL_REGIONS);
    setTownPage(Math.floor(towns.findIndex((town) => town.burgIndex === pick.burgIndex) / MAX_VISIBLE_TOWNS));
    setSelectedIndex(pick.burgIndex);
  }, [towns]);

  const handlePickCell = useCallback((info: CellTraits) => {
    const town = nearestTown(world, towns, info.i);
    if (town) {
      // Map picking is an explicit change of context. Clear both filters and
      // open the exact catalogue page so the picked town is also the visible,
      // confirmable listbox option.
      setSearch('');
      setRegionFilter(ALL_REGIONS);
      setTownPage(Math.floor(towns.findIndex((entry) => entry.burgIndex === town.burgIndex) / MAX_VISIBLE_TOWNS));
      setSelectedIndex(town.burgIndex);
    }
  }, [world, towns]);

  // Size the atlas to a 16:9 box fitted inside its column (S3: no letterbox).
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapSize, setMapSize] = useState({ width: 800, height: 450 });
  useEffect(() => {
    const el = mapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // Ignore zero-size measurements (pre-layout): passing width/height 0 to the
    // atlas yields a degenerate fit (k = 0/0 = NaN) for a frame.
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      // Fit the map's 16:9 aspect inside the available pane: constrain by
      // whichever axis is the tighter fit so the atlas fills its box edge-to-edge
      // with no dark letterbox margins. The pane itself centers the box.
      const fitW = Math.min(w, h * MAP_ASPECT);
      const fitH = fitW / MAP_ASPECT;
      setMapSize({ width: Math.round(fitW), height: Math.round(fitH) });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  // Headless hook for proof scripts / preview_eval.
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__startSelect = {
      towns: () => towns,
      regions: () => regions,
      select: (burgIndex: number) => setSelectedIndex(burgIndex),
      selected: () => activeTown,
      surpriseMe,
      highlight: triggerPulse,
      confirm,
    };
    return () => { delete (window as unknown as Record<string, unknown>).__startSelect; };
  }, [towns, regions, activeTown, surpriseMe, triggerPulse, confirm]);

  // The atlas already renders every town via its always-on burgs + labels layers,
  // so we only mark the *selected* town here (extra pins for all 700+ towns would
  // just clutter the map and cost render time).
  const marker = activeTown ? { x: activeTown.x, y: activeTown.y } : null;

  // The atlas is a very heavy SVG. Memoize the element so typing in search,
  // changing the region filter, or scrolling the 700+ town list doesn't re-render
  // it — only an actual world/marker/size change does.
  const markerKey = marker ? `${marker.x},${marker.y}` : 'none';
  const atlasElement = useMemo(() => (
    <AtlasSvgView
      atlas={world}
      marker={marker}
      pulseToken={pulseToken}
      width={mapSize.width}
      height={mapSize.height}
      onPickCell={handlePickCell}
      prefsScope={worldSeed}
    />
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [world, markerKey, mapSize.width, mapSize.height, handlePickCell, pulseToken, worldSeed]);

  const rootStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: isCompactLayout ? 'column' : 'row',
    height: '100vh',
    width: '100vw',
    background: '#0b1220',
    color: '#e2e8f0',
    fontFamily: 'system-ui, sans-serif',
  };

  const mapPaneStyle: React.CSSProperties = isCompactLayout
    ? {
        flex: '0 0 32vh',
        minHeight: 160,
        maxHeight: 220,
        width: '100%',
        position: 'relative',
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: '1px solid #1e293b',
      }
    : {
        flex: 1,
        position: 'relative',
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      };

  const panelStyle: React.CSSProperties = {
    width: isCompactLayout ? '100%' : 380,
    flex: isCompactLayout ? '1 1 auto' : undefined,
    minHeight: isCompactLayout ? 0 : undefined,
    padding: isCompactLayout ? 16 : '16px 20px',
    borderLeft: isCompactLayout ? 'none' : '1px solid #1e293b',
    borderTop: isCompactLayout ? '1px solid #1e293b' : 'none',
    // Desktop: the panel itself does NOT scroll — the town list (the primary
    // decision surface) flex-grows and scrolls internally, so it stays the
    // dominant element instead of one keyhole competing with the whole form.
    // Compact: keep the whole panel scrollable since it stacks under the map.
    overflowY: isCompactLayout ? 'auto' : 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  };

  return (
    <div data-testid="start-select-layout" style={rootStyle}>
      {/* S2: inline styles can't express :hover, so a scoped rule gives
          non-selected rows a clear hover state for legibility/affordance. */}
      <style>{`
        [data-testid="start-town-row"][data-selected="0"]:hover {
          background: #16233b !important;
          color: #ffffff !important;
        }
      `}</style>
      {/* Atlas — the 16:9 map box is centered in the pane so the atlas fills it
          edge-to-edge instead of letterboxing with dark-blue margins (S3). */}
      <div
        ref={mapRef}
        style={mapPaneStyle}
        data-testid="start-select-map"
      >
        <div style={{ width: mapSize.width, height: mapSize.height, position: 'relative' }} data-testid="start-select-map-box">
          {atlasElement}
        </div>
      </div>

      {/* Selection panel */}
      <aside data-testid="start-select-panel" style={panelStyle}>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>Choose your starting town</h1>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 3, marginBottom: 0 }}>
            {characterName ? `Where will ${characterName}'s journey begin?` : 'Where will your journey begin?'}
            {' '}Click the map or pick a town below.
          </p>
        </div>

        {/* Name search */}
        <label
          htmlFor="start-town-search"
          style={{ fontSize: 12, color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: 4 }}
        >
          Search towns or regions
          <input
            id="start-town-search"
            data-testid="start-search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setTownPage(0); }}
            aria-describedby="start-town-results"
            style={{ minHeight: 44, boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6, background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' }}
          />
        </label>

        {/* Region filter */}
        <label style={{ fontSize: 12, color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: 4 }}>
          Region
          <select
            data-testid="start-region-filter"
            value={regionFilter}
            onChange={(e) => { setRegionFilter(e.target.value); setTownPage(0); }}
            style={{ minHeight: 44, boxSizing: 'border-box', padding: '8px', borderRadius: 6, background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' }}
          >
            <option value={ALL_REGIONS}>All regions ({towns.length} towns)</option>
            {regions.map((r) => (
              <option key={r.stateIndex} value={String(r.stateIndex)}>
                {r.stateName} ({r.towns.length})
              </option>
            ))}
          </select>
        </label>

        {/* Marker legend (S2): the ★/⚓ icons in the town rows are otherwise
            unexplained — ★ for capitals, ⚓ for coastal ports. */}
        <div
          data-testid="start-marker-legend"
          style={{ display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8', alignItems: 'center', marginTop: -4 }}
        >
          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ color: '#fbbf24', fontSize: 16, lineHeight: 1 }}>★</span> capital
          </span>
          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ color: '#7dd3fc', fontSize: 16, lineHeight: 1 }}>⚓</span> port
          </span>
        </div>

        <p
          id="start-town-results"
          data-testid="start-town-results"
          role="status"
          aria-live="polite"
          style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}
        >
          {visibleTowns.length === 0
            ? 'No matching towns.'
            : `Showing towns ${renderedRangeStart} to ${renderedRangeEnd} of ${visibleTowns.length}. Page ${safeTownPage + 1} of ${townPageCount}.`}
        </p>

        {/* Town list — one ARIA listbox (bounded a11y tree; GG-40) */}
        <div
          ref={listRef}
          data-testid="start-town-list"
          role="listbox"
          aria-label={`Selectable towns, ${visibleTowns.length} result${visibleTowns.length === 1 ? '' : 's'}, page ${safeTownPage + 1} of ${townPageCount}`}
          aria-describedby="start-town-results"
          aria-activedescendant={activeOptionId}
          tabIndex={0}
          onKeyDown={handleListKeyDown}
          style={{
            order: isCompactLayout ? 2 : undefined,
            flex: 1,
            // Desktop: minHeight 0 lets the list flex-grow to fill the panel and
            // scroll its own overflow (many more rows visible). Compact keeps a
            // usable floor so the stacked list never collapses to nothing.
            minHeight: isCompactLayout ? 220 : 0,
            overflowY: 'auto',
            border: '1px solid #334155',
            borderRadius: 8,
            background: '#0b1424',
          }}
        >
          {visibleTowns.length === 0 && (
            <p style={{ padding: 12, fontSize: 13, color: '#94a3b8', margin: 0 }}>No towns in this region.</p>
          )}
          {renderedTowns.map((t) => {
            const isSel = t.burgIndex === selectedIndex;
            return (
              <button
                key={t.burgIndex}
                id={`start-town-opt-${t.burgIndex}`}
                data-testid="start-town-row"
                data-selected={isSel ? '1' : '0'}
                role="option"
                aria-selected={isSel}
                tabIndex={-1}
                onClick={() => { selectTown(t); triggerPulse(); }}
                onDoubleClick={() => { selectTown(t); onConfirm(t); }}
                style={{
                  width: '100%', minHeight: 44, textAlign: 'left', padding: '9px 12px', border: 'none', cursor: 'pointer',
                  // S2: non-selected rows were dim gray (#cbd5e1) — brighter text
                  // (#f1f5f9) reads clearly on the dark list; the selected row keeps
                  // its blue highlight. A stronger divider separates each row.
                  background: isSel ? '#1d4ed8' : 'transparent', color: isSel ? '#ffffff' : '#f1f5f9',
                  fontSize: 14,
                  borderBottom: '1px solid #24334d', display: 'flex', justifyContent: 'space-between', gap: 8,
                }}
              >
                <span style={{ display: 'flex', gap: 7, alignItems: 'center', minWidth: 0 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                  {/* S3: tier icons were tiny — larger, colored glyphs read at a glance. */}
                  {t.isCapital && <span title="Capital" aria-hidden style={{ fontSize: 16, lineHeight: 1, color: isSel ? '#fde68a' : '#fbbf24' }}>★</span>}
                  {t.isPort && <span title="Port" aria-hidden style={{ fontSize: 16, lineHeight: 1, color: isSel ? '#bae6fd' : '#7dd3fc' }}>⚓</span>}
                </span>
                <span style={{ color: isSel ? '#dbeafe' : '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {formatPopulation(t.population)}
                </span>
              </button>
            );
          })}
        </div>

        {townPageCount > 1 && (
          <nav
            data-testid="start-town-pagination"
            aria-label="Town result pages"
            style={{ order: isCompactLayout ? 2 : undefined, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
          >
            <button
              type="button"
              onClick={() => showTownPage(safeTownPage - 1)}
              disabled={safeTownPage === 0}
              style={{ minHeight: 44, padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', background: '#1e293b', color: '#f1f5f9' }}
            >
              Previous towns
            </button>
            <span aria-hidden style={{ color: '#94a3b8', fontSize: 12 }}>
              {safeTownPage + 1} of {townPageCount}
            </span>
            <button
              type="button"
              onClick={() => showTownPage(safeTownPage + 1)}
              disabled={safeTownPage >= townPageCount - 1}
              style={{ minHeight: 44, padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', background: '#1e293b', color: '#f1f5f9' }}
            >
              Next towns
            </button>
          </nav>
        )}

        {/* Selected town detail — compact single row so the town LIST above stays
            the dominant surface (name + region/pop on the left, Highlight on the
            right) instead of a tall card eating the panel. */}
        {activeTown && (
          <div
            data-testid="start-selected-detail"
            style={{
              order: isCompactLayout ? 3 : undefined, background: '#0f172a', border: '1px solid #1e293b',
              borderRadius: 8, padding: '8px 12px', fontSize: 13, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeTown.name}
                {activeTown.isCapital && <span style={{ color: '#fbbf24', marginLeft: 6, fontSize: 12 }}>★ capital</span>}
              </div>
              <div style={{ color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeTown.stateName} · {formatPopulation(activeTown.population)} inhabitants{activeTown.isPort ? ' · port' : ''}
              </div>
            </div>
            <button
              data-testid="start-highlight"
              onClick={triggerPulse}
              title="Flash this town's location on the map"
              style={{
                flexShrink: 0, minHeight: 44, padding: '8px 10px', borderRadius: 6, border: '1px solid #7f1d1d',
                background: '#1f2937', color: '#fca5a5', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
              }}
            >
              ◎ Highlight
            </button>
          </div>
        )}

        {/* Actions */}
        <div
          data-testid="start-action-bar"
          style={{
            display: isCompactLayout ? 'grid' : 'flex',
            gap: 8,
            gridTemplateColumns: isCompactLayout ? (onBack ? 'minmax(0, 1fr) minmax(0, 1fr)' : '1fr') : undefined,
            // On phone-width layouts, place the real "begin here" decision
            // above the long town list so it stays visible without covering
            // town rows. Desktop keeps the natural bottom-of-panel order.
            order: isCompactLayout ? 1 : undefined,
            zIndex: isCompactLayout ? 2 : undefined,
            paddingTop: isCompactLayout ? 8 : undefined,
            background: isCompactLayout ? '#0b1220' : undefined,
            borderTop: isCompactLayout ? '1px solid #1e293b' : undefined,
          }}
        >
          {onBack && (
            <button
              onClick={onBack}
              style={{ minHeight: 44, padding: isCompactLayout ? '8px 10px' : '10px 14px', borderRadius: 6, background: '#334155', color: 'white', border: 'none', cursor: 'pointer', minWidth: 0 }}
            >
              Back
            </button>
          )}
          <button
            data-testid="start-surprise"
            onClick={surpriseMe}
            title="Pick a random town"
            style={{ minHeight: 44, padding: isCompactLayout ? '8px 10px' : '10px 14px', borderRadius: 6, background: '#334155', color: 'white', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', minWidth: 0 }}
          >
            🎲 Surprise me
          </button>
          <button
            data-testid="start-confirm"
            onClick={confirm}
            disabled={!activeTown}
            style={{
              flex: 1, minHeight: 44, padding: isCompactLayout ? '8px 10px' : '10px 14px', borderRadius: 6, border: 'none', fontWeight: 700,
              background: activeTown ? '#16a34a' : '#1e293b', color: activeTown ? 'white' : '#64748b',
              cursor: activeTown ? 'pointer' : 'not-allowed',
              gridColumn: isCompactLayout ? '1 / -1' : undefined,
              gridRow: isCompactLayout ? 1 : undefined,
              minWidth: 0,
            }}
          >
            {activeTown ? `Begin in ${activeTown.name} →` : 'Select a town'}
          </button>
        </div>
      </aside>
    </div>
  );
};

export default StartPointSelection;
