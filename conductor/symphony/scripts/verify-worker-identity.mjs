import assert from 'node:assert/strict';
import {
  buildWorkerDesignationLabel,
  serializeWorkerDesignation,
} from '../dist/orchestrator.js';

// This verifier protects the multi-agent identity contract. Symphony assigns a
// stable worker callsign so humans can connect dashboard rows, workspace marker
// files, prompts, and Linear comments back to the same foreman run.

assert.equal(
  buildWorkerDesignationLabel('ARA-5', 1),
  'worker-ARA-5-run-0001',
);

assert.equal(
  buildWorkerDesignationLabel('ARA 5/unsafe', 27),
  'worker-ARA-5-unsafe-run-0027',
);

const startedAt = new Date('2026-05-17T00:00:00.000Z');
const worker = {
  designation: buildWorkerDesignationLabel('ARA-5', 42),
  runNumber: 42,
  attempt: 1,
  issueIdentifier: 'ARA-5',
  workspacePath: 'F:\\Repos\\Aralia\\conductor\\symphony\\.workspaces\\ARA-5',
  threadId: 'thread-ara-5',
  model: 'gpt-5.5',
  reasoningEffort: 'high',
  startedAt,
};

assert.deepEqual(
  serializeWorkerDesignation(worker),
  {
    designation: 'worker-ARA-5-run-0042',
    run_number: 42,
    attempt: 1,
    issue_identifier: 'ARA-5',
    workspace_path: 'F:\\Repos\\Aralia\\conductor\\symphony\\.workspaces\\ARA-5',
    thread_id: 'thread-ara-5',
    model: 'gpt-5.5',
    reasoning_effort: 'high',
    started_at: '2026-05-17T00:00:00.000Z',
  },
);

assert.equal(serializeWorkerDesignation(null), null);
