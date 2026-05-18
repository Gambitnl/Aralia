import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Orchestrator } from './orchestrator.js';
import type { Logger } from './logger.js';
import {
  buildJulesManifestPreviewFromDraft,
  TaskIntakeStore,
  type GitDispositionCategory,
  type JulesRunManifest,
  type TaskDraftSnapshot,
} from './task-intake.js';
import { LinearClient } from './linear-client.js';

type TaskConflictWatch = {
  status: 'clear' | 'attention' | 'blocked';
  summary: string;
  overlap_files: Array<{
    path: string;
    handoffs: Array<{ id: string; title: string; pull_request_url: string | null }>;
  }>;
  risk_files: Array<{
    path: string;
    handoff_id: string;
    title: string;
    pull_request_url: string | null;
    risk: 'medium' | 'high';
    reason: string | null;
  }>;
  next_action: Record<string, unknown> | null;
};

type LinearIssueCapability = {
  canCreateLinearIssue: boolean;
  requiresLinearIssueForHandoff: boolean;
  linearProjectSlug: string | null;
  linearIssueCreationBlocker: string | null;
};

type LinearIssuePreview = {
  draftId: string;
  projectSlug: string | null;
  canCreateNow: boolean;
  wouldCreateLinearIssue: boolean;
  mutatesExternalSystems: false;
  createLinearIssueUrl: string;
  blockers: string[];
  issueTitle: string;
  issueDescription: string;
  safetyNote: string;
};

type JulesManifestPreview = {
  draftId: string;
  canStageNow: boolean;
  wouldStageJulesManifest: boolean;
  mutatesLocalFiles: false;
  manifestPath: string;
  stageManifestUrl: string;
  blockers: string[];
  manifest: JulesRunManifest;
  safetyNote: string;
};

type HandoffReadinessStage = {
  id: 'git_sync' | 'linear_issue' | 'jules_manifest' | 'jules_launch' | 'first_nudge';
  label: string;
  status: 'ready' | 'waiting' | 'blocked';
  detail: string;
  endpoint: string | null;
  method: 'GET' | 'POST' | 'NONE';
  blockers: string[];
};

type HandoffPassPathAction = {
  id: 'git_sync' | 'linear_issue' | 'jules_manifest' | 'first_nudge';
  label: string;
  status: 'complete' | 'ready' | 'waiting' | 'blocked';
  canRunNow: boolean;
  method: 'GET' | 'POST' | 'NONE';
  endpoint: string | null;
  mutatesGitIfRun: boolean;
  mutatesExternalSystemsIfRun: boolean;
  mutatesLocalFilesIfRun: boolean;
  blockedBy: string[];
  expectedProof: string;
  receipt: string | null;
};

type HandoffPassPath = {
  status: 'blocked' | 'ready';
  currentBoundary: HandoffPassPathAction['id'];
  nextExpectedProof: string;
  actions: HandoffPassPathAction[];
};

type HandoffReadinessPacket = {
  draftId: string;
  title: string;
  status: 'ready' | 'blocked';
  summary: string;
  mutatesGit: false;
  mutatesExternalSystems: false;
  mutatesLocalFiles: false;
  blockers: string[];
  nextOperatorAction: {
    label: string;
    detail: string;
    method: 'GET' | 'POST' | 'NONE';
    endpoint: string | null;
  };
  links: {
    self: string;
    gitPreflight: string;
    linearIssuePreview: string;
    julesManifestPreview: string;
    taskNudge: string;
  };
  stages: HandoffReadinessStage[];
  passPath: HandoffPassPath;
  safetyNote: string;
};

type JulesLaunchReadinessPacket = {
  handoffId: string;
  title: string;
  status: 'blocked' | 'ready' | 'launched';
  canLaunchNow: boolean;
  mutatesGitIfRun: false;
  mutatesExternalSystemsIfRun: boolean;
  mutatesLocalFilesIfRun: boolean;
  launchUrl: string;
  refreshStatusUrl: string;
  launchCommand: string | null;
  statusCommand: string | null;
  recordsPath: string | null;
  manifestPath: string | null;
  base: {
    branch: string | null;
    commit: string | null;
    checkedAt: string | null;
  };
  linearIssue: {
    identifier: string | null;
    url: string | null;
  };
  sessionReceipt: {
    sessionId: string | null;
    sessionUrl: string | null;
    state: string | null;
    launchedAt: string | null;
  };
  blockers: string[];
  safetyChecklist: string[];
  expectedNextProof: string;
  safetyNote: string;
};

type LocalSyncReadinessPacket = {
  handoffId: string;
  title: string;
  status: 'waiting' | 'blocked' | 'ready' | 'current' | 'observed';
  canRefreshNow: boolean;
  canSyncNow: boolean;
  mutatesGitIfRun: boolean;
  mutatesLocalFilesIfRun: boolean;
  refreshUrl: string | null;
  syncUrl: string | null;
  pullCommand: string | null;
  pr: {
    url: string | null;
    state: string | null;
    dashboardStarted: boolean;
  };
  evidence: {
    checkedAt: string | null;
    baseBranch: string | null;
    remoteBranch: string | null;
    currentBranch: string | null;
    localCommit: string | null;
    remoteCommit: string | null;
    ahead: number | null;
    behind: number | null;
    dirtyFiles: number | null;
    untrackedFiles: number | null;
  };
  blockers: string[];
  nextAction: NonNullable<TaskDraftSnapshot['handoffs'][number]['localSyncStatus']>['nextAction'] | null;
  safetyChecklist: string[];
  expectedNextProof: string;
  safetyNote: string;
};

type ScoutCoreReadinessPacket = {
  handoffId: string;
  title: string;
  status: 'waiting' | 'blocked_by_pr' | 'blocked_by_scout' | 'ready_for_core' | 'merged' | 'observed';
  nextBoundary: 'github_pr' | 'scout_core' | 'core_merge' | 'local_sync';
  canRefreshNow: boolean;
  canScoutReviewNow: boolean;
  canCoreValidateNow: boolean;
  canCoreMergeNow: boolean;
  mutatesGitIfRun: false;
  mutatesLocalFilesIfRun: false;
  mutatesExternalSystemsIfCoreMerges: boolean;
  refreshUrl: string | null;
  scoutReviewCommand: string | null;
  coreValidationCommand: string | null;
  coreMergeCommand: string | null;
  feedbackCommand: string | null;
  pr: {
    url: string | null;
    state: string | null;
    isDraft: boolean | null;
    mergeable: string | null;
    reviewDecision: string | null;
    dashboardStarted: boolean;
    lastRefreshAt: string | null;
  };
  evidence: {
    checksConclusion: string | null;
    failedChecks: number | null;
    pendingChecks: number | null;
    fileRisk: string | null;
    riskReasons: string[];
    outOfScopeFiles: string[];
    scoutConflictComments: number;
    externalReviewComments: number;
    julesFeedbackComments: number;
  };
  blockers: string[];
  nextAction: TaskDraftSnapshot['handoffs'][number]['githubPullRequestNextAction'];
  safetyChecklist: string[];
  expectedNextProof: string;
  safetyNote: string;
};

type MiddlemanPathStage = {
  id: 'git_sync' | 'linear_issue' | 'jules_manifest' | 'jules_launch' | 'jules_session' | 'github_pr' | 'scout_core' | 'local_sync';
  label: string;
  status: 'complete' | 'ready' | 'waiting' | 'blocked' | 'active' | 'observed';
  sourceId: string | null;
  sourceTitle: string | null;
  detail: string;
  endpoint: string | null;
  method: 'GET' | 'POST' | 'NONE';
  canRunNow: boolean;
  mutatesGitIfRun: boolean;
  mutatesExternalSystemsIfRun: boolean;
  mutatesLocalFilesIfRun: boolean;
  blockedBy: string[];
  expectedProof: string;
  receipt: string | null;
};

type MiddlemanForemanAction = {
  boundary: MiddlemanPathStage['id'];
  boundaryLabel: string;
  label: string;
  status: MiddlemanPathStage['status'];
  method: 'GET' | 'POST' | 'NONE';
  endpoint: string | null;
  evidenceEndpoint: string | null;
  recordEndpoint: string | null;
  canRunNow: boolean;
  requiresOperator: boolean;
  safety: 'operator_only' | 'read_only' | 'local_state_only' | 'external_read' | 'external_write' | 'git_mutation';
  mutatesGitIfRun: boolean;
  mutatesExternalSystemsIfRun: boolean;
  mutatesLocalFilesIfRun: boolean;
  blockedReason: string | null;
  instruction: string;
  expectedProof: string;
};

type MiddlemanPathPacket = {
  status: 'blocked' | 'ready' | 'waiting' | 'active' | 'complete';
  currentBoundary: MiddlemanPathStage['id'];
  currentBoundaryLabel: string;
  summary: string;
  nextExpectedProof: string;
  foremanAction: MiddlemanForemanAction;
  stages: MiddlemanPathStage[];
  safetyNote: string;
};

type GitDispositionReviewCategory = {
  category: GitDispositionCategory;
  label: string;
  status: 'resolved' | 'missing_decision' | 'needs_review';
  currentDecision: string | null;
  currentDecisionLabel: string;
  note: string;
  evidenceCount: number;
  evidence: string[];
  sourceCandidates: number;
  generatedCandidates: number;
  allowedDecisions: string[];
  question: string;
};

type GitDispositionReviewPacket = {
  status: 'ready' | 'blocked_by_decision' | 'blocked_by_review' | 'blocked_by_preflight_error';
  generatedAt: string;
  mutatesGit: false;
  canRecordDispositions: boolean;
  recordDispositionUrl: string;
  summary: string;
  requiredCategories: GitDispositionCategory[];
  blockers: string[];
  categories: GitDispositionReviewCategory[];
  readOnlyCommands: string[];
  safetyNote: string;
};

// ============================================================================
// Local Observability Server
// ============================================================================
// This file serves the small browser dashboard and JSON API for Symphony.
// It exists so the human running the orchestrator can see whether workers are
// alive, retrying, stalled, or touching files without reading terminal logs.
// ============================================================================

export class HttpServer {
  private server: ReturnType<typeof createServer>;
  private port: number;
  private log: Logger;
  private orchestrator: Orchestrator;
  private publicDir: string;
  private taskIntake: TaskIntakeStore;

