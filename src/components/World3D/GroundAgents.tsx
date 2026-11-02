// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/08/2026, 15:06:59
 * Dependents: components/World3D/World3DScene.tsx, components/Worldforge/AgentSim3DPreview.tsx
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file GroundAgents.tsx
 * @description Instanced townsfolk that walk the streets in WF ground mode — the
 * render rung of the agent-sim (every layer beneath is pure + tested:
 * schedule → motion → `groundAgentScenePositions` → `crowdInstancePlan`).
 *
 * Figures are BAKED generated entities (src/systems/entities3d/three/crowdBake):
 * one representative body per ancestry group, baked once into
 * [idle, walk phase 0…N] keyframe geometries with vertex colors. Each agent is
 * an instance in the (group, phase) bucket its gait currently occupies, so a
 * street of walkers cycles through keyframes at instancing cost — no live
 * metaball fields. Replaced the unit-box figures 2026-07-11 (entity generator
 * slice 5).
 *
 * Renders NOTHING unless the ground world exposes agent inputs
 * (`townPlans`/`boundsFeet`) — inert in continent/PLAYING mode.
 *
 * Clock source priority: `window.__wfAgentClock` (capture/scrub override) → the
 * `clock` prop (live game time) → a default commute hour.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import type { LoadedChunk } from '@/systems/world3d/types';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import {
  groundAgentScenePositions,
  type GroundAgentSceneNode,
} from '@/systems/worldforge/bridge/groundAgentMotion';
import type { TownRoster } from '@/systems/worldforge/roster/types';
import { worldToScene } from '@/systems/world3d/sceneOrigin';
import { WORLD3D_CONFIG } from '@/systems/world3d/config';
import { registerAllParts } from '@/systems/entities3d/parts';
import { CROWD_WALK_PHASES } from '@/systems/entities3d/three/crowdBake';
import {
  CROWD_ACTIVITIES,
  stepCrowdActivityBake,
  crowdArchetypeForGroup,
  peekCrowdActivityFrames,
  peekCrowdArchetype,
} from '@/systems/entities3d/recipeFromOccupant';
import { toonGradient, ENTITY_RENDER_MODE } from '@/systems/entities3d/three/toon';
import { crowdInstancePlan, CROWD_GROUPS, type HeadingMemory } from './crowdInstancePlan';
import { createCrowdRenderClock, stepCrowdRenderClock } from './crowdRenderClock';
import {
  collectResidentHandoffIndex,
  residentAncestryIndex,
  residentIdentityKey,
  residentRenderKey,
  residentRenderOwnerAtClock,
  type ResidentHandoffRecord,
} from './InteriorOccupants';
import { streetOwnedAgentNodes } from './streetOwnedAgents';

registerAllParts();

/** Instance cap per (group, phase) bucket. Raised from 128 (NPC life,
 * 2026-11-02): with only outdoor people drawn, a busy midday market can
 * hold more than 128 idle people of one ancestry. */
const MAX_PER_BUCKET = 256;
/** Recompute cadence (s of game time at the normal rate): a full crowd pass
 * runs this often; walkers glide between two passes every frame. */
const RECOMPUTE_INTERVAL_S = 0.3;
/** Crowd level of detail: at most this many figures, nearest the camera first. */
const MAX_DRAWN = 900;
/** Figures farther than this from the camera (m) are not drawn. */
const MAX_DRAW_DISTANCE_M = 320;

/** Still crowds with activity poses redraw this often (s) for their frames. */
const ACTIVITY_REDRAW_S = 0.12;
/** The base CC0 clip pack: Idle_Talking and Idle_FoldArms for the crowd. */
const CROWD_CLIP_PACK = 'anim/humanoid/human-base-animations.glb';

/** One full crowd pass: outdoor street-owned people at one drawing clock. */
interface CrowdPass {
  clock: number;
  nodes: Map<string, GroundAgentSceneNode>;
}
/** Default clock when nothing else supplies one (a lively morning commute). */
const DEFAULT_CLOCK = 7.5;

