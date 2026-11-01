import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {Matrix4,type InstancedMesh} from 'three/webgpu';
import {buildRiverVegetation,type RiverVegetationInput} from '../riverVegetation';

// Placement tests use actual native plant generation and instance matrices.
// Canvas drawing is irrelevant to positions; real bitmap appearance is checked
// in the browser rather than pretending this no-op context proves it.
let contextSpy:ReturnType<typeof vi.spyOn>;
beforeAll(()=>{
  const context=new Proxy({}, {get:()=>()=>{}});
  const getContext=((kind:string)=>kind==='2d'?context:null) as unknown as HTMLCanvasElement['getContext'];
  contextSpy=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(getContext);
});
afterAll(()=>contextSpy.mockRestore());
const fixture:RiverVegetationInput={seed:582,domain:{x0:500,z0:0,x1:530,z1:30},groundAt:()=>10,overWaterAt:()=>100,
  courseDistAt:()=>0,courseSNAt:()=>({s:1480,n:0}),halfWidthAt:()=>70,plantAllowedAt:(x,z)=>x>=510&&x<530&&z>=0&&z<30};
const roots=(input:RiverVegetationInput)=>{
  const result=buildRiverVegetation(input),points:number[][]=[],m=new Matrix4();
  for(const child of result.group.children){const mesh=child as InstancedMesh;if(!mesh.isInstancedMesh)continue;for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);points.push([m.elements[12],m.elements[13],m.elements[14]]);}}
  return points;
};
describe('native vegetation extension ownership',()=>{
  it('does not populate an unowned extension or an ordinary course center',()=>{
    expect(roots({...fixture,plantAllowedAt:()=>false,landIslandAt:()=>true})).toEqual([]);
    expect(roots(fixture)).toEqual([]);
  });
  it('plants raised dry land inside the declared mask, with wet and steep rejection retained',()=>{
    const dry=roots({...fixture,landIslandAt:()=>true});expect(dry.length).toBeGreaterThan(0);
    for(const [x,,z] of dry){expect(x).toBeGreaterThanOrEqual(510);expect(x).toBeLessThan(530);expect(z).toBeGreaterThanOrEqual(0);expect(z).toBeLessThan(30);}
    expect(roots({...fixture,landIslandAt:()=>true,overWaterAt:()=>0})).toEqual([]);
    expect(roots({...fixture,landIslandAt:()=>true,groundAt:x=>10+2*x})).toEqual([]);
  });
});
