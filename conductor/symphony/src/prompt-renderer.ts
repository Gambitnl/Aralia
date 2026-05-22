// ============================================================================
// Prompt Renderer
// ============================================================================
// Renders the WORKFLOW.md prompt template using Liquid-compatible semantics
// with strict variable and filter checking.
//
// Based on SPEC Section 5.4 (Prompt Template Contract) and Section 12.
// ============================================================================

import { Liquid } from 'liquidjs';
import type { Issue, WorkerDesignation } from './types.js';
import { WorkflowError } from './types.js';

// ---------------------------------------------------------------------------
// Liquid engine — configured for strict mode
// ---------------------------------------------------------------------------

// Shared Liquid engine with strict variable/filter checking.
// "strictVariables" makes unknown variables fail rendering.
// "strictFilters" makes unknown filters fail rendering.
const engine = new Liquid({
  strictVariables: true,
  strictFilters: true,
});

// ---------------------------------------------------------------------------
// Jules foreman contract
// ---------------------------------------------------------------------------

// These lines are prepended to every worker prompt so Linear-picked issues and
// dashboard-created tasks share the same Symphony direction: Codex coordinates
// Jules cloud work, watches GitHub, and only edits locally when the operator has
// made that local implementation role explicit.
function buildJulesForemanContract(dashboardBaseUrl: string): string {
  return [
  'Symphony foreman contract:',
  '- Your default job is to coordinate a bounded Jules task, not to implement broad code changes locally.',
  '- Treat GitHub master as the starting point Jules will see. The checked-out worktree must match that GitHub base commit before Jules starts; local master may be unrelated in a linked-worktree workflow.',
  '- Prefer preparing or monitoring a Jules handoff: clarify the task, identify risky files, watch the Jules session, inspect the PR, checks, and conflict risk, then help sync local master after merge.',
  `- Use the local Symphony dashboard/API as your control surface when it is running: \`${dashboardBaseUrl}/api/v1/state\` for the whole dashboard state, \`/api/v1/<issue>\` for your assigned issue, and \`/api/v1/<issue>/activity\` for readable activity.`,
  // These endpoint names are spelled out because headless workers cannot see
  // the dashboard UI unless they query it. The prompt should make the
  // dashboard-first workflow usable without endpoint guesswork.
  `- Dashboard task queue and Jules controls: \`${dashboardBaseUrl}/api/v1/task-drafts\` shows local drafts/handoffs, \`${dashboardBaseUrl}/api/v1/git-preflight\` rechecks the GitHub sync gate, and \`${dashboardBaseUrl}/api/v1/jules-handoffs/refresh-all\` refreshes tracked Jules session, PR, and local-sync status.`,
  '- When `/api/v1/task-drafts` returns a top-level `next_action`, treat that as the current queue instruction; do not re-derive the Jules workflow from raw fields first unless the action is missing or contradicted by newer operator instructions.',
  // next_action is now more than a label. It can carry the exact dashboard
  // endpoint, affected Jules PRs, a single PR-stage URL, and the Jules session
  // link the foreman should inspect before acting. This keeps workers from
  // memorizing routes or approving cloud plans without opening the referenced
  // remote surface first.
  '- Use `next_action.url` and `next_action.method` as the dashboard-approved control endpoint when they are present.',
  '- When `next_action.request_body_schema` is present, follow that JSON shape exactly instead of guessing a POST body.',
  '- When `next_action.affected_pr_urls` is present, open those Jules PRs before giving Scout/Core guidance.',
  '- When `next_action.github_pull_request_url` is present, open that Jules PR before refreshing checks, giving Scout/Core guidance, or syncing local master.',
  '- When `next_action.jules_session_url` is present, inspect that Jules session before approving plans or sending feedback.',
  // conflict_watch is the API version of the dashboard's cross-PR warning
  // panel. Name both hard overlaps and single-PR risk so headless workers know
  // Scout must bridge risky files before Core validates or merges.
  '- When `/api/v1/task-drafts` returns `conflict_watch.status` as `blocked`, bridge those overlapping Jules PR files through Scout before asking Core to validate or merge.',
  '- When `/api/v1/task-drafts` returns `conflict_watch.status` as `attention`, bridge those conflict-prone Jules PR files through Scout before asking Core to validate or merge.',
  '- For your current issue, check the dashboard API before guessing whether Jules is waiting on plan approval, PR checks, conflict risk, approval, or local sync.',
  '- Do local code edits only for Symphony/Jules orchestration itself, tiny diagnostic probes, or an explicit local-only instruction from the operator.',
  '- Use your worker designation in progress comments so the dashboard and Linear issue make clear which foreman produced the update.',
  '- When posting back to Linear, post status comments only on the assigned issue unless the operator explicitly asks for broader Linear changes.',
  ].join('\n');
}

