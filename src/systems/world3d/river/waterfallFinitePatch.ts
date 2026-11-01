/**
 * A supported finite section of liquid moves under capillary and air pressure.
 * Material segment volumes stay fixed; actual length determines thickness.
 * This isolated two-dimensional, per-unit-span experiment is not imported by
 * the native river. Endpoints follow their unperturbed continuation, with the
 * support reaction recorded. They are not massless freely retracting rims.
 *
 * Exterior air is unbounded irrotational potential flow. The continuous P1
 * potential jump has zero endpoints; its Galerkin added inertia is positive.
 * Air sees the moving centerline; thickness supplies liquid volume and inertia,
 * rather than separately resolved gas interfaces on the two liquid faces.
 * This excludes vortex transport, viscous air, finite rims, breakup, mist,
 * gravity and crest/impact pressure. Convergence and geometric validity stop
 * the run rather than clamping motion. Interface impulses are NOT a global
 * gas momentum budget. Full nonlinear energy conservation is not claimed.
 * Validity checks sample endpoint and midpoint geometry; they do not prove
 * continuous swept collision safety between those samples.
 * Opt-in refinement only divides actual material. Consistent P1 liquid mass
 * preserves its geometry, volume, momentum and kinetic energy at division;
 * gas projection energy changes remain explicit. The dense solver is bounded
 * to 129 points and is an experiment, not an established browser frame budget.
 * Bend/contact checks use declared auxiliary and averaged geometric proxies;
 * they are not pointwise curvature or exact finite-thickness tube-reach proofs.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 06/10/2026, 03:21:25
 * Dependents: None (Orphan)
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export type FiniteVec2 = [number, number];
export interface FinitePatchRefinementOptions {
  enabled: boolean; maximumSegmentLength: number; curvatureTolerance: number;
  maximumPoints: number; checkEvery: number;
}
export interface FinitePatchOptions {
  dt: number; waterDensity: number; airDensity: number; surfaceTension: number;
  ambient: FiniteVec2; quadraturePanels: number; maximumIterations: number;
  solverTolerance: number; minimumLength: number;
  /** Diagnostic h/ds threshold only; straight subdivision cannot invalidate
   * unchanged material solely because numerical ds becomes smaller than h. */
  maximumThicknessRatio: number;
  maximumCurvatureThickness: number; curvatureProbeLength: number; refinement: FinitePatchRefinementOptions;
}
export type FinitePatchConfig = Partial<Omit<FinitePatchOptions, 'refinement'>> & { refinement?: Partial<FinitePatchRefinementOptions> };
export interface FinitePatchInitial {
  points: FiniteVec2[]; velocities?: FiniteVec2[]; segmentVolumes?: number[]; thickness?: number;
  materialCoordinates?: number[]; nodeIds?: number[]; segmentRootIds?: number[];
}
export interface FinitePatchRemapReceipt {
  time: number; addedPoints: number; volumeError: number; linearMomentumError: number;
  angularMomentumError: number; liquidKineticEnergyChange: number; capillaryEnergyChange: number;
  gasInterpolationEnergyChange: number; gasProjectionEnergyChange: number; gasEnergyChange: number;
  maximumMuProjection: number; preProjectionKinematicResidual: number; postProjectionKinematicResidual: number;
}
export interface FinitePatchRefinementReceipt {
  operations: number; addedPoints: number; pointCount: number; requiredSegments: number;
  maximumLengthIndicator: number; maximumCurvatureIndicator: number;
  liquidEnergyChange: number; gasEnergyChange: number; capillaryEnergyChange: number;
  lastRemap: FinitePatchRemapReceipt | null; runtimeMs: number;
}
export interface FinitePatchReceipt {
  volume: number; minimumLength: number; minimumThickness: number; maximumThickness: number;
  maximumThicknessRatio: number; maximumCurvatureThickness: number;
  maximumAveragedCurvatureThickness: number; maximumSharpBendThickness: number;
  curvatureProbeLength: number; thicknessSpacingWarning: boolean;
  /** Pressure residual is weak momentum balance in force per unit span;
   * kinematic residual is integrated normal flux. Neither is a pointwise CFD
   * pressure/divergence norm. They apply to accepted steps only (ticks>0). */
  pressureResidual: number; kinematicResidual: number; impulseResidual: number;
  liquidImpulse: FiniteVec2; gasInterfaceImpulse: FiniteVec2; supportImpulse: FiniteVec2;
  capillaryImpulse: FiniteVec2; capillaryEnergy: number; capillaryWork: number;
  capillaryWorkResidual: number; supportWork: number; waterKineticEnergy: number;
  gasPerturbationEnergy: number; diagnosticEnergyChange: number;
  physicalDiagnosticEnergyChange: number; liquidMomentum: FiniteVec2; liquidAngularMomentum: number;
  refinement: FinitePatchRefinementReceipt;
  nonlinearResidual: number; iterations: number; maximumIterationsUsed: number;
  ticks: number; runtimeMs: number; valid: boolean; failure: string | null;
}
export interface FinitePatchSnapshot {
  time: number; positions: Float64Array; velocities: Float64Array;
  segmentVolumes: Float64Array; lengths: Float64Array; thickness: Float64Array;
  mu: Float64Array; pressure: Float64Array; pressureTime: number | null;
  /** Midpoint fields used by the last finite pressure solve. When pressureTime
   * is null (initial state or gas impulse), these fields are inapplicable. */
  pressurePositions: Float64Array; pressureVelocity: Float64Array;
  pressureMu: Float64Array; pressureMaterialDerivative: Float64Array;
  materialCoordinates: Float64Array; nodeIds: Int32Array; segmentRootIds: Int32Array;
  /** Exact P1 prolongation before the current-potential remap projection.
   * This is remap history, never the authoritative current gas solution. */
  remapInterpolatedMu: Float64Array;
  ambient: FiniteVec2; pressureAmbient: FiniteVec2; receipt: FinitePatchReceipt;
}
export interface FinitePatchOperators {
  points: number; interior: number; lengths: Float64Array; tangents: Float64Array;
  normals: Float64Array; K: Float64Array; N: Float64Array;
  basisMass: Float64Array; logKernel: Float64Array;
}

// All small dense systems are bounded by the point limit. Positive inertia is
// checked instead of repaired with a diagonal fudge or a softened kernel.
function cholesky(matrix: Float64Array, n: number) {
  const l = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let v = matrix[i * n + j];
    for (let k = 0; k < j; k++) v -= l[i * n + k] * l[j * n + k];
    if (i === j) { if (!(v > 1e-13) || !Number.isFinite(v)) throw Error('Nonpositive gas added-inertia matrix'); l[i * n + j] = Math.sqrt(v); }
    else l[i * n + j] = v / l[j * n + j];
  }
  return l;
}
function solveCholesky(l: Float64Array, rhs: Float64Array) {
  const n = rhs.length, result = rhs.slice();
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) result[i] -= l[i * n + j] * result[j];
    result[i] /= l[i * n + i];
  }
  for (let i = n - 1; i >= 0; i--) {
    for (let j = i + 1; j < n; j++) result[i] -= l[j * n + i] * result[j];
    result[i] /= l[i * n + i];
  }
  return result;
}
function solveDense(matrix: Float64Array, rhs: Float64Array) {
  const n = rhs.length, a = matrix.slice(), b = rhs.slice();
  for (let k = 0; k < n; k++) {
    let pivot = k;
    for (let j = k + 1; j < n; j++) if (Math.abs(a[j * n + k]) > Math.abs(a[pivot * n + k])) pivot = j;
    if (!Number.isFinite(a[pivot * n + k]) || Math.abs(a[pivot * n + k]) < 1e-13) throw Error('Singular coupled pressure system');
    if (pivot !== k) {
      for (let j = k; j < n; j++) [a[k * n + j], a[pivot * n + j]] = [a[pivot * n + j], a[k * n + j]];
      [b[k], b[pivot]] = [b[pivot], b[k]];
    }
    for (let i = k + 1; i < n; i++) {
      const factor = a[i * n + k] / a[k * n + k];
      for (let j = k + 1; j < n; j++) a[i * n + j] -= factor * a[k * n + j];
      b[i] -= factor * b[k];
    }
  }
  const result = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let v = b[i]; for (let j = i + 1; j < n; j++) v -= a[i * n + j] * result[j];
    result[i] = v / a[i * n + i];
  }
  return result;
}
function product(a: Float64Array, rows: number, columns: number, v: Float64Array) {
  const r = new Float64Array(rows);
  for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) r[i] += a[i * columns + j] * v[j];
  return r;
}
function adjoint(a: Float64Array, rows: number, columns: number, v: Float64Array) {
  const r = new Float64Array(columns);
  for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) r[j] += a[i * columns + j] * v[i];
  return r;
}
const gx = [-.9602898564975363, -.7966664774136267, -.525532409916329, -.1834346424956498,
  .1834346424956498, .525532409916329, .7966664774136267, .9602898564975363];
