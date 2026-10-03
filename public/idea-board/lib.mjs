/**
 * This file contains the Idea Board's shared, side-effect-free browser rules.
 *
 * The dashboard uses these helpers to normalize source addresses, interpret
 * stable record links, choose the current dated assessment, and filter large
 * collections. Keeping these rules separate lets the Node validation tests
 * prove URL and routing behavior without starting the browser application.
 *
 * Called by: app.mjs and scripts/idea-board/validate.test.mjs
 * Depends on: browser and Node standard JavaScript only
 */

// ============================================================================
// Board Vocabulary
// ============================================================================
// These values are the public language of the board. A record must use one of
// them so filters and status summaries cannot drift into near-duplicates.
// ============================================================================

export const ASSESSMENT_STATUSES = Object.freeze([
  'promising',
  'worth watching',
  'unsuitable',
  'superseded',
  'adopted',
  'experiment in progress',
]);

export const IDEA_KINDS = Object.freeze([
  'complete implementation',
  'partial technique',
  'demonstration',
  'speculative concept',
  'supporting evidence',
]);

export const CONFIDENCE_LEVELS = Object.freeze(['low', 'medium', 'high']);

// ============================================================================
// Stable Source Identity
// ============================================================================
// Source URLs are normalized only enough to catch accidental duplicates. Query
// strings remain intact because repository revisions and video timestamps can
// be evidence-bearing parts of a primary source.
// ============================================================================

export function normalizeSourceUrl(value) {
  const url = new URL(value);
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
  return url.toString();
}

// ============================================================================
// Historical Assessment Selection
// ============================================================================
// A record's latest revision is its current conclusion. Older revisions remain
// addressable and are never overwritten when the source or Aralia changes.
// ============================================================================

export function sortRevisionsNewestFirst(revisions) {
  return [...revisions].sort((left, right) => right.assessedAt.localeCompare(left.assessedAt));
}

export function currentRevision(record) {
  return sortRevisionsNewestFirst(record.revisions)[0] ?? null;
}

// ============================================================================
// Stable Hash Routes
// ============================================================================
// Hash routes work on static hosting without server rewrites. Both records and
// individual historical revisions have durable, copyable addresses.
// ============================================================================

export function recordUrl(recordId) {
  return `#/ideas/${encodeURIComponent(recordId)}`;
}

export function revisionUrl(recordId, revisionId) {
  return `${recordUrl(recordId)}/revisions/${encodeURIComponent(revisionId)}`;
}

export function guideUrl() {
  return '#/guide';
}

export function promptsUrl(promptId = '', recordId = '') {
  const base = promptId ? `#/prompts/${encodeURIComponent(promptId)}` : '#/prompts';
  return recordId ? `${base}?record=${encodeURIComponent(recordId)}` : base;
}

export function lexiconUrl(slug = '') {
  return slug ? `#/lexicon/${encodeURIComponent(slug)}` : '#/lexicon';
}

export function parseIdeaRoute(hash) {
  const cleanHash = hash.split('?')[0].replace(/^#\/?/, '');
  const parts = cleanHash.split('/').filter(Boolean).map(decodeURIComponent);

  if (parts[0] === 'remember' && parts.length === 1) return { view: 'remember' };

  // The prompt library is copy-only; an optional ID scrolls to one prompt.
  if (parts[0] === 'prompts' && parts.length <= 2) return { view: 'prompts', prompt: parts[1] ?? '' };

  // The guide is a permanent cold-start route, not record data or an editing surface.
  if (parts[0] === 'guide' && parts.length === 1) return { view: 'guide' };

  // The lexicon explains board vocabulary; an optional slug scrolls to one term.
  if (parts[0] === 'lexicon' && parts.length <= 2) return { view: 'lexicon', term: parts[1] ?? '' };

  // The index is the safe fallback for empty, malformed, or unrelated hashes.
  if (parts[0] !== 'ideas' || !parts[1]) return { view: 'index' };

  // A revision route preserves a dated conclusion even after newer evidence is added.
  if (parts[2] === 'revisions' && parts[3]) {
    return { view: 'revision', recordId: parts[1], revisionId: parts[3] };
  }

  return { view: 'record', recordId: parts[1] };
}

// ============================================================================
// Search And Filter
// ============================================================================
// The search corpus includes the latest assessment plus stable identity fields.
// This keeps hundreds of records usable without hiding historical revisions.
// ============================================================================

export function filterRecords(records, filters) {
  const query = filters.query.trim().toLowerCase();

  return records.filter((record) => {
    const revision = currentRevision(record);
    const searchable = [
      record.id,
      record.title,
      record.summary,
      record.problem,
      ...record.tags,
      ...(revision?.recommendations ?? []),
    ].join(' ').toLowerCase();

    const matchesQuery = !query || searchable.includes(query);
    const matchesStatus = !filters.status || revision?.status === filters.status;
    const matchesKind = !filters.kind || record.kind === filters.kind;
    const matchesConfidence = !filters.confidence || revision?.confidence === filters.confidence;
    return matchesQuery && matchesStatus && matchesKind && matchesConfidence;
  });
}
