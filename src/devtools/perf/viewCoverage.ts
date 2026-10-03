/**
 * @file viewCoverage.ts
 * The share of the screen each group covers, measured by drawing it.
 *
 * "How much of the screen is water" has no answer in the renderer counters,
 * and a projected bounding box overstates it (a river's box covers the whole
 * view). So this draws the camera's view ONCE, on request, into a small
 * target with one flat color per group (see sceneInventory.ts for what a
 * group is), reads the pixels back, and counts them. It is the visible share:
 * the nearest surface at each pixel, with depth, so water under a bridge does
 * not count.
 *
 * It runs only when the reader presses "measure" in the panel's View tab, in
 * a task of its own between frames, and every renderer call it makes is
 * hidden from the probe (`withoutProbe`). It puts back every material,
 * visibility, background, fog and render target it changed.
 *
 * WHAT IT CANNOT DO. WebGPU is not supported yet: the swap would need the
 * WebGPU build's node materials and an async readback. A shader that moves
 * vertices (waves, wind) is drawn at its rest shape, because the flat
 * material has no displacement.
 */
import { groupOf } from './sceneInventory';
import { recentScenesFor, withoutProbe } from './rendererProbe';

export interface CoverageResult {
  width: number;
  height: number;
  tookMs: number;
  /** Visible share of the screen per group, 0 to 1, largest first. `nothing` is empty background. */
  shares: { group: string; share: number }[];
  camera: string;
}

interface MeshLike {
  isMesh?: boolean;
  isPoints?: boolean;
  isLine?: boolean;
  isSprite?: boolean;
  visible?: boolean;
  material?: unknown;
  children?: MeshLike[];
  parent?: MeshLike | null;
  isScene?: boolean;
  name?: string;
  userData?: Record<string, unknown>;
}

interface SceneLike extends MeshLike {
  background?: unknown;
  fog?: unknown;
  overrideMaterial?: unknown;
}

type CoverageError = { error: string };

/**
 * Measure the screen share of each group for one surface. `order` lists the
 * scene keys in the order the page draws them, so the sky goes first and the
 * water after the ground, as on screen.
 */
