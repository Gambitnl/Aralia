/** Remember actually delivered factual replies and generated exchanges in the NPC's existing interactions.
 * Saved words stay historical when today's accounts change. Stable life provenance
 * keeps a new keeper from claiming an older person's conversation; unknown legacy
 * history is never reconstructed from the global last-response display or model logs.
 * Generated wording is attributed speech, never corroborated world knowledge.
 * Readers can follow an exact saved life across venue packet IDs. They never
 * merge NPCs, facts, relationships, property or inventory; writers keep their
 * strict active-session and full speaker-key checks. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 31/10/2026, 03:11:09
 * Dependents: components/World3D/World3DWrapper.tsx, hooks/actions/handleNpcInteraction.ts, hooks/useDialogueSystem.ts, services/dialogueService.ts, state/reducers/worldReducer.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {GameState} from '../../types/state';
import type {NpcDialoguePublication,NpcWorkDialoguePublication,NpcPersonalDialoguePublication,NpcGeneratedDialoguePublication,NpcInstitutionDialoguePublication,Interaction} from '../../types/memory';
import {householdNpcAliveAt,householdNpcDescription} from '../worldforge/townsim/householdNpc';
import {villagerForResident} from '../worldforge/roster/agentLife';
import {getGameDay} from '../../utils/core';
import {resolveNpcPersonalStatement,type PersonalStatementTopic} from './npcPersonalStatements';
import {createEmptyMemory} from '../../utils/world/memoryUtils';
import {NPCS} from '../../data/world/npcs';
import type {RichNPC,NpcMemory} from '../../types/world';
import {resolveNpcInstitutionStatement} from './npcInstitutionStatements';

/** Household dialogue uses today's admitted life, not the founding biography.
 * Other authored personalities retain their existing voice and facts. Saved
 * biographies, equipment, kinship and offices are never rewritten for a prompt. */
export function currentNpcDialogueProfile(state:GameState,npcId:string):string|undefined {
  const npc=(NPCS[npcId]??state.generatedNpcs?.[npcId]) as RichNPC|undefined;
  if (!npc) return undefined;
  if (!('worldforgeHousehold' in npc)) return npc.initialPersonalityPrompt || undefined;
  const description=householdNpcDescription(npc,state.townSim,getGameDay(state.gameTime));
  if (!description || !npcDialogueSpeakerKey(state,npcId)) return undefined;
  const family=resolveNpcPersonalStatement(state,npcId,'household_family');
  return [description,family?.snapshot ? family.text : '',
    'Use this current life record for identity, age, office and family. Unlisted ties and personal history are unknown.'].filter(Boolean).join(' ');
}

/** A town identity includes the actual saved life; other NPCs keep their
 * canonical id within this world. An unresolved household never falls back. */
export function generatedDialogueSpeakerKey(state:GameState,npcId:string):string|undefined {
  const npc=NPCS[npcId]??state.generatedNpcs?.[npcId];
  if (!npc || npc.id!==npcId || !Number.isSafeInteger(state.worldSeed)) return undefined;
  return 'worldforgeHousehold' in npc ? npcDialogueSpeakerKey(state,npcId)
    : JSON.stringify(['npc',state.worldSeed,npcId]);
}

function validGeneratedPublication(value:unknown):value is NpcGeneratedDialoguePublication {
  const data=value as Partial<NpcGeneratedDialoguePublication>|undefined;
  return !!data && data.topicId==='generated_exchange' && typeof data.speakerKey==='string'
    && data.source?.kind==='generated-exchange' && typeof data.source.requestId==='string' && !!data.source.requestId.trim()
    && typeof data.source.playerPrompt==='string' && !!data.source.playerPrompt.trim();
}

function validInstitutionPublication(value:unknown):value is NpcInstitutionDialoguePublication {
  const data=value as Partial<NpcInstitutionDialoguePublication>|undefined;
  return !!data && (data.topicId==='household_temple'||data.topicId==='household_office_history'||data.topicId==='household_public_history')
    && typeof data.speakerKey==='string' && data.source?.kind==='institution-statement'
    && typeof data.source.snapshot==='string' && !!data.source.snapshot;
}

/** A venue packet is not a person. Only the already admitted current life can
 * read another packet's attributed words: world, town, household member, saved
 * occupant and birth must all match. The old stamp must also name its actual
 * memory owner. Names, similar occupations and unqualified legacy text cannot
 * establish this link. No memory is copied or re-keyed. */
