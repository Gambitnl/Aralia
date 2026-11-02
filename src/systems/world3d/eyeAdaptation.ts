/**
 * @file eyeAdaptation.ts — eye adaptation (auto exposure) for the 3D world
 * (GG-594 part 1, Remy's ruling 2026-11-02: "Drop it, add eye adaptation").
 *
 * WHY. A room lit only through its windows gets 1 to 6% of the light outside.
 * That is physically right, but with a fixed exposure the room renders nearly
 * black. A camera-inside fill light used to hide this; it lit every room at any
 * hour and flattened the falloff from the window. The fill is gone. The frame
 * now sets its own exposure from the light it measures, as an eye does: in a
 * dim room the exposure goes up, so the floor under the window reads bright
 * and the back of the room stays dark.
 *
 * THE LOOP (both renderers share it; only the meter and the exposure knob are
 * per renderer):
 *   1. A meter pass draws the linear (pre tone map) frame into a small 8-bit
 *      grid, METER_W by METER_H. Each texel holds the log2 luminance of four
 *      taps in its cell, encoded by `encodeLog2Luminance`.
 *   2. An async readback brings the grid to the CPU every METER_EVERY_FRAMES
 *      frames, with at most one read in flight. It never stalls the GPU.
 *   3. `meterLog2Average` turns the grid into the frame's log2 average
 *      luminance (a geometric mean: a bright window in view does not swamp it).
 *   4. `targetExposure` maps that to an exposure. The KEY is set BELOW the
 *      outdoor day frame, so outdoors the exposure stays at 1 (today's look)
 *      and only a frame much darker than the street is lifted.
 *   5. `adaptExposure` moves the exposure toward the target in log space, with
 *      a slower time constant to brighten (eyes adapt to the dark slowly) than
 *      to darken.
 *   WebGL: an effect in the composer multiplies the color by the exposure just
 *   before the ACES pass. WebGPU: the renderer's `toneMappingExposure`, which
 *   `renderOutput` applies inside its ACES.
 *
 * NIGHT IS NOT ADAPTED (a choice of this slice, recorded in GG-594). The sun
 * model keeps its intensity at night and darkens the look through color, so a
 * frame-only rule would lift the whole night street. `maxExposureAt` lets the
 * full range act only while the sun is up and fades it to 1 over dusk. Night
 * rooms keep the hearth and lamp lights they had.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/11/2026, 23:06:19
 * Dependents: components/World3D/World3DScene.tsx, components/World3D/eyeAdaptationEffect.ts, components/World3D/gpu/worldGpuPost.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/** The constants every meter and controller share. */
export const EYE_ADAPTATION = {
  /** Meter grid size. 64 texels * 4 bytes = 256 bytes a row, the WebGPU copy alignment. */
  METER_W: 64,
  METER_H: 32,
  /** The log2 luminance range the 8-bit meter encodes (18 stops, 0.07 stop a level). */
  LOG2_MIN: -14,
  LOG2_MAX: 4,
  /** Frames between two meter readbacks. */
  METER_EVERY_FRAMES: 4,
  /**
   * Target log2 average luminance. Set by measurement (domain doc, "Eye
   * adaptation"), WebGL town demo at 13 h: the outdoor start view measures
   * -3.6 and a live room -10.4. At -2.6 the street got 2x and washed white;
   * -5 leaves 1.4 stops of margin under the street.
   */
  KEY_LOG2: -5,
  /** The exposure never goes below today's fixed look. */
  MIN_EXPOSURE: 1,
  /** The most a dark frame is lifted (by day). */
  MAX_EXPOSURE: 16,
  /** Seconds (time constant) for the image to brighten, in a dark room. */
  BRIGHTEN_TAU_S: 1.2,
  /** Seconds for the image to darken, back into the light. */
  DARKEN_TAU_S: 0.4,
} as const;

/** Rec. 709 luminance of a linear color. */
export function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The meter's 0..1 code for a luminance (the GLSL and TSL meters do the same). */
export function encodeLog2Luminance(lum: number): number {
  const { LOG2_MIN, LOG2_MAX } = EYE_ADAPTATION;
  const l2 = Math.log2(Math.max(lum, 2 ** LOG2_MIN));
  return Math.min(1, Math.max(0, (l2 - LOG2_MIN) / (LOG2_MAX - LOG2_MIN)));
}

