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
import { type SceneOrigin } from '@/systems/world3d/sceneOrigin';
import type { GroundAgentSceneNode } from '@/systems/worldforge/bridge/groundAgentMotion';
/** Capsule-ish figure size (meters). Center-origin, so lift by half-height. */
export declare const AGENT_HEIGHT_M = 1.8;
export declare const AGENT_RADIUS_M = 0.32;
/** Minimal surface the writer needs (an InstancedMesh in practice). */
export interface AgentInstanceMatrixTarget {
    setMatrixAt(index: number, matrix: THREE.Matrix4): void;
    instanceMatrix: {
        needsUpdate: boolean;
    };
    count?: number;
}
/**
 * Write each agent's transform into the instanced mesh. Returns the number of
 * instances written (callers cap this at the mesh's allocated `count`). Idempotent
 * and side-effect-free beyond the target's matrices + `needsUpdate` flag.
 */
export declare function syncAgentInstanceMatrices(target: AgentInstanceMatrixTarget, nodes: GroundAgentSceneNode[], origin: SceneOrigin, 
/** Visual size multiplier (e.g. exaggerate figures in a zoomed-out preview). */
figureScale?: number): number;