function admittedSpokenHistory(state:GameState,npcId:string,key:string|undefined,accept:(publication:unknown)=>boolean):
  Array<{record:Interaction;ownerId:string;memory:NpcMemory}> {
  const now=Number(state.gameTime);
  if (!key || !Number.isFinite(now)) return [];
  let person:unknown;
  try { person=JSON.parse(key); } catch { return []; }
  const town=Array.isArray(person)&&person.length===7&&person[0]==='town' ? person : undefined;
  const matches=(stamp:unknown,ownerId:string):boolean=>{
    if (typeof stamp!=='string') return false;
    if (stamp===key) return ownerId===npcId;
    if (!town) return false;
    try {
      const prior:unknown=JSON.parse(stamp);
      return Array.isArray(prior)&&prior.length===7&&prior[2]===ownerId
        && [0,1,3,4,5,6].every(index=>prior[index]===town[index]);
    } catch { return false; }
  };
  const memories=town ? Object.entries(state.npcMemory??{}) : [[npcId,state.npcMemory?.[npcId]] as const];
  const entries:Array<{record:Interaction;ownerId:string;memory:NpcMemory}>=[];
  for (const [ownerId,memory] of memories) {
    if (!memory || !Array.isArray(memory.interactions)) continue;
    for (const record of memory.interactions) {
      if (record&&record.type==='dialogue'&&accept(record.dialogue)&&matches(record.dialogue?.speakerKey,ownerId)
        &&typeof record.summary==='string'&&record.summary.trim()&&Number.isFinite(record.date)&&record.date<=now) entries.push({record,ownerId,memory});
    }
  }
  return entries;
}

/** Last discussion means the last delivered exchange, including factual ones.
 * Recall must not skip a just-heard career answer to repeat an older model line. */
export function latestSpokenDialogueReplies(state:GameState,npcId:string,max=3):Interaction[] {
  if (!Number.isFinite(max)||max<=0) return [];
  const entries=admittedSpokenHistory(state,npcId,generatedDialogueSpeakerKey(state,npcId),value=>
    validGeneratedPublication(value)||validInstitutionPublication(value)||validPublication(value)||validPersonalPublication(value))
    .sort((a,b)=>a.record.date-b.record.date);
  // Repeating an older fact is still the latest real delivery. Honor the
  // pointer in the original memory without changing that record's first date.
  let recent:typeof entries[number]|undefined,deliveredAt=-Infinity;
  for (const entry of entries) {
    const last=entry.memory.lastSpokenDialogue;
    if (last&&last.interactionId===entry.record.id&&Number.isFinite(last.deliveredAt)
      &&entry.record.date<=last.deliveredAt&&last.deliveredAt<=Number(state.gameTime)
      &&last.deliveredAt>=(entries.at(-1)?.record.date??-Infinity)
      &&(last.deliveredAt>deliveredAt||last.deliveredAt===deliveredAt&&entry.ownerId===npcId&&recent?.ownerId!==npcId)) {
      recent=entry;deliveredAt=last.deliveredAt;
    }
  }
  if (recent) entries.push(...entries.splice(entries.indexOf(recent),1));
  return entries.slice(-Math.max(0,Math.min(3,Math.floor(max)))).map(entry=>entry.record);
}

function publishInstitutionReply(state:GameState,npcId:string|null,response:string|null,dialogue:NpcInstitutionDialoguePublication):Partial<GameState> {
  if (!npcId || !response?.trim() || !validInstitutionPublication(dialogue)
    || state.activeDialogueSession?.npcId!==npcId
    || !state.activeDialogueSession.discussedTopicIds.includes(dialogue.topicId)
    || dialogue.speakerKey!==npcDialogueSpeakerKey(state,npcId)
    || !Number.isFinite(Number(state.gameTime))) return {};
  const current=resolveNpcInstitutionStatement(state,npcId,dialogue.topicId);
  if (!current || current.text!==response || current.snapshot!==dialogue.source.snapshot) return {};
  const memory=state.npcMemory[npcId]??createEmptyMemory(),history=memory.interactions??[];
  const display={lastInteractedNpcId:npcId,lastNpcResponse:response};
  const repeated=history.some(record=>record.type==='dialogue' && validInstitutionPublication(record.dialogue)
    && record.dialogue.speakerKey===dialogue.speakerKey && record.dialogue.topicId===dialogue.topicId
    && record.dialogue.source.snapshot===dialogue.source.snapshot && record.summary===response);
  if (repeated) return display;
  const record:Interaction={id:'dialogue:'+npcId+':'+Number(state.gameTime)+':'+history.length,date:Number(state.gameTime),
    type:'dialogue',summary:response,attitudeChange:0,significance:3,
    dialogue:{topicId:dialogue.topicId,speakerKey:dialogue.speakerKey,source:{...dialogue.source}}};
  return {...display,npcMemory:{...state.npcMemory,[npcId]:{...memory,interactions:[...history,record]}}};
}

