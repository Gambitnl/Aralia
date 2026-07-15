// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 23:20:14
 * Dependents: App.tsx
 * Imports: 44 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
import { recipeFromCharacter, recipeFromRichNpc } from '@/systems/entities3d/recipeFromCharacter';
import { createForgeAssetService } from '@/systems/worldforge/assets/forgeAssetService';
import { assetAddress } from '@/systems/worldforge/assets/assetKey';

const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
let _stubService: ReturnType<typeof createForgeAssetService> | undefined;
if (urlParams.get('stubForgeAssets') === '1') {
  _stubService = createForgeAssetService({
    generator: {
      async generate(key) {
        // Simple red texture data URI
        const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVQIW2NkYGD4z8DAwMgAI0AMDA4YAQFDzMCmAAAAAElFTkSuQmCC'; 
        return { key, address: assetAddress(key), source: 'generated', imageUri: dataUri };
      }
    },
    online: true,
  });
}

import InWorldHUD from './InWorldHUD';
import WorldGenLoadingScreen, { type WorldGenLoadingStage } from './WorldGenLoadingScreen';
import type { DisposableWorldGenClient } from './createWorldGenClient';
import LocaleMovePane from './LocaleMovePane';
import { groundSurfaceYM } from './PlayerAvatar';
import {
  cameraMayWriteGroundPos,
  hasArrivedAtIntent,
  isIntentOnTile,
  type ClickMoveIntent,
} from './clickMoveAuthority';
import { localeFeetToGroundMeters } from '../../systems/worldforge/local/localePosition';
import { requestMapCenterOnPlayer, requestMapDrillToPlayerTown } from '../Worldforge/mapFocusSignal';
import { type DisposableChunkLoader } from './createWorkerChunkLoader';
import { resolveGroundEntryCellId } from './entryCellIdentity';
import { usePlayerWorldPos, useWorldViewMode } from '../../hooks/useWorldViewMode';
import { useGameState } from '../../state/GameContext';
import { type SceneCastMember } from './SceneCast';
import { scheduleClockFromGameTime } from '../../systems/worldforge/roster/gameClock';
import { GamePhase } from '../../types/core';
import type { PlayerWorldPosition } from '../../types';
import type { BattleMapBiome, BattleMapData } from '../../types/combat';

/**
 * HOSTILE-1 return-from-combat contract:
 * On encounter resolution, the player re-enters ground mode at the fight
 * tile + position. Persisted state:
 *   - `playerGroundPos` (GameState) — tile-scoped ground meters, set by
 *     SET_PLAYER_GROUND_POS immediately before combat starts.
 *   - `combatTriggered` ref — prevents exit cleanup from overwriting the
 *     saved continent position when the player enters combat.
 *   - `returningFromCombat` ref — signals that the ground-mode rebuild
 *     was triggered by a combat return, so the saved ground position is
 *     the authoritative spawn (not the continent-derived tile center).
 */
import { WORLD3D_CONFIG, heightToMeters } from '../../systems/world3d/config';
import { makeCellLocationId } from '../../utils/location/cellLocationId';
import { POSITION_DISPATCH_INTERVAL_MS } from './transitionTiming';
// The worldforge bridge modules pull the entire FMG generation stack —
// they are DYNAMICALLY imported inside the ground branch below so PLAYING's
// initial chunk (and the unit-test module graph) never pays for them; the
// same reason AtlasDemo is lazy. Only types may be imported statically.
import type { WorldDelta } from '../../systems/worldforge/delta/types';
import type { GroundWorld } from '../../systems/worldforge/bridge/groundChunkLoader';
import type { RegionArtifact } from '../../systems/worldforge/artifacts';
import type { BuildingEventLogsByBurg } from '../../systems/worldforge/interior/blueprintTypes';
import {
  buildingHistoryEventCount,
  cloneBuildingEventHistory,
} from '../../systems/worldforge/interior/buildingEventHistory';
import type { TownSimRegistry } from '../../systems/worldforge/townsim/townSimRegistry';
import { dungeonNameForEntrance } from '../../systems/worldforge/bridge/dungeonEntrances';
import { LOCATIONS } from '../../data/world/locations';
import { getBurgNamer } from '../../systems/worldforge/bridge/legacySubmapBridge';
import { generateTownRoster } from '../../systems/worldforge/roster/generateTownRoster';
import { SeededRandom } from '../../utils/random/seededRandom';
import { generateNPC } from '../../services/npcGenerator';
import type { NPCGenerationConfig } from '../../services/npcGenerator';
import { generateNpcBusiness, generateBusinessName } from '../../systems/economy/NpcBusinessManager';
import type { BusinessType } from '../../types/business';
import { getGameDay } from '../../utils/core';

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
// Grid retirement: the ?wf_tile / ?wf_town grid-coord dev overrides are gone —
// 3D entry is cell-native (anchor cell or the player's canonical cell).
const WF_SEED: number | null = (() => {
  const raw = wfParam('wf_seed');
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : null;
})();

interface World3DWrapperProps {
  /** Initial world position to start at. */
  entryPosition: { x: number; y: number; z: number };
  /**
   * Click-to-talk: called with an NPC figure's id when the player clicks a
   * townsperson/stranger in the 3D world. App wires this to the same `talk`
   * action the 2D action pane runs, so the dialogue opens with full bookkeeping.
   */
  onTalkToNpc?: (npcId: string) => void;
}

/** Throttle interval in ms (~10Hz) — see transitionTiming.ts for perf budget. */
const DISPATCH_INTERVAL_MS = POSITION_DISPATCH_INTERVAL_MS;

/** FPS sampling window in ms. */
const FPS_SAMPLE_MS = 1000;

/**
 * Mark a terrain patch as a projection of the live world before combat owns it.
 * The painter uses this lineage to avoid inventing roads, shoreline props, and
 * set pieces that are absent from the source GroundWorld. The atlas cell is
 * optional because legacy grid-addressed sessions can still enter combat while
 * their canonical cell identity is being migrated.
 */
