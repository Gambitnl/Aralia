/**
 * @file VolumeArenaWater.tsx — the arena's water, as mass rather than as a plane.
 *
 * WHAT THIS REPLACES. `WaterSystem` builds one flat sheet per water tile, pinned
 * to that tile's elevation, extended half a tile onto the shore, and never
 * changes again. It cannot fill a hole a spell just dug, it cannot drain when
 * the bank is breached, and its "flow" is a scrolling texture — the water is a
 * decoration painted over the terrain, not a quantity the world contains.
 *
 * WHAT IS HERE INSTEAD. The campaign's `ShallowWaterField`: a conservative
 * two-dimensional depth-and-discharge grid over a bed READ FROM THE VOXELS. The
 * bed changes when the ground changes, because it is derived from the ground
 * rather than stored beside it. Every cubic metre is accounted: what starts in
 * the arena, what a boundary source pours in, and what runs off the edge into
 * the ledger. A solver that quietly loses water is worse than no solver, because
 * the loss is invisible until a reservoir is mysteriously empty.
 *
 * PARKED BY DEFAULT. Nothing steps unless it is armed. A combat map opens with
 * its water SETTLED — a bounded, deterministic relaxation run once at build
 * time, which is arithmetic and not a simulation — and stays still until
 * `window.__bmWater.start()` or an explicit `flowing` prop says otherwise. That
 * is the campaign's standing rule and it also happens to be right for combat:
 * a turn-based board should not spend frame budget on a river nobody has
 * touched.
 *
 * THE BOUNDARY SOURCE, AND WHY IT IS NOT A LOOPING TEXTURE. A stream crosses the
 * arena; it comes from somewhere and it goes somewhere. Both of those are off
 * the map. So water tiles that touch the arena edge on the UPSTREAM side are a
 * source that adds real volume each step, and the field's own edge faces drain
 * to the exterior and bank what leaves in `boundaryLedgerM3`. The flow across a
 * ford is then honest mass moving downhill, and the ledger closes:
 *
 *     started + poured  ==  in the field + left the edge
 *
 * DRAWING IT. The sheet is one grid over the volume's columns, and the index
 * buffer names only the quads that may be drawn — `wetQuadIndices` with the
 * pin-and-tuck rule the campaign settled on after two generations of per-corner
 * culls that each left a visible edge. A dry shore vertex is pinned to the water
 * level of its wet neighbours and then TUCKED to just under its own ground, so
 * the sheet's edge always ends beneath the terrain skin: it cannot z-fight a
 * brim it exactly matches, cannot hang in the air over a beach, and cannot lie
 * on top of a bank. The visible waterline is the sub-cell line where the ground
 * crosses the sheet.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BattleMapData, BattleMapTile } from '../../../types/combat';
import { canUseDevTools } from '../../../utils/core';
import { BATTLE_MAP_ELEVATION_METERS_PER_UNIT } from '../../../config/mapConfig';
import { ShallowWaterField } from '@/systems/worldforge/terrain/shallowWater';
import { volumeBed, bedColumn, type VolumeBed } from '@/systems/worldforge/terrain/volumeSurface';
import { wetQuadIndices, DRY_M, TUCK_M, RELIEF_PER_CELL } from '@/components/DesignPreview/steps/waterSheet';
import { createWaterMaterial, getBiomeWaterColors } from './WaterSystem';
import type { ArenaVolumeHandle } from './createArenaVolumeClient';

/**
 * Settle steps run once at build time.
 *
 * The initial depth is "tile water level minus the voxel bed", which is right
 * on average and wrong in detail: the bed is quantized to the cell and the tile
 * level is a bilinear lattice, so the first frame would show a sheet with cell
 * relief in it. A short relaxation levels each pool exactly, and it is bounded
 * and deterministic — the same map settles the same way every time.
 */
const SETTLE_STEPS = 120;

/**
 * Settle steps run after a CARVE.
 *
 * A crater beside a stream is a new hole in the bed, and the honest picture is
 * the one where the water has already found it. Shorter than the build settle
 * because only a small window changed and the rest of the field is already at
 * rest — and still bounded, deterministic and run once, so the board stays
 * parked. Nothing here starts a simulation.
 */
const CARVE_SETTLE_STEPS = 45;

/** Seconds per settle step. Below the field's own stability limit at any depth. */
const SETTLE_DT = 1 / 60;

