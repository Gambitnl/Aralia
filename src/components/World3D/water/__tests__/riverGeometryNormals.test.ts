/** The faster native path must reproduce Three's normals, including Float32
 * accumulation, collapsed faces and layouts handled by its generic fallback. */
import {describe,expect,it} from 'vitest';
import * as THREE from 'three/webgpu';
import {updateWaterGeometryNormals} from '../riverGeometryNormals';
function compare(g:THREE.BufferGeometry){
 const expected=g.clone();expected.computeVertexNormals();updateWaterGeometryNormals(g);
 expect(g.getAttribute('normal').array).toEqual(expected.getAttribute('normal').array);
 expect(g.getAttribute('position').array).toEqual(expected.getAttribute('position').array);
 expect(g.index?.array).toEqual(expected.index?.array);
}
describe('native water normal rebuilding',()=>{
 it('matches moving indexed meshes exactly while retaining normal buffer identity',()=>{
  const g=new THREE.PlaneGeometry(7,11,24,40),normal=g.getAttribute('normal') as THREE.BufferAttribute,position=g.getAttribute('position');
  for(let frame=0;frame<16;frame++){
   for(let i=0;i<position.count;i++)position.setZ(i,Math.sin(i*.37+frame*.13)*.7);
   const version=normal.version;compare(g);expect(g.getAttribute('normal')).toBe(normal);expect(normal.version).toBe(version+1);
  }
 });
 it('preserves isolated vertices, zero-area faces and repeated indices',()=>{
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,2,2,2],3));
  g.setIndex(new THREE.Uint32BufferAttribute([0,1,2,0,0,1,1,2,2],1));g.computeVertexNormals();compare(g);
 });
 it('falls back for missing normals and nonindexed or interleaved positions',()=>{
  const base=new THREE.PlaneGeometry(2,3,3,4);base.deleteAttribute('normal');compare(base);
  compare(base.toNonIndexed());
  const packed=new THREE.PlaneGeometry(2,3,3,4),source=packed.getAttribute('position');
  const interleaved=new THREE.InterleavedBuffer(new Float32Array(source.count*4),4);
  const p=new THREE.InterleavedBufferAttribute(interleaved,3,0);for(let i=0;i<source.count;i++)p.setXYZ(i,source.getX(i),source.getY(i),source.getZ(i));
  packed.setAttribute('position',p);compare(packed);
 });
 it('preserves normalized attribute behavior through Three fallback',()=>{
  const g=new THREE.PlaneGeometry(2,3,3,4);
  g.setAttribute('normal',new THREE.Int16BufferAttribute(new Int16Array(g.getAttribute('position').count*3),3,true));compare(g);
 });
});
