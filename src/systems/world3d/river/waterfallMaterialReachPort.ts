/**
 * Reconstructs one original Film face release as a finite artificial inlet.
 * Film pressure contributes to exported momentum, so donor depth cannot also
 * be the inlet thickness. This preserves the recorded centroid, volume,
 * momentum and legacy mechanical energy without changing Film or its ledger.
 * It produces geometry only: sheet insertion, boundary reactions and actual
 * solid clearance remain separately owned operations. It never qualifies
 * native Film detachment or calls around requireQualifiedReachInterface.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 11/10/2026, 06:07:31
 * Dependents: None (Orphan)
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { ContactSurface, ContactVec3 } from './waterfallContactFlow';
import type { FilmOutflow, FilmReleaseOrigin } from './waterfallContactFilm';
import { waterfallContactGeometryIdentity } from './waterfallContactGeometry';

export interface MaterialPortTolerances {
  geometryAbsolute: number;
  unitAbsolute: number;
  momentAbsolute: number;
  momentRelative: number;
}
/** Arithmetic allowances, not adjustable physical thickness or clearance. */
export const MATERIAL_PORT_TOLERANCES: Readonly<MaterialPortTolerances> = {
  geometryAbsolute: 1e-9, unitAbsolute: 1e-10, momentAbsolute: 1e-10, momentRelative: 1e-10,
};
export type MaterialPortCutMotion =
  | { kind: 'stationary'; velocity: ContactVec3 }
  | { kind: 'measured-moving'; velocity: ContactVec3; evidence: string };
export interface MaterialPortAperture {
  centroidStart: ContactVec3;
  centroidEnd: ContactVec3;
  /** Lower start, lower end, upper end, upper start. */
  corners: [ContactVec3, ContactVec3, ContactVec3, ContactVec3];
  normal: ContactVec3;
  outwardConormal: ContactVec3;
  thickness: number;
  length: number;
}
export interface MaterialPortClearance {
  status: 'clear' | 'blocked';
  /** Must bound the entire finite aperture against actual solids, not a ray
   * through its centroid or a label declaring that water is detached. */
  coverage: 'whole-finite-aperture';
  minimumSeparation: number;
  uncertainty: number;
  evidence: string;
}
export interface MaterialPortInput {
  releaseId: string;
  externalBoundaryOwner: string;
  outflow: FilmOutflow;
  support: ContactSurface;
  outwardConormal: ContactVec3;
  cut: MaterialPortCutMotion;
  /** If absent, retain Film's legacy mechanical energy at its original
   * donor centroid. This contains no surface or wetting energy. */
  declaredMechanicalEnergy?: number;
  tolerances?: Readonly<MaterialPortTolerances>;
  checkClearance?: (aperture: Readonly<MaterialPortAperture>) => MaterialPortClearance;
}
export interface MaterialReachPort extends MaterialPortAperture {
  releaseId: string;
  externalBoundaryOwner: string;
  forcing: 'externally-forced-film-release';
  filmDetachment: 'unqualified';
  initialSheetAdapter: 'pending-actual-material-geometry';
  origin: FilmReleaseOrigin;
  edge: string;
  face: number;
  intervalStart: number;
  intervalEnd: number;
  time: number;
  cut: MaterialPortCutMotion;
  volume: number;
  mass: number;
  momentum: ContactVec3;
  velocity: ContactVec3;
  donorHeight: number;
  inwardSpeed: number;
  mechanicalEnergy: number;
  energySource: 'legacy-film-release' | 'explicit-declared-release';
  clearance: MaterialPortClearance | { status: 'unresolved' };
  checks: {
    sweptVolume: number;
    representedApertureArea: number;
    geometricSweptVolume: number;
    volumeResidual: number;
    momentumResidual: ContactVec3;
    centroidPotentialEnergy: number;
    realizedMechanicalEnergy: number;
    energyResidual: number;
    tolerances: MaterialPortTolerances;
  };
}
const add = (a: ContactVec3, b: ContactVec3): ContactVec3 => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const sub = (a: ContactVec3, b: ContactVec3): ContactVec3 => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const scale = (a: ContactVec3, s: number): ContactVec3 => [a[0]*s, a[1]*s, a[2]*s];
const dot = (a: ContactVec3, b: ContactVec3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a: ContactVec3, b: ContactVec3): ContactVec3 => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length = (a: ContactVec3) => Math.hypot(...a);
const finiteVector = (v: ContactVec3) => v.length === 3 && v.every(Number.isFinite);

/** No aggregation or guessed downstream trajectory enters this operation.
 * A positive energy surplus would need retained velocity variance; this
 * uniform inlet rejects it rather than inventing internal motion. */
