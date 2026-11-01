/** Measure the assembled standing figure above its own feet for doorway and
 * ceiling clearance. Equipped gear counts; the projected ground shadow does
 * not. Measure once before gait animation, so walking cannot bob under a beam. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 12:14:45
 * Dependents: components/World3D/OccupantFigure.tsx, components/World3D/PlayerAvatar.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three';
import type { ActorFootprint } from './actorPersonalSpace';
export interface StandingBodyFootprint extends ActorFootprint {radiusM:number}

export function standingBodyHeight(root: THREE.Object3D | null | undefined): number | undefined {
  if (!root) return undefined;
  root.updateWorldMatrix(true, true);
  const feetY = root.getWorldPosition(new THREE.Vector3()).y;
  const bounds = new THREE.Box3();
  root.traverseVisible(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || mesh.name === 'blobShadow') return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (materials.some(material => material?.visible && material.opacity > 0)) {
      bounds.union(new THREE.Box3().setFromObject(mesh));
    }
  });
  const height = bounds.max.y - feetY;
  return Number.isFinite(height) && height > 0 ? height : undefined;
}

/** Horizontal standing envelope around the actual feet, including asymmetric
 * anatomy and gear. The projected shadow and hidden meshes are not people. */
export function standingBodyFootprint(root: THREE.Object3D | null | undefined, refreshSkinBounds=false): StandingBodyFootprint | undefined {
  if (!root) return undefined;
  // Refresh ancestors, then use the renderer's update path so attached
  // SkinnedMesh instances also update their bind-matrix inverse.
  root.updateWorldMatrix(true, false);
  root.updateMatrixWorld(true);
  const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert(),relative=new THREE.Matrix4();
  const bounds=new THREE.Box3(),part=new THREE.Box3();
  root.traverseVisible(object=>{
    const mesh=object as THREE.Mesh;
    if(!mesh.isMesh||mesh.name==='blobShadow')return;
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    if(!materials.some(material=>material?.visible&&material.opacity>0))return;
    const skin=mesh as THREE.SkinnedMesh;
    if(skin.isSkinnedMesh){
      // Prime once after the first real pose. Later samples reuse that standing
      // skin envelope; they do not reskin every vertex on every render frame.
      if(refreshSkinBounds||!skin.boundingBox)skin.computeBoundingBox();
      if(!skin.boundingBox)return;
      part.copy(skin.boundingBox);
    }else{
      if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
      if(!mesh.geometry.boundingBox)return;
      part.copy(mesh.geometry.boundingBox);
    }
    // Measure in the figure's own axes. A world-axis box grows when it turns,
    // which would incorrectly make personal space expand with facing.
    bounds.union(part.applyMatrix4(relative.copy(inverse).multiply(mesh.matrixWorld)));
  });
  if(bounds.isEmpty())return undefined;
  const scale=root.getWorldScale(new THREE.Vector3());
  const x=Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x))*Math.abs(scale.x);
  const z=Math.max(Math.abs(bounds.min.z),Math.abs(bounds.max.z))*Math.abs(scale.z);
  const radius=Math.hypot(x,z);
  if(!Number.isFinite(radius)||radius<=0)return undefined;
  return {radiusM:radius,minXM:bounds.min.x*Math.abs(scale.x),maxXM:bounds.max.x*Math.abs(scale.x),minZM:bounds.min.z*Math.abs(scale.z),maxZM:bounds.max.z*Math.abs(scale.z),yawRad:Math.atan2(root.matrixWorld.elements[8],root.matrixWorld.elements[10])};
}

/** Compatibility radius retains the full measured circumcircle. The actor
 * solver may also use the measured box to avoid blocking its empty margins. */
export function standingBodyRadius(root:THREE.Object3D|null|undefined,refreshSkinBounds=false):number|undefined {return standingBodyFootprint(root,refreshSkinBounds)?.radiusM;}
