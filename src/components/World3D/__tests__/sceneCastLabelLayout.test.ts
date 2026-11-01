import {describe,it,expect} from 'vitest';
import {Camera,Object3D,PerspectiveCamera} from 'three';
import {createCastLabelProjectors,fitCastLabels} from '../sceneCastLabelLayout';

describe('actual cast-caption edge and overlap cases',()=>{
  it.each([{width:1440,height:900}])('keeps four coincident heads inside $width pixels without caption overlap',size=>{
    const result=[...fitCastLabels(['a','b','c','d'].map(id=>({id,x:size.width+40,y:4})),size).values()];
    expect(result).toHaveLength(4);
    for(let i=0;i<result.length;i++){
      const [x,y]=result[i];
      expect(x-90).toBeGreaterThanOrEqual(8);expect(x+90).toBeLessThanOrEqual(size.width-8);
      expect(y-13).toBeGreaterThanOrEqual(8);expect(y+13).toBeLessThanOrEqual(size.height-8);
      for(let j=0;j<i;j++)expect(Math.abs(x-result[j][0])>=184||Math.abs(y-result[j][1])>=30).toBe(true);
    }
  });
  it('preserves uncrowded head projections and omits invalid coordinates',()=>{
    expect([...fitCastLabels([{id:'a',x:200,y:300},{id:'b',x:500,y:400},{id:'bad',x:NaN,y:20}],{width:1440,height:900})])
      .toEqual([['a',[200,300]],['b',[500,400]]]);
  });
  it('does not drift across frames or depend on callback registration order',()=>{
    const project=createCastLabelProjectors(['a','b']);
    const first=project('a'),second=project('b');
    const a=new Object3D(),b=new Object3D(),camera=new PerspectiveCamera(50,1440/900,.1,100);
    a.position.set(0,0,-5);b.position.set(.01,0,-5);a.updateMatrixWorld();b.updateMatrixWorld();camera.updateMatrixWorld();
    const initial=[...a.matrixWorld.elements],size={width:1440,height:900};
    second(b,camera,size);first(a,camera,size);
    const expected=[first(a,camera,size),second(b,camera,size)];
    for(let frame=0;frame<6;frame++)expect([first(a,camera,size),second(b,camera,size)]).toEqual(expected);
    expect(a.matrixWorld.elements).toEqual(initial);
  });
  it('handles an unavailable viewport without mutating source points',()=>{
    const points=[{id:'a',x:1,y:2}];
    expect(fitCastLabels(points,{width:0,height:0}).size).toBe(0);
    expect(points).toEqual([{id:'a',x:1,y:2}]);
  });
  it('keeps desktop talk labels clear of the player name and footing notice',()=>{
    const size={width:1440,height:900};
    const obstacles=[{x:678,y:390,width:84,height:23},{x:610,y:418,width:220,height:46}];
    const placed=[...fitCastLabels([{id:'kaelen',x:723,y:402},{id:'elara',x:732,y:430}],size,obstacles).values()];
    expect(placed).toHaveLength(2);
    expect(Math.abs(placed[0][1]-placed[1][1])).toBeGreaterThanOrEqual(30);
    for(const [x,y] of placed)for(const rect of obstacles){
      expect(x+90+4<=rect.x||x-90-4>=rect.x+rect.width||y+13+4<=rect.y||y-13-4>=rect.y+rect.height).toBe(true);
    }
  });
});