const gw = [.1012285362903763, .2223810344533745, .3137066458778873, .362683783378362,
  .362683783378362, .3137066458778873, .2223810344533745, .1012285362903763];
const tau = 2 * Math.PI;

function geometry(p: Float64Array): FinitePatchOperators {
  const n = p.length / 2, m = n - 2, s = n - 1;
  if (!Number.isInteger(n) || n < 4 || n > 129 || !p.every(Number.isFinite)) throw Error('Invalid finite patch points');
  const lengths = new Float64Array(s), tangents = new Float64Array(2 * s), normals = new Float64Array(2 * s);
  const N = new Float64Array(m * 2 * n), basisMass = new Float64Array(m * m);
  for (let panel = 0; panel < s; panel++) {
    const ex = p[2 * panel + 2] - p[2 * panel], ey = p[2 * panel + 3] - p[2 * panel + 1], length = Math.hypot(ex, ey);
    if (!(length > 1e-10)) throw Error('Collapsed liquid segment');
    lengths[panel] = length; tangents[2 * panel] = ex / length; tangents[2 * panel + 1] = ey / length;
    normals[2 * panel] = -ey / length; normals[2 * panel + 1] = ex / length;
    for (let a = 0; a < 2; a++) {
      const node = panel + a; if (node === 0 || node === n - 1) continue;
      for (let b = 0; b < 2; b++) {
        const other = panel + b, weight = length / 6 * (a === b ? 2 : 1);
        if (other > 0 && other < n - 1) basisMass[(node - 1) * m + other - 1] += weight;
        N[(node - 1) * 2 * n + 2 * other] += weight * normals[2 * panel];
        N[(node - 1) * 2 * n + 2 * other + 1] += weight * normals[2 * panel + 1];
      }
    }
  }
  return { points: n, interior: m, lengths, tangents, normals, N, basisMass,
    K: new Float64Array(m * m), logKernel: new Float64Array(s * s) };
}
// Integrate the logarithm along one straight source panel analytically. The
// remaining target integral uses an endpoint transformation to resolve the
// touching-panel logarithm; no artificial distance cutoff changes the kernel.
function logPrimitive(u: number, b: number) {
  if (b < 1e-14) return u === 0 ? 0 : u * (Math.log(Math.abs(u)) - 1);
  return .5 * u * Math.log(u * u + b * b) - u + b * Math.atan(u / b);
}
function panelLogAverage(p: Float64Array, g: FinitePatchOperators, target: number, source: number, subdivisions: number) {
  const l = g.lengths[source], tx = g.tangents[2 * source], ty = g.tangents[2 * source + 1];
  let integral = 0;
  for (let cell = 0; cell < subdivisions; cell++) for (let q = 0; q < 8; q++) {
    const u = (cell + (gx[q] + 1) / 2) / subdivisions;
    const t = (1 - Math.cos(Math.PI * u)) / 2, jacobian = Math.PI * Math.sin(Math.PI * u) / 2;
    const x = p[2 * target] + t * (p[2 * target + 2] - p[2 * target]);
    const y = p[2 * target + 1] + t * (p[2 * target + 3] - p[2 * target + 1]);
    const rx = x - p[2 * source], ry = y - p[2 * source + 1];
    const a = rx * tx + ry * ty, b = Math.abs(-rx * ty + ry * tx);
    const meanLog = (logPrimitive(l - a, b) - logPrimitive(-a, b)) / l;
    integral += gw[q] / (2 * subdivisions) * jacobian * meanLog;
  }
  return -integral / tau;
}

/** Positive weak exterior Dirichlet-to-Neumann operator for a continuous
 * potential jump with zero endpoints. Flat infinite-span limit is |k|/2,
 * so its inverse recovers the two-face added inertia 2 rhoAir / |k|. */
export function buildFinitePatchOperators(positions: Float64Array, quadraturePanels = 2): FinitePatchOperators {
  if (!Number.isInteger(quadraturePanels) || quadraturePanels < 1 || quadraturePanels > 16) throw Error('Invalid gas quadrature');
  const g = geometry(positions), s = g.points - 1, m = g.interior;
  for (let i = 0; i < s; i++) for (let j = i; j < s; j++) {
    const value = i === j ? (1.5 - Math.log(g.lengths[i])) / tau :
      .5 * (panelLogAverage(positions, g, i, j, quadraturePanels) + panelLogAverage(positions, g, j, i, quadraturePanels));
    g.logKernel[i * s + j] = value; g.logKernel[j * s + i] = value;
  }
  // B contains material potential differences on each panel. Applying its
  // exact transpose keeps the weak hypersingular operator symmetric.
  for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) g.K[i * m + j] =
    g.logKernel[i * s + j] - g.logKernel[i * s + j + 1]
    - g.logKernel[(i + 1) * s + j] + g.logKernel[(i + 1) * s + j + 1];
  cholesky(g.K, m);
  return g;
}

/** This discrete gradient changes surface energy by exactly its mechanical
 * work, even for finite deformation. It is capillarity, not edge elasticity. */
export function finitePatchSurfaceForce(old: Float64Array, next: Float64Array, sigma: number) {
  if (old.length !== next.length || sigma < 0 || !Number.isFinite(sigma)) throw Error('Invalid capillary geometry');
  const force = new Float64Array(old.length);
  for (let j = 0; j < old.length / 2 - 1; j++) {
    const ox = old[2 * j + 2] - old[2 * j], oy = old[2 * j + 3] - old[2 * j + 1];
    const nx = next[2 * j + 2] - next[2 * j], ny = next[2 * j + 3] - next[2 * j + 1];
    const denominator = Math.hypot(ox, oy) + Math.hypot(nx, ny);
    if (!(denominator > 1e-10)) throw Error('Collapsed capillary segment');
    const fx = 2 * sigma * (ox + nx) / denominator, fy = 2 * sigma * (oy + ny) / denominator;
    force[2 * j] += fx; force[2 * j + 1] += fy; force[2 * j + 2] -= fx; force[2 * j + 3] -= fy;
  }
  return force;
}

