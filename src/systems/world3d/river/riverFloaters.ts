/**
 * @file riverFloaters.ts — things that float on the judged river: a paper boat
 * that the current carries (a passive floater: it tests the flow and the
 * buoyancy) and a few mallards that paddle their own ways while the current
 * carries them (they show the current by NOT matching it).
 *
 * Rivers round 4 (Remy's addendum, 2026-09-28): "a paper boat floating down
 * the river ... and a few ducks going different directions, while being
 * obviously carried to a degree by the river flow".
 *
 * PURE AND DETERMINISTIC. The state at a time t is the result of integrating
 * from t = 0 at a fixed step (1/30 s) with a seeded generator, so a capture at
 * a pinned time shows the same frame on every run. `at(t)` continues from the
 * last state when the clock runs forward and starts again from 0 when it goes
 * back. The water is read through `FloaterWaterSampler` (the flow map's
 * velocity and depth); the vertical ride on the drawn waves is the view's job
 * (riverFloatersView.ts), because it needs the shader's height mirror.
 *
 * THE PAPER BOAT (a 20 cm folded boat, very light):
 *   - its velocity relaxes to the water's surface velocity with a time
 *     constant of 0.45 s;
 *   - its heading spins with HALF the local curl of the flow (a small floating
 *     body turns with the water's own rotation rate, which is half the
 *     vorticity), and turns gently toward the flow direction where the water
 *     moves (an elongated floater settles lengthwise in a current);
 *   - rocks are circles at their waterline: the boat slides round them (the
 *     velocity into a rock is removed, the rest kept);
 *   - where the depth is under its 1.2 cm draft it runs aground; after 3 s
 *     aground, or once it leaves the reach, it starts again at a fixed point
 *     upstream.
 *
 * A DUCK paddles at its own speed along its own heading; its GROUND velocity
 * is that paddle velocity PLUS the water's velocity where it swims. Its body
 * faces its paddle heading, not its track over the ground: the angle between
 * the two (the crab angle) is the carry, plain to see. Each duck changes its
 * mind every few seconds (a seeded wander), prefers slow water when the
 * current beats its paddle, keeps off the banks (depth over 15 cm), off the
 * rocks and away from the other ducks, and turns back toward its home water
 * when it strays (see `duckHome`). Swept into fast water, it rides it.
 */

/** The water, as the floaters read it. */
export interface FloaterWaterSampler {
  /** The water's surface velocity at (x, z), m/s, written into `out` as [u, v] (x and z). */
  velocity(x: number, z: number, out: [number, number]): void;
  /** The water's depth at (x, z), m (0 or less on dry ground). */
  depth(x: number, z: number): number;
}

/** A rock at the waterline: a circle the floaters keep out of. */
export interface FloaterRock {
  x: number;
  z: number;
  /** Radius at the waterline, m. */
  r: number;
}

export interface PaperBoatState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Heading, rad, from +x toward +z. */
  heading: number;
  /** The heading's rate of change in the last step, rad/s. */
  spin: number;
  /** Half the local curl of the water in the last step, rad/s. */
  halfCurl: number;
  /** The water's velocity under the boat in the last step, m/s. */
  wx: number;
  wz: number;
  aground: boolean;
  agroundS: number;
  /** How many times it has started (1 at t = 0). */
  launches: number;
  /** Seconds since its last start. */
  sailedS: number;
}

export interface DuckState {
  x: number;
  z: number;
  /** Paddle heading, rad, from +x toward +z: where the body faces. */
  heading: number;
  /** Paddle speed, m/s. */
  paddle: number;
  /** The water's velocity where it swam in the last step, m/s. */
  wx: number;
  wz: number;
  /** Ground velocity in the last step (paddle + water), m/s. */
  gx: number;
  gz: number;
  /** The heading it currently wants (its wander), rad. */
  intent: number;
  /** Drake (green head) or hen (mottled brown). */
  drake: boolean;
  /** Paddle stroke phase, rad (the view's head bob). */
  stroke: number;
}

export interface RiverFloatersState {
  t: number;
  boat: PaperBoatState;
  ducks: DuckState[];
}

export interface DuckSpawn {
  x: number;
  z: number;
  heading: number;
  paddle: number;
  drake: boolean;
}

