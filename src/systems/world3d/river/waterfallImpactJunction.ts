/**
 * Calculates two separate wall streams when a coherent water curtain hits a rock.
 * This compact, inviscid turning model redirects normal motion through pressure;
 * it does not resolve the stagnation region, submerged impact, air or splashing.
 * The caller must supply measured arriving flux and energy at the actual impact
 * bed, then transport the two ports separately. Geometry and film coupling live
 * elsewhere; this helper alone is not evidence that a native waterfall is valid.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/10/2026, 00:21:37
 * Dependents: systems/world3d/river/waterfallContactFlow.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export interface WaterfallImpactJunctionInput {
  /** Actual arriving volume rate per unit curtain span, m²/s. */
  q: number;
  /** Velocity along the curtain span, m/s; conserved through both ports. */
  ve: number;
  /** Signed incoming velocity along the plus-port tangent, m/s. */
  vt: number;
  /** Incoming velocity along the wall's outward normal, m/s; negative for impact. */
  vn: number;
  /** Gravity into the wall, m/s²; must be positive. */
  gn: number;
  /** Incoming specific mechanical energy relative to the junction bed, m²/s²,
   * excluding ve²/2. Includes actual incoming potential relative to that bed. */
  H: number;
  /** Defaults to 1, yielding balances per unit density. */
  density?: number;
  /** Multipliers for integrated receipts; default to a unit span and unit time. */
  span?: number;
  duration?: number;
}

export interface WaterfallImpactPort {
  q: number;
  h: number;
  /** Positive speed away from impact; minus port has tangent velocity -s. */
  s: number;
  ve: number;
}

export interface ImpactBalance {
  incoming: number;
  outgoing: number;
  /** Outgoing minus incoming; a roundoff diagnostic, never invented dissipation. */
  residual: number;
}

export interface WaterfallImpactBalances {
  /** Mass rate per span (flux) or mass (integrated). */
  mass: ImpactBalance;
  /** Includes hydrostatic pressure traction, unlike advected particle momentum. */
  tangentialMomentum: ImpactBalance;
  spanwiseMomentum: ImpactBalance;
  /** Includes pressure work at the ports; measured relative to the junction bed. */
  mechanicalEnergy: ImpactBalance;
  /** Velocity-only kinetic transport; its difference is NOT numerical loss. */
  particleKineticEnergy: ImpactBalance;
  /** Signed outward force on liquid per span, or its integrated impulse.
   * Uses actual vn, not an equivalent velocity inferred from incoming head. */
  normalReaction: number;
}

export type WaterfallImpactFailureReason =
  | 'invalid-input' | 'capacity-exceeded' | 'no-momentum-bracket'
  | 'critical-port' | 'numerical-failure';

export type WaterfallImpactJunctionResult = {
  ok: true;
  plus: WaterfallImpactPort;
  minus: WaterfallImpactPort;
  flux: WaterfallImpactBalances;
  integrated: WaterfallImpactBalances;
  /** Actual incoming potential relative to the junction bed, after removing
   * velocity-only perpendicular kinetic energy. May be signed. */
  incomingPotentialRelativeToBed: number;
  criticalDepth: number;
  criticalFlux: number;
  iterations: number;
} | { ok: false; reason: WaterfallImpactFailureReason; message: string };

// Both depth and split searches have a hard work bound. Midpoint stagnation ends
// a solve earlier; no branch switch or fitted head loss rescues invalid physics.
const ITERATION_LIMIT = 64;
const RESIDUAL_TOLERANCE = 1e-10;

function balance(incoming: number, outgoing: number): ImpactBalance {
  return { incoming, outgoing, residual: outgoing - incoming };
}

function scaledBalances(value: WaterfallImpactBalances, scale: number): WaterfallImpactBalances {
  const scaled = (b: ImpactBalance): ImpactBalance => ({
    incoming: b.incoming * scale, outgoing: b.outgoing * scale, residual: b.residual * scale,
  });
  return {
    mass: scaled(value.mass), tangentialMomentum: scaled(value.tangentialMomentum),
    spanwiseMomentum: scaled(value.spanwiseMomentum), mechanicalEnergy: scaled(value.mechanicalEnergy),
    particleKineticEnergy: scaled(value.particleKineticEnergy), normalReaction: value.normalReaction * scale,
  };
}

