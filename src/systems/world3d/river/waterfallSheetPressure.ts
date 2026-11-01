/**
 * A small liquid sheet moves under pressure from air on both faces.
 * This isolated mechanism benchmark does not replace the native river. A
 * numerical finite-depth potential solve supplies air inertia and pressure;
 * water inertia and two liquid surfaces supply the capillary response.
 *
 * LIMIT: linear, periodic, sinuous motion in the water material frame. Base
 * thickness is constant to first order. There is no gravity, rupture, mist,
 * viscosity, cloth elasticity, crest, or nonlinear waterfall claim. Sealed
 * gas strips reject the mean mode. Pressure impulse equality is an interface
 * budget, not a global gas momentum budget: the outer walls exert reactions.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 06/10/2026, 02:48:39
 * Dependents: None (Orphan)
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export interface SheetPressureOptions {
  length: number; cells: number; gasDepth: number; gasRows: number; dt: number;
  thickness: number; waterDensity: number; airDensity: number; surfaceTension: number;
  airSpeed: [number, number]; maximumSlope: number; maximumRelativeDisplacement: number;
}
export interface SheetPerturbation { mode: number; amplitude: number; velocity?: number; phase?: number }
export interface SheetPressureReceipt {
  maxSlope: number; relativeDisplacement: number; validLinear: boolean;
  /** Unit-flux Laplace and interface equation residuals (dimensionless).
   * Dynamic residual is in Pa; cumulative impulse residual is in Pa seconds.
   * Dynamic/impulse diagnostics are inapplicable until ticks is positive. */
  laplaceResidual: number; interfaceResidual: number;
  dynamicResidual: number; impulsePairResidual: number; waterImpulse: Float64Array;
  gasImpulse: Float64Array; capillaryImpulse: Float64Array; energy: number;
  ticks: number; failure: string | null;
}
export interface SheetPressureSnapshot {
  time: number; x: Float64Array; displacement: Float64Array; velocity: Float64Array;
  thickness: Float64Array; pressureUpper: Float64Array; pressureLower: Float64Array;
  gasNormalUpper: Float64Array; gasNormalLower: Float64Array;
  /** Pressures and gas interface velocities apply to this midpoint, not to
   * the endpoint displacement. Null means there has been no pressure step. */
  midpointTime: number | null; midpointDisplacement: Float64Array;
  midpointVelocity: Float64Array; pressureAirSpeed: [number, number];
  spectra: { mode: number; amplitude: number; velocityAmplitude: number }[];
  receipt: SheetPressureReceipt;
}

// The gas pressure response is obtained by solving Laplace's equation. Each
// boundary has a half control volume; this makes the prescribed interface
// flux part of the same equations as the interior, rather than a target shape.
function gasResponse(lambda: number, depth: number, rows: number) {
  const dz = depth / rows, n = rows + 1;
  const diagonal = new Float64Array(n), rhs = new Float64Array(n);
  const original = new Float64Array(n), potential = new Float64Array(n);
  for (let j = 0; j < n; j++) diagonal[j] = original[j] =
    lambda * dz * (j === 0 || j === rows ? .5 : 1) + (j === 0 || j === rows ? 1 : 2) / dz;
  rhs[0] = 1;
  for (let j = 1; j < n; j++) {
    const factor = -1 / dz / diagonal[j - 1];
    diagonal[j] += factor / dz;
    rhs[j] -= factor * rhs[j - 1];
  }
  potential[rows] = rhs[rows] / diagonal[rows];
  for (let j = rows - 1; j >= 0; j--) potential[j] = (rhs[j] + potential[j + 1] / dz) / diagonal[j];
  let residual = 0;
  for (let j = 0; j < n; j++) {
    const lhs = original[j] * potential[j] - (j > 0 ? potential[j - 1] / dz : 0)
      - (j < rows ? potential[j + 1] / dz : 0);
    residual = Math.max(residual, Math.abs(lhs - (j === 0 ? 1 : 0)));
  }
  const flux = (potential[0] - potential[1]) / dz + lambda * dz * .5 * potential[0];
  return { response: potential[0], residual, interfaceResidual: Math.abs(flux - 1) };
}

