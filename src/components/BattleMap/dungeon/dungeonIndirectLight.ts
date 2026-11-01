/** Room-local diffuse bounce, baked from the existing fixed fixtures.
 * Render textures are disposable presentation data, never saved discoveries.
 * This uses r172's SH probe support without upgrading the shared renderer. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/11/2026, 00:18:51
 * Dependents: components/BattleMap/dungeon/Dungeon3DPreview.tsx, components/BattleMap/dungeon/DungeonIndirectLighting.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {DataTexture, FloatType, Group, Material, NearestFilter, type Object3D, PointLight, RGBAFormat, SphericalHarmonics3, Vector2, Vector3} from 'three';
import {CellKind, type DungeonPlan} from '../../../systems/worldforge/dungeon/types';

export function createDungeonIndirectLight(plan: DungeonPlan) {
  const slots = new Int16Array(plan.W * plan.H).fill(-1);
  const probes: {roomId:number;position:Vector3;slot:number}[] = [];
  // Match the scene adapter's source-foot conversion and true room-floor rule.
  // Corridors and solid rock have no room probe; touching rooms never blend.
  for (const room of plan.rooms) {
    const cells: {x:number;y:number}[] = [];
    for(let y=Math.max(0,Math.floor(room.y/plan.cellFt));y<Math.min(plan.H,Math.ceil((room.y+room.h)/plan.cellFt));y++) {
      for(let x=Math.max(0,Math.floor(room.x/plan.cellFt));x<Math.min(plan.W,Math.ceil((room.x+room.w)/plan.cellFt));x++) {
        if(plan.grid[y*plan.W+x]===CellKind.Floor && plan.corridor[y*plan.W+x]===0)cells.push({x,y});
      }
    }
    if(!cells.length)continue;
    const slot=probes.length;
    const cx=(room.x+room.w/2)/plan.cellFt-0.5,cy=(room.y+room.h/2)/plan.cellFt-0.5;
    cells.sort((a,b)=>(a.x-cx)**2+(a.y-cy)**2-((b.x-cx)**2+(b.y-cy)**2));
    const center=cells[0];
    probes.push({roomId:room.id,slot,position:new Vector3(center.x-plan.W/2+0.5,0.65,center.y-plan.H/2+0.5)});
    for(const cell of cells)slots[cell.y*plan.W+cell.x]=slot;
  }
  const lookupData = new Float32Array(plan.W*plan.H*4);
  slots.forEach((slot,i)=>{lookupData[i*4]=slot+1;});
  const coefficients = new Float32Array(9*Math.max(1,probes.length)*4);
  const lookup=new DataTexture(lookupData,plan.W,plan.H,RGBAFormat,FloatType);
  const atlas=new DataTexture(coefficients,9,Math.max(1,probes.length),RGBAFormat,FloatType);
  for(const texture of [lookup,atlas]) {
    texture.minFilter=NearestFilter;texture.magFilter=NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
  }
  const uniforms={dungeonBounceRooms:{value:lookup},dungeonBounceSH:{value:atlas},
    dungeonBounceSize:{value:new Vector2(plan.W,plan.H)},dungeonBounceRows:{value:Math.max(1,probes.length)},
    dungeonBounceStrength:{value:0.65}};
  return {slots,probes,coefficients,uniforms,
    publish(slot:number,sh:SphericalHarmonics3) {
      if(slot<0||slot>=probes.length)throw Error('Invalid dungeon probe slot');
      sh.coefficients.forEach((c,i)=>{coefficients.set([c.x,c.y,c.z,1],(slot*9+i)*4);});
      atlas.needsUpdate=true;
    },
    dispose(){lookup.dispose();atlas.dispose();},
  };
}
export type DungeonIndirectLight = ReturnType<typeof createDungeonIndirectLight>;

/** Separate shadow maps keep actors out of the bake without changing their live
 * shadows. A fixed fixture is copied at its exact world position and intensity;
 * its static shadow is computed once, then reused for the six probe faces. */
export function createDungeonBakeFixtures(scene:Object3D) {
  const group=new Group(),lights=new Set<PointLight>();group.visible=false;
  scene.traverseVisible(object=>{
    const source=object as PointLight;
    if(!source.isPointLight||!source.userData.dungeonFixedLight||!source.castShadow)return;
    const copy=source.clone();source.getWorldPosition(copy.position);
    copy.shadow.autoUpdate=false;copy.shadow.needsUpdate=true;
    group.add(copy);lights.add(copy);
  });
  return {group,lights,dispose(){group.removeFromParent();lights.forEach(light=>light.dispose());}};
}

export function applyDungeonIndirectLight(material: Material, light: DungeonIndirectLight) {
  const compile=material.onBeforeCompile.bind(material),baseKey=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{
    compile(shader,renderer);Object.assign(shader.uniforms,light.uniforms);
    shader.vertexShader='varying vec3 vDungeonBounceWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
      vec4 bouncePosition=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        bouncePosition=instanceMatrix*bouncePosition;
      #endif
      vDungeonBounceWorld=(modelMatrix*bouncePosition).xyz;
    `);
    shader.fragmentShader=`varying vec3 vDungeonBounceWorld;
      uniform sampler2D dungeonBounceRooms;
      uniform sampler2D dungeonBounceSH;
      uniform vec2 dungeonBounceSize;
      uniform float dungeonBounceRows;
      uniform float dungeonBounceStrength;
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',`
      #if defined(RE_IndirectDiffuse)
        vec3 bounceNormal=inverseTransformDirection(geometryNormal,viewMatrix);
        // Sample just outside the visible masonry face, on its room side.
        vec2 bounceCell=floor((vDungeonBounceWorld+bounceNormal*0.35).xz+dungeonBounceSize*0.5);
        if(all(greaterThanEqual(bounceCell,vec2(0.0))) && all(lessThan(bounceCell,dungeonBounceSize))) {
          float bounceSlot=texture2D(dungeonBounceRooms,(bounceCell+0.5)/dungeonBounceSize).r-1.0;
          if(bounceSlot>=0.0) {
            vec3 bounceSH[9];
            for(int i=0;i<9;i++)bounceSH[i]=texture2D(dungeonBounceSH,vec2((float(i)+0.5)/9.0,(bounceSlot+0.5)/dungeonBounceRows)).rgb;
            irradiance+=max(vec3(0.0),shGetIrradianceAt(bounceNormal,bounceSH))*dungeonBounceStrength;
          }
        }
      #endif
      #include <lights_fragment_maps>
    `);
  };
  material.customProgramCacheKey=()=>baseKey+':dungeon-room-bounce-v1';
  material.needsUpdate=true;
}
