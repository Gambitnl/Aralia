import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { propSourceId, type PropInstance } from '@/systems/worldforge/props/propSchema';
import { makeFieldSurfaceProbe } from '@/systems/worldforge/terrain/surfaceProbe';
import { verifyRenderedPropSupport } from '../groundPropSupport';
import { captureRenderedGroundPropShape, groundPropInstanceSource, renderedPropPose, setGroundPropInstanceSources,
  type RenderedGroundPropShape } from '../groundPropGeometry';

const prop: PropInstance = { defId: 'crate', xM: 5, zM: 7, rotationRad: 0,
  variation: { scale: 1, variant: 0 }, surface: { groundYM: 0, sinkM: 0, tiltRad: 0, tiltAxis: [1, 0] } };
const flat = makeFieldSurfaceProbe(() => 0);
function bottom(y = 0): RenderedGroundPropShape {
  return { sourceId: propSourceId(prop), defId: prop.defId, variation: { ...prop.variation }, triangles: [
    [[-.5, y, -.5], [.5, y, -.5], [.5, y, .5]], [[-.5, y, -.5], [.5, y, .5], [-.5, y, .5]],
  ] };
}

describe('actual rendered prop lower-hull support', () => {
  it('accepts a flat rendered base on flat support using existing town thresholds', () => {
    const before = JSON.stringify(prop), result = verifyRenderedPropSupport(prop, bottom(), flat);
    expect(result).toMatchObject({ passed: true, samples: 25, contactRatio: 1, penetrationFt: 0 });
    expect(JSON.stringify(prop)).toBe(before);
  });
  it('refuses floating rendered geometry even when the nominal origin is on the ground', () => {
    expect(verifyRenderedPropSupport(prop, bottom(.5), flat).issues).toContain('rendered-floater');
  });
  it('refuses buried geometry and missing terrain rather than rewriting support', () => {
    expect(verifyRenderedPropSupport(prop, bottom(-.5), flat).issues).toContain('rendered-sunken');
    expect(verifyRenderedPropSupport(prop, bottom(), makeFieldSurfaceProbe(() => NaN)).passed).toBe(false);
  });
  it('does not invent a flat base across the gap between two supports', () => {
    const shape = bottom();
    shape.triangles = [
      [[-.5, 0, -.5], [-.3, 0, -.5], [-.3, 0, .5]], [[-.5, 0, -.5], [-.3, 0, .5], [-.5, 0, .5]],
      [[.3, 0, -.5], [.5, 0, -.5], [.5, 0, .5]], [[.3, 0, -.5], [.5, 0, .5], [.3, 0, .5]],
    ];
    const result = verifyRenderedPropSupport(prop, shape, flat);
    expect(result.passed).toBe(true); expect(result.samples).toBe(10);
  });
  it('takes the lowest triangle where stacked pieces share an XZ projection', () => {
    const shape = bottom(); shape.triangles.push(...bottom(1).triangles);
    expect(verifyRenderedPropSupport(prop, shape, flat).contactRatio).toBe(1);
  });
  it('detects a narrow buried vertex between the regular contact samples', () => {
    const shape = bottom();
    shape.triangles.push([[.09, -.3, .09], [.11, 0, .09], [.1, 0, .11]]);
    expect(verifyRenderedPropSupport(prop, shape, flat).issues).toContain('rendered-sunken');
  });
  it('refuses another source, changed appearance and an unseated pose', () => {
    expect(verifyRenderedPropSupport(prop, { ...bottom(), sourceId: 'another' }, flat).passed).toBe(false);
    expect(verifyRenderedPropSupport({ ...prop, variation: { scale: 2, variant: 0 } }, bottom(), flat).issues).toContain('shape-appearance-mismatch');
    expect(verifyRenderedPropSupport({ ...prop, surface: undefined }, bottom(), flat).issues).toContain('unseated-prop');
  });
  it('captures actual indexed geometry in prop-local axes, retaining scale exactly once', () => {
    const root = new THREE.Group(), current = { ...prop, rotationRad: .7, variation: { scale: 2, variant: 0 } };
    const geometry = new THREE.BoxGeometry(1, 1, 1); geometry.translate(0, .5, 0);
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial(), 1);
    mesh.setMatrixAt(0, renderedPropPose(current, 0).multiply(new THREE.Matrix4().makeScale(2, 2, 2)));
    setGroundPropInstanceSources(mesh, [groundPropInstanceSource(current)]); root.add(mesh);
    const before = mesh.instanceMatrix.array.slice();
    const result = captureRenderedGroundPropShape(root, { x: 0, z: 0 }, current, 0);
    expect(result.issues).toEqual([]); expect(result.shape?.triangles).toHaveLength(12);
    const coordinates = result.shape!.triangles.flat().flat(); expect(Math.max(...coordinates)).toBeCloseTo(2, 6);
    expect(verifyRenderedPropSupport(current, result.shape!, flat).passed).toBe(true);
    expect(mesh.instanceMatrix.array).toEqual(before);
  });
  it('preserves yaw and surface lean through capture and virtual pose reconstruction', () => {
    const root = new THREE.Group(), current: PropInstance = { ...prop, rotationRad: .5,
      surface: { ...prop.surface!, tiltRad: .15, tiltAxis: [1, 0] } };
    const geometry = new THREE.BoxGeometry(1, 1, 1); geometry.translate(0, .5, 0);
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial(), 1);
    mesh.setMatrixAt(0, renderedPropPose(current, 0)); setGroundPropInstanceSources(mesh, [groundPropInstanceSource(current)]); root.add(mesh);
    const result = captureRenderedGroundPropShape(root, { x: 0, z: 0 }, current, 0);
    expect(result.issues).toEqual([]);
    const y = result.shape!.triangles.flat().map(p => p[1]);
    expect(Math.min(...y)).toBeCloseTo(0, 6); expect(Math.max(...y)).toBeCloseTo(1, 6);
  });
});