export interface RiverFloatersOptions {
  seed: number;
  water: FloaterWaterSampler;
  rocks: FloaterRock[];
  /** Where the paper boat starts (and starts again), and its first heading. */
  boatSpawn: { x: number; z: number; heading: number };
  ducks: DuckSpawn[];
  /** The reach the floaters stay in; outside it the boat starts again. */
  domain: { x0: number; z0: number; x1: number; z1: number };
  /**
   * The ducks' home water, m: past `r` from it they turn back toward it, so
   * they keep crossing the current there (the pool's head, where a riffle's
   * jet runs in) instead of drifting off into the still pool, where the
   * carry cannot be seen.
   */
  duckHome?: { x: number; z: number; r: number };
}

/** The floaters' constants. */
export const RIVER_FLOATERS = {
  /** Integration step, s. */
  dt: 1 / 30,
  /** The boat's velocity time constant, s (a paper boat is light: 0.3 to 0.6 s). */
  boatTauS: 0.45,
  /** How fast the boat turns lengthwise into a current, 1/s at full speed. */
  boatAlign: 0.8,
  /** The water speed at which that turn is at full rate, m/s. */
  boatAlignSpeed: 0.4,
  /** The boat's draft (it runs aground in shallower water), m. */
  boatDraftM: 0.012,
  /** The boat's half length, as a circle against the rocks, m. */
  boatRadiusM: 0.1,
  /** Aground this long, it starts again upstream, s. */
  boatGroundedS: 3,
  /** A duck's body as a circle, m. */
  duckRadiusM: 0.18,
  /** The fastest a duck turns, rad/s. */
  duckTurnRate: 1.3,
  /** A duck's wander: a new intent every 3 to 6 s, up to +-0.9 rad from the old one. */
  duckWanderMinS: 3,
  duckWanderMaxS: 6,
  duckWanderRad: 0.9,
  /** Depth a duck keeps to, m, probed this far ahead, m. */
  duckMinDepthM: 0.15,
  duckProbeM: 0.8,
  /** The distance ducks keep from each other, m. */
  duckSpacingM: 1.2,
} as const;

/** A small seeded generator (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wrap an angle to (-pi, pi]. */
export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** A uniform grid over the rocks, so a floater reads only the rocks near it. */
class RockGrid {
  private readonly cell = 2;
  private readonly map = new Map<number, FloaterRock[]>();

  constructor(rocks: FloaterRock[]) {
    for (const r of rocks) {
      const i0 = Math.floor((r.x - r.r) / this.cell);
      const i1 = Math.floor((r.x + r.r) / this.cell);
      const j0 = Math.floor((r.z - r.r) / this.cell);
      const j1 = Math.floor((r.z + r.r) / this.cell);
      for (let j = j0; j <= j1; j += 1) {
        for (let i = i0; i <= i1; i += 1) {
          const k = this.key(i, j);
          let l = this.map.get(k);
          if (!l) { l = []; this.map.set(k, l); }
          l.push(r);
        }
      }
    }
  }

  private key(i: number, j: number): number {
    return (i + 20000) * 40000 + (j + 20000);
  }

  /** The rocks whose cells are within `reach` m of (x, z). */
  near(x: number, z: number, reach: number, out: FloaterRock[]): FloaterRock[] {
    out.length = 0;
    const i0 = Math.floor((x - reach) / this.cell);
    const i1 = Math.floor((x + reach) / this.cell);
    const j0 = Math.floor((z - reach) / this.cell);
    const j1 = Math.floor((z + reach) / this.cell);
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const l = this.map.get(this.key(i, j));
        if (l) for (const r of l) if (!out.includes(r)) out.push(r);
      }
    }
    return out;
  }
}

/**
 * THE FLOATERS. `at(t)` returns the state at time t (s), interpolated between
 * the two fixed steps around it, so the motion is smooth at any frame rate
 * and the same at a pinned time on every run.
 */
export class RiverFloaters {
  private readonly o: RiverFloatersOptions;
  private readonly rocks: RockGrid;
  private readonly rockTmp: FloaterRock[] = [];
  private readonly w: [number, number] = [0, 0];
  private step = 0;
  private cur!: RiverFloatersState;
  private prev!: RiverFloatersState;
  /** Per duck: when its next wander comes, s, and its own generator. */
  private wander: Array<{ next: number; rnd: () => number }> = [];

