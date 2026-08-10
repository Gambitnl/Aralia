/**
 * @file VolumeArenaGround.tsx — the combat arena drawn as MATTER.
 *
 * This replaces the heightfield's ground inside the playable rectangle. The
 * heightfield keeps its fringe run-out and a border band across the join (see
 * `TerrainMesh`'s `interiorHoleInsetTiles`); everything inside is voxels, meshed
 * with surface nets and drawn with the campaign's one substance material.
 *
 * WHAT CHANGES, IN ONE SENTENCE: the arena ground now has an INSIDE. A crater
 * bored into it shows litter, topsoil, subsoil and rock in the order they were
 * laid down, water finds the hole, and the collision surface is derived from the
 * same voxels rather than kept in a second place that can disagree.
 *
 * THE JOIN. The volume is filled from the SAME height formula the heightfield
 * draws (`makeTerrainHeightSampler`) and offset by radius from the arena's edge:
 * lifted just over a cell inside, ramped down through zero to `RIM_SINK_M` below
 * the terrain at the border. What the camera sees is the HIGHER of the two
 * surfaces, and the higher of two continuous surfaces is continuous.
 *
 * THE HEIGHT EVERY OTHER LAYER USES. Grass, scatter, props, tokens and the grid
 * all sit ON the ground, and the ground they must sit on is the one the mesh
 * DRAWS — not the one the voxels store, and no longer the heightfield. Surface
 * nets places a vertex at the average of its edge crossings, so the drawn top
 * lies up to a cell below the column top; a layer that asked the voxels would
 * float, and one that asked the heightfield would sink by the rim lift. So each
 * slab reports its per-dual-column drawn maximum, this component folds those
 * into one field, and `onSurface` hands the host a sampler over it.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BattleMapData, BattleMapTile } from '../../../types/combat';
import { canUseDevTools } from '../../../utils/core';
import { makeSubstanceGroundMaterial } from '@/components/World3D/terrain/substanceGroundMaterial';
import { applyBrush } from '@/systems/worldforge/terrain/voxelBrush';
import { colorAtDepth } from '@/systems/worldforge/terrain/materials';
import { meshCellRange, aoReachCellsY, AO_REACH_CELLS } from '@/systems/worldforge/terrain/surfaceNets';
import { resolveTerrainTileCoordinates } from './terrainTileMapping';
import {
  arenaTilesFromMapData,
  arenaDepthDatum,
  arenaSurfaceTint,
  RIM_RAMP_TILES,
  type ArenaVolume,
} from './arenaVolume';
import { createArenaVolumeClient, type ArenaVolumeHandle } from './createArenaVolumeClient';
import { ARENA_SLAB_XZ, ARENA_SLAB_Y, type ArenaSlabMessage } from './arenaVolumeWorker';

/** How far inside the rect the heightfield stops. Matches the rim ramp. */
export const ARENA_HEIGHTFIELD_INSET_TILES = RIM_RAMP_TILES;

export interface ArenaSurface {
  /** Drawn ground height at a point in TILE coordinates. */
  sampleY: (tileX: number, tileZ: number) => number;
  /** The live volume, so a carve slice can edit the one copy that exists. */
  handle: ArenaVolumeHandle;
  /**
   * Dig a crater and republish everything that stands on the ground.
   *
   * The one entry point. The dev hook and the live combat driver call THIS —
   * two carve paths would be two chances for the drawn surface, the samplers
   * and the water bed to disagree about what the ground now is.
   *
   * Returns the touched cell window, so the water can sync only the columns
   * that changed, and the milliseconds the whole slice took, because a carve
   * lands mid-encounter and a hitch is a bug.
   */
  carve: (
    tileX: number,
    tileZ: number,
    radiusM: number,
    depthM: number,
  ) => { changed: number; min: [number, number, number]; max: [number, number, number]; ms: number };
  /**
   * Drawn top per VOXEL COLUMN, `z * cells + x`, or `-Infinity` where nothing
   * is drawn. The water bed rests on this: a bed taken from the voxel column
   * instead floats the sheet above the ground by up to a whole cell, in
   * cell-shaped slabs, which is exactly what it did on the sandbox.
   */
  columnTopY: Float32Array;
  /**
   * The cell window the carve that produced THIS publication touched, or null
   * for the build.
   *
   * It rides the published surface rather than being tracked separately by the
   * host, because it belongs to the same fact: this is the ground, and this is
   * the part of it that just changed. The water syncs those columns and no
   * others. Tracked beside the surface instead, it went stale the first time
   * the dev carve hook fired — the hook republished the ground while the host's
   * copy of "where the last crater was" stayed null, so the water never learnt
   * that its bed had moved.
   */
  carveWindow: { min: [number, number, number]; max: [number, number, number] } | null;
}

