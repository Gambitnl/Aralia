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
 *     first, reselected each frame as the camera moves. Zero lights when nothing
 *     is lit. These make a hearthside room glow from a real source (bodies cast
 *     no shadow but pick up the warm falloff) rather than only the emissive box.
 *
 *  2. CAMERA-INSIDE fill — one neutral light that fades in when the camera is
 *     inside a building shell (cheap footprint-bounds + under-roof test) so any
 *     interior is readable at ANY hour, even a dark unlit house at noon. Smooth
 *     0.3 s intensity lerp so there is no pop crossing the threshold. When the
 *     camera and reached player share a shell, it stays above the player so
 *     orbiting several meters away does not leave the furniture dark.
 *
 *  3. LIT WINDOWS onto the street (2026-11-02) — the nearest ≤8 lit panes within
 *     40 m each get a RectAreaLight the size of the pane, facing out, with the
 *     radiance the pane shows. The street receives the light the glass emits.
 *
 *  4. TABLE LAMPS (2026-11-02) — while a household's windows are lit, an oil
 *     lamp (8 cd, about 100 lm) burns on each table, desk, counter and
 *     workbench; the nearest ≤4 within 30 m are real point lights.
 *
 * The window and lamp lights keep a fixed count and go dark by intensity, so
 * a camera move never changes the light count (which recompiles materials).
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
import { buildInteriorDaylight } from '@/systems/world3d/interiorDaylight';
import { siteLocalToScene, type SitePlacement } from './interiorPlacement';
import { emissiveForPart, useInteriorHour } from './InteriorHourContext';
import { isWebGpuWorldEnabled } from './webgpuWorldFlag';
import { WINDOW_GLOW_HEX } from '@/systems/worldforge/bridge/interiorParts';

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
/** The lamp's flame stands this far above the top of its table. */
const LAMP_FLAME_ABOVE_M = 0.3;
/** Furniture that holds a lamp when the household has its lamps lit. */
const LAMP_FURNITURE = new Set(['table', 'desk', 'writing-desk', 'counter', 'workbench']);

/** Neutral camera-inside fill — readable interior at any hour. */
const FILL_COLOR = new THREE.Color('#fff2e0');
// The admitted fill sits 2.7 m above the reached body. At 1.15 its falloff
// leaves faces and nearby furniture nearly black in the played inn. Give this
// existing readability light enough power at that distance; hearth timing,
// warm flame lights, shell admission and the one-fill budget stay separate.
const FILL_TARGET_INTENSITY = 24;
/** Seconds to fade the fill in/out (no pop crossing the shell threshold). */
const FILL_FADE_S = 0.3;

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
}

/** One building shell's scene-space bounds for the camera-inside test. */
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

function insideInteriorShell(point:THREE.Vector3,sh:ShellBounds):boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)
    || point.y<sh.baseY-.5 || point.y>sh.topY) return false;
  const dx=point.x-sh.cx,dz=point.z-sh.cz,cos=Math.cos(-sh.rotationY),sin=Math.sin(-sh.rotationY);
  return Math.abs(dx*cos+dz*sin)<=sh.halfW && Math.abs(-dx*sin+dz*cos)<=sh.halfD;
}

/** Keep the existing camera-inside gate. A reached body can anchor this one
 * presentation light only when it shares that same source building shell;
 * looking into a different house cannot move its fill to a remote player. */
export function interiorFillAnchor(camera: THREE.Vector3, player: THREE.Vector3 | null,
  shells: readonly ShellBounds[]): THREE.Vector3 | null {
  let cameraInside=false;
  for (const sh of shells) {
    if (!insideInteriorShell(camera,sh)) continue;
    cameraInside=true;
    if (player && insideInteriorShell(player,sh)) return player;
  }
  return cameraInside?camera:null;
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
  FILL_TARGET_INTENSITY,
  FILL_FADE_S,
} as const;

