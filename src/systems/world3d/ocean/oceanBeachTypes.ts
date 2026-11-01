/**
 * @file oceanBeachTypes.ts
 * The original beach options, state, swash and resource contracts.
 * These declarations carry no GPU allocations and preserve every callback and field.
 * Existing public type imports remain available through oceanBeach.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 03:34:56
 * Dependents: systems/world3d/ocean/oceanBeach.ts, systems/world3d/ocean/oceanBeachResources.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import { type OceanField } from './oceanField';
import { createOceanSeabed, type OceanSeabed } from './oceanSeabed';
import { type SeabedParams } from './oceanSeabedMath';
import { type SwashGridSpec, type BeachFrame, type SwashLedger, type BeachSite } from './oceanBeachMath';


/** A TSL node expression. See `oceanSurface.ts` for why this is `any`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TslNode = any;

export interface OceanBeachOptions {
  readonly field: OceanField;
  /** Unit vector toward the sun: the sky's `sunDir`. */
  readonly sunDir: THREE.Vector3;
  /** The sky's `uOvercast` node. */
  readonly overcast: TslNode;
  /** The sky's blurred cloud copy (`OceanSky.cloudReflTexture`), for the sheet's reflection. */
  readonly skyClouds?: THREE.Texture;
  readonly seed: number;
  /**
   * Build the crest hide (see CREST_HIDE_H): the shore hook's `waterHide`,
   * so the surface discards the sea's crest over the sheet. Off by default
   * (round 11): the Discard costs about 1 ms of the sea's draw.
   */
  readonly crestHide?: boolean;
  /**
   * Build the look's levers of rounds 9 to 11 (the `tune.v*` uniforms; see
   * VARIANTS). Off by default (round 11): round 8's look, and round 8's node
   * graph, so its cost too (at 0 the levers' reads still cost 0.4 to 0.8 ms).
   */
  readonly levers?: boolean;
  /**
   * ROUND 12: build the look matched BY MEASURE to the Manly frames (see
   * MATCH_*; `&beachmatch=1` in the viewer). It builds the levers too and
   * sets the ones the match uses (vSand, vBand) on. Off by default: round
   * 8's look and round 8's node graph.
   */
  readonly match?: boolean;
  /**
   * ROUND 20: which swash the match runs. Absent or 'r20': the swash derived
   * from the sea and the sand (BEACH_MATCH_SWASH); 'r16': round 16's fitted
   * set (BEACH_MATCH_SWASH_R16), for an A/B in the same minutes. Only the
   * worker reads it; the look does not change.
   */
  readonly matchSwash?: 'r16' | 'r20';
  /**
   * RIVER MOUTH ROUND 1 (`oceanMouth.ts`): the beach on another floor and
   * grid. `seabedParams` is the floor (the surf coast with the river's
   * valley; absent: `LAGOON_CAY_SEABED`), `grid` the swash grid (absent:
   * `BEACH_GRID`), `wall` the swash cells the mouth's grid owns
   * (`SwashField.wall`), and `derivedSwash` runs the worker on round 20's
   * derived swash (the sea shoaled and held to the depth at the grid's edge)
   * without the match's look: a surf sea at the 0.64 m edge needs its crests
   * held. All absent, the beach is the cay's, bit for bit.
   */
  readonly seabedParams?: SeabedParams;
  readonly grid?: SwashGridSpec;
  readonly wall?: Uint8Array;
  readonly derivedSwash?: boolean;
  /**
   * RIVER MOUTH ROUND 12 (gap 2): the sea the swash grid is forced with, in place of the field's own cascades (the
   * place's day: `daySeaCascades`, the forced bands' energy scaled; the page scales the FFT's own forced bands by the
   * same share, so the grid's sea edge is the drawn sea). Absent: the field's cascades, as before.
   */
  readonly cascades?: readonly import('./oceanConfig').CascadeParams[];
  /**
   * RIVER MOUTH ROUND 1 (the lead's seam 1): the along-shore span [a0, a1]
   * of the strip the mouth's grid owns (its swash cells are `wall`). The
   * beach's look (the sheet, the lace, the surf's body, the wet sand) fades
   * out over EDGE_FADE_M before the strip, as it does at the patch's two
   * along-shore ends, so the swash sheet does not end in the boxes of water
   * that piles against the wall cells (they drew as white blocks at both
   * banks). Inside the strip the sea's one surface draws the mouth's water.
   * What is still open: the two grids do not trade water across the strip's
   * edge (the wall reflects); one grid, or a flux coupling, is the physical fix.
   * Absent: the look is the same node graph as before.
   */
  readonly wallStripA?: readonly [number, number];
  /**
   * RIVER MOUTH ROUND 5 (GG-394; the judge of round 4: "the sand spits are flat
   * tan polygons with hard clean edges: no wet-sand darkening"). Inside the
   * mouth's strip (\`wallStripA\`) the beach's look is off and the floor drew
   * the plain sand. The mouth's near field now carries the beach's own sand
   * (oceanMouthMath.ts, \`MouthSoil\`), and \`at\` reads its state at a world XZ
   * in the beach's own layout (a = (h, u, v, foam), b = (skin saturation,
   * stranded foam, mark, minutes since the water left)) with the near
   * field's weight w: over the strip the floor takes the beach's wet sand by
   * the same law (\`wetness\`, Angstrom's wet albedo, the immersed grains),
   * from the mouth's state. A holder: the mouth is built after the beach,
   * and sets \`at\` before the first frame (\`setStripSoil\`). Absent or null: the
   * look is the same node graph as before.
   */
  readonly stripSoil?: { at: ((xz: TslNode) => { w: TslNode; a: TslNode; b: TslNode }) | null };
  /**
   * RIVER MOUTH ROUND 1 (the lead's seam 2): the length, m, over which the
   * beach's look fades in from the grid's sea edge, in place of 2 m. The
   * mouth passes the near field's own hand-over length (half the shortest
   * forced wave, `mouthHandoverLengthM`), so the swash's look and the mouth's
   * water hand over to the FFT sea over one length. Absent: 2 m, as before.
   */
  readonly seaEdgeFadeM?: number;
  /**
   * RIVER MOUTH ROUND 12 (gap 3, GG-394): the floor's detail rectangles (`OceanSeabedOptions.detail`), passed to the
   * floor this beach builds; on them the floor draws at the sand mesh's cell. The sand mesh's border vertices that
   * stand inside one take the floor's map height there (the detail mesh's own), so the two meshes share those
   * vertices and meet with no step; round 1's border took the 2.5 m mesh's height, and the seam between that line and
   * the sand's fine bed was the sawtooth at the spit. Absent: the floor and the sand mesh build exactly as before.
   */
  readonly floorDetail?: NonNullable<Parameters<typeof createOceanSeabed>[0]['detail']>;
  /**
   * RIVER MOUTH ROUND 1c (the lead's seams 1 and 2): the worker also packs
   * the slope of the grid's water seaward of the still-water line
   * (`BeachPack.e`), and `swash` carries it, so the sea's one surface can
   * draw the grid's water there (oceanMouth.ts). Absent: no new texture, the
   * same node graph.
   */
  readonly seaSlope?: boolean;
}

