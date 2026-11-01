/**
 * Resolves one newly opened shallow-water edge against exactly dry ground.
 * The advancing edge and the water behind it come from the same rarefaction,
 * so an unvisited part of a cell stays dry without a depth cutoff or a mask.
 *
 * This is a building block for the attached-water boundary, not an impact or
 * complete film solver. Its constant, planar wet state is valid only until
 * another wave, source change, wall or front interacts with this event. The
 * caller must resolve that interaction rather than restart this fan each tick.
 * Native rendering and the live Film are not changed by this module yet.
 * Reference: https://www.clawpack.org/riemann_book/html/Shallow_water.html
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/10/2026, 18:52:17
 * Dependents: systems/world3d/river/waterfallContactFilm.ts, systems/world3d/river/waterfallFilmFront.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export interface WetFrontEvent {
  origin: number;
  bornAt: number;
  depth: number;
  velocity: number;
  normalGravity: number;
}
/** Per metre of transverse width: m2, kg/s, J/m. Momentum includes density. */
export interface WetFrontInventory { volume: number; momentum: number; energy: number }
export interface WetFrontState { depth: number; velocity: number }
const rho = 1000;
const zero = (): WetFrontInventory => ({volume: 0, momentum: 0, energy: 0});
const nodes = [-Math.sqrt(3 / 5), 0, Math.sqrt(3 / 5)];
const weights = [5 / 9, 8 / 9, 5 / 9];
const timeNodes = [-.906179845938664, -.538469310105683, 0, .538469310105683, .906179845938664];
const timeWeights = [.236926885056189, .478628670499366, .568888888888889, .478628670499366, .236926885056189];
const fields = ['volume', 'momentum', 'energy'] as const;
const multiply = (a: number[], b: number[]): number[] => {
  const result=Array(a.length+b.length-1).fill(0) as number[];
  a.forEach((x,i)=>b.forEach((y,j)=>{result[i+j]+=x*y;}));
  return result;
};
const sumPolynomial = (a:number[],b:number[]):number[] => Array.from({length:Math.max(a.length,b.length)},(_,i)=>(a[i]??0)+(b[i]??0));

