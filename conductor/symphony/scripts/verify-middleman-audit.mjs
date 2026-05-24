import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/**
 * ============================================================================
 * VERIFIER: verify-middleman-audit.mjs
 * ============================================================================
 * 
 * PURPOSE:
 * This verifier protects the JULES_MIDDLEMAN_AUDIT.md markdown document.
 * It ensures that the document remains the canonical, evidence-based status
 * ledger for the Symphony orchestrator and Jules delegation middleman work.
 * 
 * WHY IT WAS DESIGNED THIS WAY:
 * We want the audit document to keep all 16 goal requirements visible, along
 * with the correct section structure, without pinning it to fragile, short-lived,
 * or dynamic local checkout details (like specific dates or screenshot names).
 * That way, as the implementation progresses, the verifier checks for structural
 * completeness and alignment with the Operating Spec, but does not block
 * clean-up passes or active frontier advancement.
 * 
 * WHAT WAS PRESERVED:
 * - Structural matches for all core markdown sections (Verdict, Requirements, Ledger, Evidence).
 * - Match assertion verifying the existence of exactly 16 requirement rows.
 * - Conceptual validation that documentation maintenance, gitignore safety, and the
 *   separation of measured facts from estimates remain preserved.
 * ============================================================================
 */

// Load the current audit file asynchronously
const audit = await readFile(new URL('../JULES_MIDDLEMAN_AUDIT.md', import.meta.url), 'utf8');

// Section Structure Checks
assert.match(audit, /# Jules Middleman Completion Audit/);
assert.match(audit, /conductor\/symphony\/docs\/JULES_MIDDLEMAN_OPERATING_SPEC\.md/);
assert.match(audit, /goal should point to that spec and this audit instead of growing into a static prompt/);
assert.match(audit, /live Markdown status ledger for the active Symphony goal/);
assert.match(audit, /goalpost, current status, achieved\/not-achieved state, blocker, remaining proof, and evidence path/);
assert.match(audit, /Documentation maintenance is part of the active work loop/);
assert.match(audit, /read-only\s+refresh should be documented as read-only/);
assert.match(audit, /next operator-owned mutation\s+boundary should remain visible/);
assert.match(audit, /operator-owned boundary means external or workflow-advancing mutation/);
assert.match(audit, /Linear, Jules, GitHub, PR branches, deployment waiver, local master sync, or\s+user-visible task decision/);
assert.match(audit, /does not mean ordinary local Symphony hygiene\s+such as documentation edits, verifier updates, local API\/dashboard code edits/);
assert.match(audit, /local checkpoint commits when those changes do not\s+push, launch, merge, sync, contact external systems/);
assert.match(audit, /canonical list of approval boundaries is\s+now `docs\/JULES_MIDDLEMAN_OPERATING_SPEC\.md#approval-boundaries`/);
assert.match(audit, /canonical workflow phase list is\s+`docs\/JULES_MIDDLEMAN_OPERATING_SPEC\.md#workflow-phases`/);
assert.match(audit, /without maintaining a competing ladder/);
assert.match(audit, /operator has allowed assumed approvals at\s+each phase boundary/);
assert.match(audit, /decision point, options considered, agent decision, rationale\/evidence/);

// Gitignore Safety Policies
assert.match(audit, /Repository hygiene is part of that proof discipline/);
assert.match(audit, /Symphony runtime state and\s+live proof output belong under ignored paths/);
assert.match(audit, /contract verifiers are durable source/);
assert.match(audit, /Every `conductor\/symphony\/scripts\/verify-\*\.mjs` file referenced by\s+`verify:jules-contract` must remain visible to Git/);
assert.match(audit, /verify-gitignore-contract-boundary\.mjs` now enforces that every verifier named\s+by the contract suite is not ignored/);
assert.match(audit, /representative `\.symphony` runtime\s+paths remain ignored/);

// Verdict and High-Level Status Matching
assert.match(audit, /## Current Verdict/);
assert.match(audit, /\*\*Not complete yet\.\*\*/);
assert.match(audit, /active goal is now the full Symphony delegation workflow/);
assert.match(audit, /Codex acts as a foreman, clarifies tasks, creates or updates Linear tracking/);
assert.match(audit, /follows Jules through planning, execution, PR creation, GitHub checks, deployment state, repair or feedback sequencing, merge readiness, and local repo sync after merge/);
assert.match(audit, /task-level Delegation ROI ledger that measures whether delegating to Jules reduces Codex usage/);
assert.match(audit, /Delegation ROI ledger has moved from specification to a conservative baseline implementation/);
assert.match(audit, /`\/api\/v1\/task-drafts` passes Symphony runtime `codex_totals` into that ledger/);
assert.match(audit, /dashboard renders separate `Measured facts`, `Estimated avoided Codex work`, and `Workflow value signals` sections/);

// Stable Requirement Area Concepts
assert.match(audit, /## Requirement Audit/);
assert.match(audit, /Dashboard-first task intake/i);
assert.match(audit, /Hard GitHub sync preflight/i);
assert.match(audit, /Codex workers as foremen, trackers, and nudgers/i);
assert.match(audit, /Preserve Jules\/Scout\/Core workflow/i);
assert.match(audit, /Jules session tracking/i);
assert.match(audit, /GitHub PR tracking and Actions quality/i);
assert.match(audit, /Conflict-prone file tracking/i);
assert.match(audit, /Merge\/readiness tracking/i);
assert.match(audit, /Local sync tracking/i);
assert.match(audit, /Readable dashboard status/i);
assert.match(audit, /Approvals/i);
assert.match(audit, /Usage\/spending/i);
assert.match(audit, /Delegation ROI ledger/i);
assert.match(audit, /Worker model\/thinking assignment/i);
assert.match(audit, /Dashboard foreman-console focus/i);
assert.match(audit, /Verification/i);
assert.match(audit, /Live end-to-end proof/i);
assert.match(audit, /Completion audit/i);

// Section ledger structure
assert.match(audit, /## Goalpost Status Ledger/);
assert.match(audit, /## Evidence Inventory/);

// Structural Requirement Table Assertions
// Verify that the table contains exactly 16 numbered requirement rows
const requirementRows = audit
  .split('\n')
  .filter(line => /^\| \d+ \|/.test(line));

assert.equal(requirementRows.length, 16, 'Audit must keep all 16 goal requirements visible.');
console.log('✅ verify-middleman-audit.mjs passed structural contract validation!');
