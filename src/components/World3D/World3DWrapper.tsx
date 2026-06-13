/**
 * @file src/components/World3D/World3DWrapper.tsx
 * Wraps World3DScene and connects the camera position to game state dispatch.
 *
 * Responsibilities:
 * 1. Renders World3DScene with the correct loader and start position
 * 2. Listens to camera position changes and dispatches SET_PLAYER_WORLD_POS
 * 3. Resolves terrain height (Y) from WorldData during position updates
 * 4. Throttles position dispatches to ~10Hz to avoid dispatch spam
 * 5. Renders InWorldHUD overlay (control panel, view-mode toggle, debug)
 * 6. Builds a worker-backed ChunkLoader for PLAYING (W3DUI-1) so mesh work stays off the main thread
 *
 * Sandbox `World3DDemo` still uses an inline loader; only this PLAYING wrapper uses the worker path.
 */

import React, { useCallback, useRef, useMemo, useState, useEffect } from 'react';
import World3DScene from './World3DScene';
import InWorldHUD from './InWorldHUD';
import { createWorkerChunkLoader, type DisposableChunkLoader } from './createWorkerChunkLoader';
import { usePlayerWorldPos, useWorldViewMode } from '../../hooks/useWorldViewMode';
import { getTerrainHeight, gridWorldDimensions } from '../../utils/worldCoords';
import { useGameState } from '../../state/GameContext';
import { GamePhase } from '../../types/core';
import type { WorldData } from '../../services/worldSim/types';
import type { PlayerWorldPosition } from '../../types';
import { WORLD3D_CONFIG, heightToMeters } from '../../systems/world3d/config';
import { POSITION_DISPATCH_INTERVAL_MS } from './transitionTiming';
// The worldforge bridge modules pull the entire FMG generation stack —
// they are DYNAMICALLY imported inside the ground branch below so PLAYING's
// initial chunk (and the unit-test module graph) never pays for them; the
// same reason AtlasDemo is lazy. Only types may be imported statically.
import type { WorldDelta } from '../../systems/worldforge/delta/types';
import { LOCATIONS } from '../../data/world/locations';

// PLAYING's 3D view enters the Worldforge ground world (walking scale,
// interiors, occupants) at the party/clicked tile BY DEFAULT — the legacy
// continent streamer (km-scale smooth pyramids, lattice-banded tree rows)
// is what Remy's 2026-06-12 atlas→Enter-3D review rejected; SPEC decision:
// replace legacy aggressively. ?wf_legacy=1 keeps the old streamer for
// comparison. Optional ?wf_tile=x,y overrides the entry tile; ?wf_seed=
// pins the world; ?wf_town=1 auto-picks the nearest burg-bearing tile.
//
// IMPORTANT: this module is LAZY-loaded — by the time Enter 3D mounts it,
// useHistorySync has already REWRITTEN the URL (?phase=playing...) and the
// wf_ params are gone from location.search. The navigation timing entry
// preserves the URL the document was actually loaded with, so flags read
// from there survive the rewrite. Current search wins when present (so
// hand-editing the URL mid-session still works).
function wfParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  const current = new URLSearchParams(window.location.search).get(name);
  if (current !== null) return current;
  try {
    const nav = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (nav?.name) return new URL(nav.name).searchParams.get(name);
  } catch {
    /* fall through */
  }
  return null;
}
const WF_GROUND = wfParam('wf_legacy') !== '1';
const WF_TILE: { x: number; y: number } | null = (() => {
  const raw = wfParam('wf_tile');
  if (!raw) return null;
  const [x, y] = raw.split(',').map(Number);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
})();
const WF_SEED: number | null = (() => {
  const raw = wfParam('wf_seed');
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : null;
})();
const WF_TOWN = wfParam('wf_town') === '1';

interface World3DWrapperProps {
  /** Initial world position to start at. */
  entryPosition: { x: number; y: number; z: number };
  /** WorldData for terrain height lookup and chunk loading. */
  worldData: WorldData | null;
}

/** Throttle interval in ms (~10Hz) — see transitionTiming.ts for perf budget. */
const DISPATCH_INTERVAL_MS = POSITION_DISPATCH_INTERVAL_MS;

/** FPS sampling window in ms. */
const FPS_SAMPLE_MS = 1000;

