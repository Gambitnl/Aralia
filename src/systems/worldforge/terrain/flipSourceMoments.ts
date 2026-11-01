/**
 * Transfers finite pieces of the ballistic waterfall into a local GPU receiver.
 * All positions and velocities describe the same physical step boundary. The
 * entrance plane selects material that will cross during the next step; it is
 * not an emitter that teleports a whole interval of water onto one plane.
 *
 * APIC receives the material's velocity-position moment divided by its grid
 * inertia. Copying a continuum velocity gradient instead was measured to create
 * energy. Source energy and the energy represented by APIC remain separate.
 * This adapter does not qualify receiver pressure, contact or optical volume.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 12/10/2026, 14:25:12
 * Dependents: None (Orphan)
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { FiniteWaterPacket } from './flipFiniteSource';

type Vec3 = [number, number, number];
type Mat3 = [number, number, number, number, number, number, number, number, number];
export interface BallisticInlet {
  flowM3s: number;
  widthM: number;
  bottomM: number;
  depthM: number;
  entranceY: number;
  sourceOn: number;
  sourceOff: number;
  depthCells: number;
  spanCells: number;
}
export interface SourceCarrierMoment {
  packet: FiniteWaterPacket;
  /** Column-major mass-normalized velocity-position and position covariance. */
  B: Mat3;
  R: Mat3;
  sourceKineticJ: number;
  apicKineticJ: number;
  potentialJ: number;
  momentumNs: Vec3;
  angularMomentum: Vec3;
  materialBounds: { min: Vec3; max: Vec3 };
}
const G = 9.81;
// Positive four-point Gauss integration, reused for depth and birth-time labels.
const Q = [
  [-.8611363115940526, .3478548451374538],
  [-.3399810435848563, .6521451548625461],
  [.3399810435848563, .6521451548625461],
  [.8611363115940526, .3478548451374538],
];
const zeroMatrix = (): Mat3 => [0, 0, 0, 0, 0, 0, 0, 0, 0];
const cross = (x: Vec3, v: Vec3): Vec3 => [x[1]*v[2]-x[2]*v[1], x[2]*v[0]-x[0]*v[2], x[0]*v[1]-x[1]*v[0]];

/** Finite staging slabs for [time,time+dt), evaluated at time, before native
 * advancement. The caller retains upstream ownership until actual admission is
 * acknowledged and rejects overlapping resident water or unsupported stencils.
 * Partition and dt are caller decisions; no silent refinement or rescaling.
 */