/** Initial disturbance only; nothing regenerates its sinusoid after creation. */
export function makeFinitePatchFixture(options: { points?: number; length?: number; thickness?: number; amplitude?: number;
  wavelength?: number; envelopeWidth?: number; velocity?: FiniteVec2 } = {}): FinitePatchInitial {
  const count = options.points ?? 25, length = options.length ?? 4, amplitude = options.amplitude ?? .002;
  const wavelength = options.wavelength ?? 1, envelope = options.envelopeWidth ?? .5;
  if (!Number.isInteger(count) || count < 4 || count > 129 || length <= 0 || wavelength <= 0 || envelope <= 0
    || ![length, amplitude, wavelength, envelope].every(Number.isFinite)) throw Error('Invalid fixture');
  const points: FiniteVec2[] = [], velocities: FiniteVec2[] = [];
  for (let j = 0; j < count; j++) {
    const x = length * (j / (count - 1) - .5);
    points.push([x, j === 0 || j === count - 1 ? 0 : amplitude * Math.exp(-((x / envelope) ** 2)) * Math.sin(tau * x / wavelength)]);
    velocities.push([...(options.velocity ?? [0, 0])] as FiniteVec2);
  }
  return { points, velocities, thickness: options.thickness ?? .015 };
}

// Piecewise-constant vortex strength is -mu_s. This analytical segment integral
// gives the principal-value induced mean velocity; the own straight panel has
// zero tangential contribution. It is not transported vorticity in the air.
function meanTangentialAir(p: Float64Array, g: FinitePatchOperators, mu: Float64Array, target: number, t: number, ambient: FiniteVec2) {
  const x = p[2 * target] + t * (p[2 * target + 2] - p[2 * target]);
  const y = p[2 * target + 1] + t * (p[2 * target + 3] - p[2 * target + 1]);
  let vx = ambient[0], vy = ambient[1];
  for (let j = 0; j < g.points - 1; j++) {
    if (j === target) continue;
    const tx = g.tangents[2 * j], ty = g.tangents[2 * j + 1], length = g.lengths[j];
    const rx = x - p[2 * j], ry = y - p[2 * j + 1], a = rx * tx + ry * ty, b = -rx * ty + ry * tx;
    const angle = b === 0 ? 0 : Math.atan2(b * length, b * b + a * (a - length));
    const normal = .5 * Math.log((a * a + b * b) / ((a - length) ** 2 + b * b));
    const gamma = -(mu[j + 1] - mu[j]) / length;
    vx += gamma / tau * (-angle * tx - normal * ty);
    vy += gamma / tau * (-angle * ty + normal * tx);
  }
  return vx * g.tangents[2 * target] + vy * g.tangents[2 * target + 1];
}
function convection(p: Float64Array, g: FinitePatchOperators, mu: Float64Array, velocity: Float64Array, ambient: FiniteVec2) {
  const weak = new Float64Array(g.interior);
  for (let panel = 0; panel < g.points - 1; panel++) for (let q = 0; q < 8; q++) {
    const t = (gx[q] + 1) / 2, weight = gw[q] / 2 * g.lengths[panel];
    const vx = (1 - t) * velocity[2 * panel] + t * velocity[2 * panel + 2];
    const vy = (1 - t) * velocity[2 * panel + 1] + t * velocity[2 * panel + 3];
    const relative = meanTangentialAir(p, g, mu, panel, t, ambient) - vx * g.tangents[2 * panel] - vy * g.tangents[2 * panel + 1];
    const value = relative * (mu[panel + 1] - mu[panel]) / g.lengths[panel];
    if (panel > 0) weak[panel - 1] += weight * (1 - t) * value;
    if (panel + 1 < g.points - 1) weak[panel] += weight * t * value;
  }
  return solveCholesky(cholesky(g.basisMass, g.interior), weak);
}

/** Inspect the same weak Bernoulli convection used by the evolution. Includes
 * induced air tangential velocity, not merely the prescribed ambient stream. */
export function finitePatchConvection(positions: Float64Array, velocities: Float64Array, mu: Float64Array, ambient: FiniteVec2) {
  const g = geometry(positions);
  if (velocities.length !== positions.length || mu.length !== g.points || !velocities.every(Number.isFinite)
    || !mu.every(Number.isFinite) || !ambient.every(Number.isFinite) || mu[0] !== 0 || mu[mu.length - 1] !== 0) throw Error('Invalid pressure convection state');
  const result = new Float64Array(g.points); result.set(convection(positions, g, mu, velocities, ambient), 1);
  return result;
}

function surfaceEnergy(p: Float64Array, sigma: number) {
  let length = 0; for (let j = 0; j < p.length - 2; j += 2) length += Math.hypot(p[j + 2] - p[j], p[j + 3] - p[j + 1]);
  return 2 * sigma * length;
}

/** Exact P1 liquid mass per unit span. Unlike lumping, this retains the
 * kinetic energy and angular momentum of the same linear velocity field
 * when a material segment is divided without changing its geometry. */
