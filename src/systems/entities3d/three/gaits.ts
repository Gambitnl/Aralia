/**
 * @file gaits.ts — the six locomotion drivers, generalized from the blobfolk
 * prototype's hardcoded critters to any Frame.
 *
 * A driver owns the per-frame skeleton math: it advances the gait cycle,
 * emits the body's metaballs (buildBody), and maintains the Pose — the named
 * anchor transforms that modular parts attach to. Locomotion (where the
 * entity is, which way it faces, how fast it moves) comes from the caller;
 * drivers only need `speed` (and expose `verticalOffsetM` for airborne body
 * lift, applied by the assembler to the body root).
 */
import { Quaternion, Vector3, Euler } from 'three';
import type { Anchor, BallSink, Frame, Gait } from '../types';
import { ANCHORS, FT_TO_M, headRadiusM, heightM } from '../types';
import { smooth, solveKnee } from './ik';
import { TreadmillLeg } from './legs';

export interface LocomotionState {
  position: Vector3;
  heading: Vector3;
  /** Ground speed in m/s (or air speed for flyers). */
  speed: number;
}

export interface PoseAnchor {
  pos: Vector3;
  quat: Quaternion;
}

export interface Pose {
  anchors: Record<Anchor, PoseAnchor>;
}

export interface GaitDriver {
  update(t: number, dt: number, loco: LocomotionState): void;
  /** Emit this frame's body metaballs (entity-local meters, ground at y=0). */
  buildBody(sink: BallSink): void;
  readonly pose: Pose;
  readonly gaitPhase: number;
  /** Wing flap angle in radians; 0 for non-flyers. */
  readonly flap: number;
  /** Extra body lift (hopper airtime, flyer altitude), applied by the assembler. */
  readonly verticalOffsetM: number;
}

function makePose(): Pose {
  return {
    anchors: Object.fromEntries(
      ANCHORS.map((a) => [a, { pos: new Vector3(), quat: new Quaternion() }]),
    ) as Record<Anchor, PoseAnchor>,
  };
}

/** Chain of interpolated balls (limb segments, spines, necks).
 * Sample count adapts to span ÷ radius so long limbs on big frames stay a
 * connected tube instead of beads on a string. */
function chain(
  sink: BallSink,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  minN: number, r0: number, r1: number,
): void {
  const dist = Math.hypot(bx - ax, by - ay, bz - az);
  const rMin = Math.max(Math.min(r0, r1), 1e-4);
  const n = Math.max(minN, Math.min(10, Math.ceil(dist / (rMin * 1.15)) + 1));
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    sink.ball(ax + (bx - ax) * u, ay + (by - ay) * u, az + (bz - az) * u, r0 + (r1 - r0) * u);
  }
}

const EULER = new Euler();
const V_HIP = new Vector3();
const V_KNEE = new Vector3();
const V_BEND = new Vector3();
const V_HAND = new Vector3();
const V_SH = new Vector3();

abstract class BaseDriver implements GaitDriver {
  readonly pose = makePose();
  gaitPhase = 0;
  flap = 0;
  verticalOffsetM = 0;
  protected t = 0;
  protected speed = 0;
  protected speedFactor = 0;
  protected readonly hM: number;
  protected readonly hr: number;
  protected readonly baseR: number;
  protected readonly legLenM: number;

  constructor(protected readonly frame: Frame) {
    this.hM = heightM(frame);
    this.hr = headRadiusM(frame);
    this.baseR = this.hM * 0.105 * frame.bulk;
    this.legLenM = frame.limbLengthFt * FT_TO_M;
  }

  protected cadence(): number {
    if (this.speed < 0.01) return 1.2;
    return Math.min(1.5 + this.speed / Math.max(this.legLenM, 0.2) / 2.4, 3.0);
  }

  protected strideHalf(): number {
    if (this.speed < 0.01) return 0;
    return Math.min(this.speed / (2 * this.cadence()), this.legLenM * 0.42);
  }

