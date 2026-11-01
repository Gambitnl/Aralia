import {describe,expect,it} from 'vitest';
import {buildRiverLandTransition,type RiverLandLattice} from '../riverTerrainLod';
const lattice=(x0:number,z0:number,step:number,nx:number,nz:number):RiverLandLattice=>({x0,z0,step,nx,nz,height:(i,j)=>2*(x0+i*step)-3*(z0+j*step)});
describe('native fine/coarse land transition',()=>{
  it('covers only the surrounding annulus, with upward triangles and no artificial sink',()=>{
    const fine=lattice(.25,-.75,.5,9,7),outer=lattice(-32,-32,8,10,10),r=buildRiverLandTransition(fine,outer),p=r.positions;
    let area=0;
    for(let q=0;q<r.indices.length;q+=3){
      const a=r.indices[q]*3,b=r.indices[q+1]*3,c=r.indices[q+2]*3;
      const cross=(p[b]-p[a])*(p[c+2]-p[a+2])-(p[b+2]-p[a+2])*(p[c]-p[a]);
      expect(cross).toBeLessThan(0);area-=cross/2;
      const x=(p[a]+p[b]+p[c])/3,z=(p[a+2]+p[b+2]+p[c+2])/3;
      expect(x>fine.x0&&x<fine.x0+4&&z>fine.z0&&z<fine.z0+3).toBe(false);
    }
    expect(area).toBe((r.hole.maxX-r.hole.minX)*(r.hole.maxZ-r.hole.minZ)-12);
    for(let q=0;q<p.length;q+=3)expect(p[q+1]).toBe(2*p[q]-3*p[q+2]);
    // Preserve every actual fine boundary vertex, including the corners.
    for(let j=0;j<fine.nz;j++)for(let i=0;i<fine.nx;i++)if(i===0||j===0||i===fine.nx-1||j===fine.nz-1){
      const x=fine.x0+i*.5,z=fine.z0+j*.5;
      expect(Array.from({length:p.length/3},(_,v)=>v).some(v=>p[v*3]===x&&p[v*3+2]===z&&p[v*3+1]===fine.height(i,j))).toBe(true);
    }
  });
  it('refuses an outer lattice that cannot close around the actual fine boundary',()=>{
    expect(()=>buildRiverLandTransition(lattice(0,0,.5,20,20),lattice(0,0,8,2,2))).toThrow('does not surround');
  });
});
