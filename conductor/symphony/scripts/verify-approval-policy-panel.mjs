import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// This verifier protects the idle approval dashboard. The policy panel should
// explain routine auto-approvals in human terms, not only list raw app-tool
// identifiers that require the operator to understand Linear internals.

const dashboardSource = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
const policyStart = dashboardSource.indexOf('function approvalPolicyPanel');

assert(policyStart >= 0, 'dashboard.js should contain approvalPolicyPanel');

const context = vm.createContext({
  Date,
  JSON,
  Math,
  Number,
  RegExp,
  String,
  console,
});

vm.runInContext(dashboardSource.slice(policyStart), context);

const html = context.approvalPolicyPanel({
  codex_policy: {
    approval_policy: 'on-failure',
    auto_approve_app_tools: ['linear.save_comment'],
  },
});

assert.match(html, /Routine Approval Rules/);
assert.match(html, /linear\.save_comment/);
assert.match(html, /Status comments on the assigned Linear issue/);
assert.match(html, /broader Linear changes still need approval/);
