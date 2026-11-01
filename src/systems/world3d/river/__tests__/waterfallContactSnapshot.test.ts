/** Public inspection records remain editable copies even when the common
 * native parcel layout uses a faster copy path. Extra metadata is retained. */
import {describe,expect,it} from 'vitest';
import {WaterfallContactFlow,type ContactParcel} from '../waterfallContactFlow';
const source={q:1.5,width:10,depth:.7,speed:1.5/7,top:78,pool:18};
function seeded(){const f=new WaterfallContactFlow({startTime:0,dt:1/120,maxStepsPerAdvance:1});f.advanceTo(1/120,()=>source);return f;}
function originalCopy(p:ContactParcel){return {...p,...(p.sourceSupport?{sourceSupport:structuredClone(p.sourceSupport)}:{}),support:p.support?structuredClone(p.support):undefined,releaseLocal:p.releaseLocal?structuredClone(p.releaseLocal):undefined,position:[...p.position],velocity:[...p.velocity],sourceSection:p.sourceSection?{...p.sourceSection}:undefined,sourceRelease:p.sourceRelease?{...p.sourceRelease,start:[...p.sourceRelease.start],end:[...p.sourceRelease.end],velocity:[...p.sourceRelease.velocity]}:undefined,sheetRelease:p.sheetRelease?{...p.sheetRelease,start:[...p.sheetRelease.start],end:[...p.sheetRelease.end],velocity:[...p.sheetRelease.velocity]}:undefined};}
describe('waterfall public snapshot copying',()=>{
 it('preserves all native values, optional field presence and editable vectors',()=>{
  const flow=seeded(),saved=flow.saveState();
  saved.snapshot.parcels[0].motionRevision=3;
  saved.snapshot.parcels[1].sourceSupport=undefined;
  saved.snapshot.parcels[2].sheetRelease=structuredClone(saved.snapshot.parcels[2].sourceRelease!);
  flow.restoreState(saved);
  const before=flow.snapshot();
  expect(before.parcels).toEqual(saved.snapshot.parcels.map(originalCopy));
  const copy=flow.snapshot();
  copy.parcels[0].position[0]+=10;copy.parcels[0].velocity[0]+=10;
  copy.parcels[0].sourceSection!.width+=10;copy.parcels[0].sourceRelease!.end[2]+=10;
  copy.parcels[2].sheetRelease!.start[0]+=10;
  expect(flow.snapshot()).toEqual(before);
 });
 it('retains extension fields rather than narrowing diagnostic records',()=>{
  const flow=seeded(),saved=flow.saveState();
  Object.assign(saved.snapshot.parcels[0],{futureScalar:7,futureRecord:{value:'retained'}});
  flow.restoreState(saved);
  expect(flow.snapshot().parcels).toEqual(saved.snapshot.parcels.map(originalCopy));
 });
 it('keeps older snapshots unchanged while water moves and rewinds',()=>{
  const flow=seeded(),checkpoint=flow.saveTransactionState(),before=flow.snapshot(),expected=structuredClone(before);
  flow.advanceTo(2/120,()=>source);expect(before).toEqual(expected);
  flow.restoreTransactionState(checkpoint);expect(flow.snapshot()).toEqual(expected);
 });
});