  constructor(o: RiverFloatersOptions) {
    this.o = o;
    this.rocks = new RockGrid(o.rocks);
    this.reset();
  }

  private reset(): void {
    const o = this.o;
    const boat: PaperBoatState = {
      x: o.boatSpawn.x, z: o.boatSpawn.z, vx: 0, vz: 0, heading: o.boatSpawn.heading, spin: 0, halfCurl: 0,
      wx: 0, wz: 0, aground: false, agroundS: 0, launches: 1, sailedS: 0,
    };
    const ducks: DuckState[] = o.ducks.map((d) => ({
      x: d.x, z: d.z, heading: d.heading, paddle: d.paddle, wx: 0, wz: 0, gx: 0, gz: 0, intent: d.heading, drake: d.drake, stroke: 0,
    }));
    this.wander = o.ducks.map((_, i) => {
      const rnd = rng((o.seed ^ 0x9e3779b1) + i * 7919);
      const R = RIVER_FLOATERS;
      return { next: R.duckWanderMinS + (R.duckWanderMaxS - R.duckWanderMinS) * rnd(), rnd };
    });
    this.step = 0;
    this.cur = { t: 0, boat, ducks };
    this.prev = clone(this.cur);
  }

  /** The state at time t, s. */
  at(t: number): RiverFloatersState {
    const dt = RIVER_FLOATERS.dt;
    const target = Math.max(0, t);
    if (target < this.prev.t - 1e-9) this.reset();
    while (this.cur.t < target - 1e-9) {
      this.prev = clone(this.cur);
      this.advance();
    }
    // Interpolate between prev and cur (cur.t >= target >= prev.t).
    const span = this.cur.t - this.prev.t;
    const f = span > 0 ? Math.min(1, Math.max(0, (target - this.prev.t) / span)) : 1;
    return lerpState(this.prev, this.cur, f, target);
  }

  /** One fixed step. */
  private advance(): void {
    const R = RIVER_FLOATERS;
    const dt = R.dt;
    this.step += 1;
    const s = this.cur;
    s.t = this.step * dt;
    this.stepBoat(s.boat, dt);
    for (let i = 0; i < s.ducks.length; i += 1) this.stepDuck(i, s.ducks, dt, s.t);
  }

  /** The water's curl at (x, z): dv/dx - du/dz, 1/s (positive turns +x toward +z). */
  private curl(x: number, z: number): number {
    const e = 0.35;
    const W = this.o.water;
    const a: [number, number] = [0, 0];
    W.velocity(x + e, z, a); const vxp = a[1];
    W.velocity(x - e, z, a); const vxm = a[1];
    W.velocity(x, z + e, a); const uzp = a[0];
    W.velocity(x, z - e, a); const uzm = a[0];
    return (vxp - vxm) / (2 * e) - (uzp - uzm) / (2 * e);
  }

  private respawnBoat(b: PaperBoatState): void {
    const sp = this.o.boatSpawn;
    b.x = sp.x; b.z = sp.z; b.vx = 0; b.vz = 0; b.heading = sp.heading; b.spin = 0;
    b.aground = false; b.agroundS = 0; b.launches += 1; b.sailedS = 0;
  }