export function buildFinitePatchLiquidMass(segmentVolumes: Float64Array, density: number) {
  if (!segmentVolumes.every(v => Number.isFinite(v) && v > 0) || segmentVolumes.length < 3
    || segmentVolumes.length > 128 || !Number.isFinite(density) || density <= 0) throw Error('Invalid liquid material mass');
  const n = segmentVolumes.length + 1, matrix = new Float64Array(n * n);
  for (let j = 0; j < n - 1; j++) {
    const weight = density * segmentVolumes[j] / 6;
    matrix[j * n + j] += 2 * weight; matrix[(j + 1) * n + j + 1] += 2 * weight;
    matrix[j * n + j + 1] += weight; matrix[(j + 1) * n + j] += weight;
  }
  return matrix;
}
function liquidMassProduct(matrix: Float64Array, velocity: Float64Array) {
  const n = velocity.length / 2, result = new Float64Array(velocity.length);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let axis = 0; axis < 2; axis++)
    result[2 * i + axis] += matrix[i * n + j] * velocity[2 * j + axis];
  return result;
}
function liquidInvariants(p: Float64Array, v: Float64Array, mass: Float64Array) {
  const mv = liquidMassProduct(mass, v), momentum: FiniteVec2 = [0, 0];
  let angular = 0, kinetic = 0;
  for (let j = 0; j < p.length; j += 2) {
    momentum[0] += mv[j]; momentum[1] += mv[j + 1];
    angular += p[j] * mv[j + 1] - p[j + 1] * mv[j];
    kinetic += .5 * (v[j] * mv[j] + v[j + 1] * mv[j + 1]);
  }
  return { momentum, angular, kinetic };
}
function turningData(g: FinitePatchOperators) {
  const arc = new Float64Array(g.points), turn = new Float64Array(g.points);
  for (let j = 1; j < g.points; j++) arc[j] = arc[j - 1] + g.lengths[j - 1];
  for (let j = 1; j < g.points - 1; j++) {
    const cross = g.tangents[2 * j - 2] * g.tangents[2 * j + 1] - g.tangents[2 * j - 1] * g.tangents[2 * j];
    const dot = g.tangents[2 * j - 2] * g.tangents[2 * j] + g.tangents[2 * j - 1] * g.tangents[2 * j + 1];
    turn[j] = Math.abs(Math.atan2(cross, dot));
  }
  return { arc, turn };
}
// Both checks are declared geometric approximations. A P1 corner has singular
// pointwise curvature, so neither is advertised as a rigorous tube-reach bound.
// The fixed physical averaging window is independent of numerical subdivision.
// The auxiliary sharp-bend stencil ignores only collinear inserted nodes; it
// never alters actual positions or removes a physical bend from the state.
function curvatureDiagnostics(p: Float64Array, g: FinitePatchOperators, volumes: Float64Array, probe: number) {
  const thickness = g.lengths.map((l, j) => volumes[j] / l), maximumH = Math.max(...thickness);
  const { arc, turn } = turningData(g), totalLength = arc[arc.length - 1], window = Math.min(probe, totalLength);
  let maximumTurning = 0;
  for (let i = 1; i < g.points - 1; i++) if (turn[i] > 1e-10) {
    const left = Math.min(arc[i], totalLength - window); let sum = 0;
    for (let j = 1; j < g.points - 1; j++) if (arc[j] >= left - 1e-12 && arc[j] <= left + window + 1e-12) sum += turn[j];
    maximumTurning = Math.max(maximumTurning, sum);
  }
  const vertices = [0];
  for (let j = 1; j < g.points - 1; j++) if (turn[j] > 1e-10) vertices.push(j);
  vertices.push(g.points - 1); let sharp = 0;
  for (let j = 1; j < vertices.length - 1; j++) {
    const previous = vertices[j - 1], node = vertices[j], next = vertices[j + 1];
    const left = Math.hypot(p[2 * node] - p[2 * previous], p[2 * node + 1] - p[2 * previous + 1]);
    const right = Math.hypot(p[2 * next] - p[2 * node], p[2 * next + 1] - p[2 * node + 1]);
    let localH = 0; for (let k = previous; k < next; k++) localH = Math.max(localH, thickness[k]);
    // The shorter geometric side prevents a tiny bridge between long remote
    // continuations from hiding its sharp bend in a long averaged stencil.
    sharp = Math.max(sharp, turn[node] * localH / Math.min(left, right));
  }
  return { averaged: maximumH * maximumTurning / window, sharp };
}
function segmentClosest(p: Float64Array, i: number, j: number) {
  const ax = p[2 * i], ay = p[2 * i + 1], bx = p[2 * i + 2], by = p[2 * i + 3];
  const cx = p[2 * j], cy = p[2 * j + 1], dx = p[2 * j + 2], dy = p[2 * j + 3];
  const cross = (x: number, y: number, u: number, v: number) => x * v - y * u;
  const abx = bx - ax, aby = by - ay, cdx = dx - cx, cdy = dy - cy;
  const den = cross(abx, aby, cdx, cdy);
  if (Math.abs(den) > 1e-15) {
    const t = cross(cx - ax, cy - ay, cdx, cdy) / den, u = cross(cx - ax, cy - ay, abx, aby) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return { distance: 0, candidates: [{ ta: t, tb: u, distance: 0 }] };
  }
  const pointLine = (x: number, y: number, sx: number, sy: number, ex: number, ey: number) => {
    const vx = ex - sx, vy = ey - sy, t = Math.max(0, Math.min(1, ((x - sx) * vx + (y - sy) * vy) / (vx * vx + vy * vy)));
    return { t, distance: Math.hypot(x - sx - t * vx, y - sy - t * vy) };
  };
  const ac = pointLine(ax, ay, cx, cy, dx, dy), bc = pointLine(bx, by, cx, cy, dx, dy);
  const ca = pointLine(cx, cy, ax, ay, bx, by), da = pointLine(dx, dy, ax, ay, bx, by);
  const candidates = [{ ta: 0, tb: ac.t, distance: ac.distance }, { ta: 1, tb: bc.t, distance: bc.distance },
    { ta: ca.t, tb: 0, distance: ca.distance }, { ta: da.t, tb: 1, distance: da.distance }];
  // Parallel overlapping projections have a continuum of closest pairs. Its
  // endpoints and an interior representative are retained; all tied minima
  // are checked rather than selecting an arbitrary local-looking endpoint.
  const la = Math.hypot(abx, aby), lb = Math.hypot(cdx, cdy);
  if (Math.abs(den) <= 1e-12 * la * lb) {
    const start = ((cx - ax) * abx + (cy - ay) * aby) / (la * la);
    const end = ((dx - ax) * abx + (dy - ay) * aby) / (la * la);
    const lo = Math.max(0, Math.min(start, end)), hi = Math.min(1, Math.max(start, end));
    if (lo <= hi) {
      const ta = (lo + hi) / 2, projection = pointLine(ax + ta * abx, ay + ta * aby, cx, cy, dx, dy);
      candidates.push({ ta, tb: projection.t, distance: projection.distance });
    }
  }
  return { distance: Math.min(...candidates.map(c => c.distance)), candidates };
}
// Contact uses an auxiliary inventory too: exact collinear, equal-thickness
// subdivisions disappear ONLY from the checker. This prevents numerical panel
// insertion from exposing a different set of local/nonlocal closest pairs.
// The arclength/turn exclusion is a conservative declared heuristic, not exact
// tube reach. Actual simulation geometry and material history remain intact.
function contactFailure(p: Float64Array, g: FinitePatchOperators, volumes: Float64Array) {
  const { arc, turn } = turningData(g), thickness = g.lengths.map((l, j) => volumes[j] / l), vertices = [0];
  for (let j = 1; j < g.points - 1; j++) {
    const sameH = Math.abs(thickness[j - 1] - thickness[j]) <= 1e-10 * Math.max(thickness[j - 1], thickness[j]);
    if (turn[j] > 1e-10 || !sameH) vertices.push(j);
  }
  vertices.push(g.points - 1);
  const auxiliary = Float64Array.from(vertices.flatMap(j => [p[2 * j], p[2 * j + 1]]));
  for (let i = 0; i < vertices.length - 1; i++) for (let j = i + 2; j < vertices.length - 1; j++) {
    const pair = segmentClosest(auxiliary, i, j);
    if (pair.distance <= 1e-12) return 'Liquid self-contact: nonadjacent centerlines cross, touch or overlap';
    const hi = thickness[vertices[i]], hj = thickness[vertices[j]];
    if (pair.distance > .5 * (hi + hj)) continue;
    const tolerance = 1e-12 * Math.max(1, pair.distance);
    for (const candidate of pair.candidates) if (candidate.distance <= pair.distance + tolerance) {
      const si = arc[vertices[i]] + candidate.ta * (arc[vertices[i + 1]] - arc[vertices[i]]);
      const sj = arc[vertices[j]] + candidate.tb * (arc[vertices[j + 1]] - arc[vertices[j]]);
      let pathTurn = 0;
      for (let k = 1; k < g.points - 1; k++) if (arc[k] >= si - 1e-12 && arc[k] <= sj + 1e-12) pathTurn += turn[k];
      const localConnected = sj - si <= 2 * (hi + hj) && pathTurn <= Math.PI / 2 + 1e-12;
      if (!localConnected) return 'Liquid self-contact: nonlocal finite-thickness branches touch';
    }
  }
  return null;
}

export class WaterfallFinitePatch {
  readonly options: FinitePatchOptions;
  private p: Float64Array; private v: Float64Array; private mu: Float64Array;
  private volumes: Float64Array; private massMatrix: Float64Array;
  private continuation: Float64Array; private g: FinitePatchOperators;
  private materialCoordinates: Float64Array; private nodeIds: Int32Array; private segmentRootIds: Int32Array;
  private nextNodeId: number; private remapInterpolatedMu: Float64Array;
  private refinementOperations = 0; private addedPoints = 0;
  private refinementRuntime = 0;
  private remapLiquidEnergy = 0; private remapGasEnergy = 0; private remapCapillaryEnergy = 0;
  private lastRemap: FinitePatchRemapReceipt | null = null;
  private ambient: FiniteVec2; private pressureAmbient: FiniteVec2;
  private pressure: Float64Array; private pressureTime: number | null = null;
  private pressurePositions: Float64Array; private pressureVelocity: Float64Array;
  private pressureMu: Float64Array; private pressureMaterialDerivative: Float64Array;
  private clock = 0; private events: { time: number; ambient: FiniteVec2 }[] = [];
  private ticks = 0; private runtime = 0; private iterations = 0; private maximumIterationsUsed = 0;
  private failure: string | null = null; private nonlinearResidual = 0; private pressureResidual = 0;
  private kinematicResidual = 0; private impulseResidual = 0;
  private liquidImpulse: FiniteVec2 = [0, 0]; private gasImpulse: FiniteVec2 = [0, 0];
  private supportImpulse: FiniteVec2 = [0, 0]; private capillaryImpulse: FiniteVec2 = [0, 0];
  private capillaryWork = 0; private capillaryWorkResidual = 0; private supportWork = 0;
  private initialEnergy = 0;

