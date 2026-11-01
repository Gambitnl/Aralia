/**
 * WF-G266: keep a visual review pending on the existing board when build work
 * is handed to a worker who cannot inspect or tune it. The coordinator creates
 * two linked tasks, not a new task state. Exact records and blocking dependencies
 * are checked before dispatch; they do not certify rendered proof or grant edits.
 * Creation and append are separate requests. An uncertain response needs record
 * inspection and explicit resume, never automatic mutation retry or rollback.
 */
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import path from 'node:path';
import {hasMagic} from 'glob';
import {run as clientRun} from './client.mjs';
import {normalizeTaskDeps,isBlockingDepType} from './store.mjs';
import {indexGaps} from './gapIndex.mjs';
import {fileURLToPath} from 'node:url';
import {isVisualBuildOnlyTask,canonicalVisualDeliveryRefs,visualReviewDeliveryIssue} from './visualTaskKind.mjs';

const TASK=/^agora-[a-z0-9]+(?:\.[0-9]+)*$/i;
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const fail=message=>{throw new Error('WF-G266 '+message);};
const exactKeys=(value,keys,label)=>{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))fail(label+' has invalid or unknown fields');
};
const text=(value,label,max=4096)=>{
  if(typeof value!=='string'||!value.trim()||value.length>max)fail(label+' needs bounded nonblank text');
  return value.trim();
};

