/**
 * @file InteriorLights.tsx — interior lighting for the streamed 3D town.
 *
 * The sun + hemisphere fill (World3DLighting) light the OUTSIDE; roofs shadow
 * the sun so interiors go pitch black. This adds the two RENDER-side interior
 * lights the emissive-only lit-windows / lit-hearth data can't provide on its
 * own:
 *
 *  1. FLAME point lights — a warm, shadowless <pointLight> at the hearth of each
 *     lit-hearth building within ~40 m of the camera. Hard-capped at 4, nearest
 *     first, reselected each frame as the camera moves. An unused slot stays
 *     mounted at intensity 0 (GG-594 part 3). These make a hearthside room glow
 *     from a real source (bodies cast no shadow but pick up the warm falloff)
 *     rather than only the emissive box.
 *
 *  2. (REMOVED 2026-11-02, GG-594 part 1) The camera-inside fill light. It lit
 *     every room at any hour and hid the window falloff. Remy ruled "Drop it,
 *     add eye adaptation": a room now shows only the light it receives, and the
 *     exposure step (eyeAdaptation.ts) makes a dim room readable.
 *
 *  3. LIT WINDOWS onto the street (2026-11-02) — the nearest ≤8 lit panes within
 *     40 m each get a RectAreaLight the size of the pane, facing out, with the
 *     radiance the pane shows. The street receives the light the glass emits.
 *
 *  4. TABLE LAMPS (2026-11-02) — while a household's windows are lit, an oil
 *     lamp (8 cd, about 100 lm) burns on each table, desk, counter and
 *     workbench; the nearest ≤4 within 30 m are real point lights. The lamp
 *     itself is a mesh that SiteBuilding draws (tableLamp.ts, GG-594 part 3).
 *
 *  5. SUN BOUNCE (GG-594 part 2) — the sunlit floor patch under each window
 *     near the camera is an upward area light; see SUN BOUNCE below. It uses
 *     the window-light slots that no lit window holds.
 *
 * The hearth, window and lamp lights keep a fixed count and go dark by
 * intensity, so a camera move never changes the light count (which recompiles
 * materials).
 *
 * DATA vs RENDER: which windows glow and where the hearths are flows through the
 * existing SitePart plumbing (emissiveHex tags, baked deterministically). This
 * component only does render-side, camera-relative SELECTION — legitimately not
 * deterministic data. No per-frame allocations in the selector loop.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 20:17:36
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RectAreaLightNode } from 'three/webgpu';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { RectAreaLightTexturesLib } from 'three/examples/jsm/lights/RectAreaLightTexturesLib.js';
import type { LoadedChunk } from '@/systems/world3d/types';
import { chunkOriginWorld } from '@/systems/world3d/coords';
import { worldToScene, type SceneOrigin } from '@/systems/world3d/sceneOrigin';
import {
  buildInteriorDaylight,
  sunFloorPatch,
  type DaylightOpening,
  type InteriorDaylight,
} from '@/systems/world3d/interiorDaylight';
import { siteLocalToScene, type SitePlacement } from './interiorPlacement';
import { emissiveForPart, useInteriorHour } from './InteriorHourContext';
import { isWebGpuWorldEnabled } from './webgpuWorldFlag';
import { WINDOW_GLOW_HEX } from '@/systems/worldforge/bridge/interiorParts';
import { DEFAULT_TIME_OF_DAY_H, sunFromTime } from './World3DLighting';
import { LAMP_FLAME_ABOVE_M, LAMP_FURNITURE } from './tableLamp';
import { isInteriorLive } from './liveInteriors';

/**
 * NIGHT LIGHT OUT (2026-11-02, Remy: "lighting in the houses"). A lit window
 * is a rectangle of lamplit room seen through glass, so it is modeled as what
 * it is: a rectangular area light the size of the pane, facing out of the
 * house, with the same radiance the pane shows (WINDOW_GLOW_HEX at the pane's
 * emissive intensity). No look-tuned number: the street receives exactly the
 * light the glass appears to emit. RectAreaLight needs its LTC tables once
 * per renderer type.
 */
