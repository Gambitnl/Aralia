// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 10/08/2026, 15:25:56
 * Dependents: components/BattleMap/BattleMap3D.tsx, components/BattleMap/terrain/TerrainApron.tsx, components/BattleMap/terrain/TerrainMesh.tsx, components/BattleMap/terrain/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file apronField.ts — the land OUTSIDE the playable rect, as one formula.
 *
 * Remy, 2026-08-10, with a circled screenshot: the combat map "doesn't look
 * like it's on the 'continual world' (which shouldn't have a 'cliff down to
 * nothingness')". It didn't, and there were three separate reasons:
 *
 *  1. the heightfield's fringe eased DOWN to a fixed apron datum (-0.15), so
 *     the battlefield sat on a shelf that sank into a flat plate;
 *  2. that plate was one large quad painted the fog colour, so the far ground
 *     carried no landform at all — the eye read "board, then haze";
 *  3. the plate ENDED. Its far edge drew a dead-straight line against the sky.
 *     That line is the cliff.
 *
 * The fix is one continuous surface and one height function. `apronHeightAt`
 * IS the ground everywhere outside the rect: it starts from the map's own
 * edge-clamped heightfield (so at the rect boundary it is bit-for-bit the
 * terrain the board is made of) and grows a landscape into it as the distance
 * out increases. `TerrainMesh` evaluates it across its fringe, `TerrainApron`
 * evaluates it from the fringe boundary out to the horizon. Neither blends
 * toward the other — they are the same function, so the seam cannot crack.
 *
 * This mirrors what World3D's far-distance shells do for the streamed world
 * (`systems/worldforge/bridge/farShells.ts`): coarse rings on the window's own
 * vertical datum, continuing the near terrain instead of dressing its edge.
 * The difference is the source. World3D HAS a real region heightfield to
 * continue; a sandbox combat map does not (see `apronWorldSourceNote` below),
 * so the relief here is generated from the map's own seed and biome.
 */
import { BattleMapData } from '../../../types/combat';

/**
 * Non-playable visual run-out beyond the playable rect, in world tiles per
 * side. The heightfield mesh covers exactly this band; the apron mesh starts
 * where it ends. Exported so both agree without a magic number each.
 */
export const FRINGE_TILES = 12;

/** Biome shape of the land beyond the board. */
export interface ApronProfile {
  /**
   * Peak relief amplitude in world units, reached far from the board.
   * (1 world unit = 1 tile = 1.524 m, the board's own horizontal unit.)
   */
  amp: number;
  /** Distance in tiles over which relief ramps from 0 to full. */
  reliefRun: number;
  /** Spatial frequency of the broad landforms (smaller = wider hills). */
  freq: number;
  /** Flat-topped mesa/butte shaping instead of rounded hills. */
  mesa: boolean;
  /**
   * How far out the apron reaches, as a multiple of the map's half-diagonal.
   * Open biomes see a long way; enclosed ones are walled in close.
   */
  reach: number;
  /** Enclosed biome: the "apron" is a cavern wall that rises and closes. */
  enclosed: boolean;
  /**
   * Amplitude of the far ranges, as a multiple of `amp`. Distant landforms have
   * to be far bigger than near ones to subtend anything at all — see the
   * arithmetic beside the term itself.
   */
  rangeScale: number;
  /**
   * Fog start and end, as multiples of the map's half-diagonal.
   *
   * These live here, with the apron, because fog and the apron are one
   * decision: fog is how far you can see, and the apron is what there is to
   * see. The old numbers were authored when there was nothing out there — the
   * shipped 120x90 forest board ended up with fog fully saturated at 125 world
   * units against a camera that orbits out to 120, which is why the overview
   * was a sheet of haze and why nothing anyone put on the horizon was ever
   * visible. Open biomes now fog over a distance the apron actually spans;
   * enclosed ones keep their close, dark enclosure to within a few units of
   * what they had.
   */
  fogNearMul: number;
  fogFarMul: number;
}

/**
 * There are no colours here. The apron is painted by the board's own ground
 * material (`terrainSurfaceMaterial.ts`), which is the only way two surfaces
 * that continue each other can be guaranteed to match — a hand-picked "distant"
 * palette is exactly how the retired ridge band ended up a different colour
 * from the ground it was supposed to continue, and how the first version of
 * this apron drew a tonal rectangle around the board.
 */
