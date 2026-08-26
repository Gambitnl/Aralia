/**
 * This file holds the Idea Board's prompt library.
 *
 * Curated prompts are versioned here so every agent receives the same intake,
 * reassessment, experiment, and maintenance instructions. Personal prompts live
 * only in this browser's local storage, like the Remember page. Placeholders use
 * {{NAME}} and are filled on the page before copying.
 *
 * The pure helpers below take storage as an argument, so the Node tests can
 * prove them without a browser.
 *
 * Called by: app.mjs and scripts/idea-board/validate.test.mjs
 * Depends on: nothing
 */

// ============================================================================
// Curated Prompts
// ============================================================================
// Each prompt names the runbook as the authority, so a pasted prompt stays
// correct even when an agent has no memory of earlier sessions.
// ============================================================================

const RUNBOOK = 'docs/projects/idea-board/RUNBOOK.md';

export const PROMPT_GROUPS = Object.freeze(['Intake', 'Reassess and history', 'Experiments', 'Understand', 'Maintenance']);

export const BOARD_PROMPTS = Object.freeze([
  {
    id: 'intake-source',
    group: 'Intake',
    title: 'Add one source to the Idea Board',
    when: 'You found a post, repository, paper, or product and want a dated assessment.',
    body: `Add this source to the Aralia Idea Board: {{SOURCE_URL}}

Follow ${RUNBOOK} exactly. Snapshot Aralia first (HEAD, commit time, git status count, inspection time). Search public/idea-board/records.json for duplicates by URL, mechanism, and problem. Choose one outcome: new record, supporting evidence for an existing record, or deliberate exclusion, and say why.

Separate what the source claims, what it demonstrates, and what its implementation contains. Compare it with Aralia as it is today, with evidence from the codebase. Add a lexicon list of terms a non-specialist needs. Describe a bounded experiment, but do not run it, download it, install it, or sign in anywhere.

Then run the validator, the focused tests, and the sync check, check the rendered record and revision routes at desktop and 375 px, and update AUDIT_OR_PROOF, TRACKER, NORTH_STAR, COLD_START_AGENT_PROMPT, and GAPS.`,
  },
  {
    id: 'intake-batch',
    group: 'Intake',
    title: 'Add several sources in one pass',
    when: 'You collected a few links and want each one classified.',
    body: `Add each of these sources to the Aralia Idea Board, one at a time:

{{SOURCE_URLS}}

Follow ${RUNBOOK} for every source. Each source gets exactly one outcome: a new record, supporting evidence for an existing record, or a deliberate exclusion. Two sources that show the same mechanism and problem belong in one record. Do not run, download, install, or sign in to anything. Validate and update the project docs once at the end, and report a short table: source, outcome, record ID, status, and conclusion.`,
  },
  {
    id: 'add-supporting',
    group: 'Intake',
    title: 'Add supporting evidence to an existing record',
    when: 'A new source shows the same technique as a record you already have.',
    body: `Add {{SOURCE_URL}} to Idea Board record {{RECORD_ID}} as supporting evidence.

Follow ${RUNBOOK} section 2. Confirm first that the source concerns the same mechanism and problem as {{RECORD_ID}}; if it does not, stop and tell me which outcome fits instead. Allocate the next SRC- ID. Append a linked revision only if the new evidence changes the status, confidence, comparison, or conclusion, and explain that decision. Validate, check the record route, and update the project docs.`,
  },
  {
    id: 'exclude-source',
    group: 'Intake',
    title: 'Record a deliberate exclusion',
    when: 'A source should be on file but not assessed, for example a duplicate or a dead link.',
    body: `Record {{SOURCE_URL}} as a deliberate exclusion on the Aralia Idea Board.

Reason: {{REASON}}

Follow ${RUNBOOK}. Allocate the next EXC- ID, record the date supplied and the exclusion date, and write an honest reason. Do not create a record. Validate and update the project docs.`,
  },
  {
    id: 'reassess-record',
    group: 'Reassess and history',
    title: 'Reassess a record',
    when: 'The source or Aralia changed, and the old conclusion may be stale.',
    body: `Reassess Idea Board record {{RECORD_ID}}.

What changed: {{WHAT_CHANGED}}

Follow ${RUNBOOK} section 6. Take a fresh Aralia snapshot, re-inspect the sources at their current revisions, and append a new revision whose previousRevisionId points to the latest one. Never edit or delete an earlier revision. If the old conclusion no longer holds, say so in the new revision. Validate, check the current and the historical revision routes, and update the project docs.`,
  },
  {
    id: 'compare-revisions',
    group: 'Reassess and history',
    title: 'Explain how a record changed over time',
    when: 'A record has more than one revision and you want the story.',
    body: `Read every revision of Idea Board record {{RECORD_ID}} in public/idea-board/records.json and explain, in plain words, what changed between them: status, confidence, conclusion, sources, and the Aralia baseline. Name the evidence that caused each change. Do not edit anything.`,
  },
  {
    id: 'run-experiment',
    group: 'Experiments',
    title: 'Run a record\'s bounded experiment',
    when: 'You decided to try an idea. This prompt is your explicit authorization.',
    body: `I authorize the bounded experiment recorded in the current revision of Idea Board record {{RECORD_ID}}.

Owner decision or brief: {{OWNER_NOTE}}

Stay inside the experiment's exact input, pinned revisions, limit, and isolation boundary. Keep all output under an ignored path in .agent/scratch and confirm with git check-ignore. Measure what the record lists. Judge the result only against its acceptance and rejection criteria. Run the cleanup, confirm production files are unchanged, and append the dated result as a new revision of {{RECORD_ID}}. Do not promote any output into production.`,
  },
  {
    id: 'design-experiment',
    group: 'Experiments',
    title: 'Tighten a proposed experiment',
    when: 'A record\'s experiment is too vague or too large to run.',
    body: `Review the bounded experiment in Idea Board record {{RECORD_ID}}. Check that it has an exact input, pinned revisions, a time limit, measurable acceptance and rejection criteria, an isolation boundary, and a cleanup step. Propose a smaller, sharper version if needed and explain each change. Do not run anything, and do not edit records.json until I approve.`,
  },
  {
    id: 'explain-record',
    group: 'Understand',
    title: 'Explain a record in plain words',
    when: 'You want the short version of an assessment.',
    body: `Explain Idea Board record {{RECORD_ID}} to me in plain words. Cover: what the idea is, what problem it solves, what Aralia does today instead, why it has its current status and conclusion, what is still unknown, and what the smallest next step would be. Use the record's own lexicon for hard terms. Do not edit anything.`,
  },
  {
    id: 'compare-records',
    group: 'Understand',
    title: 'Compare two records',
    when: 'Two ideas look like they solve the same problem.',
    body: `Compare Idea Board records {{RECORD_A}} and {{RECORD_B}}. For each, state the mechanism, the problem, the evidence strength, and the conclusion. Then say whether they overlap, compete, or complement each other for Aralia, and which one I should try first and why. Do not edit anything.`,
  },
  {
    id: 'what-next',
    group: 'Understand',
    title: 'What should I try next?',
    when: 'You want a ranked shortlist from the whole board.',
    body: `Read public/idea-board/records.json and docs/projects/idea-board/TRACKER.md. Rank the waiting experiments by value to Aralia, cost, and risk, with one sentence each. Name the single experiment you would run first and the owner decision it still needs. Focus on: {{FOCUS}}. Do not edit anything.`,
  },
  {
    id: 'lexicon-terms',
    group: 'Maintenance',
    title: 'Add or correct lexicon terms',
    when: 'A record uses words you do not know, or a definition is wrong.',
    body: `Update the lexicon list of Idea Board record {{RECORD_ID}}.

Terms to add or correct: {{TERMS}}

Follow ${RUNBOOK} section 2a. Keep each meaning to one or two plain sentences. Do not repeat a board-wide term from public/idea-board/lexicon.mjs. This is not a reassessment, so do not add a revision. Validate and check the record route.`,
  },
  {
    id: 'map-to-project',
    group: 'Maintenance',
    title: 'Place a record in the constellation',
    when: 'A record shows under Unassigned in the constellation view.',
    body: `Idea Board record {{RECORD_ID}} is unassigned in the constellation view. Add it to the concept map in public/idea-board/organization.mjs with a category, an image, and project connections. Use only connections the record's own fit assessment supports; mark anything else as suggested. Check the constellation and the project counts in the browser.`,
  },
  {
    id: 'board-health',
    group: 'Maintenance',
    title: 'Check board health',
    when: 'Before a commit, or when something looks wrong.',
    body: `Check the health of the Aralia Idea Board. Run:

node scripts/idea-board/validate.mjs
node scripts/idea-board/validate.test.mjs (with node --test)
npm run sync-check
node scripts/idea-board/validate.mjs --reach

Then open the index, the guide, the lexicon, the prompts page, one record, and one historical revision in the browser, at desktop width and at 375 px, and read the console. Report failures, unreachable or redirected sources, and layout problems. Fix nothing without asking.`,
  },
]);

