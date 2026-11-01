/**
 * Reconstructs a visible water boundary from the live waterfall's material samples.
 * It changes representation only: sample motion, source history and water budgets
 * stay owned by the live solver. The native river does not call this experiment.
 *
 * One normalized parcel-volume field supplies both the boundary and its normals.
 * Sparse water below the fixed half-density contour remains explicitly unmeshed.
 * Optional local anisotropy shrinks kernel axes inferred from the actual cloud;
 * it never enlarges support, moves samples, fills gaps or invents droplets.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 06/10/2026, 08:21:43
 * Dependents: None (Orphan)
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export type LiquidSurfaceVec3=[number,number,number];
export interface LiquidSurfaceSample {position:readonly[number,number,number];volume:number}
export interface LiquidSurfaceOptions {
  cellSize:number;support:number;anisotropic?:boolean;minimumAxisRatio?:number;
  maxNodes?:number;maxTriangles?:number;
}
export interface LiquidSurfaceReceipt {
  samples:number;sampleVolume:number;depositedVolume:number;depositError:number;
  meshVolume:number;signedMeshVolume:number;surfaceArea:number;volumeRatio:number;
  diluteSampleVolume:number;diluteSamples:number;fieldBelowIsoVolume:number;
  retainedFieldVolume:number;omittedBelowIsoVolume:number;candidateBins:number;
  nodes:number;activeCells:number;vertices:number;triangles:number;components:number;
  boundaryEdges:number;nonManifoldEdges:number;inconsistentEdges:number;degenerateTriangles:number;normalFallbackVertices:number;
  cellSize:number;support:number;iso:number;anisotropic:boolean;minimumAxisRatio:number;
  shrunkenSamples:number;isolatedSamples:number;minimumKernelAxis:number;maximumKernelAxis:number;
  milliseconds:number;
}
export interface LiquidSurfaceResult {
  positions:Float32Array;normals:Float32Array;indices:Uint32Array;
  // Exact field only in the surface/normal band; omitted dilute volume is in
  // the receipt. This sparse band is not a complete volume texture.
  field:{coordinates:Int32Array;density:Float64Array;cellSize:number};receipt:LiquidSurfaceReceipt;
}
type V=LiquidSurfaceVec3;
type Node={coordinate:V;value:number};
const key=(p:readonly number[])=>`${p[0]},${p[1]},${p[2]}`;
const dot=(a:readonly number[],b:readonly number[])=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:readonly number[],b:readonly number[]):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const subtract=(a:readonly number[],b:readonly number[]):V=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const corners:V[]=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
const tetrahedra=[[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6],[0,5,1,6]];

// A small symmetric eigensolve measures local shape, without a prescribed sheet
// direction. Volume weights make coincident sample subdivision immaterial.
function principalAxes(matrix:number[]) {
  const a=matrix.slice(),v=[1,0,0,0,1,0,0,0,1];
  for(let iteration=0;iteration<12;iteration++){
    let p=0,q=1;for(const pair of[[0,2],[1,2]])if(Math.abs(a[pair[0]*3+pair[1]])>Math.abs(a[p*3+q]))[p,q]=pair;
    if(Math.abs(a[p*3+q])<1e-16*Math.max(1,Math.abs(a[0])+Math.abs(a[4])+Math.abs(a[8])))break;
    const angle=.5*Math.atan2(2*a[p*3+q],a[q*3+q]-a[p*3+p]),c=Math.cos(angle),s=Math.sin(angle);
    const j=[1,0,0,0,1,0,0,0,1];j[p*3+p]=j[q*3+q]=c;j[p*3+q]=s;j[q*3+p]=-s;
    const aj=new Array<number>(9).fill(0),next=new Array<number>(9).fill(0),nv=new Array<number>(9).fill(0);
    for(let r=0;r<3;r++)for(let col=0;col<3;col++)for(let k=0;k<3;k++){aj[r*3+col]+=a[r*3+k]*j[k*3+col];nv[r*3+col]+=v[r*3+k]*j[k*3+col];}
    for(let r=0;r<3;r++)for(let col=0;col<3;col++)for(let k=0;k<3;k++)next[r*3+col]+=j[k*3+r]*aj[k*3+col];
    for(let i=0;i<9;i++){a[i]=next[i];v[i]=nv[i];}
  }
  const order=[0,1,2].sort((x,y)=>a[y*3+y]-a[x*3+x]);
  return{values:order.map(i=>Math.max(0,a[i*3+i])),axes:order.map(i=>[v[i],v[3+i],v[6+i]] as V)};
}

export function buildWaterfallLiquidSurface(samples:readonly LiquidSurfaceSample[],options:LiquidSurfaceOptions):LiquidSurfaceResult {
  const began=performance.now(),h=options.cellSize,H=options.support,iso=.5,anisotropic=options.anisotropic??true,ratio=options.minimumAxisRatio??.25,maxNodes=options.maxNodes??250000,maxTriangles=options.maxTriangles??300000;
  if(![h,H,ratio].every(Number.isFinite)||h<=0||H<h||H/h>8||ratio<.25||ratio>1||!Number.isInteger(maxNodes)||maxNodes<1||maxNodes>4000000||!Number.isInteger(maxTriangles)||maxTriangles<1||maxTriangles>2000000||samples.length>50000)throw Error('Invalid bounded liquid surface options');
  if(anisotropic&&h>H*ratio+1e-12)throw Error('Smallest liquid kernel axis is unresolved on reconstruction grid');
  if(samples.some(p=>p.position.length!==3||![...p.position,p.volume].every(Number.isFinite)||p.position.some(x=>Math.abs(x/h)>2**20)||p.volume<=0))throw Error('Invalid liquid surface material');
  // Coincident quadrature subdivision represents the same water. Coalescing
  // those weights also keeps covariance roundoff independent of sample count.
  const groups=new Map<string,LiquidSurfaceSample>();for(const p of samples){const k=key(p.position),old=groups.get(k);groups.set(k,{position:p.position,volume:(old?.volume??0)+p.volume});}const material=[...groups.values()];
  const buckets=new Map<string,number[]>();for(let i=0;i<material.length;i++){const k=key(material[i].position.map(x=>Math.floor(x/H))),list=buckets.get(k)??[];list.push(i);buckets.set(k,list);}
  const binCells=Math.max(1,Math.floor(H/h)),upperBins=new Map<string,{coordinate:V;upper:number}>(),kernels:{particle:LiquidSurfaceSample;axes:V[];radii:V;lo:number[];hi:number[];scale:number}[]=[];
  const weightAt=(coordinate:readonly number[],particle:LiquidSurfaceSample,axes:V[],radii:V)=>{const d=coordinate.map((v,c)=>v*h-particle.position[c]),q=Math.sqrt(axes.reduce((v,a,c)=>v+(dot(d,a)/radii[c])**2,0))/1.5;return q<1?(1-q)**4*(1+4*q):0;};
  const nodes=new Map<string,Node>();let sampleVolume=0,shrunkenSamples=0,isolatedSamples=0,minimumAxis=H;
  for(const particle of material){sampleVolume+=particle.volume;
    let axes:V[]=[[1,0,0],[0,1,0],[0,0,1]],radii:V=[H,H,H];
    if(anisotropic){const center=particle.position,bucket=center.map(x=>Math.floor(x/H)),neighbors:{delta:V;weight:number}[]=[],mean:V=[0,0,0];let weight=0;
      for(let k=bucket[2]-2;k<=bucket[2]+2;k++)for(let j=bucket[1]-2;j<=bucket[1]+2;j++)for(let i=bucket[0]-2;i<=bucket[0]+2;i++)for(const id of buckets.get(key([i,j,k]))??[]){const other=material[id],delta=subtract(other.position,center),distance2=dot(delta,delta)/(1.5*H)**2;if(distance2>=1)continue;const w=other.volume*(1-distance2)**3;neighbors.push({delta,weight:w});weight+=w;for(let c=0;c<3;c++)mean[c]+=w*delta[c];}
      if(weight>0){for(let c=0;c<3;c++)mean[c]/=weight;const covariance=new Array<number>(9).fill(0);for(const n of neighbors){const d=subtract(n.delta,mean);for(let c=0;c<3;c++)for(let a=0;a<3;a++)covariance[c*3+a]+=n.weight*d[c]*d[a]/weight;}
        const eig=principalAxes(covariance);if(eig.values[0]>1e-12*H*H){axes=eig.axes;radii=eig.values.map(value=>H*Math.max(ratio,Math.sqrt(value/eig.values[0]))) as V;if(radii.some(r=>r<H*(1-1e-6)))shrunkenSamples++;}else isolatedSamples++;
      }
    }
    minimumAxis=Math.min(minimumAxis,...radii);
    // A radial compact kernel is insensitive to rotations within a repeated
    // covariance eigenspace. Its Euclidean reach never exceeds 1.5*support.
    const bounds=[0,1,2].map(c=>1.5*Math.sqrt(axes.reduce((s,a,j)=>s+(a[c]*radii[j])**2,0)));
    const lo=particle.position.map((x,c)=>Math.ceil((x-bounds[c])/h)),hi=particle.position.map((x,c)=>Math.floor((x+bounds[c])/h));let sum=0;
    for(let k=lo[2];k<=hi[2];k++)for(let j=lo[1];j<=hi[1];j++)for(let i=lo[0];i<=hi[0];i++)sum+=weightAt([i,j,k],particle,axes,radii);
    if(!(sum>0)||!Number.isFinite(sum))throw Error('Liquid kernel is unresolved on reconstruction grid');
    const scale=particle.volume/(sum*h**3);if(!Number.isFinite(scale))throw Error('Nonfinite liquid field');kernels.push({particle,axes,radii,lo,hi,scale});
    const binLo=lo.map(v=>Math.floor(v/binCells)),binHi=hi.map(v=>Math.floor(v/binCells));
    for(let k=binLo[2];k<=binHi[2];k++)for(let j=binLo[1];j<=binHi[1];j++)for(let i=binLo[0];i<=binHi[0];i++){
      const coordinate:V=[i,j,k],distance2=coordinate.reduce((s,v,c)=>{const minimum=v*binCells*h,maximum=(v*binCells+binCells-1)*h,d=Math.max(minimum-particle.position[c],0,particle.position[c]-maximum);return s+d*d;},0),q=Math.sqrt(distance2)/(1.5*H),upper=q<1?scale*(1-q)**4*(1+4*q):0;
      if(upper>0){const k=key(coordinate),bin=upperBins.get(k)??{coordinate,upper:0};bin.upper+=upper;if(!Number.isFinite(bin.upper))throw Error('Nonfinite liquid field bound');upperBins.set(k,bin);}
    }
  }
  if(!Number.isFinite(sampleVolume))throw Error('Nonfinite material volume');
  // An upper bound below .5 proves that a bin cannot contain a contour node.
  // Keep its neighbours too, so all surface crossings and normal differences
  // see the exact common field. Omitted kernel volume is retained separately;
  // this is not a particle cutoff, a new surface level or a mass deletion.
  const retainedBins=new Set<string>(),apron=Math.ceil(2/binCells);let candidateBins=0;
  for(const bin of upperBins.values())if(bin.upper>=iso-64*Number.EPSILON*Math.max(1,bin.upper)){candidateBins++;for(let k=-apron;k<=apron;k++)for(let j=-apron;j<=apron;j++)for(let i=-apron;i<=apron;i++)retainedBins.add(key([bin.coordinate[0]+i,bin.coordinate[1]+j,bin.coordinate[2]+k]));}
  let omittedBelowIsoVolume=0;
  for(const kernel of kernels){const{particle,axes,radii,lo,hi,scale}=kernel;for(let k=lo[2];k<=hi[2];k++)for(let j=lo[1];j<=hi[1];j++)for(let i=lo[0];i<=hi[0];i++){const coordinate:V=[i,j,k],w=weightAt(coordinate,particle,axes,radii);if(w<=0)continue;const contribution=scale*w;
      if(!retainedBins.has(key(coordinate.map(v=>Math.floor(v/binCells))))){omittedBelowIsoVolume+=contribution*h**3;continue;}
      const nk=key(coordinate),node=nodes.get(nk)??{coordinate,value:0};node.value+=contribution;if(!Number.isFinite(node.value))throw Error('Nonfinite liquid field');nodes.set(nk,node);if(nodes.size>maxNodes)throw Error('Liquid reconstruction node capacity exceeded');
    }}
  const value=(p:readonly number[])=>nodes.get(key(p))?.value??0;
  // Resolve floating-point equality consistently at every use of a shared
  // grid node. This machine-scale tie rule changes no physical contour level.
  const levelValue=(p:readonly number[])=>{const v=value(p);return Math.abs(v-iso)<=32*Number.EPSILON*Math.max(1,v)?iso:v;};
  const densityAt=(p:readonly number[])=>{const q=p.map(x=>x/h),lo=q.map(Math.floor);let result=0;for(const c of corners){const node=c.map((x,a)=>x+lo[a]),w=c.reduce((w,x,a)=>w*(x?q[a]-lo[a]:1-q[a]+lo[a]),1);result+=w*value(node);}return result;};
  const gradient=(p:readonly number[]):V=>[0,1,2].map(c=>{const a=[...p],b=[...p];a[c]++;b[c]--;return(value(a)-value(b))/(2*h);}) as V;
  const cells=new Map<string,V>();let depositedVolume=omittedBelowIsoVolume,fieldBelowIsoVolume=omittedBelowIsoVolume;
  for(const node of nodes.values()){depositedVolume+=node.value*h**3;if(node.value<iso)fieldBelowIsoVolume+=node.value*h**3;if(levelValue(node.coordinate)>=iso)for(const c of corners){const cell=subtract(node.coordinate,c);cells.set(key(cell),cell);}}
  const positions:number[]=[],normals:number[]=[],indices:number[]=[],vertexIds=new Map<string,number>();let degenerateTriangles=0;
  const vertex=(a:V,b:V,va:number,vb:number)=>{const t=(iso-va)/(vb-va),ka=key(a),kb=key(b),k=va===iso?`n:${ka}`:vb===iso?`n:${kb}`:ka<kb?`${ka}|${kb}`:`${kb}|${ka}`;const prior=vertexIds.get(k);if(prior!==undefined)return prior;
    const id=positions.length/3,ga=gradient(a),gb=gradient(b);for(let c=0;c<3;c++){positions.push((a[c]+t*(b[c]-a[c]))*h);normals.push(-(ga[c]+t*(gb[c]-ga[c])));}vertexIds.set(k,id);return id;};
  const triangle=(a:number,b:number,c:number,outward:number[])=>{if(a===b||b===c||a===c){degenerateTriangles++;return;}const pa=positions.slice(a*3,a*3+3),pb=positions.slice(b*3,b*3+3),pc=positions.slice(c*3,c*3+3),normal=cross(subtract(pb,pa),subtract(pc,pa));if(dot(normal,normal)<1e-24*h**4){degenerateTriangles++;return;}if(dot(normal,outward)<0)[b,c]=[c,b];indices.push(a,b,c);if(indices.length/3>maxTriangles)throw Error('Liquid reconstruction triangle capacity exceeded');};
  // Consistent cube tetrahedra share face diagonals. This closes the boundary
  // across cells without joining separate zero-density regions.
  for(const cell of cells.values()){const p=corners.map(c=>c.map((v,a)=>v+cell[a]) as V),v=p.map(levelValue);for(const tet of tetrahedra){const inside=tet.filter(i=>v[i]>=iso),outside=tet.filter(i=>v[i]<iso);if(!inside.length||!outside.length)continue;
      const edge=(a:number,b:number)=>vertex(p[a],p[b],v[a],v[b]),outward=[0,1,2].map(c=>outside.reduce((s,i)=>s+p[i][c]/outside.length,0)-inside.reduce((s,i)=>s+p[i][c]/inside.length,0));
      if(inside.length===1)triangle(...outside.map(i=>edge(inside[0],i)) as [number,number,number],outward);
      else if(inside.length===3)triangle(...inside.map(i=>edge(outside[0],i)) as [number,number,number],outward);
      else{const a=edge(inside[0],outside[0]),b=edge(inside[0],outside[1]),c=edge(inside[1],outside[1]),d=edge(inside[1],outside[0]);triangle(a,b,c,outward);triangle(a,c,d,outward);}
    }}
  let normalFallbackVertices=0;const fallback=new Float64Array(normals.length),edges=new Map<string,{count:number;orientation:number}>(),parents=Array.from({length:positions.length/3},(_,i)=>i),find=(i:number):number=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
  let signedMeshVolume=0,surfaceArea=0;const gpuPositions=Float32Array.from(positions),reference=positions.length?positions.slice(0,3):[0,0,0];
  for(let i=0;i<indices.length;i+=3){const tri=indices.slice(i,i+3),p=tri.map(id=>Array.from(gpuPositions.slice(id*3,id*3+3))),n=cross(subtract(p[1],p[0]),subtract(p[2],p[0]));surfaceArea+=Math.hypot(...n)/2;signedMeshVolume+=dot(subtract(p[0],reference),cross(subtract(p[1],reference),subtract(p[2],reference)))/6;
    for(let c=0;c<3;c++){const a=tri[c],b=tri[(c+1)%3],k=a<b?`${a},${b}`:`${b},${a}`,edge=edges.get(k)??{count:0,orientation:0};edge.count++;edge.orientation+=a<b?1:-1;edges.set(k,edge);parents[find(b)]=find(a);for(let j=0;j<3;j++)fallback[a*3+j]+=n[j];}
  }
  for(let i=0;i<normals.length;i+=3){let length=Math.hypot(normals[i],normals[i+1],normals[i+2]);if(length<1e-16){normalFallbackVertices++;for(let c=0;c<3;c++)normals[i+c]=fallback[i+c];length=Math.hypot(normals[i],normals[i+1],normals[i+2]);}if(length>0)for(let c=0;c<3;c++)normals[i+c]/=length;}
  let boundaryEdges=0,nonManifoldEdges=0,inconsistentEdges=0;for(const edge of edges.values()){if(edge.count===1)boundaryEdges++;if(edge.count>2)nonManifoldEdges++;if(edge.count===2&&edge.orientation!==0)inconsistentEdges++;}
  let diluteSamples=0,diluteSampleVolume=0;for(const p of samples)if(densityAt(p.position)<iso){diluteSamples++;diluteSampleVolume+=p.volume;}
  const used=new Set(indices),components=new Set([...used].map(find)).size,coordinates=new Int32Array(nodes.size*3),density=new Float64Array(nodes.size);let cursor=0;for(const node of nodes.values()){coordinates.set(node.coordinate,cursor*3);density[cursor++]=node.value;}
  const receipt:LiquidSurfaceReceipt={samples:samples.length,sampleVolume,depositedVolume,depositError:depositedVolume-sampleVolume,retainedFieldVolume:depositedVolume-omittedBelowIsoVolume,omittedBelowIsoVolume,candidateBins,meshVolume:Math.abs(signedMeshVolume),signedMeshVolume,surfaceArea,volumeRatio:sampleVolume?Math.abs(signedMeshVolume)/sampleVolume:0,diluteSampleVolume,diluteSamples,fieldBelowIsoVolume,nodes:nodes.size,activeCells:cells.size,vertices:positions.length/3,triangles:indices.length/3,components,boundaryEdges,nonManifoldEdges,inconsistentEdges,degenerateTriangles,normalFallbackVertices,cellSize:h,support:H,iso,anisotropic,minimumAxisRatio:ratio,shrunkenSamples,isolatedSamples,minimumKernelAxis:minimumAxis,maximumKernelAxis:H,milliseconds:performance.now()-began};
  return{positions:gpuPositions,normals:Float32Array.from(normals),indices:Uint32Array.from(indices),field:{coordinates,density,cellSize:h},receipt};
}
