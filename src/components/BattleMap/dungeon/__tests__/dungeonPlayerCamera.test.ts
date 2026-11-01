import {describe,expect,it} from 'vitest';
import {dungeonPlayerCameraFrame} from '../dungeonPlayerCamera';
import type {DungeonSceneInstance,DungeonSceneDoor} from '../dungeonSceneModel';

function wall(x:number,z:number,sx:number,sz:number,height=2.4):DungeonSceneInstance {
  return {x,y:height/2,z,sx,sy:height,sz,rotation:0,color:'#777777'};
}
const empty={walls:[] as DungeonSceneInstance[],wallCaps:[] as DungeonSceneInstance[],architectureBoxes:[] as DungeonSceneInstance[],doors:[] as DungeonSceneDoor[]};

describe('source-aware dungeon Follow Me camera',()=>{
  it('preserves the existing unobstructed frame and accepted footing exactly',()=>{
    const player=Object.freeze({x:12,z:-8});const before=structuredClone(empty);
    expect(dungeonPlayerCameraFrame(empty,player)).toEqual({position:[12+9.6*.62,5.5,-8+9.6*.76],target:[12,.45,-8]});
    expect(empty).toEqual(before);expect(player).toEqual({x:12,z:-8});
  });
  it('keeps feet visible above or between the actual corridor side walls',()=>{
    const model={...empty,walls:[wall(-1,0,1,20),wall(1,0,1,20)]};
    const before=structuredClone(model);const frame=dungeonPlayerCameraFrame(model,{x:0,z:0})!;
    expect(frame).not.toBeNull();
    const [x,y]=frame.position;
    // Independent plane check at the corridor's inner face, not the camera chooser's box routine.
    if(Math.abs(x)>.5)expect(.08+(y-.08)*(.5/Math.abs(x))).toBeGreaterThan(2.4);
    expect(frame.position).not.toEqual([9.6*.62,5.5,9.6*.76]);
    expect(model).toEqual(before);
  });
  it('treats a closed door as structure while an open leaf keeps the original frame',()=>{
    const door={...wall(0,1,20,1),state:'door' as const};
    const frame=dungeonPlayerCameraFrame({...empty,doors:[door]},{x:0,z:0})!;
    const [,y,z]=frame.position;
    if(z>.5)expect(.08+(y-.08)*(.5/z)).toBeGreaterThan(2.4);
    expect(dungeonPlayerCameraFrame({...empty,doors:[{...door,state:'open'}]},{x:0,z:0})?.position).toEqual([9.6*.62,5.5,9.6*.76]);
  });
  it('fails closed for an enclosed tall structure or invalid footing',()=>{
    const model={...empty,walls:[wall(-1,0,1,20,50),wall(1,0,1,20,50),wall(0,-1,20,1,50),wall(0,1,20,1,50)]};
    expect(dungeonPlayerCameraFrame(model,{x:0,z:0})).toBeNull();
    expect(dungeonPlayerCameraFrame(empty,{x:NaN,z:0})).toBeNull();
  });
});
