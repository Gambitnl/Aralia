/**
 * An isolated falling-water experiment with persistent liquid and moving air.
 * Material triangles keep their water volume as their vertices stretch. Edges
 * can contract into ligaments, then drops; every transfer retains water and
 * momentum. The native river and its arrival schedule remain the authority.
 *
 * The legacy drag modes and damage closure remain experimental reductions.
 * Opt-in projected-air instead couples liquid normal motion and incompressible
 * MAC-grid air through a joint mass-weighted projection. Its finite support is
 * a declared coarse pressure coupling, not a sharp two-face liquid solver or
 * resolved centimeter-scale breakup. The native river remains untouched.
 * Exchange impulses conserve momentum; semi-Lagrangian air transport itself
 * is not momentum-conservative, so exchange receipts are not a global budget.
 * No shape is driven by camera, opacity, a stored animation, or a cloth spring.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/10/2026, 09:59:45
 * Dependents: components/World3D/water/waterfallThinFeatureView.ts, components/World3D/water/waterfallThinLiveView.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { WaterfallAirProjection, type AirProjectionOptions, type AirProjectionReceipt } from './waterfallAirProjection';

export type ThinVec3 = [number, number, number];
export type ThinAirMode = 'fixed-air' | 'one-way' | 'two-way' | 'projected-air';
export interface ThinSource { q: number; width: number; depth: number; speed: number; top?: number; turbulence?: number; verticalSpeed?: number; forward?: number }
export interface ThinDynamicsOptions {
  dt: number; emissionStep: number; across: number; airCell: number;
  mode: ThinAirMode; crest: number; pool: number; maximumFeatures: number;
  ambient: ThinVec3; rupture: boolean;
  projectedAir?: Partial<AirProjectionOptions>;
  /** Streaming comparison: account for momentum when a new face adds mass to
   * an existing row. The older isolated controls retain their original law. */
  conservativeAdmission?: boolean;
}
export interface ThinVertex { id: number; position: ThinVec3; velocity: ThinVec3 }
export interface ThinPatch { id: number; vertices: [number, number, number]; volume: number; thickness: number; normal: ThinVec3; birth: number; damage: number }
export interface ThinLigament { id: number; center: ThinVec3; velocity: ThinVec3; axis: ThinVec3; length: number; radius: number; volume: number; birth: number; age: number }
export interface ThinDrop { id: number; center: ThinVec3; velocity: ThinVec3; radius: number; volume: number; birth: number }
export interface ThinReceipt {
  time: number; emittedVolume: number; airborneVolume: number; landedVolume: number;
  landedMomentum: ThinVec3; exchangeWaterMomentum: ThinVec3; exchangeAirMomentum: ThinVec3;
  budgetError: number; ruptures: number; dropsCreated: number; ticks: number; failure: string | null;
  maximumCapillaryCourant: number;
  admissionMomentum: ThinVec3; admissionMixingLoss: number;
  projectedAir: AirProjectionReceipt | null;
  patchCount: number; ligamentCount: number; dropCount: number; airCellCount: number;
}
export interface ThinSnapshot {
  vertices: ThinVertex[]; patches: ThinPatch[]; ligaments: ThinLigament[]; drops: ThinDrop[];
  air: { center: ThinVec3; velocity: ThinVec3 }[]; receipt: ThinReceipt;
}
const rho = 1000, rhoAir = 1.2, sigma = .072, gravity = 9.81;
const add = (a: ThinVec3, b: ThinVec3): ThinVec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: ThinVec3, b: ThinVec3): ThinVec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: ThinVec3, s: number): ThinVec3 => [a[0] * s, a[1] * s, a[2] * s];
const norm = (a: ThinVec3) => Math.hypot(...a);
const cross = (a: ThinVec3, b: ThinVec3): ThinVec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: ThinVec3): ThinVec3 => mul(a, 1 / Math.max(1e-12, norm(a)));
const average = (a: ThinVec3, b: ThinVec3, c: ThinVec3): ThinVec3 => mul(add(add(a, b), c), 1 / 3);

