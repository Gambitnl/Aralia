/**
 * campaign-model.mjs — the campaign charter, the Plan Map contract, and the
 * triage report, as PURE functions. No file access, no clock, no store.
 *
 * Why one module: two processes need the same rules. The daemon (store.mjs)
 * refuses a bad charter and records dispositions; the read-only surface
 * (readonly-store.mjs) builds the triage report from a snapshot and must never
 * be able to write. A rule list copied into both places drifts — that is how
 * the seat-name gate went wrong before it was hoisted (seatNames.test.mjs). So
 * the rules live here once, and both import them.
 *
 * Design: docs/superpowers/specs/2026-06-27-agora-agent-coordination-design.md,
 * sections 4, 6, 7, 10, 11, 22, and the revision in section 72.
 */
import { featureSlugs } from './planmap-reconcile-lib.mjs';

export const CHARTER_TIERS = Object.freeze(['small', 'standard', 'large']);
export const CHARTER_RISKS = Object.freeze(['low', 'medium', 'high']);
export const ADOPTION_POLICIES = Object.freeze(['reclaim', 'close-on-abandon', 'escalate']);
export const CHARTER_STATUSES = Object.freeze(['needs-review', 'approved']);

// §4 escalation rule: work that touches one of these takes the large intake,
// whatever its size. A declared touch is the charter author's own statement.
export const ESCALATING_TOUCHES = Object.freeze(['public-api', 'daemon-protocol', 'save-format']);

const RANK = { small: 0, standard: 1, large: 2 };

// §4 requirements matrix, R rows only. `approvers` and `revisions` are not
// author fields: the store writes them when a charter is approved or edited.
// `effort` is { taskCount, fileCount }:
// §72 removes the agent-hour figure, because the operator's standing directive
// forbids time estimates, and a tier needs sizes rather than a schedule.
export const REQUIRED_BY_TIER = Object.freeze({
  small: Object.freeze([
    'mission', 'outcome', 'planMapPrimary', 'scope', 'tier', 'effort', 'risk',
    'acceptance', 'verification', 'owner', 'author',
  ]),
  standard: Object.freeze([
    'mission', 'outcome', 'planMapPrimary', 'currentState', 'scope', 'nonScope', 'tier', 'effort',
    'risk', 'affectedDomains', 'milestones', 'acceptance', 'verification', 'adoptionPolicy',
    'owner', 'author',
  ]),
  large: Object.freeze([
    'mission', 'outcome', 'planMapPrimary', 'currentState', 'scope', 'nonScope', 'tier', 'effort',
    'risk', 'affectedDomains', 'milestones', 'workstreams', 'dependencies', 'acceptance',
    'verification', 'adoptionPolicy', 'owner', 'author', 'openDecisions',
    'escalationPath',
  ]),
});

function present(v) {
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === 'object') return Object.keys(v).length > 0;
  if (typeof v === 'number') return Number.isFinite(v);
  return typeof v === 'string' ? v.trim().length > 0 : Boolean(v);
}

/** §4: take the highest tier that ANY single measure reaches. Every measure
 *  that raised the tier is named, so the result can be checked, not trusted. */
export function measuredTier({ effort = {}, risk, touches = [] } = {}) {
  const reasons = [];
  let tier = 'small';
  const raise = (to, why) => {
    if (RANK[to] > RANK[tier]) tier = to;
    if (to !== 'small') reasons.push(`${why} -> ${to}`);
  };
  const tasks = Number(effort.taskCount);
  const files = Number(effort.fileCount);
  if (Number.isFinite(tasks)) raise(tasks > 20 ? 'large' : tasks >= 6 ? 'standard' : 'small', `${tasks} tasks`);
  if (Number.isFinite(files)) raise(files > 50 ? 'large' : files >= 11 ? 'standard' : 'small', `${files} files`);
  if (risk === 'high') raise('large', 'high risk');
  else if (risk === 'medium') raise('standard', 'medium risk');
  for (const touch of touches || []) {
    if (ESCALATING_TOUCHES.includes(touch)) raise('large', `touches ${touch}`);
  }
  return { tier, reasons };
}

/** §7: check one Plan Map reference against topics.json.
 *
 *  `campaignState` enables the contradiction check. The contradiction that
 *  stopped the first trial (design §71) was a feature reading `done` while the
 *  campaign that serves it was still `active`, so that case is checked at both
 *  the topic and the feature level. */