export const APRON_PROFILES: Record<string, ApronProfile> = {
  forest: {
    amp: 9.5, reliefRun: 60, freq: 0.0075, mesa: false, reach: 14, enclosed: false, rangeScale: 4.5,
    fogNearMul: 1.15, fogFarMul: 13,
  },
  desert: {
    amp: 16, reliefRun: 70, freq: 0.0055, mesa: true, reach: 20, enclosed: false, rangeScale: 5.5,
    fogNearMul: 1.6, fogFarMul: 19,
  },
  swamp: {
    amp: 5.0, reliefRun: 50, freq: 0.0095, mesa: false, reach: 9, enclosed: false, rangeScale: 2.6,
    fogNearMul: 0.5, fogFarMul: 6,
  },
  cave: {
    amp: 30, reliefRun: 26, freq: 0.03, mesa: false, reach: 1.35, enclosed: true, rangeScale: 0,
    fogNearMul: 0.28, fogFarMul: 0.85,
  },
  dungeon: {
    amp: 28, reliefRun: 24, freq: 0.032, mesa: false, reach: 1.3, enclosed: true, rangeScale: 0,
    fogNearMul: 0.22, fogFarMul: 0.68,
  },
};

export const resolveApronProfile = (biome: string): ApronProfile =>
  APRON_PROFILES[biome] ?? APRON_PROFILES.forest;

/**
 * How far the apron reaches beyond the playable rect, in world tiles.
 *
 * The scene's camera far plane, its sky-dome radius and its fog far distance
 * all have to clear this, and they are set in `BattleMap3D` before any apron
 * geometry exists — so the reach is a pure function of the map, callable
 * without building the field.
 */
export function apronReachTiles(
  mapData: Pick<BattleMapData, 'dimensions'> & { theme?: string; biome?: string },
): number {
  const { width, height } = mapData.dimensions;
  const profile = resolveApronProfile(mapData.biome ?? mapData.theme ?? 'forest');
  return Math.max(120, (Math.hypot(width, height) / 2) * profile.reach);
}

/** Everything the scene needs to draw a believable distance, in world units. */
export interface HorizonSetup {
  /** How far the apron reaches past the playable rect. */
  reachTiles: number;
  fogNear: number;
  fogFar: number;
  /** Sky-dome radius: must contain the whole apron or the ground pokes out. */
  skyRadius: number;
  /** Camera far plane: must contain the sky dome or the horizon is clipped. */
  cameraFar: number;
  /**
   * Camera near plane. Raised off the old 0.1 because the far plane moved by an
   * order of magnitude, and depth precision is the ratio of the two. Orbit
   * controls clamp the camera to 5 units from its target, so nothing the player
   * can look at renders anywhere near this.
   */
  cameraNear: number;
  /**
   * Furthest tactical orbit distance allowed by the camera controls.
   * Keeping this beside fog makes it impossible for the two systems to drift.
   */
  cameraMaxDistance: number;
}

/**
 * The fog end must leave breathing room beyond the camera target.
 *
 * Linear fog is fully opaque at `fogFar`. A 1.5 ratio reserves another half
 * orbit distance beyond the camera's legal maximum, so dungeon atmosphere
 * remains visible without erasing the active camera target.
 */
export const CAMERA_TO_FOG_FAR_RATIO = 1.5;

/**
 * Resolve the orbit distance from the same map scale and biome enclosure that
 * drive the rest of the horizon. Open landscapes retain their broad overview;
 * caves and dungeons retain the closer cap that keeps their walls meaningful.
 */
export function resolveCameraMaxDistance(
  mapData: Pick<BattleMapData, 'dimensions'> & { theme?: string; biome?: string },
): number {
  const halfDiag = Math.hypot(mapData.dimensions.width, mapData.dimensions.height) / 2;
  const profile = resolveApronProfile(mapData.biome ?? mapData.theme ?? 'forest');
  return profile.enclosed
    ? Math.max(20, halfDiag * 0.9)
    : Math.max(35, halfDiag * 1.6);
}

/**
 * Resolve the scene's distance budget from the map alone.
 *
 * Fog far, the sky-dome radius and the camera far plane are three numbers that
 * MUST be ordered — fog saturates before the apron ends, the dome contains the
 * apron, the far plane contains the dome — and they were previously three
 * independent constants in three places. Two of them (fog far 125, dome radius
 * 140) were already smaller than the camera's own orbit distance on the shipped
 * board.
 */