if (isWebGpuWorldEnabled()) RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init());
else RectAreaLightUniformsLib.init();

/** Max simultaneous hearth point lights — a hard cap (perf discipline). */
const MAX_HEARTH_LIGHTS = 4;
/** Only hearths within this scene-meter radius of the camera light up. */
const HEARTH_RANGE_M = 40;
/** Warm hearth flame color. */
const HEARTH_LIGHT_COLOR = new THREE.Color('#ff8a3c');
/** Per-light intensity + falloff — lights the room, not the town. */
const HEARTH_INTENSITY = 14;
const HEARTH_DISTANCE_M = 9;
const HEARTH_DECAY = 2;

/** A lit pane's radiance, as the glass shows it (emissiveForPart at a lit hour). */
const WINDOW_RADIANCE = emissiveForPart('window', 0, [true]).emissiveIntensity;
/** Max lit windows that light the street at once, nearest first. */
const MAX_WINDOW_LIGHTS = 8;
/** Only lit windows within this scene-meter radius of the camera light the street. */
const WINDOW_RANGE_M = 40;
/** Max table lamps lit at once, nearest first (perf discipline, as hearths). */
const MAX_LAMP_LIGHTS = 4;
const LAMP_RANGE_M = 30;
/**
 * An oil lamp gives about 100 lumens; spread over the full sphere that is
 * 100 / (4 pi) = 8 candela. three's physical point-light intensity is candela.
 */
const LAMP_INTENSITY_CD = 8;
const LAMP_DISTANCE_M = 7;
/** Warm oil-flame color. */
const LAMP_LIGHT_COLOR = new THREE.Color('#ffb36b');
const WINDOW_LIGHT_COLOR = new THREE.Color(WINDOW_GLOW_HEX);

/**
 * SUN BOUNCE (GG-594 part 2, 2026-11-02). The sun lights a patch of floor
 * through each window (the shadow map draws it), and a real room is lit
 * mostly by the light that patch reflects. three.js has no global
 * illumination, so the patch lit nothing. Each sunlit patch near the camera
 * now carries an upward area light the size of the patch (sunFloorPatch).
 *
 * The radiance is the patch as drawn, not a look-tuned number: the floor
 * receives E = sun intensity * s.y (glass casts no shadow, so the drawn
 * patch has no glass loss either) and a matte floor sends L = rho * E / pi.
 * A three RectAreaLight's intensity is that radiance; its color carries the
 * sun color times the floor color, which is the rho of each channel. The
 * area light's form factor gives the first bounce at every surface above the
 * patch. The light has no shadow, so a wall between the patch and a point
 * does not stop it (the patch is clipped at the first wall across the beam).
 *
 * The bounce shares the window-light pool: lit windows (night) take their
 * slots first, sunlit patches (day) take the rest. The pool keeps one fixed
 * count of area lights, so the bounce adds no light to the shader.
 */
const BOUNCE_RANGE_M = 25;
/** The bounce area light floats this far above the floor top (no z-fight). */
const BOUNCE_LIFT_M = 0.02;

/** One hearth's world-scene position (already rebased to the scene origin). */
export interface HearthLight {
  x: number;
  y: number;
  z: number;
  /**
   * The site's 24-hour hearth schedule (`hearthHours[h]` = lit at hour h).
   * Undefined for legacy/unscheduled sites (always eligible). The per-frame
   * selector skips a hearth whose current hour is dark before the distance test.
   */
  hearthHours?: boolean[];
}

/** One window pane as an outward-facing area emitter, scene space. */
export interface WindowEmitter {
  x: number;
  y: number;
  z: number;
  /** Unit outward normal (horizontal). */
  nx: number;
  nz: number;
  /** Pane width along the wall and height, meters. */
  width: number;
  height: number;
  /** The building's window-lit schedule (litHours[h]); undefined = never lit. */
  litHours?: boolean[];
}

