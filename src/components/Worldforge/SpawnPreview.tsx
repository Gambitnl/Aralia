/**
 * @file SpawnPreview.tsx — dedicated preview mode for the reroll→spawn problem.
 *
 * Reachable at `?phase=spawnpreview`. This harness exists to make the "player
 * spawning on an ocean tile" bug reproducible and *visible* in isolation, decoupled
 * from live game state. Each reroll:
 *   1. generates a fresh legacy map (`generateMap`, the same call the game uses),
 *   2. applies the real spawn fix (`applyWfSpawnToMap`: unify biomes → resolve a
 *      land/burg spawn → relocate the player tile), then
 *   3. renders the marker through the EXACT MapPane pipeline — the player's
 *      `isPlayerCurrent` grid tile mapped back through the grid↔atlas bridge to a
 *      Voronoi cell, marker placed at that cell's site — over the real atlas.
 *
 * A readout panel reports the resolved spawn (seed, grid cell, burg, atlas cell,
 * height, biome) and a big PASS/FAIL: FAIL means the rendered marker sits on a
 * water cell (h < 20), i.e. the ocean-spawn bug. A batch iterator runs N rerolls
 * and tallies failures so the invariant can be checked at a glance.
 *
 * `window.__spawnPreview` exposes `reroll(seed?)` and `audit(n)` for headless proof.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AtlasSvgView from './AtlasSvgView';
import { generateMap } from '../../services/mapService';
import { getBridgeAtlas } from '../../systems/worldforge/bridge/legacySubmapBridge';
import { applyWfSpawnToMap } from '../../systems/worldforge/local/resolveSpawn';
import { legacyGridToAtlasCell } from '../../systems/worldforge/local/gridAtlasBridge';
import { wfBiomeIndexToLegacyId } from '../../systems/worldforge/local/wfBiomeToLegacy';
import { MAP_GRID_SIZE } from '../../config/mapConfig';
import { LOCATIONS, STARTING_LOCATION_ID } from '../../data/world/locations';
import { BIOMES } from '../../data/biomes';
import { generateWorldSeed } from '../../utils/random/generateWorldSeed';
import type { MapData } from '../../types';

const LAND_THRESHOLD = 20;
const GRID = { cols: MAP_GRID_SIZE.cols, rows: MAP_GRID_SIZE.rows };

interface SpawnAudit {
  seed: number;
  /** Player grid cell (the relocated `isPlayerCurrent` tile). */
  gridCell: { x: number; y: number };
  burg?: string;
  /** Atlas Voronoi cell the grid cell maps back to (same call as MapPane). */
  atlasCell: number | null;
  /** Height of that atlas cell; >= 20 is land. */
  height: number | null;
  /** Marker position in graph coords (atlas cell site), as MapPane renders it. */
  marker: { x: number; y: number } | null;
  /** Legacy biome stamped on the start tile after unification + relocate. */
  startBiomeId: string;
  /** PASS = marker cell is land AND start biome is passable. */
  land: boolean;
  passableBiome: boolean;
}

/**
 * Run the full fix + the MapPane marker pipeline for one seed. Pure: returns the
 * resolved map, the atlas it was resolved against, and an audit verdict.
 */
function resolveAndAudit(seed: number): { map: MapData; atlas: ReturnType<typeof getBridgeAtlas>; audit: SpawnAudit } {
  const map = generateMap(GRID.rows, GRID.cols, LOCATIONS, BIOMES, seed);
  const spawn = applyWfSpawnToMap(map, seed, GRID, {
    biomeIndexToLegacyId: (idx) => wfBiomeIndexToLegacyId(idx),
    fallbackBiomeId: LOCATIONS[STARTING_LOCATION_ID].biomeId,
    isWalkable: (biomeId) => BIOMES[biomeId]?.passable ?? false,
  });
  // The rendered atlas uses the SAME canonical world MapPane would (`getBridgeAtlas`,
  // i.e. "aralia-<seed>" + the fixed 960×540/10k/continents options), so the marker
  // pipeline below is bit-for-bit what the live World Map computes — and the SAME world
  // `applyWfSpawnToMap` resolved the spawn against (WM1 unification). Auditing against a
  // bare `generateFmgWorld(String(seed))` here would re-introduce the world mismatch the
  // harness is meant to catch.
  const atlas = getBridgeAtlas(seed);

  // ---- Cell-native spawn audit (grid retirement) ----
  // The spawn no longer marks an isPlayerCurrent tile; audit the RESOLVED cell
  // directly. atlasCell is the spawn's own cell; the grid cell + biome come from
  // the resolved spawn, not a mapData.tiles scan.
  const playerCell = spawn.gridCell;
  const atlasCell = spawn.atlasCellId;
  const site = atlasCell >= 0 ? atlas.pack.cells.p?.[atlasCell] : undefined;
  const marker = site ? { x: site[0], y: site[1] } : null;
  const height = atlasCell >= 0 ? atlas.pack.cells.h[atlasCell] : null;
  const startBiomeId = wfBiomeIndexToLegacyId(spawn.biomeIndex) ?? '(none)';

  return {
    map,
    atlas,
    audit: {
      seed,
      gridCell: playerCell ?? spawn.gridCell,
      burg: spawn.burgName,
      atlasCell: atlasCell ?? null,
      height,
      marker,
      startBiomeId,
      land: height != null && height >= LAND_THRESHOLD,
      passableBiome: BIOMES[startBiomeId]?.passable ?? false,
    },
  };
}

