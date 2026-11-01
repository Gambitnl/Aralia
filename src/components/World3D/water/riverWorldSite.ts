/**
 * THE RIVER IN THE GAME WORLD (ADR 0009 step 6, slices 7 to 10, 2026-10-26).
 *
 * TWO MODES, one address each:
 *
 * `?gpu=1&riverSite=1` (slice 7, THE TEST SITE): the WebGPU game world loads
 * the river page's reach (the same solver data, seed 20260928 unless
 * `riverSeed=` asks for another) and draws it inside the world:
 * - the river's own bed mesh (`buildGround`) with the bank material, as a
 *   group in the world scene at the site's placement;
 * - the river's water through `RiverWaterLayer`, in a pass that the world's
 *   post chain runs after its scene pass (`setComposite`).
 * The world terrain is not cut: `clearAboveWorld` LIFTS the site above the
 * world ground. Kept as it was, for the A/B rigs.
 *
 * `?gpu=1&riverSite=world` (slice 10, THE WORLD'S RIVER): the bed is the
 * world's own. The site reads the streamed ground world (`worldGroundHook`),
 * finds the world river nearest the spawn, and sends the flow worker the
 * drawn terrain's lattice heights, the river's line and width as a
 * `RiverWorldBedInit` (`riverWorldBed.ts`). The worker builds the reach on
 * that bed (`riverReach.ts`, `setRiverWorldBed`) and starts the live solver
 * from the design level (the world's channel depth over the bed): no steady
 * solve, no warm-start file. The river's local axes are placed by a move and a
 * turn (`RiverWaterLayer.placement`, `yaw`): river-local coordinates stay near
 * zero, so the water's half-float levels keep their precision. The world's
 * terrain and static water DISCARD their fragments in the footprint
 * (`gpu/riverFootprintCut.ts`), and the river's bed mesh, whose heights are
 * the world's at the footprint edge, is the visible ground there: no lifted
 * plateau, no gap, no cliff.
 *
 * HOW THE WATER PASS WORKS (both modes). `RiverWaterPassNode` is a texture
 * node with an update-before step, as three's own render-to-texture node.
 * Each frame, after the world's scene pass, it:
 * 1. draws the mirror: the world scene from the mirrored camera, moved back
 *    into world space (the layer works in river-local space; `localCamera`,
 *    `hostCamera`);
 * 2. copies the scene pass's color and depth into its own target;
 * 3. draws the water scene over that copy with the river-local camera.
 * The chain then adds only the water's change to the shaded scene color:
 * `lit + (water - sceneColor)`. Away from the water this is `lit` exactly; on
 * the water the ambient occlusion of the ground under it stays in.
 *
 * WHAT IS NOT DONE (world mode):
 * - The bed has no rocks (the world has no rock data for its rivers) and one
 *   roughness; the discharge is the page's default shape (1.5 m^3/s).
 * - The bed mesh is the river page's bank material; the world's terrain look
 *   stops at the footprint edge.
 * - The world's static water line here stands far above its carved bed (see
 *   the domain doc); the live river takes the world's channel depth over the
 *   bed instead, so the two water levels differ.
 * - The reach is the page's grid size (350 m x 140 m at 0.5 m) and does not
 *   move with the player.
 */
import * as THREE from 'three/webgpu';
import { Fn, nodeObject, uv } from 'three/tsl';
import type { WorldGpuPostHandle } from '../gpu/worldGpuPost';
import { getWorldGpuPost, onWorldGpuPost } from '../gpu/worldGpuPost';
import { riverBedOutsideDiscard, setRiverFootprintCut } from '../gpu/riverFootprintCut';
import { RiverMirror } from './riverMirrorCamera';
import { buildMirrorMask, mirrorMaskHits } from './riverMirrorMask';
import { RiverWaterLayer } from './riverWaterLayer';
import { buildRiverWaterGeometry, riverWaterGeometryFrom } from './riverWaterMaterial';
import type { RiverLiveClient, RiverLiveInit } from './riverLiveClient';
import type { RiverViewFlowSnapshot } from './riverReceivingRefiner';
import { RIVER_GRID, RIVER_RENDER_DOMAIN, RIVER_SHAPE_DEFAULT } from '@/systems/world3d/river/riverReach';
import type { RiverReachData } from '@/systems/world3d/river/riverWorker';
import {
  applyFineGroundPatch, buildWorldFineGround, buildWorldTerrainLattice, fineGroundPatch, latticeHeightAt, riverLocalCourse,
  riverWorldFrameNear, worldBoxToRiverLocal, worldDirToRiverLocal,
  type RiverWorldBedInit, type RiverWorldCarry, type RiverWorldFrame, type XZ,
} from '@/systems/world3d/river/riverWorldBed';
import { createRiverBankMaterial } from './riverBankMaterial';
import { getWorldGround, getWorldPlayer, onWorldGround, onWorldPlayer, type WorldGroundForRiver } from './worldGroundHook';
import { groundSurfaceY } from '@/systems/worldforge/bridge/groundChunkLoader';
import { RIVER_CHANNEL_MANNING, riverChannelSection, riverFlowDepthM, riverNormalFlowM3s, type RiverChannelSection } from '@/systems/worldforge/region/riverChannel';
import { TERRAIN_LATTICE_M } from '@/systems/worldforge/bridge/streamedSurface';
import { GROUND_METERS_PER_CELL } from '@/systems/worldforge/bridge/groundWorldAdapter';
import { groundEditsThisSession, onGroundEdit, type GroundEditEvent } from '@/systems/worldforge/bridge/groundRecord';
import type { LiveBedPatch } from '@/systems/world3d/river/riverLive';

/* TSL node graphs chain operators that @types/three 0.172 does not model. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type N = any;

type RiverPageModule = typeof import('./riverReachScene');

/**
 * THE MIRROR'S OWN LAYER (slice 8): the mirror draws only what joins it.
 * Measured 2026-10-26 (2560x1440, vsync off, river window): the water pass
 * without its mirror cost 0.3 to 0.9 ms; the mirror over the whole world
 * scene cost 8 to 9 ms more. The mirror draws the ground, the trees, the
 * buildings, the far shell, the river's bed, the sky dome and the lights;
 * grass, bushes, understory, props, people and the static water stay out.
 */
export const RIVER_MIRROR_LAYER = 7;
const MIRROR_NAMES = ['world3d:terrain', 'world3d:trees', 'world3d:site-building', 'world3d:walls', 'world3d:gates', 'world3d:far-shell', 'world3d:roads', 'world3d:decks', 'river-site-bed'];
/** Does this object join the mirror? (Tree shadow copies stay out.) */
export function joinsRiverMirror(o: THREE.Object3D): boolean {
  if ((o as THREE.Light).isLight) return true;
  const n = o.name || o.parent?.name || '';
  if (n.endsWith(':shadow')) return false;
  if (MIRROR_NAMES.some((p) => n.startsWith(p))) return true;
  // The sky dome: an unnamed mesh seen from inside.
  const m = (o as THREE.Mesh).material as THREE.Material | undefined;
  return !!(o as THREE.Mesh).isMesh && !!m && !Array.isArray(m) && m.side === THREE.BackSide;
}

/** The world mode's frame and checks, for probes and the report. */
export interface RiverWorldSiteWorldInfo {
  /** The world river chosen: its id, width and how far the spawn stood from its line, m. */
  river: { id: number | undefined; widthM: number; distanceM: number; points: number };
  frame: RiverWorldFrame;
  /** The anchor (the spawn's foot on the river line), world m. */
  anchor: { x: number; z: number };
  /** The course's control points in the reach. */
  coursePoints: number;
  lattice: { nx: number; nz: number; step: number };
  /** The drawn terrain against the lattice at sampled footprint points (a ray down the world terrain): count, the largest gap, m, and where it was (river-local). */
  latticeCheck: { n: number; maxAbsM: number; meanAbsM: number; worstAt: [number, number]; gaps: number[] } | null;
  /** The design level and the bed under the anchor, river-local m. */
  bedAtAnchor: number;
  designLevelAtAnchor: number;
  /** Cells this reach took from the previous reach's water at its start (one water, step 1); 0 for a first reach, null before ready. */
  carriedCells: number | null;
  /**
   * The reach's water from the world (one water, GG-534): the main inflow and
   * the total with tributaries, m^3/s; the channel's flood depth and the
   * water's normal depth at the anchor, m; half the widest width, m; and the
   * tributaries' mouths (river-local m) and flows.
   */
  water: {
    inflowM3S: number; totalM3S: number; channelDepthM: number; normalDepthM: number; halfW: number;
    tributaries: Array<{ x: number; z: number; dischargeM3S: number }>;
  };
}

