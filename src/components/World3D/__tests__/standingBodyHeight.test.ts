import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {standingBodyHeight,standingBodyRadius,standingBodyFootprint} from '../standingBodyHeight';

function box(height: number, y: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(.3,height,.3),new THREE.MeshBasicMaterial());
  mesh.position.y=y;
  return mesh;
}
describe('standing figure clearance',()=>{
  it('measures above the feet through mounted ancestors and includes held gear',()=>{
    const parent=new THREE.Group(),root=new THREE.Group();
    parent.position.y=9;parent.add(root);root.position.y=3;
    root.add(box(1.7,.85));
    expect(standingBodyHeight(root)).toBeCloseTo(1.7);
    root.add(box(.4,1.8));
    expect(standingBodyHeight(root)).toBeCloseTo(2);
  });
  it('excludes the projected shadow, hidden groups and invisible materials',()=>{
    const root=new THREE.Group();root.add(box(1.6,.8));
    const shadow=box(4,2);shadow.name='blobShadow';root.add(shadow);
    const hidden=new THREE.Group();hidden.visible=false;hidden.add(box(5,2.5));root.add(hidden);
    const invisible=box(6,3);(invisible.material as THREE.Material).visible=false;root.add(invisible);
    expect(standingBodyHeight(root)).toBeCloseTo(1.6);
  });
  it('leaves missing anatomy unknown instead of manufacturing a short body',()=>{
    expect(standingBodyHeight(null)).toBeUndefined();
    expect(standingBodyHeight(new THREE.Group())).toBeUndefined();
  });
});

describe('standing personal footprint',()=>{
 it('measures around the feet and excludes projected shadow width',()=>{
  const parent=new THREE.Group(),root=new THREE.Group();parent.position.set(30,7,40);parent.add(root);
  const body=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.8,.8),new THREE.MeshBasicMaterial());body.position.y=.9;root.add(body);
  const shadow=new THREE.Mesh(new THREE.BoxGeometry(20,.01,20),new THREE.MeshBasicMaterial());shadow.name='blobShadow';root.add(shadow);
  expect(standingBodyRadius(root)).toBeCloseTo(Math.hypot(.6,.4));
 });
 it('includes asymmetrical anatomy or held gear without shifting the foot anchor',()=>{
  const root=new THREE.Group();root.add(box(1.6,.8));
  const gear=new THREE.Mesh(new THREE.BoxGeometry(.4,.2,.2),new THREE.MeshBasicMaterial());gear.position.x=.9;root.add(gear);
  expect(standingBodyRadius(root)).toBeGreaterThan(1.1);expect(root.position.toArray()).toEqual([0,0,0]);
 });
 it('keeps a missing rendered body unknown',()=>{
  expect(standingBodyRadius(null)).toBeUndefined();expect(standingBodyRadius(new THREE.Group())).toBeUndefined();
 });
 it('keeps the same physical envelope when the whole figure turns',()=>{
  const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.8,.8),new THREE.MeshBasicMaterial());root.add(mesh);
  const before=standingBodyRadius(root);root.rotation.y=Math.PI/4;
  expect(standingBodyRadius(root)).toBeCloseTo(before!);
 });

 it('updates attached skin binding after the figure is mounted away from the origin',()=>{
  const root=new THREE.Group(),bone=new THREE.Bone(),geometry=new THREE.BoxGeometry(1,2,.4);root.add(bone);
  const count=geometry.attributes.position.count,weights=new Float32Array(count*4);for(let i=0;i<count;i++)weights[i*4]=1;
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(count*4),4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const skin=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial());root.add(skin);skin.bind(new THREE.Skeleton([bone]));
  const parent=new THREE.Group();parent.position.set(100,3,200);parent.add(root);root.position.set(2,0,1);
  expect(standingBodyRadius(root,true)).toBeCloseTo(Math.hypot(.5,.2));
 });

});


describe('measured standing box',()=>{
 it('preserves asymmetric bounds and the world facing without shifting feet',()=>{
  const parent=new THREE.Group(),root=new THREE.Group();parent.position.set(100,3,200);parent.rotation.y=.6;parent.add(root);
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.8,.4),new THREE.MeshBasicMaterial());mesh.position.set(0,.9,-.3);root.add(mesh);
  const f=standingBodyFootprint(root)!;expect(f.minXM).toBeCloseTo(-.6);expect(f.maxXM).toBeCloseTo(.6);expect(f.minZM).toBeCloseTo(-.5);expect(f.maxZM).toBeCloseTo(-.1);expect(f.yawRad).toBeCloseTo(.6);expect(f.radiusM).toBeCloseTo(Math.hypot(.6,.5));expect(root.position.toArray()).toEqual([0,0,0]);
 });
 it('keeps all gear and ancestor scaling in the measured box',()=>{
  const parent=new THREE.Group(),root=new THREE.Group();parent.scale.set(2,1,2);parent.add(root);root.add(box(1.6,.8));
  const gear=new THREE.Mesh(new THREE.BoxGeometry(.4,.2,.2),new THREE.MeshBasicMaterial());gear.position.x=.9;root.add(gear);
  const f=standingBodyFootprint(root)!;expect(f.minXM).toBeCloseTo(-.3);expect(f.maxXM).toBeCloseTo(2.2);expect(f.radiusM).toBeCloseTo(standingBodyRadius(root)!);
 });
 it('keeps projected shadows out and absent bodies unknown',()=>{
  const root=new THREE.Group();root.add(box(1.6,.8));const shadow=box(20,0);shadow.name='blobShadow';root.add(shadow);
  expect(standingBodyFootprint(root)!.maxXM).toBeCloseTo(.15);expect(standingBodyFootprint(null)).toBeUndefined();
 });
});
