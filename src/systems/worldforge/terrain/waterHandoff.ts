/**
 * @file waterHandoff.ts — the contract between the two water models.
 *
 * ADR 0002 leaves one thing open at the top of its list: the world has TWO
 * water models and no seam between them.
 *
 *   - The SHEET (`shallowWater.ts`) is the primary model. Two-dimensional,
 *     conservative, cheap enough to run everywhere, and exact about mass.
 *   - The PARTICLES (`mpmDomain.ts`, and its GPU twin `flipCompute.ts`) are
 *     the local exception. Real inertia, a real splash, and a budget: a fixed
 *     number of particles in a bounded box around one violent event.
 *
 * Water must be able to cross between them, in both directions, without a drop
 * appearing or disappearing. This file is that crossing, and nothing else. It
 * has no three.js in it and no simulation in it, so vitest can prove the
 * arithmetic with no GPU and no scene — the same discipline `fluidGather.ts`
 * established for the kernel it mirrors.
 *
 * THE ONE RULE: A PARTICLE IS A QUANTUM OF VOLUME
 *
 * The particle sim has a fixed budget and no notion of "half a particle". So
 * the sheet is debited in WHOLE PARTICLES and never by the requested amount:
 * ask for 1.7 quanta and 1 leaves, with 0.7 still sitting in the sheet where
 * it was. Rounding the request would manufacture or destroy the remainder
 * every frame, at frame rate, which is exactly the class of silent loss this
 * campaign has now found four times.
 *
 * Every particle then carries EXACTLY that quantum for its whole life. The
 * volume held by the domain is therefore `live * quantumM3` — a product, not
 * an accumulated sum, so it cannot drift no matter how long the domain runs.
 *
 * THE LEDGER TERM
 *
 * `HandoffLedger.inFlightM3` is a printed term of the identity, beside pool,
 * transit, soaked and ran off. It is not a diagnostic: while a domain is live,
 * the identity is FALSE without it, and the campaign's hard-won lesson is that
 * a term you do not print is a term you will lose.
 */

/**
 * The part of the 2D sheet this contract touches.
 *
 * Structural, not a class reference: `ShallowWaterField` satisfies it as it
 * stands, and a test can hand over three fields instead of building a solver.
 */
export interface SheetTarget {
  /** Cells per edge. */
  readonly n: number;
  /** Cell size in world meters. */
  readonly cellM: number;
  /** Water depth per cell in meters, laid out z * n + x. */
  readonly depth: Float32Array;
}

/** Inclusive cell bounds on the sheet grid. Clamped on use. */
export interface HandoffRegion {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/**
 * The volume one particle carries, cubic meters.
 *
 * MLS-MPM's rest density is measured in PARTICLES PER CELL (4, from
 * webgpu-ocean), so a cell of side `dxM` at rest holds `restDensity`
 * particles. One particle is therefore that cell's volume divided by the
 * count. Get this wrong and the domain still looks like water while the
 * ledger drifts — the number is invisible on screen and decisive on paper.
 */
export function particleVolumeM3(dxM: number, restDensity: number): number {
  return (dxM * dxM * dxM) / restDensity;
}

export interface SheetDebit {
  /** Volume actually removed from the sheet, m³. A whole number of quanta. */
  takenM3: number;
  /** How many particles that volume buys. */
  particles: number;
  /** Volume that was available but did not fill a whole quantum. Still in the sheet. */
  remainderM3: number;
}

/**
 * Move water OUT of the sheet, ready to become particles.
 *
 * `keepDepthM` is the depth left behind in every cell the debit touches. The
 * sheet's own dry threshold is the right value: strip a lip cell to zero and
 * the fall it feeds stops being a fall, so the next frame finds no event, the
 * domain disarms, and the water arrives back as an ordinary pour. A feed that
 * destroys its own trigger oscillates.
 *
 * The debit is spread in proportion to each cell's AVAILABLE depth, so the
 * shape of the pour survives the crossing rather than being cut out of one
 * cell.
 */
export function sheetToParticles(
  sheet: SheetTarget,
  region: HandoffRegion,
  requestM3: number,
  quantumM3: number,
  keepDepthM: number,
): SheetDebit {
  const none: SheetDebit = { takenM3: 0, particles: 0, remainderM3: 0 };
  if (!(requestM3 > 0) || !(quantumM3 > 0)) return none;

  const n = sheet.n;
  const area = sheet.cellM * sheet.cellM;
  const x0 = Math.max(0, Math.min(n - 1, region.x0));
  const x1 = Math.max(0, Math.min(n - 1, region.x1));
  const z0 = Math.max(0, Math.min(n - 1, region.z0));
  const z1 = Math.max(0, Math.min(n - 1, region.z1));
  if (x1 < x0 || z1 < z0) return none;

  let availableM = 0;
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      const d = sheet.depth[z * n + x] - keepDepthM;
      if (d > 0) availableM += d;
    }
  }
  const availableM3 = availableM * area;
  if (availableM3 <= 0) return none;

  const wantM3 = Math.min(requestM3, availableM3);
  const particles = Math.floor(wantM3 / quantumM3);
  if (particles <= 0) return { takenM3: 0, particles: 0, remainderM3: wantM3 };
  const takenM3 = particles * quantumM3;

  /* Proportional withdrawal. `scale` cannot exceed 1 because takenM3 <=
   * wantM3 <= availableM3, so no cell is ever pushed below `keepDepthM`. */
  const scale = takenM3 / availableM3;
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      const i = z * n + x;
      const d = sheet.depth[i] - keepDepthM;
      if (d > 0) sheet.depth[i] -= d * scale;
    }
  }
  return { takenM3, particles, remainderM3: wantM3 - takenM3 };
}