export function resolveHorizon(
  mapData: Pick<BattleMapData, 'dimensions'> & { theme?: string; biome?: string },
): HorizonSetup {
  const { width, height } = mapData.dimensions;
  const halfDiag = Math.hypot(width, height) / 2;
  const profile = resolveApronProfile(mapData.biome ?? mapData.theme ?? 'forest');
  const reachTiles = apronReachTiles(mapData);
  const skyRadius = (reachTiles + halfDiag) * 1.15;
  const cameraMaxDistance = resolveCameraMaxDistance(mapData);

  // Preserve every biome's authored fog distance when it already clears the
  // camera. Enclosed biomes get only the missing safety floor: their fog still
  // begins close to the player and keeps its dark color, but it cannot become
  // fully opaque before the camera reaches a legal overview position.
  const authoredFogFar = halfDiag * profile.fogFarMul;
  const fogFar = Math.max(
    authoredFogFar,
    cameraMaxDistance * CAMERA_TO_FOG_FAR_RATIO,
  );
  return {
    reachTiles,
    fogNear: halfDiag * profile.fogNearMul,
    fogFar,
    skyRadius,
    cameraFar: skyRadius * 1.3,
    cameraNear: 0.2,
    cameraMaxDistance,
  };
}

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Deterministic value-noise FBM in cartesian tile space. Same construction the
 * old ridge band used (integer hash + smoothstep lerp + 5 octaves) — kept
 * because it is cheap, seedable, and has no shared mutable table to corrupt
 * (see the SimplexNoise shared-table hazard).
 */
function makeFbm(seed: number, octaves: number) {
  const hash = (xi: number, zi: number): number => {
    let h = Math.imul(xi | 0, 374761393) ^ Math.imul(zi | 0, 668265263) ^ Math.imul(seed | 0, 362437);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const noise = (x: number, z: number): number => {
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const xf = x - xi;
    const zf = z - zi;
    const u = xf * xf * (3 - 2 * xf);
    const v = zf * zf * (3 - 2 * zf);
    const v00 = hash(xi, zi);
    const v10 = hash(xi + 1, zi);
    const v01 = hash(xi, zi + 1);
    const v11 = hash(xi + 1, zi + 1);
    return lerp(lerp(v00, v10, u), lerp(v01, v11, u), v);
  };
  return (x: number, z: number): number => {
    let sum = 0;
    let amp = 0.5;
    let f = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise(x * f, z * f);
      norm += amp;
      amp *= 0.5;
      f *= 2.07;
    }
    return sum / norm;
  };
}

export interface ApronField {
  profile: ApronProfile;
  /**
   * World Y of the ground at a tile coordinate. INSIDE the playable rect this
   * returns the heightfield's own value exactly (relief is zero there), so it
   * is safe to call across the whole fringe plane without a branch.
   */
  heightAt: (tileX: number, tileZ: number) => number;
  /** Tiles outside the playable rect (0 inside). */
  outsetAt: (tileX: number, tileZ: number) => number;
  /** How far the apron mesh reaches beyond the rect, in tiles. */
  reachTiles: number;
  /** Height range the relief spans, for the colour ramp. */
  amp: number;
}

/**
 * Build the apron field for one map.
 *
 * `heightfieldAt` must be the map's own `makeTerrainHeightSampler` closure.
 * It edge-clamps its tile lookups, so evaluating it outside the rect already
 * extrudes the border row outward — that extrusion is the apron's base, and
 * the relief rides on top of it.
 */
