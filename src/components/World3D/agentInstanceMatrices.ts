/**
 * @file agentInstanceMatrices.ts
 * @description Matrix writer for the instanced townsfolk layer (`<GroundAgents>`).
 *
 * The pure, testable core of the 3D agent-walking render rung (the rest of the
 * data pipeline — schedule → motion → `groundAgentScenePositions` — is already
 * built/tested). Given scene-ready agent nodes (`gridX/gridY` pseudo-grid +
 * sampled `surfaceY`) and the scene's floating origin, it writes one InstancedMesh
 * matrix per agent at `worldToScene(gridX·METERS_PER_CELL, gridY·METERS_PER_CELL)`,
 * lifted onto the terrain. Kept out of the component so the (error-prone) matrix
 * math is unit-testable without mounting R3F.
 *
 * NB: this encodes the coordinate assumption that ground-local meters share the
 * scene's absolute-world frame (the same `pseudoGrid` path the static occupant
 * sites use). That assumption is confirmed visually in-scene — see
 * docs/plans/2026-06-25-3d-agent-walking-integration.md.
 */
import * as THREE from 'three';
import { worldToScene, type SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { WORLD3D_CONFIG } from '@/systems/world3d/config';
import type { GroundAgentSceneNode } from '@/systems/worldforge/bridge/groundAgentMotion';

/** Capsule-ish figure size (meters). Center-origin, so lift by half-height. */
export const AGENT_HEIGHT_M = 1.8;
export const AGENT_RADIUS_M = 0.32;

/** Minimal surface the writer needs (an InstancedMesh in practice). */
export interface AgentInstanceMatrixTarget {
  setMatrixAt(index: number, matrix: THREE.Matrix4): void;
  instanceMatrix: { needsUpdate: boolean };
  count?: number;
}

/**
 * Write each agent's transform into the instanced mesh. Returns the number of
 * instances written (callers cap this at the mesh's allocated `count`). Idempotent
 * and side-effect-free beyond the target's matrices + `needsUpdate` flag.
 */
export function syncAgentInstanceMatrices(
  target: AgentInstanceMatrixTarget,
  nodes: GroundAgentSceneNode[],
  origin: SceneOrigin,
  /** Visual size multiplier (e.g. exaggerate figures in a zoomed-out preview). */
  figureScale = 1,
): number {
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const mpc = WORLD3D_CONFIG.METERS_PER_CELL;

  const max = target.count != null ? Math.min(nodes.length, target.count) : nodes.length;
  for (let i = 0; i < max; i++) {
    const n = nodes[i];
    // Per-agent parametric body dims when present, else the uniform default.
    const h = (n.bodyHeightM ?? AGENT_HEIGHT_M) * figureScale;
    const w = (n.bodyWidthM ?? AGENT_RADIUS_M * 2) * figureScale;
    scale.set(w, h, w);
    const s = worldToScene(n.gridX * mpc, n.gridY * mpc, origin);
    // Center-origin figure: lift by half-height so the feet sit on the surface.
    position.set(s.x, n.surfaceY + h / 2, s.z);
    matrix.compose(position, rotation, scale);
    target.setMatrixAt(i, matrix);
  }
  target.instanceMatrix.needsUpdate = true;
  return max;
}
