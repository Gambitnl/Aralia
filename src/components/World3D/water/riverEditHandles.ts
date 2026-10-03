/**
 * @file riverEditHandles.ts — the river scene's EDIT MODE handles (the live
 * river editor, 2026-09-29: "make it so i can grab the river and i can
 * manipulate the river shape live").
 *
 * WHAT THEY ARE
 *
 * - A PATH HANDLE (blue) on each control point of the course line inside the
 *   solver grid. Drag it over the ground and the river's path follows: the
 *   four Catmull-Rom segments round that point move, and the bed near them is
 *   carved again (riverLive.ts).
 * - Two BANK HANDLES (amber) at each control point, one on each bank. Drag one
 *   away from the water to widen the channel there, toward it to narrow it
 *   (both banks move: the channel stays centered on its thalweg).
 * - A HEIGHT HANDLE (green) beside each path handle (Remy, 2026-09-29: "make
 *   it so that i can make the river nodes be able to go up and down
 *   individually"). Drag it up to raise the bed at that point, down to lower
 *   it. Its LABEL names the point's height against the judged bed and what
 *   the height does to the water (deeper, shallower, a hump the water splits
 *   round, or a block the water ponds behind), and carries a "Reset height"
 *   button when the height is not 0.
 * - The course line itself, drawn over the water.
 *
 * They draw over the finished frame (RiverReachView.overlay) with no depth
 * test, at a fixed size on screen; the labels are page elements over the
 * canvas. Neither draws in a capture unless a script asks.
 */
import * as THREE from 'three';
import {
  RIVER_COURSE_POINTS, RIVER_EDITABLE_POINTS, RIVER_EDIT_LIMITS, courseKeyAt, defaultRiverCourse, getRiverShape,
  riverBaseHalfWidthAt,
} from '@/systems/world3d/river/riverReach';
import type { RiverNodeReport } from '@/systems/world3d/river/riverLive';
import type { RiverReachView } from './riverReachScene';

/** One handle: a control point's path handle, one of its bank handles, or its height handle. */
export interface RiverHandle {
  kind: 'path' | 'bank' | 'height';
  /** The control point's index in the course line. */
  point: number;
  /** For a bank handle: +1 the left bank (looking downstream), -1 the right. */
  side: 1 | -1;
  mesh: THREE.Mesh;
  /** Where it stands now, m. */
  x: number;
  y: number;
  z: number;
}

/** A handle's size on screen: its radius, px. */
const HANDLE_PX = 9;
/** How near the pointer must come to a handle to take it, px. */
const PICK_PX = 16;
/** How far right of its path handle a height handle stands on screen, px. */
const HEIGHT_OFFSET_PX = 26;

const COLORS = {
  path: new THREE.Color('#38bdf8'),
  bank: new THREE.Color('#f59e0b'),
  height: new THREE.Color('#34d399'),
  hover: new THREE.Color('#ffffff'),
  line: new THREE.Color('#7dd3fc'),
};

/** What each report kind says, short (the label) and in full (its title). */
const KIND_WORDS: Record<RiverNodeReport['kind'], { tag: string; full: string }> = {
  deeper: { tag: 'deeper', full: 'The bed is lower here: the channel holds deeper water.' },
  shallower: { tag: 'shallower', full: 'The bed is higher here: the water runs shallower over it.' },
  split: { tag: 'dry hump: water goes round', full: 'The middle of the channel stands out of the water as a dry hump, and the water passes beside it.' },
  block: { tag: 'blocks: water ponds', full: 'The water cannot pass at its old level: it ponds upstream and spills over the lowest way past.' },
};

