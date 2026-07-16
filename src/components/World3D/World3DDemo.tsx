/**
 * @file World3DDemo.tsx
 * @description Self-contained host for the streamed 3D world. Generates a full world via the
 * real generation pipeline (`generateMap` â†’ `WorldData` v2) and feeds World3DScene an inline
 * (main-thread) chunk loader.
 *
 * Why this is built this way:
 * - Using the real `generateMap` pipeline (instead of a synthetic all-`plains` heightmap) means
 *   the demo showcases the *actual* implemented content: varied biomes, flow-traced rivers,
 *   the MST road graph, and placed towns/dungeons/ruins â€” the same data the live atlas + 3D
 *   world consume. (Resolves gap W3D-G8 / task T4.)
 * - The inline loader keeps the sandbox runnable without the Web Worker pool (worker-backed
 *   loading is tracked separately as W3D-G1).
 * - The camera spawns on the town with the greatest local terrain relief and is lifted to that
 *   ground elevation, so the now vertically-exaggerated hills read immediately rather than
 *   spawning on flat coast/ocean or a flat plateau (W3D-G11 / T8).
 */

import React, { useMemo } from 'react';
import World3DScene from './World3DScene';
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

import { generateMap } from '@/services/mapService';
import { BIOMES } from '@/constants';
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
import { handleChunkRequest } from '@/systems/world3d/chunkWorkerCore';
import { WORLD3D_CONFIG, heightToMeters, resolutionForLod } from '@/systems/world3d/config';
import type { ChunkLoader } from '@/systems/world3d/types';
import { getWorldforgeLocalForLocation, getWorldforgeLocalForCell, getBridgeAtlas } from '@/systems/worldforge/bridge/legacySubmapBridge';
import { createGroundChunkLoader } from '@/systems/worldforge/bridge/groundChunkLoader';
import { pickSeamCellPair, buildSeamStitchedLocal } from '@/systems/worldforge/bridge/seamProbe';

const DEMO_COLS = 60;
const DEMO_ROWS = 40;
const DEMO_SEED = 2026;
/** Worldforge world seed for the ground/seam sandbox (matches the .agent probes). */
const DEMO_WF_SEED = 42;