interface VolumeArenaWaterProps {
  mapData: BattleMapData;
  handle: ArenaVolumeHandle;
  /** Drawn top per voxel column — what the water actually rests on. */
  columnTopY: Float32Array;
  /**
   * The cell window the last carve touched, or null on a fresh map.
   *
   * The water syncs only these columns. Re-reading all 65,536 after every
   * crater is a third of a second of main-thread work spent almost entirely on
   * ground the blast never came near.
   */
  lastCarve?: { min: [number, number, number]; max: [number, number, number] } | null;
  /** Step the solver every frame. Off by default: parked is the campaign rule. */
  flowing?: boolean;
}

interface WaterRig {
  field: ShallowWaterField;
  bed: VolumeBed;
  n: number;
  geo: THREE.BufferGeometry;
  idx: Uint32Array;
  levels: Float32Array;
  depthAttr: THREE.BufferAttribute;
  posAttr: THREE.BufferAttribute;
  /** Column indices that pour water in, and how much per second, m³. */
  sourceIdx: Int32Array;
  sourceRateM3: number;
  /** Everything ever poured in by the boundary source, m³. */
  pouredM3: number;
  startedM3: number;
  cellM: number;
  /**
   * Water a RISING bed pushed out of its own column, m³.
   *
   * Carried in the ledger rather than deleted. A bed that comes up under water
   * has displaced it, not destroyed it, and a solver that quietly loses a cubic
   * metre here is the same solver nobody can trust about a reservoir later.
   */
  displacedM3: number;
}

/**
 * The water LEVEL a tile's sheet sits at, in world Y.
 *
 * Taken from the uncarved tile elevation, smoothed over the 3x3 water
 * neighbourhood and then bilinearly sampled — the same continuous lattice
 * `WaterSystem` settled on, because raw per-tile levels serrate every diagonal
 * shoreline into a tile-period sawtooth. This is the surface the arena STARTS
 * with; from the first step onward the solver owns it.
 */
function makeWaterLevelSampler(
  mapData: BattleMapData,
  width: number,
  height: number,
): { levelAt: (tx: number, tz: number) => number; isWater: (x: number, y: number) => boolean } {
  const grid: (BattleMapTile | null)[][] = [];
  for (let y = 0; y < height; y++) {
    grid[y] = [];
    for (let x = 0; x < width; x++) grid[y][x] = mapData.tiles.get(`${x}-${y}`) ?? null;
  }
  const lattice = new Float32Array(width * height);
  const known = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x]?.terrain !== 'water') continue;
      let sum = 0;
      let n = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const nb = grid[y + oy]?.[x + ox];
          if (nb?.terrain !== 'water') continue;
          sum += nb.elevation;
          n++;
        }
      }
      lattice[y * width + x] = n > 0 ? sum / n : (grid[y][x]?.elevation ?? 0);
      known[y * width + x] = 1;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (known[i]) continue;
      let sum = 0;
      let n = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (!known[ny * width + nx]) continue;
          sum += lattice[ny * width + nx];
          n++;
        }
      }
      lattice[i] = n > 0 ? sum / n : (grid[y][x]?.elevation ?? 0);
    }
  }
  const levelAt = (tx: number, tz: number): number => {
    const fx = Math.min(width - 1.001, Math.max(0, tx - 0.5));
    const fz = Math.min(height - 1.001, Math.max(0, tz - 0.5));
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const ax = fx - ix;
    const az = fz - iz;
    const i00 = lattice[iz * width + ix];
    const i10 = lattice[iz * width + Math.min(width - 1, ix + 1)];
    const i01 = lattice[Math.min(height - 1, iz + 1) * width + ix];
    const i11 = lattice[Math.min(height - 1, iz + 1) * width + Math.min(width - 1, ix + 1)];
    return (
      (i00 * (1 - ax) * (1 - az) + i10 * ax * (1 - az) + i01 * (1 - ax) * az + i11 * ax * az) *
      BATTLE_MAP_ELEVATION_METERS_PER_UNIT
    );
  };
  const isWater = (x: number, y: number) => grid[y]?.[x]?.terrain === 'water';
  return { levelAt, isWater };
}

