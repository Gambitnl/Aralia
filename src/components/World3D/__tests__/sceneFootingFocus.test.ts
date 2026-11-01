import {describe,expect,it} from 'vitest';
import {sceneFootingFocus} from '../sceneFootingFocus';

const step=6.096;
const player={x:450.2372564563363,z:488.67694175411066};
const elara={x:436.81542248942407,z:488.6117358589292};
describe('standing-ground precision for independent people',()=>{
  it('retains the existing player anchor when no retained people are nearby',()=>{
    expect(sceneFootingFocus(player,[],step)).toEqual({centerX:451.104,centerZ:487.68,innerRadius:8,outerRadius:16});
  });
  it('covers both played Sedanes standing bodies inside the same bounded window',()=>{
    const focus=sceneFootingFocus(player,[elara],step)!;
    expect(focus.centerX).toBeCloseTo(445.008,10);
    expect(focus.innerRadius).toBeCloseTo(12.192,10);
    expect(focus.outerRadius).toBe(16);
    for(const point of [player,elara])expect(Math.max(Math.abs(point.x-focus.centerX),Math.abs(point.z-focus.centerZ))+2).toBeLessThanOrEqual(focus.innerRadius);
  });
  it('ignores invalid and out-of-window people instead of following them or expanding the window',()=>{
    expect(sceneFootingFocus(player,[{x:NaN,z:488},{x:900,z:900}],step)).toEqual(sceneFootingFocus(player,[],step));
  });
  it('keeps the player covered when people on opposite sides cannot all fit',()=>{
    const focus=sceneFootingFocus({x:0,z:0},[{x:-20,z:0},{x:20,z:0}],step)!;
    expect(Math.max(Math.abs(focus.centerX),Math.abs(focus.centerZ))+2).toBeLessThanOrEqual(focus.innerRadius);
    expect(focus.innerRadius).toBeLessThanOrEqual(14);
    expect(focus.outerRadius).toBe(16);
  });
  it('is independent of input order and leaves all accepted points unchanged',()=>{
    const points=[{x:442,z:489},elara],copy=JSON.stringify({player,points});
    expect(sceneFootingFocus(player,points,step)).toEqual(sceneFootingFocus(player,points.slice().reverse(),step));
    expect(JSON.stringify({player,points})).toBe(copy);
  });
  it('refuses invalid player coordinates or quantization instead of inventing an anchor',()=>{
    expect(sceneFootingFocus({x:Infinity,z:0},[],step)).toBeUndefined();
    expect(sceneFootingFocus(player,[],0)).toBeUndefined();
    expect(sceneFootingFocus(player,[],100)).toBeUndefined();
  });
});
