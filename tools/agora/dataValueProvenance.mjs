// WF-G267: task authors must say where a prescribed data value came from.
// Task lint and packet preflight read exact JSON sibling fields or an explicit
// new-value reason. This checks literal provenance, not semantic canon, runtime
// compatibility, complete English intent or permission to edit the cited file.
import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {CLIENT_REPO_ROOT as ROOT} from './client-root.mjs';
const MARKER=/^[ \t>*-]*(?:REFERENCE-ONLY:\s*)?DATA-VALUE\s*:\s*(.*)$/i;
const exact=file=>typeof file==='string'&&/^[A-Za-z0-9_.@/-]+\.json$/.test(file)&&!file.startsWith('/')&&!file.split('/').includes('..')&&path.posix.normalize(file)===file;
const field=value=>Array.isArray(value)&&value.length>0&&value.length<=32&&value.every(key=>typeof key==='string'&&key.length<=128||Number.isSafeInteger(key)&&key>=0);
const only=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));
const reason=value=>typeof value==='string'&&value.trim().length>=8&&Buffer.byteLength(value)<=4096&&!/\b(?:TODO|TBD)\b/i.test(value);

// Read only regular, contained sources. Private test readers use the same
// bounded string contract; neither reader executes code or writes JSON.
export function readDataValueSource(repoRoot,file){
  if(!exact(file))throw new Error('need an exact repository-relative JSON source');
  const root=fs.realpathSync(repoRoot),target=fs.realpathSync(path.join(root,file));
  const relative=path.relative(root,target),stat=fs.statSync(target);
  if(path.isAbsolute(relative)||relative==='..'||relative.startsWith('..'+path.sep)||!stat.isFile()||stat.size>2*1024*1024)throw new Error('source is outside the repository, not regular, or larger than2MiB');
  return fs.readFileSync(target,'utf8');
}

export function withoutDataValuePayload(value){return String(value||'').split(/\r?\n/).filter(line=>!MARKER.test(line)).join('\n');}