export class WaterfallSheetPressure {
  readonly options: SheetPressureOptions;
  private readonly etaR: Float64Array; private readonly etaI: Float64Array;
  private readonly wR: Float64Array; private readonly wI: Float64Array;
  private readonly midEtaR: Float64Array; private readonly midEtaI: Float64Array;
  private readonly midWR: Float64Array; private readonly midWI: Float64Array;
  private readonly response: Float64Array; private readonly lambda: Float64Array;
  private readonly derivative: Float64Array; private readonly cos: Float64Array;
  private readonly sin: Float64Array;
  private readonly pUpperR: Float64Array; private readonly pUpperI: Float64Array;
  private readonly pLowerR: Float64Array; private readonly pLowerI: Float64Array;
  private readonly qUpperR: Float64Array; private readonly qUpperI: Float64Array;
  private readonly qLowerR: Float64Array; private readonly qLowerI: Float64Array;
  private readonly waterImpulse: Float64Array; private readonly gasImpulse: Float64Array;
  private readonly capillaryImpulse: Float64Array;
  private events: { time: number; speed: [number, number] }[] = [];
  private speed: [number, number]; private clock = 0; private ticks = 0;
  private midpointTime: number | null = null; private pressureAirSpeed: [number, number];
  private laplaceResidual = 0; private interfaceResidual = 0; private dynamicResidual = 0;
  private pairResidual = 0; private failure: string | null = null;

  constructor(options: Partial<SheetPressureOptions> = {}, perturbations: SheetPerturbation[] = [{ mode: 2, amplitude: .0001 }]) {
    this.options = { length: 1, cells: 32, gasDepth: .25, gasRows: 24, dt: .001,
      thickness: .001, waterDensity: 1000, airDensity: 1.2, surfaceTension: .072,
      airSpeed: [0, 0], maximumSlope: .1, maximumRelativeDisplacement: .1, ...options };
    const o = this.options;
    if (![o.length, o.cells, o.gasDepth, o.gasRows, o.dt, o.thickness, o.waterDensity,
      o.airDensity, o.surfaceTension, o.maximumSlope, o.maximumRelativeDisplacement, ...o.airSpeed].every(Number.isFinite)
      || o.length <= 0 || !Number.isInteger(o.cells) || o.cells < 8 || o.cells > 128 || o.cells % 2
      || o.gasDepth <= 0 || !Number.isInteger(o.gasRows) || o.gasRows < 2 || o.gasRows > 512
      || o.dt <= 0 || o.thickness <= 0 || o.waterDensity <= 0 || o.airDensity < 0
      || o.surfaceTension < 0 || o.maximumSlope <= 0 || o.maximumSlope > .25
      || o.maximumRelativeDisplacement <= 0 || o.maximumRelativeDisplacement > .25) throw Error('Invalid sheet pressure options');
    const n = o.cells, modes = n / 2;
    this.etaR = new Float64Array(modes); this.etaI = new Float64Array(modes);
    this.wR = new Float64Array(modes); this.wI = new Float64Array(modes);
    this.midEtaR = new Float64Array(modes); this.midEtaI = new Float64Array(modes);
    this.midWR = new Float64Array(modes); this.midWI = new Float64Array(modes);
    this.response = new Float64Array(modes); this.lambda = new Float64Array(modes);
    this.derivative = new Float64Array(modes); this.cos = new Float64Array(n * modes);
    this.sin = new Float64Array(n * modes);
    this.pUpperR = new Float64Array(modes); this.pUpperI = new Float64Array(modes);
    this.pLowerR = new Float64Array(modes); this.pLowerI = new Float64Array(modes);
    this.qUpperR = new Float64Array(modes); this.qUpperI = new Float64Array(modes);
    this.qLowerR = new Float64Array(modes); this.qLowerI = new Float64Array(modes);
    this.waterImpulse = new Float64Array(n); this.gasImpulse = new Float64Array(n);
    this.capillaryImpulse = new Float64Array(n); this.speed = [...o.airSpeed]; this.pressureAirSpeed = [...o.airSpeed];
    const dx = o.length / n;
    for (let k = 1; k < modes; k++) {
      this.lambda[k] = 4 * Math.sin(Math.PI * k / n) ** 2 / dx ** 2;
      this.derivative[k] = Math.sin(2 * Math.PI * k / n) / dx;
      const gas = gasResponse(this.lambda[k], o.gasDepth, o.gasRows);
      this.response[k] = gas.response;
      this.laplaceResidual = Math.max(this.laplaceResidual, gas.residual);
      this.interfaceResidual = Math.max(this.interfaceResidual, gas.interfaceResidual);
      for (let j = 0; j < n; j++) {
        this.cos[k * n + j] = Math.cos(2 * Math.PI * k * j / n);
        this.sin[k * n + j] = Math.sin(2 * Math.PI * k * j / n);
      }
    }
    for (const p of perturbations) {
      if (!Number.isInteger(p.mode) || p.mode <= 0 || p.mode >= modes
        || ![p.amplitude, p.velocity ?? 0, p.phase ?? 0].every(Number.isFinite))
        throw Error('Unsupported perturbation: mean and Nyquist modes are excluded');
      this.etaR[p.mode] += p.amplitude * Math.cos(p.phase ?? 0);
      this.etaI[p.mode] += p.amplitude * Math.sin(p.phase ?? 0);
      this.wR[p.mode] += (p.velocity ?? 0) * Math.cos(p.phase ?? 0);
      this.wI[p.mode] += (p.velocity ?? 0) * Math.sin(p.phase ?? 0);
    }
    this.checkValidity();
  }

