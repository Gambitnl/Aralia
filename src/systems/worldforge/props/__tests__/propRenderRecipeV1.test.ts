// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { PropInstance } from '../propSchema';
import { woodpileShapeV1 } from '../generators/woodpileGeometry';
import { createPropGeometriesV1, disposePropGeometriesV1, propRenderScaleV1, propShapeV1 } from '../generators/propRenderRecipeV1';

const prop = (defId: string, scale = 1): PropInstance => ({defId,xM:17,zM:31,rotationRad:.7,variation:{scale,variant:3}});
function bounds(p: PropInstance) {
  const shape = propShapeV1(p,{x:0,z:0})!;
  return new THREE.Box3().setFromPoints(shape.triangles.flat().map(v=>new THREE.Vector3(...v)));
}

describe('existing prop render recipe shared with placement', () => {
  it('keeps every canonical woodpile triangle and original identity', () => {
    const p=prop('woodpile',1.0515553719378592), before=JSON.stringify(p);
    expect(propShapeV1(p,{x:10,z:20})).toEqual(woodpileShapeV1(p));
    expect(JSON.stringify(p)).toBe(before);
  });

  it('includes fence rails and cart shafts beyond their central body', () => {
    const fence=bounds(prop('fence-run',1.2));
    expect(fence.min.x).toBeCloseTo(-3.84,5);
    expect(fence.max.x).toBeCloseTo(3.84,5);
    const cart=bounds(prop('cart'));
    expect(cart.max.x).toBeGreaterThan(1.78);
    expect(cart.min.x).toBeCloseTo(-1,5);
    expect(cart.max.z).toBeGreaterThan(.65);
  });

  it('reproduces world-vertical lift in the normalized frame of a leaning simple form', () => {
    const p={...prop('crate'),surface:{tiltRad:.2,tiltAxis:[1,0] as [number,number],sinkM:0,groundYM:0}};
    const shape=propShapeV1(p,{x:0,z:0})!;
    const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.rotationRad);
    rotation.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-.2));
    const world=new THREE.Box3().setFromPoints(shape.triangles.flat().map(v=>new THREE.Vector3(...v).applyQuaternion(rotation)));
    expect(world.getCenter(new THREE.Vector3()).x).toBeCloseTo(0,8);
    expect(world.getCenter(new THREE.Vector3()).y).toBeCloseTo(.375*Math.cos(.2),8);
    expect(world.getCenter(new THREE.Vector3()).z).toBeCloseTo(0,8);
  });

  it('preserves the legacy origin-dependent rock scale explicitly instead of silently migrating old art', () => {
    const p=prop('boulder');
    expect(propRenderScaleV1(p,{x:0,z:0})).not.toBe(propRenderScaleV1(p,{x:17,z:31}));
    expect(propShapeV1(p,{x:0,z:0})).toEqual(propShapeV1(p,{x:0,z:0}));
    expect(propRenderScaleV1(prop('crate',.9),{x:500,z:200})).toBe(.9);
  });

  it('refuses unknown art rather than substituting a nominal catalog box', () => {
    expect(propShapeV1(prop('not-an-authored-form'),{x:0,z:0})).toBeUndefined();
    expect(()=>propShapeV1(prop('crate',NaN),{x:0,z:0})).toThrow('Invalid prop recipe scale');
  });

  it('supports one owned geometry library for a batch and disposes each shared geometry once', () => {
    const g=createPropGeometriesV1(),counts=new Map<THREE.BufferGeometry,number>();
    const geometries=[g.box,g.barrel,g.sack,g.hay,...g.bushes,...g.boulders,...g.logs,...Object.values(g.composed),...Object.values(g.town).flatMap(f=>f.geometries)];
    for(const geometry of new Set(geometries))geometry.addEventListener('dispose',()=>counts.set(geometry,(counts.get(geometry)??0)+1));
    for(const id of ['crate','barrel','sack','haystack','bush','boulder','fallen-log','market-stall','woodpile','fence-run','well','water-trough','cart','crate-stack','brazier','statue']) {
      const result=propShapeV1(prop(id),{x:0,z:0},g);
      expect(result?.triangles.length,id).toBeGreaterThan(0);
      expect(result?.triangles.flat(2).every(Number.isFinite),id).toBe(true);
    }
    expect(counts.size).toBe(0);
    disposePropGeometriesV1(g);
    expect(counts.size).toBe(new Set(geometries).size);
    expect([...counts.values()].every(count=>count===1)).toBe(true);
  });
});