  constructor(options: FinitePatchConfig = {}, initial: FinitePatchInitial = makeFinitePatchFixture()) {
    this.options = { dt: .002, waterDensity: 1000, airDensity: 1.2, surfaceTension: .072,
      ambient: [0, 0], quadraturePanels: 2, maximumIterations: 16, solverTolerance: 1e-9,
      minimumLength: 1e-5, maximumThicknessRatio: .4, maximumCurvatureThickness: .2, curvatureProbeLength: .02, ...options,
      refinement: { enabled: false, maximumSegmentLength: .125, curvatureTolerance: .001,
        maximumPoints: 65, checkEvery: 1, ...options.refinement } };
    const o = this.options;
    if (![o.dt, o.waterDensity, o.airDensity, o.surfaceTension, o.maximumIterations, o.solverTolerance,
      o.minimumLength, o.maximumThicknessRatio, o.maximumCurvatureThickness, o.curvatureProbeLength, ...o.ambient].every(Number.isFinite)
      || o.dt <= 0 || o.waterDensity <= 0 || o.airDensity < 0 || o.surfaceTension < 0
      || !Number.isInteger(o.maximumIterations) || o.maximumIterations < 2 || o.maximumIterations > 100
      || o.solverTolerance <= 0 || o.minimumLength <= 0 || o.maximumThicknessRatio <= 0
      || o.maximumCurvatureThickness <= 0 || o.curvatureProbeLength <= 0) throw Error('Invalid finite patch options');
    const r = o.refinement;
    if (![r.maximumSegmentLength, r.curvatureTolerance, r.maximumPoints, r.checkEvery].every(Number.isFinite)
      || r.maximumSegmentLength <= 0 || r.curvatureTolerance <= 0 || !Number.isInteger(r.maximumPoints)
      || r.maximumPoints < 4 || r.maximumPoints > 129 || !Number.isInteger(r.checkEvery) || r.checkEvery < 1)
      throw Error('Invalid bounded refinement options');
    if (!initial.points.every(point => point.length === 2) || initial.velocities?.some(velocity => velocity.length !== 2)) throw Error('Expected two-dimensional material points and velocities');
    this.p = new Float64Array(initial.points.flat()); this.g = geometry(this.p);
    if (r.enabled && this.g.points > r.maximumPoints) throw Error('Initial material grid exceeds the configured refinement point limit');
    this.v = new Float64Array((initial.velocities ?? initial.points.map(() => [0, 0])).flat());
    if (this.v.length !== this.p.length || !this.v.every(Number.isFinite)) throw Error('Invalid material velocities');
    this.continuation = this.v.slice();
    this.volumes = new Float64Array(initial.segmentVolumes ?? Array.from(this.g.lengths, l => l * (initial.thickness ?? .015)));
    if (this.volumes.length !== this.g.lengths.length || !this.volumes.every(v => Number.isFinite(v) && v > 0)) throw Error('Invalid liquid segment volumes');
    this.massMatrix = buildFinitePatchLiquidMass(this.volumes, o.waterDensity);
    const totalVolume = this.volumes.reduce((sum, v) => sum + v, 0);
    this.materialCoordinates = new Float64Array(this.g.points);
    for (let j = 1; j < this.g.points; j++) this.materialCoordinates[j] = this.materialCoordinates[j - 1] + this.volumes[j - 1] / totalVolume;
    if (initial.materialCoordinates) this.materialCoordinates = new Float64Array(initial.materialCoordinates);
    if (this.materialCoordinates.length !== this.g.points || !this.materialCoordinates.every(Number.isFinite)
      || this.materialCoordinates.some((v, j) => j > 0 && v <= this.materialCoordinates[j - 1])) throw Error('Invalid material coordinates');
    this.nodeIds = new Int32Array(initial.nodeIds ?? Array.from({ length: this.g.points }, (_, j) => j));
    this.segmentRootIds = new Int32Array(initial.segmentRootIds ?? Array.from({ length: this.volumes.length }, (_, j) => j));
    if (this.nodeIds.length !== this.g.points || new Set(this.nodeIds).size !== this.g.points
      || this.nodeIds.some(id => id < 0) || this.segmentRootIds.length !== this.volumes.length) throw Error('Invalid material identifiers');
    this.nextNodeId = Math.max(...this.nodeIds) + 1;
    this.ambient = [...o.ambient]; this.pressureAmbient = [...o.ambient];
    this.mu = new Float64Array(this.g.points); this.pressure = new Float64Array(this.g.points);
    this.remapInterpolatedMu = this.mu.slice();
    this.pressurePositions = this.p.slice(); this.pressureVelocity = this.v.slice();
    this.pressureMu = this.mu.slice(); this.pressureMaterialDerivative = this.mu.slice();
    this.failure = this.validity(this.p, this.g);
    if (!this.failure) { this.g = buildFinitePatchOperators(this.p, o.quadraturePanels); this.mu = this.potential(this.g, this.v, this.ambient); }
    this.initialEnergy = this.energy().total;
  }
  recordAmbient(time: number, ambient: FiniteVec2) {
    if (!Number.isFinite(time) || time < this.clock - 1e-12 || !ambient.every(Number.isFinite)) throw Error('Invalid or past ambient event');
    this.events = this.events.filter(e => e.time !== time); this.events.push({ time, ambient: [...ambient] });
    this.events.sort((a, b) => a.time - b.time);
  }

  private resolutionIndicators() {
    const r = this.options.refinement, curvature = new Float64Array(this.volumes.length);
    for (let j = 1; j < this.g.points - 1; j++) {
      const cross = this.g.tangents[2 * j - 2] * this.g.tangents[2 * j + 1] - this.g.tangents[2 * j - 1] * this.g.tangents[2 * j];
      const dot = this.g.tangents[2 * j - 2] * this.g.tangents[2 * j] + this.g.tangents[2 * j - 1] * this.g.tangents[2 * j + 1];
      const estimate = Math.abs(Math.atan2(cross, dot)) / (.5 * (this.g.lengths[j - 1] + this.g.lengths[j]));
      curvature[j - 1] = Math.max(curvature[j - 1], estimate); curvature[j] = Math.max(curvature[j], estimate);
    }
    const segments: number[] = []; let maximumLength = 0, maximumCurvature = 0;
    for (let j = 0; j < this.volumes.length; j++) {
      const lengthIndicator = this.g.lengths[j] / r.maximumSegmentLength;
      // This is a conservative local sagitta estimate, not a proof of the
      // unresolved smooth curve. Splitting inserts no smoothed target geometry.
      const curvatureIndicator = curvature[j] * this.g.lengths[j] ** 2 / (8 * r.curvatureTolerance);
      maximumLength = Math.max(maximumLength, lengthIndicator); maximumCurvature = Math.max(maximumCurvature, curvatureIndicator);
      if (lengthIndicator > 1 + 1e-10 || curvatureIndicator > 1 + 1e-10) segments.push(j);
    }
    return { segments, maximumLength, maximumCurvature };
  }
  private refineForResolution() {
    for (;;) {
      const requested = this.resolutionIndicators().segments;
      if (!requested.length) return;
      this.refineSegments(requested);
    }
  }