  /** Schedules a change without rewriting past water. At the event, an abrupt
   * gas-speed change creates its own interface-pressure impulse. This idealized
   * external base-flow change is not a solved inlet or global wind budget. */
  recordAirSpeed(time: number, speed: [number, number]) {
    if (!Number.isFinite(time) || time < this.clock - 1e-12 || !speed.every(Number.isFinite)) throw Error('Invalid or past air event');
    this.events = this.events.filter(event => event.time !== time);
    this.events.push({ time, speed: [...speed] }); this.events.sort((a, b) => a.time - b.time);
  }

  advanceTo(time: number) {
    if (!Number.isFinite(time) || time < this.clock - 1e-12) throw Error('Cannot rewind sheet pressure');
    while (this.clock < time - 1e-12 && !this.failure) {
      while (this.events.length && this.events[0].time <= this.clock + 1e-12) this.changeSpeed(this.events.shift()!.speed);
      const end = Math.min(time, this.clock + this.options.dt, this.events[0]?.time ?? Infinity);
      this.step(end - this.clock); this.clock = end; this.ticks++; this.checkValidity();
    }
  }

  private changeSpeed(next: [number, number]) {
    const o = this.options, mass = o.waterDensity * o.thickness, n = o.cells;
    const deltaSum = next[0] + next[1] - this.speed[0] - this.speed[1];
    // Integrating Bernoulli across the wind step gives
    // (water mass + gas added mass) delta(w) = -rho C sum(delta(U)) eta_x.
    // Omitting it would reset gas interface velocity without its reaction on
    // the liquid. Displacement stays continuous; velocity receives the impulse.
    for (let k = 1; k < this.etaR.length; k++) {
      const coefficient = o.airDensity * this.response[k] * this.derivative[k] * deltaSum
        / (mass + 2 * o.airDensity * this.response[k]);
      const dwr = coefficient * this.etaI[k], dwi = -coefficient * this.etaR[k];
      this.wR[k] += dwr; this.wI[k] += dwi;
      for (let j = 0; j < n; j++) {
        const impulse = mass * (dwr * this.cos[k * n + j] - dwi * this.sin[k * n + j]);
        this.waterImpulse[j] += impulse; this.gasImpulse[j] -= impulse;
      }
    }
    this.speed = [...next];
  }