/** The swash's state on the GPU, for the sea's one surface (river mouth round 1c). */
export interface OceanBeachSwash {
  /** (h, u along s, v along a, foam), one texel a cell. */
  readonly a: THREE.DataTexture;
  /** (bed, saturated band, -, -), static. */
  readonly c: THREE.DataTexture;
  /** (-d eta/ds, -d eta/da) seaward of the still-water line (`BeachPack.e`); null without `seaSlope`. */
  readonly e: THREE.DataTexture | null;
  readonly frame: BeachFrame;
  readonly grid: SwashGridSpec;
}

export interface OceanBeachState {
  readonly step: number;
  readonly timeS: number;
  readonly ledger: SwashLedger;
  readonly stats: { steps: number; ms: number; courant: number; sheetM3: number; soakedM3: number };
}

export interface OceanBeach {
  readonly seabed: OceanSeabed;
  readonly site: BeachSite;
  /** The swash's state textures and frame (river mouth round 1c). */
  readonly swash: OceanBeachSwash;
  /** Sand, sheet and debris; add it to the scene. */
  readonly group: THREE.Group;
  /**
   * Once a frame, AFTER the sea's step: ask the worker for the state at
   * `simTime` (all of it now when `pinned`, else a real-time share), put the
   * newest state it returned on the GPU, and draw the seabed's caustic web.
   */
  update(renderer: THREE.WebGPURenderer, camera: THREE.Camera, simTime: number, pinned: boolean, askWorker?: boolean): void;
  dispose(): void;
  readonly probe: Record<string, unknown>;
}

export interface DebrisMeshes {
  readonly meshes: THREE.Object3D[];
  place(poses: Float32Array): void;
  dispose(): void;
}
export interface WrackTune { readonly frame: BeachFrame; readonly vDry: () => number }
