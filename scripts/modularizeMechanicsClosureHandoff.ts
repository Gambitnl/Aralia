import fs from 'node:fs';
import path from 'node:path';

/**
 * This script moves older spell mechanics closure handoff batch history into a
 * separate history document.
 *
 * The active handoff is the restart surface for agents. It should stay short
 * enough to review before the next batch begins. Older completed-batch details
 * are still valuable evidence, but they do not need to sit in the current-state
 * file forever. This script preserves those details in a history file and leaves
 * the handoff with a pointer to that history.
 *
 * Called by: agents during mandatory between-batch modularization checkpoints.
 * Depends on: stable markdown markers in `MECHANICS_CLOSURE_HANDOFF.md`.
 */

// ============================================================================
// Paths And Markers
// ============================================================================
// The split is intentionally marker-based instead of line-number-based so small
// edits above the completed-batch section do not break the modularization.
// ============================================================================

const repoRoot = process.cwd();
const handoffPath = path.join(
  repoRoot,
  'docs/tasks/spells/mechanics-discovery/MECHANICS_CLOSURE_HANDOFF.md',
);
const historyPath = path.join(
  repoRoot,
  'docs/tasks/spells/mechanics-discovery/MECHANICS_CLOSURE_BATCH_HISTORY.md',
);

const startMarker = '\nPrevious completed batch:\n\n';
const endMarker = '\n## Current In-Flight Batch\n';

// ============================================================================
// Handoff Loading
// ============================================================================
// Keep the operation conservative: if the expected markers are missing, fail
// instead of trying to guess what should be moved.
// ============================================================================

const handoff = fs.readFileSync(handoffPath, 'utf8');
const startIndex = handoff.indexOf(startMarker);
const endIndex = handoff.indexOf(endMarker);

if (startIndex === -1) {
  throw new Error(`Could not find completed-batch history start marker in ${handoffPath}`);
}

if (endIndex === -1 || endIndex <= startIndex) {
  throw new Error(`Could not find current in-flight marker after history start in ${handoffPath}`);
}

const retained = handoff.slice(0, startIndex);
const movedHistory = handoff.slice(startIndex + startMarker.length, endIndex).trim();
const rest = handoff.slice(endIndex);

// ============================================================================
// History Writing
// ============================================================================
// The history file is regenerated from the current handoff content. That makes
// the split repeatable and avoids appending duplicate batch histories.
// ============================================================================

const history = `# Spell Mechanics Closure Batch History

Status: archived completed-batch detail
Last updated: 2026-05-14

This file stores completed-batch detail moved out of \`MECHANICS_CLOSURE_HANDOFF.md\` during the between-batch modularization checkpoint. The active handoff remains the restart surface; this file preserves older evidence and rationale.

${movedHistory}
`;

const pointer = `
Previous completed batch history has been moved to:

- \`docs/tasks/spells/mechanics-discovery/MECHANICS_CLOSURE_BATCH_HISTORY.md\`

Keep only the latest completed batch in this handoff. Move older batch detail back into the history file when this restart surface grows past the review threshold.
`;

fs.writeFileSync(historyPath, history, 'utf8');
fs.writeFileSync(handoffPath, `${retained}${pointer}${rest}`, 'utf8');

console.log(`Moved completed-batch history to ${historyPath}`);