export function ballisticInletMoments(source: BallisticInlet, time: number, dt: number, dx: number, birthStep: number): SourceCarrierMoment[] {
  if (![source.flowM3s, source.widthM, source.bottomM, source.depthM, source.entranceY,
    source.sourceOn, source.sourceOff, time, dt, dx].every(Number.isFinite)
    || !(source.flowM3s > 0 && source.widthM > 0 && source.depthM > 0 && dt > 0 && dx > 0)
    || source.bottomM <= source.entranceY || source.sourceOff <= source.sourceOn
    || !Number.isInteger(birthStep) || birthStep < 0
    || !Number.isInteger(source.depthCells) || source.depthCells < 1
    || !Number.isInteger(source.spanCells) || source.spanCells < 1) throw Error('Invalid ballistic inlet');
  const u = source.flowM3s / (source.widthM * source.depthM);
  const carriers: SourceCarrierMoment[] = [];
  for (let d = 0; d < source.depthCells; d++) {
    const lo = source.bottomM + source.depthM*d/source.depthCells;
    const hi = source.bottomM + source.depthM*(d+1)/source.depthCells;
    // Split only at actual startup/shutoff intersections. Without these exact
    // label boundaries, quadrature could smear a pulse edge into future water.
    const cuts = [lo, hi];
    for (const birth of [source.sourceOn, source.sourceOff]) for (const t of [time, time+dt]) {
      if (t >= birth) {
        const y = source.entranceY + .5*G*(t-birth)**2;
        if (y > lo && y < hi) cuts.push(y);
      }
    }
    cuts.sort((a,b)=>a-b);
    for (let z = 0; z < source.spanCells; z++) {
      const zlo = -source.widthM/2 + source.widthM*z/source.spanCells;
      const zhi = -source.widthM/2 + source.widthM*(z+1)/source.spanCells;
      const samples: { mass: number; x: Vec3; v: Vec3 }[] = [];
      for (let c = 0; c+1 < cuts.length; c++) for (const [q, w] of Q) {
        const y0 = (cuts[c]+cuts[c+1])/2 + q*(cuts[c+1]-cuts[c])/2;
        const crossingAge = Math.sqrt(2*(y0-source.entranceY)/G);
        const amin = Math.max(0, time-source.sourceOff, crossingAge-dt);
        const amax = Math.min(time-source.sourceOn, crossingAge);
        if (amax <= amin) continue;
        for (const [qa, wa] of Q) for (const qz of [-1/Math.sqrt(3), 1/Math.sqrt(3)]) {
          const age = (amin+amax)/2 + qa*(amax-amin)/2;
          const span = (zlo+zhi)/2 + qz*(zhi-zlo)/2;
          const mass = 1000*u*w*(cuts[c+1]-cuts[c])/2 * wa*(amax-amin)/2 * (zhi-zlo)/2;
          samples.push({mass, x:[u*age,y0-.5*G*age**2,span], v:[u,-G*age,0]});
        }
      }
      if (!samples.length) continue;
      let mass = 0, sourceKineticJ = 0, potentialJ = 0;
      const center: Vec3=[0,0,0], velocity: Vec3=[0,0,0], momentumNs: Vec3=[0,0,0], angularMomentum: Vec3=[0,0,0];
      for (const s of samples) {
        mass += s.mass;
        sourceKineticJ += .5*s.mass*s.v.reduce((v,k)=>v+k*k,0);
        potentialJ += s.mass*G*s.x[1];
        const angular = cross(s.x,s.v);
        for (let a=0;a<3;a++) { center[a]+=s.mass*s.x[a]; velocity[a]+=s.mass*s.v[a]; momentumNs[a]+=s.mass*s.v[a]; angularMomentum[a]+=s.mass*angular[a]; }
      }
      for(let a=0;a<3;a++){center[a]/=mass;velocity[a]/=mass;}
      const B=zeroMatrix(), R=zeroMatrix();
      for (const s of samples) for(let col=0;col<3;col++) for(let row=0;row<3;row++) {
        B[col*3+row]+=s.mass/mass*(s.v[row]-velocity[row])*(s.x[col]-center[col]);
        R[col*3+row]+=s.mass/mass*(s.x[row]-center[row])*(s.x[col]-center[col]);
      }
      const inertia=dx*dx/4;
      const affinePerSecond=B.map(b=>b/inertia) as Mat3;
      const apicKineticJ=.5*mass*(velocity.reduce((v,k)=>v+k*k,0)+B.reduce((v,b)=>v+b*b/inertia,0));
      // Conservative label bounds, not extrema of quadrature samples. These
      // bound the whole finite parcel for staging clearance checks.
      const maxAge=Math.min(time-source.sourceOn,Math.sqrt(2*(hi-source.entranceY)/G));
      const minAge=Math.max(0,time-source.sourceOff,Math.sqrt(2*(lo-source.entranceY)/G)-dt);
      carriers.push({packet:{id:`ballistic-${birthStep}-${d}-${z}`,birthStep,volumeM3:mass/1000,positionM:center,velocityMps:velocity,affinePerSecond},
        B,R,sourceKineticJ,apicKineticJ,potentialJ,momentumNs,angularMomentum,
        materialBounds:{min:[u*minAge,source.entranceY,zlo],max:[u*maxAge,hi-.5*G*minAge**2,zhi]}});
    }
  }
  return carriers;
}
