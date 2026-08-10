/**
 * @file VolumeGroundBubble.tsx — the volume ground, in the live world.
 *
 * ADR 0002 decided that "the ground becomes a voxel volume in a bubble around
 * the player" and the classic heightfield holds everywhere else. Until this
 * file that bubble existed only on a sandbox page. The streamed world was still
 * what the facade audit found: one triangle layer with a wall at the frontier
 * and a floor plane under it. From below it is closed; from a cut it has no
 * inside, because there is nothing inside to have.
 *
 * This is the FIRST wiring slice, and it is deliberately narrow: a bubble is
 * built around the player from the SAME `GroundWorld` the streamed terrain
 * meshes, it is drawn with the substance material, and it joins the heightfield
 * with no visible seam. Digging and water in the live world are later slices.
 * Nothing here writes to the volume — but the volume is handed out, because the
 * next slice's carve runs on the main thread against exactly this object.
 *
 * THE BUILD NEVER BLOCKS. Fill and initial mesh both run in
 * `volumeBubbleWorker`; this file receives typed arrays whose buffers were
 * transferred, wraps them in `BufferGeometry`, and draws them. The main thread's
 * whole share of a 256³ bubble is the wrapping — no fill, no surface nets, no
 * copy of either.
 *
 * SLABS ARRIVE ONE AT A TIME, and are committed one at a time, so the ground
 * under the player draws while the rock beneath it is still being meshed.
 * React state is bumped on a coalescing timer rather than per slab: a build
 * delivers a few hundred slabs, and a re-render each would cost more than the
 * meshing did.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import {
  meshSlab,
  depthDatumFor,
  slabsForEdit,
  slabKey,
  type BubbleSlab,
  type SlabCoord,
} from '@/systems/worldforge/terrain/volumeBubbleCore';
import { colorAtDepth, substance } from '@/systems/worldforge/terrain/materials';
import { applyBrush } from '@/systems/worldforge/terrain/voxelBrush';
import { AO_REACH_CELLS } from '@/systems/worldforge/terrain/surfaceNets';
import {
  createVolumeBubbleClient,
  type BubbleVolume,
  type BubblePreCut,
} from './createVolumeBubbleClient';
import { makeSubstanceGroundMaterial, wrapShift } from './terrain/substanceGroundMaterial';

/**
 * Bubble size and cell, straight from ADR 0002: 64 m across at 25 cm, which is
 * 256³ cells. The ADR took the AREA over the DETAIL after measuring both, and
 * these are the numbers that decision produced.
 */
export const BUBBLE_EXTENT_M = 64;
export const BUBBLE_CELL_M = 0.25;

/**
 * How far the player may walk before the bubble is rebuilt around them.
 *
 * A quarter of the extent. Smaller rebuilds constantly for no visible gain;
 * larger lets the player reach the rim, where the ground is a metre under the
 * heightfield and the substance stops.
 */
const REBUILD_STEP_M = BUBBLE_EXTENT_M / 4;

/** How often committed slabs are shown, ms. See the file header. */
const COMMIT_INTERVAL_MS = 120;

export interface VolumeGroundBubbleProps {
  ground: GroundWorld | null;
  sceneOrigin: SceneOrigin;
  /** Where the player is, world meters. Null keeps the bubble at the origin. */
  playerGroundPos: { xM: number; zM: number } | null;
  /**
   * Called once per build with the voxels. The next slice's carve runs against
   * this object on the main thread; nothing else may own a second copy.
   */
  onVolume?: (v: BubbleVolume) => void;
  /** Called when a build finishes, with what it cost. For the perf report. */
  onStats?: (s: BubbleBuildStats) => void;
}

