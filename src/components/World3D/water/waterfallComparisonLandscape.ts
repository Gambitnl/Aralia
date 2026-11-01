/**
 * Builds plain, solid land around the seven existing waterfall profiles.
 * Contact tops keep their exact positions. Rock underneath, dry shoulders,
 * upstream channels and lower basins make the shapes readable as land rather
 * than floating test cards. The neighboring courses join into one mountain, using the host valley material.
 *
 * The existing water prototype collides with the same contact tops and sloped
 * bank faces drawn here. Vertical cliff sides, undersides and basin interiors
 * remain visual terrain; basin-water pressure is unfinished.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/10/2026, 16:03:24
 * Dependents: components/World3D/water/waterfallTerrainComparisonView.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import type { ContactSurface, ContactVec3 } from '@/systems/world3d/river/waterfallContactFlow';
import type { TerrainComparisonCase } from '@/systems/world3d/river/waterfallTerrainProfiles';

type Point = ContactVec3;
type Rect = { x0: number; x1: number; z0: number; z1: number; surface: ContactSurface };
const FLOOR = 14;
const smooth = (a:number,b:number,v:number) => { const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t); };

export function buildWaterfallComparisonLandscape(profile: TerrainComparisonCase,
  toWorld: (p: Point) => Point, groundAt: (x: number, z: number) => number,
  hostMaterial: THREE.MeshStandardNodeMaterial, courseIndex: number, courseCount: number, canopy?: THREE.InstancedMesh,
  existingWaterAt?: (x:number,z:number)=>number): THREE.Mesh {
  const contactTops = profile.buildSurfaces();
  const surfaces = [...contactTops, ...(profile.buildBanks?.() ?? [])];
  const rects: Rect[] = surfaces.map(surface => ({ surface,
    x0: Math.min(...surface.vertices.map(p=>p[0])), x1:Math.max(...surface.vertices.map(p=>p[0])),
    z0:Math.min(...surface.vertices.map(p=>p[2])), z1:Math.max(...surface.vertices.map(p=>p[2])) }));
  const positions:number[]=[], kinds:number[]=[], tones:number[]=[], uvs:number[]=[], landNormals:number[]=[];
  const height = (r:Rect,x:number,z:number) => { const p=r.surface.vertices[0],n=r.surface.normal;return p[1]-(n[0]*(x-p[0])+n[2]*(z-p[2]))/n[1]; };
  function tri(a:Point,b:Point,c:Point,kind:number) {
    // The river's across-axis reflects local Z. Reverse winding when moving
    // to world space so uphill land is lit from above, like the host valley.
    for(const p of [a,c,b]) { const w=toWorld(p);positions.push(...w);kinds.push(kind);tones.push(.5);uvs.push(w[0]/8,w[2]/8); }
  }
  function quad(a:Point,b:Point,c:Point,d:Point,kind=1) {tri(a,b,c,kind);tri(a,c,d,kind);}
  // Keep the exact contact tops and their cliff faces. Surrounding earth now
  // meets them, rather than exposing a row of rectangular pedestals.
  for(const r of rects) {
    const v=r.surface.vertices;
    quad(v[0],v[3],v[2],v[1]);
    const low=v.map(p=>[p[0],profile.id==='steinsdalsfossen'?Math.max(FLOOR,p[1]-2.5):FLOOR,p[2]] as Point);
    for(let k=0;k<4;k++){const j=(k+1)%4;quad(v[k],low[k],low[j],v[j]);}
  }
  const end=Math.max(...rects.map(r=>r.x1));
  // Every tile samples the same ridge at its shared edge. This joins all seven
  // courses into continuous mountain terrain, with wide slopes down to the
  // existing valley at the two outer ends and behind/in front of the falls.
  const zMin=courseIndex===0?-58:-32, zMax=courseIndex===courseCount-1?150:32;
  function sample(x:number,z:number):number {
    const w=toWorld([x,0,z]), base=groundAt(w[0],w[2])-w[1];
    const globalZ=courseIndex*64+z;
    // Shared world-scale relief crosses course boundaries. Uneven spurs and
    // shallow dry gullies replace the identical straight shoulders of each lane.
    const relief=5*Math.sin(globalZ*.027+x*.013)+3*Math.sin(x*.063-globalZ*.041)
      +1.5*Math.sin(x*.12+globalZ*.083);
    const ridge=84-64*smooth(-22,125,x)+relief;
    let channel:number;
    if(x < -.5) channel=77.3+smooth(8,20,Math.abs(z))*5;
    else if(x>end) {
      // A broad, winding dry outlet connects the foot of each fall to its apron.
      // This is terrain shaping only; no extra water is emitted into it.
      const bend=7*Math.sin((x-end)*.035+courseIndex*.71)*smooth(end,end+28,x);
      channel=18-.015*(x-end)+smooth(8,27,Math.abs(z-bend))*7;
    }
    else {
      let best=Infinity,nearest=18;
      for(const r of rects){const px=Math.max(r.x0,Math.min(r.x1,x)),pz=Math.max(r.z0,Math.min(r.z1,z));
        const d=Math.hypot((px-x)*1.6,pz-z); if(d<best){best=d;nearest=height(r,px,pz);}}
      channel=nearest+Math.min(12,best*.7);
    }
    const bankDistance=Math.min(...rects.map(r=>Math.hypot(Math.max(r.x0-x,0,x-r.x1),Math.max(r.z0-z,0,z-r.z1))));
    const bend=4*Math.sin(x*.047+globalZ*.023)*smooth(3,12,bankDistance);
    const shoulder=Math.max(smooth(16,31,Math.abs(z-bend)),smooth(26,31,Math.abs(z)));
    // Exact contact faces and their three-meter banks remain untouched. Relief
    // grows outside them and reaches the same shared ridge at both tile edges.
    const detail=relief*.6*smooth(3,14,bankDistance)*(1-shoulder);
    let y=channel*(1-shoulder)+ridge*shoulder+detail;
    // The actual upstream channel must reach the reference lip downhill.
    // Decorative relief previously put a hump in this approach: native water
    // filled it and ran backward while the plane-only prototype missed it.
    // Carve the drawn rock itself; do not inject a second source below it.
    if(x>=-24&&x<-.5){
      const spans=profile.streamSpans??[{z0:-5,z1:5}];
      const distance=Math.min(...spans.map(span=>Math.max(span.z0-z,0,z-span.z1)));
      const core=1-smooth(0,2,distance),approach=77.3+.025*(-.5-x);
      y=y*(1-core)+approach*core;
    }
    const uphill=smooth(-150,-26,x),downhill=1-smooth(90,240,x);
    const left=courseIndex===0?smooth(-58,-24,z):1;
    const right=courseIndex===courseCount-1?1-smooth(26,150,z):1;
    // Preserve the original river and plunge pool. Broad mountain aprons must
    // meet their banks, not bury the already flowing channel under new earth.
    const level=existingWaterAt?.(w[0],w[2]) ?? -100;
    const riverMargin=level>-50?smooth(5,22,base+w[1]-level):1;
    const blend=uphill*downhill*left*right*riverMargin;
    y=base-.2+(y-base+.2)*blend;
    // Outside the water course this addition only raises land; it cannot cut
    // holes into the original valley, whose geometry stays authoritative.
    return Math.max(base-.2,y);
  }
  function axis(a:number,b:number,extra:number[]) {const values=[a,b,...extra.filter(v=>v>a&&v<b)];for(let v=a+3;v<b;v+=3)values.push(v);return [...new Set(values)].sort((a,b)=>a-b);}
  const xs=axis(-150,240,[-24,-6,-.5,end,...rects.flatMap(r=>[r.x0,r.x1])]);
  const spans=profile.streamSpans??[{z0:-5,z1:5}];
  const zs=axis(zMin,zMax,[-32,-24,-16,0,16,24,32,...spans.flatMap(s=>[s.z0-2,s.z0,s.z1,s.z1+2]),...rects.flatMap(r=>[r.z0,r.z1])]);
  const contactVertexCount=positions.length/3;
  const normalCache=new Map<string,number[]>();
  const normalAt=(p:Point)=>{
    const key=p[0]+','+p[2],cached=normalCache.get(key);if(cached)return cached;
    const step=.25;
    const a=toWorld([p[0]-step,sample(p[0]-step,p[2]),p[2]]),b=toWorld([p[0]+step,sample(p[0]+step,p[2]),p[2]]);
    const c=toWorld([p[0],sample(p[0],p[2]-step),p[2]-step]),d=toWorld([p[0],sample(p[0],p[2]+step),p[2]+step]);
    const normal=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]).cross(new THREE.Vector3(d[0]-c[0],d[1]-c[1],d[2]-c[2])).normalize().toArray();
    normalCache.set(key,normal);return normal;
  };
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++) {
    const x0=xs[i],x1=xs[i+1],z0=zs[j],z1=zs[j+1],xm=(x0+x1)/2,zm=(z0+z1)/2;
    // The original planar contact faces own these holes in the surrounding
    // mountain mesh. No noisy cosmetic rock is laid over the flowing water.
    if(rects.some(r=>xm>r.x0&&xm<r.x1&&zm>r.z0&&zm<r.z1))continue;
    // A short space between two contact shelves is a real exposed lip. The
    // previous nearest-shelf interpolation joined its high and low endpoints
    // with rock, turning every intended fall into a supported steep ramp.
    // Continue the receiving shelf's bed through this gap instead. The upper
    // shelf already owns its vertical cliff; both the rendered land and native
    // triangle sampler now see the same discontinuity. Continuous chutes stay
    // untouched, and no water is injected or forced airborne here.
    const receiving = rects.find(r => contactTops.includes(r.surface) && xm < r.x0 && r.x0-xm < 2
      && zm > r.z0 && zm < r.z1 && rects.some(up => contactTops.includes(up.surface)
        && up.x1 <= xm && r.x0-up.x1 <= 2 && zm > up.z0 && zm < up.z1));
    const gapHeight = (x:number,z:number) => {
      if (!receiving) return sample(x,z);
      const world=toWorld([x,0,z]);
      return Math.max(groundAt(world[0],world[2])-world[1]-.2,height(receiving,x,z));
    };
    const a:Point=[x0,gapHeight(x0,z0),z0],b:Point=[x0,gapHeight(x0,z1),z1],c:Point=[x1,gapHeight(x1,z1),z1],d:Point=[x1,gapHeight(x1,z0),z0];
    const slope=Math.max(Math.abs(a[1]-d[1])/(x1-x0),Math.abs(a[1]-b[1])/(z1-z0));
    quad(a,b,c,d,slope>.65?1:0);
    const gapNormal=receiving ? new THREE.Vector3(...toWorld(d)).sub(new THREE.Vector3(...toWorld(a)))
      .cross(new THREE.Vector3(...toWorld(b)).sub(new THREE.Vector3(...toWorld(a)))).normalize().toArray() : null;
    for(const p of [a,c,b,a,d,c])landNormals.push(...(gapNormal ?? normalAt(p)));
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('aKind',new THREE.Float32BufferAttribute(kinds,1));
  geometry.setAttribute('aTone',new THREE.Float32BufferAttribute(tones,1));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.computeVertexNormals();
  // Smooth only the surrounding earth. Contact shelves and cliff walls retain
  // their actual planar normals, so lighting does not round off the test shapes.
  const normals=geometry.getAttribute('normal');
  for(let i=0;i<landNormals.length/3;i++)normals.setXYZ(contactVertexCount+i,landNormals[i*3],landNormals[i*3+1],landNormals[i*3+2]);
  geometry.computeBoundingSphere();
  // Share the valley's shader graph/textures, but own the disposable material
  // wrapper. Disposing this comparison must never dispose the host ground.
  const material=hostMaterial.clone();material.side=THREE.DoubleSide;
  const mesh=new THREE.Mesh(geometry,material);mesh.name=`valley-waterfall-landscape-${profile.id}`;
  mesh.receiveShadow=true;
  // Use the existing valley canopy model, not a second tree style. Sparse
  // stands grow only on gentle, dry shoulders outside the water's contact bed.
  if(canopy && !Array.isArray(canopy.material)) {
    const roots:Point[]=[];
    for(let x=-100;x<160;x+=13)for(let z=zMin+7;z<zMax-5;z+=12){
      const seed=Math.sin(x*12.9898+(z+courseIndex*64)*78.233)*43758.5453;
      const r=seed-Math.floor(seed),px=x+(r-.5)*9,pz=z+Math.sin(seed)*4;
      if(r<.35 || px>-30&&px<end+30&&Math.abs(pz)<22)continue;
      const world=toWorld([px,0,pz]),water=existingWaterAt?.(world[0],world[2])??-100;
      if(water>-50 && sample(px,pz)+world[1]<water+5)continue;
      const slope=Math.hypot(sample(px+1,pz)-sample(px-1,pz),sample(px,pz+1)-sample(px,pz-1))/2;
      if(slope>.65)continue;
      roots.push([px,sample(px,pz),pz]);
    }
    if(roots.length){
      const trees=new THREE.InstancedMesh(canopy.geometry.clone(),new THREE.MeshStandardNodeMaterial({color:0x34462c,roughness:.95}),roots.length);
      const trunkGeo=new THREE.CylinderGeometry(.08,.16,5,5);trunkGeo.translate(0,2.5,0);
      const trunks=new THREE.InstancedMesh(trunkGeo,new THREE.MeshStandardNodeMaterial({color:0x5a4a3c,roughness:.92}),roots.length);
      const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
      roots.forEach((p,i)=>{const size=13+6*(.5+.5*Math.sin(i*17+courseIndex));q.setFromAxisAngle(up,i*2.399);
        const w=toWorld(p);matrix.compose(new THREE.Vector3(...w),q,new THREE.Vector3(size,size,size));trees.setMatrixAt(i,matrix);
        matrix.compose(new THREE.Vector3(...w),q,new THREE.Vector3(1,size/16,1));trunks.setMatrixAt(i,matrix);
      });
      trees.computeBoundingSphere();trunks.computeBoundingSphere();mesh.add(trees,trunks);
    }
  }
  // DEBT: New connecting hills are visual terrain. Existing water contact tops
  // and bank planes remain the solver boundary; general hillside collision and
  // basin pressure are a separate unfinished part of the water task.
  return mesh;
}