  // Implicit midpoint advances the coupled equations, not a stored waveform.
  // For each face, q=w+U eta_x and Bernoulli pressure contains a+2U w_x+U² eta_xx.
  // Upper/lower potential orientation changes pressure sign, never q's sign.
  private step(dt: number) {
    const o = this.options, mass = o.waterDensity * o.thickness, n = o.cells;
    this.midpointTime = this.clock + dt / 2; this.pressureAirSpeed = [...this.speed];
    const sumU = this.speed[0] + this.speed[1], sumU2 = this.speed[0] ** 2 + this.speed[1] ** 2;
    for (let k = 1; k < this.etaR.length; k++) {
      const c = this.response[k], d = this.derivative[k], l = this.lambda[k];
      const coupledMass = mass + 2 * o.airDensity * c;
      const a = (-2 * o.surfaceTension * l + o.airDensity * c * sumU2 * d * d) / coupledMass;
      const b = -2 * o.airDensity * c * sumU * d / coupledMass;
      const er = this.etaR[k], ei = this.etaI[k], wr = this.wR[k], wi = this.wI[k];
      const denR = 1 - dt * dt * a / 4, denI = -dt * b / 2;
      const numR = (1 + dt * dt * a / 4) * wr - dt * b * wi / 2 + dt * a * er;
      const numI = (1 + dt * dt * a / 4) * wi + dt * b * wr / 2 + dt * a * ei;
      const den = denR * denR + denI * denI;
      const nextWr = (numR * denR + numI * denI) / den;
      const nextWi = (numI * denR - numR * denI) / den;
      const midWr = (wr + nextWr) / 2, midWi = (wi + nextWi) / 2;
      const nextEr = er + dt * midWr, nextEi = ei + dt * midWi;
      const midEr = (er + nextEr) / 2, midEi = (ei + nextEi) / 2;
      this.midEtaR[k] = midEr; this.midEtaI[k] = midEi;
      this.midWR[k] = midWr; this.midWI[k] = midWi;
      const ar = (nextWr - wr) / dt, ai = (nextWi - wi) / dt;
      for (let face = 0; face < 2; face++) {
        const u = this.speed[face], sign = face === 0 ? 1 : -1;
        const pr = sign * o.airDensity * c * (ar - 2 * u * d * midWi - u * u * d * d * midEr);
        const pi = sign * o.airDensity * c * (ai + 2 * u * d * midWr - u * u * d * d * midEi);
        const qr = midWr - u * d * midEi, qi = midWi + u * d * midEr;
        (face === 0 ? this.pUpperR : this.pLowerR)[k] = pr;
        (face === 0 ? this.pUpperI : this.pLowerI)[k] = pi;
        (face === 0 ? this.qUpperR : this.qLowerR)[k] = qr;
        (face === 0 ? this.qUpperI : this.qLowerI)[k] = qi;
      }
      const jumpR = this.pLowerR[k] - this.pUpperR[k], jumpI = this.pLowerI[k] - this.pUpperI[k];
      const capR = -2 * o.surfaceTension * l * midEr, capI = -2 * o.surfaceTension * l * midEi;
      this.dynamicResidual = Math.max(this.dynamicResidual, Math.abs(mass * ar - jumpR - capR), Math.abs(mass * ai - jumpI - capI));
      for (let j = 0; j < n; j++) {
        const cs = this.cos[k * n + j], sn = this.sin[k * n + j];
        this.waterImpulse[j] += dt * mass * (ar * cs - ai * sn);
        this.gasImpulse[j] -= dt * (jumpR * cs - jumpI * sn);
        this.capillaryImpulse[j] += dt * (capR * cs - capI * sn);
      }
      this.etaR[k] = nextEr; this.etaI[k] = nextEi; this.wR[k] = nextWr; this.wI[k] = nextWi;
    }
    for (let j = 0; j < n; j++) this.pairResidual = Math.max(this.pairResidual,
      Math.abs(this.waterImpulse[j] + this.gasImpulse[j] - this.capillaryImpulse[j]));
  }