function attachWorldforgeBattleMapProvenance(
  mapData: BattleMapData,
  worldSeed: number,
  anchorCellId: number | undefined,
  anchorX: number,
  anchorZ: number,
): BattleMapData {
  return {
    ...mapData,
    provenance: {
      kind: 'worldforge',
      worldSeed,
      anchorCellId,
      anchorWorldMeters: { x: anchorX, z: anchorZ },
      generationPath: ['World', 'Region', 'Local', 'Ground', 'Tactical patch'],
    },
  };
}

/**
 * Strip the living-town registry down to worker-safe building history only.
 * Sorted numeric keys make the serialized effect dependency stable when
 * unrelated villagers, news, or prosperity change.
 */
export function compactBuildingEventLogs(
  registry: TownSimRegistry | undefined,
): BuildingEventLogsByBurg | undefined {
  const result: BuildingEventLogsByBurg = {};
  const burgIds = Object.keys(registry ?? {}).map(Number).sort((a, b) => a - b);
  for (const burgId of burgIds) {
    const source = registry?.[burgId]?.buildingEvents;
    if (!source) continue;
    const byPlot: BuildingEventLogsByBurg[number] = {};
    for (const plotId of Object.keys(source).map(Number).sort((a, b) => a - b)) {
      const events = source[plotId];
      if (buildingHistoryEventCount(events) === 0) continue;
      byPlot[plotId] = cloneBuildingEventHistory(events);
    }
    if (Object.keys(byPlot).length) result[burgId] = byPlot;
  }
  return Object.keys(result).length ? result : undefined;
}

