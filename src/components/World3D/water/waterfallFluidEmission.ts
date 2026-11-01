/** Moving material samples for the optional reconstructed waterfall.
 * Each birth owns its source volume and launch opening. Gravity stretches
 * that water as it falls; later source edits cannot move already released
 * water. This is bounded prescribed kinematics, not a pressure/SPH solver.
 * The screen renderer reconstructs the visible surface from these samples.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 06/10/2026, 01:10:49
 * Dependents: components/World3D/water/riverWaterfallView.ts, components/World3D/water/waterfallReconstructedFluid.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export const FLUID_EMISSION = { stepS: .025, lanes: 40, maximumParticles: 12000, gravity: 9.81 } as const;
export interface FluidBirth { q: number; speed: number; width: number; depth: number; top: number; ageScale: number }
export interface FluidParticle {
  id: string; birth: number; age: number; volume: number;
  center: [number, number, number]; tangent: [number, number, number];
  radii: [number, number, number]; liquidFraction: number; foam: number;
  spray?: boolean;
}
const hash = (x: number, y: number) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return 2 * (v - Math.floor(v)) - 1; };
const noise = (x: number, y: number) => {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return (hash(ix, iy) * (1 - sx) + hash(ix + 1, iy) * sx) * (1 - sy)
    + (hash(ix, iy + 1) * (1 - sx) + hash(ix + 1, iy + 1) * sx) * sy;
};
const signal = (birth: number, u: number) => noise(birth / .13, u * 11) * .65 + noise(birth / .47, u * 5) * .35;

/** Birth labels rather than render-frame random numbers own all structure.
 * A backward proof seek reconstructs the same water exactly. The source
 * callback must provide historical openings, including zero after shutdown.
 * Each ellipsoid carries an exact liquid-volume budget; overlaps are a
 * reconstruction filter, so their union volume is not a CFD volume claim.
 */