  update(t: number, dt: number, loco: LocomotionState): void {
    this.t = t;
    this.speed = Math.max(0, loco.speed);
    this.speedFactor = Math.min(this.speed / 1.2, 1);
    this.gaitPhase += this.cadence() * Math.max(dt, 0);
    this.advance(t, dt);
  }

  /** Per-gait skeleton update; must refresh every pose anchor. */
  protected abstract advance(t: number, dt: number): void;
  abstract buildBody(sink: BallSink): void;

  protected setAnchor(a: Anchor, x: number, y: number, z: number): void {
    this.pose.anchors[a].pos.set(x, y, z);
  }

  /** Standard head-cluster anchors around a head center. */
  protected setHeadAnchors(hx: number, hy: number, hz: number): void {
    const r = this.hr;
    this.setAnchor('head', hx, hy, hz);
    this.setAnchor('crown', hx, hy + r * 0.95, hz - r * 0.1);
    this.setAnchor('jaw', hx, hy - r * 0.55, hz + r * 0.45);
    this.setAnchor('browL', hx - r * 0.42, hy + r * 0.35, hz + r * 0.6);
    this.setAnchor('browR', hx + r * 0.42, hy + r * 0.35, hz + r * 0.6);
    this.setAnchor('earL', hx - r * 0.95, hy + r * 0.15, hz - r * 0.05);
    this.setAnchor('earR', hx + r * 0.95, hy + r * 0.15, hz - r * 0.05);
  }
}

/* ------------------------------------------------------------------ biped */

class BipedDriver extends BaseDriver {
  private readonly legs: [TreadmillLeg, TreadmillLeg];
  private pelvisY = 0;
  private chestY = 0;
  private headY = 0;
  private bob = 0;
  private sway = 0;

  constructor(frame: Frame) {
    super(frame);
    const stance = (frame.stanceWidthFt * FT_TO_M) / 2;
    this.legs = [
      new TreadmillLeg(-stance, 0.01, 0, { liftH: this.hM * 0.06 }),
      new TreadmillLeg(stance, 0.01, 0.5, { liftH: this.hM * 0.06 }),
    ];
  }

  protected advance(): void {
    const stride = this.strideHalf();
    for (const leg of this.legs) leg.update(this.gaitPhase, stride);
    this.bob = Math.sin(this.gaitPhase * Math.PI * 4) * this.hM * 0.014 * (0.4 + this.speedFactor);
    this.sway = Math.sin(this.gaitPhase * Math.PI * 2) * this.hM * 0.011;
    this.pelvisY = this.legLenM * 1.0 + this.bob;
    this.chestY = this.pelvisY + (this.hM - this.legLenM) * 0.45;
    // keep the head clear of the chest blob so stocky frames still read as
    // head-on-shoulders instead of one pear-shaped mass
    this.headY = this.hM - this.hr * 0.7 + this.bob;
    const shoulderX = (this.frame.shoulderWidthFt * FT_TO_M) / 2 + this.baseR * 0.35;
    // arms: counter-swing to the legs; hang forward-and-easy when idle
    for (const sgn of [-1, 1] as const) {
      const phaseOff = sgn < 0 ? 0.5 : 0;
      const swing = Math.sin((this.gaitPhase + phaseOff) * Math.PI * 2) * 0.55 * this.speedFactor;
      const hand = this.pose.anchors[sgn < 0 ? 'handL' : 'handR'];
      hand.pos.set(
        sgn * (shoulderX + this.baseR * 0.05),
        this.pelvisY + this.hM * 0.015,
        Math.sin(swing) * this.frame.armLengthFt * FT_TO_M * 0.42 + this.hM * 0.045,
      );
      // tilt held gear slightly forward and away from the body so it reads
      hand.quat.setFromEuler(EULER.set(swing * 0.5 + 0.22, 0, sgn * -0.3));
    }
    this.setAnchor('hips', this.sway, this.pelvisY, 0);
    this.setAnchor('hipL', -Math.abs(this.legs[0].pos.x) * 0.8, this.pelvisY - this.baseR * 0.3, 0);
    this.setAnchor('hipR', Math.abs(this.legs[1].pos.x) * 0.8, this.pelvisY - this.baseR * 0.3, 0);
    this.setAnchor('chest', this.sway * 0.6, this.chestY, this.baseR * 0.15);
    this.setAnchor('back', this.sway * 0.6, this.chestY + this.baseR * 0.15, -this.baseR * 0.85);
    this.setAnchor('tailRoot', this.sway, this.pelvisY - this.baseR * 0.2, -this.baseR * 0.8);
    this.setHeadAnchors(0, this.headY, this.hr * 0.25);
  }

