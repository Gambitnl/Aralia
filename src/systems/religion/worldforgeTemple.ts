/** Gives a town's main physical temple the faith already generated for its
 * settlement. The living office record supplies clergy, never magical skills,
 * prices, attendance or a replacement for someone's personal beliefs. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 22:28:58
 * Dependents: components/World3D/World3DWrapper.tsx, components/World3D/templeDedication.tsx, systems/social/npcInstitutionStatements.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {DiscoveryType, type DiscoveryEntry} from '../../types';
import {getBridgeAtlas} from '../worldforge/bridge/legacySubmapBridge';
import {canonicalArtifactTownForSiteFromAtlas} from '../worldforge/town/canonicalTown';
import {institutionPlotForRole} from '../worldforge/townsim/keyNpcs';
import type {TownLifeState} from '../worldforge/roster/agentLife';

export interface WorldforgeTempleIdentity {
  sourceId: string;
  worldSeed: number;
  burgId: number;
  plotId: number;
  cellId: number;
  townName: string;
  faith: {id: number; name: string; type: string; form: string; deity: string | null};
  clergy?: {occupantId: number; name: string};
}

export interface TempleDedicationReading {
  identity: WorldforgeTempleIdentity;
  entry: Omit<DiscoveryEntry, 'timestamp' | 'isRead'>;
}

export function resolveWorldforgeTempleIdentity(worldSeed: number, burgId: number, plotId: number,
  day: number, life: TownLifeState | undefined): WorldforgeTempleIdentity | undefined {
  if (![worldSeed, burgId, plotId, day].every(Number.isSafeInteger) || burgId <= 0 || plotId < 0) return undefined;
  // A faith belongs to a real physical temple. Do not identify today's main
  // temple as an older saved building while that town's layout is unresolved.
  if (life && life.layoutRevision === undefined) return undefined;
  try {
    const atlas = getBridgeAtlas(worldSeed), burg = atlas.pack.burgs?.[burgId];
    if (!burg || burg.i !== burgId || burg.removed || !Number.isSafeInteger(burg.cell)
      || typeof burg.name !== 'string' || !burg.name.trim()) return undefined;
    const faithId = atlas.pack.cells.religion?.[burg.cell];
    if (typeof faithId !== 'number' || !Number.isSafeInteger(faithId) || faithId <= 0) return undefined;
    const religion = atlas.pack.religions?.[faithId];
    if (!religion || religion.i !== faithId || religion.removed
      || typeof religion.name !== 'string' || !religion.name.trim()
      || typeof religion.form !== 'string' || !religion.form.trim()
      || !['Folk', 'Organized', 'Cult', 'Heresy'].includes(religion.type)) return undefined;
    const {plan} = canonicalArtifactTownForSiteFromAtlas(atlas, worldSeed, {
      burgId, envelope:{x:0,y:0,width:0,height:0}, gates:[],
    }, life?.layoutRevision);
    const temple = institutionPlotForRole(plan, 'priest');
    if (!temple || temple.id !== plotId || temple.role !== 'temple' || temple.pop?.residential === true
      || plan.plots.filter(plot => plot.id === plotId).length !== 1) return undefined;

    // A disputed or missing office stays unknown. Do not select a nearby adult,
    // reuse a deceased priest or manufacture a new person to fill the directory.
    const holders = Object.values(life?.villagers ?? {}).filter(person => person.role === 'priest'
      && Number.isFinite(person.bornDay) && person.bornDay <= day
      && (person.diedDay === undefined || Number.isFinite(person.diedDay) && person.diedDay > day));
    const holder = holders.length === 1 ? holders[0] : undefined;
    const clergy = life && holder && Number.isSafeInteger(holder.occupantId) && holder.occupantId > 0
      && life.villagers[holder.occupantId] === holder && typeof holder.name === 'string' && holder.name.trim()
      && Object.values(life.villagers).filter(person => person.occupantId === holder.occupantId).length === 1
      ? {occupantId:holder.occupantId, name:holder.name.trim()} : undefined;
    return {
      sourceId:`world:${worldSeed}:cell:${burg.cell}:building:wf-plot-${burgId}-${plotId}`,
      worldSeed, burgId, plotId, cellId:burg.cell, townName:burg.name.trim(),
      faith:{id:faithId, name:religion.name.trim(), type:religion.type, form:religion.form.trim(),
        deity:typeof religion.deity === 'string' && religion.deity.trim() ? religion.deity.trim() : null},
      ...(clergy ? {clergy} : {}),
    };
  } catch {
    return undefined;
  }
}

/** A reading is dated when performed. Its stable identity includes the actual
 * dedication and listed clergy, so rereading preserves the first account while
 * a later succession can add a new account without rewriting the earlier one. */
