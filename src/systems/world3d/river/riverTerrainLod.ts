/** Joins the actual fine land edge to a surrounding coarse land lattice.
 * The coarse mesh leaves this rectangular hole empty. Four stitched strips
 * fill only the space between its boundary and the fine vertices, avoiding
 * overlapping heightfields that poke through one another at steep falls.
 * This builds land geometry only; it never changes hydraulic cells or water. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/10/2026, 22:22:42
 * Dependents: components/World3D/water/riverReachScene.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export interface RiverLandLattice {
  x0:number;z0:number;step:number;nx:number;nz:number;
  height(i:number,j:number):number;
}
export interface RiverLandTransition {
  positions:Float32Array;indices:Uint32Array;
  hole:{minX:number;maxX:number;minZ:number;maxZ:number};
}
export function buildRiverLandTransition(fine:RiverLandLattice,outer:RiverLandLattice):RiverLandTransition {
  const fx0=fine.x0,fz0=fine.z0,fx1=fx0+(fine.nx-1)*fine.step,fz1=fz0+(fine.nz-1)*fine.step;
  const i0=Math.floor((fx0-outer.x0)/outer.step)-1,i1=Math.ceil((fx1-outer.x0)/outer.step)+1;
  const j0=Math.floor((fz0-outer.z0)/outer.step)-1,j1=Math.ceil((fz1-outer.z0)/outer.step)+1;
  if(fine.nx<2||fine.nz<2||outer.step<=fine.step||i0<0||j0<0||i1>=outer.nx||j1>=outer.nz)throw Error('Outer land lattice does not surround the fine edge');
  const hole={minX:outer.x0+i0*outer.step,maxX:outer.x0+i1*outer.step,minZ:outer.z0+j0*outer.step,maxZ:outer.z0+j1*outer.step};
  const positions:number[]=[],indices:number[]=[];
  type Point={x:number;y:number;z:number;t:number;index:number};
  const point=(x:number,y:number,z:number,t:number):Point=>{
    if(!Number.isFinite(x+y+z))throw Error('Nonfinite native land boundary');
    const index=positions.length/3;positions.push(x,y,z);return {x,y,z,t,index};
  };
  const triangle=(a:Point,b:Point,c:Point):void=>{
    const area=(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
    if(area===0)return;
    // Clockwise in the horizontal plane faces upward in world coordinates.
    indices.push(a.index,area<0?b.index:c.index,area<0?c.index:b.index);
  };
  const stitch=(inner:Point[],outside:Point[]):void=>{
    let i=0,j=0;
    while(i<inner.length-1||j<outside.length-1){
      if(j===outside.length-1||(i<inner.length-1&&inner[i+1].t<=outside[j+1].t)){
        triangle(inner[i],inner[i+1],outside[j]);i++;
      }else{triangle(inner[i],outside[j+1],outside[j]);j++;}
    }
  };
  for(const north of [true,false]){
    const fj=north?0:fine.nz-1,oj=north?j0:j1;
    stitch(Array.from({length:fine.nx},(_,i)=>{const x=fx0+i*fine.step;return point(x,fine.height(i,fj),north?fz0:fz1,x);}),
      Array.from({length:i1-i0+1},(_,k)=>{const i=i0+k,x=outer.x0+i*outer.step;return point(x,outer.height(i,oj),outer.z0+oj*outer.step,x);}));
  }
  for(const west of [true,false]){
    const fi=west?0:fine.nx-1,oi=west?i0:i1;
    stitch(Array.from({length:fine.nz},(_,j)=>{const z=fz0+j*fine.step;return point(west?fx0:fx1,fine.height(fi,j),z,z);}),
      Array.from({length:j1-j0+1},(_,k)=>{const j=j0+k,z=outer.z0+j*outer.step;return point(outer.x0+oi*outer.step,outer.height(oi,j),z,z);}));
  }
  return {positions:Float32Array.from(positions),indices:Uint32Array.from(indices),hole};
}
