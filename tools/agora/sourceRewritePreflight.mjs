// WF-G295: retain a complete, pre-probed Idea Board primary-URL rewrite batch.
// This extends packet checks, not task permissions or the immutable CLI. Current
// JSON, stable identities and the owning validator are rechecked at launch.
// A collision needs a parent ruling; this reader never edits or fetches sources.
import {isDeepStrictEqual} from 'node:util';
import {probeIdeaSourceRewrites} from '../../scripts/idea-board/validate.mjs';
import {IDEA_BOARD_FILE} from './recordSourceProvenance.mjs';
import {readDataValueSource} from './dataValueProvenance.mjs';
import {CLIENT_REPO_ROOT as ROOT} from './client-root.mjs';
const REWRITE=/^[ \t>*-]*(?:REFERENCE-ONLY:\s*)?SOURCE-REWRITE\s*:\s*(.*)$/i;
const EDIT=/^[ \t>*-]*(?:REFERENCE-ONLY:\s*)?DATA-EDIT\s*:\s*(.*)$/i;
const primary=edit=>edit?.file===IDEA_BOARD_FILE && Array.isArray(edit.field) && (
  edit.field.length===5 && edit.field[0]==='records' && edit.field[2]==='sources' && edit.field[4]==='url'
  || edit.field[0]==='excludedSources' && edit.field.at(-1)==='url');
const equalSet=(left,right)=>{
  if(left.length!==right.length)return false;
  const remaining=[...right];
  for(const item of left){const index=remaining.findIndex(other=>isDeepStrictEqual(item,other));if(index<0)return false;remaining.splice(index,1);}
  return true;
};

export function sourceRewritePromptBlock(packet){
  return '\nSOURCE REWRITE ACCEPTANCE (WF-G295): probe the complete primary-address batch with the owning Idea Board validator before filing an edit brief and after acquiring locks. Preserve IDs, exclusions and human rulings. A collision requires parent reconciliation; a reason is not an override. This is not reachability or semantic acceptance.\n'
    +(packet.sourceRewrites||[]).map(item=>'REFERENCE-ONLY: SOURCE-REWRITE: '+JSON.stringify(item)).join('\n')+'\n';
}
function markers(body,pattern){
  if(Buffer.byteLength(body)>262144)throw new Error('body exceeds262144 bytes');
  const result=[];
  for(const line of body.split(/\r?\n/)){
    const match=pattern.exec(line);if(!match)continue;
    if(result.length>=32 || Buffer.byteLength(match[1])>16384)throw new Error('at most32 declarations of16384 bytes each');
    result.push(JSON.parse(match[1]));
  }
  return result;
}
export function inspectPacketSourceRewrites(packet,{repoRoot=ROOT,readSource=file=>readDataValueSource(repoRoot,file)}={}){
  const fail=message=>{throw new Error('packet '+packet.id+': WF-G295 '+message);};
  try{
    const rewrites=packet.sourceRewrites??[];
    if(!Array.isArray(rewrites)||rewrites.length>32)fail('sourceRewrites must be an array of at most32 records');
    const edits=(packet.dataEdits||[]).filter(primary);
    const prose=[packet.scope||'',packet.guidance||''].join('\n').split(/\r?\n/).filter(line=>!/^\s*(?:REFERENCE-ONLY|HISTORY|EVIDENCE|SNAPSHOT|KNOWN-INVALID)\s*:/i.test(line)).join('\n');
    if(!rewrites.length && !edits.length){
      if((packet.files||[]).includes(IDEA_BOARD_FILE) && /\b(?:rewrite|repoint|replace|update|change)\b[^\n]{0,120}\b(?:sources?\s+(?:urls?|addresses?|address)|primary\s+(?:urls?|addresses?|address)|urls?\s+fields?)\b/i.test(prose))fail('primary-address prescription needs pre-probed sourceRewrites and exact dataEdits before filing');
      return {declarations:[],edits:[]};
    }
    if(!(packet.files||[]).includes(IDEA_BOARD_FILE))fail('source rewrite target must be explicitly owned');
    if(edits.some(edit=>edit.field[0]==='excludedSources'))fail('excluded-source rewrites require parent reconciliation; preserve the existing human ruling');
    if(!rewrites.length || !edits.length)fail('sourceRewrites and exact primary-URL dataEdits must both be retained');
    const raw=readSource(IDEA_BOARD_FILE);
    if(typeof raw!=='string'||Buffer.byteLength(raw)>2*1024*1024)fail('current board unavailable or exceeds2MiB');
    const report=probeIdeaSourceRewrites(JSON.parse(raw),rewrites);
    if(!report.ok){
      const collisions=report.collisions.map(c=>'collision '+c.url+' owned by '+c.owners.map(o=>(o.recordId||'excluded')+'/'+o.sourceId+' '+o.path).join(', '));
      fail([...collisions,...report.errors,...report.baselineErrors.map(e=>'baseline: '+e),...report.proposedErrors.map(e=>'proposed: '+e)].join('; ')+'; parent reconciliation required before an edit brief');
    }
    if(!equalSet(edits,report.edits))fail('stable owners/from-values and exact dataEdit positions differ; re-read and reconcile, never silently reindex');
    for(const record of report.sourceRecords)if(!(packet.sourceRecords||[]).some(item=>isDeepStrictEqual(item,record)))fail('rewrite needs matching current SOURCE-RECORD');
    return {...report,declarations:rewrites};
  }catch(error){if(error.message.includes('WF-G295'))throw error;fail(error.message);}
}
export function assertTaskSourceRewrites(packet,task,options){
  try{
    const body=String(task.body||'');
    const sourceRewrites=markers(body,REWRITE),dataEdits=markers(body,EDIT).filter(primary).map(edit=>{
      // Existing seed bodies add this advisory reminder. It must be the known
      // recheck form, not a substitute for the retained authored from-value.
      if(Object.hasOwn(edit,'verification')&&edit.verification!=='RECHECK BEFORE EDITING')throw new Error('primary rewrite requires an authored from-value and RECHECK BEFORE EDITING');
      const {verification,...authored}=edit;return authored;
    });
    if(!equalSet(sourceRewrites,packet.sourceRewrites||[]) || !equalSet(dataEdits,(packet.dataEdits||[]).filter(primary)))throw new Error('current task rewrite batch and exact dataEdits must be retained in both task and packet; removal needs parent reconciliation');
    return inspectPacketSourceRewrites({...packet,scope:task.title,guidance:body,sourceRewrites,dataEdits},options);
  }catch(error){throw new Error('WF-G295 '+error.message);}
}