  buildBody(sink: BallSink): void {
    const r = this.baseR;
    // torso stack: pelvis → belly → chest (chest slimmer than head to keep
    // the silhouette readable)
    sink.ball(this.sway, this.pelvisY, 0, r);
    sink.ball(this.sway * 0.6, this.pelvisY + (this.chestY - this.pelvisY) * 0.5, 0.01, r * 1.0);
    sink.ball(0, this.chestY, 0.02, r * 0.98);
    sink.ball(0, this.headY, this.hr * 0.25, this.hr);
    const shoulderX = (this.frame.shoulderWidthFt * FT_TO_M) / 2;
    const armLen = this.frame.armLengthFt * FT_TO_M;
    const armR = Math.max(r * 0.42, armLen * 0.1);
    for (const sgn of [-1, 1] as const) {
      const hand = this.pose.anchors[sgn < 0 ? 'handL' : 'handR'].pos;
      V_SH.set(sgn * shoulderX, this.chestY + r * 0.45, 0.02);
      V_BEND.set(sgn, 0, -0.4).normalize();
      solveKnee(V_SH, V_HAND.copy(hand), armLen * 0.52, armLen * 0.52, V_BEND, V_KNEE);
      chain(sink, V_SH.x, V_SH.y, V_SH.z, V_KNEE.x, V_KNEE.y, V_KNEE.z, 3, armR, armR * 0.9);
      chain(sink, V_KNEE.x, V_KNEE.y, V_KNEE.z, hand.x, hand.y, hand.z, 3, armR * 0.9, armR * 1.25);
    }
    const legR = Math.max(r * 0.48, this.legLenM * 0.11);
    for (const leg of this.legs) {
      V_HIP.set(leg.pos.x * 0.8, this.pelvisY - r * 0.2, 0);
      V_BEND.set(0, 0, 1);
      solveKnee(V_HIP, V_HAND.copy(leg.pos), this.legLenM * 0.52, this.legLenM * 0.52, V_BEND, V_KNEE);
      chain(sink, V_HIP.x, V_HIP.y, V_HIP.z, V_KNEE.x, V_KNEE.y, V_KNEE.z, 3, legR, legR * 0.92);
      chain(sink, V_KNEE.x, V_KNEE.y, V_KNEE.z, leg.pos.x, leg.pos.y, leg.pos.z, 3, legR * 0.92, legR * 1.2);
    }
  }
}

/* ------------------------------------------------------- quad + hexapod */

class MultiLegDriver extends BaseDriver {
  private readonly legs: TreadmillLeg[] = [];
  private readonly legAnchorsX: number[] = [];
  private readonly legAnchorsZ: number[] = [];
  private bodyY = 0;
  private bob = 0;
  private readonly bodyLen: number;
  private readonly isHexa: boolean;

