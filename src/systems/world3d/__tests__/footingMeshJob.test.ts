import { describe, expect, it } from 'vitest';
import { buildFootingMeshes, footingMeshTransfers, type FootingMeshRequest } from '../footingMeshJob';
import { refineTerrainForDetails } from '../terrainFootingDetail';
import { refineRoadMeshForFooting, refineRoadMeshesForFooting } from '../roadGeometry';
import { groundSurfaceY, type GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';

describe('worker standing-ground drawing', () => {
  it('matches the inline terrain, road partitions and verge bytes without detaching scene inputs', () => {
    const terrain = { positions: new Float32Array([0, 0, 0, 16, 0, 0, 0, 0, 16, 16, 0, 16]),
      indices: new Uint32Array([0, 2, 1, 1, 2, 3]),
      normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), colors: new Float32Array(12).fill(.5) };
    const roads = { ...terrain, positions: terrain.positions.map((v, i) => i % 3 === 1 ? .3 : v),
      road: new Float32Array([0, 0, 2, 0, 1, 0, 2, 0, 0, 1, 2, 0, 1, 1, 2, 0]), terrainLift: new Float32Array(4).fill(.3) };
    const ground = { cols: 32, rows: 32, heights: Array.from({ length: 1024 }, (_, i) => 50 + Math.sin(i / 32) * .01) } as GroundWorld;
    const heightAt = (x: number, z: number) => groundSurfaceY(ground, x, z);
    const spec = { centerX: 8, centerZ: 8, innerRadius: 3, outerRadius: 6, maxEdgeM: 1 };
    const request: FootingMeshRequest = { id: 1, chunks: [{ key: '0|0', cx: 0, cy: 0, terrain, roads, roadVerges: roads }],
      terrainDetails: [spec], roadDetails: [spec], refineVerges: true };
    const sourceBytes = () => JSON.stringify(request, (_key, value) => ArrayBuffer.isView(value)
      ? Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)) : value);
    const before = sourceBytes();
    // The browser clones requests; only buffers owned by the worker are returned
    // by transfer. Check all typed-array bytes against the original algorithms.
    const output = buildFootingMeshes(structuredClone(request), heightAt);
    const detail = { ...spec, heightAt }, at = { x: 0, z: 0 };
    expect(output).toEqual([{ key: '0|0', terrain: refineTerrainForDetails(terrain, at, [detail]),
      roads: refineRoadMeshesForFooting(roads, at, detail), roadVerges: refineRoadMeshForFooting(roads, at, detail) }]);
    const transfer = footingMeshTransfers(output);
    expect(new Set(transfer).size).toBe(transfer.length);
    const delivered = structuredClone(output, { transfer });
    expect(delivered[0].terrain.positions.length).toBeGreaterThan(terrain.positions.length);
    expect(sourceBytes()).toBe(before);
    expect(terrain.positions.buffer.byteLength).toBe(48);
  });
});
