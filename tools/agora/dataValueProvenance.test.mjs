// WF267: private readers prove provenance failures without changing game data.
// Current corpus values are source evidence, never a runtime acceptance claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {inspectDataValueClaims,inspectPacketDataValues,assertTaskDataValues,dataValuePromptBlock,readDataValueSource} from './dataValueProvenance.mjs';
const file='public/data/target.json',source='public/data/sibling.json';
const record=()=>({file,field:['frequency'],value:'each_turn',origin:{kind:'existing',file:source,field:['frequency'],reason:'Current sibling expresses the same reviewed authored cadence.'}});
const line=value=>'REFERENCE-ONLY: DATA-VALUE: '+JSON.stringify(value);
const readSource=()=>JSON.stringify({frequency:'each_turn',zero:0,enabled:false,empty:null,array:['each_turn'],nested:{'a.b':'each_turn'}});
const inspect=body=>inspectDataValueClaims({body,refs:[file]},{readSource});

test('unjustified literal needs a sibling citation or explicit new-value record',()=>{
  assert.match(inspect('Add "timing": "each_caster_turn" to '+file).issues[0].reason,/needs DATA-VALUE/);
});
test('a current exact sibling field proves the selected literal without mutating declarations',()=>{
  const r=record(),before=JSON.stringify(r),report=inspect('Set "frequency": "each_turn" in '+file+'\n'+line(r));
  assert.equal(report.issues.length,0);assert.equal(report.resolved.length,1);assert.equal(JSON.stringify(r),before);
});
test('new values need explicit reviewed reasons, not fake sibling provenance',()=>{
  const r={...record(),value:'new_cadence',origin:{kind:'new',reason:'Parent deliberately introduces a distinct cadence; compatibility proof remains required.'}};
  assert.equal(inspect('Set "frequency": "new_cadence" in '+file+'\n'+line(r)).issues.length,0);
  for(const origin of [{kind:'new',reason:'TODO'},{kind:'new',reason:'Reviewed distinct cadence.',file:source},{kind:'guessed',reason:'Reviewed distinct cadence.'}])assert.ok(inspect(line({...r,origin})).issues.length);
});
test('stale values, missing fields, wrong sources and self-citations cannot prove a sibling',()=>{
  for(const r of [{...record(),value:'each_caster_turn'},{...record(),origin:{...record().origin,field:['missing']}},{...record(),origin:{...record().origin,file}}])assert.ok(inspect(line(r)).issues.length);
  const result=inspectDataValueClaims({body:line(record())},{readSource:()=>{throw new Error('source unavailable');}});assert.match(result.issues[0].reason,/unavailable/);
});
test('two prescribed alternatives cannot silently use only one canonical spelling',()=>{
  assert.ok(inspect('Choose "frequency": "each_turn" or "timing": "each_caster_turn" in '+file+'\n'+line(record())).issues.some(issue=>/timing/.test(issue.reason)));
});
test('historical and reference-only examples are not new instructions; metadata is still validated',()=>{
  for(const prefix of ['HISTORY','SNAPSHOT','REFERENCE-ONLY','EVIDENCE'])assert.equal(inspect(prefix+': Add "timing": "invented" in '+file).issues.length,0);
  assert.ok(inspect('REFERENCE-ONLY: DATA-VALUE: broken').issues.length);
  assert.equal(inspect('SOURCE-CITATION: {"file":"'+file+'","quote":"example"}').issues.length,0);
});
test('duplicate, malformed, traversal, absolute, glob and oversized declarations fail',()=>{
  assert.ok(inspect(line(record())+'\n'+line(record())).issues.length);
  for(const patch of [{file:'../outside.json'},{file:'F:/outside.json'},{file:'public/*.json'},{field:[]},{field:['a'.repeat(129)]},{value:'x'.repeat(8193)},{extra:'field'}])assert.ok(inspect(line({...record(),...patch})).issues.length);
  assert.ok(inspect('DATA-VALUE: '+JSON.stringify({...record(),value:null}).replace('"value":null','"value":1e400')).issues.length);
  assert.ok(inspect('x'.repeat(262145)).issues.length);
});
test('false, zero, null, arrays and exact dotted keys are real sibling values',()=>{
  for(const [field,value]of [['zero',0],['enabled',false],['empty',null],['array',['each_turn']]]){
    const r={...record(),field:[field],value,origin:{...record().origin,field:[field]}};assert.equal(inspect(line(r)).issues.length,0);
  }
  assert.equal(inspect(line({...record(),origin:{...record().origin,field:['nested','a.b']}})).issues.length,0);
  assert.ok(inspect(line({...record(),value:1,origin:{...record().origin,field:['array','length']}})).issues.length);
});
test('structured data edits require matching provenance, independently of from-values',()=>{
  const edit={file,field:['frequency'],to:'each_turn',from:'before'};
  const body='REFERENCE-ONLY: DATA-EDIT: '+JSON.stringify(edit);
  assert.ok(inspect(body).issues.length);assert.equal(inspect(body+'\n'+line(record())).issues.length,0);
  assert.ok(inspect(body+'\n'+line({...record(),field:['timing']})).issues.length);
});
test('task records cannot be dropped or changed and provenance grants no edit permission',()=>{
  const packet={id:'values',files:[file],dataValues:[record()]};
  assert.equal(inspectPacketDataValues(packet,{readSource}).issues.length,0);
  const task={body:dataValuePromptBlock(packet),refs:[file]};assert.doesNotThrow(()=>assertTaskDataValues(packet,task,{readSource}));
  assert.throws(()=>assertTaskDataValues({...packet,dataValues:[]},task,{readSource}),/retained exactly/);
  assert.throws(()=>assertTaskDataValues({...packet,dataValues:[{...record(),origin:{kind:'new',reason:'Changed provenance premise.'}}]},task,{readSource}),/retained exactly/);
  assert.match(task.body,/not semantic canon or edit permission/);
});
test('another file or nested field cannot stand in for the instruction target',()=>{
  const r={...record(),field:['other','frequency']};
  for(const prose of ['Set "frequency": "each_turn" in '+file+' effects[1].frequency',
    'Set "frequency": "each_turn" in public/data/b.json effects[1].frequency\nAlso inspect '+file])assert.ok(inspect(prose+'\n'+line(r)).issues.length);
});
test('independent new-value reasons do not select prescriptive alternatives',()=>{
  const a={...record(),origin:{kind:'new',reason:'A reviewed novel frequency value.'}},b={...record(),field:['timing'],value:'each_caster_turn',origin:{kind:'new',reason:'Another reviewed novel timing value.'}};
  for(const prose of ['Add "timing": "each_caster_turn" (or the canonical "frequency") to '+file,
    'Add "frequency": "each_turn" or "timing": "each_caster_turn" to '+file])assert.ok(inspect(prose+'\n'+line(a)+'\n'+line(b)).issues.length);
});
test('unsupported field continuations cannot be accepted by their valid prefix',()=>{
  const r={...record(),field:['effects','frequency']};
  for(const field of ['effects.[1].grantedActions[0]','effects..frequency','effects[key]','effects?.frequency','effects-extra'])assert.ok(inspect('Set "frequency": "each_turn" in '+file+' '+field+'\n'+line(r)).issues.length,field);
});
test('multiline alternatives remain unresolved until the author selects one spelling',()=>{
  const a={...record(),origin:{kind:'new',reason:'A reviewed novel frequency value.'}},b={...record(),field:['timing'],value:'each_caster_turn',origin:{kind:'new',reason:'Another reviewed novel timing value.'}};
  const first='Set "frequency": "each_turn" in '+file,second='set "timing": "each_caster_turn" in '+file;
  for(const prefix of ['Alternatively ','or ','- Alternatively '])assert.ok(inspect(first+'\n'+prefix+second+'\n'+line(a)+'\n'+line(b)).issues.length,prefix);
  assert.equal(inspect(first+'\nHISTORY: Alternatively '+second+'\n'+line(a)).issues.length,0);
});
test('literal strings with escapes are checked without interpreting them as instructions',()=>{
  const value='some "quoted" text',r={...record(),value,origin:{kind:'new',reason:'Parent deliberately adds a quoted label.'}};
  assert.equal(inspect('Set "frequency": '+JSON.stringify(value)+' in '+file+'\n'+line(r)).issues.length,0);
});
test('default reader rejects sources escaping the repo and nonregular sources',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'agora-data-provenance-'));
  try{
    fs.writeFileSync(path.join(root,'value.json'),'{"value":"current"}');assert.equal(readDataValueSource(root,'value.json'),'{"value":"current"}');
    assert.throws(()=>readDataValueSource(root,'../outside.json'),/exact/);
    fs.mkdirSync(path.join(root,'folder.json'));assert.throws(()=>readDataValueSource(root,'folder.json'),/not regular/);
    fs.writeFileSync(path.join(root,'large.json'),' '.repeat(2*1024*1024+1));assert.throws(()=>readDataValueSource(root,'large.json'),/larger than/);
  }finally{assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));assert.match(path.basename(root),/^agora-data-provenance-/);fs.rmSync(root,{recursive:true,force:true});}
});
