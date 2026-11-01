/**
 * Finds work that explicitly asks for the owner's decision or hands-on action.
 * The dashboard reads existing Agora tasks; this is not a second decision store.
 * Legacy blockers remain visible, but dependency-only waits are not new questions.
 */
export function blockedReason(task) {
  const transition = [...(task.history || [])].reverse().find((entry) => entry.action === 'state' && entry.state === 'blocked');
  return String(transition?.reason || '').trim();
}

export function humanRequestKind(task) {
  if (task.state === 'done') return null;
  const categories = [task.category, ...(task.categories || [])];
  if (categories.includes('human-decision')) return 'decision';
  if (categories.includes('human-action')) return 'action';
  if (task.state !== 'blocked') return null;
  const reason = blockedReason(task);
  // A task waiting on another task's ruling must not ask the same question again.
  if (/^(?:gated\b|depends\b|its own body: do not\b|needs split\b)/i.test(reason)
      || /^[^\n]*(?:has not landed|waits on a question-sheet answer)/i.test(reason)) return null;
  const direct = /^(?:blocked on (?:remy|human[- ]operator)\b|needs remy\b|human[- ]operator:)/i.test(reason)
    || /(?:needs remy's hands|asset sourcing is a remy decision|build waits on remy's|do not start until q\d+ is answered)/i.test(reason);
  if (!direct) return null;
  // Account operations, downloads and protected commands need a person, but are
  // different from choosing product behavior. Keep them in their own lane.
  // Some legacy notes list several neighboring tasks. Their "eyeball backlog"
  // must not turn a different task's skeleton or repository ruling into action.
  return /(?:run or explicitly authorize|needs remy's hands|third-party account|interactive session)/i.test(reason)
    || /(?:eyeball backlog|hands-on)/i.test(task.title)
    ? 'action' : 'decision';
}

export function collectHumanRequests(tasks, { now = Date.now() } = {}) {
  return tasks.flatMap((task) => {
    const kind = humanRequestKind(task);
    if (!kind) return [];
    return [{ task, kind, reason: blockedReason(task), explicit: [task.category, ...(task.categories || [])].includes('human-' + kind),
      stale: !task.updatedAt || now - task.updatedAt > 14 * 24 * 60 * 60 * 1000 }];
  }).sort((a, b) => (a.task.priority ?? 99) - (b.task.priority ?? 99)
    || (a.task.createdAt || 0) - (b.task.createdAt || 0) || a.task.id.localeCompare(b.task.id));
}

// Board text is untrusted. Only HTTP links may become clickable; plain file and
// Plan Map references stay text rather than being treated as arbitrary schemes.
export function sourceLinks(task) {
  const values = [...(task.refs || []), task.body, task.result, blockedReason(task)].filter(Boolean).join('\n');
  const urls = values.match(/https?:\/\/[^\s<>"`]+/g) || [];
  return [...new Set(urls.map((value) => value.replace(/[.,;)]*$/, '')))].filter((value) => {
    try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
  });
}

const blocking = new Set(['blocks', 'parent-child', 'waits-for', 'conditional-blocks']);
const dependencyTypes = new Set([...blocking, 'related', 'tracks', 'discovered-from', 'caused-by', 'validates', 'supersedes']);

/** WF-G353: dependency records name an ID and a relationship, not an object
 * used as an ID. Preserve legacy strings and unambiguous renamed targets.
 * Missing/unknown records stay explicit; this display never changes readiness. */
export function resolveTaskDependencies(task, tasks, {byId = new Map(tasks.map(row => [row.id, row]))} = {}) {
  return (task.deps || []).map(raw => {
    const originalId = typeof raw === 'string' ? raw : typeof raw?.id === 'string' ? raw.id : '';
    const type = typeof raw === 'string' ? 'blocks' : raw?.type == null ? 'blocks' : typeof raw.type === 'string' ? raw.type : '(invalid type)';
    const aliases = byId.has(originalId) ? [] : tasks.filter(row => row.formerIds?.includes(originalId));
    const target = byId.get(originalId) || (aliases.length === 1 ? aliases[0] : null);
    const invalid = !originalId || !dependencyTypes.has(type);
    return {id: target?.id || originalId || '(missing dependency ID)', originalId, type,
      blocking: invalid ? null : blocking.has(type), task: target || null,
      missing: !target, ambiguous: aliases.length > 1, invalid};
  });
}

export function blockingDependents(tasks, id) {
  return tasks.filter((task) => task.state !== 'done' && (task.deps || []).some((dep) =>
    typeof dep === 'string' ? dep === id : dep.id === id && blocking.has(dep.type || 'blocks')));
}