export class WaterfallWetFront {
  readonly event: Readonly<WetFrontEvent>;
  readonly headSpeed: number;
  readonly frontSpeed: number;
  constructor(event: WetFrontEvent) {
    if (!Object.values(event).every(Number.isFinite) || !(event.depth > 0) || !(event.normalGravity > 0)) {
      throw Error('wet-front-invalid-event');
    }
    this.event = Object.freeze({...event});
    const c = Math.sqrt(event.normalGravity * event.depth);
    this.headSpeed = event.velocity - c;
    this.frontSpeed = event.velocity + 2 * c;
    if (![this.headSpeed, this.frontSpeed].every(Number.isFinite)) throw Error('wet-front-nonfinite-speed');
  }
  private age(time: number): number {
    if (!Number.isFinite(time) || time < this.event.bornAt) throw Error('wet-front-invalid-time');
    return time - this.event.bornAt;
  }
  front(time: number): number { return this.event.origin + this.frontSpeed * this.age(time); }
  state(x: number, time: number): WetFrontState {
    if (!Number.isFinite(x)) throw Error('wet-front-invalid-position');
    const age = this.age(time), dx = x - this.event.origin;
    if (age === 0) return dx < 0 ? {depth: this.event.depth, velocity: this.event.velocity} : {depth: 0, velocity: this.frontSpeed};
    const xi = dx / age;
    if (xi >= this.frontSpeed) return {depth: 0, velocity: this.frontSpeed};
    if (xi <= this.headSpeed) return {depth: this.event.depth, velocity: this.event.velocity};
    const c = (this.frontSpeed - xi) / 3;
    return {depth: c * c / this.event.normalGravity, velocity: (this.frontSpeed + 2 * xi) / 3};
  }
  private density(state: WetFrontState): WetFrontInventory {
    const {depth: h, velocity: u} = state;
    return {volume: h, momentum: rho * h * u,
      energy: .5 * rho * (h * u * u + this.event.normalGravity * h * h)};
  }
  /** Integrate the represented water, splitting at the exact fan boundaries.
   * Three-point Gauss integration is exact for the quartic energy polynomial;
   * this does not average the wet area back into a full background cell. */
  inventory(left: number, right: number, time: number): WetFrontInventory {
    const age = this.age(time);
    if (![left, right].every(Number.isFinite) || right < left) throw Error('wet-front-invalid-interval');
    const head = this.event.origin + this.headSpeed * age, front = this.front(time);
    const result = zero();
    const wetLength = Math.max(0, Math.min(right, head) - left);
    const wet = this.density({depth: this.event.depth, velocity: this.event.velocity});
    for (const key of ['volume', 'momentum', 'energy'] as const) result[key] = wet[key] * wetLength;
    const start = Math.max(left, head), end = Math.min(right, front);
    if (end > start) {
      const mid = (start + end) * .5, half = (end - start) * .5;
      for (let i = 0; i < nodes.length; i++) {
        const values = this.density(this.state(mid + half * nodes[i], time));
        for (const key of ['volume', 'momentum', 'energy'] as const) result[key] += values[key] * half * weights[i];
      }
    }
    if (!Object.values(result).every(Number.isFinite)) throw Error('wet-front-nonfinite-inventory');
    return result;
  }
  /** Signed local flux through a stationary face. Split at actual wave arrival
   * before integrating; never subtract two large reservoir inventories to find
   * the tiny first arrival. Neighbors consume ONE result with opposite signs.
   * Source-off and colliding waves still require a new interaction solution. */
  transfer(face: number, startTime: number, endTime: number): WetFrontInventory {
    const startAge = this.age(startTime), endAge = this.age(endTime);
    if (!Number.isFinite(face) || endTime < startTime) throw Error('wet-front-invalid-transfer');
    const result = zero(), dt = endTime - startTime;
    if (dt === 0) return result;
    const d=face-this.event.origin, s=this.frontSpeed, gn=this.event.normalGravity;
    const dry=(lo:number,hi:number)=>s>0?hi<=d/s:s<0?lo>=d/s:d>=0;
    const reservoir=(lo:number,hi:number)=>this.headSpeed>0?lo>=d/this.headSpeed:this.headSpeed<0?hi<=d/this.headSpeed:d<=0;
    if(dry(startAge,endAge))return result;
    const flux=(h:number,u:number):WetFrontInventory=>({volume:h*u,momentum:rho*h*(u*u+.5*gn*h),energy:rho*h*u*(.5*u*u+gn*h)});
    const wet=flux(this.event.depth,this.event.velocity);
    const cuts=[startAge,endAge,...[this.headSpeed,s].filter(v=>v!==0).map(v=>d/v).filter(t=>t>startAge&&t<endAge)].sort((a,b)=>a-b);
    // Fluxes are polynomials in r=d/t. Their tenth derivatives bound the
    // five-point Gauss remainder on a smooth fan interval (DLMF3.5(v)).
    // Coefficients are used only for this bound; values use factored h and u.
    const h=[s*s,-2*s,1].map(v=>v/(9*gn)),u=[s/3,2/3],u2=multiply(u,u),h2=multiply(h,h),hu=multiply(h,u);
    const coefficients={volume:hu,momentum:sumPolynomial(multiply(h,u2),h2.map(v=>.5*gn*v)).map(v=>rho*v),energy:multiply(hu,sumPolynomial(u2.map(v=>.5*v),h.map(v=>gn*v))).map(v=>rho*v)};
    let work=0;
    const integrate=(lo:number,hi:number):WetFrontInventory=>{
      if (++work>512 || !(lo>0)) throw Error('wet-front-quadrature-capacity');
      const half=(hi-lo)*.5,values=zero(),absolute=zero();
      for(let k=0;k<timeNodes.length;k++) {
        const offset=half*(1+timeNodes[k]),t=lo+offset;
        // Local elapsed coordinates retain the small time since front arrival.
        // This also works for retreat; s=0 has a stationary front at origin.
        const difference=s===0?-d/t:s*(((lo-d/s)+offset)/t);
        const state=flux(difference*difference/(9*gn),s-2*difference/3);
        for(const key of fields){const term=state[key]*half*timeWeights[k];values[key]+=term;absolute[key]+=Math.abs(term);}
      }
      let fits=true;
      for(const key of fields) {
        let derivative=0;
        coefficients[key].forEach((coefficient,k)=>{
          if(k===0)return;
          let rising=1;for(let n=0;n<10;n++)rising*=k+n;
          derivative+=Math.abs(coefficient)*Math.abs(d/lo)**k*rising;
        });
        const remainder=(120**4/(11*3628800**3))*(hi-lo)*((hi-lo)/lo)**10*derivative;
        // Arithmetic estimate is not a certified bound on all input rounding.
        // Keep the independent cell/world-energy check and ENERGY_UNKNOWN.
        const arithmetic=64*Number.EPSILON*absolute[key];
        if(!Number.isFinite(remainder+arithmetic) || remainder+arithmetic>2e-13*Math.max(absolute[key],1e-20))fits=false;
      }
      if(fits)return values;
      const mid=lo+(hi-lo)*.5;
      if(mid===lo||mid===hi)throw Error('wet-front-quadrature-resolution');
      const left=integrate(lo,mid),right=integrate(mid,hi);
      for(const key of fields)left[key]+=right[key];
      return left;
    };
    for(let i=1;i<cuts.length;i++) {
      const lo=cuts[i-1],hi=cuts[i];if(hi===lo)continue;
      // Classify the whole split interval by crossing times. A rounded midpoint
      // can equal the arrival itself when the interval is only one ULP wide.
      if(dry(lo,hi))continue;
      const isReservoir=reservoir(lo,hi);
      const part=isReservoir?{volume:wet.volume*(hi-lo),momentum:wet.momentum*(hi-lo),energy:wet.energy*(hi-lo)}
        :d===0?flux(s*s/(9*gn),s/3):integrate(lo,hi);
      for(const key of fields)result[key]+=part[key]*(d===0&&!isReservoir?hi-lo:1);
    }
    if (!Object.values(result).every(Number.isFinite)) throw Error('wet-front-nonfinite-transfer');
    return result;
  }
}
