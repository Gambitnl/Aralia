/**
 * A bounded, resolved-scale air/thin-liquid projection experiment.
 * Normal constraints exchange impulses with a MAC grid. The original point
 * control can remove unresolved liquid motion; opt-in material regions instead
 * enforce one area-integrated normal flux per caller-owned material region.
 * Caller-owned groups move with liquid and are never reassigned to world bins.
 * This weak P0 response control leaves unresolved pointwise slip and requires
 * separate physical-scale/pressure-response validation before live adoption.
 * Divergence and interface constraints are solved together, using the
 * exact transpose of interpolation. This is regularized immersed coupling,
 * not a sharp two-face pressure solver or a centimeter-scale breakup model.
 * Open pressure boundaries are homogeneous (p=0); boundary velocities remain
 * free. Semi-Lagrangian transport is a separate, dissipative approximation.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 06/10/2026, 04:45:30
 * Dependents: systems/world3d/river/waterfallThinDynamics.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export type AirVec3 = [number, number, number];
export interface AirProjectionOptions {
  origin: AirVec3; cells: AirVec3; cellSize: number;
  airDensity?: number; ambient?: AirVec3; maximumCells?: number;
  maximumPoints?: number; maximumStencilEntries?: number; maxIterations?: number; tolerance?: number;
  /** World-space tent support; hold this fixed in grid refinement studies. */
  couplingRadius?: number;
  /** Material regions are caller-owned; their pressure basis never bins by world position. */
  coupling?: 'point' | 'material-regions';
}
export interface AirLiquidPoint { id: number; position: AirVec3; normal: AirVec3; mass: number; velocity: AirVec3; area?: number; region?: string | number }
export interface AirStencilEntry { index: number; weight: number }
export interface AirMaterialRegionReceipt {
  region: string | number; pointCount: number; area: number;
  /** Conservative current physical diameter: diagonal of the region's world AABB. */
  diameterBound: number; weakResidual: number; meanSlip: number; maximumPointwiseSlip: number;
}
export interface AirProjectionReceipt {
  converged: boolean; failure: string | null; iterations: number; relativeResidual: number;
  maximumDivergence: number; maximumInterfaceError: number;
  exchangeAirImpulse: AirVec3; exchangeLiquidImpulse: AirVec3; pressureBoundaryReaction: AirVec3;
  energyBefore: number; energyAfter: number; projectionLoss: number; residualWork: number;
  energyIdentityError: number; milliseconds: number; cells: number; faces: number; constraints: number; stencilEntries: number;
  coupling: 'point' | 'material-regions'; groupCount: number; regions: AirMaterialRegionReceipt[];
  maximumWeakResidual: number; weakResidualUnits: 'm3/s' | 'm/s'; maximumWeakMeanSlip: number;
}
export interface AirProjectionResult { velocities: AirVec3[]; receipt: AirProjectionReceipt }
export interface AirAdvectionReceipt {
  energyBefore: number; energyAfter: number; momentumChange: AirVec3;
  reservoirReplacementMomentum: AirVec3; reservoirReplacementEnergy: number;
  exteriorCharacteristics: number; milliseconds: number;
}
const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => { let s=0; for(let i=0;i<a.length;i++) s+=a[i]*b[i]; return s; };

