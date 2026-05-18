/**
 * These tests protect the Jules outsourcing guardrails before any remote session is launched.
 *
 * The orchestrator is meant to let Codex delegate bounded work to Google Jules without
 * giving Jules open-ended control over Aralia. These tests focus on the local packet
 * builder because that is where unsafe scope expansion should be stopped.
 *
 * Called by: Vitest
 * Depends on: .jules/orchestrator/orchestrator.ts
 */

import { describe, expect, it } from 'vitest';

import {
  buildReviewChecklist,
  buildDashboardState,
  buildCreateSessionRequest,
  buildSessionActionPath,
  renderJulesTaskPrompt,
  resolveJulesApiKey,
  validateJulesPatchAgainstTask,
  validateJulesRunManifest,
  type JulesRunManifest,
} from '../orchestrator';

// ============================================================================
// Test Fixtures
// ============================================================================
// These fixtures describe small Jules task packets. They stay local to the test
// so the remote API is never contacted while proving the guardrail behavior.
// ============================================================================

const baseTask = {
  id: 'scan-glossary-docs',
  title: 'Scan glossary docs for stale Jules references',
  persona: 'scribe',
  mode: 'scout' as const,
  prompt: 'Inspect the glossary documentation and report stale Jules instructions.',
  readScopes: ['docs/guides'],
  writeScopes: ['.jules/worklogs/worklog_scribe.md'],
  forbiddenFiles: ['package-lock.json'],
  verification: ['npx vitest .jules/orchestrator/__tests__/julesOrchestrator.test.ts --run'],
};

function makeManifest(overrides: Partial<JulesRunManifest> = {}): JulesRunManifest {
  return {
    runId: '2026-05-14-jules-smoke',
    source: 'sources/github/Gambitnl/Aralia',
    startingBranch: 'main',
    requirePlanApproval: true,
    automationMode: 'NONE',
    tasks: [baseTask],
    ...overrides,
  };
}

// ============================================================================
// Manifest Validation
// ============================================================================
// These tests make sure Codex cannot accidentally feed Jules an unbounded or
// conflicting batch. The validation layer is the safety stop before API calls.
// ============================================================================

