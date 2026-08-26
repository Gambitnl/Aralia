/**
 * This file holds the Idea Board's shared vocabulary.
 *
 * Board-wide terms live here because they describe the board's own contract:
 * statuses, evidence classes, source roles, baseline fields, conclusions, and
 * the Aralia surfaces that recur across many records. Terms that belong to one
 * idea live in that record's `lexicon` list in records.json, so the record page
 * can show only the concepts a reader needs for that idea.
 *
 * Called by: app.mjs
 * Depends on: nothing
 */

// ============================================================================
// Board-Wide Terms
// ============================================================================
// Each group is a reading order, not a taxonomy. A term's `see` list names
// other terms in this file by their exact `term` text.
// ============================================================================

export const BOARD_LEXICON = Object.freeze([
  {
    group: 'The board',
    terms: [
      { term: 'Idea Board', meaning: 'Aralia\'s dated institutional memory for external techniques, tools, papers, products, and demos. It compares each source with the project as it existed on the assessment date. It is not a bookmark list or an integration queue.' },
      { term: 'Record', meaning: 'One idea with a stable IB- identity, a summary, a problem statement, tags, a source shelf, and one or more dated revisions.', see: ['Revision', 'Source shelf'] },
      { term: 'Revision', meaning: 'One dated assessment of a record. A later revision links to the one before it and never rewrites it. The newest revision is the current conclusion.', see: ['Historical snapshot'] },
      { term: 'Historical snapshot', meaning: 'An older revision opened by its own URL. The page shows it exactly as written and links to the current assessment.' },
      { term: 'Read only', meaning: 'The dashboard never writes project state. Every durable fact lives in the versioned records.json file that agents edit by hand.' },
      { term: 'Deliberate exclusion', meaning: 'A supplied source that the board records with a reason instead of an assessment, for example a duplicate address. It keeps an EXC- identity so the decision stays traceable.' },
      { term: 'Agent guide', meaning: 'The permanent #/guide route. It tells a cold agent how to classify a source, capture evidence, decide, preserve history, and verify.' },
    ],
  },
  {
    group: 'Identifiers',
    terms: [
      { term: 'IB-', meaning: 'A record identity such as IB-0010. Numbers only go up. A retired number is never reused.' },
      { term: 'SRC-', meaning: 'A source identity such as SRC-0047. Every source address is unique across the whole board.' },
      { term: 'R001, R002', meaning: 'A revision identity under its record, such as IB-0010-R001. R001 is the first assessment.' },
      { term: 'EXC-', meaning: 'A deliberate exclusion identity such as EXC-0001.' },
    ],
  },
  {
    group: 'Status',
    terms: [
      { term: 'promising', meaning: 'The evidence supports a real benefit for Aralia, and a bounded next step is clear.' },
      { term: 'worth watching', meaning: 'The idea has merit, but a blocker, a missing measurement, or a style or boundary mismatch stops any next step today.' },
      { term: 'unsuitable', meaning: 'The idea does not fit Aralia\'s needs, boundaries, or licences, and the record explains why.' },
      { term: 'superseded', meaning: 'A newer revision or a newer record replaces this conclusion. The old text stays for history.' },
      { term: 'adopted', meaning: 'A later approved change brought the idea into the project through normal review. The board records the fact; it never performs the adoption.' },
      { term: 'experiment in progress', meaning: 'An explicitly requested bounded experiment is running in an isolated lane.' },
    ],
  },
  {
    group: 'Source maturity',
    terms: [
      { term: 'complete implementation', meaning: 'Public source that runs end to end, usually with a licence, tests, or a release.' },
      { term: 'partial technique', meaning: 'A method with some artifacts or code, but not a runnable general pipeline.' },
      { term: 'demonstration', meaning: 'A video, post, or hosted result that shows an outcome without exposing how it was made.' },
      { term: 'speculative concept', meaning: 'A described idea with no artifact to inspect.' },
      { term: 'supporting evidence', meaning: 'A source added to an existing record because it concerns the same mechanism and problem.' },
    ],
  },
  {
    group: 'Confidence',
    terms: [
      { term: 'high confidence', meaning: 'Primary sources were inspected directly and the key claims were verified or measured.' },
      { term: 'medium confidence', meaning: 'Sources and licences were verified, but a key property such as performance or quality on Aralia hardware was not measured.' },
      { term: 'low confidence', meaning: 'The assessment rests mostly on claims, a demo, or documentation that could not be checked.' },
    ],
  },
  {
    group: 'Evidence classes',
    terms: [
      { term: 'Facts', meaning: 'Statements the assessor verified in a source or in Aralia on the assessment date.' },
      { term: 'Inferences', meaning: 'The assessor\'s interpretation of the facts. It is labeled so it is never mistaken for a source claim.' },
      { term: 'Unknowns', meaning: 'Questions the evidence does not answer. They set the limit of the conclusion.' },
      { term: 'Recommendations', meaning: 'What the assessor advises the project to do or not do next, without authorizing any action.' },
    ],
  },
  {
    group: 'Source shelf',
    terms: [
      { term: 'Source shelf', meaning: 'Every retained source for a record: the original post, the repository, the pinned commit, documentation, releases, licences, and receipts.' },
      { term: 'primary', meaning: 'A source role. The artifact itself: the code, paper, release, or original demonstration.' },
      { term: 'supporting', meaning: 'A source role. Documentation, licences, receipts, or dependencies that back the primary source.' },
      { term: 'discovery', meaning: 'A source role. The post or link that brought the idea to the board. It proves interest, not quality.' },
      { term: 'Source explicitly claims', meaning: 'What the source says about itself, in its own words.' },
      { term: 'Directly demonstrated', meaning: 'What the assessor could see the source do or contain, as distinct from what it claims.' },
      { term: 'Implementation contains', meaning: 'What is actually in the code or artifact, and what is missing from it.' },
      { term: 'Provenance', meaning: 'How and when the assessor reached the source, and what was and was not run, downloaded, or signed into.' },
      { term: 'Pinned revision', meaning: 'The exact commit, tag, or release inspected. Evidence always names it so a later reader sees the same thing.' },
      { term: 'unavailable: <reason>', meaning: 'The honest value for a date, licence, or revision the source does not expose. The board never guesses precision.' },
      { term: 'Archive', meaning: 'A link to a third-party snapshot of a source at risk of disappearing. The board links snapshots; it never makes or stores one.' },
    ],
  },
  {
    group: 'Aralia baseline',
    terms: [
      { term: 'Committed baseline', meaning: 'The Git commit and its timestamp that Aralia was at when the assessment ran.' },
      { term: 'Workspace inspected', meaning: 'The exact time the assessor looked at the local checkout.' },
      { term: 'Dirty workspace', meaning: 'The checkout had uncommitted work. The commit alone does not describe the project state, and the record says so.' },
      { term: 'Source provided', meaning: 'The date the operator supplied the source to the board.' },
      { term: 'Assessed', meaning: 'The timestamp of the revision itself.' },
    ],
  },
  {
    group: 'Comparison and fit',
    terms: [
      { term: 'Dimension', meaning: 'One aspect on which the external approach and Aralia\'s approach are compared, such as hair or renderer.' },
      { term: 'External approach', meaning: 'How the source solves the dimension.' },
      { term: 'Aralia at assessment', meaning: 'How Aralia solved the same dimension on the assessment date, with evidence from the codebase.' },
      { term: 'Fit assessment', meaning: 'A structured judgment: what could help, what would not, complements, what must not be replaced, boundaries, dependencies, blockers, risks, owners, rollback, and one conclusion.' },
      { term: 'Must not replace', meaning: 'Project-owned systems and authority that an idea may inform but never take over.' },
      { term: 'Architectural boundary', meaning: 'Where an idea would sit if tried, and what it may never touch, such as gameplay state or production assets.' },
      { term: 'Blocker', meaning: 'A named condition that stops any next step until it is resolved.' },
      { term: 'Ownership', meaning: 'Which project owners must decide before any experiment, adoption, or licence step.' },
    ],
  },
  {
    group: 'Conclusion vocabulary',
    terms: [
      { term: 'Adopt directly', meaning: 'The idea can enter the project through normal review with no adaptation layer.' },
      { term: 'Adapt behind a boundary', meaning: 'The idea is useful only when re-expressed inside an Aralia-owned boundary.' },
      { term: 'Test as an optional sidecar', meaning: 'Try it as a separate, removable lane beside the project, never inside the production path.' },
      { term: 'Watch for future maturity', meaning: 'Do nothing now. Reassess when the source, Aralia, or a named requirement changes.' },
      { term: 'Reject for the current project', meaning: 'The idea does not fit, and the record explains why.' },
      { term: 'Revisit after a named blocker is resolved', meaning: 'A specific blocker, such as a licence, must clear before the idea is reconsidered.' },
    ],
  },
  {
    group: 'Experiments',
    terms: [
      { term: 'Bounded experiment', meaning: 'A written, measurable, isolated test with pinned inputs, a time limit, pass and reject gates, and cleanup. Writing it down does not run it.' },
      { term: 'Isolation boundary', meaning: 'Where the experiment runs and what it may not touch. Usually a disposable lane with no repository writes.' },
      { term: 'Acceptance criteria', meaning: 'Measurable results that would make the experiment a pass.' },
      { term: 'Rejection criteria', meaning: 'Measurable results that would make the experiment a fail.' },
      { term: 'Cleanup / rollback', meaning: 'How every file, process, flag, and hash returns to baseline after the experiment.' },
      { term: 'Clean-room', meaning: 'Re-expressed from a description only, with no copied source, so licence and provenance stay clean.' },
      { term: 'Sidecar', meaning: 'A separate tool or lane that runs beside the project and hands back candidates, without authority over project state.' },
      { term: 'Candidate', meaning: 'An artifact or result that exists for review only. It becomes a project asset only through normal ownership and promotion.' },
      { term: 'Promotion', meaning: 'The approved step that moves a candidate into accepted project state. The board never promotes anything.' },
    ],
  },
  {
    group: 'Aralia surfaces',
    terms: [
      { term: 'Entity Studio', meaning: 'Aralia\'s standalone entity authoring and review surface for candidate assets, rigs, and visual checks.' },
      { term: 'Character Atelier', meaning: 'The procedural character part library and head, hair, and rig construction in Aralia.' },
      { term: 'Design Preview', meaning: 'Aralia\'s project-owned preview scene for feature and rendering checks, including visual proof captures.' },
      { term: 'BattleMap', meaning: 'The 3D tactical combat map. It renders with WebGL by default and has an opt-in WebGPU path.' },
      { term: 'World3D', meaning: 'Aralia\'s 3D world rendering: terrain, water, vegetation, and environments.' },
      { term: 'WorldForge', meaning: 'Aralia\'s deterministic world and town generation, including street networks.' },
      { term: 'Visual verdict', meaning: 'A reviewer decision based on a captured image or scene, recorded as proof.' },
      { term: 'Sheet distance', meaning: 'The typical camera distance for Aralia figures. Parts are shaped and colored to read clearly at that distance.' },
    ],
  },
]);

// ============================================================================
// Lookup
// ============================================================================
// Pills and labels use these helpers to show a short definition on hover.
// ============================================================================

const index = new Map();
for (const group of BOARD_LEXICON) {
  for (const entry of group.terms) index.set(entry.term.toLowerCase(), entry);
}

export function boardTerm(term) {
  return index.get(String(term ?? '').toLowerCase()) ?? null;
}

export function boardMeaning(term) {
  return boardTerm(term)?.meaning ?? '';
}

// Slugs make each term addressable at #/lexicon/<slug>.
export function termSlug(term) {
  return String(term).toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-|-$/g, '');
}