export async function measureScreenShare(sessionId: string, order: number[]): Promise<CoverageResult | CoverageError> {
  const recent = recentScenesFor(sessionId);
  if (!recent) return { error: 'the surface is not drawing' };
  const renderer = recent.renderer as {
    isWebGLRenderer?: boolean;
    domElement?: HTMLCanvasElement;
    getRenderTarget: () => unknown;
    setRenderTarget: (t: unknown) => void;
    getClearColor: (c: unknown) => unknown;
    getClearAlpha: () => number;
    setClearColor: (c: unknown, a?: number) => void;
    clear: (c?: boolean, d?: boolean, s?: boolean) => void;
    autoClear: boolean;
    render: (s: unknown, c: unknown) => void;
    readRenderTargetPixels: (t: unknown, x: number, y: number, w: number, h: number, buf: Uint8Array) => void;
  };
  if (!renderer.isWebGLRenderer) return { error: 'not measured on WebGPU yet' };

  // The main camera: the one the largest scene is judged by. Only scenes drawn
  // with that camera are part of what the eye sees.
  const inputs = recent.inputs.filter((i) => i.camera);
  if (inputs.length === 0) return { error: 'no scene has a camera yet' };
  const byTris = inputs
    .map((i) => ({ i, tris: countTriangles(i.scene as unknown as MeshLike) }))
    .sort((a, b) => b.tris - a.tris);
  const camera = byTris[0].i.camera!;
  const scenes = inputs
    .filter((i) => i.camera === camera)
    .sort((a, b) => rank(order, a.sceneKey) - rank(order, b.sceneKey))
    .map((i) => i.scene as unknown as SceneLike);

  // three is already on the page; this import resolves to the same module.
  const THREE = await import('three');
  const t0 = performance.now();
  const el = renderer.domElement;
  const aspect = el && el.height > 0 ? el.width / el.height : 16 / 9;
  const width = 192;
  const height = Math.max(1, Math.round(width / aspect));
  const target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true });

  const groups: string[] = [];
  const mats = new Map<string, InstanceType<typeof THREE.MeshBasicMaterial>>();
  const matFor = (group: string, side: number) => {
    const key = `${group}|${side}`;
    let m = mats.get(key);
    if (!m) {
      let index = groups.indexOf(group);
      if (index < 0) {
        groups.push(group);
        index = groups.length - 1;
      }
      m = new THREE.MeshBasicMaterial({ fog: false, side: side as never });
      // Linear red channel = group index + 1, read back exactly from an 8-bit target.
      m.color.setRGB((index + 1) / 255, 0, 0, THREE.LinearSRGBColorSpace);
      mats.set(key, m);
    }
    return m;
  };

  const restore: (() => void)[] = [];
  const prevTarget = renderer.getRenderTarget();
  const prevClear = new THREE.Color();
  renderer.getClearColor(prevClear);
  const prevAlpha = renderer.getClearAlpha();
  const prevAutoClear = renderer.autoClear;
  const pixels = new Uint8Array(width * height * 4);

  try {
    for (const scene of scenes) {
      const bg = scene.background;
      const fog = scene.fog;
      const ov = scene.overrideMaterial;
      scene.background = null;
      scene.fog = null;
      scene.overrideMaterial = null;
      restore.push(() => {
        scene.background = bg;
        scene.fog = fog;
        scene.overrideMaterial = ov;
      });
      const stack: MeshLike[] = [...(scene.children ?? [])];
      while (stack.length) {
        const o = stack.pop()!;
        if (o.visible === false) continue;
        if (o.children?.length) stack.push(...o.children);
        if (o.isPoints || o.isLine || o.isSprite) {
          o.visible = false;
          restore.push(() => {
            o.visible = true;
          });
          continue;
        }
        if (!o.isMesh || !o.material) continue;
        const original = o.material;
        const g = groupOf(o as never);
        // An unnamed object keeps the word "unnamed" and adds its kind, so the
        // unnamed water and the unnamed trees still get two shares.
        const name = g.source === 'unnamed' ? `unnamed: ${kindOf(o)}` : g.name;
        const side = (Array.isArray(original) ? original[0]?.side : (original as { side?: number }).side) ?? THREE.FrontSide;
        const flat = matFor(name, side);
        o.material = Array.isArray(original) ? original.map(() => flat) : flat;
        // Instance colors multiply the flat color and would scramble the ids.
        const inst = o as { instanceColor?: unknown };
        const instanceColor = inst.instanceColor;
        if (instanceColor) inst.instanceColor = null;
        restore.push(() => {
          o.material = original;
          if (instanceColor) inst.instanceColor = instanceColor;
        });
      }
    }

    withoutProbe(() => {
      renderer.setRenderTarget(target);
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, true, true);
      renderer.autoClear = false;
      for (const scene of scenes) renderer.render(scene, camera);
      renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
    });
  } finally {
    for (let i = restore.length - 1; i >= 0; i--) restore[i]();
    withoutProbe(() => {
      renderer.autoClear = prevAutoClear;
      renderer.setRenderTarget(prevTarget);
      renderer.setClearColor(prevClear, prevAlpha);
    });
    target.dispose();
    for (const m of mats.values()) m.dispose();
  }

  const counts = new Map<number, number>();
  for (let p = 0; p < width * height; p++) {
    const id = pixels[p * 4];
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const total = width * height;
  const shares = [...counts]
    .map(([id, n]) => ({ group: id === 0 ? 'nothing (background)' : groups[id - 1] ?? `group ${id}`, share: n / total }))
    .sort((a, b) => b.share - a.share);
  const cam = camera as { name?: string; type?: string };
  return { width, height, tookMs: performance.now() - t0, shares, camera: cam.name || cam.type || 'camera' };
}

/** "InstancedMesh · Standard · Icosahedron": the object's kind, material and geometry, short. */
function kindOf(o: MeshLike & { type?: string; geometry?: { type?: string } }): string {
  const mat = Array.isArray(o.material) ? o.material[0] : o.material;
  const m = ((mat as { type?: string } | undefined)?.type ?? 'Material').replace(/Material$/, '').replace(/^Mesh/, '');
  const geo = (o.geometry?.type ?? 'Buffer').replace(/Geometry$/, '');
  return `${o.type ?? 'Mesh'} · ${m || 'Material'} · ${geo}`;
}

function rank(order: number[], key: number): number {
  const i = order.indexOf(key);
  return i < 0 ? order.length : i;
}

function countTriangles(scene: MeshLike): number {
  let n = 0;
  const stack: MeshLike[] = [...(scene.children ?? [])];
  while (stack.length) {
    const o = stack.pop()! as MeshLike & { geometry?: { index?: { count: number } | null; attributes?: { position?: { count: number } } }; isInstancedMesh?: boolean; count?: number };
    if (o.visible === false) continue;
    if (o.children?.length) stack.push(...o.children);
    if (!o.isMesh || !o.geometry) continue;
    const c = o.geometry.index ? o.geometry.index.count : o.geometry.attributes?.position?.count ?? 0;
    n += Math.floor(c / 3) * (o.isInstancedMesh ? o.count ?? 1 : 1);
  }
  return n;
}