/** Exact relaxation of two finite masses. Strong drag cannot overshoot the
 * shared velocity. The equal and opposite impulses are useful proof receipts.
 */
export function thinMomentumExchange(water: ThinVec3, air: ThinVec3, waterMass: number, airMass: number, conductance: number, dt: number) {
  if (![waterMass, airMass, conductance, dt].every(Number.isFinite) || waterMass <= 0 || airMass <= 0 || conductance < 0 || dt < 0) throw Error('Invalid phase exchange');
  const reduced = waterMass * airMass / (waterMass + airMass);
  const impulse = mul(sub(air, water), reduced * -Math.expm1(-conductance * dt / reduced));
  return { water: add(water, mul(impulse, 1 / waterMass)), air: sub(air, mul(impulse, 1 / airMass)), impulse };
}

/** Normal pressure and tangential skin traction have separate directions.
 * Crosswind loading therefore cannot impersonate large fall-direction drag.
 */
export function thinPlateMomentumExchange(water: ThinVec3, air: ThinVec3, waterMass: number, airMass: number, area: number, normal: ThinVec3, dt: number, skin = .005) {
  const n = unit(normal), relative = sub(air, water), vn = relative.reduce((s, v, k) => s + v * n[k], 0);
  const reduced = waterMass * airMass / (waterMass + airMass);
  const normalImpulse = mul(n, vn * reduced * -Math.expm1(-.5 * rhoAir * .8 * area * Math.abs(vn) * dt / reduced));
  let nextWater = add(water, mul(normalImpulse, 1 / waterMass)), nextAir = sub(air, mul(normalImpulse, 1 / airMass));
  const after = sub(nextAir, nextWater), normalAfter = after.reduce((s, v, k) => s + v * n[k], 0), tangential = sub(after, mul(n, normalAfter));
  const skinImpulse = mul(tangential, reduced * -Math.expm1(-.5 * rhoAir * skin * area * norm(tangential) * dt / reduced));
  nextWater = add(nextWater, mul(skinImpulse, 1 / waterMass)); nextAir = sub(nextAir, mul(skinImpulse, 1 / airMass));
  return { water: nextWater, air: nextAir, impulse: add(normalImpulse, skinImpulse) };
}

/** A local gravity-free gas grid. Semi-Lagrangian transport uses open ambient
 * boundaries and small velocity diffusion. It lacks a pressure projection;
 * exported cells therefore establish local response, not divergence-free air.
 */
export class ThinAirField {
  cells = new Map<string, ThinVec3>();
  constructor(readonly dx: number, readonly ambient: ThinVec3, readonly crest: number) {}
  key(p: ThinVec3) { return p.map(v => Math.floor(v / this.dx)).join(','); }
  center(key: string): ThinVec3 { return key.split(',').map(v => (Number(v) + .5) * this.dx) as ThinVec3; }
  at(p: ThinVec3): ThinVec3 {
    const coord = p.map(v => v / this.dx - .5), lo = coord.map(Math.floor), fraction = coord.map((v, k) => v - lo[k]);
    let velocity: ThinVec3 = [0, 0, 0];
    for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) {
      const weight = (x ? fraction[0] : 1 - fraction[0]) * (y ? fraction[1] : 1 - fraction[1]) * (z ? fraction[2] : 1 - fraction[2]);
      const value = this.cells.get([lo[0] + x, lo[1] + y, lo[2] + z].join(',')) ?? this.ambient;
      velocity = add(velocity, mul(value, weight));
    }
    return velocity;
  }
  cellAt(p: ThinVec3): ThinVec3 { return this.cells.get(this.key(p)) ?? this.ambient; }
  set(p: ThinVec3, velocity: ThinVec3) { this.cells.set(this.key(p), velocity); }
  step(dt: number) {
    const next = new Map<string, ThinVec3>();
    for (const [key, velocity] of this.cells) {
      const p = this.center(key);
      if (p[1] < -3 || p[1] > this.crest + 3 || Math.abs(p[2]) > 10 || p[0] < -5 || p[0] > 100) continue;
      // Transport only cells near water and their immediate neighbors. Ambient
      // re-entry replaces departing gas, so the local grid has open boundaries.
      for (const offset of [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const target = add(p, mul(offset as ThinVec3, this.dx)), targetKey = this.key(target);
        if (next.has(targetKey)) continue;
        const advected = this.at(sub(target, mul(this.cellAt(target), dt)));
        let neighbors: ThinVec3 = [0, 0, 0];
        for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
          const q = [...target] as ThinVec3; q[axis] += sign * this.dx; neighbors = add(neighbors, this.cellAt(q));
        }
        const mix = Math.min(.12, .08 * dt / (this.dx * this.dx));
        const value = add(mul(advected, 1 - mix), mul(neighbors, mix / 6));
        if (norm(sub(value, this.ambient)) > 1e-8 || norm(sub(velocity, this.ambient)) > 1e-5) next.set(targetKey, value);
      }
    }
    if (next.size > 50000) throw Error('Thin air capacity exceeded');
    this.cells = next;
  }
}