  constructor(port: number, orchestrator: Orchestrator, logger: Logger) {
    this.port = port;
    this.orchestrator = orchestrator;
    this.publicDir = resolve(process.cwd(), 'public');
    this.taskIntake = new TaskIntakeStore({
      repoRoot: resolve(process.cwd(), '..', '..'),
      storePath: resolve(process.cwd(), '.symphony', 'task-drafts.json'),
    });
    this.log = logger.child({ component: 'http_server' });

    this.server = createServer((req, res) => {
      this.handleRequest(req, res).catch(err => {
        this.log.error('HTTP server error', { error: err.message });
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { code: 'internal_error', message: err.message } }));
        }
      });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, '127.0.0.1', () => {
        const address = this.server.address();
        const actualPort = typeof address === 'object' && address !== null ? address.port : this.port;
        this.log.info('HTTP server listening', { port: actualPort });
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) reject(err);
        else {
          this.log.info('HTTP server stopped');
          resolve();
        }
      });
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (method === 'GET' && pathname === '/') {
      return this.handleStaticFile(res, 'dashboard.html', 'text/html; charset=utf-8');
    }

    if (method === 'GET' && pathname === '/proof') {
      return this.handleProofBoard(res);
    }

    if (method === 'GET' && pathname === '/dashboard.css') {
      return this.handleStaticFile(res, 'dashboard.css', 'text/css; charset=utf-8');
    }

    if (method === 'GET' && pathname === '/dashboard.js') {
      return this.handleStaticFile(res, 'dashboard.js', 'text/javascript; charset=utf-8');
    }

    if (method === 'GET' && pathname === '/api/v1/state') {
      return this.handleGetState(res);
    }

    if (method === 'GET' && pathname === '/api/v1/dispatch-control') {
      return this.handleGetDispatchControl(res);
    }

    if (method === 'POST' && pathname === '/api/v1/dispatch-control') {
      return this.handleSetDispatchControl(req, res);
    }

    if (method === 'GET' && pathname === '/api/v1/dashboard-fragment') {
      return this.handleDashboardFragment(res);
    }

    if (method === 'GET' && pathname === '/api/v1/events') {
      return this.handleDashboardEvents(req, res);
    }

    if (method === 'GET' && pathname === '/api/v1/task-drafts') {
      return this.handleGetTaskDrafts(res);
    }

    if (method === 'GET' && pathname.startsWith('/api/v1/task-drafts/')) {
      const parts = pathname.split('/');
      if (parts.length === 6 && parts[5] === 'linear-preview') {
        return this.handleGetLinearIssuePreview(parts[4], res);
      }
      if (parts.length === 6 && parts[5] === 'jules-manifest-preview') {
        return this.handleGetJulesManifestPreview(parts[4], res);
      }
      if (parts.length === 6 && parts[5] === 'handoff-readiness') {
        return this.handleGetHandoffReadiness(parts[4], res);
      }
    }

    if (method === 'GET' && pathname.startsWith('/api/v1/jules-handoffs/')) {
      const parts = pathname.split('/');
      if (parts.length === 6 && parts[5] === 'launch-readiness') {
        return this.handleGetJulesLaunchReadiness(parts[4], res);
      }
    }

    if (method === 'POST' && pathname === '/api/v1/task-drafts') {
      return this.handleCreateTaskDraft(req, res);
    }

    if (method === 'POST' && pathname === '/api/v1/observed-prs') {
      return this.handleWatchObservedPullRequest(req, res);
    }

    if (method === 'POST' && pathname.startsWith('/api/v1/task-drafts/')) {
      const parts = pathname.split('/');
      if (parts.length === 6 && parts[5] === 'promote') {
        return this.handlePromoteTaskDraft(parts[4], res);
      }
      if (parts.length === 6 && parts[5] === 'create-linear') {
        return this.handleCreateLinearTaskIssue(parts[4], res);
      }
    }

    if (method === 'POST' && pathname.startsWith('/api/v1/jules-handoffs/')) {
      const parts = pathname.split('/');
      if (parts.length === 5 && parts[4] === 'refresh-all') {
        return this.handleRefreshAllJulesHandoffs(res);
      }
      if (parts.length === 6 && parts[5] === 'stage-manifest') {
        return this.handleStageJulesManifest(parts[4], res);
      }
      if (parts.length === 6 && parts[5] === 'launch') {
        return this.handleLaunchJulesHandoff(parts[4], res);
      }
      if (parts.length === 6 && parts[5] === 'refresh-status') {
        return this.handleRefreshJulesHandoff(parts[4], res);
      }
      if (parts.length === 6 && parts[5] === 'message') {
        return this.handleJulesOperatorMessage(parts[4], req, res);
      }
      if (parts.length === 6 && parts[5] === 'approve-plan') {
        return this.handleJulesPlanApproval(parts[4], res);
      }
      if (parts.length === 6 && parts[5] === 'refresh-pr') {
        return this.handleRefreshJulesPullRequest(parts[4], res);
      }
      if (parts.length === 6 && parts[5] === 'create-follow-up-draft') {
        return this.handleCreateObservedPullRequestFollowUp(parts[4], req, res);
      }
      if (parts.length === 6 && parts[5] === 'refresh-local-sync') {
        return this.handleRefreshLocalSync(parts[4], res);
      }
      if (parts.length === 6 && parts[5] === 'sync-local') {
        return this.handleSyncLocalMaster(parts[4], res);
      }
    }

    if (method === 'POST' && pathname === '/api/v1/git-preflight') {
      return this.handleGitPreflight(res);
    }

    if (method === 'GET' && pathname === '/api/v1/git-disposition/review') {
      return this.handleGitDispositionReview(res);
    }

    if (method === 'POST' && pathname === '/api/v1/git-disposition') {
      return this.handleGitDisposition(req, res);
    }

    if (method === 'POST' && pathname === '/api/v1/task-nudges') {
      return this.handleTaskNudge(req, res);
    }

    if (method === 'POST' && pathname === '/api/v1/task-nudges/refresh-due') {
      return this.handleRefreshDueTaskNudges(res);
    }

    if (method === 'POST' && pathname === '/api/v1/refresh') {
      return this.handleRefresh(res);
    }

    if (method === 'POST' && pathname.startsWith('/api/v1/')) {
      const parts = pathname.split('/');
      if (parts.length === 5 && parts[4] === 'approval') {
        const identifier = parts[3];
        return this.handleApprovalDecision(identifier, req, res);
      }
    }

    if (method === 'GET' && pathname.startsWith('/api/v1/')) {
      const parts = pathname.split('/');
      if (parts.length === 5 && parts[4] === 'activity') {
        const identifier = parts[3];
        return this.handleGetActivity(identifier, res);
      }
      if (parts.length === 4) {
        const identifier = parts[3];
        return this.handleGetIssue(identifier, res);
      }
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'not_found', message: 'Endpoint not found' } }));
  }

  private async handleStaticFile(
    res: ServerResponse,
    filename: string,
    contentType: string
  ): Promise<void> {
    try {
      // Dashboard assets are read from disk on each request so CSS/JS/HTML
      // edits can be picked up by a browser refresh without restarting the
      // Symphony process that owns live Codex worker sessions.
      const content = await readFile(resolve(this.publicDir, filename));
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      });
      res.end(content);
    } catch (err) {
      this.log.error('Failed to serve dashboard asset', {
        file: filename,
        error: (err as Error).message,
      });
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Dashboard asset not found');
    }
  }

  private buildDashboardView(): {
    state: any;
    statsHtml: string;
    approvalHtml: string;
    runningHtml: string;
    retryingHtml: string;
    activityHtml: string;
  } {
    const state = this.orchestrator.getSnapshot() as any;
    const statsHtml = `
    <div class="stat">
      <div>Running</div>
      <div class="stat-value">${state.counts.running}</div>
    </div>
    <div class="stat">
      <div>Retrying</div>
      <div class="stat-value">${state.counts.retrying}</div>
    </div>
    <div class="stat">
      <div>Completed Since Start</div>
      <div class="stat-value">${state.counts.completed_since_start}</div>
    </div>
    <div class="stat">
      <div>Total Tokens</div>
      <div class="stat-value">${state.codex_totals.total_tokens.toLocaleString()}</div>
    </div>
    <div class="stat">
      <div>Total Runtime</div>
      <div class="stat-value">${state.codex_totals.seconds_running}s</div>
    </div>`;

    let runningHtml = state.running.map((r: any) => {
      const issue = this.escapeHtml(r.issue_identifier);
      const detailUrl = this.escapeHtml(r.detail_url);
      const worker = this.escapeHtml(r.worker_designation || r.worker?.designation || 'unassigned');
      const workspace = this.escapeHtml(r.workspace_path || 'not created yet');
      const lastMessage = this.escapeHtml(r.last_message || '');
      const statusBadge = r.waiting_on_approval
        ? '<span class="badge approval">approval needed</span>'
        : '<span class="badge running">running</span>';
      const statusText = r.waiting_on_approval
        ? this.escapeHtml(r.approval_summary || 'Waiting for approval')
        : this.escapeHtml(r.state);

      return '<tr><td><a href="' + detailUrl + '">' + issue + '</a></td>' +
             '<td><code>' + worker + '</code></td>' +
             '<td>' + statusBadge + ' ' + statusText + '</td>' +
             '<td>' + r.turn_count + '</td>' +
             '<td>' + r.tokens.input_tokens + ' / ' + r.tokens.output_tokens + '</td>' +
             '<td>' + this.escapeHtml(r.last_event || 'none') + '<br><small>' +
             this.formatAge(r.last_activity_age_ms) + ' ago</small></td>' +
             '<td><code>' + workspace + '</code></td>' +
             '<td class="message">' + lastMessage + '</td></tr>';
    }).join('');

    if (!runningHtml) runningHtml = '<tr><td colspan="8">No running issues</td></tr>';

    let retryingHtml = state.retrying.map((r: any) => {
      const issue = this.escapeHtml(r.issue_identifier);
      const detailUrl = this.escapeHtml(r.detail_url);
      const worker = this.escapeHtml(r.worker_designation || r.worker?.designation || 'previous worker unknown');

      return '<tr><td><a href="' + detailUrl + '">' + issue + '</a></td>' +
             '<td><code>' + worker + '</code></td>' +
             '<td><span class="badge retrying">retrying</span> ' + r.attempt + '</td>' +
             '<td>' + this.escapeHtml(r.due_at) + '</td>' +
             '<td>' + this.escapeHtml(r.last_event || 'none') + '</td>' +
             '<td class="message">' + this.escapeHtml(r.error || 'normal continuation retry') + '</td></tr>';
    }).join('');

    if (!retryingHtml) retryingHtml = '<tr><td colspan="6">No issues in retry queue</td></tr>';

    const activeIssueIds = [
      ...state.running.map((r: any) => r.issue_identifier),
      ...state.retrying.map((r: any) => r.issue_identifier),
    ];

    // Show approval requests as their own first-class dashboard surface.
    // The activity feed still keeps the raw chronology, but approval is a
    // decision point for the human operator and should not be hidden below
    // ordinary token, file, or command events.
    const approvalHtml = activeIssueIds.map((identifier: string) => {
      const details = this.orchestrator.getIssueDetails(identifier) as any;
      return this.renderApprovalPanel(identifier, details);
    }).filter(Boolean).join('');

    const activityHtml = activeIssueIds.map((identifier: string) => {
      const details = this.orchestrator.getIssueDetails(identifier) as any;
      if (!details?.activity?.length) return '';

      const entries = details.activity.slice(-12).reverse().map((entry: any) => {
        const status = entry.status ? '<span class="activity-status">' + this.escapeHtml(entry.status) + '</span>' : '';
        const detail = entry.detail ? '<pre>' + this.escapeHtml(entry.detail) + '</pre>' : '';
        return '<li class="activity-item">' +
               '<div><span class="activity-kind">' + this.escapeHtml(entry.kind) + '</span>' +
               '<strong>' + this.escapeHtml(entry.title) + '</strong>' + status +
               '<small>' + this.escapeHtml(entry.timestamp) + '</small></div>' +
               detail +
               '</li>';
      }).join('');
      const fileRows = (details.workspace?.recent_files ?? []).slice(0, 8).map((file: any) => {
        return '<li><code>' + this.escapeHtml(file.path) + '</code> <small>' +
               this.escapeHtml(file.modified_at) + '</small></li>';
      }).join('');
      const filesHtml = fileRows
        ? '<h3>Recent Files</h3><ul class="file-feed">' + fileRows + '</ul>'
        : '';

      return '<div class="card">' +
             '<h2>Activity: <a href="/api/v1/' + encodeURIComponent(identifier) + '/activity">' +
             this.escapeHtml(identifier) + '</a></h2>' +
             filesHtml +
             '<ol class="activity-feed">' + entries + '</ol>' +
             '</div>';
    }).join('');

    return { state, statsHtml, approvalHtml, runningHtml, retryingHtml, activityHtml };
  }

  private escapeHtml(value: unknown): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private formatAge(ageMs: unknown): string {
    const age = typeof ageMs === 'number' ? ageMs : 0;
    if (age < 1000) return `${Math.max(0, Math.round(age))}ms`;
    if (age < 60_000) return `${Math.round(age / 1000)}s`;
    return `${Math.round(age / 60_000)}m`;
  }

  private renderApprovalPanel(identifier: string, details: any): string {
    if (!details?.waiting_on_approval) return '';

    const activity = Array.isArray(details.activity) ? details.activity : [];
    const approvalIndex = activity.findLastIndex((entry: any) => entry?.kind === 'approval' && entry?.status === 'waiting');
    const approvalEntry = approvalIndex >= 0 ? activity[approvalIndex] : null;
    const actionEntry = approvalIndex >= 0
      ? activity.slice(0, approvalIndex).reverse().find((entry: any) => {
        return entry?.status === 'inProgress' && ['tool_call', 'command', 'file_change'].includes(entry?.kind);
      })
      : activity.slice().reverse().find((entry: any) => entry?.status === 'inProgress');

    // This server-rendered fallback mirrors the static dashboard. The normal
    // browser path uses dashboard.js, but keeping this readable prevents the
    // older fragment endpoint from regressing when an approval is pending.
    const actionTitle = actionEntry?.title || details.approval_summary || approvalEntry?.title || 'Waiting for approval';
    const pending = details.pending_approval;
    const actionDetail = pending?.detail || actionEntry?.detail || approvalEntry?.detail || 'The worker paused before completing this action.';
    const actionKind = actionEntry?.kind || 'approval';
    const workerLabel = details.worker_designation || details.worker?.designation || 'worker unknown';
    const requestedAt = pending?.requested_at ? '<p><strong>Requested:</strong> ' + this.escapeHtml(pending.requested_at) + '</p>' : '';
    const actionButtons = pending?.can_respond
      ? '<div class="approval-actions" data-issue="' + this.escapeHtml(identifier) + '">' +
        '<button type="button" data-decision="approve">Approve</button>' +
        '<button type="button" data-decision="deny">Deny</button>' +
        '</div>'
      : '<p class="approval-note">Symphony can explain this request, but this approval method is view-only until a safe response mapping is added.</p>';

    return '<div class="card approval-panel">' +
           '<h2><span class="badge approval">approval needed</span>' +
           '<a href="/api/v1/' + encodeURIComponent(identifier) + '/activity">' +
           this.escapeHtml(identifier) + '</a></h2>' +
           '<p><strong>Worker:</strong> <code>' + this.escapeHtml(workerLabel) + '</code></p>' +
           '<p><strong>Pending action:</strong> ' + this.escapeHtml(actionTitle) + '</p>' +
           '<p><strong>Action type:</strong> ' + this.escapeHtml(actionKind) + '</p>' +
           requestedAt +
           actionButtons +
           '<pre class="approval-detail">' + this.escapeHtml(actionDetail) + '</pre>' +
           '</div>';
  }

  private handleGetState(res: ServerResponse) {
    const state = this.orchestrator.getSnapshot();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(state, null, 2));
  }

  private handleGetDispatchControl(res: ServerResponse) {
    const control = this.orchestrator.getDispatchControl();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(control, null, 2));
  }

  private async handleSetDispatchControl(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let payload: { enabled?: unknown } = {};

    try {
      payload = JSON.parse(await this.readRequestBody(req));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'bad_json', message: 'Expected JSON body with enabled: true or false.' },
      }));
      return;
    }

    if (typeof payload.enabled !== 'boolean') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'bad_dispatch_control', message: 'enabled must be a boolean.' },
      }));
      return;
    }

    try {
      // Dispatch control is the dashboard's hard worker-assignment gate. It is
      // intentionally backend-owned so a browser refresh or localStorage state
      // cannot accidentally decide whether Symphony may start agents.
      const control = await this.orchestrator.setDispatchEnabled(payload.enabled);
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(control, null, 2));
    } catch (err) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'dispatch_control_blocked', message: (err as Error).message },
      }));
    }
  }

  private handleDashboardFragment(res: ServerResponse) {
    const { state, statsHtml, approvalHtml, runningHtml, retryingHtml, activityHtml } = this.buildDashboardView();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      generated_at: state.generated_at,
      stats_html: statsHtml,
      approval_html: approvalHtml,
      running_html: runningHtml,
      retrying_html: retryingHtml,
      activity_html: activityHtml,
    }));
  }

  private handleDashboardEvents(req: IncomingMessage, res: ServerResponse) {
    // This local event stream is the dashboard's "live updates" trigger. It
    // does not send raw Codex logs or mutate worker state; it only tells the
    // browser that fresh JSON should be pulled into the existing sections. That
    // keeps active Codex/Jules sessions alive while the page updates in place.
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const writeDashboardEvent = () => {
      const state = this.orchestrator.getSnapshot() as any;
      res.write(`event: dashboard\n`);
      res.write(`data: ${JSON.stringify({
        generated_at: state.generated_at,
        dashboard: state.dashboard ?? null,
        running: state.counts?.running ?? 0,
        retrying: state.counts?.retrying ?? 0,
        sent_at: new Date().toISOString(),
      })}\n\n`);
    };

    writeDashboardEvent();
    const interval = setInterval(writeDashboardEvent, 2000);

    req.on('close', () => {
      clearInterval(interval);
      res.end();
    });
  }

  private async handleProofBoard(res: ServerResponse): Promise<void> {
    const snapshot = await this.taskIntake.snapshot();
    const taskState = this.withTaskCapabilities(snapshot);
    const html = this.renderProofBoard(taskState);

    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(html);
  }

  private renderProofBoard(taskState: ReturnType<HttpServer['withTaskCapabilities']> & {
    drafts: Array<TaskDraftSnapshot['drafts'][number] & {
      next_action?: Record<string, unknown>;
      linear_issue_preview?: LinearIssuePreview;
      jules_manifest_preview?: JulesManifestPreview;
      handoff_readiness?: HandoffReadinessPacket;
    }>;
    handoffs: Array<TaskDraftSnapshot['handoffs'][number] & {
      next_action?: Record<string, unknown>;
      local_sync_readiness?: LocalSyncReadinessPacket;
      scout_core_readiness?: ScoutCoreReadinessPacket;
    }>;
  }): string {
    const appState = this.orchestrator.getSnapshot() as any;
    const latestDraft = taskState.drafts[0] ?? null;
    const latestHandoff = taskState.handoffs[0] ?? null;
    const localSyncReadinessPackets = taskState.handoffs
      .map(handoff => (handoff as TaskDraftSnapshot['handoffs'][number] & { local_sync_readiness?: LocalSyncReadinessPacket }).local_sync_readiness)
      .filter((readiness): readiness is LocalSyncReadinessPacket => Boolean(readiness));
    const scoutCoreReadinessPackets = taskState.handoffs
      .map(handoff => (handoff as TaskDraftSnapshot['handoffs'][number] & { scout_core_readiness?: ScoutCoreReadinessPacket }).scout_core_readiness)
      .filter((readiness): readiness is ScoutCoreReadinessPacket => Boolean(readiness));
    const middlemanPath = taskState.middleman_path ?? null;
    const latestLinearPreview = latestDraft?.linear_issue_preview ?? null;
    const latestManifestPreview = latestDraft?.jules_manifest_preview ?? null;
    const latestReadiness = latestDraft?.handoff_readiness ?? null;
    const gitDispositionReview = taskState.git_disposition_review ?? null;
    const nextAction = taskState.next_action ?? {};
    const syncTone = taskState.preflight.ok ? 'ready' : 'blocked';
    const syncLabel = taskState.preflight.ok ? 'ready' : 'blocked';
    const proofStamp = new Date().toISOString();
    const evidenceLinks = [
      'conductor/symphony/docs/JULES_MIDDLEMAN_OPERATING_SPEC.md',
      'conductor/symphony/JULES_MIDDLEMAN_AUDIT.md',
      'conductor/symphony/.symphony/live-proof/proof-board-2026-05-17.json',
      'conductor/symphony/.symphony/live-proof/proof-board-2026-05-17.md',
    ];

    // The proof board is intentionally server-rendered and script-free. It is
    // not a replacement dashboard; it is a compact follow-along receipt for the
    // Codex in-app browser when the richer dashboard is too large for reliable
    // screenshot capture. Every value comes from the same task-intake snapshot
    // as /api/v1/task-drafts so it cannot invent a separate orchestration truth.
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Symphony Proof Board</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f6f8fb; color: #172033; }
    main { max-width: 980px; margin: 0 auto; padding: 24px; }
    h1 { margin: 0 0 6px; font-size: 28px; letter-spacing: 0; }
    h2 { margin: 0 0 10px; font-size: 17px; letter-spacing: 0; }
    p { margin: 6px 0; line-height: 1.4; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .card { background: #fff; border: 1px solid #d8e0ea; border-radius: 8px; padding: 14px; }
    .wide { grid-column: 1 / -1; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    .blocked { background: #ffe1df; color: #8a1f15; }
    .ready { background: #dff5e4; color: #175b2c; }
    .waiting { background: #e8edf7; color: #263b63; }
    code { background: #eef2f7; padding: 2px 4px; border-radius: 4px; }
    ul, ol { margin: 8px 0 0 20px; padding: 0; }
    li { margin: 4px 0; }
    a { color: #174ea6; }
    .small { color: #5e6a7d; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <header class="card wide">
      <h1>Symphony Proof Board</h1>
      <p class="small">Generated ${this.escapeHtml(proofStamp)} from the live task-intake snapshot.</p>
      <p><span class="badge ${syncTone}">GitHub sync: ${syncLabel}</span> ${this.escapeHtml(taskState.preflight.summary)}</p>
    </header>
    <section class="grid">
      <article class="card">
        <h2>Middleman Path</h2>
        ${middlemanPath ? `
          <p><strong>Current boundary: ${this.escapeHtml(middlemanPath.currentBoundaryLabel)}</strong></p>
          <p>${this.escapeHtml(middlemanPath.summary)}</p>
          <p class="small">${this.escapeHtml(middlemanPath.nextExpectedProof)}</p>
          ${middlemanPath.foremanAction ? `
            <p><strong>Foreman action: ${this.escapeHtml(middlemanPath.foremanAction.label)}</strong></p>
            <p class="small">Safety: ${this.escapeHtml(middlemanPath.foremanAction.safety)}; method: ${this.escapeHtml(middlemanPath.foremanAction.method)}; can run now: ${middlemanPath.foremanAction.canRunNow ? 'yes' : 'no'}</p>
          ` : ''}
          <ol>${middlemanPath.stages.map(stage => `
            <li>
              <span class="badge ${this.escapeHtml(stage.status)}">${this.escapeHtml(stage.status)}</span>
              ${this.escapeHtml(stage.label)}${stage.sourceTitle ? `: ${this.escapeHtml(stage.sourceTitle)}` : ''}
            </li>
          `).join('')}</ol>
        ` : '<p>No middleman path packet is available yet.</p>'}
      </article>
      <article class="card">
        <h2>Queue Next Action</h2>
        <p><strong>${this.escapeHtml(nextAction.label ?? 'No next action')}</strong></p>
        <p>${this.escapeHtml(nextAction.summary ?? 'No queue action is currently available.')}</p>
        <p class="small">Source: ${this.escapeHtml(nextAction.source_type ?? 'queue')} ${this.escapeHtml(nextAction.source_id ?? '')}</p>
      </article>
      <article class="card">
        <h2>Git Sync Plan</h2>
        <p><strong>${this.escapeHtml(taskState.gitSyncPlan.status)}</strong></p>
        <p>${this.escapeHtml(taskState.gitSyncPlan.summary)}</p>
        <p class="small">Can execute: ${taskState.gitSyncPlan.canExecute ? 'yes' : 'no'}; mutates Git: ${taskState.gitSyncPlan.mutatesGit ? 'yes' : 'no'}</p>
      </article>
      <article class="card">
        <h2>Git Disposition Review</h2>
        ${gitDispositionReview ? `
          <p><strong>${this.escapeHtml(gitDispositionReview.status)}</strong></p>
          <p>${this.escapeHtml(gitDispositionReview.summary)}</p>
          <p class="small">Required decisions: ${this.escapeHtml(gitDispositionReview.requiredCategories.join(', ') || 'none')}</p>
          <p class="small">Mutates Git: ${gitDispositionReview.mutatesGit ? 'yes' : 'no'}</p>
        ` : '<p>No Git disposition review packet is available yet.</p>'}
      </article>
      <article class="card">
        <h2>Latest Draft</h2>
        ${latestDraft ? `
          <p><strong>${this.escapeHtml(latestDraft.title)}</strong></p>
          <p>Status: <code>${this.escapeHtml(latestDraft.status)}</code></p>
          <p class="small">Next: ${this.escapeHtml(latestDraft.next_action?.label ?? 'none')}</p>
        ` : '<p>No draft exists yet.</p>'}
      </article>
      <article class="card">
        <h2>Linear Issue Preview</h2>
        ${latestLinearPreview ? `
          <p><strong>${this.escapeHtml(latestLinearPreview.issueTitle)}</strong></p>
          <p>Can create now: ${latestLinearPreview.canCreateNow ? 'yes' : 'no'}</p>
          <p>Mutates external systems: ${latestLinearPreview.mutatesExternalSystems ? 'yes' : 'no'}</p>
          <p class="small">${this.escapeHtml(latestLinearPreview.safetyNote)}</p>
        ` : '<p>No draft preview is available yet.</p>'}
      </article>
      <article class="card">
        <h2>Handoff Readiness</h2>
        ${latestReadiness ? `
          <p><strong>${this.escapeHtml(latestReadiness.title)}</strong></p>
          <p>Status: ${this.escapeHtml(latestReadiness.status)}</p>
          <p>${this.escapeHtml(latestReadiness.summary)}</p>
          <p class="small">Mutates Git: ${latestReadiness.mutatesGit ? 'yes' : 'no'}; Mutates external systems: ${latestReadiness.mutatesExternalSystems ? 'yes' : 'no'}; Mutates local files: ${latestReadiness.mutatesLocalFiles ? 'yes' : 'no'}</p>
        ` : '<p>No handoff readiness packet is available yet.</p>'}
      </article>
      <article class="card">
        <h2>Jules Manifest Preview</h2>
        ${latestManifestPreview ? `
          <p><strong>${this.escapeHtml(latestManifestPreview.manifest.tasks[0]?.title ?? latestDraft?.title ?? 'Untitled manifest')}</strong></p>
          <p>Can stage now: ${latestManifestPreview.canStageNow ? 'yes' : 'no'}</p>
          <p>Mutates local files: ${latestManifestPreview.mutatesLocalFiles ? 'yes' : 'no'}</p>
          <p class="small">${this.escapeHtml(latestManifestPreview.manifestPath)}</p>
        ` : '<p>No manifest preview is available yet.</p>'}
      </article>
      <article class="card">
        <h2>Latest Handoff Or Observed PR</h2>
        ${latestHandoff ? `
          <p><strong>${this.escapeHtml(latestHandoff.title)}</strong></p>
          <p>Status: <code>${this.escapeHtml(latestHandoff.status)}</code></p>
          <p class="small">Next: ${this.escapeHtml(latestHandoff.next_action?.label ?? 'none')}</p>
          ${latestHandoff.githubPullRequestUrl ? `<p><a href="${this.escapeHtml(latestHandoff.githubPullRequestUrl)}">${this.escapeHtml(latestHandoff.githubPullRequestUrl)}</a></p>` : ''}
        ` : '<p>No handoff or observed PR exists yet.</p>'}
      </article>
      <article class="card">
        <h2>Local Sync Readiness</h2>
        ${localSyncReadinessPackets.length ? `
          <ol>${localSyncReadinessPackets.map(readiness => `
            <li>
              <strong>${this.escapeHtml(readiness.title)}</strong>
              <span class="badge ${this.escapeHtml(readiness.status)}">${this.escapeHtml(readiness.status)}</span>
              <p class="small">Can sync now: ${readiness.canSyncNow ? 'yes' : 'no'}; mutates Git: ${readiness.mutatesGitIfRun ? 'yes' : 'no'}; mutates local files: ${readiness.mutatesLocalFilesIfRun ? 'yes' : 'no'}</p>
              <p class="small">${this.escapeHtml(readiness.expectedNextProof)}</p>
              ${readiness.blockers.length ? `<ul>${readiness.blockers.map((blocker: string) => `<li>${this.escapeHtml(blocker)}</li>`).join('')}</ul>` : ''}
            </li>
          `).join('')}</ol>
        ` : '<p>No local sync readiness packet is available yet.</p>'}
      </article>
      <article class="card">
        <h2>Scout/Core Readiness</h2>
        ${scoutCoreReadinessPackets.length ? `
          <ol>${scoutCoreReadinessPackets.map(readiness => `
            <li>
              <strong>${this.escapeHtml(readiness.title)}</strong>
              <span class="badge ${this.escapeHtml(readiness.status)}">${this.escapeHtml(readiness.status)}</span>
              <p class="small">Scout review: ${readiness.canScoutReviewNow ? 'yes' : 'no'}; Core validation: ${readiness.canCoreValidateNow ? 'yes' : 'no'}; Core merge: ${readiness.canCoreMergeNow ? 'yes' : 'no'}</p>
              <p class="small">Checks: ${this.escapeHtml(readiness.evidence.checksConclusion ?? 'unknown')}; file risk: ${this.escapeHtml(readiness.evidence.fileRisk ?? 'unknown')}; next boundary: ${this.escapeHtml(readiness.nextBoundary)}</p>
              <p class="small">${this.escapeHtml(readiness.expectedNextProof)}</p>
              ${readiness.blockers.length ? `<ul>${readiness.blockers.map((blocker: string) => `<li>${this.escapeHtml(blocker)}</li>`).join('')}</ul>` : ''}
            </li>
          `).join('')}</ol>
        ` : '<p>No Scout/Core readiness packet is available yet.</p>'}
      </article>
      <article class="card">
        <h2>Nudge Scheduler</h2>
        <p><strong>${this.escapeHtml(taskState.taskNudges.scheduler.status)}</strong></p>
        <p>${this.escapeHtml(taskState.taskNudges.scheduler.summary)}</p>
        <p class="small">Due ${taskState.taskNudges.scheduler.dueCount}, waiting ${taskState.taskNudges.scheduler.waitingCount}, blocked ${taskState.taskNudges.scheduler.blockedCount}; mutates external systems: ${taskState.taskNudges.scheduler.mutatesExternalSystems ? 'yes' : 'no'}</p>
      </article>
      <article class="card">
        <h2>Worker Snapshot</h2>
        <p>Running: <strong>${this.escapeHtml(appState.counts?.running ?? 0)}</strong>; retrying: <strong>${this.escapeHtml(appState.counts?.retrying ?? 0)}</strong></p>
        <p class="small">Dashboard base: ${this.escapeHtml(appState.dashboard?.base_url ?? this.orchestrator.getDashboardBaseUrl())}</p>
      </article>
      <article class="card wide">
        <h2>Evidence Ledger</h2>
        <ul>${evidenceLinks.map(link => `<li><code>${this.escapeHtml(link)}</code></li>`).join('')}</ul>
      </article>
    </section>
  </main>
</body>
</html>`;
  }

  private async handleRefresh(res: ServerResponse) {
    // Fire and forget, or wait? Spec says "Queues an immediate tracker poll + reconciliation cycle"
    // We return 202 Accepted.
    this.orchestrator.refresh().catch(err => {
      this.log.error('Refresh failed', { error: err.message });
    });

    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      queued: true,
      coalesced: false,
      requested_at: new Date().toISOString(),
      operations: ['poll', 'reconcile']
    }));
  }

  private async handleGetTaskDrafts(res: ServerResponse): Promise<void> {
    const snapshot = await this.taskIntake.snapshot();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(this.withTaskCapabilities(snapshot), null, 2));
  }

  private withTaskCapabilities(snapshot: TaskDraftSnapshot): TaskDraftSnapshot & {
    links: {
      self: string;
      gitPreflight: string;
      gitDisposition: string;
      gitDispositionReview: string;
      taskNudges: string;
      observedPullRequests: string;
      refreshDueTaskNudges: string;
    bulkRefreshJules: string;
    };
    next_action: Record<string, unknown>;
    capabilities: {
      canCreateLinearIssue: boolean;
      requiresLinearIssueForHandoff: boolean;
      trackerKind: string | null;
      linearProjectSlug: string | null;
      linearIssueCreationBlocker: string | null;
      kickoffGuide: ReturnType<HttpServer['buildKickoffGuide']>;
    };
    conflict_watch: TaskConflictWatch;
    git_disposition_review: GitDispositionReviewPacket;
    middleman_path: MiddlemanPathPacket;
  } {
    const config = this.orchestrator.getConfig();
    const trackerKind = config?.tracker.kind ?? null;
    const linearCapability = this.getLinearIssueCapability(config);
    const baseUrl = this.orchestrator.getDashboardBaseUrl();
    const draftsWithActions = snapshot.drafts.map(draft => {
      const links = this.buildDraftLinks(baseUrl, draft.id);
      const draftLinearIssuePreview = this.buildLinearIssuePreview(
        baseUrl,
        draft,
        snapshot.preflight,
        linearCapability,
      );
      const draftJulesManifestPreview = this.buildJulesManifestPreview(
        baseUrl,
        draft,
        snapshot.preflight,
        linearCapability,
      );
      const draftHandoffReadiness = this.buildHandoffReadinessPacket(
        baseUrl,
        draft,
        snapshot.preflight,
        draftLinearIssuePreview,
        draftJulesManifestPreview,
      );

      return {
      ...draft,
      links,
      linear_issue_preview: draftLinearIssuePreview,
      jules_manifest_preview: draftJulesManifestPreview,
      handoff_readiness: draftHandoffReadiness,
      next_action: this.buildDraftNextAction(baseUrl, draft, {
        requiresLinearIssueForHandoff: linearCapability.requiresLinearIssueForHandoff,
        canCreateLinearIssue: linearCapability.canCreateLinearIssue,
        linearIssueCreationBlocker: linearCapability.linearIssueCreationBlocker,
      }),
    };
    });
    const handoffsWithActions = snapshot.handoffs.map(handoff => {
      const links = this.buildHandoffLinks(baseUrl, handoff.id);

      return {
        ...handoff,
        links,
        launch_readiness: this.buildJulesLaunchReadinessPacket(baseUrl, handoff),
        scout_core_readiness: this.buildScoutCoreReadinessPacket(baseUrl, handoff),
        local_sync_readiness: this.buildLocalSyncReadinessPacket(baseUrl, handoff),
        next_action: this.buildHandoffNextAction(baseUrl, handoff),
      };
    });
    const conflictWatch = this.buildConflictWatch(handoffsWithActions);
    const gitDispositionReview = this.buildGitDispositionReviewPacket(baseUrl, snapshot);
    const middlemanPath = this.buildMiddlemanPathPacket(
      baseUrl,
      snapshot,
      draftsWithActions,
      handoffsWithActions,
      conflictWatch,
    );

    // These capabilities are operator-facing affordances, not security gates.
    // The mutating endpoint still performs the real checks. This payload keeps
    // the dashboard honest before the user clicks a button that cannot work in
    // mock mode or before a Linear workflow has been loaded.
    return {
      ...snapshot,
      drafts: draftsWithActions,
      handoffs: handoffsWithActions,
      conflict_watch: conflictWatch,
      middleman_path: middlemanPath,
      next_action: this.buildQueueNextAction(baseUrl, snapshot, draftsWithActions, handoffsWithActions, conflictWatch),
      // The task queue endpoint is also a worker-facing API surface. Links make
      // it self-describing so a headless foreman can inspect the queue response
      // and know the safe next URLs without hard-coded route knowledge.
      links: {
        self: `${baseUrl}/api/v1/task-drafts`,
        gitPreflight: `${baseUrl}/api/v1/git-preflight`,
        gitDisposition: `${baseUrl}/api/v1/git-disposition`,
        gitDispositionReview: `${baseUrl}/api/v1/git-disposition/review`,
        taskNudges: `${baseUrl}/api/v1/task-nudges`,
        observedPullRequests: `${baseUrl}/api/v1/observed-prs`,
        refreshDueTaskNudges: `${baseUrl}/api/v1/task-nudges/refresh-due`,
        bulkRefreshJules: `${baseUrl}/api/v1/jules-handoffs/refresh-all`,
      },
      git_disposition_review: gitDispositionReview,
      capabilities: {
        canCreateLinearIssue: linearCapability.canCreateLinearIssue,
        requiresLinearIssueForHandoff: linearCapability.requiresLinearIssueForHandoff,
        trackerKind,
        linearProjectSlug: linearCapability.linearProjectSlug,
        linearIssueCreationBlocker: linearCapability.linearIssueCreationBlocker,
        kickoffGuide: this.buildKickoffGuide(linearCapability.canCreateLinearIssue),
      },
    };
  }

  private buildMiddlemanPathPacket(
    baseUrl: string,
    snapshot: TaskDraftSnapshot,
    drafts: Array<TaskDraftSnapshot['drafts'][number] & {
      linear_issue_preview?: LinearIssuePreview;
      jules_manifest_preview?: JulesManifestPreview;
      handoff_readiness?: HandoffReadinessPacket;
      next_action?: Record<string, unknown>;
    }>,
    handoffs: Array<TaskDraftSnapshot['handoffs'][number] & {
      launch_readiness?: JulesLaunchReadinessPacket;
      scout_core_readiness?: ScoutCoreReadinessPacket;
      local_sync_readiness?: LocalSyncReadinessPacket;
      next_action?: Record<string, unknown>;
    }>,
    conflictWatch: TaskConflictWatch,
  ): MiddlemanPathPacket {
    const latestDraft = drafts[0] ?? null;
    const latestHandoff = handoffs[0] ?? null;
    const dashboardHandoff = handoffs.find(handoff => handoff.status !== 'observed_pr') ?? null;
    const prHandoff = handoffs.find(handoff => Boolean(handoff.githubPullRequestUrl)) ?? latestHandoff;
    const gitBlocked = !snapshot.preflight.ok;
    const hasLinearReceipt = Boolean(
      latestHandoff?.linearIssueIdentifier
      || latestHandoff?.linearIssueUrl
      || latestDraft?.linearIssueIdentifier
      || latestDraft?.linearIssueUrl
    );
    const manifestHandoff = dashboardHandoff;
    const hasManifest = Boolean(manifestHandoff?.manifestPath);
    const hasSession = Boolean(manifestHandoff?.julesSessionId || manifestHandoff?.julesSessionUrl || manifestHandoff?.julesState);
    const hasDashboardPr = Boolean(dashboardHandoff?.githubPullRequestUrl);
    const hasObservedPr = Boolean(prHandoff?.status === 'observed_pr' && prHandoff.githubPullRequestUrl);
    const hasPr = hasDashboardPr || hasObservedPr;
    const prState = prHandoff?.githubPullRequestState ?? null;
    const prChecks = prHandoff?.githubPullRequestChecks ?? null;
    const hasPrBlocker = prChecks?.failed ? prChecks.failed > 0 : false;
    const scoutAttention = conflictWatch.status === 'blocked' || conflictWatch.status === 'attention';
    const localSyncHandoff = hasDashboardPr ? prHandoff : null;
    const localSync = localSyncHandoff?.localSyncStatus ?? null;
    const localSyncSafe = Boolean(localSync?.safeToPull);

    // The middleman path is the global version of the per-card readiness
    // packets. It does not replace the guarded endpoints; it gives foremen and
    // humans one ordered ladder so they can see which proof exists before
    // moving from local dashboard work into Linear, Jules, GitHub, review, and
    // local repository sync.
    const stages: MiddlemanPathStage[] = [
      {
        id: 'git_sync',
        label: 'GitHub sync',
        status: gitBlocked ? 'blocked' : 'complete',
        sourceId: null,
        sourceTitle: null,
        detail: snapshot.preflight.summary || (gitBlocked ? 'GitHub sync is blocked.' : 'GitHub sync gate passes.'),
        endpoint: `${baseUrl}/api/v1/git-preflight`,
        method: 'POST',
        canRunNow: false,
        mutatesGitIfRun: false,
        mutatesExternalSystemsIfRun: false,
        mutatesLocalFilesIfRun: false,
        blockedBy: gitBlocked ? snapshot.preflight.blockers : [],
        expectedProof: gitBlocked
          ? 'Human-owned Git disposition and a passing GitHub sync preflight.'
          : 'GitHub sync preflight receipt with clean local and remote base state.',
        receipt: snapshot.preflight.ok
          ? `${snapshot.preflight.remoteBranch ?? 'origin/master'} @ ${snapshot.preflight.remoteCommit ?? 'unknown'}`
          : null,
      },
      {
        id: 'linear_issue',
        label: 'Linear issue',
        status: hasLinearReceipt ? 'complete' : gitBlocked ? 'waiting' : latestDraft?.linear_issue_preview?.canCreateNow ? 'ready' : 'blocked',
        sourceId: latestDraft?.id ?? latestHandoff?.id ?? null,
        sourceTitle: latestDraft?.title ?? latestHandoff?.title ?? null,
        detail: hasLinearReceipt
          ? 'Linear tracking receipt is attached.'
          : gitBlocked
            ? 'Waiting for GitHub sync before creating or linking Linear tracking.'
            : latestDraft
              ? 'Linear issue can be created from the dashboard draft.'
              : 'Create a dashboard draft before creating Linear tracking.',
        endpoint: latestDraft ? `${baseUrl}/api/v1/task-drafts/${encodeURIComponent(latestDraft.id)}/create-linear` : null,
        method: latestDraft ? 'POST' : 'NONE',
        canRunNow: Boolean(!hasLinearReceipt && latestDraft?.linear_issue_preview?.canCreateNow),
        mutatesGitIfRun: false,
        mutatesExternalSystemsIfRun: Boolean(!hasLinearReceipt && latestDraft?.linear_issue_preview?.canCreateNow),
        mutatesLocalFilesIfRun: false,
        blockedBy: hasLinearReceipt ? [] : latestDraft?.linear_issue_preview?.blockers ?? (latestDraft ? [] : ['No dashboard draft exists yet.']),
        expectedProof: 'Linear issue identifier and URL attached to the draft or handoff.',
        receipt: latestHandoff?.linearIssueIdentifier ?? latestDraft?.linearIssueIdentifier ?? null,
      },
      {
        id: 'jules_manifest',
        label: 'Jules manifest',
        status: hasManifest ? 'complete' : gitBlocked || !hasLinearReceipt ? 'waiting' : 'ready',
        sourceId: manifestHandoff?.id ?? latestDraft?.id ?? null,
        sourceTitle: manifestHandoff?.title ?? latestDraft?.title ?? null,
        detail: hasManifest
          ? 'A staged `.jules/orchestrator` manifest exists.'
          : 'Waiting for Git sync and Linear receipt before staging the Jules manifest.',
        endpoint: manifestHandoff ? `${baseUrl}/api/v1/jules-handoffs/${encodeURIComponent(manifestHandoff.id)}/stage-manifest` : null,
        method: manifestHandoff ? 'POST' : 'NONE',
        canRunNow: Boolean(!hasManifest && !gitBlocked && hasLinearReceipt && manifestHandoff),
        mutatesGitIfRun: false,
        mutatesExternalSystemsIfRun: false,
        mutatesLocalFilesIfRun: Boolean(!hasManifest && !gitBlocked && hasLinearReceipt && manifestHandoff),
        blockedBy: hasManifest ? [] : [
          ...(gitBlocked ? ['GitHub sync preflight is blocked.'] : []),
          ...(!hasLinearReceipt ? ['Linear issue receipt is missing.'] : []),
          ...(!manifestHandoff ? ['No Jules handoff exists yet.'] : []),
        ],
        expectedProof: 'Staged `.jules/runs/.../manifest.json` path and launch command.',
        receipt: manifestHandoff?.manifestPath ?? null,
      },
      {
        id: 'jules_launch',
        label: 'Jules launch',
        status: hasSession ? 'complete' : manifestHandoff?.launch_readiness?.status === 'ready' ? 'ready' : 'waiting',
        sourceId: manifestHandoff?.id ?? null,
        sourceTitle: manifestHandoff?.title ?? null,
        detail: hasSession
          ? 'Jules session receipt exists.'
          : 'Waiting for a staged manifest before launch.',
        endpoint: manifestHandoff ? `${baseUrl}/api/v1/jules-handoffs/${encodeURIComponent(manifestHandoff.id)}/launch` : null,
        method: manifestHandoff ? 'POST' : 'NONE',
        canRunNow: Boolean(manifestHandoff?.launch_readiness?.canLaunchNow),
        mutatesGitIfRun: false,
        mutatesExternalSystemsIfRun: Boolean(manifestHandoff?.launch_readiness?.mutatesExternalSystemsIfRun),
        mutatesLocalFilesIfRun: Boolean(manifestHandoff?.launch_readiness?.mutatesLocalFilesIfRun),
        blockedBy: manifestHandoff?.launch_readiness?.blockers ?? ['No staged Jules handoff exists yet.'],
        expectedProof: 'Jules session id, session URL, state, and launch timestamp.',
        receipt: manifestHandoff?.launchedAt ?? null,
      },
      {
        id: 'jules_session',
        label: 'Jules session',
        status: hasSession ? 'active' : 'waiting',
        sourceId: manifestHandoff?.id ?? null,
        sourceTitle: manifestHandoff?.title ?? null,
        detail: hasSession
          ? `Jules state is ${manifestHandoff?.julesState ?? 'unknown'}.`
          : 'Waiting for Jules launch and status refresh.',
        endpoint: manifestHandoff ? `${baseUrl}/api/v1/jules-handoffs/${encodeURIComponent(manifestHandoff.id)}/refresh-status` : null,
        method: manifestHandoff ? 'POST' : 'NONE',
        canRunNow: Boolean(hasSession && manifestHandoff),
        mutatesGitIfRun: false,
        mutatesExternalSystemsIfRun: false,
        mutatesLocalFilesIfRun: Boolean(hasSession && manifestHandoff),
        blockedBy: hasSession ? [] : ['Jules session receipt is missing.'],
        expectedProof: 'Refreshed Jules state, plan approval state, or PR/session boundary.',
        receipt: manifestHandoff?.julesSessionUrl ?? manifestHandoff?.julesSessionId ?? null,
      },
      {
        id: 'github_pr',
        label: 'GitHub PR',
        status: hasDashboardPr ? (hasPrBlocker ? 'blocked' : 'active') : hasObservedPr ? 'observed' : 'waiting',
        sourceId: prHandoff?.id ?? null,
        sourceTitle: prHandoff?.title ?? null,
        detail: hasPr
          ? `PR state is ${prState ?? 'unknown'}${hasObservedPr ? '; observed records stay watch-only.' : '.'}`
          : 'Waiting for Jules to create a PR.',
        endpoint: prHandoff ? `${baseUrl}/api/v1/jules-handoffs/${encodeURIComponent(prHandoff.id)}/refresh-pr` : null,
        method: prHandoff ? 'POST' : 'NONE',
        canRunNow: Boolean(prHandoff?.githubPullRequestUrl),
        mutatesGitIfRun: false,
        mutatesExternalSystemsIfRun: false,
        mutatesLocalFilesIfRun: false,
        blockedBy: hasPrBlocker ? ['GitHub checks report failing jobs.'] : [],
        expectedProof: 'Refreshed PR state, checks, changed files, comments, and risk classification.',
        receipt: prHandoff?.githubPullRequestUrl ?? null,
      },
      {
        id: 'scout_core',
        label: 'Scout/Core review',
        status: scoutAttention ? 'blocked' : 'waiting',
        sourceId: prHandoff?.id ?? null,
        sourceTitle: prHandoff?.title ?? null,
        detail: scoutAttention
          ? conflictWatch.summary
          : hasPr
            ? 'Waiting for Scout/Core readiness or merge review evidence.'
            : 'Waiting for a Jules PR before Scout/Core can review.',
        endpoint: (prHandoff?.next_action?.url as string | null) ?? null,
        method: (prHandoff?.next_action?.method as 'GET' | 'POST' | 'NONE' | undefined) ?? 'NONE',
        canRunNow: false,
        mutatesGitIfRun: false,
        mutatesExternalSystemsIfRun: false,
        mutatesLocalFilesIfRun: false,
        blockedBy: scoutAttention ? [conflictWatch.summary] : [],
        expectedProof: 'Scout/Core readiness, conflict bridge result, or explicit review blocker.',
        receipt: prHandoff?.githubPullRequestFeedback?.summary ?? null,
      },
      {
        id: 'local_sync',
        label: 'Local sync',
        status: localSyncSafe ? 'ready' : prState === 'MERGED' ? 'blocked' : 'waiting',
        sourceId: localSyncHandoff?.id ?? null,
        sourceTitle: localSyncHandoff?.title ?? null,
        detail: localSyncSafe
          ? 'Merged PR can be safely fast-forwarded locally.'
          : prState === 'MERGED'
            ? 'Merged PR exists, but local sync safety is not proven.'
            : 'Waiting for a merged dashboard-started Jules PR.',
        endpoint: localSyncHandoff ? `${baseUrl}/api/v1/jules-handoffs/${encodeURIComponent(localSyncHandoff.id)}/sync-local` : null,
        method: localSyncHandoff ? 'POST' : 'NONE',
        canRunNow: localSyncSafe,
        mutatesGitIfRun: localSyncSafe,
        mutatesExternalSystemsIfRun: false,
        mutatesLocalFilesIfRun: localSyncSafe,
        blockedBy: localSync?.blockers ?? [],
        expectedProof: 'Safe fast-forward receipt and refreshed local GitHub sync preflight.',
        receipt: localSync?.summary ?? null,
      },
    ];

    const activeStages = stages.filter(stage => stage.status === 'active');
    const current = stages.find(stage => stage.status === 'blocked')
      ?? stages.find(stage => stage.status === 'ready')
      ?? activeStages[activeStages.length - 1]
      ?? stages.find(stage => stage.status === 'waiting')
      ?? stages[stages.length - 1];
    const status: MiddlemanPathPacket['status'] = current.status === 'complete' || current.status === 'observed'
      ? 'complete'
      : current.status;
    const foremanAction = this.buildMiddlemanForemanAction(baseUrl, current);

    return {
      status,
      currentBoundary: current.id,
      currentBoundaryLabel: current.label,
      summary: `${current.label}: ${current.detail}`,
      nextExpectedProof: current.expectedProof,
      foremanAction,
      stages,
      safetyNote: 'Read-only path packet: this response does not mutate Git, Linear, Jules, GitHub, Scout/Core, local files, or worker state.',
    };
  }

  private buildMiddlemanForemanAction(baseUrl: string, stage: MiddlemanPathStage): MiddlemanForemanAction {
    const blockedReason = stage.blockedBy.length ? stage.blockedBy.join(' ') : null;
    const canRunBoundary = stage.canRunNow && stage.endpoint !== null;
    const safety = this.middlemanActionSafety(stage, canRunBoundary);
    const evidenceEndpoint = this.middlemanActionEvidenceEndpoint(stage);

    // The foreman action is deliberately derived from the current ladder stage.
    // This keeps Symphony from growing a second action model that could disagree
    // with the dashboard path about what is safe, what is blocked, or what proof
    // must be captured before the next boundary advances.
    if (stage.id === 'git_sync' && stage.status === 'blocked') {
      return {
        boundary: stage.id,
        boundaryLabel: stage.label,
        label: 'Resolve Git disposition before Linear/Jules',
        status: stage.status,
        method: 'NONE',
        endpoint: null,
        evidenceEndpoint: `${baseUrl}/api/v1/git-disposition/review`,
        recordEndpoint: `${baseUrl}/api/v1/git-disposition`,
        canRunNow: false,
        requiresOperator: true,
        safety: 'operator_only',
        mutatesGitIfRun: false,
        mutatesExternalSystemsIfRun: false,
        mutatesLocalFilesIfRun: false,
        blockedReason,
        instruction: 'Review the Git disposition packet, record human-owned decisions for local commits, tracked changes, untracked artifacts, and remote commits, then rerun the GitHub sync preflight.',
        expectedProof: stage.expectedProof,
      };
    }

    return {
      boundary: stage.id,
      boundaryLabel: stage.label,
      label: `${canRunBoundary ? 'Run' : 'Wait for'} ${stage.label}`,
      status: stage.status,
      method: canRunBoundary ? stage.method : 'NONE',
      endpoint: canRunBoundary ? stage.endpoint : null,
      evidenceEndpoint,
      recordEndpoint: null,
      canRunNow: canRunBoundary,
      requiresOperator: !canRunBoundary || stage.mutatesGitIfRun || stage.mutatesExternalSystemsIfRun || stage.mutatesLocalFilesIfRun,
      safety,
      mutatesGitIfRun: canRunBoundary && stage.mutatesGitIfRun,
      mutatesExternalSystemsIfRun: canRunBoundary && stage.mutatesExternalSystemsIfRun,
      mutatesLocalFilesIfRun: canRunBoundary && stage.mutatesLocalFilesIfRun,
      blockedReason,
      instruction: canRunBoundary
        ? `Use the guarded ${stage.label} endpoint, then capture proof: ${stage.expectedProof}`
        : `Do not run ${stage.label} yet. Wait for the earlier proof or blocker resolution named by the middleman path.`,
      expectedProof: stage.expectedProof,
    };
  }

  private middlemanActionEvidenceEndpoint(stage: MiddlemanPathStage): string | null {
    if (!stage.endpoint) return null;

    // Mutating foreman actions need a read-only receipt URL where one exists.
    // This lets future automation inspect proof before crossing Linear, Jules,
    // or local Git boundaries without treating the mutation endpoint itself as
    // the evidence source.
    if (stage.id === 'linear_issue') return stage.endpoint.replace(/\/create-linear$/, '/linear-preview');
    if (stage.id === 'jules_launch') return stage.endpoint.replace(/\/launch$/, '/launch-readiness');
    if (stage.id === 'local_sync') return stage.endpoint.replace(/\/sync-local$/, '/refresh-local-sync');

    return stage.endpoint;
  }

  private middlemanActionSafety(stage: MiddlemanPathStage, canRunBoundary: boolean): MiddlemanForemanAction['safety'] {
    if (!canRunBoundary) return 'operator_only';
    if (stage.mutatesGitIfRun) return 'git_mutation';
    if (stage.mutatesExternalSystemsIfRun) return 'external_write';
    if (stage.mutatesLocalFilesIfRun) return 'local_state_only';
    if (stage.id === 'github_pr' || stage.id === 'jules_session') return 'external_read';
    return 'read_only';
  }

  private buildGitDispositionReviewPacket(baseUrl: string, snapshot: TaskDraftSnapshot): GitDispositionReviewPacket {
    const preflight = snapshot.preflight;
    const packet = preflight.resolutionPacket;
    const recordDispositionUrl = `${baseUrl}/api/v1/git-disposition`;
    const dispositionByCategory = new Map(
      (snapshot.gitDisposition?.categories ?? []).map(record => [record.category, record])
    );
    const definitions: Array<{ category: GitDispositionCategory; label: string; evidence: string[] }> = [
      {
        category: 'local_commits',
        label: 'Local-only commits',
        evidence: (packet?.localCommits ?? []).map(commit => `${commit.hash} ${commit.message}`.trim()),
      },
      {
        category: 'tracked_changes',
        label: 'Tracked edits and deletions',
        evidence: (packet?.trackedFiles ?? []).map(file => `${file.status} ${file.path}`.trim()),
      },
      {
        category: 'untracked_artifacts',
        label: 'Untracked artifacts',
        evidence: (packet?.untrackedFiles ?? []).map(file => `${file.status} ${file.path}`.trim()),
      },
      {
        category: 'remote_commits',
        label: 'Remote-only commits',
        evidence: (packet?.remoteCommits ?? []).map(commit => `${commit.hash} ${commit.message}`.trim()),
      },
    ];
    const activeCounts: Record<GitDispositionCategory, number> = {
      local_commits: preflight.ahead ?? 0,
      tracked_changes: preflight.dirtyFiles ?? 0,
      untracked_artifacts: preflight.untrackedFiles ?? 0,
      remote_commits: preflight.behind ?? 0,
    };
    const allowedDecisions = [
      'commit_for_jules_base',
      'keep_local',
      'generated_proof',
      'ignore',
      'needs_review',
      'integrate_after_local_safe',
    ];
    const categories = definitions
      .filter(definition => activeCounts[definition.category] > 0 || definition.evidence.length > 0)
      .map(definition => {
        const disposition = dispositionByCategory.get(definition.category);
        const status: GitDispositionReviewCategory['status'] = disposition?.decision === 'needs_review'
          ? 'needs_review'
          : disposition?.decision
            ? 'resolved'
            : 'missing_decision';
        const generatedCandidates = definition.category === 'untracked_artifacts'
          ? definition.evidence.filter(item => this.isGeneratedUntrackedEvidence(item)).length
          : 0;
        const sourceCandidates = definition.category === 'untracked_artifacts'
          ? Math.max(0, definition.evidence.length - generatedCandidates)
          : 0;

        // This review packet puts all evidence beside the current disposition
        // choice. It avoids the common failure mode where an agent sees "dirty
        // Git" and invents an unsafe cleanup plan without showing the files.
        return {
          category: definition.category,
          label: definition.label,
          status,
          currentDecision: disposition?.decision ?? null,
          currentDecisionLabel: disposition?.decisionLabel ?? 'Not decided',
          note: disposition?.note ?? '',
          evidenceCount: definition.evidence.length,
          evidence: definition.evidence,
          sourceCandidates,
          generatedCandidates,
          allowedDecisions,
          question: this.gitDispositionQuestion(definition.category),
        };
      });
    const requiredCategories = categories
      .filter(category => category.status === 'missing_decision' || category.status === 'needs_review')
      .map(category => category.category);
    const blockers = categories.flatMap(category => {
      if (category.status === 'needs_review') return [`${category.label} is marked needs review.`];
      if (category.status === 'missing_decision') return [`${category.label} is not decided.`];
      return [];
    });
    const status = preflight.ok
      ? 'ready'
      : categories.some(category => category.status === 'needs_review')
        ? 'blocked_by_review'
        : requiredCategories.length > 0
          ? 'blocked_by_decision'
          : (preflight.blockers ?? []).length > 0
            ? 'blocked_by_preflight_error'
            : 'ready';
    const summary = preflight.ok
      ? 'Git disposition review is ready; the GitHub sync gate is clean.'
      : requiredCategories.length > 0
        ? `Git disposition review is blocked by ${requiredCategories.length} category decision(s).`
        : status === 'blocked_by_preflight_error'
          ? 'Git disposition review has no category decisions left, but preflight still reports a blocker.'
          : 'Git disposition review is ready for the guarded human sync plan.';
    const readOnlyCommands = this.uniqueNonEmptyStrings([
      preflight.commands?.status,
      preflight.commands?.inspectDivergence,
      preflight.commands?.fetch,
      packet?.commands?.fullStatus,
      packet?.commands?.inspectDivergence,
    ]);

    return {
      generatedAt: preflight.checkedAt || new Date().toISOString(),
      status,
      mutatesGit: false,
      canRecordDispositions: true,
      recordDispositionUrl,
      summary,
      requiredCategories,
      blockers,
      categories,
      readOnlyCommands,
      safetyNote: 'This review packet does not run Git, pull, push, stash, clean, or change files. It only shows evidence and records operator disposition intent through the linked endpoint.',
    };
  }

  private isGeneratedUntrackedEvidence(value: string): boolean {
    const normalized = value.replace(/^\?\?\s*/, '').replaceAll('\\', '/').toLowerCase();
    return normalized.startsWith('.jules/')
      || normalized.startsWith('conductor/symphony/.symphony/')
      || normalized.includes('proof')
      || /\.(png|jpe?g|gif|webp|zip|json|log)$/i.test(normalized);
  }

  private gitDispositionQuestion(category: GitDispositionCategory): string {
    const questions: Record<GitDispositionCategory, string> = {
      local_commits: 'Should these local-only commits become part of the Jules base, remain local, or wait for review?',
      tracked_changes: 'Should these tracked edits be committed, kept local, ignored for this handoff, or reviewed first?',
      untracked_artifacts: 'Which untracked files are source work, which are generated proof, and which should stay out of the handoff?',
      remote_commits: 'Should remote-only commits be integrated after local work is safe?',
    };
    return questions[category];
  }

  private uniqueNonEmptyStrings(values: Array<string | null | undefined>): string[] {
    return Array.from(new Set(values
      .map(value => typeof value === 'string' ? value.trim() : '')
      .filter(Boolean)));
  }

  private getLinearIssueCapability(config: ReturnType<Orchestrator['getConfig']>): LinearIssueCapability {
    const tracker = config?.tracker;

    // Linear-backed workflows require a tracking issue before handoff, but the
    // create button is only honest when the credentials and project slug are
    // present. Keep those states separate so the dashboard can say "blocked by
    // Linear config" instead of pretending local/mock mode is the problem.
    if (!tracker || tracker.kind !== 'linear') {
      return {
        canCreateLinearIssue: false,
        requiresLinearIssueForHandoff: false,
        linearProjectSlug: null,
        linearIssueCreationBlocker: 'Symphony is not running with a Linear tracker workflow.',
      };
    }

    const projectSlug = typeof tracker.projectSlug === 'string' ? tracker.projectSlug.trim() : '';
    const apiKey = typeof tracker.apiKey === 'string' ? tracker.apiKey.trim() : '';

    if (!apiKey) {
      return {
        canCreateLinearIssue: false,
        requiresLinearIssueForHandoff: true,
        linearProjectSlug: projectSlug || null,
        linearIssueCreationBlocker: 'Linear API key is missing. Set tracker.api_key or LINEAR_API_KEY before creating dashboard tasks.',
      };
    }

    if (!projectSlug) {
      return {
        canCreateLinearIssue: false,
        requiresLinearIssueForHandoff: true,
        linearProjectSlug: null,
        linearIssueCreationBlocker: 'Linear project slug is missing. Set tracker.project_slug before creating dashboard tasks.',
      };
    }

    return {
      canCreateLinearIssue: true,
      requiresLinearIssueForHandoff: true,
      linearProjectSlug: projectSlug,
      linearIssueCreationBlocker: null,
    };
  }

  private buildKickoffGuide(canCreateLinearIssue: boolean): {
    title: string;
    summary: string;
    steps: Array<{ label: string; detail: string }>;
    fields: Record<string, string>;
  } {
    // This guide is intentionally duplicated into the API, not only the
    // browser. A headless foreman can read /api/v1/task-drafts and understand
    // the operator workflow without already knowing Linear, Jules manifests, or
    // Symphony's button order.
    return {
      title: 'How to start a Jules task',
      summary: 'Draft locally, create the tracking issue when Linear is available, then let Symphony stage and launch the bounded Jules handoff after GitHub sync passes.',
      steps: [
        { label: 'Check GitHub Sync', detail: 'Local master must match GitHub and the working tree must be intentionally clean before Jules starts.' },
        { label: 'Save Draft', detail: 'Capture the task in plain language with expected files and verification commands.' },
        {
          label: 'Create Linear Issue',
          detail: canCreateLinearIssue
            ? 'Create the tracking ticket Symphony workers can claim and report against.'
            : 'Unavailable in this workflow until Symphony is connected to Linear.',
        },
        { label: 'Prepare Handoff', detail: 'Generate the bounded prompt a foreman can hand to Jules.' },
        { label: 'Stage Jules Manifest', detail: 'Write the local .jules manifest for review before any cloud session starts.' },
        { label: 'Launch Jules', detail: 'Start the Jules cloud session, then monitor PR checks, Scout/Core review, and local sync.' },
      ],
      fields: {
        title: 'Short human name for the work.',
        body: 'Plain-language task details, constraints, and intended result.',
        expectedFiles: 'Expected files / write scope. Required so Jules, Scout, and Core can detect scope drift.',
        verificationCommands: 'Required verification commands Jules, Scout, or Core should run or report before merge.',
      },
    };
  }

  private buildQueueNextAction(
    baseUrl: string,
    snapshot: TaskDraftSnapshot,
    drafts: Array<TaskDraftSnapshot['drafts'][number] & { next_action: Record<string, unknown> }>,
    handoffs: Array<TaskDraftSnapshot['handoffs'][number] & { next_action: Record<string, unknown> }>,
    conflictWatch: TaskConflictWatch,
  ): Record<string, unknown> {
    const attachSource = (
      action: Record<string, unknown>,
      sourceType: string,
      sourceId: string | null,
      url: string | null = typeof action.url === 'string' ? action.url : null,
      method: string | null = typeof action.method === 'string' ? action.method : null,
    ) => ({
      ...action,
      source_type: sourceType,
      source_id: sourceId,
      url,
      method,
    });

    // The queue-level action is the single safest thing a worker or operator
    // should look at first. Git sync blocks everything Jules-related, so it
    // outranks individual draft/handoff actions whenever the gate is red.
    if (!snapshot.preflight.ok && snapshot.preflight.nextAction) {
      return attachSource(
        snapshot.preflight.nextAction as unknown as Record<string, unknown>,
        'git_preflight',
        null,
        `${baseUrl}/api/v1/git-preflight`,
        'POST',
      );
    }

    if (conflictWatch.next_action) {
      return attachSource(conflictWatch.next_action, 'conflict_watch', null);
    }

    const firstHandoff = this.pickQueueHandoff(handoffs);
    if (firstHandoff?.next_action) {
      return attachSource(firstHandoff.next_action, 'handoff', firstHandoff.id);
    }

    const firstDraft = drafts[0];
    if (firstDraft?.next_action) {
      // Once a handoff exists, Symphony is already babysitting Jules/GitHub
      // return work. Service that before encouraging new draft intake, because
      // plan approvals, PR checks, and local sync are the places cloud work can
      // stall or conflict with local master.
      return attachSource(firstDraft.next_action, 'draft', firstDraft.id);
    }

    return {
      code: 'draft_task',
      tone: 'waiting',
      label: 'Draft a Jules Task',
      summary: 'GitHub is ready, but there are no local drafts or Jules handoffs yet.',
      url: `${baseUrl}/api/v1/task-drafts`,
      method: 'POST',
      steps: [
        'Describe a bounded task for Jules.',
        'Add expected files or leave the scope analysis-only.',
        'Save the draft before preparing a handoff.',
      ],
      // This is the first API action in the dashboard-first workflow. Keep the
      // body shape on the action so workers and external operators can create a
      // draft without reverse-engineering the dashboard form fields.
      request_body_schema: {
        title: 'string',
        body: 'string',
        expectedFiles: 'string[] | newline-separated string',
        verificationCommands: 'string[] | newline-separated string',
      },
      request_body_example: {
        title: 'Bounded Jules task title',
        body: 'Plain-language task details, constraints, and intended result.',
        expectedFiles: ['src/path/or/write-scope'],
        verificationCommands: ['npm.cmd run build'],
      },
      source_type: 'task_queue',
      source_id: null,
    };
  }

  private pickQueueHandoff(
    handoffs: Array<TaskDraftSnapshot['handoffs'][number] & { next_action: Record<string, unknown> }>,
  ): (TaskDraftSnapshot['handoffs'][number] & { next_action: Record<string, unknown> }) | null {
    const scored = handoffs
      .filter(handoff => handoff.next_action)
      .map((handoff, index) => ({
        handoff,
        index,
        score: this.queueHandoffActionScore(handoff.next_action),
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index);

    // Handoffs represent cloud work already in flight or returned through
    // GitHub. A completed handoff can stay visible on its card, but the
    // queue-level "what now?" should first surface plan approvals, PR blockers,
    // Scout/Core review, and local sync work that can stall the pipeline.
    return scored[0]?.handoff ?? null;
  }

  private queueHandoffActionScore(action: Record<string, unknown>): number {
    const code = typeof action.code === 'string' ? action.code : '';
    const tone = typeof action.tone === 'string' ? action.tone : '';

    if (code === 'complete' || code === 'local_master_current') return 0;
    if (tone === 'blocked') return 40;
    if (tone === 'ready') return 30;
    if (tone === 'waiting') return 20;
    return 10;
  }

  private buildConflictWatch(
    handoffs: Array<TaskDraftSnapshot['handoffs'][number] & { next_action?: Record<string, unknown> }>,
  ): TaskConflictWatch {
    const records: Array<{
      key: string;
      path: string;
      handoffId: string;
      title: string;
      pullRequestUrl: string | null;
      risk: 'low' | 'medium' | 'high';
      reason: string | null;
    }> = [];

    // The browser has a visual conflict panel, but the API needs the same
    // compact signal so headless foremen can coordinate several Jules PRs
    // without scraping dashboard HTML. Only active PRs participate; merged or
    // closed PRs move into the local-sync path instead.
    for (const handoff of handoffs) {
      if (!handoff.githubPullRequestUrl) continue;
      if (handoff.githubPullRequestState === 'MERGED' || handoff.githubPullRequestState === 'CLOSED') continue;

      const files = Array.isArray(handoff.githubPullRequestFiles?.files)
        ? handoff.githubPullRequestFiles.files
        : [];

      for (const file of files) {
        const path = typeof file.path === 'string' ? file.path : '';
        if (!path) continue;

        records.push({
          key: this.normalizeConflictPath(path),
          path,
          handoffId: handoff.id,
          title: handoff.title,
          pullRequestUrl: handoff.githubPullRequestUrl,
          risk: file.risk === 'high' || file.risk === 'medium' ? file.risk : 'low',
          reason: typeof file.reason === 'string' ? file.reason : null,
        });
      }
    }

    const byPath = new Map<string, typeof records>();
    for (const record of records) {
      const bucket = byPath.get(record.key) ?? [];
      bucket.push(record);
      byPath.set(record.key, bucket);
    }

    const overlapFiles = [...byPath.values()]
      .filter(items => new Set(items.map(item => item.handoffId)).size > 1)
      .map(items => ({
        path: items[0].path,
        handoffs: items.map(item => ({
          id: item.handoffId,
          title: item.title,
          pull_request_url: item.pullRequestUrl,
        })),
      }));
    const riskFiles = records
      .filter(record => record.risk !== 'low' || record.reason)
      .map(record => ({
        path: record.path,
        handoff_id: record.handoffId,
        title: record.title,
        pull_request_url: record.pullRequestUrl,
        risk: record.risk === 'high' ? 'high' as const : 'medium' as const,
        reason: record.reason,
      }));

    const status: TaskConflictWatch['status'] = overlapFiles.length
      ? 'blocked'
      : riskFiles.length
        ? 'attention'
        : 'clear';
    const summary = overlapFiles.length
      ? `${overlapFiles.length} file(s) are changed by multiple active Jules PRs. Scout should bridge before Core merges.`
      : riskFiles.length
        ? `${riskFiles.length} conflict-prone file change(s) need Scout attention before Core merges.`
        : 'No overlapping or conflict-prone active Jules PR files are visible.';
    const affectedPrUrls = this.collectConflictPullRequestUrls(overlapFiles, riskFiles);

    const overlapFilePaths = overlapFiles.map(item => item.path).slice(0, 40);
    const riskFilePaths = riskFiles.map(item => item.path).slice(0, 40);

    return {
      status,
      summary,
      overlap_files: overlapFiles.slice(0, 40),
      risk_files: riskFiles.slice(0, 40),
      next_action: status === 'clear'
        ? null
        : {
            code: status === 'blocked' ? 'bridge_cross_handoff_conflicts' : 'bridge_conflict_prone_files',
            tone: 'blocked',
            label: status === 'blocked' ? 'Bridge Jules PR Conflicts' : 'Bridge Conflict-Prone Files',
            summary,
            url: null,
            method: null,
            affected_pr_urls: affectedPrUrls,
            overlap_file_paths: overlapFilePaths,
            risk_file_paths: riskFilePaths,
            // Conflict watch is not a button action; it is a coordination stop.
            // Put the affected PRs and file paths on the machine-readable
            // action so foremen can route risk through Scout before Core treats
            // the PR as merge-ready, even when only one active PR is involved.
            steps: status === 'blocked'
              ? [
                  'Open the overlapping Jules PRs listed in affected_pr_urls and conflict_watch.overlap_files.',
                  'Have Scout decide which PR owns each shared file before Core merges either PR.',
                  'Refresh all Jules handoffs after the overlap is resolved.',
                ]
              : [
                  'Open the affected Jules PRs listed in affected_pr_urls and conflict_watch.risk_files.',
                  'Have Scout review the conflict-prone files before Core validates or merges.',
                  'Refresh all Jules handoffs after Scout records the risk decision.',
                ],
          },
    };
  }

  private collectConflictPullRequestUrls(
    overlapFiles: TaskConflictWatch['overlap_files'],
    riskFiles: TaskConflictWatch['risk_files'],
  ): string[] {
    const urls = new Set<string>();

    // Queue-level next_action is what headless foremen read first. Put the PR
    // URLs directly on that action so workers can open the affected Jules PRs
    // without reverse-engineering the nested dashboard conflict payload.
    for (const file of overlapFiles) {
      for (const handoff of file.handoffs) {
        if (handoff.pull_request_url) urls.add(handoff.pull_request_url);
      }
    }

    for (const file of riskFiles) {
      if (file.pull_request_url) urls.add(file.pull_request_url);
    }

    return [...urls].slice(0, 40);
  }

  private normalizeConflictPath(path: string): string {
    return path.trim().replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
  }

  private buildDraftNextAction(
    baseUrl: string,
    draft: TaskDraftSnapshot['drafts'][number],
    options: {
      requiresLinearIssueForHandoff: boolean;
      canCreateLinearIssue: boolean;
      linearIssueCreationBlocker: string | null;
    },
  ): Record<string, unknown> {
    const links = this.buildDraftLinks(baseUrl, draft.id);
    const action = (
      code: string,
      tone: 'blocked' | 'ready' | 'waiting',
      label: string,
      summary: string,
      url: string | null,
      method: 'GET' | 'POST' | null,
      steps: string[],
      extra: Record<string, unknown> = {},
    ) => ({ code, tone, label, summary, url, method, steps, ...extra });

    // Drafts are the pre-Jules part of the dashboard-first workflow. Give
    // headless foremen the same safe next click the human sees: first satisfy
    // GitHub sync, then create the Linear tracker issue when this workflow
    // requires one, then promote the draft into a bounded Jules handoff.
    if (draft.status === 'blocked_by_git_sync') {
      return action('check_git_sync', 'blocked', 'Check GitHub Sync',
        'GitHub sync must pass before this draft can become a Jules handoff.',
        `${baseUrl}/api/v1/git-preflight`,
        'POST',
        ['Clean, commit, or push the intended local work.', 'Recheck the GitHub sync gate.', 'Only prepare a handoff once local master and GitHub agree.']);
    }

    if (options.requiresLinearIssueForHandoff && !draft.linearIssueId) {
      if (!options.canCreateLinearIssue) {
        return action('linear_issue_config_blocked', 'blocked', 'Linear Issue Blocked',
          options.linearIssueCreationBlocker ?? 'Linear issue creation is not available in this workflow.',
          links.createLinearIssue,
          'POST',
          ['Fix the Linear tracker configuration.', 'Re-run Check GitHub Sync if the repository changed.', 'Create the Linear tracking issue before preparing the Jules handoff.']);
      }

      return action('create_linear_issue', 'ready', 'Create Linear Issue',
        'This workflow requires a Linear issue before Symphony prepares the Jules handoff.',
        links.createLinearIssue,
        'POST',
        ['Review the draft title, write scope, and test commands.', 'Create the Linear tracking issue.', 'Use the linked issue as the foreman status thread.']);
    }

    return action('prepare_handoff', 'ready', 'Prepare Handoff',
      'Convert this draft into a bounded Jules handoff with prompt, write scope, and verification commands.',
      links.promote,
      'POST',
      ['Review expected files and verification commands.', 'Prepare the Jules handoff.', 'Stage the Jules manifest from the handoff card.']);
  }

  private buildHandoffNextAction(baseUrl: string, handoff: TaskDraftSnapshot['handoffs'][number]): Record<string, unknown> {
    const links = this.buildHandoffLinks(baseUrl, handoff.id);
    const hasManifest = Boolean(handoff.manifestPath);
    const hasSession = Boolean(handoff.julesSessionId || handoff.julesSessionUrl || handoff.julesState);
    const hasPullRequest = Boolean(handoff.githubPullRequestUrl);
    const pullRequestMerged = handoff.githubPullRequestState === 'MERGED';
    const pullRequestBlocked =
      handoff.githubPullRequestState === 'CLOSED' ||
      handoff.githubPullRequestMergeable === 'CONFLICTING' ||
      handoff.githubPullRequestChecks?.conclusion === 'failing';
    const pullRequestContext = hasPullRequest
      ? {
        // PR-stage actions are intended to hand control back and forth between
        // Jules, Scout, Core, and the local operator. Carry the exact GitHub URL
        // on each action so dashboard users and headless foremen inspect the
        // same remote review surface before deciding what to do next.
        github_pull_request_url: handoff.githubPullRequestUrl,
      }
      : {};

    const action = (
      code: string,
      tone: 'blocked' | 'ready' | 'waiting',
      label: string,
      summary: string,
      url: string | null,
      method: 'GET' | 'POST' | null,
      steps: string[],
      extra: Record<string, unknown> = {},
    ) => ({ code, tone, label, summary, url, method, steps, ...extra });

    // This mirrors the dashboard's operator plan in a compact JSON shape. The
    // browser can render richer guidance, but headless Codex foremen need the
    // same safe next button without scraping client-side HTML or guessing URLs.
    if (handoff.status === 'observed_pr') {
      if (handoff.githubPullRequestState === 'CLOSED') {
        return action('record_observed_learning', 'waiting', 'Record Observed Learning',
          'This watched PR is closed historical evidence. Keep it read-only, use its comments/checks/files for learning, and create a new bounded task if the lesson needs follow-up work.',
          links.refreshPullRequest,
          'POST',
          ['Refresh the observed PR evidence if GitHub comments changed.', 'Review Scout conflict and external-review lanes.', 'Create a new task draft for any follow-up instead of repairing this old PR.'],
          {
            ...pullRequestContext,
            follow_up_draft_url: links.createFollowUpDraft,
          });
      }

      if (handoff.githubPullRequestNextAction) {
        const prAction = handoff.githubPullRequestNextAction;
        return action(prAction.code, prAction.tone, prAction.label,
          prAction.summary,
          prAction.url || links.refreshPullRequest,
          'POST',
          prAction.steps,
          {
            ...pullRequestContext,
            command: prAction.command,
            pull_request_next_action: prAction,
          });
      }

      // Observed PRs reuse the PR-readiness panels, but they are not Jules
      // handoffs from this dashboard run. Keep their next action on the
      // read-only GitHub refresh lane until remote evidence says otherwise.
      return action('refresh_observed_pr', 'ready', 'Refresh Observed PR',
        'This is a watched GitHub PR. Refresh checks, mergeability, comments, and Scout/Core/Jules feedback without staging or launching Jules.',
        links.refreshPullRequest,
        'POST',
        ['Refresh the observed PR state.', 'Review checks, comments, and changed-file risk.', 'Use the feedback lanes for learning or course correction.'],
        {
          ...pullRequestContext,
          follow_up_draft_url: links.createFollowUpDraft,
        });
    }

    if (handoff.status === 'blocked_by_git_sync') {
      return action('check_git_sync', 'blocked', 'Check GitHub Sync',
        handoff.gitPreflight?.summary || 'GitHub sync must pass before this handoff can move.',
        `${baseUrl}/api/v1/git-preflight`,
        'POST',
        ['Clean or commit local work that Jules needs.', 'Push the intended base to GitHub.', 'Recheck GitHub sync before staging Jules.']);
    }

    if (handoff.status === 'base_commit_stale') {
      return action('stage_manifest', 'blocked', 'Re-stage Jules Manifest',
        handoff.baseCommitDrift?.summary || 'GitHub moved after this handoff was prepared.',
        links.stageManifest,
        'POST',
        ['Review the old and current GitHub base commits.', 'Stage the Jules manifest again.', 'Launch only after the manifest uses the current GitHub base.']);
    }

    if (!hasManifest) {
      return action('stage_manifest', 'ready', 'Stage Jules Manifest',
        'The prompt exists locally; write the Jules manifest before launch.',
        links.stageManifest,
        'POST',
        ['Review the expected files and verification commands.', 'Stage the Jules manifest.', 'Confirm the manifest records the synced GitHub base.']);
    }

    if (handoff.status === 'launch_failed') {
      return action('launch_jules', 'blocked', 'Repair and Launch Jules',
        handoff.launchError || 'The manifest exists, but the Jules launch command failed.',
        links.launch,
        'POST',
        ['Inspect the launch error.', 'Repair the Jules or environment issue.', 'Launch again after the GitHub sync gate still passes.']);
    }

    if (!hasSession) {
      return action('launch_jules', 'ready', 'Launch Jules',
        'The manifest is ready. Start the cloud Jules run.',
        links.launch,
        'POST',
        ['Launch Jules.', 'Wait for the session id or Jules state.', 'Refresh status if the session does not update automatically.']);
    }

    if (handoff.julesState === 'AWAITING_PLAN_APPROVAL') {
      return action('approve_jules_plan', 'ready', 'Approve Jules Plan',
        'Jules is waiting for the operator to approve its proposed plan before it continues.',
        links.approvePlan,
        'POST',
        ['Review the Jules plan in the session link or latest status output.', 'Approve only if the plan respects the write scope and verification contract.', 'Refresh Jules status after approving.'],
        {
          // The approval endpoint is local, but the decision belongs to the
          // cloud Jules plan. Put the exact session on the next_action so
          // headless foremen and the dashboard do not approve blind.
          jules_session_id: handoff.julesSessionId,
          jules_session_url: handoff.julesSessionUrl,
        });
    }

    if (handoff.julesState === 'AWAITING_USER_FEEDBACK') {
      return action('send_jules_feedback', 'ready', 'Send Jules Feedback',
        'Jules is waiting for operator feedback before it can continue.',
        links.message,
        'POST',
        ['Open the Jules session to read the request.', 'Write a bounded operator note that preserves the task scope.', 'Send the note through Symphony, then refresh Jules status.'],
        {
          // Feedback uses the existing message bridge rather than a new
          // terminal-only path. Include the session link so foremen inspect the
          // cloud request before deciding what feedback belongs in Symphony.
          jules_session_id: handoff.julesSessionId,
          jules_session_url: handoff.julesSessionUrl,
          // The message endpoint requires a JSON body. Put that contract on
          // the action so headless foremen do not have to reverse-engineer the
          // dashboard textarea before sending bounded feedback to Jules.
          request_body_schema: { body: 'string' },
          request_body_example: {
            body: 'Short bounded feedback for Jules after inspecting the session request.',
          },
        });
    }

    if (!hasPullRequest) {
      return action('refresh_jules_status', 'waiting', 'Refresh Jules Status',
        `Jules is ${handoff.julesState || 'running'}, but no PR URL has been captured yet.`,
        links.refreshStatus,
        'POST',
        ['Refresh Jules status.', 'Use operator notes if Jules needs feedback.', 'Wait for a PR URL before checking GitHub readiness.']);
    }

    if (!handoff.lastPullRequestRefreshAt) {
      return action('refresh_pull_request', 'ready', 'Refresh PR Checks',
        'A PR URL exists; read checks, mergeability, and changed-file risk.',
        links.refreshPullRequest,
        'POST',
        ['Refresh PR checks.', 'Review mergeability and changed files.', 'Let Scout/Core review before merge.'],
        pullRequestContext);
    }

    if (handoff.githubPullRequestNextAction) {
      const prAction = handoff.githubPullRequestNextAction;
      return action(prAction.code, prAction.tone, prAction.label,
        prAction.summary,
        // The PR readiness model may name a CLI command for Scout/Core, but
        // the dashboard-approved API action remains "refresh this PR status"
        // after the human or foreman acts. Preserve both so workers do not
        // collapse pending checks, failed checks, or Core readiness into a
        // generic Scout/Core label.
        prAction.url || links.refreshPullRequest,
        'POST',
        prAction.steps,
        {
          ...pullRequestContext,
          command: prAction.command,
          pull_request_next_action: prAction,
        });
    }

    if (pullRequestBlocked) {
      return action('resolve_pull_request_blockers', 'blocked', 'Resolve PR Blockers',
        'GitHub reports a closed, conflicting, or failing PR state.',
        links.refreshPullRequest,
        'POST',
        ['Inspect failed checks, conflicts, or risky files.', 'Send follow-up work to Jules or repair the PR.', 'Refresh PR checks after repair.'],
        pullRequestContext);
    }

    if (!pullRequestMerged) {
      return action('scout_core_review', 'waiting', 'Bridge Through Scout/Core',
        'The PR is visible. Scout should inspect risk before Core validates or merges.',
        links.refreshPullRequest,
        'POST',
        ['Refresh PR checks.', 'Have Scout review cross-PR and poison-file risk.', 'Let Core validate and merge only after Scout marks it ready.'],
        pullRequestContext);
    }

    if (!handoff.localSyncStatus) {
      return action('refresh_local_sync', 'ready', 'Check Local Sync',
        'The PR is merged; check local safety before pulling.',
        links.refreshLocalSync,
        'POST',
        ['Check local sync.', 'Confirm local master is clean and only behind GitHub.', 'Sync local master only after the check says it is safe.'],
        pullRequestContext);
    }

    if (handoff.localSyncStatus.nextAction) {
      const localAction = handoff.localSyncStatus.nextAction;
      const localActionUrl = localAction.code === 'sync_local_master'
        ? links.syncLocal
        : localAction.code === 'local_master_current'
          ? null
          : links.refreshLocalSync;
      const localActionMethod = localActionUrl ? 'POST' : null;

      return action(localAction.code, localAction.tone, localAction.label,
        localAction.summary,
        // Local sync has the highest mutation risk in this flow: it can pull
        // cloud Jules work into the user's checkout. Preserve the exact safety
        // decision while pointing mutating sync to the guarded endpoint and
        // blocked/waiting states back to the read-only refresh endpoint.
        localActionUrl,
        localActionMethod,
        localAction.steps,
        {
          ...pullRequestContext,
          command: localAction.command,
          local_sync_next_action: localAction,
        });
    }

    if (handoff.localSyncStatus.safeToPull) {
      return action('sync_local_master', 'ready', 'Sync Local Master',
        handoff.localSyncStatus.summary || 'Local master can fast-forward from GitHub.',
        links.syncLocal,
        'POST',
        ['Sync local master.', 'Confirm the pull or fast-forward succeeded.', 'Start the next Jules task only after local master is current.'],
        pullRequestContext);
    }

    if (handoff.localSyncStatus.upToDate) {
      return action('complete', 'ready', 'Local Checkout Current',
        handoff.localSyncStatus.summary || 'The merged Jules work is already present on local master.',
        null,
        null,
        ['Review the local sync check time.', 'Use the dashboard to draft the next bounded Jules task.'],
        pullRequestContext);
    }

    return action('resolve_local_sync_blockers', 'blocked', 'Resolve Local Sync Blockers',
      handoff.localSyncStatus.summary || 'Symphony found a local safety blocker.',
      links.refreshLocalSync,
      'POST',
      ['Read the local sync blockers.', 'Clean, commit, or switch branches intentionally.', 'Re-run local sync before pulling from GitHub.'],
      pullRequestContext);
  }

  private buildDraftLinks(baseUrl: string, draftId: string): Record<string, string> {
    const encoded = encodeURIComponent(draftId);
    return {
      handoffReadiness: `${baseUrl}/api/v1/task-drafts/${encoded}/handoff-readiness`,
      linearIssuePreview: `${baseUrl}/api/v1/task-drafts/${encoded}/linear-preview`,
      julesManifestPreview: `${baseUrl}/api/v1/task-drafts/${encoded}/jules-manifest-preview`,
      createLinearIssue: `${baseUrl}/api/v1/task-drafts/${encoded}/create-linear`,
      promote: `${baseUrl}/api/v1/task-drafts/${encoded}/promote`,
    };
  }

  private buildHandoffReadinessPacket(
    baseUrl: string,
    draft: TaskDraftSnapshot['drafts'][number],
    preflight: TaskDraftSnapshot['preflight'],
    linearPreview: LinearIssuePreview,
    manifestPreview: JulesManifestPreview,
  ): HandoffReadinessPacket {
    const links = this.buildDraftLinks(baseUrl, draft.id);
    const blockers = !preflight.ok ? preflight.blockers : [];
    const status: HandoffReadinessPacket['status'] = blockers.length > 0 ? 'blocked' : 'ready';
    const linearStageStatus: HandoffReadinessStage['status'] = linearPreview.canCreateNow ? 'ready' : 'blocked';
    const manifestStageStatus: HandoffReadinessStage['status'] = manifestPreview.canStageNow ? 'ready' : 'blocked';
    const passPath = this.buildHandoffPassPath(baseUrl, draft, preflight, linearPreview, manifestPreview);
    const nextAction = passPath.actions.find(action => action.id === passPath.currentBoundary);

    // The readiness packet deliberately does not replace the individual Git,
    // Linear, or Jules packets. It summarizes them into one foreman checklist so
    // the operator can see the real handoff chain without clicking through
    // separate preview endpoints while Git is still unsafe for cloud work.
    return {
      draftId: draft.id,
      title: draft.title,
      status,
      summary: status === 'ready'
        ? 'Handoff readiness is ready for Linear issue creation.'
        : 'Handoff readiness is blocked by GitHub sync.',
      mutatesGit: false,
      mutatesExternalSystems: false,
      mutatesLocalFiles: false,
      blockers,
      nextOperatorAction: {
        label: this.handoffPassPathActionLabel(passPath.currentBoundary, Boolean(draft.linearIssueIdentifier)),
        detail: nextAction?.expectedProof ?? (status === 'ready'
          ? 'Use the next ready handoff boundary, then capture its receipt before advancing.'
          : 'Review the Git sync packet, record or carry out the human disposition, and re-run the preflight before creating Linear or Jules artifacts.'),
        method: nextAction?.method ?? 'POST',
        endpoint: nextAction?.endpoint ?? (status === 'ready' ? links.createLinearIssue : `${baseUrl}/api/v1/git-preflight`),
      },
      links: {
        self: links.handoffReadiness,
        gitPreflight: `${baseUrl}/api/v1/git-preflight`,
        linearIssuePreview: links.linearIssuePreview,
        julesManifestPreview: links.julesManifestPreview,
        taskNudge: `${baseUrl}/api/v1/task-nudges`,
      },
      stages: [
        {
          id: 'git_sync',
          label: 'GitHub Sync Gate',
          status: preflight.ok ? 'ready' : 'blocked',
          detail: preflight.summary,
          endpoint: `${baseUrl}/api/v1/git-preflight`,
          method: 'POST',
          blockers,
        },
        {
          id: 'linear_issue',
          label: 'Linear Issue Packet',
          status: linearStageStatus,
          detail: linearPreview.canCreateNow
            ? 'Linear issue creation can run after operator confirmation.'
            : 'Linear issue packet is previewable, but creation remains blocked until GitHub sync and Linear configuration are ready.',
          endpoint: linearPreview.canCreateNow ? linearPreview.createLinearIssueUrl : linearPreview.createLinearIssueUrl,
          method: 'POST',
          blockers: linearPreview.blockers,
        },
        {
          id: 'jules_manifest',
          label: 'Jules Manifest Packet',
          status: manifestStageStatus,
          detail: `Jules manifest packet is previewable at ${manifestPreview.manifestPath}, but staging waits for Git sync and Linear tracking.`,
          endpoint: manifestPreview.stageManifestUrl,
          method: 'POST',
          blockers: manifestPreview.blockers,
        },
        {
          id: 'jules_launch',
          label: 'Jules Launch',
          status: 'waiting',
          detail: 'Jules launch waits until the handoff exists, the manifest is staged, and the existing .jules/orchestrator launch command is available.',
          endpoint: null,
          method: 'NONE',
          blockers: manifestPreview.canStageNow ? [] : ['Stage the Jules manifest before launch.'],
        },
        {
          id: 'first_nudge',
          label: 'First Task Nudge',
          status: 'ready',
          detail: 'A foreman can record the current wait or refresh decision as task-tracking evidence without mutating GitHub, Linear, Jules, or local files.',
          endpoint: `${baseUrl}/api/v1/task-nudges`,
          method: 'POST',
          blockers: [],
        },
      ],
      passPath,
      safetyNote: 'Read-only packet: this response does not change Git, call Linear, write .jules files, launch Jules, create a PR, or start local sync.',
    };
  }

  private buildHandoffPassPath(
    baseUrl: string,
    draft: TaskDraftSnapshot['drafts'][number],
    preflight: TaskDraftSnapshot['preflight'],
    linearPreview: LinearIssuePreview,
    manifestPreview: JulesManifestPreview,
  ): HandoffPassPath {
    const links = this.buildDraftLinks(baseUrl, draft.id);
    const hasLinearIssue = Boolean(draft.linearIssueIdentifier);
    const linearStatus: HandoffPassPathAction['status'] = hasLinearIssue
      ? 'complete'
      : linearPreview.canCreateNow
        ? 'ready'
        : preflight.ok
          ? 'blocked'
          : 'waiting';
    const manifestStatus: HandoffPassPathAction['status'] = manifestPreview.canStageNow
      ? 'ready'
      : preflight.ok
        ? 'waiting'
        : 'waiting';

    // The pass path is the clean-gate counterpart to the blocked Git review
    // packet. It names the next boundary that can actually run after Git sync
    // passes, but it keeps the packet itself read-only so the dashboard can
    // display future mutations without performing them.
    const actions: HandoffPassPathAction[] = [
      {
        id: 'git_sync',
        label: 'GitHub Sync Gate',
        status: preflight.ok ? 'complete' : 'blocked',
        canRunNow: !preflight.ok,
        method: 'POST',
        endpoint: `${baseUrl}/api/v1/git-preflight`,
        mutatesGitIfRun: false,
        mutatesExternalSystemsIfRun: false,
        mutatesLocalFilesIfRun: false,
        blockedBy: preflight.ok ? [] : preflight.blockers,
        expectedProof: preflight.ok
          ? `Passing GitHub sync receipt for ${preflight.remoteBranch} at ${preflight.remoteCommit ?? 'unknown commit'}.`
          : 'Passing GitHub sync receipt before Linear or Jules starts.',
        receipt: preflight.ok ? `${preflight.remoteBranch} @ ${preflight.remoteCommit ?? 'unknown'}` : null,
      },
      {
        id: 'linear_issue',
        label: 'Linear Tracking Issue',
        status: linearStatus,
        canRunNow: linearPreview.canCreateNow,
        method: 'POST',
        endpoint: links.createLinearIssue,
        mutatesGitIfRun: false,
        mutatesExternalSystemsIfRun: linearPreview.canCreateNow,
        mutatesLocalFilesIfRun: false,
        blockedBy: hasLinearIssue ? [] : linearPreview.blockers,
        expectedProof: 'Linear issue receipt with identifier, URL, synced branch, and synced commit.',
        receipt: draft.linearIssueIdentifier ?? null,
      },
      {
        id: 'jules_manifest',
        label: 'Jules Handoff Manifest',
        status: manifestStatus,
        canRunNow: manifestPreview.canStageNow,
        method: 'POST',
        endpoint: links.promote,
        mutatesGitIfRun: false,
        mutatesExternalSystemsIfRun: false,
        mutatesLocalFilesIfRun: manifestPreview.canStageNow,
        blockedBy: manifestPreview.canStageNow ? [] : manifestPreview.blockers,
        expectedProof: 'Staged .jules/orchestrator manifest path plus launch/status commands.',
        receipt: manifestPreview.canStageNow ? manifestPreview.manifestPath : null,
      },
      {
        id: 'first_nudge',
        label: 'First Foreman Nudge',
        status: 'ready',
        canRunNow: true,
        method: 'POST',
        endpoint: `${baseUrl}/api/v1/task-nudges`,
        mutatesGitIfRun: false,
        mutatesExternalSystemsIfRun: false,
        mutatesLocalFilesIfRun: false,
        blockedBy: [],
        expectedProof: 'Task nudge ledger record showing the next wait, refresh, send, or assign decision.',
        receipt: null,
      },
    ];
    const currentBoundary = this.findCurrentHandoffBoundary(actions);
    const currentAction = actions.find(action => action.id === currentBoundary);

    return {
      status: preflight.ok ? 'ready' : 'blocked',
      currentBoundary,
      nextExpectedProof: currentAction?.expectedProof ?? 'Capture the next handoff boundary receipt.',
      actions,
    };
  }

  private findCurrentHandoffBoundary(actions: HandoffPassPathAction[]): HandoffPassPathAction['id'] {
    // Earlier handoff boundaries own the current action before later evidence
    // nudges. A blocked Git gate must stay the current boundary even though the
    // nudge ledger is always able to record "still waiting" evidence.
    for (const action of actions) {
      if (action.id === 'first_nudge') continue;
      if (action.status === 'blocked' || (action.status === 'ready' && action.canRunNow)) {
        return action.id;
      }
    }

    const waitingAction = actions.find(action => action.id !== 'first_nudge' && action.status === 'waiting');
    return waitingAction?.id ?? 'first_nudge';
  }

  private handoffPassPathActionLabel(
    boundary: HandoffPassPathAction['id'],
    hasLinearIssue: boolean,
  ): string {
    if (boundary === 'git_sync') return 'Resolve GitHub sync before Linear/Jules';
    if (boundary === 'linear_issue') return 'Create Linear issue before Jules handoff';
    if (boundary === 'jules_manifest') {
      return hasLinearIssue
        ? 'Prepare Jules handoff from linked Linear issue'
        : 'Prepare Jules handoff';
    }
    return 'Record the next foreman nudge';
  }

  private buildJulesManifestPreview(
    baseUrl: string,
    draft: TaskDraftSnapshot['drafts'][number],
    preflight: TaskDraftSnapshot['preflight'],
    linearCapability: LinearIssueCapability,
  ): JulesManifestPreview {
    const links = this.buildDraftLinks(baseUrl, draft.id);
    const runId = `symphony-preview-${draft.id}`;
    const manifestRelativePath = `.jules/runs/${runId}/manifest.json`;
    const needsLinearIssue = linearCapability.requiresLinearIssueForHandoff && !draft.linearIssueIdentifier;
    const blockers = [
      ...(needsLinearIssue ? ['Create Linear Issue before preparing a Jules handoff.'] : []),
      ...(!preflight.ok ? preflight.blockers : []),
    ];

    // This preview rehearses the exact Jules manifest shape that staging writes
    // later, but it intentionally stays in memory. The actual `.jules/runs/...`
    // file is still written only by the guarded staging endpoint after Git sync
    // and the Linear issue gate are satisfied.
    return {
      draftId: draft.id,
      canStageNow: blockers.length === 0,
      wouldStageJulesManifest: true,
      mutatesLocalFiles: false,
      manifestPath: manifestRelativePath,
      stageManifestUrl: links.promote,
      blockers,
      manifest: buildJulesManifestPreviewFromDraft(draft, preflight, runId),
      safetyNote: 'Preview only: this response does not write .jules files, create a handoff, launch Jules, create a PR, or mutate Git.',
    };
  }

  private buildLinearIssuePreview(
    baseUrl: string,
    draft: TaskDraftSnapshot['drafts'][number],
    preflight: TaskDraftSnapshot['preflight'],
    linearCapability: LinearIssueCapability,
  ): LinearIssuePreview {
    const links = this.buildDraftLinks(baseUrl, draft.id);
    const hasLinearIssue = Boolean(draft.linearIssueIdentifier);
    const wouldCreateLinearIssue = linearCapability.requiresLinearIssueForHandoff && !hasLinearIssue;
    const blockers = [
      ...(hasLinearIssue ? [`Draft is already linked to ${draft.linearIssueIdentifier}.`] : []),
      ...(!linearCapability.canCreateLinearIssue && linearCapability.linearIssueCreationBlocker
        ? [linearCapability.linearIssueCreationBlocker]
        : []),
      ...(!preflight.ok ? preflight.blockers : []),
    ];

    // The preview deliberately uses the same issue body builder as the mutating
    // create endpoint. This makes the dashboard packet a true rehearsal for the
    // future Linear issue while still keeping this API read-only and safe during
    // blocked Git states.
    return {
      draftId: draft.id,
      projectSlug: linearCapability.linearProjectSlug,
      canCreateNow: wouldCreateLinearIssue && linearCapability.canCreateLinearIssue && preflight.ok,
      wouldCreateLinearIssue,
      mutatesExternalSystems: false,
      createLinearIssueUrl: links.createLinearIssue,
      blockers,
      issueTitle: draft.title,
      issueDescription: this.buildLinearTaskDescription(
        draft.title,
        draft.body,
        draft.expectedFiles ?? [],
        draft.verificationCommands ?? [],
        preflight.remoteBranch,
        preflight.remoteCommit,
        baseUrl,
      ),
      safetyNote: 'Preview only: this response does not call Linear, create an issue, stage Jules, launch workers, or mutate Git.',
    };
  }

  private buildHandoffLinks(baseUrl: string, handoffId: string): Record<string, string> {
    const encoded = encodeURIComponent(handoffId);
    return {
      stageManifest: `${baseUrl}/api/v1/jules-handoffs/${encoded}/stage-manifest`,
      launch: `${baseUrl}/api/v1/jules-handoffs/${encoded}/launch`,
      launchReadiness: `${baseUrl}/api/v1/jules-handoffs/${encoded}/launch-readiness`,
      refreshStatus: `${baseUrl}/api/v1/jules-handoffs/${encoded}/refresh-status`,
      message: `${baseUrl}/api/v1/jules-handoffs/${encoded}/message`,
      approvePlan: `${baseUrl}/api/v1/jules-handoffs/${encoded}/approve-plan`,
      refreshPullRequest: `${baseUrl}/api/v1/jules-handoffs/${encoded}/refresh-pr`,
      createFollowUpDraft: `${baseUrl}/api/v1/jules-handoffs/${encoded}/create-follow-up-draft`,
      refreshLocalSync: `${baseUrl}/api/v1/jules-handoffs/${encoded}/refresh-local-sync`,
      syncLocal: `${baseUrl}/api/v1/jules-handoffs/${encoded}/sync-local`,
    };
  }

  private buildJulesLaunchReadinessPacket(
    baseUrl: string,
    handoff: TaskDraftSnapshot['handoffs'][number],
  ): JulesLaunchReadinessPacket {
    const links = this.buildHandoffLinks(baseUrl, handoff.id);
    const hasSession = Boolean(handoff.julesSessionId || handoff.julesSessionUrl || handoff.julesState);
    const canLaunchNow = (handoff.status === 'manifest_ready' || handoff.status === 'launch_failed')
      && Boolean(handoff.manifestPath)
      && Boolean(handoff.launchCommand)
      && !hasSession;
    const blockers = this.buildJulesLaunchBlockers(handoff, hasSession);
    const status: JulesLaunchReadinessPacket['status'] = hasSession
      ? 'launched'
      : canLaunchNow
        ? 'ready'
        : 'blocked';

    // This packet is the staged-handoff equivalent of the draft readiness
    // packet. It makes the launch boundary auditable before the operator starts
    // a real Jules cloud session, while still leaving the actual launch behind
    // the existing POST endpoint and Jules orchestrator command.
    return {
      handoffId: handoff.id,
      title: handoff.title,
      status,
      canLaunchNow,
      mutatesGitIfRun: false,
      mutatesExternalSystemsIfRun: canLaunchNow,
      mutatesLocalFilesIfRun: canLaunchNow,
      launchUrl: links.launch,
      refreshStatusUrl: links.refreshStatus,
      launchCommand: handoff.launchCommand,
      statusCommand: handoff.statusCommand,
      recordsPath: handoff.recordsPath,
      manifestPath: handoff.manifestPath,
      base: {
        branch: handoff.gitPreflight?.remoteBranch ?? null,
        commit: handoff.gitPreflight?.remoteCommit ?? null,
        checkedAt: handoff.gitPreflight?.checkedAt ?? null,
      },
      linearIssue: {
        identifier: handoff.linearIssueIdentifier ?? null,
        url: handoff.linearIssueUrl ?? null,
      },
      sessionReceipt: {
        sessionId: handoff.julesSessionId ?? null,
        sessionUrl: handoff.julesSessionUrl ?? null,
        state: handoff.julesState ?? null,
        launchedAt: handoff.launchedAt ?? null,
      },
      blockers,
      safetyChecklist: this.buildJulesLaunchSafetyChecklist(canLaunchNow, hasSession),
      expectedNextProof: hasSession
        ? 'Refresh Jules status, approve the plan if requested, or wait for the PR/session boundary.'
        : 'Jules session receipt with session id, session URL, state, launch timestamp, and status refresh command.',
      safetyNote: 'Read-only packet: this response does not launch Jules, call GitHub, create a PR, mutate Git, or write local files. If the operator runs the launch endpoint, Symphony records the Jules run locally and asks the existing orchestrator to create or update Jules-side session state.',
    };
  }

  private buildJulesLaunchBlockers(
    handoff: TaskDraftSnapshot['handoffs'][number],
    hasSession: boolean,
  ): string[] {
    const blockers: string[] = [];

    if (handoff.status === 'observed_pr') blockers.push('Observed PR records are watch-only and were not launched by this dashboard.');
    if (handoff.status === 'blocked_by_git_sync') blockers.push(handoff.gitPreflight?.summary ?? 'GitHub sync is blocked.');
    if (handoff.status === 'base_commit_stale') blockers.push(handoff.baseCommitDrift?.summary ?? 'The staged manifest is stale against the current GitHub base.');
    if (!handoff.manifestPath) blockers.push('Stage the Jules manifest before launch.');
    if (!handoff.launchCommand) blockers.push('Launch command is missing from the staged manifest receipt.');
    if (hasSession) blockers.push('Jules session already exists; refresh status instead of launching again.');
    if (handoff.status === 'status_refresh_failed') blockers.push(handoff.launchError || 'Refresh Jules status before launching again.');

    return blockers;
  }

  private buildJulesLaunchSafetyChecklist(canLaunchNow: boolean, hasSession: boolean): string[] {
    const checklist = [
      'Review the staged manifest path, write scope, verification commands, Linear issue, and GitHub base commit before launching.',
      'Confirm the launch command uses .jules/orchestrator/cli.ts and the recorded manifest path.',
      'After launch, capture the Jules session id, session URL, state, launch timestamp, and status refresh command.',
      'Refresh Jules status before approving a plan, sending feedback, or waiting for a PR.',
    ];

    if (hasSession) {
      return [
        'Do not launch again while a Jules session receipt already exists.',
        ...checklist,
      ];
    }

    if (!canLaunchNow) {
      return [
        'Do not launch Jules until every blocker in this packet is resolved.',
        ...checklist,
      ];
    }

    return checklist;
  }

  private buildLocalSyncReadinessPacket(
    baseUrl: string,
    handoff: TaskDraftSnapshot['handoffs'][number],
  ): LocalSyncReadinessPacket {
    const links = this.buildHandoffLinks(baseUrl, handoff.id);
    const status = handoff.localSyncStatus;
    const dashboardStarted = handoff.status !== 'observed_pr';
    const prMerged = handoff.githubPullRequestState === 'MERGED';
    const canRefreshNow = Boolean(dashboardStarted && handoff.githubPullRequestUrl);
    const canSyncNow = Boolean(dashboardStarted && prMerged && status?.safeToPull);
    const packetStatus: LocalSyncReadinessPacket['status'] = !dashboardStarted
      ? 'observed'
      : !prMerged || !status
        ? 'waiting'
        : status.upToDate
          ? 'current'
          : status.safeToPull
            ? 'ready'
            : 'blocked';
    const blockers = this.buildLocalSyncReadinessBlockers(handoff, status, dashboardStarted, prMerged);

    // Local sync is the final bridge from cloud work back into the operator's
    // checkout. This packet keeps the read-only proof separate from the guarded
    // fast-forward endpoint so a foreman can refresh facts without pulling
    // remote commits into local master.
    return {
      handoffId: handoff.id,
      title: handoff.title,
      status: packetStatus,
      canRefreshNow,
      canSyncNow,
      mutatesGitIfRun: canSyncNow,
      mutatesLocalFilesIfRun: canSyncNow,
      refreshUrl: canRefreshNow ? links.refreshLocalSync : null,
      syncUrl: canSyncNow ? links.syncLocal : null,
      pullCommand: canSyncNow ? status?.pullCommand ?? handoff.localSyncCommand : null,
      pr: {
        url: handoff.githubPullRequestUrl,
        state: handoff.githubPullRequestState,
        dashboardStarted,
      },
      evidence: {
        checkedAt: status?.checkedAt ?? null,
        baseBranch: status?.baseBranch ?? handoff.gitPreflight?.baseBranch ?? null,
        remoteBranch: status?.remoteBranch ?? handoff.gitPreflight?.remoteBranch ?? null,
        currentBranch: status?.currentBranch ?? null,
        localCommit: status?.localCommit ?? null,
        remoteCommit: status?.remoteCommit ?? null,
        ahead: status?.ahead ?? null,
        behind: status?.behind ?? null,
        dirtyFiles: status?.dirtyFiles ?? null,
        untrackedFiles: status?.untrackedFiles ?? null,
      },
      blockers,
      nextAction: status?.nextAction ?? null,
      safetyChecklist: this.buildLocalSyncSafetyChecklist(canSyncNow, dashboardStarted),
      expectedNextProof: canSyncNow
        ? 'Fast-forward receipt, refreshed GitHub sync preflight, and updated local commit.'
        : packetStatus === 'current'
          ? 'Recorded local-sync check proving local master already matches GitHub after the Jules merge.'
          : 'Refreshed local-sync check proving PR merge state and local checkout safety before any pull.',
      safetyNote: 'Read-only packet: this response does not pull from GitHub, mutate Git, overwrite local files, or mark the handoff complete. The sync URL is present only when the existing local-sync guard says a fast-forward pull is safe.',
    };
  }

  private buildScoutCoreReadinessPacket(
    baseUrl: string,
    handoff: TaskDraftSnapshot['handoffs'][number],
  ): ScoutCoreReadinessPacket {
    const links = this.buildHandoffLinks(baseUrl, handoff.id);
    const dashboardStarted = handoff.status !== 'observed_pr';
    const nextAction = handoff.githubPullRequestNextAction;
    const status = this.scoutCoreReadinessStatus(handoff, dashboardStarted);
    const canRefreshNow = Boolean(handoff.githubPullRequestUrl);
    const canScoutReviewNow = Boolean(handoff.githubPullRequestUrl && handoff.lastPullRequestRefreshAt);
    const canCoreValidateNow = Boolean(dashboardStarted && status === 'ready_for_core');
    const canCoreMergeNow = canCoreValidateNow;
    const blockers = this.buildScoutCoreReadinessBlockers(handoff, dashboardStarted, status);

    // Scout/Core readiness sits between "Jules opened a PR" and "Core may
    // merge it". Keep this packet read-only and derive it from the existing PR
    // next-action model so the dashboard, foreman prompts, and verifiers do not
    // create separate opinions about checks, risk, Scout conflict comments, or
    // observed PR learning records.
    return {
      handoffId: handoff.id,
      title: handoff.title,
      status,
      nextBoundary: this.scoutCoreNextBoundary(status),
      canRefreshNow,
      canScoutReviewNow,
      canCoreValidateNow,
      canCoreMergeNow,
      mutatesGitIfRun: false,
      mutatesLocalFilesIfRun: false,
      mutatesExternalSystemsIfCoreMerges: Boolean(canCoreMergeNow && handoff.coreMergeCommand),
      refreshUrl: canRefreshNow ? links.refreshPullRequest : null,
      scoutReviewCommand: handoff.scoutReviewCommand,
      coreValidationCommand: canCoreValidateNow ? handoff.coreValidationCommand : null,
      coreMergeCommand: canCoreMergeNow ? handoff.coreMergeCommand : null,
      feedbackCommand: nextAction?.feedbackCommand ?? null,
      pr: {
        url: handoff.githubPullRequestUrl,
        state: handoff.githubPullRequestState,
        isDraft: handoff.githubPullRequestIsDraft,
        mergeable: handoff.githubPullRequestMergeable,
        reviewDecision: handoff.githubPullRequestReviewDecision,
        dashboardStarted,
        lastRefreshAt: handoff.lastPullRequestRefreshAt,
      },
      evidence: {
        checksConclusion: handoff.githubPullRequestChecks?.conclusion ?? null,
        failedChecks: handoff.githubPullRequestChecks?.failed ?? null,
        pendingChecks: handoff.githubPullRequestChecks?.pending ?? null,
        fileRisk: handoff.githubPullRequestFiles?.risk ?? null,
        riskReasons: handoff.githubPullRequestFiles?.riskReasons ?? [],
        outOfScopeFiles: handoff.githubPullRequestFiles?.outOfScopeFiles ?? [],
        scoutConflictComments: handoff.githubPullRequestFeedback?.scoutConflictComments.length ?? 0,
        externalReviewComments: handoff.githubPullRequestFeedback?.externalReviewComments.length ?? 0,
        julesFeedbackComments: handoff.githubPullRequestFeedback?.julesFeedback.length ?? 0,
      },
      blockers,
      nextAction,
      safetyChecklist: this.buildScoutCoreSafetyChecklist(status, dashboardStarted),
      expectedNextProof: status === 'ready_for_core'
        ? 'Core validation receipt, merge receipt, refreshed PR state, then local sync readiness.'
        : status === 'merged'
          ? 'Refreshed PR state showing merged status, then local sync readiness.'
          : 'Refreshed PR checks, changed-file risk, Scout review disposition, and Core validation decision before merge.',
      safetyNote: 'Read-only packet: this response does not run Scout, merge the PR, call GitHub, mutate Git, or write local files. Core merge remains an explicit external command after checks and Scout review are clear.',
    };
  }

  private scoutCoreReadinessStatus(
    handoff: TaskDraftSnapshot['handoffs'][number],
    dashboardStarted: boolean,
  ): ScoutCoreReadinessPacket['status'] {
    const actionCode = handoff.githubPullRequestNextAction?.code;

    if (!dashboardStarted) return 'observed';
    if (!handoff.githubPullRequestUrl || !handoff.lastPullRequestRefreshAt) return 'waiting';
    if (handoff.githubPullRequestState === 'MERGED' || actionCode === 'check_local_sync') return 'merged';
    if (actionCode === 'core_validate_and_merge') return 'ready_for_core';
    if (
      actionCode === 'scout_bridge_risk'
      || handoff.githubPullRequestFiles?.risk === 'medium'
      || handoff.githubPullRequestFiles?.risk === 'high'
      || (handoff.githubPullRequestFeedback?.scoutConflictComments.length ?? 0) > 0
    ) {
      return 'blocked_by_scout';
    }
    if (
      actionCode === 'repair_failed_checks'
      || actionCode === 'resolve_conflicts'
      || actionCode === 'reopen_or_replace_pr'
      || handoff.githubPullRequestState === 'CLOSED'
      || handoff.githubPullRequestMergeable === 'CONFLICTING'
      || handoff.githubPullRequestChecks?.conclusion === 'failing'
    ) {
      return 'blocked_by_pr';
    }

    return 'waiting';
  }

  private scoutCoreNextBoundary(status: ScoutCoreReadinessPacket['status']): ScoutCoreReadinessPacket['nextBoundary'] {
    if (status === 'ready_for_core') return 'core_merge';
    if (status === 'merged') return 'local_sync';
    if (status === 'waiting' || status === 'blocked_by_pr') return 'github_pr';
    return 'scout_core';
  }

  private buildScoutCoreReadinessBlockers(
    handoff: TaskDraftSnapshot['handoffs'][number],
    dashboardStarted: boolean,
    status: ScoutCoreReadinessPacket['status'],
  ): string[] {
    const blockers: string[] = [];
    const action = handoff.githubPullRequestNextAction;

    if (!dashboardStarted) blockers.push('Observed PR records are read-only; Core merge belongs to a dashboard-started Jules PR.');
    if (!handoff.githubPullRequestUrl) blockers.push('No GitHub PR URL is recorded for this handoff.');
    if (handoff.githubPullRequestUrl && !handoff.lastPullRequestRefreshAt) blockers.push('Refresh PR checks before Scout/Core readiness can be trusted.');

    if (status === 'waiting') {
      if (handoff.githubPullRequestIsDraft) blockers.push('The PR is still a draft.');
      if (!handoff.githubPullRequestChecks || handoff.githubPullRequestChecks.conclusion !== 'passing') {
        blockers.push('GitHub checks are not conclusively passing yet.');
      }
    }

    if (status === 'blocked_by_pr') {
      if (handoff.githubPullRequestState === 'CLOSED') blockers.push('GitHub reports this PR closed before merge.');
      if (handoff.githubPullRequestMergeable === 'CONFLICTING') blockers.push('GitHub reports merge conflicts.');
      if (handoff.githubPullRequestChecks?.conclusion === 'failing') blockers.push('GitHub checks are failing.');
    }

    if (status === 'blocked_by_scout') {
      blockers.push('Scout review must clear risky, out-of-scope, or conflict-prone files before Core validates or merges.');
      blockers.push(...(handoff.githubPullRequestFiles?.riskReasons ?? []));
      if (handoff.githubPullRequestFiles?.outOfScopeFiles.length) {
        blockers.push(`Out-of-scope files changed: ${handoff.githubPullRequestFiles.outOfScopeFiles.join(', ')}`);
      }
      const conflictCount = handoff.githubPullRequestFeedback?.scoutConflictComments.length ?? 0;
      if (conflictCount > 0) blockers.push(`${conflictCount} Scout conflict comment(s) need disposition.`);
    }

    if (action?.summary && status !== 'ready_for_core' && status !== 'merged') blockers.push(action.summary);

    return this.uniqueNonEmptyStrings(blockers);
  }

  private buildScoutCoreSafetyChecklist(
    status: ScoutCoreReadinessPacket['status'],
    dashboardStarted: boolean,
  ): string[] {
    const checklist = [
      'Refresh GitHub PR state before making a Scout/Core decision.',
      'Confirm checks are passing, the PR is mergeable, and changed files match the expected scope.',
      'Review Scout conflict comments and external review comments before Core merge.',
      'After Core merge, refresh PR state and move to local sync readiness instead of pulling immediately.',
    ];

    if (!dashboardStarted) {
      return [
        'Do not merge observed PR learning records from Symphony.',
        ...checklist,
      ];
    }

    if (status !== 'ready_for_core') {
      return [
        'Do not run Core merge until this packet reports ready_for_core.',
        ...checklist,
      ];
    }

    return checklist;
  }

  private buildLocalSyncReadinessBlockers(
    handoff: TaskDraftSnapshot['handoffs'][number],
    status: TaskDraftSnapshot['handoffs'][number]['localSyncStatus'],
    dashboardStarted: boolean,
    prMerged: boolean,
  ): string[] {
    const blockers: string[] = [];

    if (!dashboardStarted) blockers.push('Observed PR records are read-only; local sync belongs to a dashboard-started merged Jules PR.');
    if (!handoff.githubPullRequestUrl) blockers.push('No GitHub PR URL is recorded for this handoff.');
    if (!prMerged) blockers.push('GitHub has not reported this Jules PR as merged yet.');
    if (!status) blockers.push('Run Check Local Sync to capture current branch, dirty files, ahead/behind, and fast-forward safety.');

    return [
      ...blockers,
      ...(status?.blockers ?? []),
    ];
  }

  private buildLocalSyncSafetyChecklist(canSyncNow: boolean, dashboardStarted: boolean): string[] {
    const checklist = [
      'Confirm GitHub reports the dashboard-started Jules PR as merged.',
      'Confirm the local checkout is on the configured base branch.',
      'Confirm dirty files, untracked files, and local-only commits are resolved before pulling.',
      'After syncing, refresh the GitHub sync preflight so the dashboard proves local and remote base state again.',
    ];

    if (!dashboardStarted) {
      return [
        'Do not sync local master from observed PR learning records.',
        ...checklist,
      ];
    }

    if (!canSyncNow) {
      return [
        'Do not run local sync until the readiness packet says the fast-forward pull is safe.',
        ...checklist,
      ];
    }

    return checklist;
  }

  private async handleCreateTaskDraft(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    let payload: { title?: unknown; body?: unknown; expectedFiles?: unknown; verificationCommands?: unknown } = {};

    try {
      payload = JSON.parse(await this.readRequestBody(req));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'bad_json', message: 'Expected JSON body with title and body.' }
      }));
      return;
    }

    try {
      // Task intake is intentionally local for now. This lets the dashboard
      // capture task intent and show the GitHub gate before any future bridge
      // creates a Linear issue or starts a Jules cloud session.
      const snapshot = await this.taskIntake.createDraft({
        title: typeof payload.title === 'string' ? payload.title : '',
        body: typeof payload.body === 'string' ? payload.body : '',
        expectedFiles: typeof payload.expectedFiles === 'string' || Array.isArray(payload.expectedFiles)
          ? payload.expectedFiles
          : undefined,
        verificationCommands: typeof payload.verificationCommands === 'string' || Array.isArray(payload.verificationCommands)
          ? payload.verificationCommands
          : undefined,
      });

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.withTaskCapabilities(snapshot), null, 2));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'bad_task_draft', message: (err as Error).message }
      }));
    }
  }

  private async handleGetLinearIssuePreview(draftId: string, res: ServerResponse): Promise<void> {
    try {
      const decodedDraftId = decodeURIComponent(draftId);
      const snapshot = await this.taskIntake.snapshot();
      const draft = snapshot.drafts.find(candidate => candidate.id === decodedDraftId);
      if (!draft) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: { code: 'draft_not_found', message: `Task draft ${decodedDraftId} was not found.` },
        }));
        return;
      }

      const config = this.orchestrator.getConfig();
      const preview = this.buildLinearIssuePreview(
        this.orchestrator.getDashboardBaseUrl(),
        draft,
        snapshot.preflight,
        this.getLinearIssueCapability(config),
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(preview, null, 2));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'linear_issue_preview_failed', message: (err as Error).message },
      }));
    }
  }

  private async handleGetJulesManifestPreview(draftId: string, res: ServerResponse): Promise<void> {
    try {
      const decodedDraftId = decodeURIComponent(draftId);
      const snapshot = await this.taskIntake.snapshot();
      const draft = snapshot.drafts.find(candidate => candidate.id === decodedDraftId);
      if (!draft) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: { code: 'draft_not_found', message: `Task draft ${decodedDraftId} was not found.` },
        }));
        return;
      }

      const preview = this.buildJulesManifestPreview(
        this.orchestrator.getDashboardBaseUrl(),
        draft,
        snapshot.preflight,
        this.getLinearIssueCapability(this.orchestrator.getConfig()),
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(preview, null, 2));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'jules_manifest_preview_failed', message: (err as Error).message },
      }));
    }
  }

  private async handleGetHandoffReadiness(draftId: string, res: ServerResponse): Promise<void> {
    try {
      const decodedDraftId = decodeURIComponent(draftId);
      const snapshot = await this.taskIntake.snapshot();
      const draft = snapshot.drafts.find(candidate => candidate.id === decodedDraftId);
      if (!draft) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: { code: 'draft_not_found', message: `Task draft ${decodedDraftId} was not found.` },
        }));
        return;
      }

      const baseUrl = this.orchestrator.getDashboardBaseUrl();
      const linearCapability = this.getLinearIssueCapability(this.orchestrator.getConfig());
      const linearPreview = this.buildLinearIssuePreview(
        baseUrl,
        draft,
        snapshot.preflight,
        linearCapability,
      );
      const manifestPreview = this.buildJulesManifestPreview(
        baseUrl,
        draft,
        snapshot.preflight,
        linearCapability,
      );

      // This combines the separate rehearsals into one read-only checklist for
      // foremen and the operator. It is intentionally not a launch endpoint.
      const readiness = this.buildHandoffReadinessPacket(
        baseUrl,
        draft,
        snapshot.preflight,
        linearPreview,
        manifestPreview,
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(readiness, null, 2));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'handoff_readiness_failed', message: (err as Error).message },
      }));
    }
  }

  private async handleGetJulesLaunchReadiness(handoffId: string, res: ServerResponse): Promise<void> {
    try {
      const decodedHandoffId = decodeURIComponent(handoffId);
      const snapshot = await this.taskIntake.snapshot();
      const handoff = snapshot.handoffs.find(candidate => candidate.id === decodedHandoffId);
      if (!handoff) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: { code: 'handoff_not_found', message: `Jules handoff ${decodedHandoffId} was not found.` },
        }));
        return;
      }

      // This endpoint mirrors the launch readiness object embedded in the queue
      // snapshot. It gives a foreman a small, direct packet to inspect before
      // deciding whether to run the mutating Jules launch endpoint.
      const readiness = this.buildJulesLaunchReadinessPacket(
        this.orchestrator.getDashboardBaseUrl(),
        handoff,
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(readiness, null, 2));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'jules_launch_readiness_failed', message: (err as Error).message },
      }));
    }
  }

  private async handleWatchObservedPullRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    let payload: { prUrl?: unknown; title?: unknown; expectedFiles?: unknown; verificationCommands?: unknown } = {};

    try {
      payload = JSON.parse(await this.readRequestBody(req));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'bad_json', message: 'Expected JSON body with a GitHub pull request URL.' }
      }));
      return;
    }

    try {
      // Observed PRs are read-only watch records. They let Symphony track and
      // learn from PRs created outside this dashboard run, while keeping the
      // Linear/Jules launch trail separate and honest.
      const snapshot = await this.taskIntake.watchPullRequest({
        prUrl: typeof payload.prUrl === 'string' ? payload.prUrl : '',
        title: typeof payload.title === 'string' ? payload.title : undefined,
        expectedFiles: typeof payload.expectedFiles === 'string' || Array.isArray(payload.expectedFiles)
          ? payload.expectedFiles
          : undefined,
        verificationCommands: typeof payload.verificationCommands === 'string' || Array.isArray(payload.verificationCommands)
          ? payload.verificationCommands
          : undefined,
      });

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.withTaskCapabilities(snapshot), null, 2));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'bad_observed_pr', message: (err as Error).message }
      }));
    }
  }

  private async handleCreateObservedPullRequestFollowUp(
    handoffId: string,
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    let payload: { title?: unknown; body?: unknown; expectedFiles?: unknown; verificationCommands?: unknown } = {};

    try {
      const body = await this.readRequestBody(req);
      payload = body ? JSON.parse(body) : {};
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'bad_json', message: 'Expected optional JSON body for observed PR follow-up draft.' }
      }));
      return;
    }

    try {
      // This bridge keeps old PRs read-only. It turns a useful observed lesson
      // into a normal dashboard draft, which must still pass the Git/Linear/Jules
      // gates before any worker mutates code or GitHub.
      const snapshot = await this.taskIntake.createObservedPullRequestFollowUp({
        handoffId: decodeURIComponent(handoffId),
        title: typeof payload.title === 'string' ? payload.title : undefined,
        body: typeof payload.body === 'string' ? payload.body : undefined,
        expectedFiles: typeof payload.expectedFiles === 'string' || Array.isArray(payload.expectedFiles)
          ? payload.expectedFiles
          : undefined,
        verificationCommands: typeof payload.verificationCommands === 'string' || Array.isArray(payload.verificationCommands)
          ? payload.verificationCommands
          : undefined,
      });

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.withTaskCapabilities(snapshot), null, 2));
    } catch (err) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'observed_pr_follow_up_blocked', message: (err as Error).message }
      }));
    }
  }

  private async handlePromoteTaskDraft(draftId: string, res: ServerResponse): Promise<void> {
    try {
      // Promotion creates a local Jules handoff record and prompt only. It does
      // not launch Jules yet; the later bridge should reuse the handoff record
      // to create the Linear issue, start Jules, and monitor the resulting PR.
      const decodedDraftId = decodeURIComponent(draftId);
      const config = this.orchestrator.getConfig();
      const snapshot = await this.taskIntake.promoteDraft(decodedDraftId, {
        requireLinearIssue: config?.tracker.kind === 'linear',
      });

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.withTaskCapabilities(snapshot), null, 2));
    } catch (err) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: {
          code: (err as Error).message.includes('Create Linear Issue')
            ? 'linear_issue_required'
            : 'handoff_blocked',
          message: (err as Error).message,
        }
      }));
    }
  }

  private async handleCreateLinearTaskIssue(draftId: string, res: ServerResponse): Promise<void> {
    try {
      const config = this.orchestrator.getConfig();
      if (!config || config.tracker.kind !== 'linear') {
        throw new Error('Symphony is not running with a Linear tracker workflow.');
      }

      const linearCapability = this.getLinearIssueCapability(config);
      if (!linearCapability.canCreateLinearIssue) {
        throw new Error(linearCapability.linearIssueCreationBlocker ?? 'Linear issue creation is not available in this workflow.');
      }

      const preflight = await this.taskIntake.runGitSyncPreflight();
      if (!preflight.ok) {
        throw new Error(`GitHub sync gate is blocked: ${preflight.blockers.join(' ')}`);
      }

      const draft = await this.taskIntake.getDraft(decodeURIComponent(draftId));
      if (draft.linearIssueIdentifier) {
        throw new Error(`Draft is already linked to ${draft.linearIssueIdentifier}.`);
      }

      const client = new LinearClient({
        endpoint: config.tracker.endpoint,
        apiKey: config.tracker.apiKey,
        projectSlug: config.tracker.projectSlug,
        activeStates: config.tracker.activeStates,
        terminalStates: config.tracker.terminalStates,
        logger: this.log,
      });

      // Creating the Linear issue is the dashboard-to-foreman bridge. The issue
      // description carries the user's original task plus the same Jules-first
      // expectations the worker prompt enforces, so the polling worker has a
      // clear tracking surface without the user manually navigating Linear.
      const issue = await client.createProjectIssue({
        title: draft.title,
        description: this.buildLinearTaskDescription(
          draft.title,
          draft.body,
          draft.expectedFiles ?? [],
          draft.verificationCommands ?? [],
          preflight.remoteBranch,
          preflight.remoteCommit,
          this.orchestrator.getDashboardBaseUrl()
        ),
      });
      const snapshot = await this.taskIntake.attachLinearIssueToDraft(draft.id, {
        id: issue.id,
        identifier: issue.identifier,
        url: issue.url,
      });

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.withTaskCapabilities(snapshot), null, 2));
    } catch (err) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'linear_issue_create_blocked', message: (err as Error).message }
      }));
    }
  }

  private async handleStageJulesManifest(handoffId: string, res: ServerResponse): Promise<void> {
    try {
      // Staging writes the existing .jules/orchestrator manifest format, then
      // records the launch command the operator or a later Symphony action can
      // run. This keeps the first bridge local and reviewable.
      const snapshot = await this.taskIntake.stageHandoffManifest(decodeURIComponent(handoffId));

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.withTaskCapabilities(snapshot), null, 2));
    } catch (err) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'manifest_blocked', message: (err as Error).message }
      }));
    }
  }

  private buildLinearTaskDescription(
    title: string,
    body: string,
    expectedFiles: string[],
    verificationCommands: string[],
    remoteBranch: string,
    remoteCommit: string | null,
    dashboardBaseUrl = 'http://127.0.0.1:8081'
  ): string {
    const expectedFileLines = expectedFiles.length
      ? expectedFiles.map(file => `- \`${file}\``)
      : [
          // This line must match the dashboard and manifest contract. An empty
          // write-scope list is not broad permission; it means Jules should
          // coordinate, inspect, or plan until the operator names editable files.
          '- No editable files are declared. Treat this as analysis-only until the operator adds expected files or explicit write scopes.',
        ];
    const verificationLines = verificationCommands.length
      ? verificationCommands.map(command => `- \`${command}\``)
      : ['- No explicit commands supplied yet; choose the smallest meaningful verification for the files changed.'];

    return [
      'Created from the Symphony dashboard as a Jules delegation task.',
      '',
      `Title: ${title}`,
      '',
      'Task details:',
      body,
      '',
      'Expected files / write scopes:',
      ...expectedFileLines,
      '',
      'Requested verification:',
      ...verificationLines,
      '',
      'GitHub sync receipt:',
      // Jules runs in the cloud from GitHub, so the Linear issue should record
      // the exact base commit that passed the dashboard gate. This lets the
      // foreman compare the issue, manifest, Jules session, and PR against one
      // concrete hash instead of trusting a branch name that may move later.
      `- Synced base: \`${remoteBranch} @ ${remoteCommit || 'unknown'}\``,
      '',
      'Acceptance contract for Jules, Scout, and Core:',
      // The Linear issue is the handoff receipt that survives outside the local
      // dashboard. Spell out how Jules, Scout, and Core should interpret the
      // scope and test-command sections so cloud work does not silently drift.
      '- Treat Expected files / write scopes as the declared Jules write scope.',
      '- If a PR changes files outside that scope, call that out before merge or local sync.',
      '- Run and report the requested verification commands when code changes.',
      '- Scout and Core should use this issue as the review contract before merge or local sync.',
      '',
      'Dashboard control surface:',
      // This issue text is what a worker sees when it claims work from Linear.
      // Include the same local API surface shown in the browser dashboard so
      // the foreman can inspect live Symphony/Jules state without guessing.
      `- Dashboard state: \`${dashboardBaseUrl}/api/v1/state\``,
      `- Task queue: \`${dashboardBaseUrl}/api/v1/task-drafts\``,
      `- GitHub sync gate: \`${dashboardBaseUrl}/api/v1/git-preflight\``,
      `- Refresh tracked Jules handoffs: \`${dashboardBaseUrl}/api/v1/jules-handoffs/refresh-all\``,
      `- Assigned issue: \`${dashboardBaseUrl}/api/v1/<issue>\``,
      `- Assigned issue activity: \`${dashboardBaseUrl}/api/v1/<issue>/activity\``,
      '',
      'Symphony foreman expectations:',
      '- Treat this as a Jules coordination task before treating it as local implementation.',
      `- Verify the Jules starting point is ${remoteBranch} at commit ${remoteCommit || 'unknown'}.`,
      '- If GitHub sync is blocked, report that blocker instead of starting broad local work.',
      '- Track Jules session, PR checks, conflict-prone files, merge readiness, and local sync back to master.',
      '- Post status comments only on this issue unless the operator asks for broader Linear changes.',
    ].join('\n');
  }

  private async handleLaunchJulesHandoff(handoffId: string, res: ServerResponse): Promise<void> {
    try {
      // Launching reuses the existing .jules/orchestrator CLI. The dashboard
      // remains the operator front door, while the proven Jules manifest/records
      // machinery still owns the cloud session creation and PR automation.
      const snapshot = await this.taskIntake.launchHandoff(decodeURIComponent(handoffId));

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.withTaskCapabilities(snapshot), null, 2));
    } catch (err) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'jules_launch_blocked', message: (err as Error).message }
      }));
    }
  }

  private async handleRefreshJulesHandoff(handoffId: string, res: ServerResponse): Promise<void> {
    try {
      // Refresh is the foreman loop after Jules has started: read/update the
      // existing orchestrator records, then copy the session state and PR URL
      // back into the dashboard-facing handoff record.
      const snapshot = await this.taskIntake.refreshHandoffStatus(decodeURIComponent(handoffId));

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.withTaskCapabilities(snapshot), null, 2));
    } catch (err) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'jules_status_refresh_failed', message: (err as Error).message }
      }));
    }
  }

  private async handleRefreshAllJulesHandoffs(res: ServerResponse): Promise<void> {
    try {
      // Bulk refresh is for multi-agent operation. It reuses the same
      // read-only status/PR refresh paths as individual handoff cards and
      // returns partial failures instead of making the operator click every
      // active Jules handoff one at a time.
      const snapshot = await this.taskIntake.refreshTrackedHandoffs();

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.withTaskCapabilities(snapshot), null, 2));
    } catch (err) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'jules_bulk_refresh_failed', message: (err as Error).message }
      }));
    }
  }

  private async handleJulesOperatorMessage(
    handoffId: string,
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    let payload: { body?: unknown } = {};

    try {
      payload = JSON.parse(await this.readRequestBody(req));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'bad_json', message: 'Expected JSON body with body: string.' }
      }));
      return;
    }

    if (typeof payload.body !== 'string' || !payload.body.trim()) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'bad_message', message: 'Operator message body is required.' }
      }));
      return;
    }

    try {
      // Operator feedback uses the existing Jules CLI `message` action. The
      // dashboard is only the front door; TaskIntakeStore records whether the
      // message actually reached Jules so the operator has an audit trail.
      const snapshot = await this.taskIntake.sendJulesOperatorMessage(
        decodeURIComponent(handoffId),
        payload.body
      );

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.withTaskCapabilities(snapshot), null, 2));
    } catch (err) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'jules_message_failed', message: (err as Error).message }
      }));
    }
  }

  private async handleJulesPlanApproval(handoffId: string, res: ServerResponse): Promise<void> {
    try {
      // Jules plan approval is intentionally separate from sending notes. It
      // calls the existing orchestrator approve command only when the stored
      // session state says a plan is waiting for approval.
      const snapshot = await this.taskIntake.approveJulesPlan(decodeURIComponent(handoffId));

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.withTaskCapabilities(snapshot), null, 2));
    } catch (err) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'jules_plan_approval_failed', message: (err as Error).message }
      }));
    }
  }

  private async handleRefreshJulesPullRequest(handoffId: string, res: ServerResponse): Promise<void> {
    try {
      // PR refresh is read-only. It asks GitHub CLI for the current Jules PR
      // state/checks, then stores those results so the dashboard can explain
      // merge and local-sync readiness before anything is pulled locally.
      const snapshot = await this.taskIntake.refreshPullRequestStatus(decodeURIComponent(handoffId));

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.withTaskCapabilities(snapshot), null, 2));
    } catch (err) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'github_pr_refresh_failed', message: (err as Error).message }
      }));
    }
  }

  private async handleRefreshLocalSync(handoffId: string, res: ServerResponse): Promise<void> {
    try {
      // This is the post-merge local sync gate. It checks whether the checkout
      // can fast-forward from GitHub before exposing a mutating pull action.
      const snapshot = await this.taskIntake.refreshLocalSyncStatus(decodeURIComponent(handoffId));

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.withTaskCapabilities(snapshot), null, 2));
    } catch (err) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'local_sync_refresh_failed', message: (err as Error).message }
      }));
    }
  }

  private async handleSyncLocalMaster(handoffId: string, res: ServerResponse): Promise<void> {
    try {
      // This is intentionally guarded inside TaskIntakeStore. It only performs
      // `git pull --ff-only` when the PR is merged, the current branch is the
      // base branch, the worktree is clean, and local history can fast-forward.
      const snapshot = await this.taskIntake.syncLocalMaster(decodeURIComponent(handoffId));

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.withTaskCapabilities(snapshot), null, 2));
    } catch (err) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'local_sync_blocked', message: (err as Error).message }
      }));
    }
  }

  private async handleGitPreflight(res: ServerResponse): Promise<void> {
    // This endpoint is the hard gate that future Jules handoff code should
    // reuse. It fetches GitHub first, then reports whether the local base branch
    // is current, pushed, and clean enough for cloud work to start.
    const preflight = await this.taskIntake.runGitSyncPreflight();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(preflight, null, 2));
  }

  private async handleGitDispositionReview(res: ServerResponse): Promise<void> {
    const snapshot = await this.taskIntake.snapshot();
    const review = this.buildGitDispositionReviewPacket(this.orchestrator.getDashboardBaseUrl(), snapshot);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(review, null, 2));
  }

  private async handleGitDisposition(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let payload: any;
    try {
      payload = JSON.parse(await this.readRequestBody(req));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'bad_json', message: 'Expected JSON body with category, decision, and optional note.' }
      }));
      return;
    }

    try {
      // Git disposition is an operator intent ledger, not a Git mutator. The
      // store records the decision and immediately re-runs preflight so the
      // dashboard can show both facts together: the human plan and the actual
      // still-blocking repository state.
      const snapshot = await this.taskIntake.recordGitDisposition({
        category: payload.category,
        decision: payload.decision,
        note: typeof payload.note === 'string' ? payload.note : '',
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.withTaskCapabilities(snapshot), null, 2));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'bad_git_disposition', message: (err as Error).message }
      }));
    }
  }

  private async handleTaskNudge(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let payload: any;
    try {
      payload = JSON.parse(await this.readRequestBody(req));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'bad_json', message: 'Expected JSON body with subject, action, phase, and optional note.' }
      }));
      return;
    }

    try {
      // Task nudges are the durable "foreman checked in" record. Recording one
      // does not start Jules, assign local Codex, post to Linear, or mutate
      // Git; it only saves the wait/refresh/nudge decision beside the task
      // queue so a later turn can continue with evidence.
      const snapshot = await this.taskIntake.recordTaskNudge({
        subjectId: typeof payload.subjectId === 'string' ? payload.subjectId : null,
        subjectKind: typeof payload.subjectKind === 'string' ? payload.subjectKind : null,
        action: typeof payload.action === 'string' ? payload.action : null,
        phase: typeof payload.phase === 'string' ? payload.phase : null,
        note: typeof payload.note === 'string' ? payload.note : '',
        pauseSeconds: typeof payload.pauseSeconds === 'number' ? payload.pauseSeconds : null,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.withTaskCapabilities(snapshot), null, 2));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'bad_task_nudge', message: (err as Error).message }
      }));
    }
  }

  private async handleRefreshDueTaskNudges(res: ServerResponse): Promise<void> {
    try {
      // This is the dashboard button for a measured foreman wake-up. It asks
      // the task-intake store to refresh only due external-read boundaries and
      // to report skipped local-state actions instead of launching them.
      const snapshot = await this.taskIntake.refreshDueTaskNudges();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.withTaskCapabilities(snapshot), null, 2));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'task_nudge_refresh_failed', message: (err as Error).message }
      }));
    }
  }

  private async handleApprovalDecision(
    identifier: string,
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    let payload: { decision?: unknown } = {};

    try {
      payload = JSON.parse(await this.readRequestBody(req));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'bad_json', message: 'Expected JSON body with decision: approve or deny.' }
      }));
      return;
    }

    const decision = payload.decision === 'approve' || payload.decision === 'deny'
      ? payload.decision
      : null;

    if (!decision) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: { code: 'bad_decision', message: 'Decision must be approve or deny.' }
      }));
      return;
    }

    let result: { ok: boolean; message: string };

    try {
      result = this.orchestrator.resolveApproval(identifier, decision);
    } catch (err) {
      // Approval buttons bridge the dashboard into a live headless Codex
      // app-server session. If that session rejects the response shape, the
      // operator needs a clear "not sent" answer instead of a generic HTTP 500.
      const message = (err as Error).message;
      this.log.warn('Approval response failed', { identifier, decision, error: message });
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: false,
        message: `Could not send ${decision} decision to ${identifier}: ${message}`,
        error: {
          code: 'approval_response_failed',
          message: `Could not send ${decision} decision to ${identifier}: ${message}`,
        },
        decided_at: new Date().toISOString(),
      }));
      return;
    }

    res.writeHead(result.ok ? 202 : 409, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: result.ok,
      message: result.message,
      decided_at: new Date().toISOString(),
    }));
  }

  private readRequestBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 64_000) {
          reject(new Error('request_body_too_large'));
          req.destroy();
        }
      });
      req.on('end', () => resolve(body || '{}'));
      req.on('error', reject);
    });
  }

  private handleGetIssue(identifier: string, res: ServerResponse) {
    const details = this.orchestrator.getIssueDetails(identifier);
    if (!details) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'issue_not_found', message: 'Issue ' + identifier + ' not found in orchestrator state' } }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(details, null, 2));
  }

  private handleGetActivity(identifier: string, res: ServerResponse) {
    const activity = this.orchestrator.getIssueActivity(identifier);
    if (!activity) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'issue_not_found', message: 'Issue ' + identifier + ' not found in orchestrator state' } }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(activity, null, 2));
  }
}
