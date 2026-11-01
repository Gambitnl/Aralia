/**
 * Redistributes each falling section's accounted liquid among connected,
 * moving ribbons. The waterfall view supplies its existing polygon and Q/v
 * fraction; this module changes where that liquid sits, never its trajectory.
 * Whole-section normalization replaces paired reflection constraints, which
 * previously forced a permanently opaque center column. This is prescribed
 * entrainment structure, not a resolved turbulent liquid simulation.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/10/2026, 05:13:29
 * Dependents: components/World3D/water/riverWaterfallView.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { DataUtils } from 'three';

export const WATERFALL_ATLAS = { x: 48, y: 24, ages: 65, maxAge: 4.5, interval: 0.125 } as const;
export type WaterfallDensityProfile = 'legacy' | 'packets' | 'folds' | 'formation';
// Formation is an explicit frozen direction probe. Its minimum three-meter
// descending event spans at least7.7 age cells at4.5s before emission phase
// modulation. Live update cost and rendered shape remain unaccepted.
export const WATERFALL_FORMATION_ATLAS = { ...WATERFALL_ATLAS, ages:513, interval:0.125 } as const;
export const WATERFALL_PACKET_ATLAS = { ...WATERFALL_ATLAS, ages: 129, interval: 0.0625 } as const;
export const WATERFALL_FOLD_ATLAS = { ...WATERFALL_ATLAS, ages: 257, interval: 0.03125 } as const;
export interface WaterfallAtlasSection {
  canonicalRing: [number, number][];
  width: number;
  thickness: number;
  fraction: number;
  coherence: number;
}
type SectionAt = (age: number) => WaterfallAtlasSection;
export interface WaterfallTransientAtlas {
  sectionAtTime: (age: number, simulationTime: number) => WaterfallAtlasSection;
  emissionAt?: (age: number, simulationTime: number) => number;
}
const { x: NX, y: NY } = WATERFALL_ATLAS;
const CELLS = NX * NY;
const smooth = (v: number) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };
function random(i: number): number {
  let n = Math.imul(i ^ 0x6d2b79f5, 0x45d9f3b); n = Math.imul(n ^ n >>> 16, 0x45d9f3b);
  return ((n ^ n >>> 16) >>> 0) / 4294967296;
}
function moving(seed: number, emission: number): number {
  const phase = emission * (1.7 + random(seed) * 1.4) + random(seed + 1) * 19;
  const i = Math.floor(phase), f = smooth(phase - i);
  return random(i + seed * 7919) * (1 - f) + random(i + 1 + seed * 7919) * f;
}
/** The same polygon intersection and radial taper used by the shader. */
export function waterfallAtlasOccupancy(section: WaterfallAtlasSection, x: number, y: number): number {
  const angle = Math.atan2(y, x), count = section.canonicalRing.length, sector = 2 * Math.PI / count;
  const index = ((Math.floor(angle / sector) % count) + count) % count;
  const p = section.canonicalRing[index], q = section.canonicalRing[(index + 1) % count];
  const px = p[0] * 2 / section.width, py = p[1] * 2 / section.thickness;
  const qx = q[0] * 2 / section.width, qy = q[1] * 2 / section.thickness;
  const bound = (px * qy - qx * py) / (Math.cos(angle) * (qy - py) - Math.sin(angle) * (qx - px));
  const edge = Math.min((1 - section.coherence) * 0.4, (1 - section.fraction) * 0.5);
  if (edge < 1e-10) return Number(Math.hypot(x, y) <= bound);
  return 1 - smooth((Math.hypot(x, y) - bound * (1 - edge)) / (bound * edge));
}
export function waterfallAtlasEdgeMean(section: WaterfallAtlasSection): number {
  const edge = Math.min((1 - section.coherence) * 0.4, (1 - section.fraction) * 0.5);
  return 1 - edge + 0.3 * edge * edge;
}
/** Empty emitted sections have no polygon to normalize or cache. Invalid wet
 * geometry is an error, rather than water that can be silently made dry. */
