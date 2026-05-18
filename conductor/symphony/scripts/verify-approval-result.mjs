import assert from 'node:assert/strict';
import { buildDashboardApprovalResult } from '../dist/agent-runner.js';

// This verifier protects the dashboard approval bridge. The browser asks the
// operator for plain "Approve" or "Deny", while the headless Codex app-server
// expects method-specific response words. If this mapping drifts, the dashboard
// would look useful but fail to unblock the worker.

const itemLevelMethods = [
  'item/mcpToolCall/requestApproval',
  'item/commandExecution/requestApproval',
  'item/fileChange/requestApproval',
  'item/permissions/requestApproval',
];

for (const method of itemLevelMethods) {
  assert.deepEqual(
    buildDashboardApprovalResult({ method }, 'approve'),
    { decision: 'accept' },
  );
  assert.deepEqual(
    buildDashboardApprovalResult({ method }, 'deny'),
    { decision: 'decline' },
  );
}

const legacyMethods = [
  'execCommandApproval',
  'applyPatchApproval',
];

for (const method of legacyMethods) {
  assert.deepEqual(
    buildDashboardApprovalResult({ method }, 'approve'),
    { decision: 'approved' },
  );
  assert.deepEqual(
    buildDashboardApprovalResult({ method }, 'deny'),
    { decision: 'denied' },
  );
}

// Unknown approval methods should remain view-only until a future agent adds a
// deliberate mapping. Guessing here could approve a broader action than the
// operator understood from the dashboard.
assert.equal(
  buildDashboardApprovalResult({ method: 'unknown/approvalShape' }, 'approve'),
  null,
);

