/** Draws the existing conserved spill prisms as instances of one unit box.
 * Only drawing changes: packet volume, dimensions, trajectory and contact
 * times stay with the native spill owner. The old expanded mesh remains the
 * comparison baseline. Frozen rendered equivalence and lower drawing cost are
 * verified; this does not qualify full live runtime or waterfall realism.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/10/2026, 05:46:28
 * Dependents: components/World3D/water/riverSpillView.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import type { SpillDisplayPacket } from './riverSpillView';

// Shared outward box topology: across, optical thickness, then flight path.
export const SPILL_BOX_FACES = [[0,2,3,1],[4,5,7,6],[0,1,5,4],[2,6,7,3],[0,4,6,2],[1,3,7,5]];

function unitPrism():THREE.BufferGeometry {
  const corners=Array.from({length:8},(_,k)=>new THREE.Vector3(k&1?.5:-.5,k&2?.5:-.5,k&4?.5:-.5));
  const positions:number[]=[],normals:number[]=[],coordinates:number[]=[];
  for(const face of SPILL_BOX_FACES){
    const n=corners[face[1]].clone().sub(corners[face[0]]).cross(corners[face[2]].clone().sub(corners[face[0]])).normalize();
    const order=n.dot(corners[face[0]])>=0?face:[face[0],face[3],face[2],face[1]];
    if(n.dot(corners[face[0]])<0)n.negate();
    for(const k of [order[0],order[1],order[2],order[0],order[2],order[3]]){
      positions.push(...corners[k].toArray());normals.push(...n.toArray());coordinates.push(corners[k].x,corners[k].y);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute('materialCoordinate',new THREE.Float32BufferAttribute(coordinates,2));
  geometry.setAttribute('materialThicknessGradient',new THREE.Float32BufferAttribute(new Float32Array(36*3),3));
  return geometry;
}

/** Growth replaces only the drawing object/buffers. A zero or smaller count
 * draws no stale slots. Every accepted packet still has all twelve faces.
 * Instance matrices are Float32, so expansion is numerically equivalent within
 * ordinary matrix arithmetic error, rather than bit-identical CPU vertices.
 */
export function updateSpillInstances(packets:readonly SpillDisplayPacket[],material:THREE.Material,reuse?:THREE.InstancedMesh,preserveReleaseShear=true):THREE.InstancedMesh {
  const capacity=reuse?.instanceMatrix.count??0;
  let mesh=reuse;
  if(!mesh||capacity<packets.length){
    const nextCapacity=2**Math.ceil(Math.log2(Math.max(1,packets.length)));
    const geometry=unitPrism();
    // Pack optical fields into one GPU binding. Separate per-field buffers
    // plus matrix and box attributes would exceed the common eight-slot limit.
    // Plane and depth gradient are the same physical axis for these prisms.
    const optics=new THREE.InstancedInterleavedBuffer(new Float32Array(nextCapacity*9),9,1).setUsage(THREE.DynamicDrawUsage);
    for(const [name,size,offset]of [['materialPlane',3,0],['materialDepthGradient',3,0],['materialAcross',3,3],['materialThickness',1,6],['materialWidth',1,7],['materialShear',1,8]] as const)
      geometry.setAttribute(name,new THREE.InterleavedBufferAttribute(optics,size,offset));
    mesh=new THREE.InstancedMesh(geometry,material,nextCapacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.renderOrder=10;
    mesh.name='Conserved instanced spill';
  }
  const matrix=new THREE.Matrix4(),tangent=new THREE.Vector3(),across=new THREE.Vector3(),plane=new THREE.Vector3(),faceAcross=new THREE.Vector3(),scale=new THREE.Vector3();
  let count=0;
  for(const p of packets){
    if(!(p.volume>0)||!(p.width>0)||!(p.releaseDuration>0))continue;
    tangent.set(...p.velocity);const speed=tangent.length();if(speed<1e-6)continue;tangent.divideScalar(speed);
    if(p.releaseAcross)faceAcross.set(...p.releaseAcross);else if(p.faceAxis==='x')faceAcross.set(0,0,1);else faceAcross.set(-1,0,0);
    across.copy(faceAcross).addScaledVector(tangent,-faceAcross.dot(tangent));
    const width=p.width*across.length();if(width<1e-6)continue;across.normalize();plane.crossVectors(tangent,across).normalize();
    const length=speed*p.releaseDuration,thickness=p.volume/(width*length);
    // A finite face emits a sheared parcel when flow has a sideways component.
    // Keeping that face direction makes neighboring uniform-flow parcels meet.
    // Optical width stays the perpendicular spacing, so determinant volume and
    // the native material's ray coordinates remain consistent with this shear.
    matrix.makeBasis(preserveReleaseShear?faceAcross:across,plane,tangent).scale(scale.set(preserveReleaseShear?p.width:width,thickness,length)).setPosition(...p.position);
    mesh.setMatrixAt(count,matrix);
    mesh.geometry.getAttribute('materialPlane').setXYZ(count,plane.x,plane.y,plane.z);
    mesh.geometry.getAttribute('materialAcross').setXYZ(count,across.x,across.y,across.z);
    mesh.geometry.getAttribute('materialThickness').setX(count,thickness);
    mesh.geometry.getAttribute('materialShear').setX(count,preserveReleaseShear?faceAcross.dot(tangent)/(width/p.width):0);
    mesh.geometry.getAttribute('materialWidth').setX(count,width);count++;
  }
  mesh.count=count;
  mesh.boundingSphere=null;mesh.boundingBox=null;
  const optics=(mesh.geometry.getAttribute('materialWidth') as THREE.InterleavedBufferAttribute).data;
  mesh.instanceMatrix.clearUpdateRanges();optics.clearUpdateRanges();
  if(count){mesh.instanceMatrix.addUpdateRange(0,count*16);mesh.instanceMatrix.needsUpdate=true;optics.addUpdateRange(0,count*9);optics.needsUpdate=true;}
  // Instancing owns culling bounds separately from the shared unit box.
  // This view deliberately keeps culling off, matching the expanded baseline.
  return mesh;
}
