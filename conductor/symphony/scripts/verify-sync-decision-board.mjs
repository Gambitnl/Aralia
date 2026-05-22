import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// This verifier protects the operator-facing Git sync decision board.
//
// The live Aralia checkout can be blocked by user-owned work that Symphony
// must not mutate on its own. The dashboard therefore needs to expose the big
// human decisions directly instead of only listing Git commands or sample
// files. This keeps the Jules middleman workflow moving at the stage level:
// decide what belongs in GitHub, what should be set aside, and only then allow
// Linear/Jules handoff work to continue.

const dashboard = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
const stylesheet = await readFile(new URL('../public/dashboard.css', import.meta.url), 'utf8');

// The board must be rendered from the same preflight object as the hard gate
// so the operator sees the decision guidance exactly where Jules is blocked.
assert.match(dashboard, /renderSyncDecisionBoard\(preflight, gitDisposition\)/);
assert.match(dashboard, /const syncDecisionBoard = renderSyncDecisionBoard\(preflight, gitDisposition\);/);
assert.match(dashboard, /\$\{syncDecisionBoard\}/);

// Each decision category maps to a real blocker class observed in the current
// live workspace: one local-only commit, tracked edits/deletions, many
// untracked artifacts, and remote-only commits waiting on GitHub.
assert.match(dashboard, /Local-only commits/);
assert.match(dashboard, /Tracked edits and deletions/);
assert.match(dashboard, /Untracked artifacts/);
assert.match(dashboard, /Remote-only commits/);

// The copy should state the ownership question, not only the Git command. That
// distinction prevents the dashboard from nudging the operator into a blind
// pull, push, stash, or delete while unrelated user work is present.
assert.match(dashboard, /Decide whether Jules and GitHub should see these local commits/);
assert.match(dashboard, /Decide whether each tracked edit belongs to the Jules base/);
assert.match(dashboard, /Decide which new artifacts are source, docs, generated proof, ignored output, or discardable scratch/);
assert.match(dashboard, /Fast-forward only after local commits and working-tree changes are intentionally handled/);
assert.match(dashboard, /Record Git disposition/);
assert.match(dashboard, /This records operator intent only. It does not change Git and does not bypass the sync gate./);
assert.match(dashboard, /data-git-disposition-category/);
assert.match(dashboard, /recordGitDisposition/);
assert.match(dashboard, /renderGitResolutionPacket\(preflight\.resolutionPacket\)/);
assert.match(dashboard, /renderGitSyncPlan\(snapshot\.gitSyncPlan\)/);
assert.match(dashboard, /renderTaskRouting\(snapshot\.taskRouting, snapshot\.taskNudges\)/);
assert.match(dashboard, /function shouldOpenGitSafetyGroup/);
assert.match(dashboard, /Git Safety', 'Preflight, disposition, sync plan, and the global path evidence\.', gitSafety, gitSafetyNeedsAttention/);
assert.match(dashboard, /Sync Decision Board\|Guarded Git sync plan\|blocked_by_disposition/);
assert.match(dashboard, /Git resolution packet/);
assert.match(dashboard, /Guarded Git sync plan/);
assert.match(dashboard, /Task routing and nudge plan/);
assert.match(dashboard, /formatNudgeCadence/);
assert.match(dashboard, /Mutating commands remain human-operated outside this panel/);
assert.match(dashboard, /Read-only: \$\{packet\.mutatesGit === false \? 'yes' : 'unknown'\}/);
assert.match(dashboard, /resolutionCommitList\('Local-only commits', localCommits\)/);
assert.match(dashboard, /resolutionFileList\('Untracked files', untrackedFiles\)/);

// The board needs its own visual treatment so it is visible in the in-app
// browser as an operator checkpoint, not hidden inside the existing details
// disclosure.
assert.match(stylesheet, /\.sync-decision-board/);
assert.match(stylesheet, /\.sync-decision-grid/);
assert.match(stylesheet, /\.sync-decision-card/);
assert.match(stylesheet, /\.git-resolution-packet/);
assert.match(stylesheet, /\.git-resolution-grid/);
assert.match(stylesheet, /\.git-sync-plan/);
assert.match(stylesheet, /\.task-routing/);
assert.match(stylesheet, /\.task-nudge-ledger/);
