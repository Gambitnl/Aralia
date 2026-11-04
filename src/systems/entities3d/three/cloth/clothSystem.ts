/**
 * @file clothSystem.ts — the WebGL GPU cloth solver: one per renderer.
 *
 * Character cloth+armor campaign, slice 1c (2026-11-04; sheet 71CWggvG q3 +
 * q10: GPU particle cloth, on WebGL because the game world draws with WebGL
 * today). Every registered garment's points share one float atlas
 * (clothAtlas.ts), so the whole scene steps in a few full-atlas draws per
 * substep, whatever the number of figures.
 *
 * WHO STEPS IT. A garment mesh calls `stepFrame` from its own onBeforeRender
 * (clothGarment.ts). By then the renderer has refreshed every world matrix,
 * so pins read this frame's bones, not last frame's — a cape pinned one
 * frame late lags the shoulders and cuts into them on a turn. The first
 * garment drawn in a frame steps the system; the rest find it done. No React
 * context and no scene hook are needed, so the forge, the game and any other
 * canvas get cloth by drawing a garment.
 *
 * One real path: a renderer that is not WebGL2 with float render targets
 * throws. There is no CPU cloth to fall back to.
 *
 * TIME. A frame is split into substeps of about 1/120 s (entity-forge's
 * rate), at most MAX_SUBSTEPS, and each substep is stretched up to 1/30 s so
 * the cloth keeps real time on a slow frame. Pins and colliders move in a
 * straight line from last frame's pose to this frame's across those
 * substeps. Found in the browser pane at 4 fps (2026-11-04): with fixed short
 * substeps and pins that jumped the whole frame at once, a walking figure's
 * cape flipped up over its head. SOLVE_ITERATIONS constraint passes run per
 * substep.
 */
import {
  DataTexture,
  FloatType,
  Matrix4,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderTarget,
  type Bone,
  type WebGLRenderer,
} from 'three';
import { ATLAS_SIZE, ClothAtlasPacker, clearGarment, createAtlasData, writeGarment, type AtlasData, type AtlasRegion } from './clothAtlas';
import { CLOTH_COLLIDER_STRIDE, poseClothColliders, type ClothCollider } from './bodyColliders';
import type { ClothPanel } from './garmentPanels';
import { COLLIDERS_PER_ROW, INTEGRATE_FRAGMENT, MAX_GARMENT_COLLIDERS, PASS_VERTEX, PREV_FRAGMENT, SOLVE_FRAGMENT } from './clothShaders';

export const CLOTH_SUBSTEP = 1 / 120;
export const MAX_SUBSTEPS = 8;
/** Longest one substep may be stretched to on a slow frame. */
export const MAX_SUBSTEP_DT = 1 / 30;
/** A longer frame (a freeze, a hidden tab) counts as this long. */
export const MAX_FRAME_DT = 0.25;
export const SOLVE_ITERATIONS = 12;
/** Over-relaxation of the averaged (Jacobi) correction. 1.5 jittered the
 * sheet into fine wrinkles in the first render; 1.2 still converges. */
const OMEGA = 1.2;
const DAMPING = 0.985;
const GARMENT_TEX_W = 256;
const GARMENT_TEX_H = 4;
const PIN_TEX_W = 256;

/** What a garment hands the system: its cut, and how to place it each frame. */
export interface ClothSource {
  readonly panel: ClothPanel;
  /** The skeleton the cloth hangs on, in bone-index order. */
  readonly bones: readonly Bone[];
  readonly boneInverses: readonly Matrix4[];
  /** Body colliders this garment tests (≤ MAX_GARMENT_COLLIDERS). */
  readonly colliders: readonly ClothCollider[];
  /** Bone index per pin, parallel to panel.pins. */
  readonly pinBone: Int32Array;
  /** World height of the ground under the figure, this frame. */
  floorY(): number;
  /** Bind space → world for the garment's first frame (the chest skin
   * matrix): every point starts where the rest cut puts it on the live pose. */
  initMatrix(out: Matrix4): Matrix4;
}

interface Slot {
  src: ClothSource;
  region: AtlasRegion;
  garmentSlot: number;
  pinStart: number;
  colliderStart: number;
  /** World pin position last frame, to catch teleports. */
  lastPin: Vector3 | null;
  needsInit: boolean;
}

function dataTexture(w: number, h: number): DataTexture {
  const t = new DataTexture(new Float32Array(w * h * 4), w, h, RGBAFormat, FloatType);
  t.minFilter = NearestFilter;
  t.magFilter = NearestFilter;
  t.needsUpdate = true;
  return t;
}

