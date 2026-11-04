/** Keep the walking camera clear of opaque scenery using the drawn figure.
 * Asymmetric anatomy must not turn empty bounding-box corners into body parts. */
// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 21:49:36
 * Dependents: components/World3D/FreeRoamCameraController.tsx, components/World3D/World3DScene.tsx, components/World3D/playerCameraFrame.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three';
import {nearestGroundCameraHit} from './cameraGroundRaycast';

export type CameraPoint = readonly [number, number, number];
/** Nearest opaque town structure or ground surface along the camera arm. */
export type PlayerCameraSightline = (focus: CameraPoint, eye: CameraPoint) => number | null;

/** Select actual drawn vertices at the figure's six extremes. A tail's overall
 * box also contains empty space above it; a porch in that space cannot hide the
 * person. Keep vertex references so warm camera queries follow current skin,
 * morph and world transforms without scanning the whole figure for every ray. */
function createBodySurfaceSamples() {
  type Sample = {mesh: THREE.Mesh; index: number; edgeIndex?: number; blend?: number};
  let signature='', scannedAt=-Infinity, selected: Sample[]=[];
  const vertex=new THREE.Vector3(),neighbor=new THREE.Vector3();
  const attributeIds=new WeakMap<object,number>();let nextAttributeId=0;
  const attributeId=(attribute: object|null)=>{
    if(!attribute)return 0;
    if(!attributeIds.has(attribute))attributeIds.set(attribute,++nextAttributeId);
    return attributeIds.get(attribute)!;
  };
  const visible=(material: THREE.Material|undefined)=>Boolean(material?.visible&&material.opacity>0);
  return (player: THREE.Object3D,time: number): CameraPoint[] => {
    player.updateWorldMatrix(true,true);
    const meshes: THREE.Mesh[]=[];
    player.traverseVisible(object=>{
      const mesh=object as THREE.Mesh;
      if(!mesh.isMesh||mesh.name==='blobShadow'||!mesh.geometry.getAttribute('position'))return;
      const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      if(materials.some(visible))meshes.push(mesh);
    });
    const nextSignature=meshes.map(mesh=>{
      const g=mesh.geometry,p=g.getAttribute('position'),materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      return [mesh.uuid,g.uuid,attributeId(p),p.count,'version' in p?p.version:p.data.version,attributeId(g.index),g.index?.version,
        g.drawRange.start,g.drawRange.count,materials.map(visible).join(','),
        g.groups.map(group=>[group.start,group.count,group.materialIndex].join(',')).join(';')].join(':');
    }).join('|');
    if(nextSignature!==signature||time-scannedAt>=1000){
      const extremes: Array<Sample|undefined>=Array(6),values=[Infinity,-Infinity,Infinity,-Infinity,Infinity,-Infinity];
      for(const mesh of meshes){
        const g=mesh.geometry,index=g.index,start=g.drawRange.start,end=Math.min(index?.count??g.getAttribute('position').count,start+g.drawRange.count);
        const materials=mesh.material;
        const ranges=Array.isArray(materials)?g.groups.filter(group=>visible(materials[group.materialIndex??0]))
          .map(group=>[Math.max(start,group.start),Math.min(end,group.start+group.count)]):[[start,end]];
        const visited=new Set<number>();
        for(const [first,last] of ranges)for(let offset=first;offset<last;offset++){
          const i=index?index.getX(offset):offset;
          if(visited.has(i))continue;visited.add(i);
          mesh.getVertexPosition(i,vertex);vertex.applyMatrix4(mesh.matrixWorld);
          if(![vertex.x,vertex.y,vertex.z].every(Number.isFinite))continue;
          for(let axis=0;axis<6;axis++){
            const coordinate=vertex.getComponent(Math.floor(axis/2));
            if(axis%2?coordinate>values[axis]:coordinate<values[axis]){
              values[axis]=coordinate;extremes[axis]={mesh,index:i};
            }
          }
        }
      }
      selected=extremes.filter((sample): sample is Sample=>Boolean(sample))
        .filter((sample,i,all)=>all.findIndex(other=>other.mesh===sample.mesh&&other.index===sample.index)===i);
      // Do not cast from a sole's exact ground-contact boundary: a rising
      // bank can intersect that point while the person still has a clear
      // view. Preserve the existing 12 cm foot allowance on a real adjacent
      // triangle edge, rather than raising a point into empty space.
      const footHeight=values[2]+Math.min(.12,(values[3]-values[2])*.1);
      selected=selected.filter(sample=>{
        const {mesh,index:source}=sample,g=mesh.geometry,index=g.index;
        mesh.getVertexPosition(source,vertex);vertex.applyMatrix4(mesh.matrixWorld);
        if(vertex.y>=footHeight)return true;
        const start=g.drawRange.start,end=Math.min(index?.count??g.getAttribute('position').count,start+g.drawRange.count),materials=mesh.material;
        const ranges=Array.isArray(materials)?g.groups.filter(group=>visible(materials[group.materialIndex??0]))
          .map(group=>[Math.max(start,group.start),Math.min(end,group.start+group.count)]):[[start,end]];
        let shortest=Infinity;
        for(const [first,last] of ranges)for(let offset=first;offset+2<last;offset+=3){
          const triangle=[0,1,2].map(i=>index?index.getX(offset+i):offset+i);
          if(!triangle.includes(source))continue;
          for(const i of triangle){
            mesh.getVertexPosition(i,neighbor);neighbor.applyMatrix4(mesh.matrixWorld);
            if(neighbor.y<=footHeight)continue;
            const blend=(footHeight-vertex.y)/(neighbor.y-vertex.y),distance=vertex.distanceToSquared(neighbor)*blend*blend;
            if(distance<shortest){shortest=distance;sample.edgeIndex=i;sample.blend=blend;}
          }
        }
        return sample.edgeIndex!==undefined;
      });
      signature=nextSignature;scannedAt=time;
    }
    return selected.map(({mesh,index,edgeIndex,blend})=>{
      mesh.getVertexPosition(index,vertex);
      if(edgeIndex!==undefined){mesh.getVertexPosition(edgeIndex,neighbor);vertex.lerp(neighbor,blend!);}
      vertex.applyMatrix4(mesh.matrixWorld);
      return [vertex.x,vertex.y,vertex.z] as const;
    });
  };
}

