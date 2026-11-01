/**
 * @file World3DDemo.tsx
 * @description Self-contained host for the streamed 3D ground world. One-worldmap
 * cleanup 2026-08-05: the legacy continent sandbox (generateMap → WorldData grid,
 * inline chunk loader) is gone. The demo now always runs the canonical Worldforge
 * ground pipeline — the same cell-addressed Local artifacts the game streams.
 * URL tuning: ?gx/?gy (grid window), ?dcell (atlas cell), ?wfseed, ?hour, ?seam=1.
 */

import React, { useEffect, useMemo, useState } from 'react';
import World3DScene from './World3DScene';
import SubmapSvgView from '../Worldforge/SubmapSvgView';
import { atlasCellToSubmapContext } from '@/systems/worldforge/submap/l0Adapter';
import {
  generateSubmap,
  normalizeParentContextScale,
} from '@/systems/worldforge/submap/submapEngine';
import { rootSeedPath } from '@/systems/worldforge/seedPath';
import { createForgeAssetService } from '@/systems/worldforge/assets/forgeAssetService';
import { assetAddress } from '@/systems/worldforge/assets/assetKey';

const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
let _stubService: ReturnType<typeof createForgeAssetService> | undefined;
if (urlParams.get('stubForgeAssets') === '1') {
  _stubService = createForgeAssetService({
    generator: {
      async generate(key) {
        // Red checkerboard or simple texture data URI
        const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVQIW2NkYGD4z8DAwMgAI0AMDA4YAQFDzMCmAAAAAElFTkSuQmCC'; // 2x2 red and black
        return { key, address: assetAddress(key), source: 'generated', imageUri: dataUri };
      }
    },
    online: true,
  });
}

import { ALL_RACES_DATA } from '@/data/races';
import { CLASSES_DATA } from '@/data/classes';
import type { PlayerCharacter } from '@/types/character';
import type { SceneCastMember } from './SceneCast';
import { recipeFromCharacter } from '@/systems/entities3d/recipeFromCharacter';

/** Demo body: a real race + class so the sandbox avatar exercises the real
 * entity-generator path without any game state. */
const demoCharacter = {
  id: 'demo-player',
  name: 'Demo Player',
  race: ALL_RACES_DATA['human'],
  class: CLASSES_DATA['fighter'],
  equippedItems: {},
} as unknown as PlayerCharacter;

/** `?cast=1`: stage a demo opening cluster (player + two strangers) so the
 * SceneCast entity swap is eyeball-able without a running game/Ollama. One
 * stranger carries a real recipe (geared ranger), one falls through to the
 * commoner default — the two paths castMemberRecipe covers. */
const demoCast: SceneCastMember[] = [
  {
    id: 'demo-player',
    name: 'Demo Player',
    isPlayer: true,
    recipe: recipeFromCharacter(demoCharacter),
  },
  {
    id: 'demo-speaker',
    name: 'Rangy Speaker',
    isSpeaker: true,
    recipe: { kind: 'humanoid', raceId: 'wood_elf', classId: 'ranger', seed: 'demo-speaker' },
  },
  { id: 'demo-commoner', name: 'Quiet Stranger' },
];
import { heightToMeters } from '@/systems/world3d/config';
import type { ChunkLoader } from '@/systems/world3d/types';
import { getBridgeAtlas, resolveWorldforgeLocationEntry } from '@/systems/worldforge/bridge/legacySubmapBridge';
import type { WorldforgeLocationEntry } from '@/systems/worldforge/bridge/legacySubmapBridge';
import { createGroundChunkLoader } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
// GG-558: the game's staged off-thread entry (world-gen worker + mesh worker).
import { createWorldGenClient } from './createWorldGenClient';
import { createGroundWorkerChunkLoader } from './createGroundWorkerChunkLoader';
import type { DisposableChunkLoader } from './createGroundWorkerChunkLoader';
import { useOffThreadBridgeAtlas } from '@/components/Worldforge/useOffThreadBridgeAtlas';
import { pickSeamCellPair, buildSeamStitchedLocal } from '@/systems/worldforge/bridge/seamProbe';