export function latestSpokenGeneratedReplies(state:GameState,npcId:string,max=3):Interaction[] {
  if (!Number.isFinite(max)||max<=0) return [];
  return admittedSpokenHistory(state,npcId,generatedDialogueSpeakerKey(state,npcId),validGeneratedPublication)
    .map(entry=>entry.record).sort((a,b)=>a.date-b.date).slice(-Math.max(0,Math.min(3,Math.floor(max))));
}

/** Remember only this delivered request. A retry of the same publication
 * keeps its first date; another conversation is a separate historical event.
 * Known facts and social rewards are untouched, even if the model was wrong. */
function publishGeneratedReply(state:GameState,npcId:string|null,response:string|null,dialogue:NpcGeneratedDialoguePublication):Partial<GameState> {
  if (!npcId || !response?.trim() || !validGeneratedPublication(dialogue)
    || state.activeDialogueSession?.npcId!==npcId
    || dialogue.speakerKey!==generatedDialogueSpeakerKey(state,npcId)
    || !Number.isFinite(Number(state.gameTime))) return {};
  const memory=state.npcMemory[npcId]??createEmptyMemory();
  const history=memory.interactions??[];
  const existing=history.find(record=>record.type==='dialogue' && validGeneratedPublication(record.dialogue)
    && record.dialogue.speakerKey===dialogue.speakerKey && record.dialogue.source.requestId===dialogue.source.requestId);
  if (existing) return existing.summary===response && existing.dialogue?.source.kind==='generated-exchange'
    && existing.dialogue.source.playerPrompt===dialogue.source.playerPrompt ? {lastInteractedNpcId:npcId,lastNpcResponse:response} : {};
  const record:Interaction={id:'dialogue:'+npcId+':'+dialogue.source.requestId,date:Number(state.gameTime),type:'dialogue',summary:response,
    attitudeChange:0,significance:3,dialogue:{topicId:'generated_exchange',speakerKey:dialogue.speakerKey,source:{...dialogue.source}}};
  return {lastInteractedNpcId:npcId,lastNpcResponse:response,npcMemory:{...state.npcMemory,[npcId]:{...memory,interactions:[...history,record]}}};
}

export function npcDialogueSpeakerKey(state: GameState, npcId: string): string | undefined {
  const npc=state.generatedNpcs?.[npcId] as (GameState['generatedNpcs'][string] & {worldforgeHousehold?:{burgId:number;memberId:string;legacyNameUnique?:boolean}}) | undefined;
  const identity=npc?.worldforgeHousehold;
  if (!npc || !identity || !householdNpcAliveAt(npc,state.townSim,getGameDay(state.gameTime))) return undefined;
  const home=/^b([0-9]+):/.exec(identity.memberId);
  const town=state.townSim?.[identity.burgId];
  if (!home || !town) return undefined;
  const person=villagerForResident(town,{name:npc.name,homePlotId:Number(home[1]),householdMemberId:identity.memberId},identity.legacyNameUnique);
  // A mismatched projection is unresolved identity, not a reason to reuse old speech.
  if (!person || person.name!==npc.name) return undefined;
  // Use the saved life record, not today's numeric visual-roster slot.
  return JSON.stringify(['town',state.worldSeed,npcId,identity.burgId,identity.memberId,person.occupantId,person.bornDay]);
}