  constructor(frame: Frame, isHexa: boolean) {
    super(frame);
    this.isHexa = isHexa;
    this.bodyLen = this.hM * 1.5;
    const stance = (frame.stanceWidthFt * FT_TO_M) / 2;
    if (isHexa) {
      const zs = [this.bodyLen * 0.32, 0, -this.bodyLen * 0.32];
      for (let i = 0; i < 3; i++) {
        for (const sgn of [-1, 1] as const) {
          const phase = ((i + (sgn > 0 ? 1 : 0)) % 2) * 0.5; // tripod gait
          this.legs.push(new TreadmillLeg(sgn * stance, zs[i], phase, { duty: 0.55, liftH: this.hM * 0.07 }));
          this.legAnchorsX.push(sgn * stance * 0.4);
          this.legAnchorsZ.push(zs[i]);
        }
      }
    } else {
      const zf = this.bodyLen * 0.36;
      const zb = -this.bodyLen * 0.36;
      const defs: Array<[number, number, number]> = [
        [-stance, zf, 0],
        [stance, zb, 0],
        [stance, zf, 0.5],
        [-stance, zb, 0.5],
      ];
      for (const [x, z, phase] of defs) {
        this.legs.push(new TreadmillLeg(x, z, phase, { liftH: this.hM * 0.08 }));
        this.legAnchorsX.push(x * 0.75);
        this.legAnchorsZ.push(z * 0.95);
      }
    }
  }

  protected advance(): void {
    const stride = this.strideHalf();
    for (const leg of this.legs) leg.update(this.gaitPhase, stride);
    this.bob = Math.sin(this.gaitPhase * Math.PI * 4) * this.hM * 0.02;
    this.bodyY = this.hM * (this.isHexa ? 0.55 : 0.8) + this.bob;
    const headZ = this.bodyLen * 0.55;
    const headY = this.bodyY + this.hM * (this.isHexa ? 0.15 : 0.35);
    this.setHeadAnchors(0, headY, headZ);
    this.setAnchor('chest', 0, this.bodyY + this.baseR * 0.4, this.bodyLen * 0.3);
    this.setAnchor('back', 0, this.bodyY + this.baseR * 0.75, 0);
    this.setAnchor('hips', 0, this.bodyY, -this.bodyLen * 0.3);
    this.setAnchor('tailRoot', 0, this.bodyY + this.baseR * 0.2, -this.bodyLen * 0.48);
    this.setAnchor('handL', -this.legAnchorsX[0], this.bodyY - this.baseR * 0.3, this.bodyLen * 0.3);
    this.setAnchor('handR', this.legAnchorsX[0], this.bodyY - this.baseR * 0.3, this.bodyLen * 0.3);
    this.setAnchor('hipL', -this.legAnchorsX[0], this.bodyY - this.baseR * 0.3, -this.bodyLen * 0.3);
    this.setAnchor('hipR', this.legAnchorsX[0], this.bodyY - this.baseR * 0.3, -this.bodyLen * 0.3);
  }

  buildBody(sink: BallSink): void {
    const r = this.baseR * (this.isHexa ? 0.85 : 1);
    chain(
      sink,
      0, this.bodyY, -this.bodyLen * 0.33,
      0, this.bodyY + this.hM * 0.04, this.bodyLen * 0.33,
      3, r * 1.02, r,
    );
    const head = this.pose.anchors.head.pos;
    // neck
    chain(sink, 0, this.bodyY + this.hM * 0.05, this.bodyLen * 0.32, head.x, head.y, head.z, 3, r * 0.6, this.hr * 0.9);
    sink.ball(head.x, head.y, head.z, this.hr);
    const legR = Math.max(r * (this.isHexa ? 0.34 : 0.46), this.legLenM * (this.isHexa ? 0.08 : 0.12));
    for (let i = 0; i < this.legs.length; i++) {
      const leg = this.legs[i];
      V_HIP.set(this.legAnchorsX[i], this.bodyY - r * 0.1, this.legAnchorsZ[i]);
      V_BEND.set(this.isHexa ? Math.sign(this.legAnchorsX[i]) : 0, this.isHexa ? 0.9 : 0, this.legAnchorsZ[i] >= 0 ? 1 : -1).normalize();
      const l = this.legLenM * 0.55;
      solveKnee(V_HIP, V_HAND.copy(leg.pos), l, l, V_BEND, V_KNEE);
      chain(sink, V_HIP.x, V_HIP.y, V_HIP.z, V_KNEE.x, V_KNEE.y, V_KNEE.z, 3, legR, legR * 0.88);
      chain(sink, V_KNEE.x, V_KNEE.y, V_KNEE.z, leg.pos.x, leg.pos.y, leg.pos.z, 3, legR * 0.88, legR * 1.1);
    }
  }
}

