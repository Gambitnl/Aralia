// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 11:37:46
 * Dependents: components/World3D/FreeRoamCameraController.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three';
import {OUTLINE_MATERIAL_NAME} from '../../systems/entities3d/three/toon';

type BodyMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
type OwnedMaterials = {original: BodyMesh['material']; faded: BodyMesh['material']; clones: THREE.Material[]};

/** Camera presentation only. The lead body remains present to physical systems. */
export function createPlayerCameraSelfVisibility() {
  const owned = new Map<BodyMesh, OwnedMaterials>();
  const bounds = new THREE.Box3(), part = new THREE.Box3();
  const projected = new THREE.Vector3();
  let root: THREE.Object3D | undefined, cachedScene: THREE.Scene | undefined, faded = false;
  const restoreMesh = (mesh: BodyMesh, record: OwnedMaterials) => {
    // Appearance updates may replace a material while the close view is active.
    // Never restore an older appearance over that new source-owned material.
    if (mesh.material === record.faded) mesh.material = record.original;
    record.clones.forEach(material => material.dispose());
    owned.delete(mesh);
  };
  const releaseMaterials = () => { for (const [mesh, record] of owned) restoreMesh(mesh, record); };
  const belongsTo = (object: THREE.Object3D | undefined, scene: THREE.Scene) => {
    for (let parent = object; parent; parent = parent.parent ?? undefined) if (parent === scene) return true;
    return false;
  };
  const restore = () => { releaseMaterials(); faded = false; root = undefined; cachedScene = undefined; };
  const crowdsFrame = (camera: THREE.Camera | undefined): boolean => {
    const perspective = camera as THREE.PerspectiveCamera | undefined;
    if (!perspective?.isPerspectiveCamera || bounds.isEmpty()
      || !perspective.projectionMatrix.elements.every(Number.isFinite)) return false;
    // The legal inn camera can be more than a meter from the body while Sana
    // still fills most of the screen. Measure the visible figure in this view,
    // rather than extending a fixed distance to every race and camera zoom.
    perspective.updateWorldMatrix(true, false);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) {
        projected.set(x, y, z).applyMatrix4(perspective.matrixWorldInverse);
        if (projected.z >= -perspective.near) continue;
        projected.applyMatrix4(perspective.projectionMatrix);
        minX = Math.min(minX, projected.x); maxX = Math.max(maxX, projected.x);
        minY = Math.min(minY, projected.y); maxY = Math.max(maxY, projected.y);
      }
    // Ignore an offscreen figure. Clip to the viewport so geometry beyond the
    // screen cannot exaggerate coverage; retain hysteresis through small orbits.
    const centered = minX < .2 && maxX > -.2 && minY < .2 && maxY > -.2;
    const height = (Math.min(1, maxY) - Math.max(-1, minY)) / 2;
    return centered && height > (faded ? .45 : .55);
  };
  return {
    update(scene: THREE.Scene | null | undefined, eye: THREE.Vector3, enabled: boolean, camera?: THREE.Camera): boolean {
      if (!enabled || !scene || !eye.toArray().every(Number.isFinite)) { restore(); return false; }
      if (scene !== cachedScene || !belongsTo(root, scene)) {
        restore(); root = scene.getObjectByName('world3d:player'); cachedScene = scene;
      }
      if (!root) return false;
      for (let parent: THREE.Object3D | null = root; parent; parent = parent.parent) {
        if (!parent.visible) { releaseMaterials(); faded = false; return false; }
      }
      root.updateWorldMatrix(true, true); bounds.makeEmpty();
      const meshes = new Set<BodyMesh>(), shadows = new Set<BodyMesh>();
      root.traverseVisible(object => {
        const mesh = object as BodyMesh;
        if (!mesh.isMesh) return;
        if (mesh.name === 'blobShadow') { shadows.add(mesh); return; }
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        if (!materials.some(material => material.visible && material.opacity > 0)) return;
        meshes.add(mesh); bounds.union(part.setFromObject(mesh));
      });
      // A shadow, hidden equipment or a different character cannot make the
      // lead figure transparent. Small hysteresis prevents doorway flicker.
      faded = !bounds.isEmpty() && (bounds.distanceToPoint(eye) < (faded ? .8 : .5) || crowdsFrame(camera));
      if (!faded) { releaseMaterials(); return false; }
      // The shadow never decides whether the body crowds the camera, but it
      // must disappear with that body rather than remaining as a detached blob.
      for (const shadow of shadows) meshes.add(shadow);
      for (const [mesh, record] of owned) {
        if (!meshes.has(mesh) || mesh.material !== record.faded) restoreMesh(mesh, record);
      }
      for (const mesh of meshes) {
        let record = owned.get(mesh);
        if (!record) {
          const original = mesh.material, materials = Array.isArray(original) ? original : [original];
          const clones = materials.map(material => {
            const clone = material.clone(); clone.transparent = true; clone.depthWrite = false;
            clone.alphaTest = 0;
            // Layered alpha body/armor produced a milky veil in the played inn.
            // Suppress color instead: keep positive opacity and visible meshes
            // so physical body measurements still see the unchanged figure.
            clone.colorWrite = false;
            return clone;
          });
          record = {original, clones, faded: Array.isArray(original) ? clones : clones[0]};
          owned.set(mesh, record); mesh.material = record.faded;
        }
        const original = Array.isArray(record.original) ? record.original : [record.original];
        // Keep opacity positive: source figure bounds and physical actor-space
        // admission still see the same meshes. Only this camera's lead model
        // stops drawing color; residents, companions and walls retain
        // their original materials, identity, geometry and collision authority.
        record.clones.forEach((material, i) => {
          material.opacity = original[i].opacity * .08;
          // Entity ink writes its own alpha. Standard opacity alone leaves
          // that inverse hull solid, which the first library replay exposed.
          // Match the existing named material contract; other custom shaders
          // retain their own uniforms rather than receiving guessed edits.
          const ink = material as THREE.ShaderMaterial, source = original[i] as THREE.ShaderMaterial;
          if (ink.isShaderMaterial && ink.name === OUTLINE_MATERIAL_NAME
            && typeof source.uniforms.uA?.value === 'number') {
            ink.uniforms.uA.value = source.uniforms.uA.value * .08;
          }
        });
      }
      return true;
    },
    restore,
  };
}