// ============================================================================
// Placeholders
// ============================================================================

const PLACEHOLDER = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;

export function promptVariables(body) {
  return [...new Set([...String(body ?? '').matchAll(PLACEHOLDER)].map((match) => match[1]))];
}

// Empty values keep their placeholder so a half-filled prompt stays visibly unfinished.
export function fillPrompt(body, values = {}) {
  return String(body ?? '').replaceAll(PLACEHOLDER, (whole, name) => {
    const value = values[name];
    return typeof value === 'string' && value.trim() ? value.trim() : whole;
  });
}

// Human label for a placeholder name: RECORD_ID becomes "Record id".
export function variableLabel(name) {
  const text = String(name).toLowerCase().replaceAll('_', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Record pages pre-fill these prompts with their own ID.
export const RECORD_PROMPT_IDS = Object.freeze(['explain-record', 'reassess-record', 'run-experiment', 'lexicon-terms']);

// ============================================================================
// Personal Prompts
// ============================================================================
// Personal prompts are browser-local. Every write keeps the previous copy under
// a backup key, and imports never overwrite an existing prompt.
// ============================================================================

export const PROMPTS_KEY = 'idea-board-prompts-v1';
export const PROMPTS_BACKUP_KEY = `${PROMPTS_KEY}-previous`;
export const emptyPrompts = () => ({ version: 1, prompts: [] });

export function parsePromptsPayload(value) {
  const data = typeof value === 'string' ? JSON.parse(value) : value;
  const rows = Array.isArray(data) ? data : data?.prompts;
  if (!Array.isArray(rows)) throw new Error('Choose a prompt library JSON file with a prompts list.');
  return rows.map((row, index) => {
    const valid = row && typeof row === 'object' && !Array.isArray(row)
      && typeof row.id === 'string' && row.id.trim()
      && typeof row.title === 'string' && row.title.trim()
      && typeof row.body === 'string' && row.body.trim();
    if (!valid) throw new Error(`Prompt ${index + 1} needs an ID, a title, and a body. Nothing was imported.`);
    if (row.group != null && typeof row.group !== 'string') throw new Error(`Prompt ${index + 1} has an invalid group. Nothing was imported.`);
    return { id: row.id.trim(), title: row.title.trim(), group: (row.group ?? '').trim() || 'My prompts', body: row.body, updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : '' };
  });
}

export function readPrompts(storage) {
  const raw = storage.getItem(PROMPTS_KEY);
  if (!raw) return emptyPrompts();
  return { version: 1, prompts: parsePromptsPayload(raw) };
}

export function savePrompts(storage, collection) {
  const previous = storage.getItem(PROMPTS_KEY);
  if (previous) storage.setItem(PROMPTS_BACKUP_KEY, previous);
  storage.setItem(PROMPTS_KEY, JSON.stringify({ version: 1, prompts: collection.prompts }));
}

// Imported prompts with a taken ID get a suffix; identical prompts are skipped.
export function mergePrompts(current, payload) {
  const incoming = parsePromptsPayload(payload);
  const next = { version: 1, prompts: current.prompts.map((prompt) => ({ ...prompt })) };
  let added = 0, skipped = 0;
  for (const prompt of incoming) {
    if (next.prompts.some((item) => item.title === prompt.title && item.body === prompt.body)) { skipped++; continue; }
    let id = prompt.id;
    for (let suffix = 1; next.prompts.some((item) => item.id === id) || BOARD_PROMPTS.some((item) => item.id === id); suffix++) id = `${prompt.id}-${suffix}`;
    next.prompts.push({ ...prompt, id });
    added++;
  }
  return { collection: next, added, skipped };
}

export function newPromptId(collection) {
  let n = collection.prompts.length + 1;
  while (collection.prompts.some((item) => item.id === `my-${n}`)) n++;
  return `my-${n}`;
}
