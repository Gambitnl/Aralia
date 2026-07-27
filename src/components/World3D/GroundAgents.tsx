// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 20:25:28
 * Dependents: components/World3D/World3DScene.tsx, components/Worldforge/AgentSim3DPreview.tsx
 * Imports: 11 files
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
import React, { useMemo, useRef } from 'react';
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
import { crowdArchetypeForGroup, CROWD_WALK_PHASES } from '@/systems/entities3d/three/crowdBake';
import { toonGradient, ENTITY_RENDER_MODE } from '@/systems/entities3d/three/toon';
import { crowdInstancePlan, CROWD_GROUPS, type HeadingMemory } from './crowdInstancePlan';
import {
  collectResidentHandoffIndex,
  residentIdentityKey,
  residentRenderKey,
  residentRenderOwnerAtClock,
  type ResidentHandoffRecord,
} from './InteriorOccupants';

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
}

/**
 * Remove only roster instances whose joined interior packet owns the resident
 * at this clock. Unmatched/legacy residents remain street-owned, and the stable
 * member-key equality prevents a coincident numeric id from hiding a stranger.
 */
export function streetOwnedAgentNodes(
  nodes: GroundAgentSceneNode[],
  rosters: TownRoster[],
  handoffs: ReadonlyMap<string, ResidentHandoffRecord>,
  clock: number,
): GroundAgentSceneNode[] {
  const rosterIdentityByRenderKey = new Map<string, string>();
  for (const roster of rosters) {
    for (const occupant of roster.occupants) {
      if (occupant.householdMemberId === undefined) continue;
      rosterIdentityByRenderKey.set(
        residentRenderKey(roster.burgId, occupant.id),
        residentIdentityKey(roster.burgId, occupant.householdMemberId),
      );
    }
  }

  return nodes.filter((node) => {
    const renderKey = residentRenderKey(node.burgId, node.occupantId);
    const handoff = handoffs.get(renderKey);
    const rosterIdentity = rosterIdentityByRenderKey.get(renderKey);
    if (!handoff || !rosterIdentity || handoff.stableKey !== rosterIdentity) {
      return true;
    }
    return residentRenderOwnerAtClock(handoff.occupant, clock) === 'street';
  });
}

const GroundAgents: React.FC<GroundAgentsProps> = ({ ground, loaded, clock, sceneOrigin, figureScale = 1 }) => {
  const sinceWrite = useRef(RECOMPUTE_INTERVAL_S); // write on first frame
  const timeRef = useRef(0);
  const headings = useRef<HeadingMemory>(new Map());
  const lastOwnershipHour = useRef<number | null>(null);
  const hasAgents = !!(ground && ground.townPlans && ground.townPlans.length);
  const loadedKey = loaded.map((chunk) => `${chunk.cx}|${chunk.cy}`).join(',');
  const handoffs = useMemo(
    () => collectResidentHandoffIndex(loaded),
    // Chunk membership is the stable ownership-packet boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadedKey],
  );

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
  const buckets = useMemo(() => {
    if (!hasAgents) return null;
    const map = new Map<string, THREE.InstancedMesh>();
    for (const group of CROWD_GROUPS) {
      const arch = crowdArchetypeForGroup(group);
      for (let p = 0; p <= CROWD_WALK_PHASES; p++) {
        const mesh = new THREE.InstancedMesh(arch.geometries[p], material, MAX_PER_BUCKET);
        mesh.count = 0;
        mesh.frustumCulled = false;
        map.set(`${group}:${p}`, mesh);
      }
    }
    return map;
  }, [hasAgents, material]);

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (!hasAgents || !buckets) return;
    sinceWrite.current += delta;
    const override = (window as unknown as { __wfAgentClock?: number }).__wfAgentClock;
    const c = override ?? clock ?? DEFAULT_CLOCK;
    const ownershipHour = ((Math.floor(c) % 24) + 24) % 24;
    const ownershipChanged = lastOwnershipHour.current !== ownershipHour;
    if (sinceWrite.current < RECOMPUTE_INTERVAL_S && !ownershipChanged) return;
    sinceWrite.current = 0;
    lastOwnershipHour.current = ownershipHour;
    const nodes = streetOwnedAgentNodes(
      groundAgentScenePositions(ground!, c, undefined),
      ground!.rosters,
      handoffs,
      c,
    );
    const plan = crowdInstancePlan(nodes, timeRef.current, headings.current);

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
