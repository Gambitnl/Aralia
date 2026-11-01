// WF-G285: a shared-file completion can invalidate an unfinished brief's counts.
// This pure view preserves every authored byte and every ownership/readiness rule.
// Declared overlap is a reason to remeasure, not proof of an edit or a new count.
import path from 'node:path';

const UNFINISHED = new Set(['open', 'claimed', 'in_progress', 'blocked']);
const DEFAULT_LIMITS = Object.freeze({tasks:5000, refs:128, history:10000, entries:200000, comparisons:100000, completions:64});
const validTime = value => Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;
const result = (status, reason = '', completions = []) => ({status, reason, completions});

// An existing reason-only task note acknowledges exact overlap receipts. It is
// authored review evidence, not a certified measurement or permission to edit.
// Stale/malformed/partial notes cannot clear a newer completion warning.
function applyRecordedReviews(task, receipts, repoRoot) {
  const notes = (task.history || []).filter(event => event.action === 'note' && /^COUNT-REVIEW:/.test(event.reason || ''));
  if (notes.length > 32) return 'Count-review note limit exceeded.';
  const fields = ['taskId','sourceTask','completedAt','historyIndex','refs','proof'].sort().join(',');
  for (const note of notes) {
    if (typeof note.reason !== 'string' || note.reason.length > 32768 || !validTime(note.at)) continue;
    let review;
    try { review = JSON.parse(note.reason.slice('COUNT-REVIEW:'.length)); } catch { continue; }
    if (!review || Object.keys(review).sort().join(',') !== fields || review.taskId !== task.id
      || typeof review.sourceTask !== 'string' || !validTime(review.completedAt)
      || !Number.isSafeInteger(review.historyIndex) || review.historyIndex < 0
      || !Array.isArray(review.refs) || !review.refs.length || review.refs.length > 128
      || typeof review.proof !== 'string' || review.proof.trim().length < 12 || review.proof.length > 8192
      || /^(?:todo|tbd|pending|placeholder|none|unknown)\b/i.test(review.proof.trim())) continue;
    const refs = review.refs.map(ref => normalizeTaskFileRef(ref, repoRoot));
    if (refs.some(ref => !ref) || new Set(refs).size !== refs.length) continue;
    for (const event of receipts) {
      if (event.taskId === review.sourceTask && event.at === review.completedAt && event.historyIndex === review.historyIndex
        && note.at >= event.at && JSON.stringify([...refs].sort()) === JSON.stringify(event.sharedRefs)) {
        event.reviewedAt = Math.max(event.reviewedAt || 0, note.at);
      }
    }
  }
  return '';
}

/** Exact declared file identity only. No disk access, glob expansion, basename
 * search or foreign-checkout aliasing. Line/fragment refs share the same file. */