function emptyAtlasSection(section: WaterfallAtlasSection): boolean {
  const fields = [section.width, section.thickness, section.fraction, section.coherence];
  if (!fields.every(Number.isFinite) || section.coherence < 0 || section.coherence > 1 || section.canonicalRing.length < 3 || section.canonicalRing.some(p => !p.every(Number.isFinite))) throw Error('Invalid waterfall atlas section');
  if (section.fraction === 0) return true;
  if (!(section.width > 0 && section.thickness > 0 && section.fraction > 0 && section.fraction <= 1)) throw Error('Invalid wet waterfall atlas section');
  let twiceArea = 0;
  for (let i = 0; i < section.canonicalRing.length; i++) {
    const p = section.canonicalRing[i], q = section.canonicalRing[(i + 1) % section.canonicalRing.length];
    const px = p[0] * 2 / section.width, py = p[1] * 2 / section.thickness;
    const qx = q[0] * 2 / section.width, qy = q[1] * 2 / section.thickness;
    if (![px, py, qx, qy].every(Number.isFinite)) throw Error('Invalid waterfall atlas normalized geometry');
    twiceArea += px * qy - qx * py;
  }
  if (!Number.isFinite(twiceArea) || twiceArea === 0) throw Error('Degenerate wet waterfall atlas section');
  return false;
}

/** Only finite positive normalization measure may enter the shared cache. */
function validateAtlasWeights(weights: Float32Array, offset = 0): void {
  let sum = 0;
  for (let i = offset; i < offset + CELLS; i++) {
    const weight = weights[i];
    if (!Number.isFinite(weight) || weight < 0) throw Error('Invalid waterfall atlas weights');
    sum += weight;
  }
  if (!(sum > 0) || !Number.isFinite(sum)) throw Error('Empty wet waterfall atlas weights');
}

function basis(v: number, n: number): [number, number, number] {
  const p = (v * 0.5 + 0.5) * n - 0.5, low = Math.floor(p);
  return [Math.max(0, Math.min(n - 1, low)), Math.max(0, Math.min(n - 1, low + 1)), p - low];
}
function halfBelow(v: number, cap: number): number {
  let bits = DataUtils.toHalfFloat(v);
  if (DataUtils.fromHalfFloat(bits) > cap) bits -= 1;
  return bits;
}


// Only normalization weights use a bounded canonical-shape approximation.
// Discharge, section geometry and trajectory are never rounded. Independent
// integration tests measure the error against the actual unrounded section.
const transientWeightsCache = new Map<string, Float32Array>();
const transientQuadratureCache = new Map<number, Float64Array>();
function transientQuadrature(subdivisions: number, ringCount: number): Float64Array {
  const cached=transientQuadratureCache.get(subdivisions); if(cached) return cached;
  const samples=new Float64Array(NX*NY*subdivisions*subdivisions*10);
  let n=0;
  for(let j=0;j<NY*subdivisions;j++) for(let i=0;i<NX*subdivisions;i++) {
    const x=(i+.5)*2/(NX*subdivisions)-1,y=(j+.5)*2/(NY*subdivisions)-1;
    const angle=Math.atan2(y,x),[x0,x1,tx]=basis(x,NX),[y0,y1,ty]=basis(y,NY);
    samples.set([((Math.floor(angle/(2*Math.PI/ringCount))%ringCount)+ringCount)%ringCount,
      Math.cos(angle),Math.sin(angle),Math.hypot(x,y),y0*NX+x0,y0*NX+x1,y1*NX+x0,y1*NX+x1,tx,ty],n);n+=10;
  }
  transientQuadratureCache.set(subdivisions,samples);return samples;
}