/** One lamp position (scene space) on a table-like furnishing. */
export interface LampLight {
  x: number;
  y: number;
  z: number;
  /** The building's window-lit schedule: lamps burn when the windows glow. */
  litHours?: boolean[];
  /** The chunk's site object: a lamp lights only while its rooms are live. */
  site?: object;
}

/** One building with interior daylight, in scene space (yaw + origin). */
export interface DaylitHouse {
  /** The chunk's site object: bounce only while its rooms are live. */
  site: object;
  gx: number;
  gz: number;
  surfaceY: number;
  cos: number;
  sin: number;
  day: InteriorDaylight;
}

/** One window pane that can let the sun onto a floor. */
export interface SunAperture {
  /** Pane center (scene meters), for the distance test. */
  x: number;
  y: number;
  z: number;
  /** Unit outward normal (scene, horizontal): the sun must be on this side. */
  nx: number;
  nz: number;
  house: DaylitHouse;
  opening: DaylightOpening;
}

/** A sunlit floor patch in scene space, with its bounce color and radiance. */
export interface ScenePatch {
  x: number;
  y: number;
  z: number;
  /** The window's outward normal (scene); the patch depth runs along it. */
  nx: number;
  nz: number;
  width: number;
  depth: number;
  /** Linear sun color times the floor color (the per-channel reflectance). */
  color: THREE.Color;
  /** Radiance of a white floor: sun intensity * s.y / pi. */
  intensity: number;
}

/**
 * The sunlit patch of one aperture under `sun` (scene space, from
 * sunFromTime), or null. Pure; allocates its result.
 */
export function scenePatchFor(
  a: SunAperture,
  sun: { direction: readonly [number, number, number]; sunColor: number; sunIntensity: number },
): ScenePatch | null {
  const [sx, sy, sz] = sun.direction;
  const { cos, sin } = a.house;
  // Scene -> render frame is the inverse yaw (see collectInteriorLighting).
  const local = { x: sx * cos - sz * sin, y: sy, z: sx * sin + sz * cos };
  const p = sunFloorPatch(a.house.day, a.opening, local);
  if (!p) return null;
  return {
    x: a.house.gx + p.center.x * cos + p.center.z * sin,
    y: a.house.surfaceY + p.center.y,
    z: a.house.gz - p.center.x * sin + p.center.z * cos,
    nx: p.outward.x * cos + p.outward.z * sin,
    nz: -p.outward.x * sin + p.outward.z * cos,
    width: p.width,
    depth: p.depth,
    color: new THREE.Color(sun.sunColor).multiply(new THREE.Color(p.floorHex)),
    intensity: (sun.sunIntensity * sy) / Math.PI,
  };
}

/** One building shell's scene-space bounds. Since the fill light went (GG-594
 * part 1), the shells only tell whether any interior building is loaded. */
export interface ShellBounds {
  /** Group origin (scene meters). */
  cx: number;
  cz: number;
  /** Yaw applied to the group (radians). */
  rotationY: number;
  /** Half extents along the group's local width/depth axes (meters). */
  halfW: number;
  halfD: number;
  /** Group base Y (ground surface) and shell top height above it. */
  baseY: number;
  topY: number;
}

/**
 * Flatten the loaded chunks into (a) every lit-hearth world position and (b)
 * every interior-bearing shell's bounds, in scene space. Recomputed only when
 * the loaded-chunk set changes (keyed by chunk coords) — never per frame.
 */
export const INTERIOR_LIGHT_TUNING = {
  MAX_HEARTH_LIGHTS,
  HEARTH_RANGE_M,
  HEARTH_INTENSITY,
  HEARTH_DISTANCE_M,
  MAX_WINDOW_LIGHTS,
  MAX_LAMP_LIGHTS,
} as const;

