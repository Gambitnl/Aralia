/** A diagnostic connected liquid strip carried by emission time.
 * Its front/back boundaries and optical thickness share the same positive
 * material section. This is prescribed kinematics, not a fluid solver;
 * section volume accounting does not prove swept three-dimensional volume.
 * No water is separated into unresolved droplets or invented whitewater. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/10/2026, 21:09:08
 * Dependents: components/World3D/water/riverWaterfallView.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export const MATERIAL_SHEET={rows:513,columns:49,emissionCellS:.05,emissionSupportS:.075}as const;
export interface MaterialSheetSection{across:Float64Array;center:Float64Array;thickness:Float64Array;area:number;measuredArea:number;emission:number;age:number}
const hash=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const eventCache=new Map<string,{position:number;span:number;sign:number;strength:number;drift:number}>();
function sheetEvent(level:number,n:number){const key=level+'/'+n;let e=eventCache.get(key);if(!e){const seed=n+level*997;e={position:.10+.80*hash(seed+4),span:.14+.18*hash(seed+29),sign:2*hash(seed+67)-1,strength:.3+.7*hash(seed+8),drift:2*hash(seed+31)-1};eventCache.set(key,e);if(eventCache.size>512)eventCache.delete(eventCache.keys().next().value!);}return e;}
const bandTopology=new Map<number,Uint32Array>();
const bump=(x:number)=>Math.abs(x)>=1?0:(1-x*x)*(1-x*x);
/** At the lip both displacement and its age derivative vanish. Fixing an
 * emission label retains the same events as age grows; fixing a physical age
 * and advancing time replaces labels at the actual source emission rate. */
export function materialSheetSection(area:number,width:number,age:number,emission:number,columns:number=MATERIAL_SHEET.columns):MaterialSheetSection{
 if(![area,width,age,emission].every(Number.isFinite)||area<0||width<=0||age<0||!Number.isSafeInteger(columns)||columns<3)throw Error('Invalid material sheet section');
 const across=new Float64Array(columns),center=new Float64Array(columns),thickness=new Float64Array(columns);
 const develop=1-Math.exp(-age*age*1.3),amplitude=Math.min(.55,width*.10)*develop;
 const events:{weight:number;position:number;span:number;sign:number;strength:number;drift:number}[]=[];
 for(const [level,cellSize,support]of [[0,.05,.075],[1,.18,.22]]as const){
  const cell=Math.floor(emission/cellSize);
  for(let n=cell-2;n<=cell+2;n++){
   const parcel=bump((emission-(n+.5)*cellSize)/support);if(parcel===0)continue;
   const e=sheetEvent(level,n);events.push({weight:parcel*(level===0?.65:.35),position:e.position+.06*develop*e.drift,span:e.span,sign:e.sign,strength:e.strength,drift:e.drift});
  }
 }
 // Edge changes are carried by the same emitted labels as the interior.
 // Their zero-age value/derivative preserve the exact source opening.
 let edge=0,shift=0;for(const e of events){edge+=e.weight*e.sign;shift+=e.weight*e.drift;}
 const actualWidth=width*(1+.16*develop*Math.tanh(edge)),origin=width*.04*develop*Math.tanh(shift);
 const weights=new Float64Array(columns);let integral=0;
 for(let k=0;k<columns;k++){
  const u=k/(columns-1),x=(u-.5)*actualWidth+origin;across[k]=x;let deformation=0,redistribution=0;
  for(const e of events){const lateral=bump((u-e.position)/e.span);deformation+=e.weight*lateral*e.strength*e.sign;redistribution+=e.weight*lateral*e.sign;}
  center[k]=develop===0?0:amplitude*deformation;weights[k]=Math.max(.25,1+.65*develop*redistribution);
  if(k>0)integral+=(weights[k-1]+weights[k])*.5*(across[k]-across[k-1]);
 }
 for(let k=0;k<columns;k++)thickness[k]=area*weights[k]/integral;
 let measuredArea=0;for(let k=1;k<columns;k++)measuredArea+=(thickness[k-1]+thickness[k])*.5*(across[k]-across[k-1]);
 return {across,center,thickness,area,measuredArea,emission,age};
}
/** Exact support of the represented piecewise-linear front/back section.
 * Both geometry and absorption read this same material slab, with phi=1. */
export function materialSheetSupport(section:MaterialSheetSection,across:number,thick:number):boolean{
 const x=section.across;if(across<x[0]||across>x[x.length-1])return false;
 let k=1;while(k<x.length-1&&across>x[k])k++;
 const f=(across-x[k-1])/(x[k]-x[k-1]),center=section.center[k-1]*(1-f)+section.center[k]*f;
 const thickness=section.thickness[k-1]*(1-f)+section.thickness[k]*f;
 return Math.abs(thick-center)<=thickness*.5;
}
/** Closed surface topology: fixed material-column ownership prevents event
 * changes from shifting vertex correspondence. Caps fill the strip, not a
 * concave-ring fan. Triangle winding is shared with the volume audit. */