export function templeDedicationReading(identity: WorldforgeTempleIdentity,
  gameTime: Date | string): TempleDedicationReading | undefined {
  const time = new Date(gameTime);
  if (!Number.isFinite(time.getTime())) return undefined;
  const faith = identity.faith;
  const snapshot = JSON.stringify([faith.id, faith.name, faith.type, faith.form, faith.deity,
    identity.clergy?.occupantId ?? null, identity.clergy?.name ?? null]);
  const content = `At the temple in ${identity.townName}, the dedication names ${identity.faith.name}.`
    + ` The recorded tradition is ${identity.faith.form.toLowerCase()}.`
    + (identity.faith.deity ? ` It names ${identity.faith.deity} as an associated deity.` : '')
    + (identity.clergy ? ` The temple lists ${identity.clergy.name} as its priest.` : '');
  return {identity, entry:{
    id:`temple-dedication:${identity.sourceId}:${encodeURIComponent(snapshot)}`,
    gameTime:time.toISOString(), type:DiscoveryType.LORE_DISCOVERY,
    title:`Temple dedication: ${identity.faith.name}`, content,
    source:{type:'LOCATION',id:identity.sourceId,name:`Temple in ${identity.townName}`},
    flags:[{key:'knowledgeKind',value:'temple-dedication',label:'Temple dedication'},
      {key:'religionId',value:identity.faith.id,label:identity.faith.name},
      {key:'buildingId',value:`wf-plot-${identity.burgId}-${identity.plotId}`,label:'Main temple'},
      ...(identity.clergy ? [{key:'clergyOccupantId',value:identity.clergy.occupantId,label:identity.clergy.name}] : [])],
    isQuestRelated:false, associatedLocationId:`cell_${identity.cellId}`,
  }};
}

/** Discussion starts from a real retained reading, not merely standing near a
 * temple. An earlier clergy listing remains historical after succession. The
 * current faith must still match; changed or malformed lore is not rewritten. */
export function findRetainedTempleDedication(entries:readonly DiscoveryEntry[],identity:WorldforgeTempleIdentity,
  gameTime:Date|string):DiscoveryEntry|undefined {
  const now=Number(new Date(gameTime));
  if (!Array.isArray(entries) || !Number.isFinite(now)) return undefined;
  const prefix='temple-dedication:'+identity.sourceId+':';
  const faith=identity.faith;
  let latest:DiscoveryEntry|undefined;
  for (const entry of entries) {
    if (!entry || typeof entry.id!=='string' || !entry.id.startsWith(prefix)
      || entry.type!==DiscoveryType.LORE_DISCOVERY || !Array.isArray(entry.flags)
      || entry.source?.type!=='LOCATION' || entry.source.id!==identity.sourceId
      || entry.associatedLocationId!==`cell_${identity.cellId}`
      || !Number.isFinite(Number(new Date(entry.gameTime))) || Number(new Date(entry.gameTime))>now) continue;
    try {
      const recorded=JSON.parse(decodeURIComponent(entry.id.slice(prefix.length))) as unknown[];
      if (!Array.isArray(recorded) || recorded.length!==7
        || JSON.stringify(recorded.slice(0,5))!==JSON.stringify([faith.id,faith.name,faith.type,faith.form,faith.deity])) continue;
      const noClergy=recorded[5]===null&&recorded[6]===null;
      if (!noClergy && !(Number.isSafeInteger(recorded[5])&&Number(recorded[5])>0
        && typeof recorded[6]==='string'&&recorded[6].trim()===recorded[6]&&!!recorded[6])) continue;
      const historical={...identity,clergy:noClergy?undefined:{occupantId:Number(recorded[5]),name:String(recorded[6])}};
      const expected=templeDedicationReading(historical,entry.gameTime)?.entry;
      if (!expected || expected.id!==entry.id || expected.content!==entry.content || expected.title!==entry.title
        || !expected.flags?.every(flag=>entry.flags!.filter((known:{key?:unknown;value?:unknown}|null|undefined)=>known?.key===flag.key&&known?.value===flag.value).length===1)) continue;
      if (!latest || Number(new Date(entry.gameTime))>Number(new Date(latest.gameTime))) latest=entry;
    } catch { /* An old or damaged account remains readable, but grants no topic. */ }
  }
  return latest;
}
