/**
 * Verifies the instanced-townsfolk matrix writer: correct scene translation
 * (worldToScene of pseudo-grid·METERS_PER_CELL), terrain lift, count cap, and the
 * needsUpdate flag. This is the testable core of the <GroundAgents> render rung;
 * the visual placement assumption is confirmed in-scene (see the plan).
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { syncAgentInstanceMatrices, AGENT_HEIGHT_M } from '../agentInstanceMatrices';
import { WORLD3D_CONFIG } from '@/systems/world3d/config';
import type { GroundAgentSceneNode } from '@/systems/worldforge/bridge/groundAgentMotion';

const MPC = WORLD3D_CONFIG.METERS_PER_CELL;

function fakeMesh(capacity?: number) {
  const matrices: Record<number, THREE.Matrix4> = {};
  return {
    matrices,
    count: capacity,
    instanceMatrix: { needsUpdate: false },
    setMatrixAt(i: number, m: THREE.Matrix4) { matrices[i] = m.clone(); },
  };
}

function node(over: Partial<GroundAgentSceneNode>): GroundAgentSceneNode {
  return {
    burgId: 1, occupantId: 1, name: 'A', xM: 0, zM: 0, moving: false, activity: 'home',
    gridX: 0, gridY: 0, surfaceY: 0, ...over,
  };
}

describe('syncAgentInstanceMatrices', () => {
  it('translates to worldToScene(gridX·MPC) and lifts onto the surface', () => {
    const origin = { x: 100, z: 200 };
    const n = node({ gridX: 0.5, gridY: 1.5, surfaceY: 42 });
    const mesh = fakeMesh();
    const written = syncAgentInstanceMatrices(mesh, [n], origin);

    expect(written).toBe(1);
    const pos = new THREE.Vector3().setFromMatrixPosition(mesh.matrices[0]);
    expect(pos.x).toBeCloseTo(0.5 * MPC - origin.x);
    expect(pos.z).toBeCloseTo(1.5 * MPC - origin.z);
    expect(pos.y).toBeCloseTo(42 + AGENT_HEIGHT_M / 2); // feet on terrain
    expect(mesh.instanceMatrix.needsUpdate).toBe(true);
  });

  it('writes one matrix per agent and is deterministic', () => {
    const nodes = [node({ occupantId: 1, gridX: 1 }), node({ occupantId: 2, gridX: 2 }), node({ occupantId: 3, gridX: 3 })];
    const a = fakeMesh();
    expect(syncAgentInstanceMatrices(a, nodes, { x: 0, z: 0 })).toBe(3);
    const ax = new THREE.Vector3().setFromMatrixPosition(a.matrices[1]).x;
    const b = fakeMesh();
    syncAgentInstanceMatrices(b, nodes, { x: 0, z: 0 });
    expect(new THREE.Vector3().setFromMatrixPosition(b.matrices[1]).x).toBeCloseTo(ax);
  });

  it('uses per-agent parametric body dims (varying figures) when present', () => {
    const tall = node({ occupantId: 1, gridX: 0, bodyHeightM: 2.0, bodyWidthM: 0.5, surfaceY: 0 });
    const short = node({ occupantId: 2, gridX: 1, bodyHeightM: 1.2, bodyWidthM: 0.35, surfaceY: 0 });
    const mesh = fakeMesh();
    syncAgentInstanceMatrices(mesh, [tall, short], { x: 0, z: 0 });

    const sTall = new THREE.Vector3().setFromMatrixScale(mesh.matrices[0]);
    const sShort = new THREE.Vector3().setFromMatrixScale(mesh.matrices[1]);
    expect(sTall.y).toBeCloseTo(2.0);
    expect(sShort.y).toBeCloseTo(1.2);
    expect(sTall.y).toBeGreaterThan(sShort.y); // figures actually differ
    // Taller figure is lifted higher (feet stay on the surface).
    const yTall = new THREE.Vector3().setFromMatrixPosition(mesh.matrices[0]).y;
    const yShort = new THREE.Vector3().setFromMatrixPosition(mesh.matrices[1]).y;
    expect(yTall).toBeCloseTo(1.0);
    expect(yShort).toBeCloseTo(0.6);
  });

  it('caps writes at the mesh capacity (never overruns the buffer)', () => {
    const nodes = Array.from({ length: 5 }, (_, i) => node({ occupantId: i, gridX: i }));
    const mesh = fakeMesh(3); // only 3 instances allocated
    expect(syncAgentInstanceMatrices(mesh, nodes, { x: 0, z: 0 })).toBe(3);
    expect(Object.keys(mesh.matrices)).toHaveLength(3);
  });
});