export function makeApronField(
  mapData: Pick<BattleMapData, 'dimensions' | 'seed'> & { theme?: string; biome?: string },
  heightfieldAt: (tileX: number, tileZ: number) => number,
): ApronField {
  const { width, height } = mapData.dimensions;
  const biome = mapData.biome ?? mapData.theme ?? 'forest';
  const profile = resolveApronProfile(biome);
  const seed = mapData.seed ?? 42;
  const broad = makeFbm(seed, 5);
  const detail = makeFbm(seed ^ 0x5bd1, 3);

  const reachTiles = apronReachTiles(mapData);

  const outsetAt = (tileX: number, tileZ: number): number => {
    const dx = Math.max(0, -tileX, tileX - width);
    const dz = Math.max(0, -tileZ, tileZ - height);
    return Math.hypot(dx, dz);
  };

  /* ---------------------------------------------------------------------
   * THE BOARD'S EDGE, LOW-PASSED — why this exists.
   *
   * Outside the rect the heightfield sampler edge-clamps, so it extrudes the
   * border row outward unchanged: the board's tile-scale relief (integer tile
   * elevations, plus quarter-tile micro-noise) runs all the way to the horizon.
   * The fringe mesh samples that four times per tile. The apron mesh, which is
   * coarse because it is huge, samples it about once. Two meshes tracing the
   * same fast wiggle at different rates DO NOT MEET — they leave pinholes of
   * sky along the join at exactly the grazing angles this work is judged at.
   * The first version of the seam test measured a 1.1-unit crack.
   *
   * So the extrusion is low-passed. Because the clamped sampler outside the
   * rect depends only on the projection onto the rect boundary, that whole
   * surface is ONE-DIMENSIONAL: a profile around the perimeter. Smooth the
   * profile once, at build time, and every point outside gets a base with a
   * 30-plus-tile wavelength — coarse enough that a chord across an apron
   * quad is under two centimetres off it.
   *
   * The blend from raw to smoothed runs over the fringe and starts at ZERO
   * weight on the boundary, so the board's own edge is untouched and the
   * fringe mesh, which is fine enough to resolve it, carries the transition.
   * --------------------------------------------------------------------- */
  const perimeter = 2 * (width + height);
  const PROFILE_STEP = 0.5;
  const profileN = Math.max(16, Math.ceil(perimeter / PROFILE_STEP));
  /** Half-width of each of the two box passes, in tiles (box² = triangle). */
  const PROFILE_SMOOTH_TILES = 8;

  const perimeterPoint = (s: number, out: [number, number]): void => {
    let t = s % perimeter;
    if (t < 0) t += perimeter;
    if (t < width) { out[0] = t; out[1] = 0; return; }
    t -= width;
    if (t < height) { out[0] = width; out[1] = t; return; }
    t -= height;
    if (t < width) { out[0] = width - t; out[1] = height; return; }
    t -= width;
    out[0] = 0; out[1] = height - t;
  };

  /** Perimeter arc-length of the boundary point an outside sample projects to. */
  const perimeterParam = (tileX: number, tileZ: number): number => {
    const cx = Math.min(width, Math.max(0, tileX));
    const cz = Math.min(height, Math.max(0, tileZ));
    if (tileZ < 0) return cx;
    if (tileZ > height) return 2 * width + height - cx;
    if (tileX > width) return width + cz;
    return 2 * width + 2 * height - cz;
  };

  const edgeProfile = (() => {
    const raw = new Float64Array(profileN);
    const pt: [number, number] = [0, 0];
    for (let i = 0; i < profileN; i++) {
      perimeterPoint((i * perimeter) / profileN, pt);
      raw[i] = heightfieldAt(pt[0], pt[1]);
    }
    const halfSamples = Math.max(1, Math.round(PROFILE_SMOOTH_TILES / PROFILE_STEP));
    const boxPass = (src: Float64Array): Float64Array => {
      const dst = new Float64Array(src.length);
      const w = Math.min(halfSamples, Math.floor((src.length - 1) / 2));
      let sum = 0;
      for (let k = -w; k <= w; k++) sum += src[((k % src.length) + src.length) % src.length];
      const inv = 1 / (2 * w + 1);
      for (let i = 0; i < src.length; i++) {
        dst[i] = sum * inv;
        const drop = src[((i - w) % src.length + src.length) % src.length];
        const add = src[((i + w + 1) % src.length + src.length) % src.length];
        sum += add - drop;
      }
      return dst;
    };
    return boxPass(boxPass(raw));
  })();

  const smoothedEdgeAt = (tileX: number, tileZ: number): number => {
    const s = perimeterParam(tileX, tileZ);
    const f = (s / perimeter) * profileN;
    const i0 = Math.floor(f);
    const frac = f - i0;
    const a = edgeProfile[((i0 % profileN) + profileN) % profileN];
    const b = edgeProfile[((i0 + 1) % profileN + profileN) % profileN];
    return a + (b - a) * frac;
  };

  /** The ground the relief rides on: the board at the boundary, its smoothed
   *  edge profile from the fringe outward. */
  const baseAt = (tileX: number, tileZ: number, d: number): number => {
    /* Past the fringe the blend weight is exactly 1 and the raw term cancels,
     * so the apron mesh never touches the bicubic sampler at all — it reads a
     * table. That is not a micro-optimisation: the apron builds 27,000 vertices
     * and evaluates the height five times each for its normals, and paying a
     * 16-tap bicubic (with a 3x3 water scan inside it) for every one of those
     * measured 365 ms of main-thread hitch on map change. It is now a lookup. */
    if (d >= FRINGE_TILES) return smoothedEdgeAt(tileX, tileZ);
    const raw = heightfieldAt(tileX, tileZ);
    if (d <= 0) return raw;
    const w = smoothstep(0, FRINGE_TILES, d);
    return raw + (smoothedEdgeAt(tileX, tileZ) - raw) * w;
  };

  const heightAt = (tileX: number, tileZ: number): number => {
    const d = outsetAt(tileX, tileZ);
    if (d <= 0) return heightfieldAt(tileX, tileZ);
    const base = baseAt(tileX, tileZ, d);

    // Relief ramps in from ZERO at the rect boundary, so the fringe's first row
    // of vertices matches the playable terrain exactly and every row after it
    // is one continuous function of position. No blend, no seam.
    const ramp = smoothstep(0, profile.reliefRun, d);

    if (profile.enclosed) {
      // Cave / dungeon: the surround is a wall that climbs steeply and keeps
      // climbing, so the chamber closes overhead instead of opening to a sky
      // it has no business showing.
      const wall = broad(tileX * profile.freq * 4, tileZ * profile.freq * 4);
      return base + ramp * profile.amp * (0.55 + 0.45 * wall) + d * 0.55 * ramp;
    }

    const n = broad(tileX * profile.freq, tileZ * profile.freq);
    // Contrast the noise so crests separate instead of averaging into a swell.
    const shaped = n * n * (3 - 2 * n);
    const landform = profile.mesa
      ? 0.10 + 0.26 * shaped + 0.64 * smoothstep(0.44, 0.60, shaped)
      : 0.14 + 0.86 * shaped;
    // A finer octave keeps the middle distance from reading as one smooth
    // swell; it is scaled by the ramp too, so it cannot disturb the seam.
    const fine = (detail(tileX * profile.freq * 5.5, tileZ * profile.freq * 5.5) - 0.5) * 0.22;
    const hills = ramp * profile.amp * (landform + fine);

    /* DISTANT RANGES, and why they are a separate term.
     *
     * The first live apron had one relief term at a constant amplitude, and it
     * read as a flat green plain from the grazing angles the combat camera
     * spends its time at. The arithmetic says why: a 9.5-unit hill 700 units
     * away subtends a third of a degree. Landscapes do not look like that
     * because the things you can see from far away ARE bigger — you see hills
     * at 300 m and mountain ranges at 15 km, not the same hill twice.
     *
     * So a second term with a much longer wavelength and a much larger
     * amplitude fades in over the outer half of the reach. It contributes
     * nothing near the board (where hills of that size would be absurd), and
     * by the fog line it is the whole silhouette. */
    const far = smoothstep(reachTiles * 0.03, reachTiles * 0.5, d);
    if (far <= 0) return base + hills;
    const rn = broad(tileX * profile.freq * 0.28 + 91.3, tileZ * profile.freq * 0.28 + 47.1);
    const ranges = far * profile.amp * profile.rangeScale * (rn * rn * (3 - 2 * rn));
    return base + hills + ranges;
  };


  return { profile, heightAt, outsetAt, reachTiles, amp: profile.amp };
}