/* ----------------------------------------------------------------- hopper */

class HopperDriver extends BaseDriver {
  private hopT = 0;
  private squash = 0;

  protected advance(_t: number, dt: number): void {
    const period = 1.15;
    if (this.speed > 0.01) {
      this.hopT = (this.hopT + dt / period) % 1;
    } else {
      this.hopT = 0;
    }
    const u = this.hopT;
    const AIR0 = 0.38;
    const AIR1 = 0.82;
    let s = 0;
    let air = 0;
    if (this.speed > 0.01) {
      if (u < 0.26) s = smooth(u / 0.26) * 0.38;
      else if (u < AIR0) s = 0.38 - smooth((u - 0.26) / (AIR0 - 0.26)) * 0.75;
      else if (u < AIR1) {
        const v = (u - AIR0) / (AIR1 - AIR0);
        air = Math.sin(Math.PI * v);
        s = -0.32 * (1 - v * 0.6);
      } else {
        const v = (u - AIR1) / (1 - AIR1);
        s = 0.45 * Math.exp(-4 * v) * Math.cos(v * 9);
      }
    } else {
      s = Math.sin(this.t * 2.2) * 0.05; // idle breathing squish
    }
    this.squash = s;
    this.verticalOffsetM = air * this.hM * (0.35 + 0.35 * this.speedFactor);
    const ky = 1 - s * 0.55;
    const headY = this.hM * 0.82 * ky;
    this.setHeadAnchors(0, headY, this.hr * 0.15);
    this.setAnchor('hips', 0, this.hM * 0.3 * ky, 0);
    this.setAnchor('chest', 0, this.hM * 0.55 * ky, this.hM * 0.05);
    this.setAnchor('back', 0, this.hM * 0.6 * ky, -this.hM * 0.12);
    this.setAnchor('tailRoot', 0, this.hM * 0.28 * ky, -this.hM * 0.14);
    for (const sgn of [-1, 1] as const) {
      const lag = Math.sin(this.t * 6 - 1.2) * 0.04 - s * 0.08;
      this.setAnchor(sgn < 0 ? 'handL' : 'handR', sgn * this.hM * 0.28, this.hM * (0.42 + lag) * ky, this.hM * 0.1);
      this.setAnchor(sgn < 0 ? 'hipL' : 'hipR', sgn * this.hM * 0.2, this.hM * 0.18 * ky, 0);
    }
  }

  buildBody(sink: BallSink): void {
    const s = this.squash;
    const ky = 1 - s * 0.55;
    const kxz = 1 + s * 0.45;
    const B = (x: number, y: number, z: number, r: number) =>
      sink.ball(x * kxz, 0.02 + (y - 0.02) * ky, z * kxz * 0.6 + z * 0.4, r * (1 + s * 0.08));
    const r = this.baseR * 1.25;
    B(0, this.hM * 0.28, 0, r * 1.15);
    B(0, this.hM * 0.55, this.hM * 0.01, r);
    B(0, this.hM * 0.82, this.hM * 0.03, this.hr);
    for (const sgn of [-1, 1] as const) {
      const hand = this.pose.anchors[sgn < 0 ? 'handL' : 'handR'].pos;
      B(hand.x, hand.y, hand.z, r * 0.32);
      B(sgn * this.hM * 0.24, hand.y - this.hM * 0.08, this.hM * 0.12, r * 0.26);
    }
  }
}

/* ---------------------------------------------------------- flyer + float */

class AirborneDriver extends BaseDriver {
  constructor(frame: Frame, private readonly flapping: boolean) {
    super(frame);
  }

