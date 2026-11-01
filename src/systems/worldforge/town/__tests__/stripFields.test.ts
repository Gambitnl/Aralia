/** Agricultural parent identity is candidate-only and never changes strip geometry. */
import {describe,it,expect} from 'vitest';
import {stripFarmParcels} from '../stripFields';
import {rootSeedPath} from '../../seedPath';
import type {TownOutskirt} from '../townEngine';
const parcels:TownOutskirt[]=[{kind:'pasture',polygon:[[0,0],[20,0],[20,20],[0,20]]},{kind:'farm',polygon:[[30,0],[230,0],[230,200],[30,200]]}];
const args={outskirts:parcels,roads:[[[0,-10],[250,-10]] as [number,number][]],center:[120,100] as [number,number],stripWidth:44,roadReach:500,seedPath:rootSeedPath(42)};
describe('field parent source receipts',()=>{
 it('keeps exact legacy strips and nonfarm identity while adding explicit source parents',()=>{
  const old=stripFarmParcels(args),fresh=stripFarmParcels({...args,retainParentParcels:true});
  expect(old.every(p=>!Object.hasOwn(p,'farmParent'))).toBe(true);
  expect(fresh.map(({farmParent,...p})=>p)).toEqual(old);
  expect(fresh[0]).toBe(parcels[0]);
  expect(fresh.filter(p=>p.kind==='farm').length).toBeGreaterThan(1);
  for(const field of fresh.filter(p=>p.kind==='farm'))expect(field.farmParent).toEqual({id:'farm-parent:1',polygon:parcels[1].polygon});
 });
 it('copies parent polygons so a reader cannot alter siblings or input land',()=>{
  const fresh=stripFarmParcels({...args,retainParentParcels:true}).filter(p=>p.kind==='farm');
  expect(fresh[0].farmParent!.polygon).not.toBe(fresh[1].farmParent!.polygon);
  fresh[0].farmParent!.polygon[0][0]=999;
  expect(fresh[1].farmParent!.polygon[0][0]).toBe(30);expect(parcels[1].polygon[0][0]).toBe(30);
 });
});
