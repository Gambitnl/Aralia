// WF-G294: bind an Idea Board address to the source and record that own it.
// The receipt reader and brief generator derive all three from one JSON snapshot.
// Task lint and packet checks re-read that relationship before assignment. This
// is identity evidence, not reachability, research truth or permission to edit.
import {isDeepStrictEqual} from 'node:util';
import {CLIENT_REPO_ROOT as ROOT} from './client-root.mjs';
import {readDataValueSource} from './dataValueProvenance.mjs';
export const IDEA_BOARD_FILE='public/idea-board/records.json';
const MARKER=/^[ \t>*-]*(?:REFERENCE-ONLY:\s*)?SOURCE-RECORD\s*:\s*(.*)$/i;
const address=value=>typeof value==='string'&&value.length<=4096&&/^https?:\/\//.test(value)&&!new URL(value).username&&!new URL(value).password;

// Array positions are observation hints only. Stable IDs stay attached to the
// same address when the board is sorted. Exclusions have no active record owner.
export function collectIdeaSourceIdentities(data){
  const entries=[];
  for(const[ri,record]of(data?.records??[]).entries())for(const[si,source]of(record?.sources??[]).entries()){
    for(const addressField of ['url','archiveUrl'])if(typeof source?.[addressField]==='string'&&source[addressField].trim())entries.push({path:`records[${ri}].sources[${si}].${addressField}`,url:source[addressField].trim(),recordId:record.id??null,sourceId:source.id??null,addressField});
  }
  for(const[i,source]of(data?.excludedSources??[]).entries())if(typeof source?.url==='string'&&source.url.trim())entries.push({path:`excludedSources[${i}].url`,url:source.url.trim(),recordId:null,sourceId:source.id??null,addressField:'url',excluded:true});
  return entries;
}

function currentEntries(data){
  if(!Array.isArray(data?.records)||!Array.isArray(data?.excludedSources))throw new Error('current board needs records and excludedSources arrays');
  const ids=new Set(),sources=new Set();
  for(const record of data.records){
    if(!/^IB-\d{4}$/.test(record?.id)||ids.has(record.id)||!Array.isArray(record.sources))throw new Error('current record IDs absent, ambiguous or malformed');ids.add(record.id);
    for(const source of record.sources){if(!/^SRC-\d{4}$/.test(source?.id)||sources.has(source.id))throw new Error('current source IDs absent, ambiguous or malformed');sources.add(source.id);}
  }
  const excluded=new Set();
  for(const source of data.excludedSources){if(!/^EXC-\d{4}$/.test(source?.id)||excluded.has(source.id))throw new Error('excluded source IDs absent, ambiguous or malformed');excluded.add(source.id);}
  return collectIdeaSourceIdentities(data);
}
const citation=entry=>({file:IDEA_BOARD_FILE,recordId:entry.recordId,sourceId:entry.sourceId,addressField:entry.addressField,url:entry.url});

// The caller supplies the current parsed snapshot, not IDs from a prior sweep.
// An absent, excluded or multiply owned address cannot become an editable brief.
export function buildIdeaSourceTask(data,urls){
  if(!Array.isArray(urls)||!urls.length||urls.length>32||new Set(urls).size!==urls.length)throw new Error('supply1-32 distinct exact current addresses');
  const entries=currentEntries(data),sourceRecords=urls.map(url=>{
    if(!address(url))throw new Error('need an exact HTTP(S) address without credentials');
    const matches=entries.filter(entry=>entry.url===url);
    if(matches.length!==1||matches[0].excluded)throw new Error('address absent, excluded or ambiguous; re-read current board and preserve human rulings: '+url);
    return citation(matches[0]);
  });
  const body=sourceRecords.map(item=>`Review ${item.recordId} / ${item.sourceId} address ${item.url} in ${item.file} (${item.addressField}).\nREFERENCE-ONLY: SOURCE-RECORD: ${JSON.stringify(item)}`).join('\n')
    +'\nIdentity-only brief: re-read the current owning record before editing. Parent must add the actual bounded repair, acceptance criteria and owned files. Do not infer link rot, revision intent, licence, installation or permission from this binding.';
  return {title:'Review current Idea Board source identities',body,refs:[IDEA_BOARD_FILE],sourceRecords};
}