  /** Divide actual material, without changing its P1 geometry or velocity.
   * The consistent liquid mass preserves P/L/KE. CURRENT gas potential is
   * projected into the enriched constraint space; its signed energy jump is
   * remap-only, not a pressure impulse or a physical step. Raw prolonged mu
   * and the previous pressure history remain available but are not current.
   * Failure is atomic; no partial split is accepted. */
  refineSegments(segments: number[]): FinitePatchRemapReceipt | null {
    if (this.failure) throw Error('Cannot refine an invalid finite patch');
    const requested = new Set(segments), oldCount = this.g.points;
    if (requested.size !== segments.length || segments.some(j => !Number.isInteger(j) || j < 0 || j >= oldCount - 1)) throw Error('Invalid refinement segments');
    if (!requested.size) return null;
    if (oldCount + requested.size > this.options.refinement.maximumPoints) throw Error('Material refinement point limit reached before requested resolution');
    const start = performance.now();
    try {
      const beforeEnergy = this.energy(), beforeLiquid = liquidInvariants(this.p, this.v, this.massMatrix);
      const prolong = (field: Float64Array, width: number) => {
        const result = new Float64Array((oldCount + requested.size) * width); let index = 0;
        for (let node = 0; node < oldCount; node++) {
          for (let axis = 0; axis < width; axis++) result[index * width + axis] = field[node * width + axis];
          index++;
          if (requested.has(node)) {
            for (let axis = 0; axis < width; axis++) result[index * width + axis] = .5 * (field[node * width + axis] + field[(node + 1) * width + axis]);
            index++;
          }
        }
        return result;
      };
      const p = prolong(this.p, 2), v = prolong(this.v, 2), rawMu = prolong(this.mu, 1);
      const volumeList: number[] = [], rootList: number[] = [], idList: number[] = []; let nextId = this.nextNodeId;
      for (let j = 0; j < oldCount; j++) {
        idList.push(this.nodeIds[j]); if (requested.has(j)) idList.push(nextId++);
        if (j < oldCount - 1) {
          const pieces = requested.has(j) ? 2 : 1;
          for (let k = 0; k < pieces; k++) { volumeList.push(this.volumes[j] / pieces); rootList.push(this.segmentRootIds[j]); }
        }
      }
      const volumes = new Float64Array(volumeList), basic = geometry(p), failure = this.validity(p, basic, volumes);
      if (failure) throw Error('Refinement cannot resolve material: ' + failure);
      const g = buildFinitePatchOperators(p, this.options.quadraturePanels), mass = buildFinitePatchLiquidMass(volumes, this.options.waterDensity);
      const projectedMu = this.potential(g, v, this.ambient), afterLiquid = liquidInvariants(p, v, mass);
      const gasEnergy = (mu: Float64Array) => {
        const values = mu.slice(1, -1), response = product(g.K, g.interior, g.interior, values);
        return .5 * this.options.airDensity * values.reduce((sum, value, j) => sum + value * response[j], 0);
      };
      const rawGas = gasEnergy(rawMu), projectedGas = gasEnergy(projectedMu);
      const relative = v.map((value, j) => value - this.ambient[j % 2]), flux = product(g.N, g.interior, v.length, relative);
      const rawResponse = product(g.K, g.interior, g.interior, rawMu.slice(1, -1));
      const projectedResponse = product(g.K, g.interior, g.interior, projectedMu.slice(1, -1));
      let preResidual = 0, postResidual = 0, maximumMuProjection = 0;
      for (let j = 0; j < g.interior; j++) {
        preResidual = Math.max(preResidual, Math.abs(rawResponse[j] + flux[j]));
        postResidual = Math.max(postResidual, Math.abs(projectedResponse[j] + flux[j]));
        maximumMuProjection = Math.max(maximumMuProjection, Math.abs(projectedMu[j + 1] - rawMu[j + 1]));
      }
      if (!projectedMu.every(Number.isFinite) || postResidual > 1e-9 * Math.max(1, ...flux.map(Math.abs)))
        throw Error('Refinement gas projection failed the enriched kinematic constraint');
      const remap: FinitePatchRemapReceipt = {
        time: this.clock, addedPoints: requested.size,
        volumeError: volumes.reduce((sum, value) => sum + value, 0) - this.volumes.reduce((sum, value) => sum + value, 0),
        linearMomentumError: Math.hypot(afterLiquid.momentum[0] - beforeLiquid.momentum[0], afterLiquid.momentum[1] - beforeLiquid.momentum[1]),
        angularMomentumError: afterLiquid.angular - beforeLiquid.angular,
        liquidKineticEnergyChange: afterLiquid.kinetic - beforeLiquid.kinetic,
        capillaryEnergyChange: surfaceEnergy(p, this.options.surfaceTension) - beforeEnergy.capillary,
        gasInterpolationEnergyChange: rawGas - beforeEnergy.gas,
        gasProjectionEnergyChange: projectedGas - rawGas, gasEnergyChange: projectedGas - beforeEnergy.gas,
        maximumMuProjection, preProjectionKinematicResidual: preResidual, postProjectionKinematicResidual: postResidual,
      };
      // Complete all checks before the atomic state replacement. The historical
      // pressure fields are prolonged exactly but lose their current-time tag.
      this.pressure = prolong(this.pressure, 1); this.pressurePositions = prolong(this.pressurePositions, 2);
      this.pressureVelocity = prolong(this.pressureVelocity, 2); this.pressureMu = prolong(this.pressureMu, 1);
      this.pressureMaterialDerivative = prolong(this.pressureMaterialDerivative, 1);
      this.continuation = prolong(this.continuation, 2); this.materialCoordinates = prolong(this.materialCoordinates, 1);
      this.nodeIds = new Int32Array(idList); this.segmentRootIds = new Int32Array(rootList); this.nextNodeId = nextId;
      this.p = p; this.v = v; this.mu = projectedMu; this.volumes = volumes; this.massMatrix = mass; this.g = g;
      this.remapInterpolatedMu = rawMu; this.pressureTime = null;
      this.lastRemap = remap; this.refinementOperations++; this.addedPoints += requested.size;
      this.remapLiquidEnergy += remap.liquidKineticEnergyChange; this.remapGasEnergy += remap.gasEnergyChange; this.remapCapillaryEnergy += remap.capillaryEnergyChange;
      return remap;
    } finally { this.refinementRuntime += performance.now() - start; }
  }
  advanceTo(time: number) {
    if (!Number.isFinite(time) || time < this.clock - 1e-12) throw Error('Cannot rewind finite patch');
    const start = performance.now();
    try {
      while (!this.failure) {
        while (this.events.length && this.events[0].time <= this.clock + 1e-12) this.ambientEvent(this.events.shift()!.ambient);
        if (this.clock >= time - 1e-12) break;
        if (this.options.refinement.enabled && this.ticks % this.options.refinement.checkEvery === 0) this.refineForResolution();
        const dt = Math.min(this.options.dt, time - this.clock, (this.events[0]?.time ?? Infinity) - this.clock);
        this.step(dt);
      }
    } catch (error) { this.failure = error instanceof Error ? error.message : String(error); }
    this.runtime += performance.now() - start;
  }

  private potential(g: FinitePatchOperators, v: Float64Array, ambient: FiniteVec2) {
    const relative = v.slice(); for (let j = 0; j < relative.length; j++) relative[j] -= ambient[j % 2];
    const rhs = product(g.N, g.interior, v.length, relative).map(x => -x);
    const interior = solveCholesky(cholesky(g.K, g.interior), rhs), result = new Float64Array(g.points);
    result.set(interior, 1); return result;
  }