export function planMapHealth(ref, topicsData, { campaignState } = {}) {
  const out = { ref: typeof ref === 'string' ? ref : '', ok: false, topic: null, feature: null, problems: [] };
  if (typeof ref !== 'string' || !ref.trim()) {
    out.problems.push('no primary Plan Map reference');
    return out;
  }
  const m = /^planmap:([a-z0-9-]+)(?:\/([a-z0-9-]+))?$/.exec(ref.trim());
  if (!m) {
    out.problems.push(`not a planmap:<topic>[/<feature>] reference: ${ref}`);
    return out;
  }
  if (!topicsData || !Array.isArray(topicsData.topics)) {
    out.problems.push('topics.json could not be read, so the reference cannot be checked');
    return out;
  }
  const topic = topicsData.topics.find((t) => t.id === m[1]);
  if (!topic) {
    out.problems.push(`topic "${m[1]}" does not exist`);
    return out;
  }
  out.topic = { id: topic.id, status: topic.status || '' };
  if (topic.status === 'superseded') out.problems.push(`topic "${topic.id}" is superseded`);
  let target = topic;
  if (m[2]) {
    const feats = topic.features || [];
    const slugs = featureSlugs(feats);
    const i = slugs.indexOf(m[2]);
    if (i < 0) {
      out.problems.push(`feature slug "${m[2]}" does not resolve inside topic "${topic.id}"`);
      return out;
    }
    target = feats[i];
    out.feature = { slug: m[2], title: target.title || '', status: target.status || '' };
    if (target.status === 'superseded') out.problems.push(`feature "${m[2]}" is superseded`);
  }
  const live = campaignState && !['done', 'closed'].includes(campaignState);
  if (live && target.status === 'done') {
    out.problems.push(
      `contradiction: the reference reads "done" while the campaign is "${campaignState}"`,
    );
  }
  out.ok = out.problems.length === 0;
  return out;
}

/** §6 validation. Returns every problem at once, each naming its field, so an
 *  author fixes a charter in one pass rather than one refusal at a time. */
export function validateCharter(charter, { topics, campaignState } = {}) {
  const errors = [];
  const warnings = [];
  const c = charter && typeof charter === 'object' ? charter : {};

  if (!CHARTER_TIERS.includes(c.tier)) errors.push(`tier must be one of ${CHARTER_TIERS.join(', ')}`);
  if (!CHARTER_RISKS.includes(c.risk)) errors.push(`risk must be one of ${CHARTER_RISKS.join(', ')}`);
  if (c.risk && !present(c.riskReason)) errors.push('riskReason is required: say in one line why the risk is what it is');
  if (c.adoptionPolicy && !ADOPTION_POLICIES.includes(c.adoptionPolicy)) {
    errors.push(`adoptionPolicy must be one of ${ADOPTION_POLICIES.join(', ')}`);
  }

  // §7 rule 1: exactly one primary. An array is how "two primaries" arrives.
  if (Array.isArray(c.planMapPrimary)) {
    errors.push(`planMapPrimary must be exactly one reference, got ${c.planMapPrimary.length}`);
  }

  // The operator forbids time estimates. A charter that carries one is refused
  // by name, rather than stored and quietly ignored.
  const effort = c.effort && typeof c.effort === 'object' ? c.effort : {};
  for (const key of Object.keys(effort)) {
    if (/hour|day|week|minute|duration|time/i.test(key)) {
      errors.push(`effort.${key} is a time estimate; size a charter by taskCount and fileCount only`);
    }
  }
  if (c.effort !== undefined && !Number.isFinite(Number(effort.taskCount))) {
    errors.push('effort.taskCount must be a number');
  }
  if (c.effort !== undefined && !Number.isFinite(Number(effort.fileCount))) {
    errors.push('effort.fileCount must be a number');
  }

  const measured = measuredTier({ effort, risk: c.risk, touches: c.touches });
  // §4: "never lower a tier to skip work". A stated tier below the measured
  // one is an error, and the fields owed are the MEASURED tier's fields.
  if (CHARTER_TIERS.includes(c.tier) && RANK[c.tier] < RANK[measured.tier]) {
    errors.push(`tier "${c.tier}" is lower than the measures require ("${measured.tier}": ${measured.reasons.join('; ')})`);
  }
  const owedTier = CHARTER_TIERS.includes(c.tier) && RANK[c.tier] >= RANK[measured.tier] ? c.tier : measured.tier;
  for (const field of REQUIRED_BY_TIER[owedTier]) {
    if (!present(c[field])) errors.push(`missing required field for tier ${owedTier}: ${field}`);
  }

  if (Array.isArray(c.acceptance)) {
    c.acceptance.forEach((a, i) => {
      const text = typeof a === 'string' ? a : a && a.text;
      const evidence = a && typeof a === 'object' ? a.evidence : '';
      if (!present(text)) errors.push(`acceptance[${i}] is empty`);
      if (!present(evidence)) errors.push(`acceptance[${i}] names no evidence`);
    });
  }

  // Tasks in the charter's tree must name a milestone that exists, and their
  // dependencies must not form a cycle (§22 Stage 0, hierarchy validity).
  const milestoneIds = new Set((c.milestones || []).map((ms) => ms && ms.id).filter(Boolean));
  const taskRows = Array.isArray(c.tasks) ? c.tasks : [];
  for (const t of taskRows) {
    if (t.milestone && !milestoneIds.has(t.milestone)) {
      errors.push(`task ${t.id} names milestone ${t.milestone}, which does not exist`);
    }
    if (t.role && !['worker', 'orchestrator', 'master', 'human'].includes(t.role)) {
      errors.push(`task ${t.id} names an unknown role: ${t.role}`);
    }
    if ((t.kind === 'approval' || /approv/i.test(t.title || '')) && t.role && !approverRolesFor(owedTier).includes(t.role)) {
      errors.push(`task ${t.id} approves the charter, but role "${t.role}" may not approve a ${owedTier} charter (§11)`);
    }
  }
  const cyc = findCycle(taskRows);
  if (cyc) errors.push(`task dependencies form a cycle: ${cyc.join(' -> ')}`);

  if ((owedTier === 'standard' || owedTier === 'large') && !present(c.nonScope)) {
    warnings.push('nonScope is empty: an unbounded scope is the common failure');
  }
  if (owedTier === 'small' && present(c.planMapSupporting)) {
    warnings.push('a small campaign rarely needs supporting references');
  }

  const primary = Array.isArray(c.planMapPrimary) ? '' : c.planMapPrimary;
  const health = planMapHealth(primary, topics, { campaignState });
  for (const p of health.problems) errors.push(`planMapPrimary: ${p}`);
  const supporting = (c.planMapSupporting || []).map((ref) => planMapHealth(ref, topics));
  for (const s of supporting) {
    for (const p of s.problems) warnings.push(`planMapSupporting ${s.ref}: ${p}`);
  }

  return { ok: errors.length === 0, errors, warnings, statedTier: c.tier || '', measured, owedTier, planMapHealth: health, supporting };
}