export function withoutSourceRecordPayload(body){return String(body||'').split(/\r?\n/).filter(line=>!MARKER.test(line)).join('\n');}
export function inspectRecordSourceClaims(task={}, {repoRoot=ROOT,readSource=file=>readDataValueSource(repoRoot,file)}={}){
  const issues=[],declarations=[],resolved=[],claims=[],seen=new Set();let entries;
  const issue=(bodyLine,reason)=>issues.push({bodyLine,reason});
  const body=String(task.body||'');
  if(Buffer.byteLength(body)>262144){issue(0,'record provenance body exceeds262144 bytes');return {issues,declarations,resolved,claims};}
  const getEntries=()=>{
    if(!entries){const raw=readSource(IDEA_BOARD_FILE);if(typeof raw!=='string'||Buffer.byteLength(raw)>2*1024*1024)throw new Error('current board unavailable or exceeds2MiB');entries=currentEntries(JSON.parse(raw));}
    return entries;
  };
  for(const[i,line]of body.split(/\r?\n/).entries()){
    const match=MARKER.exec(line);if(!match)continue;
    try{
      if(declarations.length>=32||Buffer.byteLength(match[1])>8192)throw new Error('at most32 SOURCE-RECORD declarations of8192 bytes each');
      const item=JSON.parse(match[1]);
      if(!item||typeof item!=='object'||Object.keys(item).sort().join(',')!=='addressField,file,recordId,sourceId,url'||item.file!==IDEA_BOARD_FILE||!/^IB-\d{4}$/.test(item.recordId)||!/^SRC-\d{4}$/.test(item.sourceId)||!['url','archiveUrl'].includes(item.addressField)||!address(item.url))throw new Error('SOURCE-RECORD needs exact board file, stable record/source IDs, addressField and HTTP(S) url');
      const key=JSON.stringify(item);if(seen.has(key))throw new Error('duplicate SOURCE-RECORD');seen.add(key);
      const matches=getEntries().filter(entry=>entry.url===item.url);
      if(matches.length!==1||matches[0].excluded||!isDeepStrictEqual(citation(matches[0]),item))throw new Error('address owner differs, is absent, excluded or ambiguous; derive record and source IDs from the same current read');
      declarations.push(item);resolved.push({...item,path:matches[0].path,bodyLine:i+1});
    }catch(error){issue(i+1,error.message);}
  }
  // Explicit stable-ID/address prose is the supported automatic form. Complex
  // paragraphs with several owners must be split, not silently cross-associated.
  const prose=[task.title||'',withoutSourceRecordPayload(body)].join('\n').split(/\r?\n/).filter(line=>!/^\s*(?:REFERENCE-ONLY|HISTORY|EVIDENCE|SNAPSHOT|KNOWN-INVALID|DATA-VALUE|DATA-EDIT|SOURCE-CITATION)\s*:/i.test(line));
  const urlPattern=/(?:https?:\/\/|github\.com\/)[^\s<>\x60"']+/g;
  const hasAddress=declarations.length>0||prose.some(line=>line.match(urlPattern));
  for(const[i,line]of prose.entries()){
    const words=line.replace(urlPattern,'ADDRESS');
    const records=[...new Set(words.match(/\bIB-\d{4}\b/g)||[])],sources=[...new Set(words.match(/\bSRC-\d{4}\b/g)||[])];
    const urls=[...new Set((line.match(urlPattern)||[]).map(url=>url.replace(/[),.;]+$/,'')).map(url=>url.startsWith('github.com/')?'https://'+url:url))];
    if(!records.length&&!sources.length)continue;
    if(!urls.length){
      // A short title may name the record while the body gives its address.
      // Only a title that agrees with verified body declarations is accepted.
      if(i===0&&records.length===1&&sources.length<=1&&declarations.some(item=>item.recordId===records[0]&&(!sources.length||item.sourceId===sources[0])))continue;
      if(hasAddress)issue(i+1,'split record/address prose needs author reconciliation; put the actual record, source and address on the same instruction line');
      continue;
    }
    if(claims.length+urls.length>64){issue(0,'more than64 record/address claims; author reconciliation required');break;}
    if(records.length!==1||sources.length>1){issue(i+1,'ambiguous record/address prose; put one actual owning record and source per instruction line');continue;}
    for(const url of urls){claims.push({recordId:records[0],sourceId:sources[0],url});if(!declarations.some(item=>item.recordId===records[0]&&(!sources.length||item.sourceId===sources[0])&&item.url===url))issue(i+1,'record/address prescription needs matching current SOURCE-RECORD: '+records[0]+' '+url);}
  }
  return {issues,declarations,resolved,claims};
}
export function sourceRecordPromptBlock(packet){return '\nSOURCE RECORD IDENTITY (WF-G294): derive address, source and owning record together from current JSON, never an upstream summary. Recheck before editing; historical/excluded sources and literal bindings grant no edits or semantic acceptance.\n'+(packet.sourceRecords||[]).map(item=>'REFERENCE-ONLY: SOURCE-RECORD: '+JSON.stringify(item)).join('\n')+'\n';}
export function inspectPacketSourceRecords(packet,options){
  if(packet.sourceRecords!==undefined&&(!Array.isArray(packet.sourceRecords)||packet.sourceRecords.length>32))throw new Error('WF-G294 sourceRecords must be an array of at most32 records');
  const result=inspectRecordSourceClaims({title:packet.scope,body:[packet.guidance||'',sourceRecordPromptBlock(packet)].join('\n'),refs:[...(packet.files||[]),...(packet.refs||[])]},options);
  if(result.issues.length)throw new Error('packet '+packet.id+': WF-G294 '+result.issues.map(i=>i.reason).join('; '));return result;
}
export function assertTaskSourceRecords(packet,task,options){
  const result=inspectRecordSourceClaims(task,options);
  if(result.issues.length)throw new Error('WF-G294 '+result.issues.map(i=>i.reason).join('; '));
  const required=packet.sourceRecords||[];
  if(!Array.isArray(required)||result.declarations.length!==required.length||result.declarations.some(record=>!required.some(item=>isDeepStrictEqual(item,record))))throw new Error('WF-G294 current task sourceRecords must be retained exactly in both task and packet; removal needs parent reconciliation');return result;
}