/** Query real mounted buildings, decks, terrain, roads and scenery, never the avatar or NPCs.
 * A clear building-only ray can still put the eye above an opaque bridge while
 * the accepted body stands underneath it, or inside a hill after walking down.
 * Reuse the rendered surfaces for visibility; geometry and feet stay unchanged. */
export function createPlayerCameraSightline(getScene: () => THREE.Scene | null,
  now: () => number = () => performance.now()): PlayerCameraSightline {
  const raycaster = new THREE.Raycaster(), focus = new THREE.Vector3(), direction = new THREE.Vector3();
  let cachedScene: THREE.Scene | null = null, refreshedAt = -Infinity;
  let player: THREE.Object3D | null = null, sampledFrame = -1;
  const sampleBody=createBodySurfaceSamples();
  let playerPoints: CameraPoint[]=[];
  let buildings: Array<{ root: THREE.Object3D; bounds: THREE.Box3 }> = [];
  return (from, to) => {
    const scene = getScene();
    // No mounted scene is unknown clearance, not proof of a clear arm.
    if (!scene) return 0;
    const time = now();
    // Streaming changes the occluder roster. Cache its broad phase, but read
    // live leaf transforms for every ray so opening a door clears it immediately.
    if (scene !== cachedScene || time - refreshedAt >= 1000) {
      buildings = []; player = null; sampledFrame = -1;
      scene.updateMatrixWorld(true);
      scene.traverse(object => {
        if (object.name === 'world3d:player') player = object;
        if (object.name === 'world3d:site-building' || object.name === 'world3d:decks'
          || object.name === 'world3d:terrain' || object.name === 'world3d:roads'
          // The played Dragon doorway was hidden by a real overturned barrel.
          // Include its rendered prop batch; keep the barrel and its source intact.
          || object.name === 'ground-props') buildings.push({ root: object,
          bounds: new THREE.Box3().setFromObject(object).expandByScalar(2) });
      });
      cachedScene = scene; refreshedAt = time;
    }
    const distance = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    if (distance < 1e-6) return null;
    const points: CameraPoint[] = [from];
    if (player?.parent) {
      // The actual figure supplies its height and width, including small races.
      // A clear torso ray alone can still hide the head behind a door lintel.
      const frame = Math.floor(time / 16);
      if (frame !== sampledFrame) {
        playerPoints=sampleBody(player,time);
        sampledFrame = frame;
      }
      if (!playerPoints.length) return 0;
      points.push(...playerPoints);
    }
    let nearest: number | null = null;
    const updated = new Set<THREE.Object3D>();
    for (const point of points) {
    focus.set(...point); direction.set(...to).sub(focus);
    const sampleLength = direction.length();
    if (sampleLength < 1e-6) continue;
    raycaster.set(focus, direction.divideScalar(sampleLength));
    raycaster.near = 0.01; raycaster.far = sampleLength;
    for (const { root, bounds } of buildings) {
      let ancestor: THREE.Object3D | null = root;
      while (ancestor && ancestor !== scene && ancestor.visible) ancestor = ancestor.parent;
      if (ancestor !== scene || !scene.visible || !raycaster.ray.intersectsBox(bounds)) continue;
      if (!updated.has(root)) { root.updateWorldMatrix(true, true); updated.add(root); }
      // Dense interior floors/walls need the same exact triangle candidate
      // index as terrain. Native temple play spent most sampled CPU time in
      // full building scans. The helper still reads current leaf transforms,
      // material sides/visibility and custom raycasts; nothing becomes clear
      // merely because it is expensive, and no physical geometry is changed.
      const hit = nearestGroundCameraHit(root, raycaster);
      if (hit !== null) {
        const armDistance = hit / sampleLength * distance;
        if (nearest === null || armDistance < nearest) nearest = armDistance;
      }
    }
    }
    return nearest;
  };
}