const World3DWrapper: React.FC<World3DWrapperProps> = ({ entryPosition, worldData }) => {
  const { dispatch, state } = useGameState();
  const { setPosition, position } = usePlayerWorldPos();
  const { setMode } = useWorldViewMode();
  const isDevModeEnabled = state.isDevModeEnabled ?? false;

  // Worker-backed loader for PLAYING — keeps chunk mesh generation off the main thread.
  // Created and disposed inside ONE effect (the React-correct disposable-resource pattern): under
  // StrictMode's dev double-mount (setup → cleanup → setup) each setup builds a fresh loader+worker
  // and each cleanup disposes the very instance it built, so the committed tree always holds a LIVE
  // worker. The previous render-phase `useMemo` + out-of-band worker termination left the chunk
  // streamer bound to a worker that StrictMode had already terminated → it posted forever to a dead
  // worker and never loaded a chunk (the empty/flat 3D world). See createWorkerChunkLoader.
  const [loader, setLoader] = useState<DisposableChunkLoader | undefined>(undefined);
  // Set when WF_GROUND succeeds: walking-scale spawn + camera profile +
  // the resolved tile (the unit-scope for persisted ground positions).
  const [wfGroundView, setWfGroundView] = useState<{
    start: readonly [number, number, number];
    surfaceY: number;
    tile: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let activeCleanup: (() => void) | null = null;

    // Legacy continent path: synchronous, unchanged behavior.
    const startLegacy = (): (() => void) | null => {
      setWfGroundView(null);
      if (!worldData) {
        setLoader(undefined);
        return null;
      }
      const built = createWorkerChunkLoader(
        worldData,
        WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION,
        () => new Worker(new URL('./chunkWorker.ts', import.meta.url), { type: 'module' }),
      );
      setLoader(() => built);
      return () => {
        built.dispose();
        setLoader(undefined);
      };
    };

    if (!WF_GROUND) {
      activeCleanup = startLegacy();
      return () => {
        cancelled = true;
        activeCleanup?.();
      };
    }

    // Worldforge ground entry (the DEFAULT): build the village/terrain
    // loader at the clicked/party tile — gameTime drives occupant hours,
    // saved worldforge deltas replay into the town. The bridge modules are
    // dynamically imported (they pull the whole FMG stack); any failure
    // falls back to the continent worker loader so 3D can never brick.
    (async () => {
      try {
        const [bridge, loaderMod, adapter] = await Promise.all([
          import('../../systems/worldforge/bridge/legacySubmapBridge'),
          import('../../systems/worldforge/bridge/groundChunkLoader'),
          import('../../systems/worldforge/bridge/groundWorldAdapter'),
        ]);
        if (cancelled) return;

        const loc = LOCATIONS[state.currentLocationId];
        const wfSeed = WF_SEED ?? state.worldSeed;
        const rows = state.mapData?.tiles?.length ?? 16;
        const cols = state.mapData?.tiles?.[0]?.length ?? 25;
        // Entry tile priority: explicit dev override → the tile the player
        // CLICKED on the atlas (Enter-3D-at-cell stores it as continent
        // meters in playerWorldPos) → the party's location tile.
        const clicked = state.playerWorldPos
          ? {
              x: Math.max(0, Math.min(cols - 1, Math.floor(state.playerWorldPos.x / WORLD3D_CONFIG.METERS_PER_CELL))),
              y: Math.max(0, Math.min(rows - 1, Math.floor(state.playerWorldPos.z / WORLD3D_CONFIG.METERS_PER_CELL))),
            }
          : null;
        let coords = WF_TILE ?? clicked ?? loc?.mapCoordinates;
        if (WF_TOWN && !WF_TILE && wfSeed != null) {
          // Data-driven Enter Village: nearest burg-bearing tile to the party.
          const townTiles = bridge.getTownTilesForGrid(wfSeed, cols, rows);
          if (townTiles.length) {
            const px = coords?.x ?? cols / 2;
            const py = coords?.y ?? rows / 2;
            coords = townTiles.reduce((best, t) =>
              Math.hypot(t.x - px, t.y - py) < Math.hypot(best.x - px, best.y - py) ? t : best,
            );
            // eslint-disable-next-line no-console
            console.info('[wf_town] entering nearest town tile', coords, 'of', townTiles.length, 'town tiles');
          }
        }
        if (coords && wfSeed != null) {
          const bridged = bridge.getWorldforgeLocalForLocation(
            wfSeed, coords.x, coords.y, cols, rows,
          );
          const hour =
            state.gameTime instanceof Date ? state.gameTime.getHours() : 12;
          const deltas =
            (state as { worldforgeDeltas?: WorldDelta[] }).worldforgeDeltas ?? [];
          const { ground, loader: groundLoader } = loaderMod.createGroundChunkLoader(
            bridged.local, wfSeed, bridged.region, { hour, deltas },
          );
          if (cancelled) return;
          // Spawn at the SAVED ground position when it belongs to this tile
          // (WF-STORE-2 contract item 3); else the artifact center.
          const saved = (state as { playerGroundPos?: { tileX: number; tileY: number; xM: number; zM: number } | null }).playerGroundPos;
          const spawn =
            saved && saved.tileX === coords.x && saved.tileY === coords.y
              ? { x: saved.xM, z: saved.zM }
              : { x: ground.extentMetersX / 2, z: ground.extentMetersZ / 2 };
          const cell = adapter.GROUND_METERS_PER_CELL;
          const sgx = Math.max(0, Math.min(ground.cols - 1, Math.round(spawn.x / cell)));
          const sgy = Math.max(0, Math.min(ground.rows - 1, Math.round(spawn.z / cell)));
          setWfGroundView({
            start: [spawn.x, 0, spawn.z],
            surfaceY: heightToMeters(ground.heights[sgy * ground.cols + sgx] ?? 0),
            tile: { x: coords.x, y: coords.y },
          });
          const disposable: DisposableChunkLoader = Object.assign(
            (cx: number, cy: number) => groundLoader(cx, cy),
            { dispose: () => {} },
          );
          setLoader(() => disposable);
          const exitTile = { x: coords.x, y: coords.y };
          activeCleanup = () => {
            setLoader(undefined);
            // Exit coherence (contract item 4): the continent view resumes
            // at this tile's center; the two position fields never mix units.
            setPosition({
              x: (exitTile.x + 0.5) * WORLD3D_CONFIG.METERS_PER_CELL,
              y: 0,
              z: (exitTile.y + 0.5) * WORLD3D_CONFIG.METERS_PER_CELL,
            });
          };
          return;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[wf_ground] village entry failed; using continent loader', err);
      }
      if (!cancelled) activeCleanup = startLegacy();
    })();

    return () => {
      cancelled = true;
      activeCleanup?.();
    };
    // state fields are stable per 3D entry; deliberate minimal deps below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldData, state.currentLocationId, state.worldSeed]);

  // FPS tracking state.
  const [fps, setFps] = useState(0);
  const frameCount = useRef(0);
  const lastFpsTime = useRef(performance.now());

  useEffect(() => {
    let animFrameId: number;
    const tick = () => {
      frameCount.current++;
      const now = performance.now();
      if (now - lastFpsTime.current >= FPS_SAMPLE_MS) {
        setFps(Math.round((frameCount.current * 1000) / (now - lastFpsTime.current)));
        frameCount.current = 0;
        lastFpsTime.current = now;
      }
      animFrameId = requestAnimationFrame(tick);
    };
    animFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameId);
  }, []);

  // Streamer stats tracking (basic: count loaded chunks via scene re-renders).
  const [chunkCount, setChunkCount] = useState(0);
  const [streamerStats, setStreamerStats] = useState({
    chunksLoaded: 0,
    chunksUnloaded: 0,
    pendingRequests: 0,
  });

  // Use a ref to track previous chunk count for detecting changes.
  const prevChunkCount = useRef(0);

  // Callback to update chunk stats (called by scene when chunks change).
  const handleChunkUpdate = useCallback((loaded: number) => {
    setChunkCount(loaded);
    const delta = loaded - prevChunkCount.current;
    if (delta > 0) {
      setStreamerStats((prev) => ({
        ...prev,
        chunksLoaded: prev.chunksLoaded + delta,
      }));
    } else if (delta < 0) {
      setStreamerStats((prev) => ({
        ...prev,
        chunksUnloaded: prev.chunksUnloaded + Math.abs(delta),
      }));
    }
    prevChunkCount.current = loaded;
  }, []);

  // Throttle state for position dispatches.
  const lastDispatchTime = useRef(0);
  const lastDispatchedPos = useRef<{ x: number; z: number }>({ x: NaN, z: NaN });

  // Ground-mode dispatch (contract item 2): tile-scoped ground meters into
  // playerGroundPos — a separate field from the continent playerWorldPos,
  // so the legacy clamp/scale never sees walking-scale numbers.
  const lastGroundDispatch = useRef(0);
  const handleGroundPositionChange = useCallback(
    (x: number, z: number) => {
      const tile = wfGroundView?.tile;
      if (!tile) return;
      const now = Date.now();
      if (now - lastGroundDispatch.current < DISPATCH_INTERVAL_MS) return;
      lastGroundDispatch.current = now;
      dispatch({
        type: 'SET_PLAYER_GROUND_POS',
        payload: { position: { tileX: tile.x, tileY: tile.y, xM: x, zM: z } },
      });
    },
    [dispatch, wfGroundView?.tile],
  );

  /**
   * Called by FreeRoamCameraController (via World3DScene) when the camera moves.
   * Receives world X/Z coordinates, resolves terrain height Y, and dispatches
   * SET_PLAYER_WORLD_POS (throttled to ~10Hz).
   */
  const handlePositionChange = useCallback((worldX: number, worldZ: number) => {
    const now = Date.now();

    // Clamp to the world grid BEFORE anything persists. The free-roam camera
    // can pan past the map edge; dispatching the raw coords let the autosave
    // capture off-map positions (e.g. z=-881), and resuming such a save
    // centered the chunk streamer outside the grid — the player came back to
    // a featureless edge-clamped slab (resume-journey task 2).
    if (worldData) {
      const { widthM, heightM } = gridWorldDimensions(
        worldData.gridSize.cols,
        worldData.gridSize.rows,
      );
      worldX = Math.min(Math.max(worldX, 0), widthM);
      worldZ = Math.min(Math.max(worldZ, 0), heightM);
    }

    // Skip if throttled (less than DISPATCH_INTERVAL_MS since last dispatch).
    if (now - lastDispatchTime.current < DISPATCH_INTERVAL_MS) {
      return;
    }

    // Skip if position hasn't actually changed (avoid redundant dispatches).
    const lastPos = lastDispatchedPos.current;
    if (Math.abs(lastPos.x - worldX) < 0.1 && Math.abs(lastPos.z - worldZ) < 0.1) {
      return;
    }

    // Resolve terrain height (Y) from WorldData.
    let terrainY = entryPosition.y; // Fallback to entry Y if WorldData unavailable.
    if (worldData) {
      terrainY = getTerrainHeight(worldX, worldZ, worldData);
    }

    // Update throttle state.
    lastDispatchTime.current = now;
    lastDispatchedPos.current = { x: worldX, z: worldZ };

    // Dispatch position to game state.
    const position: PlayerWorldPosition = {
      x: worldX,
      y: terrainY,
      z: worldZ,
    };
    setPosition(position);
  }, [setPosition, worldData, entryPosition.y]);

  // FREEZE the scene origin / spawn at the value present when 3D was entered.
  //
  // `entryPosition` is `gameState.playerWorldPos` (App.tsx), which THIS component drives via
  // `setPosition` as the camera moves. Deriving `start` from it live created a feedback loop:
  //   camera pans → onPositionChange → SET_PLAYER_WORLD_POS → entryPosition → start →
  //   World3DScene re-derives its floating `sceneOrigin` → the whole world shifts under the camera →
  //   the camera reports a new position → … (repeats every frame)
  // The visible result was the map "sliding through space" and never stopping. The floating origin
  // must stay fixed for the session, so we capture the entry coords once and ignore later updates.
  const frozenEntry = useRef(entryPosition);
  const startPos: readonly [number, number, number] = useMemo(
    () => [frozenEntry.current.x, frozenEntry.current.y, frozenEntry.current.z],
    [],
  );

  // Spawn-surface height via the SAME mapping the chunk geometry uses
  // (heightToMeters: 0..100 → exaggerated meters). Saved entry positions
  // carry y≈0 from before vertical exaggeration landed, which parked the
  // camera hundreds of meters UNDER the terrain — every face back-culled,
  // so PLAYING's 3D view rendered nothing but sky (the "light blue box").
  const startSurfaceY = useMemo(() => {
    if (!worldData) return frozenEntry.current.y;
    const { cols, rows } = worldData.gridSize;
    const gx = Math.max(0, Math.min(cols - 1, Math.round(frozenEntry.current.x / WORLD3D_CONFIG.METERS_PER_CELL)));
    const gy = Math.max(0, Math.min(rows - 1, Math.round(frozenEntry.current.z / WORLD3D_CONFIG.METERS_PER_CELL)));
    return heightToMeters(worldData.heights[gy * cols + gx] ?? 0);
  }, [worldData]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {loader ? (
        <World3DScene
          loader={loader}
          start={wfGroundView?.start ?? startPos}
          startSurfaceY={wfGroundView?.surfaceY ?? startSurfaceY}
          viewProfile={wfGroundView ? 'ground' : 'continent'}
          playerWorldPos={wfGroundView ? null : position}
          onPositionChange={wfGroundView ? handleGroundPositionChange : handlePositionChange}
          onChunkUpdate={handleChunkUpdate}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '78vh',
            minHeight: '520px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-surface-alt, #1e2e3e)',
            color: 'var(--text-secondary, #8a9aaa)',
            fontFamily: 'Outfit, sans-serif',
            fontSize: '14px',
            borderRadius: '12px',
            border: '1px solid var(--border-color, #3a4a5a)',
          }}
        >
          World data is not ready for 3D view. Use Open Map to return to the atlas.
        </div>
      )}
      {/* InWorldHUD overlay — always mounted so exit controls work without a loader */}
      <InWorldHUD
        isDevModeEnabled={isDevModeEnabled}
        worldData={worldData}
        worldGen={state.mapData?.generation ?? null}
        chunkCount={chunkCount}
        fps={fps}
        playerPos={position}
        streamerStats={streamerStats}
        onOpenMap={() => setMode('atlas')}
        onExitToMenu={() => dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.MAIN_MENU })}
      />
    </div>
  );
};

export default World3DWrapper;
