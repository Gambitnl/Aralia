/** World-space view of the isolated thin-water experiment. Triangles retain
 * their actual connectivity; cylinders and spheres retain liquid volume.
 * No screen reconstruction, mist or opacity clumps conceal the primary state.
 * Ordinary shading is a diagnostic approximation, not accepted water optics.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 06/10/2026, 02:28:04
 * Dependents: None (Orphan)
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three';
import type { ThinSnapshot } from '../../../systems/world3d/river/waterfallThinDynamics';

export function createWaterfallThinFeatureView() {
  const group = new THREE.Group();
  const sheetGeometry = new THREE.BufferGeometry();
  const maximum = 40000;
  // r172 retains its first attribute bindings for a geometry. Keep these
  // buffers alive and upload current values, or the first water frame freezes
  // while the simulation receipt continues to change underneath it.
  const positions = new THREE.BufferAttribute(new Float32Array(maximum * 9), 3).setUsage(THREE.DynamicDrawUsage);
  const normals = new THREE.BufferAttribute(new Float32Array(maximum * 9), 3).setUsage(THREE.DynamicDrawUsage);
  sheetGeometry.setAttribute('position', positions);
  sheetGeometry.setAttribute('normal', normals);
  sheetGeometry.setDrawRange(0, 0);
  const bounds = new THREE.Box3(), point = new THREE.Vector3();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), normal = new THREE.Vector3();
  const sheetMaterial = new THREE.MeshStandardMaterial({ color: 0x83aeb9, roughness: .22, metalness: 0,
    side: THREE.DoubleSide, transparent: true, opacity: .72 });
  const ligamentMaterial = new THREE.MeshStandardMaterial({ color: 0x96bdc7, roughness: .2 });
  const dropMaterial = new THREE.MeshStandardMaterial({ color: 0xb0d3dc, roughness: .13 });
  const sheet = new THREE.Mesh(sheetGeometry, sheetMaterial);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 6);
  const sphere = new THREE.SphereGeometry(1, 6, 4);
  const ligaments = new THREE.InstancedMesh(cylinder, ligamentMaterial, maximum);
  const drops = new THREE.InstancedMesh(sphere, dropMaterial, maximum);
  ligaments.count = 0; drops.count = 0; group.add(sheet, ligaments, drops);
  const dummy = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0), direction = new THREE.Vector3();
  let diagnosticMode = false;
  return {
    group,
    setDiagnostic(diagnostic: boolean) {
      if (diagnostic === diagnosticMode) return;
      diagnosticMode = diagnostic;
      sheetMaterial.color.setHex(diagnostic ? 0x278dcc : 0x83aeb9);
      sheetMaterial.opacity = diagnostic ? 1 : .72; sheetMaterial.transparent = !diagnostic;
      sheetMaterial.roughness = diagnostic ? .7 : .22;
      ligamentMaterial.color.setHex(diagnostic ? 0xeaa52f : 0x96bdc7);
      dropMaterial.color.setHex(diagnostic ? 0xd252c0 : 0xb0d3dc);
      sheetMaterial.needsUpdate = true;
    },
    update(snapshot: ThinSnapshot) {
      if (snapshot.patches.length > maximum || snapshot.ligaments.length > maximum || snapshot.drops.length > maximum) throw Error('Thin view capacity exceeded');
      const vertices = new Map(snapshot.vertices.map(v => [v.id, v]));
      let cursor = 0;
      bounds.makeEmpty();
      for (const patch of snapshot.patches) {
        const start = cursor;
        for (const id of patch.vertices) {
          const vertex = vertices.get(id);
          if (!vertex) throw Error('Missing thin material vertex');
          positions.array.set(vertex.position, cursor); cursor += 3;
          bounds.expandByPoint(point.fromArray(vertex.position));
        }
        a.fromArray(positions.array, start); b.fromArray(positions.array, start + 3); c.fromArray(positions.array, start + 6);
        normal.crossVectors(b.sub(a), c.sub(a)).normalize();
        for (let offset = start; offset < cursor; offset += 3) normal.toArray(normals.array, offset);
      }
      // Draw only current material. Old values beyond this range are unused;
      // shutdown must not retain ghost triangles or corrupt the active bounds.
      sheetGeometry.setDrawRange(0, cursor / 3);
      positions.clearUpdateRanges(); normals.clearUpdateRanges();
      if (cursor > 0) { positions.addUpdateRange(0, cursor); normals.addUpdateRange(0, cursor); }
      positions.needsUpdate = true; normals.needsUpdate = true;
      sheetGeometry.boundingBox = bounds.clone();
      sheetGeometry.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());
      ligaments.count = snapshot.ligaments.length; drops.count = snapshot.drops.length;
      snapshot.ligaments.forEach((l, i) => {
        dummy.position.fromArray(l.center); direction.fromArray(l.axis); dummy.quaternion.setFromUnitVectors(up, direction);
        dummy.scale.set(l.radius, l.length, l.radius); dummy.updateMatrix(); ligaments.setMatrixAt(i, dummy.matrix);
      });
      snapshot.drops.forEach((d, i) => {
        dummy.position.fromArray(d.center); dummy.quaternion.identity(); dummy.scale.setScalar(d.radius);
        dummy.updateMatrix(); drops.setMatrixAt(i, dummy.matrix);
      });
      ligaments.instanceMatrix.needsUpdate = true; drops.instanceMatrix.needsUpdate = true;
      ligaments.computeBoundingSphere(); drops.computeBoundingSphere();
    },
    dispose() {
      sheetGeometry.dispose(); cylinder.dispose(); sphere.dispose();
      sheetMaterial.dispose(); ligamentMaterial.dispose(); dropMaterial.dispose(); group.clear();
    },
  };
}