export function collectInteriorLighting(
  loaded: LoadedChunk[],
  origin: SceneOrigin,
): { hearths: HearthLight[]; shells: ShellBounds[]; windows: WindowEmitter[]; lamps: LampLight[]; apertures: SunAperture[] } {
  const hearths: HearthLight[] = [];
  const shells: ShellBounds[] = [];
  const windows: WindowEmitter[] = [];
  const lamps: LampLight[] = [];
  const apertures: SunAperture[] = [];
  for (const chunk of loaded) {
    const o = chunkOriginWorld(chunk.cx, chunk.cy);
    const chunkScene = worldToScene(o.x, o.y, origin); // chunk-local frame origin
    for (const s of chunk.bundle.sites) {
      if (!s.parts) continue;
      const gx = chunkScene.x + s.localX;
      const gz = chunkScene.z + s.localZ;
      const rot = s.rotationY ?? 0;
      const doorSign = s.doorZSign ?? -1;
      // Shell bounds (mirror SiteBuilding's test): one per interior building.
      shells.push({
        cx: gx,
        cz: gz,
        rotationY: rot,
        halfW: (s.wallWidthM ?? s.boxWidth ?? 0) / 2 + 0.5,
        halfD: (s.wallDepthM ?? s.boxDepth ?? 0) / 2 + 0.5,
        baseY: s.surfaceY,
        topY: s.surfaceY + (s.boxHeight ?? 0) + 1.0,
      });
      // Hearth flame lights: the hearth furnishing part carries lightRole
      // 'hearth'. Project its site-local (x, z) into scene space with the SAME
      // transform SiteBuilding renders it through (shared helper). The hearth's
      // live-lit hours ride along so the selector can skip a dark hearth. The y
      // stays local: surfaceY + baseY + half height (yaw never touches y).
      const placement: SitePlacement = {
        gx,
        gz,
        rotationY: rot,
        doorZSign: doorSign,
      };
      for (const p of s.parts) {
        if (p.lightRole !== 'hearth') continue;
        const { x, z } = siteLocalToScene(p.x, p.z, placement);
        const y = s.surfaceY + (p.baseY ?? 0) + p.h * 0.5;
        hearths.push({ x, y, z, hearthHours: s.hearthHours });
      }
      // Window openings in the render frame (z already flipped by doorZSign),
      // then the group's yaw and origin, as three applies them. Every pane of
      // every building can let the sun onto a floor (the sun bounce).
      const day = buildInteriorDaylight(s.parts, doorSign);
      const cos = Math.cos(rot), sin = Math.sin(rot);
      if (day) {
        const house: DaylitHouse = { site: s, gx, gz, surfaceY: s.surfaceY, cos, sin, day };
        for (const o of day.openings) {
          apertures.push({
            x: gx + o.center.x * cos + o.center.z * sin,
            y: s.surfaceY + o.center.y,
            z: gz - o.center.x * sin + o.center.z * cos,
            nx: o.outward.x * cos + o.outward.z * sin,
            nz: -o.outward.x * sin + o.outward.z * cos,
            house,
            opening: o,
          });
        }
      }
      // Lit windows and lamps exist only for a building with a lit schedule.
      if (!s.litHours?.some(Boolean)) continue;
      for (const p of s.parts) {
        if (!p.furnishing || !LAMP_FURNITURE.has(p.furnishing.kind)) continue;
        const { x, z } = siteLocalToScene(p.x, p.z, placement);
        lamps.push({ x, y: s.surfaceY + (p.baseY ?? 0) + p.h + LAMP_FLAME_ABOVE_M, z, litHours: s.litHours, site: s });
      }
      if (!day) continue;
      for (const o of day.openings) {
        const [a, b, , d] = o.corners;
        windows.push({
          x: gx + o.center.x * cos + o.center.z * sin,
          y: s.surfaceY + o.center.y,
          z: gz - o.center.x * sin + o.center.z * cos,
          nx: o.outward.x * cos + o.outward.z * sin,
          nz: -o.outward.x * sin + o.outward.z * cos,
          width: Math.hypot(b.x - a.x, b.z - a.z),
          height: Math.abs(d.y - a.y),
          litHours: s.litHours,
        });
      }
    }
  }
  return { hearths, shells, windows, lamps, apertures };
}