// Slice budgets use the reconstructed bilinear field, including quantization.
// Interpolating age also interpolates between slightly different polygon
// weights; independent integration tests bound that continuum approximation.
export class WaterfallDensityAtlas {
  readonly first: Uint16Array;
  readonly second: Uint16Array;
  private readonly pendingFirst: Uint16Array;
  private readonly pendingSecond: Uint16Array;
  private readonly weights: Float32Array;
  private readonly caps: Float32Array;
  readonly config: { x: number; y: number; ages: number; maxAge: number; interval: number };
  supportExpansions = 0;
  fullSectionFallbacks = 0;
  maximumFallbackAge = 0;
  private readonly sections: WaterfallAtlasSection[];
  private readonly raw = new Float32Array(CELLS);
  private readonly values = new Float32Array(CELLS);
  private readonly ribbonX = new Float32Array(6 * NX);
  private readonly ribbonY = new Float32Array(6 * NY);
  private readonly coreX = Float32Array.from({ length: NX }, (_, i) => Math.exp(-(((i + 0.5) * 2 / NX - 1) ** 2) * 12));
  private readonly coreY = Float32Array.from({ length: NY }, (_, j) => Math.exp(-(((j + 0.5) * 2 / NY - 1) ** 2) * 4));
  private tick = Number.NaN;
  private sampleTime = 0;
  private physicalSection: { age: number; section: WaterfallAtlasSection } | null = null;
  frozenTime:number|null=null;
  blend = 0;
  version = 0;
  lastUpdateMs = 0;
  readonly initializationMs: number;
  readonly textureBytes: number;

  constructor(private readonly sectionAt: SectionAt, readonly profile: WaterfallDensityProfile = 'legacy', private readonly transient?: WaterfallTransientAtlas) {
    const started = performance.now();
    if(profile==='formation'&&transient)throw new Error('Formation atlas is frozen-only; flood remains legacy');
    this.config = profile==='formation'?WATERFALL_FORMATION_ATLAS:profile === 'folds' ? WATERFALL_FOLD_ATLAS : profile === 'packets' ? WATERFALL_PACKET_ATLAS : WATERFALL_ATLAS;
    const NZ = this.config.ages;
    this.first = new Uint16Array(CELLS * NZ); this.second = new Uint16Array(CELLS * NZ);
    this.pendingFirst = new Uint16Array(CELLS * NZ); this.pendingSecond = new Uint16Array(CELLS * NZ);
    this.weights = new Float32Array(CELLS * NZ); this.caps = new Float32Array(NZ);
    this.textureBytes = this.first.byteLength + this.second.byteLength;
    this.sections = Array.from({ length: NZ }, (_, k) => {
      const section = sectionAt(k * WATERFALL_ATLAS.maxAge / (NZ - 1)); emptyAtlasSection(section); return section;
    });
    // Integrate each bilinear texel's basis over the ACTUAL polygon/taper.
    // This one-time table makes every later redistribution a small weighted
    // sum, rather than a million density evaluations on every animation frame.
    for (let z = 0; z < NZ; z++) {
      const section = this.sections[z];
      if (!emptyAtlasSection(section)) {
        let polygonArea = 0;
        section.canonicalRing.forEach((p, k) => {
          const q = section.canonicalRing[(k + 1) % section.canonicalRing.length];
          polygonArea += (p[0] * q[1] - p[1] * q[0]) * 2 / (section.width * section.thickness);
        });
        const area = Math.abs(polygonArea);
        const offset = z * CELLS;
        const edge = Math.min((1 - section.coherence) * 0.4, (1 - section.fraction) * 0.5);
        // The initial taper is much narrower than a texel. Resolve it during
        // initialization rather than accepting a biased normalization there.
        const subdivisions = edge > 0 && edge < 0.006 ? 16 : edge < 0.03 && edge > 0 ? 8 : 4;
        if (!transient) for (let j = 0; j < NY * subdivisions; j++) for (let i = 0; i < NX * subdivisions; i++) {
          const x = (i + 0.5) * 2 / (NX * subdivisions) - 1, y = (j + 0.5) * 2 / (NY * subdivisions) - 1;
          const weight = waterfallAtlasOccupancy(section, x, y) * 4 / (NX * NY * subdivisions * subdivisions * area);
          const [x0, x1, tx] = basis(x, NX), [y0, y1, ty] = basis(y, NY);
          this.weights[offset + y0 * NX + x0] += weight * (1 - tx) * (1 - ty);
          this.weights[offset + y0 * NX + x1] += weight * tx * (1 - ty);
          this.weights[offset + y1 * NX + x0] += weight * (1 - tx) * ty;
          this.weights[offset + y1 * NX + x1] += weight * tx * ty;
        }
        if (!transient) validateAtlasWeights(this.weights, z * CELLS);
      }
      // Adjacent age rows share the stricter cap, so their trilinear blend
      // cannot exceed pure liquid between them. Quantization rounds below it.
      let cap = Infinity;
      for (let k = Math.max(0, z - 1); k <= Math.min(NZ - 1, z + 1); k++) {
        const near = this.sections[k]; cap = Math.min(cap, waterfallAtlasEdgeMean(near) / Math.max(near.fraction, 1e-12));
      }
      this.caps[z] = Math.max(1, cap);
    }
    this.initializationMs = performance.now() - started;
  }

