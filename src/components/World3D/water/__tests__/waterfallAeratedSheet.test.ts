import {describe,it,expect} from 'vitest';
import {aeratedFraction,aeratedSection,aeratedOpticalBudget,aeratedTransfer,aeratedDebit,aeratedLocalSection} from '../waterfallAeratedSheet';
import {materialSheetTrajectory,materialSheetSection} from '../waterfallMaterialSheet';
describe('optional connected secondary water',()=>{
 it('keeps the exact crest clear and partitions liquid without creating volume',()=>{
  for(const q of [.5,1.5,12,120])for(const age of [0,.3,.7,1.3,2.5,3.8])for(const emission of [19.1,19.37,20.12]){
   const fraction=aeratedFraction(age,emission,6);expect(fraction).toBeGreaterThanOrEqual(0);expect(fraction).toBeLessThanOrEqual(.85);
   if(age<=.35)expect(fraction).toBe(0);
   const total=q*.013;expect(total*(1-fraction)+total*fraction).toBeCloseTo(total,13);
  }
 });
 it('accounts polygon liquid fraction and stays finite across low and flood-scale sections',()=>{
  for(const area of [0,.0001,.05,2,20])for(const width of [3,6,10])for(const age of [.4,1,3.8]){
   const s=aeratedSection(area,width,age,19.37);expect(s.fraction).toBeGreaterThanOrEqual(0);expect(s.fraction).toBeLessThanOrEqual(1+1e-12);
   expect(s.area*s.fraction).toBeCloseTo(area,10);
   let signed=0;for(let k=0;k<s.across.length;k++){const next=(k+1)%s.across.length;signed+=s.across[k]*s.normal[next]-s.across[next]*s.normal[k];}
   expect(signed).toBeGreaterThan(0);expect([...s.across,...s.normal].every(Number.isFinite)).toBe(true);
  }
 });
 it('carries contours with emission labels while the same parcel grows and moves outward',()=>{
  const early=aeratedSection(.01,10,.8,18),late=aeratedSection(.01,10,2.8,18),next=aeratedSection(.01,10,2.8,18.1875);
  expect(Math.max(...late.normal)-Math.min(...late.normal)).toBeGreaterThan(Math.max(...early.normal)-Math.min(...early.normal));
  expect(late.normal.reduce((a,x,k)=>a+Math.abs(x-next.normal[k]),0)).toBeGreaterThan(.5);
  const trajectory=materialSheetTrajectory(2.8,3.8,.7,78,12/7);
  const outward=Math.abs(trajectory.yDerivative/trajectory.arcSpeed*late.normal[16]);expect(outward).toBeGreaterThan(.4);
 });
 it('has conservative local reflection/transmission limits, not additive white gain',()=>{
  for(const tau of [0,.000001,1,1000])for(const albedo of [0,.3,1]){const b=aeratedOpticalBudget(tau,albedo);expect(b.reflection+b.transmission+b.absorption).toBeCloseTo(1,14);expect(Math.min(...Object.values(b))).toBeGreaterThanOrEqual(-1e-15);}
  expect(aeratedOpticalBudget(0,1)).toEqual({transmission:1,reflection:0,absorption:0});expect(aeratedOpticalBudget(1000,1).reflection).toBe(1);
 });
 it('allows neighboring material columns to form independently of the central column',()=>{
  let centerDrySideWet=0,nonuniform=0;
  for(let j=0;j<120;j++){const age=.8+j*.025,transfer=aeratedTransfer(age,20-age,10);
   expect([...transfer].every(f=>Number.isFinite(f)&&f>=0&&f<=.85)).toBe(true);
   if(transfer[4]===0&&Math.max(...transfer)>0)centerDrySideWet++;
   if(Math.max(...transfer)-Math.min(...transfer)>.1)nonuniform++;
  }
  expect(centerDrySideWet).toBeGreaterThan(10);expect(nonuniform).toBeGreaterThan(80);
  expect([...aeratedTransfer(0,20,10)]).toEqual(Array(9).fill(0));
 });
 it('debits local core columns and integrates nonuniform fog phi independently',()=>{
  for(const area of [.001,.05,2,20])for(const age of [.4,1.2,3.8]){
   const original=materialSheetSection(area,6,age,19.37),transfer=aeratedTransfer(age,19.37,6),debit=aeratedDebit(original,transfer);
   expect(debit.coreArea+debit.removedArea).toBeCloseTo(area,10);
   const fog=aeratedLocalSection(original,debit.removed,transfer,.37,6,age,19.37),half=fog.across.length/2;
   let integral=0;for(let i=0;i<half;i++){
    const left=half-i,right=half-i-1,lowerLeft=(fog.across.length-left)%fog.across.length,lowerRight=(fog.across.length-right)%fog.across.length;
    const dx=fog.across[right]-fog.across[left],h0=fog.normal[left]-fog.normal[lowerLeft],h1=fog.normal[right]-fog.normal[lowerRight],p0=fog.phi[left],p1=fog.phi[right];
    // Simpson integration is independent of the deposit's nodal-area formula.
    integral+=dx/6*(p0*h0+4*(p0+p1)*.5*(h0+h1)*.5+p1*h1);
   }
   expect(integral).toBeCloseTo(debit.removedArea*.37,10);
   expect([...fog.phi].every(p=>Number.isFinite(p)&&p>=0&&p<=1+1e-12)).toBe(true);
  }
 });
 it('preserves exact local empty support instead of introducing a fog density floor',()=>{
  const section=materialSheetSection(.4,10,2,19),transfer=new Float64Array(9);transfer[2]=.8;
  const debit=aeratedDebit(section,transfer),fog=aeratedLocalSection(section,debit.removed,transfer,.5,10,2,19);
  expect(fog.phi.filter(x=>x===0).length).toBeGreaterThan(20);
  expect(Math.max(...fog.phi)).toBeGreaterThan(0);
  const dry=materialSheetSection(.4,10,2,19),none=aeratedDebit(dry,new Float64Array(9)),empty=aeratedLocalSection(dry,none.removed,new Float64Array(9),.5,10,2,19);
  expect([...empty.phi]).toEqual(Array(64).fill(0));expect(none.coreArea).toBeCloseTo(.4,12);
 });
});