export interface BubbleBuildStats {
  fillMs: number;
  meshMs: number;
  drawnSlabs: number;
  triangles: number;
  solidCells: number;
  /** Wall-clock from the build request to the last slab, ms. */
  wallMs: number;
  /**
   * What the MAIN THREAD actually spent on this build: wrapping the
   * transferred arrays in `BufferGeometry`, rebasing them and computing their
   * bounds. This is the only work the worker cannot take, so it is the number
   * that says whether the move off-thread succeeded.
   */
  wrapMs: number;
  /** The longest single slab wrap, ms — the worst block the build can cause. */
  wrapWorstMs: number;
}

/** One drawn slab: its geometry, and where in the lattice it came from. */
interface DrawnSlab extends SlabCoord {
  geom: THREE.BufferGeometry;
}

interface LiveBubble {
  /** Bubble center in world meters — the geometry is stored relative to it. */
  shiftM: [number, number, number];
  slabs: DrawnSlab[];
  /**
   * The material for THIS bubble's ground. One per stack key, reused across
   * rebuilds — see `materialFor`.
   */
  material: THREE.MeshStandardMaterial;
}

function geometryFromSlab(slab: BubbleSlab, shiftM: readonly [number, number, number]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(slab.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(slab.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(slab.colors, 3));
  // The substance material reads these instead of the vertex color: depth so
  // the strata draw per FRAGMENT at their true thickness, and baked occupancy
  // AO so a cut carries contact shadow. Both baked at mesh time.
  g.setAttribute('aCutDepth', new THREE.BufferAttribute(slab.cutDepth, 1));
  g.setAttribute('aAO', new THREE.BufferAttribute(slab.ao, 1));
  /* The per-column top tint. A bubble is 64 m wide and the biome grid is
   * 1.524 m, so a bubble on a river bank stands on two grounds and the material
   * can only carry one; this hands the weathered top the other one back. Exactly
   * 1 everywhere the column matches the bubble's own stack. */
  g.setAttribute('aTint', new THREE.BufferAttribute(slab.tint, 3));
  g.setIndex(new THREE.BufferAttribute(slab.indices, 1));
  /* Rebase to the bubble center. The world is tens of kilometres wide and a
   * vertex buffer is float32: leaving absolute coordinates in it throws away
   * the precision the 25 cm cell depends on. */
  g.translate(-shiftM[0], -shiftM[1], -shiftM[2]);
  g.computeBoundingSphere();
  return g;
}

/**
 * Point a substance material at this build's grid, and turn its tint on.
 *
 * `onBeforeCompile` reads these out of `userData` when the program is BUILT, and
 * a material reused for a second bubble at a new centre never rebuilds its
 * program — the shader source is identical, so three.js hands back the cached
 * one. Writing `userData` alone would then leave the world-locked noise anchored
 * to wherever the player first stood, and the cell snap pointing at a lattice
 * 64 m away. So the uniforms are written DIRECTLY once the shader exists, and
 * `needsUpdate` is only the first-compile path.
 */
function aimMaterial(
  m: THREE.MeshStandardMaterial,
  shiftM: readonly [number, number, number],
  cellM: number,
  originM: readonly [number, number, number],
): void {
  m.userData.shiftM = shiftM;
  m.userData.cellM = cellM;
  m.userData.originM = originM;
  m.userData.tintMix = 1;
  const shader = m.userData.shader as
    | { uniforms: Record<string, { value: unknown }> }
    | undefined;
  if (!shader) {
    m.needsUpdate = true;
    return;
  }
  (shader.uniforms.uShift.value as THREE.Vector3).fromArray(wrapShift(shiftM));
  (shader.uniforms.uGridOrigin.value as THREE.Vector3).fromArray(wrapShift(originM));
  shader.uniforms.uCellM.value = cellM;
  shader.uniforms.uTintMix.value = 1;
}

const VolumeGroundBubble: React.FC<VolumeGroundBubbleProps> = ({
  ground,
  sceneOrigin,
  playerGroundPos,
  onVolume,
  onStats,
}) => {
  const [bubble, setBubble] = useState<LiveBubble | null>(null);
  const { camera, gl, scene } = useThree();
  const statsRef = useRef<BubbleBuildStats | null>(null);
  const clientRef = useRef<ReturnType<typeof createVolumeBubbleClient> | null>(null);
  /** Where the live build is centered, world meters. Null before the first. */
  const centerRef = useRef<{ x: number; z: number } | null>(null);
  /** The live voxels and their datum — what a bore edits. */
  const volumeRef = useRef<BubbleVolume | null>(null);
  /**
   * One material per ground type, for the component's life.
   *
   * A shader that hardcoded forest litter needed exactly one. A bubble that is
   * peat in the marsh and scree on the ridge needs one per stack, and a player
   * walking a shoreline crosses back and forth — rebuilding the program each
   * time would recompile a 500-line fragment shader mid-stride. Keyed by the
   * stack name the worker reports.
   */
  const materialsRef = useRef(new Map<string, THREE.MeshStandardMaterial>());

  // One worker per GroundWorld. It is init'd with the world, so a new world is
  // a new worker.
  useEffect(() => {
    if (!ground) return undefined;
    const client = createVolumeBubbleClient(ground);
    clientRef.current = client;
    return () => {
      client.dispose();
      clientRef.current = null;
      centerRef.current = null;
      setBubble(null);
    };
  }, [ground]);

  /**
   * A rig override for where the bubble is built, world meters.
   *
   * The bubble follows the player, and a player stands in exactly one place per
   * window — so a contact sheet comparing peat against sand against scree could
   * only ever be shot at whatever ground the spawn happened to land on. This
   * moves the bubble instead. Null in play; only `__volBubble.at()` sets it, and
   * only a capture rig calls that.
   *
   * The streamed terrain loads four chunks around the PLAYER, so a point more
   * than about 500 m away has no heightfield under it to join.
   */
  const [rigCenter, setRigCenter] = useState<{
    x: number;
    z: number;
    cut?: BubblePreCut;
  } | null>(null);

  // Build, and rebuild when the player has walked far enough.
  const px = rigCenter?.x ?? playerGroundPos?.xM ?? sceneOrigin.x;
  const pz = rigCenter?.z ?? playerGroundPos?.zM ?? sceneOrigin.z;
  const rigCut = rigCenter?.cut;
  useEffect(() => {
    const client = clientRef.current;
    if (!ground || !client) return undefined;
    const at = centerRef.current;
    if (at && !rigCut && Math.hypot(px - at.x, pz - at.z) < REBUILD_STEP_M) return undefined;
    centerRef.current = { x: px, z: pz };

    const t0 = performance.now();
    let shiftM: [number, number, number] = [px, 0, pz];
    let triangles = 0;
    let fillMs = 0;
    let solidCells = 0;
    let wrapMs = 0;
    let wrapWorstMs = 0;
    let live: LiveBubble | null = null;
    let timer: number | null = null;

    /* Show what has arrived, at most every COMMIT_INTERVAL_MS. The geometry
     * array is copied on each commit so React sees a new value; the geometries
     * themselves are shared, never rebuilt. */
    const show = (): void => {
      timer = null;
      if (!live) return;
      setBubble({ shiftM: live.shiftM, slabs: live.slabs.slice(), material: live.material });
    };

    client.build({
      centerXM: px,
      centerZM: pz,
      extentM: BUBBLE_EXTENT_M,
      cellM: BUBBLE_CELL_M,
      preCut: rigCut,
      onFill: (v) => {
        fillMs = v.fillMs;
        solidCells = v.solidCells;
        const half = (v.cellsPerEdge * v.cellM) / 2;
        shiftM = [v.originM[0] + half, v.originM[1] + half, v.originM[2] + half];
        /* THE BUBBLE'S GROUND DECIDES ITS SHADER. `stackKey` names the ground
         * most of these columns stand on, and the strata a cut face shows are
         * that stack's — which is why a mountain bubble now bores into rock
         * rather than into forest subsoil. */
        let mat = materialsRef.current.get(v.stackKey);
        if (!mat) {
          mat = makeSubstanceGroundMaterial(v.stack);
          materialsRef.current.set(v.stackKey, mat);
        }
        aimMaterial(mat, shiftM, v.cellM, v.originM);
        live = { shiftM, slabs: [], material: mat };
        volumeRef.current = v;
        onVolume?.(v);
      },
      onSlab: (slab) => {
        if (!live) return;
        const w0 = performance.now();
        live.slabs.push({
          cx: slab.cx,
          cy: slab.cy,
          cz: slab.cz,
          geom: geometryFromSlab(slab, live.shiftM),
        });
        const dt = performance.now() - w0;
        wrapMs += dt;
        if (dt > wrapWorstMs) wrapWorstMs = dt;
        triangles += slab.triangles;
        if (timer === null) timer = window.setTimeout(show, COMMIT_INTERVAL_MS);
      },
      onDone: (s) => {
        if (timer !== null) window.clearTimeout(timer);
        show();
        const stats: BubbleBuildStats = {
          fillMs,
          meshMs: s.meshMs,
          drawnSlabs: s.drawnSlabs,
          triangles,
          solidCells,
          wallMs: Math.round(performance.now() - t0),
          wrapMs: +wrapMs.toFixed(1),
          wrapWorstMs: +wrapWorstMs.toFixed(1),
        };
        statsRef.current = stats;
        onStats?.(stats);
      },
    });

    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
    // `onVolume` and `onStats` are stable for the component's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ground, px, pz, rigCut]);

  // Retire the geometries of a superseded build. Held until React has stopped
  // rendering them — disposing a geometry that then draws again re-uploads it.
  const shownRef = useRef<THREE.BufferGeometry[]>([]);
  useEffect(() => {
    const nowShown = (bubble?.slabs ?? []).map((s) => s.geom);
    const stale = shownRef.current.filter((g) => !nowShown.includes(g));
    for (const g of stale) g.dispose();
    shownRef.current = nowShown;
  }, [bubble]);
  const materials = materialsRef.current;
  useEffect(
    () => () => {
      for (const g of shownRef.current) g.dispose();
      shownRef.current = [];
      for (const m of materials.values()) m.dispose();
      materials.clear();
    },
    [materials],
  );

  /* A scriptable handle, the same contract the sandbox's `__volCam` and
   * BattleMap's `__bm3dCam` already publish. A headless rig cannot judge a
   * ground join from a default camera 60 m up: it has to stand at the rim and
   * look along it. The handle also carries the build's own numbers, so a perf
   * claim in a report is read off the running page rather than inferred. */
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__volBubble = {
      stats: () => statsRef.current,
      center: () => (bubble ? bubble.shiftM : null),
      /** Where the bubble sits in SCENE coordinates — what a camera needs. */
      scenePos: () =>
        bubble
          ? [bubble.shiftM[0] - sceneOrigin.x, bubble.shiftM[1], bubble.shiftM[2] - sceneOrigin.z]
          : null,
      slabs: () => bubble?.slabs.length ?? 0,
      /**
       * The top of the voxel column at a world point, world metres, with the
       * substance found there — the instrument that says whether a carve
       * actually moved the ground rather than whether a screenshot looks like it
       * did. Returns null outside the bubble.
       */
      probe: (xM: number, zM: number) => {
        const v = volumeRef.current;
        if (!v) return null;
        const ix = Math.floor((xM - v.originM[0]) / v.cellM);
        const iz = Math.floor((zM - v.originM[2]) / v.cellM);
        if (ix < 0 || iz < 0 || ix >= v.cellsPerEdge || iz >= v.cellsPerEdge) return null;
        for (let y = v.cellsPerEdge - 1; y >= 0; y--) {
          const m = v.volume.get(ix, y, iz);
          if (m !== 0) {
            const topY = v.originM[1] + (y + 1) * v.cellM;
            const datumY = v.originalTopY[iz * v.cellsPerEdge + ix];
            return {
              topY: +topY.toFixed(3),
              datumY: +datumY.toFixed(3),
              dropM: +(datumY - topY).toFixed(3),
              substance: substance(m).label,
            };
          }
        }
        return { topY: null, datumY: v.originalTopY[iz * v.cellsPerEdge + ix], dropM: null, substance: 'air' };
      },
      /**
       * Rebuild the bubble around a world point. See `rigCenter`.
       * `at(null)` gives it back to the player.
       */
      at: (xM: number | null, zM?: number, cut?: BubblePreCut) => {
        centerRef.current = null;
        setRigCenter(xM === null ? null : { x: xM, z: zM ?? 0, cut });
      },
      /**
       * What this bubble is made of. A capture rig judging "is a desert bubble
       * sand" must not infer the answer from the tone it is judging.
       */
      groundInfo: () => {
        const v = volumeRef.current;
        if (!v) return null;
        return {
          stackKey: v.stackKey,
          bands: v.stack.map((b) => ({
            substance: substance(b.substance).label,
            depthM: b.depthM,
          })),
          stackCounts: v.stackCounts,
          minorityShare: +v.minorityShare.toFixed(4),
        };
      },
      /**
       * Bore a crater at a world point and re-mesh what it touched.
       *
       * The campaign's whole claim is that this ground has an INSIDE, and the
       * only proof of that is a cut face. Nothing in the live world digs yet, so
       * this is the rig verb that makes one: `applyBrush` against the one live
       * volume — the object `onVolume` hands out, never a copy — then a re-mesh
       * of the slabs the edit reached.
       *
       * The re-mesh window is padded by `AO_REACH_CELLS`, because baked
       * occupancy AO reads several cells out: a slab re-meshed to its own bounds
       * leaves a lit seam along every boundary the crater crossed.
       */
      carve: (
        xM: number,
        zM: number,
        radiusM: number,
        depthM: number,
        /**
         * `trench` follows the ground down each column, so its walls are the
         * full depth everywhere and a section reads its strata as horizontal
         * bands. A `bore` is a sphere: a bowl, which shows the layers as
         * concentric rings and is the wrong picture for judging a stack.
         */
        shape: 'trench' | 'bore' = 'trench',
        lengthM = 24,
        axis: 'x' | 'z' = 'x',
      ) => {
        const v = volumeRef.current;
        const live = bubble;
        if (!v || !live) return null;
        const t0 = performance.now();
        const cell = (m: number, o: number): number =>
          Math.min(v.cellsPerEdge - 1, Math.max(0, Math.floor((m - o) / v.cellM)));
        const topY = v.originalTopY[cell(zM, v.originM[2]) * v.cellsPerEdge + cell(xM, v.originM[0])];
        const r = applyBrush(
          { volume: v.volume, cellM: v.cellM, originM: v.originM },
          shape === 'trench' ? [xM, topY, zM] : [xM, topY - depthM + radiusM, zM],
          shape === 'trench'
            ? { shape: 'ditch', mode: 'dig', radiusM, heightM: depthM, lengthM, axis }
            : { shape: 'sphere', mode: 'dig', radiusM },
          v.stack,
        );
        if (r.changed === 0) return { changed: 0, remeshed: 0, added: 0, ms: 0 };

        const datum = depthDatumFor(v.originalTopY, v.originM, v.cellM, v.cellsPerEdge);
        /* Resolved against the SLAB PLAN, not against what is being drawn: the
         * floor of a cut belongs to a buried slab that meshed to nothing at
         * build time and was therefore never delivered. See `slabsForEdit`. */
        const touched = slabsForEdit(v.cellsPerEdge, r.min, r.max, AO_REACH_CELLS + 1);
        const touchedKeys = new Set(touched.map(slabKey));
        const next: DrawnSlab[] = live.slabs.filter((s) => !touchedKeys.has(slabKey(s)));
        const had = live.slabs.length - next.length;
        const perSlab: Record<string, number> = {};
        let drawn = 0;
        for (const s of touched) {
          const fresh = meshSlab(
            v.volume,
            v.cellM,
            v.originM,
            (d) => colorAtDepth(d, v.stack),
            datum,
            s,
            /* A cut is inside ONE column's ground by construction — it is metres
             * wide and the tint is a top-surface signal, so the fresh vertices
             * keep the bubble's own reference of 1. */
            undefined,
          );
          perSlab[slabKey(s)] = fresh?.triangles ?? 0;
          if (!fresh) continue;
          drawn++;
          next.push({ cx: s.cx, cy: s.cy, cz: s.cz, geom: geometryFromSlab(fresh, live.shiftM) });
        }
        setBubble({ shiftM: live.shiftM, slabs: next, material: live.material });
        return {
          changed: r.changed,
          remeshed: touched.length,
          /** Slabs that hold geometry now and held none before — the cut's floor. */
          added: drawn - had,
          cellRange: { min: r.min, max: r.max },
          perSlab,
          ms: +(performance.now() - t0).toFixed(1),
        };
      },
      renderInfo: () => ({
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
      }),
      /** The camera's live pose — proves whether `setCam` survived the frame. */
      cam: () => ({
        pos: camera.position.toArray(),
        dir: camera.getWorldDirection(new THREE.Vector3()).toArray(),
      }),
      /** Place the camera in SCENE coordinates and aim it. */
      setCam: (pos: [number, number, number], look: [number, number, number]) => {
        camera.position.set(pos[0], pos[1], pos[2]);
        camera.lookAt(look[0], look[1], look[2]);
        camera.updateProjectionMatrix();
      },
      /** Hide or show the bubble, so the join can be A/B'd against bare ground. */
      setVisible: (on: boolean) => {
        scene.traverse((o) => {
          if (o.name === 'world3d:volumeBubble') o.visible = on;
        });
      },
      /**
       * Hide or show the streamed heightfield.
       *
       * A capture verb, and it exists because of a fault worth naming: the
       * bubble is a LID. It sits about 30 cm over the heightfield, and the
       * heightfield is never cut, so anything dug into the bubble exposes the
       * terrain skin rather than the bubble's own strata — the hole reads as a
       * flat pale patch in the terrain's tint, not as a trench with walls. The
       * arena solved the same problem by cutting a hole in its heightfield;
       * nothing here does yet. Until something does, the only way to PICTURE a
       * cut face in the live world is to stop the skin drawing for one frame.
       * Toggles `visible` only, and puts it straight back.
       */
      setTerrainVisible: (on: boolean) => {
        scene.traverse((o) => {
          if (o.name === 'world3d:terrain' || o.name === 'world3d:terrain-skirt') o.visible = on;
        });
      },
    };
    return () => {
      delete w.__volBubble;
    };
  }, [bubble, camera, gl, scene, sceneOrigin]);

  if (!bubble || bubble.slabs.length === 0) return null;

  return (
    <group
      position={[
        bubble.shiftM[0] - sceneOrigin.x,
        bubble.shiftM[1],
        bubble.shiftM[2] - sceneOrigin.z,
      ]}
    >
      {bubble.slabs.map((s, i) => (
        /* `receiveShadow` only, matching the streamed terrain. A shadow CASTER
           re-draws its geometry into the shadow map, and this bubble is a large
           share of the frame's triangles; the terrain it covers already casts
           the same silhouette. */
        <mesh
          key={s.geom.uuid ?? i}
          name="world3d:volumeBubble"
          geometry={s.geom}
          material={bubble.material}
          receiveShadow
        />
      ))}
    </group>
  );
};

export default VolumeGroundBubble;
