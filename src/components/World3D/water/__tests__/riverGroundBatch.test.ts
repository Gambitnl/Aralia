/** Native tile ownership and camera/edit fallback must survive derived batching. */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { RiverGroundBatch } from '../riverGroundBatch';

function fixture(sourceRevision?: () => number | null, options: ConstructorParameters<typeof RiverGroundBatch>[2] = {}) {
  let clock = 0;
  const scene = new THREE.Scene(), material = new THREE.MeshBasicMaterial();
  const tiles = Array.from({ length: 10 }, (_, k) => {
    const geometry = new THREE.BufferGeometry(); const z = -2 - k;
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.2,0,z,0.2,0,z,0,0.2,z], 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,1], 3));
    geometry.setIndex([0,1,2]); geometry.computeBoundingSphere();
    const tile = new THREE.Mesh(geometry, material); tile.castShadow = true; tile.receiveShadow = true;
    scene.add(tile); return tile;
  });
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.coordinateSystem = THREE.WebGPUCoordinateSystem;
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(); scene.updateMatrixWorld();
  const batch = new RiverGroundBatch(scene, tiles, { stableMs: 10, budgetMs: Infinity, clock: () => clock, sourceRevision, ...options });
  const drawn = () => scene.children.filter((o): o is THREE.Mesh => (o as THREE.Mesh).isMesh);
  const prepare = () => { batch.enabled = true; batch.draw(camera, drawn); clock += 11; return batch.draw(camera, drawn); };
  return { scene, tiles, camera, batch, material, drawn, prepare, advance: () => { clock += 11; } };
}