/**
 * WORLD-POSITION FINDING, recorded where the next reader will trip over it.
 *
 * `BattleMapData.provenance` (types/combat.ts) carries `anchorWorldMeters` and
 * an optional `anchorCellId` whenever the board was projected from a real
 * WorldForge location — so a world-derived encounter DOES know where it is, and
 * the surrounding kilometre could be sampled instead of invented. The pieces
 * for that already exist: `systems/worldforge/bridge/groundChunkLoader.ts`
 * builds the streamed window the board was cut from, and `farShells.ts` turns
 * the region + atlas heightfields into exactly the two coarse rings this apron
 * draws by hand.
 *
 * It is NOT wired here, and the reason is not laziness:
 *
 *  - the sandbox board (`generateProceduralSandboxBattleSetup`, which is what
 *    `?step=battlemap` and every 3D BattleMap test render) has NO provenance at
 *    all, so a provenance-only apron would leave the verification surface — and
 *    every dev deep link — with the cliff still in it;
 *  - the real sampler is asynchronous (worker + chunk streaming) while the
 *    apron mesh is built synchronously with the terrain;
 *  - two apron sources would be two code paths for one surface, which is the
 *    fallback pattern this codebase does not ship.
 *
 * So the apron continues the board's own edge heights and biome everywhere,
 * and REAL-WORLD SAMPLING IS THE NAMED FOLLOW-UP: give `TerrainApron` an
 * optional pre-built `FarShellGrid` pair resolved from `provenance` on the
 * worldforge path, keep this generator as the sandbox's, and make the choice at
 * the data layer instead of inside the mesh.
 */
export const apronWorldSourceNote =
  'apron relief is generated from map seed + biome; provenance.anchorWorldMeters ' +
  'is the hook for sampling the real surrounding world (see farShells.ts)';