const World3DDemo: React.FC = () => {
  // Worldforge GROUND MODE (?ground=1, slice 3b): stream an L2 LocalArtifact
  // at walking scale (5 ft cells) through the same scene/streamer the
  // continent demo uses â€” the loaders differ, nothing else does.
  const groundMode = useMemo(
    () => new URLSearchParams(window.location.search).get('ground') === '1',
    [],
  );

  const { loader, start, startSurfaceY, ground: demoGround } = useMemo(() => {
    if (groundMode) {
      // Location is URL-tunable: ?ground=1&gx=17&gy=4 → river window;
      // default (16,4) spawns at a town site. Scans: find-river/find-town
      // probes in .agent/a8/.
      const params = new URLSearchParams(window.location.search);
      const gx = Number(params.get('gx') ?? 16);
      const gy = Number(params.get('gy') ?? 4);
      // &hour= drives time-of-day occupant placement (default noon: workers
      // at their shops). The PLAYING integration will pass real game time.
      const hour = Number(params.get('hour') ?? 12);

      // SEAM PROBE (?ground=1&seam=1) — open-region seam-first slice: two
      // ADJACENT atlas cells, each with its OWN region, one locale per side
      // stitched across the shared boundary. Spawns ON the seam (the
      // artifact's vertical centerline) so the region→region handoff is the
      // thing on screen. Bare ground by design: no town/region content.
      if (params.get('seam') === '1') {
        const atlas = getBridgeAtlas(DEMO_WF_SEED);
        const fpp = Number(params.get('seamFpp') ?? 1000);
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

      // &wfseed= overrides the Worldforge world for dev shoots (e.g. a world
      // whose cultures cover more architecture-style families than seed 42's).
      const wfSeed = Number(params.get('wfseed') ?? DEMO_WF_SEED);
      // DUNGEON-ENTRANCE EYEBALL (?ground=1&dcell=<cellId>): enter the ground
      // window centered on a specific atlas CELL (not a coarse grid tile), so a
      // window known to contain a dungeon site actually frames its sealed-door
      // entrance. Dev-only; falls back to grid-tile entry when absent.
      const dcellParam = params.get('dcell');
      const bridged =
        dcellParam != null
          ? getWorldforgeLocalForCell(wfSeed, Number(dcellParam))
          : getWorldforgeLocalForLocation(wfSeed, gx, gy, 25, 16);
      const { ground, loader: groundLoader } = createGroundChunkLoader(bridged.local, wfSeed, bridged.region, { hour });

      // Spawn at the artifact center, on the ground surface
      const startX = ground.extentMetersX / 2;
      const startZ = ground.extentMetersZ / 2;
      const cgx = Math.round(ground.cols / 2);
      const cgy = Math.round(ground.rows / 2);
      const centerH = ground.heights[cgy * ground.cols + cgx] ?? 0;
      // Dev hook (like __wf3dScene/__wf3dSetPose): headless capture rigs read
      // the streamed ground world (prop/building positions) to frame shots.
      (window as unknown as { __wfGroundWorld?: unknown }).__wfGroundWorld = ground;
      return {
        loader: groundLoader as ChunkLoader,
        start: [startX, 0, startZ] as const,
        startSurfaceY: heightToMeters(centerH),
        ground,
      };
    }
    // Run the real world-generation pipeline so the demo renders authentic rivers, roads,
    // towns, and varied biomes rather than a uniform-plains placeholder.
    const map = generateMap(DEMO_ROWS, DEMO_COLS, {}, BIOMES, DEMO_SEED);
    const world = map.worldData;
    if (!world) {
      throw new Error('World3DDemo: generateMap did not produce worldData (v2). Check the worldSim pipeline.');
    }

    const inlineLoader: ChunkLoader = async (cx, cy, lod) =>
      handleChunkRequest(world, { cx, cy, resolution: resolutionForLod(lod) });

    // Spawn on the town with the greatest *local relief* (maxâˆ’min terrain height in its
    // neighborhood) so the camera frames varied, hilly ground where the now vertically-exaggerated
    // relief reads clearly â€” rather than the first town (often a flat coastal/sea-level site) or
    // the highest town (often a flat plateau top). Falls back to the world's geometric center.
    const { cols: wCols, rows: wRows } = world.gridSize;
    const heightAtCell = (gx: number, gy: number): number => {
      const cx = Math.max(0, Math.min(wCols - 1, Math.round(gx)));
      const cy = Math.max(0, Math.min(wRows - 1, Math.round(gy)));
      return world.heights[cy * wCols + cx] ?? 0;
    };
    const localRelief = (gx: number, gy: number): number => {
      let min = Infinity, max = -Infinity;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const h = heightAtCell(gx + dx, gy + dy);
          if (h < min) min = h;
          if (h > max) max = h;
        }
      }
      return max - min;
    };
    const towns = world.sites.filter((s) => s.kind === 'town');
    const spawnTown = towns.length
      ? towns.reduce((best, s) =>
          localRelief(s.position.x, s.position.y) > localRelief(best.position.x, best.position.y) ? s : best,
        )
      : undefined;
    const startGridX = spawnTown ? spawnTown.position.x : DEMO_COLS / 2;
    const startGridY = spawnTown ? spawnTown.position.y : DEMO_ROWS / 2;
    const startX = startGridX * WORLD3D_CONFIG.METERS_PER_CELL;
    const startZ = startGridY * WORLD3D_CONFIG.METERS_PER_CELL;

    // Terrain is now vertically exaggerated, so the spawn surface can sit hundreds of meters up.
    // Convert the spawn cell's height (via the same exaggerated mapping the geometry builders use)
    // so the scene can frame the camera on the actual ground, not Y=0.
    const startSurfaceY = heightToMeters(heightAtCell(startGridX, startGridY));

    return { loader: inlineLoader, start: [startX, 0, startZ] as const, startSurfaceY, ground: null };
  }, [groundMode]);

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
      </p>
      {/* Absolute-inset slot: gives World3DScene's height:100% root a DEFINITE
          height regardless of how the flex column resolves percentages. */}
      <div style={{ flex: '1 1 auto', minHeight: '520px', position: 'relative' }}>
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

