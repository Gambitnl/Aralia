/**
 * This file builds safe Google Jules task packets for Aralia.
 *
 * Codex uses this module before any remote Jules session is created. It checks
 * that each task has an explicit write boundary, rejects files that are known to
 * cause batch conflicts, and renders a prompt that tells Jules exactly what it
 * may inspect, write, verify, and report. The CLI wrapper handles network calls;
 * this file stays focused on local safety rules that can be tested without Jules.
 *
 * Called by: .jules/orchestrator/cli.ts and .jules/orchestrator/__tests__/julesOrchestrator.test.ts
 * Depends on: the .jules persona/worklog convention and Jules REST session shape
 */

// ============================================================================
// Public Types
// ============================================================================
// These types describe the local manifest Codex writes before outsourcing work.
// Keeping this manifest explicit makes each Jules task reviewable by the human
// owner and by future agents before any remote work starts.
// ============================================================================

export type JulesTaskMode = 'scout' | 'worker' | 'batch';

export type JulesAutomationMode = 'NONE' | 'AUTO_CREATE_PR';

export interface JulesTaskPacket {
  id: string;
  title: string;
  persona: string;
  mode: JulesTaskMode;
  prompt: string;
  readScopes: string[];
  writeScopes: string[];
  forbiddenFiles: string[];
  verification: string[];
}