/**
 * The drawn Y of every sheet vertex, and the pin-and-tuck rule that owns shores.
 *
 * A wet vertex draws at its own free surface. A dry vertex takes the level of
 * its wettest neighbour and is then pushed to just under its own ground —
 * `min(level, bed - TUCK_M)` — so the sheet's rim finishes beneath the terrain
 * skin instead of ending in mid air or lying on top of the bank.
 */
function computeLevels(rig: WaterRig): void {
  const { field, n, levels } = rig;
  const { bed, depth } = field;
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      if (depth[i] > DRY_M) {
        levels[i] = bed[i] + depth[i];
        continue;
      }
      let best = -Infinity;
      if (x > 0 && depth[i - 1] > DRY_M) best = Math.max(best, bed[i - 1] + depth[i - 1]);
      if (x < n - 1 && depth[i + 1] > DRY_M) best = Math.max(best, bed[i + 1] + depth[i + 1]);
      if (z > 0 && depth[i - n] > DRY_M) best = Math.max(best, bed[i - n] + depth[i - n]);
      if (z < n - 1 && depth[i + n] > DRY_M) best = Math.max(best, bed[i + n] + depth[i + n]);
      levels[i] = best === -Infinity ? bed[i] - TUCK_M : Math.min(best, bed[i] - TUCK_M);
    }
  }
}

/** Push depths, drawn heights and the index range into the geometry. */
function refreshGeometry(rig: WaterRig): void {
  const { field, n, levels, geo, idx, depthAttr, posAttr } = rig;
  computeLevels(rig);
  const pos = posAttr.array as Float32Array;
  const dep = depthAttr.array as Float32Array;
  for (let i = 0; i < n * n; i++) {
    pos[i * 3 + 1] = levels[i];
    dep[i] = Math.max(0, levels[i] - field.bed[i]);
  }
  posAttr.needsUpdate = true;
  depthAttr.needsUpdate = true;
  const count = wetQuadIndices(
    field.depth,
    n,
    idx,
    DRY_M,
    levels,
    rig.cellM * RELIEF_PER_CELL,
  );
  (geo.index as THREE.BufferAttribute).needsUpdate = true;
  geo.setDrawRange(0, count);
}

/**
 * Re-read the bed under a carved window and move the water honestly.
 *
 * The rig used to be keyed to `columnTopY`, so any carve rebuilt the whole
 * field and re-settled it from the TILES — which recomputes the water from the
 * map as though the encounter had just started, and silently throws away
 * whatever the board's water had actually done. This is the campaign's own
 * `syncBed` rule instead, applied to the columns that changed and nothing else:
 *
 * - **A bed that DROPPED (a crater) keeps its column's water MASS.** The depth
 *   does not grow to meet the old free surface, because digging a hole under a
 *   puddle does not conjure water; the surface falls and the neighbours flow in
 *   over the following steps.
 * - **A bed that ROSE displaces what it came up through.** The column keeps
 *   only what still fits; the rest is banked and poured back over the wet
 *   columns around the edit, so the total is unchanged.
 *
 * Returns the volume it had to move, for the ledger.
 */
function syncBedWindow(
  rig: WaterRig,
  handle: ArenaVolumeHandle,
  columnTopY: Float32Array,
  min: readonly [number, number, number],
  max: readonly [number, number, number],
): number {
  const { field, n, cellM } = rig;
  const t = {
    volume: handle.volume,
    cellM: handle.cellM,
    cellHM: handle.cellHM,
    originM: handle.originM,
  };
  const x0 = Math.max(0, min[0] - 1);
  const x1 = Math.min(n - 1, max[0] + 1);
  const z0 = Math.max(0, min[2] - 1);
  const z1 = Math.min(n - 1, max[2] + 1);
  const area = cellM * cellM;

  let displacedM3 = 0;
  const rim: number[] = [];
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      const i = z * n + x;
      const col = bedColumn(t, x, z, columnTopY);
      const oldBed = field.bed[i];
      const newBed = col.bedY;
      if (newBed === oldBed) {
        if (field.depth[i] > DRY_M) rim.push(i);
        continue;
      }
      field.bed[i] = newBed;
      rig.bed.bedY[i] = newBed;
      rig.bed.ceilY[i] = col.ceilY;
      rig.bed.floor[i] = col.floor;
      rig.bed.bottomless[i] = col.bottomless ? 1 : 0;
      if (newBed > oldBed) {
        // The bed came UP through the water column. Only what still fits stays.
        const room = Math.max(0, field.depth[i] - (newBed - oldBed));
        displacedM3 += (field.depth[i] - room) * area;
        field.depth[i] = room;
      }
      // A bed that dropped keeps its depth: the mass is unchanged and the free
      // surface falls with the floor. Nothing to do.
      if (field.depth[i] > DRY_M) rim.push(i);
    }
  }

  /* Give the displaced volume back. Onto the wet columns around the edit if
   * there are any — that is where the water physically went — and into the
   * boundary ledger if the edit drowned every wet cell it touched, so the
   * accounting still closes instead of the water simply ceasing to exist. */
  if (displacedM3 > 0) {
    if (rim.length > 0) {
      const per = displacedM3 / rim.length / area;
      for (const i of rim) field.depth[i] += per;
    } else {
      field.boundaryLedgerM3 += displacedM3;
    }
  }
  return displacedM3;
}

