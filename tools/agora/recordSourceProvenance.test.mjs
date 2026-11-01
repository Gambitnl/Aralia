// WF-G294: stable IDs are verified with their actual address from the same read.
// These fixtures never fetch a source or change the real Idea Board dataset.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {IDEA_BOARD_FILE,collectIdeaSourceIdentities,buildIdeaSourceTask,inspectRecordSourceClaims,inspectPacketSourceRecords,assertTaskSourceRecords} from './recordSourceProvenance.mjs';
import {generateSourceTask} from '../../scripts/idea-board/source-task.mjs';
import {lintTask,extractTaskOwnershipPaths,formatLintReport} from './taskLint.mjs';
const url='https://github.com/ahujasid/blender-mcp';
const data=()=>({records:[{id:'IB-0008',sources:[{id:'SRC-0042',url},{id:'SRC-0043',url:url+'/tree/main',archiveUrl:'https://web.archive.org/web/20260920/'+url}]},{id:'IB-0001',sources:[{id:'SRC-0001',url:'https://example.com/ocean'}]}],excludedSources:[{id:'EXC-0001',url:'https://t.co/CxgZHabgiI'}]});
const item={file:IDEA_BOARD_FILE,recordId:'IB-0008',sourceId:'SRC-0042',addressField:'url',url};
const body=value=>'SOURCE-RECORD: '+JSON.stringify(value);
const options=(d=data())=>({readSource:()=>JSON.stringify(d)});

test('generator ignores upstream IDs and obtains record, source, field and URL together',()=>{
  const current=data(),before=JSON.stringify(current),brief=buildIdeaSourceTask(current,[url]);
  assert.deepEqual(brief.sourceRecords,[item]);assert.match(brief.body,/Review IB-0008 \/ SRC-0042/);assert.equal(inspectRecordSourceClaims(brief,options()).issues.length,0);assert.equal(JSON.stringify(current),before);
  current.records.reverse();assert.deepEqual(buildIdeaSourceTask(current,[url]).sourceRecords,[item]);assert.equal(collectIdeaSourceIdentities(current).find(x=>x.url===url).path,'records[1].sources[0].url');
  let reads=0;assert.deepEqual(generateSourceTask([url],{readSource:()=>{reads++;return before;}}).sourceRecords,[item]);assert.equal(reads,1,'all identity fields come from one read');
});
test('excluded, absent, duplicated and invalid addresses cannot become editable briefs',()=>{
  for(const urls of [[],[url,url],['https://t.co/CxgZHabgiI'],['https://example.com/absent'],['https://name:secret@example.com/source'],['not a URL']])assert.throws(()=>buildIdeaSourceTask(data(),urls));
  const duplicate=data();duplicate.records[1].sources.push({id:'SRC-0050',url});assert.throws(()=>buildIdeaSourceTask(duplicate,[url]),/ambiguous/);
  const moved=data();moved.records[1].sources.push(moved.records[0].sources.shift());assert.equal(buildIdeaSourceTask(moved,[url]).sourceRecords[0].recordId,'IB-0001');
});
test('current binding rejects wrong record, wrong source, wrong field and stale owner',()=>{
  assert.equal(inspectRecordSourceClaims({body:body(item)},options()).issues.length,0);
  for(const mutation of [{recordId:'IB-0001'},{sourceId:'SRC-0043'},{addressField:'archiveUrl'},{url:'https://t.co/CxgZHabgiI'},{file:'../records.json'},{permission:'write'}])assert.ok(inspectRecordSourceClaims({body:body({...item,...mutation})},options()).issues.length);
  const moved=data();moved.records[1].sources.push(moved.records[0].sources.shift());assert.ok(inspectRecordSourceClaims({body:body(item)},options(moved)).issues.length);
  assert.ok(inspectRecordSourceClaims({body:body(item)+'\n'+body(item)},options()).issues.length);
});
test('explicit prose cannot substitute a valid nearby citation for a wrong owner or source',()=>{
  const valid=body(item)+'\nReview IB-0008 / SRC-0042 address '+url;
  assert.equal(inspectRecordSourceClaims({body:valid},options()).issues.length,0);
  for(const line of ['Review IB-0001 address '+url,'Review IB-0008 / SRC-0043 address '+url,'Review IB-0001 and IB-0008 address '+url,'Review SRC-0042 address '+url,'Review IB-0008 address github.com/ahujasid/blender-mcp']){
    const report=inspectRecordSourceClaims({body:body(item)+'\n'+line},options());
    if(line.includes('github.com/')&&!line.includes('https://')&&line.includes('IB-0008'))assert.equal(report.issues.length,0);else assert.ok(report.issues.length,line);
  }
  assert.ok(inspectRecordSourceClaims({body:'Review IB-0008 address '+url},options()).issues.length,'vague packet refs cannot hide record/address prose');
  assert.equal(inspectRecordSourceClaims({body:'HISTORY: IB-0001 address '+url},options()).issues.length,0,'historical evidence is not a new edit prescription');
});
test('bounds, duplicate identity, missing source and malformed JSON fail closed',()=>{
  for(const raw of [undefined,'invalid','{}','x'.repeat(2*1024*1024+1)])assert.ok(inspectRecordSourceClaims({body:body(item)},{readSource:()=>raw}).issues.length);
  for(const mutate of [d=>d.records.push(d.records[0]),d=>d.records[1].sources[0].id='SRC-0042',d=>delete d.records[0].id,d=>d.excludedSources.push(d.excludedSources[0])]){const d=data();mutate(d);assert.ok(inspectRecordSourceClaims({body:body(item)},options(d)).issues.length);}
  assert.ok(inspectRecordSourceClaims({body:'SOURCE-RECORD: invalid'},options()).issues.length);
  assert.ok(inspectRecordSourceClaims({body:'SOURCE-RECORD: '+ 'x'.repeat(8193)},options()).issues.length);
  assert.ok(inspectRecordSourceClaims({body:'x'.repeat(262145)},options()).issues.length);
  assert.throws(()=>inspectPacketSourceRecords({sourceRecords:{}},options()),/array/);
  assert.throws(()=>inspectPacketSourceRecords({sourceRecords:Array(33).fill(item)},options()),/32/);
});
test('packet retains exact task metadata and current source is read once for several bindings',()=>{
  const brief=buildIdeaSourceTask(data(),[url,url+'/tree/main']),packet={id:'fixture',scope:brief.title,guidance:brief.body,files:[IDEA_BOARD_FILE],sourceRecords:brief.sourceRecords};
  // Do not duplicate the generator metadata in both guidance and packet fields.
  packet.guidance=brief.body.split('\n').filter(line=>!line.startsWith('REFERENCE-ONLY: SOURCE-RECORD:')).join('\n');
  let reads=0;const opts={readSource:()=>{reads++;return JSON.stringify(data());}};
  assert.equal(inspectPacketSourceRecords(packet,opts).issues.length,0);assert.equal(reads,1);
  assert.equal(assertTaskSourceRecords(packet,brief,options()).issues.length,0);
  assert.throws(()=>assertTaskSourceRecords({...packet,sourceRecords:[]},brief,options()),/retained exactly/);
  assert.throws(()=>assertTaskSourceRecords(packet,{...brief,body:body({...item,recordId:'IB-0001'})},options()),/owner differs/);
});
test('native contained JSON reader and task lint share identity, not implied ownership',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'agora-source-record-'));
  try{
    fs.mkdirSync(path.dirname(path.join(root,IDEA_BOARD_FILE)),{recursive:true});fs.writeFileSync(path.join(root,IDEA_BOARD_FILE),JSON.stringify(data()));
    const brief=buildIdeaSourceTask(data(),[url]),opts={repoRoot:root,fileExists:()=>true,ignoredPaths:()=>[],grepSrc:()=>true,basenameExists:()=>true,grepTypes:()=>[],checkFileFields:()=>[]};
    assert.equal(lintTask(brief,opts).clean,true,formatLintReport(lintTask(brief,opts)).join('\n'));
    assert.deepEqual(extractTaskOwnershipPaths({body:body(item)}),[],'metadata does not grant the board');
    const stale=structuredClone(brief);stale.body=stale.body.replace('Review IB-0008','Review IB-0001');assert.equal(lintTask(stale,opts).clean,false);
    assert.equal(lintTask({body:body(item)},opts).clean,true,'unprefixed metadata is not a data value assignment');
  }finally{assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));assert.match(path.basename(root),/^agora-source-record-/);fs.rmSync(root,{recursive:true,force:true});}
});
test('actual native source-task refuses excluded historical URL without changing the current corpus',()=>{
  const before=fs.readFileSync(IDEA_BOARD_FILE,'utf8');
  const result=spawnSync(process.execPath,['scripts/idea-board/source-task.mjs','https://t.co/CxgZHabgiI'],{encoding:'utf8'});
  assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,/excluded/);assert.equal(fs.readFileSync(IDEA_BOARD_FILE,'utf8'),before);
});