/**
 * Pick the nearest `cap` candidates that are lit at `hourInt` and inside
 * `range` of the camera, into `pick` (indices, -1 = empty). Sorted top-N
 * insertion over preallocated arrays: no per-frame allocation.
 */
function nearestLit(
  items: ReadonlyArray<{ x: number; y: number; z: number; litHours?: boolean[]; site?: object }>,
  cam: THREE.Vector3,
  hourInt: number,
  range: number,
  pick: number[],
  dist: number[],
  liveOnly = false,
): void {
  const cap = pick.length;
  for (let i = 0; i < cap; i++) { pick[i] = -1; dist[i] = Infinity; }
  const rangeSq = range * range;
  for (let k = 0; k < items.length; k++) {
    if (!items[k].litHours?.[hourInt]) continue;
    // A lamp in a closed shell lights nothing visible (see liveInteriors.ts).
    if (liveOnly && items[k].site && !isInteriorLive(items[k].site!)) continue;
    const dx = items[k].x - cam.x, dy = items[k].y - cam.y, dz = items[k].z - cam.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > rangeSq || d2 >= dist[cap - 1]) continue;
    let slot = cap - 1;
    while (slot > 0 && dist[slot - 1] > d2) { dist[slot] = dist[slot - 1]; pick[slot] = pick[slot - 1]; slot--; }
    dist[slot] = d2;
    pick[slot] = k;
  }
}

type SunState = ReturnType<typeof sunFromTime>;

/**
 * Pick the nearest `cap` apertures within `range` of the camera whose window
 * throws a sun patch onto a floor, into `pick` (indices, -1 = empty). Patches
 * come from `cache` (computed once per aperture per sun state). A window that
 * faces away from the sun is skipped before any patch math.
 */
function nearestSunlit(
  apertures: ReadonlyArray<SunAperture>,
  cam: THREE.Vector3,
  sun: SunState,
  range: number,
  cache: Map<SunAperture, ScenePatch | null>,
  pick: number[],
  dist: number[],
): void {
  const cap = pick.length;
  for (let i = 0; i < cap; i++) { pick[i] = -1; dist[i] = Infinity; }
  const [sx, sy, sz] = sun.direction;
  if (sy <= 0) return;
  const rangeSq = range * range;
  for (let k = 0; k < apertures.length; k++) {
    const a = apertures[k];
    if (a.nx * sx + a.nz * sz <= 0) continue;
    // Only live rooms: a closed shell keeps the sun out (see liveInteriors.ts).
    if (!isInteriorLive(a.house.site)) continue;
    const dx = a.x - cam.x, dy = a.y - cam.y, dz = a.z - cam.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > rangeSq || d2 >= dist[cap - 1]) continue;
    let patch = cache.get(a);
    if (patch === undefined) {
      patch = scenePatchFor(a, sun);
      cache.set(a, patch);
    }
    if (!patch) continue;
    let slot = cap - 1;
    while (slot > 0 && dist[slot - 1] > d2) { dist[slot] = dist[slot - 1]; pick[slot] = pick[slot - 1]; slot--; }
    dist[slot] = d2;
    pick[slot] = k;
  }
}