const VolumeArenaWater: React.FC<VolumeArenaWaterProps> = ({
  mapData,
  handle,
  columnTopY,
  lastCarve = null,
  flowing = false,
}) => {
  const lastCarveRef = useRef(lastCarve);
  lastCarveRef.current = lastCarve;
  const { width, height } = mapData.dimensions;
  const biome =
    (mapData as BattleMapData & { biome?: string }).biome ?? mapData.theme ?? 'forest';

  const rig = useMemo<WaterRig | null>(() => {
    const n = handle.cells;
    const cellM = handle.cellM;
    const bed = volumeBed(
      { volume: handle.volume, cellM, cellHM: handle.cellHM, originM: handle.originM },
      columnTopY,
    );
    const field = new ShallowWaterField(n, cellM);
    field.bed.set(bed.bedY);

    const { levelAt, isWater } = makeWaterLevelSampler(mapData, width, height);

    /* Fill every column whose tile is water up to that tile's level. The bed is
     * the CARVED basin the heightfield already digs under water tiles, so this
     * is a real depth and not a plane laid on the ground. */
    let started = 0;
    const sources: number[] = [];
    for (let z = 0; z < n; z++) {
      const wz = z * cellM;
      if (wz > height) continue;
      for (let x = 0; x < n; x++) {
        const wx = x * cellM;
        if (wx > width) continue;
        const tx = Math.min(width - 1, Math.floor(wx));
        const tz = Math.min(height - 1, Math.floor(wz));
        if (!isWater(tx, tz)) continue;
        const i = z * n + x;
        if (bed.bottomless[i]) continue;
        const d = levelAt(wx, wz) - field.bed[i];
        if (d <= 0) continue;
        field.depth[i] = d;
        started += d;
        /* THE SOURCE. A water tile touching the arena's boundary is where the
         * stream comes from — off the map, upstream. Those columns pour, and
         * the field's own edge faces drain, so what crosses the board is mass
         * arriving and leaving rather than a texture scrolling in place. */
        if (tx === 0 || tz === 0 || tx === width - 1 || tz === height - 1) sources.push(i);
      }
    }

    /* Pour rate from the source's own cross-section: a metre of depth over the
     * source cells, per ten seconds. Enough that a stream visibly renews, small
     * enough that a pond fed by one edge cell does not become a flood. */
    const sourceRateM3 = sources.length * cellM * cellM * 0.1;

    const pos = new Float32Array(n * n * 3);
    const uv = new Float32Array(n * n * 2);
    const dep = new Float32Array(n * n);
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const i = z * n + x;
        pos[i * 3] = handle.originM[0] + x * cellM;
        pos[i * 3 + 1] = bed.bedY[i];
        pos[i * 3 + 2] = handle.originM[2] + z * cellM;
        // World-scale UVs so the ripple frequency does not stretch with the map.
        uv[i * 2] = pos[i * 3];
        uv[i * 2 + 1] = pos[i * 3 + 2];
      }
    }
    const idx = new Uint32Array((n - 1) * (n - 1) * 6);
    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(pos, 3);
    const depthAttr = new THREE.BufferAttribute(dep, 1);
    geo.setAttribute('position', posAttr);
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('aWaterDepth', depthAttr);
    const nrm = new Float32Array(n * n * 3);
    for (let i = 0; i < n * n; i++) nrm[i * 3 + 1] = 1;
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(width / 2, 0, height / 2),
      Math.hypot(width, height),
    );

    const r: WaterRig = {
      field,
      bed,
      n,
      geo,
      idx,
      levels: new Float32Array(n * n),
      depthAttr,
      posAttr,
      sourceIdx: Int32Array.from(sources),
      sourceRateM3,
      pouredM3: 0,
      startedM3: started * cellM * cellM,
      cellM,
      displacedM3: 0,
    };

    /* Settle once, here. Bounded and deterministic — not a simulation running,
     * an initial condition being computed. */
    for (let s = 0; s < SETTLE_STEPS; s++) field.step(SETTLE_DT);
    refreshGeometry(r);
    return r;
    /* NOT keyed to `columnTopY`. A carve republishes that field, and rebuilding
     * here would recompute the arena's water from the TILES — the encounter's
     * water, whatever it had done, replaced by the map's opening condition. The
     * effect below syncs the changed columns instead.
     *
     * The initial `columnTopY` is still read, through the closure, on the build
     * this memo does run: the bed the field is born on is the drawn surface. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, mapData, width, height]);

  const { material, uniforms } = useMemo(
    () => createWaterMaterial(getBiomeWaterColors(biome)),
    [biome],
  );
  const uniformsRef = useRef(uniforms);
  uniformsRef.current = uniforms;

  const flowingRef = useRef(flowing);
  flowingRef.current = flowing;

  useEffect(() => {
    if (!rig || typeof window === 'undefined' || !canUseDevTools()) return;
    const api = {
      start: () => {
        flowingRef.current = true;
      },
      park: () => {
        flowingRef.current = false;
      },
      /** The exact ledger. Started plus poured must equal held plus escaped. */
      ledger: () => {
        const held = rig.field.volume();
        const escaped = rig.field.boundaryLedgerM3;
        return {
          startedM3: rig.startedM3,
          pouredM3: rig.pouredM3,
          heldM3: held,
          escapedM3: escaped,
          displacedM3: rig.displacedM3,
          residualM3: rig.startedM3 + rig.pouredM3 - held - escaped,
          sources: rig.sourceIdx.length,
          flowing: flowingRef.current,
        };
      },
      field: rig.field,
    };
    (window as unknown as { __bmWater?: unknown }).__bmWater = api;
    return () => {
      delete (window as unknown as { __bmWater?: unknown }).__bmWater;
    };
  }, [rig]);

  /* THE CARVE REACTION. `columnTopY` is a fresh array after every carve, so
   * this fires exactly once per carve and never on a frame. The first
   * publication is the one the rig was built on, so it is skipped. */
  const syncedRef = useRef<Float32Array | null>(null);
  useEffect(() => {
    if (!rig) return;
    if (syncedRef.current === null) {
      syncedRef.current = columnTopY;
      return;
    }
    if (syncedRef.current === columnTopY) return;
    syncedRef.current = columnTopY;
    const w = lastCarveRef.current;
    if (!w) return;
    rig.displacedM3 += syncBedWindow(rig, handle, columnTopY, w.min, w.max);
    for (let s = 0; s < CARVE_SETTLE_STEPS; s++) rig.field.step(SETTLE_DT);
    refreshGeometry(rig);
  }, [rig, handle, columnTopY]);

  useEffect(() => () => {
    rig?.geo.dispose();
  }, [rig]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state, delta) => {
    uniformsRef.current.uWaterTime.value = state.clock.elapsedTime;
    if (!rig || !flowingRef.current) return;
    /* One step per frame, clamped to the field's own stability limit. A frame
     * that took 200 ms does not get to take a 200 ms step: the scheme
     * oscillates past its CFL bound and the field fills with NaN. */
    const dt = Math.min(delta, rig.field.maxStableStep());
    if (rig.sourceIdx.length > 0) {
      const perCell = (rig.sourceRateM3 * dt) / rig.sourceIdx.length / (rig.cellM * rig.cellM);
      for (let k = 0; k < rig.sourceIdx.length; k++) {
        rig.field.depth[rig.sourceIdx[k]] += perCell;
      }
      rig.pouredM3 += rig.sourceRateM3 * dt;
    }
    rig.field.step(dt);
    refreshGeometry(rig);
  });

  if (!rig) return null;

  return <mesh geometry={rig.geo} material={material} renderOrder={2} frustumCulled={false} />;
};

export default VolumeArenaWater;