/** Solve only the shallow supercritical two-port branch of planar impingement. */
export function solveWaterfallImpactJunction(input: WaterfallImpactJunctionInput): WaterfallImpactJunctionResult {
  const { q, ve, vt, vn, gn, H } = input;
  const density = input.density ?? 1, span = input.span ?? 1, duration = input.duration ?? 1;
  const fail = (reason: WaterfallImpactFailureReason, message: string): WaterfallImpactJunctionResult => ({ ok: false, reason, message });
  if (![q, ve, vt, vn, gn, H, density, span, duration].every(Number.isFinite)
    || q < 0 || gn <= 0 || H < 0 || density <= 0 || span <= 0 || duration < 0
    || (q > 0 && (vn >= 0 || H <= 0))) {
    return fail('invalid-input', 'Require finite data, nonnegative flux, positive gravity/head and an incoming normal velocity for wet impact.');
  }
  const criticalDepth = (2 / 3) * H / gn;
  const criticalFlux = criticalDepth * Math.sqrt((2 / 3) * H);
  const incomingPotentialRelativeToBed = H - 0.5 * (vt * vt + vn * vn);
  if (![criticalDepth, criticalFlux, incomingPotentialRelativeToBed, span * duration].every(Number.isFinite)
    || (q > 0 && criticalFlux <= 0)) return fail('numerical-failure', 'Derived head, capacity or receipt scale is not representable.');
  if (q > 2 * criticalFlux) return fail('capacity-exceeded', 'Arriving flux exceeds the capacity of two shallow ports at the supplied head.');

  // In normalized depth x=h/hcrit, q/qcrit=x sqrt(3-2x). The tighter
  // [r/sqrt(3),r] bracket preserves tiny arriving flux instead of losing it
  // against an unrelated absolute depth tolerance.
  const port = (portQ: number): WaterfallImpactPort => {
    if (portQ === 0) return { q: 0, h: 0, s: Math.sqrt(2 * H), ve };
    const r = portQ / criticalFlux;
    let low = r / Math.sqrt(3), high = r;
    for (let i = 0; i < ITERATION_LIMIT; i++) {
      const mid = (low + high) / 2;
      if (mid === low || mid === high) break;
      if (mid * Math.sqrt(3 - 2 * mid) < r) low = mid; else high = mid;
    }
    const h = criticalDepth * ((low + high) / 2);
    return { q: portQ, h, s: Math.sqrt(2 * (H - gn * h)), ve };
  };
  const traction = (p: WaterfallImpactPort): number => p.q * p.s + 0.5 * gn * p.h * p.h;
  const splitResidual = (plusQ: number): number => traction(port(plusQ)) - traction(port(q - plusQ)) - q * vt;
  // These limits are the intersection of the two port-capacity constraints,
  // not a clamp of an inadmissible physical state.
  let low = Math.max(0, q - criticalFlux), high = Math.min(q, criticalFlux);
  const lowResidual = splitResidual(low), highResidual = splitResidual(high);
  if (!Number.isFinite(lowResidual) || !Number.isFinite(highResidual)) return fail('numerical-failure', 'Momentum bracket is not finite.');
  if (lowResidual > 0 || highResidual < 0) return fail('no-momentum-bracket', 'No split can conserve incoming tangential momentum on the shallow branches.');
  let iterations = 0;
  if (lowResidual === 0) high = low;
  else if (highResidual === 0) low = high;
  else for (; iterations < ITERATION_LIMIT; iterations++) {
    const mid = (low + high) / 2;
    if (mid === low || mid === high) break;
    if (splitResidual(mid) < 0) low = mid; else high = mid;
  }
  const plus = port((low + high) / 2), minus = port(q - plus.q);
  if (q > 0 && (plus.q >= criticalFlux || minus.q >= criticalFlux
    || plus.h >= criticalDepth || minus.h >= criticalDepth)) {
    return fail('critical-port', 'A critical port is not a strictly supercritical outgoing state.');
  }
  const flux: WaterfallImpactBalances = {
    mass: balance(density * q, density * (plus.q + minus.q)),
    tangentialMomentum: balance(density * q * vt, density * (traction(plus) - traction(minus))),
    spanwiseMomentum: balance(density * q * ve, density * (plus.q + minus.q) * ve),
    mechanicalEnergy: balance(density * q * (H + 0.5 * ve * ve), density * (
      plus.q * (0.5 * (plus.s * plus.s + ve * ve) + gn * plus.h)
      + minus.q * (0.5 * (minus.s * minus.s + ve * ve) + gn * minus.h))),
    particleKineticEnergy: balance(0.5 * density * q * (ve * ve + vt * vt + vn * vn),
      0.5 * density * (plus.q * (plus.s * plus.s + ve * ve) + minus.q * (minus.s * minus.s + ve * ve))),
    normalReaction: q === 0 ? 0 : -density * q * vn,
  };
  const integrated = scaledBalances(flux, span * duration);
  const finiteBalances = (b: WaterfallImpactBalances): boolean => Number.isFinite(b.normalReaction)
    && [b.mass, b.tangentialMomentum, b.spanwiseMomentum, b.mechanicalEnergy, b.particleKineticEnergy]
      .every(v => [v.incoming, v.outgoing, v.residual].every(Number.isFinite));
  // Scale cancellation checks by unsigned transport, including equal opposing
  // streams at normal incidence. Kinetic transport intentionally need not match.
  const checks: [ImpactBalance, number][] = [
    [flux.mass, density * q], [flux.spanwiseMomentum, density * q * Math.abs(ve)],
    [flux.tangentialMomentum, density * (traction(plus) + traction(minus) + Math.abs(q * vt))],
    [flux.mechanicalEnergy, Math.abs(flux.mechanicalEnergy.incoming)],
  ];
  if (!finiteBalances(flux) || !finiteBalances(integrated)
    || ![plus.h, plus.s, minus.h, minus.s].every(Number.isFinite)
    || [plus, minus].some(p => p.q > 0 && (p.h <= 0 || p.s <= 0
      || Math.abs(p.q - p.h * p.s) > RESIDUAL_TOLERANCE * p.q))
    || checks.some(([b, scale]) => Math.abs(b.residual) > RESIDUAL_TOLERANCE * scale)) {
    return fail('numerical-failure', 'Bounded solve did not produce finite, conservative port balances.');
  }
  return { ok: true, plus, minus, flux, integrated, incomingPotentialRelativeToBed, criticalDepth, criticalFlux, iterations };
}
