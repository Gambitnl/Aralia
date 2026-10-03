/**
 * @file oceanSeabed.ts — the sea floor on the GPU: a sand lagoon under the
 * FFT sea, the caustic web the waves focus onto it, and the reader the water
 * surface calls to see the floor through the water.
 *
 * WHAT IS NEW. The ocean had no floor: it was a deep open sea (TMA depth
 * 1000 m), and the water's color was one deep body everywhere. This module
 * adds a floor under a region of the sea, and three things with it:
 *
 *   1. THE MAP. The floor's depth, seagrass, rock and ripple-mark phase,
 *      computed once on the CPU (`buildSeabedMap` in oceanSeabedMath.ts) and
 *      uploaded as one half-float texture. A static floor, so it is never
 *      computed again.
 *   2. THE CAUSTIC WEB, computed each frame from the real wave normals. Every
 *      cell of the ripple cascade is a small lens: a sun ray enters the
 *      displaced surface there, refracts through its normal (Snell's law,
 *      WGSL `refract`), and lands on the floor. The surface grid is drawn onto
 *      the floor at those landing points, and each triangle adds the ratio of
 *      its surface area to its floor area into a floor texture. Where the
 *      lenses focus, triangles shrink and the ratio climbs: that is the web.
 *      The mean over the tile is exactly 1, so the web moves light and never
 *      adds any. This is done for four floor depths (`CAUSTIC_LAYER_DEPTHS_M`)
 *      over the ripple cascade's periodic 13 m patch. The longer cascades are
 *      too gentle to fold the light at these depths; they shift the web, move
 *      it with their orbital motion and focus or spread it in broad bands,
 *      read per pixel from their own slopes and curvature.
 *   3. THE READER. `reader.shade` runs inside the water surface's fragment
 *      shader. It refracts the view ray through the surface normal, walks it
 *      to the floor, lights the floor there (sun through the water, the
 *      caustic web, skylight), and returns what comes back up: the floor's
 *      light after the path through the water, and the path's transmittance.
 *      The surface keeps its own deep body color for the rest (the water's
 *      in-scatter), so where the floor falls away the water is the open sea.
 *
 * WHAT IS KEPT. The FFT, the sea state and the surface shader are not
 * touched. The reader is handed to the surface through `setSeabed(reader)`,
 * a hook in oceanSurface.ts (owned by the shading builder; the exact change
 * is in the caustics report of the ocean gauntlet). The sea is still a pure
 * function of (seed, time), and so is the web: it is recomputed from the
 * field each frame and holds no state.
 *
 * THE FLOOR MESH is drawn only when the camera is under the water (the
 * underwater piece's view) or the floor reaches the surface. From above the
 * water is opaque and the reader draws the floor, so the mesh would be
 * hidden fragment for fragment; it is not submitted then.
 *
 * STILL OPEN. The surface hook `setSeabed` is routed, not landed (until it
 * lands, the gauntlet's `caustics/surfacePatch.mjs` applies it in a capture
 * browser only). Under the water the floor mesh hazes to a fixed deep color,
 * not the underwater piece's in-scatter, so the two meet in a band where the
 * floor ends. The deep layers' low-pass draws flat triangle facets up close
 * (a per-vertex area ratio would smooth them). Every blind critic that
 * picked this piece still named the web's one cell size and contrast
 * across the frame.
 */