/** The log2 luminance an 8-bit meter code stands for. */
export function decodeLog2Luminance(code: number): number {
  const { LOG2_MIN, LOG2_MAX } = EYE_ADAPTATION;
  return LOG2_MIN + (code / 255) * (LOG2_MAX - LOG2_MIN);
}

/**
 * The frame's log2 average luminance from an RGBA8 meter readback (the code is
 * in the red byte). `rowTexels` is the texel stride of one row in `pixels`
 * when the readback pads its rows; `width` texels of each row are read.
 */
export function meterLog2Average(pixels: ArrayLike<number>, width: number, height: number, rowTexels = width): number {
  let sum = 0;
  for (let y = 0; y < height; y++) {
    const row = y * rowTexels * 4;
    for (let x = 0; x < width; x++) sum += decodeLog2Luminance(pixels[row + x * 4]);
  }
  return sum / (width * height);
}

/**
 * How much of the exposure range the hour allows: 1 while the sun is up, 0 at
 * night, a smooth ramp at dawn and dusk. Mirrors World3DLighting's sun angle
 * (`sin(((h - 6) / 14) * pi)`, positive by day).
 */
export function daylightWeight(hours: number): number {
  const s = Math.sin(((hours - 6) / 14) * Math.PI);
  const t = Math.min(1, Math.max(0, (s + 0.05) / 0.2));
  return t * t * (3 - 2 * t);
}

/** The largest exposure allowed at this hour (1 at night). */
export function maxExposureAt(hours: number): number {
  const { MIN_EXPOSURE, MAX_EXPOSURE } = EYE_ADAPTATION;
  return MIN_EXPOSURE + (MAX_EXPOSURE - MIN_EXPOSURE) * daylightWeight(hours);
}

/** The exposure that brings a frame's log2 average to the key, clamped. */
export function targetExposure(log2Average: number, maxExposure: number, keyLog2: number = EYE_ADAPTATION.KEY_LOG2): number {
  const e = 2 ** (keyLog2 - log2Average);
  return Math.min(Math.max(e, EYE_ADAPTATION.MIN_EXPOSURE), Math.max(maxExposure, EYE_ADAPTATION.MIN_EXPOSURE));
}

/** One time step of adaptation, in log space (frame-rate independent). */
export function adaptExposure(current: number, target: number, dtS: number): number {
  if (!(dtS > 0)) return current;
  const tau = target > current ? EYE_ADAPTATION.BRIGHTEN_TAU_S : EYE_ADAPTATION.DARKEN_TAU_S;
  const k = 1 - Math.exp(-dtS / tau);
  return 2 ** (Math.log2(current) + (Math.log2(target) - Math.log2(current)) * k);
}

/**
 * The per-renderer controller: feed it meter readbacks and the frame time,
 * read `exposure`. A rig sets `hold` to pin the exposure for an A-B.
 */
export class EyeAdaptation {
  /** The exposure to apply this frame (1 = today's fixed look). */
  exposure = 1;
  /** The last measured log2 average luminance, or null before the first read. */
  measuredLog2: number | null = null;
  /** The exposure the controller moves toward. */
  target = 1;
  /** The game hour (sets the allowed range). */
  hours = 13;
  /** A rig override: a fixed exposure, or null to adapt. */
  hold: number | null = null;
  /** The key, kept on the instance so a rig can sweep it. */
  keyLog2: number = EYE_ADAPTATION.KEY_LOG2;
  private frame = 0;
  private reading = false;

  /** True on the frames where a meter readback should start. */
  wantsReading(): boolean {
    this.frame++;
    return !this.reading && this.frame % EYE_ADAPTATION.METER_EVERY_FRAMES === 0;
  }

  /** Run one readback; the promise's pixels feed the meter. Errors drop the read. */
  read(readback: () => Promise<ArrayLike<number>>, width: number, height: number, rowTexels = width): void {
    this.reading = true;
    readback().then((px) => {
      this.measuredLog2 = meterLog2Average(px, width, height, rowTexels);
    }, () => { /* a lost read: the next one measures again */ }).finally(() => { this.reading = false; });
  }

  /** Advance the exposure by `dtS` seconds and return it. */
  step(dtS: number): number {
    if (this.hold !== null) {
      this.exposure = this.hold;
      return this.exposure;
    }
    if (this.measuredLog2 === null) return this.exposure;
    this.target = targetExposure(this.measuredLog2, maxExposureAt(this.hours), this.keyLog2);
    this.exposure = adaptExposure(this.exposure, this.target, Math.min(dtS, 0.25));
    return this.exposure;
  }
}
