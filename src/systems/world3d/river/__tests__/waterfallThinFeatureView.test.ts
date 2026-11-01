/** Protect the live display from a changing simulation behind frozen r172
 * attribute bindings. Rendered proof is still required for the WebGPU path. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createWaterfallThinFeatureView } from '../../../../components/World3D/water/waterfallThinFeatureView';
import { WaterfallThinDynamics } from '../waterfallThinDynamics';

describe('live thin-water geometry', () => {
  it('updates existing GPU-bound attributes as water moves, then draws nothing after landing', () => {
    const simulation = new WaterfallThinDynamics({mode: 'fixed-air', across: 2});
    simulation.recordSource(0, {q: .2, width: 1, depth: .1, speed: 2, turbulence: 0});
    simulation.recordSource(.05, {q: 0, width: 1, depth: .1, speed: 2, turbulence: 0});
    const view = createWaterfallThinFeatureView();
    const sheet = view.group.children[0] as THREE.Mesh;
    const position = sheet.geometry.getAttribute('position') as THREE.BufferAttribute;
    const normals = sheet.geometry.getAttribute('normal') as THREE.BufferAttribute;
    simulation.advanceTo(.1); view.update(simulation.snapshot());
    const x = position.getX(0), version = position.version;
    simulation.advanceTo(.2); view.update(simulation.snapshot());
    expect(sheet.geometry.getAttribute('position')).toBe(position);
    expect(sheet.geometry.getAttribute('normal')).toBe(normals);
    expect(position.getX(0)).toBeGreaterThan(x);
    expect(position.version).toBeGreaterThan(version);
    expect(sheet.geometry.drawRange.count).toBe(simulation.snapshot().patches.length * 3);
    expect(sheet.geometry.boundingBox!.min.y).toBeGreaterThan(60);
    simulation.advanceTo(5); view.update(simulation.snapshot());
    expect(sheet.geometry.drawRange.count).toBe(0);
    expect(sheet.geometry.boundingBox!.isEmpty()).toBe(true);
    view.dispose();
  });
});