import * as THREE from 'three/webgpu';
import {
  Fn,
  If,
  abs,
  hash,
  bitAnd,
  cameraPosition,
  clamp,
  dFdx,
  dFdy,
  dot,
  exp,
  float,
  int,
  length,
  log2,
  max,
  min,
  mix,
  normalize,
  positionGeometry,
  positionWorld,
  refract,
  select,
  sin,
  cos,
  Discard,
  smoothstep,
  sqrt,
  texture,
  uniform,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import type { OceanField } from './oceanField';
import { createOceanSampler } from './oceanSampler';
import {
  CAUSTIC_LAYER_DEPTHS_M,
  FLOOR_LIGHT,
  GRASS_ALBEDO,
  LAGOON_SEABED,
  LAGOON_WATER,
  ROCK_ALBEDO,
  SAND_ALBEDO,
  SAND_PALE_ALBEDO,
  SUN_ANGULAR_RADIUS,
  WATER_IOR,
  beamSlopeJacobian,
  buildSeabedMap,
  cascadeFocusAt,
  seabedDepthAt,
  splatCausticCpu,
  sunInWater,
  type FloorLight,
  type SeabedMap,
  type SeabedParams,
  type V3,
  type WaterOptics,
} from './oceanSeabedMath';

/** A TSL node expression. See `oceanSurface.ts` for why this is `any`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TslNode = any;

/**
 * Texels per side of one caustic layer, and the finest mip level the floor
 * reads.
 *
 * The ripple patch is 13 m, so 1024 is a 1.27 cm texel, a quarter of the
 * FFT's 5 cm cell, and the floor reads level 1 and coarser: a 2.5 cm texel
 * that is the mean of four. That is supersampling, and it is there for the
 * caustic lines. A surface triangle the lenses squeeze under a texel is
 * rasterized or missed whole, so at 512 with level 0 read, a line drew as a
 * dotted row of texels 50 to 100 times too bright (peak 1123 at 1.5 m
 * against the CPU twin's 30); the energy was right, its placement was not.
 * A 4x multisampled target was tried first and came back empty on this
 * three build (RedFormat half float), so the mean of four is taken by the
 * mip chain instead. At 2.5 cm the sun's own blur at 3 m (1.4 cm,
 * `sunBlurM`) is under a texel. Four layers with their mips are 11 MB.
 */
export const CAUSTIC_RES = 1024;
const CAUSTIC_MIN_LEVEL = 1;

/**
 * Most a surface cell's refracted beam wanders from the flat-sea beam, per
 * meter of depth, for the margin of surface drawn around the tile. The
 * ripple's steepest facets tilt about 0.6 (its slope RMS is 0.17); at that
 * tilt the beam moves 0.16 of the depth, and 0.3 covers it twice over.
 * Beam paths from outside the margin would be lost from the tile, which the
 * probe's mean (1.000 when nothing is lost) would show.
 */
const CAUSTIC_MARGIN_PER_M = 0.3;

/**
 * THE GRID STRIDE of each layer, in FFT cells: the layer's surface grid takes
 * one vertex per stride x stride cells and reads their mean (a box low-pass
 * of the surface). This bounds the pass's fill, which is the cost that
 * matters. Past the first focus the lens map folds, a surface triangle lands
 * stretched across the floor, and the fragments drawn are the floor area of
 * all the triangles: measured on the `shallow` ripple (`caustics/overdraw.ts`
 * in the gauntlet scratch), every cell drawn gave 1.8, 4.7, 15.9 and 60 times
 * the tile at 1.5, 3, 6 and 12 m, 86 million fragments a frame, which cost
 * 30 ms of a contended GPU. With strides 1, 2, 4 and 8 it is 1.8, 1.6, 1.5
 * and 1.35 times, 6.5 million.
 *
 * What the low-pass removes is what the depth removes anyway: a wave of
 * length L and steepness ak focuses at about L / (2 pi^2 (1 - 1/n) ak)
 * meters, so the waves under 0.2 m have folded the light over many times by
 * 3 m and their web is a fine, low-contrast mesh the sun's blur and the
 * forward scatter soften; the web a deep floor shows is the longer waves'.
 */
const CAUSTIC_LAYER_STRIDE: readonly number[] = [1, 2, 4, 8];

/**
 * The floor of the Jacobian in the caustic pass's slope divide. The ripple's
 * own Jacobian minimum on the `shallow` sea is 0.60, so this never binds
 * there; on a sea that folds, it keeps a cusp from sending one beam across
 * the tile.
 */
const CAUSTIC_JAC_FLOOR = 0.2;

/**
 * Where the reader skips the floor: deeper than this, a path to the floor
 * and back keeps under 0.4% of its blue, and the map's rim fades it out over
 * `EDGE_FADE_M` so the region ends in open sea with no seam.
 */
const SEE_DEPTH_MAX_M = 60;
const EDGE_FADE_M = 120;

/**
 * The in-scatter of the lagoon's water column, scene-linear: what a column
 * too deep to show its floor sends back up, the deep water past the reef
 * wall. The surface's own body color is the open sea's calibration, a teal
 * seen steeply ((0.03, 0.14, 0.17), `oceanSurface.ts`), and over the wall it
 * read as a grey teal ((72, 125, 137) sRGB from 110 m) where the task asks
 * for the shallows to deepen to blue. Its hue is this water's: the
 * reflectance of a deep column goes as its back-scatter over its absorption
 * (Gordon et al. 1975, R = 0.33 bb / a); the lagoon absorbs green 1.8 to
 * 2.2 times as fast as blue (`LAGOON_WATER`) and back-scatters blue a little
 * more than green, so B / G is 2.6 here. Its brightness is set by eye to (18, 72, 130) sRGB seen from
 * above through the viewer's tone map, between a photographed fore-reef
 * drop-off and the Water Pro demo's own deep water at a slant (20, 90, 150);
 * `caustics/acesInv.ts` in the gauntlet scratch finds it.
 */
const DEEP_WATER_INSCATTER: V3 = [0.021, 0.074, 0.19];
/** The in-scatter's share left under a full storm deck: the skylight alone (0.315 * 0.93 of 2.4 * 0.866 + 0.29). */
const OVERCAST_INSCATTER = 0.12;

/**
 * THE FLOOR THROUGH THE RIPPLE: the share of the short waves (the cascades
 * under 20 m, which the surface leaves out of its body normal) in the normal
 * the view ray refracts through, by how steeply the eye looks down.
 *
 * Looking down within about 25 degrees of the vertical (the view vector's
 * up component over REFRACT_STEEP_UP[1]) the share is 1, the physics: a
 * facet's tilt turns the ray by (1 - 1/n) of the tilt, the floor's image
 * moves a few centimeters at lagoon depths, and the eye reads the floor
 * wobbling under the ripple. At a grazing view Snell's law saturates near
 * the critical angle and the ray turns by the WHOLE tilt, meters on the
 * floor, and the full ripple scrambled the floor to noise at eye level
 * (photographed at 0, 0.35 and 0.7: only 0 kept the web). There the share
 * is REFRACT_RIPPLE, which keeps the chop's bending and a trace of the
 * ripple's. This is a stylization at grazing, as the surface's reflection
 * normal carries less ripple than its glints (`oceanSurface.ts`).
 */
const REFRACT_RIPPLE = 0.15;
const REFRACT_STEEP_UP: readonly [number, number] = [0.6, 0.9];

/**
 * Forward scattering, per meter of path, for the floor's detail. Clear
 * lagoon water scatters 0.05 to 0.3 of the light per meter (Petzold's clear
 * ocean 0.037, coastal 0.2 and up), and nearly all of it by a few degrees,
 * which blurs a caustic line or a sand grain over the path as a halo tens of
 * centimeters wide. So the web's contrast falls as exp(-b (down + up)): 0.8
 * over 2 m of water seen from above, 0.6 over 4 m, 0.3 over 12 m. Two blind
 * critics named the web's even strength from the shallows to the wall
 * ("like a texture pasted flat") as the winner's weakest point.
 */
const FWD_SCATTER_PER_M = 0.05;

/**
 * The web is read at a blur of at least this many texels of the tile: at the
 * finest level a rasterized caustic line is a ragged row of texels, and
 * magnified under a close camera it drew as beads.
 */
const CAUSTIC_MIN_BLUR_TEXELS = 2;

/** Ripple troughs' albedo loss at their bottom (detritus and heavy grains). */
const RIPPLE_TROUGH_DARKEN = 0.3;

/** Sand grain speckle: cell size, meters, and brightness spread (+-half). */
const GRAIN_M = 0.012;
const GRAIN_CONTRAST = 0.16;

/**
 * Fixed-point steps of the refracted ray's walk to the floor. See
 * `hitFloorCpu`: the map contracts, and three steps land within a few
 * millimeters on the lagoon's slopes.
 */
const HIT_STEPS = 3;

/** The least focusing, at the deepest layer, for a long cascade to be read. */
const LONG_FOCUS_MIN = 0.01;

/** What the surface hands the reader, per water pixel. */
export interface SeabedShadeInput {
  /** The drawn water point, world meters (the surface's `vWorld`). */
  readonly world: TslNode;
  /** The shading normal, unit, world space: every cascade the pixel resolves. */
  readonly normal: TslNode;
  /**
   * The normal of the long waves only, unit, world space: the surface's body
   * normal (cascades whose longest wave is 20 m or more). The floor is seen
   * through a mix of the two; see `refractRipple`.
   */
  readonly normalLong: TslNode;
  /** Unit vector from the water point toward the camera. */
  readonly viewDir: TslNode;
  /** The pixel's footprint on the water, long and short axes, meters. */
  readonly longM: TslNode;
  readonly shortM: TslNode;
  /**
   * Optional: true when the shore hook's own water calls the reader (the
   * beach's sheet for its deep part), not the sea's surface. The hook's
   * `waterFoam` receives it; absent, false (round 5 of the beach).
   */
  readonly own?: boolean;
}

/** What the reader gives back, per water pixel. */
export interface SeabedShadeOutput {
  /**
   * vec3: the transmittance of the path from the water point down to the
   * floor, per channel. The surface scales its body by (1 - trans): the body
   * is the in-scatter of an infinitely deep column, and a floor at this path
   * hides the rest of it.
   */
  readonly trans: TslNode;
  /** vec3: the floor's light after the path, in the surface's scene-linear units. */
  readonly through: TslNode;
  /**
   * Optional float 0 to 1: the share of the sea's sun glints this pixel
   * keeps. The beach needs it where the sea's surface pokes above the sand
   * at a wave crest (water a few centimeters deep or none): those glints
   * drew white chips on the beach face. Absent: every glint stays, and the
   * surface builds exactly as before (2026-09-28).
   */
  readonly glint?: TslNode;
  /**
   * Optional float 0 to 1: the share of the sea's own foam (its whitecaps and
   * the persistent foam field) this pixel keeps. The beach draws its own surf
   * foam from its swash grid, and the sea's crests over the patch drew clipped
   * white specks and a white crest polygon there (beach round 9). Absent: the
   * sea's foam is unchanged, and the surface builds exactly as before.
   */
  readonly seaFoam?: TslNode;
  /**
   * Optional float 0 or 1: 1 asks the surface to draw nothing at this pixel.
   * The beach sets it over its patch where its own swash grid holds the water:
   * there the sea's crest, standing over the swash sheet, drew a darker patch
   * with straight sides (beach round 10). Absent: the surface draws as before.
   */
  readonly hide?: TslNode;
}

/** The surface hook: `surface.setSeabed(reader)` calls `shade` from its fragment shader. */
export interface OceanSeabedReader {
  shade(p: SeabedShadeInput): SeabedShadeOutput;
}

export interface OceanSeabedOptions {
  readonly field: OceanField;
  /** Unit vector toward the sun: the sky's `sunDir`, which the surface also has. */
  readonly sunDir: THREE.Vector3;
  /** The sky's `uOvercast` node: under a deck the floor has skylight only. */
  readonly overcast?: TslNode;
  readonly params?: SeabedParams;
  readonly optics?: WaterOptics;
  readonly light?: FloorLight;
  /**
   * The beach piece's hook (`oceanBeach.ts`). Absent for the lagoon: the
   * floor, the reader and the floor mesh then build exactly as before.
   */
  readonly shore?: SeabedShoreHook;
}

/**
 * WHAT THE BEACH TELLS THE FLOOR. The beach draws its own sand, its swash
 * sheet and its debris over a patch of the island's shore; the floor keeps
 * drawing everything else and the water over it.
 */
export interface SeabedShoreHook {
  /** 1 where the beach draws the ground itself (the floor mesh discards there), else 0. World XZ in. */
  owns(xz: TslNode): TslNode;
  /**
   * The floor's albedo at a floor point, from the seabed's own: the beach's
   * wet and drying sand where it has a state, the seabed's albedo elsewhere.
   * `depth` is the floor's depth under the mean sea level (negative on land);
   * `footM` the pixel's footprint on the floor, m (for detail that must fade).
   */
  floorAlbedo(xz: TslNode, depth: TslNode, albedo: TslNode, footM: TslNode): TslNode;
  /**
   * The foam on the SEA SURFACE at a water point, over a column of `column`
   * meters: the beach's foam field where the sea's own surface is the water
   * the eye sees (seaward of the swash sheet). `cover` 0 to 1 and the foam's
   * scene-linear radiance. `footM` is the pixel's footprint on the water, m
   * (the reader's own), so the hook takes no derivative of its own.
   * `viewDir` is the unit vector from the water point toward the eye (round
   * 5 of the beach: the film's sky reflection); a hook may ignore it.
   */
  waterFoam(xz: TslNode, column: TslNode, footM: TslNode, viewDir: TslNode, own?: boolean): { cover: TslNode; radiance: TslNode };
  /**
   * How much of the floor's fine detail (the caustic web, the ripple marks,
   * the grain) survives the water over it, 0 to 1, on top of the lagoon's
   * own clear-water loss: the beach's suspended sand. Optional.
   */
  floorClarity?(xz: TslNode): TslNode;
  /**
   * The sand's grain speckle at a floor point, -0.5 to 0.5, in place of the
   * floor's square-cell speckle (`cellGrain`, handed in for the points the
   * hook does not own). Optional.
   */
  grain?(xz: TslNode, footM: TslNode, cellGrain: TslNode): TslNode;
  /**
   * The share of the sea's sun glints a water point keeps, 0 to 1, over a
   * column of `column` meters (the water from the sea's surface down to the
   * floor). The reader returns it as `SeabedShadeOutput.glint`. Optional:
   * absent, the reader returns no `glint` and the surface keeps every glint
   * (round 4 of the beach, 2026-09-28).
   */
  waterGlint?(xz: TslNode, column: TslNode): TslNode;
  /**
   * The share of the sea's own foam a water point keeps, 0 to 1, over a column
   * of `column` meters. The reader returns it as `SeabedShadeOutput.seaFoam`.
   * Optional: absent, the reader returns no `seaFoam` and the sea's foam is
   * unchanged (round 9 of the beach, 2026-09-28).
   */
  waterSeaFoam?(xz: TslNode, column: TslNode): TslNode;
  /**
   * 1 where the surface should draw nothing at a water point (the beach's own
   * water shows there), else 0. The reader returns it as
   * `SeabedShadeOutput.hide`. Optional: absent, no `hide` (beach round 10).
   */
  waterHide?(xz: TslNode, column: TslNode): TslNode;
  /**
   * The water the reader's path to the floor crosses, m, at a water point over
   * a column of `column` m, 0 to `column`: the beach's own water depth where
   * the sea's surface stands over its swash grid (the grid carries the real
   * water there; the sea's crest over the beach face is the offshore field).
   * The path's loss and in-scatter scale by it over `column`. Optional:
   * absent, the whole column counts, as before (round 5 of the beach).
   */
  waterColumn?(xz: TslNode, column: TslNode): TslNode;
}

export interface OceanSeabed {
  readonly map: SeabedMap;
  readonly reader: OceanSeabedReader;
  /** The floor mesh; add it to the scene. It shows only when it can be seen. */
  readonly mesh: THREE.Mesh;
  /** The caustic layers: one render target, a layer per channel, `CAUSTIC_LAYER_DEPTHS_M` order. */
  readonly layers: THREE.RenderTarget;
  /**
   * Draw the caustic web for the field's current time. Call once a frame
   * AFTER `field.step` and before the scene renders.
   */
  step(renderer: THREE.WebGPURenderer, camera: THREE.Camera): void;
  dispose(): void;
  /** Capture and proof hooks; see the mount, `oceanExtras/seabed.ts`. */
  readonly probe: Record<string, unknown>;
  /**
   * The floor's light at a floor point, the function the reader and the
   * floor mesh use: `xz` world, `footM` the pixel's footprint, `viewPathM`
   * the path through the water to the eye (0 on dry land). The beach's sand
   * mesh lights its sand with it, so its sand and the floor's meet.
   */
  floorRadianceAt(xz: TslNode, footM: TslNode, viewPathM: TslNode): TslNode;
}

function v3(a: V3): TslNode {
  return vec3(a[0], a[1], a[2]);
}

/** Build the floor, its caustic passes and the surface reader. */
export function createOceanSeabed(opts: OceanSeabedOptions): OceanSeabed {
  const { field } = opts;
  const params = opts.params ?? LAGOON_SEABED;
  const optics = opts.optics ?? LAGOON_WATER;
  const light = opts.light ?? FLOOR_LIGHT;
  const bufs = field.buffers;
  const n = bufs.n;
  const cascades = field.cascades;

  // The ripple is the cascade with the smallest patch: its waves are the
  // lenses that fold the light at lagoon depths (see CAUSTIC_LAYER_DEPTHS_M).
  let rippleIdx = 0;
  for (let i = 1; i < cascades.length; i += 1) if (cascades[i].patchM < cascades[rippleIdx].patchM) rippleIdx = i;
  const ripple = cascades[rippleIdx];
  const tileM = ripple.patchM;
  const tileTexelM = tileM / CAUSTIC_RES;

  const sunV: V3 = [opts.sunDir.x, opts.sunDir.y, opts.sunDir.z];
  const sun = sunInWater(sunV);
  const jac = beamSlopeJacobian(sunV);
  // The sun's ray as it arrives, in the air: the caustic pass refracts THIS
  // through each facet. (`sun.down` is the flat sea's refracted beam; bending
  // it a second time moved every layer off the flat-sea offset, which the
  // GPU-CPU cross-check caught as a correlation near 0.)
  const uSunIn = uniform(new THREE.Vector3(-sunV[0], -sunV[1], -sunV[2]).normalize());
  /** The sun in the air, toward it: the light of dry land (a map with land only). */
  const uSunAir = uniform(new THREE.Vector3(sunV[0], sunV[1], sunV[2]).normalize());
  const uOvercast: TslNode = opts.overcast ?? uniform(0);
  const sunVis = float(1).sub(uOvercast);
  /**
   * Tuning channel, as the surface's `tune`: named uniforms whose defaults
   * are the shipped values, so a capture rig compares values in one page
   * load. Nothing in the game sets them.
   *   longFocus  weight of the long waves' focusing of the web (1 = physical)
   *   longShift  weight of the long waves' shift and orbital carry (1)
   *   webGain    the web's contrast about its mean (1 = physical)
   *   refractRipple  share of the short waves in the normal the view ray
   *              refracts through; see THE FLOOR THROUGH THE RIPPLE
   */
  const tune = {
    longFocus: uniform(1),
    longShift: uniform(1),
    webGain: uniform(1),
    refractRipple: uniform(REFRACT_RIPPLE),
  };

  /* --- the map ---------------------------------------------------- */

  const map = buildSeabedMap(params);
  /** The map holds ground above the mean sea level (the beach's cay). The lagoon has none. */
  const hasLand = map.minDepthM < 0;
  const half = new Uint16Array(map.data.length);
  for (let i = 0; i < map.data.length; i += 1) half[i] = THREE.DataUtils.toHalfFloat(map.data[i]);
  const mapTex = new THREE.DataTexture(half, map.res, map.res, THREE.RGBAFormat, THREE.HalfFloatType);
  mapTex.minFilter = THREE.LinearFilter;
  mapTex.magFilter = THREE.LinearFilter;
  mapTex.wrapS = THREE.ClampToEdgeWrapping;
  mapTex.wrapT = THREE.ClampToEdgeWrapping;
  mapTex.generateMipmaps = false;
  mapTex.flipY = false;
  mapTex.needsUpdate = true;
  // World XZ to map UV: texel centers at origin + i * texel, as `seabedDepthAt`.
  const mapScale = 1 / (map.texelM * map.res);
  const mapOffX = (0.5 * map.texelM - map.originX) * mapScale;
  const mapOffZ = (0.5 * map.texelM - map.originZ) * mapScale;
  const mapUV = (xz: TslNode): TslNode => vec2(xz.x.mul(mapScale).add(mapOffX), xz.y.mul(mapScale).add(mapOffZ));
  const mapAt = (xz: TslNode): TslNode => texture(mapTex, mapUV(xz)).level(float(0));
  const depthAt = (xz: TslNode): TslNode => mapAt(xz).x;
  // Distance inside the map's square, for the rim fade.
  const halfExt = params.extentM / 2;
  const insideMap = (xz: TslNode): TslNode => {
    const dx = float(halfExt).sub(abs(xz.x.sub(params.centerX)));
    const dz = float(halfExt).sub(abs(xz.y.sub(params.centerZ)));
    return min(dx, dz);
  };

  /* --- the caustic layers ------------------------------------------ */

  // `filtered`: the refraction's plane reads go through the bordered
  // atlases (performance pass, iteration 5; see oceanSampler.ts).
  const { disp, norm, sampleCascade } = createOceanSampler(bufs, uniform(new THREE.Vector2(0, 0)), { filtered: true });
  const cells = n * n;
  const nMask = n - 1;
  const cascadeTexelM = ripple.patchM / n;

  // ONE TARGET, ONE PASS: the four layers are the four channels of one
  // RGBA half-float target, each layer's mesh adding into its own channel.
  // Four targets cost four render passes and four mip chains a frame (44
  // passes), and the CPU's cost per pass alone measured 4.5 ms a step; one
  // target is one pass and one chain, and the floor reads all four layers
  // in one tap.
  if (CAUSTIC_LAYER_DEPTHS_M.length !== 4) {
    throw new Error('[ocean] The caustic layers are the four channels of one target; there must be four.');
  }
  const causticRT = new THREE.RenderTarget(CAUSTIC_RES, CAUSTIC_RES, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    depthBuffer: false,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
  });
  causticRT.texture.name = 'seabed-caustic-layers';
  const causticScene = new THREE.Scene();
  const layerGeoms: THREE.BufferGeometry[] = [];
  const layerMats: THREE.NodeMaterial[] = [];
  if (CAUSTIC_LAYER_STRIDE.length !== CAUSTIC_LAYER_DEPTHS_M.length) {
    throw new Error('[ocean] Every caustic layer needs a grid stride.');
  }
  for (let layer = 0; layer < CAUSTIC_LAYER_DEPTHS_M.length; layer += 1) {
    const depthL = CAUSTIC_LAYER_DEPTHS_M[layer];
    const stride = CAUSTIC_LAYER_STRIDE[layer];

    // The surface grid over the tile and a margin around it, one vertex per
    // `stride` x `stride` FFT cells (CAUSTIC_LAYER_STRIDE). Position holds the
    // integer index of the block's first cell.
    const margin = Math.ceil((depthL * CAUSTIC_MARGIN_PER_M + 0.2) / (cascadeTexelM * stride));
    const side = n / stride + 2 * margin;
    const pos = new Float32Array(side * side * 3);
    for (let j = 0; j < side; j += 1) {
      for (let i = 0; i < side; i += 1) {
        const o = (j * side + i) * 3;
        pos[o] = (i - margin) * stride;
        pos[o + 1] = 0;
        pos[o + 2] = (j - margin) * stride;
      }
    }
    const idx = new Uint32Array((side - 1) * (side - 1) * 6);
    let k = 0;
    for (let j = 0; j < side - 1; j += 1) {
      for (let i = 0; i < side - 1; i += 1) {
        const a = j * side + i;
        idx[k++] = a; idx[k++] = a + side; idx[k++] = a + 1;
        idx[k++] = a + 1; idx[k++] = a + side; idx[k++] = a + side + 1;
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setIndex(new THREE.BufferAttribute(idx, 1));
    geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    layerGeoms.push(geom);

    const mat = new THREE.MeshBasicNodeMaterial();
    // THE LENS. Read the ripple cell exactly (no filter: a vertex sits on a
    // cell; on a coarse layer, the mean of its stride x stride cells), enter
    // the displaced surface, refract, land on the floor.
    const ci = int(positionGeometry.x);
    const cj = int(positionGeometry.z);
    const cellAt = (di: number, dj: number) => int(rippleIdx * cells)
      .add(bitAnd(cj.add(int(dj)), int(nMask)).mul(int(n))).add(bitAnd(ci.add(int(di)), int(nMask)));
    // The block mean (one cell at stride 1). `blockMeanCpu` is the CPU twin
    // the cross-check uses.
    let d: TslNode = disp.element(cellAt(0, 0));
    let nn: TslNode = norm.element(cellAt(0, 0));
    for (let dj = 0; dj < stride; dj += 1) {
      for (let di = 0; di < stride; di += 1) {
        if (di === 0 && dj === 0) continue;
        d = d.add(disp.element(cellAt(di, dj)));
        nn = nn.add(norm.element(cellAt(di, dj)));
      }
    }
    if (stride > 1) {
      d = d.mul(1 / (stride * stride));
      nn = nn.mul(1 / (stride * stride));
    }
    // The cell block's center: a coarse vertex stands for its whole block.
    const gridM = vec2(positionGeometry.x, positionGeometry.z).add((stride - 1) / 2).mul(cascadeTexelM);
    const entry = gridM.add(vec2(d.x, d.z));
    const slope = vec2(nn.x, nn.y).div(max(nn.z, float(CAUSTIC_JAC_FLOOR)));
    const nrm = normalize(vec3(slope.x, float(1), slope.y));
    const beam = refract(uSunIn, nrm, float(1 / WATER_IOR));
    // Path to a floor depthL under the mean level from a surface at height
    // d.y, less the flat-sea beam's travel to the same depth, so the layers
    // line up (see `causticTileShift`).
    const run = float(depthL).add(d.y).div(max(beam.y.negate(), float(0.05)));
    const land = entry.add(vec2(beam.x, beam.z).mul(run))
      .sub(vec2(sun.offsetPerM[0], sun.offsetPerM[1]).mul(depthL));
    // Straight to clip space over the tile: u, v in [0, 1] -> [-1, 1].
    const uv = land.div(tileM);
    mat.vertexNode = vec4(uv.x.mul(2).sub(1), uv.y.mul(2).sub(1), float(0.5), float(1));
    // THE RATIO OF AREAS. `src` is linear across a triangle, so its screen
    // derivatives are that triangle's surface area per floor texel.
    const src = varying(entry, 'vCausticSrc');
    const ax = dFdx(src);
    const ay = dFdy(src);
    const ratio = abs(ax.x.mul(ay.y).sub(ax.y.mul(ay.x))).div(tileTexelM * tileTexelM);
    mat.fragmentNode = vec4(
      layer === 0 ? ratio : float(0), layer === 1 ? ratio : float(0),
      layer === 2 ? ratio : float(0), layer === 3 ? ratio : float(0),
    );
    mat.transparent = true;
    mat.blending = THREE.CustomBlending;
    mat.blendEquation = THREE.AddEquation;
    mat.blendSrc = THREE.OneFactor;
    mat.blendDst = THREE.OneFactor;
    mat.blendSrcAlpha = THREE.OneFactor;
    mat.blendDstAlpha = THREE.OneFactor;
    mat.depthTest = false;
    mat.depthWrite = false;
    mat.side = THREE.DoubleSide;
    mat.toneMapped = false;
    layerMats.push(mat);

    const mesh = new THREE.Mesh(geom, mat);
    mesh.frustumCulled = false;
    causticScene.add(mesh);
  }
  const layerCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  /* --- the floor's light -------------------------------------------- */

  // The long cascades: everything but the ripple.
  // Only a long cascade whose curvature focuses the web by a percent or more
  // at the deepest layer is read (`cascadeFocusAt`): on `shallow` the chop
  // (23% RMS at 4 m, 68% at 12 m) and not the swell (0.2% at 4 m, 0.65% at
  // 12 m). Each one costs four bilinear reads a water pixel.
  const deepest = CAUSTIC_LAYER_DEPTHS_M[CAUSTIC_LAYER_DEPTHS_M.length - 1];
  const longIdx = cascades.map((_, i) => i).filter((i) => i !== rippleIdx
    && cascadeFocusAt(cascades[i], n, deepest) >= LONG_FOCUS_MIN);

  /**
   * THE LONG WAVES ON THE WEB. At the beam's entry point `q`: the long
   * cascades' horizontal displacement carries the ripple (and its web) with
   * the water's orbital motion; their slope shifts the landing point by
   * depth * J * slope; their curvature focuses or spreads it by
   * 1 / det(I + depth * J * H). Returns vec4(shift.xy, focus, height).
   */
  const longWaves = (q: TslNode, depth: TslNode): TslNode => {
    let dSum: TslNode = vec2(0, 0);
    let hSum: TslNode = float(0);
    let sx: TslNode = float(0); let sz: TslNode = float(0);
    let hxx: TslNode = float(0); let hxz: TslNode = float(0);
    let hzx: TslNode = float(0); let hzz: TslNode = float(0);
    for (const i of longIdx) {
      const c = cascades[i];
      const e = c.patchM / n;
      const dd = sampleCascade(disp, q, i, c.patchM);
      dSum = dSum.add(vec2(dd.x, dd.z));
      hSum = hSum.add(dd.y);
      const sl = (p: TslNode): TslNode => {
        const nm = sampleCascade(norm, p, i, c.patchM);
        return vec2(nm.x, nm.y).div(max(nm.z, float(0.3)));
      };
      const s0 = sl(q);
      const s1 = sl(q.add(vec2(e, 0)));
      const s2 = sl(q.add(vec2(0, e)));
      sx = sx.add(s0.x); sz = sz.add(s0.y);
      hxx = hxx.add(s1.x.sub(s0.x).div(e)); hzx = hzx.add(s1.y.sub(s0.y).div(e));
      hxz = hxz.add(s2.x.sub(s0.x).div(e)); hzz = hzz.add(s2.y.sub(s0.y).div(e));
    }
    const [j00, j01, j10, j11] = jac;
    // Shift: depth * J s.
    const shx = depth.mul(sx.mul(j00).add(sz.mul(j01)));
    const shz = depth.mul(sx.mul(j10).add(sz.mul(j11)));
    // M = I + depth * J H, with H = d(slope)/d(x, z).
    const m00 = float(1).add(depth.mul(hxx.mul(j00).add(hzx.mul(j01))));
    const m01 = depth.mul(hxz.mul(j00).add(hzz.mul(j01)));
    const m10 = depth.mul(hxx.mul(j10).add(hzx.mul(j11)));
    const m11 = float(1).add(depth.mul(hxz.mul(j10).add(hzz.mul(j11))));
    const det = abs(m00.mul(m11).sub(m01.mul(m10)));
    const focus = mix(float(1), float(1).div(clamp(det, float(0.35), float(3))), tune.longFocus);
    return vec4(dSum.x.add(shx).mul(tune.longShift), dSum.y.add(shz).mul(tune.longShift), focus, hSum);
  };

  const causticTex = causticRT.texture;
  const lnLayers = CAUSTIC_LAYER_DEPTHS_M.map((d) => Math.log(d));
  const angW = SUN_ANGULAR_RADIUS * (sun.cosAir / (WATER_IOR * sun.cosWater));

  /**
   * THE WEB AT A FLOOR POINT. Blend the two layers around this depth in log
   * depth (`causticLayerWeights`), read at the point moved back along the
   * flat-sea beam and by the long waves, at the mip level of the larger of
   * the pixel's footprint and the sun's blur (`sunBlurM`).
   */
  const causticAt = (xz: TslNode, depth: TslNode, footM: TslNode, clarity: TslNode): TslNode => {
    const q = xz.sub(vec2(sun.offsetPerM[0], sun.offsetPerM[1]).mul(depth));
    const lw = longWaves(q, depth).toVar();
    const dEff = max(depth.add(lw.w), float(0.05));
    const uv = q.sub(vec2(lw.x, lw.y)).div(tileM);
    const blur = dEff.div(sun.cosWater).mul(angW).mul(2);
    const lvl = clamp(log2(max(max(footM, blur), float(CAUSTIC_MIN_BLUR_TEXELS * tileTexelM)).div(tileTexelM)), float(CAUSTIC_MIN_LEVEL), float(10));
    const ld = log(dEff);
    // Hat weights in log depth: 1 at the layer, 0 at its neighbours; the
    // ends hold their layer past it. One tap reads all four layers.
    const nL = lnLayers.length;
    const ws: TslNode[] = [];
    for (let i = 0; i < nL; i += 1) {
      if (i === 0) {
        ws.push(float(1).sub(clamp(ld.sub(lnLayers[0]).div(lnLayers[1] - lnLayers[0]), float(0), float(1))));
      } else if (i === nL - 1) {
        ws.push(clamp(ld.sub(lnLayers[i - 1]).div(lnLayers[i] - lnLayers[i - 1]), float(0), float(1)));
      } else {
        const up = clamp(ld.sub(lnLayers[i - 1]).div(lnLayers[i] - lnLayers[i - 1]), float(0), float(1));
        const dn = float(1).sub(clamp(ld.sub(lnLayers[i]).div(lnLayers[i + 1] - lnLayers[i]), float(0), float(1)));
        ws.push(min(up, dn));
      }
    }
    const acc = dot(texture(causticTex, uv).level(lvl), vec4(ws[0], ws[1], ws[2], ws[3]));
    // Above the first layer the web fades to flat light at the waterline.
    // FORWARD SCATTERING fades it with the light's path down (the beam's) and
    // the image's path up (`clarity`, the caller's): see FWD_SCATTER_PER_M.
    const contrast = clamp(dEff.div(CAUSTIC_LAYER_DEPTHS_M[0]), float(0), float(1))
      .mul(exp(dEff.div(sun.cosWater).mul(-FWD_SCATTER_PER_M))).mul(clarity);
    return float(1).add(acc.sub(1).mul(contrast).mul(tune.webGain)).mul(lw.z);
  };

  const beamW = light.sunE * sun.transmit * (sun.cosAir / sun.cosWater);
  const downPerM = v3(optics.downPerM);
  const upPerM = v3(optics.upPerM);
  const sunUpW = vec3(-sun.down[0], -sun.down[1], -sun.down[2]);
  const ripK = (2 * Math.PI) / params.rippleLengthM;
  const ripDir = vec2(Math.cos(params.rippleDirRad), Math.sin(params.rippleDirRad));

  /**
   * THE FLOOR AT A POINT: its normal (the map's slope, plus the ripple marks
   * as a normal), its albedo, and its light. `floorRadianceCpu` is the twin
   * for a flat floor.
   */
  const floorRadiance = (xz: TslNode, footM: TslNode, viewPathM: TslNode): TslNode => {
    // How much of the floor's fine detail survives the path up to the eye.
    const clarityLagoon = exp(viewPathM.mul(-FWD_SCATTER_PER_M));
    // THE SAND IN THE SURF (the hook, optional): suspended sand scatters the
    // floor's image forward, so the web and the fine detail blur away there.
    const clarity = (opts.shore?.floorClarity ? clarityLagoon.mul(opts.shore.floorClarity(xz)) : clarityLagoon).toVar();
    const e = map.texelM;
    const m = mapAt(xz).toVar();
    const mxp = mapAt(xz.add(vec2(e, 0)));
    const mxm = mapAt(xz.sub(vec2(e, 0)));
    const mzp = mapAt(xz.add(vec2(0, e)));
    const mzm = mapAt(xz.sub(vec2(0, e)));
    const depth = m.x;
    // The floor is y = -depth, so its normal is (d depth/dx, 1, d depth/dz).
    const gx = mxp.x.sub(mxm.x).div(2 * e);
    const gz = mzp.x.sub(mzm.x).div(2 * e);
    // RIPPLE MARKS: a trochoid-like profile (sharp crests, broad troughs),
    // its phase bent by the map's warp. Gone where the footprint cannot hold
    // one (a quarter to two thirds of a wavelength), on grass and rock, and
    // below the swell's reach.
    const wgx = mxp.w.sub(mxm.w).div(2 * e);
    const wgz = mzp.w.sub(mzm.w).div(2 * e);
    const phase = dot(xz, ripDir).mul(ripK).add(m.w.mul(2 * Math.PI));
    const dhdp = cos(phase).add(sin(phase.mul(2)).mul(0.5));
    const ampSea = float(params.rippleHeightM / 2)
      .mul(float(1).sub(m.y)).mul(float(1).sub(m.z))
      .mul(float(1).sub(smoothstep(float(5), float(14), depth)))
      .mul(float(1).sub(smoothstep(float(params.rippleLengthM / 4), float(params.rippleLengthM / 1.5), footM)))
      .mul(clarity);
    // THE SHORE (a map with land only): the swash planes the beach face
    // smooth, so the wave ripples start under 0.3 m of water and are full
    // by 1.2 m (Clifton 1976: a plane bed where the orbital flow is fast).
    // Without land no node is added.
    const amp = hasLand ? ampSea.mul(smoothstep(float(0.3), float(1.2), depth)) : ampSea;
    const kx = ripDir.x.mul(ripK).add(wgx.mul(2 * Math.PI));
    const kz = ripDir.y.mul(ripK).add(wgz.mul(2 * Math.PI));
    const rhx = amp.mul(dhdp).mul(kx);
    const rhz = amp.mul(dhdp).mul(kz);
    const nF = normalize(vec3(gx.sub(rhx), float(1), gz.sub(rhz))).toVar();

    // ALBEDO: carbonate sand, paler in the shallows (fine sand settles where
    // the water is calm; `SAND_PALE_ALBEDO`), with a slow tint wander from
    // the warp field; seagrass and rock over it.
    const tint = clamp(float(0.55).add(sin(m.w.mul(1.7).add(depth.mul(0.35))).mul(0.25))
      .add(float(1).sub(smoothstep(float(1.2), float(5), depth)).mul(0.3)), float(0), float(1));
    // RIPPLE TROUGHS ARE DARKER. A wave ripple sorts its bed: the fine
    // organic detritus and the heavy grains settle in the troughs and the
    // clean coarse sand stays on the crests, so ripples show as bands of tone
    // whatever the sun's side (RIPPLE_TROUGH_DARKEN at the trough bottom).
    const prof = sin(phase).sub(cos(phase.mul(2)).mul(0.25));
    const trough = smoothstep(float(0.1), float(-0.9), prof).mul(amp.div(params.rippleHeightM / 2));
    // SAND GRAIN: a speckle of one value per GRAIN_M cell, gone once a pixel
    // holds several cells and with the image's clarity.
    const gc = xz.div(GRAIN_M).floor();
    const grainCell = hash(int(gc.x).mul(int(73856093)).bitXor(int(gc.y).mul(int(19349663)))).sub(0.5)
      .mul(float(1).sub(smoothstep(float(GRAIN_M * 0.5), float(GRAIN_M * 2), footM))).mul(clarity);
    // The shore hook may draw its own grain (the beach's, smooth where the
    // square cells show up close); without one the cells are unchanged.
    const grain = opts.shore?.grain ? opts.shore.grain(xz, footM, grainCell).mul(clarity) : grainCell;
    const sandTone = float(1).sub(trough.mul(RIPPLE_TROUGH_DARKEN)).add(grain.mul(GRAIN_CONTRAST));
    const sandLagoon = mix(v3(SAND_ALBEDO), v3(SAND_PALE_ALBEDO), tint).mul(sandTone);
    // THE ISLAND'S OWN SAND (a map with land only): the beach's albedo on the
    // island and under the water near it, full above 0.3 m of depth and gone
    // by 2 m, where the lagoon's carbonate takes over.
    const isl = params.island;
    const sand = hasLand && isl
      ? mix(sandLagoon, v3(isl.sandAlbedo).mul(sandTone), smoothstep(float(2), float(0.3), depth))
      : sandLagoon;
    const albedo0 = mix(mix(sand, v3(GRASS_ALBEDO), m.y), v3(ROCK_ALBEDO), m.z);
    // The beach's wet sand where it has a state (the hook); the seabed's own elsewhere.
    const albedo = opts.shore ? opts.shore.floorAlbedo(xz, depth, albedo0, footM) : albedo0;

    // LIGHT: the sun beam through the water (its Fresnel and slant are in
    // `beamW`), focused by the web, on this facet; the skylight through the
    // water, on the facet's upward share. A seagrass canopy scatters the web.
    const causticSea = mix(causticAt(xz, depth, footM, clarity), float(1), m.y.mul(0.7));
    // No web on dry land (a map with land only): it fades out over the last
    // 2 cm of water, where a sheet can no longer focus the sun.
    const caustic = hasLand ? mix(causticSea, float(1), smoothstep(float(0.02), float(-0.02), depth)) : causticSea;
    const cosF = max(dot(nF, sunUpW), float(0));
    // On land (a map with land only) the light has no water to cross: the
    // depth of its path is floored at 0, or dry sand would shine brighter
    // than the sun.
    const pathDepth = hasLand ? max(depth, float(0)) : depth;
    const tSun = exp(downPerM.mul(pathDepth.div(sun.cosWater)).negate());
    const tSky = exp(downPerM.mul(pathDepth.div(0.8)).negate());
    const eSunSea = tSun.mul(cosF.mul(beamW).mul(caustic).mul(sunVis));
    const eSkySea = tSky.mul(float(light.skyE * 0.93).mul(float(0.5).add(nF.y.mul(0.5))));
    if (!hasLand) return albedo.mul(eSunSea.add(eSkySea)).div(Math.PI);
    // DRY LAND (a map with land only): the sun as it is in the air, square
    // irradiance sunE on the facet's cosine to it, and the skylight with no
    // Fresnel loss into water. The share of land runs over the last 2 cm.
    const landK = smoothstep(float(0.02), float(-0.02), depth);
    const eSunLand = vec3(1, 1, 1).mul(max(dot(nF, uSunAir), float(0)).mul(light.sunE).mul(sunVis));
    const eSkyLand = vec3(1, 1, 1).mul(float(light.skyE).mul(float(0.5).add(nF.y.mul(0.5))));
    return albedo.mul(mix(eSunSea.add(eSkySea), eSunLand.add(eSkyLand), landK)).div(Math.PI);
  };

  /* --- the reader ---------------------------------------------------- */

  const reader: OceanSeabedReader = {
    shade(p: SeabedShadeInput): SeabedShadeOutput {
      const P = p.world;
      const xz0 = vec2(P.x, P.z);
      const rim = smoothstep(float(0), float(EDGE_FADE_M), insideMap(xz0)).toVar();
      // THE WATER'S OWN LIGHT. Over the map the column's in-scatter is this
      // water's (DEEP_WATER_INSCATTER), not the open sea's body: `trans`
      // hides the surface's body by `rim` and `through` carries the
      // in-scatter in its place, so the surface's formula
      // body * (1 - trans) + through needs no second term. At the map's rim
      // it hands back to the surface's body over EDGE_FADE_M.
      const inscatter = v3(DEEP_WATER_INSCATTER).mul(mix(float(OVERCAST_INSCATTER), float(1), sunVis));
      const trans = vec3(rim, rim, rim).toVar();
      const through = inscatter.mul(rim).toVar();
      const d0 = depthAt(xz0);
      If(rim.greaterThan(0).and(d0.lessThan(SEE_DEPTH_MAX_M)), () => {
        // THE FLOOR THROUGH THE RIPPLE: see REFRACT_RIPPLE.
        const share = mix(tune.refractRipple, float(1), smoothstep(float(REFRACT_STEEP_UP[0]), float(REFRACT_STEEP_UP[1]), p.viewDir.y));
        const nR = normalize(mix(p.normalLong, p.normal, share));
        // Keep the normal on the eye's side: a facet the eye sees from behind
        // would refract a ray back up out of the water.
        const nv = dot(nR, p.viewDir);
        const nEye = normalize(nR.add(p.viewDir.mul(max(float(0.05).sub(nv), float(0)))));
        const r = refract(p.viewDir.negate(), nEye, float(1 / WATER_IOR)).toVar();
        const down = max(r.y.negate(), float(1e-3));
        // THE WALK TO THE FLOOR (`hitFloorCpu`).
        const t = P.y.add(d0).div(down).toVar();
        for (let s = 0; s < HIT_STEPS; s += 1) {
          const x = xz0.add(vec2(r.x, r.z).mul(t));
          t.assign(max(P.y.add(depthAt(x)).div(down), float(0)));
        }
        const hit = xz0.add(vec2(r.x, r.z).mul(t));
        // THE FOOTPRINT is the pixel's long axis on the water, capped at four
        // times its short one, as the surface picks its normal level. A mip
        // read has no anisotropy: from the short axis (or the geometric mean,
        // the first choice) a slant view kept the web as sharp at 40 m as at
        // 4 m, and every critic of the round-3 deck and eye frames called it
        // one texture tiled flat with no fade with distance.
        const foot = min(p.longM, p.shortM.mul(4));
        // THE PATH THROUGH THE WATER THAT IS THERE (the hook's optional
        // `waterColumn`): over the beach's swash grid, only its own water.
        let tPath: TslNode = t;
        if (opts.shore?.waterColumn) {
          const col = max(P.y.add(d0), float(1e-3));
          tPath = t.mul(clamp(opts.shore.waterColumn(xz0, col).div(col), float(0), float(1)));
        }
        const tr = exp(upPerM.mul(tPath).negate());
        through.assign(floorRadiance(hit, foot, tPath).mul(tr).add(inscatter.mul(vec3(1, 1, 1).sub(tr))).mul(rim));
      });
      // THE BEACH'S FOAM on the sea's own surface, seaward of the swash
      // sheet: the bores' foam where the sea is the water the eye sees.
      if (opts.shore) {
        const wf = opts.shore.waterFoam(xz0, P.y.add(d0), min(p.longM, p.shortM.mul(4)), p.viewDir, p.own === true);
        through.assign(mix(through, wf.radiance, clamp(wf.cover, float(0), float(1))));
      }
      // THE GLINTS THE BEACH KEEPS (the hook's optional `waterGlint`), and
      // the share of the sea's own foam it keeps (its optional `waterSeaFoam`).
      // Each is in the output only when the hook has it.
      const glint = opts.shore?.waterGlint ? opts.shore.waterGlint(xz0, P.y.add(d0)) : undefined;
      const seaFoam = opts.shore?.waterSeaFoam ? opts.shore.waterSeaFoam(xz0, P.y.add(d0)) : undefined;
      const hide = opts.shore?.waterHide ? opts.shore.waterHide(xz0, P.y.add(d0)) : undefined;
      return {
        trans,
        through,
        ...(glint === undefined ? {} : { glint }),
        ...(seaFoam === undefined ? {} : { seaFoam }),
        ...(hide === undefined ? {} : { hide }),
      };
    },
  };

  /* --- the floor mesh ------------------------------------------------ */

  const FLOOR_SIDE = 512;
  const floorGeom = new THREE.PlaneGeometry(params.extentM, params.extentM, FLOOR_SIDE - 1, FLOOR_SIDE - 1);
  floorGeom.rotateX(-Math.PI / 2);
  floorGeom.translate(params.centerX, 0, params.centerZ);
  const floorMat = new THREE.MeshBasicNodeMaterial();
  const fxz = vec2(positionGeometry.x, positionGeometry.z);
  floorMat.positionNode = vec3(positionGeometry.x, depthAt(fxz).negate(), positionGeometry.z);
  floorMat.fragmentNode = Fn(() => {
    const w = positionWorld;
    const xz = vec2(w.x, w.z);
    // The beach draws its own ground over its patch (the hook).
    if (opts.shore) {
      If(opts.shore.owns(xz).greaterThan(0.5), () => {
        Discard();
      });
    }
    const foot = max(length(dFdx(xz)), length(dFdy(xz)));
    const inWaterPath = cameraPosition.sub(w).length().mul(clamp(float(0).sub(w.y).div(max(cameraPosition.y.sub(w.y).abs(), float(1e-3))), float(0), float(1)));
    const rad = floorRadiance(xz, foot, select(cameraPosition.y.lessThan(0), cameraPosition.sub(w).length(), inWaterPath));
    // Seen from under the water (the underwater piece's view): the floor's
    // image through the water between it and the eye, below y = 0, with the
    // water's deep color in-scattered over the rest. A camera above the
    // water sees this mesh only where the floor stands above the surface.
    const toEye = cameraPosition.sub(w);
    const len = length(toEye);
    const frac = clamp(float(0).sub(w.y).div(max(cameraPosition.y.sub(w.y).abs(), float(1e-3))), float(0), float(1));
    const inWater = select(cameraPosition.y.lessThan(0), len, len.mul(frac));
    const tr = exp(upPerM.mul(inWater).negate());
    return vec4(rad.mul(tr).add(vec3(0.006, 0.07, 0.1).mul(vec3(1, 1, 1).sub(tr))), float(1));
  })();
  floorMat.toneMapped = true;
  const mesh = new THREE.Mesh(floorGeom, floorMat);
  mesh.frustumCulled = false;
  // After the water, so the water's depth hides it fragment for fragment
  // wherever both draw.
  mesh.renderOrder = 10;
  mesh.visible = false;
  const floorReachesSurface = map.minDepthM < 0.05;

  /* --- per frame ------------------------------------------------------ */

  const clearColor = new THREE.Color();
  const step = (renderer: THREE.WebGPURenderer, camera: THREE.Camera) => {
    const prevTarget = renderer.getRenderTarget();
    renderer.getClearColor(clearColor as unknown as Parameters<typeof renderer.getClearColor>[0]);
    const prevAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(causticRT);
    renderer.render(causticScene, layerCam);
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(clearColor, prevAlpha);
    mesh.visible = camera.position.y < 0 || floorReachesSurface;
  };

  /* --- proof ------------------------------------------------------------ */

  /** Read one layer (channel) back: rows bottom (v = 0) to top, as the CPU twin lays them out. */
  const readLayer = async (renderer: THREE.WebGPURenderer, li: number): Promise<Float32Array> => {
    const raw = await (renderer as unknown as {
      readRenderTargetPixelsAsync(rt: THREE.RenderTarget, x: number, y: number, w: number, h: number): Promise<Uint16Array>;
    }).readRenderTargetPixelsAsync(causticRT, 0, 0, CAUSTIC_RES, CAUSTIC_RES);
    const rowStride = raw.length / CAUSTIC_RES;
    const out = new Float32Array(CAUSTIC_RES * CAUSTIC_RES);
    for (let j = 0; j < CAUSTIC_RES; j += 1) {
      // The readback's first row is the top of the target, v = 1.
      const src = (CAUSTIC_RES - 1 - j) * rowStride;
      for (let i = 0; i < CAUSTIC_RES; i += 1) out[j * CAUSTIC_RES + i] = THREE.DataUtils.fromHalfFloat(raw[src + i * 4 + li]);
    }
    return out;
  };

  const statsOf = (img: ArrayLike<number>) => {
    let s = 0; let s2 = 0; let mx = 0; let b2 = 0;
    for (let i = 0; i < img.length; i += 1) {
      const v = img[i]; s += v; s2 += v * v; if (v > mx) mx = v; if (v > 2) b2 += 1;
    }
    const mean = s / img.length;
    return { mean, contrast: Math.sqrt(Math.max(s2 / img.length - mean * mean, 0)) / mean, over2: b2 / img.length, max: mx };
  };

  /**
   * GPU TIME OF ONE RENDER PASS, from the WebGPU timestamp query three takes
   * when the renderer has `trackTimestamp` (the viewer sets it). Wall-clock
   * benches were useless here: other pages held the GPU at 99%, and a
   * frame's wall time swung from 35 to 110 ms between two runs of one build.
   * A timestamp pair brackets the pass on the GPU, so another process's work
   * lands in it only where it preempts the pass. `render` must make exactly
   * one `renderAsync` call, WITH A CAMERA NEW TO THE RENDERER: three 0.172
   * attaches a render context's timestamp writes to its first pass only, so
   * a second pass of the same (scene, camera, target) re-reads the first
   * pass's numbers (every sample of a run came back identical). A cloned
   * camera is a new render context. Returns ms per sample.
   */
  const gpuPassMs = async (
    renderer: THREE.WebGPURenderer,
    render: () => Promise<void>,
    samples: number,
  ): Promise<number[]> => {
    // The backend hands each resolved pass time to `info.updateTimestamp`,
    // which sums them per frame; the raw value is taken where it arrives.
    const info = renderer.info as unknown as {
      updateTimestamp(type: string, ms: number): void;
    };
    const orig = info.updateTimestamp;
    const got: number[] = [];
    info.updateTimestamp = function patched(this: unknown, type: string, ms: number) {
      if (type === 'render') got.push(ms);
      orig.call(this, type, ms);
    };
    const out: number[] = [];
    try {
      for (let i = 0; i < samples; i += 1) {
        const n0 = got.length;
        await render();
        for (let w = 0; w < 400 && got.length === n0; w += 1) {
          await new Promise((res) => { setTimeout(res, 2); });
        }
        if (got.length > n0) out.push(got[got.length - 1]);
      }
    } finally {
      info.updateTimestamp = orig;
    }
    return out;
  };

  const probe: Record<string, unknown> = {
    gpuPassMs,
    /** GPU ms of the caustic pass (all four layers, without the mip chain), per sample. */
    causticPassMs: async (renderer: THREE.WebGPURenderer, samples = 20) => gpuPassMs(renderer, async () => {
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(causticRT);
      await renderer.renderAsync(causticScene, layerCam.clone());
      renderer.setRenderTarget(prev);
    }, samples),
    /** Set a tuning uniform by name; an unknown name throws. */
    setTune: (name: string, value: number) => {
      const u = (tune as Record<string, { value: number }>)[name];
      if (!u) throw new Error(`[ocean] No seabed tuning uniform named "${name}".`);
      u.value = value;
    },
    getTune: () => Object.fromEntries(Object.entries(tune).map(([k, u]) => [k, u.value])),
    layers: CAUSTIC_LAYER_DEPTHS_M,
    tileM,
    map: { res: map.res, texelM: map.texelM, minDepthM: map.minDepthM, maxDepthM: map.maxDepthM },
    depthAt: (x: number, z: number) => seabedDepthAt(map, x, z),
    /** Mean, contrast (std / mean), share over 2x and peak of one layer. */
    layerStats: async (renderer: THREE.WebGPURenderer, li: number) => statsOf(await readLayer(renderer, li)),
    /**
     * THE GPU AGAINST THE CPU. Read the ripple cascade's displacement and
     * normal back, splat the same layer on the CPU (`splatCausticCpu`), and
     * compare: both means are 1, and the correlation of the two maps after a
     * 2-texel blur is the proof that the pass lands each beam where Snell's
     * law puts it (a flipped axis or a wrong sign gives a correlation near 0).
     */
    crossCheck: async (renderer: THREE.WebGPURenderer, li: number) => {
      const getBuf = (a: unknown) => (renderer as unknown as {
        getArrayBufferAsync(x: unknown): Promise<ArrayBuffer>;
      }).getArrayBufferAsync(a);
      const dArr = new Float32Array(await getBuf(bufs.disp));
      const nArr = new Float32Array(await getBuf(bufs.norm));
      // The floor reads level 1: compare that, the mean of each 2x2.
      const full = await readLayer(renderer, li);
      const r = CAUSTIC_RES / 2;
      const gpu = new Float32Array(r * r);
      for (let j = 0; j < r; j += 1) {
        for (let i = 0; i < r; i += 1) {
          const o = 2 * j * CAUSTIC_RES + 2 * i;
          gpu[j * r + i] = 0.25 * (full[o] + full[o + 1] + full[o + CAUSTIC_RES] + full[o + CAUSTIC_RES + 1]);
        }
      }
      const base = rippleIdx * cells * 4;
      // The layer's own low-pass: the stride x stride block means, centered
      // on their blocks, read bilinearly (`blockMeanCpu`).
      const st = CAUSTIC_LAYER_STRIDE[li];
      const m = n / st;
      const blocks = (arr: Float32Array) => blockMeanCpu(arr, base, n, st);
      const dB = blocks(dArr);
      const nB = blocks(nArr);
      const at = (arr: Float32Array, x: number, z: number, k: number) => {
        const tx = x / (cascadeTexelM * st) - (st - 1) / (2 * st); const tz = z / (cascadeTexelM * st) - (st - 1) / (2 * st);
        const x0 = Math.floor(tx); const z0 = Math.floor(tz); const fx = tx - x0; const fz = tz - z0;
        const w = (xi: number, zi: number) => arr[((((zi % m) + m) % m) * m + (((xi % m) + m) % m)) * 4 + k];
        return (w(x0, z0) * (1 - fx) + w(x0 + 1, z0) * fx) * (1 - fz) + (w(x0, z0 + 1) * (1 - fx) + w(x0 + 1, z0 + 1) * fx) * fz;
      };
      const cpu = splatCausticCpu({
        patchM: tileM, srcN: m, res: r, depthM: CAUSTIC_LAYER_DEPTHS_M[li], sunDir: sunV, sub: Math.max(2, 2 * st),
        slopeAt: (x, z) => {
          const j = Math.max(at(nB, x, z, 2), CAUSTIC_JAC_FLOOR);
          return [at(nB, x, z, 0) / j, at(nB, x, z, 1) / j];
        },
        dispAt: (x, z) => [at(dB, x, z, 0), at(dB, x, z, 1), at(dB, x, z, 2)],
      });
      const blur = (img: ArrayLike<number>) => {
        const o = new Float64Array(r * r);
        for (let j = 0; j < r; j += 1) {
          for (let i = 0; i < r; i += 1) {
            let s = 0;
            for (let dj = -2; dj <= 2; dj += 1) for (let di = -2; di <= 2; di += 1) {
              s += img[(((j + dj) + r) % r) * r + (((i + di) + r) % r)];
            }
            o[j * r + i] = s / 25;
          }
        }
        return o;
      };
      const b = blur(cpu);
      const corr = (img: Float32Array) => {
        const a = blur(img);
        let ma = 0; let mb = 0; for (let i = 0; i < a.length; i += 1) { ma += a[i]; mb += b[i]; }
        ma /= a.length; mb /= b.length;
        let sab = 0; let saa = 0; let sbb = 0;
        for (let i = 0; i < a.length; i += 1) { const x = a[i] - ma; const y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y; }
        return sab / Math.sqrt(saa * sbb);
      };
      // The same map read with each axis flipped and transposed: only the
      // right orientation correlates, so a wrong one is named, not hidden.
      const variant = (f: (i: number, j: number) => number) => {
        const o = new Float32Array(r * r);
        for (let j = 0; j < r; j += 1) for (let i = 0; i < r; i += 1) o[j * r + i] = gpu[f(i, j)];
        return o;
      };
      const orient = {
        asIs: corr(gpu),
        flipV: corr(variant((i, j) => (r - 1 - j) * r + i)),
        flipU: corr(variant((i, j) => j * r + (r - 1 - i))),
        transpose: corr(variant((i, j) => i * r + j)),
      };
      return { depthM: CAUSTIC_LAYER_DEPTHS_M[li], stride: st, gpu: statsOf(gpu), cpu: statsOf(cpu), correlation: orient.asIs, orient };
    },
    /** One layer as a PNG data URL: intensity / 3, gamma 2.2. */
    layerImage: async (renderer: THREE.WebGPURenderer, li: number) => {
      const img = await readLayer(renderer, li);
      const r = CAUSTIC_RES;
      const canvas = document.createElement('canvas');
      canvas.width = r; canvas.height = r;
      const g = canvas.getContext('2d');
      if (!g) throw new Error('[ocean] no 2d canvas for the caustic image');
      const id = g.createImageData(r, r);
      for (let j = 0; j < r; j += 1) {
        for (let i = 0; i < r; i += 1) {
          const v = Math.round(255 * Math.min(1, Math.max(0, img[j * r + i] / 3)) ** (1 / 2.2));
          const o = ((r - 1 - j) * r + i) * 4;
          id.data[o] = v; id.data[o + 1] = v; id.data[o + 2] = v; id.data[o + 3] = 255;
        }
      }
      g.putImageData(id, 0, 0);
      return canvas.toDataURL('image/png');
    },
    /** The caustic passes alone, saturating, ms per frame. */
    /**
     * The caustic passes alone, saturating: `iters` steps then one fence, ms
     * per step. `parts` splits the cost: 'full' (the step), 'empty' (the
     * same passes with nothing drawn: the clear, the mips and the CPU's
     * per-pass cost), 'nomips' (drawn, no mip chain). CPU time and GPU time
     * overlap in a real frame, so the parts are a diagnosis, not a sum.
     */
    benchStep: async (renderer: THREE.WebGPURenderer, camera: THREE.Camera, iters = 200, parts = 'full') => {
      const fence = async () => {
        await (renderer as unknown as { getArrayBufferAsync(a: unknown): Promise<ArrayBuffer> })
          .getArrayBufferAsync(bufs.disp);
      };
      const meshes = causticScene.children;
      if (parts === 'empty') for (const m of meshes) m.visible = false;
      if (parts === 'nomips') causticTex.generateMipmaps = false;
      try {
        for (let i = 0; i < 10; i += 1) step(renderer, camera);
        await fence();
        const c0 = performance.now();
        for (let i = 0; i < iters; i += 1) step(renderer, camera);
        const cpuMs = (performance.now() - c0) / iters;
        await fence();
        return { ms: (performance.now() - c0) / iters, cpuMs, parts };
      } finally {
        for (const m of meshes) m.visible = true;
        causticTex.generateMipmaps = true;
      }
    },
  };

  return {
    map,
    reader,
    mesh,
    floorRadianceAt: (xz: TslNode, footM: TslNode, viewPathM: TslNode) => floorRadiance(xz, footM, viewPathM),
    layers: causticRT,
    step,
    dispose() {
      causticRT.dispose();
      for (const g of layerGeoms) g.dispose();
      for (const m of layerMats) m.dispose();
      floorGeom.dispose();
      floorMat.dispose();
      mapTex.dispose();
    },
    probe,
  };
}

/**
 * The CPU twin of the caustic pass's block mean: vec4 cells of one cascade
 * plane at `base` in `arr` (n x n), averaged over `stride` x `stride`
 * blocks, laid out (n / stride)^2 with 4 floats each.
 */
function blockMeanCpu(arr: Float32Array, base: number, n: number, stride: number): Float32Array {
  const m = n / stride;
  const out = new Float32Array(m * m * 4);
  for (let j = 0; j < m; j += 1) {
    for (let i = 0; i < m; i += 1) {
      for (let b = 0; b < stride; b += 1) {
        for (let a = 0; a < stride; a += 1) {
          const src = base + ((j * stride + b) * n + (i * stride + a)) * 4;
          const o = (j * m + i) * 4;
          for (let k = 0; k < 4; k += 1) out[o + k] += arr[src + k] / (stride * stride);
        }
      }
    }
  }
  return out;
}

/** Natural log as a TSL node: log2 times ln 2. */
function log(x: TslNode): TslNode {
  return log2(x).mul(Math.LN2);
}
