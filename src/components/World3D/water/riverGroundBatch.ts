/** Preserve native terrain ownership while reducing opaque submissions.
 * Original tiles remain the edit and shadow source. Moving cameras and any
 * unsupported layout draw those tiles; only a completed stable-camera batch
 * replaces them inside one synchronous opaque draw. Default enablement belongs
 * to the Scene owner after rendered camera/edit/shadow and live pacing checks. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/10/2026, 08:47:28
 * Dependents: components/World3D/water/riverReachScene.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three';

type Tile = THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
type CameraBatch = {
  key: string; epoch: number; stableAt: number;
  groups: Tile[][] | null; next: number; proxies: Tile[];
  originalChildren: THREE.Object3D[] | null; drawChildren: THREE.Object3D[] | null;
};
type SourceState = { geometry: THREE.BufferGeometry; material: THREE.Material; visible: boolean; layers: number;
  attributes: Array<{ name: string; attribute: THREE.BufferAttribute; version: number }>;
  index: THREE.BufferAttribute | null; indexVersion: number };
const IDENTITY = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];

export class RiverGroundBatch {
  enabled = false;
  /** A soft preparation budget: a single bounded group completes before checking the clock. */
  lastPreparationMs = 0;
  private epoch = 0;
  private readonly batches = new Map<THREE.Camera, CameraBatch>();
  private readonly owners: Set<THREE.Object3D>;
  private readonly clock: () => number;
  private source: SourceState[];
  private materials: Set<THREE.Material>;
  private layout = 0;
  private readonly layoutChanged = (): void => { this.layout++; };
  private validated: { revision: number; layout: number; children: THREE.Object3D[]; length: number; eligible: boolean } | null = null;

  constructor(private readonly scene: THREE.Scene, private readonly tiles: readonly Tile[],
    private readonly options: { stableMs?: number; budgetMs?: number; maxVertices?: number; maxTiles?: number; bucketFormats?: boolean; clock?: () => number; sourceRevision?: () => number | null } = {}) {
    this.owners = new Set(tiles); this.clock = options.clock ?? (() => performance.now());
    this.scene.addEventListener('childadded', this.layoutChanged);
    this.scene.addEventListener('childremoved', this.layoutChanged);
    this.source = this.readSource();
    this.materials = new Set(tiles.map(t => t.material));
  }

  private readSource(): SourceState[] {
    return this.tiles.map(t => ({ geometry: t.geometry, material: t.material, visible: t.visible, layers: t.layers.mask,
      attributes: Object.entries(t.geometry.attributes).map(([name, attribute]) => ({ name,
        attribute: attribute as THREE.BufferAttribute, version: (attribute as THREE.BufferAttribute).version })),
      index: t.geometry.index, indexVersion: t.geometry.index?.version ?? 0 }));
  }

  /** Edits preserve TileMap buffers. Rebuild derived batches after their versions change. */
  invalidate(): void {
    this.validated = null;
    this.epoch++; this.source = this.readSource();
    this.materials = new Set(this.tiles.map(t => t.material));
    for (const batch of this.batches.values()) this.disposeBatch(batch);
    this.batches.clear();
  }

  private sourceChanged(): boolean {
    return this.tiles.some((t, i) => {
      const s = this.source[i];
      return t.geometry !== s.geometry || t.material !== s.material || t.visible !== s.visible || t.layers.mask !== s.layers
        || t.geometry.index !== s.index || (t.geometry.index?.version ?? 0) !== s.indexVersion
        || s.attributes.some(a => t.geometry.attributes[a.name] !== a.attribute || a.attribute.version !== a.version);
    });
  }

  private eligible(): boolean {
    // Another object with this material could interleave in native depth order.
    // Keep the original branch until that wider ownership is explicitly supported.
    if (this.scene.children.some(o => (o as Tile).isMesh && this.materials.has((o as Tile).material) && !this.owners.has(o))) return false;
    return this.tiles.length > 0 && this.tiles.every(t => t.parent === this.scene && !t.material.transparent
      && t.position.lengthSq() === 0 && t.quaternion.x === 0 && t.quaternion.y === 0 && t.quaternion.z === 0 && t.quaternion.w === 1
      && t.scale.x === 1 && t.scale.y === 1 && t.scale.z === 1 && t.renderOrder === 0
      && t.matrixWorld.elements.every((n, i) => n === IDENTITY[i])
      && t.geometry.groups.length === 0 && t.geometry.drawRange.start === 0
      && (t.geometry.drawRange.count === Infinity || t.geometry.drawRange.count === (t.geometry.index?.count ?? t.geometry.attributes.position.count))
      && Object.values(t.geometry.attributes).every(a => !(a as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute));
  }

  private cameraKey(camera: THREE.Camera): string {
    return camera.projectionMatrix.elements.join(',') + '|' + camera.matrixWorldInverse.elements.join(',') + '|' + camera.layers.mask;
  }

  private groupsFor(camera: THREE.Camera): Tile[][] {
    const format = (t: Tile): string => Object.entries(t.geometry.attributes).map(([n, a]) =>
      `${n}:${a.itemSize}:${a.array.constructor.name}:${a.normalized}`).sort().join('|') + '|' + !!t.geometry.index;
    const matrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(matrix, camera.coordinateSystem);
    const depths = new Map<Tile, number>(); const center = new THREE.Vector4();
    const visible = this.tiles.filter(t => {
      if (!t.geometry.boundingSphere) t.geometry.computeBoundingSphere();
      if (!t.visible || !t.layers.test(camera.layers) || (t.frustumCulled && !frustum.intersectsObject(t))) return false;
      const p = t.geometry.boundingSphere!.center;
      // Installed native RenderList uses clip-space Vector4.z, without dividing by w.
      depths.set(t, center.set(p.x, p.y, p.z, 1).applyMatrix4(t.matrixWorld).applyMatrix4(matrix).z);
      return true;
    }).sort((a, b) => {
      // Opaque format buckets retain every native attribute and triangle.
      // Material grouping avoids alternating compatible shader layouts; depth
      // stays stable within a bucket. Generic callers retain native tile order.
      const bucket = this.options.bucketFormats
        ? a.material.uuid.localeCompare(b.material.uuid) || format(a).localeCompare(format(b)) : 0;
      return bucket || depths.get(a)! - depths.get(b)! || a.id - b.id;
    });
    const groups: Tile[][] = []; let group: Tile[] = []; let vertices = 0;
    for (const tile of visible) {
      const count = tile.geometry.attributes.position.count;
      if (group.length && (group.length === (this.options.maxTiles ?? 8) || vertices + count > (this.options.maxVertices ?? 32_000)
        || tile.material !== group[0].material || tile.receiveShadow !== group[0].receiveShadow || format(tile) !== format(group[0]))) {
        groups.push(group); group = []; vertices = 0;
      }
      group.push(tile); vertices += count;
    }
    if (group.length) groups.push(group);
    return groups;
  }

  private build(members: Tile[]): Tile {
    // One large native tile must not disable batching for the entire course.
    // groupsFor keeps it alone in native depth order; borrow it unchanged
    // instead of allocating an oversized derived buffer or dropping its faces.
    if (members.length === 1 && members[0].geometry.attributes.position.count > (this.options.maxVertices ?? 32_000)) return members[0];
    const first = members[0]; const geometry = new THREE.BufferGeometry();
    const count = members.reduce((n, t) => n + t.geometry.attributes.position.count, 0);
    for (const [name, source] of Object.entries(first.geometry.attributes)) {
      const AttributeArray = source.array.constructor as new (length: number) => THREE.TypedArray;
      const array = new AttributeArray(count * source.itemSize); let offset = 0;
      for (const t of members) { const a = t.geometry.attributes[name].array; array.set(a, offset); offset += a.length; }
      geometry.setAttribute(name, new THREE.BufferAttribute(array, source.itemSize, source.normalized));
    }
    const indexCount = members.reduce((n, t) => n + (t.geometry.index?.count ?? t.geometry.attributes.position.count), 0);
    const index = new Uint32Array(indexCount); let offset = 0; let vertex = 0;
    for (const t of members) {
      const a = t.geometry.index?.array;
      if (a) for (const i of a) index[offset++] = i + vertex;
      else for (let i = 0; i < t.geometry.attributes.position.count; i++) index[offset++] = i + vertex;
      vertex += t.geometry.attributes.position.count;
    }
    geometry.setIndex(new THREE.BufferAttribute(index, 1)); geometry.computeBoundingSphere();
    // Group centers remain between consecutive native sort keys. Culling was
    // performed on original tile spheres; a batch cannot introduce hidden tiles.
    geometry.boundingSphere!.center.set(0, 0, 0);
    for (const t of members) geometry.boundingSphere!.center.add(t.geometry.boundingSphere!.center);
    geometry.boundingSphere!.center.multiplyScalar(1 / members.length);
    const proxy = new THREE.Mesh(geometry, first.material);
    proxy.receiveShadow = first.receiveShadow; proxy.castShadow = false; proxy.frustumCulled = false;
    proxy.layers.mask = first.layers.mask; proxy.parent = this.scene;
    return proxy;
  }

  /** Call only around an opaque pass after native shadow priming. During camera
   * movement/preparation the callback receives the unchanged original Scene. */
  draw<T>(camera: THREE.Camera, nativeDraw: () => T): T {
    this.lastPreparationMs = 0;
    if (!this.enabled) return nativeDraw();
    const shadowDue = this.scene.children.some(o => {
      const light = o as THREE.Light & { shadow?: THREE.LightShadow };
      return light.isLight && light.castShadow && light.shadow && (light.shadow.autoUpdate || light.shadow.needsUpdate);
    });
    if (shadowDue) return nativeDraw();
    // The terrain owner increments its existing revision only after an edit
    // commits. Generic callers retain per-draw buffer/version validation.
    const revision = this.options.sourceRevision?.();
    if (revision === null) return nativeDraw();
    if (revision === undefined) {
      if (this.sourceChanged()) this.invalidate();
      if (!this.eligible()) return nativeDraw();
    } else {
      const v = this.validated;
      if (!v || v.revision !== revision || v.layout !== this.layout || v.children !== this.scene.children || v.length !== this.scene.children.length) {
        this.invalidate();
        this.validated = { revision, layout: this.layout, children: this.scene.children, length: this.scene.children.length, eligible: this.eligible() };
      }
      if (!this.validated!.eligible || [...this.materials].some(m => m.transparent)) return nativeDraw();
    }
    const key = this.cameraKey(camera), now = this.clock();
    let batch = this.batches.get(camera);
    if (!batch || batch.key !== key || batch.epoch !== this.epoch) {
      if (batch) this.disposeBatch(batch);
      batch = { key, epoch: this.epoch, stableAt: now, groups: null, next: 0, proxies: [], originalChildren: null, drawChildren: null };
      this.batches.set(camera, batch); return nativeDraw();
    }
    if (now - batch.stableAt < (this.options.stableMs ?? 300)) return nativeDraw();
    const start = this.clock();
    batch.groups ??= this.groupsFor(camera);
    while (batch.next < batch.groups.length) {
      batch.proxies.push(this.build(batch.groups[batch.next++]));
      if (this.clock() - start >= (this.options.budgetMs ?? 1)) break;
    }
    this.lastPreparationMs = this.clock() - start;
    if (batch.next !== batch.groups.length) return nativeDraw();
    const original = this.scene.children;
    if (!batch.originalChildren || original.length !== batch.originalChildren.length || original.some((o, i) => o !== batch!.originalChildren![i])) {
      batch.originalChildren = original.slice();
      batch.drawChildren = original.filter(o => !this.owners.has(o)).concat(batch.proxies);
    }
    // Avoid per-frame remove/add events and quadratic child splices. Preserve
    // the canonical array and parent links, including when rendering throws.
    this.scene.children = batch.drawChildren!;
    try { return nativeDraw(); } finally { this.scene.children = original; }
  }

  private disposeBatch(batch: CameraBatch): void {
    // Oversized members are original edit/shadow owners, never batch resources.
    for (const proxy of batch.proxies) if (!this.owners.has(proxy)) { proxy.geometry.dispose(); proxy.parent = null; }
  }
  dispose(): void { this.scene.removeEventListener('childadded', this.layoutChanged); this.scene.removeEventListener('childremoved', this.layoutChanged); for (const batch of this.batches.values()) this.disposeBatch(batch); this.batches.clear(); }
}