  /** Physical diagnostics commonly inspect many points in the same section.
   * Reuse its prescribed dimensions rather than rebuilding its ring per point. */
  section(age: number): WaterfallAtlasSection {
    if (this.physicalSection?.age !== age) this.physicalSection = { age, section: this.transient ? this.transient.sectionAtTime(age,this.sampleTime) : this.sectionAt(age) };
    return this.physicalSection.section;
  }


  private retarget(time: number): void {
    if (!this.transient) return;
    this.physicalSection = null;
    const NZ = this.config.ages;
    const upcoming = [time-this.config.interval,time,time+this.config.interval].map(t=>Array.from({length:NZ},(_,z)=>this.transient!.sectionAtTime(z*this.config.maxAge/(NZ-1),t)));
    for (const rows of upcoming) for (const section of rows) emptyAtlasSection(section);
    for(let z=0;z<NZ;z++) {
      let cap=Infinity;
      for(const rows of upcoming) for(let k=Math.max(0,z-1);k<=Math.min(NZ-1,z+1);k++) cap=Math.min(cap,waterfallAtlasEdgeMean(rows[k])/Math.max(rows[k].fraction,1e-12));
      this.caps[z]=Math.max(1,Math.min(this.caps[z],cap));
    }
    for (let z = 0; z < NZ; z++) {
      const section = this.transient.sectionAtTime(z * this.config.maxAge / (NZ - 1), time);
      this.sections[z] = section;
      const offset = z * CELLS;
      // A closed source keeps older wet sections, but its empty rows have no
      // normalized footprint. Never let their 0/0 geometry share a wet key.
      if (emptyAtlasSection(section)) { this.weights.fill(0, offset, offset + CELLS); continue; }
      const edge = Math.min((1 - section.coherence) * .4, (1 - section.fraction) * .5);
      const key = Math.round(section.coherence * 1000) + '/' + Math.round(edge * 1000);
      const cached = transientWeightsCache.get(key);
      if (cached) { validateAtlasWeights(cached); this.weights.set(cached,offset); continue; }
      const ring = section.canonicalRing.map(p => [p[0] * 2 / section.width, p[1] * 2 / section.thickness]);
      let area = 0;
      for (let k = 0; k < ring.length; k++) { const p = ring[k], q = ring[(k + 1) % ring.length]; area += (p[0] * q[1] - p[1] * q[0]) * .5; }
      area = Math.abs(area);
      const subdivisions = edge > 0 && edge < .006 ? 8 : 2;
      const samples = transientQuadrature(subdivisions, ring.length);
      this.weights.fill(0, offset, offset + CELLS);
      const scale = 40 / (samples.length * area);
      for (let n=0;n<samples.length;n+=10) {
        const k=samples[n],p=ring[k],q=ring[(k+1)%ring.length];
        const bound=(p[0]*q[1]-q[0]*p[1])/(samples[n+1]*(q[1]-p[1])-samples[n+2]*(q[0]-p[0]));
        const occupied=edge<1e-10 ? Number(samples[n+3]<=bound) : 1-smooth((samples[n+3]-bound*(1-edge))/(bound*edge));
        if(occupied===0) continue;
        const weight=occupied*scale,tx=samples[n+8],ty=samples[n+9];
        this.weights[offset+samples[n+4]]+=weight*(1-tx)*(1-ty);
        this.weights[offset+samples[n+5]]+=weight*tx*(1-ty);
        this.weights[offset+samples[n+6]]+=weight*(1-tx)*ty;
        this.weights[offset+samples[n+7]]+=weight*tx*ty;
      }
      validateAtlasWeights(this.weights, offset);
      transientWeightsCache.set(key,this.weights.slice(offset,offset+CELLS));
      if(transientWeightsCache.size>256) transientWeightsCache.delete(transientWeightsCache.keys().next().value!);
    }
  }