function validPublication(value: unknown): value is NpcWorkDialoguePublication {
  const data=value as Partial<NpcWorkDialoguePublication>|undefined;
  return !!data && data.topicId==='household_work' && typeof data.speakerKey==='string'
    && data.source?.kind==='business-report' && typeof data.source.businessId==='string'
    && [data.source.day,data.source.revenue,data.source.costs,data.source.profit].every(Number.isFinite)
    && [data.source.supplyIssues,data.source.competitorActions,data.source.staffIssues].every(v=>v===undefined || Array.isArray(v)&&v.every(x=>typeof x==='string'));
}

export function latestSpokenWorkReply(state: GameState,npcId: string): Interaction | undefined {
  let latest:Interaction|undefined;
  for (const {record} of admittedSpokenHistory(state,npcId,npcDialogueSpeakerKey(state,npcId),validPublication)) {
    if (!latest||record.date>=latest.date) latest=record;
  }
  return latest;
}

/** Publication and durable content happen together in SET_LAST_NPC_INTERACTION.
 * Replay of the same words/source preserves the original record and date. */
export function publishSpokenWorkReply(state: GameState,npcId: string|null,response: string|null,dialogue: NpcWorkDialoguePublication): Partial<GameState> {
  if (!npcId || !response?.trim() || !validPublication(dialogue)
      || state.activeDialogueSession?.npcId!==npcId
      || !state.activeDialogueSession.discussedTopicIds.includes(dialogue.topicId)
      || dialogue.speakerKey!==npcDialogueSpeakerKey(state,npcId)
      || !Number.isFinite(Number(state.gameTime))) return {};
  const source=dialogue.source;
  const business=state.worldBusinesses?.[source.businessId];
  const report=business?.lastDailyReport;
  if (source.kind!=='business-report' || business?.ownerId!==npcId || business.ownerType!=='npc' || !report
      || ![source.day,source.revenue,source.costs,source.profit].every(Number.isFinite)
      || source.day!==report.day || source.revenue!==report.revenue || source.costs!==report.costs || source.profit!==report.profit) return {};
  const sameIssues=(a:string[]|undefined,b:string[]|undefined)=>JSON.stringify(a??[])===JSON.stringify(b??[]);
  if (!sameIssues(source.supplyIssues,report.supplyIssues) || !sameIssues(source.competitorActions,report.competitorActions) || !sameIssues(source.staffIssues,report.staffIssues)) return {};
  const memory=state.npcMemory[npcId]??createEmptyMemory();
  const history=Array.isArray(memory.interactions)?memory.interactions:[];
  const existing=history.some(m=>m.type==='dialogue' && validPublication(m.dialogue) && m.summary===response
    && m.dialogue?.speakerKey===dialogue.speakerKey && m.dialogue.topicId===dialogue.topicId
    && m.dialogue.source.businessId===source.businessId && m.dialogue.source.day===source.day
    && m.dialogue.source.revenue===source.revenue && m.dialogue.source.costs===source.costs && m.dialogue.source.profit===source.profit
    && sameIssues(m.dialogue.source.supplyIssues,source.supplyIssues) && sameIssues(m.dialogue.source.competitorActions,source.competitorActions) && sameIssues(m.dialogue.source.staffIssues,source.staffIssues));
  const display={lastInteractedNpcId:npcId,lastNpcResponse:response};
  if (existing) return display;
  const record: Interaction={id:`dialogue:${npcId}:${Number(state.gameTime)}:${history.length}`,date:Number(state.gameTime),type:'dialogue',summary:response,attitudeChange:0,significance:3,
    dialogue:{topicId:'household_work',speakerKey:dialogue.speakerKey,source:{kind:'business-report',businessId:source.businessId,day:source.day,revenue:source.revenue,costs:source.costs,profit:source.profit,supplyIssues:[...(source.supplyIssues??[])],competitorActions:[...(source.competitorActions??[])],staffIssues:[...(source.staffIssues??[])]}}};
  return {...display,npcMemory:{...state.npcMemory,[npcId]:{...memory,interactions:[...history,record]}}};
}

function validPersonalPublication(value: unknown): value is NpcPersonalDialoguePublication {
  const data=value as Partial<NpcPersonalDialoguePublication>|undefined;
  return !!data && (data.topicId==='global_who_are_you'||data.topicId==='household_family')
    && typeof data.speakerKey==='string' && data.source?.kind==='household-personal'
    && typeof data.source.snapshot==='string' && !!data.source.snapshot;
}

/** Recall belongs to the same saved life even when today's family or office changes.
 * Missing legacy display text is never promoted into a remembered conversation. */