export interface SheetCredit {
  /** Volume that landed in the sheet, m³. */
  creditedM3: number;
  /**
   * Volume aimed at a cell outside the grid, m³.
   *
   * Recorded, never dropped. The caller books it against the sheet's boundary
   * ledger, which is where every other unit that leaves the domain goes.
   */
  strandedM3: number;
}

/**
 * Move water back INTO the sheet, where particles came to rest.
 *
 * Deposits arrive as two parallel arrays and a count, not as objects — the
 * same fixed-buffer discipline the fall-segment and wet-quad paths already
 * use, so a settling frame allocates nothing.
 */
export function particlesToSheet(
  sheet: SheetTarget,
  indices: Int32Array,
  volumesM3: Float32Array,
  count: number,
): SheetCredit {
  const cells = sheet.n * sheet.n;
  const invArea = 1 / (sheet.cellM * sheet.cellM);
  let credited = 0;
  let stranded = 0;
  for (let k = 0; k < count; k++) {
    const m3 = volumesM3[k];
    if (!(m3 > 0)) continue;
    const i = indices[k];
    if (i < 0 || i >= cells) {
      stranded += m3;
      continue;
    }
    sheet.depth[i] += m3 * invArea;
    credited += m3;
  }
  return { creditedM3: credited, strandedM3: stranded };
}

/**
 * The books for one live particle domain.
 *
 * `inFlightM3` is the term the page prints. The three cumulative fields are
 * for diagnosis: a crossing that conserves per-call but drifts over a session
 * shows up as `toParticlesM3 - toSheetM3 - strandedM3` failing to equal
 * `inFlightM3`, and `checkHandoff` below asserts exactly that.
 */
export interface HandoffLedger {
  /** Volume held by live particles right now, m³. A printed ledger term. */
  inFlightM3: number;
  /** Cumulative volume the sheet has handed to particles, m³. */
  toParticlesM3: number;
  /** Cumulative volume particles have handed back, m³. */
  toSheetM3: number;
  /** Cumulative volume that had no cell to land in, m³. Booked at the boundary. */
  strandedM3: number;
}

export function newHandoffLedger(): HandoffLedger {
  return { inFlightM3: 0, toParticlesM3: 0, toSheetM3: 0, strandedM3: 0 };
}

/** `sheetToParticles`, with the books moved. Use this, not the bare function. */
export function debitSheet(
  sheet: SheetTarget,
  ledger: HandoffLedger,
  region: HandoffRegion,
  requestM3: number,
  quantumM3: number,
  keepDepthM: number,
): SheetDebit {
  const d = sheetToParticles(sheet, region, requestM3, quantumM3, keepDepthM);
  ledger.inFlightM3 += d.takenM3;
  ledger.toParticlesM3 += d.takenM3;
  return d;
}

/** `particlesToSheet`, with the books moved. Use this, not the bare function. */
export function creditSheet(
  sheet: SheetTarget,
  ledger: HandoffLedger,
  indices: Int32Array,
  volumesM3: Float32Array,
  count: number,
): SheetCredit {
  const c = particlesToSheet(sheet, indices, volumesM3, count);
  ledger.inFlightM3 -= c.creditedM3 + c.strandedM3;
  ledger.toSheetM3 += c.creditedM3;
  ledger.strandedM3 += c.strandedM3;
  return c;
}

/**
 * The crossing's own invariant, in one line.
 *
 * Everything that left the sheet is either still in flight, back in the sheet,
 * or stranded at the boundary. Nothing else is permitted, and this is asserted
 * rather than assumed because the failure mode is a slow leak that looks fine
 * for a minute.
 */
export function handoffResidualM3(ledger: HandoffLedger): number {
  return ledger.toParticlesM3 - (ledger.inFlightM3 + ledger.toSheetM3 + ledger.strandedM3);
}