interface GroundAgentsProps {
  ground?: GroundWorld | null;
  /** Loaded interior packets that can currently own joined resident bodies. */
  loaded: LoadedChunk[];
  /** Fractional hour (live game clock). Overridden by window.__wfAgentClock. */
  clock?: number;
  sceneOrigin: SceneOrigin;
  /** Visual size multiplier for figures (preview exaggeration). Default 1. */
  figureScale?: number;
  /** Same ten-body allocation as the interior layer; never a second person. */
  bodyOwners?: React.MutableRefObject<ReadonlySet<string>>;
}

const GroundAgents: React.FC<GroundAgentsProps> = ({ ground, loaded, clock, sceneOrigin, figureScale = 1, bodyOwners }) => {
  const timeRef = useRef(0);
  // NPC life (2026-11-02): the crowd draws from a smoothed clock (see
  // crowdRenderClock.ts) and glides walkers between two passes, so a walker no
  // longer hops 1.2 m once a game second.
  const renderClock = useRef(createCrowdRenderClock());
  const passWindow = useRef<{ a: CrowdPass; b: CrowdPass } | null>(null);
  const rewrite = useRef(true);
  const lastCam = useRef({ x: Infinity, z: Infinity });
  const sinceActivity = useRef(0);
  const headings = useRef<HeadingMemory>(new Map());
  const lastOwnershipHour = useRef<number | null>(null);
  const hasAgents = !!(ground && ground.townPlans && ground.townPlans.length);
  const lastBodyOwners = useRef<ReadonlySet<string> | undefined>(undefined);
  const handoffs = useMemo(
    () => collectResidentHandoffIndex(loaded),
    [loaded],
  );
  const ancestries = useMemo(() => residentAncestryIndex(ground?.rosters ?? [], handoffs), [ground?.rosters, handoffs]);
  const groups = useMemo(() => [...new Set([...CROWD_GROUPS, ...ancestries.values()])].sort(), [ancestries]);

  // One material + the per-group baked keyframes (bakes once per session,
  // cached module-side). ~12 groups × 7 keyframes of ~small geometry.
  const material = useMemo(
    () =>
      new THREE.MeshToonMaterial({
        vertexColors: true,
        gradientMap: toonGradient(),
        wireframe: ENTITY_RENDER_MODE === 'wireframe',
      }),
    [],
  );
  // GG-574 (2026-11-02): the first bake of all groups took about 1.9 s in one
  // useMemo during render (12+ groups x 9 poses). The groups now bake one per
  // macrotask, most common first, and each finished group joins the crowd.
  // A group that is not baked yet has no bucket, so its agents are not drawn
  // for that short time; the frame loop already skips a missing bucket.
  const [bakedCount, setBakedCount] = React.useState(0);
  useEffect(() => {
    if (!hasAgents) return;
    const order = [...CROWD_GROUPS.filter((g) => groups.includes(g)), ...groups.filter((g) => !CROWD_GROUPS.includes(g))];
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const step = () => {
      if (cancelled) return;
      const next = order.find((g) => !peekCrowdArchetype(g));
      if (!next) return;
      crowdArchetypeForGroup(next);
      setBakedCount((n) => n + 1);
      timer = setTimeout(step, 0);
    };
    timer = setTimeout(step, 0);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [hasAgents, groups]);
  // NPC life (2026-11-02): activity frames (talk, listen) come from the entity
  // generator's clip pack. The pack loads once; each group then bakes its
  // activity frames in its own macrotask, after all idle/walk groups are ready.
  // Until a group has them, its people at errand places stand in the idle pose.
  const [clips, setClips] = React.useState<Map<string, THREE.AnimationClip> | null>(null);
  useEffect(() => {
    if (!hasAgents) return;
    let live = true;
    import('@/systems/entities3d/anim/clipStore')
      .then((m) => m.loadHumanoidClips(`${import.meta.env.BASE_URL}${CROWD_CLIP_PACK}`))
      .then((loaded) => { if (live) setClips(loaded); })
      .catch((error) => {
        // Loud, not silent: the crowd keeps its idle pose at errand places.
        console.error('[GroundAgents] crowd clip pack failed to load; no talk/listen poses', error);
      });
    return () => { live = false; };
  }, [hasAgents]);
  const [activityCount, setActivityCount] = React.useState(0);
  useEffect(() => {
    if (!hasAgents || !clips) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const step = () => {
      if (cancelled) return;
      // Wait for the idle/walk bake of every group first.
      if (groups.some((g) => !peekCrowdArchetype(g))) { timer = setTimeout(step, 50); return; }
      const next = groups.find((g) => !peekCrowdActivityFrames(g));
      if (!next) return;
      // One frame per macrotask (stepCrowdActivityBake); a finished group joins.
      if (stepCrowdActivityBake(next, clips)) setActivityCount((n) => n + 1);
      timer = setTimeout(step, 0);
    };
    timer = setTimeout(step, 0);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [hasAgents, clips, groups]);
  const buckets = useMemo(() => {
    if (!hasAgents) return null;
    const map = new Map<string, THREE.InstancedMesh>();
    const add = (key: string, geometry: THREE.BufferGeometry) => {
      const mesh = new THREE.InstancedMesh(geometry, material, MAX_PER_BUCKET);
      mesh.count = 0;
      mesh.frustumCulled = false;
      map.set(key, mesh);
    };
    for (const group of groups) {
      const arch = peekCrowdArchetype(group);
      if (!arch) continue;
      for (let p = 0; p <= CROWD_WALK_PHASES; p++) add(`${group}:${p}`, arch.geometries[p]);
      const activities = peekCrowdActivityFrames(group);
      for (const a of activities ? CROWD_ACTIVITIES : []) {
        activities!.get(a.name)!.forEach((g, f) => add(`${group}:${a.name}${f}`, g));
      }
    }
    return map;
  }, [hasAgents, material, groups, bakedCount, activityCount]);
  // Source ancestries can change as chunks stream. Release only the retired
  // instance buffers; their cached shared geometry/material stay owned upstream.
  useEffect(() => () => buckets?.forEach(mesh => mesh.dispose()), [buckets]);
  // New buckets start with no instances. Write them on the next frame, so a
  // group that joins (GG-574) does not blank the crowd for one write interval.
  useEffect(() => { rewrite.current = true; }, [buckets]);
  // New interior packets change who the street owns: start a fresh window.
  useEffect(() => { passWindow.current = null; }, [handoffs, ground]);

  useFrame((state, delta) => {
    timeRef.current += delta;
    if (!hasAgents || !buckets) return;
    const override = (window as unknown as { __wfAgentClock?: number }).__wfAgentClock;
    const source = override ?? clock ?? DEFAULT_CLOCK;
    const c = stepCrowdRenderClock(renderClock.current, source, state.clock.elapsedTime);
    const ownershipHour = ((Math.floor(c) % 24) + 24) % 24;
    const ownershipChanged = lastOwnershipHour.current !== ownershipHour || lastBodyOwners.current !== bodyOwners?.current;
    lastOwnershipHour.current = ownershipHour;
    lastBodyOwners.current = bodyOwners?.current;

    // Two full passes bracket the drawing clock: A at or before it, B one
    // interval (in game time) ahead. Outdoor people only (the rest are inside).
    const passAt = (at: number): CrowdPass => {
      const nodes = streetOwnedAgentNodes(
        groundAgentScenePositions(ground!, at, undefined, { outdoorsOnly: true }),
        ground!.rosters,
        handoffs,
        at,
        bodyOwners?.current,
      );
      return { clock: at, nodes: new Map(nodes.map((n) => [n.burgId + ':' + n.occupantId, n])) };
    };
    const stepH = (RECOMPUTE_INTERVAL_S * Math.max(renderClock.current.rate, 1e-3)) / 3600;
    let w = passWindow.current;
    if (!w || ownershipChanged || c < w.a.clock || c > w.b.clock + stepH) {
      const a = passAt(c);
      w = { a, b: passAt(c + stepH) };
      rewrite.current = true;
    } else if (c >= w.b.clock) {
      w = { a: w.b, b: passAt(w.b.clock + stepH) };
      rewrite.current = true;
    }
    passWindow.current = w;
    const t = w.b.clock > w.a.clock ? Math.min(1, Math.max(0, (c - w.a.clock) / (w.b.clock - w.a.clock))) : 1;

    // Walkers glide from A to B; everyone else stands at B. A person only in
    // A has gone inside within this interval; a person only in B just left.
    const mpc = WORLD3D_CONFIG.METERS_PER_CELL;
    const camX = state.camera.position.x, camZ = state.camera.position.z;
    const drawn: Array<{ node: GroundAgentSceneNode; d: number }> = [];
    let walkers = 0;
    for (const [key, nb] of w.b.nodes) {
      const na = w.a.nodes.get(key);
      let node = nb;
      if (na && (na.moving || nb.moving)) {
        walkers++;
        const u = 1 - t;
        node = {
          ...nb,
          moving: true,
          xM: na.xM * u + nb.xM * t,
          zM: na.zM * u + nb.zM * t,
          gridX: na.gridX * u + nb.gridX * t,
          gridY: na.gridY * u + nb.gridY * t,
          surfaceY: na.surfaceY * u + nb.surfaceY * t,
        };
      }
      const sp = worldToScene(node.gridX * mpc, node.gridY * mpc, sceneOrigin);
      const d = Math.hypot(sp.x - camX, sp.z - camZ);
      if (d <= MAX_DRAW_DISTANCE_M) drawn.push({ node, d });
    }
    // Still crowds need no rewrite until the window moves; walkers do, and so
    // does a camera that moved far enough to change the nearest set. People
    // at errand places step through their talk frames a few times a second.
    const camMoved = Math.hypot(camX - lastCam.current.x, camZ - lastCam.current.z) > 8;
    sinceActivity.current += delta;
    const activityDue = activityCount > 0 && sinceActivity.current >= ACTIVITY_REDRAW_S;
    if (!rewrite.current && walkers === 0 && !camMoved && !activityDue) return;
    rewrite.current = false;
    sinceActivity.current = 0;
    lastCam.current = { x: camX, z: camZ };
    drawn.sort((x, y) => x.d - y.d);
    if (drawn.length > MAX_DRAWN) drawn.length = MAX_DRAWN;
    const plan = crowdInstancePlan(drawn.map((x) => x.node), timeRef.current, headings.current, ancestries);

    const counts = new Map<string, number>();
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (const inst of plan) {
      const activityKey = inst.activity ? inst.group + ':' + inst.activity + inst.activityFrame : undefined;
      const key = activityKey && buckets.has(activityKey) ? activityKey : inst.group + ':' + inst.phaseIdx;
      const mesh = buckets.get(key);
      if (!mesh) continue;
      const i = counts.get(key) ?? 0;
      if (i >= MAX_PER_BUCKET) continue;
      const sp = worldToScene(inst.node.gridX * mpc, inst.node.gridY * mpc, sceneOrigin);
      // baked bodies have their feet at y=0 — no half-height lift
      position.set(sp.x, inst.node.surfaceY, sp.z);
      q.setFromAxisAngle(up, inst.yaw);
      const k = inst.scale * figureScale;
      scale.set(k, k, k);
      matrix.compose(position, q, scale);
      mesh.setMatrixAt(i, matrix);
      counts.set(key, i + 1);
    }
    for (const [key, mesh] of buckets) {
      const n = counts.get(key) ?? 0;
      if (n === 0 && mesh.count === 0) continue;
      mesh.count = n;
      // An empty bucket issues no draw call; a full one uploads only its rows.
      mesh.visible = n > 0;
      mesh.instanceMatrix.clearUpdateRanges();
      mesh.instanceMatrix.addUpdateRange(0, n * 16);
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  if (!hasAgents || !buckets) return null;
  return (
    <group name="groundAgentsCrowd" data-testid="ground-agents">
      {[...buckets.entries()].map(([key, mesh]) => (
        <primitive key={key} object={mesh} />
      ))}
    </group>
  );
};

export default GroundAgents;