export function latestSpokenPersonalReply(state: GameState,npcId:string,topicId:PersonalStatementTopic):Interaction|undefined {
  let latest:Interaction|undefined;
  for (const {record} of admittedSpokenHistory(state,npcId,npcDialogueSpeakerKey(state,npcId),value=>
    validPersonalPublication(value)&&value.topicId===topicId)) {
    if (!latest||record.date>=latest.date) latest=record;
  }
  return latest;
}

/** SET_LAST_NPC_INTERACTION publishes display and history atomically. A source
 * change between selecting a topic and delivering its answer rejects both. */
function publishSpokenNpcReplyContent(state:GameState,npcId:string|null,response:string|null,dialogue:NpcDialoguePublication):Partial<GameState> {
  if (validGeneratedPublication(dialogue)) return publishGeneratedReply(state,npcId,response,dialogue);
  if (validInstitutionPublication(dialogue)) return publishInstitutionReply(state,npcId,response,dialogue);
  if (validPublication(dialogue)) return publishSpokenWorkReply(state,npcId,response,dialogue);
  if (!npcId || !response?.trim() || !validPersonalPublication(dialogue)
    || state.activeDialogueSession?.npcId!==npcId
    || !state.activeDialogueSession.discussedTopicIds.includes(dialogue.topicId)
    || dialogue.speakerKey!==npcDialogueSpeakerKey(state,npcId)
    || !Number.isFinite(Number(state.gameTime))) return {};
  const current=resolveNpcPersonalStatement(state,npcId,dialogue.topicId);
  if (!current?.snapshot || current.text!==response || current.snapshot!==dialogue.source.snapshot) return {};
  const memory=state.npcMemory[npcId]??createEmptyMemory();
  const history=Array.isArray(memory.interactions)?memory.interactions:[];
  const display={lastInteractedNpcId:npcId,lastNpcResponse:response};
  const repeated=history.some(m=>m.type==='dialogue' && validPersonalPublication(m.dialogue)
    && m.summary===response && m.dialogue.topicId===dialogue.topicId && m.dialogue.speakerKey===dialogue.speakerKey
    && m.dialogue.source.snapshot===dialogue.source.snapshot);
  if (repeated) return display;
  const record:Interaction={id:'dialogue:'+npcId+':'+Number(state.gameTime)+':'+history.length,date:Number(state.gameTime),type:'dialogue',summary:response,attitudeChange:0,significance:3,
    dialogue:{topicId:dialogue.topicId,speakerKey:dialogue.speakerKey,source:{kind:'household-personal',snapshot:dialogue.source.snapshot}}};
  return {...display,npcMemory:{...state.npcMemory,[npcId]:{...memory,interactions:[...history,record]}}};
}

/** Delivery and remembered recency are one reducer action. The history remains
 * the only source of spoken words; this reference cannot manufacture a reply.
 * In particular, repeating an older fact must not make "last discussed" point
 * to a different, newer first-publication date. Failed publication changes none. */
export function publishSpokenNpcReply(state:GameState,npcId:string|null,response:string|null,dialogue:NpcDialoguePublication):Partial<GameState> {
  const result=publishSpokenNpcReplyContent(state,npcId,response,dialogue);
  if (!npcId || result.lastInteractedNpcId!==npcId || result.lastNpcResponse!==response) return result;
  const memories=result.npcMemory??state.npcMemory,memory=memories[npcId];
  const record=memory?.interactions?.filter(item=>{
    if (item.type!=='dialogue' || item.summary!==response || item.dialogue?.speakerKey!==dialogue.speakerKey
      || item.dialogue.topicId!==dialogue.topicId) return false;
    const stored=item.dialogue.source as unknown as Record<string,unknown>,incoming=dialogue.source as unknown as Record<string,unknown>;
    return Object.keys({...stored,...incoming}).every(key=>JSON.stringify(stored[key]??[])===JSON.stringify(incoming[key]??[]));
  }).at(-1);
  if (!record) return result;
  const deliveredAt=Number(state.gameTime);
  if (memory.lastSpokenDialogue?.interactionId===record.id&&memory.lastSpokenDialogue.deliveredAt===deliveredAt) return result;
  return {...result,npcMemory:{...memories,[npcId]:{...memory,lastSpokenDialogue:{interactionId:record.id,deliveredAt}}}};
}