/**
 * The world mode's reach, with the calls the follow (one water, step 1,
 * 2026-10-30) needs: a reach is built hidden, then shown in one step, and
 * hands its water to the next reach.
 */
export interface RiverWorldRiver extends RiverWorldSite {
  /** Show the reach: its bed, its water pass and its cut of the world's ground and static water. */
  activate(): void;
  /** This reach's water with its frame and grid: the next reach's start. */
  exportWater(): Promise<RiverWorldCarry>;
  /** The ground world the reach was built on. */
  readonly ground: WorldGroundForRiver['ground'];
}

/** What the site shows to probes (`window.__wf3dRiverSite`). */
export interface RiverWorldSite {
  readonly mode: 'site' | 'world';
  readonly layer: RiverWaterLayer;
  readonly bed: THREE.Group;
  /** The river's local origin in the world (a move only; y is the height datum). */
  readonly placement: THREE.Vector3;
  /** The bearing of river-local +x in the scene, radians (0 in the test site). */
  readonly yaw: number;
  /** Move the site: the bed, the bank's origin and the water layer together (test site only). */
  place(x: number, y: number, z: number): void;
  /**
   * Move the site so the river's local point (localX, localZ) sits on the
   * world point (worldX, worldZ), with the river's bed there at the world
   * ground's height plus `lift` m. Returns both heights, or null when a ray
   * finds no ground. Test site only: the world mode is placed by the world.
   */
  placeBeside(worldX: number, worldZ: number, localX: number, localZ: number, lift?: number): { worldGround: number; bed: number } | null;
  /**
   * Raise the site until the river's wet bed stands `margin` m above the
   * world ground at every sampled wet cell (a test-site stand-in for a world
   * terrain lowered in the footprint). Returns the lift, m. Test site only.
   */
  clearAboveWorld(margin?: number): number;
  /** Put the water pass in the world's chain, or take it out (a measurement switch). */
  setWater(on: boolean): void;
  /** Draw the mirror pass (a measurement switch; on by default). */
  mirrorOn: boolean;
  /** Draw the whole world scene in the mirror, not its own layer (a measurement switch; off by default). */
  mirrorAll: boolean;
  /**
   * Cut the mirror to what the water can read (see THE MIRROR'S WATER MASK IN
   * THE WORLD): objects no read reaches stay out, and the mirror draws only
   * the image area the reads cover. OFF by default: measured 2026-10-28 at
   * Remy's view over 17,4 (interleaved A/B, 4 rounds) it saved nothing
   * measurable (mask off 1.1 ms faster, inside the noise), because the
   * scissor box still covers 80 % of the image (the river runs corner to
   * corner) and the trees, one instanced batch, stay in. Kept as a switch
   * for a view where the river covers less of the screen.
   */
  mirrorMaskOn: boolean;
  /** Frames the water pass drew, and the last error, if any. */
  readonly stats: RiverWorldSiteStats;
  /** The world mode's frame and checks (null in the test site). */
  readonly world: RiverWorldSiteWorldInfo | null;
  dispose(): void;
}

export interface RiverWorldSiteStats {
  frames: number;
  error: string | null;
  waterLevel: number;
  pictures: number;
  simTime: number;
  volume: number | null;
  qIn: number | null;
  qOut: number | null;
  inflowDry: boolean | null;
  healthy: boolean | null;
  restores: number | null;
  /** The last live picture's wet cells (depth over 5 cm) and their mean surface, river-local m. */
  wetCells: number;
  meanSurface: number | null;
  /**
   * The last mirror pass's water mask: marked cells of the 96 x 54 grid, the
   * objects left out, the objects drawn, and the drawn share of the image
   * (null = the whole image: the mask was off or covered all of it).
   */
  mirrorMask: { marked: number; full: boolean; culled: number; drawn: number; area: number | null } | null;
  /**
   * Live ground edits the world mode passed to its river (GG-533): edits that
   * reached the reach, bed patches that came back, the last patch's round
   * trip (ms) and the patch's volume change, m^3 (0: a ground edit keeps the water's volume).
   */
  groundEdits: { sent: number; applied: number; lastRttMs: number | null; lastVolumeChangeM3: number | null; error: string | null };
}

/**
 * The water pass as a node of the world's post chain (see the file comment).
 * Its value is its own target's color: the scene copy with the water on it.
 */
class RiverWaterPassNode extends THREE.TextureNode {
  readonly target: THREE.RenderTarget;
  draw: ((renderer: THREE.WebGPURenderer, target: THREE.RenderTarget) => void) | null = null;

  constructor() {
    const target = new THREE.RenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true });
    target.depthTexture = new THREE.DepthTexture(1, 1);
    target.depthTexture.type = THREE.FloatType;
    super(target.texture, uv());
    this.target = target;
    // Once per frame, before the chain's output quad samples this texture.
    this.updateBeforeType = THREE.NodeUpdateType.FRAME;
  }

  updateBefore(frame: THREE.NodeFrame): void {
    this.draw?.(frame.renderer as unknown as THREE.WebGPURenderer, this.target);
  }
}

/** The water layer, the bed and the pass, built from one reach's data (both modes). */
interface SiteCore {
  layer: RiverWaterLayer;
  bed: THREE.Group;
  bank: THREE.Material;
  placement: THREE.Vector3;
  yaw: number;
  /** Move (and turn) the river: the bed, the bank's origin and the water layer together. */
  place(x: number, y: number, z: number, yaw?: number): void;
  stats: RiverWorldSiteStats;
  sw: { mirrorOn: boolean; mirrorAll: boolean; mirrorMaskOn: boolean };
  composite: (lit: N, parts: { sceneColor: N }) => N;
  applySnapshot(s: RiverViewFlowSnapshot): void;
  /** Take a bed patch from the solver: the new ground into the reach data and the grid mesh. */
  applyBedPatch(p: LiveBedPatch): void;
  /** Free the core; `ownsComposite` false leaves the chain's water pass as it is (a reach never shown). */
  dispose(ownsComposite?: boolean): void;
}

