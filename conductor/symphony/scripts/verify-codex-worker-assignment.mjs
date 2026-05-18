import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveConfig } from '../dist/config.js';

// This verifier protects Symphony's Codex assignment policy. The dashboard may
// ask for a specific worker model or reasoning effort, but that only matters if
// WORKFLOW.md parsing, API state, and the app-server request payload all keep
// the same values instead of silently falling back to Codex defaults.

const config = resolveConfig({
  tracker: {
    kind: 'mock',
  },
  codex: {
    command: 'codex app-server',
    model: 'gpt-5.5',
    reasoning_effort: 'high',
    approval_policy: 'never',
  },
}, process.cwd());

assert.equal(config.codex.model, 'gpt-5.5');
assert.equal(config.codex.reasoningEffort, 'high');
assert.equal(config.codex.approvalPolicy, 'never');

const blankConfig = resolveConfig({
  tracker: {
    kind: 'mock',
  },
  codex: {
    model: '   ',
    reasoning_effort: null,
  },
}, process.cwd());

assert.equal(blankConfig.codex.model, null);
assert.equal(blankConfig.codex.reasoningEffort, null);

const runnerSource = await readFile(new URL('../src/agent-runner.ts', import.meta.url), 'utf8');
assert.match(runnerSource, /thread\/start[\s\S]*model: this\.codexConfig\.model \?\? undefined/);
assert.match(runnerSource, /turn\/start[\s\S]*model: this\.codexConfig\.model \?\? undefined/);
assert.match(runnerSource, /turn\/start[\s\S]*effort: this\.codexConfig\.reasoningEffort \?\? undefined/);

const dashboardSource = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
assert.match(dashboardSource, /function formatWorkerModelAssignment/);
assert.match(dashboardSource, /Worker model:/);
assert.match(dashboardSource, /Model: <code>/);