export interface JulesRunManifest {
  runId: string;
  source: string;
  startingBranch: string;
  /** Optional exact GitHub commit that Symphony verified before launch. */
  startingCommit?: string;
  requirePlanApproval: boolean;
  automationMode: JulesAutomationMode;
  tasks: JulesTaskPacket[];
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface JulesCreateSessionRequest {
  prompt: string;
  title: string;
  sourceContext: {
    source: string;
    githubRepoContext: {
      startingBranch: string;
    };
  };
  requirePlanApproval: boolean;
  automationMode?: 'AUTO_CREATE_PR';
}

export type JulesSessionState =
  | 'QUEUED'
  | 'PLANNING'
  | 'AWAITING_PLAN_APPROVAL'
  | 'AWAITING_USER_FEEDBACK'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'NOT_STARTED';

export interface JulesTaskRunRecord {
  taskId: string;
  sessionId?: string;
  state: JulesSessionState;
  url?: string;
  pullRequestUrl?: string;
  updatedAt?: string;
}

export interface JulesDashboardTask {
  id: string;
  title: string;
  persona: string;
  mode: JulesTaskMode;
  status: JulesSessionState;
  sessionId: string | null;
  sessionUrl: string | null;
  pullRequestUrl: string | null;
  updatedAt: string | null;
  writeScopes: string[];
  verification: string[];
}

export interface JulesDashboardState {
  runId: string;
  source: string;
  startingBranch: string;
  /** Shows the human which remote revision this Jules run was meant to start from. */
  startingCommit: string | null;
  updatedAt: string;
  summary: {
    total: number;
    completed: number;
    failed: number;
    needsHuman: number;
    running: number;
  };
  tasks: JulesDashboardTask[];
}

// ============================================================================
// Shared Guardrails
// ============================================================================
// These defaults mirror the existing .jules roster warning. They are checked for
// every task because one bad batch worker can create noisy merge conflicts for
// everyone else.
// ============================================================================

export const DEFAULT_FORBIDDEN_JULES_FILES = [
  'package-lock.json',
  'pnpm-lock.yaml',
  'tsconfig.tsbuildinfo',
  'tsconfig.node.tsbuildinfo',
  'dist',
];

const JULES_TASK_MODES: JulesTaskMode[] = ['scout', 'worker', 'batch'];
const JULES_AUTOMATION_MODES: JulesAutomationMode[] = ['NONE', 'AUTO_CREATE_PR'];

// ============================================================================
// Manifest Validation
// ============================================================================
// This section stops unsafe task packets before they become remote Jules
// sessions. The checks are intentionally conservative because temporary
// duplication is safer for Aralia than uncontrolled shared-file edits.
// ============================================================================

export function validateJulesRunManifest(manifest: JulesRunManifest): ValidationResult {
  const errors: string[] = [];

  // Make sure the manifest has the minimum data needed to create traceable
  // sessions against a known repo and branch.
  if (!manifest.runId.trim()) errors.push('Manifest must declare a runId.');
  if (!manifest.source.trim()) errors.push('Manifest must declare a Jules source.');
  if (!manifest.startingBranch.trim()) errors.push('Manifest must declare a startingBranch.');
  if (!JULES_AUTOMATION_MODES.includes(manifest.automationMode)) {
    errors.push(`Manifest automationMode must be one of: ${JULES_AUTOMATION_MODES.join(', ')}.`);
  }
  if (manifest.tasks.length === 0) errors.push('Manifest must contain at least one task.');

  // Check every task independently before checking cross-task conflicts. This
  // gives Codex a precise list of packet problems to fix.
  for (const task of manifest.tasks) {
    if (!task.id.trim()) errors.push('Every task must declare an id.');
    if (!task.title.trim()) errors.push(`Task ${task.id || '(missing id)'} must declare a title.`);
    if (!task.persona.trim()) errors.push(`Task ${task.id || '(missing id)'} must declare a persona.`);
    if (!JULES_TASK_MODES.includes(task.mode)) {
      errors.push(`Task ${task.id || '(missing id)'} mode must be one of: ${JULES_TASK_MODES.join(', ')}.`);
    }
    if (!task.prompt.trim()) errors.push(`Task ${task.id || '(missing id)'} must declare a prompt.`);
    if (task.readScopes.length === 0) errors.push(`Task ${task.id} must declare at least one read scope.`);
    if (task.verification.length === 0) errors.push(`Task ${task.id} must declare at least one verification command or check.`);

    // A Jules worker without a write scope is too open-ended for Aralia. Scout
    // tasks still need a worklog scope so their findings have one controlled
    // place to land.
    if (task.writeScopes.length === 0) {
      errors.push(`Task ${task.id} must declare at least one write scope.`);
    }

    // Combine local task bans with global bans so each packet can add stricter
    // limits without weakening the repo-wide conflict protections.
    const forbiddenFiles = new Set([...DEFAULT_FORBIDDEN_JULES_FILES, ...task.forbiddenFiles]);
    for (const writeScope of task.writeScopes) {
      for (const forbiddenFile of forbiddenFiles) {
        if (pathsOverlap(writeScope, forbiddenFile)) {
          errors.push(`Task ${task.id} may not write forbidden file ${forbiddenFile}.`);
        }
      }
    }
  }

  // Batch work is only safe when the write surfaces are disjoint. This catches
  // both identical paths and parent-directory overlap such as docs/ vs docs/a.md.
  for (let leftIndex = 0; leftIndex < manifest.tasks.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < manifest.tasks.length; rightIndex += 1) {
      const leftTask = manifest.tasks[leftIndex];
      const rightTask = manifest.tasks[rightIndex];
      const overlap = findFirstOverlap(leftTask.writeScopes, rightTask.writeScopes);

      if (overlap) {
        errors.push(
          `Tasks ${leftTask.id} and ${rightTask.id} have overlapping write scopes: ${overlap.left} vs ${overlap.right}.`,
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function findFirstOverlap(leftScopes: string[], rightScopes: string[]): { left: string; right: string } | null {
  // Compare every declared write boundary because a single overlap makes the
  // combined batch unsafe to run in parallel.
  for (const left of leftScopes) {
    for (const right of rightScopes) {
      if (pathsOverlap(left, right)) return { left, right };
    }
  }

  return null;
}

function pathsOverlap(leftPath: string, rightPath: string): boolean {
  const left = normalizeManifestPath(leftPath);
  const right = normalizeManifestPath(rightPath);

  // Empty paths are handled by higher-level validation. Treat them as not
  // overlapping here so this helper stays focused on path containment.
  if (!left || !right) return false;

  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function normalizeManifestPath(rawPath: string): string {
  // Jules runs on Linux, while Codex is currently on Windows. Normalizing slashes
  // lets manifests use either style without weakening overlap detection.
  return rawPath
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/$/, '')
    .trim();
}

// ============================================================================
// Prompt Rendering
// ============================================================================
// This section turns a structured packet into a Jules-readable prompt. The prompt
// repeats the most important constraints because remote workers should not need
// to infer the safety boundary from surrounding scripts.
// ============================================================================

export function renderJulesTaskPrompt(task: JulesTaskPacket): string {
  const modeLabel = toTitleCase(task.mode);

  return [
    `You are Jules working on Aralia as the ${task.persona} persona.`,
    '',
    `Operating mode: ${modeLabel}`,
    getModeBoundary(task.mode),
    '',
    'Project rules:',
    '- Read AGENTS.md first and follow its preservation-first guidance.',
    '- Read the matching .jules persona, roster, methodology, and worklog before editing.',
    '- Do not expand scope beyond this task packet.',
    '- Preserve unfinished systems and future-facing scaffolds unless the task explicitly says otherwise.',
    '- Do not commit package-lock.json, pnpm-lock.yaml, tsbuildinfo files, or dist output.',
    '',
    'Task:',
    task.prompt,
    '',
    'Read scopes:',
    ...formatBulletList(task.readScopes),
    '',
    'Allowed write scopes:',
    ...formatBulletList(task.writeScopes),
    '',
    'Forbidden files:',
    ...formatBulletList(uniqueStrings([...DEFAULT_FORBIDDEN_JULES_FILES, ...task.forbiddenFiles])),
    '',
    'Verification commands or checks:',
    ...formatBulletList(task.verification),
    '',
    'Required final report:',
    '- Summarize the files changed.',
    '- State which verification commands ran and their results.',
    '- List any deferred work in the persona worklog instead of broadening the task.',
  ].join('\n');
}

function formatBulletList(items: string[]): string[] {
  // A visible placeholder is safer than silently omitting a section, because it
  // makes malformed task packets obvious in rendered prompts.
  if (items.length === 0) return ['- (none declared)'];

  return items.map((item) => `- ${item}`);
}

function toTitleCase(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function getModeBoundary(mode: JulesTaskMode): string {
  if (mode === 'scout') {
    return 'Mode boundary: investigate and report findings; do not change application code unless the write scope explicitly permits it.';
  }

  if (mode === 'worker') {
    return 'Mode boundary: implement only the named slice; do not perform adjacent cleanup or broaden the touched surface.';
  }

  return 'Mode boundary: act as one disjoint batch packet; do not edit shared files or another packet boundary.';
}

function uniqueStrings(values: string[]): string[] {
  // Task packets can repeat a global forbidden file for emphasis. The prompt
  // only needs to show each file once so Jules gets a clean checklist.
  return [...new Set(values)];
}

// ============================================================================
// Jules REST Request Construction
// ============================================================================
// This section builds the request body for the Jules Sessions API. It does not
// send the request; that separation keeps API credentials out of the testable
// safety logic.
// ============================================================================

export function buildCreateSessionRequest(
  manifest: JulesRunManifest,
  task: JulesTaskPacket,
): JulesCreateSessionRequest {
  const request: JulesCreateSessionRequest = {
    title: `${toTitleCase(task.mode)}: ${task.title}`,
    prompt: renderJulesTaskPrompt(task),
    sourceContext: {
      source: manifest.source,
      githubRepoContext: {
        startingBranch: manifest.startingBranch,
      },
    },
    requirePlanApproval: manifest.requirePlanApproval,
  };

  // Jules treats AUTO_CREATE_PR as an explicit mode, but rejects a literal NONE.
  // Local manifests keep NONE for readability; API requests omit the field.
  if (manifest.automationMode === 'AUTO_CREATE_PR') {
    request.automationMode = 'AUTO_CREATE_PR';
  }

  return request;
}

// ============================================================================
// Dashboard State
// ============================================================================
// This section creates the small JSON document consumed by the Jules dashboard.
// The UI should not need to understand raw API responses; it only needs clear
// task cards showing what is running, blocked, failed, completed, or ready for
// review.
// ============================================================================

export function buildDashboardState(
  manifest: JulesRunManifest,
  runRecords: JulesTaskRunRecord[],
  updatedAt = new Date().toISOString(),
): JulesDashboardState {
  const recordsByTaskId = new Map(runRecords.map((record) => [record.taskId, record]));

  // Merge the static task packet with the latest remote session record. Tasks
  // without a session stay visible as NOT_STARTED instead of disappearing.
  const tasks = manifest.tasks.map((task): JulesDashboardTask => {
    const record = recordsByTaskId.get(task.id);

    return {
      id: task.id,
      title: task.title,
      persona: task.persona,
      mode: task.mode,
      status: record?.state ?? 'NOT_STARTED',
      sessionId: record?.sessionId ?? null,
      sessionUrl: record?.url ?? null,
      pullRequestUrl: record?.pullRequestUrl ?? null,
      updatedAt: record?.updatedAt ?? null,
      writeScopes: task.writeScopes,
      verification: task.verification,
    };
  });

  return {
    runId: manifest.runId,
    source: manifest.source,
    startingBranch: manifest.startingBranch,
    startingCommit: manifest.startingCommit ?? null,
    updatedAt,
    summary: summarizeDashboardTasks(tasks),
    tasks,
  };
}

function summarizeDashboardTasks(tasks: JulesDashboardTask[]): JulesDashboardState['summary'] {
  // The summary groups raw Jules states into the decisions Codex and the human
  // need to make: running, needs human input, failed, or completed.
  return {
    total: tasks.length,
    completed: tasks.filter((task) => task.status === 'COMPLETED').length,
    failed: tasks.filter((task) => task.status === 'FAILED').length,
    needsHuman: tasks.filter((task) =>
      task.status === 'AWAITING_PLAN_APPROVAL' || task.status === 'AWAITING_USER_FEEDBACK',
    ).length,
    running: tasks.filter((task) =>
      task.status === 'QUEUED' ||
      task.status === 'PLANNING' ||
      task.status === 'IN_PROGRESS' ||
      task.status === 'PAUSED',
    ).length,
  };
}

// ============================================================================
// API Key Resolution
// ============================================================================
// This helper exists because Codex may create a Jules key and store it as a
// Windows user environment variable while the current terminal session is still
// running. The process environment wins, but callers can provide a fallback
// lookup for user-level storage.
// ============================================================================

export function resolveJulesApiKey(
  environment: Record<string, string | undefined>,
  fallbackLookup: () => string | undefined,
): string | undefined {
  const processKey = environment.JULES_API_KEY?.trim();
  if (processKey) return processKey;

  const fallbackKey = fallbackLookup()?.trim();
  return fallbackKey || undefined;
}

// ============================================================================
// Result Review
// ============================================================================
// This section turns a completed Jules record back into a concrete review list.
// Codex uses it after pulling or inspecting a PR so the original task boundary
// remains visible during acceptance, repair, or rejection.
// ============================================================================

export function buildReviewChecklist(task: JulesTaskPacket, record: JulesTaskRunRecord): string[] {
  const sessionId = record.sessionId ?? '(missing session id)';
  const checklist = [`Confirm Jules session ${sessionId} is ${record.state}.`];

  if (record.url) checklist.push(`Inspect Jules session: ${record.url}`);
  if (record.pullRequestUrl) checklist.push(`Inspect pull request: ${record.pullRequestUrl}`);

  checklist.push(`Confirm changed files stay within: ${task.writeScopes.join(', ')}`);
  checklist.push(`Confirm forbidden files are untouched: ${task.forbiddenFiles.join(', ') || '(task declared none)'}`);

  for (const command of task.verification) {
    checklist.push(`Run or verify: ${command}`);
  }

  checklist.push('Record accept, repair, or reject disposition before merge.');
  return checklist;
}

export function validateJulesPatchAgainstTask(task: JulesTaskPacket, unidiffPatch: string): ValidationResult {
  const errors: string[] = [];
  const patchPaths = extractUnidiffPaths(unidiffPatch);
  const forbiddenFiles = new Set([...DEFAULT_FORBIDDEN_JULES_FILES, ...task.forbiddenFiles]);

  if (patchPaths.length === 0) {
    errors.push('Patch does not contain any changed file paths.');
  }

  for (const patchPath of patchPaths) {
    const isAllowed = task.writeScopes.some((writeScope) => pathsOverlap(writeScope, patchPath));
    if (!isAllowed) {
      errors.push(`Patch changes ${patchPath}, which is outside allowed write scopes: ${task.writeScopes.join(', ')}.`);
    }

    for (const forbiddenFile of forbiddenFiles) {
      if (pathsOverlap(patchPath, forbiddenFile)) {
        errors.push(`Patch changes forbidden file ${forbiddenFile}.`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function extractUnidiffPaths(unidiffPatch: string): string[] {
  const paths = new Set<string>();

  // Jules activity artifacts expose standard git unidiff patches. The diff
  // header is the most reliable place to learn which files would be touched
  // before Codex applies anything locally.
  for (const line of unidiffPatch.split(/\r?\n/)) {
    const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (!match) continue;

    for (const candidate of [match[1], match[2]]) {
      if (candidate !== '/dev/null') paths.add(normalizeManifestPath(candidate));
    }
  }

  return [...paths];
}

// ============================================================================
// Session Action Paths
// ============================================================================
// These paths are small, but centralizing them avoids slightly different API
// endpoint strings across launch, approval, and feedback flows.
// ============================================================================

export function buildSessionActionPath(sessionId: string, action: 'approvePlan' | 'sendMessage'): string {
  return `/sessions/${sessionId}:${action}`;
}
