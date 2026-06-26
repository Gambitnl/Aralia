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
import { generateFmgWorld } from '../../systems/worldforge/fmg/generateWorld';
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

function formatPopulation(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

/** Nearest town to a clicked atlas cell, by graph-space distance to its site. */
function nearestTown(
  world: ReturnType<typeof generateFmgWorld>,
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
  const world = useMemo(() => generateFmgWorld(String(worldSeed)), [worldSeed]);
  const towns = useMemo(() => listSelectableTowns(world), [world]);
  const regions = useMemo(() => groupTownsByState(towns), [towns]);

  const [regionFilter, setRegionFilter] = useState<string>(ALL_REGIONS);
  const [search, setSearch] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(() => towns[0]?.burgIndex ?? null);

  const selected = useMemo(
    () => towns.find((t) => t.burgIndex === selectedIndex) ?? null,
    [towns, selectedIndex],
  );

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

  const confirm = useCallback(() => {
    if (selected) onConfirm(selected);
  }, [selected, onConfirm]);

  // Quick-start: select a random town (clearing the filters so it's visible) —
  // the explicit, in-fiction equivalent of "just drop me somewhere sensible".
  const surpriseMe = useCallback(() => {
    if (towns.length === 0) return;
    const pick = towns[Math.floor(Math.random() * towns.length)];
    setSearch('');
    setRegionFilter(ALL_REGIONS);
    setSelectedIndex(pick.burgIndex);
  }, [towns]);

  const handlePickCell = useCallback((info: CellTraits) => {
    const town = nearestTown(world, towns, info.i);
    if (town) {
      setSelectedIndex(town.burgIndex);
      // If the snapped town is outside the active region filter, widen to All so
      // the selection is visible in the list.
      setRegionFilter((cur) => (cur !== ALL_REGIONS && Number(cur) !== town.stateIndex ? ALL_REGIONS : cur));
    }
  }, [world, towns]);

  // Size the atlas to fill its column.
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapSize, setMapSize] = useState({ width: 800, height: 600 });
  useEffect(() => {
    const el = mapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // Ignore zero-size measurements (pre-layout): passing width/height 0 to the
    // atlas yields a degenerate fit (k = 0/0 = NaN) for a frame.
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (w > 0 && h > 0) setMapSize({ width: w, height: h });
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
      selected: () => selected,
      surpriseMe,
      confirm,
    };
    return () => { delete (window as unknown as Record<string, unknown>).__startSelect; };
  }, [towns, regions, selected, surpriseMe, confirm]);

  // The atlas already renders every town via its always-on burgs + labels layers,
  // so we only mark the *selected* town here (extra pins for all 700+ towns would
  // just clutter the map and cost render time).
  const marker = selected ? { x: selected.x, y: selected.y } : null;

  // The atlas is a very heavy SVG. Memoize the element so typing in search,
  // changing the region filter, or scrolling the 700+ town list doesn't re-render
  // it — only an actual world/marker/size change does.
  const markerKey = marker ? `${marker.x},${marker.y}` : 'none';
  const atlasElement = useMemo(() => (
    <AtlasSvgView
      atlas={world}
      marker={marker}
      width={mapSize.width}
      height={mapSize.height}
      onPickCell={handlePickCell}
    />
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [world, markerKey, mapSize.width, mapSize.height, handlePickCell]);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#0b1220', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Atlas */}
      <div ref={mapRef} style={{ flex: 1, position: 'relative', minWidth: 0 }} data-testid="start-select-map">
        {atlasElement}
      </div>

      {/* Selection panel */}
      <aside style={{ width: 380, padding: 20, borderLeft: '1px solid #1e293b', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Choose your starting town</h1>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            {characterName ? `Where will ${characterName}'s journey begin?` : 'Where will your journey begin?'}
            {' '}Click a town on the map or pick one below. You always begin inside a settlement.
          </p>
        </div>

        {/* Name search */}
        <input
          data-testid="start-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search towns or regions…"
          style={{ padding: '8px 10px', borderRadius: 6, background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' }}
        />

        {/* Region filter */}
        <label style={{ fontSize: 12, color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: 4 }}>
          Region
          <select
            data-testid="start-region-filter"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            style={{ padding: '8px', borderRadius: 6, background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' }}
          >
            <option value={ALL_REGIONS}>All regions ({towns.length} towns)</option>
            {regions.map((r) => (
              <option key={r.stateIndex} value={String(r.stateIndex)}>
                {r.stateName} ({r.towns.length})
              </option>
            ))}
          </select>
        </label>

        {/* Town list */}
        <div data-testid="start-town-list" style={{ flex: 1, minHeight: 120, overflowY: 'auto', border: '1px solid #1e293b', borderRadius: 8 }}>
          {visibleTowns.length === 0 && (
            <p style={{ padding: 12, fontSize: 13, color: '#94a3b8', margin: 0 }}>No towns in this region.</p>
          )}
          {visibleTowns.slice(0, MAX_VISIBLE_TOWNS).map((t) => {
            const isSel = t.burgIndex === selectedIndex;
            return (
              <button
                key={t.burgIndex}
                data-testid="start-town-row"
                data-selected={isSel ? '1' : '0'}
                onClick={() => selectTown(t)}
                onDoubleClick={() => { selectTown(t); onConfirm(t); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', cursor: 'pointer',
                  background: isSel ? '#1d4ed8' : 'transparent', color: isSel ? 'white' : '#cbd5e1',
                  borderBottom: '1px solid #14203a', display: 'flex', justifyContent: 'space-between', gap: 8,
                }}
              >
                <span style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                  {t.isCapital && <span title="Capital">★</span>}
                  {t.isPort && <span title="Port">⚓</span>}
                </span>
                <span style={{ color: isSel ? '#dbeafe' : '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {formatPopulation(t.population)}
                </span>
              </button>
            );
          })}
          {visibleTowns.length > MAX_VISIBLE_TOWNS && (
            <p data-testid="start-town-overflow" style={{ padding: '8px 12px', fontSize: 12, color: '#64748b', margin: 0 }}>
              Showing {MAX_VISIBLE_TOWNS} of {visibleTowns.length}. Search or pick a region to narrow.
            </p>
          )}
        </div>

        {/* Selected town detail */}
        {selected && (
          <div data-testid="start-selected-detail" style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 12, fontSize: 13 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              {selected.name}
              {selected.isCapital && <span style={{ color: '#fbbf24', marginLeft: 6 }}>★ capital</span>}
            </div>
            <div style={{ color: '#94a3b8' }}>{selected.stateName}</div>
            <div style={{ color: '#94a3b8' }}>
              {formatPopulation(selected.population)} inhabitants{selected.isPort ? ' · coastal port' : ''}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{ padding: '10px 14px', borderRadius: 6, background: '#334155', color: 'white', border: 'none', cursor: 'pointer' }}
            >
              Back
            </button>
          )}
          <button
            data-testid="start-surprise"
            onClick={surpriseMe}
            title="Pick a random town"
            style={{ padding: '10px 14px', borderRadius: 6, background: '#334155', color: 'white', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            🎲 Surprise me
          </button>
          <button
            data-testid="start-confirm"
            onClick={confirm}
            disabled={!selected}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 6, border: 'none', fontWeight: 700,
              background: selected ? '#16a34a' : '#1e293b', color: selected ? 'white' : '#64748b',
              cursor: selected ? 'pointer' : 'not-allowed',
            }}
          >
            {selected ? `Begin in ${selected.name} →` : 'Select a town'}
          </button>
        </div>
      </aside>
    </div>
  );
};

export default StartPointSelection;