export function reconstructFilmMaterialReachPort(input: MaterialPortInput): MaterialReachPort {
  const { outflow: o, support: s, outwardConormal: nu } = input;
  const t = { ...(input.tolerances ?? MATERIAL_PORT_TOLERANCES) };
  if (!Object.values(t).every(v => Number.isFinite(v) && v >= 0)) throw Error('Invalid port arithmetic tolerances');
  const allowance = (value: number) => t.momentAbsolute + t.momentRelative*Math.abs(value);
  const origin = o.origin;
  if (!input.releaseId.trim() || !input.externalBoundaryOwner.trim() || !origin ||
      !Number.isSafeInteger(o.face) || o.face < 0 || origin.face !== o.face ||
      !origin.edge || o.edge !== `${origin.surfaceId}:${origin.edge}` ||
      !(o.intervalEnd > o.intervalStart) || o.time !== o.intervalEnd || !(o.volume > 0) || !(o.height > 0) ||
      ![o.intervalStart,o.intervalEnd,o.time,o.volume,o.height,...origin.anchor].every(Number.isFinite) ||
      origin.anchor.length !== 2 || origin.anchor.some(a => a < 0 || a > 1) ||
      ![o.start,o.end,o.velocity,o.momentum,origin.normal,s.normal,nu,input.cut.velocity,...s.vertices].every(finiteVector)) {
    throw Error('Incomplete original face interval or nonfinite port input');
  }
  if (s.vertices.length !== 4 || origin.surfaceId !== s.id || origin.geometryIdentity !== waterfallContactGeometryIdentity(s) ||
      length(sub(origin.normal,s.normal)) > t.unitAbsolute ||
      Math.abs(length(s.normal)-1) > t.unitAbsolute || Math.abs(length(nu)-1) > t.unitAbsolute ||
      Math.abs(dot(s.normal,nu)) > t.unitAbsolute || !(s.normal[1] > 0)) throw Error('Inconsistent supplying support or port unit vectors');
  if (input.cut.kind === 'stationary' ? length(input.cut.velocity) !== 0 : !input.cut.evidence.trim()) throw Error('Cut motion needs actual measured evidence');
  const edge = sub(o.end,o.start), L = length(edge);
  if (!(L > 0) || !Number.isFinite(L) || Math.abs(dot(edge,s.normal))/L > t.unitAbsolute || Math.abs(dot(edge,nu))/L > t.unitAbsolute) throw Error('Port edge is not perpendicular to normal and conormal');

  // Film already added n*donorHeight/2 to both endpoints. Subtracting it here
  // only validates the supplying bed; the returned centroid is never offset
  // again or reset to the thinner inlet's bed-attached position.
  const [a,b,c,d] = s.vertices, u = sub(b,a), z = sub(d,a), uu=dot(u,u), zz=dot(z,z), uz=dot(u,z), determinant=uu*zz-uz*uz;
  if (!(determinant > 0) || !Number.isFinite(determinant) || length(sub(c,add(b,z))) > t.geometryAbsolute ||
      Math.abs(dot(u,s.normal)) > t.geometryAbsolute || Math.abs(dot(z,s.normal)) > t.geometryAbsolute) throw Error('Invalid physical supplying plane');
  const coordinate = (p: ContactVec3): [number,number] => {
    const q=sub(sub(p,scale(s.normal,o.height*.5)),a);
    if(Math.abs(dot(q,s.normal))>t.geometryAbsolute)throw Error('Release centroid is inconsistent with donor support');
    return [(dot(q,u)*zz-dot(q,z)*uz)/determinant,(dot(q,z)*uu-dot(q,u)*uz)/determinant];
  };
  const cs=coordinate(o.start), ce=coordinate(o.end);
  const parameterTolerance=t.geometryAbsolute/Math.max(Number.MIN_VALUE,Math.min(length(u),length(z)));
  if ([...cs,...ce].some(v=>v < -parameterTolerance || v > 1+parameterTolerance) ||
      cs.some((v,i)=>Math.abs((v+ce[i])*.5-origin.anchor[i])>parameterTolerance)) throw Error('Release endpoints disagree with supplying anchor');
  const boundary = { upstream:[0,0], downstream:[0,1], 'across-negative':[1,0], 'across-positive':[1,1] }[origin.edge];
  if (!boundary || [cs,ce].some(q=>Math.abs(q[boundary[0]]-boundary[1])>parameterTolerance)) throw Error('Release is not on its declared supplying edge');
  const outward = boundary[0]===0 ? sub(u,scale(z,uz/zz)) : sub(z,scale(u,uz/uu));
  const expectedNu=scale(outward,(boundary[1]===0?1:-1)/length(outward));
  if(length(sub(nu,expectedNu))>t.unitAbsolute)throw Error('Inlet conormal disagrees with supplying edge');

  const mass=1000*o.volume, dt=o.intervalEnd-o.intervalStart;
  const velocity: ContactVec3=[o.momentum[0]/mass,o.momentum[1]/mass,o.momentum[2]/mass];
  if(!Number.isFinite(mass)||!finiteVector(velocity)||length(sub(velocity,o.velocity))>allowance(length(velocity)) ||
      Math.abs(dot(velocity,s.normal))>allowance(length(velocity)))throw Error('Release momentum or supported velocity is inconsistent');
  const inwardSpeed=-dot(sub(velocity,input.cut.velocity),nu), thickness=o.volume/(L*dt*inwardSpeed);
  if(!(inwardSpeed>0)||!(thickness>0)||![inwardSpeed,thickness].every(Number.isFinite))throw Error('Nonpositive or nonfinite inward crossing');
  const bedY=a[1]+u[1]*origin.anchor[0]+z[1]*origin.anchor[1];
  // Separate potential products preserve Film's shallow-clearance accounting
  // at large world coordinates. The physical midpoint must still agree.
  const centroidPotentialEnergy=mass*9.81*bedY+mass*9.81*s.normal[1]*o.height*.5;
  const kinetic=mass*.5*dot(velocity,velocity), realizedMechanicalEnergy=kinetic+centroidPotentialEnergy;
  const mechanicalEnergy=input.declaredMechanicalEnergy??realizedMechanicalEnergy;
  const energyResidual=mechanicalEnergy-realizedMechanicalEnergy;
  if(![mechanicalEnergy,realizedMechanicalEnergy,energyResidual].every(Number.isFinite))throw Error('Nonfinite release energy');
  if(Math.abs(energyResidual)>allowance(mechanicalEnergy))throw Error(energyResidual<0?'Unrealizable release energy below uniform kinetic energy':'Release energy surplus requires retained variance');
  const half=scale(s.normal,thickness*.5);
  const aperture:MaterialPortAperture={centroidStart:[...o.start],centroidEnd:[...o.end],corners:[sub(o.start,half),sub(o.end,half),add(o.end,half),add(o.start,half)],normal:[...s.normal],outwardConormal:[...nu],thickness,length:L};
  if(!aperture.corners.every(finiteVector))throw Error('Nonfinite reconstructed aperture');
  // A rounded-away thickness is not a finite geometric aperture, even when
  // the mass formula remains positive in arithmetic.
  if(length(sub(aperture.corners[3],aperture.corners[0]))===0 || length(sub(aperture.corners[2],aperture.corners[1]))===0)throw Error('Finite aperture thickness is not representable');
  const sweptVolume=L*thickness*dt*inwardSpeed, volumeResidual=sweptVolume-o.volume;
  // This second volume uses returned corners, so lost coordinate precision
  // cannot pass solely because the flux/thickness formula is self-consistent.
  const representedApertureArea=length(cross(sub(aperture.corners[1],aperture.corners[0]),sub(aperture.corners[3],aperture.corners[0])));
  const geometricSweptVolume=representedApertureArea*dt*inwardSpeed;
  const momentumResidual=sub(scale(velocity,mass),o.momentum);
  if(![sweptVolume,representedApertureArea,geometricSweptVolume].every(Number.isFinite)||Math.abs(volumeResidual)>allowance(o.volume)||Math.abs(geometricSweptVolume-o.volume)>allowance(o.volume)||length(momentumResidual)>allowance(length(o.momentum)))throw Error('Port moments failed arithmetic reconstruction');
  const clearance=input.checkClearance?.(structuredClone(aperture))??{status:'unresolved' as const};
  if(clearance.status!=='unresolved' && (clearance.status!=='clear'||clearance.coverage!=='whole-finite-aperture'||!clearance.evidence.trim()||
      ![clearance.minimumSeparation,clearance.uncertainty].every(Number.isFinite)||clearance.uncertainty<0||clearance.minimumSeparation<=clearance.uncertainty))throw Error('Actual finite aperture clearance is blocked or insufficient');
  return {...aperture,releaseId:input.releaseId,externalBoundaryOwner:input.externalBoundaryOwner,forcing:'externally-forced-film-release',filmDetachment:'unqualified',initialSheetAdapter:'pending-actual-material-geometry',origin:structuredClone(origin),edge:o.edge,face:o.face,intervalStart:o.intervalStart,intervalEnd:o.intervalEnd,time:o.time,cut:structuredClone(input.cut),volume:o.volume,mass,momentum:[...o.momentum],velocity,donorHeight:o.height,inwardSpeed,mechanicalEnergy,energySource:input.declaredMechanicalEnergy===undefined?'legacy-film-release':'explicit-declared-release',clearance:structuredClone(clearance),checks:{sweptVolume,representedApertureArea,geometricSweptVolume,volumeResidual,momentumResidual,centroidPotentialEnergy,realizedMechanicalEnergy,energyResidual,tolerances:t}};
}