function reviewFields(value) {
  exactKeys(value.reviewer,['agentId','handle'],'reviewer');
  if(!UUID.test(value.reviewer.agentId||''))fail('reviewer needs an exact registered agent UUID');
  const handle=text(value.reviewer.handle,'reviewer handle',128);
  if(!/^[a-z0-9][a-z0-9._-]*$/i.test(handle)||['orchestrator','master','human','worker','agent'].includes(handle.toLowerCase()))fail('reviewer needs a named identity, not a role');
  exactKeys(value.visualProof,['url','acceptance'],'visualProof');
  let url;try{url=new URL(value.visualProof.url);}catch{}
  if(!url||!['http:','https:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.username||url.password)fail('visualProof needs a credential-free running loopback surface');
  const acceptance=text(value.visualProof.acceptance,'visual acceptance');
  if(!Array.isArray(value.tuningFiles)||value.tuningFiles.length>64)fail('tuningFiles needs an explicit array of at most64 exact paths; [] means inspection only');
  const tuningFiles=value.tuningFiles.map(file=>{
    if(typeof file!=='string'||!file||file.length>512||file.includes('\\')||path.posix.normalize(file)!==file||path.posix.isAbsolute(file)||/^[a-z]:/i.test(file)||file.split('/').some(part=>part==='..'||part==='.')||hasMagic(file,{magicalBraces:true}))fail('tuningFiles must name exact relative paths');
    return file;
  });
  if(new Set(tuningFiles).size!==tuningFiles.length)fail('duplicate tuning file');
  return {reviewer:{agentId:value.reviewer.agentId,handle},visualProof:{url:url.href,acceptance},tuningFiles,buildAcceptance:text(value.buildAcceptance,'build acceptance')};
}

export function validateVisualSplit(plan,input) {
  exactKeys(input,['id','packetId','buildAcceptance','reviewer','visualProof','tuningFiles'],'visual split');
  const id=text(input.id,'split id',64);
  if(!/^[a-z0-9][a-z0-9_-]*$/i.test(id))fail('split id needs a stable alphanumeric key');
  const packet=(plan.packets||[]).find(p=>p.id===input.packetId);
  if(!packet)fail('packetId must name an existing build packet');
  if((packet.taskIds||[]).length||(packet.refs||[]).some(x=>TASK.test(x))||(packet.issues||[]).some(x=>TASK.test(x))||packet.visualHandoff)fail('split at creation, not by duplicating an already assigned task; reconcile existing work manually');
  const fields=reviewFields(input);
  if(fields.buildAcceptance===fields.visualProof.acceptance)fail('build and rendered acceptance must be separate');
  return {id,packetId:packet.id,...fields};
}

export function validateVisualHandoff(record) {
  exactKeys(record,['splitId','buildTask','followUpTask','buildAcceptance','reviewer','visualProof','tuningFiles','buildPrerequisites','deliveryRefs'],'visual handoff');
  if(!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(record.splitId||'')||!TASK.test(record.buildTask||'')||!TASK.test(record.followUpTask||'')||record.buildTask===record.followUpTask)fail('visual handoff needs distinct exact build/review tasks and stable splitId');
  const fields=reviewFields(record);
  const buildPrerequisites=record.buildPrerequisites||[];
  if(!Array.isArray(buildPrerequisites)||buildPrerequisites.length>128||new Set(buildPrerequisites).size!==buildPrerequisites.length||buildPrerequisites.some(id=>!TASK.test(id)||[record.buildTask,record.followUpTask].includes(id)))fail('buildPrerequisites must name distinct exact predecessor tasks');
  const deliveryRefs=record.deliveryRefs||[];
  if(!Array.isArray(deliveryRefs)||deliveryRefs.length>128||new Set(deliveryRefs).size!==deliveryRefs.length||deliveryRefs.some(ref=>typeof ref!=='string'||ref.length>512||!(/^[a-z0-9_.-]+(?::[a-z0-9_.-]+)?$/i.test(ref)||/^planmap:[a-z0-9-]+(?:\/[a-z0-9-]+)?$/.test(ref))))fail('deliveryRefs must retain bounded canonical metadata refs, not file paths');
  return {splitId:record.splitId,buildTask:record.buildTask,followUpTask:record.followUpTask,...fields,buildPrerequisites,deliveryRefs};
}

export const visualHandoffLine=record=>'REFERENCE-ONLY: VISUAL-HANDOFF: '+JSON.stringify(validateVisualHandoff(record));
export const visualReviewLine=record=>'REFERENCE-ONLY: VISUAL-REVIEW: '+JSON.stringify(validateVisualHandoff(record));
export function validateVisualPacket(packet) {
  if(packet.visualHandoff&&packet.visualReview)fail('packet cannot be both build and review');
  if(!packet.visualHandoff&&!packet.visualReview)return null;
  const record=validateVisualHandoff(packet.visualHandoff||packet.visualReview);
  const selected=[...(packet.taskIds||[]),...(packet.refs||[]),...(packet.issues||[])].filter(id=>TASK.test(id));
  if(packet.visualReview){
    if(!selected.includes(record.followUpTask)||selected.some(id=>id!==record.followUpTask))fail('review packet must select only its exact assigned review task');
    if(packet.handle!==record.reviewer.handle||packet.scope!==record.visualProof.acceptance||!isDeepStrictEqual(packet.visualProof,record.visualProof))fail('review packet must retain the named reviewer, rendered acceptance and surface');
    if(!Array.isArray(packet.files)||!isDeepStrictEqual([...packet.files].sort(),[...record.tuningFiles].sort()))fail('review packet files must equal the explicit tuning files; no additional grants');
    return record;
  }
  if(!selected.includes(record.buildTask))fail('packet must retain its exact assigned visual build task');
  if(packet.scope!==record.buildAcceptance)fail('packet scope must equal reviewed build-only acceptance');
  return record;
}
function declarations(task,label) {
  const lines=(task.body||'').split(/\r?\n/).map(line=>line.replace(/^REFERENCE-ONLY: /,'')).filter(line=>line.startsWith(label+':'));
  if(lines.length!==1)fail('task '+task.id+' must retain exactly one '+label+' declaration');
  try{return validateVisualHandoff(JSON.parse(lines[0].slice(label.length+1)));}catch(error){fail('task '+task.id+' '+error.message);}
}

/** Recheck current exact tasks. A record is ownership routing, not visual proof. */
export function inspectVisualHandoff(packet,build,tasks) {
  const reviewDeclared=(build.body||'').split(/\r?\n/).some(line=>/^(?:REFERENCE-ONLY: )?VISUAL-REVIEW:/.test(line));
  if(packet.visualReview||reviewDeclared){
    if(!packet.visualReview)fail('review packet omits durable reviewer identity and rendered acceptance');
    const record=validateVisualPacket(packet);
    if(record.followUpTask!==build.id||!isDeepStrictEqual(declarations(build,'VISUAL-REVIEW'),record))fail('current review task and packet differ');
    const matches=tasks.filter(task=>task.id===record.buildTask);
    if(matches.length!==1||matches[0].state!=='done')fail('review requires its exact completed build prerequisite');
    inspectVisualHandoff({scope:record.buildAcceptance,visualHandoff:record},matches[0],tasks);
    return {buildTask:record.buildTask,followUpTask:build.id,reviewer:record.reviewer,acceptancePending:true};
  }
  const declared=(build.body||'').split(/\r?\n/).some(line=>/^(?:REFERENCE-ONLY: )?VISUAL-HANDOFF:/.test(line));
  if(!packet.visualHandoff&&!declared)return null;
  if(!packet.visualHandoff)fail('packet omits the durable visual handoff; parent must reconcile it');
  const record=validateVisualHandoff(packet.visualHandoff);
  if(packet.scope!==record.buildAcceptance)fail('packet scope must equal the reviewed build-only acceptance, not the original combined purpose');
  if(record.buildTask!==build.id||!isDeepStrictEqual(declarations(build,'VISUAL-HANDOFF'),record))fail('current build task and packet visual handoff differ');
  for(const taskId of record.buildPrerequisites){
    const predecessor=tasks.filter(task=>task.id===taskId);
    if(predecessor.length!==1||predecessor[0].campaignId!==build.campaignId||!normalizeTaskDeps(build.deps).some(dep=>dep.id===taskId&&isBlockingDepType(dep.type)))fail('build lost its exact same-campaign blocking prerequisite '+taskId);
  }
  const matches=tasks.filter(task=>task.id===record.followUpTask);
  if(matches.length!==1)fail('visual follow-up absent or ambiguous');
  const review=matches[0];
  if(!build.campaignId||review.campaignId!==build.campaignId||!['open','claimed','blocked'].includes(review.state))fail('visual follow-up must remain unfinished in the build campaign');
  if(review.claimedBy&&review.claimedBy!==record.reviewer.agentId)fail('visual follow-up is claimed by another identity; reconcile owner');
  if(!isDeepStrictEqual(declarations(review,'VISUAL-REVIEW'),record))fail('visual follow-up scope/owner/surface changed; reconcile acceptance');
  if(!normalizeTaskDeps(review.deps).some(dep=>dep.id===build.id&&isBlockingDepType(dep.type)))fail('visual follow-up needs a blocking dependency on this exact build task');
  for(const file of record.tuningFiles)if(!(review.refs||[]).includes(file))fail('visual follow-up lacks tuning file ref '+file);
  for(const ref of record.deliveryRefs)if(!(review.refs||[]).includes(ref))fail('visual follow-up lost canonical delivery ref '+ref);
  const repo=fileURLToPath(new URL('../../',import.meta.url));
  const gaps=[...indexGaps({root:path.join(repo,'docs/projects')}),...indexGaps({root:path.join(repo,'tools/agora')})];
  if(!isDeepStrictEqual(canonicalVisualDeliveryRefs(review,record.deliveryRefs,gaps),[...record.deliveryRefs].sort()))fail('visual follow-up canonical delivery refs exceed or contradict the declared acceptance');
  return {buildTask:build.id,followUpTask:review.id,reviewer:record.reviewer,acceptancePending:true};
}

/** Finished build work never hides a missing, blocked or contradictory review,
 * even when an old tracking map omitted the review task. This reports board
 * acceptance only; it cannot certify the reviewer's screenshot or result. */
export function visualAcceptancePending(seededMap,tasks) {
  const pending=[],seen=new Set();
  for(const [packetId,taskId] of Object.entries(seededMap)){
    const tracked=tasks.find(task=>task.id===taskId);
    const isBuild=isVisualBuildOnlyTask(tracked);
    const isReview=(tracked?.body||'').split(/\r?\n/).some(line=>/^(?:REFERENCE-ONLY: )?VISUAL-REVIEW:/.test(line));
    // Recover a reverse link when the build declaration was lost and the caller
    // omitted review tracking. No unrelated campaign review is inferred.
    const reverse=[];
    if(!isBuild&&!isReview)for(const candidate of tasks){
      if(candidate.campaignId!==tracked?.campaignId||!(candidate.body||'').includes('VISUAL-REVIEW:'))continue;
      try{const record=declarations(candidate,'VISUAL-REVIEW');if(record.buildTask===taskId)reverse.push(record);}catch{}
    }
    if(!isBuild&&!isReview&&!packetId.endsWith(':visual')&&!reverse.length)continue;
    let record;
    try{
      if(!tracked)fail('tracked visual acceptance task is missing');
      if(reverse.length>1)fail('ambiguous reverse visual review links');
      record=reverse[0]||declarations(tracked,isBuild?'VISUAL-HANDOFF':'VISUAL-REVIEW');
      if(seen.has(record.buildTask))continue;
      seen.add(record.buildTask);
      const builds=tasks.filter(task=>task.id===record.buildTask),build=builds[0];
      if(builds.length!==1)fail('visual build absent or ambiguous');
      const reviews=tasks.filter(task=>task.id===record.followUpTask),review=reviews[0];
      if((isBuild||reverse.length?record.buildTask:record.followUpTask)!==tracked.id||reviews.length!==1)fail('visual follow-up absent or ambiguous');
      if(build.state==='done'&&review.state==='done'){
        const issue=visualReviewDeliveryIssue(review,tasks);
        if(issue)fail(issue);
      }
      // Reuse the preflight's owner/dependency/content checks without pretending
      // that a done review is an unfinished dispatch candidate.
      inspectVisualHandoff({scope:record.buildAcceptance,visualHandoff:record},build,
        tasks.map(task=>task.id===review.id&&task.state==='done'?{...task,state:'open'}:task));
      if(build.state!=='done'||review.state!=='done')pending.push({packetId,taskId:review.id,state:review.state,reason:'rendered acceptance remains '+review.state});
    }catch(error){pending.push({packetId,taskId:record?.followUpTask||taskId,state:'invalid',reason:error.message});}
  }
  return pending;
}

export function visualReviewPrompt(packet) {
  const record=validateVisualPacket(packet);
  if(!packet.visualReview)fail('expected an explicit review packet');
  const scoped=packet.agent==='codex'||packet.agent==='gemini'
    ? `$env:AGORA_AGENT_ID='${record.reviewer.handle}'; node tools/agora/client.mjs`
    : `AGORA_AGENT_ID=${record.reviewer.handle} node tools/agora/client.mjs`;
  return `EXISTING REVIEWER HANDOFF (WF-G266): ${record.reviewer.handle} (${record.reviewer.agentId}).\n`
    +`Deliver this to the already registered reviewer, not a newly spawned worker. Run ${scoped} whoami --live and stop unless agentId is exactly ${record.reviewer.agentId} with the original current session. Do not register a replacement identity.\n`
    +`Re-read ${record.buildTask} and ${record.followUpTask}; claim only the latter after its build dependency is done and current records still agree.\n`
    +`Rendered acceptance: ${record.visualProof.acceptance}\nRunning surface: ${record.visualProof.url}\n`
    +`Authorized tuning files: ${record.tuningFiles.join(', ')||'none; inspection only'}. Acquire narrow locks before any edit; preserve prior work and do not release pre-existing locks.\n`
    +`Inspect actual rendered output and record ignored capture paths plus focused verification. Missing proof or out-of-scope tuning stays blocked. No server start/restart, new command permission or overall completion from source alone.\n`
    +`Close only ${record.followUpTask} with fresh evidence after meeting the acceptance. Release only locks acquired for this review, using their exact IDs. Do not retire this pre-existing reviewer or run unlock --mine.\n`
    +visualReviewLine(record);
}

export function visualHandoffPrompt(packet) {
  if(!packet.visualHandoff)return '';
  const r=validateVisualPacket(packet);
  return 'VISUAL ACCEPTANCE HANDOFF (WF-G266):\n'+visualHandoffLine(r)
    +'\nBuild-only acceptance: '+r.buildAcceptance+'. Close only that assigned build acceptance with current proof. '
    +'Rendered review and tuning remain pending on '+r.followUpTask+' for '+r.reviewer.handle+' ('+r.reviewer.agentId+'). '
    +'Do not claim overall visual completion, perform deferred tuning or silently widen file/command permissions. '
    +'Re-read both exact tasks before work/completion; missing, completed, contradictory or differently claimed review work requires parent reconciliation. '
    +'The reviewer must use the named running surface, inspect actual rendered proof and acquire authorized tuning locks in a separate packet. No server start/restart or proof is granted by this handoff.';
}

/** Create both durable tasks before a build worker receives the packet. */
export async function createVisualSplit(plan,input,{env=process.env,run=clientRun,taskBody,dryRun=false}={}) {
  const split=validateVisualSplit(plan,input),packet=plan.packets.find(p=>p.id===split.packetId);
  if(typeof taskBody!=='function')fail('authoring needs the existing packet body renderer');
  const context={env,baseUrl:plan.baseUrl};
  const identity=await run(['whoami','--live'],context);
  if(identity.code!==0||!identity.live||!['orchestrator','master','human'].includes(identity.agent?.role))fail('split requires a live scoped coordinator; no registration performed');
  const campaign=await run(['campaign','show',plan.campaign?.id||plan.campaignId],context);
  if(campaign.code!==0||!campaign.view?.campaign?.id)fail('existing campaign cannot be verified');
  const campaignId=campaign.view.campaign.id;
  const roster=await run(['agents'],context);
  if(roster.code!==0||!roster.agents?.some(agent=>agent.id===split.reviewer.agentId&&agent.handle===split.reviewer.handle&&agent.status==='online'))fail('reviewer exact UUID/handle must match the current online roster; no inferred role owner');
  const snapshot=await run(['tasks'],context);
  if(snapshot.code!==0||!Array.isArray(snapshot.tasks))fail('task snapshot unavailable');
  // A task split changes acceptance, not execution order. Resolve every planned
  // prerequisite before writing; an unseeded predecessor cannot disappear.
  const prerequisites=[];
  for(const id of packet.after||[]){
    const matches=plan.packets.filter(candidate=>candidate.id===id);
    if(matches.length!==1||id===packet.id)fail('prerequisite packet absent, ambiguous or self-referencing: '+id);
    const predecessor=matches[0];
    const ids=[...new Set([...(predecessor.taskIds||[]),...(predecessor.refs||[]),...(predecessor.issues||[])].filter(value=>TASK.test(value)))];
    if(!ids.length)fail('prerequisite packet '+id+' has no exact seeded task identities');
    for(const taskId of ids){
      const current=snapshot.tasks.filter(task=>task.id===taskId);
      if(current.length!==1||current[0].campaignId!==campaignId)fail('prerequisite task unavailable or in another campaign: '+taskId);
      if(!prerequisites.includes(taskId))prerequisites.push(taskId);
    }
  }
  const digest=createHash('sha256').update(JSON.stringify({split,packet,prerequisites})).digest('hex');
  // Keep canonical completion routing on the reviewer, without copying source
  // paths that would falsely imply ownership of the builder's implementation.
  const repo=fileURLToPath(new URL('../../',import.meta.url));
  const gaps=[...indexGaps({root:path.join(repo,'docs/projects')}),...indexGaps({root:path.join(repo,'tools/agora')})];
  const deliveryRefs=canonicalVisualDeliveryRefs({refs:[...(packet.refs||[]),...(packet.issues||[])]},[],gaps);
  const marker=`VISUAL SPLIT [${campaignId}/${split.id}]`;
  const buildPacket={...packet,scope:split.buildAcceptance};delete buildPacket.visualProof;
  const bodies={build:`${marker} BUILD sha256=${digest}\nREFERENCE-ONLY: Original combined purpose: ${JSON.stringify(packet.scope)}\n${taskBody(buildPacket)}\nVisual acceptance belongs to a separate dependent review; this build task is not overall feature acceptance. Do not dispatch until its VISUAL-HANDOFF is durable.`,
    review:`${marker} REVIEW sha256=${digest}\nVisual reviewer: ${split.reviewer.handle} (${split.reviewer.agentId}).\nAcceptance: ${split.visualProof.acceptance}\nRunning surface: ${split.visualProof.url}\nOwned tuning files: ${split.tuningFiles.join(', ')||'none; inspection only'}.\nAttach to the named existing server; inspect a fresh ignored capture. Tests/source are not rendered acceptance. Keep verification and approval limits; no server start/restart, broad command or unowned edit. Claim only as the named reviewer after the build dependency is done. Missing proof or required out-of-scope tuning remains blocked, not done.`};
  const found={};
  for(const task of snapshot.tasks.filter(task=>task.campaignId===campaignId)){
    if(!(task.body||'').includes(marker))continue;
    const role=Object.keys(bodies).find(key=>(task.body||'').startsWith(bodies[key]));
    if(!role||found[role])fail('split id has conflicting/duplicate durable records; inspect and use newly reviewed identity, not automatic retry');
    found[role]=task;
  }
  const receipt={splitId:split.id,campaignId,digest,dryRun,created:[],alreadyPresent:Object.values(found).map(task=>task.id),linked:false,buildTask:found.build?.id,reviewTask:found.review?.id};
  if(dryRun)return receipt;
  try{
    for(const role of ['build','review']){
      if(found[role])continue;
      const args=['task','new',`${packet.id}: ${role==='build'?'build only':'visual review + tune'} (${split.id})`,'--campaign',campaignId,'--wave',String(plan.wave||campaignId),'--body',bodies[role]];
      for(const ref of role==='build'?[...(packet.refs||[]),...(packet.issues||[])]:[...new Set([...split.tuningFiles,...deliveryRefs])])args.push('--ref',ref);
      if(role==='build')for(const taskId of prerequisites)args.push('--dep',taskId);
      if(role==='review')args.push('--dep',found.build.id,'--ref','task:'+found.build.id);
      const result=await run(args,context);
      if(result.code!==0||!result.task?.id||result.task.body!==bodies[role])fail('task creation response unverified; inspect tasks before explicit resume, no automatic retry');
      found[role]=result.task;receipt.created.push(result.task.id);receipt[role==='build'?'buildTask':'reviewTask']=result.task.id;
    }
    const record={splitId:split.id,buildTask:found.build.id,followUpTask:found.review.id,...reviewFields(split),buildPrerequisites:prerequisites,deliveryRefs};
    for(const role of ['review','build']){
      const fresh=await run(['task','show',found[role].id],context),line=role==='build'?visualHandoffLine(record):visualReviewLine(record);
      if(fresh.code!==0||fresh.task?.campaignId!==campaignId||!(fresh.task.body||'').startsWith(bodies[role]))fail('task changed before handoff append; inspect before resume');
      if((fresh.task.body||'').includes(line))continue;
      if(fresh.task.state==='done'||(fresh.task.body||'').includes(role==='build'?'VISUAL-HANDOFF:':'VISUAL-REVIEW:'))fail('completed or conflicting task cannot receive a new split declaration');
      const appended=await run(['task','edit',found[role].id,'--append-body',line,'--reason','WF-G266 durable separate visual acceptance'],context);
      if(appended.code!==0||!appended.task?.body?.includes(line))fail('handoff append unverified; inspect durable records before explicit resume, no automatic retry');
    }
    const current=await run(['tasks'],context);if(current.code!==0||!Array.isArray(current.tasks))fail('final split verification unavailable; inspect before resume');
    const build=current.tasks.find(task=>task.id===record.buildTask);
    const review=current.tasks.find(task=>task.id===record.followUpTask);
    for(const ref of deliveryRefs)if(!(review?.refs||[]).includes(ref))fail('visual review lost canonical delivery ref '+ref+'; inspect before resume');
    for(const taskId of prerequisites)if(!normalizeTaskDeps(build?.deps).some(dep=>dep.id===taskId&&isBlockingDepType(dep.type)))fail('build lost its blocking prerequisite '+taskId+'; inspect before resume');
    inspectVisualHandoff({...buildPacket,visualHandoff:record},build,current.tasks);
    receipt.linked=true;receipt.visualHandoff=record;receipt.packet={...buildPacket,taskIds:[record.buildTask],visualHandoff:record};receipt.tracking={[packet.id]:record.buildTask,[packet.id+':visual']:record.followUpTask};
    // Lane/pet settings must be supplied from the actual reviewer's roster by
    // the parent. This fragment does not authorize spawning that identity.
    receipt.reviewPacket={id:packet.id+':visual',handle:split.reviewer.handle,scope:split.visualProof.acceptance,files:[...split.tuningFiles],taskIds:[record.followUpTask],visualProof:split.visualProof,visualReview:record};
    return receipt;
  }catch(error){error.receipt=receipt;error.message+='\nSplit receipt: '+JSON.stringify(receipt);throw error;}
}