  protected advance(t: number): void {
    this.flap = this.flapping ? Math.sin(t * 9) * 0.65 : 0;
    const bob = this.flapping
      ? Math.sin(t * 9 - Math.PI / 2) * this.hM * 0.04
      : Math.sin(t * 1.6) * this.hM * 0.06;
    this.verticalOffsetM = this.hM * (this.flapping ? 0.9 : 0.55) + bob;
    // body floats around local origin; the assembler lifts the body root
    const headZ = this.hM * (this.flapping ? 0.28 : 0.05);
    const headY = this.hM * (this.flapping ? 0.16 : 0.3);
    this.setHeadAnchors(0, headY, headZ);
    this.setAnchor('chest', 0, this.hM * 0.03, this.hM * 0.12);
    this.setAnchor('back', 0, this.hM * 0.1, -this.hM * 0.02);
    this.setAnchor('hips', 0, -this.hM * 0.05, -this.hM * 0.1);
    this.setAnchor('tailRoot', 0, 0, -this.hM * 0.22);
    const dang = Math.sin(this.t * 9 + 1.4) * this.hM * 0.02;
    for (const sgn of [-1, 1] as const) {
      this.setAnchor(sgn < 0 ? 'handL' : 'handR', sgn * this.hM * 0.12, -this.hM * 0.16 + dang, this.hM * 0.08);
      this.setAnchor(sgn < 0 ? 'hipL' : 'hipR', sgn * this.hM * 0.1, -this.hM * 0.2 + dang, -this.hM * 0.02);
    }
  }

  buildBody(sink: BallSink): void {
    const r = this.baseR;
    if (this.flapping) {
      sink.ball(0, 0, -this.hM * 0.02, r);
      sink.ball(0, this.hM * 0.02, this.hM * 0.12, r * 0.9);
      const head = this.pose.anchors.head.pos;
      sink.ball(head.x, head.y, head.z, this.hr);
      // tail feathers
      sink.ball(0, this.hM * 0.02, -this.hM * 0.18, r * 0.6);
      sink.ball(0, this.hM * 0.05, -this.hM * 0.28, r * 0.45);
      // flapping wing lobes merge into the body
      for (const sgn of [-1, 1] as const) {
        for (let i = 1; i <= 4; i++) {
          const d = this.hM * (0.06 + i * 0.09);
          const curl = this.flap * (1 + i * 0.09);
          sink.ball(sgn * d * Math.cos(curl), this.hM * 0.04 + d * Math.sin(curl), -this.hM * 0.03, r * (0.62 - i * 0.06));
        }
      }
      // dangling feet
      for (const sgn of [-1, 1] as const) {
        const hip = this.pose.anchors[sgn < 0 ? 'hipL' : 'hipR'].pos;
        chain(sink, sgn * this.hM * 0.08, -this.hM * 0.08, this.hM * 0.02, hip.x, hip.y, hip.z, 2, r * 0.32, r * 0.26);
      }
    } else {
      // floater: one big rounded mass + side lobes + head lobe, slow pulse
      const pulse = 1 + Math.sin(this.t * 2.4) * 0.04;
      sink.ball(0, 0, 0, r * 1.3 * pulse);
      sink.ball(0, this.hM * 0.12, this.hM * 0.02, r * 1.05);
      for (const sgn of [-1, 1] as const) {
        sink.ball(sgn * r * 0.85, -this.hM * 0.02, 0, r * 0.7 * pulse);
      }
      sink.ball(0, -this.hM * 0.06, -r * 0.8, r * 0.65);
      const head = this.pose.anchors.head.pos;
      sink.ball(head.x, head.y, head.z, this.hr * 1.05);
    }
  }
}

/* ------------------------------------------------------------------ entry */

export function createGaitDriver(gait: Gait, frame: Frame): GaitDriver {
  switch (gait) {
    case 'biped':
      return new BipedDriver(frame);
    case 'quad':
      return new MultiLegDriver(frame, false);
    case 'hexapod':
      return new MultiLegDriver(frame, true);
    case 'hopper':
      return new HopperDriver(frame);
    case 'flyer':
      return new AirborneDriver(frame, true);
    case 'float':
      return new AirborneDriver(frame, false);
    default: {
      const never: never = gait;
      throw new Error(`entities3d: unknown gait "${never as string}"`);
    }
  }
}