  private stepBoat(b: PaperBoatState, dt: number): void {
    const R = RIVER_FLOATERS;
    const W = this.o.water;
    const d0 = this.o.domain;
    b.sailedS += dt;
    if (b.aground) {
      b.agroundS += dt;
      b.vx = 0; b.vz = 0; b.spin = 0;
      if (b.agroundS >= R.boatGroundedS) this.respawnBoat(b);
      return;
    }
    W.velocity(b.x, b.z, this.w);
    const wx = this.w[0];
    const wz = this.w[1];
    b.wx = wx; b.wz = wz;
    // Velocity relaxes to the water's (exact for a constant water velocity
    // over the step: 1 - exp(-dt / tau)).
    const a = 1 - Math.exp(-dt / R.boatTauS);
    b.vx += (wx - b.vx) * a;
    b.vz += (wz - b.vz) * a;
    // Heading: half the curl, plus a gentle turn lengthwise into the current.
    const halfCurl = 0.5 * this.curl(b.x, b.z);
    const sp = Math.hypot(wx, wz);
    let align = 0;
    if (sp > 0.02) {
      // Lengthwise either way: a boat pointing upstream turns to the nearer
      // of the two ends (sin of twice the angle).
      const d = wrapAngle(Math.atan2(wz, wx) - b.heading);
      align = R.boatAlign * Math.min(1, sp / R.boatAlignSpeed) * 0.5 * Math.sin(2 * d);
    }
    b.halfCurl = halfCurl;
    b.spin = halfCurl + align;
    b.heading = wrapAngle(b.heading + b.spin * dt);
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    // Rocks: slide round them.
    for (const r of this.rocks.near(b.x, b.z, R.boatRadiusM + 1.2, this.rockTmp)) {
      const dx = b.x - r.x;
      const dz = b.z - r.z;
      const dist = Math.hypot(dx, dz);
      const min = r.r + R.boatRadiusM;
      if (dist < min && dist > 1e-6) {
        const nx = dx / dist;
        const nz = dz / dist;
        b.x = r.x + nx * min;
        b.z = r.z + nz * min;
        const into = b.vx * nx + b.vz * nz;
        if (into < 0) { b.vx -= into * nx; b.vz -= into * nz; }
      }
    }
    if (b.x < d0.x0 || b.x > d0.x1 || b.z < d0.z0 || b.z > d0.z1) { this.respawnBoat(b); return; }
    if (W.depth(b.x, b.z) < R.boatDraftM) {
      b.aground = true;
      b.agroundS = 0;
      b.vx = 0; b.vz = 0;
    }
  }

