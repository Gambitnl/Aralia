import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { groundPropInstanceSource, measureRenderedGroundProps, setGroundPropInstanceSources } from '../groundPropGeometry';
import { propSourceId, type PropInstance } from '@/systems/worldforge/props/propSchema';

const pile: PropInstance = { defId: 'woodpile', xM: 472.358912923433, zM: 488.4628858281934,
  rotationRad: 5.610892274095856, variation: { scale: 1.0515553719378592, variant: 3 } };
const origin = { x: 472.57470729781323, z: 489.8174913216476 };

function logs(root: THREE.Group, source = pile) {
  const positions = [[-.3, .15], [0, .15], [.3, .15], [-.15, .42], [.15, .42], [0, .68]];
  const parent = new THREE.Matrix4().compose(new THREE.Vector3(source.xM - origin.x, 4.6, source.zM - origin.z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), source.rotationRad),
    new THREE.Vector3().setScalar(source.variation.scale));
  const meshes: THREE.InstancedMesh[] = [];
  for (let material = 0; material < 2; material++) {
    const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(.14, .14, 1.4, 7), new THREE.MeshBasicMaterial(), 3);
    positions.filter((_, i) => i % 2 === material).forEach(([x, y], i) => {
      const local = new THREE.Matrix4().compose(new THREE.Vector3(x, y, 0),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(parent, local));
    });
    setGroundPropInstanceSources(mesh, Array.from({ length: 3 }, () => groundPropInstanceSource(source)));
    root.add(mesh); meshes.push(mesh);
  }
  return meshes;
}

describe('rendered prop identity and actual bounds', () => {
  it('joins all six actual woodpile log pieces across material batches at the measured native radius', () => {
    const root = new THREE.Group(); logs(root);
    const snapshot = measureRenderedGroundProps(root, origin, [pile]);
    expect(snapshot.issues).toEqual([]);
    expect(snapshot.bounds).toHaveLength(1);
    expect(snapshot.bounds[0]).toMatchObject({ sourceId: propSourceId(pile), defId: 'woodpile', pieces: 6 });
    expect(snapshot.bounds[0].radiusM).toBeCloseTo(.8674684969740052, 6);
    expect(snapshot.bounds[0].vertices).toBeGreaterThan(100);
  });

  it('measures parent transforms and surface lean rather than an upright catalog proxy', () => {
    const root = new THREE.Group(), [mesh] = logs(root);
    const baseline = measureRenderedGroundProps(root, origin, [pile]).bounds[0];
    mesh.rotation.x = .4; root.position.y = 2;
    const changed = measureRenderedGroundProps(root, origin, [pile]);
    expect(changed.issues).toEqual([]);
    expect(changed.bounds[0].maxYM).toBeGreaterThan(baseline.maxYM + 1);
    expect(changed.bounds[0].radiusM).not.toBeCloseTo(baseline.radiusM, 3);
  });

  it('keeps nearby props separate even when they share mesh/material batches', () => {
    const root = new THREE.Group(), other = { ...pile, xM: pile.xM + .25 };
    logs(root); logs(root, other);
    const snapshot = measureRenderedGroundProps(root, origin, [pile, other]);
    expect(snapshot.issues).toEqual([]);
    expect(snapshot.bounds).toHaveLength(2);
    expect(snapshot.bounds.every(row => row.pieces === 6)).toBe(true);
  });

  it('keeps the retained original address after a physical move and JSON round trip', () => {
    const root = new THREE.Group();
    const moved = JSON.parse(JSON.stringify({ ...pile, xM: 469.8213397867784, retainedSourceId: propSourceId(pile) }));
    logs(root, moved);
    const snapshot = measureRenderedGroundProps(root, origin, [moved]);
    expect(snapshot.issues).toEqual([]);
    expect(snapshot.bounds[0].sourceId).toBe(propSourceId(pile));
    expect(snapshot.bounds[0].xM).toBe(moved.xM);
  });

  it('reports missing or hidden props rather than inventing their geometry', () => {
    const root = new THREE.Group(); logs(root); root.visible = false;
    expect(measureRenderedGroundProps(root, origin, [pile])).toEqual({ bounds: [], issues: [`unmeasured:${propSourceId(pile)}`] });
  });

  it('refuses a partial result when any represented piece has invalid geometry', () => {
    const root = new THREE.Group(), [mesh] = logs(root);
    mesh.geometry.getAttribute('position').setX(0, NaN);
    const snapshot = measureRenderedGroundProps(root, origin, [pile]);
    expect(snapshot.bounds).toEqual([]);
    expect(snapshot.issues).toContain(`unmeasured:${propSourceId(pile)}`);
  });

  it('reports mismatched matrix/provenance counts and stale coordinates', () => {
    const root = new THREE.Group(), [a, b] = logs(root);
    setGroundPropInstanceSources(a, []);
    setGroundPropInstanceSources(b, Array.from({ length: 3 }, () => ({ ...groundPropInstanceSource(pile), xM: 0 })));
    const snapshot = measureRenderedGroundProps(root, origin, [pile]);
    expect(snapshot.bounds).toEqual([]);
    expect(snapshot.issues.some(issue => issue.startsWith('instance-count:'))).toBe(true);
    expect(snapshot.issues).toContain(`unmeasured:${propSourceId(pile)}`);
  });

  it('bounds vertex work to the selected canonical prop origins', () => {
    const root = new THREE.Group(), far = { ...pile, xM: pile.xM + 30 };
    logs(root); logs(root, far);
    const snapshot = measureRenderedGroundProps(root, origin, [pile, far], { xM: pile.xM, zM: pile.zM, radiusM: 2 });
    expect(snapshot.issues).toEqual([]);
    expect(snapshot.bounds).toHaveLength(1);
    expect(snapshot.bounds[0].sourceId).toBe(propSourceId(pile));
  });

  it('refuses two physical objects that claim the same retained address', () => {
    const root = new THREE.Group(); logs(root);
    const duplicate = { ...pile, xM: pile.xM + 1, retainedSourceId: propSourceId(pile) };
    const snapshot = measureRenderedGroundProps(root, origin, [pile, duplicate]);
    expect(snapshot).toEqual({ bounds: [], issues: [`duplicate-source:${propSourceId(pile)}`] });
  });

  it('refuses an invalid measurement frame rather than converting bad coordinates', () => {
    const root = new THREE.Group(); logs(root);
    expect(measureRenderedGroundProps(root, { x: NaN, z: 0 }, [pile]).issues).toEqual(['invalid-measurement-frame']);
    expect(measureRenderedGroundProps(root, origin, [pile], { xM: 0, zM: 0, radiusM: -1 }).bounds).toEqual([]);
  });
});