  private fill(data: Uint16Array, time: number): void {
    this.retarget(time);
    const NZ = this.config.ages;
    for (let z = 0; z < NZ; z++) {
      const section = this.sections[z], offset = z * CELLS;
      // Empty emission owns exactly zero density. Wet ribbons keep their
      // existing cap and mass normalizer; no positive water is thresholded.
      if (emptyAtlasSection(section)) { data.fill(0, offset, offset + CELLS); continue; }
      const age = z * WATERFALL_ATLAS.maxAge / (NZ - 1);
      const emission = this.transient?.emissionAt?.(age,time) ?? time - age, target = waterfallAtlasEdgeMean(section), cap = this.caps[z];
      if (this.profile === 'packets') this.packetSupports(emission, age, offset, target, cap);
      if (this.profile === 'folds') this.foldSupports(emission, age, offset, target, cap);
      if (this.profile === 'formation') this.foldSupports(emission, age, offset, target, cap, true);
      const ribbons = Array.from({ length: 6 }, (_, k) => ({
        x: (k / 5 * 1.6 - 0.8) + (moving(21 + k * 13, emission) - 0.5) * 0.55,
        y: (moving(43 + k * 17, emission) - 0.5) * 1.35,
        wx: 0.05 + moving(79 + k * 19, emission) * 0.10,
        wy: 0.12 + moving(101 + k * 23, emission) * 0.48,
        weight: 0.12 + moving(137 + k * 29, emission) ** 2 * 1.8,
      }));
      // These supports separate across and depth. Cache their one-dimensional
      // profiles rather than evaluating six exponentials in every voxel.
      // The existing area-preserving geometry shear supplies oblique folds.
      if (this.profile === 'legacy') ribbons.forEach((r, k) => {
        for (let i = 0; i < NX; i++) {
          const dx = ((i + 0.5) * 2 / NX - 1 - r.x) / r.wx;
          this.ribbonX[k * NX + i] = Math.abs(dx) > 2 ? 0 : Math.exp(-(dx ** 4));
        }
        for (let j = 0; j < NY; j++) {
          const dy = ((j + 0.5) * 2 / NY - 1 - r.y) / r.wy;
          this.ribbonY[k * NY + j] = Math.abs(dy) > 2 ? 0 : Math.exp(-(dy ** 4));
        }
      });
      let sum = 0;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        // The legacy profile retains its weak connecting core exactly.
        // Both optional profiles have compact downstream support.
        let value = this.raw[j * NX + i];
        if (this.profile === 'legacy') {
          value = 0.001 + 0.004 * this.coreX[i] * this.coreY[j];
          for (let k = 0; k < ribbons.length; k++) value += ribbons[k].weight * this.ribbonX[k * NX + i] * this.ribbonY[k * NY + j];
        }
        const index = j * NX + i; this.raw[index] = value;
        sum += value * this.weights[offset + index];
      }
      if (!(sum > 0) || !Number.isFinite(sum)) throw Error('Invalid waterfall atlas density normalization');
      // Water filling saturates dense cells and redistributes their surplus
      // among the remaining cells. A global amplitude ceiling would waste
      // available air and recreate the old restriction on column structure.
      let remaining = target, freeSum = sum;
      this.values.fill(-1);
      for (let iteration = 0; iteration <= CELLS; iteration++) {
        const scale = remaining / Math.max(freeSum, 1e-20); let saturated = false;
        for (let i = 0; i < CELLS; i++) if (this.values[i] < 0 && this.raw[i] * scale > cap) {
          this.values[i] = cap; remaining -= cap * this.weights[offset + i]; freeSum -= this.raw[i] * this.weights[offset + i]; saturated = true;
        }
        if (!saturated) { for (let i = 0; i < CELLS; i++) if (this.values[i] < 0) this.values[i] = this.raw[i] * scale; break; }
      }
      const developed = this.profile !== 'legacy' ? smooth((1 - section.coherence) / 0.98) : 1 - section.coherence;
      for (let i = 0; i < CELLS; i++) {
        const value = 1 + developed * (this.values[i] - 1);
        const encoded = halfBelow(Math.max(0, value), cap);
        if (!Number.isFinite(value) || (encoded & 0x7c00) === 0x7c00) throw Error('Invalid waterfall atlas half density');
        data[offset + i] = encoded;
      }
    }
  }

  /** One open material strip replaces the rejected hollow ellipse tubes.
   * Local C1 displacement events have finite emission lifetimes and varying
   * material centers; they do not preserve three permanent lobe anchors.
   * Filled strip triangles carry du*dv liquid measure, including interiors.
   * Compression and overlap concentrate that measure; stretching spreads it.
   * This is prescribed aerated support, not a solved deformation gradient.
   * Polygon/taper normalization and the liquid cap retain the existing Q/v.
   */
  private foldSupports(emission: number, age: number, offset: number, target: number, cap: number, formation=false): void {
    const newest = Math.floor(emission / .075);
    const events: { center: number; radius: number; x: number; y: number; width: number }[] = [];
    if(!formation)for (let id = newest - 5; id <= newest; id++) {
      const seed = id * 157 + 2191, duration = .16 + random(seed) * .14;
      const phase = (emission - id * .075) / duration;
      if (phase <= 0 || phase >= 1) continue;
      const pulse = Math.sin(Math.PI * phase) ** 2;
      events.push({ center: .08 + random(seed + 1) * .84, radius: .14 + random(seed + 2) * .19,
        x: (random(seed + 3) - .5) * .95 * pulse,
        y: (random(seed + 4) - .5) * 1.25 * pulse,
        width: (.025 + random(seed + 5) * .07) * pulse });
    }
    // This candidate forms NEW localized sheet structure during descent.
    // Emission labels move the event lattice/parameters; there are no six
    // permanent tracks or hollow loops. Filled material triangles connect
    // the locally thickened lobes through veils of the same sheet. Material
    // measure is du*dv: thickening alone dilutes it; compression/overlap can
    // concentrate it. The global cap normalizer can redistribute elsewhere.
    // DEBT: These finite C1 events prescribe structure, not solved turbulence.
    if(formation){
      const descent=.5*9.81*age*age,shift=6*moving(2903,emission*.2);
      const coordinate=descent+shift,head=Math.floor(coordinate/1.5);
      const develop=1-Math.exp(-age*age);
      for(let id=head-3;id<=head;id++){
        const seed=id*163+3011,length=3+random(seed)*.6,phase=(coordinate-id*1.5)/length;
        if(phase<=0||phase>=1)continue;
        const pulse=16*phase*phase*(1-phase)*(1-phase)*develop;
        events.push({center:.06+moving(seed+1,emission*.2)*.88,radius:.13+random(seed+2)*.20,
          x:(moving(seed+3,emission*.2)-.5)*.55*pulse,
          y:(moving(seed+4,emission*.2)-.5)*1.3*pulse,
          width:(.055+random(seed+5)*.17)*pulse});
      }
    }
    const point = (u: number): [number, number, number] => {
      let x = (2 * u - 1) * (formation?.85:.78), y = formation?(moving(3109,emission*.2)-.5)*.12:0, width = formation?.065:.08;
      for (const e of events) {
        const v = (u - e.center) / e.radius;
        if (Math.abs(v) >= 1) continue;
        const weight = (1 - v * v) ** 2;
        x += e.x * weight; y += e.y * weight; width += e.width * weight;
      }
      return [x, y, width];
    };
    const count = 64;
    const center = Array.from({ length: count + 1 }, (_, k) => point(k / count));
    const section = this.sections[offset / CELLS];
    const normals = center.map((_, k) => {
      const a = center[Math.max(0, k - 1)], b = center[Math.min(count, k + 1)];
      const dx = (b[0] - a[0]) * section.width, dy = (b[1] - a[1]) * section.thickness;
      const length = Math.max(Math.hypot(dx, dy), 1e-12);
      return [-dy / length * section.thickness / section.width, dx / length];
    });
    const raster = (a: number[], b: number[], c: number[], measure: number) => {
      const cross = (x: number, y: number, xx: number, yy: number) => x * yy - y * xx;
      const ax = b[0] - a[0], ay = b[1] - a[1], bx = c[0] - a[0], by = c[1] - a[1];
      const determinant = cross(ax, ay, bx, by);
      if (Math.abs(determinant) < 1e-12) return;
      const density = measure * 2 / Math.abs(determinant);
      const loX = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) + 1) * NX / 2 - 1));
      const hiX = Math.min(NX - 1, Math.ceil((Math.max(a[0], b[0], c[0]) + 1) * NX / 2));
      const loY = Math.max(0, Math.floor((Math.min(a[1], b[1], c[1]) + 1) * NY / 2 - 1));
      const hiY = Math.min(NY - 1, Math.ceil((Math.max(a[1], b[1], c[1]) + 1) * NY / 2));
      for (let j = loY; j <= hiY; j++) for (let i = loX; i <= hiX; i++) {
        let inside = 0;
        // Cell averages reduce missed narrow triangles before the resident
        // half-float field is reconstructed with ordinary texture filtering.
        for (const sy of [.25, .75]) for (const sx of [.25, .75]) {
          const x = (i + sx) * 2 / NX - 1 - a[0], y = (j + sy) * 2 / NY - 1 - a[1];
          const u = cross(x, y, bx, by) / determinant, v = cross(ax, ay, x, y) / determinant;
          if (u >= 0 && v >= 0 && u + v <= 1) inside++;
        }
        this.raw[j * NX + i] += density * inside / 4;
      }
    };
    for (let expansion = 0; expansion < 8; expansion++) {
      this.raw.fill(0);
      const growth = 1.45 ** expansion;
      // Capacity expansion also extends the open ends. Widening only depth
      // could never fit nearly pure crest liquid into a shorter across span.
      const at = (k: number, v: number) => [center[k][0] * growth + normals[k][0] * center[k][2] * growth * v,
        center[k][1] + normals[k][1] * center[k][2] * growth * v];
      for (let k = 0; k < count; k++) for (let band = 0; band < 4; band++) {
        const v0 = band * .5 - 1, v1 = v0 + .5;
        const a = at(k, v0), b = at(k + 1, v0), c = at(k + 1, v1), d = at(k, v1);
        const measure = .5 / count * (1 - ((v0 + v1) * .5) ** 2) ** 2;
        raster(a, b, c, measure * .5); raster(a, c, d, measure * .5);
      }
      let capacity = 0;
      for (let i = 0; i < CELLS; i++) if (this.raw[i] > 0) capacity += cap * this.weights[offset + i];
      if (capacity >= target * 1.00001) { this.supportExpansions += expansion; return; }
    }
    this.raw.fill(1); this.fullSectionFallbacks++; this.maximumFallbackAge = Math.max(this.maximumFallbackAge, age);
  }

  /** Finite emission windows carry curved sheets, whose branches separate
   * and rejoin before their support dies. There is no persistent track floor.
   * Near the pure-liquid crest, expand those same supports only when their
   * capacity cannot hold Q/v under phi<=1; this is a mass constraint, not gain. */
  private packetSupports(emission: number, age: number, offset: number, target: number, cap: number): void {
    const spacing = 0.16, newest = Math.floor(emission / spacing);
    for (let expansion = 0; expansion < 9; expansion++) {
      this.raw.fill(0);
      const growth = 1.45 ** expansion;
      for (let id = newest - 4; id <= newest; id++) {
        const seed = id * 101 + 731, duration = 0.48 + random(seed) * 0.16;
        const u = (emission - id * spacing) / duration;
        if (u <= 0 || u >= 1) continue;
        const pulse = Math.sin(Math.PI * u) ** 2;
        const cx = (random(seed + 1) - 0.5) * 1.2;
        const cy = (random(seed + 2) - 0.5) * 1.0;
        const wx = (0.55 + random(seed + 3) * 0.3) * growth;
        const wy = (0.11 + random(seed + 4) * 0.09) * growth;
        const slope = (random(seed + 5) - 0.5) * 0.65;
        const curve = (random(seed + 6) - 0.5) * 0.7;
        const split = pulse * (0.12 + random(seed + 7) * 0.23);
        for (let i = 0; i < NX; i++) {
          const dx = ((i + 0.5) * 2 / NX - 1 - cx) / wx;
          if (Math.abs(dx) >= 1) continue;
          const across = (1 - dx * dx) ** 2;
          const center = cy + slope * dx + curve * (dx * dx - 0.3);
          for (const sign of [-1, 1]) {
            const y = center + sign * split * across;
            const lo = Math.max(0, Math.floor((y - wy + 1) * NY / 2 - 0.5));
            const hi = Math.min(NY - 1, Math.ceil((y + wy + 1) * NY / 2 - 0.5));
            for (let j = lo; j <= hi; j++) {
              const dy = ((j + 0.5) * 2 / NY - 1 - y) / wy;
              if (Math.abs(dy) < 1) this.raw[j * NX + i] += pulse * across * (1 - dy * dy) ** 2;
            }
          }
        }
      }
      let capacity = 0;
      for (let i = 0; i < CELLS; i++) if (this.raw[i] > 0) capacity += cap * this.weights[offset + i];
      if (capacity >= target * 1.00001) { this.supportExpansions += expansion; return; }
    }
    // An almost full liquid section cannot contain prescribed air gaps.
    // This bounded fallback is reported rather than silently losing mass.
    this.raw.fill(1); this.fullSectionFallbacks++;
    this.maximumFallbackAge = Math.max(this.maximumFallbackAge, age);
  }

  /** Two cached snapshots interpolate on the GPU. A normal frame only
   * changes one scalar; neither density evaluation nor texture upload runs. */
  /** Deliberate frozen snapshot refresh for the high-resolution candidate.
   * Ordinary update calls keep its captured time: live play must not pay this
   * expensive construction every frame. Other profiles retain their clocks. */
  freezeAt(time:number):boolean {
    if(this.profile!=='formation')throw new Error('Only formation supports frozen snapshots');
    if(!Number.isFinite(time))throw new Error('Frozen formation time must be finite');
    if(this.frozenTime===time)return false;
    const started=performance.now();this.sampleTime=time;this.physicalSection=null;
    this.fill(this.pendingFirst,time);this.first.set(this.pendingFirst);this.second.set(this.pendingFirst);this.blend=0;
    this.frozenTime=time;this.version++;this.lastUpdateMs=performance.now()-started;return true;
  }
  update(time: number): boolean {
    if(this.profile==='formation')return this.frozenTime===null?this.freezeAt(time):false;
    if (this.transient && time !== this.sampleTime) this.physicalSection = null;
    this.sampleTime = time;
    const tick = Math.floor(time / this.config.interval);
    const blend = time / this.config.interval - tick;
    if (tick === this.tick) { this.blend = blend; return false; }
    const started = performance.now();
    // Publish the pair only after both encoded outputs are valid. A failed
    // new row cannot leave one texture from an incomplete update on screen.
    if (tick === this.tick + 1) this.pendingFirst.set(this.second);
    else this.fill(this.pendingFirst, tick * this.config.interval);
    this.fill(this.pendingSecond, (tick + 1) * this.config.interval);
    this.first.set(this.pendingFirst); this.second.set(this.pendingSecond); this.blend = blend;
    this.tick = tick; this.version++; this.lastUpdateMs = performance.now() - started;
    return true;
  }

  /** Matches half-float trilinear texture filtering and snapshot mixing. */
  sample(x: number, y: number, age: number): number {
    const [x0, x1, tx] = basis(x, NX), [y0, y1, ty] = basis(y, NY);
    const NZ = this.config.ages;
    const pz = Math.max(0, Math.min(NZ - 1, age / WATERFALL_ATLAS.maxAge * (NZ - 1))), z0 = Math.floor(pz), z1 = Math.min(NZ - 1, z0 + 1), tz = pz - z0;
    const read = (data: Uint16Array) => {
      const layer = (z: number) => {
        const at = (i: number, j: number) => DataUtils.fromHalfFloat(data[z * CELLS + j * NX + i]);
        return (at(x0, y0) * (1 - tx) + at(x1, y0) * tx) * (1 - ty) + (at(x0, y1) * (1 - tx) + at(x1, y1) * tx) * ty;
      };
      return layer(z0) * (1 - tz) + layer(z1) * tz;
    };
    return read(this.first) * (1 - this.blend) + read(this.second) * this.blend;
  }
}