function buildCore(handle: WorldGpuPostHandle, page: RiverPageModule, data: RiverReachData, opts: { yaw: number; waterLevel: number; gridOnly: boolean; trackLevel: boolean }): SiteCore {
  const map = page.flowMapOf(data);
  const scene = handle.scene as unknown as THREE.Scene;
  const camera = handle.camera as unknown as THREE.PerspectiveCamera;

  // The water layer, lit by the world's sun where the world has one.
  const layer = new RiverWaterLayer(map, null, '', new RiverMirror(), new THREE.Scene());
  layer.createSurface(data);
  layer.createMaterial();
  const L = page.RIVER_LIGHT;
  let sun: THREE.DirectionalLight | null = null;
  scene.traverse((o) => { if (!sun && (o as THREE.DirectionalLight).isDirectionalLight) sun = o as THREE.DirectionalLight; });
  const sunLight = sun as THREE.DirectionalLight | null;
  const sunDir = sunLight ? sunLight.position.clone().sub(sunLight.target.position).normalize() : L.sunDir.clone();
  // The water shades in river-local axes: a turned river sees a turned sun.
  if (opts.yaw !== 0) {
    const [lx, lz] = worldDirToRiverLocal({ x: 0, z: 0, yaw: opts.yaw, datum: 0 }, sunDir.x, sunDir.z);
    sunDir.set(lx, sunDir.y, lz);
  }
  const sunColor = sunLight ? sunLight.color.clone().multiplyScalar(sunLight.intensity) : new THREE.Color(L.sunColor).multiplyScalar(L.sunIntensity);
  const fog = scene.fog as THREE.FogExp2 | THREE.Fog | null;
  layer.setLighting({
    sunDir, sunColor,
    skyZenith: L.skyZenith, skyHorizon: L.skyHorizon, skyGain: L.skyGain,
    fogColor: fog ? fog.color : L.skyHorizon.clone(),
    fogDensity: fog && (fog as THREE.FogExp2).isFogExp2 ? (fog as THREE.FogExp2).density : 0.0015,
  });
  // The previous picture's heights (aPrevY), equal to the current ones: the
  // first picture does not blend (the page does the same on its first picture).
  const waterGeometry = buildRiverWaterGeometry(map);
  page.riverSheetPreviousHeights(waterGeometry, null, null, data.grid);
  layer.createMesh(waterGeometry);
  layer.scene.add(layer.water);
  layer.reflection.planeY = opts.waterLevel;

  // The river's own bed, in the world scene. The world mode draws only the
  // solver grid's mesh: outside the footprint the world's terrain is the ground.
  const bank = createRiverBankMaterial(layer.flowTex, data.grid, layer.sharedOptics, layer.coarseLevel);
  const bed = new THREE.Group();
  bed.name = 'river-site-bed';
  const grounds = page.buildGround(data);
  grounds.forEach((g, k) => {
    if (opts.gridOnly && k > 0) { g.dispose(); return; }
    const mesh = new THREE.Mesh(g, bank);
    mesh.receiveShadow = true;
    bed.add(mesh);
  });
  scene.add(bed);

  const placement = layer.placement;
  const riverUniforms = bank.userData.riverUniforms as { uRiverOrigin: { value: THREE.Vector3 }; uRiverTurn: { value: THREE.Vector2 } };
  const core: SiteCore = {
    layer, bed, bank, placement, yaw: 0,
    place: (x, y, z, yaw = core.yaw) => {
      placement.set(x, y, z);
      core.yaw = yaw;
      layer.yaw = yaw;
      bed.position.copy(placement);
      // three turns about +y by x' = x cos a + z sin a; the river frame's turn
      // is x' = x cos - z sin (riverWorldBed.ts), so the angle is -yaw.
      bed.rotation.set(0, -yaw, 0);
      bed.updateMatrixWorld(true);
      riverUniforms.uRiverOrigin.value.copy(placement);
      riverUniforms.uRiverTurn.value.set(Math.cos(yaw), Math.sin(yaw));
    },
    stats: {
      frames: 0, error: null, waterLevel: opts.waterLevel, pictures: 0, simTime: 0, volume: null, qIn: null, qOut: null,
      inflowDry: null, healthy: null, restores: null, wetCells: 0, meanSurface: null, mirrorMask: null,
      groundEdits: { sent: 0, applied: 0, lastRttMs: null, lastVolumeChangeM3: null, error: null },
    },
    sw: { mirrorOn: true, mirrorAll: false, mirrorMaskOn: false },
    composite: null as unknown as SiteCore['composite'],
    applySnapshot: null as unknown as SiteCore['applySnapshot'],
    applyBedPatch: null as unknown as SiteCore['applyBedPatch'],
    dispose: null as unknown as SiteCore['dispose'],
  };

  // The passes the water layer's host supplies (the river page's own quads).
  const copyQ = page.createCopyPass();
  const blitQ = page.createBlitPass();
  const quad = new THREE.QuadMesh(copyQ.material);
  const t0 = performance.now();
  const stats = core.stats;
  // The blend between live pictures, as the page does (flowBlendSpanMs).
  let blendFrom = 0;
  let blendSpanMs = 250;
  let lastPictureAt = 0;

  const shadowLights: THREE.DirectionalLight[] = [];
  // The meshes on the mirror layer, for the water mask's cull (refreshed with the tags).
  const mirrorMeshes: THREE.Mesh[] = [];
  // Mask cells added on every side of the scissor box (a cell is about 6 mirror
  // texels at the shipped half size, so 4 cells cover a read 4 mips down).
  const SCISSOR_PAD_CELLS = 4;
  const maskVp = new THREE.Matrix4();
  const worldVp = new THREE.Matrix4();
  const sphere = new THREE.Sphere();
  const sw = core.sw;
  const passNode = new RiverWaterPassNode();
  passNode.draw = (r, target) => {
    try {
      // New chunks stream in: tag what joins the mirror about once a second.
      if (stats.frames % 60 === 0) {
        shadowLights.length = 0;
        mirrorMeshes.length = 0;
        scene.traverse((o) => {
          if (joinsRiverMirror(o)) {
            o.layers.enable(RIVER_MIRROR_LAYER);
            // Instanced and batched meshes stay out of the cull: their bounds
            // are the instances', which a streamed chunk can change between
            // tag passes, and one batch spans the whole window anyway.
            const m = o as THREE.Mesh & { isInstancedMesh?: boolean; isBatchedMesh?: boolean };
            if (m.isMesh && !m.isInstancedMesh && !m.isBatchedMesh) mirrorMeshes.push(m);
          }
          const l = o as THREE.DirectionalLight;
          if (l.isDirectionalLight && l.castShadow && l.shadow.autoUpdate) shadowLights.push(l);
        });
      }
      const sp = handle.scenePass as N;
      const color = sp.getTexture('output') as THREE.Texture;
      const depth = sp.getTexture('depth') as THREE.Texture;
      const w = sp.renderTarget.width as number;
      const h = sp.renderTarget.height as number;
      if (target.width !== w || target.height !== h) target.setSize(w, h);
      if (layer.reflection.target.width !== Math.max(1, Math.floor(w * layer.reflection.scale))) layer.reflection.setSize(w, h);
      const prevTarget = r.getRenderTarget();
      const prevAutoClear = r.autoClear;
      r.autoClear = false;
      camera.updateMatrixWorld();
      const local = layer.localCamera(camera);
      const u = layer.waterMat.uniforms;
      u.uTime.value = (performance.now() - t0) / 1000;
      u.uFlowBlend.value = blendFrom > 0 ? Math.min(1, (performance.now() - blendFrom) / blendSpanMs) : 1;
      if (sw.mirrorOn) layer.reflection.draw(r, local, null, {
        drawSky: () => {},
        drawScene: (mc) => {
          const wc = layer.hostCamera(mc);
          if (!sw.mirrorAll) wc.layers.set(RIVER_MIRROR_LAYER);
          // THE MIRROR'S WATER MASK IN THE WORLD (agora-257c, 2026-10-28).
          // At Remy's view over 17,4 the mirror cost 7 of a 31.5 ms frame
          // (mirror off: 24.6 ms), though the river covers a small part of
          // the screen. The water reads the mirror only where its reflected
          // rays land (riverMirrorMask.ts, built for the river page and
          // tested there). The world now uses the same mask two ways: a mesh
          // whose image no read reaches leaves the mirror layer for this
          // draw, and the draw is cut (scissor) to the box of the marked
          // cells (off by default: see mirrorMaskOn for the measurement).
          // Both are lossless where the water reads: the mask is
          // conservative by construction. Outside the box the mirror keeps
          // last frame's pixels, which no read samples.
          const hidden: THREE.Mesh[] = [];
          const rt = r.getRenderTarget();
          let scissored = false;
          if (sw.mirrorMaskOn && !sw.mirrorAll && rt) {
            maskVp.multiplyMatrices(mc.projectionMatrix, mc.matrixWorldInverse);
            const mask = buildMirrorMask(maskVp.elements, local.position, layer.reflection.planeY, data.grid, data.h);
            let marked = 0;
            let c0 = mask.cols; let c1 = -1; let r0 = mask.rows; let r1 = -1;
            for (let row = 0; row < mask.rows; row += 1) {
              for (let col = 0; col < mask.cols; col += 1) {
                if (!mask.bits[row * mask.cols + col]) continue;
                marked += 1;
                if (col < c0) c0 = col;
                if (col > c1) c1 = col;
                if (row < r0) r0 = row;
                if (row > r1) r1 = row;
              }
            }
            let area: number | null = null;
            if (!mask.full) {
              worldVp.multiplyMatrices(wc.projectionMatrix, wc.matrixWorldInverse);
              for (const m of mirrorMeshes) {
                if (!m.visible || !m.layers.isEnabled(RIVER_MIRROR_LAYER)) continue;
                const g = m.geometry;
                if (!g.boundingSphere) g.computeBoundingSphere();
                if (!g.boundingSphere) continue;
                sphere.copy(g.boundingSphere).applyMatrix4(m.matrixWorld);
                if (!mirrorMaskHits(mask, worldVp.elements, sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius)) {
                  m.layers.disable(RIVER_MIRROR_LAYER);
                  hidden.push(m);
                }
              }
              // The scissor box, in target pixels. Mask row 0 is the bottom
              // of the image (NDC y = -1); a WebGPU scissor counts y from the top.
              if (c1 >= c0 && r1 >= r0) {
                // Grown by SCISSOR_PAD_CELLS: the water reads the mirror's mip
                // chain (rough water up to several levels down), and a texel
                // there blends the pixels around it, so the box keeps a margin
                // of drawn pixels past the last marked cell.
                c0 = Math.max(0, c0 - SCISSOR_PAD_CELLS); c1 = Math.min(mask.cols - 1, c1 + SCISSOR_PAD_CELLS);
                r0 = Math.max(0, r0 - SCISSOR_PAD_CELLS); r1 = Math.min(mask.rows - 1, r1 + SCISSOR_PAD_CELLS);
                const W = rt.width; const H = rt.height;
                const x = Math.floor((c0 / mask.cols) * W);
                const xe = Math.ceil(((c1 + 1) / mask.cols) * W);
                const yTop = Math.floor((1 - (r1 + 1) / mask.rows) * H);
                const yBot = Math.ceil((1 - r0 / mask.rows) * H);
                rt.scissor.set(x, yTop, Math.max(1, xe - x), Math.max(1, yBot - yTop));
                r.setScissorTest(true);
                scissored = true;
                area = ((xe - x) * (yBot - yTop)) / (W * H);
              } else {
                // No water read lands in the image: draw nothing at all.
                rt.scissor.set(0, 0, 1, 1);
                r.setScissorTest(true);
                scissored = true;
                area = 0;
              }
            }
            stats.mirrorMask = { marked, full: mask.full, culled: hidden.length, drawn: mirrorMeshes.length - hidden.length, area };
          } else stats.mirrorMask = null;
          // No shadow map for the mirror camera: three r172 keeps one per
          // camera, and the mirror's would redraw every caster each frame.
          for (const l of shadowLights) l.shadow.autoUpdate = false;
          r.render(scene, wc);
          for (const l of shadowLights) l.shadow.autoUpdate = true;
          if (scissored) {
            r.setScissorTest(false);
            rt!.scissor.set(0, 0, rt!.width, rt!.height);
          }
          for (const m of hidden) m.layers.enable(RIVER_MIRROR_LAYER);
        },
        blit: (source, dst) => {
          blitQ.color.value = source;
          quad.material = blitQ.material;
          r.setRenderTarget(dst);
          quad.render(r);
        },
      });
      layer.drawWater(local, { sceneColor: color, sceneDepth: depth, width: w, height: h, target, underwaterPlane: null, reflectionOn: true }, {
        copyOpaque: (dst) => {
          copyQ.color.value = color;
          copyQ.depth.value = depth;
          quad.material = copyQ.material;
          r.setRenderTarget(dst);
          r.clear();
          quad.render(r);
        },
        drawScene: (s, cam) => { r.render(s, cam); },
      });
      r.setRenderTarget(prevTarget);
      r.autoClear = prevAutoClear;
      stats.frames += 1;
    } catch (e) {
      stats.error = String(e);
    }
  };
  const water: N = nodeObject(passNode as unknown as THREE.Node);
  core.composite = (lit: N, parts: { sceneColor: N }): N => lit.add(water.sub(parts.sceneColor));

  // THE LIVE RIVER (slice 9): each picture updates the layer's flow textures,
  // its surface sampler and its water sheet, as the page's applyFlowSnapshot
  // does without the page's receiving-sheet refinement and waterfall parts.
  core.applySnapshot = (s: RiverViewFlowSnapshot): void => {
    try {
      const r = handle.renderer as unknown as THREE.WebGPURenderer;
      const blended = layer.updateFlowTextures(r, s, true);
      // A patch picture (GG-430) changed the kept surface in place: the cells
      // it replaced give their old values through surfaceBeforeAt.
      const prevSurface = s.surfaceBeforeAt ?? data.surface;
      layer.surface.setFlowHalf(s.t0h, s.t1h, s.t2h, s.surface);
      const old = layer.water.geometry;
      const g = riverWaterGeometryFrom(s.sheet);
      page.riverSheetPreviousHeights(g, blended ? prevSurface : null, blended ? s.surface : null, data.grid);
      layer.water.geometry = g;
      old.dispose();
      data.t0 = s.t0; data.surface = s.surface; data.h = s.h; data.u = s.u; data.v = s.v; data.mapStats = s.mapStats;
      const now = performance.now();
      if (lastPictureAt > 0) blendSpanMs += 0.5 * (0.95 * Math.min(2000, now - lastPictureAt) - blendSpanMs);
      lastPictureAt = now;
      blendFrom = blended ? now : 0;
      stats.pictures += 1;
      stats.simTime = s.simTime;
      // The wet cells and their mean level; the world mode's mirror plane
      // follows it (the page eases its plane from the camera's view instead).
      let sum = 0;
      let n = 0;
      for (let c = 0; c < s.h.length; c += 1) {
        if (s.h[c] > 0.05 && Number.isFinite(s.surface[c])) { sum += s.surface[c]; n += 1; }
      }
      stats.wetCells = n;
      stats.meanSurface = n ? sum / n : null;
      if (opts.trackLevel && n) { layer.reflection.planeY = sum / n; stats.waterLevel = sum / n; }
    } catch (e) {
      stats.error = String(e);
    }
  };

  // THE BED PATCH (agora-257c, 2026-10-29, GG-533): after a ground edit the
  // solver sends the new ground over a box of cells. The grid mesh has one
  // vertex per cell (buildGround), so the box's heights go straight in, and
  // the normals one cell round it are read again from the new heights, by the
  // central differences buildGround uses. Only the solver grid's mesh exists
  // here (the world draws the land past it), so the outer lattice part of the
  // patch has no mesh to move.
  core.applyBedPatch = (p) => {
    if (!p.box || !p.ground) return;
    const { nx, nz, dx } = data.grid;
    const H = data.ground;
    const b = p.box;
    const bw = b.i1 - b.i0 + 1;
    for (let j = b.j0; j <= b.j1; j += 1) {
      for (let i = b.i0; i <= b.i1; i += 1) H[j * nx + i] = p.ground[(j - b.j0) * bw + (i - b.i0)];
    }
    const mesh = bed.children[0] as THREE.Mesh | undefined;
    if (!mesh) return;
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const nor = mesh.geometry.getAttribute('normal') as THREE.BufferAttribute;
    for (let j = Math.max(0, b.j0 - 1); j <= Math.min(nz - 1, b.j1 + 1); j += 1) {
      for (let i = Math.max(0, b.i0 - 1); i <= Math.min(nx - 1, b.i1 + 1); i += 1) {
        const c = j * nx + i;
        const gx = (H[j * nx + Math.min(nx - 1, i + 1)] - H[j * nx + Math.max(0, i - 1)]) / (2 * dx);
        const gz = (H[Math.min(nz - 1, j + 1) * nx + i] - H[Math.max(0, j - 1) * nx + i]) / (2 * dx);
        const l = Math.hypot(gx, 1, gz);
        pos.setY(c, H[c]);
        nor.setXYZ(c, -gx / l, 1 / l, -gz / l);
      }
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
    mesh.geometry.computeBoundingSphere();
    mesh.geometry.computeBoundingBox();
  };

  core.dispose = (ownsComposite = true) => {
    if (ownsComposite) handle.setComposite(null);
    scene.remove(bed);
    for (const m of bed.children) (m as THREE.Mesh).geometry.dispose();
    bank.dispose();
    passNode.target.dispose();
    layer.reflection.dispose();
  };
  return core;
}

/** The mean level of a reach's wet cells, river-local m (the mirror plane of a static reach). */
function meanWetLevel(data: RiverReachData, fallback: number): number {
  let sum = 0;
  let n = 0;
  for (let c = 0; c < data.h.length; c += 1) {
    if (data.h[c] > 0.05 && Number.isFinite(data.surface[c])) { sum += data.surface[c]; n += 1; }
  }
  return n ? sum / n : fallback;
}

/**
 * Mount the test site (slice 7) on the world's post chain. Resolves when the
 * reach is loaded and the water pass is in the chain.
 */
export async function mountRiverWorldSite(handle: WorldGpuPostHandle, opts: { seed?: number; at?: THREE.Vector3; live?: boolean } = {}): Promise<RiverWorldSite> {
  const page: RiverPageModule = await import('./riverReachScene');
  const seed = opts.seed ?? 20260928;
  const { data } = await page.loadRiverReachData(seed);
  const scene = handle.scene as unknown as THREE.Scene;
  const camera = handle.camera as unknown as THREE.PerspectiveCamera;
  const core = buildCore(handle, page, data, { yaw: 0, waterLevel: meanWetLevel(data, 1.3), gridOnly: false, trackLevel: false });
  const { layer, bed, placement, place, stats, sw, composite } = core;
  const at = opts.at ?? new THREE.Vector3(camera.position.x, camera.position.y - 40, camera.position.z);
  place(at.x, at.y, at.z, 0);

  // A downward ray: the highest hit on the world's terrain, or on the bed.
  const raycaster = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const highest = (roots: THREE.Object3D[], x: number, z: number): number | null => {
    raycaster.set(new THREE.Vector3(x, 5000, z), down);
    raycaster.far = 10000;
    const hit = raycaster.intersectObjects(roots, true)[0];
    return hit ? hit.point.y : null;
  };
  const worldTerrain = (): THREE.Object3D[] => {
    const out: THREE.Object3D[] = [];
    scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.name === 'world3d:terrain') out.push(o); });
    return out;
  };
  const clearAboveWorld = (margin = 0.3): number => {
    const { nx, nz, dx, x0, z0 } = data.grid;
    const s = Math.max(1, Math.ceil(Math.sqrt((nx * nz) / 600)));
    const roots = worldTerrain();
    let need = -Infinity;
    for (let j = 0; j < nz; j += s) {
      for (let i = 0; i < nx; i += s) {
        const c = j * nx + i;
        if (!(data.h[c] > 0.05)) continue;
        const lx = x0 + (i + 0.5) * dx;
        const lz = z0 + (j + 0.5) * dx;
        const g = highest(roots, lx + placement.x, lz + placement.z);
        if (g === null) continue;
        need = Math.max(need, g + margin - (data.ground[c] + placement.y));
      }
    }
    const lift = Number.isFinite(need) ? Math.max(0, need) : 0;
    place(placement.x, placement.y + lift, placement.z);
    return lift;
  };
  const placeBeside = (worldX: number, worldZ: number, localX: number, localZ: number, lift = 0): { worldGround: number; bed: number } | null => {
    const g = highest(worldTerrain(), worldX, worldZ);
    place(0, 0, 0);
    const b = highest([bed], localX, localZ);
    if (g === null || b === null) { place(at.x, at.y, at.z); return null; }
    place(worldX - localX, g + lift - b, worldZ - localZ);
    return { worldGround: g, bed: b };
  };
  handle.setComposite(composite);

  // THE LIVE RIVER (slice 9): the page's live solver, started from the reach's steady solution.
  let client: RiverLiveClient | null = null;
  if (opts.live !== false) {
    const { RiverLiveClient: Client } = await import('./riverLiveClient');
    client = new Client({
      seed, edit: { shape: RIVER_SHAPE_DEFAULT, course: null }, speed: 'auto', viewportVisible: true,
      field: { h: data.h.slice(), u: data.u.slice(), v: data.v.slice(), uRms: data.uRms.slice(), t1: data.t1.slice() },
    }, {
      onSnapshot: core.applySnapshot,
      onStatus: (st) => { stats.volume = st.volume; stats.qIn = st.qIn; stats.qOut = st.qOut; stats.inflowDry = st.inflowDry; stats.healthy = st.healthy; stats.restores = st.restores; },
      onError: (m) => { stats.error = m; },
    });
  }

  const site: RiverWorldSite = {
    mode: 'site', layer, bed, placement, yaw: 0, place: (x, y, z) => place(x, y, z, 0), placeBeside, clearAboveWorld, stats, world: null,
    get mirrorOn() { return sw.mirrorOn; },
    set mirrorOn(v: boolean) { sw.mirrorOn = v; },
    get mirrorAll() { return sw.mirrorAll; },
    set mirrorAll(v: boolean) { sw.mirrorAll = v; },
    get mirrorMaskOn() { return sw.mirrorMaskOn; },
    set mirrorMaskOn(v: boolean) { sw.mirrorMaskOn = v; },
    setWater: (on: boolean) => handle.setComposite(on ? composite : null),
    dispose: () => { client?.dispose(); core.dispose(); },
  };
  return site;
}