interface VolumeArenaGroundProps {
  mapData: BattleMapData;
  /** Called once the drawn surface is complete, and after every carve. */
  onSurface?: (s: ArenaSurface | null) => void;
  onTileClick?: (tile: BattleMapTile) => void;
  onTileHover?: (tile: BattleMapTile) => void;
}

interface SlabEntry {
  geometry: THREE.BufferGeometry;
  dualTopY: Float32Array;
  dualRect: { x0: number; z0: number; w: number; h: number };
}

const slabKey = (cx: number, cy: number, cz: number, a: number) => (cy * a + cz) * a + cx;

/**
 * How much of the per-tile surface tint the arena's TOP draws, 0..1.
 *
 * 1 is what has shipped since slice 1 and this slice does not change it. The
 * value is named here so the A/B has something to be an A/B *of*: at 0 the
 * board is one biome stack everywhere and a rock outcrop reads as forest
 * litter; at 1 every tile type is legible and the ground is more colourful than
 * one honest column of substance. Only Remy can pick, and he picks from frames.
 */
export const ARENA_TINT_MIX = 1;

/**
 * Milliseconds of re-mesh a single frame will do for a carve.
 *
 * A crater on the shipped map re-meshes twelve 32-cell slabs, about 160 ms of
 * work, and the worst of them is 31.6 ms (`ARENA_SLAB_XZ`'s table). Done in one
 * call that is a 160 ms hole in the encounter; drained a slab at a time it is a
 * crater that finishes forming over a fifth of a second while the board keeps
 * moving. The budget is checked BEFORE each slab and never interrupts one, so
 * the real worst frame is this plus one slab — which is the number the plan was
 * chosen to make small.
 */
const CARVE_FRAME_BUDGET_MS = 8;

/** `?tintmix=0.65` — the A/B, set before the first frame. Dev surfaces only. */
function arenaTintMixOverride(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('tintmix');
  if (raw === null) return null;
  const v = Number(raw);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null;
}

/** Turn one worker slab into a drawable geometry. The only main-thread cost. */
function slabGeometry(s: ArenaSlabMessage): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(s.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(s.normals, 3));
  /* The substance material reads these three instead of a vertex colour: depth
   * so the strata are drawn per FRAGMENT at their true thickness, baked
   * occupancy AO so a bore hole carries contact shadow, and the per-tile
   * surface tint that keeps terrain types legible on the top. */
  g.setAttribute('aCutDepth', new THREE.BufferAttribute(s.cutDepth, 1));
  g.setAttribute('aAO', new THREE.BufferAttribute(s.ao, 1));
  g.setAttribute('aTint', new THREE.BufferAttribute(s.tint, 3));
  g.setIndex(new THREE.BufferAttribute(s.indices, 1));
  g.computeBoundingSphere();
  return g;
}

/**
 * Fold every slab's per-dual-column maximum into one drawn-top field, then into
 * the per-voxel-column field the samplers and the water bed read.
 *
 * Each lattice cell has exactly one owning slab, so a column's drawn top is the
 * max of the slab partials in its stack — exact, not approximate. Voxel column
 * x reads dual columns x+1 and x+2, which is why the voxel fold trails the dual
 * one by two.
 */