test('WF294 review: wrapped wrong-owner instructions require reconciliation',()=>{
  const guidance='Review IB-0001 / SRC-0042.\nAddress: '+url;
  const task={body:body(item)+'\n'+guidance};assert.ok(inspectRecordSourceClaims(task,options()).issues.length);
  assert.throws(()=>inspectPacketSourceRecords({id:'wrapped',scope:'Review sources',guidance,sourceRecords:[item]},options()),/WF-G294/);
});
test('WF294 review: durable removal of one or all bindings cannot pass late retention',()=>{
  const brief=buildIdeaSourceTask(data(),[url,url+'/tree/main']),packet={sourceRecords:brief.sourceRecords};
  for(const task of [{body:'Review sources'},{body:body(item)}])assert.throws(()=>assertTaskSourceRecords(packet,task,options()),/retained exactly/);
});

test('a source ID in a URL is not prose, and a correctly bound title need not repeat the address',()=>{
  const d=data();d.records[0].sources[0].url=url+'/IB-0001';
  const brief=buildIdeaSourceTask(d,[d.records[0].sources[0].url]);brief.title='Review IB-0008 source';
  assert.equal(inspectRecordSourceClaims(brief,options(d)).issues.length,0);
  brief.title='Review IB-0001 source';assert.ok(inspectRecordSourceClaims(brief,options(d)).issues.length);
});

test('WF294 review: metadata-only address cannot excuse wrong ID-only prose or title',()=>{
  const task={body:body(item)+'\nReview IB-0001 / SRC-0042.'};assert.ok(inspectRecordSourceClaims(task,options()).issues.length);
  assert.ok(inspectRecordSourceClaims({title:'Review IB-0001 source',body:body(item)},options()).issues.length);
  assert.throws(()=>inspectPacketSourceRecords({id:'metadata-only',scope:'Review sources',guidance:'Review IB-0001 / SRC-0042.',sourceRecords:[item]},options()),/WF-G294/);
});