export class WaterfallThinDynamics {
  readonly options: ThinDynamicsOptions;
  private vertices = new Map<number, ThinVertex>();
  private patches: ThinPatch[] = [];
  private ligaments: ThinLigament[] = [];
  private drops: ThinDrop[] = [];
  private air: ThinAirField;
  private projection: WaterfallAirProjection | null;
  private pressureReceipt: AirProjectionReceipt | null = null;
  private sources: { time: number; source: ThinSource }[] = [];
  private row: { ids: number[]; source: ThinSource; time: number } | null = null;
  private nextId = 1;
  private nextBirth = 0;
  private nextEvent = 0;
  private tick = 0;
  private emitted = 0;
  private landed = 0;
  private landedMomentum: ThinVec3 = [0, 0, 0];
  private waterExchange: ThinVec3 = [0, 0, 0];
  private airExchange: ThinVec3 = [0, 0, 0];
  private ruptureCount = 0;
  private dropCount = 0;
  private failure: string | null = null;
  private capillaryCourant = 0;
  private airElapsed = 0;
  private admissionMomentum: ThinVec3 = [0, 0, 0];
  private admissionMixingLoss = 0;
  constructor(options: Partial<ThinDynamicsOptions> = {}) {
    this.options = { dt: .005, emissionStep: .025, across: 12, airCell: 1, mode: 'two-way', crest: 70, pool: 0,
      maximumFeatures: 20000, ambient: [.6, 0, .25], rupture: false, ...options };
    const o = this.options;
    if (![o.dt, o.emissionStep, o.airCell, o.crest, o.pool, o.maximumFeatures, ...o.ambient].every(Number.isFinite)
      || o.dt <= 0 || o.dt > .02 || o.emissionStep < o.dt || o.airCell <= 0 || o.crest <= o.pool || o.across < 2 || !Number.isInteger(o.across)) throw Error('Invalid thin-water options');
    this.air = new ThinAirField(o.airCell, [...o.ambient], o.crest);
    // Keep the older controls available. Only the explicit pressure experiment
    // replaces normal drag; it never stacks projection on top of that drag.
    if (o.mode === 'projected-air' && o.rupture) throw Error('Projected air does not yet couple ligament/drop phases');
    // Material-region tests own their areas and persistent group IDs explicitly.
    // This falling-sheet adapter has no such mapping yet; reject it up front.
    if (o.mode === 'projected-air' && o.projectedAir?.coupling === 'material-regions') throw Error('Projected air material regions require a dedicated area and region mapping');
    this.projection = o.mode === 'projected-air' ? new WaterfallAirProjection({
      origin: [-6, o.pool - 4, -6],
      cells: [Math.ceil(24 / o.airCell), Math.ceil((o.crest - o.pool + 8) / o.airCell), Math.ceil(12 / o.airCell)],
      cellSize: o.airCell, ambient: [...o.ambient], ...o.projectedAir,
    }) : null;
  }
  /** Future events retain their own inlet geometry. Rewriting simulated history
   * is rejected instead of quietly changing already released water. A fresh
   * instance is the explicit way to replay a different source experiment.
   */
  recordSource(timeS: number, source: ThinSource) {
    if (!Number.isFinite(timeS) || timeS < this.tick * this.options.dt - 1e-10 || source.q < 0 || source.width <= 0 || source.depth <= 0 || source.speed < 0
      || ![source.q, source.width, source.depth, source.speed, source.top ?? this.options.crest, source.turbulence ?? .12, source.verticalSpeed ?? 0, source.forward ?? 0].every(Number.isFinite)) throw Error('Invalid or past thin-water source event');
    const existing = this.sources.find(event => event.time === timeS);
    const preceding = [...this.sources].reverse().find(event => event.time < timeS);
    if (!existing && preceding && Object.keys({ ...preceding.source, ...source }).every(key => preceding.source[key as keyof ThinSource] === source[key as keyof ThinSource])) return;
    if (existing) existing.source = { ...source };
    else this.sources.push({ time: timeS, source: { ...source } });
    this.sources.sort((a, b) => a.time - b.time);
    if (Math.abs(timeS - this.tick * this.options.dt) < 1e-10) this.emit(timeS);
  }
  private sourceAt(time: number): ThinSource | null {
    for (let k = this.sources.length - 1; k >= 0; k--) if (this.sources[k].time <= time + 1e-12) return this.sources[k].source;
    return null;
  }
  advanceTo(timeS: number) {
    if (!Number.isFinite(timeS) || timeS < this.tick * this.options.dt - 1e-9) throw Error('Thin-water clock cannot seek backward');
    if (this.failure) throw Error(this.failure);
    const target = Math.floor((timeS + 1e-10) / this.options.dt);
    try { while (this.tick < target) {
      let at = this.tick * this.options.dt;
      const end = (this.tick + 1) * this.options.dt;
      while (true) {
        const eventTime = this.sources[this.nextEvent]?.time ?? Infinity;
        const birth = Math.min(this.nextBirth, eventTime);
        if (birth > end + 1e-10) break;
        if (birth > at + 1e-10) this.step(birth - at);
        this.emit(birth); at = birth;
        if (Math.abs(birth - this.nextBirth) < 1e-10) this.nextBirth += this.options.emissionStep;
        if (Math.abs(birth - eventTime) < 1e-10) this.nextEvent++;
      }
      if (end > at + 1e-10) this.step(end - at);
      this.tick++;
    } }
    catch (error) { this.failure = String(error); throw error; }
  }
  private inletRow(time: number, source: ThinSource) {
    // A birth row is a real material opening, with a deterministic inlet
    // velocity perturbation in meters/second. It is not a downstream shape law.
    const ids: number[] = [], n = this.options.across, turbulent = source.turbulence ?? .12;
    for (let j = 0; j <= n; j++) {
      const z = source.width * (j / n - .5), id = this.nextId++;
      const a = Math.sin(time * 9.13 + z * 17.7), b = Math.sin(time * 3.71 - z * 8.1 + .8);
      this.vertices.set(id, { id, position: [source.forward ?? 0, source.top ?? this.options.crest, z],
        velocity: [source.speed + turbulent * a, (source.verticalSpeed ?? 0) + turbulent * .45 * b, turbulent * .7 * a * b] }); ids.push(id);
    }
    return { ids, source: { ...source }, time };
  }
  private emit(time: number) {
    const current = this.sourceAt(time), previous = this.row;
    const changed = previous && current && Object.keys({ ...previous.source, ...current }).filter(key => key !== 'q')
      .some(key => previous.source[key as keyof ThinSource] !== current[key as keyof ThinSource]);
    // A control edit at the current clock can revisit a boundary that was
    // already processed. It changes only the next inlet, never zero-volume
    // triangles or vertices that already carry the completed interval.
    if (previous && time <= previous.time + 1e-10) {
      if (!current || current.q === 0) this.row = null;
      else if (changed) this.row = this.inletRow(time, current);
      return;
    }
    if (previous) {
      // Integrate piecewise source events exactly over this emission interval.
      // Geometry is sampled at births; the full source budget remains exact.
      let amount = 0, at = previous.time;
      const cuts = this.sources.filter(e => e.time > at && e.time < time).map(e => e.time).concat(time);
      for (const end of cuts) { amount += (this.sourceAt(at)?.q ?? 0) * (end - at); at = end; }
      // The completed interval owns both of its launch boundaries. At an
      // abrupt source change, use a distinct future row: one vertex cannot
      // simultaneously carry the old and new inlet velocities. This creates
      // an explicit inlet seam, rather than stealing past material momentum.
      const closing = this.inletRow(time, previous.source), n = this.options.across;
      const oldMass = new Map<number, number>();
      const addedMass = new Map<number, number>();
      if (this.options.conservativeAdmission) for (const patch of this.patches) for (const id of patch.vertices) oldMass.set(id, (oldMass.get(id) ?? 0) + rho * patch.volume / 3);
      if (amount > 0) for (let j = 0; j < n; j++) {
        for (const v of [[previous.ids[j], previous.ids[j + 1], closing.ids[j]], [closing.ids[j], previous.ids[j + 1], closing.ids[j + 1]]]) {
          this.patches.push({ id: this.nextId++, vertices: v as [number, number, number], volume: amount / (2 * n), thickness: previous.source.depth, normal: [0, 1, 0], birth: (time + previous.time) * .5, damage: 0 });
          if (this.options.conservativeAdmission) for (const id of v) addedMass.set(id, (addedMass.get(id) ?? 0) + rho * amount / (6 * n));
        }
      }
      // Adding water to a shared material row changes its mass. Preserve its
      // old momentum and mix the incoming momentum explicitly; do not assign
      // the old velocity to new mass and manufacture momentum. The incoming
      // ballistic velocity is an approximate boundary prescription, not a
      // solved finite-depth crest. Record its inelastic projection loss.
      for (const [id, incomingMass] of addedMass) {
        const vertex = this.vertices.get(id)!, residentMass = oldMass.get(id) ?? 0;
        const age = previous.ids.includes(id) ? time - previous.time : 0;
        const incoming: ThinVec3 = [previous.source.speed, (previous.source.verticalSpeed ?? 0) - gravity * age, 0];
        const totalMass = residentMass + incomingMass;
        const combined = mul(add(mul(vertex.velocity, residentMass), mul(incoming, incomingMass)), 1 / totalMass);
        this.admissionMixingLoss += .5 * (residentMass * norm(vertex.velocity) ** 2 + incomingMass * norm(incoming) ** 2 - totalMass * norm(combined) ** 2);
        this.admissionMomentum = add(this.admissionMomentum, mul(incoming, incomingMass));
        vertex.velocity = combined;
      }
      this.emitted += amount;
      this.row = current && current.q > 0 ? changed ? this.inletRow(time, current) : { ...closing, source: { ...current } } : null;
    } else this.row = current && current.q > 0 ? this.inletRow(time, current) : null;
  }
  private shape(p: ThinPatch) {
    const v = p.vertices.map(id => this.vertices.get(id)!);
    const raw = cross(sub(v[1].position, v[0].position), sub(v[2].position, v[0].position));
    const area = Math.max(1e-12, norm(raw) * .5);
    p.normal = unit(raw); p.thickness = p.volume / area;
    return { v, area, center: average(v[0].position, v[1].position, v[2].position), velocity: average(v[0].velocity, v[1].velocity, v[2].velocity) };
  }
  private exchange(position: ThinVec3, velocity: ThinVec3, mass: number, area: number, dt: number): ThinVec3 {
    if (this.options.mode === 'fixed-air') return velocity;
    const gas = this.options.mode === 'two-way' ? this.air.cellAt(position) : this.options.ambient;
    const drag = .5 * rhoAir * .8 * area * norm(sub(gas, velocity));
    if (this.options.mode !== 'two-way') {
      const next = add(gas, mul(sub(velocity, gas), Math.exp(-drag * dt / mass)));
      this.waterExchange = add(this.waterExchange, mul(sub(next, velocity), mass)); return next;
    }
    const result = thinMomentumExchange(velocity, gas, mass, rhoAir * this.options.airCell ** 3, drag, dt);
    this.air.set(position, result.air);
    this.waterExchange = add(this.waterExchange, result.impulse); this.airExchange = sub(this.airExchange, result.impulse);
    return result.water;
  }
  private land(volume: number, velocity: ThinVec3) { this.landed += volume; this.landedMomentum = add(this.landedMomentum, mul(velocity, volume * rho)); }
  private step(dt: number) {
    const oldLigaments = new Set(this.ligaments.map(l => l.id)), oldDrops = new Set(this.drops.map(d => d.id));
    const masses = new Map<number, number>(), loads = new Map<number, { area: number; normal: ThinVec3 }[]>(), forces = new Map<number, ThinVec3>();
    for (const p of this.patches) {
      const shape = this.shape(p), { area } = shape;
      // Normal loading uses projected area. The 0.005 tangential coefficient
      // is an explicit uncalibrated skin-drag assumption for this experiment.
      for (const id of p.vertices) { masses.set(id, (masses.get(id) ?? 0) + p.volume * rho / 3); const local = loads.get(id) ?? []; local.push({ area: area / 3, normal: p.normal }); loads.set(id, local); }
      for (let j = 0; j < 3; j++) {
        const id = p.vertices[j], opposite = sub(shape.v[(j + 1) % 3].position, shape.v[(j + 2) % 3].position);
        // Negative gradient of the two-sided surface energy E=2*sigma*area.
        // Interior forces cancel on a flat connected sheet; free edges retract.
        forces.set(id, add(forces.get(id) ?? [0, 0, 0], mul(cross(opposite, p.normal), -sigma)));
        this.capillaryCourant = Math.max(this.capillaryCourant, dt * Math.sqrt(sigma / (rho * Math.max(1e-12, p.thickness))) / Math.max(1e-9, norm(opposite)));
      }
    }
    const previousVelocity = this.projection ? new Map([...masses.keys()].map(id => [id, [...this.vertices.get(id)!.velocity] as ThinVec3])) : null;
    for (const [id, mass] of masses) {
      const v = this.vertices.get(id)!;
      v.velocity = add(v.velocity, mul(forces.get(id) ?? [0, 0, 0], dt / mass));
      v.velocity[1] -= gravity * dt;
      if (!this.projection && this.options.mode !== 'fixed-air') for (const load of loads.get(id) ?? []) {
        const gas = this.options.mode === 'two-way' ? this.air.cellAt(v.position) : this.options.ambient;
        const result = thinPlateMomentumExchange(v.velocity, gas, mass, this.options.mode === 'two-way' ? rhoAir * this.options.airCell ** 3 : 1e30, load.area, load.normal, dt);
        v.velocity = result.water; this.waterExchange = add(this.waterExchange, result.impulse);
        if (this.options.mode === 'two-way') { this.air.set(v.position, result.air); this.airExchange = sub(this.airExchange, result.impulse); }
      }
      if (!this.projection) v.position = add(v.position, mul(v.velocity, dt));
    }
    if (this.projection) {
      const previousAir = [this.projection.u.slice(), this.projection.v.slice(), this.projection.w.slice(), this.projection.pressure.slice()];
      try {
      // All shared liquid vertices participate simultaneously after gravity and
      // capillarity. Zero-mass inlet samples are absent from this constraint.
      // Lagged area-weighted normals describe the current material; they do not
      // certify swept contact or resolve liquid thickness below the air grid.
      const points = [...masses].map(([id, mass]) => {
        const v = this.vertices.get(id)!;
        const weighted = (loads.get(id) ?? []).reduce((sum, load) => add(sum, mul(load.normal, load.area)), [0, 0, 0] as ThinVec3);
        if (!(norm(weighted) > 1e-12)) throw Error('Unresolved projected liquid normal');
        return { id, mass, position: v.position, normal: unit(weighted), velocity: v.velocity };
      });
      this.projection.advect(dt);
      const result = this.projection.project(points, dt);
      this.pressureReceipt = result.receipt;
      if (!result.receipt.converged) throw Error(result.receipt.failure ?? 'Coupled air projection failed');
      this.waterExchange = add(this.waterExchange, result.receipt.exchangeLiquidImpulse);
      this.airExchange = add(this.airExchange, result.receipt.exchangeAirImpulse);
      points.forEach((point, i) => {
        const v = this.vertices.get(point.id)!;
        v.velocity = [...result.velocities[i]];
        v.position = add(v.position, mul(v.velocity, dt));
      });
      } catch (error) {
        // A failed pressure step keeps both physical phases at the previous
        // accepted state. Its failed receipt remains visible for diagnosis.
        for (const [id, velocity] of previousVelocity!) this.vertices.get(id)!.velocity = velocity;
        [this.projection.u, this.projection.v, this.projection.w, this.projection.pressure].forEach((field, i) => field.set(previousAir[i]));
        throw error;
      }
    }
    // The first boundary row has no water until its interval is complete; move
    // it under gravity too, rather than leaving a rigid horizontal crest rail.
    for (const id of this.row?.ids ?? []) if (!masses.has(id)) {
      const v = this.vertices.get(id)!; v.velocity[1] -= gravity * dt; v.position = add(v.position, mul(v.velocity, dt));
    }
    const surviving: ThinPatch[] = [];
    for (const p of this.patches) {
      const shape = this.shape(p);
      if (shape.center[1] <= this.options.pool) { this.land(p.volume, shape.velocity); continue; }
      const relative = sub(this.air.at(shape.center), shape.velocity);
      const normalSpeed = Math.abs(relative.reduce((s, v, k) => s + v * p.normal[k], 0));
      const weber = rhoAir * normalSpeed ** 2 * p.thickness / sigma;
      const capillaryTime = Math.sqrt(rho * Math.max(1e-6, p.thickness) ** 3 / sigma);
      // Disabled by default: one material triangle becoming one ligament makes
      // fragment size depend on tessellation. This opt-in closure is diagnostic
      // evidence only until a mesh-independent rupture/redistribution exists.
      // Unvalidated physical-scale damage closure: sustained normal air load
      // competes with capillarity. No grid, mesh radius, age pattern or emission
      // index chooses the rupture site. Refinement still needs visual study.
      p.damage += dt * Math.max(0, weber / 6 - 1) / Math.max(.025, capillaryTime);
      if (this.options.rupture && p.damage > 1) {
        const pairs = [[0, 1], [1, 2], [2, 0]].map(([a, b]) => sub(shape.v[b].position, shape.v[a].position));
        const longest = pairs.reduce((a, b) => norm(a) > norm(b) ? a : b), length = norm(longest);
        this.ligaments.push({ id: p.id, center: shape.center, velocity: shape.velocity, axis: unit(longest), length,
          radius: Math.sqrt(p.volume / (Math.PI * Math.max(1e-6, length))), volume: p.volume, birth: p.birth, age: 0 });
        this.ruptureCount++;
      } else surviving.push(p);
    }
    this.patches = surviving;
    const ligaments: ThinLigament[] = [];
    for (const l of this.ligaments) {
      if (!oldLigaments.has(l.id)) { ligaments.push(l); continue; }
      l.velocity[1] -= gravity * dt; l.velocity = this.exchange(l.center, l.velocity, l.volume * rho, 2 * l.radius * l.length, dt);
      l.center = add(l.center, mul(l.velocity, dt)); l.age += dt;
      if (l.center[1] <= this.options.pool) { this.land(l.volume, l.velocity); continue; }
      // Taylor-Culick scale contraction retains volume; Rayleigh breakup is
      // represented by two equal drops, not an arbitrary spray population.
      const retract = Math.sqrt(sigma / (rho * Math.max(1e-8, l.radius)));
      l.length = Math.max(2 * l.radius, l.length - 2 * retract * dt);
      l.radius = Math.sqrt(l.volume / (Math.PI * l.length));
      if (l.age > 3 * Math.sqrt(rho * l.radius ** 3 / sigma)) {
        for (const sign of [-1, 1]) this.drops.push({ id: this.nextId++, center: add(l.center, mul(l.axis, sign * l.length * .25)),
          velocity: [...l.velocity], volume: l.volume / 2, radius: Math.cbrt(l.volume * .5 * 3 / (4 * Math.PI)), birth: l.birth });
        this.dropCount += 2;
      } else ligaments.push(l);
    }
    this.ligaments = ligaments;
    this.drops = this.drops.filter(d => {
      if (!oldDrops.has(d.id)) return true;
      d.velocity[1] -= gravity * dt; d.velocity = this.exchange(d.center, d.velocity, d.volume * rho, Math.PI * d.radius ** 2, dt);
      d.center = add(d.center, mul(d.velocity, dt));
      if (d.center[1] <= this.options.pool) { this.land(d.volume, d.velocity); return false; } return true;
    });
    const used = new Set(this.patches.flatMap(p => p.vertices)); for (const id of this.row?.ids ?? []) used.add(id);
    for (const id of this.vertices.keys()) if (!used.has(id)) this.vertices.delete(id);
    if (this.patches.length + this.ligaments.length + this.drops.length > this.options.maximumFeatures) throw Error('Thin water capacity exceeded; water retained in failed state');
    if ([...this.vertices.values()].some(v => ![...v.position, ...v.velocity].every(Number.isFinite))) throw Error('Thin water nonfinite state');
    if (this.options.mode === 'two-way') {
      this.airElapsed += dt;
      if (this.airElapsed >= .02 - 1e-10) { this.air.step(this.airElapsed); this.airElapsed = 0; }
    }
  }
  receipt(): ThinReceipt {
    const airborne = this.patches.reduce((s, p) => s + p.volume, 0) + this.ligaments.reduce((s, p) => s + p.volume, 0) + this.drops.reduce((s, p) => s + p.volume, 0);
    return { time: this.tick * this.options.dt, emittedVolume: this.emitted, airborneVolume: airborne, landedVolume: this.landed,
      landedMomentum: [...this.landedMomentum], exchangeWaterMomentum: [...this.waterExchange], exchangeAirMomentum: [...this.airExchange],
      budgetError: airborne + this.landed - this.emitted, ruptures: this.ruptureCount, dropsCreated: this.dropCount, ticks: this.tick, failure: this.failure,
      maximumCapillaryCourant: this.capillaryCourant,
      admissionMomentum: [...this.admissionMomentum], admissionMixingLoss: this.admissionMixingLoss,
      projectedAir: this.pressureReceipt ? structuredClone(this.pressureReceipt) : null,
      patchCount: this.patches.length,
      ligamentCount: this.ligaments.length, dropCount: this.drops.length, airCellCount: this.projection ? this.projection.pressure.length : this.air.cells.size };
  }
  snapshot(): ThinSnapshot {
    // Copies prevent renderer or proof code from editing authoritative state.
    return { vertices: Array.from(this.vertices.values(), v => ({ ...v, position: [...v.position], velocity: [...v.velocity] })),
      patches: this.patches.map(p => ({ ...p, vertices: [...p.vertices], normal: [...p.normal] })),
      ligaments: this.ligaments.map(l => ({ ...l, center: [...l.center], velocity: [...l.velocity], axis: [...l.axis] })),
      drops: this.drops.map(d => ({ ...d, center: [...d.center], velocity: [...d.velocity] })),
      air: this.projection ? this.projection.diagnosticCells(2) : Array.from(this.air.cells, ([key, velocity]) => ({ center: this.air.center(key), velocity: [...velocity] })), receipt: this.receipt() };
  }
}