  // The velocity system includes the endpoint kinematic constraint and its
  // adjoint pressure impulse. Only interior velocities are unknown; supports
  // supply exactly the force required by prescribed endpoint continuation.
  private coupledVelocity(gNew: FinitePatchOperators, gMid: FinitePatchOperators, oldV: Float64Array,
    oldMu: Float64Array, capillary: Float64Array, conv: Float64Array, dt: number, ambient: FiniteVec2) {
    const n = gNew.points, m = gNew.interior, d = 2 * m, full = 2 * n, rho = this.options.airDensity;
    const factor = cholesky(gNew.K, m), inverseN = new Float64Array(m * d);
    for (let col = 0; col < d; col++) {
      const rhs = new Float64Array(m);
      for (let i = 0; i < m; i++) rhs[i] = gNew.N[i * full + col + 2];
      const solution = solveCholesky(factor, rhs);
      for (let i = 0; i < m; i++) inverseN[i * d + col] = solution[i];
    }
    const prescribed = new Float64Array(full);
    prescribed[0] = this.continuation[0]; prescribed[1] = this.continuation[1];
    prescribed[full - 2] = this.continuation[full - 2]; prescribed[full - 1] = this.continuation[full - 1];
    for (let j = 0; j < full; j++) prescribed[j] = ambient[j % 2] - prescribed[j];
    const affine = solveCholesky(factor, product(gNew.N, m, full, prescribed));
    const matrix = new Float64Array(d * d), rhs = new Float64Array(d);
    for (let i = 0; i < d; i++) {
      const node = 1 + Math.floor(i / 2), axis = i % 2;
      rhs[i] = dt * capillary[i + 2];
      // Boundary velocities are prescribed and unchanged, so their full mass
      // terms cancel on the interior RHS. Boundary momentum rows are retained
      // when recording support reactions below.
      for (let j = 0; j < d; j++) if (j % 2 === axis) {
        const mass = this.massMatrix[node * n + 1 + Math.floor(j / 2)];
        matrix[i * d + j] = mass; rhs[i] += mass * oldV[j + 2];
      }
      for (let k = 0; k < m; k++) {
        const transfer = rho * gMid.N[k * full + i + 2];
        rhs[i] += transfer * (affine[k] - oldMu[k + 1] + dt * conv[k]);
        for (let j = 0; j < d; j++) matrix[i * d + j] += transfer * inverseN[k * d + j];
      }
    }
    const interior = solveDense(matrix, rhs), velocity = this.continuation.slice();
    velocity.set(interior, 2);
    return velocity;
  }

  private ambientEvent(ambient: FiniteVec2) {
    if (ambient[0] === this.ambient[0] && ambient[1] === this.ambient[1]) return;
    const oldV = this.v, oldMu = this.mu;
    const nextV = this.coupledVelocity(this.g, this.g, oldV, oldMu, new Float64Array(this.p.length), new Float64Array(this.g.interior), 0, ambient);
    const nextMu = this.potential(this.g, nextV, ambient);
    const jump = nextMu.slice(1, -1).map((value, j) => this.options.airDensity * (value - oldMu[j + 1]));
    const impulse = adjoint(this.g.N, this.g.interior, this.p.length, jump);
    this.account(oldV, nextV, impulse, new Float64Array(this.p.length));
    this.v = nextV; this.mu = nextMu; this.ambient = [...ambient];
    // An instantaneous pressure impulse has no finite pressure/time receipt.
    this.pressureTime = null; this.pressure.fill(0); this.pressureAmbient = [...ambient];
  }

  private step(dt: number) {
    const oldP = this.p, oldV = this.v, oldMu = this.mu, n = this.g.points;
    let guessV = oldV.slice(), finalP = oldP, finalV = oldV, finalMu = oldMu;
    let finalG = this.g, finalMid = this.g, finalCap = new Float64Array(oldP.length), finalPressure = new Float64Array(n - 2);
    let converged = false;
    for (let iteration = 1; iteration <= this.options.maximumIterations; iteration++) {
      const nextP = oldP.map((value, j) => value + dt / 2 * (oldV[j] + guessV[j]));
      const midP = oldP.map((value, j) => (value + nextP[j]) / 2);
      const basic = geometry(nextP), failure = this.validity(nextP, basic);
      if (failure) throw Error(failure);
      const gMid = geometry(midP), midpointFailure = this.validity(midP, gMid);
      if (midpointFailure) throw Error('Pressure midpoint: ' + midpointFailure);
      const gNew = buildFinitePatchOperators(nextP, this.options.quadraturePanels);
      const guessedMu = this.potential(gNew, guessV, this.ambient);
      const midMu = oldMu.map((value, j) => (value + guessedMu[j]) / 2);
      const midV = oldV.map((value, j) => (value + guessV[j]) / 2);
      const cap = finitePatchSurfaceForce(oldP, nextP, this.options.surfaceTension);
      const conv = this.options.airDensity === 0 ? new Float64Array(n - 2) : convection(midP, gMid, midMu, midV, this.ambient);
      const solvedV = this.coupledVelocity(gNew, gMid, oldV, oldMu, cap, conv, dt, this.ambient);
      let residual = 0; for (let j = 0; j < solvedV.length; j++) residual = Math.max(residual, Math.abs(solvedV[j] - guessV[j]));
      this.nonlinearResidual = residual; this.iterations = iteration; this.maximumIterationsUsed = Math.max(this.maximumIterationsUsed, iteration);
      if (residual <= this.options.solverTolerance) {
        // Retain the geometry used in the converged equations. The displacement
        // defect is bounded by dt/2 times the reported nonlinear residual.
        finalP = nextP; finalV = solvedV; finalMu = this.potential(gNew, solvedV, this.ambient);
        finalG = gNew; finalMid = gMid; finalCap = cap;
        for (let j = 0; j < n - 2; j++) finalPressure[j] = this.options.airDensity * ((finalMu[j + 1] - oldMu[j + 1]) / dt + conv[j]);
        converged = true; break;
      }
      guessV = solvedV;
    }
    if (!converged) throw Error('Finite-geometry pressure iteration did not converge; state not clamped');
    const pressureImpulse = adjoint(finalMid.N, n - 2, 2 * n, finalPressure).map(value => value * dt);
    const capImpulse = finalCap.map(value => value * dt), displacement = finalP.map((value, j) => value - oldP[j]);
    let capWork = 0;
    for (let j = 0; j < displacement.length; j++) capWork += finalCap[j] * displacement[j];
    const energyChange = surfaceEnergy(finalP, this.options.surfaceTension) - surfaceEnergy(oldP, this.options.surfaceTension);
    this.capillaryWork += capWork; this.capillaryWorkResidual = Math.max(this.capillaryWorkResidual, Math.abs(capWork + energyChange));
    this.account(oldV, finalV, pressureImpulse, capImpulse);
    const relative = finalV.map((value, j) => value - this.ambient[j % 2]);
    const constraint = product(finalG.N, n - 2, 2 * n, relative);
    const kmu = product(finalG.K, n - 2, n - 2, finalMu.slice(1, -1));
    for (let j = 0; j < n - 2; j++) this.kinematicResidual = Math.max(this.kinematicResidual, Math.abs(kmu[j] + constraint[j]));
    const momentumChange = liquidMassProduct(this.massMatrix, finalV.map((value, j) => value - oldV[j]));
    for (let j = 2; j < 2 * n - 2; j++) this.pressureResidual = Math.max(this.pressureResidual,
      Math.abs(momentumChange[j] - pressureImpulse[j] - capImpulse[j]) / dt);
    this.p = finalP; this.v = finalV; this.mu = finalMu; this.g = finalG;
    this.pressurePositions = oldP.map((value, j) => (value + finalP[j]) / 2);
    this.pressureVelocity = oldV.map((value, j) => (value + finalV[j]) / 2);
    this.pressureMu = oldMu.map((value, j) => (value + finalMu[j]) / 2);
    this.pressureMaterialDerivative = oldMu.map((value, j) => (finalMu[j] - value) / dt);
    this.pressure.fill(0); this.pressure.set(finalPressure, 1); this.pressureTime = this.clock + dt / 2;
    this.pressureAmbient = [...this.ambient]; this.clock += dt; this.ticks++;
  }

