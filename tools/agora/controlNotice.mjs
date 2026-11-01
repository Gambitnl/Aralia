/**
 * WF-G305/WF-G334/WF-G323/WF-G307/WF-G246: carry shared controls, capability and audit-scope corrections,
 * recorded owner rulings or source preservation reviews into durable task bodies. Reuse the board's
 * atomic append operation, never read/replace a sibling body. Delivery is per
 * task, not a cross-task transaction; failures expose explicit-resume receipts.
 * The caller inventories tests and reviews capability evidence. Exact claim
 * matching is not semantic truth, owner consent or current-host proof. No notice grants
 * ownership, edits game code, restarts a daemon, or dispatches a worker.
 */
import path from 'node:path';
import { createHash } from 'node:crypto';
import { hasMagic } from 'glob';
import { run as clientRun } from './client.mjs';
import { packetTaskIds } from './packetOwnership.mjs';
import { lockOverlap } from './store.mjs';
import { isDeepStrictEqual } from 'node:util';
import { captureSourceReview, inspectSourceReviews, inspectSourceCitations, readCitationSource } from './taskLint.mjs';

function text(value, label, max = 512) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label} needs nonblank text (max ${max})`);
  return value.trim();
}

/** Map every inventoried test to exactly one current packet before any write. */
export function controlNoticeRecipients(plan, notice, { repoRoot = process.cwd() } = {}) {
  if (!plan || !Array.isArray(plan.packets) || !plan.packets.length) throw new Error('control notice needs a packet plan');
  if (!notice || typeof notice !== 'object' || Array.isArray(notice)) throw new Error('control notice must be an object');
  const fields = new Set(['id', 'fromPacket', 'oldControl', 'replacement', 'affectedTests', 'evidence']);
  for (const name of Object.keys(notice)) if (!fields.has(name)) throw new Error('unknown control notice field: ' + name);
  const id = text(notice.id, 'notice id', 64);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) throw new Error('notice id must be a stable alphanumeric/hyphen/underscore key');
  const fromPacket = text(notice.fromPacket, 'fromPacket');
  const packets = new Map();
  for (const packet of plan.packets) {
    if (!packet.id || packets.has(packet.id)) throw new Error('control notice needs unique packet ids');
    packets.set(packet.id, packet);
  }
  if (!packets.has(fromPacket)) throw new Error('unknown retiring packet: ' + fromPacket);
  if (!Array.isArray(notice.affectedTests) || !notice.affectedTests.length) throw new Error('inventory affectedTests before publishing');
  const affectedTests = [...new Set(notice.affectedTests.map(value => {
    const file = text(value, 'affected test path').replace(/\\/g, '/').replace(/^\.\//, '');
    if (path.isAbsolute(file) || /^[A-Za-z]:/.test(file) || file.split('/').includes('..')
      || hasMagic(file, { magicalBraces: true }) || !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)) {
      throw new Error('affectedTests must name exact repository-relative test files: ' + value);
    }
    return file;
  }))].sort();
  const recipientIds = new Set([fromPacket]);
  for (const file of affectedTests) {
    const owners = plan.packets.filter(packet => lockOverlap([file], { paths: packet.files || [], globs: [] }, repoRoot));
    if (owners.length !== 1) throw new Error(`${file} has ${owners.length} packet owners; assign exactly one before publishing`);
    recipientIds.add(owners[0].id);
  }
  const normalized = { id, fromPacket, oldControl: text(notice.oldControl, 'oldControl'),
    replacement: text(notice.replacement, 'replacement'), affectedTests, evidence: text(notice.evidence, 'evidence', 4096) };
  if (normalized.oldControl === normalized.replacement) throw new Error('replacement must differ from the old control');
  return { notice: normalized, packets: [...recipientIds].sort().map(id => packets.get(id)) };
}

export function controlNoticeBody(campaignId, notice) {
  const digest = createHash('sha256').update(JSON.stringify(notice)).digest('hex');
  const marker = `SHARED CONTROL CHANGE [${campaignId}/${notice.id}]`;
  const body = [
    `${marker} sha256=${digest}`,
    `Retiring packet: ${notice.fromPacket}`,
    `REFERENCE-ONLY: Old control: ${JSON.stringify(notice.oldControl)}`,
    `REFERENCE-ONLY: Replacement: ${JSON.stringify(notice.replacement)}`,
    `REFERENCE-ONLY: Inventoried affected tests: ${notice.affectedTests.join(', ')}`,
    `REFERENCE-ONLY: Evidence: ${JSON.stringify(notice.evidence)}`,
    'Required action: recheck the old control in your owned affected tests before verification or completion; use the replacement and record actual proof or a blocker.',
    'Ownership and command limits are unchanged. Unlisted consumers still need review; this notice is not a complete runtime graph or proof that tests were repaired.',
    `END ${marker}`,
  ].join('\n');
  return { marker, body, digest };
}

/** Use the current authenticated coordinator scope; never register a new agent. */
export async function publishControlNotice(plan, notice, {
  seededMap = {}, env = process.env, run = clientRun, dryRun = false, repoRoot = process.cwd(),
} = {}) {
  const prepared = controlNoticeRecipients(plan, notice, { repoRoot });
  const context = { env, baseUrl: plan.baseUrl };
  const identity = await run(['whoami', '--live'], context);
  if (identity.code !== 0 || !identity.live || !['orchestrator', 'master', 'human'].includes(identity.agent?.role)) {
    throw new Error('control notices require a live orchestrator/master/human in the current AGORA_AGENT_ID scope');
  }
  const campaignName = plan.campaign?.id || plan.campaignId;
  if (!campaignName) throw new Error('control notice plan must name its existing campaign id');
  const campaign = await run(['campaign', 'show', campaignName], context);
  if (campaign.code !== 0 || !campaign.view?.campaign?.id) throw new Error('control notice campaign could not be verified');
  const campaignId = campaign.view.campaign.id;
  const snapshot = await run(['tasks'], context);
  if (snapshot.code !== 0 || !Array.isArray(snapshot.tasks)) throw new Error('control notice task snapshot unavailable; no notice sent');
  const byId = new Map(snapshot.tasks.map(task => [task.id, task]));
  const payload = controlNoticeBody(campaignId, prepared.notice);
  const targets = new Map();
  // Preflight ALL recipients before the first append. Full current task ids
  // avoid ambiguous prefixes; seed maps and assigned legacy tasks both count.
  for (const packet of prepared.packets) {
    const ids = [...new Set([seededMap[packet.id], ...packetTaskIds(packet)].filter(Boolean))];
    if (!ids.length) throw new Error(`packet ${packet.id} has no board task; seed or assign it first`);
    for (const id of ids) {
      const task = byId.get(id);
      if (!task) throw new Error(`packet ${packet.id}: current exact task ${id} not found`);
      if (task.campaignId !== campaignId) throw new Error(`task ${id} belongs to another campaign; no notice sent`);
      const body = task.body || '';
      const present = body.includes(payload.body);
      if (!present && body.includes(payload.marker)) throw new Error(`notice ${prepared.notice.id} already has different content on ${id}; use a new id`);
      if (!present && task.state === 'done') throw new Error(`task ${id} is done; publish before the retiring/affected packet closes`);
      if (targets.has(id) && targets.get(id).packetId !== packet.id) throw new Error(`task ${id} is assigned to multiple recipient packets`);
      targets.set(id, { id, packetId: packet.id, present });
    }
  }
  const receipt = { noticeId: prepared.notice.id, campaignId, digest: payload.digest,
    dryRun, targets: [...targets.values()], appended: [], alreadyPresent: [], broadcast: false };
  const message = `SHARED CONTROL CHANGE ${campaignId}/${prepared.notice.id}: ${prepared.notice.oldControl} -> ${prepared.notice.replacement}. Durable notice on ${[...targets.keys()].join(', ')}. Re-read task show before testing/completion; ownership unchanged.`;
  return deliverNotice(receipt, payload, { dryRun, run, context,
    reason: `WF-G305 control notice ${prepared.notice.id}`, message });
}

// Both notice kinds use the same bounded append/verify delivery. A failed
// response can follow a successful write, so inspection must precede resuming.
async function deliverNotice(receipt, payload, { dryRun, run, context, reason, message, beforeAppend, afterAppend }) {
  if (dryRun) return receipt;
  try {
    for (const target of receipt.targets) {
      if (beforeAppend) target.present = await beforeAppend(target);
      if (target.present) { receipt.alreadyPresent.push(target.id); continue; }
      const response = await run(['task', 'edit', target.id, '--append-body', payload.body,
        '--reason', reason], context);
      if (response.code !== 0 || !response.task?.body?.includes(payload.body)) {
        throw new Error(`append for ${target.id} was not verified; it may have been applied. Inspect task show before explicitly resuming; no automatic retry`);
      }
      receipt.appended.push(target.id);
      if (afterAppend) await afterAppend(response.task);
    }
    if (receipt.appended.length) {
      const sent = await run(['say', message], context);
      if (sent.code !== 0) throw new Error('durable appends verified, but broadcast unverified; inspect inbox and report the notice explicitly');
      receipt.broadcast = true;
    }
    return receipt;
  } catch (error) {
    error.receipt = receipt;
    error.message += '\nDelivery receipt: ' + JSON.stringify(receipt);
    throw error;
  }
}

/** Append one explicitly reviewed current block without replacing sibling text. */
export async function publishSourceReview(plan, notice, { env = process.env, run = clientRun, dryRun = false, repoRoot = process.cwd(), readSource } = {}) {
  if (!notice || typeof notice !== 'object' || Array.isArray(notice)) throw new Error('source review must be an object');
  const { taskId, ...input } = notice;
  text(taskId, 'source review taskId', 128);
  const options = { repoRoot, ...(readSource ? { readSource } : {}) };
  const review = captureSourceReview(input, options);
  const context = { env, baseUrl: plan.baseUrl };
  const identity = await run(['whoami', '--live'], context);
  if (identity.code !== 0 || !identity.live || !['orchestrator', 'master', 'human'].includes(identity.agent?.role)) throw new Error('source reviews require a live orchestrator/master/human in the current AGORA_AGENT_ID scope');
  const name = plan.campaign?.id || plan.campaignId;
  if (!name) throw new Error('source review plan must name its existing campaign');
  const campaign = await run(['campaign', 'show', name], context);
  if (campaign.code !== 0 || !campaign.view?.campaign?.id) throw new Error('source review campaign could not be verified');
  const campaignId = campaign.view.campaign.id;
  const snapshot = await run(['tasks'], context);
  if (snapshot.code !== 0 || !Array.isArray(snapshot.tasks)) throw new Error('source review task snapshot unavailable');
  const target = snapshot.tasks.find(task => task.id === taskId);
  if (!target || target.campaignId !== campaignId || target.state === 'done') throw new Error('source review needs an exact unfinished task in this campaign');
  const inspected = inspectSourceReviews(target, options), existing = inspected.declarations.find(item => item.id === review.id);
  const marker = `SOURCE PRESERVATION REVIEW [${campaignId}/${review.id}]`;
  const stripTime = value => { const result = { ...value }; delete result.observedAt; delete result.bodyLine; return result; };
  if (existing) {
    if (!isDeepStrictEqual(stripTime(existing), stripTime(review))) throw new Error('source review id has different content or changed block; use a new explicit superseding id');
    if (inspected.issues.length) throw new Error('existing source review is unresolved: ' + inspected.issues.map(issue => issue.reason).join('; '));
    if (!inspected.active.some(item => item.id === existing.id)) throw new Error('source review id was already superseded; do not restore historical authority');
    return { review: existing, checkedAt: inspected.checkedAt, campaignId, targets: [{ id: target.id, present: true }], appended: [], alreadyPresent: [target.id], dryRun, broadcast: false };
  }
  if ((target.body || '').includes(marker)) throw new Error('source review marker already has different content; inspect before resuming');
  const body = [marker, 'SOURCE-REVIEW: ' + JSON.stringify(review),
    'Required action: preserve the parent-reviewed affected behavior during this replacement. Re-read the anchored block after locking and before editing; changed content needs another explicit reconciliation. The original review remains history only where superseded.',
    'Literal block identity and parent-supplied symbols are not semantic completeness, automatic permission, worker test results or rendered proof.', `END ${marker}`].join('\n');
  const candidate = inspectSourceReviews({ ...target, body: (target.body || '') + '\n' + body }, options);
  if (candidate.issues.length) throw new Error('source review reconciliation is unresolved: ' + candidate.issues.map(issue => issue.reason).join('; '));
  const receipt = { review, checkedAt: candidate.checkedAt, campaignId, dryRun, targets: [{ id: target.id, present: false }], appended: [], alreadyPresent: [], broadcast: false };
  // Check the response once; an uncertain write may already be durable. Do not
  // append again or roll back a concurrent sibling note to recover certainty.
  const verifiedRun = async (args, context) => {
    const response = await run(args, context);
    if (args[0] === 'task' && args[1] === 'edit' && response.code === 0 && response.task?.body?.includes(body)) {
      if (!response.task.body.includes(target.body || '')) throw new Error('source review append lost prior task text; inspect without retry');
      const after = inspectSourceReviews(response.task, options);
      if (after.issues.length) throw new Error('source changed during source review append; inspect durable body and reconcile before dispatch, no automatic retry');
    }
    return response;
  };
  return deliverNotice(receipt, { marker, body }, { dryRun, run: verifiedRun, context, reason: 'WF-G307 reviewed source block ' + review.id,
    message: 'SOURCE PRESERVATION REVIEW ' + campaignId + '/' + review.id + ' recorded on ' + target.id + '. Current symbols: ' + review.symbols.join(', ') + '. Re-read task show and lint before replacement; ownership unchanged.' });
}

function normalizeCapabilityNotice(notice) {
  if (!notice || typeof notice !== 'object' || Array.isArray(notice)) throw new Error('capability notice must be an object');
  const fields = new Set(['id', 'fromTask', 'oldClaim', 'replacement', 'observedAt', 'conditions', 'evidence']);
  for (const name of Object.keys(notice)) if (!fields.has(name)) throw new Error('unknown capability notice field: ' + name);
  const id = text(notice.id, 'notice id', 64);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) throw new Error('notice id must be a stable alphanumeric/hyphen/underscore key');
  const observedAt = text(notice.observedAt, 'observedAt', 24);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(observedAt)
    || !Number.isFinite(Date.parse(observedAt)) || new Date(observedAt).toISOString() !== observedAt) {
    throw new Error('observedAt must be a real UTC timestamp: YYYY-MM-DDTHH:mm:ss.sssZ');
  }
  const result = { id, fromTask: text(notice.fromTask, 'fromTask'), oldClaim: text(notice.oldClaim, 'oldClaim', 4096),
    replacement: text(notice.replacement, 'replacement', 4096), observedAt,
    conditions: text(notice.conditions, 'conditions', 4096), evidence: text(notice.evidence, 'evidence', 4096) };
  if (result.oldClaim === result.replacement) throw new Error('replacement must differ from the old claim');
  return result;
}

/** Preserve the original brief, but explicitly supersede its scoped claim. */
export function capabilityNoticeBody(campaignId, notice) {
  const normalized = normalizeCapabilityNotice(notice);
  const digest = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  const marker = `CAPABILITY CLAIM CORRECTION [${campaignId}/${normalized.id}]`;
  const body = [
    `${marker} sha256=${digest}`,
    `Source task: ${normalized.fromTask}`,
    `Observed at: ${normalized.observedAt}`,
    `REFERENCE-ONLY: Superseded claim: ${JSON.stringify(normalized.oldClaim)}`,
    `REFERENCE-ONLY: Replacement guidance: ${JSON.stringify(normalized.replacement)}`,
    `REFERENCE-ONLY: Conditions: ${JSON.stringify(normalized.conditions)}`,
    `REFERENCE-ONLY: Evidence: ${JSON.stringify(normalized.evidence)}`,
    'Required action: this correction supersedes the matching capability claim in the earlier brief for the stated conditions only. Re-read task show, check the actual host and touched surface before verification, and record current proof or a blocker.',
    'Ownership and command limits are unchanged. This is reviewed guidance, not automatic capability detection, runtime acceptance or permission to skip required visual proof.',
    `END ${marker}`,
  ].join('\n');
  return { marker, body, digest };
}

/** Sweep current campaign bodies, including siblings absent from this plan. */
export async function publishCapabilityNotice(plan, notice, options = {}) {
  return publishCampaignCorrection(plan, normalizeCapabilityNotice(notice), options);
}

// WF-G246 adds audit scope to the existing campaign sweep and atomic append
// mechanism. Capability correction behavior and its schema remain unchanged.
async function publishCampaignCorrection(plan, normalized, { env = process.env, run = clientRun, dryRun = false, scopeReview } = {}) {
  const context = { env, baseUrl: plan?.baseUrl };
  const identity = await run(['whoami', '--live'], context);
  if (identity.code !== 0 || !identity.live || !['orchestrator', 'master', 'human'].includes(identity.agent?.role)) {
    throw new Error('capability notices require a live orchestrator/master/human in the current AGORA_AGENT_ID scope');
  }
  const campaignName = plan?.campaign?.id || plan?.campaignId;
  if (!campaignName) throw new Error('capability notice plan must name its existing campaign id');
  const campaign = await run(['campaign', 'show', campaignName], context);
  if (campaign.code !== 0 || !campaign.view?.campaign?.id) throw new Error('capability notice campaign could not be verified');
  const campaignId = campaign.view.campaign.id;
  const snapshot = await run(['tasks'], context);
  if (snapshot.code !== 0 || !Array.isArray(snapshot.tasks)) throw new Error('capability notice task snapshot unavailable; no notice sent');
  const source = snapshot.tasks.find(task => task.id === normalized.fromTask);
  if (!source || source.campaignId !== campaignId) throw new Error('fromTask must name an exact current task in this campaign');
  const payload = scopeReview ? scopeReview.payload(campaignId) : capabilityNoticeBody(campaignId, normalized);
  if (scopeReview) scopeReview.checkSource(source);
  const targets = [], closedMatches = [];
  // Preflight the whole campaign. A reused id with different content is a
  // conflict even if the new wording would no longer match that sibling.
  for (const task of snapshot.tasks.filter(task => task.campaignId === campaignId).sort((a, b) => a.id.localeCompare(b.id))) {
    const body = task.body || '';
    const present = body.includes(payload.body);
    if (!present && body.includes(payload.marker)) throw new Error(`notice ${normalized.id} already has different content on ${task.id}; use a new id`);
    if (!present && !body.includes(normalized.oldClaim)) continue;
    if (!present && task.state === 'done') { closedMatches.push(task.id); continue; }
    targets.push({ id: task.id, present });
  }
  const receipt = { noticeId: normalized.id, campaignId, digest: payload.digest, fromTask: source.id,
    dryRun, targets, closedMatches, appended: [], alreadyPresent: [], broadcast: false };
  if (!targets.length && !dryRun) {
    const error = new Error('no unfinished matching tasks; inspect the sweep and completed matches, do not claim a correction was delivered');
    error.receipt = receipt; throw error;
  }
  const label = scopeReview ? 'AUDIT SCOPE CORRECTION' : 'CAPABILITY CLAIM CORRECTION';
  const message = `${label} ${campaignId}/${normalized.id}: durable scoped guidance on ${targets.map(t => t.id).join(', ')}. Re-read task show before verification/completion; conditions and evidence are in the body, ownership unchanged. Completed matches needing review: ${closedMatches.join(', ') || 'none'}.`;
  return deliverNotice(receipt, payload, { dryRun, run, context,
    reason: scopeReview ? `WF-G246 audit scope correction ${normalized.id}` : `WF-G334 capability correction ${normalized.id}`, message,
    ...(scopeReview ? { afterAppend: async task => {
      // A changed audit during the write leaves durable history, not valid
      // current guidance. Report the applied append and stop without rollback.
      if (task.campaignId !== campaignId || task.state === 'done') throw new Error('scope target completed or changed campaign during append; inspect durable correction and review acceptance before resume');
      scopeReview.checkAudit();
      const currentSource = await run(['task','show',source.id], context);
      if (currentSource.code !== 0 || currentSource.task?.id !== source.id || currentSource.task.campaignId !== campaignId) throw new Error('audit source task changed during append; inspect durable correction before resume');
      scopeReview.checkSource(currentSource.task);
    }, beforeAppend: async target => {
      // Read the audit and source linkage again before each append. A newer
      // target brief must not receive stale advice merely because it matched
      // an earlier snapshot. This reduces races, not a cross-task transaction.
      scopeReview.checkAudit();
      const currentSource = await run(['task','show',source.id], context);
      if (currentSource.code !== 0 || currentSource.task?.id !== source.id || currentSource.task.campaignId !== campaignId) throw new Error('current exact audit source task unavailable or changed campaign; inspect before resume');
      scopeReview.checkSource(currentSource.task);
      const current = await run(['task','show',target.id], context);
      if (current.code !== 0 || current.task?.id !== target.id || current.task.campaignId !== campaignId) throw new Error('current exact scope target unavailable or changed campaign; inspect before resume');
      const body = current.task.body || '';
      if (body.includes(payload.body)) return true;
      if (target.present) throw new Error('previously stored scope correction disappeared since sweep; inspect before resume');
      if (body.includes(payload.marker)) throw new Error('scope correction id now has different content; inspect before resume');
      if (current.task.state === 'done' || !body.includes(normalized.oldClaim)) throw new Error('scope target completed or old scope changed since sweep; inspect before resume');
      scopeReview.checkAudit();
      return false;
    } } : {}) });
}

function normalizeScopeNotice(notice, { repoRoot = process.cwd(), now = Date.now() } = {}) {
  if (!notice || typeof notice !== 'object' || Array.isArray(notice)) throw new Error('scope notice must be an object');
  const keys=['id','fromTask','oldScope','scope','observedAt','audit'];
  if(Object.keys(notice).some(key=>!keys.includes(key)))throw new Error('unknown scope notice field');
  // Reuse the established id, time and bounded-text validation rather than
  // introducing another task store. The audit is location evidence, not a
  // certification of its counts, runtime findings or required file ownership.
  const base=normalizeCapabilityNotice({id:notice.id,fromTask:notice.fromTask,oldClaim:notice.oldScope,replacement:notice.scope,
    observedAt:notice.observedAt,conditions:'Reviewed audit scope; ownership unchanged.',evidence:'Current literal audit citation.'});
  const at=Date.parse(base.observedAt);
  if(at>now+60000||now-at>86400000)throw new Error('scope review needs a UTC observation within24h, not stale or future evidence');
  const audit=notice.audit;
  if(!audit||typeof audit!=='object'||Array.isArray(audit)||Object.keys(audit).some(key=>!['file','quote'].includes(key)))throw new Error('audit needs only exact file and unique quote');
  let source;
  const citation={file:audit.file,quote:audit.quote};
  const checked=inspectSourceCitations({body:'SOURCE-CITATION: '+JSON.stringify(citation)},{repoRoot,readSource:file=>(source=readCitationSource(repoRoot,file))});
  if(checked.issues.length||checked.resolved.length!==1)throw new Error('scope audit citation unresolved: '+checked.issues.map(issue=>issue.reason).join('; '));
  return {id:base.id,fromTask:base.fromTask,oldScope:base.oldClaim,scope:base.replacement,observedAt:base.observedAt,
    audit:{...citation,observedLine:checked.resolved[0].line,sha256:createHash('sha256').update(source,'utf8').digest('hex')}};
}

function scopeNoticePayload(campaignId, normalized) {
  const digest=createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  const marker=`AUDIT SCOPE CORRECTION [${campaignId}/${normalized.id}]`;
  const {sha256,...citation}=normalized.audit;
  const body=[`${marker} sha256=${digest}`,`Source audit task: ${normalized.fromTask}`,`Reviewed at: ${normalized.observedAt}`,
    'REFERENCE-ONLY: Superseded scope: '+JSON.stringify(normalized.oldScope),
    'REFERENCE-ONLY: Corrected scope: '+JSON.stringify(normalized.scope),
    'SOURCE-CITATION: '+JSON.stringify(citation),
    'REFERENCE-ONLY: Audit source text SHA256: '+sha256,
    'Required action: this reviewed scope supersedes the matching earlier scope only. Re-read task show and the current cited audit before work or acceptance; do not size delivery from the narrower original brief.',
    'The parent must reconcile packet scope, acceptance, dependencies and file owners before implementation. Stop on uncovered work or contradictory evidence. Keep unfinished intent and record current behavior proof or blockers; source quotes and historical counts are not runtime acceptance.',
    'Original brief/history, claimant, dependencies, refs and file/command permissions are preserved. This notice grants no additional files or commands, automatically executes nothing and never reopens completed work.',`END ${marker}`].join('\n');
  return {marker,body,digest};
}

/** Build a checked, durable audit reference and explicitly superseding scope. */
export function scopeNoticeBody(campaignId, notice, options = {}) {
  return scopeNoticePayload(campaignId,normalizeScopeNotice(notice,options));
}

export async function publishScopeNotice(plan, notice, options = {}) {
  const normalized=normalizeScopeNotice(notice,options);
  return publishCampaignCorrection(plan,{id:normalized.id,fromTask:normalized.fromTask,oldClaim:normalized.oldScope},
    {...options,scopeReview:{payload:campaignId=>scopeNoticePayload(campaignId,normalized),
      checkSource:source=>{if(!(source.refs||[]).includes(normalized.audit.file))throw new Error('exact source task must reference the current audit file before scope delivery');},
      checkAudit:()=>{const current=normalizeScopeNotice(notice,options);if(!isDeepStrictEqual(current,normalized))throw new Error('audit source changed since scope review; reread and use a newly reviewed notice, not automatic retry');}}});
}

// A ruling is quoted from an existing reviewed record. Syntax and exact text
// checks cannot decide whether a human actually approved it or still endorses it.
function normalizeRulingNotice(notice) {
  if (!notice || typeof notice !== 'object' || Array.isArray(notice)) throw new Error('ruling notice must be an object');
  const fields = new Set(['id', 'taskId', 'sourceTask', 'sourceReference', 'ruling', 'oldInstruction',
    'replacement', 'evidence', 'observedAt', 'blocker']);
  for (const name of Object.keys(notice)) if (!fields.has(name)) throw new Error('unknown ruling notice field: ' + name);
  const id = text(notice.id, 'ruling id', 64);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) throw new Error('ruling id needs a stable alphanumeric/hyphen/underscore key');
  const observedAt = text(notice.observedAt, 'observedAt', 24);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(observedAt)
    || !Number.isFinite(Date.parse(observedAt)) || new Date(observedAt).toISOString() !== observedAt) {
    throw new Error('observedAt must be a real UTC timestamp: YYYY-MM-DDTHH:mm:ss.sssZ');
  }
  const block = notice.blocker;
  if (!block || typeof block !== 'object' || Array.isArray(block) || Object.keys(block).some(key => !['at', 'reason'].includes(key))
    || !Number.isSafeInteger(block.at) || block.at <= 0) throw new Error('blocker needs the exact blocked history event at/reason');
  const normalized = { id, taskId: text(notice.taskId, 'taskId', 128), sourceTask: text(notice.sourceTask, 'sourceTask', 128),
    sourceReference: text(notice.sourceReference, 'sourceReference', 1024), ruling: text(notice.ruling, 'ruling', 4096),
    oldInstruction: text(notice.oldInstruction, 'oldInstruction', 4096), replacement: text(notice.replacement, 'replacement', 4096),
    evidence: text(notice.evidence, 'evidence', 4096), observedAt, blocker: { at: block.at, reason: text(block.reason, 'blocker reason', 4096) } };
  if (normalized.oldInstruction === normalized.replacement) throw new Error('replacement must differ from the invalidated instruction');
  return normalized;
}

/** Retain the old brief as history, but name exactly which instruction is superseded. */
export function rulingNoticeBody(campaignId, notice) {
  const normalized = normalizeRulingNotice(notice);
  const digest = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  const marker = `SUPERSEDED BY RULING [${campaignId}/${normalized.id}]`;
  const body = [
    `${marker} sha256=${digest}`,
    `Target task: ${normalized.taskId}; source task: ${normalized.sourceTask}; observed at: ${normalized.observedAt}`,
    `REFERENCE-ONLY: Authoritative source reference: ${JSON.stringify(normalized.sourceReference)}`,
    `REFERENCE-ONLY: Recorded ruling quote: ${JSON.stringify(normalized.ruling)}`,
    `REFERENCE-ONLY: Invalidated earlier instruction: ${JSON.stringify(normalized.oldInstruction)}`,
    `REFERENCE-ONLY: Replacement guidance: ${JSON.stringify(normalized.replacement)}`,
    `REFERENCE-ONLY: Reviewed evidence: ${JSON.stringify(normalized.evidence)}`,
    `REFERENCE-ONLY: Addressed blocked event: ${JSON.stringify(normalized.blocker)}`,
    'Required action: the matching earlier instruction is superseded by this reviewed ruling. Re-read the full body, history and authoritative source before work or acceptance; stop and ask the coordinator about contradictions or a later decision.',
    'This does not infer human approval, prove implementation, grant files/commands, remove dependencies or authorize external/protected actions. The original brief remains history, not the active instruction where superseded.',
    `END ${marker}`,
  ].join('\n');
  return { marker, body, digest };
}

/** Append and verify the ruling BEFORE reopening the one explicitly addressed blocker. */
export async function publishRulingUnblock(plan, notice, { env = process.env, run = clientRun, dryRun = false } = {}) {
  const normalized = normalizeRulingNotice(notice);
  const context = { env, baseUrl: plan?.baseUrl };
  const identity = await run(['whoami', '--live'], context);
  if (identity.code !== 0 || !identity.live || !['orchestrator', 'master', 'human'].includes(identity.agent?.role)) {
    throw new Error('ruling reconciliation requires a live orchestrator/master/human in the current AGORA_AGENT_ID scope');
  }
  const campaignName = plan?.campaign?.id || plan?.campaignId;
  if (!campaignName) throw new Error('ruling plan must name its existing campaign id');
  const campaign = await run(['campaign', 'show', campaignName], context);
  if (campaign.code !== 0 || !campaign.view?.campaign?.id) throw new Error('ruling campaign could not be verified');
  const campaignId = campaign.view.campaign.id;
  const snapshot = await run(['tasks'], context);
  if (snapshot.code !== 0 || !Array.isArray(snapshot.tasks)) throw new Error('ruling task snapshot unavailable; no changes sent');
  const payload = rulingNoticeBody(campaignId, normalized);
  const reason = `${payload.marker} sha256=${payload.digest}: recorded decision from ${normalized.sourceReference}`;
  const quotePresent = source => source?.campaignId === campaignId && [source.body, source.result,
    ...(source.history || []).flatMap(entry => [entry.reason, entry.result])]
    .some(value => typeof value === 'string' && value.includes(normalized.ruling));
  const alreadyApplied = target => (target.history || []).some(entry => entry.state === 'open' && entry.reason === reason);
  const checkTarget = target => {
    if (!target || target.id !== normalized.taskId || target.campaignId !== campaignId) throw new Error('exact target task must be in the current campaign');
    const present = (target.body || '').includes(payload.body);
    if (!present && (target.body || '').includes(payload.marker)) throw new Error('ruling id already has different content; use a new reviewed id');
    if (alreadyApplied(target)) {
      if (!present) throw new Error('previous ruling application lost its body reconciliation; inspect before further work');
      return { present, applied: true };
    }
    if (target.state !== 'blocked') throw new Error('unapplied ruling requires a blocked target; inspect the current state');
    const blocker = [...(target.history || [])].reverse().find(entry => entry.state === 'blocked');
    if (!blocker || blocker.at !== normalized.blocker.at || blocker.reason !== normalized.blocker.reason) {
      throw new Error('blocked event changed or is unverifiable; inspect and review the actual blocker');
    }
    if (!(target.body || '').includes(normalized.oldInstruction)) throw new Error('invalidated instruction is absent from the current target body');
    return { present, applied: false };
  };
  const source = snapshot.tasks.find(task => task.id === normalized.sourceTask);
  if (!quotePresent(source)) throw new Error('exact source task must carry the recorded ruling quote in body/result/history and share the campaign');
  const target = snapshot.tasks.find(task => task.id === normalized.taskId);
  const checked = checkTarget(target);
  const receipt = { noticeId: normalized.id, campaignId, taskId: normalized.taskId, sourceTask: normalized.sourceTask,
    digest: payload.digest, dryRun, observedState: target.state, appended: false, alreadyPresent: checked.present,
    alreadyApplied: checked.applied, reopened: false, broadcast: false };
  if (dryRun || checked.applied) return receipt;
  const freshTask = async id => {
    const response = await run(['task', 'show', id], context);
    if (response.code !== 0 || response.task?.id !== id) throw new Error('fresh exact task read failed; inspect before resuming');
    return response.task;
  };
  try {
    if (!quotePresent(await freshTask(normalized.sourceTask))) throw new Error('recorded ruling source changed; inspect and review the decision');
    const fresh = checkTarget(await freshTask(normalized.taskId));
    if (fresh.applied) { receipt.alreadyApplied = true; return receipt; }
    receipt.alreadyPresent = fresh.present;
    if (!fresh.present) {
      const appended = await run(['task', 'edit', normalized.taskId, '--append-body', payload.body,
        '--reason', `WF-G323 reconcile ruling ${normalized.id} before unblock`], context);
      if (appended.code !== 0 || !appended.task?.body?.includes(payload.body) || appended.lint?.clean === false) {
        throw new Error('ruling append not verified or brief lint still fails; it may have applied. Inspect task show');
      }
      receipt.appended = true;
    }
    // An earlier append can survive a failed lint response. Explicit resume
    // must still repair the brief, not treat a saved marker as a lint bypass.
    const linted = await run(['task', 'lint', normalized.taskId], context);
    if (linted.code !== 0 || linted.lint?.clean !== true) throw new Error('current reconciled brief lint fails; inspect and repair before unblock');
    // A new blocker or another worker's state must survive. This fresh check
    // reduces races, but the existing append/state requests are not a transaction.
    if (!quotePresent(await freshTask(normalized.sourceTask))) throw new Error('ruling source changed after append; inspect before unblock');
    const ready = checkTarget(await freshTask(normalized.taskId));
    if (!ready.present) throw new Error('ruling reconciliation disappeared before unblock; inspect the task');
    if (ready.applied) { receipt.alreadyApplied = true; return receipt; }
    const reopened = await run(['task', 'state', normalized.taskId, 'open', '--reason', reason], context);
    if (reopened.code !== 0 || reopened.task?.state !== 'open' || !reopened.task?.body?.includes(payload.body)
      || !alreadyApplied(reopened.task)) throw new Error('ruling unblock not verified; it may have applied. Inspect task show');
    receipt.reopened = true;
    const sent = await run(['say', `${payload.marker}: reconciled durable brief before reopening ${normalized.taskId}. Source ${normalized.sourceTask}; re-read body/history/source. Dependencies, ownership and approval boundaries unchanged.`], context);
    if (sent.code !== 0) throw new Error('ruling reconciled and reopened, but broadcast unverified; inspect inbox and report explicitly');
    receipt.broadcast = true; return receipt;
  } catch (error) {
    error.receipt = receipt; error.message += '\nInspect the task and source before explicit resume; no automatic retry. Receipt: ' + JSON.stringify(receipt);
    throw error;
  }
}
