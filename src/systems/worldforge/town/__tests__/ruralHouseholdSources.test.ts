/** Rural population markers must not become hundreds of children in one house. */
import {describe,it,expect} from 'vitest';
import {assignTownPopulation} from '../population';
import {generateTownPlan,scaleProfile,type TownOutskirt} from '../townEngine';
import {generateHousehold} from '../household';
import {assignFarmCrops,cropForFarmParcel} from '../farmCrops';
import {rootSeedPath} from '../../seedPath';
const seed=rootSeedPath(42);
const parcels:TownOutskirt[]=[
 {kind:'farm',polygon:[[0,0],[100,0],[100,100],[0,100]]},
 {kind:'farm',polygon:[[200,0],[300,0],[300,100],[200,100]]},
];
function population(n:number,ruralHouseholdSources?:boolean){
 return assignTownPopulation({plots:[],farmParcels:parcels,population:n,profile:scaleProfile(n),townCenter:[150,50],townSpan:300,seedPath:seed,ruralHouseholdSources});
}
describe('explicit rural household sources',()=>{
 it.each([900,4200,120000])('preserves the population and locations while sizing one family at %s people',n=>{
  const old=population(n),fresh=population(n,true);
  expect(fresh.demographics).toEqual(old.demographics);
  expect(fresh.demographics.accounted).toBe(n);
  expect(fresh.farmsteads.map(({id,x,y})=>({id,x,y}))).toEqual(old.farmsteads.map(({id,x,y})=>({id,x,y})));
  expect(fresh.farmsteads.reduce((sum,f)=>sum+f.representedPopulation!,0)).toBe(fresh.demographics.rural);
  for(const [i,farm]of fresh.farmsteads.entries()){
   expect(farm.farmParcelIndex).toBe(i%parcels.length);
   expect(farm.occupants).toBeGreaterThanOrEqual(1);expect(farm.occupants).toBeLessThanOrEqual(8);
   expect(farm.occupants).toBeLessThanOrEqual(farm.representedPopulation!);
   const family=generateHousehold(seed,farm.id,farm.occupants,'farmstead');
   expect(family.members).toHaveLength(farm.occupants);
   expect(family.occupation).toBe('farmer');
  }
  expect(old.farmsteads.every(f=>!Object.hasOwn(f,'farmParcelIndex')&&!Object.hasOwn(f,'representedPopulation'))).toBe(true);
  expect(population(n,false)).toEqual(old);
 });
 it('demonstrates the capital marker count is not a household size',()=>{
  const old=population(120000),fresh=population(120000,true);
  expect(Math.max(...old.farmsteads.map(f=>f.occupants))).toBeGreaterThan(100);
  expect(new Set(fresh.farmsteads.map(f=>f.occupants)).size).toBeGreaterThan(1);
 });
 it('joins field crops by source identity rather than current distance or order',()=>{
  const farms=[{id:'f0',x:250,y:50,farmParcelIndex:0},{id:'f1',x:50,y:50,farmParcelIndex:1},{id:'f2',x:10000,y:10000,farmParcelIndex:0}];
  const crops=assignFarmCrops(seed,farms,[{kind:'pasture',polygon:parcels[0].polygon},...parcels]);
  expect(crops.cropByParcel.get(1)).toBe(cropForFarmParcel(seed,0));
  expect(crops.cropByParcel.get(2)).toBe(cropForFarmParcel(seed,1));
  expect(crops.cropByParcel.has(0)).toBe(false);
  expect(crops.cropByFarmstead.get('f0')).toBe(crops.cropByFarmstead.get('f2'));
  expect(assignFarmCrops(seed,[...farms].reverse(),[{kind:'pasture',polygon:parcels[0].polygon},...parcels])).toEqual(crops);
  expect(assignFarmCrops(seed,[farms[2]],parcels).cropByFarmstead.get('f2')).toBe(crops.cropByFarmstead.get('f2'));
 });
 it.each([-1,0.5,NaN,2])('refuses invalid explicit field %s instead of borrowing the nearest',farmParcelIndex=>{
  expect(()=>assignFarmCrops(seed,[{id:'f',x:50,y:50,farmParcelIndex}],parcels)).toThrow('unavailable source parcel');
 });
 it('does not shift source ordinals past a malformed earlier farm parcel',()=>{
  const broken=[{kind:'farm',polygon:[]},parcels[1]];
  const valid=assignFarmCrops(seed,[{id:'f',x:0,y:0,farmParcelIndex:1}],broken);
  expect(valid.cropByParcel.get(1)).toBe(cropForFarmParcel(seed,1));
  expect(()=>assignFarmCrops(seed,[{id:'f',x:250,y:50,farmParcelIndex:0}],broken)).toThrow('unavailable source parcel');
 });
 it('round-trips source identities, household sizes and accounting through JSON',()=>{
  const out=population(4200,true),restored=JSON.parse(JSON.stringify(out));
  expect(restored).toEqual(out);
  expect(assignFarmCrops(seed,restored.farmsteads,parcels)).toEqual(assignFarmCrops(seed,out.farmsteads,parcels));
 });
 it.each([900,4200])('threads explicit sources through both town forms at %s',n=>{
  const footprint:[[number,number],[number,number],[number,number],[number,number]]=[[0,0],[1000,0],[1000,1000],[0,1000]];
  const old=generateTownPlan(footprint,seed,{population:n});
  const fresh=generateTownPlan(footprint,seed,{population:n,ruralHouseholdSources:true});
  expect(fresh.wards).toEqual(old.wards);expect(fresh.demographics).toEqual(old.demographics);
  expect(fresh.farmsteads.length).toBeGreaterThan(0);
  expect(fresh.farmsteads.every(f=>f.farmParcelIndex!==undefined&&f.occupants<=8)).toBe(true);
 });
});