/** Retract the eye before opaque structure on its existing arm; feet and focus never move. */
export function cameraBeforeBuilding(focus: CameraPoint, eye: CameraPoint,
  sightline: PlayerCameraSightline): CameraPoint | null {
  let candidate = eye;
  for (let attempt = 0; attempt < 5; attempt++) {
  const hit = sightline(focus, candidate);
  if (hit === null) return candidate;
  const length = Math.hypot(candidate[0] - focus[0], candidate[1] - focus[1], candidate[2] - focus[2]);
  const available = hit - 0.2;
  // Do not claim a clear view by putting the eye inside its focus or a wall.
  if (available < 0.25 || length < 1e-6) return null;
  const ratio = available / length;
  candidate = [focus[0] + (candidate[0] - focus[0]) * ratio,
    focus[1] + (candidate[1] - focus[1]) * ratio, focus[2] + (candidate[2] - focus[2]) * ratio];
  }
  return null;
}

/** The map's near plane cannot crop rooms after a legal walking-scale retraction.
 * Own only this camera's temporary projection; keep far depth, pose and geometry.
 * A later projection owner is never overwritten during cleanup. */
export function createPlayerCameraProjection() {
  let owned: {camera: THREE.PerspectiveCamera; originalNear: number; appliedNear: number} | null = null;
  const restore = () => {
    if (owned && owned.camera.near === owned.appliedNear && owned.camera.near !== owned.originalNear) {
      owned.camera.near = owned.originalNear;
      owned.camera.updateProjectionMatrix();
    }
    owned = null;
  };
  return {
    update(camera: THREE.Camera, enabled: boolean, focusDistanceM: number) {
      const perspective = camera as THREE.PerspectiveCamera;
      if (!enabled || !perspective.isPerspectiveCamera || !Number.isFinite(perspective.near) || perspective.near <= 0
        || !Number.isFinite(focusDistanceM) || focusDistanceM <= 0) {
        restore(); return;
      }
      if (owned?.camera !== perspective) {
        restore(); owned = {camera: perspective, originalNear: perspective.near, appliedNear: perspective.near};
      } else if (perspective.near !== owned.appliedNear) {
        owned.originalNear = perspective.near;
      }
      // Close rooms need a small plane; a long outdoor arm retains more of
      // the map's depth precision instead of keeping five centimeters everywhere.
      const near = Math.min(owned.originalNear, Math.max(.05, focusDistanceM * .1));
      if (perspective.near !== near) {
        perspective.near = near;
        perspective.updateProjectionMatrix();
      }
      owned.appliedNear = near;
    },
    restore,
  };
}