const InteriorLights: React.FC<{
  loaded: LoadedChunk[];
  origin: SceneOrigin;
  /** The sun's hour, as World3DLighting gets it (the bounce follows that sun). */
  sunHours?: number;
}> = ({ loaded, origin, sunHours }) => {
  // The live game hour comes from the shared InteriorHour context (one clock
  // source for every interior liveness — windows, hearths, occupants — honoring
  // the window.__wfAgentClock scrub override like GroundAgents). Hearths dark at
  // this hour are skipped in the selector below.
  const hour = useInteriorHour();
  // Static-per-chunk-set lighting data (no per-frame rebuild). The key changes
  // only when chunks stream in/out.
  const loadedKey = loaded.map((c) => `${c.cx}|${c.cy}`).join(',');
  const { hearths, shells, windows, lamps, apertures } = useMemo(
    () => collectInteriorLighting(loaded, origin),
    // loadedKey captures set membership; origin is frozen for the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadedKey, origin],
  );
  // The same sun as World3DLighting (same hour, same default).
  const sun = useMemo(() => sunFromTime(sunHours ?? DEFAULT_TIME_OF_DAY_H), [sunHours]);
  const patchCache = useRef<{ sun: SunState | null; apertures: SunAperture[] | null; map: Map<SunAperture, ScenePatch | null> }>(
    { sun: null, apertures: null, map: new Map() },
  );

  const hearthRefs = useRef<Array<THREE.PointLight | null>>([]);
  const windowRefs = useRef<Array<THREE.RectAreaLight | null>>([]);
  const lampRefs = useRef<Array<THREE.PointLight | null>>([]);
  const nightScratch = useRef({
    winPick: new Array<number>(MAX_WINDOW_LIGHTS).fill(-1),
    winDist: new Array<number>(MAX_WINDOW_LIGHTS).fill(Infinity),
    lampPick: new Array<number>(MAX_LAMP_LIGHTS).fill(-1),
    lampDist: new Array<number>(MAX_LAMP_LIGHTS).fill(Infinity),
    bouncePick: new Array<number>(MAX_WINDOW_LIGHTS).fill(-1),
    bounceDist: new Array<number>(MAX_WINDOW_LIGHTS).fill(Infinity),
  });
  // Preallocated scratch — no per-frame allocation in the selector loop.
  const scratch = useRef({
    // indices + squared distances of the current nearest candidates
    pick: new Array<number>(MAX_HEARTH_LIGHTS).fill(-1),
    dist: new Array<number>(MAX_HEARTH_LIGHTS).fill(Infinity),
  });

  useFrame(({ camera }) => {
    const cam = camera.position;
    const { pick, dist } = scratch.current;

    // ── Hearth point lights: nearest-first ≤ cap within range ────────────────
    for (let i = 0; i < MAX_HEARTH_LIGHTS; i++) {
      pick[i] = -1;
      dist[i] = Infinity;
    }
    const rangeSq = HEARTH_RANGE_M * HEARTH_RANGE_M;
    const hourInt = ((Math.floor(hour) % 24) + 24) % 24;
    for (let h = 0; h < hearths.length; h++) {
      // Skip a hearth that is dark at the current hour before the distance test.
      if (hearths[h].hearthHours && !hearths[h].hearthHours![hourInt]) continue;
      const dx = hearths[h].x - cam.x;
      const dy = hearths[h].y - cam.y;
      const dz = hearths[h].z - cam.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > rangeSq) continue;
      // Insertion into the sorted top-N (tiny fixed N, no allocation).
      if (d2 >= dist[MAX_HEARTH_LIGHTS - 1]) continue;
      let slot = MAX_HEARTH_LIGHTS - 1;
      while (slot > 0 && dist[slot - 1] > d2) {
        dist[slot] = dist[slot - 1];
        pick[slot] = pick[slot - 1];
        slot--;
      }
      dist[slot] = d2;
      pick[slot] = h;
    }
    // GG-594 part 3: a hearth goes dark by intensity 0, not by `visible`, as
    // the window and lamp lights below do. A `visible` flip changes the light
    // count, which makes three rebuild the program of every lit material.
    for (let i = 0; i < MAX_HEARTH_LIGHTS; i++) {
      const light = hearthRefs.current[i];
      if (!light) continue;
      const idx = pick[i];
      if (idx < 0) {
        light.intensity = 0;
        continue;
      }
      const hearth = hearths[idx];
      light.position.set(hearth.x, hearth.y + 0.3, hearth.z);
      light.intensity = HEARTH_INTENSITY;
    }

    // ── Lit windows onto the street, lamps inside: nearest-first ≤ cap ───────
    // These lights keep a FIXED count and go dark by intensity 0, not by
    // `visible`: a change in the light count makes three rebuild the
    // programs of every lit material.
    const night = nightScratch.current;
    nearestLit(windows, cam, hourInt, WINDOW_RANGE_M, night.winPick, night.winDist);
    // The sun bounce takes the slots that no lit window holds (SUN BOUNCE).
    const cache = patchCache.current;
    if (cache.sun !== sun || cache.apertures !== apertures) {
      cache.map.clear();
      cache.sun = sun;
      cache.apertures = apertures;
    }
    nearestSunlit(apertures, cam, sun, BOUNCE_RANGE_M, cache.map, night.bouncePick, night.bounceDist);
    let nextBounce = 0;
    for (let i = 0; i < MAX_WINDOW_LIGHTS; i++) {
      const light = windowRefs.current[i];
      if (!light) continue;
      const idx = night.winPick[i];
      if (idx >= 0) {
        const w = windows[idx];
        light.color.copy(WINDOW_LIGHT_COLOR);
        light.intensity = WINDOW_RADIANCE;
        light.width = w.width;
        light.height = w.height;
        // A hair outside the glass, facing out of the house.
        light.position.set(w.x + w.nx * 0.03, w.y, w.z + w.nz * 0.03);
        light.up.set(0, 1, 0);
        light.lookAt(w.x + w.nx, w.y, w.z + w.nz);
        continue;
      }
      const ai = nextBounce < MAX_WINDOW_LIGHTS ? night.bouncePick[nextBounce++] : -1;
      const patch = ai >= 0 ? cache.map.get(apertures[ai]) : null;
      if (!patch) { light.intensity = 0; continue; }
      light.color.copy(patch.color);
      light.intensity = patch.intensity;
      // Width along the wall, height along the window normal (the `up`
      // below), facing up out of the floor.
      light.width = patch.width;
      light.height = patch.depth;
      light.position.set(patch.x, patch.y + BOUNCE_LIFT_M, patch.z);
      light.up.set(patch.nx, 0, patch.nz);
      light.lookAt(patch.x, patch.y + 1, patch.z);
    }
    nearestLit(lamps, cam, hourInt, LAMP_RANGE_M, night.lampPick, night.lampDist, true);
    for (let i = 0; i < MAX_LAMP_LIGHTS; i++) {
      const light = lampRefs.current[i];
      if (!light) continue;
      const idx = night.lampPick[i];
      if (idx < 0) { light.intensity = 0; continue; }
      light.intensity = LAMP_INTENSITY_CD;
      light.position.set(lamps[idx].x, lamps[idx].y, lamps[idx].z);
    }
  });

  // No building with an interior loaded → mount no lights at all (perf: zero
  // cost away from towns). Every hearth, window, lamp and aperture belongs to
  // such a building.
  if (shells.length === 0) return null;

  // GG-594 part 3: while any interior building is loaded, every pool mounts at
  // its full size, whether or not this chunk set has a hearth, a lit window or
  // a lamp. The light count then changes only when the town itself streams in
  // or out, never when one more hearth or lit house enters the set.
  return (
    <>
      {Array.from({ length: MAX_HEARTH_LIGHTS }).map((_, i) => (
          <pointLight
            key={`hearth-${i}`}
            ref={(el) => {
              hearthRefs.current[i] = el;
            }}
            color={HEARTH_LIGHT_COLOR}
            intensity={0}
            distance={HEARTH_DISTANCE_M}
            decay={HEARTH_DECAY}
            castShadow={false}
          />
        ))}
      {Array.from({ length: MAX_WINDOW_LIGHTS }).map((_, i) => (
          <rectAreaLight
            key={`window-${i}`}
            ref={(el) => {
              windowRefs.current[i] = el;
            }}
            color={WINDOW_GLOW_HEX}
            intensity={0}
            width={1}
            height={1}
          />
        ))}
      {Array.from({ length: MAX_LAMP_LIGHTS }).map((_, i) => (
          <pointLight
            key={`lamp-${i}`}
            ref={(el) => {
              lampRefs.current[i] = el;
            }}
            color={LAMP_LIGHT_COLOR}
            intensity={0}
            distance={LAMP_DISTANCE_M}
            decay={2}
            castShadow={false}
          />
        ))}
    </>
  );
};

export default InteriorLights;