/** A cold start's first data: the live solver's ground and the course, and no water until the first flow map (as the river page's). */
function dataFromInit(d: RiverLiveInit): RiverReachData {
  const n = d.grid.nx * d.grid.nz;
  const t0 = new Float32Array(n * 4);
  const t1 = new Float32Array(n * 4);
  for (let c = 0; c < n; c += 1) { t0[c * 4 + 3] = -100; t1[c * 4 + 2] = 8; t1[c * 4 + 3] = -1; }
  return {
    seed: d.seed, shape: RIVER_SHAPE_DEFAULT, grid: d.grid, ground: d.ground, outer: d.outer, boulders: d.boulders,
    t0, t1, t2: new Float32Array(n * 4), surface: new Float32Array(n).fill(Number.NaN),
    h: new Float32Array(n), u: new Float32Array(n), v: new Float32Array(n), uRms: new Float32Array(n), course: d.course,
    solverStats: { simSeconds: 0, steps: 0, qIn: 0, qOut: 0, dVdt: 0, volume: 0, maxSpeed: 0, activeCells: 0, breachCells: 0, wallMs: 0 },
    mapStats: { wetCells: 0, eddyCells: 0, maxWhite: 0, maxStreak: 0, meanSpeedWet: 0 },
    eddyCells: 0, buildMs: 0,
  };
}