function target(): WebGLRenderTarget {
  return new WebGLRenderTarget(ATLAS_SIZE, ATLAS_SIZE, {
    type: FloatType,
    format: RGBAFormat,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
}

const skinM = new Matrix4();
const initM = new Matrix4();
const tmp = new Vector3();

export class ClothSystem {
  private readonly packer = new ClothAtlasPacker();
  private readonly data: AtlasData = createAtlasData();
  private readonly slots = new Map<ClothSource, Slot>();
  private dirty = true;
  private usedRows = 0;

  private readonly pos = [target(), target()];
  private readonly prev = [target(), target()];
  private cur = 0;

  private readonly rest = dataTexture(ATLAS_SIZE, ATLAS_SIZE);
  private readonly rest2 = dataTexture(ATLAS_SIZE, ATLAS_SIZE);
  private readonly grid = dataTexture(ATLAS_SIZE, ATLAS_SIZE);
  private readonly meta = dataTexture(ATLAS_SIZE, ATLAS_SIZE);
  private readonly init = dataTexture(ATLAS_SIZE, ATLAS_SIZE);
  private readonly garment = dataTexture(GARMENT_TEX_W, GARMENT_TEX_H);
  private pin = dataTexture(PIN_TEX_W, 1);
  private coll = dataTexture(COLLIDERS_PER_ROW * 8, 1);
  private pinCount = 0;
  private collCount = 0;
  /** This frame's pin targets and colliders (the END of the frame), and the
   * previous frame's (the START); substeps upload a blend of the two. */
  private pinTo = new Float32Array(PIN_TEX_W * 4);
  private pinFrom = new Float32Array(PIN_TEX_W * 4);
  private collTo = new Float32Array(COLLIDERS_PER_ROW * 8 * 4);
  private collFrom = new Float32Array(COLLIDERS_PER_ROW * 8 * 4);
  private freshFrom = true;
  private lastH = CLOTH_SUBSTEP;

  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: Mesh;
  private readonly integrate: ShaderMaterial;
  private readonly copyPrev: ShaderMaterial;
  private readonly solve: ShaderMaterial;

  private lastStep = -1;
  private stepping = false;
  private initPending = false;

  constructor(private readonly renderer: WebGLRenderer) {
    const common = {
      uPos: { value: null as unknown },
      uPrev: { value: null as unknown },
      uMeta: { value: this.meta },
      uInit: { value: this.init },
      uPin: { value: this.pin },
      uPinWidth: { value: PIN_TEX_W },
    };
    this.integrate = new ShaderMaterial({
      vertexShader: PASS_VERTEX,
      fragmentShader: INTEGRATE_FRAGMENT,
      uniforms: { ...common, uDt: { value: CLOTH_SUBSTEP }, uDtRatio: { value: 1 }, uDamping: { value: DAMPING }, uGravity: { value: new Vector3(0, -9.81, 0) } },
      depthTest: false,
      depthWrite: false,
    });
    this.copyPrev = new ShaderMaterial({ vertexShader: PASS_VERTEX, fragmentShader: PREV_FRAGMENT, uniforms: { ...common }, depthTest: false, depthWrite: false });
    this.solve = new ShaderMaterial({
      vertexShader: PASS_VERTEX,
      fragmentShader: SOLVE_FRAGMENT,
      uniforms: {
        ...common,
        uRest: { value: this.rest },
        uRest2: { value: this.rest2 },
        uGrid: { value: this.grid },
        uGarment: { value: this.garment },
        uColl: { value: this.coll },
        uOmega: { value: OMEGA },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new Mesh(new PlaneGeometry(2, 2), this.integrate);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.rest.image.data = this.data.rest;
    this.rest2.image.data = this.data.rest2;
    this.grid.image.data = this.data.grid;
    this.meta.image.data = this.data.meta;
  }

  /** The texture holding every point's current world position. */
  positionTexture(): WebGLRenderTarget['texture'] {
    return this.pos[this.cur].texture;
  }

  /** Atlas placement of a registered garment (for its mesh's UVs). */
  regionOf(src: ClothSource): AtlasRegion | undefined {
    return this.slots.get(src)?.region;
  }

  register(src: ClothSource): AtlasRegion {
    const existing = this.slots.get(src);
    if (existing) return existing.region;
    if (src.colliders.length > MAX_GARMENT_COLLIDERS) {
      throw new Error(`clothSystem: a garment may test at most ${MAX_GARMENT_COLLIDERS} colliders, got ${src.colliders.length}`);
    }
    if (this.slots.size >= GARMENT_TEX_W * GARMENT_TEX_H) throw new Error('clothSystem: garment slots are full');
    const region = this.packer.allocate(src.panel.cols, src.panel.rows);
    this.slots.set(src, { src, region, garmentSlot: -1, pinStart: 0, colliderStart: 0, lastPin: null, needsInit: true });
    this.dirty = true;
    return region;
  }

  unregister(src: ClothSource): void {
    const slot = this.slots.get(src);
    if (!slot) return;
    clearGarment(this.data, slot.region);
    this.packer.release(slot.region);
    this.slots.delete(src);
    this.dirty = true;
  }

  /** Rebuild the static per-texel data and the dynamic texture sizes after
   * a garment came or went. Rare (mount and unmount only). */
  private rebuild(): void {
    let pinStart = 0;
    let collStart = 0;
    let garmentSlot = 0;
    this.usedRows = 0;
    for (const slot of this.slots.values()) {
      slot.garmentSlot = garmentSlot++;
      slot.pinStart = pinStart;
      slot.colliderStart = collStart;
      const panel = slot.src.panel;
      const pinSlots = new Int32Array(panel.rows * panel.cols).fill(-1);
      panel.pins.forEach((p, k) => (pinSlots[p.index] = pinStart + k));
      writeGarment(this.data, slot.region, panel, slot.garmentSlot, pinSlots);
      pinStart += panel.pins.length;
      collStart += slot.src.colliders.length;
      this.usedRows = Math.max(this.usedRows, slot.region.y + slot.region.rows);
    }
    this.pinCount = pinStart;
    this.collCount = collStart;
    const pinRows = Math.max(1, Math.ceil(pinStart / PIN_TEX_W));
    // slots moved: last frame's pins and colliders no longer line up
    this.freshFrom = true;
    this.pinTo = new Float32Array(PIN_TEX_W * pinRows * 4);
    this.pinFrom = new Float32Array(this.pinTo.length);
    if (this.pin.image.height !== pinRows) {
      this.pin.dispose();
      this.pin = dataTexture(PIN_TEX_W, pinRows);
      for (const m of [this.integrate, this.copyPrev, this.solve]) m.uniforms.uPin.value = this.pin;
    }
    const collRows = Math.max(1, Math.ceil(collStart / COLLIDERS_PER_ROW));
    this.collTo = new Float32Array(COLLIDERS_PER_ROW * 8 * collRows * 4);
    this.collFrom = new Float32Array(this.collTo.length);
    if (this.coll.image.height !== collRows) {
      this.coll.dispose();
      this.coll = dataTexture(COLLIDERS_PER_ROW * 8, collRows);
      this.solve.uniforms.uColl.value = this.coll;
    }
    for (const t of [this.rest, this.rest2, this.grid, this.meta]) t.needsUpdate = true;
    this.dirty = false;
  }

  /** Per-frame CPU work: pin targets, posed colliders, floors, and the
   * first-frame positions of new (or teleported) garments. */
  private upload(): void {
    const pinData = this.pinTo;
    const collData = this.collTo;
    const garmData = this.garment.image.data as Float32Array;
    const initData = this.init.image.data as Float32Array;
    const posed = new Float32Array(MAX_GARMENT_COLLIDERS * CLOTH_COLLIDER_STRIDE);
    for (const slot of this.slots.values()) {
      const { src, region } = slot;
      const panel = src.panel;
      // pins
      panel.pins.forEach((p, k) => {
        const b = src.pinBone[k];
        skinM.multiplyMatrices(src.bones[b].matrixWorld, src.boneInverses[b]);
        tmp.set(panel.rest[p.index * 3], panel.rest[p.index * 3 + 1], panel.rest[p.index * 3 + 2]).applyMatrix4(skinM);
        const o = (slot.pinStart + k) * 4;
        pinData[o] = tmp.x;
        pinData[o + 1] = tmp.y;
        pinData[o + 2] = tmp.z;
        pinData[o + 3] = 1;
        if (k === 0) {
          // a pin that jumped more than 2 m since last frame = a teleport:
          // restart the garment from its rest cut instead of flinging it
          if (slot.lastPin && slot.lastPin.distanceTo(tmp) > 2) slot.needsInit = true;
          (slot.lastPin ??= new Vector3()).copy(tmp);
        }
      });
      // colliders
      poseClothColliders(src.colliders, src.bones, src.boneInverses, posed);
      for (let c = 0; c < src.colliders.length; c++) {
        const ci = slot.colliderStart + c;
        const x = (ci % COLLIDERS_PER_ROW) * 8;
        const y = Math.floor(ci / COLLIDERS_PER_ROW);
        collData.set(posed.subarray(c * CLOTH_COLLIDER_STRIDE, (c + 1) * CLOTH_COLLIDER_STRIDE), (y * COLLIDERS_PER_ROW * 8 + x) * 4);
      }
      // garment row: collider range + floor
      const g = slot.garmentSlot * 4;
      garmData[g] = slot.colliderStart;
      garmData[g + 1] = src.colliders.length;
      garmData[g + 2] = src.floorY() + 0.005;
      garmData[g + 3] = 1;
      // first frame (or teleport): every point at its rest cut on this pose
      if (slot.needsInit) {
        src.initMatrix(initM);
        for (let r = 0; r < panel.rows; r++) {
          for (let c = 0; c < panel.cols; c++) {
            const i = r * panel.cols + c;
            tmp.set(panel.rest[i * 3], panel.rest[i * 3 + 1], panel.rest[i * 3 + 2]).applyMatrix4(initM);
            const t = ((region.y + r) * ATLAS_SIZE + region.x + c) * 4;
            initData[t] = tmp.x;
            initData[t + 1] = tmp.y;
            initData[t + 2] = tmp.z;
            initData[t + 3] = 1;
          }
        }
        slot.needsInit = false;
        this.initPending = true;
        this.init.needsUpdate = true;
      }
    }
    this.garment.needsUpdate = true;
  }

  /** Upload pins and colliders blended `alpha` of the way from last frame's
   * pose to this frame's. */
  private blendDynamic(alpha: number): void {
    const pin = this.pin.image.data as Float32Array;
    for (let i = 0; i < this.pinTo.length; i++) pin[i] = this.pinFrom[i] + (this.pinTo[i] - this.pinFrom[i]) * alpha;
    const coll = this.coll.image.data as Float32Array;
    for (let i = 0; i < this.collTo.length; i++) coll[i] = this.collFrom[i] + (this.collTo[i] - this.collFrom[i]) * alpha;
    this.pin.needsUpdate = this.pinCount > 0;
    this.coll.needsUpdate = this.collCount > 0;
  }

  private pass(material: ShaderMaterial, out: WebGLRenderTarget): void {
    this.quad.material = material;
    out.scissor.set(0, 0, ATLAS_SIZE, this.usedRows);
    out.scissorTest = true;
    this.renderer.setRenderTarget(out);
    this.renderer.render(this.scene, this.camera);
  }

  /** Advance the cloth to now. Safe to call from every garment's
   * onBeforeRender: only the first call in a frame does work. */
  stepFrame(): void {
    if (this.stepping) return;
    const now = performance.now();
    // every garment drawn in one frame calls in within a millisecond or two
    if (this.lastStep >= 0 && now - this.lastStep < 1.5) return;
    const rawDt = this.lastStep < 0 ? CLOTH_SUBSTEP : (now - this.lastStep) / 1000;
    let dt = Math.min(MAX_FRAME_DT, rawDt);
    this.lastStep = now;
    if (this.slots.size === 0) return;
    // A FREEZE (a held frame, a hidden tab, a load stall) moves the figure
    // farther than any cloth can follow — the browser pane holds frames for
    // a second when out of view, and the cape stood out like a board. Such a
    // frame restarts every garment from its rest drape on the current pose,
    // the same rule as a teleport, then settles it for a short while.
    if (rawDt > MAX_FRAME_DT) {
      for (const slot of this.slots.values()) slot.needsInit = true;
      this.freshFrom = true;
      dt = 4 * CLOTH_SUBSTEP;
    }
    this.stepping = true;
    const r = this.renderer;
    const keepTarget = r.getRenderTarget();
    const keepAutoClear = r.autoClear;
    const keepXr = r.xr.enabled;
    const keepShadow = r.shadowMap.autoUpdate;
    r.autoClear = false;
    r.xr.enabled = false;
    r.shadowMap.autoUpdate = false;
    try {
      if (this.dirty) this.rebuild();
      this.upload();
      if (this.freshFrom) {
        this.pinFrom.set(this.pinTo);
        this.collFrom.set(this.collTo);
        this.freshFrom = false;
      }
      // A slow frame is carried, not dropped (entity-forge fm-056): the
      // substeps cover the whole frame, each stretched up to MAX_SUBSTEP_DT.
      const steps = Math.max(1, Math.min(MAX_SUBSTEPS, Math.ceil(dt / CLOTH_SUBSTEP - 1e-6)));
      const h = Math.min(MAX_SUBSTEP_DT, dt / steps);
      this.integrate.uniforms.uDt.value = h;
      // damping is per 1/120 s; a longer substep damps more
      this.integrate.uniforms.uDamping.value = Math.pow(DAMPING, h / CLOTH_SUBSTEP);
      for (let s = 0; s < steps; s++) {
        this.blendDynamic((s + 1) / steps);
        // time-corrected Verlet: the stored velocity was over the last
        // substep's length, so it scales to this one's
        this.integrate.uniforms.uDtRatio.value = h / this.lastH;
        this.lastH = h;
        const next = 1 - this.cur;
        this.setInputs(this.integrate);
        this.pass(this.integrate, this.pos[next]);
        this.setInputs(this.copyPrev);
        this.pass(this.copyPrev, this.prev[next]);
        this.cur = next;
        if (this.initPending) {
          // the init texture did its job on this substep's two passes
          (this.init.image.data as Float32Array).fill(0);
          this.init.needsUpdate = true;
          this.initPending = false;
        }
        for (let k = 0; k < SOLVE_ITERATIONS; k++) {
          const out = 1 - this.cur;
          this.setInputs(this.solve);
          this.pass(this.solve, this.pos[out]);
          // the solve writes only positions; prev must follow the swap, so
          // copy prev forward unchanged by swapping the prev pair too
          this.prev.reverse();
          this.cur = out;
        }
      }
      this.pinFrom.set(this.pinTo);
      this.collFrom.set(this.collTo);
    } finally {
      r.setRenderTarget(keepTarget);
      r.autoClear = keepAutoClear;
      r.xr.enabled = keepXr;
      r.shadowMap.autoUpdate = keepShadow;
      this.stepping = false;
    }
  }

  private setInputs(m: ShaderMaterial): void {
    m.uniforms.uPos.value = this.pos[this.cur].texture;
    m.uniforms.uPrev.value = this.prev[this.cur].texture;
  }

  /** Debug and test readback: one garment's live world positions
   * (rows * cols * 3 floats, row-major). Synchronous GPU read; never call it
   * on a hot path. */
  readPositions(src: ClothSource): Float32Array {
    const slot = this.slots.get(src);
    if (!slot) throw new Error('clothSystem: garment is not registered');
    const { x, y, cols, rows } = slot.region;
    const px = new Float32Array(cols * rows * 4);
    this.renderer.readRenderTargetPixels(this.pos[this.cur], x, y, cols, rows, px);
    const out = new Float32Array(cols * rows * 3);
    for (let i = 0; i < cols * rows; i++) out.set(px.subarray(i * 4, i * 4 + 3), i * 3);
    return out;
  }

  get garmentCount(): number {
    return this.slots.size;
  }

  dispose(): void {
    for (const t of [...this.pos, ...this.prev]) t.dispose();
    for (const t of [this.rest, this.rest2, this.grid, this.meta, this.init, this.garment, this.pin, this.coll]) t.dispose();
    for (const m of [this.integrate, this.copyPrev, this.solve]) m.dispose();
    this.quad.geometry.dispose();
  }
}

const systems = new WeakMap<WebGLRenderer, ClothSystem>();

/** The one cloth system of a renderer, made on first use. Throws on a
 * renderer that cannot run it (no fallback path exists). */
export function clothSystemFor(renderer: WebGLRenderer): ClothSystem {
  let sys = systems.get(renderer);
  if (sys) return sys;
  if (!(renderer as { isWebGLRenderer?: boolean }).isWebGLRenderer) {
    throw new Error('clothSystem: GPU cloth runs on a WebGLRenderer only (sheet 71CWggvG q10)');
  }
  if (!renderer.capabilities.isWebGL2 || !renderer.extensions.has('EXT_color_buffer_float')) {
    throw new Error('clothSystem: GPU cloth needs WebGL2 with EXT_color_buffer_float (float render targets)');
  }
  sys = new ClothSystem(renderer);
  systems.set(renderer, sys);
  return sys;
}
