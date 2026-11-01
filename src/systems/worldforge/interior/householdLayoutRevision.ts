/** Explicit saved household layout revision over an immutable observation.
 * A frozen plan is validated and read, never regenerated from a later recipe.
 * Original goods, household and qualified door keys remain historical facts.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 22:45:21
 * Dependents: state/reducers/townReducer.ts, systems/worldforge/interior/buildingSource.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {BlueprintPlan} from './blueprintTypes';
import type {Household} from '../town/household';
import type {ContainerManifest} from './manifests';
import {buildingPlanSignature, type BuildingSourcePosition} from './buildingSource';
import {householdLivingGeometryIssues, type HouseholdLivingProposal} from './householdLivingPlan';
import {proposeHouseholdLayoutReferences, type HouseholdLayoutReferenceChanges, type HouseholdLayoutReferences} from './householdLayoutReferences';

export interface HouseholdLayoutRevision {
 version:1; recipe:'shared-hall-cottage-v1';
 sourceSignature:string; planSignature:string; plan:BlueprintPlan;
 referenceChanges:HouseholdLayoutReferenceChanges;
 references:HouseholdLayoutReferences;
 admittedAt:string; position:BuildingSourcePosition;
}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const fail=()=>{throw new Error('The recorded household layout no longer preserves its original source and references.');};

/** Frozen coordinates remain authoritative. Recheck permitted structural intent,
 * physical fit and original joins; do not call the household or roof generator.
 * The first admitted family is the played modest shared hall. Rich private-door
 * changes still require a deliberate policy rather than inheriting this one.
 */
export function validateHouseholdLayoutRevision(before:BlueprintPlan,household:Household,
 manifests:readonly ContainerManifest[],revision:HouseholdLayoutRevision):void{
 const plan=revision.plan,old=before.floors.find(f=>f.level===0),floor=plan.floors.find(f=>f.level===0);
 if(revision.version!==1||revision.recipe!=='shared-hall-cottage-v1'
   ||revision.sourceSignature!==buildingPlanSignature(before)||revision.planSignature!==buildingPlanSignature(plan)
   ||!Number.isFinite(Date.parse(revision.admittedAt))||!['tileX','tileY','xM','zM','yM'].every(k=>Number.isFinite(revision.position[k as keyof BuildingSourcePosition]))
   ||before.type!=='cottage'||before.widthFt!==25||before.depthFt!==15||!old||!floor
   ||before.floors.length!==1||plan.floors.length!==1||!before.household||before.household.homeId!==household.homeId
   ||before.household.worksAtHome||before.household.residential===false||before.household.wealth==='wealthy'
   ||before.ensemble?.partyWallLeft||before.ensemble?.partyWallRight||before.liveHistory?.features.length
   ||before.household.slots.length<2||before.household.slots.length>4
   ||before.household.slots.some(s=>!['head','spouse','child'].includes(s.role)))fail();
 // The narrow correction changes floor layout and retargets identical history
 // surfaces; shell/land/roof/culture/household/history facts stay byte-equivalent.
 const fixed=(p:BlueprintPlan)=>{const {floors,backstory,...rest}=p;return rest;};
 const floorFixed=(f:NonNullable<typeof floor>)=>{const {rooms,doors,walls,wallRuns,furnishings,...rest}=f;return rest;};
 if(!same(fixed(before),fixed(plan))||!same(floorFixed(old!),floorFixed(floor!))
   ||floor!.rooms.length!==2||floor!.doors.length!==2
   ||floor!.rooms.find(r=>r.id===0)?.purpose!=='hall'||floor!.rooms.find(r=>r.id===2)?.purpose!=='kitchen')fail();
 const expectedChanges:HouseholdLayoutReferenceChanges={publicRoomMerges:[{level:0,fromRoomId:1,toRoomId:0}],
   entranceRelocations:[{level:0,fromIndex:old!.doors.findIndex(d=>d.isEntry),toIndex:1}]};
 if(!same(revision.referenceChanges,expectedChanges))fail();
 // Rooms still partition the original floor: no duplicated cells, invented
 // yard area or bounding-box shortcuts can make a furniture route pass.
 const cells=floor!.rooms.flatMap(r=>r.cells.map(c=>c.cx+':'+c.cy));
 const footprint=before.footprintCells.map(c=>c.cx+':'+c.cy);
 if(cells.length!==footprint.length||new Set(cells).size!==cells.length||cells.some(c=>!footprint.includes(c)))fail();
 const backstory=structuredClone(plan.backstory);
 if(backstory)for(const [i,feature]of backstory.features.entries())if('wallRunIndex'in feature){
   const original=before.backstory?.features[i];
   if(!original||!('wallRunIndex'in original)||feature.floorLevel!==original.floorLevel)fail();
   const a=old!.wallRuns[(original as typeof feature).wallRunIndex],b=floor!.wallRuns[feature.wallRunIndex];
   if(!a||!b||!same(a,b))fail();
   feature.wallRunIndex=(original as typeof feature).wallRunIndex;
 }
 if(!same(backstory,before.backstory)||householdLivingGeometryIssues(plan).length)fail();
 const refs=proposeHouseholdLayoutReferences(before,plan,household,manifests,revision.referenceChanges);
 if(refs.issues.length||!same(refs,revision.references))fail();
}

/** Build a reviewable frozen receipt. Position/source/mounted checks remain the
 * reducer's responsibility; this helper cannot move actors or write a save. */
export function freezeHouseholdLayoutRevision(before:BlueprintPlan,household:Household,
 manifests:readonly ContainerManifest[],proposal:HouseholdLivingProposal,
 admittedAt:string,position:BuildingSourcePosition):HouseholdLayoutRevision{
 if(proposal.recipe!=='shared-hall-cottage-v1'||proposal.issues.length||!proposal.referenceChanges)fail();
 const revision:HouseholdLayoutRevision={version:1,recipe:'shared-hall-cottage-v1',sourceSignature:buildingPlanSignature(before),
   planSignature:buildingPlanSignature(proposal.plan),plan:structuredClone(proposal.plan),
   referenceChanges:structuredClone(proposal.referenceChanges!),
   references:proposeHouseholdLayoutReferences(before,proposal.plan,household,manifests,proposal.referenceChanges),
   admittedAt,position:{...position}};
 validateHouseholdLayoutRevision(before,household,manifests,revision);
 return revision;
}

/** Retain every old key, including the merged opening and unknown legacy keys.
 * Only a single unambiguous alias inherits state. An occupied conflicting key
 * refuses the entire transaction rather than overwriting another door. */
export function householdLayoutDoorStates(revision:HouseholdLayoutRevision,
 previous:Readonly<Record<string,boolean>>={}):Record<string,boolean>{
 const next={...previous};
 for(const door of revision.references.doors){
   if(door.status==='merged-opening'&&door.to.length===0)continue;
   if(door.status!=='aliased'||door.to.length!==1)fail();
   if(!Object.hasOwn(previous,door.from))continue;
   const target=door.to[0],value=previous[door.from];
   if(Object.hasOwn(next,target)&&next[target]!==value)throw new Error('Conflicting household door state.');
   next[target]=value;
 }
 return next;
}