export function collectInteriorLighting(
  loaded: LoadedChunk[],
  origin: SceneOrigin,
): { hearths: HearthLight[]; shells: ShellBounds[]; windows: WindowEmitter[]; lamps: LampLight[] } {
  const hearths: HearthLight[] = [];
  const shells: ShellBounds[] = [];
  const windows: WindowEmitter[] = [];
  const lamps: LampLight[] = [];
  for (const chunk of loaded) {
    const o = chunkOriginWorld(chunk.cx, chunk.cy);
    const chunkScene = worldToScene(o.x, o.y, origin); // chunk-local frame origin
    for (const s of chunk.bundle.sites) {
      if (!s.parts) continue;
      const gx = chunkScene.x + s.localX;
      const gz = chunkScene.z + s.localZ;
      const rot = s.rotationY ?? 0;
      const doorSign = s.doorZSign ?? -1;
      // Shell bounds for the camera-inside fill (mirror SiteBuilding's test).
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
      // Lit windows and lamps exist only for a building with a lit schedule.
      if (!s.litHours?.some(Boolean)) continue;
      for (const p of s.parts) {
        if (!p.furnishing || !LAMP_FURNITURE.has(p.furnishing.kind)) continue;
        const { x, z } = siteLocalToScene(p.x, p.z, placement);
        lamps.push({ x, y: s.surfaceY + (p.baseY ?? 0) + p.h + LAMP_FLAME_ABOVE_M, z, litHours: s.litHours });
      }
      // Window openings in the render frame (z already flipped by doorZSign),
      // then the group's yaw and origin, as three applies them.
      const day = buildInteriorDaylight(s.parts, doorSign);
      if (!day) continue;
      const cos = Math.cos(rot), sin = Math.sin(rot);
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
  return { hearths, shells, windows, lamps };
}

/**
 * Pick the nearest `cap` candidates that are lit at `hourInt` and inside
 * `range` of the camera, into `pick` (indices, -1 = empty). Sorted top-N
 * insertion over preallocated arrays: no per-frame allocation.
 */
function nearestLit(
  items: ReadonlyArray<{ x: number; y: number; z: number; litHours?: boolean[] }>,
  cam: THREE.Vector3,
  hourInt: number,
  range: number,
  pick: number[],
  dist: number[],
): void {
  const cap = pick.length;
  for (let i = 0; i < cap; i++) { pick[i] = -1; dist[i] = Infinity; }
  const rangeSq = range * range;
  for (let k = 0; k < items.length; k++) {
    if (!items[k].litHours?.[hourInt]) continue;
    const dx = items[k].x - cam.x, dy = items[k].y - cam.y, dz = items[k].z - cam.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > rangeSq || d2 >= dist[cap - 1]) continue;
    let slot = cap - 1;
    while (slot > 0 && dist[slot - 1] > d2) { dist[slot] = dist[slot - 1]; pick[slot] = pick[slot - 1]; slot--; }
    dist[slot] = d2;
    pick[slot] = k;
  }
}

const InteriorLights: React.FC<{
  loaded: LoadedChunk[];
  origin: SceneOrigin;
}> = ({ loaded, origin }) => {
  // The live game hour comes from the shared InteriorHour context (one clock
  // source for every interior liveness — windows, hearths, occupants — honoring
  // the window.__wfAgentClock scrub override like GroundAgents). Hearths dark at
  // this hour are skipped in the selector below.
  const hour = useInteriorHour();
  // Static-per-chunk-set lighting data (no per-frame rebuild). The key changes
  // only when chunks stream in/out.
  const loadedKey = loaded.map((c) => `${c.cx}|${c.cy}`).join(',');
  const { hearths, shells, windows, lamps } = useMemo(
    () => collectInteriorLighting(loaded, origin),
    // loadedKey captures set membership; origin is frozen for the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadedKey, origin],
  );

  const hearthRefs = useRef<Array<THREE.PointLight | null>>([]);
  const windowRefs = useRef<Array<THREE.RectAreaLight | null>>([]);
  const lampRefs = useRef<Array<THREE.PointLight | null>>([]);
  const nightScratch = useRef({
    winPick: new Array<number>(MAX_WINDOW_LIGHTS).fill(-1),
    winDist: new Array<number>(MAX_WINDOW_LIGHTS).fill(Infinity),
    lampPick: new Array<number>(MAX_LAMP_LIGHTS).fill(-1),
    lampDist: new Array<number>(MAX_LAMP_LIGHTS).fill(Infinity),
  });
  const fillRef = useRef<THREE.PointLight>(null);
  const fillIntensity = useRef(0);
  const fillBody = useRef<{scene:THREE.Scene|null; player:THREE.Object3D|null; retryAfter:number}>(
    {scene:null,player:null,retryAfter:.25});
  // Preallocated scratch — no per-frame allocation in the selector loop.
  const scratch = useRef({
    // indices + squared distances of the current nearest candidates
    pick: new Array<number>(MAX_HEARTH_LIGHTS).fill(-1),
    dist: new Array<number>(MAX_HEARTH_LIGHTS).fill(Infinity),
    local: new THREE.Vector3(),
  });

  useFrame(({ camera, scene }, delta) => {
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
    for (let i = 0; i < MAX_HEARTH_LIGHTS; i++) {
      const light = hearthRefs.current[i];
      if (!light) continue;
      const idx = pick[i];
      if (idx < 0) {
        light.visible = false;
        continue;
      }
      const hearth = hearths[idx];
      light.position.set(hearth.x, hearth.y + 0.3, hearth.z);
      light.visible = true;
    }

    // ── Lit windows onto the street, lamps inside: nearest-first ≤ cap ───────
    // These lights keep a FIXED count and go dark by intensity 0, not by
    // `visible`: a change in the light count makes three rebuild the
    // programs of every lit material.
    const night = nightScratch.current;
    nearestLit(windows, cam, hourInt, WINDOW_RANGE_M, night.winPick, night.winDist);
    for (let i = 0; i < MAX_WINDOW_LIGHTS; i++) {
      const light = windowRefs.current[i];
      if (!light) continue;
      const idx = night.winPick[i];
      if (idx < 0) { light.intensity = 0; continue; }
      const w = windows[idx];
      light.intensity = WINDOW_RADIANCE;
      light.width = w.width;
      light.height = w.height;
      // A hair outside the glass, facing out of the house.
      light.position.set(w.x + w.nx * 0.03, w.y, w.z + w.nz * 0.03);
      light.lookAt(w.x + w.nx, w.y, w.z + w.nz);
    }
    nearestLit(lamps, cam, hourInt, LAMP_RANGE_M, night.lampPick, night.lampDist);
    for (let i = 0; i < MAX_LAMP_LIGHTS; i++) {
      const light = lampRefs.current[i];
      if (!light) continue;
      const idx = night.lampPick[i];
      if (idx < 0) { light.intensity = 0; continue; }
      light.intensity = LAMP_INTENSITY_CD;
      light.position.set(lamps[idx].x, lamps[idx].y, lamps[idx].z);
    }

    // ── Camera-inside fill: fade in when inside any shell ─────────────────────
    // Reuse the actual mounted body, as ground nameplates do. Cache its identity
    // and bound missing-body searches to four per second; no game pose is moved.
    const body=fillBody.current;
    if(body.scene!==scene){body.scene=scene;body.player=null;body.retryAfter=.25;}
    body.retryAfter+=delta;
    if(!body.player?.parent && body.retryAfter>=.25){body.player=scene.getObjectByName('world3d:player')??null;body.retryAfter=0;}
    const player=body.player?.parent?body.player.getWorldPosition(scratch.current.local):null;
    const anchor=interiorFillAnchor(cam,player,shells);
    const inside=anchor!==null;
    const target = inside ? FILL_TARGET_INTENSITY : 0;
    // Exponential-ish lerp toward target over ~FILL_FADE_S.
    const t = Math.min(1, delta / FILL_FADE_S);
    fillIntensity.current += (target - fillIntensity.current) * t;
    const fill = fillRef.current;
    if (fill) {
      if (fillIntensity.current < 0.01) {
        fill.visible = false;
      } else {
        fill.visible = true;
        fill.intensity = fillIntensity.current;
        // Keep the existing one-fill budget. Place the same-shell fill
        // above the body: the first chest-height candidate lit the character
        // harshly from below. Camera-only views retain their old source,
        // including the fade after leaving the building.
        const source=anchor??cam;
        fill.position.copy(source);
        fill.position.y += source === cam ? .5 : 2.7;
      }
    }
  });

  // Nothing lit anywhere → mount no lights at all (perf: zero cost when dark).
  if (hearths.length === 0 && shells.length === 0 && windows.length === 0 && lamps.length === 0) return null;

  return (
    <>
      {hearths.length > 0 &&
        Array.from({ length: MAX_HEARTH_LIGHTS }).map((_, i) => (
          <pointLight
            key={`hearth-${i}`}
            ref={(el) => {
              hearthRefs.current[i] = el;
            }}
            visible={false}
            color={HEARTH_LIGHT_COLOR}
            intensity={HEARTH_INTENSITY}
            distance={HEARTH_DISTANCE_M}
            decay={HEARTH_DECAY}
            castShadow={false}
          />
        ))}
      {windows.length > 0 &&
        Array.from({ length: MAX_WINDOW_LIGHTS }).map((_, i) => (
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
      {lamps.length > 0 &&
        Array.from({ length: MAX_LAMP_LIGHTS }).map((_, i) => (
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
      {shells.length > 0 && (
        <pointLight
          ref={fillRef}
          visible={false}
          color={FILL_COLOR}
          intensity={0}
          distance={14}
          decay={2}
          castShadow={false}
        />
      )}
    </>
  );
};

export default InteriorLights;