export function buildFluidParticles(time: number, pool: number, historyS: number,
  sourceAt: (birth: number) => FluidBirth) {
  if (![time, pool, historyS].every(Number.isFinite) || historyS <= 0 || historyS > 7) throw Error('Invalid fluid history');
  const particles: FluidParticle[] = [];
  let emittedVolume = 0, airborneVolume = 0, landedVolume = 0;
  const step = FLUID_EMISSION.stepS;
  for (let cell = Math.floor((time - historyS) / step); cell <= Math.floor(time / step); cell++) {
    const lo = Math.max(time - historyS, cell * step), hi = Math.min(time, (cell + 1) * step);
    if (hi <= lo) continue;
    const birth = (lo + hi) * .5, source = sourceAt(birth);
    if (![source.q, source.speed, source.width, source.depth, source.top, source.ageScale].every(Number.isFinite)
      || source.q < 0 || source.speed < 0 || source.width <= 0 || source.depth <= 0 || source.ageScale <= 0) throw Error('Invalid fluid birth');
    if (source.q === 0) continue;
    const age = (time - birth) / source.ageScale, amount = source.q * (hi - lo);
    emittedVolume += amount;
    const g = FLUID_EMISSION.gravity;
    const y = source.top - source.depth * .5 * Math.exp(-6 * age * age) - .5 * g * age * age;
    if (y <= pool) { landedVolume += amount; continue; }
    const vy = source.depth * 6 * age * Math.exp(-6 * age * age) - g * age;
    const flow = 1 - Math.exp(-source.speed / .8), developed = 1 - Math.exp(-age * age * .8);
    // Slow runoff gathers into fewer rivulets; faster release retains a broad
    // connected curtain. Neither the opening nor launch velocity is replaced
    // by a globally fixed waterfall width or speed.
    const lanes = Math.max(6, Math.ceil(FLUID_EMISSION.lanes * (.18 + .82 * flow)));
    const width = source.width * (1 - developed * .72 * (1 - flow));
    for (let lane = 0; lane < lanes; lane++) {
      const u = (lane + .5) / lanes, carried = signal(birth, u);
      const lateral = (u - .5) * width + developed * flow * .24 * Math.sin(birth * 5 + u * 9);
      // Relative deformation is carried with the water. Uniform gravity alone
      // does not whiten the fall. Increasing launch energy increases breakup.
      const relief = developed * (.12 + .45 * flow) * carried;
      const forward = source.speed * age + relief;
      const localSpeed = Math.hypot(source.speed, vy) / source.ageScale;
      const rt = Math.max(.035, localSpeed * step * .82);
      const ra = Math.max(.018, width / lanes * (.82 - .16 * developed * (1 - flow)));
      const parcelVolume = amount / lanes;
      const foam = Math.min(.7, Math.max(0, developed * flow * (Math.abs(signal(birth + .025, u) - carried) * 4.2 - .12)));
      // A small local transfer becomes sparse airborne spray. Its budget is
      // removed from this same parcel; it is not a second source of water.
      const sprayVolume = foam > .18 && lane % 3 === Math.abs(cell % 3) ? parcelVolume * foam * .06 : 0;
      const volume = parcelVolume - sprayVolume;
      const rn = Math.max(.012, volume / (4 * Math.PI / 3 * rt * ra));
      const fraction = volume / (4 * Math.PI / 3 * rt * ra * rn);
      const arc = Math.max(1e-8, Math.hypot(source.speed, vy));
      particles.push({ id: cell + ':' + lane, birth, age, volume,
        center: [forward, y, lateral], tangent: [source.speed / arc, vy / arc, 0],
        radii: [rt, rn, ra], liquidFraction: fraction, foam });
      airborneVolume += volume;
      if (sprayVolume > 0) {
        const spread = developed * flow, r = Math.max(.018, Math.cbrt(sprayVolume * 3 / (4 * Math.PI)));
        particles.push({ id: cell + ':' + lane + ':spray', birth, age, volume: sprayVolume, spray: true,
          center: [forward + spread * (.35 + Math.abs(carried)), y, lateral + spread * carried * .8],
          tangent: [source.speed / arc, vy / arc, 0], radii: [r * 1.7, r * .77, r * .77],
          liquidFraction: sprayVolume / (4 * Math.PI / 3 * r ** 3 * 1.7 * .77 ** 2), foam });
        airborneVolume += sprayVolume;
      }
    }
  }
  if (particles.length > FLUID_EMISSION.maximumParticles) throw Error('Fluid particle capacity exceeded');
  return { particles, emittedVolume, airborneVolume, landedVolume,
    budgetError: airborneVolume + landedVolume - emittedVolume };
}

/** Ordinary source edits have a small resident history. Floods use the
 * authoritative analytic pulse instead. Backward seeks discard future edits;
 * seeking before all retained history resets to the supplied current source.
 */
export class FluidSourceHistory {
  private entries: { time: number; source: FluidBirth }[] = [];
  private time = -Infinity;
  record(time: number, source: FluidBirth) {
    if (time < this.time) this.entries = this.entries.filter(entry => entry.time <= time);
    if (!this.entries.length) this.entries.push({ time: -Infinity, source: { ...source } });
    const previous = this.entries[this.entries.length - 1].source;
    if (Object.keys(source).some(key => source[key as keyof FluidBirth] !== previous[key as keyof FluidBirth]))
      this.entries.push({ time, source: { ...source } });
    this.time = time;
    while (this.entries.length > 2 && this.entries[1].time < time - 7) this.entries.shift();
  }
  at(time: number): FluidBirth {
    for (let k = this.entries.length - 1; k >= 0; k--) if (this.entries[k].time <= time) return this.entries[k].source;
    return this.entries[0].source;
  }
  reset() { this.entries = []; this.time = -Infinity; }
  receipt() { return { sourceEdits: Math.max(0, this.entries.length - 1), earliestRetainedEdit: this.entries[1]?.time ?? null, latestRecordedTime: this.time }; }
}
