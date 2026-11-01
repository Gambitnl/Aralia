/** Validate the actual closed ledge geometry; swept motion is exercised on GPU. */
import { describe, expect, it } from 'vitest';
import { createFlipConvexContact } from '../flipConvexContact';
const params = { n: 112, dx: .25, count: 8, origin: [-2, 50, -14] as [number, number, number] };
const vertices: [number, number, number][] = [[-.5,61.36,-12],[8,55.835,-12],[8,61.115,12],[-.5,66.64,12],[-.5,58.86,-12],[8,53.335,-12],[8,58.615,12],[-.5,64.14,12]];
const triangles: [number,number,number][] = [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
describe('closed convex ledge boundary', () => {
 it('derives six outward planes from the finite source mesh with vertical thickness', () => {
  const solid=createFlipConvexContact(params,'actual-first-ledge',vertices,triangles);
  expect(solid.planes).toHaveLength(6);
  const inside=(world:number[])=>solid.planes.every(f=>f.normal.reduce((s,n,a)=>s+n*((world[a]-params.origin[a])/params.dx-f.point[a]),0)<=1e-10);
  expect(inside([0,63,0])).toBe(true);
  expect(inside([0,64,0])).toBe(false);
  expect(inside([0,60,0])).toBe(false);
  expect(inside([9,57,0])).toBe(false);
  for(const f of solid.planes)expect(Math.hypot(...f.normal)).toBeCloseTo(1,12);
 });
 it('rejects open, warped and degenerate geometry instead of assuming a heightfield', () => {
  expect(()=>createFlipConvexContact(params,'open',vertices,triangles.slice(1))).toThrow(/closed/);
  const dent=vertices.map(v=>[...v] as [number,number,number]);dent[0][1]-=1;
  expect(()=>createFlipConvexContact(params,'dent',dent,triangles)).toThrow(/convex/);
  expect(()=>createFlipConvexContact(params,'bad',vertices,[[0,0,1],...triangles])).toThrow(/Degenerate/);
 });
});