  private account(oldV: Float64Array, nextV: Float64Array, pressureImpulse: Float64Array, capImpulse: Float64Array) {
    const change = liquidMassProduct(this.massMatrix, nextV.map((value, j) => value - oldV[j]));
    for (let j = 0; j < this.p.length; j++) {
      const axis = j % 2, liquid = change[j];
      const endpoint = j < 2 || j >= this.p.length - 2;
      const support = endpoint ? liquid - pressureImpulse[j] - capImpulse[j] : 0;
      this.liquidImpulse[axis] += liquid; this.gasImpulse[axis] -= pressureImpulse[j];
      this.capillaryImpulse[axis] += capImpulse[j]; this.supportImpulse[axis] += support;
      this.supportWork += support * (endpoint ? this.continuation[j] : 0);
    }
    for (let axis = 0; axis < 2; axis++) this.impulseResidual = Math.max(this.impulseResidual,
      Math.abs(this.liquidImpulse[axis] + this.gasImpulse[axis] - this.capillaryImpulse[axis] - this.supportImpulse[axis]));
  }

  private validity(p: Float64Array, g: FinitePatchOperators, volumes = this.volumes) {
    if (!p.every(Number.isFinite)) return 'Nonfinite liquid geometry';
    for (let j = 0; j < g.lengths.length; j++) {
      if (g.lengths[j] < this.options.minimumLength) return 'Collapsed or unresolved liquid segment';
      // h/ds is retained as telemetry. Numerical subdivision can make ds<h
      // without changing any physical thickness, bend or contact geometry.
      if (j > 0) {
        const cross = g.tangents[2 * j - 2] * g.tangents[2 * j + 1] - g.tangents[2 * j - 1] * g.tangents[2 * j];
        const dot = g.tangents[2 * j - 2] * g.tangents[2 * j] + g.tangents[2 * j - 1] * g.tangents[2 * j + 1];
        // Adjacent panels normally share one endpoint. Collinear reversal
        // instead overlaps a finite interval, even when thinness makes the
        // curvature check look harmless; that already requires new topology.
        if (dot < 0 && Math.abs(cross) < 1e-10) return 'Adjacent liquid panels overlap or backtrack';
      }
    }
    const contact = contactFailure(p, g, volumes); if (contact) return contact;
    const curvature = curvatureDiagnostics(p, g, volumes, this.options.curvatureProbeLength);
    if (Math.max(curvature.averaged, curvature.sharp) > this.options.maximumCurvatureThickness)
      return 'Liquid bend exceeds the declared averaged or auxiliary sharp-bend thickness guard';
    return null;
  }
  private energy() {
    const water = liquidInvariants(this.p, this.v, this.massMatrix).kinetic;
    const interior = this.mu.slice(1, -1), kmu = product(this.g.K, this.g.interior, this.g.interior, interior);
    let gas = 0; for (let j = 0; j < interior.length; j++) gas += .5 * this.options.airDensity * interior[j] * kmu[j];
    const capillary = surfaceEnergy(this.p, this.options.surfaceTension);
    return { water, gas, capillary, total: water + gas + capillary };
  }
  snapshot(): FinitePatchSnapshot {
    const thickness = this.g.lengths.map((l, j) => this.volumes[j] / l), energy = this.energy();
    const liquid = liquidInvariants(this.p, this.v, this.massMatrix), resolution = this.resolutionIndicators();
    let ratio = 0;
    for (let j = 0; j < thickness.length; j++) {
      ratio = Math.max(ratio, thickness[j] / this.g.lengths[j]);
    }
    const curvature = curvatureDiagnostics(this.p, this.g, this.volumes, this.options.curvatureProbeLength);
    return { time: this.clock, positions: this.p.slice(), velocities: this.v.slice(), segmentVolumes: this.volumes.slice(),
      lengths: this.g.lengths.slice(), thickness, mu: this.mu.slice(), pressure: this.pressure.slice(), pressureTime: this.pressureTime,
      pressurePositions: this.pressurePositions.slice(), pressureVelocity: this.pressureVelocity.slice(),
      pressureMu: this.pressureMu.slice(), pressureMaterialDerivative: this.pressureMaterialDerivative.slice(),
      materialCoordinates: this.materialCoordinates.slice(), nodeIds: this.nodeIds.slice(), segmentRootIds: this.segmentRootIds.slice(),
      remapInterpolatedMu: this.remapInterpolatedMu.slice(),
      ambient: [...this.ambient], pressureAmbient: [...this.pressureAmbient], receipt: {
        volume: this.volumes.reduce((sum, v) => sum + v, 0), minimumLength: Math.min(...this.g.lengths), minimumThickness: Math.min(...thickness), maximumThickness: Math.max(...thickness),
        maximumThicknessRatio: ratio, maximumCurvatureThickness: Math.max(curvature.averaged, curvature.sharp),
        maximumAveragedCurvatureThickness: curvature.averaged, maximumSharpBendThickness: curvature.sharp,
        curvatureProbeLength: this.options.curvatureProbeLength, thicknessSpacingWarning: ratio > this.options.maximumThicknessRatio,
        pressureResidual: this.pressureResidual, kinematicResidual: this.kinematicResidual,
        impulseResidual: this.impulseResidual, liquidImpulse: [...this.liquidImpulse], gasInterfaceImpulse: [...this.gasImpulse], supportImpulse: [...this.supportImpulse],
        capillaryImpulse: [...this.capillaryImpulse], capillaryEnergy: energy.capillary, capillaryWork: this.capillaryWork,
        capillaryWorkResidual: this.capillaryWorkResidual, supportWork: this.supportWork, waterKineticEnergy: energy.water,
        gasPerturbationEnergy: energy.gas, diagnosticEnergyChange: energy.total - this.initialEnergy,
        physicalDiagnosticEnergyChange: energy.total - this.initialEnergy - this.remapLiquidEnergy - this.remapGasEnergy - this.remapCapillaryEnergy,
        liquidMomentum: liquid.momentum, liquidAngularMomentum: liquid.angular,
        refinement: { operations: this.refinementOperations, addedPoints: this.addedPoints, pointCount: this.g.points,
          requiredSegments: resolution.segments.length, maximumLengthIndicator: resolution.maximumLength,
          maximumCurvatureIndicator: resolution.maximumCurvature, liquidEnergyChange: this.remapLiquidEnergy,
          gasEnergyChange: this.remapGasEnergy, capillaryEnergyChange: this.remapCapillaryEnergy,
          lastRemap: this.lastRemap ? { ...this.lastRemap } : null, runtimeMs: this.refinementRuntime },
        nonlinearResidual: this.nonlinearResidual, iterations: this.iterations, maximumIterationsUsed: this.maximumIterationsUsed,
        ticks: this.ticks, runtimeMs: this.runtime, valid: this.failure === null, failure: this.failure } };
  }
}
