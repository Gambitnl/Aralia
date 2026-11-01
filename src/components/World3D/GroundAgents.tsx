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
import { crowdArchetypeForGroup, peekCrowdArchetype } from '@/systems/entities3d/recipeFromOccupant';
import { toonGradient, ENTITY_RENDER_MODE } from '@/systems/entities3d/three/toon';
import { crowdInstancePlan, CROWD_GROUPS, type HeadingMemory } from './crowdInstancePlan';
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

/** Instance cap per (group, phase) bucket. */
const MAX_PER_BUCKET = 128;
/** Recompute cadence (s): townsfolk amble, so a few Hz is plenty + cheap. */
const RECOMPUTE_INTERVAL_S = 0.3;
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
  const sinceWrite = useRef(RECOMPUTE_INTERVAL_S); // write on first frame
  const timeRef = useRef(0);
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
  const buckets = useMemo(() => {
    if (!hasAgents) return null;
    const map = new Map<string, THREE.InstancedMesh>();
    for (const group of groups) {
      const arch = peekCrowdArchetype(group);
      if (!arch) continue;
      for (let p = 0; p <= CROWD_WALK_PHASES; p++) {
        const mesh = new THREE.InstancedMesh(arch.geometries[p], material, MAX_PER_BUCKET);
        mesh.count = 0;
        mesh.frustumCulled = false;
        map.set(`${group}:${p}`, mesh);
      }
    }
    return map;
  }, [hasAgents, material, groups, bakedCount]);
  // Source ancestries can change as chunks stream. Release only the retired
  // instance buffers; their cached shared geometry/material stay owned upstream.
  useEffect(() => () => buckets?.forEach(mesh => mesh.dispose()), [buckets]);
  // New buckets start with no instances. Write them on the next frame, so a
  // group that joins (GG-574) does not blank the crowd for one write interval.
  useEffect(() => { sinceWrite.current = RECOMPUTE_INTERVAL_S; }, [buckets]);

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (!hasAgents || !buckets) return;
    sinceWrite.current += delta;
    const override = (window as unknown as { __wfAgentClock?: number }).__wfAgentClock;
    const c = override ?? clock ?? DEFAULT_CLOCK;
    const ownershipHour = ((Math.floor(c) % 24) + 24) % 24;
    const ownershipChanged = lastOwnershipHour.current !== ownershipHour || lastBodyOwners.current !== bodyOwners?.current;
    if (sinceWrite.current < RECOMPUTE_INTERVAL_S && !ownershipChanged) return;
    sinceWrite.current = 0;
    lastOwnershipHour.current = ownershipHour;
    lastBodyOwners.current = bodyOwners?.current;
    const nodes = streetOwnedAgentNodes(
      groundAgentScenePositions(ground!, c, undefined),
      ground!.rosters,
      handoffs,
      c,
      bodyOwners?.current,
    );
    const plan = crowdInstancePlan(nodes, timeRef.current, headings.current, ancestries);

    const counts = new Map<string, number>();
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const mpc = WORLD3D_CONFIG.METERS_PER_CELL;
    for (const inst of plan) {
      const key = `${inst.group}:${inst.phaseIdx}`;
      const mesh = buckets.get(key);
      if (!mesh) continue;
      const i = counts.get(key) ?? 0;
      if (i >= MAX_PER_BUCKET) continue;
      const s = worldToScene(inst.node.gridX * mpc, inst.node.gridY * mpc, sceneOrigin);
      // baked bodies have their feet at y=0 — no half-height lift
      position.set(s.x, inst.node.surfaceY, s.z);
      q.setFromAxisAngle(up, inst.yaw);
      const k = inst.scale * figureScale;
      scale.set(k, k, k);
      matrix.compose(position, q, scale);
      mesh.setMatrixAt(i, matrix);
      counts.set(key, i + 1);
    }
    for (const [key, mesh] of buckets) {
      mesh.count = counts.get(key) ?? 0;
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
