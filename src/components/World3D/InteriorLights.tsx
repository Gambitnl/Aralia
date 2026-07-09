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
 *     0.3 s intensity lerp so there is no pop crossing the threshold.
 *
 * DATA vs RENDER: which windows glow and where the hearths are flows through the
 * existing SitePart plumbing (emissiveHex tags, baked deterministically). This
 * component only does render-side, camera-relative SELECTION — legitimately not
 * deterministic data. No per-frame allocations in the selector loop.
 */
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LoadedChunk } from '@/systems/world3d/types';
import { chunkOriginWorld } from '@/systems/world3d/coords';
import { worldToScene, type SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { siteLocalToScene, type SitePlacement } from './interiorPlacement';
import { useInteriorHour } from './InteriorHourContext';

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

/** Neutral camera-inside fill — readable interior at any hour. */
const FILL_COLOR = new THREE.Color('#fff2e0');
const FILL_TARGET_INTENSITY = 1.15;
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
): { hearths: HearthLight[]; shells: ShellBounds[] } {
  const hearths: HearthLight[] = [];
  const shells: ShellBounds[] = [];
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
    }
  }
  return { hearths, shells };
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
  const { hearths, shells } = useMemo(
    () => collectInteriorLighting(loaded, origin),
    // loadedKey captures set membership; origin is frozen for the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadedKey, origin],
  );

  const hearthRefs = useRef<Array<THREE.PointLight | null>>([]);
  const fillRef = useRef<THREE.PointLight>(null);
  const fillIntensity = useRef(0);
  // Preallocated scratch — no per-frame allocation in the selector loop.
  const scratch = useRef({
    // indices + squared distances of the current nearest candidates
    pick: new Array<number>(MAX_HEARTH_LIGHTS).fill(-1),
    dist: new Array<number>(MAX_HEARTH_LIGHTS).fill(Infinity),
    local: new THREE.Vector3(),
  });

  useFrame(({ camera }, delta) => {
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

    // ── Camera-inside fill: fade in when inside any shell ─────────────────────
    let inside = false;
    const local = scratch.current.local;
    for (let sIdx = 0; sIdx < shells.length; sIdx++) {
      const sh = shells[sIdx];
      if (cam.y < sh.baseY - 0.5 || cam.y > sh.topY) continue;
      // Camera into the shell's local (unrotated) frame.
      const dx = cam.x - sh.cx;
      const dz = cam.z - sh.cz;
      const cos = Math.cos(-sh.rotationY);
      const sin = Math.sin(-sh.rotationY);
      const lx = dx * cos + dz * sin;
      const lz = -dx * sin + dz * cos;
      if (Math.abs(lx) <= sh.halfW && Math.abs(lz) <= sh.halfD) {
        inside = true;
        local.set(sh.cx, sh.topY - 1.0, sh.cz);
        break;
      }
    }
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
        // Anchor the fill just under the camera so it lights the room the player
        // stands in; follow the camera each frame.
        fill.position.set(cam.x, cam.y + 0.5, cam.z);
      }
    }
  });

  // Nothing lit anywhere → mount no lights at all (perf: zero cost when dark).
  if (hearths.length === 0 && shells.length === 0) return null;

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
