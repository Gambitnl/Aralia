/**
 * Residents locate their own town, registered public workplace and mapped
 * public gates from the canonical map. These factual answers do not grant a
 * visit, a travel route, opening hours or safe passage.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 22:01:54
 * Dependents: services/dialogueService.ts, systems/social/npcInstitutionStatements.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '../../types/state';
import type { NPC, RichNPC } from '../../types/world';
import { getBridgeAtlas } from '../worldforge/bridge/legacySubmapBridge';
import { burgIdForLocation } from '../worldforge/townsim/chronicleForLocation';
import { householdNpcAliveAt, householdFamilyAt, householdInstitutionRole } from '../worldforge/townsim/householdNpc';
import { canonicalArtifactTownForSiteFromAtlas, townSpanFtForBurg } from '../worldforge/town/canonicalTown';
import { polygonCentroid } from '../worldforge/submap/submapEngine';
import { getGameDay } from '../../utils/core';
import { institutionPlotForRole } from '../worldforge/townsim/keyNpcs';
import { bearingToDirection } from './navDrift';

const sectors = { N: 'northern', NE: 'northeastern', E: 'eastern', SE: 'southeastern',
  S: 'southern', SW: 'southwestern', W: 'western', NW: 'northwestern' } as const;

export function resolveNpcLocalDirections(state: GameState, npc: NPC): string | undefined {
  const resident = state.generatedNpcs?.[npc.id] as (RichNPC & {
    worldforgeHousehold?: { burgId: number; memberId: string; legacyNameUnique?: boolean };
  }) | undefined;
  const identity = resident?.worldforgeHousehold;
  if (!resident || resident.name !== npc.name || !identity || !Number.isInteger(identity.burgId)
      || !identity.memberId || !householdNpcAliveAt(resident, state.townSim, getGameDay(state.gameTime))) return undefined;
  // An authored refusal, secret or willingness rule remains authoritative.
  if (resident.knowledgeProfile?.topicOverrides?.global_directions
      || npc.knowledgeProfile?.topicOverrides?.global_directions) return undefined;
  const cell = state.playerCell?.cellId;
  if (cell == null || state.currentLocationId !== `cell_${cell}`
      || burgIdForLocation({ worldSeed: state.worldSeed, cellId: cell, ground: state }) !== identity.burgId) return undefined;
  const atlas = getBridgeAtlas(state.worldSeed), burg = atlas.pack.burgs?.[identity.burgId];
  if (!burg || burg.removed || burg.cell !== cell || !burg.name?.trim()) return undefined;
  const location = `You're in ${burg.name.trim()}.`;
  // The atlas still names the town, but an established unversioned layout
  // cannot supply trustworthy building directions until source admission.
  const savedTown = state.townSim?.[identity.burgId];
  if (savedTown && savedTown.layoutRevision === undefined) return location;
  const owned = Object.values(state.worldBusinesses ?? {}).filter(b => b.ownerId === resident.id);
  const business = resident.businessId ? owned.find(b => b.id === resident.businessId)
    : owned.length === 1 ? owned[0] : undefined;
  if (!business?.name?.trim() || business.burgId !== identity.burgId || business.locationId !== state.currentLocationId
      || !Number.isInteger(business.plotId)) {
    const temple=priestTempleLocation(state,resident,identity,atlas);
    const gates=temple ? undefined : publicGateLocations(state,identity,atlas);
    return temple ? location+' '+temple : gates ? location+' '+gates : location;
  }

  // The map and ground share this north-up source plan. A zero translation
  // retains its compass sectors; no new town, home or route is generated here.
  const { plan } = canonicalArtifactTownForSiteFromAtlas(atlas, state.worldSeed, {
    burgId: identity.burgId, envelope: { x: 0, y: 0, width: 0, height: 0 }, gates: [],
  }, state.townSim?.[identity.burgId]?.layoutRevision);
  const plot = plan.plots.find(p => p.id === business.plotId);
  if (!plot || !['market', 'workshop'].includes(plot.role) || !plot.pop?.buildingType
      || plot.pop.residential !== false || plot.pop.proprietorHomeId !== identity.memberId.split(':')[0]
      || plot.footprint.length < 3 || plot.footprint.some(p => !p.every(Number.isFinite))) return location;
  const [x, y] = polygonCentroid(plot.footprint);
  const span = townSpanFtForBurg(atlas, identity.burgId);
  if (!Number.isFinite(span) || span <= 0) return location;
  const area = Math.hypot(x, y) <= span * 0.12 ? 'near the town center'
    : `in the ${sectors[bearingToDirection(x, y)]} part of town`;
  // Use the fitted public building type, not a legacy ledger's trade category.
  // A taverner's old enchanter stock does not turn their tavern into a new shop.
  return `${location} ${business.name.trim()} is my ${plot.pop.buildingType.replaceAll('-', ' ')}, ${area}.`;
}

/** A resident without a verified workplace still knows the marked public ways
 * out of their own town. Keep the map's gate numbers and north-up source; this
 * locates gates without promising an open leaf, a safe crossing or admission. */