function foldDrawnTops(
  slabs: Map<number, SlabEntry>,
  cells: number,
): { dualTopY: Float32Array; columnTopY: Float32Array } {
  const cn = cells + 1;
  const dualTopY = new Float32Array(cn * cn).fill(-Infinity);
  for (const e of slabs.values()) {
    const { x0, z0, w, h } = e.dualRect;
    for (let lz = 0; lz < h; lz++) {
      for (let lx = 0; lx < w; lx++) {
        const v = e.dualTopY[lz * w + lx];
        if (v === -Infinity) continue;
        const i = (z0 + lz) * cn + (x0 + lx);
        if (v > dualTopY[i]) dualTopY[i] = v;
      }
    }
  }

  const columnTopY = new Float32Array(cells * cells).fill(-Infinity);
  for (let z = 0; z < cells; z++) {
    for (let x = 0; x < cells; x++) {
      let sum = 0;
      let hits = 0;
      for (let dz = 0; dz <= 1; dz++) {
        for (let dx = 0; dx <= 1; dx++) {
          const lx = x + 1 + dx;
          const lz = z + 1 + dz;
          if (lx >= cn || lz >= cn) continue;
          const v = dualTopY[lz * cn + lx];
          if (v === -Infinity) continue;
          sum += v;
          hits++;
        }
      }
      columnTopY[z * cells + x] = hits > 0 ? sum / hits : -Infinity;
    }
  }
  return { dualTopY, columnTopY };
}

/**
 * A bilinear sampler over the drawn-top field, in TILE coordinates.
 *
 * Column x sits at world x = x * cellM, and tile coordinates ARE world XZ on
 * this map (one tile is one unit). A column with nothing drawn over it — outside
 * the arena rectangle, where the heightfield owns the ground — reports
 * `-Infinity`, and the caller's own fallback surface takes over there.
 */
export function makeArenaSurfaceSampler(
  columnTopY: Float32Array,
  cells: number,
  cellM: number,
  fallback: (tileX: number, tileZ: number) => number,
): (tileX: number, tileZ: number) => number {
  return (tileX, tileZ) => {
    const fx = tileX / cellM;
    const fz = tileZ / cellM;
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    if (ix < 0 || iz < 0 || ix >= cells - 1 || iz >= cells - 1) return fallback(tileX, tileZ);
    const ax = fx - ix;
    const az = fz - iz;
    const a = columnTopY[iz * cells + ix];
    const b = columnTopY[iz * cells + ix + 1];
    const c = columnTopY[(iz + 1) * cells + ix];
    const d = columnTopY[(iz + 1) * cells + ix + 1];
    if (a === -Infinity || b === -Infinity || c === -Infinity || d === -Infinity) {
      return fallback(tileX, tileZ);
    }
    return (
      a * (1 - ax) * (1 - az) + b * ax * (1 - az) + c * (1 - ax) * az + d * ax * az
    );
  };
}