const World3DWrapper: React.FC<World3DWrapperProps> = ({ entryPosition, onTalkToNpc }) => {
  const { dispatch, state } = useGameState();
  const { setPosition, position } = usePlayerWorldPos();
  const { setMode } = useWorldViewMode();
  const isDevModeEnabled = state.isDevModeEnabled ?? false;
  const buildingEventLogJson = useMemo(
    () => JSON.stringify(compactBuildingEventLogs(state.townSim) ?? {}),
    [state.townSim],
  );

  // Tracks whether the player is currently exploring the walking-scale Ground Mode (true)
  // or flying above the global-scale Continent Mode (false).
  // Initialized from the URL parameters (?wf_legacy=1 starts in Continent Mode).
  // Toggling this value tears down the existing scene streamer and rebuilds it dynamically.
  const [isGroundMode, setIsGroundMode] = useState(() => wfParam('wf_legacy') !== '1');

  // Bumped by the HUD "Town Cell" button to pull the 3D camera up to an overhead
  // framing of the spawn town (stays in the scene — see World3DScene.frameTownCellNonce).
  const [frameTownCellNonce, setFrameTownCellNonce] = useState(0);

  // Worker-backed loader for PLAYING — keeps chunk mesh generation off the main thread.
  // Created and disposed inside ONE effect (the React-correct disposable-resource pattern): under
  // StrictMode's dev double-mount (setup → cleanup → setup) each setup builds a fresh loader+worker
  // and each cleanup disposes the very instance it built, so the committed tree always holds a LIVE
  // worker. The previous render-phase `useMemo` + out-of-band worker termination left the chunk
  // streamer bound to a worker that StrictMode had already terminated → it posted forever to a dead
  // worker and never loaded a chunk (the empty/flat 3D world). See createWorkerChunkLoader.
  const [loader, setLoader] = useState<DisposableChunkLoader | undefined>(undefined);
  // Staged 3D entry: which loading-stage label to show while the world assembles
  // off-thread (null once the scene can render), plus an honest error if the
  // worker failed. See WorldGenLoadingScreen + createWorldGenClient.
  const [worldGenStage, setWorldGenStage] = useState<WorldGenLoadingStage | null>(null);
  const [worldGenError, setWorldGenError] = useState<string | null>(null);
  // Bumped when Stage B patches props into the live ground, so the scene re-renders
  // the prop layer. Only the setter is used — any state change forces the re-read.
  const [, setGroundNonce] = useState(0);
  // Set when WF_GROUND succeeds: walking-scale spawn + camera profile +
  // the resolved tile (the unit-scope for persisted ground positions).
  const [wfGroundView, setWfGroundView] = useState<{
    start: readonly [number, number, number];
    surfaceY: number;
    tile: { x: number; y: number };
    // The active Locale's extent in ground cells (cols×5 ft by rows×5 ft). Held
    // in render state (not just groundRef) so the 2D LocaleMovePane re-renders
    // when a ground session becomes active. Cell-native world, Stage 3.
    localeExtent: { cols: number; rows: number };
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let activeCleanup: (() => void) | null = null;
    let client: DisposableWorldGenClient | null = null;

    // Grid retirement: the legacy continent streamer (createWorkerChunkLoader over
    // the 30x20 mapData heightfield) is gone. Continent Mode (?wf_legacy=1) now
    // renders nothing — the streamed cell-native ground below is the only world.
    if (!isGroundMode) {
      setWfGroundView(null);
      setLoader(undefined);
      setWorldGenStage(null);
      setWorldGenError(null);
      return () => {
        cancelled = true;
      };
    }

    // Worldforge ground entry (the DEFAULT): build the village/terrain
    // loader at the clicked/party tile — gameTime drives occupant hours,
    // saved worldforge deltas replay into the town. The bridge modules are
    // dynamically imported (they pull the whole FMG stack). No-fallback
    // directive (2026-06-15): a failure here surfaces honestly instead of
    // silently substituting the legacy continent streamer — one real path.
    (async () => {
      try {
        // Only the light main-thread bits load here (entry-cell resolution, the
        // shop/NPC registration helpers, the combat-patch extractor). The heavy
        // world assembly runs in the world-gen worker (createWorldGenClient), so
        // this dynamic import keeps the FMG stack off PLAYING's initial chunk.
        const [bridge, loaderMod, adapter, clientMod, groundLoaderMod] = await Promise.all([
          import('../../systems/worldforge/bridge/legacySubmapBridge'),
          import('../../systems/worldforge/bridge/groundChunkLoader'),
          import('../../systems/worldforge/bridge/groundWorldAdapter'),
          import('./createWorldGenClient'),
          import('./createGroundWorkerChunkLoader'),
        ]);
        if (cancelled) return;

        const wfSeed = WF_SEED ?? state.worldSeed;
        // Grid retirement (2026-07-01): 3D entry is fully cell-native. The entry
        // CELL is the anchor's cell (map click / start-selection / travel carry an
        // Entry3DAnchor) or — for a toggle-to-3D from gameplay with no anchor — the
        // player's canonical cell. A settlement's centerPx only frames the town;
        // resolving that coordinate back through Voronoi geometry could redirect
        // the worker to a neighbour and contradict the saved/2D player cell.
        const anchor = state.entry3DAnchor;
        const entryCellId = resolveGroundEntryCellId(anchor, state.playerCell);
        // The ground session's tile identity is the entry cell (opaque {x: cellId,
        // y: 0}) — cell-native, no grid coord. Feeds wfGroundView.tile + the
        // ground-position save/restore below.
        const coords = entryCellId != null ? { x: entryCellId, y: 0 } : null;
        if (!(coords && wfSeed != null && entryCellId != null)) return;

        const hour =
          state.gameTime instanceof Date ? state.gameTime.getHours() : 12;
        const deltas =
          (state as { worldforgeDeltas?: WorldDelta[] }).worldforgeDeltas ?? [];

        // Register the town's shops/NPCs into game state. Deterministic + idempotent
        // (guards on existing ids). Deferred to idle after Stage A so it never blocks
        // the first paint — buildings already read correct names via the same seed
        // fallback the renderer uses (staged-entry design doc, Stage C invariant).
        const registerTownContent = (region: RegionArtifact | undefined) => {
          const helperGetBusinessTypeForPlot = (role: string, plotId: number): BusinessType => {
            const types: BusinessType[] = role === 'market'
              ? ['general_store', 'tavern', 'apothecary', 'trading_company', 'enchanter_shop']
              : ['smithy', 'mine', 'farm', 'trading_company'];
            const index = Math.abs(Math.imul(plotId + 17, 2654435761) >>> 8) % types.length;
            return types[index];
          };

          for (const t of region?.townSites ?? []) {
            // CANONICAL plan (shared with the 3D renderer via groundChunkLoader):
            // business/NPC IDs are keyed by plot id, so this MUST be the same plan
            // the renderer bakes — otherwise registered shops bind to plot IDs the
            // rendered town doesn't have.
            const plan = loaderMod.canonicalArtifactTownForSite(wfSeed, t).plan;
            // No-fallback directive: getBurgNamer throws if the culture can't
            // resolve — no syllable substitute.
            const nameFor = getBurgNamer(wfSeed, t.burgId);
            const roster = generateTownRoster(plan, region!.seedPath, { nameFor });

            for (const p of plan.plots) {
              if (p.role === 'market' || p.role === 'workshop') {
                const npcId = `npc_burg_${t.burgId}_plot_${p.id}`;
                const bizId = `biz_burg_${t.burgId}_plot_${p.id}`;

                if (!state.generatedNpcs?.[npcId] || !state.worldBusinesses?.[bizId]) {
                  const seedValue = wfSeed + t.burgId + p.id;
                  const rng = new SeededRandom(seedValue);
                  const bizType = helperGetBusinessTypeForPlot(p.role, p.id);
                  const bizName = generateBusinessName(bizType, rng);

                  const occupant = roster.occupants.find(o => o.workPlotId === p.id);
                  const finalNpcName = occupant?.name ?? nameFor(rng);

                  const npcConfig: NPCGenerationConfig = {
                    id: npcId,
                    name: finalNpcName,
                    role: 'merchant',
                    occupation: p.role === 'market' ? 'shopkeeper' : 'artisan',
                    level: 3,
                  };
                  const richNpc = generateNPC(npcConfig);
                  richNpc.businessId = bizId;

                  const bizCell = (bridge.getBridgeAtlas(wfSeed).pack.burgs?.[t.burgId] as { cell?: number } | undefined)?.cell ?? 0;
                  const worldBiz = generateNpcBusiness(
                    richNpc,
                    makeCellLocationId(bizCell),
                    bizType,
                    getGameDay(state.gameTime),
                    rng
                  );
                  worldBiz.id = bizId;
                  worldBiz.name = bizName;
                  worldBiz.ownerId = npcId;
                  (worldBiz as any).burgId = t.burgId;
                  (worldBiz as any).plotId = p.id;

                  if (!state.generatedNpcs?.[npcId]) {
                    dispatch({ type: 'REGISTER_GENERATED_NPC', payload: { npc: richNpc } });
                  }
                  if (!state.worldBusinesses?.[bizId]) {
                    dispatch({ type: 'REGISTER_WORLD_BUSINESS', payload: { business: worldBiz } });
                  }
                }
              }
            }
          }
        };

        // Off-thread staged assembly. The loading screen animates while the worker
        // builds terrain + town (Stage A), then props (Stage B). No-fallback: a
        // worker failure surfaces plainly instead of a silent legacy substitute.
        setWorldGenError(null);
        setWorldGenStage('land');
        client = clientMod.createWorldGenClient();
        const buildingEventLogs = JSON.parse(buildingEventLogJson) as BuildingEventLogsByBurg;
        client.generate(
          {
            wfSeed,
            entryCellId,
            centerPx: anchor?.centerPx,
            hour,
            deltas,
            ...(Object.keys(buildingEventLogs).length ? { buildingEventLogs } : {}),
          },
          {
            onProgress: (stage) => {
              if (!cancelled && stage === 'town') setWorldGenStage('town');
            },
            onError: (message) => {
              if (!cancelled) setWorldGenError(message);
            },
            onStageA: ({ ground, region }) => {
              if (cancelled) return;
              // Store refs so handleGroundPositionChange / combat handoff can read
              // the live world and the extraction helper.
              groundRef.current = ground;
              extractPatchRef.current = loaderMod.extractLocalTerrainPatch;
              combatTriggered.current = false;
              // Dev hook: resolved entry anchor + rendered town burg ids for probes.
              (window as unknown as { __wfEntry?: unknown }).__wfEntry = {
                anchor: anchor ?? null,
                usedCellEntry: !!anchor,
                groundTownBurgs: (ground.towns ?? []).map((t) => t.burgId),
              };

              // Spawn at the SAVED ground position when it belongs to this tile
              // (WF-STORE-2 contract item 3); else the inherited burg / artifact center.
              const saved = (state as { playerGroundPos?: { tileX: number; tileY: number; xM: number; zM: number } | null }).playerGroundPos;
              const burgSpawn = ground.towns && ground.towns.length > 0
                ? { x: ground.towns[0].xM, z: ground.towns[0].zM }
                : { x: ground.extentMetersX / 2, z: ground.extentMetersZ / 2 };
              const spawn =
                saved && saved.tileX === coords.x && saved.tileY === coords.y
                  ? { x: saved.xM, z: saved.zM }
                  : burgSpawn;
              const cell = adapter.GROUND_METERS_PER_CELL;
              const sgx = Math.max(0, Math.min(ground.cols - 1, Math.round(spawn.x / cell)));
              const sgy = Math.max(0, Math.min(ground.rows - 1, Math.round(spawn.z / cell)));
              setWfGroundView({
                start: [spawn.x, 0, spawn.z],
                surfaceY: heightToMeters(ground.heights[sgy * ground.cols + sgx] ?? 0),
                tile: { x: coords.x, y: coords.y },
                localeExtent: { cols: ground.cols, rows: ground.rows },
              });
              // Mesh ground chunks OFF the main thread so walking stays smooth.
              // The worker is init'd with the Stage A ground (props empty) — meshing
              // never reads props, so Stage B never re-inits it. Self-healing loader
              // (survives StrictMode double-mount); disposed in cleanup below.
              const disposable = groundLoaderMod.createGroundWorkerChunkLoader(ground);
              setLoader(() => disposable);
              // Terrain + town are up — the loading screen gives way to the scene.
              setWorldGenStage(null);

              // Wire shops/NPCs in idle time so registration never blocks the paint.
              const ric = (window as unknown as {
                requestIdleCallback?: (cb: () => void) => number;
              }).requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 0));
              ric(() => { if (!cancelled) registerTownContent(region); });

              const exitTile = { x: coords.x, y: coords.y };
              activeCleanup = () => {
                disposable.dispose(); // terminate the ground mesh worker
                setLoader(undefined);
                groundRef.current = null;
                extractPatchRef.current = null;
                // HOSTILE-1: entering combat keeps the saved playerGroundPos as the
                // return point, so skip the continent position override.
                if (!combatTriggered.current) {
                  setPosition({
                    x: (exitTile.x + 0.5) * WORLD3D_CONFIG.METERS_PER_CELL,
                    y: 0,
                    z: (exitTile.y + 0.5) * WORLD3D_CONFIG.METERS_PER_CELL,
                  });
                }
                combatTriggered.current = false;
              };
            },
            onStageB: (ground) => {
              if (cancelled) return;
              // Props are patched into `ground`; swap to a fresh identity + bump a
              // nonce so World3DScene re-renders the prop layer over the live world.
              groundRef.current = { ...ground };
              setGroundNonce((n) => n + 1);
            },
          },
        );
      } catch (err) {
        // No-fallback directive: surface the failure plainly, never a silent
        // legacy substitute.
        setWorldGenError(
          `village entry failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    })();

    return () => {
      cancelled = true;
      client?.dispose();
      activeCleanup?.();
    };
    // Re-run the effect if the location, seed, or active mode scale changes.
    // HOSTILE-1: also re-run on game phase change so the ground world rebuilds
    // after a return-from-combat (BATTLE_MAP_DEMO → PLAYING transition).
  }, [
    state.currentLocationId,
    state.worldSeed,
    isGroundMode,
    state.phase,
    state.entry3DAnchor,
    buildingEventLogJson,
  ]);

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

  // References to keep track of ground world details for combat transition
  const groundRef = useRef<GroundWorld | null>(null);
  const extractPatchRef = useRef<typeof import('../../systems/worldforge/bridge/groundChunkLoader').extractLocalTerrainPatch | null>(null);
  const combatTriggered = useRef(false);
  // SP4: ids of hidden places the player has already revealed this session.
  const discoveredHiddenRef = useRef<Set<string>>(new Set());
  // Pillar 2: ids of dungeon entrances already discovered this session. Consume-
  // once so StrictMode's double-mount + re-entering a radius stay idempotent.
  const discoveredDungeonRef = useRef<Set<string>>(new Set());
  // Fight-in-place slice 1: the latest ground meters the player stands on, so a
  // dev entry (window.__fipTestFight / ?fipfight) can start a test fight at the
  // player's exact 3D location without walking into a hostile.
  const lastGroundXZ = useRef<{ x: number; z: number }>({ x: 0, z: 0 });

  // CLICK-MOVE AUTHORITY (camera↔click decoupling). `playerGroundPos` has two
  // writers: the camera controller (reports its pan target ~10Hz) and a ground
  // click. Without a referee, a pan right after a click overwrites the clicked
  // destination and the avatar never reaches it. Chosen model: a ground click
  // ARMS this intent; while it is armed the camera's position reports are IGNORED
  // for the walk state (the camera is still free to orbit/look — it just can't
  // hijack the walk target). The latch releases when the avatar arrives at the
  // intent (see clickMoveAuthority.ts); a fresh click re-arms it. Tune the
  // arrival radius via CLICK_MOVE_ARRIVE_EPSILON_M there.
  const clickMoveIntent = useRef<ClickMoveIntent>(null);

  // NIT fix: mirror `playerGroundPos` into a ref so handleGroundPositionChange
  // can read the authoritative avatar position WITHOUT `state.playerGroundPos`
  // in its deps — that field churns ~10Hz as the avatar glides, which would
  // recreate the callback every frame. The ref keeps the callback identity
  // stable while still seeing the freshest position.
  const playerGroundPosRef = useRef(state.playerGroundPos);
  useEffect(() => {
    playerGroundPosRef.current = state.playerGroundPos;
  }, [state.playerGroundPos]);

  const handleGroundPositionChange = useCallback(
    (x: number, z: number) => {
      const tile = wfGroundView?.tile;
      if (!tile) return;

      // CLICK-MOVE AUTHORITY: if a click-move is in progress, the clicked
      // destination is authoritative — a camera pan must NOT clobber the walk
      // target. Consult the pure referee; when the avatar has arrived, the latch
      // clears and the camera resumes writing. The avatar's real position (what
      // PlayerAvatar glides toward) is read via a ref so arrival is measured
      // against it, not the camera's look-at target `(x, z)`.
      const intent = clickMoveIntent.current;
      if (intent) {
        // TILE-CROSSING GUARD: an intent armed on a prior tile can never be
        // "arrived at" once the active tile differs (positions are tile-scoped),
        // so the arrival latch would stick forever and kill camera-walk. Retire
        // the stale intent on a crossing and let the camera resume writing.
        if (!isIntentOnTile(intent, tile.x, tile.y)) {
          clickMoveIntent.current = null;
        } else {
          const pgp = playerGroundPosRef.current;
          const current =
            pgp && pgp.tileX === tile.x && pgp.tileY === tile.y
              ? { xM: pgp.xM, zM: pgp.zM }
              : null;
          if (hasArrivedAtIntent(intent, current)) {
            // Arrived — release the latch so subsequent camera pans move again.
            clickMoveIntent.current = null;
          }
          if (!cameraMayWriteGroundPos(intent, current)) {
            // Camera yields the walk target this frame. Still keep the
            // fight-in-place tracker pointed at the AUTHORITATIVE avatar position
            // (the click target), not the roaming camera, so a test fight starts
            // where the player actually is.
            if (current) lastGroundXZ.current = { x: current.xM, z: current.zM };
            return;
          }
        }
      }

      // Fight-in-place dev entry: always track the freshest ground position,
      // even on throttled frames, so a test fight starts exactly where we stand.
      lastGroundXZ.current = { x, z };
      const now = Date.now();
      if (now - lastGroundDispatch.current < DISPATCH_INTERVAL_MS) return;
      lastGroundDispatch.current = now;
      dispatch({
        type: 'SET_PLAYER_GROUND_POS',
        payload: { position: { tileX: tile.x, tileY: tile.y, xM: x, zM: z } },
      });

      // SP4 discovery: reveal any hidden place the player comes within range of
      // (off-map sites placed by makeGroundWorld; revealed by 3D proximity).
      // Persist to GameState so discoveries survive reload and pin on the atlas.
      const gwForDiscovery = groundRef.current;
      if (gwForDiscovery?.hiddenSites?.length) {
        for (const hs of gwForDiscovery.hiddenSites) {
          if (discoveredHiddenRef.current.has(hs.id)) continue;
          if (Math.hypot(x - hs.xM, z - hs.zM) <= hs.discoveryRadiusM) {
            discoveredHiddenRef.current.add(hs.id);
            // The ground session IS this world tile's local surface, so every
            // hidden site it contains belongs to `tile` — pinning to the player's
            // current tile is correct at world-tile resolution (do NOT "fix" this
            // to the player's meters). The site's position WITHIN the tile becomes
            // a sub-tile offset (−0.5..0.5 from tile center) so the atlas pin sits
            // where the place actually is, not just at the cell center.
            const exX = gwForDiscovery.extentMetersX || 1;
            const exZ = gwForDiscovery.extentMetersZ || 1;
            const offsetX = Math.max(-0.5, Math.min(0.5, hs.xM / exX - 0.5));
            const offsetY = Math.max(-0.5, Math.min(0.5, hs.zM / exZ - 0.5));
            // Grid retirement: pin the discovery to the player's canonical atlas
            // cell (the ground session IS this cell's local surface), not a 30×20
            // grid tile. Need a cell to record it; skip if somehow unknown.
            const siteCellId = state.playerCell?.cellId;
            if (siteCellId == null) continue;
            dispatch({ type: 'REVEAL_HIDDEN_SITE', payload: { id: hs.id, cellId: siteCellId, name: hs.name, kind: hs.kind, offsetX, offsetY } });
            // Surface the discovery in the game log (SP4 in-game message).
            dispatch({
              type: 'ADD_MESSAGE',
              payload: {
                id: Date.now() + Math.floor(Math.random() * 1000),
                text: `You discovered a hidden place: ${hs.name}.`,
                sender: 'system',
                timestamp: new Date(),
              },
            });
          }
        }
      }

      // Pillar 2 discovery: walking within range of a world-grown dungeon
      // ENTRANCE names the dungeon and pins it (interior is Pillar 3 — no fake
      // interiors). Reuses the hidden-site persistence (REVEAL_HIDDEN_SITE): the
      // payload's id/cellId/name/kind/offset all fit a dungeon entrance, so the
      // discovery survives reload and pins on the map pane exactly like a hidden
      // place. Consume-once via `discoveredDungeonRef` so StrictMode's double
      // mount and re-entering the radius stay idempotent.
      if (gwForDiscovery?.dungeonEntrances?.length) {
        for (const de of gwForDiscovery.dungeonEntrances) {
          if (discoveredDungeonRef.current.has(de.id)) continue;
          if (Math.hypot(x - de.xM, z - de.zM) <= de.discoveryRadiusM) {
            discoveredDungeonRef.current.add(de.id);
            // The dungeon's REAL derived name (from its Pillar-1 lore pass),
            // generated once and cached per sitePath.
            const seed = state.worldSeed ?? 42;
            const name =
              dungeonNameForEntrance(seed, de.sitePath) ?? 'an unknown dungeon';
            // Pin at the ENTRANCE's own atlas cell (the site cell), not the
            // player's streamed cell — identity anchors to the site (recon trap 2).
            const exX = gwForDiscovery.extentMetersX || 1;
            const exZ = gwForDiscovery.extentMetersZ || 1;
            const offsetX = Math.max(-0.5, Math.min(0.5, de.xM / exX - 0.5));
            const offsetY = Math.max(-0.5, Math.min(0.5, de.zM / exZ - 0.5));
            dispatch({
              type: 'REVEAL_HIDDEN_SITE',
              payload: {
                id: de.id,
                cellId: de.cellId,
                name,
                kind: de.entranceKind,
                offsetX,
                offsetY,
              },
            });
            dispatch({
              type: 'ADD_MESSAGE',
              payload: {
                id: Date.now() + Math.floor(Math.random() * 1000),
                text: `You found ${name} — the way down is dark.`,
                sender: 'system',
                timestamp: new Date(),
              },
            });
          }
        }
      }

      // Combat handoff check: walking near a hostile creature in 3D ground mode
      // triggers combat by extracting the local 40x30 (5ft) terrain patch.
      if (combatTriggered.current) return;
      const ground = groundRef.current;
      const extractPatch = extractPatchRef.current;

      if (ground && extractPatch) {
        for (const h of ground.hostiles) {
          const dist = Math.hypot(x - h.xM, z - h.zM);
          // If the player walks within 4 meters of a hostile monster, trigger battle!
          if (dist < 4.0) {
            combatTriggered.current = true;

            // HOSTILE-1: persist the fight position immediately so the
            // return-from-combat path spawns the player at this exact spot.
            // Without this, the throttled dispatch (~10Hz) might not have
            // captured the final step before the hostile proximity check.
            dispatch({
              type: 'SET_PLAYER_GROUND_POS',
              payload: {
                position: {
                  tileX: tile.x,
                  tileY: tile.y,
                  xM: x,
                  zM: z,
                },
              },
            });

            // Run the async combat start wrapper
            (async () => {
              try {
                // Dynamically import the encounter handler to keep startup bundle lightweight
                const { handleStartBattleMapEncounter } = await import('../../hooks/actions/handleEncounter');

                // Map ground hostile to a standard bestiary entry
                const monster = {
                  name: h.name,
                  quantity: 1,
                  cr: '1/4',
                  description: 'Hostile creature from ground mode',
                };

                // PV4: Determine combat theme from dominant biome instead of hardcoding.
                const getThemeFromBiome = (biome: string | undefined): BattleMapBiome => {
                  if (!biome) return 'forest';
                  const lowerBiome = biome.toLowerCase();
                  if (lowerBiome.includes('desert')) return 'desert';
                  if (lowerBiome.includes('swamp') || lowerBiome.includes('wetland')) return 'swamp';
                  // Most other biomes map well to the forest theme for now.
                  return 'forest';
                };
                
                const bx = Math.max(0, Math.min(ground.cols - 1, Math.round(x / 1.524)));
                const by = Math.max(0, Math.min(ground.rows - 1, Math.round(z / 1.524)));
                const groundBiome = ground.biomeIds[by * ground.cols + bx];
                const combatTheme = getThemeFromBiome(groundBiome);

                // Extract the 40x30 terrain patch centered around the player's collision coordinate
                const worldSeed = state.worldSeed ?? 42;
                const extractedMap = attachWorldforgeBattleMapProvenance(
                  extractPatch(ground, x, z, combatTheme, worldSeed),
                  worldSeed,
                  state.playerCell?.cellId,
                  x,
                  z,
                );

                // Transition to combat mode using the extracted battle map
                await handleStartBattleMapEncounter(dispatch, {
                  monsters: [monster],
                  extractedBattleMap: extractedMap,
                });
              } catch (err) {
                // eslint-disable-next-line no-console
                console.error('[combat handoff] failed to enter battle:', err);
                combatTriggered.current = false;
              }
            })();
            break;
          }
        }
      }
    },
    [dispatch, wfGroundView?.tile, state.worldSeed, state.playerCell?.cellId],
  );

  // ==========================================================================
  // Fight-in-place slice 1 — DEV ENTRY.
  // Start a test fight at the player's exact 3D location, deriving the referee
  // grid from the local terrain patch (props → cover/LoS/movement). Reuses the
  // SAME extraction + encounter path as the hostile-proximity trigger, so the
  // world-derived grid renders on the always-available 2D board (the easiest
  // correctness surface). The context picker decides in-place vs arena; a live
  // ground world routes in-place and derives the patch from the world.
  //
  // Cut line (documented in the spec status): full in-scene 3D combat rendering
  // (actors/turn-HUD/tactical-orbit camera in the ground scene) and 3D ground
  // picking are LATER slices. This slice delivers world-derived combat on the
  // 2D board + the routing decision — no fake in-scene stubs.
  //
  // Trigger: window.__fipTestFight() from the console, or spawn with ?fipfight.
  // ==========================================================================
  const startFightInPlace = useCallback(async () => {
    const ground = groundRef.current;
    const extractPatch = extractPatchRef.current;
    if (!ground || !extractPatch) {
      // eslint-disable-next-line no-console
      console.warn('[fip dev] no live ground world yet — enter 3D first');
      return;
    }
    const { pickCombatSurface } = await import('../../systems/combat/fightInPlace/combatSurfacePicker');
    const decision = pickCombatSurface({ worldLive: true });
    // eslint-disable-next-line no-console
    console.info(`[fip dev] surface=${decision.surface} deriveFromWorld=${decision.deriveFromWorld} — ${decision.reason}`);

    const { x, z } = lastGroundXZ.current;
    const bx = Math.max(0, Math.min(ground.cols - 1, Math.round(x / 1.524)));
    const by = Math.max(0, Math.min(ground.rows - 1, Math.round(z / 1.524)));
    const groundBiome = (ground.biomeIds[by * ground.cols + bx] ?? '').toLowerCase();
    const theme: BattleMapBiome =
      groundBiome.includes('desert') ? 'desert'
        : (groundBiome.includes('swamp') || groundBiome.includes('wetland')) ? 'swamp'
          : 'forest';

    const worldSeed = state.worldSeed ?? 42;
    const extractedMap = decision.deriveFromWorld
      ? attachWorldforgeBattleMapProvenance(
        extractPatch(ground, x, z, theme, worldSeed),
        worldSeed,
        state.playerCell?.cellId,
        x,
        z,
      )
      : undefined;

    // Fight-in-place slice 2: hand the live world across the phase change so
    // CombatView can render the fight IN this town (World3DScene + combat layer)
    // instead of the teleport-to-diorama. The loader is a closure over the built
    // world, so it survives World3DWrapper unmounting. Scene origin matches
    // World3DScene's (the spawn/start point of the ground session).
    if (decision.deriveFromWorld && loader && wfGroundView) {
      const { setFightInPlaceHandoff } = await import('../../systems/combat/fightInPlace/fightInPlaceHandoff');
      setFightInPlaceHandoff({
        ground,
        loader,
        sceneOrigin: { x: wfGroundView.start[0], z: wfGroundView.start[2] },
        anchor: { playerXM: x, playerZM: z },
        surfaceY: groundSurfaceYM(ground, x, z),
        worldSeed: state.worldSeed ?? 42,
      });
    }

    // Persist the fight position so return-from-combat spawns us back here.
    const tile = wfGroundView?.tile;
    if (tile) {
      dispatch({ type: 'SET_PLAYER_GROUND_POS', payload: { position: { tileX: tile.x, tileY: tile.y, xM: x, zM: z } } });
    }

    try {
      const { handleStartBattleMapEncounter } = await import('../../hooks/actions/handleEncounter');
      combatTriggered.current = true;
      await handleStartBattleMapEncounter(dispatch, {
        monsters: [{ name: 'Test Brigand', quantity: 1, cr: '1/4', description: 'Dev fight-in-place test combatant' }],
        extractedBattleMap: extractedMap,
      });
      // eslint-disable-next-line no-console
      console.info('[fip dev] encounter dispatched — phase should be COMBAT');
    } catch (err) {
      combatTriggered.current = false;
      // eslint-disable-next-line no-console
      console.error('[fip dev] failed to start fight:', err);
    }
  }, [dispatch, wfGroundView, state.worldSeed, state.playerCell?.cellId, loader]);

  useEffect(() => {
    (window as unknown as { __fipTestFight?: () => void }).__fipTestFight = () => { void startFightInPlace(); };
    // ?fipfight — auto-start a test fight shortly after the ground world loads,
    // so a headless probe can capture the world-derived grid on the 2D board.
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('fipfight')) {
      timer = setTimeout(() => { void startFightInPlace(); }, 2500);
    }
    return () => {
      if (timer) clearTimeout(timer);
      delete (window as unknown as { __fipTestFight?: () => void }).__fipTestFight;
    };
  }, [startFightInPlace]);

  /**
   * Called by FreeRoamCameraController (via World3DScene) when the camera moves.
   * Receives world X/Z coordinates, resolves terrain height Y, and dispatches
   * SET_PLAYER_WORLD_POS (throttled to ~10Hz).
   */
  const handlePositionChange = useCallback((worldX: number, worldZ: number) => {
    const now = Date.now();

    // Skip if throttled (less than DISPATCH_INTERVAL_MS since last dispatch).
    if (now - lastDispatchTime.current < DISPATCH_INTERVAL_MS) {
      return;
    }

    // Skip if position hasn't actually changed (avoid redundant dispatches).
    const lastPos = lastDispatchedPos.current;
    if (Math.abs(lastPos.x - worldX) < 0.1 && Math.abs(lastPos.z - worldZ) < 0.1) {
      return;
    }

    // Grid retirement: continent-grid terrain height is gone. The cell-native
    // ground reports its own surface via handleGroundPositionChange; this legacy
    // continent path keeps the entry Y.
    const terrainY = entryPosition.y;

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
  }, [setPosition, entryPosition.y]);

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
  // Grid retirement: the continent heightfield is gone. The cell-native ground
  // sets its own spawn surface (wfGroundView.surfaceY); this legacy entry keeps
  // the frozen entry Y.
  const startSurfaceY = useMemo(() => frozenEntry.current.y, []);

  // Staged cast for an in-world scene: the player + the dynamic NPCs actually
  // present at this location (the opening-situation strangers at spawn). Rendered
  // only in ground/walking mode, where figures are at a visible scale. Resolves
  // names from generatedNpcs; the conversation's first participant is the speaker.
  const sceneCast = useMemo<SceneCastMember[]>(() => {
    const activeIds = state.currentLocationActiveDynamicNpcIds;
    if (!activeIds || activeIds.length === 0) return [];
    const speakerId = state.activeConversation?.kind === 'situation'
      ? state.activeConversation.participants?.[0]
      : undefined;
    const npcs = activeIds
      .slice(0, 4)
      .map((id): SceneCastMember | null => {
        const npc = state.generatedNpcs?.[id];
        return npc
          ? { id, name: npc.name, isSpeaker: id === speakerId, recipe: recipeFromRichNpc(npc) }
          : null;
      })
      .filter((m): m is SceneCastMember => m !== null);
    if (npcs.length === 0) return [];
    const player = state.party?.[0];
    const cast: SceneCastMember[] = [];
    if (player) {
      cast.push({
        id: player.id ?? 'player',
        name: player.name ?? 'You',
        isPlayer: true,
        recipe: recipeFromCharacter(player),
      });
    }
    cast.push(...npcs);
    return cast;
  }, [state.currentLocationActiveDynamicNpcIds, state.generatedNpcs, state.party, state.activeConversation]);

  // Cell-native world, Stage 3 — 2D Locale view click-to-move. The 2D pane and
  // the 3D ground are TWO SYNCED VIEWS of ONE movement state (`playerGroundPos`).
  // A 2D click dispatches the SAME `SET_PLAYER_GROUND_POS` action the 3D camera
  // walk dispatches — converting the clicked Locale feet → tile-local meters via
  // the bridge and stamping the active tile — so the reducer (which mirrors the
  // position into `playerCell.localeCoords` as feet) is the single sync point.
  // No new action, no cell↔tile mapping. The 3D camera reads `playerGroundPos`
  // as its spawn on (re)entry, so a 2D move is reflected in 3D; a 3D walk moves
  // the 2D marker live. (Live in-session 3D camera teleport from a 2D click is
  // Stage 3 polish / Stage 5 — deferred per the design doc.)
  // GRID-RETIRE: BA-3 — producer of the continuous Locale-feet movement state.
  const handleLocaleMoveTo = useCallback(
    (feetX: number, feetY: number) => {
      const tile = wfGroundView?.tile;
      if (!tile) return;
      const { xM, zM } = localeFeetToGroundMeters({ x: feetX, y: feetY });
      // Arm click-move authority — a 2D Locale click is a discrete destination
      // too, so it must survive a subsequent camera pan just like a 3D click.
      // Record the tile it was armed on so a tile crossing can retire it.
      clickMoveIntent.current = { xM, zM, tileX: tile.x, tileY: tile.y };
      dispatch({
        type: 'SET_PLAYER_GROUND_POS',
        payload: { position: { tileX: tile.x, tileY: tile.y, xM, zM } },
      });
    },
    [dispatch, wfGroundView?.tile],
  );

  // Interactive-3D locomotion: a click on open ground in the 3D world walks the
  // avatar there. GroundMovePlane already converted the raycast hit to tile/world
  // meters (the SAME convention the camera walk uses), so this is a discrete
  // dispatch of the ONE movement state — the body follows, exactly like a camera
  // walk or a 2D Locale-map click.
  const handleGroundClickMove = useCallback(
    (xM: number, zM: number) => {
      const tile = wfGroundView?.tile;
      if (!tile) return;
      // ARM click-move authority: this destination is now authoritative and the
      // camera's pan reports won't clobber it until the avatar arrives (or the
      // next click re-arms). Record the tile it was armed on so a tile crossing
      // can retire it. See clickMoveAuthority.ts / handleGroundPositionChange.
      clickMoveIntent.current = { xM, zM, tileX: tile.x, tileY: tile.y };
      dispatch({
        type: 'SET_PLAYER_GROUND_POS',
        payload: { position: { tileX: tile.x, tileY: tile.y, xM, zM } },
      });
    },
    [dispatch, wfGroundView?.tile],
  );

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {loader ? (
        <World3DScene
          forgeAssetService={_stubService}
          loader={loader}
          start={wfGroundView?.start ?? startPos}
          startSurfaceY={wfGroundView?.surfaceY ?? startSurfaceY}
          viewProfile={wfGroundView ? 'ground' : 'continent'}
          playerWorldPos={wfGroundView ? null : position}
          onPositionChange={wfGroundView ? handleGroundPositionChange : handlePositionChange}
          onChunkUpdate={handleChunkUpdate}
          // Ground mode only: townsfolk walk the streets on the game clock.
          groundWorld={wfGroundView ? groundRef.current : null}
          agentClock={state.gameTime instanceof Date ? scheduleClockFromGameTime(state.gameTime) : undefined}
          frameTownCellNonce={frameTownCellNonce}
          sceneCast={wfGroundView ? sceneCast : undefined}
          onSelectNpc={onTalkToNpc}
          onGroundPick={wfGroundView ? handleGroundClickMove : undefined}
          // Player avatar: the body follows the ONE movement state
          // (playerGroundPos) when it belongs to this tile; else it stands at
          // the spawn until the first move dispatch stamps the tile.
          playerGroundPos={
            wfGroundView &&
            state.playerGroundPos &&
            state.playerGroundPos.tileX === wfGroundView.tile.x &&
            state.playerGroundPos.tileY === wfGroundView.tile.y
              ? { xM: state.playerGroundPos.xM, zM: state.playerGroundPos.zM }
              : null
          }
          playerCharacter={wfGroundView ? (state.party?.[0] ?? null) : null}
        />
      ) : worldGenError ? (
        // No-fallback: a failed world build says so plainly instead of a blank view.
        <div
          style={{
            width: '100%',
            height: '100%',
            minHeight: '520px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '32px',
            boxSizing: 'border-box',
            background: 'var(--bg-surface-alt, #2a1418)',
            color: 'var(--text-secondary, #f2b8c0)',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '14px',
            borderRadius: '12px',
            border: '1px solid var(--border-color, #5a3a42)',
          }}
        >
          <div style={{ fontWeight: 700 }}>The world could not be built.</div>
          <div style={{ opacity: 0.85 }}>{worldGenError}</div>
        </div>
      ) : worldGenStage ? (
        // Staged assembly is running off-thread — honest, animated progress.
        <WorldGenLoadingScreen stage={worldGenStage} />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
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
      {/* Cell-native world, Stage 3: the 2D Locale view, ground-mode only. It is
          the second synced view of the one movement state (`playerGroundPos`):
          it renders the player marker from that state and writes back to it on
          click via the shared SET_PLAYER_GROUND_POS action. Additive — it sits
          beside the compass / drill views, replacing none of them. */}
      {wfGroundView ? (
        <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 20 }}>
          <LocaleMovePane
            localeExtent={wfGroundView.localeExtent}
            groundPos={state.playerGroundPos ?? null}
            onMoveTo={handleLocaleMoveTo}
          />
        </div>
      ) : null}
      {/* InWorldHUD overlay — always mounted so exit controls work without a loader */}
      <InWorldHUD
        isDevModeEnabled={isDevModeEnabled}
        worldData={null}
        worldGen={null}
        chunkCount={chunkCount}
        fps={fps}
        playerPos={position}
        streamerStats={streamerStats}
        onOpenMap={() => setMode('atlas')}
        onExitToMenu={() => dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.MAIN_MENU })}
        isGroundMode={isGroundMode}
        onToggleGroundMode={() => setIsGroundMode(prev => !prev)}
        // Only meaningful in ground/village mode (a town to frame); pulls the
        // camera up to the spawn town's overhead "cell" view without leaving 3D.
        onFrameTownCell={wfGroundView ? () => setFrameTownCellNonce((n) => n + 1) : undefined}
        // "Cell Map": open the 2D Voronoi world map as a modal over the 3D view,
        // centered on the player's town cell. TOGGLE_MAP_VISIBILITY leaves
        // worldViewMode untouched, so closing the map returns here in place.
        onOpenCellMap={wfGroundView ? () => {
          requestMapCenterOnPlayer();
          dispatch({ type: 'TOGGLE_MAP_VISIBILITY' });
        } : undefined}
        // "Town Plan": open the same 2D map modal but drilled straight to the
        // town the player's 3D world is showing (World ▸ Region ▸ Town). The
        // target burg must be passed explicitly: the player usually stands in a
        // cell ADJACENT to the town's own cell (the ground window spans several
        // atlas cells), so the town can't be derived from the player's cell.
        // Pick the nearest ground town to the player; default to the spawn town.
        onOpenTownPlan={wfGroundView ? () => {
          const towns = groundRef.current?.towns ?? [];
          const p = state.playerGroundPos;
          let burgId: number | null = towns[0]?.burgId ?? null;
          if (p && towns.length > 1) {
            let best = Infinity;
            for (const t of towns) {
              const d = (t.xM - p.xM) ** 2 + (t.zM - p.zM) ** 2;
              if (d < best) { best = d; burgId = t.burgId; }
            }
          }
          requestMapDrillToPlayerTown(burgId);
          dispatch({ type: 'TOGGLE_MAP_VISIBILITY' });
        } : undefined}
      />
    </div>
  );
};

export default World3DWrapper;