describe('validateJulesRunManifest', () => {
  it('accepts a bounded single-task manifest', () => {
    const result = validateJulesRunManifest(makeManifest());

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a task without a write scope', () => {
    const result = validateJulesRunManifest(
      makeManifest({
        tasks: [{ ...baseTask, writeScopes: [] }],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Task scan-glossary-docs must declare at least one write scope.');
  });

  it('rejects invalid runtime modes from JSON manifests', () => {
    const result = validateJulesRunManifest(
      makeManifest({
        tasks: [{ ...baseTask, mode: 'cleanup' as never }],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Task scan-glossary-docs mode must be one of: scout, worker, batch.');
  });

  it('rejects packets without read scopes or verification checks', () => {
    const result = validateJulesRunManifest(
      makeManifest({
        tasks: [{ ...baseTask, readScopes: [], verification: [] }],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Task scan-glossary-docs must declare at least one read scope.');
    expect(result.errors).toContain('Task scan-glossary-docs must declare at least one verification command or check.');
  });

  it('accepts disjoint worker and batch task packets', () => {
    const result = validateJulesRunManifest(
      makeManifest({
        tasks: [
          { ...baseTask, mode: 'worker', writeScopes: ['src/components/ExampleTarget.tsx'] },
          { ...baseTask, id: 'batch-worklog-scout', mode: 'batch', writeScopes: ['.jules/worklogs/worklog_architect.md'] },
        ],
      }),
    );

    expect(result.ok).toBe(true);
  });

  it('rejects overlapping batch write scopes', () => {
    const result = validateJulesRunManifest(
      makeManifest({
        tasks: [
          baseTask,
          {
            ...baseTask,
            id: 'rewrite-scribe-worklog',
            writeScopes: ['.jules/worklogs'],
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Tasks scan-glossary-docs and rewrite-scribe-worklog have overlapping write scopes: .jules/worklogs/worklog_scribe.md vs .jules/worklogs.',
    );
  });

  it('rejects forbidden files in write scopes', () => {
    const result = validateJulesRunManifest(
      makeManifest({
        tasks: [{ ...baseTask, writeScopes: ['package-lock.json'] }],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Task scan-glossary-docs may not write forbidden file package-lock.json.');
  });
});

// ============================================================================
// Prompt Rendering
// ============================================================================
// These tests make sure every generated Jules prompt repeats the project rules,
// the selected operating mode, and the exact boundaries Jules must obey.
// ============================================================================

describe('renderJulesTaskPrompt', () => {
  it('renders the operating mode and file boundaries into the prompt', () => {
    const prompt = renderJulesTaskPrompt(baseTask);

    expect(prompt).toContain('Operating mode: Scout');
    expect(prompt).toContain('Mode boundary: investigate and report findings;');
    expect(prompt).toContain('Allowed write scopes:');
    expect(prompt).toContain('- .jules/worklogs/worklog_scribe.md');
    expect(prompt).toContain('Forbidden files:');
    expect(prompt).toContain('- package-lock.json');
    expect(prompt).toContain('Do not expand scope beyond this task packet.');
  });
});

// ============================================================================
// Jules API Request Construction
// ============================================================================
// These tests keep the REST request predictable. Live API calls are handled by
// the CLI wrapper, but the request body can be verified locally and cheaply.
// ============================================================================

describe('buildCreateSessionRequest', () => {
  it('builds a session request for the configured source and branch', () => {
    const request = buildCreateSessionRequest(makeManifest(), baseTask);

    expect(request.title).toBe('Scout: Scan glossary docs for stale Jules references');
    expect(request.requirePlanApproval).toBe(true);
    expect(request.automationMode).toBeUndefined();
    expect(request.sourceContext).toEqual({
      source: 'sources/github/Gambitnl/Aralia',
      githubRepoContext: {
        startingBranch: 'main',
      },
    });
  });

  it('includes AUTO_CREATE_PR only when requested', () => {
    const request = buildCreateSessionRequest(
      makeManifest({
        automationMode: 'AUTO_CREATE_PR',
      }),
      baseTask,
    );

    expect(request.automationMode).toBe('AUTO_CREATE_PR');
  });
});

// ============================================================================
// Dashboard State
// ============================================================================
// The human-facing UI and agent-facing automation read the same state object so
// they do not disagree about what Jules is doing or what needs review next.
// ============================================================================

describe('buildDashboardState', () => {
  it('summarizes run progress for dashboard readers', () => {
    const dashboard = buildDashboardState(makeManifest(), [
      {
        taskId: 'scan-glossary-docs',
        sessionId: '123456',
        state: 'COMPLETED',
        url: 'https://jules.google.com/session/123456',
        pullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/999',
        updatedAt: '2026-05-14T12:00:00Z',
      },
    ]);

    expect(dashboard.runId).toBe('2026-05-14-jules-smoke');
    expect(dashboard.summary).toEqual({
      total: 1,
      completed: 1,
      failed: 0,
      needsHuman: 0,
      running: 0,
    });
    expect(dashboard.tasks[0]).toEqual(
      expect.objectContaining({
        id: 'scan-glossary-docs',
        mode: 'scout',
        status: 'COMPLETED',
        sessionUrl: 'https://jules.google.com/session/123456',
        pullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/999',
      }),
    );
  });
});

// ============================================================================
// API Key Resolution
// ============================================================================
// Windows shells can keep running after a user-level environment variable is set.
// This test protects the fallback path that lets Codex use the newly stored key
// without requiring a full app restart.
// ============================================================================

describe('resolveJulesApiKey', () => {
  it('uses the process environment before fallback lookup', () => {
    const key = resolveJulesApiKey({ JULES_API_KEY: 'process-key' }, () => 'user-key');

    expect(key).toBe('process-key');
  });

  it('uses fallback lookup when the process environment is empty', () => {
    const key = resolveJulesApiKey({}, () => 'user-key');

    expect(key).toBe('user-key');
  });
});

// ============================================================================
// Review Checklist
// ============================================================================
// Pulling Jules work is only useful if Codex has a concrete review checklist.
// These tests keep that checklist tied to the original manifest boundaries.
// ============================================================================

describe('buildReviewChecklist', () => {
  it('creates review steps from the manifest task and run record', () => {
    const checklist = buildReviewChecklist(baseTask, {
      taskId: 'scan-glossary-docs',
      sessionId: '123456',
      state: 'COMPLETED',
      url: 'https://jules.google.com/session/123456',
      pullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/999',
    });

    expect(checklist).toEqual([
      'Confirm Jules session 123456 is COMPLETED.',
      'Inspect Jules session: https://jules.google.com/session/123456',
      'Inspect pull request: https://github.com/Gambitnl/Aralia/pull/999',
      'Confirm changed files stay within: .jules/worklogs/worklog_scribe.md',
      'Confirm forbidden files are untouched: package-lock.json',
      'Run or verify: npx vitest .jules/orchestrator/__tests__/julesOrchestrator.test.ts --run',
      'Record accept, repair, or reject disposition before merge.',
    ]);
  });
});

// ============================================================================
// Session Action Paths
// ============================================================================
// Plan approval and user feedback are part of the controlled pipeline. These
// tests keep the API paths centralized so the CLI does not hand-build endpoints.
// ============================================================================

describe('buildSessionActionPath', () => {
  it('builds the approve-plan endpoint path', () => {
    expect(buildSessionActionPath('10863889126770106346', 'approvePlan')).toBe(
      '/sessions/10863889126770106346:approvePlan',
    );
  });

  it('builds the send-message endpoint path', () => {
    expect(buildSessionActionPath('10863889126770106346', 'sendMessage')).toBe(
      '/sessions/10863889126770106346:sendMessage',
    );
  });
});

// ============================================================================
// Patch Boundary Validation
// ============================================================================
// Jules can expose result patches through activity artifacts. These tests make
// sure Codex checks those patches against the original manifest before applying
// or accepting them.
// ============================================================================

describe('validateJulesPatchAgainstTask', () => {
  it('accepts a patch that stays inside the declared write scope', () => {
    const result = validateJulesPatchAgainstTask(
      baseTask,
      'diff --git a/.jules/worklogs/worklog_scribe.md b/.jules/worklogs/worklog_scribe.md\n',
    );

    expect(result.ok).toBe(true);
  });

  it('rejects a patch outside the declared write scope', () => {
    const result = validateJulesPatchAgainstTask(baseTask, 'diff --git a/src/App.tsx b/src/App.tsx\n');

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Patch changes src/App.tsx, which is outside allowed write scopes: .jules/worklogs/worklog_scribe.md.',
    );
  });

  it('rejects a patch that touches forbidden files', () => {
    const result = validateJulesPatchAgainstTask(
      { ...baseTask, writeScopes: ['package-lock.json'] },
      'diff --git a/package-lock.json b/package-lock.json\n',
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Patch changes forbidden file package-lock.json.');
  });
});