export function normalizeTaskFileRef(value, repoRoot = process.cwd()) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  let ref = value.trim().replace(/\\/g, '/').replace(/#.*$/, '').replace(/:\d+(?:-\d+|:\d+)?$/, '');
  const root = String(repoRoot).replace(/\\/g, '/').replace(/\/$/, '');
  const windows = /^[a-z]:\//i.test(root);
  if (windows) { ref = ref.toLowerCase(); }
  const rootKey = windows ? root.toLowerCase() : root;
  if (ref.startsWith(rootKey + '/')) ref = ref.slice(rootKey.length + 1);
  if (/^[a-z]+:|^\//i.test(ref) || /[\x00-\x1f*?{}\[\]]/.test(ref)) return null;
  if (ref.split('/').includes('..')) return null;
  ref = path.posix.normalize(ref);
  if (!/^[^:]+\.[a-z0-9]{1,12}$/i.test(ref) || ref.endsWith('/')) return null;
  return ref;
}

/** Compute from the WHOLE board before filters. Callers with a partial or failed
 * snapshot must pass complete:false; missing provenance never means "fresh".
 * Warning lifetime is deliberately conservative: generic edits, COUNT-SOURCE
 * declarations and a source reopening cannot certify revised counts. */
export function taskReferenceFreshness(tasks, {repoRoot = process.cwd(), complete = true, limits = {}} = {}) {
  const bounds = {...DEFAULT_LIMITS, ...limits};
  const rows = Array.isArray(tasks) ? tasks : [];
  const views = new Map(rows.filter(t => t && typeof t.id === 'string').map(t => [t.id, result(UNFINISHED.has(t.state) ? 'not_flagged' : 'not_applicable')]));
  const unavailable = reason => {
    for (const t of rows) if (t && UNFINISHED.has(t.state)) views.set(t.id, result('unavailable', reason));
    return views;
  };
  if (!complete || !Array.isArray(tasks)) return unavailable('Complete board snapshot unavailable.');
  if (rows.length > bounds.tasks || rows.some(t => !t || typeof t.id !== 'string') || views.size !== rows.length) return unavailable('Board size or task identity limit exceeded.');
  let entries = 0;
  const refsOf = refs => {
    if (!Array.isArray(refs) || refs.length > bounds.refs || refs.some(x => typeof x !== 'string' || x.length > 2048)) throw new Error('File-reference metadata unavailable or over limit.');
    entries += refs.length;
    if (entries > bounds.entries) throw new Error('Board metadata limit exceeded.');
    return [...new Set(refs.map(ref => normalizeTaskFileRef(ref, repoRoot)).filter(Boolean))].sort();
  };
  const files = new Map(), byFile = new Map(), uncertainSources = new Set();
  try {
    for (const task of rows) {
      const currentRefs = refsOf(task.refs || []); files.set(task.id, currentRefs);
      const history = task.history || [];
      if (!Array.isArray(history) || history.length > bounds.history) throw new Error('Completion history unavailable or over limit.');
      entries += history.length;
      if (entries > bounds.entries) throw new Error('Board metadata limit exceeded.');
      let historicalRefs = currentRefs, sawCompletion = false;
      for (let index = history.length - 1; index >= 0; index--) {
        const event = history[index];
        if (!event || typeof event !== 'object') throw new Error('Completion history malformed.');
        if (event.action === 'edit' && Array.isArray(event.fields) && event.fields.includes('refs')) {
          historicalRefs = Array.isArray(event.from?.refs) ? refsOf(event.from.refs) : null;
        }
        if (event.action !== 'state' || event.state !== 'done') continue;
        sawCompletion = true;
        const refs = Array.isArray(event.refs) ? refsOf(event.refs) : historicalRefs;
        if (!refs) { uncertainSources.add(task.id); continue; }
        for (const file of refs) {
          if (!byFile.has(file)) byFile.set(file, []);
          byFile.get(file).push({taskId:task.id, title:String(task.title || ''), at:validTime(event.at) ? event.at : null, historyIndex:index});
        }
      }
      if (task.state === 'done' && !sawCompletion) {
        for (const file of currentRefs) {
          if (!byFile.has(file)) byFile.set(file, []);
          byFile.get(file).push({taskId:task.id, title:String(task.title || ''), at:null, historyIndex:null});
        }
      }
    }
  } catch (error) { return unavailable(error.message); }
  let comparisons = 0;
  for (const task of rows) {
    if (!UNFINISHED.has(task.state)) continue;
    const refs = files.get(task.id), completions = new Map();
    let reason = refs.length && !validTime(task.createdAt) ? 'Task creation time unavailable.' : '';
    if (refs.length && [...uncertainSources].some(id => id !== task.id)) reason = 'Historical completion file refs unavailable.';
    for (const ref of refs) for (const source of byFile.get(ref) || []) {
      if (++comparisons > bounds.comparisons) return unavailable('Shared-file comparison limit exceeded.');
      if (source.taskId === task.id) continue;
      if (!validTime(source.at)) { reason = 'Shared-file completion time unavailable.'; continue; }
      if (source.at < task.createdAt) continue;
      const key = source.taskId + ':' + source.historyIndex;
      if (!completions.has(key)) completions.set(key, {...source, sharedRefs:[]});
      completions.get(key).sharedRefs.push(ref);
      if (completions.size > bounds.completions) return unavailable('Shared-file completion limit exceeded.');
    }
    const receipts = [...completions.values()].sort((a,b) => a.at - b.at || a.taskId.localeCompare(b.taskId) || a.historyIndex - b.historyIndex);
    reason ||= applyRecordedReviews(task, receipts, repoRoot);
    views.set(task.id, result(reason ? 'unavailable' : receipts.length
      ? receipts.every(event => event.reviewedAt !== undefined) ? 'review_recorded' : 'unverified' : 'not_flagged', reason, receipts));
  }
  return views;
}

export function formatReferenceFreshness(view) {
  if (view?.status === 'review_recorded') return ['Shared-file count review recorded for current completion receipts. This is authored evidence, not a certified measurement.'];
  if (!view || !['unverified','unavailable'].includes(view.status)) return [];
  const lines = view.status === 'unavailable'
    ? ['COUNTS UNVERIFIED: overlap check unavailable - ' + view.reason]
    : ['COUNTS UNVERIFIED: shared-file work completed in ' + view.completions.map(x => x.taskId).filter((x,i,a) => a.indexOf(x) === i).join(', ')];
  for (const event of view.completions || []) lines.push(`  ${event.taskId} "${event.title}" completed ${new Date(event.at).toISOString()} (history ${event.historyIndex}); shared refs: ${event.sharedRefs.join(', ')}`);
  lines.push('  Recheck the brief against the current files and record measured counts/proof before dispatch. This warning does not change readiness or grant ownership.');
  return lines;
}