/** The words for a height and its report (the label, and its title). */
export function riverHeightWords(h: number, r: RiverNodeReport | undefined): { text: string; title: string } {
  const v = `${h > 0 ? '+' : h < 0 ? '-' : ''}${Math.abs(h).toFixed(2)} m`;
  if (h === 0 || !r) return { text: v, title: `This point's bed is at the judged height (${v}). Drag the green handle up to raise it, down to lower it.` };
  const k = KIND_WORDS[r.kind];
  let extra = '';
  if (r.kind === 'block') {
    extra = r.noPass
      ? ' No way past stays inside the simulated band: the water rises to the solver\'s ceiling and stops. Lower the point.'
      : ` It spills over the ${r.passSide === 'middle' ? 'middle' : `${r.passSide} side`} at ${r.pass.toFixed(2)} m; the pond reaches ${r.pondM} m upstream.`;
  } else if (r.kind === 'split') {
    extra = ` The way past is on the ${r.passSide === 'middle' ? 'middle' : `${r.passSide} side`}.`;
  }
  const tag = r.kind === 'block' && r.noPass ? 'blocks: no way past' : k.tag;
  return { text: `${v} · ${tag}`, title: `This point's bed is ${v} against the judged bed. ${k.full}${extra}` };
}

export class RiverEditHandles {
  readonly scene = new THREE.Scene();
  readonly handles: RiverHandle[] = [];
  private readonly view: RiverReachView;
  private readonly line: THREE.Line;
  private hover: RiverHandle | null = null;
  private active: RiverHandle | null = null;
  /** The control points now (x, z pairs), as the last patch gave them. */
  private points: Float32Array;
  /** Each control point's height against the judged bed, m, and what it does to the water. */
  private heights: Float32Array;
  private reports = new Map<number, RiverNodeReport>();
  /** A height drag's start: the pointer's y (px) and the point's height then (m). */
  private heightDrag: { py: number; h: number } | null = null;
  /** The labels over the canvas, one per height handle (none without a label host). */
  private readonly labels = new Map<number, { el: HTMLDivElement; text: HTMLSpanElement; reset: HTMLButtonElement; key: string }>();
  private readonly labelHost: HTMLElement | null;

