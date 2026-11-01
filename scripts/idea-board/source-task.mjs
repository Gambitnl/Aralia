// WF-G294/295: print current identities or a pre-probed source rewrite brief.
// This command never creates Agora tasks, edits records or fetches addresses.
// The parent must still supply actual repair scope, acceptance and ownership.
import {fileURLToPath} from 'node:url';
import {buildIdeaSourceTask,IDEA_BOARD_FILE} from '../../tools/agora/recordSourceProvenance.mjs';
import {readDataValueSource} from '../../tools/agora/dataValueProvenance.mjs';
import {CLIENT_REPO_ROOT} from '../../tools/agora/client-root.mjs';
import {probeIdeaSourceRewrites} from './validate.mjs';
export function generateSourceTask(urls,{repoRoot=CLIENT_REPO_ROOT,readSource=file=>readDataValueSource(repoRoot,file),rewrites}={}){
  const raw=readSource(IDEA_BOARD_FILE);
  if(typeof raw!=='string'||Buffer.byteLength(raw)>2*1024*1024)throw new Error('current board unavailable or exceeds2MiB');
  const data=JSON.parse(raw),brief=buildIdeaSourceTask(data,urls);
  if(rewrites===undefined)return brief;
  // Resolve IDs and current addresses together. Even an attributed rewrite is
  // refused before a task brief exists if its complete proposed board is invalid.
  if(!Array.isArray(rewrites)||rewrites.length!==brief.sourceRecords.length)throw new Error('one rewrite per exact current primary address is required');
  const sourceRewrites=brief.sourceRecords.map(record=>{
    const matches=rewrites.filter(item=>item?.from===record.url);
    if(matches.length!==1||record.addressField!=='url'||Object.keys(matches[0]).sort().join(',')!=='from,reason,to')throw new Error('rewrite needs exact current primary from, to and reason; archive edits are separate');
    return {recordId:record.recordId,sourceId:record.sourceId,...matches[0]};
  });
  const report=probeIdeaSourceRewrites(data,sourceRewrites);
  if(!report.ok){
    const owners=report.collisions.map(c=>'collision '+c.url+' owned by '+c.owners.map(o=>(o.recordId||'excluded')+'/'+o.sourceId+' '+o.path).join(', '));
    const error=new Error('WF-G295 '+[...owners,...report.errors,...report.baselineErrors,...report.proposedErrors].join('; ')+'; parent reconciliation required before filing an edit task');
    error.report=report;throw error;
  }
  const dataValues=report.edits.map((edit,i)=>({file:edit.file,field:edit.field,value:edit.to,origin:{kind:'new',reason:sourceRewrites[i].reason}}));
  return {title:'Rewrite verified current Idea Board primary addresses',refs:brief.refs,sourceRecords:report.sourceRecords,sourceRewrites,dataEdits:report.edits,dataValues,
    body:report.sourceRecords.map(item=>'REFERENCE-ONLY: SOURCE-RECORD: '+JSON.stringify(item)).join('\n')+'\n'
      +sourceRewrites.map(item=>'REFERENCE-ONLY: SOURCE-REWRITE: '+JSON.stringify(item)).join('\n')+'\n'
      +report.edits.map(item=>'REFERENCE-ONLY: DATA-EDIT: '+JSON.stringify(item)).join('\n')+'\n'
      +dataValues.map(item=>'REFERENCE-ONLY: DATA-VALUE: '+JSON.stringify(item)).join('\n')+'\n'
      +'Apply only the complete verified primary-address batch, preserving IDs, exclusions and all other research data. Re-run the owning validator before filing and after locking. Parent must add bounded ownership and semantic acceptance; this probe does not fetch addresses or prove reachability.'};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{
    const args=process.argv.slice(2);
    if(args[0]==='--rewrite'){
      if(args.length!==5||args[3]!=='--reason')throw new Error('usage: --rewrite <exact-current-primary-url> <new-url> --reason <reviewed-intent>');
      console.log(JSON.stringify(generateSourceTask([args[1]],{rewrites:[{from:args[1],to:args[2],reason:args[4]}]}),null,2));
    }else console.log(JSON.stringify(generateSourceTask(args),null,2));
  }
  catch(error){console.error('source-task refused: '+error.message);process.exitCode=1;}
}