  private stepDuck(i: number, ducks: DuckState[], dt: number, t: number): void {
    const R = RIVER_FLOATERS;
    const W = this.o.water;
    const d = ducks[i];
    const wd = this.wander[i];
    // The wander: a new intent every few seconds.
    if (t >= wd.next) {
      d.intent = wrapAngle(d.intent + (wd.rnd() * 2 - 1) * R.duckWanderRad);
      wd.next = t + R.duckWanderMinS + (R.duckWanderMaxS - R.duckWanderMinS) * wd.rnd();
    }
    W.velocity(d.x, d.z, this.w);
    const wx = this.w[0];
    const wz = this.w[1];
    // The steering: a sum of unit pulls, the intent first.
    let tx = Math.cos(d.intent);
    let tz = Math.sin(d.intent);
    // Slow water: where the current beats the paddle, pull toward slower water.
    const sp = Math.hypot(wx, wz);
    const beat = Math.min(1, Math.max(0, (sp - 0.8 * d.paddle) / (0.7 * d.paddle)));
    if (beat > 0) {
      const e = 0.6;
      const a: [number, number] = [0, 0];
      W.velocity(d.x + e, d.z, a); const sxp = Math.hypot(a[0], a[1]);
      W.velocity(d.x - e, d.z, a); const sxm = Math.hypot(a[0], a[1]);
      W.velocity(d.x, d.z + e, a); const szp = Math.hypot(a[0], a[1]);
      W.velocity(d.x, d.z - e, a); const szm = Math.hypot(a[0], a[1]);
      const gx = -(sxp - sxm);
      const gz = -(szp - szm);
      const gl = Math.hypot(gx, gz);
      if (gl > 1e-4) { tx += 2 * beat * gx / gl; tz += 2 * beat * gz / gl; }
    }
    // The banks: probe ahead; if shallow, pull toward deeper water.
    const hx = Math.cos(d.heading);
    const hz = Math.sin(d.heading);
    const px = d.x + hx * R.duckProbeM;
    const pz = d.z + hz * R.duckProbeM;
    const shallowAhead = W.depth(px, pz) < R.duckMinDepthM;
    const shallowHere = W.depth(d.x, d.z) < R.duckMinDepthM;
    if (shallowAhead || shallowHere) {
      const e = 0.6;
      const gx = W.depth(d.x + e, d.z) - W.depth(d.x - e, d.z);
      const gz = W.depth(d.x, d.z + e) - W.depth(d.x, d.z - e);
      const gl = Math.hypot(gx, gz);
      if (gl > 1e-5) { tx += 3 * gx / gl; tz += 3 * gz / gl; } else { tx -= 3 * hx; tz -= 3 * hz; }
    }
    // Rocks: push away from any rock within a meter of the body.
    for (const r of this.rocks.near(d.x, d.z, R.duckRadiusM + 1.5, this.rockTmp)) {
      const dx = d.x - r.x;
      const dz = d.z - r.z;
      const dist = Math.hypot(dx, dz);
      const gap = dist - r.r - R.duckRadiusM;
      if (gap < 1.0 && dist > 1e-6) {
        const k = 2 * (1 - Math.max(0, gap));
        tx += k * dx / dist;
        tz += k * dz / dist;
      }
    }
    // Home: past its radius, a pull back toward it that grows over 6 m.
    const home = this.o.duckHome;
    if (home) {
      const hx2 = home.x - d.x;
      const hz2 = home.z - d.z;
      const hd = Math.hypot(hx2, hz2);
      if (hd > home.r) {
        const k = 2.5 * Math.min(1, (hd - home.r) / 6);
        tx += k * hx2 / hd;
        tz += k * hz2 / hd;
      }
    }
    // The other ducks: keep a spacing.
    for (let j = 0; j < ducks.length; j += 1) {
      if (j === i) continue;
      const dx = d.x - ducks[j].x;
      const dz = d.z - ducks[j].z;
      const dist = Math.hypot(dx, dz);
      if (dist < R.duckSpacingM && dist > 1e-6) {
        const k = 1.5 * (1 - dist / R.duckSpacingM);
        tx += k * dx / dist;
        tz += k * dz / dist;
      }
    }
    // Turn toward the wanted heading at a limited rate.
    if (Math.hypot(tx, tz) > 1e-6) {
      const dh = wrapAngle(Math.atan2(tz, tx) - d.heading);
      const maxTurn = R.duckTurnRate * dt;
      d.heading = wrapAngle(d.heading + Math.max(-maxTurn, Math.min(maxTurn, dh)));
    }
    // THE CARRY: the ground velocity is the paddle velocity plus the water's.
    const pxv = d.paddle * Math.cos(d.heading);
    const pzv = d.paddle * Math.sin(d.heading);
    d.wx = wx; d.wz = wz;
    d.gx = pxv + wx;
    d.gz = pzv + wz;
    d.x += d.gx * dt;
    d.z += d.gz * dt;
    // A rock the body still touches pushes it out (the steering keeps this rare).
    for (const r of this.rocks.near(d.x, d.z, R.duckRadiusM + 1.5, this.rockTmp)) {
      const dx = d.x - r.x;
      const dz = d.z - r.z;
      const dist = Math.hypot(dx, dz);
      const min = r.r + R.duckRadiusM;
      if (dist < min && dist > 1e-6) { d.x = r.x + dx / dist * min; d.z = r.z + dz / dist * min; }
    }
    d.stroke += dt * 2 * Math.PI * (1.2 + 1.3 * d.paddle);
  }
}

function clone(s: RiverFloatersState): RiverFloatersState {
  return { t: s.t, boat: { ...s.boat }, ducks: s.ducks.map((d) => ({ ...d })) };
}

function lerpAngle(a: number, b: number, f: number): number {
  return wrapAngle(a + wrapAngle(b - a) * f);
}

/**
 * Between two steps: positions and headings interpolate; a jump (a new start
 * of the boat) snaps to the newer step.
 */
function lerpState(p: RiverFloatersState, c: RiverFloatersState, f: number, t: number): RiverFloatersState {
  const boatJump = c.boat.launches !== p.boat.launches;
  const bp = boatJump ? c.boat : p.boat;
  const boat: PaperBoatState = {
    ...c.boat,
    x: bp.x + (c.boat.x - bp.x) * f,
    z: bp.z + (c.boat.z - bp.z) * f,
    heading: lerpAngle(bp.heading, c.boat.heading, f),
  };
  const ducks = c.ducks.map((d, i) => ({
    ...d,
    x: p.ducks[i].x + (d.x - p.ducks[i].x) * f,
    z: p.ducks[i].z + (d.z - p.ducks[i].z) * f,
    heading: lerpAngle(p.ducks[i].heading, d.heading, f),
    stroke: p.ducks[i].stroke + (d.stroke - p.ducks[i].stroke) * f,
  }));
  return { t, boat, ducks };
}
