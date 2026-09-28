/**
 * @file oceanReflector.ts — an object seen IN the water: the surface's
 * reflected-radiance hook (`setReflector`, round 11 of the buoyancy piece).
 *
 * WHAT THIS IS. The surface reflects the analytic sky along the mirrored
 * view ray (`oceanSurface.ts`, `skyRay`), so no object ever appears in the
 * water. A floating hull does: the Water Pro reference's buoy carries a
 * dark smear under its base, the buoy's own reflection, and the round-10
 * blind judge named it as what ties the hull to the surface. A reader set
 * through `setReflector` gets the water point and the directions the
 * surface already has, traces the mirrored ray against its own proxy, and
 * returns the object's radiance and how much of the pixel's mirrored ray it
 * covers; the surface mixes that into the reflected radiance BEFORE the
 * Fresnel weight, so the reflection dims at a steep view exactly as the
 * sky's does, and the sun's glints on the same pixel stay.
 *
 * THE SHAPE is the seabed hook's (`oceanSeabed.ts`, the refracted ray):
 * one reader or null, the shader rebuilt on set, and with no reader the
 * surface's code is unchanged to the pixel (the hook emits nothing).
 *
 * UNITS. Scene-linear radiance in the surface's units; meters.
 */
/** A TSL node, as `oceanSeabed.ts` types its reader (the node library is untyped here). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TslNode = any;

/** What the surface hands a reflector reader, per water pixel. */
export interface ReflectorShadeInput {
  /** The drawn water point, world meters (the surface's `vWorld`). */
  readonly world: TslNode;
  /** The shading normal, unit, world space: every cascade the pixel resolves. */
  readonly normal: TslNode;
  /**
   * The normal of the long waves only, unit, world space (the surface's
   * body normal). A reader mirrors the view ray in THIS one: the ripple
   * normal flips a nearby object's image pixel by pixel (the hull reader
   * found the same for the refracted ray, round 6).
   */
  readonly normalLong: TslNode;
  /** Unit vector from the water point toward the camera. */
  readonly viewDir: TslNode;
  /**
   * The mirrored view ray the surface reads the sky along, unit, world
   * space, before the roughness bend: reflect(-viewDir, normal).
   */
  readonly reflectDir: TslNode;
  /** The pixel's footprint on the water, long and short axes, meters. */
  readonly longM: TslNode;
  readonly shortM: TslNode;
}

/** What the reader gives back, per water pixel. */
export interface ReflectorShadeOutput {
  /**
   * vec3: the object's radiance along the mirrored ray, scene-linear, in
   * the surface's units (what the object would show a camera looking
   * along that ray).
   */
  readonly radiance: TslNode;
  /**
   * float, 0 to 1: the share of the pixel's mirrored ray the object covers.
   * The surface takes mix(sky, radiance, coverage) as the reflected
   * radiance. A thin or distant object returns a small coverage rather than
   * a dimmed radiance, so its share of the sky stays the sky's color.
   */
  readonly coverage: TslNode;
}

/** A reader the surface calls once per water fragment; see `setReflector`. */
export interface OceanReflectorReader {
  shade(p: ReflectorShadeInput): ReflectorShadeOutput;
}
