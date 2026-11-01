/**
 * Advances one straight wet/dry edge on the actual Film cells and faces.
 * Water occupies clipped strips, with a quadratic depth field inside the fan;
 * it is never spread over the dry part of a parent cell. Both neighboring cells
 * use the same integrated face transfer, including pressure and energy.
 *
 * This is the first integration gate, not the live waterfall replacement. It
 * describes a transversely uniform rarefaction on a horizontal rectangular
 * ledge, with matching wet reservoir and dry exterior states. It stops before
 * the fan reaches either end. Terrain acceleration, impact supply, a second
 * wave, transverse variation and source-off require the general boundary-band
 * evolution; they cannot be represented by restarting this event each tick.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/10/2026, 18:52:17
 * Dependents: systems/world3d/river/waterfallContactFilm.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {ContactVec3} from './waterfallContactFlow';
import {WaterfallWetFront, type WetFrontEvent, type WetFrontInventory} from './waterfallWetFront';

export interface FilmFrontGeometry {
  corners: ContactVec3[][];
  nx: number;
  nz: number;
  normalGravity: number;
  tangentialGravity: ContactVec3;
}
export interface FilmFrontPiece {
  kind: 'reservoir' | 'fan';
  corners: ContactVec3[];
  /** Depth at the upstream end, midpoint and downstream end. Together these
   * define the quadratic field, not three constant-depth slabs. */
  depth: [number, number, number];
  speed: [number, number, number];
  inventory: WetFrontInventory;
}
export interface FilmFrontCell {
  id: number;
  wetArea: number;
  pieces: FilmFrontPiece[];
  inventory: WetFrontInventory;
}
export interface FilmFrontTransfer extends WetFrontInventory {
  face: number;
  left: number;
  right: number;
}
export interface FilmFrontSnapshot {
  time: number;
  /** Momentum is the component along this physical unit vector. Energy also
   * includes the actual ledge elevation in the world's gravity potential. */
  direction: ContactVec3;
  front: ContactVec3[];
  cells: FilmFrontCell[];
  inventory: WetFrontInventory;
  /** One shared streamwise face record; across-span pressure cancels by the
   * declared uniform continuation, not by treating the side as a dry outlet. */
  transfers: FilmFrontTransfer[];
  maximumBalanceResidual: WetFrontInventory;
  boundary: 'uniform-transverse-continuation';
  qualification: 'STRAIGHT_FRONT_ONLY';
}
const keys = ['volume', 'momentum', 'energy'] as const;
const zero = (): WetFrontInventory => ({volume: 0, momentum: 0, energy: 0});
const sub = (a: ContactVec3, b: ContactVec3): ContactVec3 => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const dot = (a: ContactVec3, b: ContactVec3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const scale = (a: ContactVec3, n: number): ContactVec3 => a.map(v => v*n) as ContactVec3;
const weighted = (v: WetFrontInventory, width: number): WetFrontInventory => ({volume: v.volume*width, momentum: v.momentum*width, energy: v.energy*width});

export class WaterfallFilmFront {
  private readonly fan: WaterfallWetFront;
  private readonly a: ContactVec3;
  private readonly along: ContactVec3;
  private readonly across: ContactVec3;
  private readonly length: number;
  private readonly width: number;
  private readonly nx: number;
  private readonly nz: number;
  private current: FilmFrontSnapshot;
  constructor(geometry: FilmFrontGeometry, event: Omit<WetFrontEvent, 'normalGravity'>) {
    const {nx, nz, corners} = geometry;
    if (![nx,nz].every(n => Number.isSafeInteger(n) && n > 0) || nx*nz > 4096
      || corners.length !== nx*nz || corners.some(c => c.length !== 4 || c.some(p => p.length !== 3 || !p.every(Number.isFinite)))) throw Error('film-front-invalid-grid');
    if (!geometry.tangentialGravity.every(Number.isFinite) || Math.hypot(...geometry.tangentialGravity) > 1e-12) throw Error('film-front-requires-horizontal-plane');
    this.nx = nx; this.nz = nz;
    this.a = [...corners[0][0]];
    const u = sub(corners[0][1], this.a), v = sub(corners[0][3], this.a);
    const dx = Math.hypot(...u), dz = Math.hypot(...v);
    if (!(dx > 0 && dz > 0) || Math.abs(dot(u,v)) > 1e-12*dx*dz) throw Error('film-front-requires-rectangular-grid');
    this.along = scale(u,1/dx); this.across = scale(v,1/dz);
    this.length = dx*nx; this.width = dz*nz;
    if (Math.abs(this.along[1])+Math.abs(this.across[1]) > 1e-12) throw Error('film-front-requires-horizontal-plane');
    // Read the actual grid, including every corner, before using regular-grid
    // face indexing. Refined strike geometry must not silently fit this mode.
    corners.forEach((quad,c) => {
      const i=c%nx, j=Math.floor(c/nx);
      [[i,j],[i+1,j],[i+1,j+1],[i,j+1]].forEach(([x,z],k) => {
        if (Math.hypot(...sub(quad[k],this.point(x*dx,z*dz))) > 1e-10*Math.max(1,this.length,this.width)) throw Error('film-front-grid-shape-mismatch');
      });
    });
    this.fan = new WaterfallWetFront({...event, normalGravity: geometry.normalGravity});
    if (!(event.origin > 0 && event.origin < this.length)) throw Error('film-front-origin-outside-grid');
    this.current = this.evaluate(event.bornAt, [], zero());
  }
  private point(x: number,z: number): ContactVec3 {
    return this.a.map((v,k) => v+this.along[k]*x+this.across[k]*z) as ContactVec3;
  }
  private inventoryWithBed(value: WetFrontInventory, width: number): WetFrontInventory {
    const result=weighted(value,width);
    result.energy+=1000*9.81*this.a[1]*result.volume;
    return result;
  }
  private evaluate(time: number, transfers: FilmFrontTransfer[], residual: WetFrontInventory): FilmFrontSnapshot {
    const front=this.fan.front(time), head=this.fan.event.origin+this.fan.headSpeed*(time-this.fan.event.bornAt);
    // Reaching another boundary ends this isolated event's applicability. No
    // continuation with a guessed reflection or source response is permitted.
    if (head < 0 || front > this.length || front < 0 || head > this.length) throw Error('film-front-boundary-interaction');
    const dx=this.length/this.nx, dz=this.width/this.nz, cells: FilmFrontCell[]=[], total=zero();
    for (let j=0;j<this.nz;j++) for (let i=0;i<this.nx;i++) {
      const left=i*dx, right=(i+1)*dx, pieces: FilmFrontPiece[]=[], inventory=zero();
      let wetArea=0;
      for (const [kind,lo,hi] of [['reservoir',left,Math.min(right,head)],['fan',Math.max(left,head),Math.min(right,front)]] as const) {
        if (!(hi>lo)) continue;
        const state=[lo,(lo+hi)*.5,hi].map(x => this.fan.state(x,time));
        // At birth the reservoir's right endpoint is the discontinuity. Its
        // interior limiting depth is the initial wet state, not the dry trace.
        if (kind==='reservoir') state.forEach(s => {s.depth=this.fan.event.depth; s.velocity=this.fan.event.velocity;});
        const part=this.inventoryWithBed(this.fan.inventory(lo,hi,time),dz);
        pieces.push({kind,corners:[this.point(lo,j*dz),this.point(hi,j*dz),this.point(hi,(j+1)*dz),this.point(lo,(j+1)*dz)],depth:state.map(s=>s.depth) as [number,number,number],speed:state.map(s=>s.velocity) as [number,number,number],inventory:part});
        wetArea+=(hi-lo)*dz;
        for (const key of keys) inventory[key]+=part[key];
      }
      cells.push({id:j*this.nx+i,wetArea,pieces,inventory});
      for (const key of keys) total[key]+=inventory[key];
    }
    return {time,direction:[...this.along],front:[this.point(front,0),this.point(front,this.width)],cells,inventory:total,transfers,maximumBalanceResidual:residual,boundary:'uniform-transverse-continuation',qualification:'STRAIGHT_FRONT_ONLY'};
  }
  /** Compute each face once, then check every cell's endpoint field against the
   * conservative change. Endpoint quadrature is authoritative; floating-point
   * disagreement is disclosed, never repaired by deleting a shallow tail. */
  advanceTo(time: number): FilmFrontSnapshot {
    if (!Number.isFinite(time) || time<this.current.time) throw Error('film-front-invalid-time');
    const dx=this.length/this.nx,dz=this.width/this.nz,transfers:FilmFrontTransfer[]=[];
    for (let j=0;j<this.nz;j++) for (let i=0;i<=this.nx;i++) transfers.push({
      face:j*(this.nx+1)+i,left:i>0?j*this.nx+i-1:-1,right:i<this.nx?j*this.nx+i:-1,
      ...this.inventoryWithBed(this.fan.transfer(i*dx,this.current.time,time),dz),
    });
    const residual=zero(), next=this.evaluate(time,transfers,residual);
    for (let j=0;j<this.nz;j++) for (let i=0;i<this.nx;i++) {
      const c=j*this.nx+i, l=transfers[j*(this.nx+1)+i],r=transfers[j*(this.nx+1)+i+1];
      for (const key of keys) {
        const before=this.current.cells[c].inventory[key], after=next.cells[c].inventory[key];
        const error=Math.abs(after-before-l[key]+r[key]);
        residual[key]=Math.max(residual[key],error);
        if (error>1e-10*Math.max(1,Math.abs(before),Math.abs(after),Math.abs(l[key]),Math.abs(r[key]))) throw Error(`film-front-conservation-failure ${JSON.stringify({cell:c,key,time,before,after,left:l[key],right:r[key],error})}`);
      }
    }
    this.current=next;
    return this.snapshot();
  }
  snapshot(): FilmFrontSnapshot {return structuredClone(this.current);}
}
