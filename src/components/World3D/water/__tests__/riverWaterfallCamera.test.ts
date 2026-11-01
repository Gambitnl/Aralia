import {describe,it,expect} from 'vitest';
import {PerspectiveCamera,Vector3} from 'three';
import {fitWaterfallCamera} from '../riverWaterfallCamera';

describe('full waterfall inspection camera',()=>{
  it('frames the tall Sisters face from below the crest at wide and narrow widths',()=>{
    const points:Array<[number,number,number]>=[];
    for(const t of [0,.25,.5,.75,1])for(const n of [-90,0,90])points.push([45*t,-42-251.575*t,n]);
    for(const aspect of [1280/440,680/450,.4]){
      const pose=fitWaterfallCamera(points,[1,0],aspect,-.4),camera=new PerspectiveCamera(pose.fov,aspect,.1,6000);
      camera.position.fromArray(pose.pos);camera.lookAt(...pose.look);camera.updateMatrixWorld();
      expect(pose.pos[1]).toBeLessThan(pose.look[1]);
      for(const point of points){const p=new Vector3(...point).project(camera);expect(Math.abs(p.x)).toBeLessThan(.95);expect(Math.abs(p.y)).toBeLessThan(.95);expect(p.z).toBeGreaterThan(-1);expect(p.z).toBeLessThan(1);}
    }
  });
  it('keeps the complete612m descent and700m run inside wide and narrow pane frusta',()=>{
    const points:Array<[number,number,number]>=[];
    for(const t of [0,.25,.5,.75,1])for(const n of [-60,0,60])points.push([700*t,-950-612*t,n]);
    for(const aspect of [1280/440,620/438,.4]){
      const pose=fitWaterfallCamera(points,[1,0],aspect),camera=new PerspectiveCamera(pose.fov,aspect,.1,6000);
      camera.position.fromArray(pose.pos);camera.lookAt(...pose.look);camera.updateMatrixWorld();
      for(const point of points){const p=new Vector3(...point).project(camera);expect(Math.abs(p.x)).toBeLessThan(.95);expect(Math.abs(p.y)).toBeLessThan(.95);expect(p.z).toBeGreaterThan(-1);expect(p.z).toBeLessThan(1);}
      expect(pose.pos[0]).toBeGreaterThan(700);
    }
  });
  it('rejects missing or nonfinite actual terrain bounds',()=>{
    expect(()=>fitWaterfallCamera([], [1,0],1)).toThrow();
    expect(()=>fitWaterfallCamera([[0,NaN,0]], [1,0],1)).toThrow();
    expect(()=>fitWaterfallCamera([[0,0,0]], [1,0],0)).toThrow();
  });
});