  constructor(view: RiverReachView, opts: { labelHost?: HTMLElement; onResetHeight?: (point: number) => void } = {}) {
    this.view = view;
    this.labelHost = opts.labelHost ?? null;
    const sphere = new THREE.SphereGeometry(1, 20, 12);
    const diamond = new THREE.OctahedronGeometry(1.25, 0).scale(0.85, 1.35, 0.85);
    const ring = new THREE.RingGeometry(1.35, 1.75, 32).rotateX(-Math.PI / 2);
    const mat = (c: THREE.Color): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({
      color: c, depthTest: false, depthWrite: false, transparent: true, opacity: 0.92, toneMapped: false,
    });
    const make = (kind: RiverHandle['kind'], point: number, side: 1 | -1): RiverHandle => {
      const c = COLORS[kind];
      const mesh = new THREE.Mesh(kind === 'height' ? diamond : sphere, mat(c));
      // A dark ring under each handle, so it reads on bright water and on gravel.
      const r = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({
        color: 0x0b1620, depthTest: false, depthWrite: false, transparent: true, opacity: 0.75, toneMapped: false, side: THREE.DoubleSide,
      }));
      mesh.add(r);
      mesh.renderOrder = 2;
      r.renderOrder = 1;
      mesh.frustumCulled = false;
      r.frustumCulled = false;
      this.scene.add(mesh);
      return { kind, point, side, mesh, x: 0, y: 0, z: 0 };
    };
    for (const p of RIVER_EDITABLE_POINTS) {
      this.handles.push(make('path', p, 1));
      this.handles.push(make('bank', p, 1));
      this.handles.push(make('bank', p, -1));
      this.handles.push(make('height', p, 1));
    }
    this.line = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: COLORS.line, depthTest: false, depthWrite: false, transparent: true, opacity: 0.7, toneMapped: false }),
    );
    this.line.frustumCulled = false;
    this.line.renderOrder = 0;
    this.scene.add(this.line);
    this.points = new Float32Array(RIVER_COURSE_POINTS.length * 2);
    RIVER_COURSE_POINTS.forEach((p, k) => { this.points[k * 2] = p[0]; this.points[k * 2 + 1] = p[1]; });
    this.heights = new Float32Array(RIVER_COURSE_POINTS.length);
    if (this.labelHost) {
      for (const p of RIVER_EDITABLE_POINTS) {
        const el = document.createElement('div');
        el.style.cssText = 'position:absolute;left:0;top:0;display:none;align-items:center;gap:4px;padding:1px 5px;border-radius:9px;'
          + 'font:600 11px/16px system-ui,sans-serif;color:#ecfdf5;background:rgba(6,40,30,0.82);white-space:nowrap;pointer-events:none;'
          + 'box-shadow:0 1px 3px rgba(0,0,0,0.4);';
        const text = document.createElement('span');
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.textContent = 'Reset height';
        reset.title = `Put point ${p}'s bed back to the judged height.`;
        reset.style.cssText = 'pointer-events:auto;cursor:pointer;border:1px solid #6ee7b7;border-radius:7px;padding:0 4px;'
          + 'font:600 10px/14px system-ui,sans-serif;color:#ecfdf5;background:rgba(16,80,60,0.9);';
        reset.addEventListener('pointerdown', (e) => e.stopPropagation());
        reset.addEventListener('click', (e) => { e.stopPropagation(); opts.onResetHeight?.(p); });
        el.append(text, reset);
        el.dataset.riverLabel = String(p);
        this.labelHost.appendChild(el);
        this.labels.set(p, { el, text, reset, key: '' });
      }
    }
    this.place();
  }

  /** The water or the ground at (x, z), whichever is higher, m. */
  private surfaceAt(x: number, z: number): number {
    const lv = this.view.levelAt(x, z);
    const d = this.view.modelAt(x, z);
    return d.h > 0.02 ? lv : Math.max(lv > -50 ? lv - 1 : -1e9, this.groundAt(x, z));
  }

  private groundAt(x: number, z: number): number {
    return this.view.groundAt(x, z);
  }

  /** The course sample (x, z, tx, tz) nearest the design s, from the view's 1 m course. */
  private courseAt(s: number): [number, number, number, number] {
    const c = this.view.data.course;
    const k = Math.max(0, Math.min(c.length / 5 - 1, Math.round(s) + 120)) * 5;
    return [c[k], c[k + 1], c[k + 3], c[k + 4]];
  }

  /**
   * PLACE THE HANDLES AND THE LINE from the control points (`points`, or the
   * last ones), the key table now (the shape and the local widths), and the
   * heights and their reports (the last patch's).
   */
  place(points?: Float32Array, heights?: Float32Array, reports?: RiverNodeReport[]): void {
    if (points) this.points = points;
    if (heights) this.heights = heights.slice();
    if (reports) this.reports = new Map(reports.map((r) => [r.point, r]));
    const pS = defaultRiverCourse().pointS;
    for (const h of this.handles) {
      if (h.kind === 'height') continue;
      if (h.kind === 'path') {
        h.x = this.points[h.point * 2];
        h.z = this.points[h.point * 2 + 1];
      } else {
        const s = pS[h.point];
        const [cx, cz, tx, tz] = this.courseAt(s);
        const hw = courseKeyAt(s).halfW;
        // The left normal of (tx, tz) is (tz, -tx).
        h.x = cx + tz * hw * h.side;
        h.z = cz - tx * hw * h.side;
      }
      if (this.active === h) continue;
      h.y = this.surfaceAt(h.x, h.z) + (h.kind === 'path' ? 0.9 : 0.5);
      h.mesh.position.set(h.x, h.y, h.z);
    }
    // The course line over the water, inside the solver grid.
    const c = this.view.data.course;
    const g = this.view.data.grid;
    const pts: number[] = [];
    for (let k = 0; k < c.length; k += 5) {
      const x = c[k];
      const z = c[k + 1];
      if (x < g.x0 || x > g.x0 + g.nx * g.dx || z < g.z0 || z > g.z0 + g.nz * g.dx) continue;
      pts.push(x, this.surfaceAt(x, z) + 0.2, z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.line.geometry.dispose();
    this.line.geometry = geo;
  }

  /**
   * Each frame: the handles at a fixed size on screen, the height handles
   * beside their path handles, the hovered one lit, and the labels over their
   * height handles (shown only when `labels` is true).
   */
  frame(camera: THREE.PerspectiveCamera, viewportW: number, viewportH: number, labels = true): void {
    const k = (2 * Math.tan((camera.fov * Math.PI) / 360) * HANDLE_PX) / Math.max(1, viewportH);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const byPoint = new Map<number, RiverHandle>();
    for (const h of this.handles) if (h.kind === 'path') byPoint.set(h.point, h);
    for (const h of this.handles) {
      if (h.kind === 'height') {
        const ph = byPoint.get(h.point);
        if (ph) {
          const d = camera.position.distanceTo(ph.mesh.position);
          const perPx = (2 * Math.tan((camera.fov * Math.PI) / 360) * d) / Math.max(1, viewportH);
          h.mesh.position.copy(ph.mesh.position).addScaledVector(right, HEIGHT_OFFSET_PX * perPx);
          h.x = h.mesh.position.x;
          h.y = h.mesh.position.y;
          h.z = h.mesh.position.z;
        }
      }
      const d = camera.position.distanceTo(h.mesh.position);
      h.mesh.scale.setScalar(Math.max(0.02, d * k));
      const lit = h === this.hover || h === this.active;
      (h.mesh.material as THREE.MeshBasicMaterial).color.copy(lit ? COLORS.hover : COLORS[h.kind]);
    }
    for (const [p, lb] of this.labels) {
      const h = this.handles.find((q) => q.kind === 'height' && q.point === p);
      if (!labels || !h) { lb.el.style.display = 'none'; continue; }
      const v = h.mesh.position.clone().project(camera);
      if (v.z > 1 || v.z < -1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) { lb.el.style.display = 'none'; continue; }
      const sx = (v.x * 0.5 + 0.5) * viewportW;
      const sy = (1 - (v.y * 0.5 + 0.5)) * viewportH;
      lb.el.style.display = 'flex';
      lb.el.style.transform = `translate(${Math.round(sx + 12)}px, ${Math.round(sy - 8)}px)`;
      const hv = this.heights[p] ?? 0;
      const r = this.reports.get(p);
      const key = `${hv}|${r ? `${r.kind}${r.noPass}${r.passSide}${r.pondM}${r.pass}` : ''}`;
      if (key !== lb.key) {
        lb.key = key;
        const w = riverHeightWords(hv, r);
        lb.text.textContent = w.text;
        lb.el.title = w.title;
        lb.el.style.pointerEvents = 'auto';
        lb.reset.style.display = hv !== 0 ? 'inline-block' : 'none';
        lb.el.style.background = hv === 0 ? 'rgba(6,40,30,0.6)' : r?.kind === 'block' ? 'rgba(120,53,15,0.9)' : 'rgba(6,78,59,0.9)';
      }
    }
  }

  /** Hide every label (the edit mode is off). */
  hideLabels(): void {
    for (const lb of this.labels.values()) lb.el.style.display = 'none';
  }

  /** The handle under a canvas point (px, y down), or null. */
  pick(px: number, py: number): RiverHandle | null {
    let best: RiverHandle | null = null;
    let bestD = PICK_PX;
    for (const h of this.handles) {
      const [sx, sy] = this.view.worldToScreen(h.mesh.position.x, h.mesh.position.y, h.mesh.position.z);
      // Behind the camera, a projection lands on the screen too: test the depth.
      const v = h.mesh.position.clone().project(this.view.camera);
      if (v.z > 1 || v.z < -1) continue;
      const d = Math.hypot(sx - px, sy - py);
      // A path handle wins a tie (it sits over the bank handles' line).
      const dd = h.kind === 'path' ? d - 2 : d;
      if (dd < bestD) { bestD = dd; best = h; }
    }
    return best;
  }

  setHover(h: RiverHandle | null): void {
    this.hover = h;
  }

  /** Start a drag on a handle (`py`: the pointer's y, px, for a height drag). */
  grab(h: RiverHandle, py = 0): void {
    this.active = h;
    this.heightDrag = h.kind === 'height' ? { py, h: this.heights[h.point] ?? 0 } : null;
  }

  /** End the drag. */
  release(): void {
    this.active = null;
    this.heightDrag = null;
  }

  get dragging(): RiverHandle | null {
    return this.active;
  }

  /**
   * WHERE THE POINTER IS on the drag's plane: the horizontal plane through the
   * grabbed handle. Null when the ray runs away from it (a view past the
   * horizon); the handle then keeps its place.
   */
  groundPoint(px: number, py: number, w: number, h: number): { x: number; z: number } | null {
    const a = this.active;
    if (!a) return null;
    const cam = this.view.camera;
    const ndc = new THREE.Vector3((px / w) * 2 - 1, -(py / h) * 2 + 1, 0.5);
    ndc.unproject(cam);
    const dir = ndc.sub(cam.position).normalize();
    if (Math.abs(dir.y) < 1e-4) return null;
    const t = (a.y - cam.position.y) / dir.y;
    if (t <= 0 || t > 2000) return null;
    return { x: cam.position.x + dir.x * t, z: cam.position.z + dir.z * t };
  }

  /**
   * WHAT A HEIGHT DRAG TO THE POINTER'S y ASKS FOR: the point's height at the
   * drag's start plus the pointer's rise, in meters of the view at the
   * handle's distance (a pixel up is as many meters as a pixel spans there),
   * kept to 1 cm and to the edit's limits. The label shows it at once.
   */
  heightTarget(py: number, viewportH: number): { point: number; height: number } | null {
    const a = this.active;
    const hd = this.heightDrag;
    if (!a || a.kind !== 'height' || !hd) return null;
    const cam = this.view.camera;
    const d = cam.position.distanceTo(a.mesh.position);
    const perPx = (2 * Math.tan((cam.fov * Math.PI) / 360) * d) / Math.max(1, viewportH);
    const L = RIVER_EDIT_LIMITS.height;
    const v = Math.min(L[1], Math.max(L[0], Math.round((hd.h + (hd.py - py) * perPx) * 100) / 100));
    this.heights[a.point] = v;
    return { point: a.point, height: v };
  }

  /**
   * WHAT A DRAG TO (x, z) ASKS FOR: a path handle, the control point's new
   * offset from its judged place (m); a bank handle, the control point's new
   * width multiplier (the pointer's distance from the course line over the
   * judged half width at the panel's width scale). The edit is clamped again
   * by the model (riverReach.ts clampRiverCourseEdit).
   */
  dragTarget(x: number, z: number): { point: number; offset?: [number, number]; width?: number } | null {
    const a = this.active;
    if (!a || a.kind === 'height') return null;
    // The handle follows the pointer at once; the ground follows with the patch.
    a.x = x;
    a.z = z;
    a.mesh.position.set(x, a.y, z);
    if (a.kind === 'path') {
      const p0 = RIVER_COURSE_POINTS[a.point];
      return { point: a.point, offset: [x - p0[0], z - p0[1]] };
    }
    const s = defaultRiverCourse().pointS[a.point];
    const [cx, cz, tx, tz] = this.courseAt(s);
    const n = Math.abs((x - cx) * tz - (z - cz) * tx);
    const w = n / (riverBaseHalfWidthAt(s) * getRiverShape().widthScale);
    return { point: a.point, width: Math.min(RIVER_EDIT_LIMITS.width[1], Math.max(RIVER_EDIT_LIMITS.width[0], w)) };
  }

  /** Where a handle is on the canvas, px (y down): for scripts that drag it with a real pointer. */
  screenOf(kind: RiverHandle['kind'], point: number, side: 1 | -1 = 1): [number, number] | null {
    const h = this.handles.find((q) => q.kind === kind && q.point === point && (kind !== 'bank' || q.side === side));
    return h ? this.view.worldToScreen(h.mesh.position.x, h.mesh.position.y, h.mesh.position.z) : null;
  }

  dispose(): void {
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.material) (m.material as THREE.Material).dispose();
    });
    this.line.geometry.dispose();
    for (const lb of this.labels.values()) lb.el.remove();
  }
}
