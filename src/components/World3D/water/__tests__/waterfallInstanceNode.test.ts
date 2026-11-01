import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { WaterfallInstanceNode } from '../waterfallInstanceNode';

describe('native waterfall instance upload contract', () => {
  it('forwards growing and shrinking prefixes once per version across draw passes', () => {
    const mesh = new THREE.InstancedMesh(new THREE.BufferGeometry(), new THREE.NodeMaterial(), 20000);
    const node = new WaterfallInstanceNode(mesh);
    node.buffer = new THREE.InstancedInterleavedBuffer(mesh.instanceMatrix.array, 16);
    for (const visible of [2553, 5000, 12]) {
      mesh.instanceMatrix.clearUpdateRanges();
      mesh.instanceMatrix.addUpdateRange(0, visible * 16);
      mesh.instanceMatrix.needsUpdate = true;
      node.update({} as THREE.NodeFrame);
      expect(node.buffer.version).toBe(mesh.instanceMatrix.version);
      expect(node.buffer.updateRanges).toEqual([{ start: 0, count: visible * 16 }]);
      // The backend consumes these ranges on its first upload. A second pass
      // with no new water must not mark another upload or refill the ranges.
      node.buffer.clearUpdateRanges();
      node.update({} as THREE.NodeFrame);
      expect(node.buffer.updateRanges).toEqual([]);
    }
    // A deliberate full-buffer update must clear a previous partial range.
    mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.needsUpdate = true;
    node.buffer.addUpdateRange(0, 16);
    node.update({} as THREE.NodeFrame);
    expect(node.buffer.updateRanges).toEqual([]);
    expect(node.buffer.array).toBe(mesh.instanceMatrix.array);
    mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); mesh.dispose();
  });
});
