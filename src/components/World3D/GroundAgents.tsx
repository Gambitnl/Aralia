/**
 * @file GroundAgents.tsx
 * @description Instanced townsfolk that walk the streets in WF ground mode — the
 * render rung of the agent-sim (every layer beneath is pure + tested:
 * schedule → motion → `groundAgentScenePositions` → `syncAgentInstanceMatrices`).
 *
 * Thin by design: one `<instancedMesh>` (unit box figures), a throttled `useFrame`
 * that recomputes scene-ready agent nodes for the current clock and writes their
 * matrices. Renders NOTHING unless the ground world exposes agent inputs
 * (`townPlans`/`boundsFeet`) — so it is inert in continent/PLAYING mode and cannot
 * affect the streamed scene.
 *
 * Clock source priority: `window.__wfAgentClock` (capture/scrub override) → the
 * `clock` prop (live game time) → a default commute hour, so the layer is visible
 * even before a live clock is wired.
 */
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { groundAgentScenePositions, type AgentBodyDims } from '@/systems/worldforge/bridge/groundAgentMotion';
import { generateBody } from '@/systems/worldforge/body/generateBody';
import { rootSeedPath } from '@/systems/worldforge/seedPath';
import { syncAgentInstanceMatrices } from './agentInstanceMatrices';

const FT_TO_M = 0.3048;

/** Instance buffer cap — far above any single artifact-window roster. */
const MAX_AGENTS = 600;
/** Recompute cadence (s): townsfolk amble, so a few Hz is plenty + cheap. */
const RECOMPUTE_INTERVAL_S = 0.3;
/** Default clock when nothing else supplies one (a lively morning commute). */
const DEFAULT_CLOCK = 7.5;

interface GroundAgentsProps {
  ground?: GroundWorld | null;
  /** Fractional hour (live game clock). Overridden by window.__wfAgentClock. */
  clock?: number;
  sceneOrigin: SceneOrigin;
  /** Visual size multiplier for figures (preview exaggeration). Default 1. */
  figureScale?: number;
}

const GroundAgents: React.FC<GroundAgentsProps> = ({ ground, clock, sceneOrigin, figureScale = 1 }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const sinceWrite = useRef(RECOMPUTE_INTERVAL_S); // write on first frame
  const hasAgents = !!(ground && ground.townPlans && ground.townPlans.length);

  // Parametric body dims per occupant (deterministic via generateBody) so figures
  // vary in height/build instead of being uniform boxes. Built once per roster.
  const bodyDims = useMemo<AgentBodyDims>(() => {
    const map: AgentBodyDims = new Map();
    for (const roster of ground?.rosters ?? []) {
      for (const occ of roster.occupants) {
        const p = generateBody(occ, rootSeedPath(occ.id)).proportions;
        map.set(occ.id, { heightM: p.height * FT_TO_M, widthM: p.shoulderWidth * FT_TO_M });
      }
    }
    return map;
  }, [ground]);

  useFrame((_, delta) => {
    if (!hasAgents || !meshRef.current) return;
    sinceWrite.current += delta;
    if (sinceWrite.current < RECOMPUTE_INTERVAL_S) return;
    sinceWrite.current = 0;
    const override = (window as unknown as { __wfAgentClock?: number }).__wfAgentClock;
    const c = override ?? clock ?? DEFAULT_CLOCK;
    const nodes = groundAgentScenePositions(ground!, c, bodyDims);
    const written = syncAgentInstanceMatrices(meshRef.current, nodes, sceneOrigin, figureScale);
    meshRef.current.count = written; // only draw the live instances
  });

  if (!hasAgents) return null;
  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, MAX_AGENTS]}
      castShadow={false}
      frustumCulled={false}
      data-testid="ground-agents"
    >
      {/* Unit box — `syncAgentInstanceMatrices` scales it to figure dims. */}
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#c2683a" />
    </instancedMesh>
  );
};

export default GroundAgents;