// Recognize explicit quoted key/value prescriptions near JSON file context.
// Existing policy and historical/reference-only lines are not new assignments.
// Other prose forms remain a manual author-review obligation, not inferred facts.
export function inspectDataValueClaims(task={}, {repoRoot=ROOT,readSource=file=>readDataValueSource(repoRoot,file)}={}){
  const issues=[],declarations=[],resolved=[],claims=[],seen=new Set(),sources=new Map();
  const issue=(bodyLine,reason)=>issues.push({bodyLine,reason});
  const body=String(task.body||'');
  if(Buffer.byteLength(body)>262144){issue(0,'data provenance body exceeds262144 bytes; explicit author reconciliation required');return {issues,declarations,resolved,claims};}
  for(const [i,line]of body.split(/\r?\n/).entries()){
    const match=MARKER.exec(line);if(!match)continue;
    try{
      if(declarations.length>=32||Buffer.byteLength(match[1])>16384)throw new Error('at most32 declarations of16384 bytes each');
      const record=JSON.parse(match[1]);
      if(!only(record,['file','field','value','origin'])||!exact(record.file)||!field(record.field)||!Object.hasOwn(record,'value'))throw new Error('declaration needs exact target JSON file, key-array field, value and origin');
      const encoded=JSON.stringify(record.value);if(encoded===undefined||Buffer.byteLength(encoded)>8192||!isDeepStrictEqual(record.value,JSON.parse(encoded)))throw new Error('value needs a finite JSON value of at most8192 bytes');
      const key=JSON.stringify([record.file,record.field.map(String)]);if(seen.has(key))throw new Error('duplicate target field declaration');seen.add(key);
      const origin=record.origin;
      if(!only(origin,['kind','file','field','reason'])||!reason(origin.reason)||!['existing','new'].includes(origin.kind))throw new Error('origin needs existing/new kind and a reviewed reason');
      if(origin.kind==='new'){
        if(origin.file!==undefined||origin.field!==undefined)throw new Error('new-value origin cannot claim an existing source');
      }else{
        if(!exact(origin.file)||!field(origin.field))throw new Error('existing origin needs exact sibling JSON file and key-array field');
        if(origin.file===record.file&&isDeepStrictEqual(origin.field.map(String),record.field.map(String)))throw new Error('target field cannot cite itself as sibling provenance');
        if(!sources.has(origin.file)){
          const raw=readSource(origin.file);if(typeof raw!=='string'||Buffer.byteLength(raw)>2*1024*1024)throw new Error('source exceeds2MiB or is unavailable');
          sources.set(origin.file,JSON.parse(raw));
        }
        let current=sources.get(origin.file);
        for(const key of origin.field){if(current===null||typeof current!=='object'||!Object.hasOwn(current,key)||(Array.isArray(current)&&!/^(?:0|[1-9]\d*)$/.test(String(key))))throw new Error('source field absent or unsupported');current=current[key];}
        if(!isDeepStrictEqual(current,record.value))throw new Error('cited current sibling value differs; select the existing spelling or explicitly declare a new value');
      }
      declarations.push(record);resolved.push({...record,bodyLine:i+1,observedAt:new Date().toISOString()});
    }catch(error){issue(i+1,error.message);}
  }
  // Durable DATA-EDIT records also prescribe values, even though their JSON
  // payload is reference-only for path ownership. Do not let that label bypass
  // spelling provenance or turn the old baseline check into the new check.
  for(const[i,line]of body.split(/\r?\n/).entries()){
    const match=/^[ \t>*-]*(?:REFERENCE-ONLY:\s*)?DATA-EDIT\s*:\s*(.*)$/i.exec(line);if(!match)continue;
    try{
      if(Buffer.byteLength(match[1])>16384)throw new Error('DATA-EDIT payload exceeds16384 bytes');
      const edit=JSON.parse(match[1]);if(!exact(edit.file)||!field(edit.field)||!Object.hasOwn(edit,'to'))throw new Error('DATA-EDIT needs exact target file, field and to-value');
      if(!declarations.some(record=>record.file===edit.file&&isDeepStrictEqual(record.field.map(String),edit.field.map(String))&&isDeepStrictEqual(record.value,edit.to)))throw new Error('DATA-EDIT target value needs matching DATA-VALUE provenance');
    }catch(error){issue(i+1,error.message);}
  }
  const prose=[task.title||'',withoutDataValuePayload(body)].join('\n').split(/\r?\n/).filter(line=>!/^\s*(?:REFERENCE-ONLY|EVIDENCE|HISTORY|SNAPSHOT|KNOWN-INVALID|DATA-EDIT|SOURCE-RECORD|SOURCE-CITATION|SOURCE-REVIEW|SOURCE-MEMBERS|SYMBOL-CHECK|DEDUP-ACCEPTANCE|COUNT-SOURCE|PRODUCTION-CALLER)\s*:/i.test(line)).join('\n');
  const context=prose+'\n'+(Array.isArray(task.refs)?task.refs.join('\n'):'');
  const files=[...new Set(context.match(/(?:public|src|tools|scripts|tests|misc|\.agent)\/[A-Za-z0-9_.@/-]+\.json\b/g)||[])];
  if(files.length){
    const quoted='"(?:[^"\\\\\\r\\n]|\\\\.)*"';
    const pair=new RegExp('('+quoted+')\\s*:\\s*('+quoted+'|-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:[eE][+-]?\\d+)?|true|false|null)(?![\\w.])','g');
    for(const match of prose.matchAll(pair)){
      if(claims.length>=64){issue(0,'more than64 recognized literal claims; explicit reconciliation required');break;}
      const key=JSON.parse(match[1]),value=JSON.parse(match[2]);claims.push({key,value});
      const start=prose.lastIndexOf('\n',match.index)+1,end=prose.indexOf('\n',match.index);
      const sentence=prose.slice(start,end===-1?undefined:end),localFiles=[...new Set(sentence.match(/(?:public|src|tools|scripts|tests|misc|\.agent)\/[A-Za-z0-9_.@/-]+\.json\b/g)||[])];
      const targets=localFiles.length?localFiles:files;
      if(targets.length!==1){issue(0,'literal target file is ambiguous; put the exact target and field on the instruction line');continue;}
      const target=targets[0],tail=sentence.slice(sentence.indexOf(target)+target.length).trim().replace(/^#/,''),token=/^[A-Za-z_$][A-Za-z0-9_$]*(?:\[(?:0|[1-9]\d*)\]|\.[A-Za-z_$][A-Za-z0-9_$]*)*/.exec(tail)?.[0];
      let targetField=[key];
      if(token){
        targetField=[...token.matchAll(/([A-Za-z_$][A-Za-z0-9_$]*)|\[(\d+)\]/g)].map(part=>part[1]??Number(part[2]));
        if(String(targetField.at(-1))!==key)targetField.push(key);
        if(/^(?:\[|-|\.(?=\S)|\?(?=\S))/.test(tail.slice(token.length))){issue(0,'unsupported target field syntax; author must reconcile the exact key array');continue;}
      }
      // Remove quoted values before looking for alternatives, so a label like
      // "morning or night" is data, not an instruction to choose a spelling.
      const localPairs=[...sentence.matchAll(new RegExp(pair.source,'g'))],unquoted=sentence.replace(new RegExp(pair.source,'g'),'VALUE');
      if((localPairs.length>1&&/\b(?:or|alternatively)\b/i.test(unquoted))
        ||/^\s*(?:(?:[-*]|\d+\.)\s*)?(?:or|alternatively)\b/i.test(unquoted)
        ||/\b(?:or|alternatively)\b[^\n]{0,80}["`][A-Za-z_$][A-Za-z0-9_$]*["`]/i.test(unquoted)){
        issue(0,'unresolved alternative spellings for '+JSON.stringify(key)+'; prescribe one selected field/value with provenance and label unselected alternatives HISTORY');continue;
      }
      if(!declarations.some(record=>record.file===target&&isDeepStrictEqual(record.field.map(String),targetField.map(String))&&isDeepStrictEqual(record.value,value)))issue(0,'prescribed '+target+' '+JSON.stringify(targetField)+': '+JSON.stringify(value)+' needs DATA-VALUE sibling provenance or explicit new-value reason');
    }
  }
  return {issues,declarations,resolved,claims};
}

// The packet owns the target through its usual files/refs contract. These
// reference-only records preserve authored provenance without granting sources.
export function dataValuePromptBlock(packet){
  return '\nDATA VALUE PROVENANCE (WF-G267): cite the current sibling field or explicitly justify a new spelling. Re-read it before editing; a source match is not semantic canon or edit permission. Resolve alternative spellings with the author, never choose silently.\n'
    +(packet.dataValues||[]).map(record=>'REFERENCE-ONLY: DATA-VALUE: '+JSON.stringify(record)).join('\n')+'\n';
}
export function inspectPacketDataValues(packet,options){
  if(packet.dataValues!==undefined&&(!Array.isArray(packet.dataValues)||packet.dataValues.length>32))throw new Error('WF-G267 dataValues must be an array of at most32 records');
  if(packet.dataEdits!==undefined&&!Array.isArray(packet.dataEdits))throw new Error('WF-G267 dataEdits must be an array');
  const edits=(packet.dataEdits||[]).map(edit=>'REFERENCE-ONLY: DATA-EDIT: '+JSON.stringify(edit)).join('\n');
  const report=inspectDataValueClaims({title:packet.scope,body:[packet.guidance||'',dataValuePromptBlock(packet),edits].join('\n'),refs:[...(packet.refs||[]),...(packet.files||[])]},options);
  if(report.issues.length)throw new Error('packet '+packet.id+': WF-G267 '+report.issues.map(issue=>issue.reason).join('; '));
  return report;
}
export function assertTaskDataValues(packet,task,options){
  const report=inspectDataValueClaims(task,options);
  if(report.issues.length)throw new Error('WF-G267 '+report.issues.map(issue=>issue.reason).join('; '));
  if(report.declarations.some(record=>!(packet.dataValues||[]).some(item=>isDeepStrictEqual(item,record))))throw new Error('WF-G267 existing task dataValues must be retained exactly in the packet');
  return report;
}