const SpawnPreview: React.FC = () => {
  const [seed, setSeed] = useState<number>(() => generateWorldSeed());
  const [seedInput, setSeedInput] = useState<string>(String(seed));
  const [batch, setBatch] = useState<{ total: number; failures: SpawnAudit[] } | null>(null);

  const { atlas, audit } = useMemo(() => resolveAndAudit(seed), [seed]);

  // Size the atlas to fill the map column (AtlasSvgView takes explicit px).
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapSize, setMapSize] = useState({ width: 800, height: 600 });
  useEffect(() => {
    const el = mapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      setMapSize({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    setMapSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const reroll = useCallback((next?: number) => {
    const s = Number.isFinite(next) && (next ?? 0) > 0 ? Math.floor(next as number) : generateWorldSeed();
    setSeed(s);
    setSeedInput(String(s));
    return s;
  }, []);

  const runAudit = useCallback((n: number) => {
    const failures: SpawnAudit[] = [];
    for (let i = 0; i < n; i++) {
      const s = generateWorldSeed();
      const { audit: a } = resolveAndAudit(s);
      if (!a.land || !a.passableBiome) failures.push(a);
    }
    const result = { total: n, failures };
    setBatch(result);
    return result;
  }, []);

  // Headless hook for proof scripts / preview_eval.
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__spawnPreview = { reroll, audit: runAudit, current: () => audit };
    return () => { delete (window as unknown as Record<string, unknown>).__spawnPreview; };
  }, [reroll, runAudit, audit]);

  const pass = audit.land && audit.passableBiome;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#0b1220', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Map */}
      <div ref={mapRef} style={{ flex: 1, position: 'relative', minWidth: 0 }} data-testid="spawn-preview-map">
        <AtlasSvgView atlas={atlas} marker={audit.marker} width={mapSize.width} height={mapSize.height} />
      </div>

      {/* Readout / controls */}
      <aside style={{ width: 360, padding: 20, borderLeft: '1px solid #1e293b', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Spawn-on-Land Preview</h1>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            Reroll the world; the marker uses the exact World&nbsp;Map pipeline. FAIL ⇒ ocean spawn.
          </p>
        </div>

        {/* Verdict */}
        <div
          data-testid="spawn-verdict"
          data-pass={pass ? '1' : '0'}
          style={{
            padding: '12px 16px', borderRadius: 8, fontWeight: 700, fontSize: 16, textAlign: 'center',
            background: pass ? '#064e3b' : '#7f1d1d', color: pass ? '#6ee7b7' : '#fecaca',
            border: `1px solid ${pass ? '#10b981' : '#ef4444'}`,
          }}
        >
          {pass ? '✓ PASS — spawned on land' : '✗ FAIL — spawned on water'}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => reroll()}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 6, background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            🎲 Reroll
          </button>
          <input
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') reroll(Number(seedInput)); }}
            style={{ width: 110, padding: '8px', borderRadius: 6, background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' }}
            placeholder="seed"
          />
          <button
            onClick={() => reroll(Number(seedInput))}
            style={{ padding: '8px 10px', borderRadius: 6, background: '#334155', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            Go
          </button>
        </div>

        {/* Spawn detail */}
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', fontSize: 13, margin: 0 }}>
          <dt style={{ color: '#94a3b8' }}>Seed</dt><dd style={{ margin: 0 }}>{audit.seed}</dd>
          <dt style={{ color: '#94a3b8' }}>Burg</dt><dd style={{ margin: 0 }}>{audit.burg ?? '—'}</dd>
          <dt style={{ color: '#94a3b8' }}>Grid cell</dt><dd style={{ margin: 0 }}>{audit.gridCell.x}, {audit.gridCell.y}</dd>
          <dt style={{ color: '#94a3b8' }}>Atlas cell</dt><dd style={{ margin: 0 }}>{audit.atlasCell ?? '—'}</dd>
          <dt style={{ color: '#94a3b8' }}>Height</dt>
          <dd style={{ margin: 0, color: audit.land ? '#6ee7b7' : '#fecaca' }}>
            {audit.height ?? '—'} {audit.height != null ? (audit.land ? '(land)' : '(water)') : ''}
          </dd>
          <dt style={{ color: '#94a3b8' }}>Start biome</dt>
          <dd style={{ margin: 0, color: audit.passableBiome ? '#6ee7b7' : '#fecaca' }}>
            {audit.startBiomeId} {audit.passableBiome ? '(passable)' : '(blocked)'}
          </dd>
          <dt style={{ color: '#94a3b8' }}>Marker</dt>
          <dd style={{ margin: 0 }}>{audit.marker ? `${audit.marker.x.toFixed(0)}, ${audit.marker.y.toFixed(0)}` : '—'}</dd>
        </dl>

        {/* Batch audit */}
        <div style={{ borderTop: '1px solid #1e293b', paddingTop: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={() => runAudit(25)} style={{ flex: 1, padding: '8px', borderRadius: 6, background: '#0f766e', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              Audit ×25
            </button>
            <button onClick={() => runAudit(200)} style={{ flex: 1, padding: '8px', borderRadius: 6, background: '#0f766e', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              Audit ×200
            </button>
          </div>
          {batch && (
            <div data-testid="spawn-batch" data-failures={batch.failures.length} style={{ fontSize: 13 }}>
              <strong style={{ color: batch.failures.length === 0 ? '#6ee7b7' : '#fecaca' }}>
                {batch.total - batch.failures.length}/{batch.total} landed on land
              </strong>
              {batch.failures.length > 0 && (
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: '#fecaca' }}>
                  {batch.failures.slice(0, 10).map((f) => (
                    <li key={f.seed} style={{ cursor: 'pointer' }} onClick={() => reroll(f.seed)}>
                      seed {f.seed}: {f.startBiomeId} (h={f.height ?? '—'})
                    </li>
                  ))}
                  {batch.failures.length > 10 && <li>…and {batch.failures.length - 10} more</li>}
                </ul>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

export default SpawnPreview;
