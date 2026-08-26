/**
 * Personal idea storage for the Idea Board's Remember page.
 * Imports keep original fields and provenance. Conflicting versions are kept
 * side by side; repeated imports do not multiply them. Nothing enters records.json.
 * Called by remember.mjs; also tested without a browser.
 */
export const REMEMBER_KEY = 'idea-board-remember-v1';
export const REMEMBER_BACKUP_KEY = REMEMBER_KEY + '-previous';
export const emptyRemember = () => ({ version: 1, ideas: [], trash: [], receipts: [], projects: [] });

export function parseRememberPayload(value) {
  if (typeof value === 'string') value = JSON.parse(value);
  if (value && Object.hasOwn(value, 'rawIdeas')) value = JSON.parse(value.rawIdeas || '[]');
  const ideas = Array.isArray(value) ? value : value?.personalIdeas ?? value?.ideas;
  if (!Array.isArray(ideas)) throw new Error('Choose a Remember JSON backup containing personal ideas.');
  const validate = rows => rows.map((idea, index) => {
    if (!idea || typeof idea !== 'object' || Array.isArray(idea) || typeof idea.id !== 'string' || !idea.id || typeof idea.title !== 'string' || !idea.title.trim()) {
      throw new Error(`Idea ${index + 1} has no valid ID or title. Nothing was imported.`);
    }
    for (const key of ['note', 'theme', 'scope', 'project', 'status', 'next', 'implementationStatus', 'implementationEvidence', 'sourceUrl']) {
      if (idea[key] != null && typeof idea[key] !== 'string') throw new Error(`Idea ${index + 1} has an invalid ${key}. Nothing was imported.`);
    }
    if (idea.source != null && (!Array.isArray(idea.source) || idea.source.some(source => !source || typeof source !== 'object' || Array.isArray(source)))) {
      throw new Error(`Idea ${index + 1} has invalid source references. Nothing was imported.`);
    }
    return structuredClone(idea);
  });
  if (value?.projects != null && (!Array.isArray(value.projects) || value.projects.some(project => typeof project !== 'string'))) throw new Error('Project names must be a list of text values.');
  return { ideas: validate(ideas), trash: validate(value?.trash || []), projects: value?.projects || [] };
}

// Compare actual content, including unknown provenance fields, not just titles.
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const fingerprint = idea => {
  const copy = { ...idea };
  if (copy.migrationOriginalId) { copy.id = copy.migrationOriginalId; delete copy.migrationOriginalId; }
  return stable(copy);
};

export function mergeRemember(current, payload) {
  const imported = parseRememberPayload(payload);
  const next = structuredClone(current);
  next.projects = [...new Set([...(current.projects || []), ...imported.projects])];
  let added = 0, skipped = 0, conflicts = 0;
  for (const lane of ['ideas', 'trash']) {
    for (const original of imported[lane]) {
      const all = [...next.ideas, ...next.trash];
      if (all.some(idea => fingerprint(idea) === fingerprint(original))) { skipped++; continue; }
      const item = { ...original };
      if (all.some(idea => idea.id === item.id)) {
        let suffix = 1;
        while (all.some(idea => idea.id === `${original.id}~import-${suffix}`)) suffix++;
        item.id = `${original.id}~import-${suffix}`;
        item.migrationOriginalId = original.id;
        conflicts++;
      }
      next[lane].push(item); added++;
    }
  }
  next.receipts.push({ at: new Date().toISOString(), added, skipped, conflicts, received: imported.ideas.length + imported.trash.length });
  return { next, added, skipped, conflicts };
}

export function readRemember(storage) {
  const raw = storage.getItem(REMEMBER_KEY);
  if (raw === null) return emptyRemember();
  const saved = JSON.parse(raw);
  if (saved.version !== 1) throw new Error('This Remember collection uses an unsupported version. Export it before changing anything.');
  const parsed = parseRememberPayload(saved);
  return { ...saved, ...parsed, receipts: Array.isArray(saved.receipts) ? saved.receipts : [] };
}

export function saveRemember(storage, next) {
  parseRememberPayload(next);
  const previous = storage.getItem(REMEMBER_KEY);
  if (previous !== null) storage.setItem(REMEMBER_BACKUP_KEY, previous);
  const serialized = JSON.stringify(next);
  storage.setItem(REMEMBER_KEY, serialized);
  if (storage.getItem(REMEMBER_KEY) !== serialized) throw new Error('Your browser did not save the collection. Export a backup and try again.');
}
