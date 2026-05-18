// ============================================================================
// Orchestrator — Core Poll/Dispatch/Reconciliation Loop
// ============================================================================
// The single authoritative owner of scheduling state. Implements:
// - Poll loop with configurable interval (Section 8.1)
// - Candidate selection and dispatch (Section 8.2-8.3)
// - Retry with exponential backoff (Section 8.4)
// - Active run reconciliation (Section 8.5)
// - Startup terminal workspace cleanup (Section 8.6)
// - Dynamic workflow reload (Section 6.2)
//
// Based on SPEC Sections 7-8 and pseudocode in Section 16.
// ============================================================================

import { watch } from 'chokidar';
import { dirname } from 'node:path';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type {
  Issue,
  OrchestratorState,
  RunningEntry,
  RetryEntry,
  ServiceConfig,
  CodexEvent,
  ActivityEntry,
  PendingApproval,
  WorkflowDefinition,
  WorkerDesignation,
} from './types.js';
import { loadWorkflow, resolveWorkflowPath } from './workflow-loader.js';
import { resolveConfig, validateDispatchConfig } from './config.js';
import { LinearClient } from './linear-client.js';
import { MockClient } from './mock-client.js';
import { WorkspaceManager } from './workspace.js';
import { AgentRunner, type SessionState } from './agent-runner.js';
import { buildTurnPrompt } from './prompt-renderer.js';
import { Logger } from './logger.js';

const MAX_RECENT_CODEX_EVENTS = 250;
const MAX_WORKSPACE_FILES = 30;
const MAX_ACTIVITY_ENTRIES = 120;
const MAX_TOOL_ARGUMENT_PREVIEW_CHARS = 50_000;

// ---------------------------------------------------------------------------
// Worker identity helpers
// ---------------------------------------------------------------------------
// Symphony assigns worker names because it owns issue dispatch. Keeping these
// helpers outside the class lets the dashboard/contract tests verify the naming
// and JSON shape without booting the whole poller or starting Codex sessions.

export function buildWorkerDesignationLabel(issueIdentifier: string, runNumber: number): string {
  const safeIdentifier = issueIdentifier.replace(/[^A-Za-z0-9_-]/g, '-');
  return `worker-${safeIdentifier}-run-${String(runNumber).padStart(4, '0')}`;
}

