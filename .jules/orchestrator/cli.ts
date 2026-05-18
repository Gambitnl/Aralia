#!/usr/bin/env tsx

/**
 * This file is Codex's command-line control surface for Google Jules outsourcing.
 *
 * It reads bounded Aralia task manifests, validates their safety rules, writes
 * dashboard state for the human-facing Jules page, and performs Jules REST API
 * calls only when an explicit command asks for them. Keeping launch, status, and
 * dashboard refresh in one small CLI gives Codex a repeatable workflow instead
 * of relying on ad hoc browser clicks.
 *
 * Called by: direct tsx invocations from .jules/orchestrator
 * Depends on: JULES_API_KEY, .jules/orchestrator/orchestrator.ts, .jules/runs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  buildReviewChecklist,
  buildCreateSessionRequest,
  buildDashboardState,
  buildSessionActionPath,
  renderJulesTaskPrompt,
  resolveJulesApiKey,
  validateJulesPatchAgainstTask,
  validateJulesRunManifest,
  type JulesRunManifest,
  type JulesTaskRunRecord,
} from './orchestrator';

// ============================================================================
// Constants
// ============================================================================
// These paths keep all generated Jules run state inside .jules/runs so the
// dashboard, Codex, and future agents have one predictable place to inspect.
// ============================================================================

const API_BASE_URL = 'https://jules.googleapis.com/v1alpha';
const DEFAULT_DASHBOARD_PATH = path.resolve(process.cwd(), '.jules/runs/jules-dashboard.json');

// ============================================================================
// Command Dispatch
// ============================================================================
// This section parses the small command vocabulary. The CLI is intentionally
// explicit so a future agent cannot accidentally launch remote work with a vague
// command.
// ============================================================================

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === 'help') {
    printHelp();
    return;
  }

  if (command === 'validate') {
    const manifest = await readManifest(requiredArg(args, 0, 'manifest path'));
    assertValidManifest(manifest);
    console.log(`Manifest ${manifest.runId} is valid with ${manifest.tasks.length} task(s).`);
    return;
  }

  if (command === 'prompt') {
    const manifest = await readManifest(requiredArg(args, 0, 'manifest path'));
    assertValidManifest(manifest);
    const taskId = requiredArg(args, 1, 'task id');
    const task = manifest.tasks.find((candidate) => candidate.id === taskId);
    if (!task) throw new Error(`No task named ${taskId} exists in ${manifest.runId}.`);
    console.log(renderJulesTaskPrompt(task));
    return;
  }

  if (command === 'sources') {
    const sources = await julesGet<{ sources?: unknown[] }>('/sources?pageSize=100');
    console.log(JSON.stringify(sources, null, 2));
    return;
  }

  if (command === 'activities') {
    const sessionId = requiredArg(args, 0, 'session id');
    const pageSize = Number(optionalArg(args, 1) ?? 50);
    const outputPath = optionalArg(args, 2);
    const activities = await listSessionActivities(sessionId, pageSize);

    if (outputPath) {
      await writeJson(outputPath, activities);
      console.log(`Activities written to ${relativePath(path.resolve(outputPath))}.`);
      return;
    }

    console.log(JSON.stringify(activities, null, 2));
    return;
  }

  if (command === 'patch') {
    const manifest = await readManifest(requiredArg(args, 0, 'manifest path'));
    assertValidManifest(manifest);
    const taskId = requiredArg(args, 1, 'task id');
    const sessionId = requiredArg(args, 2, 'session id');
    const outputPath = optionalArg(args, 3) ?? path.resolve(process.cwd(), `.jules/runs/${manifest.runId}/${taskId}.patch`);
    const task = manifest.tasks.find((candidate) => candidate.id === taskId);
    if (!task) throw new Error(`No task named ${taskId} exists in ${manifest.runId}.`);

    const activities = await listSessionActivities(sessionId, 100);
    const patch = findLatestUnidiffPatch(activities);
    if (!patch) throw new Error(`No git patch artifact found for session ${sessionId}.`);

    const validation = validateJulesPatchAgainstTask(task, patch);
    if (!validation.ok) {
      throw new Error(['Jules patch is outside the manifest boundary:', ...validation.errors.map((error) => `- ${error}`)].join('\n'));
    }

    await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
    await fs.writeFile(path.resolve(outputPath), patch, 'utf-8');
    console.log(`Patch written to ${relativePath(path.resolve(outputPath))}.`);
    return;
  }

  if (command === 'dashboard') {
    const manifest = await readManifest(requiredArg(args, 0, 'manifest path'));
    assertValidManifest(manifest);
    const records = await readRunRecords(optionalArg(args, 1));
    const dashboard = buildDashboardState(manifest, records);
    await writeJson(DEFAULT_DASHBOARD_PATH, dashboard);
    console.log(`Dashboard state written to ${relativePath(DEFAULT_DASHBOARD_PATH)}.`);
    return;
  }

  if (command === 'launch') {
    const manifest = await readManifest(requiredArg(args, 0, 'manifest path'));
    assertValidManifest(manifest);
    const records = await launchManifest(manifest);
    await writeJson(runRecordsPath(manifest.runId), records);
    await writeJson(DEFAULT_DASHBOARD_PATH, buildDashboardState(manifest, records));
    console.log(`Launched ${records.length} Jules session(s) for ${manifest.runId}.`);
    return;
  }

  if (command === 'status') {
    const manifest = await readManifest(requiredArg(args, 0, 'manifest path'));
    const records = await readRunRecords(runRecordsPath(manifest.runId));
    const refreshed = await refreshRunRecords(records);
    await writeJson(runRecordsPath(manifest.runId), refreshed);
    await writeJson(DEFAULT_DASHBOARD_PATH, buildDashboardState(manifest, refreshed));
    console.log(`Status refreshed for ${manifest.runId}.`);
    return;
  }

  if (command === 'watch') {
    const manifest = await readManifest(requiredArg(args, 0, 'manifest path'));
    const pollSeconds = Number(optionalArg(args, 1) ?? 30);
    const maxMinutes = Number(optionalArg(args, 2) ?? 30);
    await watchManifest(manifest, pollSeconds, maxMinutes);
    return;
  }

  if (command === 'pull') {
    const sessionId = requiredArg(args, 0, 'session id');
    pullJulesSession(sessionId);
    return;
  }

  if (command === 'approve') {
    const sessionId = requiredArg(args, 0, 'session id');
    await julesPost(buildSessionActionPath(sessionId, 'approvePlan'), {});
    console.log(`Approved Jules plan for session ${sessionId}.`);
    return;
  }

  if (command === 'message') {
    const sessionId = requiredArg(args, 0, 'session id');
    const prompt = args.slice(1).join(' ').trim();
    if (!prompt) throw new Error('Missing required argument: message text');
    await julesPost(buildSessionActionPath(sessionId, 'sendMessage'), { prompt });
    console.log(`Sent message to Jules session ${sessionId}.`);
    return;
  }

  if (command === 'review') {
    const manifest = await readManifest(requiredArg(args, 0, 'manifest path'));
    const records = await readRunRecords(runRecordsPath(manifest.runId));
    printReviewChecklists(manifest, records);
    return;
  }

  throw new Error(`Unknown Jules command: ${command}`);
}

function printHelp(): void {
  console.log([
    'Jules Orchestrator',
    '',
    'Commands:',
    '  validate <manifest.json>        Check task safety before launch.',
    '  prompt <manifest.json> <task>   Render one Jules prompt without launching.',
    '  sources                         List Jules API sources visible to this key.',
    '  activities <session-id> [size] [output.json]',
    '                                  List session activities, messages, and artifacts.',
    '  patch <manifest.json> <task> <session-id> [output.patch]',
    '                                  Save the latest safe Jules patch artifact.',
    '  dashboard <manifest.json> [records.json]',
    '                                  Write .jules/runs/jules-dashboard.json.',
    '  launch <manifest.json>          Create Jules sessions for every task.',
    '  status <manifest.json>          Refresh session states and dashboard JSON.',
    '  watch <manifest.json> [sec] [min]',
    '                                  Poll status until complete, failed, or human-needed.',
    '  approve <session-id>            Approve a Jules plan waiting for review.',
    '  message <session-id> <text>      Send feedback to a Jules session.',
    '  pull <session-id>               Pull a completed Jules session with Jules CLI.',
    '  review <manifest.json>          Print review checklists for recorded sessions.',
  ].join('\n'));
}

// ============================================================================
// Manifest and State Files
// ============================================================================
// This section handles local files. Every write creates parent folders first so
// a new checkout can start using Jules orchestration without manual setup.
// ============================================================================

async function readManifest(filePath: string): Promise<JulesRunManifest> {
  const raw = await fs.readFile(path.resolve(filePath), 'utf-8');
  return JSON.parse(raw) as JulesRunManifest;
}

async function readRunRecords(filePath?: string): Promise<JulesTaskRunRecord[]> {
  if (!filePath) return [];

  try {
    const raw = await fs.readFile(path.resolve(filePath), 'utf-8');
    return JSON.parse(raw) as JulesTaskRunRecord[];
  } catch (error) {
    if (isMissingFileError(error)) return [];
    throw error;
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

function runRecordsPath(runId: string): string {
  return path.resolve(process.cwd(), `.jules/runs/${runId}/records.json`);
}

function assertValidManifest(manifest: JulesRunManifest): void {
  const validation = validateJulesRunManifest(manifest);
  if (validation.ok) return;

  throw new Error(['Jules manifest is not safe to run:', ...validation.errors.map((error) => `- ${error}`)].join('\n'));
}

// ============================================================================
// Jules REST API
// ============================================================================
// This section is the only place that uses JULES_API_KEY. Responses are converted
// into small run records so the dashboard does not depend on the full alpha API
// response shape.
// ============================================================================

async function launchManifest(manifest: JulesRunManifest): Promise<JulesTaskRunRecord[]> {
  const records: JulesTaskRunRecord[] = [];

  // Launch tasks one at a time so Codex can see which exact packet failed if the
  // API rejects a request.
  for (const task of manifest.tasks) {
    const response = await julesPost<JulesSessionResponse>('/sessions', buildCreateSessionRequest(manifest, task));
    records.push(sessionToRunRecord(task.id, response));
  }

  return records;
}

async function refreshRunRecords(records: JulesTaskRunRecord[]): Promise<JulesTaskRunRecord[]> {
  const refreshed: JulesTaskRunRecord[] = [];

  // Refresh only records with sessions. A NOT_STARTED packet should stay local
  // until Codex explicitly launches it.
  for (const record of records) {
    if (!record.sessionId) {
      refreshed.push(record);
      continue;
    }

    const session = await julesGet<JulesSessionResponse>(`/sessions/${record.sessionId}`);
    refreshed.push({
      ...record,
      ...sessionToRunRecord(record.taskId, session),
    });
  }

  return refreshed;
}

async function watchManifest(manifest: JulesRunManifest, pollSeconds: number, maxMinutes: number): Promise<void> {
  // Watch mode is the unattended monitor for Codex: it refreshes the shared
  // dashboard file and exits as soon as Jules reaches a decision point.
  if (!Number.isFinite(pollSeconds) || pollSeconds < 5) {
    throw new Error('watch poll interval must be at least 5 seconds.');
  }

  if (!Number.isFinite(maxMinutes) || maxMinutes <= 0) {
    throw new Error('watch max minutes must be greater than zero.');
  }

  const deadline = Date.now() + maxMinutes * 60_000;

  while (true) {
    const records = await readRunRecords(runRecordsPath(manifest.runId));
    const refreshed = await refreshRunRecords(records);
    const dashboard = buildDashboardState(manifest, refreshed);

    await writeJson(runRecordsPath(manifest.runId), refreshed);
    await writeJson(DEFAULT_DASHBOARD_PATH, dashboard);
    console.log(
      `${new Date().toISOString()} ${manifest.runId}: completed=${dashboard.summary.completed} running=${dashboard.summary.running} needsHuman=${dashboard.summary.needsHuman} failed=${dashboard.summary.failed}`,
    );

    if (dashboard.summary.failed > 0) {
      throw new Error(`Jules run ${manifest.runId} has failed task(s). Review ${relativePath(DEFAULT_DASHBOARD_PATH)}.`);
    }

    if (dashboard.summary.needsHuman > 0) {
      console.log(`Jules run ${manifest.runId} needs human/Codex action.`);
      return;
    }

    if (dashboard.summary.completed === dashboard.summary.total) {
      console.log(`Jules run ${manifest.runId} completed.`);
      return;
    }

    if (Date.now() >= deadline) {
      throw new Error(`Timed out while watching ${manifest.runId}. Last dashboard: ${relativePath(DEFAULT_DASHBOARD_PATH)}.`);
    }

    await sleep(pollSeconds * 1000);
  }
}

async function julesGet<T>(pathName: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${pathName}`, {
    headers: julesHeaders(),
  });

  return parseJulesResponse<T>(response);
}

async function julesPost<T>(pathName: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${pathName}`, {
    method: 'POST',
    headers: {
      ...julesHeaders(),
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return parseJulesResponse<T>(response);
}

async function listSessionActivities(sessionId: string, pageSize: number): Promise<JulesActivitiesResponse> {
  // Activities give Codex more than the coarse session state: progress updates,
  // plans, messages, completion/failure events, and artifacts such as patches.
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new Error('activities page size must be an integer from 1 to 100.');
  }

  return julesGet<JulesActivitiesResponse>(`/sessions/${sessionId}/activities?pageSize=${pageSize}`);
}

function julesHeaders(): Record<string, string> {
  const key = resolveJulesApiKey(process.env, readWindowsUserJulesKey);
  if (!key) throw new Error('JULES_API_KEY is not set. Create one in Jules settings and store it before using API commands.');

  return {
    'x-goog-api-key': key,
  };
}

function readWindowsUserJulesKey(): string | undefined {
  // Windows exposes user-level environment variables through the registry even
  // when the current process was started before the variable existed. On other
  // platforms this fallback is intentionally skipped.
  if (process.platform !== 'win32') return undefined;

  return execFileText('powershell', [
    '-NoLogo',
    '-Command',
    "[Environment]::GetEnvironmentVariable('JULES_API_KEY','User')",
  ])?.trim();
}

async function parseJulesResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Jules API request failed with ${response.status}: ${text}`);
  }

  return (text ? JSON.parse(text) : {}) as T;
}

interface JulesSessionResponse {
  id?: string;
  name?: string;
  state?: JulesTaskRunRecord['state'];
  url?: string;
  updateTime?: string;
  outputs?: Array<{
    pullRequest?: {
      url?: string;
    };
  }>;
}

interface JulesActivitiesResponse {
  activities?: JulesActivityResponse[];
  nextPageToken?: string;
}

interface JulesActivityResponse {
  artifacts?: Array<{
    changeSet?: {
      gitPatch?: {
        unidiffPatch?: string;
      };
    };
  }>;
  [key: string]: unknown;
}

function findLatestUnidiffPatch(response: JulesActivitiesResponse): string | undefined {
  const activities = response.activities ?? [];

  for (let index = activities.length - 1; index >= 0; index -= 1) {
    const patch = activities[index].artifacts
      ?.map((artifact) => artifact.changeSet?.gitPatch?.unidiffPatch)
      .find((candidate): candidate is string => Boolean(candidate?.trim()));

    if (patch) return patch;
  }

  return undefined;
}

function sessionToRunRecord(taskId: string, session: JulesSessionResponse): JulesTaskRunRecord {
  // The API sometimes exposes both name ("sessions/123") and id. Store the id
  // because later endpoint paths use that compact identifier.
  const sessionId = session.id ?? session.name?.replace(/^sessions\//, '');

  return {
    taskId,
    sessionId,
    state: session.state ?? 'QUEUED',
    url: session.url,
    pullRequestUrl: session.outputs?.find((output) => output.pullRequest?.url)?.pullRequest?.url,
    updatedAt: session.updateTime,
  };
}

// ============================================================================
// Pull and Review Workflow
// ============================================================================
// This section bridges completed Jules sessions back into Codex review. Pulling
// is explicit because it can modify the local worktree; review is read-only and
// prints the checklist Codex should satisfy before accepting any remote work.
// ============================================================================

function pullJulesSession(sessionId: string): void {
  execFileSync('jules', ['remote', 'pull', '--session', sessionId], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

function printReviewChecklists(manifest: JulesRunManifest, records: JulesTaskRunRecord[]): void {
  const recordsByTaskId = new Map(records.map((record) => [record.taskId, record]));

  for (const task of manifest.tasks) {
    const record = recordsByTaskId.get(task.id);
    if (!record) {
      console.log(`\n${task.id}: no Jules session record exists yet.`);
      continue;
    }

    console.log(`\n${task.id}: ${task.title}`);
    for (const item of buildReviewChecklist(task, record)) {
      console.log(`- ${item}`);
    }
  }
}

// ============================================================================
// Small Utilities
// ============================================================================
// These helpers keep command error messages readable without pulling in a larger
// argument-parsing dependency for a six-command internal tool.
// ============================================================================

function requiredArg(args: string[], index: number, label: string): string {
  const value = args[index];
  if (!value) throw new Error(`Missing required argument: ${label}`);
  return value;
}

function optionalArg(args: string[], index: number): string | undefined {
  return args[index];
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function relativePath(filePath: string): string {
  return path.relative(process.cwd(), filePath).replace(/\\/g, '/');
}

function execFileText(command: string, args: string[]): string | undefined {
  try {
    return execFileSync(command, args, {
      encoding: 'utf-8',
      windowsHide: true,
    });
  } catch {
    return undefined;
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// ============================================================================
// Entrypoint
// ============================================================================
// Top-level errors print only the message. That keeps automation logs readable
// while still returning a failing exit code for scripts and agents.
// ============================================================================

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
