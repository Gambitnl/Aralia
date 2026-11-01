/** Local material copies shared by dungeon and combat creature bodies.
 * Never mutates the assembler's cached materials or changes party shading. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 00:16:10
 * Dependents: components/BattleMap/characters/characterActor/CharacterBody.tsx, components/BattleMap/dungeon/DungeonCreatureFigure.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {MeshStandardMaterial,type Material,type Mesh,type MeshToonMaterial,type Object3D} from 'three';
export function adaptCreatureMaterials(root:Object3D,water=false){
  const replacements=new Map<Material,Material>();
  const adapt=(material:Material)=>{
    const toon=material as MeshToonMaterial;
    if(!toon.isMeshToonMaterial)return material;
    const prior=replacements.get(material);if(prior)return prior;
    const next=new MeshStandardMaterial({color:toon.color,vertexColors:toon.vertexColors,map:toon.map,
      roughness:water?0.08:toon.transparent?0.16:0.85,metalness:0,side:toon.side,
      transparent:water||toon.transparent,opacity:water?0.62:toon.opacity,depthWrite:!water&&!toon.transparent,
      emissive:toon.emissive,emissiveIntensity:toon.emissiveIntensity});
    replacements.set(material,next);return next;
  };
  root.traverse(object=>{const mesh=object as Mesh;if(mesh.isMesh)
    mesh.material=Array.isArray(mesh.material)?mesh.material.map(adapt):adapt(mesh.material);});
}

// The shared assembler's opaque body material is appropriate for Earth, but
// the observed aquatic body needs its own local translucent response.
export function adaptWaterMaterials(root:Object3D){adaptCreatureMaterials(root,true);}