/** The ground world, now or when the scene publishes it (within `timeoutMs`). */
function waitWorldGround(timeoutMs = 90000): Promise<WorldGroundForRiver> {
  const now = getWorldGround();
  if (now) return Promise.resolve(now);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { off(); reject(new Error('[river] The world published no ground world (is this the ground profile with riverSite=world?).')); }, timeoutMs);
    const off = onWorldGround((g) => { if (g) { clearTimeout(timer); off(); resolve(g); } });
  });
}

/** Where the world river's reach is anchored: the spawn's foot on the line sits at the solver grid's center. */
const WORLD_ANCHOR_LOCAL: readonly [number, number] = [RIVER_GRID.x0 + (RIVER_GRID.nx * RIVER_GRID.dx) / 2, RIVER_GRID.z0 + (RIVER_GRID.nz * RIVER_GRID.dx) / 2];
/** The course's control points are kept this far past the render domain's x range, m. */
const WORLD_COURSE_MARGIN_M = 70;
/**
 * How far past the river's half width its bed replaces the world's ground, m.
 * Covers the bank the water reaches at bankfull (the town channel is up to 2.5 m
 * wider than the region river) and the wet band above it.
 */
const RIVER_CORRIDOR_MARGIN_M = 6;
/**
 * The fine ground's blend inside the corridor (see RiverBedCorridor in
 * riverWorldBed.ts): fine out to 3 + 1 m short of the cut line, then the drawn
 * lattice. With the town river's 4.9 m half width and the 6 m margin, the
 * channel and 2 m of each bank are the fine ground.
 */
const WORLD_BED_BLEND_M = 3;
const WORLD_BED_RIM_M = 1;
/**
 * One roughness for the world bed: Manning n of a gravel bed with some cobble
 * (Chow 1959, table 5-6). The world's channel law cuts every channel with the
 * same n (`riverChannel.ts`), so the solver's water fits the cut channel.
 */
const WORLD_BED_MANNING = RIVER_CHANNEL_MANNING;
/** How far a tributary's mouth may stand from the main course and still join it, m past the two half widths. */
const TRIBUTARY_JOIN_M = 30;

/** The world's river lines the live river can run on. */
function worldRiverLines(ground: WorldGroundForRiver['ground']) {
  return ground.rivers.filter((r) => r.sourceKind === 'river' && r.points.length >= 2);
}

type WorldRiverLine = ReturnType<typeof worldRiverLines>[number];

/** A world point in river-local m (`riverWorldBed.ts`: local = R(-yaw) (world - frame)). */
function toRiverLocal(frame: RiverWorldFrame, p: XZ): [number, number] {
  const c = Math.cos(frame.yaw);
  const s = Math.sin(frame.yaw);
  const dx = p.x - frame.x;
  const dz = p.z - frame.z;
  return [c * dx + s * dz, -s * dx + c * dz];
}

