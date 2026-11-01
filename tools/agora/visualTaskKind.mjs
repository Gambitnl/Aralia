/**
 * WF-G266: identify tasks that deliver only the build portion of a visual split.
 * Plan Map and gap reconciliation share this check so a finished build cannot
 * stand in for rendered acceptance. It reads supplied text only, performs no IO,
 * and treats damaged handoff metadata conservatively rather than certifying it.
 */
import {isDeepStrictEqual} from 'node:util';
// Mirror the existing board vocabulary without importing its writer. The
// read-only dependency audit and parity test protect this pure projection.
const blockingTypes=new Set(['blocks','parent-child','waits-for','conditional-blocks']);
const dependencyTypes=new Set([...blockingTypes,'related','tracks','discovered-from','caused-by','validates','supersedes']);
const normalizedDeps=task=>{
  const deps=Array.isArray(task.deps)?task.deps:task.deps?[task.deps]:[];
  return deps.filter(Boolean).flatMap(dep=>{
    const id=typeof dep==='string'?dep.trim():String(dep.id||'').trim();
    if(!id)return [];
    const type=typeof dep==='string'?'blocks':String(dep.type||'blocks').trim();
    if(!dependencyTypes.has(type))throw new Error('unknown dependency type: '+type);
    return [{id,type}];
  });
};
const hasBlockingDep=(deps,id)=>deps.some(dep=>dep.id===id&&blockingTypes.has(dep.type));
export const visualBlockingDepTypes=Object.freeze([...blockingTypes]);
export const visualDependencyTypes=Object.freeze([...dependencyTypes]);

export function isVisualBuildOnlyTask(task) {
  const body = typeof task?.body === 'string' ? task.body : '';
  return /^(?:REFERENCE-ONLY: )?VISUAL-HANDOFF:/m.test(body)
    || /^VISUAL SPLIT \[[^\]\r\n]+\] BUILD sha256=/m.test(body);
}

export function isVisualReviewTask(task) {
  const body=typeof task?.body==='string'?task.body:'';
  return /^(?:REFERENCE-ONLY: )?VISUAL-REVIEW:/m.test(body)
    || /^VISUAL SPLIT \[[^\]\r\n]+\] REVIEW sha256=/m.test(body);
}

/** Keep completion routing exact. Each projection supplies the canonical gaps
 * it knows; Plan Map always checks its own refs. This checks record ownership
 * and routing, not screenshot quality or the semantics of the parent's proof. */
export function canonicalVisualDeliveryRefs(task,recordRefs=[],gaps=[]) {
  // Archived workflow rows may be outside the active table parser. Their
  // explicit namespace still routes completion and must not bypass this check.
  const known=new Set([...recordRefs,...gaps.flatMap(gap=>[gap.id,`${gap.project}:${gap.id}`])].map(ref=>ref.toLowerCase()));
  return [...new Set((task.refs||[]).filter(ref=>typeof ref==='string'
    && (/^planmap:[a-z0-9-]+(?:\/[a-z0-9-]+)?$/.test(ref)
      ||/^(?:workflow:)?WF-G\d+$/i.test(ref)||known.has(ref.toLowerCase()))))].sort();
}

export function visualReviewDeliveryIssue(review,tasks,gaps=[]) {
  if(!isVisualReviewTask(review))return null;
  try{
    const declaration=(task,label)=>{
      const lines=(task.body||'').split(/\r?\n/).map(line=>line.replace(/^REFERENCE-ONLY: /,'')).filter(line=>line.startsWith(label+':'));
      if(lines.length!==1)throw new Error('missing or ambiguous '+label);
      const record=JSON.parse(lines[0].slice(label.length+1));
      if(!record||typeof record!=='object'||Array.isArray(record))throw new Error('invalid split record');
      return record;
    };
    const record=declaration(review,'VISUAL-REVIEW');
    const builds=tasks.filter(task=>task.id===record.buildTask),build=builds[0];
    if(record.followUpTask!==review.id||builds.length!==1||build.state!=='done'
      ||!review.campaignId||review.campaignId!==build.campaignId)throw new Error('wrong review/build identity, campaign or unfinished build');
    if(!record.reviewer||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(record.reviewer.agentId||'')
      ||review.claimedBy!==record.reviewer.agentId)throw new Error('completion is not owned by the named reviewer');
    if(!isDeepStrictEqual(declaration(build,'VISUAL-HANDOFF'),record))throw new Error('build/review routing records differ');
    const reviewDeps=normalizedDeps(review),buildDeps=normalizedDeps(build);
    if(!hasBlockingDep(reviewDeps,build.id))throw new Error('review lost its blocking build dependency');
    if(!Array.isArray(record.buildPrerequisites)||!Array.isArray(record.tuningFiles))throw new Error('missing prerequisite or tuning declarations');
    for(const id of record.buildPrerequisites){
      const matches=tasks.filter(task=>task.id===id);
      if(matches.length!==1||matches[0].campaignId!==build.campaignId||matches[0].state!=='done'
        ||!hasBlockingDep(buildDeps,id))throw new Error('build lost a completed same-campaign prerequisite');
    }
    if(record.tuningFiles.some(file=>typeof file!=='string'||!review.refs?.includes(file)))throw new Error('review lost tuning file refs');
    if(!Array.isArray(record.deliveryRefs)||record.deliveryRefs.length>128||record.deliveryRefs.some(ref=>typeof ref!=='string'))throw new Error('missing or invalid delivery refs');
    const expected=[...record.deliveryRefs].sort();
    if(!isDeepStrictEqual(canonicalVisualDeliveryRefs(review,expected,gaps),expected))throw new Error('canonical delivery refs differ from the declared acceptance');
    return null;
  }catch(error){return 'WF-G266 review delivery held: '+error.message;}
}