export class WaterfallAirProjection {
  readonly origin: AirVec3; readonly cells: AirVec3; readonly cellSize: number;
  readonly u: Float64Array; readonly v: Float64Array; readonly w: Float64Array;
  /** Cell pressure in Pa after the last successful projection. */
  readonly pressure: Float64Array;
  private readonly field: Float64Array; private readonly inverseMass: Float64Array;
  private readonly offsets: number[]; private readonly dims: AirVec3[];
  private readonly ambient: AirVec3; private readonly radius: number;
  private readonly maximumPoints: number; private readonly maximumStencilEntries: number; private readonly maxIterations: number; private readonly tolerance: number;
  private readonly coupling: 'point' | 'material-regions';
  constructor(options: AirProjectionOptions) {
    this.origin=[...options.origin]; this.cells=[...options.cells]; this.cellSize=options.cellSize;
    const n=this.cells.reduce((a,b)=>a*b,1), rho=options.airDensity??1.2;
    if(!this.origin.every(Number.isFinite)||!this.cells.every(x=>Number.isInteger(x)&&x>0)||!Number.isFinite(this.cellSize)||this.cellSize<=0||!Number.isFinite(rho)||rho<=0||n>(options.maximumCells??131072)) throw new Error('Invalid or over-capacity air grid');
    const [nx,ny,nz]=this.cells;
    this.dims=[[nx+1,ny,nz],[nx,ny+1,nz],[nx,ny,nz+1]];
    const sizes=this.dims.map(d=>d[0]*d[1]*d[2]); this.offsets=[0,sizes[0],sizes[0]+sizes[1]];
    this.field=new Float64Array(sizes.reduce((a,b)=>a+b,0));
    this.u=this.field.subarray(0,this.offsets[1]); this.v=this.field.subarray(this.offsets[1],this.offsets[2]); this.w=this.field.subarray(this.offsets[2]);
    this.inverseMass=new Float64Array(this.field.length); this.pressure=new Float64Array(n);
    this.ambient=[...(options.ambient??[0,0,0])]; this.radius=options.couplingRadius??this.cellSize;
    this.maximumPoints=options.maximumPoints??20000; this.maximumStencilEntries=options.maximumStencilEntries??1000000; this.maxIterations=options.maxIterations??256; this.tolerance=options.tolerance??1e-8;
    this.coupling=options.coupling??'point';
    if(this.coupling!=='point'&&this.coupling!=='material-regions') throw new Error('Invalid coupling basis');
    if(!this.ambient.every(Number.isFinite)||!Number.isFinite(this.radius)||this.radius<this.cellSize||!Number.isInteger(this.maximumPoints)||this.maximumPoints<0||!Number.isInteger(this.maximumStencilEntries)||this.maximumStencilEntries<0||!Number.isInteger(this.maxIterations)||this.maxIterations<1||!Number.isFinite(this.tolerance)||this.tolerance<=0||this.tolerance>=1||!Number.isFinite(1/(rho*this.cellSize**3))) throw new Error('Invalid air projection controls');
    for(let c=0;c<3;c++) this.forFaces(c,(index,i,j,k)=>{
      const coordinate=[i,j,k][c];
      // Boundary dual volumes are half cells; each component sums to domain mass.
      this.inverseMass[index]=1/(rho*this.cellSize**3*(coordinate===0||coordinate===this.cells[c]? .5:1));
      this.field[index]=this.ambient[c];
    });
  }
  private forFaces(c:number, visit:(index:number,i:number,j:number,k:number)=>void) {
    const [nx,ny,nz]=this.dims[c]; let index=this.offsets[c];
    for(let k=0;k<nz;k++) for(let j=0;j<ny;j++) for(let i=0;i<nx;i++) visit(index++,i,j,k);
  }
  private index(c:number,i:number,j:number,k:number) { const d=this.dims[c]; return this.offsets[c]+i+d[0]*(j+d[1]*k); }
  private inside(p:AirVec3) { return p.every((x,c)=>Number.isFinite(x)&&x>=this.origin[c]&&x<=this.origin[c]+this.cells[c]*this.cellSize); }
  private weights(position:AirVec3,c:number,radius:number):AirStencilEntry[] {
    const coordinates=position.map((x,a)=>(x-this.origin[a])/this.cellSize-(a===c?0:.5));
    const width=radius/this.cellSize, d=this.dims[c], entries:AirStencilEntry[]=[]; let sum=0;
    const lo=coordinates.map((x,a)=>Math.max(0,Math.ceil(x-width))), hi=coordinates.map((x,a)=>Math.min(d[a]-1,Math.floor(x+width)));
    for(let k=lo[2];k<=hi[2];k++) for(let j=lo[1];j<=hi[1];j++) for(let i=lo[0];i<=hi[0];i++) {
      const w=Math.max(0,1-Math.abs(i-coordinates[0])/width)*Math.max(0,1-Math.abs(j-coordinates[1])/width)*Math.max(0,1-Math.abs(k-coordinates[2])/width);
      if(w>0) { entries.push({index:this.index(c,i,j,k),weight:w}); sum+=w; }
    }
    if(sum===0) throw new Error('Empty air interpolation support');
    for(const entry of entries) entry.weight/=sum;
    return entries;
  }
  couplingStencil(position:AirVec3, normal:AirVec3):AirStencilEntry[] {
    if(!this.inside(position)) throw new Error('Liquid point outside air domain');
    const length=Math.hypot(...normal); if(!Number.isFinite(length)||length===0) throw new Error('Invalid liquid normal');
    return [0,1,2].flatMap(c=>this.weights(position,c,this.radius).map(e=>({index:e.index,weight:e.weight*normal[c]/length})));
  }
  private sampleField(position:AirVec3, field:Float64Array):AirVec3 {
    if(!this.inside(position)) return [...this.ambient];
    return [0,1,2].map(c=>this.weights(position,c,this.cellSize).reduce((s,e)=>s+field[e.index]*e.weight,0)) as AirVec3;
  }
  sample(position:AirVec3):AirVec3 { return this.sampleField(position,this.field); }
  /** Ambient reservoir is consulted only when a characteristic leaves the domain.
   * This transport step does not claim global momentum or energy conservation. */
  advect(dt:number):AirAdvectionReceipt {
    if(!Number.isFinite(dt)||dt<=0) throw new Error('Invalid advection timestep');
    const start=performance.now(), old=this.field.slice(), next=new Float64Array(old.length);
    const receipt:AirAdvectionReceipt={energyBefore:0,energyAfter:0,momentumChange:[0,0,0],reservoirReplacementMomentum:[0,0,0],reservoirReplacementEnergy:0,exteriorCharacteristics:0,milliseconds:0};
    for(let c=0;c<3;c++) this.forFaces(c,(index,i,j,k)=>{
      const p=[i,j,k].map((x,a)=>this.origin[a]+(x+(a===c?0:.5))*this.cellSize) as AirVec3;
      const velocity=this.sampleField(p,old), departure=p.map((x,a)=>x-dt*velocity[a]) as AirVec3;
      next[index]=this.sampleField(departure,old)[c];
      const mass=1/this.inverseMass[index], change=mass*(next[index]-old[index]), energyChange=.5*mass*(next[index]**2-old[index]**2);
      receipt.energyBefore+=.5*mass*old[index]**2; receipt.energyAfter+=.5*mass*next[index]**2;
      receipt.momentumChange[c]+=change;
      if(!this.inside(departure)) { receipt.exteriorCharacteristics++; receipt.reservoirReplacementMomentum[c]+=change; receipt.reservoirReplacementEnergy+=energyChange; }
    });
    this.field.set(next);
    receipt.milliseconds=performance.now()-start; return receipt;
  }
  diagnosticCells(stride=1) {
    const out:{center:AirVec3;velocity:AirVec3}[]=[];
    for(let k=0;k<this.cells[2];k+=Math.max(1,stride)) for(let j=0;j<this.cells[1];j+=Math.max(1,stride)) for(let i=0;i<this.cells[0];i+=Math.max(1,stride)) {
      const center=[i,j,k].map((x,a)=>this.origin[a]+(x+.5)*this.cellSize) as AirVec3; out.push({center,velocity:this.sample(center)});
    } return out;
  }
  /** D is integrated cell flux (m^3/s), so its multiplier is pressure impulse
   * (Pa s). D transpose is negative gradient, so physical pressure is -lambda/dt.
   * Outside pressure is zero; no gauge pin or fixed face is mixed in. */
  private divergence(field:Float64Array,out:Float64Array) {
    const [nx,ny,nz]=this.cells, area=this.cellSize**2; let cell=0;
    for(let k=0;k<nz;k++) for(let j=0;j<ny;j++) for(let i=0;i<nx;i++) out[cell++]=area*(field[this.index(0,i+1,j,k)]-field[this.index(0,i,j,k)]+field[this.index(1,i,j+1,k)]-field[this.index(1,i,j,k)]+field[this.index(2,i,j,k+1)]-field[this.index(2,i,j,k)]);
  }
  private divergenceTranspose(values:Float64Array,out:Float64Array) {
    const [nx,ny,nz]=this.cells, area=this.cellSize**2; let cell=0;
    for(let k=0;k<nz;k++) for(let j=0;j<ny;j++) for(let i=0;i<nx;i++) {
      const p=area*values[cell++];
      out[this.index(0,i+1,j,k)]+=p; out[this.index(0,i,j,k)]-=p;
      out[this.index(1,i,j+1,k)]+=p; out[this.index(1,i,j,k)]-=p;
      out[this.index(2,i,j,k+1)]+=p; out[this.index(2,i,j,k)]-=p;
    }
  }
  project(points:readonly AirLiquidPoint[],dt:number):AirProjectionResult {
    const start=performance.now(), nc=this.pressure.length;
    const original=points.map(p=>[...p.velocity] as AirVec3);
    const receipt:AirProjectionReceipt={converged:false,failure:null,iterations:0,relativeResidual:Infinity,maximumDivergence:0,maximumInterfaceError:0,exchangeAirImpulse:[0,0,0],exchangeLiquidImpulse:[0,0,0],pressureBoundaryReaction:[0,0,0],energyBefore:0,energyAfter:0,projectionLoss:0,residualWork:0,energyIdentityError:0,milliseconds:0,cells:nc,faces:this.field.length,constraints:nc,stencilEntries:0,coupling:this.coupling,groupCount:0,regions:[],maximumWeakResidual:0,weakResidualUnits:this.coupling==='material-regions'?'m3/s':'m/s',maximumWeakMeanSlip:0};
    const fail=(why:string)=>{ receipt.failure=why; receipt.milliseconds=performance.now()-start; return {velocities:original,receipt}; };
    if(!Number.isFinite(dt)||dt<=0||points.length>this.maximumPoints) return fail('Invalid timestep or point capacity');
    const ids=new Set<number>(), normals:AirVec3[]=[], stencils:AirStencilEntry[][]=[];
    for(const p of points) {
      if(ids.has(p.id)||!Number.isFinite(p.id)||!Number.isFinite(p.mass)||p.mass<=0||!Number.isFinite(1/p.mass)||p.velocity.length!==3||!p.velocity.every(Number.isFinite)) return fail('Invalid or duplicate shared liquid vertex');
      ids.add(p.id); const length=Math.hypot(...p.normal); normals.push(p.normal.map(x=>x/length) as AirVec3);
      try { stencils.push(this.couplingStencil(p.position,p.normal)); } catch(error) { return fail((error as Error).message); }
      receipt.stencilEntries+=stencils[stencils.length-1].length;
      if(receipt.stencilEntries>this.maximumStencilEntries) return fail('Interpolation stencil capacity exceeded');
    }
    if(!this.field.every(Number.isFinite)) return fail('Nonfinite predicted air velocity');
    // W has disjoint material support. Its liquid Gram block is positive diagonal
    // sum(area^2/mass), so weak rows remain independent without a rank heuristic.
    // Remaining pointwise slip is intentionally retained, not penalized away.
    const rowIds=new Map<string|number,number>(), rowOf=new Int32Array(points.length), weights=new Float64Array(points.length);
    const rows:{key:string|number;members:number[];stencil:AirStencilEntry[];liquidDiagonal:number;area:number}[]=[];
    for(let p=0;p<points.length;p++) {
      const input=points[p], weak=this.coupling==='material-regions';
      if(weak&&(!Number.isFinite(input.area)||input.area!<=0||input.region===undefined||(typeof input.region==='number'&&!Number.isFinite(input.region)))) return fail('Material region requires positive area and persistent region ID');
      const key=weak?input.region!:input.id;
      let row=rowIds.get(key); if(row===undefined) {row=rows.length;rowIds.set(key,row);rows.push({key,members:[],stencil:[],liquidDiagonal:0,area:0});}
      rowOf[p]=row; const weight=weak?input.area!:1; weights[p]=weight;
      rows[row].members.push(p); rows[row].liquidDiagonal+=weight**2/input.mass; rows[row].area+=weight;
    }
    for(const row of rows) {
      const combined=new Map<number,number>();
      for(const p of row.members) for(const e of stencils[p]) combined.set(e.index,(combined.get(e.index)??0)+weights[p]*e.weight);
      row.stencil=[...combined].map(([index,weight])=>({index,weight}));
      if(this.coupling==='material-regions') {
        const lo:AirVec3=[Infinity,Infinity,Infinity],hi:AirVec3=[-Infinity,-Infinity,-Infinity];
        for(const p of row.members) for(let c=0;c<3;c++) {lo[c]=Math.min(lo[c],points[p].position[c]);hi[c]=Math.max(hi[c],points[p].position[c]);}
        receipt.regions.push({region:row.key,pointCount:row.members.length,area:row.area,diameterBound:Math.hypot(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2]),weakResidual:0,meanSlip:0,maximumPointwiseSlip:0});
      }
    }
    const count=nc+rows.length; receipt.constraints=count; receipt.groupCount=this.coupling==='material-regions'?rows.length:0;
    const rhs=new Float64Array(count), diagonal=new Float64Array(count), lambda=new Float64Array(count);
    this.divergence(this.field,rhs);
    const [nx,ny,nz]=this.cells; let cell=0; const a4=this.cellSize**4;
    for(let k=0;k<nz;k++) for(let j=0;j<ny;j++) for(let i=0;i<nx;i++) diagonal[cell++]=a4*(this.inverseMass[this.index(0,i,j,k)]+this.inverseMass[this.index(0,i+1,j,k)]+this.inverseMass[this.index(1,i,j,k)]+this.inverseMass[this.index(1,i,j+1,k)]+this.inverseMass[this.index(2,i,j,k)]+this.inverseMass[this.index(2,i,j,k+1)]);
    for(let row=0;row<rows.length;row++) {
      diagonal[nc+row]=rows[row].liquidDiagonal;
      for(const p of rows[row].members) rhs[nc+row]+=weights[p]*dot(normals[p],points[p].velocity);
      for(const e of rows[row].stencil) {rhs[nc+row]-=e.weight*this.field[e.index];diagonal[nc+row]+=e.weight**2*this.inverseMass[e.index];}
    }
    const airScratch=new Float64Array(this.field.length);
    const apply=(x:Float64Array,out:Float64Array)=>{
      airScratch.fill(0); this.divergenceTranspose(x,airScratch);
      for(let row=0;row<rows.length;row++) for(const e of rows[row].stencil) airScratch[e.index]-=e.weight*x[nc+row];
      for(let i=0;i<airScratch.length;i++) airScratch[i]*=this.inverseMass[i];
      this.divergence(airScratch,out);
      for(let row=0;row<rows.length;row++) {let s=x[nc+row]*rows[row].liquidDiagonal;for(const e of rows[row].stencil) s-=e.weight*airScratch[e.index];out[nc+row]=s;}
    };
    const r=rhs.slice(), z=new Float64Array(count), direction=new Float64Array(count), product=new Float64Array(count);
    for(let i=0;i<count;i++) z[i]=r[i]/diagonal[i]; direction.set(z);
    let rz=dot(r,z), initial=rz;
    if(!Number.isFinite(initial)) return fail('Nonfinite constraint residual');
    for(let iteration=0;iteration<this.maxIterations&&rz>initial*this.tolerance**2;iteration++) {
      apply(direction,product); const denom=dot(direction,product);
      if(!Number.isFinite(denom)||denom<=0) return fail('Constraint Gram lost positive definiteness');
      const alpha=rz/denom;
      for(let i=0;i<count;i++) { lambda[i]+=alpha*direction[i]; r[i]-=alpha*product[i]; z[i]=r[i]/diagonal[i]; }
      const next=dot(r,z); if(!Number.isFinite(next)) return fail('Nonfinite constraint iteration');
      const beta=next/rz; for(let i=0;i<count;i++) direction[i]=z[i]+beta*direction[i]; rz=next; receipt.iterations=iteration+1;
    }
    // Recompute the true residual; recurrence alone can hide roundoff drift.
    apply(lambda,product); let trueResidual=0; for(let i=0;i<count;i++) { r[i]=rhs[i]-product[i]; trueResidual+=r[i]**2/diagonal[i]; }
    receipt.relativeResidual=initial>0?Math.sqrt(trueResidual/initial):Math.sqrt(trueResidual);
    if(!Number.isFinite(receipt.relativeResidual)) return fail('Nonfinite constraint residual');
    if(receipt.relativeResidual>Math.max(this.tolerance*4,1e-12)) return fail('Constraint iteration capacity exceeded');
    const pressureImpulse=new Float64Array(this.field.length), interfaceImpulse=new Float64Array(this.field.length);
    this.divergenceTranspose(lambda,pressureImpulse);
    for(let row=0;row<rows.length;row++) for(const e of rows[row].stencil) interfaceImpulse[e.index]+=e.weight*lambda[nc+row];
    const next=this.field.slice(), velocities=original.map(v=>[...v] as AirVec3);
    for(let c=0;c<3;c++) this.forFaces(c,index=>{
      receipt.energyBefore+=.5*this.field[index]**2/this.inverseMass[index];
      next[index]+=(interfaceImpulse[index]-pressureImpulse[index])*this.inverseMass[index];
      receipt.energyAfter+=.5*next[index]**2/this.inverseMass[index];
      receipt.exchangeAirImpulse[c]+=interfaceImpulse[index]; receipt.pressureBoundaryReaction[c]+=pressureImpulse[index];
    });
    for(let p=0;p<points.length;p++) for(let c=0;c<3;c++) {
      const impulse=-normals[p][c]*weights[p]*lambda[nc+rowOf[p]]; velocities[p][c]+=impulse/points[p].mass; receipt.exchangeLiquidImpulse[c]+=impulse;
      receipt.energyBefore+=.5*points[p].mass*original[p][c]**2; receipt.energyAfter+=.5*points[p].mass*velocities[p][c]**2;
    }
    receipt.projectionLoss=.5*dot(lambda,product); receipt.residualWork=dot(lambda,r);
    receipt.energyIdentityError=receipt.energyAfter-receipt.energyBefore+receipt.projectionLoss+receipt.residualWork;
    this.divergence(next,product); for(let i=0;i<nc;i++) receipt.maximumDivergence=Math.max(receipt.maximumDivergence,Math.abs(product[i])/this.cellSize**3);
    const weakErrors=new Float64Array(rows.length);
    for(let p=0;p<points.length;p++) {let error=dot(normals[p],velocities[p]);for(const e of stencils[p]) error-=e.weight*next[e.index];receipt.maximumInterfaceError=Math.max(receipt.maximumInterfaceError,Math.abs(error));weakErrors[rowOf[p]]+=weights[p]*error;if(this.coupling==='material-regions') receipt.regions[rowOf[p]].maximumPointwiseSlip=Math.max(receipt.regions[rowOf[p]].maximumPointwiseSlip,Math.abs(error));}
    for(let row=0;row<rows.length;row++) {
      receipt.maximumWeakResidual=Math.max(receipt.maximumWeakResidual,Math.abs(weakErrors[row]));receipt.maximumWeakMeanSlip=Math.max(receipt.maximumWeakMeanSlip,Math.abs(weakErrors[row])/rows[row].area);
      if(this.coupling==='material-regions') {receipt.regions[row].weakResidual=weakErrors[row];receipt.regions[row].meanSlip=weakErrors[row]/rows[row].area;}
    }
    if(!next.every(Number.isFinite)||!velocities.every(v=>v.every(Number.isFinite))||![receipt.energyBefore,receipt.energyAfter,receipt.projectionLoss,receipt.residualWork,receipt.energyIdentityError].every(Number.isFinite)||!lambda.subarray(0,nc).every(x=>Number.isFinite(x/dt))) return fail('Nonfinite projected state');
    this.field.set(next); for(let i=0;i<nc;i++) this.pressure[i]=-lambda[i]/dt;
    receipt.converged=true; receipt.milliseconds=performance.now()-start; return {velocities,receipt};
  }
}