/** Worldforge world seed for the ground/seam sandbox (matches the .agent probes). */
const DEMO_WF_SEED = 42;

const World3DDemo: React.FC = () => {
  // One-worldmap cleanup: the demo is ground-mode only. `?ground=1` is accepted
  // for old bookmarks but no longer selects between pipelines.
  const groundMode = true;

  // The ground harness's cell address, re-read here for the 2D zoom-out
  // overlay (the loader memo consumes the same params internally).
  const { dcell, wfSeed } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const dcellParam = params.get('dcell');
    return {
      dcell: groundMode && dcellParam != null ? Number(dcellParam) : null,
      wfSeed: Number(params.get('wfseed') ?? DEMO_WF_SEED),
    };
  }, [groundMode]);
  // ?ground=1&dcell=N only: "zoom out" overlay showing the 2D Voronoi submap
  // of the SAME atlas cell this window streams, via the same engine the
  // in-game MapPane drill uses.
  const [show2dSubmap, setShow2dSubmap] = useState(false);

  // GG-555 (2026-11-01): the atlas worker builds the world before any ground
  // loader runs, so the ~4.5 s generateFmgWorld build no longer blocks the page.
  // The seam probe always uses DEMO_WF_SEED; every other entry uses ?wfseed=.
  // The bridge calls below then read that same cached atlas.
  const atlasSeed = urlParams.get('seam') === '1' ? DEMO_WF_SEED : wfSeed;
  const { atlas: demoAtlas, error: demoAtlasError } = useOffThreadBridgeAtlas(atlasSeed);
  const submapModel = useMemo(() => {
    if (!show2dSubmap || dcell == null || !demoAtlas) return null;
    const atlas = getBridgeAtlas(wfSeed);
    const ctx = normalizeParentContextScale(
      atlasCellToSubmapContext(atlas, dcell, rootSeedPath(wfSeed)),
    );
    return generateSubmap(ctx);
  }, [show2dSubmap, dcell, wfSeed, demoAtlas]);

  // Location is URL-tunable: ?ground=1&gx=17&gy=4 → river window;
  // default (16,4) spawns at a town site. Scans: find-river/find-town
  // probes in .agent/a8/. &hour= drives time-of-day occupant placement
  // (default noon: workers at their shops).
  const hour = Number(urlParams.get('hour') ?? 12);
  const seamMode = urlParams.get('seam') === '1';

  // GG-558 (2026-11-01): the cell this window opens onto. ?dcell= names the
  // cell directly, so its build starts at once. A ?gx/?gy tile needs the atlas
  // to find its cell (a cheap lookup), so it waits for the atlas worker.
  const entry = useMemo(() => {
    if (seamMode) return null;
    if (dcell != null) return { cellId: dcell } as WorldforgeLocationEntry;
    if (!demoAtlas) return null;
    const gx = Number(urlParams.get('gx') ?? 16);
    const gy = Number(urlParams.get('gy') ?? 4);
    return resolveWorldforgeLocationEntry(wfSeed, gx, gy, 25, 16);
  }, [seamMode, dcell, demoAtlas, wfSeed]);

  // GG-558 (2026-11-01): the region and ground build used to run here, in one
  // render-time memo, and froze the page for about 17 s. The demo now uses the
  // game's own staged entry: the world-gen worker builds terrain and town
  // (Stage A), then props (Stage B), and a second worker meshes the chunks.
  // The request matches the old main-thread call: same cell, same town
  // center, same hour, and the entry cell is the canopy anchor.
  const [staged, setStaged] = useState<{
    key: string;
    loader: ChunkLoader;
    start: readonly [number, number, number];
    startSurfaceY: number;
    ground: GroundWorld;
  } | null>(null);
  const [stagedError, setStagedError] = useState<string | null>(null);
  const [stagedStep, setStagedStep] = useState<'land' | 'town'>('land');
  const entryKey = entry ? `${wfSeed}/${entry.cellId}/${entry.centerPx?.join(',') ?? ''}/${hour}` : null;
  useEffect(() => {
    if (!entry || !entryKey) return undefined;
    let cancelled = false;
    let meshLoader: DisposableChunkLoader | null = null;
    setStagedError(null);
    setStagedStep('land');
    const client = createWorldGenClient();
    client.generate(
      { wfSeed, entryCellId: entry.cellId, centerPx: entry.centerPx, hour },
      {
        onProgress: (step) => { if (!cancelled && step === 'town') setStagedStep('town'); },
        onError: (message) => { if (!cancelled) setStagedError(message); },
        // GG-573: the world-gen worker also sends the ground to the mesh worker.
        handOffGround: true,
        onStageA: ({ ground, meshGroundPort }) => {
          if (cancelled) { meshGroundPort?.close(); return; }
          // Spawn at the artifact center, on the ground surface.
          const cgx = Math.round(ground.cols / 2);
          const cgy = Math.round(ground.rows / 2);
          // Dev hook (like __wf3dScene/__wf3dSetPose): headless capture rigs read
          // the streamed ground world (prop/building positions) to frame shots.
          (window as unknown as { __wfGroundWorld?: unknown }).__wfGroundWorld = ground;
          meshLoader = createGroundWorkerChunkLoader(ground, undefined, undefined, { groundPort: meshGroundPort });
          setStaged({
            key: entryKey,
            loader: meshLoader,
            start: [ground.extentMetersX / 2, 0, ground.extentMetersZ / 2],
            startSurfaceY: heightToMeters(ground.heights[cgy * ground.cols + cgx] ?? 0),
            ground,
          });
        },
        onStageB: (ground) => {
          if (cancelled) return;
          // Props are patched into the Stage A ground. A new object identity
          // makes World3DScene draw the prop layer, as World3DWrapper does.
          const dressed = { ...ground };
          (window as unknown as { __wfGroundWorld?: unknown }).__wfGroundWorld = dressed;
          setStaged((s) => (s && s.key === entryKey ? { ...s, ground: dressed } : s));
        },
      },
    );
    return () => {
      cancelled = true;
      client.dispose();
      meshLoader?.dispose();
    };
    // entryKey names the entry; entry itself is a new object on each atlas change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryKey]);

  const seamBuilt = useMemo(() => {
    if (!seamMode || !demoAtlas) return null;
    {
      // SEAM PROBE (?ground=1&seam=1) — open-region seam-first slice: two
      // ADJACENT atlas cells, each with its OWN region, one locale per side
      // stitched across the shared boundary. Spawns ON the seam (the
      // artifact's vertical centerline) so the region→region handoff is the
      // thing on screen. Bare ground by design: no town/region content.
      // It still builds on the main thread: the world-gen worker takes one
      // cell, not a stitched pair (GG-558 leaves this probe as it was).
      {
        const atlas = demoAtlas;
        const fpp = Number(urlParams.get('seamFpp') ?? 1000);
        const pair = pickSeamCellPair(atlas, fpp);
        const seam = buildSeamStitchedLocal(atlas, DEMO_WF_SEED, { feetPerPixel: fpp, ...pair });
        // Headless probes read this line for the empirical handoff residual.
        // eslint-disable-next-line no-console
        console.info(
          `[seamProbe] cells=${seam.cellA}|${seam.cellB} seamWorldXFt=${Math.round(seam.seamWorldXFt)} ` +
            `maxJoinDeltaFt=${seam.maxJoinDeltaFt.toFixed(2)}`,
        );
        const { ground, loader: seamLoader } = createGroundChunkLoader(seam.stitched, DEMO_WF_SEED, undefined, { hour });
        const startX = ground.extentMetersX / 2; // the seam line
        const startZ = ground.extentMetersZ / 2;
        const sgx = Math.round(ground.cols / 2);
        const sgy = Math.round(ground.rows / 2);
        return {
          loader: seamLoader as ChunkLoader,
          start: [startX, 0, startZ] as const,
          startSurfaceY: heightToMeters(ground.heights[sgy * ground.cols + sgx] ?? 0),
          ground,
        };
      }
    }
  }, [demoAtlas, seamMode, hour]);

  // DUNGEON-ENTRANCE EYEBALL (?ground=1&dcell=<cellId>) enters the window
  // centered on a specific atlas CELL, so a window known to hold a dungeon
  // site frames its sealed-door entrance. &wfseed= overrides the world for
  // dev shoots. Both build in the world-gen worker (see `staged` above).
  const built = seamMode ? seamBuilt : entryKey && staged?.key === entryKey ? staged : null;

  if (!built) {
    const failure = demoAtlasError ?? stagedError;
    // The staged steps name what the worker builds now, as the game's
    // WorldGenLoadingScreen does.
    const label = !entry
      ? `Preparing world ${atlasSeed}…`
      : stagedStep === 'town' ? 'Raising the town…' : 'Shaping the land…';
    return (
      <div
        data-testid="world3d-demo-preparing"
        role="status"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', fontFamily: 'Outfit, sans-serif', color: failure ? '#b91c1c' : '#4a5a6a' }}
      >
        {failure ? `The world did not build: ${failure}` : label}
      </div>
    );
  }
  const { loader, start, startSurfaceY, ground: demoGround } = built;

  return (
    // 100dvh (not height:100%): App's min-h-screen root has AUTO height, so a
    // percentage chain from here collapses the R3F canvas to a ~150px strip —
    // the same viewport-fill failure TransitionController hit (fixed 2026-06-29).
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', height: '100dvh', boxSizing: 'border-box' }}>
      <h1 style={{ margin: 0, fontSize: '24px', fontFamily: 'Outfit, sans-serif', color: '#1a2a3a' }}>
        {groundMode ? 'Developer shortcut — canonical Worldforge ground pipeline' : 'World 3D Chunk Streaming Sandbox'}
      </h1>
      <p style={{ margin: 0, fontSize: '14px', color: '#4a5a6a' }}>
        {groundMode
          ? 'This URL-only harness reconstructs a canonical cell-addressed Local artifact for diagnostics. Player exploration enters through Atlas and preserves its selected artifact in memory.'
          : 'Right-click and drag to pan the camera across the landscape. Chunks will stream in and out in real time!'}
        {dcell != null && (
          <button
            type="button"
            onClick={() => setShow2dSubmap((v) => !v)}
            style={{
              marginLeft: '12px',
              padding: '4px 12px',
              fontSize: '13px',
              fontFamily: 'Outfit, sans-serif',
              color: '#e8eef4',
              background: '#2c4a68',
              border: '1px solid #1a2a3a',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            {show2dSubmap ? `Back to 3D` : `Zoom out — 2D submap of cell ${dcell}`}
          </button>
        )}
      </p>
      {/* Absolute-inset slot: gives World3DScene's height:100% root a DEFINITE
          height regardless of how the flex column resolves percentages. */}
      <div style={{ flex: '1 1 auto', minHeight: '520px', position: 'relative' }}>
        {/* 2D zoom-out overlay: the streamed cell's Voronoi submap, over the
            (kept-mounted) 3D scene so toggling back is instant. */}
        {show2dSubmap && submapModel && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0b1420',
              borderRadius: '8px',
            }}
          >
            <SubmapSvgView
              model={submapModel}
              width={Math.min(1100, window.innerWidth - 120)}
              height={Math.min(760, window.innerHeight - 220)}
              prefsScope={wfSeed}
            />
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0 }}>
          <World3DScene loader={loader} start={start} startSurfaceY={startSurfaceY} viewProfile={groundMode ? 'ground' : 'continent'}
            forgeAssetService={_stubService}
            // Player-avatar sandbox: the demo has no game state, so stand a
            // demo character (real race + class data) at the spawn
            // (groundPos null → spawn anchor).
            groundWorld={demoGround ?? null}
            playerCharacter={groundMode ? demoCharacter : null}
            sceneCast={groundMode && urlParams.get('cast') === '1' ? demoCast : undefined}
          />
        </div>
      </div>
    </div>
  );
};

export default World3DDemo;