const VolumeArenaGround: React.FC<VolumeArenaGroundProps> = ({
  mapData,
  onSurface,
  onTileClick,
  onTileHover,
}) => {
  const { width, height } = mapData.dimensions;
  const [, bump] = useState(0);
  const slabsRef = useRef<Map<number, SlabEntry>>(new Map());
  /** Slab keys a carve dirtied, in the order they were dirtied. */
  const queueRef = useRef<Array<[number, number, number]>>([]);
  const drainRef = useRef<{
    handle: ArenaVolumeHandle;
    slabs: Map<number, SlabEntry>;
    publish: () => Float32Array;
  } | null>(null);
  const worstFrameRef = useRef(0);
  /** The window of the carve currently in flight. Null on the build. */
  const windowRef = useRef<{ min: [number, number, number]; max: [number, number, number] } | null>(null);
  const worstSlabRef = useRef(0);
  const slabsDoneRef = useRef(0);
  const handleRef = useRef<ArenaVolumeHandle | null>(null);
  const surfaceRef = useRef<((x: number, z: number) => number) | null>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  /* One build per map. The tile grid is flattened into three typed arrays and
   * TRANSFERRED, so the 10,800-tile map never gets structure-cloned. */
  useEffect(() => {
    /* No Worker, no volume ground. This is a capability check, not a fallback:
     * jsdom (every component test) has no `Worker`, and the whole build lives
     * in one. A synchronous main-thread build "just for tests" would be 800 ms
     * of work nobody is looking at and a second code path to keep honest. */
    if (typeof Worker === 'undefined') return;
    const client = createArenaVolumeClient();
    const slabs = new Map<number, SlabEntry>();
    slabsRef.current = slabs;
    let cancelled = false;
    const t0 = performance.now();

    client.build(arenaTilesFromMapData(mapData), {
      onFill: (h) => {
        if (cancelled) return;
        handleRef.current = h;
        const mat = makeSubstanceGroundMaterial(h.biomeStack);
        /* World-locked noise needs no rebase here: an arena spans 0..120 units,
         * well inside the range float32 hashes cleanly, so the scene IS world
         * space and the shift is zero. The streamed world needs the wrap
         * because cell 785 sits tens of kilometres out. */
        mat.userData.shiftM = [0, 0, 0];
        mat.userData.cellM = h.cellM;
        mat.userData.originM = h.originM;
        /* The SHIPPED value, unchanged: the arena has drawn its top-surface
         * tint at full strength since slice 1, and this slice does not move it.
         * `?tintmix=` overrides it for the A/B frames only. */
        mat.userData.tintMix = arenaTintMixOverride() ?? ARENA_TINT_MIX;
        materialRef.current?.dispose();
        materialRef.current = mat;
      },
      onSlab: (s) => {
        if (cancelled) return;
        const h = handleRef.current;
        if (!h) return;
        const a = Math.ceil((h.cells + 1) / ARENA_SLAB_XZ);
        slabs.set(slabKey(s.cx, s.cy, s.cz, a), {
          geometry: slabGeometry(s),
          dualTopY: s.dualTopY,
          dualRect: s.dualRect,
        });
        bump((n) => n + 1);
      },
      onDone: (stats) => {
        if (cancelled) return;
        const h = handleRef.current;
        if (!h) return;
        /* Refold the drawn tops and hand the host a fresh sampler. Called again
         * after every carve: a crater that changes the mesh but not the height
         * everything stands on leaves tokens hovering over their own hole. */
        const sampler = (x: number, z: number) => surfaceRef.current!(x, z);

        /* THE ONE CARVE, in two halves.
         *
         * The VOXELS change now: `applyBrush` edits the single live volume in
         * half a millisecond, so the ground is already dug the instant the
         * spell lands and every question about what the world is made of has
         * the new answer immediately.
         *
         * The MESH catches up over the next few frames. Re-meshing the twelve
         * slabs a crater touches is about 160 ms of work, and a combat map that
         * stops for a sixth of a second every time something explodes is a map
         * with a bug in it. The queue is drained under a per-frame budget and
         * the drawn surface is republished once, when the last slab lands —
         * publishing per slab would hand the tokens a half-carved ground and
         * make them hop. */
        const carve = (
          tileX: number,
          tileZ: number,
          radiusM = 3,
          depthM = 0,
        ) => {
          const t = performance.now();
          const y = sampler(tileX, tileZ);
          const res = applyBrush(
            { volume: h.volume, cellM: h.cellM, cellHM: h.cellHM, originM: h.originM },
            [tileX, (Number.isFinite(y) ? y : 0) - depthM, tileZ],
            { shape: 'sphere', mode: 'dig', radiusM },
            h.biomeStack,
          );
          for (const key of slabsInRegion(h, res.min, res.max)) queueRef.current.push(key);
          windowRef.current = res.changed > 0 ? { min: res.min, max: res.max } : null;
          drainRef.current = { handle: h, slabs, publish };
          return { ...res, ms: performance.now() - t };
        };

        const publish = (): Float32Array => {
          const { columnTopY } = foldDrawnTops(slabs, h.cells);
          const s = makeArenaSurfaceSampler(columnTopY, h.cells, h.cellM, () => -Infinity);
          surfaceRef.current = s;
          onSurface?.({
            sampleY: s,
            handle: h,
            columnTopY,
            carve,
            carveWindow: windowRef.current,
          });
          return columnTopY;
        };
        publish();
        if (typeof window !== 'undefined' && canUseDevTools()) {
          (window as unknown as { __bmArena?: unknown }).__bmArena = {
            stats: () => ({
              cells: h.cells,
              cellsY: h.cellsY,
              cellM: h.cellM,
              cellHM: h.cellHM,
              tintMix: (materialRef.current?.userData.tintMix as number) ?? 0,
              originM: h.originM,
              topOccupiedCell: h.topOccupiedCell,
              fillMs: h.fillMs,
              meshMs: stats.meshMs,
              wallMs: Math.round(performance.now() - t0),
              slabs: stats.slabs,
              solidCells: h.solidCells,
              volume: h.volume.stats(),
            }),
            surfaceY: (x: number, z: number) => sampler(x, z),
            volume: h.volume,
            /** Slabs still waiting to be re-meshed. 0 means the carve is drawn. */
            carvePending: () => queueRef.current.length,
            /** Worst single frame and worst single SLAB any carve has cost, ms. */
            worstCarveFrameMs: () => worstFrameRef.current,
            /* CAPTURE AID, dev surfaces only. Drains the whole queue now
             * instead of over frames, so a headless rig on a software
             * rasterizer — where one frame is a second, not a sixtieth —
             * can photograph a finished crater. It runs the SAME re-mesh and
             * the SAME publish the budgeted drain runs; the only thing it
             * skips is the waiting. */
            carveFlush: () => {
              const d = drainRef.current;
              if (!d) return 0;
              const t = performance.now();
              let n = 0;
              while (queueRef.current.length > 0) {
                remeshSlab(d.handle, d.slabs, queueRef.current.shift() as [number, number, number]);
                n++;
              }
              d.publish();
              drainRef.current = null;
              bump((k) => k + 1);
              return { slabs: n, ms: +(performance.now() - t).toFixed(1) };
            },
            carveStats: () => ({
              pending: queueRef.current.length,
              slabsDone: slabsDoneRef.current,
              worstFrameMs: +worstFrameRef.current.toFixed(1),
              worstSlabMs: +worstSlabRef.current.toFixed(1),
            }),
            /* The dev carve hook calls the SAME function live combat does. */
            carve,
            /* THE PALETTE A/B. `uTintMix` blends the per-tile surface tint onto
             * the weathered TOP only; the cut faces are never tinted, so a
             * crater still shows the arena's true strata at any mix. Live so
             * three frames of the same view can be shot without a reload, and
             * `?tintmix=` sets it before the first frame. Nothing about the
             * shipped value changes here — see the material's own note. */
            setTintMix: (v: number) => {
              const mat = materialRef.current;
              if (!mat) return null;
              const mix = Math.min(1, Math.max(0, v));
              mat.userData.tintMix = mix;
              const sh = mat.userData.shader as
                | { uniforms: Record<string, { value: number }> }
                | undefined;
              if (sh?.uniforms.uTintMix) sh.uniforms.uTintMix.value = mix;
              bump((n) => n + 1);
              return mix;
            },
          };
        }
        bump((n) => n + 1);
      },
    });

    return () => {
      cancelled = true;
      client.dispose();
      for (const e of slabs.values()) e.geometry.dispose();
      slabs.clear();
      handleRef.current = null;
      surfaceRef.current = null;
      onSurface?.(null);
      if (typeof window !== 'undefined') {
        delete (window as unknown as { __bmArena?: unknown }).__bmArena;
      }
    };
    // The build is keyed to the map identity alone; nothing else re-runs it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapData]);

  useEffect(() => () => materialRef.current?.dispose(), []);

  /* THE DRAIN. Nothing runs here unless a carve queued work, so an untouched
   * board pays one array-length check per frame. */
  useFrame(() => {
    const q = queueRef.current;
    const d = drainRef.current;
    if (q.length === 0 || !d) return;
    const t0 = performance.now();
    let did = 0;
    /* Budget checked BEFORE a slab, never during: a half-meshed slab is a hole
     * in the ground, and there is no such thing as resuming one. */
    while (q.length > 0 && (did === 0 || performance.now() - t0 < CARVE_FRAME_BUDGET_MS)) {
      const ts = performance.now();
      remeshSlab(d.handle, d.slabs, q.shift() as [number, number, number]);
      const slabMs = performance.now() - ts;
      if (slabMs > worstSlabRef.current) worstSlabRef.current = slabMs;
      slabsDoneRef.current++;
      did++;
    }
    const ms = performance.now() - t0;
    if (ms > worstFrameRef.current) worstFrameRef.current = ms;
    if (q.length === 0) {
      d.publish();
      drainRef.current = null;
    }
    bump((n) => n + 1);
  });

  /* Picking. The heightfield has a hole where this ground draws, so the tile a
   * click resolves to has to come from here or the middle of the board stops
   * responding to the mouse. Same height-aware resolution the heightfield used. */
  const handleClick = useMemo(() => {
    if (!onTileClick) return undefined;
    return (e: ThreeEvent<MouseEvent>) => {
      const p = e.intersections[0]?.point;
      if (!p) return;
      e.stopPropagation();
      const coords = resolveTerrainTileCoordinates(
        { x: p.x, y: p.y, z: p.z },
        { width, height },
        { sampleHeight: surfaceRef.current ?? undefined },
      );
      if (!coords) return;
      const tile = mapData.tiles.get(`${coords.x}-${coords.y}`);
      if (tile) onTileClick(tile);
    };
  }, [mapData, onTileClick, width, height]);

  const lastHover = useRef<string | null>(null);
  const handlePointerMove = useMemo(() => {
    if (!onTileHover) return undefined;
    return (e: ThreeEvent<PointerEvent>) => {
      const p = e.intersections[0]?.point;
      if (!p) return;
      const coords = resolveTerrainTileCoordinates(
        { x: p.x, y: p.y, z: p.z },
        { width, height },
        { sampleHeight: surfaceRef.current ?? undefined },
      );
      if (!coords) return;
      const id = `${coords.x}-${coords.y}`;
      if (lastHover.current === id) return;
      lastHover.current = id;
      const tile = mapData.tiles.get(id);
      if (tile) onTileHover(tile);
    };
  }, [mapData, onTileHover, width, height]);

  const material = materialRef.current;
  if (!material) return null;

  return (
    <>
      {[...slabsRef.current.entries()].map(([key, e]) => (
        <mesh
          key={key}
          geometry={e.geometry}
          material={material}
          receiveShadow
          castShadow
          onClick={handleClick}
          onPointerMove={handlePointerMove}
        />
      ))}
    </>
  );
};

/**
 * Which slabs a carve dirtied.
 *
 * The AO probes reach five cells past a changed vertex, so the region is padded
 * before it is turned into slab indices — a carve at a slab boundary darkens
 * vertices on the far side of it, and re-meshing only the slab that changed
 * leaves a lit seam along the join. The fan is a fixed length in METRES, so the
 * padding is a different number of cells on each axis now that the cells are
 * not cubes; padding Y by the horizontal figure would leave that seam one slab
 * above every fresh crater.
 */
function slabsInRegion(
  h: ArenaVolumeHandle,
  min: readonly [number, number, number],
  max: readonly [number, number, number],
): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  if (max[0] < min[0]) return out;
  const cn = h.cells + 1;
  const cnY = h.cellsY + 1;
  const a = Math.ceil(cn / ARENA_SLAB_XZ);
  const ay = Math.ceil(cnY / ARENA_SLAB_Y);
  const padXZ = AO_REACH_CELLS + 1;
  const padY = aoReachCellsY(h.cellM, h.cellHM) + 1;
  const lo = (v: number, s: number, pad: number) => Math.max(0, Math.floor((v - pad) / s));
  const hi = (v: number, s: number, n: number, pad: number) =>
    Math.min(n - 1, Math.floor((v + pad) / s));
  for (let cy = lo(min[1], ARENA_SLAB_Y, padY); cy <= hi(max[1], ARENA_SLAB_Y, ay, padY); cy++) {
    for (let cz = lo(min[2], ARENA_SLAB_XZ, padXZ); cz <= hi(max[2], ARENA_SLAB_XZ, a, padXZ); cz++) {
      for (let cx = lo(min[0], ARENA_SLAB_XZ, padXZ); cx <= hi(max[0], ARENA_SLAB_XZ, a, padXZ); cx++) {
        out.push([cx, cy, cz]);
      }
    }
  }
  return out;
}

/** Re-mesh ONE slab in place. The unit of work the frame budget spends. */
function remeshSlab(
  h: ArenaVolumeHandle,
  slabs: Map<number, SlabEntry>,
  [cx, cy, cz]: [number, number, number],
): void {
  const cn = h.cells + 1;
  const cnY = h.cellsY + 1;
  const a = Math.ceil(cn / ARENA_SLAB_XZ);
  const arena: ArenaVolume = {
    volume: h.volume,
    cellM: h.cellM,
    cellHM: h.cellHM,
    cellsY: h.cellsY,
    originM: h.originM,
    cells: h.cells,
    topOccupiedCell: h.topOccupiedCell,
    originalTopY: h.originalTopY,
    biomeStack: h.biomeStack,
    surfaceMaterial: h.surfaceMaterial,
    fillMs: 0,
    solidCells: 0,
  };
  const datum = arenaDepthDatum(arena);
  const mesh = meshCellRange(
    h.volume,
    h.cellM,
    h.originM,
    (d) => colorAtDepth(d, h.biomeStack),
    datum,
    {
      min: [cx * ARENA_SLAB_XZ, cy * ARENA_SLAB_Y, cz * ARENA_SLAB_XZ],
      max: [
        Math.min(cn - 1, (cx + 1) * ARENA_SLAB_XZ - 1),
        Math.min(cnY - 1, (cy + 1) * ARENA_SLAB_Y - 1),
        Math.min(cn - 1, (cz + 1) * ARENA_SLAB_XZ - 1),
      ],
    },
    h.cellHM,
  );
  const key = slabKey(cx, cy, cz, a);
  slabs.get(key)?.geometry.dispose();
  slabs.delete(key);
  if (mesh.triangles === 0) return;
  slabs.set(key, {
    geometry: slabGeometry({
      kind: 'slab',
      id: 0,
      cx,
      cy,
      cz,
      positions: mesh.positions,
      normals: mesh.normals,
      cutDepth: mesh.cutDepth,
      ao: mesh.ao,
      tint: arenaSurfaceTint(arena, mesh.positions),
      indices: mesh.indices,
      triangles: mesh.triangles,
      dualTopY: mesh.dualTopY,
      dualRect: mesh.dualRect,
    }),
    dualTopY: mesh.dualTopY,
    dualRect: mesh.dualRect,
  });
}

export default VolumeArenaGround;
