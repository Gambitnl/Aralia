/**
 * @file oceanExtras.ts — the plug-in slot of the ocean viewer.
 *
 * WHY THIS EXISTS. The ocean gauntlet builds several pieces at the same time:
 * buoyancy, spray, rain, the sea floor. Each piece must show in the one ocean
 * viewer, `SideBySideOcean.tsx`, but agents that all edit that one file block
 * one another. So each piece drops ONE file into `./oceanExtras/`, and this
 * module finds it. No agent edits a file another agent owns.
 *
 * WHAT A PIECE FILE EXPORTS.
 *
 *   export default async function mount(ctx: OceanExtraContext): Promise<OceanExtra>
 *   export const enabledByDefault = false;   // optional; true once the piece wins
 *
 * The real simulation code belongs in `src/systems/world3d/ocean/`. The piece
 * file only mounts it: it builds the objects, adds them to the scene, and
 * returns an `update` that the viewer calls once a frame.
 *
 * WHICH PIECES RUN. The `extras` URL parameter chooses:
 *
 *   (absent)          every piece that sets `enabledByDefault = true`
 *   extras=none       no piece
 *   extras=all        every piece
 *   extras=buoys,spray  the pieces with those file names
 *
 * A piece that fails to mount is an error, not a silent skip. The viewer
 * reports it on the page and on `__OCEAN__.error`, so a capture never shows a
 * sea that quietly lacks the piece under test.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 28/09/2026, 13:55:37
 * Dependents: components/DesignPreview/steps/sidebyside/SideBySideOcean.tsx, components/DesignPreview/steps/sidebyside/oceanExtras/beach.ts, components/DesignPreview/steps/sidebyside/oceanExtras/buoys.ts, components/DesignPreview/steps/sidebyside/oceanExtras/foam.ts, components/DesignPreview/steps/sidebyside/oceanExtras/rain.ts, components/DesignPreview/steps/sidebyside/oceanExtras/seabed.ts, components/DesignPreview/steps/sidebyside/oceanExtras/spray.ts, components/DesignPreview/steps/sidebyside/oceanExtras/underwater.ts, components/DesignPreview/steps/sidebyside/oceanExtras/wake.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type * as THREE from 'three/webgpu';
import type { OceanField } from '@/systems/world3d/ocean/oceanField';
import type { OceanSky } from '@/systems/world3d/ocean/oceanSky';

/** What a piece gets to work with. */
export interface OceanExtraContext {
  readonly renderer: THREE.WebGPURenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly field: OceanField;
  readonly sky: OceanSky;
  /** The sea seed. A piece that places things at random seeds from this. */
  readonly seed: number;
}

/** What a piece gives back. */
export interface OceanExtra {
  /**
   * Called once a frame, AFTER `field.step` and BEFORE the render.
   *
   * @param simTime the sea clock in seconds. It is pinned during a capture, so
   *                a piece that moves by `simTime` shows the same frame each run.
   * @param dtS     wall-clock seconds since the last frame, for a piece that
   *                must integrate (a floating body). It is 0 when the clock is
   *                pinned, so a pinned capture holds still.
   */
  update(simTime: number, dtS: number): void;
  dispose(): void;
  /**
   * Values a capture script can read or call, published at
   * `__OCEAN__.extras[<piece name>]`.
   */
  readonly probe?: Record<string, unknown>;
  /**
   * Optional. Something the camera can follow: its world position (the
   * point to keep centered) and its heading in the XZ plane (radians, from
   * +X toward +Z), as of the last `update`. The viewer shows a "Pin camera"
   * button when a mounted piece has one (Remy, 2026-09-28: "pin the camera to
   * the ship ... keeps the ship centered"). Nothing reads it while the button
   * is off, so a piece that adds it changes no captured frame.
   */
  followTarget?(): { xM: number; yM: number; zM: number; headingRad: number } | null;
}

interface ExtraModule {
  default: (ctx: OceanExtraContext) => Promise<OceanExtra> | OceanExtra;
  enabledByDefault?: boolean;
}

/* Vite finds every piece file at build time. The same pattern drives
 * `RaceDomainRegistry.ts`. */
const MODULES = import.meta.glob<ExtraModule>('./oceanExtras/*.ts');

/** Every piece file present, by name (the file name without `.ts`). */
export function listOceanExtras(): string[] {
  return Object.keys(MODULES)
    .map((p) => p.replace(/^.*\/(.+)\.ts$/, '$1'))
    .sort();
}

/**
 * Mount the pieces the URL asks for.
 *
 * @param param the value of the `extras` URL parameter, or null when absent.
 * @returns the mounted pieces by name.
 * @throws when a named piece does not exist or fails to mount.
 */
export async function mountOceanExtras(
  ctx: OceanExtraContext,
  param: string | null,
): Promise<Map<string, OceanExtra>> {
  const all = listOceanExtras();
  const byName = new Map(Object.entries(MODULES).map(([p, load]) => [
    p.replace(/^.*\/(.+)\.ts$/, '$1'), load,
  ]));

  let names: string[];
  if (param === 'none') names = [];
  else if (param === 'all') names = all;
  else if (param) {
    names = param.split(',').map((s) => s.trim()).filter(Boolean);
    const missing = names.filter((n) => !byName.has(n));
    if (missing.length > 0) {
      throw new Error(
        `[ocean] extras=${param} names ${missing.join(', ')}, which does not exist. `
        + `Pieces present: ${all.join(', ') || 'none'}.`,
      );
    }
  } else {
    names = [];
    for (const n of all) {
      const mod = await byName.get(n)!();
      if (mod.enabledByDefault) names.push(n);
    }
  }

  // THE VIEW BELOW THE SURFACE IS PART OF THE OCEAN, NOT A TOGGLE (2026-09-25).
  // A camera flown under the water on a page that did not ask for the
  // underwater piece saw flat gray: nothing drew below the surface. The
  // piece draws nothing and costs only a height compare above the reach of
  // the waves, so it is mounted on every page (0 pixels changed on the
  // judged above-water scenes). `?extras=none` still mounts nothing.
  if (param !== 'none' && byName.has('underwater') && !names.includes('underwater')) names.push('underwater');

  const mounted = new Map<string, OceanExtra>();
  for (const n of names) {
    const mod = await byName.get(n)!();
    try {
      mounted.set(n, await mod.default(ctx));
    } catch (e) {
      for (const m of mounted.values()) m.dispose();
      throw new Error(`[ocean] The ${n} piece failed to mount.\n\n${String(e)}`);
    }
  }
  return mounted;
}