describe('native ground batch', () => {
  it('packs alternating opaque formats without dropping triangles or inventing absent attributes', () => {
    const f = fixture(undefined, { bucketFormats: true, maxVertices: 1_000_000, maxTiles: 256 });
    f.tiles.forEach((tile, i) => {
      tile.geometry.setAttribute('groundVertex', new THREE.BufferAttribute(Uint32Array.of(100 + i * 3, 101 + i * 3, 102 + i * 3), 1));
      if (i % 2) tile.geometry.setAttribute('rockWet', new THREE.Float32BufferAttribute([i, i, i], 1));
    });
    f.batch.invalidate(); const packed = f.prepare();
    expect(packed).toHaveLength(2);
    expect(packed.reduce((n, p) => n + p.geometry.index!.count, 0)).toBe(30);
    const rows = packed.flatMap(p => Array.from({ length: p.geometry.attributes.position.count }, (_, i) => ({
      id: p.geometry.attributes.groundVertex.getX(i), x: p.geometry.attributes.position.getX(i),
      z: p.geometry.attributes.position.getZ(i), wet: p.geometry.attributes.rockWet?.getX(i),
    }))).sort((a, b) => a.id - b.id);
    expect(rows).toEqual(f.tiles.flatMap(t => Array.from({ length: 3 }, (_, i) => ({
      id: t.geometry.attributes.groundVertex.getX(i), x: t.geometry.attributes.position.getX(i),
      z: t.geometry.attributes.position.getZ(i), wet: t.geometry.attributes.rockWet?.getX(i),
    }))));
    f.batch.dispose();
  });
  it('reuses owner validation until a committed edit, then rebuilds from every changed vertex', () => {
    let revision: number | null = 0;
    const f = fixture(() => revision), initial = f.prepare();
    const dispose = vi.spyOn(initial[0].geometry, 'dispose');
    expect(f.batch.draw(f.camera, f.drawn)[0]).toBe(initial[0]);
    revision = null;
    const position = f.tiles[0].geometry.attributes.position as THREE.BufferAttribute;
    position.setY(0, 0.4); position.needsUpdate = true;
    expect(f.batch.draw(f.camera, f.drawn)).toEqual(f.tiles);
    revision = 1;
    expect(f.batch.draw(f.camera, f.drawn)).toEqual(f.tiles);
    expect(dispose).toHaveBeenCalledOnce();
    f.advance(); const rebuilt = f.batch.draw(f.camera, f.drawn);
    expect(rebuilt[0].geometry.attributes.position.getY(0)).toBeCloseTo(0.4);
    f.material.transparent = true;
    expect(f.batch.draw(f.camera, f.drawn)).toEqual(f.tiles);
    f.batch.dispose();
  });
  it('keeps an oversized tile native without disabling batching for the rest of the terrain', () => {
    const f = fixture();
    const oversized = f.tiles[4];
    const positions = new Float32Array(32_001 * 3);
    for (let i = 0; i < positions.length; i += 3) positions.set([-0.1, 0.1, -6], i);
    oversized.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    oversized.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(positions.length), 3));
    oversized.geometry.computeBoundingSphere();
    f.batch.invalidate();
    const sourceDispose = vi.spyOn(oversized.geometry, 'dispose');
    const drawn = f.prepare();
    expect(drawn).toHaveLength(3);
    expect(drawn[1]).toBe(oversized);
    expect(drawn.map(m => m.geometry.index!.count)).toEqual([12, 3, 15]);
    expect(drawn.filter(m => m !== oversized).every(m => m.geometry.attributes.position.count <= 32_000)).toBe(true);
    expect(f.scene.children).toEqual(f.tiles);
    // Camera changes, edits and teardown may release derived batches, never
    // the original large tile or its parent link used by editing and shadows.
    f.camera.position.x = 0.1; f.camera.updateMatrixWorld();
    expect(f.batch.draw(f.camera, f.drawn)).toEqual(f.tiles);
    expect(oversized.parent).toBe(f.scene);
    expect(sourceDispose).not.toHaveBeenCalled();
    f.advance(); f.batch.draw(f.camera, f.drawn);
    f.batch.invalidate(); f.batch.dispose();
    expect(sourceDispose).not.toHaveBeenCalled();
    expect(oversized.parent).toBe(f.scene);
  });

  it('retains full-course integer cell identities through derived batches', () => {
    const f = fixture();
    f.tiles.forEach((tile, k) => {
      const ids = Uint32Array.from([23_219_270 + k * 3, 23_219_271 + k * 3, 23_219_272 + k * 3]);
      tile.geometry.setAttribute('groundVertex', new THREE.BufferAttribute(ids, 1));
    });
    f.batch.invalidate();
    const proxies = f.prepare();
    expect(proxies.every(p => p.geometry.attributes.groundVertex.array instanceof Uint32Array)).toBe(true);
    expect(proxies.flatMap(p => Array.from(p.geometry.attributes.groundVertex.array)))
      .toEqual(f.tiles.flatMap(t => Array.from(t.geometry.attributes.groundVertex.array)));
    f.batch.dispose();
  });

  it('defaults to original tiles and retains primitive order, typed arrays and source ownership when enabled', () => {
    const f = fixture(); const original = f.scene.children;
    expect(f.batch.draw(f.camera, f.drawn)).toEqual(f.tiles);
    const proxies = f.prepare();
    expect(proxies).toHaveLength(2);
    expect(proxies.map(p => p.geometry.index!.count)).toEqual([24,6]);
    expect(proxies[0].geometry.index!.array).toBeInstanceOf(Uint32Array);
    const positions = proxies.flatMap(p => Array.from(p.geometry.attributes.position.array));
    expect(positions).toEqual(f.tiles.flatMap(t => Array.from(t.geometry.attributes.position.array)));
    expect(f.scene.children).toBe(original);
    expect(f.tiles.every(t => t.parent === f.scene && t.castShadow && t.geometry.attributes.position.count === 3)).toBe(true);
    expect(proxies.every(p => !p.castShadow && p.receiveShadow)).toBe(true);
    f.batch.dispose();
    expect(f.tiles[0].geometry.attributes.position.count).toBe(3);
  });

  it('uses native frustum membership and restores the canonical Scene even after an exception', () => {
    const f = fixture(); f.tiles[0].position.x = 100; f.tiles[0].updateMatrixWorld();
    // A transformed source is unsupported, rather than silently drawing it at the origin.
    expect(f.prepare()).toEqual(f.tiles);
    f.tiles[0].position.x = 0; f.tiles[0].updateMatrixWorld(); f.batch.invalidate();
    const pos = f.tiles[0].geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setX(i, 100 + pos.getX(i));
    pos.needsUpdate = true; f.tiles[0].geometry.computeBoundingSphere();
    f.prepare(); const original = f.scene.children;
    expect(() => f.batch.draw(f.camera, () => {
      expect(f.drawn().reduce((n, m) => n + m.geometry.index!.count, 0)).toBe(27);
      throw new Error('renderer failed');
    })).toThrow('renderer failed');
    expect(f.scene.children).toBe(original);
    f.batch.dispose();
  });

  it('falls back during camera movement and rebuilds from edited native buffers', () => {
    const f = fixture(); const first = f.prepare();
    f.camera.position.x = 0.1; f.camera.updateMatrixWorld();
    expect(f.batch.draw(f.camera, f.drawn)).toEqual(f.tiles);
    f.advance(); expect(f.batch.draw(f.camera, f.drawn)).toHaveLength(2);
    const pos = f.tiles[0].geometry.attributes.position;
    pos.setY(0, 0.05); pos.needsUpdate = true; f.tiles[0].geometry.computeBoundingSphere();
    expect(f.batch.draw(f.camera, f.drawn)).toEqual(f.tiles);
    f.advance(); const edited = f.batch.draw(f.camera, f.drawn);
    expect(edited[0].geometry.attributes.position.getY(0)).toBeCloseTo(0.05);
    expect(edited[0].geometry).not.toBe(first[0].geometry);
    f.batch.dispose();
  });

  it('keeps the native path for interleaved material ownership and prepares cameras independently', () => {
    const f = fixture(); f.prepare();
    const other = new THREE.Mesh(f.tiles[0].geometry, f.material); f.scene.add(other);
    expect(f.batch.draw(f.camera, f.drawn)).toEqual([...f.tiles, other]);
    f.scene.remove(other);
    const mirror = f.camera.clone(); mirror.position.x = -0.1; mirror.updateMatrixWorld();
    expect(f.batch.draw(mirror, f.drawn)).toEqual(f.tiles);
    f.advance(); expect(f.batch.draw(mirror, f.drawn)).toHaveLength(2);
    expect(f.batch.draw(f.camera, f.drawn)).toHaveLength(2);
    f.batch.dispose();
  });

  it('preserves original shadow casters whenever a shadow refresh is due', () => {
    const f = fixture(); f.prepare();
    const sun = new THREE.DirectionalLight(); sun.castShadow = true; sun.shadow.autoUpdate = false;
    sun.shadow.needsUpdate = true; f.scene.add(sun);
    expect(f.batch.draw(f.camera, f.drawn)).toEqual(f.tiles);
    sun.shadow.needsUpdate = false;
    expect(f.batch.draw(f.camera, f.drawn)).toHaveLength(2);
    f.batch.dispose();
  });

  it('disposes only derived geometry and bounds preparation to a completed group', () => {
    const f = fixture(); let clock = 0;
    const limited = new RiverGroundBatch(f.scene, f.tiles, { stableMs: 0, budgetMs: 1, clock: () => clock++ });
    limited.enabled = true; limited.draw(f.camera, f.drawn);
    expect(limited.draw(f.camera, f.drawn)).toEqual(f.tiles);
    const proxies = limited.draw(f.camera, f.drawn);
    expect(proxies).toHaveLength(2);
    const sourceDispose = vi.spyOn(f.tiles[0].geometry, 'dispose');
    const derivedDispose = vi.spyOn(proxies[0].geometry, 'dispose');
    limited.dispose(); expect(derivedDispose).toHaveBeenCalledOnce(); expect(sourceDispose).not.toHaveBeenCalled();
    f.batch.dispose();
  });
});