export function serializeWorkerDesignation(worker: WorkerDesignation | null): Record<string, unknown> | null {
  if (!worker) return null;

  return {
    designation: worker.designation,
    run_number: worker.runNumber,
    attempt: worker.attempt,
    issue_identifier: worker.issueIdentifier,
    workspace_path: worker.workspacePath,
    thread_id: worker.threadId,
    model: worker.model,
    reasoning_effort: worker.reasoningEffort,
    started_at: worker.startedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------
export class Orchestrator {
  private workflowPath: string;
  private workflow: WorkflowDefinition | null = null;
  private config: ServiceConfig | null = null;
  private state: OrchestratorState;
  private trackerClient: LinearClient | MockClient | null = null;
  private workspaceManager: WorkspaceManager | null = null;
  private agentRunner: AgentRunner | null = null;
  private log: Logger;
  private tickTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private dispatchEnabled = false;
  private dispatchInitialized = false;
  private workerRunSequence = 0;
  private activeSessions = new Map<string, SessionState>();
  private dashboardBaseUrl: string | null = null;

  constructor(workflowPath?: string, logger?: Logger) {
    this.workflowPath = resolveWorkflowPath(workflowPath);
    this.log = (logger ?? new Logger('info', { component: 'orchestrator' }));

    // Initialize empty orchestrator state (Section 4.1.8)
    this.state = {
      pollIntervalMs: 30_000,
      maxConcurrentAgents: 10,
      running: new Map(),
      claimed: new Set(),
      retryAttempts: new Map(),
      completed: new Set(),
      codexTotals: { inputTokens: 0, outputTokens: 0, totalTokens: 0, secondsRunning: 0 },
      codexRateLimits: null,
    };
  }

  setDashboardBaseUrl(baseUrl: string | null): void {
    // The CLI can override WORKFLOW.md's dashboard port. Keep that runtime URL
    // on the orchestrator so worker prompts point at the server the operator
    // actually started, including smoke runs on alternate ports.
    this.dashboardBaseUrl = baseUrl;
  }

  getDashboardBaseUrl(): string {
    // The dashboard URL is part of Symphony's operator contract now: workers
    // receive it in prompts and humans can confirm it through /api/v1/state.
    // Prefer the runtime CLI override, then the workflow config, then the
    // historical local default used by the Aralia workflow.
    return this.dashboardBaseUrl ?? (this.config?.server.port
      ? `http://127.0.0.1:${this.config.server.port}`
      : 'http://127.0.0.1:8081');
  }

  // -------------------------------------------------------------------------
  // Service startup (Section 16.1)
  // -------------------------------------------------------------------------
  async start(_options: { dashboardOnly?: boolean } = {}): Promise<void> {
    this.log.info('Symphony starting', { workflowPath: this.workflowPath });

    // Load and validate workflow
    await this.reloadWorkflow();
    if (!this.config) throw new Error('Failed to load workflow config');

    // Apply config to state
    this.state.pollIntervalMs = this.config.polling.intervalMs;
    this.state.maxConcurrentAgents = this.config.agent.maxConcurrentAgents;

    // Start file watcher for dynamic reload (Section 6.2)
    this.startWorkflowWatch();

    this.running = true;

    // Dispatch is deliberately paused on every process start. The dashboard is
    // now allowed to be a safe inspection surface by default; the operator must
    // explicitly enable assignment before Symphony polls trackers, claims
    // issues, creates workspaces, or starts Codex app-server sessions.
    this.dispatchEnabled = false;

    this.log.info('Symphony started successfully', {
      dispatchEnabled: this.dispatchEnabled,
      dispatchDefault: 'paused',
    });
  }

  getConfig(): ServiceConfig | null {
    return this.config;
  }

  getDispatchControl(): Record<string, unknown> {
    return {
      enabled: this.dispatchEnabled,
      initialized: this.dispatchInitialized,
      default: 'paused',
      status: this.dispatchEnabled ? 'enabled' : 'paused',
      toggle_url: `${this.getDashboardBaseUrl()}/api/v1/dispatch-control`,
      summary: this.dispatchEnabled
        ? 'Dispatch is enabled. Symphony may poll trackers and assign eligible workers.'
        : 'Dispatch is paused. The dashboard can inspect state, but Symphony will not assign new workers.',
    };
  }

  async setDispatchEnabled(enabled: boolean): Promise<Record<string, unknown>> {
    if (enabled) {
      await this.ensureDispatchInitialized();
      this.dispatchEnabled = true;

      // Enabling dispatch is an explicit operator action. Start a tick now so
      // the old "poll and assign" behavior resumes only after the dashboard
      // toggle has been turned on.
      this.scheduleTick(0);
      this.log.info('Dispatch enabled by dashboard control');
    } else {
      this.dispatchEnabled = false;

      if (this.tickTimer) {
        clearTimeout(this.tickTimer);
        this.tickTimer = null;
      }

      this.log.info('Dispatch paused by dashboard control');
    }

    return this.getDispatchControl();
  }

  /** Graceful shutdown */
  async stop(): Promise<void> {
    this.log.info('Symphony stopping');
    this.running = false;

    if (this.tickTimer) {
      clearTimeout(this.tickTimer);
      this.tickTimer = null;
    }

    // Cancel all retry timers
    for (const [, entry] of this.state.retryAttempts) {
      clearTimeout(entry.timerHandle);
    }
    this.state.retryAttempts.clear();

    // Stop all running agents
    for (const [issueId, entry] of this.state.running) {
      this.log.info('Stopping agent on shutdown', { issueId, identifier: entry.identifier });
      entry.workerHandle.abort();
    }

    this.log.info('Symphony stopped');
  }

  // -------------------------------------------------------------------------
  // Poll-and-dispatch tick (Section 16.2)
  // -------------------------------------------------------------------------
  private async onTick(): Promise<void> {
    if (!this.running) return;
    if (!this.dispatchEnabled) {
      // The dashboard toggle is the runtime safety gate. A stale timer, manual
      // refresh, or old retry callback must not sneak past the paused state and
      // start tracker polling or worker assignment.
      this.log.info('Tick skipped because dispatch is paused');
      return;
    }

    this.log.debug('Tick started', {
      running: this.state.running.size,
      retrying: this.state.retryAttempts.size,
    });

    // Step 1: Reconcile running issues
    await this.reconcileRunningIssues();

    // Step 2: Validate dispatch config
    try {
      if (this.config) validateDispatchConfig(this.config);
    } catch (err) {
      this.log.error('Dispatch validation failed, skipping dispatch', {
        error: (err as Error).message,
      });
      this.scheduleTick(this.state.pollIntervalMs);
      return;
    }

    // Step 3: Fetch candidate issues
    let candidates: Issue[];
    try {
      candidates = await this.trackerClient!.fetchCandidateIssues();
    } catch (err) {
      this.log.error('Failed to fetch candidates, skipping dispatch', {
        error: (err as Error).message,
      });
      this.scheduleTick(this.state.pollIntervalMs);
      return;
    }

    // Step 4: Sort by dispatch priority (Section 8.2)
    candidates.sort((a, b) => {
      // Priority ascending (lower = higher priority; null sorts last)
      const pa = a.priority ?? 999;
      const pb = b.priority ?? 999;
      if (pa !== pb) return pa - pb;

      // Created_at oldest first
      const ca = a.createdAt?.getTime() ?? Infinity;
      const cb = b.createdAt?.getTime() ?? Infinity;
      if (ca !== cb) return ca - cb;

      // Identifier lexicographic tie-breaker
      return a.identifier.localeCompare(b.identifier);
    });

    // Step 5: Dispatch eligible issues
    for (const issue of candidates) {
      if (this.availableSlots() <= 0) break;
      if (this.shouldDispatch(issue)) {
        await this.dispatchIssue(issue, null);
      }
    }

    // Schedule next tick
    this.scheduleTick(this.state.pollIntervalMs);
  }

  // -------------------------------------------------------------------------
  // Candidate eligibility (Section 8.2)
  // -------------------------------------------------------------------------
  private shouldDispatch(issue: Issue): boolean {
    if (!issue.id || !issue.identifier || !issue.title || !issue.state) return false;

    const stateLower = issue.state.toLowerCase();
    const activeStatesLower = this.config!.tracker.activeStates.map(s => s.toLowerCase());
    const terminalStatesLower = this.config!.tracker.terminalStates.map(s => s.toLowerCase());

    if (!activeStatesLower.includes(stateLower)) return false;
    if (terminalStatesLower.includes(stateLower)) return false;
    if (this.state.running.has(issue.id)) return false;
    if (this.state.claimed.has(issue.id)) return false;

    // Per-state concurrency check
    const perStateLimit = this.config!.agent.maxConcurrentAgentsByState.get(stateLower);
    if (perStateLimit !== undefined) {
      const runningInState = [...this.state.running.values()]
        .filter(e => e.issue.state.toLowerCase() === stateLower).length;
      if (runningInState >= perStateLimit) return false;
    }

    // Blocker rule: Todo issues with non-terminal blockers are not eligible
    if (stateLower === 'todo' && issue.blockedBy.length > 0) {
      const hasNonTerminalBlocker = issue.blockedBy.some(b => {
        if (!b.state) return true; // unknown state = assume blocking
        return !terminalStatesLower.includes(b.state.toLowerCase());
      });
      if (hasNonTerminalBlocker) return false;
    }

    return true;
  }

  private availableSlots(): number {
    return Math.max(this.state.maxConcurrentAgents - this.state.running.size, 0);
  }

  private async ensureDispatchInitialized(): Promise<void> {
    if (!this.config) throw new Error('Cannot enable dispatch before workflow config is loaded.');
    if (this.dispatchInitialized) return;

    // Dispatch-only dependencies are intentionally lazy now. Starting the
    // dashboard should not require Linear/mock tracker credentials, workspace
    // cleanup, or Codex app-server setup until the operator enables assignment.
    validateDispatchConfig(this.config);

    if (this.config.tracker.kind === 'mock') {
      this.trackerClient = new MockClient({
        activeStates: this.config.tracker.activeStates,
        terminalStates: this.config.tracker.terminalStates,
        logger: this.log,
      });
    } else {
      this.trackerClient = new LinearClient({
        endpoint: this.config.tracker.endpoint,
        apiKey: this.config.tracker.apiKey,
        projectSlug: this.config.tracker.projectSlug,
        activeStates: this.config.tracker.activeStates,
        terminalStates: this.config.tracker.terminalStates,
        logger: this.log,
      });
    }

    this.workspaceManager = new WorkspaceManager(this.config, this.log);
    this.agentRunner = new AgentRunner(this.config, this.log);

    // This cleanup can delete old terminal workspaces, so it only runs after
    // the explicit dashboard toggle enables assignment.
    await this.startupCleanup();
    this.dispatchInitialized = true;
  }

  // -------------------------------------------------------------------------
  // Dispatch (Section 16.4)
  // -------------------------------------------------------------------------
  private async dispatchIssue(issue: Issue, attempt: number | null): Promise<void> {
    const workerDesignation = this.createWorkerDesignation(issue, attempt);
    this.log.info('Dispatching issue', {
      issueIdentifier: issue.identifier,
      attempt: attempt ?? 'first',
      workerDesignation: workerDesignation.designation,
    });

    const abortController = new AbortController();
    const existingRetry = this.state.retryAttempts.get(issue.id);

    const entry: RunningEntry = {
      workerHandle: abortController,
      identifier: issue.identifier,
      workerDesignation,
      issue,
      sessionId: null,
      codexAppServerPid: null,
      lastCodexMessage: null,
      lastReadableCodexTimestamp: existingRetry?.lastReadableCodexTimestamp ?? null,
      lastCodexEvent: null,
      lastCodexTimestamp: null,
      codexInputTokens: 0,
      codexOutputTokens: 0,
      codexTotalTokens: 0,
      lastReportedInputTokens: 0,
      lastReportedOutputTokens: 0,
      lastReportedTotalTokens: 0,
      retryAttempt: attempt ?? 0,
      workspacePath: existingRetry?.workspacePath ?? null,
      lastError: existingRetry?.error ?? null,
      recentCodexEvents: existingRetry?.recentCodexEvents.slice(-MAX_RECENT_CODEX_EVENTS) ?? [],
      waitingOnApproval: existingRetry?.waitingOnApproval ?? false,
      approvalSummary: existingRetry?.approvalSummary ?? null,
      pendingApproval: existingRetry?.pendingApproval ?? null,
      startedAt: new Date(),
      turnCount: 0,
    };

    this.state.running.set(issue.id, entry);
    this.state.claimed.add(issue.id);

    // Cancel any existing retry for this issue
    if (existingRetry) {
      clearTimeout(existingRetry.timerHandle);
      this.state.retryAttempts.delete(issue.id);
    }

    // Spawn worker asynchronously (Section 16.5)
    this.runWorker(issue, attempt, abortController.signal).catch(() => {});
  }

  // -------------------------------------------------------------------------
  // Worker attempt (Section 16.5)
  // -------------------------------------------------------------------------
  private async runWorker(
    issue: Issue,
    attempt: number | null,
    signal: AbortSignal
  ): Promise<void> {
    const issueLog = this.log.child({
      issueId: issue.id,
      issueIdentifier: issue.identifier,
    });
    const entryAtStart = this.state.running.get(issue.id);
    const workerDesignation = entryAtStart?.workerDesignation ?? this.createWorkerDesignation(issue, attempt);

    let workspacePath: string | null = null;

    try {
      // Create/reuse workspace
      const workspace = await this.workspaceManager!.createForIssue(issue.identifier);
      workspacePath = workspace.path;
      const runEntry = this.state.running.get(issue.id);
      if (runEntry) {
        runEntry.workspacePath = workspacePath;
        runEntry.workerDesignation.workspacePath = workspacePath;
      }
      this.writeWorkerMarker(workerDesignation, workspacePath);
      this.handleCodexEvent(issue.id, this.buildOrchestratorEvent('workspace_ready', {
        workspacePath,
        workerDesignation: workerDesignation.designation,
      }));

      // Run before_run hook
      await this.workspaceManager!.runBeforeRun(workspacePath);

      if (signal.aborted) return;

      // Start agent session
      const session = await this.agentRunner!.startSession(workspacePath, signal);
      this.activeSessions.set(issue.id, session);
      const sessionEntry = this.state.running.get(issue.id);
      if (sessionEntry) {
        sessionEntry.sessionId = session.threadId;
        sessionEntry.workerDesignation.threadId = session.threadId;
      }
      this.writeWorkerMarker(workerDesignation, workspacePath, session.threadId);
      this.handleCodexEvent(issue.id, this.buildOrchestratorEvent('session_started', {
        workspacePath,
        workerDesignation: workerDesignation.designation,
        threadId: session.threadId,
      }));

      if (signal.aborted) {
          await this.agentRunner!.stopSession(session);
          this.activeSessions.delete(issue.id);
          return;
      }

      const maxTurns = this.config!.agent.maxTurns;
      const dashboardBaseUrl = this.getDashboardBaseUrl();
      let turnNumber = 1;

      // Turn loop — keep going while issue is active and turns remain
      while (!signal.aborted) {
        const prompt = await buildTurnPrompt(
          this.workflow!.promptTemplate,
          issue,
          attempt,
          turnNumber,
          maxTurns,
          workerDesignation,
          dashboardBaseUrl
        );
        this.handleCodexEvent(issue.id, this.buildOrchestratorEvent('turn_started', {
          turnNumber,
          maxTurns,
          workerDesignation: workerDesignation.designation,
        }));

        const turnResult = await this.agentRunner!.runTurn(
          session, prompt, issue, workerDesignation,
          (event: CodexEvent) => this.handleCodexEvent(issue.id, event)
        );

        // Update turn count
        const runEntry = this.state.running.get(issue.id);
        if (runEntry) runEntry.turnCount = turnNumber;

        if (!turnResult.success) {
          await this.agentRunner!.stopSession(session);
          this.activeSessions.delete(issue.id);
          await this.workspaceManager!.runAfterRun(workspacePath);
          throw new Error(`Turn failed: ${turnResult.error}`);
        }

        // Re-check issue state from tracker
        try {
          const refreshed = await this.trackerClient!.fetchIssueStatesByIds([issue.id]);
          const current = refreshed.find(i => i.id === issue.id);
          if (current) {
            issue = { ...issue, state: current.state };
          }
        } catch (err) {
          issueLog.warn('Failed to refresh issue state after turn', {
            error: (err as Error).message,
          });
          await this.agentRunner!.stopSession(session);
          this.activeSessions.delete(issue.id);
          await this.workspaceManager!.runAfterRun(workspacePath);
          throw err;
        }

        // Check if issue is still active
        const activeStatesLower = this.config!.tracker.activeStates.map(s => s.toLowerCase());
        if (!activeStatesLower.includes(issue.state.toLowerCase())) break;
        if (turnNumber >= maxTurns) break;

        turnNumber++;
      }

      await this.agentRunner!.stopSession(session);
      this.activeSessions.delete(issue.id);
      await this.workspaceManager!.runAfterRun(workspacePath);

      // Normal exit
      this.onWorkerExit(issue.id, 'normal');
    } catch (err) {
      this.activeSessions.delete(issue.id);
      if (workspacePath) {
        await this.workspaceManager!.runAfterRun(workspacePath).catch(() => {});
      }
      issueLog.error('Worker failed', { error: (err as Error).message });
      this.onWorkerExit(issue.id, 'abnormal', (err as Error).message);
    }
  }

  // -------------------------------------------------------------------------
  // Worker exit handling (Section 16.6)
  // -------------------------------------------------------------------------
  private onWorkerExit(issueId: string, reason: 'normal' | 'abnormal', error?: string): void {
    const entry = this.state.running.get(issueId);
    if (!entry) return;

    if (error) {
      entry.lastError = error;
    }

    // Add runtime seconds to totals
    const runtimeMs = Date.now() - entry.startedAt.getTime();
    this.state.codexTotals.secondsRunning += runtimeMs / 1000;
    this.state.codexTotals.inputTokens += entry.codexInputTokens;
    this.state.codexTotals.outputTokens += entry.codexOutputTokens;
    this.state.codexTotals.totalTokens += entry.codexTotalTokens;

    this.state.running.delete(issueId);

    if (reason === 'normal') {
      this.state.completed.add(issueId);
      // Schedule continuation retry after 1s (Section 8.4)
      this.scheduleRetry(issueId, entry.identifier, 1, 1000, null, entry);
    } else {
      // Exponential backoff retry
      const nextAttempt = entry.retryAttempt + 1;
      const delay = Math.min(
        10_000 * Math.pow(2, nextAttempt - 1),
        this.config!.agent.maxRetryBackoffMs
      );
      this.scheduleRetry(issueId, entry.identifier, nextAttempt, delay, error ?? null, entry);
    }
  }

  // -------------------------------------------------------------------------
  // Retry scheduling (Section 8.4)
  // -------------------------------------------------------------------------
  private scheduleRetry(
    issueId: string, identifier: string,
    attempt: number, delayMs: number, error: string | null,
    previousEntry?: RunningEntry | RetryEntry
  ): void {
    // Cancel existing retry timer
    const existing = this.state.retryAttempts.get(issueId);
    if (existing) clearTimeout(existing.timerHandle);

    const dueAtMs = Date.now() + delayMs;
    const timerHandle = setTimeout(() => this.onRetryTimer(issueId), delayMs);

    this.state.retryAttempts.set(issueId, {
      issueId,
      identifier,
      attempt,
      dueAtMs,
      timerHandle,
      error,
      workerDesignation: previousEntry?.workerDesignation ?? null,
      workspacePath: previousEntry?.workspacePath ?? this.workspaceManager?.getWorkspacePath(identifier) ?? null,
      lastCodexEvent: previousEntry?.lastCodexEvent ?? null,
      lastCodexMessage: previousEntry?.lastCodexMessage ?? null,
      lastReadableCodexTimestamp: previousEntry?.lastReadableCodexTimestamp ?? null,
      lastCodexTimestamp: previousEntry?.lastCodexTimestamp ?? null,
      recentCodexEvents: previousEntry?.recentCodexEvents.slice(-MAX_RECENT_CODEX_EVENTS) ?? [],
      waitingOnApproval: previousEntry?.waitingOnApproval ?? false,
      approvalSummary: previousEntry?.approvalSummary ?? null,
      pendingApproval: previousEntry?.pendingApproval ?? null,
    });

    this.log.info('Retry scheduled', {
      issueIdentifier: identifier, attempt, delayMs, error: error ?? undefined,
    });
  }

  private async onRetryTimer(issueId: string): Promise<void> {
    const retryEntry = this.state.retryAttempts.get(issueId);
    if (!retryEntry) return;

    if (!this.dispatchEnabled) {
      // Preserve the retry record while dispatch is paused. Dropping it would
      // lose worker context, and dispatching it would violate the dashboard
      // gate the operator just turned off.
      const delayMs = this.state.pollIntervalMs;
      retryEntry.dueAtMs = Date.now() + delayMs;
      retryEntry.timerHandle = setTimeout(() => this.onRetryTimer(issueId), delayMs);
      this.log.info('Retry held because dispatch is paused', {
        issueIdentifier: retryEntry.identifier,
        delayMs,
      });
      return;
    }

    this.state.retryAttempts.delete(issueId);

    // Fetch candidates to check if issue is still eligible
    let candidates: Issue[];
    try {
      candidates = await this.trackerClient!.fetchCandidateIssues();
    } catch {
      this.scheduleRetry(issueId, retryEntry.identifier, retryEntry.attempt + 1,
        10_000, 'retry poll failed');
      return;
    }

    const issue = candidates.find(c => c.id === issueId);
    if (!issue) {
      this.state.claimed.delete(issueId);
      this.log.info('Retry: issue no longer a candidate, releasing claim', {
        issueIdentifier: retryEntry.identifier,
      });
      return;
    }

    if (this.availableSlots() <= 0) {
      this.scheduleRetry(issueId, issue.identifier, retryEntry.attempt + 1,
        10_000, 'no available orchestrator slots');
      return;
    }

    await this.dispatchIssue(issue, retryEntry.attempt);
  }

  // -------------------------------------------------------------------------
  // Reconciliation (Section 8.5 / 16.3)
  // -------------------------------------------------------------------------
  private async reconcileRunningIssues(): Promise<void> {
    // Part A: Stall detection
    if (this.config!.codex.stallTimeoutMs > 0) {
      const now = Date.now();
      for (const [issueId, entry] of this.state.running) {
        const lastActivity = entry.lastCodexTimestamp ?? entry.startedAt;
        const elapsedMs = now - lastActivity.getTime();
        if (elapsedMs > this.config!.codex.stallTimeoutMs) {
          this.log.warn('Stalled session detected', {
            issueIdentifier: entry.identifier, elapsedMs,
          });
          entry.workerHandle.abort();
          entry.lastError = 'session stalled';
          this.state.running.delete(issueId);
          this.scheduleRetry(issueId, entry.identifier, entry.retryAttempt + 1,
            10_000, 'session stalled', entry);
        }
      }
    }

    // Part B: Tracker state refresh
    const runningIds = [...this.state.running.keys()];
    if (runningIds.length === 0) return;

    let refreshed: { id: string; identifier: string; state: string }[];
    try {
      refreshed = await this.trackerClient!.fetchIssueStatesByIds(runningIds);
    } catch {
      this.log.debug('State refresh failed, keeping workers running');
      return;
    }

    const terminalStatesLower = this.config!.tracker.terminalStates.map(s => s.toLowerCase());
    const activeStatesLower = this.config!.tracker.activeStates.map(s => s.toLowerCase());

    for (const issueState of refreshed) {
      const entry = this.state.running.get(issueState.id);
      if (!entry) continue;

      const stateLower = issueState.state.toLowerCase();

      if (terminalStatesLower.includes(stateLower)) {
        this.log.info('Issue reached terminal state, stopping agent', {
          issueIdentifier: entry.identifier, state: issueState.state,
        });
        entry.workerHandle.abort();
        this.state.running.delete(issueState.id);
        this.state.claimed.delete(issueState.id);
        await this.workspaceManager!.removeWorkspace(entry.identifier).catch(() => {});
      } else if (activeStatesLower.includes(stateLower)) {
        entry.issue = { ...entry.issue, state: issueState.state };
      } else {
        this.log.info('Issue no longer active, stopping agent', {
          issueIdentifier: entry.identifier, state: issueState.state,
        });
        entry.workerHandle.abort();
        this.state.running.delete(issueState.id);
        this.state.claimed.delete(issueState.id);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Codex event handling (Section 10.4)
  // -------------------------------------------------------------------------
  private handleCodexEvent(issueId: string, event: CodexEvent): void {
    const entry = this.state.running.get(issueId);
    if (!entry) return;

    entry.lastCodexEvent = event.event;
    entry.lastCodexTimestamp = event.timestamp;

    // Keep the dashboard's "last message" human-readable. The Codex app-server
    // sends many protocol events, such as rate limit snapshots and whitespace
    // stream chunks, that are useful in the raw event log but confusing as the
    // headline status for a worker.
    const readableMessage = this.readableLastMessage(event);
    if (readableMessage) {
      entry.lastCodexMessage = readableMessage;
      entry.lastReadableCodexTimestamp = event.timestamp;
    }
    entry.recentCodexEvents.push(event);
    if (entry.recentCodexEvents.length > MAX_RECENT_CODEX_EVENTS) {
      entry.recentCodexEvents.splice(0, entry.recentCodexEvents.length - MAX_RECENT_CODEX_EVENTS);
    }

    const approvalSummary = this.extractApprovalSummary(event);
    if (approvalSummary) {
      entry.waitingOnApproval = true;
      entry.approvalSummary = approvalSummary;
      entry.pendingApproval = this.extractPendingApproval(event);
      entry.lastCodexMessage = approvalSummary;
      entry.lastReadableCodexTimestamp = event.timestamp;
    }

    if (this.isActiveWithoutApproval(event)) {
      entry.waitingOnApproval = false;
      entry.approvalSummary = null;
      entry.pendingApproval = null;
    }

    if (
      event.event === 'turn_failed' ||
      event.event === 'turn_cancelled' ||
      event.event === 'turn_ended_with_error' ||
      event.event === 'turn_input_required'
    ) {
      entry.lastError = entry.lastCodexMessage;
    }

    if (event.codexAppServerPid) {
      entry.codexAppServerPid = event.codexAppServerPid;
    }

    // Token accounting (Section 13.5) — prefer absolute totals
    if (event.usage) {
      const inputDelta = Math.max(0, (event.usage.inputTokens ?? 0) - entry.lastReportedInputTokens);
      const outputDelta = Math.max(0, (event.usage.outputTokens ?? 0) - entry.lastReportedOutputTokens);
      const totalDelta = Math.max(0, (event.usage.totalTokens ?? 0) - entry.lastReportedTotalTokens);

      entry.codexInputTokens += inputDelta;
      entry.codexOutputTokens += outputDelta;
      entry.codexTotalTokens += totalDelta;

      entry.lastReportedInputTokens = event.usage.inputTokens ?? 0;
      entry.lastReportedOutputTokens = event.usage.outputTokens ?? 0;
      entry.lastReportedTotalTokens = event.usage.totalTokens ?? 0;
    }

    const payload = event.payload ?? {};
    if (payload.rateLimits) {
      // The activity feed keeps a readable history, but /api/v1/state needs the
      // latest raw rate-limit snapshot so the dashboard can show current usage
      // pressure without scraping individual worker events.
      this.state.codexRateLimits = payload.rateLimits;
    }
  }

  private extractApprovalSummary(event: CodexEvent): string | null {
    const pendingApproval = this.extractPendingApproval(event);
    if (pendingApproval) return `Waiting for approval: ${pendingApproval.title}`;

    const payload = event.payload ?? {};
    const status = payload.status as { activeFlags?: unknown } | undefined;
    const activeFlags = Array.isArray(status?.activeFlags) ? status.activeFlags : [];
    const isWaitingOnApproval = activeFlags.includes('waitingOnApproval');
    if (!isWaitingOnApproval) return null;

    const item = payload.item as Record<string, unknown> | undefined;
    if (item?.type === 'mcpToolCall') {
      const server = String(item.server ?? 'unknown server');
      const tool = String(item.tool ?? 'unknown tool');
      return `Waiting for approval: ${server}.${tool}`;
    }

    return 'Waiting for approval';
  }

  private extractPendingApproval(event: CodexEvent): PendingApproval | null {
    const payload = event.payload ?? {};
    const method = this.compactText(payload.method);
    const requestId = payload.request_id as number | string | undefined;
    if (!method || requestId === undefined) return null;
    if (!this.isApprovalRequestMethod(method)) return null;

    const startedAtMs = this.numberish(payload.startedAtMs);
    const requestedAt = startedAtMs
      ? new Date(startedAtMs).toISOString()
      : event.timestamp.toISOString();

    // Keep the raw params beside the readable summary. The dashboard shows the
    // readable form, while the runner needs the method and id to send the
    // protocol-specific response back to the paused app-server.
    return {
      requestId,
      method,
      title: this.approvalTitle(method, payload),
      detail: this.approvalDetail(method, payload),
      requestedAt,
      params: payload,
      canRespond: this.canDashboardRespondToApproval(method),
    };
  }

  private isApprovalRequestMethod(method: string): boolean {
    return [
      'item/mcpToolCall/requestApproval',
      'item/commandExecution/requestApproval',
      'item/fileChange/requestApproval',
      'execCommandApproval',
      'applyPatchApproval',
      'item/permissions/requestApproval',
    ].includes(method);
  }

  private canDashboardRespondToApproval(method: string): boolean {
    return [
      'item/mcpToolCall/requestApproval',
      'item/commandExecution/requestApproval',
      'item/fileChange/requestApproval',
      'item/permissions/requestApproval',
      'execCommandApproval',
      'applyPatchApproval',
    ].includes(method);
  }

  private approvalTitle(method: string, payload: Record<string, unknown>): string {
    if (method === 'item/mcpToolCall/requestApproval') {
      const item = payload.item as Record<string, unknown> | undefined;
      const server = this.compactText(item?.server) ?? 'MCP';
      const tool = this.compactText(item?.tool) ?? 'tool call';
      return this.describeMcpToolCall(server, tool, item?.arguments).title;
    }

    if (method === 'item/commandExecution/requestApproval' || method === 'execCommandApproval') {
      return 'Command execution';
    }

    if (method === 'item/fileChange/requestApproval' || method === 'applyPatchApproval') {
      return 'File change';
    }

    if (method === 'item/permissions/requestApproval') {
      return 'Permission change';
    }

    return method;
  }

  private approvalDetail(method: string, payload: Record<string, unknown>): string {
    if (method === 'item/mcpToolCall/requestApproval') {
      const item = payload.item as Record<string, unknown> | undefined;
      const server = this.compactText(item?.server) ?? 'MCP';
      const tool = this.compactText(item?.tool) ?? 'tool call';
      const detail = this.describeMcpToolCall(server, tool, item?.arguments).detail;

      // App-tool approvals need the same plain-language summary as completed
      // tool calls. Without this, posting a Linear comment looks like a JSON
      // blob and the dashboard cannot safely answer "what am I approving?"
      return detail ?? `${server}.${tool}`;
    }

    const lines: string[] = [];
    const reason = this.compactText(payload.reason);
    const command = this.compactText(payload.command);
    const cwd = this.compactText(payload.cwd);
    const grantRoot = this.compactText(payload.grantRoot);

    if (reason) lines.push(`Reason: ${reason}`);
    if (command) lines.push(`Command: ${command}`);
    if (cwd) lines.push(`cwd: ${cwd}`);
    if (grantRoot) lines.push(`Requested write root: ${grantRoot}`);

    const actions = this.compactJson(payload.commandActions, 1200);
    if (actions) lines.push(`Parsed action:\n${actions}`);

    if (!lines.length) {
      lines.push(this.compactJson(payload, MAX_TOOL_ARGUMENT_PREVIEW_CHARS) ?? method);
    }

    return lines.join('\n\n');
  }

  private isActiveWithoutApproval(event: CodexEvent): boolean {
    const payload = event.payload ?? {};
    const status = payload.status as { type?: unknown; activeFlags?: unknown } | undefined;
    const activeFlags = Array.isArray(status?.activeFlags) ? status.activeFlags : [];
    return status?.type === 'active' && !activeFlags.includes('waitingOnApproval');
  }

  private buildOrchestratorEvent(phase: string, payload: Record<string, unknown>): CodexEvent {
    return {
      event: 'notification',
      timestamp: new Date(),
      payload: {
        source: 'orchestrator',
        phase,
        ...payload,
      },
    };
  }

  private createWorkerDesignation(issue: Issue, attempt: number | null): WorkerDesignation {
    this.workerRunSequence += 1;
    const runNumber = this.workerRunSequence;

    // Symphony owns the designation because it owns issue dispatch. The model
    // should not invent its own identity; it receives this callsign so humans
    // can connect dashboard rows, logs, prompts, and Linear updates.
    return {
      designation: buildWorkerDesignationLabel(issue.identifier, runNumber),
      runNumber,
      attempt,
      issueIdentifier: issue.identifier,
      workspacePath: null,
      threadId: null,
      // Record the model policy at assignment time. If WORKFLOW.md reloads
      // later, existing worker rows still explain what that foreman was asked
      // to use when it started.
      model: this.config?.codex.model ?? null,
      reasoningEffort: this.config?.codex.reasoningEffort ?? null,
      startedAt: new Date(),
    };
  }

  private serializeWorkerDesignation(worker: WorkerDesignation | null): Record<string, unknown> | null {
    return serializeWorkerDesignation(worker);
  }

  private writeWorkerMarker(
    worker: WorkerDesignation,
    workspacePath: string | null,
    threadId?: string | null
  ): void {
    if (!workspacePath) return;

    worker.workspacePath = workspacePath;
    if (threadId !== undefined) worker.threadId = threadId;

    const marker = {
      ...this.serializeWorkerDesignation(worker),
      purpose: 'Local Symphony worker identity for this issue workspace.',
    };

    try {
      writeFileSync(
        join(workspacePath, '.symphony-worker.json'),
        `${JSON.stringify(marker, null, 2)}\n`,
        'utf8'
      );
    } catch (err) {
      this.log.warn('Failed to write worker designation marker', {
        workerDesignation: worker.designation,
        workspacePath,
        error: (err as Error).message,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Human-readable issue inspection helpers
  // -------------------------------------------------------------------------
  // These helpers intentionally keep only small, bounded summaries. Symphony
  // workspaces can contain full repos, so the dashboard should explain recent
  // activity without trying to become a file browser.
  private serializeCodexEvents(events: CodexEvent[]): Record<string, unknown>[] {
    return events.slice(-MAX_RECENT_CODEX_EVENTS).map(event => ({
      event: event.event,
      timestamp: event.timestamp.toISOString(),
      payload_preview: JSON.stringify(event.payload ?? {}).slice(0, 500),
      usage: event.usage ?? null,
    }));
  }

  private buildActivityFeed(events: CodexEvent[]): ActivityEntry[] {
    const entries: ActivityEntry[] = [];
    const messageBuffers = new Map<string, ActivityEntry>();

    for (const event of events) {
      const payload = event.payload ?? {};
      const item = payload.item as Record<string, unknown> | undefined;
      const itemType = item?.type ? String(item.type) : null;
      const timestamp = event.timestamp.toISOString();

      if (payload.source === 'orchestrator') {
        entries.push(this.activityEntry(timestamp, 'lifecycle',
          this.titleForOrchestratorPhase(String(payload.phase ?? 'event')),
          this.describeOrchestratorPhase(payload),
          null,
          'orchestrator'));
        continue;
      }

      if (event.event === 'approval_auto_approved' && payload.auto_approved === true) {
        const readableToolCall = itemType === 'mcpToolCall'
          ? this.describeMcpToolCall(
            this.compactText(item?.server) ?? 'MCP',
            this.compactText(item?.tool) ?? 'tool call',
            item?.arguments
          )
          : null;

        // Auto-approval should be visible even though it does not block the
        // worker. This tells the operator "Symphony posted a routine Linear
        // status comment because WORKFLOW.md allowed it" instead of making the
        // action disappear from the audit trail.
        entries.push(this.activityEntry(timestamp, 'approval',
          `Auto-approved routine action: ${readableToolCall?.title ?? this.compactText(payload.auto_approved_tool) ?? 'app tool'}`,
          readableToolCall?.detail ?? this.compactJson(payload, MAX_TOOL_ARGUMENT_PREVIEW_CHARS),
          'auto-approved',
          this.compactText(payload.auto_approved_tool) ?? itemType));
        continue;
      }

      const approvalSummary = this.extractApprovalSummary(event);
      if (approvalSummary) {
        const pendingApproval = this.extractPendingApproval(event);
        entries.push(this.activityEntry(timestamp, 'approval', approvalSummary,
          pendingApproval?.detail ?? 'The worker paused before completing this action.',
          pendingApproval?.canRespond ? 'waiting' : 'waiting-view-only',
          pendingApproval?.method ?? itemType));
        continue;
      }

      if (itemType === 'agentMessage') {
        const text = this.compactText(item?.text);
        if (text) {
          entries.push(this.activityEntry(timestamp, 'assistant_message', 'Agent message',
            text, this.compactText(item?.phase), itemType));
        }
        continue;
      }

      if (itemType === 'reasoning') {
        const summary = this.compactReasoningSummary(item?.summary);
        if (summary) {
          entries.push(this.activityEntry(timestamp, 'reasoning_summary', 'Reasoning summary',
            summary, this.compactText(item?.status), itemType));
        }
        continue;
      }

      if (itemType === 'mcpToolCall') {
        const server = this.compactText(item?.server) ?? 'MCP';
        const tool = this.compactText(item?.tool) ?? 'tool call';
        const readableToolCall = this.describeMcpToolCall(server, tool, item?.arguments);
        entries.push(this.activityEntry(timestamp, 'tool_call', readableToolCall.title,
          readableToolCall.detail, this.compactText(item?.status), itemType));
        continue;
      }

      if (itemType === 'commandExecution') {
        const command = this.compactText(item?.command) ?? 'Command';
        const cwd = this.compactText(item?.cwd);
        entries.push(this.activityEntry(timestamp, 'command', command,
          cwd ? `cwd: ${cwd}` : null, this.compactText(item?.status), itemType));
        continue;
      }

      if (typeof payload.diff === 'string') {
        entries.push(this.activityEntry(timestamp, 'file_change', 'File diff emitted',
          payload.diff.slice(0, 1200), null, 'diff'));
        continue;
      }

      if (payload.tokenUsage) {
        entries.push(this.activityEntry(timestamp, 'usage', 'Token usage updated',
          this.describeTokenUsage(payload.tokenUsage), null, 'tokenUsage'));
        continue;
      }

      if (payload.rateLimits) {
        entries.push(this.activityEntry(timestamp, 'usage', 'Rate limit status updated',
          this.describeRateLimits(payload.rateLimits), null, 'rateLimits'));
        continue;
      }

      if (payload.status) {
        entries.push(this.activityEntry(timestamp, 'status', 'Worker status updated',
          this.compactJson(payload.status, 500), null, 'status'));
        continue;
      }

      if (payload.turn && typeof payload.turn === 'object') {
        const turn = payload.turn as Record<string, unknown>;
        const status = this.compactText(turn.status);
        const turnId = this.compactText(turn.id);
        entries.push(this.activityEntry(timestamp, 'result', 'Turn result',
          turnId ? `turn: ${turnId}` : this.compactJson(turn, 500), status, 'turn'));
        continue;
      }

      if (typeof payload.delta === 'string') {
        if (!this.compactText(payload.delta)) continue;
        const itemId = this.compactText(payload.itemId) ?? 'stream';
        const existing = messageBuffers.get(itemId);
        if (existing) {
          existing.detail = `${existing.detail ?? ''}${payload.delta}`.slice(-2000);
          existing.timestamp = timestamp;
        } else {
          const entry = this.activityEntry(timestamp, 'assistant_message', 'Streaming text',
            payload.delta, null, 'delta');
          messageBuffers.set(itemId, entry);
          entries.push(entry);
        }
      }
    }

    return entries
      .filter(entry => entry.detail !== '')
      .slice(-MAX_ACTIVITY_ENTRIES);
  }

  private readableLastMessage(event: CodexEvent): string | null {
    const payload = event.payload ?? {};
    const item = payload.item as Record<string, unknown> | undefined;
    const itemType = item?.type ? String(item.type) : null;

    if (payload.source === 'orchestrator') {
      return this.describeOrchestratorPhase(payload);
    }

    if (itemType === 'agentMessage') {
      return this.compactText(item?.text);
    }

    if (itemType === 'mcpToolCall') {
      const server = this.compactText(item?.server) ?? 'MCP';
      const tool = this.compactText(item?.tool) ?? 'tool call';
      const status = this.compactText(item?.status);
      return status ? `${server}.${tool} ${status}` : `${server}.${tool}`;
    }

    if (itemType === 'commandExecution') {
      const status = this.compactText(item?.status);
      const command = this.compactText(item?.command) ?? 'command';
      return status ? `Command ${status}: ${command}` : `Command: ${command}`;
    }

    if (typeof payload.delta === 'string') {
      return this.compactText(payload.delta);
    }

    if (payload.turn && typeof payload.turn === 'object') {
      const turn = payload.turn as Record<string, unknown>;
      const status = this.compactText(turn.status);
      return status ? `Turn ${status}` : 'Turn updated';
    }

    if (payload.status) {
      return this.describeWorkerStatus(payload.status);
    }

    // Token and rate-limit updates are still visible in the activity feed, but
    // they should not replace the worker's last meaningful message.
    return null;
  }

  private describeMcpToolCall(
    server: string,
    tool: string,
    args: unknown
  ): { title: string; detail: string | null } {
    if (server === 'codex_apps' && tool === 'linear_save_comment' && args && typeof args === 'object') {
      const record = args as Record<string, unknown>;
      const issueId = this.compactText(record.issueId) ?? this.compactText(record.issueIdentifier) ?? 'unknown issue';
      const body = this.compactText(record.body) ?? '';

      // Linear comment approvals are one of the most common foreman actions.
      // Show the exact issue and comment body in plain language so the operator
      // can decide whether the worker should post it without decoding JSON.
      return {
        title: 'Post Linear comment',
        detail: [
          `Issue: ${issueId}`,
          body ? `Comment body:\n${body}` : 'Comment body: empty',
        ].join('\n\n'),
      };
    }

    if (server === 'codex_apps' && tool.startsWith('linear_') && args && typeof args === 'object') {
      const record = args as Record<string, unknown>;
      const issueId = this.compactText(record.issueId) ?? this.compactText(record.issueIdentifier);
      const detail = [
        issueId ? `Issue: ${issueId}` : null,
        this.compactJson(args, MAX_TOOL_ARGUMENT_PREVIEW_CHARS),
      ].filter((part): part is string => Boolean(part)).join('\n\n');

      // Unknown Linear tools still get a clearer title than the raw protocol
      // name, while retaining the structured payload for debugging.
      return {
        title: `Linear ${tool.replace(/^linear_/, '').replace(/_/g, ' ')}`,
        detail,
      };
    }

    // Approval decisions need enough context for a human to understand the
    // action being requested. Tool arguments can be longer than ordinary log
    // lines, so keep a larger bounded preview here while still avoiding
    // unbounded dashboard payloads.
    return {
      title: `${server}.${tool}`,
      detail: this.compactJson(args, MAX_TOOL_ARGUMENT_PREVIEW_CHARS),
    };
  }

  private describeWorkerStatus(value: unknown): string | null {
    if (!value || typeof value !== 'object') return null;
    const status = value as Record<string, unknown>;
    const type = this.compactText(status.type);
    const flags = Array.isArray(status.activeFlags)
      ? status.activeFlags.map(flag => String(flag)).join(', ')
      : '';

    if (type && flags) return `Worker ${type}: ${flags}`;
    if (type) return `Worker ${type}`;
    if (flags) return `Worker flags: ${flags}`;
    return null;
  }

  private describeTokenUsage(value: unknown): string {
    const usage = this.asRecord(value);
    const total = this.asRecord(usage?.total);
    const last = this.asRecord(usage?.last);
    const totalTokens = this.numberish(total?.totalTokens ?? total?.total_tokens);
    const lastTokens = this.numberish(last?.totalTokens ?? last?.total_tokens);
    const reasoningTokens = this.numberish(last?.reasoningOutputTokens ?? last?.reasoning_output_tokens);

    const parts = [
      totalTokens !== null ? `Total tokens: ${totalTokens.toLocaleString()}` : null,
      lastTokens !== null ? `Last turn: ${lastTokens.toLocaleString()}` : null,
      reasoningTokens !== null ? `Reasoning: ${reasoningTokens.toLocaleString()}` : null,
    ].filter(Boolean);

    return parts.length ? parts.join('\n') : (this.compactJson(value, 700) ?? 'Token usage updated');
  }

  private describeRateLimits(value: unknown): string {
    const limits = this.asRecord(value);
    const primary = this.asRecord(limits?.primary);
    const secondary = this.asRecord(limits?.secondary);
    const credits = this.asRecord(limits?.credits);
    const primaryPercent = this.numberish(primary?.usedPercent ?? primary?.used_percent);
    const secondaryPercent = this.numberish(secondary?.usedPercent ?? secondary?.used_percent);
    const planType = this.compactText(limits?.planType ?? limits?.plan_type);
    const creditsUsed = this.numberish(
      credits?.usedUsd ?? credits?.used_usd ?? credits?.used ?? credits?.consumedUsd ?? credits?.consumed_usd
    );
    const creditsRemaining = this.numberish(
      credits?.remainingUsd ?? credits?.remaining_usd ?? credits?.remaining ?? credits?.balanceUsd ?? credits?.balance_usd
    );

    const parts = [
      primaryPercent !== null ? `Primary window used: ${primaryPercent}%` : null,
      secondaryPercent !== null ? `Weekly window used: ${secondaryPercent}%` : null,
      planType ? `Plan: ${planType}` : null,
      // Keep spending visible in the retained activity feed, not only in the
      // raw state.rate_limits object. If a later dashboard refresh only has
      // issue activity to parse, it should still show the operator credit
      // pressure instead of silently degrading to percentage bars.
      creditsUsed !== null ? `Credits used: $${creditsUsed.toFixed(2)}` : null,
      creditsRemaining !== null ? `Credits remaining: $${creditsRemaining.toFixed(2)}` : null,
    ].filter(Boolean);

    return parts.length ? parts.join('\n') : (this.compactJson(value, 700) ?? 'Rate limit status updated');
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? value as Record<string, unknown> : null;
  }

  private numberish(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private activityEntry(
    timestamp: string,
    kind: ActivityEntry['kind'],
    title: string,
    detail: string | null,
    status?: string | null,
    sourceType?: string | null
  ): ActivityEntry {
    return {
      timestamp,
      kind,
      title,
      detail,
      status,
      source_type: sourceType,
    };
  }

  private titleForOrchestratorPhase(phase: string): string {
    if (phase === 'workspace_ready') return 'Workspace ready';
    if (phase === 'session_started') return 'Codex session started';
    if (phase === 'turn_started') return 'Turn started';
    if (phase === 'approval_decision_sent') return 'Approval decision sent';
    return `Orchestrator: ${phase}`;
  }

  private describeOrchestratorPhase(payload: Record<string, unknown>): string | null {
    const workerText = typeof payload.workerDesignation === 'string'
      ? `Worker: ${payload.workerDesignation}`
      : null;

    if (payload.phase === 'approval_decision_sent') {
      const decisionText = payload.decision === 'approve' ? 'Decision: approved' : 'Decision: denied';
      const actionText = typeof payload.approvalTitle === 'string'
        ? `Pending action: ${payload.approvalTitle}`
        : null;
      const methodText = typeof payload.approvalMethod === 'string'
        ? `Method: ${payload.approvalMethod}`
        : null;

      return [decisionText, actionText, methodText, workerText].filter(Boolean).join('\n');
    }

    if (typeof payload.workspacePath === 'string') {
      return [workerText, payload.workspacePath].filter(Boolean).join('\n');
    }

    if (typeof payload.turnNumber === 'number') {
      return [workerText, `Turn ${payload.turnNumber} of ${String(payload.maxTurns ?? '?')}`]
        .filter(Boolean)
        .join('\n');
    }

    if (workerText) return workerText;
    return null;
  }

  private compactText(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    return text.length > 0 ? text : null;
  }

  private compactJson(value: unknown, maxLength: number): string | null {
    if (value === undefined || value === null) return null;
    const serialized = JSON.stringify(value, null, 2);

    // Approval review is a human safety surface, especially for Linear comment
    // tools that may contain the full message a worker wants to post. Keep the
    // payload readable and make any remaining size cutoff explicit instead of
    // silently ending mid-sentence.
    if (serialized.length <= maxLength) {
      return serialized;
    }

    return `${serialized.slice(0, maxLength)}\n...[truncated ${serialized.length - maxLength} more character(s)]`;
  }

  private compactReasoningSummary(value: unknown): string | null {
    if (!Array.isArray(value)) return this.compactText(value);
    const parts = value
      .map(part => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as { text: unknown }).text);
        }
        return null;
      })
      .filter((part): part is string => Boolean(part?.trim()));
    return parts.length > 0 ? parts.join('\n') : null;
  }

  private listRecentWorkspaceFiles(workspacePath: string | null): Record<string, unknown>[] {
    if (!workspacePath) return [];

    const files: { path: string; size: number; modifiedAt: Date }[] = [];
    const pending: string[] = [workspacePath];

    while (pending.length > 0 && files.length < 500) {
      const dir = pending.shift()!;
      let entries: string[];

      try {
        entries = readdirSync(dir);
      } catch {
        continue;
      }

      for (const entryName of entries) {
        const fullPath = join(dir, entryName);

        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            pending.push(fullPath);
          } else if (stat.isFile()) {
            files.push({
              path: relative(workspacePath, fullPath),
              size: stat.size,
              modifiedAt: stat.mtime,
            });
          }
        } catch {
          continue;
        }
      }
    }

    return files
      .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime())
      .slice(0, MAX_WORKSPACE_FILES)
      .map(file => ({
        path: file.path,
        size_bytes: file.size,
        modified_at: file.modifiedAt.toISOString(),
      }));
  }

  // -------------------------------------------------------------------------
  // Startup cleanup (Section 8.6)
  // -------------------------------------------------------------------------
  private async startupCleanup(): Promise<void> {
    try {
      const terminalIssues = await this.trackerClient!.fetchTerminalIssues();
      for (const issue of terminalIssues) {
        await this.workspaceManager!.removeWorkspace(issue.identifier).catch(() => {});
      }
      this.log.info('Startup cleanup completed', { cleaned: terminalIssues.length });
    } catch (err) {
      this.log.warn('Startup cleanup failed (continuing anyway)', {
        error: (err as Error).message,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Workflow reload (Section 6.2)
  // -------------------------------------------------------------------------
  private async reloadWorkflow(): Promise<void> {
    try {
      this.workflow = await loadWorkflow(this.workflowPath);
      const workflowDir = dirname(this.workflowPath);
      this.config = resolveConfig(this.workflow.config, workflowDir);

      // Update live components
      this.state.pollIntervalMs = this.config.polling.intervalMs;
      this.state.maxConcurrentAgents = this.config.agent.maxConcurrentAgents;

      if (this.trackerClient instanceof MockClient && this.config.tracker.kind === 'mock') {
        this.trackerClient.updateConfig({
          activeStates: this.config.tracker.activeStates,
          terminalStates: this.config.tracker.terminalStates,
        });
      } else if (this.trackerClient instanceof LinearClient && this.config.tracker.kind === 'linear') {
        this.trackerClient.updateConfig({
          endpoint: this.config.tracker.endpoint,
          apiKey: this.config.tracker.apiKey,
          projectSlug: this.config.tracker.projectSlug,
          activeStates: this.config.tracker.activeStates,
          terminalStates: this.config.tracker.terminalStates,
        });
      }
      this.workspaceManager?.updateConfig(this.config);
      this.agentRunner?.updateConfig(this.config);

      this.log.info('Workflow reloaded successfully');
    } catch (err) {
      this.log.error('Workflow reload failed, keeping last good config', {
        error: (err as Error).message,
      });
      // Keep running with last known good config (Section 6.2)
    }
  }

  private startWorkflowWatch(): void {
    const watcher = watch(this.workflowPath, { ignoreInitial: true });
    watcher.on('change', () => {
      this.log.info('WORKFLOW.md changed, reloading');
      this.reloadWorkflow().catch(() => {});
    });
  }

  // -------------------------------------------------------------------------
  // Tick scheduling
  // -------------------------------------------------------------------------
  private scheduleTick(delayMs: number): void {
    if (!this.running) return;
    if (!this.dispatchEnabled) return;

    if (this.tickTimer) {
      clearTimeout(this.tickTimer);
      this.tickTimer = null;
    }

    this.tickTimer = setTimeout(() => this.onTick().catch(err => {
      this.log.error('Tick failed', { error: (err as Error).message });
      this.scheduleTick(this.state.pollIntervalMs);
    }), delayMs);
  }

  // -------------------------------------------------------------------------
  // Runtime snapshot (Section 13.3)
  // -------------------------------------------------------------------------
  getSnapshot(): Record<string, unknown> {
    const now = Date.now();
    const running = [...this.state.running.entries()].map(([id, e]) => ({
      latest_activity: this.buildActivityFeed(e.recentCodexEvents).at(-1) ?? null,
      issue_id: id,
      issue_identifier: e.identifier,
      worker: this.serializeWorkerDesignation(e.workerDesignation),
      worker_designation: e.workerDesignation.designation,
      state: e.issue.state,
      session_id: e.sessionId,
      turn_count: e.turnCount,
      last_event: e.lastCodexEvent,
      last_message: e.lastCodexMessage ?? '',
      last_message_at: e.lastReadableCodexTimestamp?.toISOString() ?? null,
      started_at: e.startedAt.toISOString(),
      last_event_at: e.lastCodexTimestamp?.toISOString() ?? null,
      last_activity_age_ms: now - (e.lastCodexTimestamp ?? e.startedAt).getTime(),
      workspace_path: e.workspacePath ?? this.workspaceManager?.getWorkspacePath(e.identifier) ?? null,
      recent_event_count: e.recentCodexEvents.length,
      last_error: e.lastError,
      waiting_on_approval: e.waitingOnApproval,
      approval_summary: e.approvalSummary,
      pending_approval: this.serializePendingApproval(e.pendingApproval),
      detail_url: `/api/v1/${encodeURIComponent(e.identifier)}`,
      tokens: {
        input_tokens: e.codexInputTokens,
        output_tokens: e.codexOutputTokens,
        total_tokens: e.codexTotalTokens,
      },
    }));

    const retrying = [...this.state.retryAttempts.values()].map(r => ({
      latest_activity: this.buildActivityFeed(r.recentCodexEvents).at(-1) ?? null,
      issue_id: r.issueId,
      issue_identifier: r.identifier,
      worker: this.serializeWorkerDesignation(r.workerDesignation),
      worker_designation: r.workerDesignation?.designation ?? null,
      attempt: r.attempt,
      due_at: new Date(r.dueAtMs).toISOString(),
      error: r.error,
      workspace_path: r.workspacePath,
      last_event: r.lastCodexEvent,
      last_message: r.lastCodexMessage ?? '',
      last_message_at: r.lastReadableCodexTimestamp?.toISOString() ?? null,
      last_event_at: r.lastCodexTimestamp?.toISOString() ?? null,
      recent_event_count: r.recentCodexEvents.length,
      waiting_on_approval: r.waitingOnApproval,
      approval_summary: r.approvalSummary,
      pending_approval: this.serializePendingApproval(r.pendingApproval),
      detail_url: `/api/v1/${encodeURIComponent(r.identifier)}`,
    }));

    // Compute live aggregate runtime
    let liveSeconds = this.state.codexTotals.secondsRunning;
    for (const [, e] of this.state.running) {
      liveSeconds += (now - e.startedAt.getTime()) / 1000;
    }

    return {
      generated_at: new Date().toISOString(),
      dashboard: {
        base_url: this.getDashboardBaseUrl(),
        state_url: `${this.getDashboardBaseUrl()}/api/v1/state`,
        events_url: `${this.getDashboardBaseUrl()}/api/v1/events`,
        dispatch_control_url: `${this.getDashboardBaseUrl()}/api/v1/dispatch-control`,
        // Workers receive /api/v1/state in their prompt, but the state payload
        // should also advertise the dashboard control endpoints they can use
        // as foremen. This avoids URL guessing when a worker needs to inspect
        // task drafts, recheck GitHub sync, or refresh Jules handoffs.
        task_drafts_url: `${this.getDashboardBaseUrl()}/api/v1/task-drafts`,
        git_preflight_url: `${this.getDashboardBaseUrl()}/api/v1/git-preflight`,
        jules_refresh_all_url: `${this.getDashboardBaseUrl()}/api/v1/jules-handoffs/refresh-all`,
      },
      dispatch_control: this.getDispatchControl(),
      counts: {
        running: running.length,
        retrying: retrying.length,
        completed_since_start: this.state.completed.size,
      },
      worker_roster: this.buildWorkerRoster(),
      running,
      retrying,
      codex_totals: {
        input_tokens: this.state.codexTotals.inputTokens,
        output_tokens: this.state.codexTotals.outputTokens,
        total_tokens: this.state.codexTotals.totalTokens,
        seconds_running: Math.round(liveSeconds * 10) / 10,
      },
      codex_policy: {
        // Expose the approval policy so the dashboard can explain why routine
        // foreman status comments can pass automatically while broader tool
        // calls still pause for the operator.
        model: this.config!.codex.model,
        reasoning_effort: this.config!.codex.reasoningEffort,
        approval_policy: this.config!.codex.approvalPolicy,
        auto_approve_app_tools: this.config!.codex.autoApproveAppTools,
      },
      rate_limits: this.state.codexRateLimits,
    };
  }

  private buildWorkerRoster(): Record<string, unknown>[] {
    const roster: Record<string, unknown>[] = [];

    // The running and retrying tables are optimized for issue status. This
    // roster is optimized for the multi-agent question "who is worker X and
    // where is it operating?" so operators and headless foremen can reason
    // about assignments without reconstructing identity from several fields.
    for (const [, entry] of this.state.running) {
      roster.push({
        ...this.serializeWorkerDesignation(entry.workerDesignation),
        status: 'running',
        issue_identifier: entry.identifier,
        issue_id: entry.issue.id,
        workspace_path: entry.workspacePath ?? entry.workerDesignation.workspacePath,
        thread_id: entry.workerDesignation.threadId,
        last_activity_at: (entry.lastCodexTimestamp ?? entry.startedAt).toISOString(),
        waiting_on_approval: entry.waitingOnApproval,
        approval_summary: entry.approvalSummary,
        pending_approval: this.serializePendingApproval(entry.pendingApproval),
        detail_url: `/api/v1/${encodeURIComponent(entry.identifier)}`,
      });
    }

    for (const entry of this.state.retryAttempts.values()) {
      if (!entry.workerDesignation) {
        roster.push({
          designation: null,
          status: 'retrying',
          issue_identifier: entry.identifier,
          issue_id: entry.issueId,
          workspace_path: entry.workspacePath,
          thread_id: null,
          last_activity_at: entry.lastCodexTimestamp?.toISOString() ?? null,
          waiting_on_approval: entry.waitingOnApproval,
          approval_summary: entry.approvalSummary,
          pending_approval: this.serializePendingApproval(entry.pendingApproval),
          detail_url: `/api/v1/${encodeURIComponent(entry.identifier)}`,
        });
        continue;
      }

      roster.push({
        ...this.serializeWorkerDesignation(entry.workerDesignation),
        status: 'retrying',
        issue_identifier: entry.identifier,
        issue_id: entry.issueId,
        workspace_path: entry.workspacePath ?? entry.workerDesignation.workspacePath,
        thread_id: entry.workerDesignation.threadId,
        last_activity_at: entry.lastCodexTimestamp?.toISOString() ?? null,
        waiting_on_approval: entry.waitingOnApproval,
        approval_summary: entry.approvalSummary,
        pending_approval: this.serializePendingApproval(entry.pendingApproval),
        detail_url: `/api/v1/${encodeURIComponent(entry.identifier)}`,
      });
    }

    return roster;
  }

  // -------------------------------------------------------------------------
  // Refresh cycle trigger (Section 13.7.2)
  // -------------------------------------------------------------------------
  async refresh(): Promise<void> {
    this.log.info('Manual refresh triggered');
    if (!this.dispatchEnabled) {
      // In dashboard-only mode, Refresh should keep the browser responsive
      // without secretly starting the worker loop the operator opted out of.
      this.log.info('Manual refresh skipped because dashboard-only mode disables dispatch');
      return;
    }
    // We can clear the timeout and immediately run tick
    if (this.tickTimer) {
      clearTimeout(this.tickTimer);
      this.tickTimer = null;
    }
    await this.onTick();
  }

  resolveApproval(
    identifier: string,
    decision: 'approve' | 'deny'
  ): { ok: boolean; message: string } {
    const runningEntry = [...this.state.running.values()].find(e => e.identifier === identifier);
    if (!runningEntry) {
      return { ok: false, message: `No running worker found for ${identifier}.` };
    }

    const approval = runningEntry.pendingApproval;
    if (!approval) {
      return { ok: false, message: `No pending approval found for ${identifier}.` };
    }

    if (!approval.canRespond) {
      return {
        ok: false,
        message: `Symphony can display ${approval.method}, but it does not know how to answer it safely yet.`,
      };
    }

    const session = this.activeSessions.get(runningEntry.issue.id);
    if (!session) {
      return { ok: false, message: `No live Codex app-server session is attached to ${identifier}.` };
    }

    this.agentRunner!.resolveApproval(session, approval, decision);

    // Keep the dashboard responsive immediately. The app-server should later
    // emit its own resolved/active event, but the operator needs confirmation
    // that their click was sent to the live worker.
    this.handleCodexEvent(runningEntry.issue.id, this.buildOrchestratorEvent('approval_decision_sent', {
      decision,
      approvalTitle: approval.title,
      approvalMethod: approval.method,
      workerDesignation: runningEntry.workerDesignation.designation,
    }));
    runningEntry.waitingOnApproval = false;
    runningEntry.approvalSummary = null;
    runningEntry.pendingApproval = null;
    runningEntry.lastCodexMessage =
      decision === 'approve' ? 'Approval sent: approved.' : 'Approval sent: denied.';
    runningEntry.lastReadableCodexTimestamp = new Date();
    runningEntry.lastCodexTimestamp = runningEntry.lastReadableCodexTimestamp;

    return { ok: true, message: `Sent ${decision} decision to ${identifier}.` };
  }

  // -------------------------------------------------------------------------
  // Issue snapshot for HTTP server (Section 13.7.2)
  // -------------------------------------------------------------------------
  getIssueDetails(identifier: string): Record<string, unknown> | null {
    // Try to find in running
    const runningEntry = [...this.state.running.values()].find(e => e.identifier === identifier);
    if (runningEntry) {
      const workspacePath =
        runningEntry.workspacePath ?? this.workspaceManager?.getWorkspacePath(runningEntry.identifier) ?? null;
      const lastActivity = runningEntry.lastCodexTimestamp ?? runningEntry.startedAt;
      return {
        issue_identifier: runningEntry.identifier,
        issue_id: runningEntry.issue.id,
        worker: this.serializeWorkerDesignation(runningEntry.workerDesignation),
        worker_designation: runningEntry.workerDesignation.designation,
        status: 'running',
        workspace: {
          path: workspacePath,
          recent_files: this.listRecentWorkspaceFiles(workspacePath)
        },
        attempts: {
          restart_count: 0,
          current_retry_attempt: runningEntry.retryAttempt
        },
        running: {
          worker_designation: runningEntry.workerDesignation.designation,
          session_id: runningEntry.sessionId,
          turn_count: runningEntry.turnCount,
          state: runningEntry.issue.state,
          started_at: runningEntry.startedAt.toISOString(),
          last_event: runningEntry.lastCodexEvent,
          last_message: runningEntry.lastCodexMessage ?? '',
          last_message_at: runningEntry.lastReadableCodexTimestamp?.toISOString() ?? null,
          last_event_at: runningEntry.lastCodexTimestamp?.toISOString() ?? null,
          last_activity_age_ms: Date.now() - lastActivity.getTime(),
          waiting_on_approval: runningEntry.waitingOnApproval,
          approval_summary: runningEntry.approvalSummary,
          pending_approval: this.serializePendingApproval(runningEntry.pendingApproval),
          tokens: {
            input_tokens: runningEntry.codexInputTokens,
            output_tokens: runningEntry.codexOutputTokens,
            total_tokens: runningEntry.codexTotalTokens
          }
        },
        retry: null,
        logs: {
          last_message: runningEntry.lastCodexMessage ?? '',
          last_message_at: runningEntry.lastReadableCodexTimestamp?.toISOString() ?? null,
          event_count_retained: runningEntry.recentCodexEvents.length
        },
        recent_events: this.serializeCodexEvents(runningEntry.recentCodexEvents),
        activity: this.buildActivityFeed(runningEntry.recentCodexEvents),
        last_error: runningEntry.lastError,
        waiting_on_approval: runningEntry.waitingOnApproval,
        approval_summary: runningEntry.approvalSummary,
        pending_approval: this.serializePendingApproval(runningEntry.pendingApproval),
        tracked: {}
      };
    }

    // Try to find in retry
    const retryEntry = [...this.state.retryAttempts.values()].find(r => r.identifier === identifier);
    if (retryEntry) {
      const workspacePath =
        retryEntry.workspacePath ?? this.workspaceManager?.getWorkspacePath(retryEntry.identifier) ?? null;
      return {
        issue_identifier: retryEntry.identifier,
        issue_id: retryEntry.issueId,
        worker: this.serializeWorkerDesignation(retryEntry.workerDesignation),
        worker_designation: retryEntry.workerDesignation?.designation ?? null,
        status: 'retrying',
        workspace: {
          path: workspacePath,
          recent_files: this.listRecentWorkspaceFiles(workspacePath)
        },
        attempts: {
          restart_count: 0,
          current_retry_attempt: retryEntry.attempt
        },
        running: null,
        retry: {
          attempt: retryEntry.attempt,
          due_at: new Date(retryEntry.dueAtMs).toISOString(),
          error: retryEntry.error
        },
        logs: {
          last_message: retryEntry.lastCodexMessage ?? '',
          last_message_at: retryEntry.lastReadableCodexTimestamp?.toISOString() ?? null,
          event_count_retained: retryEntry.recentCodexEvents.length
        },
        recent_events: this.serializeCodexEvents(retryEntry.recentCodexEvents),
        activity: this.buildActivityFeed(retryEntry.recentCodexEvents),
        last_error: retryEntry.error,
        waiting_on_approval: retryEntry.waitingOnApproval,
        approval_summary: retryEntry.approvalSummary,
        pending_approval: this.serializePendingApproval(retryEntry.pendingApproval),
        tracked: {}
      };
    }

    return null;
  }

  getIssueActivity(identifier: string): Record<string, unknown> | null {
    const details = this.getIssueDetails(identifier);
    if (!details) return null;

    return {
      issue_identifier: details.issue_identifier,
      issue_id: details.issue_id,
      worker: details.worker,
      worker_designation: details.worker_designation,
      status: details.status,
      waiting_on_approval: details.waiting_on_approval,
      approval_summary: details.approval_summary,
      pending_approval: details.pending_approval,
      activity: details.activity,
    };
  }

  private serializePendingApproval(approval: PendingApproval | null): Record<string, unknown> | null {
    if (!approval) return null;

    return {
      request_id: approval.requestId,
      method: approval.method,
      title: approval.title,
      detail: approval.detail,
      requested_at: approval.requestedAt,
      can_respond: approval.canRespond,
    };
  }
}