function publicGateLocations(state:GameState,identity:{burgId:number},atlas:ReturnType<typeof getBridgeAtlas>):string|undefined {
  const {plan}=canonicalArtifactTownForSiteFromAtlas(atlas,state.worldSeed,{
    burgId:identity.burgId,envelope:{x:0,y:0,width:0,height:0},gates:[],
  },state.townSim?.[identity.burgId]?.layoutRevision);
  const gates=plan.gates??[];
  if(!gates.length||gates.some(p=>p.length!==2||!p.every(Number.isFinite)||Math.hypot(...p)===0)
    ||new Set(gates.map(p=>p.join(','))).size!==gates.length)return undefined;
  return gates.map(([x,y],index)=>`Gate ${index+1} is in the ${sectors[bearingToDirection(x,y)]} part of town.`).join(' ');
}

/** The current priest can locate the town's source temple without inventing a
 * business ledger or promising to be there now. Succession and canonical plot
 * selection use the same life/plan owners as the existing civic duty projection. */
function priestTempleLocation(state:GameState,resident:RichNPC,identity:{burgId:number;memberId:string;legacyNameUnique?:boolean},atlas:ReturnType<typeof getBridgeAtlas>):string|undefined {
  const town=state.townSim?.[identity.burgId],day=getGameDay(state.gameTime);
  if (!town) return undefined;
  const family=householdFamilyAt(town,identity.memberId,resident.name,day,identity.legacyNameUnique);
  if (!family || householdInstitutionRole(family.person,day)!=='priest') return undefined;
  // A disputed office is unresolved; neither the nearest person nor founding
  // biography is allowed to choose a holder for this conversation.
  const holders=Object.values(town.villagers).filter(p=>p.role==='priest'
    && Number.isFinite(p.bornDay) && p.bornDay<=day
    && (p.diedDay===undefined || Number.isFinite(p.diedDay)&&p.diedDay>day));
  if (holders.length!==1 || holders[0]!==family.person) return undefined;
  const {plan}=canonicalArtifactTownForSiteFromAtlas(atlas,state.worldSeed,{
    burgId:identity.burgId,envelope:{x:0,y:0,width:0,height:0},gates:[],
  }, state.townSim?.[identity.burgId]?.layoutRevision);
  const plot=institutionPlotForRole(plan,'priest');
  if (!plot || plan.plots.filter(p=>p.id===plot.id).length!==1 || plot.role!=='temple'
    || plot.pop?.residential===true || plot.footprint.length<3
    || plot.footprint.some(p=>p.length!==2 || !p.every(Number.isFinite))) return undefined;
  const [x,y]=polygonCentroid(plot.footprint),span=townSpanFtForBurg(atlas,identity.burgId);
  if (![x,y,span].every(Number.isFinite) || span<=0) return undefined;
  const area=Math.hypot(x,y)<=span*.12?'near the town center':'in the '+sectors[bearingToDirection(x,y)]+' part of town';
  return 'The temple is '+area+'.';
}