  private synthesize(real: Float64Array, imaginary: Float64Array) {
    const n = this.options.cells, values = new Float64Array(n);
    for (let k = 1; k < real.length; k++) for (let j = 0; j < n; j++)
      values[j] += real[k] * this.cos[k * n + j] - imaginary[k] * this.sin[k * n + j];
    return values;
  }
  private slope() {
    // Sum of modal slopes is a conservative bound, including unresolved peaks
    // between sample points. A sampled slope alone could hide a nonlinear crest.
    let slope = 0;
    for (let k = 1; k < this.etaR.length; k++) slope += 2 * Math.PI * k / this.options.length * Math.hypot(this.etaR[k], this.etaI[k]);
    return slope;
  }
  private checkValidity() {
    const slope = this.slope();
    if (!Number.isFinite(slope) || slope > this.options.maximumSlope) this.failure = 'Small-slope validity exceeded; nonlinear evolution is unsupported';
    if (this.relativeDisplacement() > this.options.maximumRelativeDisplacement)
      this.failure = 'Displacement relative to gas depth exceeded; linear fixed-interface gas solve is unsupported';
  }
  private relativeDisplacement() {
    let bound = 0;
    for (let k = 1; k < this.etaR.length; k++) bound += Math.hypot(this.etaR[k], this.etaI[k]);
    return bound / this.options.gasDepth;
  }

  snapshot(): SheetPressureSnapshot {
    const o = this.options, n = o.cells, x = new Float64Array(n), thickness = new Float64Array(n);
    const spectra: SheetPressureSnapshot['spectra'] = []; let energy = 0;
    // Thickness is a first-order sinuous-sheet assumption. Area changes are
    // second order, so this is not an exact nonlinear area-volume conservation.
    for (let j = 0; j < n; j++) { x[j] = j * o.length / n; thickness[j] = o.thickness; }
    for (let k = 1; k < this.etaR.length; k++) {
      const amplitude = Math.hypot(this.etaR[k], this.etaI[k]), velocityAmplitude = Math.hypot(this.wR[k], this.wI[k]);
      spectra.push({ mode: k, amplitude, velocityAmplitude });
      // Each gas face moves with q=w+U eta_x. Its perturbation kinetic energy
      // is present even when water normal velocity is initially zero. Only
      // zero shear conserves this positive energy; the base streams supply work.
      let gasKinetic = 0;
      for (const u of this.speed) {
        const qr = this.wR[k] - u * this.derivative[k] * this.etaI[k];
        const qi = this.wI[k] + u * this.derivative[k] * this.etaR[k];
        gasKinetic += o.airDensity * this.response[k] * (qr * qr + qi * qi);
      }
      energy += o.length / 4 * (o.waterDensity * o.thickness * velocityAmplitude ** 2 + gasKinetic
        + 2 * o.surfaceTension * this.lambda[k] * amplitude ** 2);
    }
    return { time: this.clock, x, displacement: this.synthesize(this.etaR, this.etaI), velocity: this.synthesize(this.wR, this.wI), thickness,
      pressureUpper: this.synthesize(this.pUpperR, this.pUpperI), pressureLower: this.synthesize(this.pLowerR, this.pLowerI),
      gasNormalUpper: this.synthesize(this.qUpperR, this.qUpperI), gasNormalLower: this.synthesize(this.qLowerR, this.qLowerI), spectra,
      midpointTime: this.midpointTime, midpointDisplacement: this.synthesize(this.midEtaR, this.midEtaI),
      midpointVelocity: this.synthesize(this.midWR, this.midWI), pressureAirSpeed: [...this.pressureAirSpeed],
      receipt: { maxSlope: this.slope(), relativeDisplacement: this.relativeDisplacement(), validLinear: this.failure === null, laplaceResidual: this.laplaceResidual,
        interfaceResidual: this.interfaceResidual, dynamicResidual: this.dynamicResidual, impulsePairResidual: this.pairResidual,
        waterImpulse: this.waterImpulse.slice(), gasImpulse: this.gasImpulse.slice(), capillaryImpulse: this.capillaryImpulse.slice(),
        energy, ticks: this.ticks, failure: this.failure } };
  }
}