/** The line's point nearest a river-local x (the reach's edges and anchor sit on the course). */
function lineIndexAtLocalX(frame: RiverWorldFrame, line: WorldRiverLine, x: number): number {
  let best = 0;
  let bestD = Infinity;
  line.points.forEach((p, i) => {
    const d = Math.abs(toRiverLocal(frame, p)[0] - x);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

/**
 * THE REACH'S WATER (one water, 2026-10-30; GG-534). From the world river's
 * width and fall at each point (`GroundPolyline.widthAtM` and `slopeAt`, set by
 * `region/riverChannel.ts`):
 * - `inflowM3S`: the normal flow of the river's width at the box's west edge;
 * - `section` and `depthM`: the channel at the anchor and the normal depth of
 *   all the reach's water in it (the design level's depth over the bed);
 * - `halfW`: half the widest width inside the box;
 * - `tributaries`: each other river line whose downstream end lies in the box
 *   within reach of the main course joins there, at the course point nearest
 *   its end, with the normal flow of its own width.
 * Throws when the line has no water data: the region tier sets it on every
 * river, so its absence is a fault to see, not a value to guess.
 */
function worldReachWater(frame: RiverWorldFrame, line: WorldRiverLine, lines: readonly WorldRiverLine[], anchorLocalX: number) {
  const widthAt = line.widthAtM;
  const slopeAt = line.slopeAt;
  if (!widthAt || !slopeAt) throw new Error(`[river] World river ${line.sourceId ?? '?'} carries no width and fall per point.`);
  const g = RIVER_GRID;
  const gx0 = g.x0;
  const gx1 = g.x0 + g.nx * g.dx;
  const gz0 = g.z0;
  const gz1 = g.z0 + g.nz * g.dx;
  const up = lineIndexAtLocalX(frame, line, gx0);
  const at = lineIndexAtLocalX(frame, line, anchorLocalX);
  // The channel the ground cut: the river's own width, in a town too
  // (`carveRiverChannelToGrade`; the town's narrower water body is GG-538).
  const cutW = (i: number) => widthAt[i];
  const inflowM3S = riverNormalFlowM3s(widthAt[up]);
  let maxW = cutW(at);
  line.points.forEach((p, i) => {
    const [lx, lz] = toRiverLocal(frame, p);
    if (lx >= gx0 && lx <= gx1 && lz >= gz0 && lz <= gz1) maxW = Math.max(maxW, cutW(i));
  });
  const course = line.points.map((p) => toRiverLocal(frame, p));
  const tributaries: RiverWorldBedInit['tributaries'] = [];
  for (const other of lines) {
    if (other === line || !other.widthAtM || !other.slopeAt || other.points.length < 2) continue;
    const n = other.points.length;
    const [ex, ez] = toRiverLocal(frame, other.points[n - 1]);
    if (ex < gx0 || ex > gx1 || ez < gz0 || ez > gz1) continue;
    // The main course's point nearest the tributary's end.
    let mx = course[0][0];
    let mz = course[0][1];
    let md = Infinity;
    for (let k = 0; k < course.length - 1; k += 1) {
      const [ax, az] = course[k];
      const [bx, bz] = course[k + 1];
      const vx = bx - ax;
      const vz = bz - az;
      const t = Math.max(0, Math.min(1, ((ex - ax) * vx + (ez - az) * vz) / (vx * vx + vz * vz || 1)));
      const px = ax + vx * t;
      const pz = az + vz * t;
      const d = Math.hypot(ex - px, ez - pz);
      if (d < md) { md = d; mx = px; mz = pz; }
    }
    const tw = other.widthAtM[n - 1];
    if (md > maxW / 2 + tw / 2 + TRIBUTARY_JOIN_M) continue;
    if (mx < gx0 || mx > gx1 || mz < gz0 || mz > gz1) continue;
    const q = riverNormalFlowM3s(tw);
    const tSection = riverChannelSection(tw, other.slopeAt[n - 1]);
    const ty = riverFlowDepthM(tSection, q);
    const area = (tSection.bottomWidthM + tSection.run * ty) * ty;
    const [px, pz] = toRiverLocal(frame, other.points[n - 2]);
    const len = Math.hypot(ex - px, ez - pz) || 1;
    tributaries.push({
      x: mx, z: mz, halfW: Math.max(g.dx, Math.min(tw, maxW) / 2), dir: [(ex - px) / len, (ez - pz) / len],
      speedMS: q / area, dischargeM3S: q,
    });
  }
  const section: RiverChannelSection = riverChannelSection(cutW(at), slopeAt[at]);
  const totalM3S = tributaries.reduce((q, t) => q + t.dischargeM3S, inflowM3S);
  return { inflowM3S, totalM3S, section, depthM: riverFlowDepthM(section, totalM3S), halfW: maxW / 2, tributaries };
}

/** The river line nearest a world point, with the reach frame there; null when the window has no river. */
function nearestWorldRiver(ground: WorldGroundForRiver['ground'], near: XZ) {
  let chosen: { line: ReturnType<typeof worldRiverLines>[number]; fit: ReturnType<typeof riverWorldFrameNear> } | null = null;
  for (const line of worldRiverLines(ground)) {
    const fit = riverWorldFrameNear(line.points, near, WORLD_ANCHOR_LOCAL, 0);
    if (!chosen || fit.distanceM < chosen.fit.distanceM) chosen = { line, fit };
  }
  return chosen;
}

/**
 * Mount the world's river (slice 10): the bed from the world's terrain and
 * river line, the live solver started on it. Resolves when the solver has
 * sent its ground; the water pass joins the chain at `activate` (at once
 * unless `activate` is false).
 *
 * ONE WATER, STEP 1 (2026-10-30): `near` places the reach on the river
 * nearest that world point (the player's foot; the scene origin when absent),
 * and `carry` starts it from the previous reach's water where the boxes
 * overlap (`carryRiverWater`).
 */
export async function mountRiverWorldRiver(
  handle: WorldGpuPostHandle,
  opts: { seed?: number; near?: XZ; carry?: RiverWorldCarry; activate?: boolean } = {},
): Promise<RiverWorldRiver> {
  const page: RiverPageModule = await import('./riverReachScene');
  const { RiverLiveClient: Client } = await import('./riverLiveClient');
  const seed = opts.seed ?? 20260928;
  const { ground, origin } = await waitWorldGround();
  const scene = handle.scene as unknown as THREE.Scene;

  // THE WORLD RIVER NEAREST THE PLAYER (the spawn when no foot is published).
  const near = opts.near ?? { x: origin.x, z: origin.z };
  const chosen = nearestWorldRiver(ground, near);
  if (!chosen) throw new Error('[river] This ground window has no river line.');
  const { line, fit } = chosen;
  // THE DATUM: a whole meter under the bed at the anchor, so river-local
  // heights are small and positive (the page's bed stands near 0 to 10 m).
  const datum = Math.floor(groundSurfaceY(ground, fit.anchor.x, fit.anchor.z)) - 1;
  const frame: RiverWorldFrame = { ...fit.frame, datum };
  // THE DRAWN TERRAIN over the render domain, as the lattice the chunks draw:
  // the vertex heights at multiples of the lattice step (streamedSurface.ts).
  const lattice = buildWorldTerrainLattice(frame, RIVER_RENDER_DOMAIN, TERRAIN_LATTICE_M, (x, z) => groundSurfaceY(ground, x, z));
  const course = riverLocalCourse(frame, line.points, RIVER_RENDER_DOMAIN.x0 - WORLD_COURSE_MARGIN_M, RIVER_RENDER_DOMAIN.x1 + WORLD_COURSE_MARGIN_M);
  // THE FINE GROUND (GG-533): the ground record's own grid (1.524 m) over the
  // same domain. Inside the corridor the bed is this grid, so the channel has
  // its carved shape, not the 8 m lattice's chain of diamond pools.
  const fine = buildWorldFineGround(frame, RIVER_RENDER_DOMAIN, GROUND_METERS_PER_CELL, (x, z) => groundSurfaceY(ground, x, z));
  // Edits made from here on reach the river through its solver (see THE LIVE
  // GROUND EDITS below); the fine ground above already holds every earlier one.
  const editsAtBuild = groundEditsThisSession().length;
  // THE REACH'S WATER (one water, 2026-10-30): the world river's own flow,
  // depth and width here, and the tributaries that join inside the box.
  const water = worldReachWater(frame, line, worldRiverLines(ground), WORLD_ANCHOR_LOCAL[0]);
  // The corridor covers the cut channel's banks too: they rise at repose for
  // one channel depth past the half width (`carveRiverChannelToGrade`), and
  // the fine ground must reach past them before it blends to the lattice.
  const corridorHalfM = water.halfW + Math.max(
    RIVER_CORRIDOR_MARGIN_M,
    water.section.depthM * water.section.run + WORLD_BED_BLEND_M + WORLD_BED_RIM_M,
  );
  const worldBed: RiverWorldBedInit = {
    frame, lattice, course, halfW: water.halfW, channelDepthM: water.depthM, manning: WORLD_BED_MANNING,
    levelRangeX: [RIVER_GRID.x0, RIVER_GRID.x0 + RIVER_GRID.nx * RIVER_GRID.dx],
    fine, corridor: { halfM: corridorHalfM, blendM: WORLD_BED_BLEND_M, rimM: WORLD_BED_RIM_M },
    dischargeM3S: water.inflowM3S, tributaries: water.tributaries,
  };
  // The start shape carries the world's whole inflow, which is the world
  // bed's default shape in the worker, so no panel edit replaces it.
  const startShape = { ...RIVER_SHAPE_DEFAULT, dischargeM3S: water.totalM3S };
  const bedAtAnchor = latticeHeightAt(lattice, fit.anchor.x, fit.anchor.z) - datum;

  // THE LATTICE AGAINST THE DRAWN TERRAIN: a ray down the world's terrain
  // meshes at sampled footprint points. A gap here would mean the solver's
  // bed is not the ground the player sees.
  const latticeCheck = ((): RiverWorldSiteWorldInfo['latticeCheck'] => {
    const roots: THREE.Object3D[] = [];
    scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.name === 'world3d:terrain') roots.push(o); });
    if (roots.length === 0) return null;
    const raycaster = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    let n = 0;
    let maxAbs = 0;
    let sumAbs = 0;
    let worstAt: [number, number] = [0, 0];
    const gaps: number[] = [];
    const G = RIVER_GRID;
    for (let k = 0; k < 64; k += 1) {
      // A fixed lattice of sample points over the footprint (no randomness).
      const lx = G.x0 + ((k % 8) + 0.5) / 8 * G.nx * G.dx;
      const lz = G.z0 + (Math.floor(k / 8) + 0.5) / 8 * G.nz * G.dx;
      const c = Math.cos(frame.yaw);
      const s = Math.sin(frame.yaw);
      const xw = frame.x + c * lx - s * lz;
      const zw = frame.z + s * lx + c * lz;
      raycaster.set(new THREE.Vector3(xw - origin.x, 5000, zw - origin.z), down);
      raycaster.far = 10000;
      const hit = raycaster.intersectObjects(roots, true)[0];
      if (!hit) continue;
      const gap = Math.abs(hit.point.y - latticeHeightAt(lattice, xw, zw));
      n += 1;
      sumAbs += gap;
      gaps.push(Math.round(gap * 1000) / 1000);
      if (gap > maxAbs) { maxAbs = gap; worstAt = [Math.round(lx), Math.round(lz)]; }
    }
    return { n, maxAbsM: maxAbs, meanAbsM: n ? sumAbs / n : 0, worstAt, gaps };
  })();

  // THE LIVE SOLVER on the world bed, from the design level (startCold).
  let core: SiteCore | null = null;
  let client: RiverLiveClient | null = null;
  const pending: RiverViewFlowSnapshot[] = [];
  const status: Partial<RiverWorldSiteStats> = {};
  let designLevelAtAnchor = Number.NaN;
  let footprint: Parameters<typeof setRiverFootprintCut>[0] = null;
  let liveGrid: RiverWorldCarry['grid'] | null = null;
  const ready = new Promise<SiteCore>((resolve, reject) => {
    client = new Client({
      seed, edit: { shape: startShape, course: null }, speed: 'auto', viewportVisible: true, field: null, worldBed, carry: opts.carry,
    }, {
      onInit: (d) => {
        try {
          const data = dataFromInit(d);
          // The first mirror plane: the design level at the anchor.
          const level = bedAtAnchor + water.depthM;
          designLevelAtAnchor = level;
          const c = buildCore(handle, page, data, { yaw: frame.yaw, waterLevel: level, gridOnly: true, trackLevel: true });
          // The river's origin in the scene: world less the scene origin; y is the datum.
          c.place(frame.x - origin.x, datum, frame.z - origin.z, frame.yaw);
          Object.assign(c.stats, status);
          for (const s of pending.splice(0)) c.applySnapshot(s);
          liveGrid = { x0: d.grid.x0, z0: d.grid.z0, dx: d.grid.dx, nx: d.grid.nx, nz: d.grid.nz };
          // Hidden until `activate` (one water, step 1): a reach built ahead of
          // the player's move draws nothing while the shown reach still runs.
          c.bed.visible = false;
          // THE CUT: the world's terrain and static water leave the footprint.
          // Only a corridor along the course swaps the world's ground for the
          // river's bed (agora-257c, 2026-10-28): the bed's river-page material
          // had covered the whole 350 x 140 m rectangle, town ground included.
          // Set at `activate`, with the water pass.
          footprint = ({
            origin: { x: c.placement.x, z: c.placement.z }, yaw: frame.yaw,
            x0: d.grid.x0, z0: d.grid.z0, x1: d.grid.x0 + d.grid.nx * d.grid.dx, z1: d.grid.z0 + d.grid.nz * d.grid.dx,
            corridor: { course, halfM: corridorHalfM, waterHalfM: water.halfW + 0.5 },
          });
          // The bed draws only where the world's ground is cut: its twin discard.
          const bedMaterials = new Set<THREE.Material>();
          c.bed.traverse((o) => { if ((o as THREE.Mesh).isMesh) bedMaterials.add((o as THREE.Mesh).material as THREE.Material); });
          for (const m of bedMaterials) {
            const nm = m as THREE.MeshStandardNodeMaterial;
            const base = nm.colorNode;
            nm.colorNode = Fn(() => { riverBedOutsideDiscard(); return base; })();
            nm.needsUpdate = true;
          }
          core = c;
          resolve(c);
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      },
      onSnapshot: (s) => { if (core) core.applySnapshot(s); else pending.push(s); },
      onPatch: (p, rtt) => {
        if (!core) return;
        core.applyBedPatch(p);
        const g = core.stats.groundEdits;
        g.applied += 1; g.lastRttMs = rtt; g.lastVolumeChangeM3 = p.volumeChange;
      },
      onStatus: (st) => {
        const into = core ? core.stats : status;
        into.volume = st.volume; into.qIn = st.qIn; into.qOut = st.qOut; into.inflowDry = st.inflowDry; into.healthy = st.healthy; into.restores = st.restores; into.simTime = st.simTime;
      },
      onError: (m) => { if (core) core.stats.error = m; else reject(new Error(m)); },
    });
  });
  const c = await ready;
  let active = false;
  const activate = (): void => {
    if (active) return;
    active = true;
    c.bed.visible = true;
    handle.setComposite(c.composite);
    setRiverFootprintCut(footprint);
  };
  if (opts.activate !== false) activate();
  // THE LIVE GROUND EDITS (agora-257c, 2026-10-29, GG-533). A spell or a tool
  // cuts a shape into the world's one ground (groundRecord.ts editGround). The
  // river reads the new fine-ground values over the edit's box from that
  // ground and sends them to its solver, which rebuilds its bed there with the
  // water on it. An edit that misses the reach changes nothing here. Inside
  // the corridor the bed is the fine ground; past it the bed stays the drawn
  // lattice, which does not yet rebuild on an edit (the next step of GG-533),
  // so a shape that crosses the corridor's edge reaches the river only inside.
  const takeGroundEdit = (e: GroundEditEvent): void => {
    if (e.ground !== ground || !client) return;
    const patch = fineGroundPatch(fine, e.box, (x, z) => groundSurfaceY(ground, x, z));
    if (!patch) return;
    applyFineGroundPatch(fine, patch);
    const g = c.stats.groundEdits;
    g.sent += 1;
    // The send moves the values' buffer to the worker: send a copy, keep ours.
    client.worldGround({ ...patch, values: patch.values.slice() }, worldBoxToRiverLocal(frame, e.box))
      .catch((err: unknown) => { g.error = err instanceof Error ? err.message : String(err); });
  };
  for (const e of groundEditsThisSession().slice(editsAtBuild)) takeGroundEdit(e);
  const offGroundEdit = onGroundEdit(takeGroundEdit);
  const refuse = (what: string) => (): never => { throw new Error(`[river] ${what} is a test-site call: the world mode is placed by the world's river line.`); };
  const site: RiverWorldRiver = {
    mode: 'world', layer: c.layer, bed: c.bed, placement: c.placement, yaw: frame.yaw, ground,
    activate,
    exportWater: async () => {
      if (!client || !liveGrid) throw new Error('[river] The reach is not ready.');
      const w = await (client as RiverLiveClient).exportWater();
      return { ...w, frame, grid: liveGrid };
    },
    place: refuse('place'), placeBeside: refuse('placeBeside'), clearAboveWorld: refuse('clearAboveWorld'),
    stats: c.stats,
    world: {
      river: { id: line.sourceId, widthM: line.widthM, distanceM: fit.distanceM, points: line.points.length },
      frame, anchor: fit.anchor, coursePoints: course.length,
      lattice: { nx: lattice.nx, nz: lattice.nz, step: lattice.step },
      latticeCheck, bedAtAnchor, designLevelAtAnchor,
      get carriedCells() { return (client as RiverLiveClient | null)?.carriedCells ?? null; },
      water: {
        inflowM3S: water.inflowM3S, totalM3S: water.totalM3S, channelDepthM: water.section.depthM,
        normalDepthM: water.depthM, halfW: water.halfW,
        tributaries: water.tributaries.map((t) => ({ x: t.x, z: t.z, dischargeM3S: t.dischargeM3S })),
      },
    },
    get mirrorOn() { return c.sw.mirrorOn; },
    set mirrorOn(v: boolean) { c.sw.mirrorOn = v; },
    get mirrorAll() { return c.sw.mirrorAll; },
    set mirrorAll(v: boolean) { c.sw.mirrorAll = v; },
    get mirrorMaskOn() { return c.sw.mirrorMaskOn; },
    set mirrorMaskOn(v: boolean) { c.sw.mirrorMaskOn = v; },
    setWater: (on: boolean) => handle.setComposite(on ? c.composite : null),
    dispose: () => { offGroundEdit(); (client as RiverLiveClient | null)?.dispose(); if (active) setRiverFootprintCut(null); c.dispose(active); },
  };
  return site;
}

/**
 * How far the player's foot on the river may move from the reach's anchor
 * before the reach moves, m. The box runs 175 m up and down the river from
 * its anchor; a move at 90 m keeps at least 85 m of live river ahead of the
 * player while the next reach builds.
 */
const FOLLOW_SHIFT_M = 90;
/** A player farther than this from every river line leaves the reach where it is, m. */
const FOLLOW_REACH_M = 250;
/** Another river must be this much nearer than the reach's own before the reach moves to it, m (no flip at a fork). */
const FOLLOW_SWITCH_M = 30;
/** How often the follow checks the player's foot when no move is published, ms. */
const FOLLOW_CHECK_MS = 1000;

/** What the follow shows to probes (`window.__wf3dRiverFollow`). */
export interface RiverFollowStats {
  moves: number;
  last: { ms: number; carriedCells: number | null; anchor: XZ; riverId: number | undefined } | null;
  error: string | null;
  moving: boolean;
  /** The player's foot at the last check, world m. */
  foot: XZ | null;
}

/** True when the reach should move for a player at `p` (see FOLLOW_SHIFT_M). */
function followWanted(cur: RiverWorldRiver, ground: WorldGroundForRiver['ground'], p: XZ): boolean {
  if (cur.ground !== ground) return true;
  const best = nearestWorldRiver(ground, p);
  if (!best || best.fit.distanceM > FOLLOW_REACH_M || !cur.world) return false;
  const info = cur.world;
  if (best.line.sourceId !== info.river.id) {
    const own = worldRiverLines(ground).find((l) => l.sourceId === info.river.id);
    const ownFit = own ? riverWorldFrameNear(own.points, p, WORLD_ANCHOR_LOCAL, 0) : null;
    if (!ownFit || best.fit.distanceM + FOLLOW_SWITCH_M < ownFit.distanceM) return true;
    return Math.hypot(ownFit.anchor.x - info.anchor.x, ownFit.anchor.z - info.anchor.z) > FOLLOW_SHIFT_M;
  }
  return Math.hypot(best.fit.anchor.x - info.anchor.x, best.fit.anchor.z - info.anchor.z) > FOLLOW_SHIFT_M;
}

/**
 * THE LIVE RIVER FOLLOWS THE PLAYER (one water, step 1, 2026-10-30). Remy
 * ruled that the live water is the only water (ADR 0009, amendment of
 * 2026-10-30). The reach mounts on the river nearest the player's foot. When
 * the foot's point on the river moves past FOLLOW_SHIFT_M from the reach's
 * anchor (or another river comes clearly nearer, or the ground world
 * changes), the next reach builds hidden on the new anchor, starts from the
 * current reach's water where the boxes overlap, and replaces it in one step.
 * `show` receives each reach shown. Returns the stop.
 */
function followWorldRiver(
  handle: WorldGpuPostHandle,
  seed: number | undefined,
  show: (s: RiverWorldSite | { error: string }) => void,
): () => void {
  let current: RiverWorldRiver | null = null;
  let dead = false;
  const stats: RiverFollowStats = { moves: 0, last: null, error: null, moving: false, foot: null };
  (window as unknown as { __wf3dRiverFollow?: RiverFollowStats }).__wf3dRiverFollow = stats;
  const check = async (): Promise<void> => {
    const g = getWorldGround();
    const p = getWorldPlayer();
    stats.foot = p;
    if (dead || stats.moving || !current || !g || !p || !followWanted(current, g.ground, p)) return;
    stats.moving = true;
    const t0 = performance.now();
    try {
      // The old reach's water; a failed read starts the next reach from the design level.
      const carry = current.ground === g.ground ? await current.exportWater().catch(() => undefined) : undefined;
      if (dead) return;
      // The foot that asked for the move: the reach builds there.
      const next = await mountRiverWorldRiver(handle, { seed, near: p, carry, activate: false });
      if (dead) { next.dispose(); return; }
      // One step: the old reach leaves the chain and the cut, the new one enters.
      current.dispose();
      next.activate();
      current = next;
      show(next);
      stats.moves += 1;
      stats.last = { ms: performance.now() - t0, carriedCells: next.world?.carriedCells ?? null, anchor: next.world!.anchor, riverId: next.world!.river.id };
      stats.error = null;
    } catch (e) {
      stats.error = e instanceof Error ? e.message : String(e);
      console.error('[river follow]', e);
    } finally {
      stats.moving = false;
    }
  };
  // The walking avatar publishes its foot every frame: check at most every 250 ms.
  let lastPlayerCheck = 0;
  const offPlayer = onWorldPlayer(() => {
    const now = performance.now();
    if (now - lastPlayerCheck < 250) return;
    lastPlayerCheck = now;
    void check();
  });
  const offGround = onWorldGround(() => { void check(); });
  const timer = setInterval(() => { void check(); }, FOLLOW_CHECK_MS);
  mountRiverWorldRiver(handle, { seed, near: getWorldPlayer() ?? undefined })
    .then((site) => {
      if (dead) { site.dispose(); return; }
      current = site;
      show(site);
      void check();
    })
    .catch((e) => { console.error('[river site]', e); show({ error: String(e) }); });
  return () => { dead = true; offPlayer(); offGround(); clearInterval(timer); current?.dispose(); current = null; };
}

/**
 * Mount the site when the world's post chain appears (and again after a
 * remount). Called once from World3DScene under `?gpu=1&riverSite=1` (the
 * test site) or `riverSite=world` (the world's river).
 */
export function autoMountRiverWorldSite(): void {
  const w = window as unknown as { __wf3dRiverSite?: RiverWorldSite | { error: string } | 'loading' };
  const params = new URLSearchParams(window.location.search);
  const seed = params.get('riverSeed') ? Number(params.get('riverSeed')) : undefined;
  const world = params.get('riverSite') === 'world';
  let stopFollow: (() => void) | null = null;
  const mount = (handle: WorldGpuPostHandle | null): void => {
    // The world mode's follow owns its reaches; stop it before anything else.
    if (stopFollow) { stopFollow(); stopFollow = null; }
    const prev = w.__wf3dRiverSite;
    if (!world && prev && typeof prev === 'object' && 'dispose' in prev) prev.dispose();
    w.__wf3dRiverSite = undefined;
    if (!handle) return;
    w.__wf3dRiverSite = 'loading';
    if (world) {
      stopFollow = followWorldRiver(handle, seed, (site) => { w.__wf3dRiverSite = site; });
      return;
    }
    const p = mountRiverWorldSite(handle, { seed, live: params.get('riverLive') !== '0' });
    p.then((site) => { w.__wf3dRiverSite = site; })
      .catch((e) => { console.error('[river site]', e); w.__wf3dRiverSite = { error: String(e) }; });
  };
  onWorldGpuPost(mount);
  const now = getWorldGpuPost();
  if (now) mount(now);
}