function buildWorkerContext(workerDesignation?: WorkerDesignation, dashboardBaseUrl = 'http://127.0.0.1:8081'): string {
  const identity = workerDesignation
    ? [
        `Symphony worker designation: ${workerDesignation.designation}`,
        `This worker is only assigned to ${workerDesignation.issueIdentifier}.`,
        `Requested Codex model: ${workerDesignation.model ?? 'app-server default'}.`,
        `Requested reasoning effort: ${workerDesignation.reasoningEffort ?? 'app-server default'}.`,
        `Assigned issue dashboard API: ${dashboardBaseUrl}/api/v1/${workerDesignation.issueIdentifier}`,
        `Assigned issue activity API: ${dashboardBaseUrl}/api/v1/${workerDesignation.issueIdentifier}/activity`,
        workerDesignation.workspacePath ? `Worker workspace: ${workerDesignation.workspacePath}` : '',
        'Use the designation in status updates so humans can tell which worker produced them.',
      ].filter(Boolean).join('\n')
    : '';

  return [identity, buildJulesForemanContract(dashboardBaseUrl)].filter(Boolean).join('\n\n');
}

// ---------------------------------------------------------------------------
// Template input building
// ---------------------------------------------------------------------------

/**
 * Convert an Issue into a template-compatible object.
 * All keys are strings so Liquid templates can access them directly.
 * Nested arrays/maps (labels, blockers) are preserved for iteration.
 */
function issueToTemplateObject(issue: Issue): Record<string, unknown> {
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description ?? '',
    priority: issue.priority,
    state: issue.state,
    branch_name: issue.branchName,
    url: issue.url,
    labels: issue.labels,
    blocked_by: issue.blockedBy.map((b) => ({
      id: b.id,
      identifier: b.identifier,
      state: b.state,
    })),
    created_at: issue.createdAt?.toISOString() ?? null,
    updated_at: issue.updatedAt?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Prompt rendering
// ---------------------------------------------------------------------------

/**
 * Render the workflow prompt template for a specific issue.
 *
 * Template variables:
 * - `issue` — normalized issue object with all fields
 * - `attempt` — null on first run, integer on retry/continuation
 *
 * Throws WorkflowError on template parse or render failure.
 */
export async function renderPrompt(
  promptTemplate: string,
  issue: Issue,
  attempt: number | null,
  workerDesignation?: WorkerDesignation,
  dashboardBaseUrl?: string
): Promise<string> {
  const workerContext = buildWorkerContext(workerDesignation, dashboardBaseUrl);

  if (!promptTemplate) {
    // Fallback prompt if workflow body is empty (spec allows this)
    return `${workerContext ? `${workerContext}\n\n` : ''}You are working on an issue from Linear.

Issue: ${issue.identifier}
Title: ${issue.title}
${issue.description ? `\nDescription:\n${issue.description}` : ''}`;
  }

  const templateInput = {
    issue: issueToTemplateObject(issue),
    attempt,
  };

  try {
    const rendered = await engine.parseAndRender(
      promptTemplate,
      templateInput
    );
    return workerContext ? `${workerContext}\n\n${rendered}` : rendered;
  } catch (err) {
    const message = (err as Error).message;

    // Distinguish parse errors from render errors
    if (message.includes('parse') || message.includes('syntax')) {
      throw new WorkflowError(
        'template_parse_error',
        `Failed to parse prompt template: ${message}`
      );
    }

    throw new WorkflowError(
      'template_render_error',
      `Failed to render prompt template: ${message}`
    );
  }
}

/**
 * Build the prompt for a specific turn within a worker run.
 *
 * - Turn 1 (first turn): full rendered task prompt from the template.
 * - Turn 2+ (continuation): short continuation guidance only, since
 *   the original prompt is already in the thread history.
 */
export async function buildTurnPrompt(
  promptTemplate: string,
  issue: Issue,
  attempt: number | null,
  turnNumber: number,
  _maxTurns: number,
  workerDesignation?: WorkerDesignation,
  dashboardBaseUrl?: string
): Promise<string> {
  if (turnNumber === 1) {
    // First turn: full rendered prompt
    return renderPrompt(promptTemplate, issue, attempt, workerDesignation, dashboardBaseUrl);
  }

  // Continuation turns: short guidance only
  return [
    buildWorkerContext(workerDesignation, dashboardBaseUrl),
    `Continue working on ${issue.identifier}: ${issue.title}.`,
    `This is turn ${turnNumber}. The issue is still in an active state.`,
    attempt !== null ? `This is attempt ${attempt}.` : '',
    'Review the current foreman state: GitHub sync, Jules handoff/session, PR checks, merge readiness, and local sync.',
    'Continue coordination or status reporting. Do not drift into broad local implementation unless the operator explicitly asked for local-only coding.',
  ]
    .filter(Boolean)
    .join('\n');
}