export function materialSheetIndices(rows:number,columns:number):Uint32Array{
 const ring=columns*2,indices:number[]=[];
 const tri=(a:number,b:number,c:number)=>indices.push(a,b,c);
 for(let j=0;j<rows-1;j++)for(let k=0;k<ring;k++){
  const a=j*ring+k,b=(j+1)*ring+k,c=j*ring+(k+1)%ring,d=(j+1)*ring+(k+1)%ring;
  // The reversed lower face must retain the SAME material diagonal as the
  // upper face. Opposite diagonals interpolate different center surfaces and
  // can intersect even when every corner's liquid thickness is positive.
  if(k>=columns&&k<ring-1){tri(a,b,d);tri(a,d,c);}else{tri(a,b,c);tri(c,b,d);}
 }
 for(const end of [0,rows-1])for(let k=0;k<columns-1;k++){
  const base=end*ring,a=base+k,b=base+k+1,c=base+ring-1-k,d=base+ring-2-k;
  if(end===0){tri(a,b,c);tri(b,d,c);}else{tri(a,c,b);tri(b,c,d);}
 }
 return new Uint32Array(indices);
}
/** Independently integrate a capped mesh band's signed tetrahedral volume.
 * This exposes transverse/swept mapping errors hidden by exact section area.
 * Positive total volume alone does not rule out self-intersection. */
export function materialSheetBandVolume(positions:Float32Array,row:number,columns:number):number{
 const ring=2*columns,origin=row*ring*3;let indices=bandTopology.get(columns);if(!indices){indices=materialSheetIndices(2,columns);bandTopology.set(columns,indices);}
 let volume=0;for(let i=0;i<indices.length;i+=3){
  const a=(row*ring+indices[i])*3,b=(row*ring+indices[i+1])*3,c=(row*ring+indices[i+2])*3;
  const ax=positions[a]-positions[origin],ay=positions[a+1]-positions[origin+1],az=positions[a+2]-positions[origin+2];
  const bx=positions[b]-positions[origin],by=positions[b+1]-positions[origin+1],bz=positions[b+2]-positions[origin+2];
  const cx=positions[c]-positions[origin],cy=positions[c+1]-positions[origin+1],cz=positions[c+2]-positions[origin+2];
  volume+=(ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx))/6;
 }return volume;
}

/** Candidate-only kinematic crest transition. The original exponential
 * recovery can rise initially when depth>g/6. This endpoint blend keeps the
 * same crest, native flight and impact center, but is not pure gravity motion.
 * Fixed vertical material layers avoid the rotating-frame thickness Jacobian. */
export function materialSheetTrajectory(age:number,flight:number,depth:number,top:number,speed:number,speedAgeDerivative=0){
 const u=age/flight,delta=depth*.5*(1-Math.exp(-6*flight*flight));
 const y=top-depth*.5-4.905*age*age+delta*(3*u*u-2*u*u*u);
 const yDerivative=-9.81*age+delta*6*u*(1-u)/flight;
 const forward=age*speed,forwardDerivative=speed+age*speedAgeDerivative;
 return {forward,y,forwardDerivative,yDerivative,arcSpeed:Math.hypot(forwardDerivative,yDerivative),valid:Number.isFinite(forwardDerivative)&&forwardDerivative>1e-5&&yDerivative<=1e-8};
}
/** Audit each capped material cell as well as the complete band. Signed
 * inversions can cancel inside a positive band; this reports them separately.
 * A sum of cell volumes is not an independently proven union volume. */
export function materialSheetCellVolume(positions:Float32Array,row:number,column:number,columns:number):number{
 const ring=columns*2;let indices=bandTopology.get(2);if(!indices){indices=materialSheetIndices(2,2);bandTopology.set(2,indices);}
 const map=(index:number)=>{const local=index%4,col=local===0?column:local===1?column+1:local===2?ring-2-column:ring-1-column;return(row+Math.floor(index/4))*ring+col;};
 const origin=(row*ring+column)*3;let volume=0;
 for(let i=0;i<indices.length;i+=3){const a=map(indices[i])*3,b=map(indices[i+1])*3,c=map(indices[i+2])*3;
  const ax=positions[a]-positions[origin],ay=positions[a+1]-positions[origin+1],az=positions[a+2]-positions[origin+2];
  const bx=positions[b]-positions[origin],by=positions[b+1]-positions[origin+1],bz=positions[b+2]-positions[origin+2];
  const cx=positions[c]-positions[origin],cy=positions[c+1]-positions[origin+1],cz=positions[c+2]-positions[origin+2];
  volume+=(ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx))/6;
 }return volume;
}
/** The unnormalized material-depth covector is (-slopeForward,1,-slopeAcross).
 * Coordinate thickness divides by its ray derivative, not by rayY alone. */
export function materialSheetDepthRayDerivative(rayForward:number,rayAcross:number,rayY:number,slopeForward:number,slopeAcross:number):number{
 return rayY-slopeForward*rayForward-slopeAcross*rayAcross;
}
/** Local front/back plane exits include coordinate-thickness gradients.
 * This is exact for affine depth/thickness fields, not curved-sheet tracing. */
export function materialSheetLocalDepthExit(thickness:number,depth:number,depthRay:number,thicknessRay=0):number{
 const upperRate=depthRay-thicknessRay*.5,lowerRate=depthRay+thicknessRay*.5;
 const upper=upperRate>1e-8?(thickness*.5-depth)/upperRate:Infinity;
 const lower=lowerRate< -1e-8?(-thickness*.5-depth)/lowerRate:Infinity;
 return Math.max(0,Math.min(upper,lower));
}
