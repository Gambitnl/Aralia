/** Pending footsteps belong to the physical journey. Keep corners in order;
 * never replace them with a camera destination or a shortcut after a save. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 08:31:23
 * Dependents: components/World3D/PartyGroundActors.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {CompanionPosition} from '@/systems/companions/companionWhereabouts';
export const MAX_PARTY_TRAIL_POINTS=512;
export const validPartyTrail=(points:unknown):points is CompanionPosition[]=>Array.isArray(points)&&points.length<=MAX_PARTY_TRAIL_POINTS
 &&points.every(p=>p&&[p.xM,p.yM,p.zM].every(Number.isFinite));
const distance=(a:CompanionPosition,b:CompanionPosition)=>Math.hypot(a.xM-b.xM,a.zM-b.zM);
export class PartyGroundTrail {
 private points:CompanionPosition[];
 private lastLeader:CompanionPosition|undefined;
 overflowed=false;
 constructor(saved:readonly CompanionPosition[]=[]){
  this.points=validPartyTrail(saved)?saved.map(p=>({...p})):[];
  this.overflowed=!validPartyTrail(saved);this.lastLeader=this.points.at(-1);
 }
 observe(leader:CompanionPosition){
  if(![leader.xM,leader.yM,leader.zM].every(Number.isFinite)||this.overflowed)return;
  if(this.lastLeader&&distance(this.lastLeader,leader)<.15)return;
  if(this.points.length>=MAX_PARTY_TRAIL_POINTS){this.overflowed=true;return;}
  this.points.push({...leader});this.lastLeader={...leader};
 }
 target(feet:CompanionPosition,gap:number):CompanionPosition|null{
  if(this.overflowed||!Number.isFinite(gap)||gap<0)return null;
  while(this.points.length>1&&distance(feet,this.points[0])<.12)this.points.shift();
  let length=0,previous=feet;
  for(const p of this.points){length+=distance(previous,p);previous=p;}
  return length>gap?this.points[0]??null:null;
 }
 snapshot(){return this.points.map(p=>({...p}));}
 /** Only a real nearby reunion can replace an unavailable trail. */
 reunite(leader:CompanionPosition){this.points=[{...leader}];this.lastLeader={...leader};this.overflowed=false;}
}