/** §11: who may approve a charter of each tier. */
export function approverRolesFor(tier) {
  return tier === 'large' ? ['human'] : ['master', 'human'];
}

function findCycle(rows) {
  const graph = new Map(rows.map((t) => [t.id, (t.deps || []).map((d) => (typeof d === 'string' ? d : d.id))]));
  const stack = [];
  const onStack = new Set();
  const done = new Set();
  function visit(id) {
    if (onStack.has(id)) return [...stack.slice(stack.indexOf(id)), id];
    if (done.has(id) || !graph.has(id)) return null;
    onStack.add(id);
    stack.push(id);
    for (const next of graph.get(id)) {
      const found = visit(next);
      if (found) return found;
    }
    stack.pop();
    onStack.delete(id);
    done.add(id);
    return null;
  }
  for (const id of graph.keys()) {
    const found = visit(id);
    if (found) return found;
  }
  return null;
}

/** §12 derivation note: start, completion, and the agent trail are already in
 *  `task.history`. Compute them on read, never store them, so replay stays exact. */
export function taskTimes(task) {
  const history = Array.isArray(task && task.history) ? task.history : [];
  const firstInProgress = history.find((h) => h && h.state === 'in_progress');
  const firstClaim = history.find((h) => h && h.action === 'claimed');
  const started = firstInProgress || firstClaim || null;
  let completedAt = null;
  for (const h of history) if (h && h.state === 'done') completedAt = h.at;
  const trail = [];
  for (const h of history) {
    const who = h && (h.action === 'claimed' ? h.by : h.action === 'handoff' ? h.to : null);
    if (who && trail[trail.length - 1] !== who) trail.push(who);
  }
  return {
    startedAt: started ? started.at : null,
    // Which entry the start came from, because many tasks go straight from
    // claimed to done and never record in_progress.
    startedFrom: firstInProgress ? 'in_progress' : firstClaim ? 'claimed' : null,
    completedAt: task && task.state === 'done' ? completedAt : null,
    agentTrail: trail,
  };
}

/** Progress is computed from task records, never stored on the campaign. It is
 *  shown beside the acceptance criteria, because six of eight tasks done says
 *  nothing about whether the outcome arrived (§17 item 7). */
export function campaignProgress(tasks, charter) {
  const byState = {};
  for (const t of tasks || []) byState[t.state] = (byState[t.state] || 0) + 1;
  const total = (tasks || []).length;
  const done = byState.done || 0;
  return {
    total,
    done,
    percent: total ? Math.round((done / total) * 100) : null,
    byState,
    acceptanceCriteria: charter && Array.isArray(charter.acceptance) ? charter.acceptance.length : 0,
    note: 'task completion only; judge each acceptance criterion separately',
  };
}

