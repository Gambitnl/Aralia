/** Follow accepted footing through a clear local camera arm, never by moving the party or walls.
 * This follows the existing world camera's bounded-candidate pattern using the
 * dungeon renderer's own structural boxes. Props and unsupported ceiling forms
 * are outside this conservative wall/cap/closed-door check. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 16:00:19
 * Dependents: components/BattleMap/dungeon/Dungeon3DPreview.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {Box3,Ray,Vector3} from 'three';
import type {DungeonSceneInstance,DungeonSceneModel} from './dungeonSceneModel';

type Structure=Pick<DungeonSceneModel,'walls'|'wallCaps'|'architectureBoxes'|'doors'>;
export interface DungeonPlayerCameraFrame {
  position:readonly [number,number,number];
  target:readonly [number,number,number];
}

function bounds(instance:DungeonSceneInstance):Box3 {
  const cos=Math.abs(Math.cos(instance.rotation)),sin=Math.abs(Math.sin(instance.rotation));
  return new Box3().setFromCenterAndSize(new Vector3(instance.x,instance.y,instance.z),
    new Vector3(cos*instance.sx+sin*instance.sz,instance.sy,sin*instance.sx+cos*instance.sz));
}

export function dungeonPlayerCameraFrame(model:Structure,player:{x:number;z:number}):DungeonPlayerCameraFrame|null {
  if(!Number.isFinite(player.x)||!Number.isFinite(player.z))return null;
  const boxes=[...model.walls,...model.wallCaps,...model.architectureBoxes.filter(part=>!part.purposeLandmark),
    ...model.doors.filter(door=>door.state!=='open')].map(bounds).filter(box=>
      box.max.x>=player.x-10&&box.min.x<=player.x+10&&box.max.z>=player.z-10&&box.min.z<=player.z+10);
  const targets=[0.08,0.45,0.85].map(y=>new Vector3(player.x,y,player.z));
  const baseX=9.6*0.62,baseZ=9.6*0.76;
  const radius0=Math.hypot(baseX,baseZ),angle0=Math.atan2(baseZ,baseX);
  const rotations=[0,Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2,3*Math.PI/4,-3*Math.PI/4,Math.PI];
  // Preserve the old frame exactly when it is clear. Try nearby directions,
  // shorter arms and higher eyes before conceding that no qualified frame exists.
  for(const height of [5.5,8,12])for(const radius of [radius0,6,4,2.4])for(const rotation of rotations){
    const original=radius===radius0&&rotation===0;
    const eye=new Vector3(player.x+(original?baseX:Math.cos(angle0+rotation)*radius),height,
      player.z+(original?baseZ:Math.sin(angle0+rotation)*radius));
    const visible=targets.every(target=>{
      const direction=target.clone().sub(eye);const lengthSquared=direction.lengthSq();
      const ray=new Ray(eye,direction.normalize());const hit=new Vector3();
      return boxes.every(box=>!ray.intersectBox(box,hit)||hit.distanceToSquared(eye)>=lengthSquared-1e-6);
    });
    if(visible)return {position:[eye.x,eye.y,eye.z],target:[player.x,0.45,player.z]};
  }
  return null;
}