// §10 per-task dispositions. `merge` became `supersede` under D-C, which makes
// the replacement a named link instead of a disposition with its own machinery.
export const DISPOSITIONS = Object.freeze({
  continue: Object.freeze({ risk: 'low', human: false, meaning: 'keep as-is under the new owner' }),
  reopen: Object.freeze({ risk: 'low', human: false, meaning: 'a dead claimant held it; return it to open' }),
  reassign: Object.freeze({ risk: 'low', human: false, meaning: 'hand to a named live agent' }),
  block: Object.freeze({ risk: 'low', human: false, meaning: 'hold behind a named blocker' }),
  escalate: Object.freeze({ risk: 'low', human: false, meaning: 'the successor cannot judge it; raise it' }),
  supersede: Object.freeze({ risk: 'medium', human: true, meaning: 'replaced by a named surviving task' }),
  'close-obsolete': Object.freeze({ risk: 'high', human: true, meaning: 'the work no longer applies; close with a reason' }),
});

/** Advice only (§10 step 5). The successor approves each action separately. */
export function recommendDisposition(task, { claimantLive } = {}) {
  if (!task) return { disposition: 'escalate', why: 'no task record' };
  if (task.state === 'done') return { disposition: 'continue', why: 'already done; nothing to change' };
  if ((task.state === 'claimed' || task.state === 'in_progress') && !claimantLive) {
    return { disposition: 'reopen', why: 'the claimant is not live, so nobody is doing this work' };
  }
  if (task.state === 'blocked') {
    const last = [...(task.history || [])].reverse().find((h) => h && h.state === 'blocked');
    return last && last.reason
      ? { disposition: 'block', why: `still blocked: ${last.reason}` }
      : { disposition: 'escalate', why: 'blocked with no recorded reason, so the blocker cannot be judged' };
  }
  return { disposition: 'continue', why: `${task.state}; the new owner keeps it` };
}

/** §10 step 2: the read-only triage report. It takes plain records and returns
 *  a plain object. It has no way to change anything, by construction. */
export function buildTriageReport({ campaign, tasks, topics, isAgentLive, attended, generatedAt } = {}) {
  if (!campaign) return { ok: false, error: 'campaign not found' };
  const charter = campaign.charter || null;
  const validation = charter ? validateCharter(charter.body, { topics, campaignState: campaign.state }) : null;
  const dispositions = (campaign.triage && campaign.triage.dispositions) || {};
  const rows = (tasks || []).map((t) => {
    const history = t.history || [];
    const last = history[history.length - 1] || null;
    const claimantLive = t.claimedBy ? Boolean(isAgentLive && isAgentLive(t.claimedBy)) : false;
    return {
      id: t.id,
      title: t.title || '',
      state: t.state,
      claimedBy: t.claimedBy || null,
      claimantLive,
      lastActor: last ? last.by || null : null,
      lastActivityAt: last ? last.at || null : null,
      result: t.result || null,
      ...taskTimes(t),
      historyComplete: history.length > 0 && history.every((h) => h && h.at && h.action),
      recommendation: recommendDisposition(t, { claimantLive }),
      disposition: dispositions[t.id] || null,
    };
  });
  return {
    ok: true,
    readOnly: true,
    generatedAt: generatedAt || null,
    campaign: {
      id: campaign.id,
      name: campaign.name || '',
      state: campaign.state,
      closedReason: campaign.closedReason || '',
      owner: campaign.agentId || '',
      seatId: campaign.seatId || '',
      attended: Boolean(attended),
      adoptable: campaign.state === 'active' && !attended,
      historyLength: (campaign.history || []).length,
    },
    charter: charter ? { status: charter.status, tier: charter.body.tier, validation } : null,
    legacy: !charter,
    planMapHealth: validation ? validation.planMapHealth : null,
    triage: campaign.triage
      ? { state: campaign.triage.state, startedAt: campaign.triage.startedAt, startedBy: campaign.triage.startedBy }
      : { state: 'none' },
    tasks: rows,
    totals: {
      tasks: rows.length,
      withDisposition: rows.filter((r) => r.disposition).length,
      incompleteHistory: rows.filter((r) => !r.historyComplete).map((r) => r.id),
    },
    // Said on the report itself, so nobody reads a zero-task report as proof
    // that the per-task path was exercised.
    notes: rows.length ? [] : ['this campaign holds no tasks; only campaign-level closure can be proved on it'],
  };
}
