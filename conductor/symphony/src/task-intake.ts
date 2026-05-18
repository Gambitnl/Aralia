import { execFile } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { promisify } from 'node:util';

// ============================================================================
// Dashboard Task Intake
// ============================================================================
// This file owns the local "task draft" queue and the GitHub sync preflight.
//
// The queue exists so the dashboard can become the human's starting point for
// Jules work without immediately creating Linear issues or launching cloud
// tasks. The preflight protects the Jules handoff: Jules runs from GitHub, so
// Symphony must prove the local base branch is current and pushed before any
// future "send to Jules" bridge is allowed.
// ============================================================================

const execFileAsync = promisify(execFile);

// ============================================================================
// Task Draft Records
// ============================================================================
// Drafts are deliberately small and local. They capture the operator's intent
// before Symphony turns that intent into Linear/Jules work in a later bridge.
// ============================================================================

export interface TaskDraft {
  id: string;
  title: string;
  body: string;
  expectedFiles: string[];
  verificationCommands: string[];
  executor: 'jules';
  status: 'draft' | 'blocked_by_git_sync' | 'ready_for_handoff';
  linearIssueId: string | null;
  linearIssueIdentifier: string | null;
  linearIssueUrl: string | null;
  linearIssueCreatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDraftInput {
  title: string;
  body: string;
  expectedFiles?: string[] | string;
  verificationCommands?: string[] | string;
}

export interface PullRequestWatchInput {
  prUrl: string;
  title?: string;
  expectedFiles?: string[] | string;
  verificationCommands?: string[] | string;
}

export interface ObservedPullRequestFollowUpInput {
  handoffId: string;
  title?: string;
  body?: string;
  expectedFiles?: string[] | string;
  verificationCommands?: string[] | string;
}

export interface TaskDraftSnapshot {
  drafts: TaskDraft[];
  handoffs: JulesHandoff[];
  preflight: GitSyncPreflight;
  gitDisposition: GitDispositionSummary;
  gitSyncPlan: GitSyncPlan;
  taskRouting: TaskRoutingPlan;
  taskNudges: TaskNudgeSummary;
}

export type GitDispositionCategory =
  | 'local_commits'
  | 'tracked_changes'
  | 'untracked_artifacts'
  | 'remote_commits';

export type GitDispositionDecision =
  | 'commit_for_jules_base'
  | 'keep_local'
  | 'generated_proof'
  | 'ignore'
  | 'needs_review'
  | 'integrate_after_local_safe';

export interface GitDispositionRecord {
  category: GitDispositionCategory;
  label: string;
  decision: GitDispositionDecision | null;
  decisionLabel: string;
  note: string;
  updatedAt: string | null;
}

export interface GitDispositionSummary {
  categories: GitDispositionRecord[];
  decidedCount: number;
  totalRequired: number;
  readyForHumanSync: boolean;
  summary: string;
  updatedAt: string | null;
}

export interface GitDispositionInput {
  category: GitDispositionCategory | string;
  decision: GitDispositionDecision | string;
  note?: string;
}

export interface GitSyncPlan {
  generatedAt: string;
  status:
    | 'ready'
    | 'blocked_by_preflight_error'
    | 'blocked_by_disposition'
    | 'blocked_by_review'
    | 'ready_for_human_execution';
  mutatesGit: false;
  canExecute: boolean;
  summary: string;
  requiredDispositions: GitDispositionCategory[];
  blockers: string[];
  steps: GitSyncPlanStep[];
  executionPacket: GitSyncExecutionPacket;
}

export interface GitSyncPlanStep {
  kind: 'inspect' | 'record_disposition' | 'prepare_local' | 'push' | 'pull' | 'verify';
  label: string;
  detail: string;
  command: string | null;
  destructive: boolean;
}

export interface GitSyncExecutionPacket {
  packageId: string;
  generatedAt: string;
  status: GitSyncPlan['status'];
  mutatesGit: false;
  canExecute: boolean;
  requiresHumanConfirmation: true;
  summary: string;
  requiredDispositions: GitDispositionCategory[];
  blockedReasons: string[];
  preflightReceipt: GitSyncExecutionPreflightReceipt;
  decisionReceipt: GitSyncExecutionDecisionReceipt;
  readOnlyCommands: string[];
  mutatingCommands: string[];
  verificationCommands: string[];
  safetyChecklist: string[];
  expectedNextProof: string;
}

export interface GitSyncExecutionPreflightReceipt {
  ok: boolean;
  checkedAt: string;
  repoRoot: string;
  baseBranch: string;
  remoteBranch: string;
  remoteName: string;
  currentBranch: string | null;
  localCommit: string | null;
  remoteCommit: string | null;
  ahead: number | null;
  behind: number | null;
  dirtyFiles: number;
  untrackedFiles: number;
  blockers: string[];
  summary: string;
}

export interface GitSyncExecutionDecisionReceipt {
  readyForHumanSync: boolean;
  decidedCount: number;
  totalRequired: number;
  summary: string;
  updatedAt: string | null;
  categories: GitDispositionRecord[];
}

export interface TaskRoutingPlan {
  generatedAt: string;
  route: 'blocked' | 'ask_operator' | 'local_agent' | 'jules_plan' | 'jules_task' | 'wait_external';
  subjectId: string | null;
  subjectTitle: string | null;
  summary: string;
  reasons: string[];
  nextAction: TaskRoutingNextAction;
  workerMode: WorkerModeRecommendation;
  candidates: TaskRoutingCandidate[];
}

export type WorkerMode =
  | 'operator_only'
  | 'local_fast'
  | 'local_careful'
  | 'jules_task'
  | 'jules_plan'
  | 'observe_wait';

export interface WorkerModeRecommendation {
  mode: WorkerMode;
  recommendedModel: string;
  recommendedReasoningEffort: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  canDispatchNow: boolean;
  summary: string;
  reasons: string[];
  complexitySignals: {
    expectedFileCount: number;
    verificationCommandCount: number;
    riskyKeywordCount: number;
    externalBoundary: boolean;
    blocked: boolean;
    dashboardStarted: boolean;
  };
  overridePolicy: string;
}

export interface TaskRoutingNextAction {
  code: 'wait' | 'refresh' | 'nudge' | 'ask_operator' | 'send_to_jules' | 'assign_local_agent';
  label: string;
  detail: string;
  pauseSeconds: number;
  nextNudgeAt: string | null;
}

export interface TaskRoutingCandidate {
  id: string;
  title: string;
  kind: 'draft' | 'handoff';
  route: TaskRoutingPlan['route'];
  workerMode: WorkerMode;
  reason: string;
}

export type TaskNudgeAction = 'wait' | 'refresh' | 'nudge' | 'ask_operator' | 'send_to_jules' | 'assign_local_agent';

export type TaskNudgePhase =
  | 'git_sync'
  | 'routing'
  | 'jules_plan'
  | 'jules_execution'
  | 'github_pr'
  | 'scout_core'
  | 'local_sync';

export interface TaskNudgeRecord {
  id: string;
  subjectId: string;
  subjectKind: 'draft' | 'handoff' | 'queue';
  subjectTitle: string;
  action: TaskNudgeAction;
  phase: TaskNudgePhase;
  note: string;
  createdAt: string;
  pauseSeconds: number;
  nextNudgeAt: string | null;
  status: 'recorded';
  mutatesExternalSystems: false;
}

export interface TaskNudgeInput {
  subjectId?: string | null;
  subjectKind?: 'draft' | 'handoff' | 'queue' | string | null;
  action?: TaskNudgeAction | string | null;
  phase?: TaskNudgePhase | string | null;
  note?: string | null;
  pauseSeconds?: number | null;
}

export interface TaskNudgeSummary {
  total: number;
  summary: string;
  latest: TaskNudgeRecord | null;
  recent: TaskNudgeRecord[];
  nextNudgeAt: string | null;
  scheduler: TaskNudgeScheduler;
}

export interface TaskNudgeScheduler {
  checkedAt: string;
  status: 'idle' | 'waiting' | 'due' | 'blocked';
  summary: string;
  dueCount: number;
  waitingCount: number;
  blockedCount: number;
  nextDueAt: string | null;
  mutatesExternalSystems: false;
  due: TaskNudgeScheduleItem[];
  waiting: TaskNudgeScheduleItem[];
  blocked: TaskNudgeScheduleItem[];
}

export interface TaskNudgeScheduleItem {
  id: string;
  subjectId: string;
  subjectKind: TaskNudgeRecord['subjectKind'];
  subjectTitle: string;
  action: TaskNudgeAction;
  phase: TaskNudgePhase;
  createdAt: string;
  nextNudgeAt: string | null;
  pauseSeconds: number;
  recommendedEndpoint: string | null;
  actionPacket: TaskNudgeActionPacket;
  summary: string;
  mutatesExternalSystems: false;
}

export interface TaskNudgeActionPacket {
  method: 'POST' | 'GET' | 'NONE';
  endpoint: string | null;
  label: string;
  safety: 'read_only' | 'local_state_only' | 'external_read' | 'operator_only';
  canRunNow: boolean;
  requiresOperator: boolean;
  blockedReason: string | null;
  mutatesExternalSystems: false;
}

const GIT_DISPOSITION_CATEGORIES: Array<{ category: GitDispositionCategory; label: string }> = [
  { category: 'local_commits', label: 'Local-only commits' },
  { category: 'tracked_changes', label: 'Tracked edits and deletions' },
  { category: 'untracked_artifacts', label: 'Untracked artifacts' },
  { category: 'remote_commits', label: 'Remote-only commits' },
];

const GIT_DISPOSITION_DECISION_LABELS: Record<GitDispositionDecision, string> = {
  commit_for_jules_base: 'Commit for Jules base',
  keep_local: 'Keep local',
  generated_proof: 'Generated proof',
  ignore: 'Ignore',
  needs_review: 'Needs review',
  integrate_after_local_safe: 'Integrate after local work is safe',
};

export interface JulesBulkRefreshResult {
  checkedAt: string;
  statusRefreshes: number;
  pullRequestRefreshes: number;
  localSyncRefreshes: number;
  skipped: number;
  failures: Array<{
    handoffId: string;
    title: string;
    phase: 'status' | 'pull_request' | 'local_sync';
    error: string;
  }>;
}

export interface TaskNudgeRefreshResult {
  checkedAt: string;
  dueCount: number;
  statusRefreshes: number;
  pullRequestRefreshes: number;
  localSyncRefreshes: number;
  skipped: number;
  failures: Array<{
    nudgeId: string;
    subjectId: string;
    subjectTitle: string;
    phase: TaskNudgePhase;
    error: string;
  }>;
  results: TaskNudgeRefreshRunItem[];
  mutatesExternalSystems: false;
}

export interface TaskNudgeRefreshRunItem {
  nudgeId: string;
  subjectId: string;
  subjectKind: TaskNudgeRecord['subjectKind'];
  subjectTitle: string;
  action: TaskNudgeAction;
  phase: TaskNudgePhase;
  endpoint: string | null;
  status: 'refreshed' | 'skipped' | 'failed';
  summary: string;
  error: string | null;
}

export interface JulesHandoff {
  id: string;
  draftId: string;
  title: string;
  executor: 'jules';
  status:
    | 'blocked_by_git_sync'
    | 'observed_pr'
    | 'ready_for_jules'
    | 'base_commit_stale'
    | 'manifest_ready'
    | 'sent_to_jules'
    | 'launch_failed'
    | 'status_refresh_failed';
  prompt: string;
  expectedFiles: string[];
  verificationCommands: string[];
  createdAt: string;
  updatedAt: string;
  gitPreflight: GitSyncPreflight;
  baseCommitDrift: HandoffBaseCommitDrift | null;
  runId: string | null;
  manifestPath: string | null;
  launchCommand: string | null;
  launchOutput: string | null;
  launchError: string | null;
  launchedAt: string | null;
  statusCommand: string | null;
  reviewCommand: string | null;
  pullCommand: string | null;
  recordsPath: string | null;
  lastStatusRefreshAt: string | null;
  julesSessionId: string | null;
  julesSessionUrl: string | null;
  julesState: string | null;
  linearIssueId: string | null;
  linearIssueIdentifier: string | null;
  linearIssueUrl: string | null;
  linearIssueCreatedAt: string | null;
  githubPullRequestUrl: string | null;
  githubPullRequestState: string | null;
  githubPullRequestIsDraft: boolean | null;
  githubPullRequestMergeable: string | null;
  githubPullRequestReviewDecision: string | null;
  githubPullRequestHeadRef: string | null;
  githubPullRequestBaseRef: string | null;
  githubPullRequestChecks: PullRequestCheckSummary | null;
  githubPullRequestFiles: PullRequestFileSummary | null;
  githubPullRequestFeedback: PullRequestFeedbackSummary | null;
  githubPullRequestNextAction: PullRequestNextAction | null;
  githubPullRequestRefreshError: string | null;
  lastPullRequestRefreshAt: string | null;
  pullRequestViewCommand: string | null;
  pullRequestChecksCommand: string | null;
  pullRequestMergeCommand: string | null;
  scoutReviewCommand: string | null;
  coreValidationCommand: string | null;
  coreMergeCommand: string | null;
  localSyncCommand: string | null;
  localSyncStatus: LocalSyncStatus | null;
  localSyncOutput: string | null;
  localSyncError: string | null;
  lastLocalSyncAt: string | null;
  operatorMessages: JulesOperatorMessage[];
  planApprovals: JulesPlanApproval[];
}

export interface HandoffBaseCommitDrift {
  detectedAt: string;
  remoteBranch: string;
  stagedRemoteCommit: string | null;
  currentRemoteCommit: string | null;
  summary: string;
}

export interface JulesOperatorMessage {
  id: string;
  body: string;
  createdAt: string;
  status: 'sent' | 'failed';
  command: string | null;
  output: string | null;
  error: string | null;
}

export interface JulesPlanApproval {
  id: string;
  createdAt: string;
  status: 'approved' | 'failed';
  command: string | null;
  output: string | null;
  error: string | null;
}

// ============================================================================
// GitHub Sync Preflight Records
// ============================================================================
// The dashboard reads this object directly to explain whether Jules delegation
// is allowed. "ok" means the base branch is current, pushed, and clean enough
// for a cloud checkout to start from the same code the human sees locally.
// ============================================================================

export interface GitSyncPreflight {
  ok: boolean;
  checkedAt: string;
  repoRoot: string;
  baseBranch: string;
  remoteBranch: string;
  currentBranch: string | null;
  localCommit: string | null;
  remoteCommit: string | null;
  ahead: number | null;
  behind: number | null;
  dirtyFiles: number;
  untrackedFiles: number;
  blockers: string[];
  summary: string;
  details: string[];
  dirtyFileSamples: string[];
  untrackedFileSamples: string[];
  resolutionPacket: GitResolutionPacket;
  remediation: string[];
  nextAction: GitSyncNextAction;
  commands: {
    status: string;
    fetch: string;
    showLocalCommit: string;
    showRemoteCommit: string;
    inspectDivergence: string;
    pullFastForward: string;
    pushBase: string;
  };
}

export interface GitResolutionPacket {
  generatedAt: string;
  mutatesGit: false;
  repoRoot: string;
  baseBranch: string;
  remoteBranch: string;
  summary: string;
  localCommits: GitResolutionCommit[];
  remoteCommits: GitResolutionCommit[];
  trackedFiles: GitResolutionFile[];
  untrackedFiles: GitResolutionFile[];
  details: string[];
  commands: {
    fullStatus: string;
    inspectDivergence: string;
  };
}

export interface GitResolutionCommit {
  side: 'local' | 'remote';
  hash: string;
  message: string;
}

export interface GitResolutionFile {
  status: string;
  path: string;
}

export interface GitSyncNextAction {
  code:
    | 'ready_for_jules'
    | 'inspect_git_state'
    | 'switch_base_branch'
    | 'review_local_changes'
    | 'resolve_divergence'
    | 'pull_fast_forward'
    | 'push_base';
  tone: 'ready' | 'blocked';
  label: string;
  command: string | null;
  summary: string;
  steps: string[];
}

export interface LocalSyncStatus {
  safeToPull: boolean;
  upToDate: boolean;
  checkedAt: string;
  repoRoot: string;
  baseBranch: string;
  remoteBranch: string;
  currentBranch: string | null;
  localCommit: string | null;
  remoteCommit: string | null;
  ahead: number | null;
  behind: number | null;
  dirtyFiles: number;
  untrackedFiles: number;
  blockers: string[];
  remediation: string[];
  summary: string;
  details: string[];
  pullCommand: string;
  nextAction: LocalSyncNextAction;
}

export interface LocalSyncNextAction {
  code:
    | 'wait_for_pr_merge'
    | 'switch_base_branch'
    | 'review_local_changes'
    | 'handle_local_commits'
    | 'sync_local_master'
    | 'local_master_current'
    | 'inspect_local_sync';
  tone: 'ready' | 'blocked' | 'waiting';
  label: string;
  command: string | null;
  summary: string;
  steps: string[];
}

export function buildGitSyncNextAction(input: {
  ok: boolean;
  currentBranch: string | null;
  currentBranchReadable?: boolean;
  baseBranch: string;
  dirtyFiles: number;
  untrackedFiles: number;
  ahead: number | null;
  behind: number | null;
  remoteBranch: string;
  commands: GitSyncPreflight['commands'];
}): GitSyncNextAction {
  // This is the compact, machine-readable version of the longer remediation
  // text. It lets dashboard clients and headless foreman workers pick one safe
  // next action without re-deriving Git policy from raw blocker strings.
  if (input.ok) {
    return {
      code: 'ready_for_jules',
      tone: 'ready',
      label: 'GitHub Sync Ready',
      command: null,
      summary: `${input.baseBranch} matches ${input.remoteBranch} and the working tree is clean enough for Jules.`,
      steps: [
        'Create the Linear issue if this workflow requires one.',
        'Prepare or stage the Jules handoff.',
        'Launch Jules only from the recorded GitHub base commit.',
      ],
    };
  }

  if (input.currentBranchReadable === false) {
    return {
      code: 'inspect_git_state',
      tone: 'blocked',
      label: 'Inspect Git State',
      command: input.commands.status,
      summary: 'Symphony could not read the local Git branch. Confirm this is the intended repository before Jules starts.',
      steps: [
        'Confirm the configured repoRoot points at a Git checkout.',
        'Inspect the fetch, status, and branch command output.',
        'Fix the repository or Symphony workflow path, then re-run Check GitHub Sync.',
      ],
    };
  }

  if (input.currentBranch !== input.baseBranch) {
    return {
      code: 'switch_base_branch',
      tone: 'blocked',
      label: `Switch to ${input.baseBranch}`,
      command: null,
      summary: `Symphony is on ${input.currentBranch || 'a detached branch'}, but Jules must start from ${input.baseBranch}.`,
      steps: [
        `Switch to ${input.baseBranch} or intentionally change the Symphony base branch.`,
        'Re-run Check GitHub Sync.',
        'Do not launch Jules from a different local branch by accident.',
      ],
    };
  }

  if (input.dirtyFiles > 0 || input.untrackedFiles > 0) {
    return {
      code: 'review_local_changes',
      tone: 'blocked',
      label: 'Review Local Changes',
      command: input.commands.status,
      summary: 'local changes are present. Decide what Jules must see before starting cloud work.',
      steps: [
        'Review tracked and untracked files.',
        'Commit and push work that Jules must use.',
        'Stash, move, ignore, or intentionally leave local-only work before rechecking GitHub sync.',
      ],
    };
  }

  if ((input.ahead ?? 0) > 0 && (input.behind ?? 0) > 0) {
    return {
      code: 'resolve_divergence',
      tone: 'blocked',
      label: `Resolve ${input.baseBranch} divergence`,
      command: input.commands.inspectDivergence,
      summary: `${input.baseBranch} and ${input.remoteBranch} both have unique commits; a fast-forward pull is not safe.`,
      steps: [
        'Inspect the commits that exist only locally and only on GitHub.',
        'Decide whether to push, rebase, merge, cherry-pick, or reset by explicit operator choice.',
        'Re-run Check GitHub Sync only after local and GitHub base commits match.',
      ],
    };
  }

  if ((input.behind ?? 0) > 0) {
    return {
      code: 'pull_fast_forward',
      tone: 'blocked',
      label: `Fast-forward ${input.baseBranch}`,
      command: input.commands.pullFastForward,
      summary: `${input.baseBranch} is behind ${input.remoteBranch}; local checkout must catch up before Jules starts.`,
      steps: [
        'Fast-forward local master from GitHub after local changes are safe.',
        'Re-run Check GitHub Sync.',
        'Start Jules only after local and GitHub commits match.',
      ],
    };
  }

  if ((input.ahead ?? 0) > 0) {
    return {
      code: 'push_base',
      tone: 'blocked',
      label: `Push ${input.baseBranch}`,
      command: input.commands.pushBase,
      summary: `${input.baseBranch} has local commits that GitHub and Jules cannot see yet.`,
      steps: [
        `Push local ${input.baseBranch} commits to ${input.remoteBranch}.`,
        'Re-run Check GitHub Sync.',
        'Launch Jules only after GitHub has the same base commit.',
      ],
    };
  }

  return {
    code: 'inspect_git_state',
    tone: 'blocked',
    label: 'Inspect Git State',
    command: input.commands.status,
    summary: 'Symphony could not identify a single automatic Git sync remedy.',
    steps: [
      'Read the blocker details.',
      'Inspect status, fetch, and divergence output.',
      'Fix the reported Git state, then re-run Check GitHub Sync.',
    ],
  };
}

export function buildLocalSyncNextAction(input: {
  prMerged: boolean;
  safeToPull: boolean;
  upToDate: boolean;
  currentBranch: string | null;
  baseBranch: string;
  dirtyFiles: number;
  untrackedFiles: number;
  ahead: number | null;
  behind: number | null;
  pullCommand: string;
}): LocalSyncNextAction {
  // This is the local return-path equivalent of the Git launch gate action.
  // It tells a foreman or dashboard client the one safest next move before
  // Symphony mutates the user's local checkout after a Jules PR merges.
  if (!input.prMerged) {
    return {
      code: 'wait_for_pr_merge',
      tone: 'waiting',
      label: 'Wait for PR Merge',
      command: null,
      summary: 'The Jules PR is not marked merged yet, so local master must not pull it.',
      steps: [
        'Refresh PR checks until GitHub reports the Jules PR as merged.',
        'Do not run local sync before the merge is confirmed.',
        'Re-run Check Local Sync after merge.',
      ],
    };
  }

  if (input.currentBranch !== input.baseBranch) {
    return {
      code: 'switch_base_branch',
      tone: 'blocked',
      label: `Switch to ${input.baseBranch}`,
      command: null,
      summary: `Local sync is on ${input.currentBranch || 'a detached branch'}, not ${input.baseBranch}.`,
      steps: [
        `Switch to ${input.baseBranch}.`,
        'Re-run Check Local Sync.',
        'Only sync Jules work into the configured base branch.',
      ],
    };
  }

  if (input.dirtyFiles > 0 || input.untrackedFiles > 0) {
    return {
      code: 'review_local_changes',
      tone: 'blocked',
      label: 'Review Local Changes',
      command: null,
      summary: 'local changes are present. Decide what must be preserved before pulling Jules work.',
      steps: [
        'Review tracked and untracked files.',
        'Commit intended work, stash temporary work, or remove accidental files.',
        'Re-run Check Local Sync before pulling.',
      ],
    };
  }

  if ((input.ahead ?? 0) > 0) {
    return {
      code: 'handle_local_commits',
      tone: 'blocked',
      label: 'Handle Local Commits',
      command: null,
      summary: `${input.baseBranch} has local-only commits that could complicate the Jules return path.`,
      steps: [
        'Push local commits if they should be part of GitHub master.',
        'Move or branch local-only work if it should stay separate.',
        'Re-run Check Local Sync before pulling Jules work.',
      ],
    };
  }

  if (input.safeToPull) {
    return {
      code: 'sync_local_master',
      tone: 'ready',
      label: 'Sync Local Master',
      command: input.pullCommand,
      summary: `${input.baseBranch} can fast-forward from GitHub.`,
      steps: [
        'Run the guarded fast-forward command.',
        'Confirm the pull reports a fast-forward or already-up-to-date state.',
        'Start the next Jules task only after local master is current.',
      ],
    };
  }

  if (input.upToDate) {
    return {
      code: 'local_master_current',
      tone: 'ready',
      label: 'Local Master Current',
      command: null,
      summary: `${input.baseBranch} already matches GitHub after the Jules merge.`,
      steps: [
        'No local sync command is needed.',
        'Use the dashboard to draft the next bounded Jules task.',
      ],
    };
  }

  return {
    code: 'inspect_local_sync',
    tone: 'blocked',
    label: 'Inspect Local Sync',
    command: null,
    summary: 'Symphony could not identify one safe local sync action.',
    steps: [
      'Read the local sync blockers and details.',
      'Resolve the reported checkout state.',
      'Re-run Check Local Sync before pulling from GitHub.',
    ],
  };
}

export function buildPullRequestNextAction(input: {
  state: string | null;
  isDraft: boolean | null;
  mergeable: string | null;
  checks: PullRequestCheckSummary | null;
  files: Pick<PullRequestFileSummary, 'risk' | 'riskReasons' | 'outOfScopeFiles'> | null;
  scoutReviewCommand: string | null;
  julesFeedbackCommand?: string | null;
  coreValidationCommand: string | null;
  coreMergeCommand: string | null;
  refreshPullRequestUrl: string | null;
}): PullRequestNextAction {
  const action = (
    code: PullRequestNextAction['code'],
    tone: PullRequestNextAction['tone'],
    label: string,
    command: string | null,
    feedbackCommand: string | null,
    url: string | null,
    summary: string,
    steps: string[],
  ): PullRequestNextAction => ({ code, tone, label, command, feedbackCommand, url, summary, steps });

  // This is the PR-specific foreman decision after Jules opens a GitHub PR.
  // It does not merge anything; it tells Scout/Core and the dashboard which
  // review stage must happen before local sync is allowed.
  if (!input.state) {
    return action('refresh_pull_request', 'ready', 'Refresh PR Checks', null, null, input.refreshPullRequestUrl,
      'The PR exists, but Symphony has not read its current GitHub state yet.',
      ['Refresh PR checks and changed files.', 'Review Scout/Core readiness after the refresh.']);
  }

  if (input.state === 'MERGED') {
    return action('check_local_sync', 'ready', 'Check Local Sync', null, null, null,
      'GitHub reports the PR merged. The next step is the guarded local sync check.',
      ['Run Check Local Sync.', 'Only sync local master if the local sync gate says it is safe.']);
  }

  if (input.state === 'CLOSED') {
    return action('reopen_or_replace_pr', 'blocked', 'Replace Closed PR', null, input.julesFeedbackCommand ?? null, input.refreshPullRequestUrl,
      'GitHub reports this PR closed before merge.',
      ['Inspect the closed PR.', 'Leave a GitHub PR comment for Jules if the closed work needs replacement context.', 'Ask Jules for a replacement PR or create a new bounded handoff.', 'Refresh PR state after repair.']);
  }

  if (input.isDraft) {
    return action('refresh_pull_request', 'waiting', 'Wait for Ready PR', null, null, input.refreshPullRequestUrl,
      'The PR is still a draft.',
      ['Wait for Jules to mark the PR ready for review.', 'Refresh PR checks after the draft state changes.']);
  }

  if (input.mergeable === 'CONFLICTING') {
    return action('resolve_conflicts', 'blocked', 'Resolve PR Conflicts', input.scoutReviewCommand, input.julesFeedbackCommand ?? null, input.refreshPullRequestUrl,
      'GitHub reports merge conflicts.',
      ['Have Scout bridge the conflict and identify overlapping files.', 'Leave a GitHub PR comment for Jules with the conflict course correction.', 'Send follow-up work to Jules or repair the branch.', 'Refresh PR checks after conflicts are resolved.']);
  }

  if (input.checks?.conclusion === 'failing') {
    return action('repair_failed_checks', 'blocked', 'Repair Failed Checks', input.scoutReviewCommand, input.julesFeedbackCommand ?? null, input.refreshPullRequestUrl,
      'GitHub checks are failing.',
      ['Inspect failed checks.', 'Leave a GitHub PR comment for Jules with the failing-check course correction.', 'Send focused repair work to Jules or fix the PR.', 'Refresh PR checks after repair.']);
  }

  if (input.checks?.conclusion === 'pending' || input.checks?.conclusion === 'unknown' || !input.checks) {
    return action('wait_for_checks', 'waiting', 'Wait for PR Checks', null, null, input.refreshPullRequestUrl,
      'GitHub checks are not conclusively passing yet.',
      ['Refresh PR checks after GitHub updates.', 'Do not ask Core to merge until checks are passing.']);
  }

  if (input.files?.risk === 'medium' || input.files?.risk === 'high') {
    return action('scout_bridge_risk', 'blocked', 'Scout Bridge Risk', input.scoutReviewCommand, input.julesFeedbackCommand ?? null, input.refreshPullRequestUrl,
      'Changed files need Scout review before Core merges.',
      ['Have Scout review risky, out-of-scope, or conflict-prone files.', 'Record accept, repair, or reject disposition.', 'Leave a GitHub PR comment for Jules if the risky files need course correction.', 'Refresh PR checks after Scout/Core updates.']);
  }

  return action('core_validate_and_merge', 'ready', 'Core Validate and Merge',
    input.coreValidationCommand || input.coreMergeCommand,
    null,
    input.refreshPullRequestUrl,
    'The PR looks ready for Core validation and merge after Scout clears it.',
    ['Run Core validation.', 'Merge only after Core accepts the PR.', 'Refresh PR state after merge, then check local sync.']);
}

interface JulesManifestTask {
  id: string;
  title: string;
  persona: string;
  mode: 'worker';
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
  /** Exact GitHub commit Symphony verified before writing or launching the manifest. */
  startingCommit: string;
  requirePlanApproval: boolean;
  automationMode: 'AUTO_CREATE_PR';
  tasks: JulesManifestTask[];
}

interface JulesTaskRunRecord {
  taskId: string;
  sessionId?: string;
  state?: string;
  url?: string;
  pullRequestUrl?: string;
  updatedAt?: string;
}

interface PullRequestCheckSummary {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  skipped: number;
  unknown: number;
  conclusion: 'passing' | 'failing' | 'pending' | 'unknown';
  artifacts: PullRequestCheckArtifact[];
}

interface PullRequestCheckArtifact {
  checkName: string;
  artifactName: string;
  detailsUrl: string | null;
  summary: string;
}

interface PullRequestFileSummary {
  total: number;
  additions: number;
  deletions: number;
  risk: 'low' | 'medium' | 'high';
  riskReasons: string[];
  scopeFiles: string[];
  outOfScopeFiles: string[];
  files: Array<{
    path: string;
    additions: number;
    deletions: number;
    risk: 'low' | 'medium' | 'high';
    reason: string | null;
  }>;
}

interface PullRequestFeedbackSummary {
  totalComments: number;
  julesFeedback: PullRequestFeedbackComment[];
  scoutConflictComments: PullRequestFeedbackComment[];
  externalReviewComments: PullRequestFeedbackComment[];
  summary: string;
}

interface PullRequestFeedbackComment {
  author: string;
  body: string;
  url: string | null;
  createdAt: string | null;
  source: 'comment' | 'review';
  conflictFile?: string | null;
  priorityPullRequest?: number | null;
}

export interface PullRequestNextAction {
  code:
    | 'refresh_pull_request'
    | 'wait_for_checks'
    | 'repair_failed_checks'
    | 'resolve_conflicts'
    | 'scout_bridge_risk'
    | 'core_validate_and_merge'
    | 'check_local_sync'
    | 'reopen_or_replace_pr';
  tone: 'ready' | 'blocked' | 'waiting';
  label: string;
  command: string | null;
  feedbackCommand: string | null;
  url: string | null;
  summary: string;
  steps: string[];
}

interface GitHubPullRequestView {
  number?: number;
  state?: string;
  isDraft?: boolean;
  mergeable?: string;
  reviewDecision?: string;
  headRefName?: string;
  baseRefName?: string;
  url?: string;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  files?: Array<{
    path?: string;
    additions?: number;
    deletions?: number;
  }>;
  comments?: Array<GitHubPullRequestComment>;
  reviews?: Array<GitHubPullRequestReview>;
  latestReviews?: Array<GitHubPullRequestReview>;
  statusCheckRollup?: Array<{
    name?: string;
    status?: string;
    conclusion?: string;
    detailsUrl?: string;
  }>;
}

interface GitHubPullRequestComment {
  author?: { login?: string };
  body?: string;
  url?: string;
  createdAt?: string;
}

interface GitHubPullRequestReview {
  author?: { login?: string };
  body?: string;
  url?: string;
  state?: string;
  submittedAt?: string;
}

interface StoredDraftFile {
  drafts: TaskDraft[];
  handoffs: JulesHandoff[];
  gitDisposition: GitDispositionRecord[];
  taskNudges: TaskNudgeRecord[];
}

// ============================================================================
// Task Intake Store
// ============================================================================
// This class is intentionally independent from the Linear tracker and Codex
// runner. It is the safe front door: collect task intent locally, then show the
// GitHub gate that must pass before the task can later be handed to Jules.
// ============================================================================

export class TaskIntakeStore {
  private repoRoot: string;
  private storePath: string;
  private baseBranch: string;
  private remoteName: string;

  constructor(opts: {
    repoRoot: string;
    storePath: string;
    baseBranch?: string;
    remoteName?: string;
  }) {
    this.repoRoot = opts.repoRoot;
    this.storePath = opts.storePath;
    this.baseBranch = opts.baseBranch ?? 'master';
    this.remoteName = opts.remoteName ?? 'origin';
  }

  async snapshot(): Promise<TaskDraftSnapshot> {
    const preflight = await this.runGitSyncPreflight();
    const stored = await this.readStoredDrafts();
    return this.buildSnapshotFromStored(stored, preflight);
  }

  async recordGitDisposition(input: GitDispositionInput): Promise<TaskDraftSnapshot> {
    const category = normalizeGitDispositionCategory(input.category);
    const decision = normalizeGitDispositionDecision(input.decision);
    const note = typeof input.note === 'string' ? input.note.trim().slice(0, 600) : '';
    const stored = await this.readStoredDrafts();
    const now = new Date().toISOString();
    const existing = new Map(stored.gitDisposition.map(record => [record.category, record]));
    const definition = GIT_DISPOSITION_CATEGORIES.find(item => item.category === category);

    if (!definition) {
      throw new Error(`Unsupported Git disposition category: ${String(input.category)}`);
    }

    // This records the operator's intent about user-owned Git work. It does not
    // run Git commands, does not clean the worktree, and does not change whether
    // preflight blocks Linear/Jules. The hard gate still comes from the live Git
    // state returned by runGitSyncPreflight().
    existing.set(category, {
      category,
      label: definition.label,
      decision,
      decisionLabel: GIT_DISPOSITION_DECISION_LABELS[decision],
      note,
      updatedAt: now,
    });

    stored.gitDisposition = buildGitDispositionSummary(Array.from(existing.values())).categories;
    await this.writeStoredDrafts(stored);

    return this.snapshot();
  }

  async recordTaskNudge(input: TaskNudgeInput): Promise<TaskDraftSnapshot> {
    const stored = await this.readStoredDrafts();
    const preflight = await this.runGitSyncPreflight();
    const routing = buildTaskRoutingPlan(stored.drafts, stored.handoffs, preflight);
    const now = new Date().toISOString();
    const action = normalizeTaskNudgeAction(input.action ?? routing.nextAction.code);
    const phase = normalizeTaskNudgePhase(input.phase ?? inferTaskNudgePhase(routing));
    const subjectKind = normalizeTaskNudgeSubjectKind(input.subjectKind ?? inferTaskNudgeSubjectKind(routing, stored));
    const subjectId = String(input.subjectId ?? routing.subjectId ?? '').trim();

    if (!subjectId) {
      throw new Error('Task nudge subject is required.');
    }

    const subjectTitle = resolveTaskNudgeSubjectTitle(subjectId, subjectKind, stored, routing);
    const pauseSeconds = typeof input.pauseSeconds === 'number' && Number.isFinite(input.pauseSeconds)
      ? Math.max(0, Math.round(input.pauseSeconds))
      : action === routing.nextAction.code
        ? routing.nextAction.pauseSeconds
        : defaultTaskNudgePauseSeconds(action, phase);
    const nextNudgeAt = pauseSeconds > 0 ? addSeconds(now, pauseSeconds) : null;
    const note = typeof input.note === 'string' ? input.note.trim().slice(0, 800) : '';

    // A nudge record is evidence, not an action runner. It captures the
    // foreman's pause/refresh/send/assign decision beside the task queue so a
    // later Codex turn can continue from durable state instead of memory.
    stored.taskNudges.unshift({
      id: `nudge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      subjectId,
      subjectKind,
      subjectTitle,
      action,
      phase,
      note,
      createdAt: now,
      pauseSeconds,
      nextNudgeAt,
      status: 'recorded',
      mutatesExternalSystems: false,
    });
    stored.taskNudges = normalizeTaskNudges(stored.taskNudges).slice(0, 80);

    await this.writeStoredDrafts(stored);

    return this.buildSnapshotFromStored(stored, preflight);
  }

  private buildSnapshotFromStored(stored: StoredDraftFile, preflight: GitSyncPreflight): TaskDraftSnapshot {
    const gitDisposition = buildGitDispositionSummary(stored.gitDisposition);
    const taskRouting = buildTaskRoutingPlan(stored.drafts, stored.handoffs, preflight);

    // Every dashboard/API response carries the same preflight, disposition,
    // guarded sync-plan, routing, and nudge-ledger view. Keeping these derived
    // at the snapshot boundary prevents command buttons, foreman workers, and
    // browser panels from drifting into different interpretations of the
    // blocked Git/Jules/GitHub boundary.
    return {
      drafts: this.applyPreflightStatus(stored.drafts, preflight),
      handoffs: this.applyHandoffPreflightStatus(stored.handoffs, preflight),
      preflight,
      gitDisposition,
      gitSyncPlan: buildGitSyncPlan(preflight, gitDisposition),
      taskRouting,
      taskNudges: buildTaskNudgeSummary(stored.taskNudges, taskRouting),
    };
  }

  async createDraft(input: TaskDraftInput): Promise<TaskDraftSnapshot> {
    const title = input.title.trim();
    const body = input.body.trim();
    const expectedFiles = normalizeExpectedFiles(input.expectedFiles);
    const verificationCommands = normalizeVerificationCommands(input.verificationCommands);

    if (!title) {
      throw new Error('Task title is required.');
    }

    if (!body) {
      throw new Error('Task body is required.');
    }

    if (!expectedFiles.length) {
      throw new Error('Expected files or write scopes are required.');
    }

    if (!verificationCommands.length) {
      throw new Error('Verification commands are required.');
    }

    const stored = await this.readStoredDrafts();
    const duplicate = findDuplicateTaskRecord(stored, {
      title,
      body,
      expectedFiles,
      verificationCommands,
    });
    if (duplicate) {
      throw new Error(`Duplicate Jules task already exists as ${duplicate.kind} ${duplicate.id}: ${duplicate.title}.`);
    }

    const now = new Date().toISOString();
    const preflight = await this.runGitSyncPreflight();

    // New drafts inherit the current gate status. This makes the dashboard show
    // immediately whether the task is only an idea or ready for the future
    // Linear/Jules handoff.
    stored.drafts.unshift({
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      body,
      expectedFiles,
      verificationCommands,
      executor: 'jules',
      status: preflight.ok ? 'ready_for_handoff' : 'blocked_by_git_sync',
      linearIssueId: null,
      linearIssueIdentifier: null,
      linearIssueUrl: null,
      linearIssueCreatedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    await this.writeStoredDrafts(stored);

      return this.buildSnapshotFromStored(stored, preflight);
  }

  async promoteDraft(
    draftId: string,
    opts: { requireLinearIssue?: boolean } = {}
  ): Promise<TaskDraftSnapshot> {
    const stored = await this.readStoredDrafts();
    const draft = stored.drafts.find(item => item.id === draftId);
    if (!draft) {
      throw new Error(`Draft ${draftId} was not found.`);
    }

    const preflight = await this.runGitSyncPreflight();
    if (!preflight.ok) {
      throw new Error(`GitHub sync gate is blocked: ${preflight.blockers.join(' ')}`);
    }

    if (opts.requireLinearIssue && !draft.linearIssueIdentifier) {
      // Handoff promotion is the boundary where a dashboard draft becomes work
      // a foreman can claim and track. Linear-backed workflows require that
      // tracking issue first so Jules work has a visible owner and audit trail.
      throw new Error('Create Linear Issue before preparing a Jules handoff, so a Symphony foreman can claim and track the work.');
    }

    const now = new Date().toISOString();
    const handoff: JulesHandoff = {
      id: `handoff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      draftId: draft.id,
      title: draft.title,
      executor: 'jules',
      status: 'ready_for_jules',
      prompt: buildJulesPrompt(draft, preflight),
      expectedFiles: draft.expectedFiles ?? [],
      verificationCommands: draft.verificationCommands ?? [],
      createdAt: now,
      updatedAt: now,
      gitPreflight: preflight,
      baseCommitDrift: null,
      runId: null,
      manifestPath: null,
      launchCommand: null,
      launchOutput: null,
      launchError: null,
      launchedAt: null,
      statusCommand: null,
      reviewCommand: null,
      pullCommand: null,
      recordsPath: null,
      lastStatusRefreshAt: null,
      julesSessionId: null,
      julesSessionUrl: null,
      julesState: null,
      linearIssueId: draft.linearIssueId ?? null,
      linearIssueIdentifier: draft.linearIssueIdentifier ?? null,
      linearIssueUrl: draft.linearIssueUrl ?? null,
      linearIssueCreatedAt: draft.linearIssueCreatedAt ?? null,
      githubPullRequestUrl: null,
      githubPullRequestState: null,
      githubPullRequestIsDraft: null,
      githubPullRequestMergeable: null,
      githubPullRequestReviewDecision: null,
      githubPullRequestHeadRef: null,
      githubPullRequestBaseRef: null,
      githubPullRequestChecks: null,
      githubPullRequestFiles: null,
      githubPullRequestFeedback: null,
      githubPullRequestNextAction: null,
      githubPullRequestRefreshError: null,
      lastPullRequestRefreshAt: null,
      pullRequestViewCommand: null,
      pullRequestChecksCommand: null,
      pullRequestMergeCommand: null,
      scoutReviewCommand: null,
      coreValidationCommand: null,
      coreMergeCommand: null,
      localSyncCommand: null,
      localSyncStatus: null,
      localSyncOutput: null,
      localSyncError: null,
      lastLocalSyncAt: null,
      operatorMessages: [],
      planApprovals: [],
    };

    // Keep the original draft for auditability while adding a handoff record.
    // The later Linear/Jules bridge can attach external IDs to this handoff
    // without losing the user's original task wording.
    stored.handoffs.unshift(handoff);
    await this.writeStoredDrafts(stored);

    return this.buildSnapshotFromStored(stored, preflight);
  }

  async watchPullRequest(input: PullRequestWatchInput): Promise<TaskDraftSnapshot> {
    const prUrl = String(input.prUrl ?? '').trim();
    const title = typeof input.title === 'string' && input.title.trim()
      ? input.title.trim()
      : `Observed GitHub PR: ${prUrl}`;
    const expectedFiles = normalizeExpectedFiles(input.expectedFiles);
    const verificationCommands = normalizeVerificationCommands(input.verificationCommands);

    if (!/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+$/i.test(prUrl)) {
      throw new Error('A full GitHub pull request URL is required.');
    }

    const stored = await this.readStoredDrafts();
    const now = new Date().toISOString();
    const existingIndex = stored.handoffs.findIndex(handoff => handoff.githubPullRequestUrl === prUrl);
    const observedHandoff = buildObservedPullRequestHandoff({
      prUrl,
      title,
      expectedFiles,
      verificationCommands,
      now,
      baseBranch: this.baseBranch,
      existing: existingIndex >= 0 ? stored.handoffs[existingIndex] : null,
    });

    // Observed PRs are read-only foreman watch records. They let Symphony learn
    // from real Jules/GitHub/Scout cases even when the current local Git base is
    // blocked, without claiming that this dashboard created or launched them.
    if (existingIndex >= 0) {
      stored.handoffs[existingIndex] = observedHandoff;
    } else {
      stored.handoffs.unshift(observedHandoff);
    }

    await this.writeStoredDrafts(stored);

    return this.snapshot();
  }

  async createObservedPullRequestFollowUp(input: ObservedPullRequestFollowUpInput): Promise<TaskDraftSnapshot> {
    const handoffId = String(input.handoffId ?? '').trim();
    const stored = await this.readStoredDrafts();
    const handoff = stored.handoffs.find(item => item.id === handoffId);

    if (!handoff) {
      throw new Error(`Observed PR handoff ${handoffId} was not found.`);
    }

    if (handoff.status !== 'observed_pr' || !handoff.githubPullRequestUrl) {
      throw new Error('Follow-up drafts can only be created from read-only observed PR records.');
    }

    const title = typeof input.title === 'string' && input.title.trim()
      ? input.title.trim()
      : buildObservedPullRequestFollowUpTitle(handoff);
    const expectedFiles = normalizeExpectedFiles(input.expectedFiles);
    const verificationCommands = normalizeVerificationCommands(input.verificationCommands);
    const body = typeof input.body === 'string' && input.body.trim()
      ? input.body.trim()
      : buildObservedPullRequestFollowUpBody(handoff);

    // This intentionally reuses the normal draft path instead of creating a
    // special "observed PR task" queue. The old PR remains a watch-only handoff;
    // the new draft is separate work that must pass the same Git, Linear, Jules,
    // and verification gates as any dashboard-created task.
    return this.createDraft({
      title,
      body,
      expectedFiles: expectedFiles.length ? expectedFiles : deriveObservedPullRequestFollowUpFiles(handoff),
      verificationCommands: verificationCommands.length
        ? verificationCommands
        : deriveObservedPullRequestFollowUpVerification(handoff),
    });
  }

  async getDraft(draftId: string): Promise<TaskDraft> {
    const stored = await this.readStoredDrafts();
    const draft = stored.drafts.find(item => item.id === draftId);

    if (!draft) {
      throw new Error(`Draft ${draftId} was not found.`);
    }

    return draft;
  }

  async attachLinearIssueToDraft(
    draftId: string,
    issue: { id: string; identifier: string; url: string | null }
  ): Promise<TaskDraftSnapshot> {
    const stored = await this.readStoredDrafts();
    const draftIndex = stored.drafts.findIndex(item => item.id === draftId);

    if (draftIndex < 0) {
      throw new Error(`Draft ${draftId} was not found.`);
    }

    const now = new Date().toISOString();
    const preflight = await this.runGitSyncPreflight();

    // Linking the Linear issue back to the draft gives the dashboard a durable
    // trace from human task wording to the worker issue that Symphony will poll.
    // It does not launch Jules by itself; the foreman worker still follows the
    // normal Linear/Symphony path after the issue exists.
    stored.drafts[draftIndex] = {
      ...stored.drafts[draftIndex],
      linearIssueId: issue.id,
      linearIssueIdentifier: issue.identifier,
      linearIssueUrl: issue.url,
      linearIssueCreatedAt: now,
      updatedAt: now,
    };

    await this.writeStoredDrafts(stored);

      return this.buildSnapshotFromStored(stored, preflight);
  }

  async stageHandoffManifest(handoffId: string): Promise<TaskDraftSnapshot> {
    const stored = await this.readStoredDrafts();
    const handoffIndex = stored.handoffs.findIndex(item => item.id === handoffId);
    if (handoffIndex < 0) {
      throw new Error(`Handoff ${handoffId} was not found.`);
    }

    const preflight = await this.runGitSyncPreflight();
    if (!preflight.ok) {
      throw new Error(`GitHub sync gate is blocked: ${preflight.blockers.join(' ')}`);
    }

    const handoff = stored.handoffs[handoffIndex];
    const sourceDraft = stored.drafts.find(item => item.id === handoff.draftId);
    const expectedFiles = sourceDraft?.expectedFiles ?? handoff.expectedFiles ?? [];
    const verificationCommands = sourceDraft?.verificationCommands ?? handoff.verificationCommands ?? [];
    const prompt = sourceDraft ? buildJulesPrompt(sourceDraft, preflight) : handoff.prompt;
    const runId = handoff.runId ?? `symphony-${handoff.id}`;
    const orchestratorCliPath = join(this.repoRoot, '.jules', 'orchestrator', 'cli.ts');
    const manifestPath = join(this.repoRoot, '.jules', 'runs', runId, 'manifest.json');
    const recordsPath = join(this.repoRoot, '.jules', 'runs', runId, 'records.json');
    const manifest = buildManifest({ ...handoff, prompt, expectedFiles, verificationCommands }, preflight, runId);
    const manifestRelativePath = relative(this.repoRoot, manifestPath).replace(/\\/g, '/');
    const launchCommand = `npx tsx .jules/orchestrator/cli.ts launch ${manifestRelativePath}`;
    const statusCommand = `npx tsx .jules/orchestrator/cli.ts status ${manifestRelativePath}`;
    const reviewCommand = `npx tsx .jules/orchestrator/cli.ts review ${manifestRelativePath}`;
    const now = new Date().toISOString();

    try {
      await access(orchestratorCliPath);
    } catch {
      // Staging is local and reviewable, but it still promises that the next
      // action will use Aralia's existing Jules orchestrator. If that CLI is
      // missing, stop before writing a manifest that points at a dead launch
      // path and tell the operator exactly which bridge is unavailable.
      throw new Error('Jules orchestrator CLI is missing at .jules/orchestrator/cli.ts. Restore the existing Jules orchestrator before staging this handoff.');
    }

    await mkdir(dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    // The manifest is the first durable bridge between the dashboard intake and
    // the existing Jules orchestrator. It is safe to create locally because it
    // does not call the Jules API yet; the later launch action can run the
    // recorded command once the operator is ready. The prompt is refreshed from
    // the original draft at staging time so a task promoted yesterday cannot
    // accidentally tell Jules to start from yesterday's GitHub commit after the
    // sync gate has verified a newer base.
    stored.handoffs[handoffIndex] = {
      ...handoff,
      status: 'manifest_ready',
      updatedAt: now,
      gitPreflight: preflight,
      baseCommitDrift: null,
      prompt,
      expectedFiles,
      verificationCommands,
      runId,
      manifestPath,
      launchCommand,
      statusCommand,
      reviewCommand,
      recordsPath,
      launchError: null,
    };

    await this.writeStoredDrafts(stored);

      return this.buildSnapshotFromStored(stored, preflight);
  }

  async launchHandoff(handoffId: string): Promise<TaskDraftSnapshot> {
    // Launching is intentionally a second step after manifest staging. It calls
    // the already-existing Jules orchestrator instead of inventing a separate
    // Jules bridge, then copies the run record back into the dashboard store so
    // the operator can see the cloud session and later PR status.
    await this.stageHandoffManifest(handoffId);

    const stored = await this.readStoredDrafts();
    const handoffIndex = stored.handoffs.findIndex(item => item.id === handoffId);
    if (handoffIndex < 0) {
      throw new Error(`Handoff ${handoffId} was not found.`);
    }

    const handoff = stored.handoffs[handoffIndex];
    if (!handoff.runId || !handoff.manifestPath) {
      throw new Error(`Handoff ${handoffId} does not have a staged Jules manifest.`);
    }

    // stageHandoffManifest performs the hard GitHub sync gate immediately
    // before writing the manifest. Use that same receipt for launch state so
    // the dashboard can prove which GitHub commit Jules was actually asked to
    // clone. A separate earlier preflight would make failed launches look like
    // they used a different base than the manifest on disk.
    const launchPreflight = handoff.gitPreflight;
    const manifestRelativePath = relative(this.repoRoot, handoff.manifestPath).replace(/\\/g, '/');
    const recordsPath = join(this.repoRoot, '.jules', 'runs', handoff.runId, 'records.json');
    const now = new Date().toISOString();

    try {
      const result = await execFileAsync(
        'npx.cmd',
        ['tsx', '.jules/orchestrator/cli.ts', 'launch', manifestRelativePath],
        {
          cwd: this.repoRoot,
          // Windows .cmd wrappers need shell mediation when spawned from Node.
          // Keeping that rule here prevents the dashboard server from failing
          // only when it finally crosses from local manifest staging to Jules.
          shell: true,
          timeout: 120_000,
          maxBuffer: 2 * 1024 * 1024,
        }
      );
      const record = await readFirstRunRecord(recordsPath);
      const pullCommand = record?.sessionId
        ? `npx tsx .jules/orchestrator/cli.ts pull ${record.sessionId}`
        : handoff.pullCommand;

      stored.handoffs[handoffIndex] = {
        ...handoff,
        status: 'sent_to_jules',
        updatedAt: now,
        gitPreflight: launchPreflight,
        baseCommitDrift: null,
        launchOutput: compactCommandOutput(result.stdout, result.stderr),
        launchError: null,
        launchedAt: now,
        recordsPath,
        lastStatusRefreshAt: now,
        julesSessionId: record?.sessionId ?? handoff.julesSessionId,
        julesSessionUrl: record?.url ?? handoff.julesSessionUrl,
        julesState: record?.state ?? handoff.julesState,
        pullCommand,
        githubPullRequestUrl: record?.pullRequestUrl ?? handoff.githubPullRequestUrl,
        ...buildPullRequestCommands(record?.pullRequestUrl ?? handoff.githubPullRequestUrl, this.baseBranch),
      };
    } catch (err) {
      const failed = err as Error & { stdout?: string; stderr?: string };
      stored.handoffs[handoffIndex] = {
        ...handoff,
        status: 'launch_failed',
        updatedAt: now,
        gitPreflight: launchPreflight,
        baseCommitDrift: null,
        launchOutput: compactCommandOutput(failed.stdout, failed.stderr),
        launchError: failed.stderr || failed.stdout || failed.message,
      };

      await this.writeStoredDrafts(stored);
      throw new Error(`Jules launch failed: ${failed.stderr || failed.stdout || failed.message}`);
    }

    await this.writeStoredDrafts(stored);

    return this.buildSnapshotFromStored(stored, launchPreflight);
  }

  async refreshHandoffStatus(handoffId: string): Promise<TaskDraftSnapshot> {
    const stored = await this.readStoredDrafts();
    const handoffIndex = stored.handoffs.findIndex(item => item.id === handoffId);
    if (handoffIndex < 0) {
      throw new Error(`Handoff ${handoffId} was not found.`);
    }

    const handoff = stored.handoffs[handoffIndex];
    if (!handoff.runId || !handoff.manifestPath) {
      throw new Error(`Handoff ${handoffId} does not have a Jules manifest to refresh.`);
    }

    const manifestRelativePath = relative(this.repoRoot, handoff.manifestPath).replace(/\\/g, '/');
    const recordsPath = handoff.recordsPath ?? join(this.repoRoot, '.jules', 'runs', handoff.runId, 'records.json');
    const now = new Date().toISOString();
    let statusOutput = '';
    let statusError: string | null = null;

    try {
      const result = await execFileAsync(
        'npx.cmd',
        ['tsx', '.jules/orchestrator/cli.ts', 'status', manifestRelativePath],
        {
          cwd: this.repoRoot,
          shell: true,
          timeout: 120_000,
          maxBuffer: 2 * 1024 * 1024,
        }
      );
      statusOutput = compactCommandOutput(result.stdout, result.stderr);
    } catch (err) {
      const failed = err as Error & { stdout?: string; stderr?: string };
      statusOutput = compactCommandOutput(failed.stdout, failed.stderr);
      statusError = failed.stderr || failed.stdout || failed.message;
    }

    const record = await readFirstRunRecord(recordsPath);
    const nextSessionId = record?.sessionId ?? handoff.julesSessionId;
    const preflight = await this.runGitSyncPreflight();

    // A status refresh is read-only unless the operator later chooses to pull a
    // completed session. It records enough commands for the human/Codex foreman
    // to review, pull, and sync the Jules result without guessing CLI syntax.
    stored.handoffs[handoffIndex] = {
      ...handoff,
      status: statusError ? 'status_refresh_failed' : handoff.status,
      updatedAt: now,
      gitPreflight: preflight,
      baseCommitDrift: null,
      launchOutput: statusOutput || handoff.launchOutput,
      launchError: statusError,
      recordsPath,
      lastStatusRefreshAt: now,
      julesSessionId: nextSessionId,
      julesSessionUrl: record?.url ?? handoff.julesSessionUrl,
      julesState: record?.state ?? handoff.julesState,
      githubPullRequestUrl: record?.pullRequestUrl ?? handoff.githubPullRequestUrl,
      ...buildPullRequestCommands(record?.pullRequestUrl ?? handoff.githubPullRequestUrl, this.baseBranch),
      pullCommand: nextSessionId
        ? `npx tsx .jules/orchestrator/cli.ts pull ${nextSessionId}`
        : handoff.pullCommand,
      statusCommand: `npx tsx .jules/orchestrator/cli.ts status ${manifestRelativePath}`,
      reviewCommand: `npx tsx .jules/orchestrator/cli.ts review ${manifestRelativePath}`,
    };

    await this.writeStoredDrafts(stored);

    return this.buildSnapshotFromStored(stored, preflight);
  }

  async refreshPullRequestStatus(handoffId: string): Promise<TaskDraftSnapshot> {
    const stored = await this.readStoredDrafts();
    const handoffIndex = stored.handoffs.findIndex(item => item.id === handoffId);
    if (handoffIndex < 0) {
      throw new Error(`Handoff ${handoffId} was not found.`);
    }

    const handoff = stored.handoffs[handoffIndex];
    const prUrl = handoff.githubPullRequestUrl;
    if (!prUrl) {
      throw new Error(`Handoff ${handoffId} does not have a GitHub PR URL yet.`);
    }

    const now = new Date().toISOString();
    const preflight = await this.runGitSyncPreflight();
    const commands = buildPullRequestCommands(prUrl, this.baseBranch);
    const julesFeedbackCommand = buildPullRequestFeedbackCommand(prUrl, handoff.id);

    try {
      const result = await execFileAsync(
        'gh',
        [
          'pr',
          'view',
          prUrl,
          '--json',
          'number,state,isDraft,mergeable,reviewDecision,headRefName,baseRefName,url,additions,deletions,changedFiles,files,comments,reviews,latestReviews,statusCheckRollup',
        ],
        {
          cwd: this.repoRoot,
          timeout: 60_000,
          maxBuffer: 2 * 1024 * 1024,
        }
      );
      const pr = JSON.parse(result.stdout) as GitHubPullRequestView;
      const pullRequestChecks = summarizePullRequestChecks(pr.statusCheckRollup);
      const pullRequestFiles = summarizePullRequestFiles(pr, handoff.expectedFiles ?? []);
      const pullRequestFeedback = summarizePullRequestFeedback(pr);

      // This is read-only PR tracking. It lets Symphony act as foreman after
      // Jules opens a PR: show checks and merge/local-sync readiness without
      // merging, pulling, or changing the local worktree on the user's behalf.
      stored.handoffs[handoffIndex] = {
        ...handoff,
        updatedAt: now,
        gitPreflight: preflight,
        baseCommitDrift: null,
        githubPullRequestUrl: pr.url ?? prUrl,
        githubPullRequestState: pr.state ?? null,
        githubPullRequestIsDraft: typeof pr.isDraft === 'boolean' ? pr.isDraft : null,
        githubPullRequestMergeable: pr.mergeable ?? null,
        githubPullRequestReviewDecision: pr.reviewDecision ?? null,
        githubPullRequestHeadRef: pr.headRefName ?? null,
        githubPullRequestBaseRef: pr.baseRefName ?? null,
        githubPullRequestChecks: pullRequestChecks,
        githubPullRequestFiles: pullRequestFiles,
        githubPullRequestFeedback: pullRequestFeedback,
        githubPullRequestNextAction: buildPullRequestNextAction({
          state: pr.state ?? null,
          isDraft: typeof pr.isDraft === 'boolean' ? pr.isDraft : null,
          mergeable: pr.mergeable ?? null,
          checks: pullRequestChecks,
          files: pullRequestFiles,
          scoutReviewCommand: commands.scoutReviewCommand,
          julesFeedbackCommand,
          coreValidationCommand: commands.coreValidationCommand,
          coreMergeCommand: commands.coreMergeCommand,
          refreshPullRequestUrl: null,
        }),
        githubPullRequestRefreshError: null,
        lastPullRequestRefreshAt: now,
        ...commands,
      };
    } catch (err) {
      const failed = err as Error & { stdout?: string; stderr?: string };
      stored.handoffs[handoffIndex] = {
        ...handoff,
        updatedAt: now,
        gitPreflight: preflight,
        baseCommitDrift: null,
        githubPullRequestNextAction: buildPullRequestNextAction({
          state: null,
          isDraft: null,
          mergeable: null,
          checks: null,
          files: null,
          scoutReviewCommand: commands.scoutReviewCommand,
          julesFeedbackCommand,
          coreValidationCommand: commands.coreValidationCommand,
          coreMergeCommand: commands.coreMergeCommand,
          refreshPullRequestUrl: null,
        }),
        githubPullRequestRefreshError: failed.stderr || failed.stdout || failed.message,
        lastPullRequestRefreshAt: now,
        ...commands,
      };

      await this.writeStoredDrafts(stored);
      throw new Error(`GitHub PR refresh failed: ${failed.stderr || failed.stdout || failed.message}`);
    }

    await this.writeStoredDrafts(stored);

    return this.buildSnapshotFromStored(stored, preflight);
  }

  async refreshLocalSyncStatus(handoffId: string): Promise<TaskDraftSnapshot> {
    const stored = await this.readStoredDrafts();
    const handoffIndex = stored.handoffs.findIndex(item => item.id === handoffId);
    if (handoffIndex < 0) {
      throw new Error(`Handoff ${handoffId} was not found.`);
    }

    const handoff = stored.handoffs[handoffIndex];
    const status = await this.runLocalSyncStatus(handoff.githubPullRequestState === 'MERGED');
    const preflight = await this.runGitSyncPreflight();

    // Local sync status is the post-merge counterpart to the launch preflight.
    // It is intentionally read-only: show whether a fast-forward pull is safe
    // before any command is allowed to modify the user's local checkout.
    stored.handoffs[handoffIndex] = {
      ...handoff,
      updatedAt: new Date().toISOString(),
      gitPreflight: preflight,
      baseCommitDrift: null,
      localSyncStatus: status,
      localSyncCommand: status.pullCommand,
      localSyncError: null,
    };

    await this.writeStoredDrafts(stored);

    return this.buildSnapshotFromStored(stored, preflight);
  }

  async syncLocalMaster(handoffId: string): Promise<TaskDraftSnapshot> {
    const stored = await this.readStoredDrafts();
    const handoffIndex = stored.handoffs.findIndex(item => item.id === handoffId);
    if (handoffIndex < 0) {
      throw new Error(`Handoff ${handoffId} was not found.`);
    }

    const handoff = stored.handoffs[handoffIndex];
    const before = await this.runLocalSyncStatus(handoff.githubPullRequestState === 'MERGED');
    if (!before.safeToPull) {
      throw new Error(`Local sync is blocked: ${before.blockers.join(' ')}`);
    }

    const now = new Date().toISOString();
    let pullOutput = '';
    let pullError: string | null = null;

    try {
      const result = await execFileAsync(
        'git',
        ['-C', this.repoRoot, 'pull', '--ff-only', this.remoteName, this.baseBranch],
        {
          timeout: 120_000,
          maxBuffer: 2 * 1024 * 1024,
        }
      );
      pullOutput = compactCommandOutput(result.stdout, result.stderr);
    } catch (err) {
      const failed = err as Error & { stdout?: string; stderr?: string };
      pullOutput = compactCommandOutput(failed.stdout, failed.stderr);
      pullError = failed.stderr || failed.stdout || failed.message;
    }

    const after = await this.runLocalSyncStatus(handoff.githubPullRequestState === 'MERGED');
    const preflight = await this.runGitSyncPreflight();

    // The only mutating local sync path is a fast-forward pull after the read
    // gate passes. If git still fails, preserve the output for the dashboard
    // instead of hiding it in terminal history.
    stored.handoffs[handoffIndex] = {
      ...handoff,
      updatedAt: now,
      gitPreflight: preflight,
      baseCommitDrift: null,
      localSyncStatus: after,
      localSyncCommand: after.pullCommand,
      localSyncOutput: pullOutput,
      localSyncError: pullError,
      lastLocalSyncAt: pullError ? handoff.lastLocalSyncAt : now,
    };

    await this.writeStoredDrafts(stored);

    if (pullError) {
      throw new Error(`Local sync failed: ${pullError}`);
    }

    return this.buildSnapshotFromStored(stored, preflight);
  }

  async sendJulesOperatorMessage(handoffId: string, body: string): Promise<TaskDraftSnapshot> {
    const trimmed = body.trim();
    if (!trimmed) {
      throw new Error('Operator message cannot be empty.');
    }

    const stored = await this.readStoredDrafts();
    const handoffIndex = stored.handoffs.findIndex(item => item.id === handoffId);
    if (handoffIndex < 0) {
      throw new Error(`Handoff ${handoffId} was not found.`);
    }

    const handoff = stored.handoffs[handoffIndex];
    if (!handoff.julesSessionId) {
      throw new Error('Jules session id is not available yet. Launch or refresh Jules before sending a message.');
    }

    const now = new Date().toISOString();
    const command = `npx tsx .jules/orchestrator/cli.ts message ${handoff.julesSessionId} ${trimmed}`;
    let message: JulesOperatorMessage;

    try {
      const result = await execFileAsync(
        'npx.cmd',
        ['tsx', '.jules/orchestrator/cli.ts', 'message', handoff.julesSessionId, trimmed],
        {
          cwd: this.repoRoot,
          // The message bridge reuses the existing Jules orchestrator CLI. On
          // Windows, npx.cmd needs shell mediation just like launch/status.
          shell: true,
          timeout: 60_000,
          maxBuffer: 1024 * 1024,
        }
      );

      message = {
        id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        body: trimmed,
        createdAt: now,
        status: 'sent',
        command,
        output: compactCommandOutput(result.stdout, result.stderr),
        error: null,
      };
    } catch (err) {
      const failed = err as Error & { stdout?: string; stderr?: string };
      message = {
        id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        body: trimmed,
        createdAt: now,
        status: 'failed',
        command,
        output: compactCommandOutput(failed.stdout, failed.stderr),
        error: failed.stderr || failed.stdout || failed.message,
      };
    }

    const preflight = await this.runGitSyncPreflight();
    const existingMessages = Array.isArray(handoff.operatorMessages) ? handoff.operatorMessages : [];

    // Operator messages are persisted on the handoff so the dashboard shows
    // what feedback was sent to Jules and whether the Jules API accepted it.
    // This gives the user an audit trail instead of hiding feedback in a
    // transient terminal command.
    stored.handoffs[handoffIndex] = {
      ...handoff,
      updatedAt: now,
      gitPreflight: preflight,
      baseCommitDrift: null,
      operatorMessages: [message, ...existingMessages].slice(0, 20),
    };

    await this.writeStoredDrafts(stored);

    if (message.status === 'failed') {
      throw new Error(`Jules message failed: ${message.error}`);
    }

    return this.buildSnapshotFromStored(stored, preflight);
  }

  async approveJulesPlan(handoffId: string): Promise<TaskDraftSnapshot> {
    const stored = await this.readStoredDrafts();
    const handoffIndex = stored.handoffs.findIndex(item => item.id === handoffId);
    if (handoffIndex < 0) {
      throw new Error(`Handoff ${handoffId} was not found.`);
    }

    const handoff = stored.handoffs[handoffIndex];
    if (!handoff.julesSessionId) {
      throw new Error('Jules session id is not available yet. Launch or refresh Jules before approving a plan.');
    }
    if (handoff.julesState !== 'AWAITING_PLAN_APPROVAL') {
      throw new Error(`Jules session is ${handoff.julesState || 'unknown'}, not awaiting plan approval.`);
    }

    const now = new Date().toISOString();
    const command = `npx tsx .jules/orchestrator/cli.ts approve ${handoff.julesSessionId}`;
    let approval: JulesPlanApproval;

    try {
      const result = await execFileAsync(
        'npx.cmd',
        ['tsx', '.jules/orchestrator/cli.ts', 'approve', handoff.julesSessionId],
        {
          cwd: this.repoRoot,
          // Plan approval reuses the existing Jules orchestrator CLI and only
          // proceeds when the tracked session explicitly reports that a plan is
          // waiting. This keeps "approve work plan" separate from plain notes.
          shell: true,
          timeout: 60_000,
          maxBuffer: 1024 * 1024,
        }
      );

      approval = {
        id: `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: now,
        status: 'approved',
        command,
        output: compactCommandOutput(result.stdout, result.stderr),
        error: null,
      };
    } catch (err) {
      const failed = err as Error & { stdout?: string; stderr?: string };
      approval = {
        id: `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: now,
        status: 'failed',
        command,
        output: compactCommandOutput(failed.stdout, failed.stderr),
        error: failed.stderr || failed.stdout || failed.message,
      };
    }

    const preflight = await this.runGitSyncPreflight();
    const existingApprovals = Array.isArray(handoff.planApprovals) ? handoff.planApprovals : [];

    // Approval attempts are persisted for the same reason messages are: the
    // dashboard should show what the operator approved and whether Jules
    // accepted the action instead of hiding that decision in terminal output.
    stored.handoffs[handoffIndex] = {
      ...handoff,
      updatedAt: now,
      gitPreflight: preflight,
      baseCommitDrift: null,
      planApprovals: [approval, ...existingApprovals].slice(0, 20),
    };

    await this.writeStoredDrafts(stored);

    if (approval.status === 'failed') {
      throw new Error(`Jules plan approval failed: ${approval.error}`);
    }

    return this.buildSnapshotFromStored(stored, preflight);
  }

  async refreshTrackedHandoffs(): Promise<TaskDraftSnapshot & { bulkRefresh: JulesBulkRefreshResult }> {
    const result: JulesBulkRefreshResult = {
      checkedAt: new Date().toISOString(),
      statusRefreshes: 0,
      pullRequestRefreshes: 0,
      localSyncRefreshes: 0,
      skipped: 0,
      failures: [],
    };

    const startingStore = await this.readStoredDrafts();

    // Bulk refresh is intentionally conservative: each handoff is refreshed
    // through the same methods used by the per-card buttons, and failures are
    // collected instead of aborting the whole dashboard update.
    for (const handoff of startingStore.handoffs) {
      if (!handoff.runId || !handoff.manifestPath) {
        result.skipped += 1;
        continue;
      }

      try {
        await this.refreshHandoffStatus(handoff.id);
        result.statusRefreshes += 1;
      } catch (err) {
        result.failures.push({
          handoffId: handoff.id,
          title: handoff.title,
          phase: 'status',
          error: (err as Error).message,
        });
      }
    }

    const afterStatusStore = await this.readStoredDrafts();
    for (const handoff of afterStatusStore.handoffs) {
      if (!handoff.githubPullRequestUrl) continue;

      try {
        await this.refreshPullRequestStatus(handoff.id);
        result.pullRequestRefreshes += 1;
      } catch (err) {
        result.failures.push({
          handoffId: handoff.id,
          title: handoff.title,
          phase: 'pull_request',
          error: (err as Error).message,
        });
      }
    }

    const afterPullRequestStore = await this.readStoredDrafts();
    for (const handoff of afterPullRequestStore.handoffs) {
      if (handoff.githubPullRequestState !== 'MERGED') continue;

      // Once GitHub reports a Jules PR as merged, the next useful dashboard
      // fact is whether local master can safely fast-forward. Including this
      // in bulk refresh lets one button monitor the whole cloud-to-local path.
      try {
        await this.refreshLocalSyncStatus(handoff.id);
        result.localSyncRefreshes += 1;
      } catch (err) {
        result.failures.push({
          handoffId: handoff.id,
          title: handoff.title,
          phase: 'local_sync',
          error: (err as Error).message,
        });
      }
    }

    return {
      ...(await this.snapshot()),
      bulkRefresh: result,
    };
  }

  async refreshDueTaskNudges(): Promise<TaskDraftSnapshot & { taskNudgeRefresh: TaskNudgeRefreshResult }> {
    const startingSnapshot = await this.snapshot();
    const due = startingSnapshot.taskNudges.scheduler.due;
    const result: TaskNudgeRefreshResult = {
      checkedAt: new Date().toISOString(),
      dueCount: due.length,
      statusRefreshes: 0,
      pullRequestRefreshes: 0,
      localSyncRefreshes: 0,
      skipped: 0,
      failures: [],
      results: [],
      mutatesExternalSystems: false,
    };

    // This is the measured wake-up after a pause expires. It deliberately only
    // runs external-read refreshes. Local-state actions such as preparing a
    // Jules handoff remain visible as due action packets, but they still need a
    // foreman/operator choice instead of being launched by the scheduler.
    for (const item of due) {
      const packet = item.actionPacket;
      if (!packet.canRunNow || packet.safety !== 'external_read' || item.subjectKind !== 'handoff') {
        result.skipped += 1;
        result.results.push({
          nudgeId: item.id,
          subjectId: item.subjectId,
          subjectKind: item.subjectKind,
          subjectTitle: item.subjectTitle,
          action: item.action,
          phase: item.phase,
          endpoint: packet.endpoint,
          status: 'skipped',
          summary: 'Skipped because this due nudge needs a deliberate operator or local-state action.',
          error: null,
        });
        continue;
      }

      try {
        const refreshed = await this.refreshDueTaskNudgeItem(item);
        await this.rescheduleTaskNudge(item.id, result.checkedAt);
        result.results.push({
          nudgeId: item.id,
          subjectId: item.subjectId,
          subjectKind: item.subjectKind,
          subjectTitle: item.subjectTitle,
          action: item.action,
          phase: item.phase,
          endpoint: packet.endpoint,
          status: 'refreshed',
          summary: refreshed.summary,
          error: null,
        });

        if (refreshed.phase === 'status') result.statusRefreshes += 1;
        if (refreshed.phase === 'pull_request') result.pullRequestRefreshes += 1;
        if (refreshed.phase === 'local_sync') result.localSyncRefreshes += 1;
      } catch (err) {
        const message = (err as Error).message;
        result.failures.push({
          nudgeId: item.id,
          subjectId: item.subjectId,
          subjectTitle: item.subjectTitle,
          phase: item.phase,
          error: message,
        });
        result.results.push({
          nudgeId: item.id,
          subjectId: item.subjectId,
          subjectKind: item.subjectKind,
          subjectTitle: item.subjectTitle,
          action: item.action,
          phase: item.phase,
          endpoint: packet.endpoint,
          status: 'failed',
          summary: `Due nudge refresh failed for ${item.subjectTitle}.`,
          error: message,
        });
      }
    }

    return {
      ...(await this.snapshot()),
      taskNudgeRefresh: result,
    };
  }

  private async refreshDueTaskNudgeItem(
    item: TaskNudgeScheduleItem
  ): Promise<{ phase: JulesBulkRefreshResult['failures'][number]['phase']; summary: string }> {
    if (item.action === 'nudge' && item.phase === 'jules_execution') {
      await this.refreshHandoffStatus(item.subjectId);
      return { phase: 'status', summary: `Refreshed Jules status for ${item.subjectTitle}.` };
    }

    if (item.action === 'refresh' && (item.phase === 'github_pr' || item.phase === 'scout_core')) {
      await this.refreshPullRequestStatus(item.subjectId);
      return { phase: 'pull_request', summary: `Refreshed GitHub PR and Scout/Core inputs for ${item.subjectTitle}.` };
    }

    if (item.action === 'refresh' && item.phase === 'local_sync') {
      await this.refreshLocalSyncStatus(item.subjectId);
      return { phase: 'local_sync', summary: `Refreshed local sync readiness for ${item.subjectTitle}.` };
    }

    throw new Error(`No safe due refresh handler exists for ${item.action} / ${item.phase}.`);
  }

  private async rescheduleTaskNudge(nudgeId: string, checkedAt: string): Promise<void> {
    const stored = await this.readStoredDrafts();
    const index = stored.taskNudges.findIndex(record => record.id === nudgeId);
    if (index < 0) return;

    const record = stored.taskNudges[index];
    stored.taskNudges[index] = {
      ...record,
      createdAt: checkedAt,
      nextNudgeAt: record.pauseSeconds > 0 ? addSeconds(checkedAt, record.pauseSeconds) : null,
    };

    await this.writeStoredDrafts(stored);
  }

  async runGitSyncPreflight(): Promise<GitSyncPreflight> {
    const checkedAt = new Date().toISOString();
    const remoteBranch = `${this.remoteName}/${this.baseBranch}`;
    const blockers: string[] = [];
    const details: string[] = [];

    // Fetch first because Jules starts from GitHub, not from stale local
    // knowledge of GitHub. If fetch fails, the safest answer is to block.
    const fetchResult = await this.git(['fetch', this.remoteName]);
    if (!fetchResult.ok) {
      blockers.push(`Could not fetch ${this.remoteName}.`);
      details.push(fetchResult.message);
    }

    const currentBranchResult = await this.git(['branch', '--show-current']);
    const currentBranch = currentBranchResult.ok ? currentBranchResult.stdout.trim() || null : null;
    if (!currentBranchResult.ok) {
      blockers.push('Could not determine the current branch.');
      details.push(currentBranchResult.message);
    } else if (currentBranch !== this.baseBranch) {
      blockers.push(`Current branch is ${currentBranch || 'detached'}, not ${this.baseBranch}.`);
    }

    // Capture the exact commits on both sides of the sync gate. The ahead /
    // behind counts are useful, but the human-facing proof is "these two hashes
    // match", because Jules will clone the GitHub commit rather than the local
    // working tree.
    const localCommitResult = await this.git(['rev-parse', this.baseBranch]);
    const localCommit = localCommitResult.ok ? localCommitResult.stdout.trim() || null : null;
    if (!localCommitResult.ok) {
      blockers.push(`Could not read the local ${this.baseBranch} commit.`);
      details.push(localCommitResult.message);
    }

    const remoteCommitResult = await this.git(['rev-parse', remoteBranch]);
    const remoteCommit = remoteCommitResult.ok ? remoteCommitResult.stdout.trim() || null : null;
    if (!remoteCommitResult.ok) {
      blockers.push(`Could not read the GitHub ${remoteBranch} commit.`);
      details.push(remoteCommitResult.message);
    }

    const statusResult = await this.git(['status', '--porcelain']);
    const statusLines = statusResult.ok
      ? statusResult.stdout.split(/\r?\n/).filter(Boolean)
      : [];
    const dirtyFiles = statusLines.filter(line => !line.startsWith('??')).length;
    const untrackedFiles = statusLines.filter(line => line.startsWith('??')).length;
    const dirtyFileSamples = statusLines
      .filter(line => !line.startsWith('??'))
      .slice(0, 12)
      .map(line => line.slice(3).trim());
    const untrackedFileSamples = statusLines
      .filter(line => line.startsWith('??'))
      .slice(0, 12)
      .map(line => line.slice(3).trim());
    if (!statusResult.ok) {
      blockers.push('Could not inspect local file changes.');
      details.push(statusResult.message);
    } else {
      if (dirtyFiles > 0) blockers.push(`${dirtyFiles} tracked file(s) have uncommitted changes.`);
      if (untrackedFiles > 0) blockers.push(`${untrackedFiles} untracked file(s) are present.`);
    }

    const divergenceResult = await this.git([
      'rev-list',
      '--left-right',
      '--count',
      `${this.baseBranch}...${remoteBranch}`,
    ]);
    const [aheadRaw, behindRaw] = divergenceResult.ok
      ? divergenceResult.stdout.trim().split(/\s+/)
      : [];
    const ahead = Number.isFinite(Number(aheadRaw)) ? Number(aheadRaw) : null;
    const behind = Number.isFinite(Number(behindRaw)) ? Number(behindRaw) : null;

    if (!divergenceResult.ok) {
      blockers.push(`Could not compare ${this.baseBranch} with ${remoteBranch}.`);
      details.push(divergenceResult.message);
    } else {
      if ((ahead ?? 0) > 0) blockers.push(`${this.baseBranch} has ${ahead} unpushed commit(s).`);
      if ((behind ?? 0) > 0) blockers.push(`${this.baseBranch} is behind ${remoteBranch} by ${behind} commit(s).`);
    }

    const ok = blockers.length === 0;
    const commands = {
      status: `git -C ${this.repoRoot} status --short`,
      fetch: `git -C ${this.repoRoot} fetch ${this.remoteName}`,
      showLocalCommit: `git -C ${this.repoRoot} rev-parse ${this.baseBranch}`,
      showRemoteCommit: `git -C ${this.repoRoot} rev-parse ${remoteBranch}`,
      inspectDivergence: `git -C ${this.repoRoot} log --oneline --left-right ${this.baseBranch}...${remoteBranch}`,
      pullFastForward: `git -C ${this.repoRoot} pull --ff-only ${this.remoteName} ${this.baseBranch}`,
      pushBase: `git -C ${this.repoRoot} push ${this.remoteName} ${this.baseBranch}`,
    };
    const resolutionPacket = await this.buildGitResolutionPacket({
      checkedAt,
      remoteBranch,
      commands,
      statusLines,
    });
    const remediation = this.buildPreflightRemediation({
      ok,
      currentBranch,
      baseBranch: this.baseBranch,
      dirtyFiles,
      untrackedFiles,
      ahead,
      behind,
      remoteBranch,
      commands,
    });

    return {
      ok,
      checkedAt,
      repoRoot: this.repoRoot,
      baseBranch: this.baseBranch,
      remoteBranch,
      currentBranch,
      localCommit,
      remoteCommit,
      ahead,
      behind,
      dirtyFiles,
      untrackedFiles,
      blockers,
      summary: ok
        ? `Ready: ${this.baseBranch} matches ${remoteBranch} and the working tree is clean.`
        : `Blocked: ${blockers[0]}`,
      details,
      dirtyFileSamples,
      untrackedFileSamples,
      resolutionPacket,
      remediation,
      nextAction: buildGitSyncNextAction({
        ok,
        currentBranch,
        currentBranchReadable: currentBranchResult.ok,
        baseBranch: this.baseBranch,
        dirtyFiles,
        untrackedFiles,
        ahead,
        behind,
        remoteBranch,
        commands,
      }),
      commands,
    };
  }

  private buildPreflightRemediation(input: {
    ok: boolean;
    currentBranch: string | null;
    baseBranch: string;
    dirtyFiles: number;
    untrackedFiles: number;
    ahead: number | null;
    behind: number | null;
    remoteBranch: string;
    commands: GitSyncPreflight['commands'];
  }): string[] {
    if (input.ok) {
      return [
        'GitHub is ready for Jules. You can create the Linear issue, stage a Jules manifest, or launch the handoff.',
      ];
    }

    const steps: string[] = [];

    // These remediation lines are intentionally practical and conservative.
    // Jules starts from GitHub, so anything local-only must either be pushed,
    // intentionally set aside, or left blocked before a cloud task begins.
    if (input.currentBranch !== input.baseBranch) {
      steps.push(`Switch to ${input.baseBranch} before starting Jules, or intentionally change the Symphony base branch.`);
    }

    if (input.dirtyFiles > 0 || input.untrackedFiles > 0) {
      steps.push(`Review local changes with \`${input.commands.status}\`.`);
      steps.push('Commit and push work that Jules must see; stash, move, or ignore work that should stay local.');
    }

    if ((input.ahead ?? 0) > 0 && (input.behind ?? 0) > 0) {
      steps.push(`Inspect branch divergence with \`${input.commands.inspectDivergence}\` before choosing a merge, rebase, reset, or push strategy.`);
      steps.push('Do not start Jules until the local base and GitHub base point at the same commit again.');
      steps.push('Re-run Check GitHub Sync after resolving the divergence.');
      return steps;
    }

    if ((input.behind ?? 0) > 0) {
      steps.push(`Fast-forward local ${input.baseBranch} from ${input.remoteBranch} after local changes are safe.`);
    }

    if ((input.ahead ?? 0) > 0) {
      steps.push(`Push local ${input.baseBranch} commits to ${input.remoteBranch} so Jules starts from the same base.`);
    }

    if (!steps.length) {
      steps.push('Read the blocker details, fix the reported Git state, then re-run Check GitHub Sync.');
    } else {
      steps.push('Re-run Check GitHub Sync before creating the Linear issue or launching Jules.');
    }

    return steps;
  }

  private async buildGitResolutionPacket(input: {
    checkedAt: string;
    remoteBranch: string;
    commands: GitSyncPreflight['commands'];
    statusLines: string[];
  }): Promise<GitResolutionPacket> {
    const fullStatusCommand = `git -C ${this.repoRoot} status --porcelain --untracked-files=all`;
    const details: string[] = [
      'Read-only packet. Symphony did not pull, push, stash, clean, reset, or delete anything while generating it.',
    ];

    // The preflight samples intentionally stay short for the compact gate. The
    // resolution packet uses the full porcelain status so a human or foreman can
    // classify every visible file before deciding how to unblock GitHub sync.
    const fullStatusResult = await this.git(['status', '--porcelain', '--untracked-files=all']);
    const fullStatusLines = fullStatusResult.ok
      ? fullStatusResult.stdout.split(/\r?\n/).filter(Boolean)
      : input.statusLines;
    if (!fullStatusResult.ok) {
      details.push(`Full status failed, falling back to sampled preflight status: ${fullStatusResult.message}`);
    }

    const divergenceResult = await this.git([
      'log',
      '--oneline',
      '--left-right',
      `${this.baseBranch}...${input.remoteBranch}`,
    ]);
    const divergenceLines = divergenceResult.ok
      ? divergenceResult.stdout.split(/\r?\n/).filter(Boolean)
      : [];
    if (!divergenceResult.ok) {
      details.push(`Divergence log failed: ${divergenceResult.message}`);
    }

    const localCommits: GitResolutionCommit[] = [];
    const remoteCommits: GitResolutionCommit[] = [];
    for (const line of divergenceLines) {
      const commit = parseResolutionCommit(line);
      if (!commit) continue;
      if (commit.side === 'local') localCommits.push(commit);
      else remoteCommits.push(commit);
    }

    const files = fullStatusLines
      .map(parseResolutionFile)
      .filter((file): file is GitResolutionFile => Boolean(file));
    const trackedFiles = files.filter(file => file.status !== '??');
    const untrackedFiles = files.filter(file => file.status === '??');

    return {
      generatedAt: input.checkedAt,
      mutatesGit: false,
      repoRoot: this.repoRoot,
      baseBranch: this.baseBranch,
      remoteBranch: input.remoteBranch,
      summary: [
        countLabel(localCommits.length, 'local-only commit'),
        countLabel(remoteCommits.length, 'remote-only commit'),
        countLabel(trackedFiles.length, 'tracked change'),
        countLabel(untrackedFiles.length, 'untracked file'),
        'need disposition before Jules can start from a trustworthy GitHub base.',
      ].join(', '),
      localCommits,
      remoteCommits,
      trackedFiles,
      untrackedFiles,
      details,
      commands: {
        fullStatus: fullStatusCommand,
        inspectDivergence: input.commands.inspectDivergence,
      },
    };
  }

  private async listDrafts(preflight: GitSyncPreflight): Promise<TaskDraft[]> {
    const stored = await this.readStoredDrafts();
    return this.applyPreflightStatus(stored.drafts, preflight);
  }

  private async listHandoffs(preflight: GitSyncPreflight): Promise<JulesHandoff[]> {
    const stored = await this.readStoredDrafts();
    return this.applyHandoffPreflightStatus(stored.handoffs, preflight);
  }

  private applyPreflightStatus(drafts: TaskDraft[], preflight: GitSyncPreflight): TaskDraft[] {
    return drafts.map(draft => ({
      ...draft,
      expectedFiles: draft.expectedFiles ?? [],
      verificationCommands: draft.verificationCommands ?? [],
      status: preflight.ok ? 'ready_for_handoff' : 'blocked_by_git_sync',
      linearIssueId: draft.linearIssueId ?? null,
      linearIssueIdentifier: draft.linearIssueIdentifier ?? null,
      linearIssueUrl: draft.linearIssueUrl ?? null,
      linearIssueCreatedAt: draft.linearIssueCreatedAt ?? null,
    }));
  }

  private applyHandoffPreflightStatus(
    handoffs: JulesHandoff[],
    preflight: GitSyncPreflight
  ): JulesHandoff[] {
    return handoffs.map(handoff => {
      const normalizedHandoff = {
        ...handoff,
        expectedFiles: handoff.expectedFiles ?? [],
        verificationCommands: handoff.verificationCommands ?? [],
        linearIssueId: handoff.linearIssueId ?? null,
        linearIssueIdentifier: handoff.linearIssueIdentifier ?? null,
        linearIssueUrl: handoff.linearIssueUrl ?? null,
        linearIssueCreatedAt: handoff.linearIssueCreatedAt ?? null,
        githubPullRequestNextAction: handoff.githubPullRequestNextAction ?? null,
      };

      if (normalizedHandoff.status === 'observed_pr') {
        return { ...normalizedHandoff, baseCommitDrift: null };
      }

      if (normalizedHandoff.status === 'sent_to_jules' || normalizedHandoff.julesSessionId) {
        return { ...normalizedHandoff, baseCommitDrift: null };
      }

      if (!preflight.ok) {
        return {
          ...normalizedHandoff,
          status: 'blocked_by_git_sync',
          baseCommitDrift: null,
        };
      }

      const baseCommitDrift = this.buildBaseCommitDrift(normalizedHandoff, preflight);
      if (baseCommitDrift) {
        return {
          ...normalizedHandoff,
          status: 'base_commit_stale',
          baseCommitDrift,
        };
      }

      if (normalizedHandoff.status === 'launch_failed' || normalizedHandoff.status === 'status_refresh_failed') {
        return { ...normalizedHandoff, baseCommitDrift: null };
      }

      if (normalizedHandoff.status === 'manifest_ready') {
        return { ...normalizedHandoff, baseCommitDrift: null };
      }

      return {
        ...normalizedHandoff,
        status: 'ready_for_jules',
        baseCommitDrift: null,
      };
    });
  }

  private buildBaseCommitDrift(
    handoff: JulesHandoff,
    preflight: GitSyncPreflight
  ): HandoffBaseCommitDrift | null {
    const stagedRemoteCommit = handoff.gitPreflight?.remoteCommit ?? null;
    const currentRemoteCommit = preflight.remoteCommit ?? null;

    // A prepared manifest is only launchable while it still points at the
    // current GitHub base. If origin/master moved after staging, Symphony should
    // tell the operator to re-stage instead of silently launching a stale prompt.
    if (!stagedRemoteCommit || !currentRemoteCommit || stagedRemoteCommit === currentRemoteCommit) {
      return null;
    }

    return {
      detectedAt: preflight.checkedAt,
      remoteBranch: preflight.remoteBranch,
      stagedRemoteCommit,
      currentRemoteCommit,
      summary: `${preflight.remoteBranch} moved from ${stagedRemoteCommit.slice(0, 12)} to ${currentRemoteCommit.slice(0, 12)} after this handoff was prepared.`,
    };
  }

  private async readStoredDrafts(): Promise<StoredDraftFile> {
    try {
      const raw = await readFile(this.storePath, 'utf8');
      // PowerShell and some editors can write UTF-8 JSON with a byte-order
      // marker. Strip it so a hand-inspected or manually repaired dashboard
      // queue does not take the API down with a JSON parse failure.
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as Partial<StoredDraftFile>;

      // Keep corrupted or hand-edited records from crashing the dashboard. A
      // malformed file should show an empty queue instead of taking Symphony's
      // observability server down.
      return {
        drafts: Array.isArray(parsed.drafts) ? parsed.drafts.filter(isTaskDraft) : [],
        handoffs: Array.isArray(parsed.handoffs) ? parsed.handoffs.filter(isJulesHandoff) : [],
        gitDisposition: buildGitDispositionSummary(parsed.gitDisposition).categories,
        taskNudges: normalizeTaskNudges(parsed.taskNudges),
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return { drafts: [], handoffs: [], gitDisposition: [], taskNudges: [] };
      }

      throw err;
    }
  }

  private async writeStoredDrafts(stored: StoredDraftFile): Promise<void> {
    await mkdir(dirname(this.storePath), { recursive: true });
    await writeFile(this.storePath, `${JSON.stringify(stored, null, 2)}\n`, 'utf8');
  }

  private async git(args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string; message: string }> {
    try {
      const result = await execFileAsync('git', ['-C', this.repoRoot, ...args], {
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
      });

      return {
        ok: true,
        stdout: result.stdout,
        stderr: result.stderr,
        message: result.stderr || result.stdout,
      };
    } catch (err) {
      const failed = err as Error & { stdout?: string; stderr?: string };
      return {
        ok: false,
        stdout: failed.stdout ?? '',
        stderr: failed.stderr ?? '',
        message: failed.stderr || failed.stdout || failed.message,
      };
    }
  }

  private async runLocalSyncStatus(prMerged: boolean): Promise<LocalSyncStatus> {
    const checkedAt = new Date().toISOString();
    const remoteBranch = `${this.remoteName}/${this.baseBranch}`;
    const blockers: string[] = [];
    const details: string[] = [];
    const pullCommand = `git pull --ff-only ${this.remoteName} ${this.baseBranch}`;

    if (!prMerged) {
      blockers.push('Jules PR is not marked merged yet.');
    }

    const fetchResult = await this.git(['fetch', this.remoteName]);
    if (!fetchResult.ok) {
      blockers.push(`Could not fetch ${this.remoteName}.`);
      details.push(fetchResult.message);
    }

    const currentBranchResult = await this.git(['branch', '--show-current']);
    const currentBranch = currentBranchResult.ok ? currentBranchResult.stdout.trim() || null : null;
    if (!currentBranchResult.ok) {
      blockers.push('Could not determine the current branch.');
      details.push(currentBranchResult.message);
    } else if (currentBranch !== this.baseBranch) {
      blockers.push(`Current branch is ${currentBranch || 'detached'}, not ${this.baseBranch}.`);
    }

    const statusResult = await this.git(['status', '--porcelain']);
    const statusLines = statusResult.ok
      ? statusResult.stdout.split(/\r?\n/).filter(Boolean)
      : [];
    const dirtyFiles = statusLines.filter(line => !line.startsWith('??')).length;
    const untrackedFiles = statusLines.filter(line => line.startsWith('??')).length;
    if (!statusResult.ok) {
      blockers.push('Could not inspect local file changes.');
      details.push(statusResult.message);
    } else {
      if (dirtyFiles > 0) blockers.push(`${dirtyFiles} tracked file(s) have uncommitted changes.`);
      if (untrackedFiles > 0) blockers.push(`${untrackedFiles} untracked file(s) are present.`);
    }

    const divergenceResult = await this.git([
      'rev-list',
      '--left-right',
      '--count',
      `${this.baseBranch}...${remoteBranch}`,
    ]);
    const [aheadRaw, behindRaw] = divergenceResult.ok
      ? divergenceResult.stdout.trim().split(/\s+/)
      : [];
    const ahead = Number.isFinite(Number(aheadRaw)) ? Number(aheadRaw) : null;
    const behind = Number.isFinite(Number(behindRaw)) ? Number(behindRaw) : null;

    if (!divergenceResult.ok) {
      blockers.push(`Could not compare ${this.baseBranch} with ${remoteBranch}.`);
      details.push(divergenceResult.message);
    } else if ((ahead ?? 0) > 0) {
      blockers.push(`${this.baseBranch} has ${ahead} local commit(s) that are not on ${remoteBranch}.`);
    }

    const localCommitResult = await this.git(['rev-parse', this.baseBranch]);
    const localCommit = localCommitResult.ok ? localCommitResult.stdout.trim() || null : null;
    if (!localCommitResult.ok) {
      blockers.push(`Could not read the local ${this.baseBranch} commit.`);
      details.push(localCommitResult.message);
    }

    const remoteCommitResult = await this.git(['rev-parse', remoteBranch]);
    const remoteCommit = remoteCommitResult.ok ? remoteCommitResult.stdout.trim() || null : null;
    if (!remoteCommitResult.ok) {
      blockers.push(`Could not read the GitHub ${remoteBranch} commit.`);
      details.push(remoteCommitResult.message);
    }

    const safeToPull = blockers.length === 0 && (behind ?? 0) > 0;
    const upToDate = blockers.length === 0 && (behind ?? 0) === 0;
    const remediation = this.buildLocalSyncRemediation({
      prMerged,
      currentBranch,
      dirtyFiles,
      untrackedFiles,
      ahead,
      behind,
      pullCommand,
    });

    return {
      safeToPull,
      upToDate,
      checkedAt,
      repoRoot: this.repoRoot,
      baseBranch: this.baseBranch,
      remoteBranch,
      currentBranch,
      localCommit,
      remoteCommit,
      ahead,
      behind,
      dirtyFiles,
      untrackedFiles,
      blockers,
      remediation,
      summary: safeToPull
        ? `${this.baseBranch} can fast-forward from ${remoteBranch}.`
        : upToDate
          ? `${this.baseBranch} is already up to date with ${remoteBranch}.`
          : `Blocked: ${blockers[0] ?? 'local sync is not ready.'}`,
      details,
      pullCommand,
      nextAction: buildLocalSyncNextAction({
        prMerged,
        safeToPull,
        upToDate,
        currentBranch,
        baseBranch: this.baseBranch,
        dirtyFiles,
        untrackedFiles,
        ahead,
        behind,
        pullCommand,
      }),
    };
  }

  private buildLocalSyncRemediation(input: {
    prMerged: boolean;
    currentBranch: string | null;
    dirtyFiles: number;
    untrackedFiles: number;
    ahead: number | null;
    behind: number | null;
    pullCommand: string;
  }): string[] {
    const steps: string[] = [];

    // These steps are intentionally operator-facing. The local sync gate is the
    // last moment before Symphony mutates the user's checkout, so blocked states
    // need exact next actions instead of just a red "not safe" label.
    if (!input.prMerged) {
      steps.push('Wait for GitHub to report the Jules PR as merged before syncing local master.');
    }

    if (input.currentBranch !== this.baseBranch) {
      steps.push(`Switch to ${this.baseBranch} before syncing local work.`);
    }

    if (input.dirtyFiles > 0 || input.untrackedFiles > 0) {
      steps.push('Review local changes before pulling; commit intended work, stash temporary work, or remove accidental files.');
    }

    if ((input.ahead ?? 0) > 0) {
      steps.push('Push or intentionally handle local-only master commits before pulling Jules work back down.');
    }

    if (!steps.length) {
      if ((input.behind ?? 0) > 0) {
        steps.push(`Run the guarded fast-forward command: ${input.pullCommand}`);
      } else {
        steps.push('Local master is already aligned with GitHub; no sync action is needed.');
      }
    } else {
      steps.push('Re-run Check Local Sync after resolving the blockers.');
    }

    return steps;
  }
}

function isTaskDraft(value: unknown): value is TaskDraft {
  const draft = value as Partial<TaskDraft>;
  return typeof draft?.id === 'string'
    && typeof draft.title === 'string'
    && typeof draft.body === 'string'
    && draft.executor === 'jules'
    && typeof draft.createdAt === 'string'
    && typeof draft.updatedAt === 'string';
}

function normalizeExpectedFiles(value: unknown): string[] {
  // Expected files become Jules write scopes. Keep them line-oriented and
  // conservative so the manifest can later check whether a PR stayed inside
  // the boundaries the operator described before remote work started.
  return normalizeLineList(value, 24);
}

function normalizeVerificationCommands(value: unknown): string[] {
  // Operators often paste commands as one block from a note or chat. Normalize
  // both textarea strings and stored arrays into a small ordered checklist that
  // Jules, Scout, and Core can all see without reading the free-form task body.
  return normalizeLineList(value, 12);
}

function buildGitDispositionSummary(value: unknown): GitDispositionSummary {
  const rawRecords = Array.isArray(value) ? value : [];
  const byCategory = new Map<GitDispositionCategory, GitDispositionRecord>();

  for (const raw of rawRecords) {
    const candidate = raw as Partial<GitDispositionRecord>;
    try {
      const category = normalizeGitDispositionCategory(candidate.category ?? '');
      const decision = candidate.decision === null || candidate.decision === undefined
        ? null
        : normalizeGitDispositionDecision(candidate.decision);
      const definition = GIT_DISPOSITION_CATEGORIES.find(item => item.category === category);

      if (!definition) continue;

      byCategory.set(category, {
        category,
        label: definition.label,
        decision,
        decisionLabel: decision ? GIT_DISPOSITION_DECISION_LABELS[decision] : 'Not decided',
        note: typeof candidate.note === 'string' ? candidate.note : '',
        updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : null,
      });
    } catch {
      // Hand-edited queue files should not crash the dashboard. Invalid
      // disposition rows are ignored and the category falls back to "not
      // decided" below, which is the safer operator-facing state.
    }
  }

  const categories = GIT_DISPOSITION_CATEGORIES.map(definition => {
    return byCategory.get(definition.category) ?? {
      category: definition.category,
      label: definition.label,
      decision: null,
      decisionLabel: 'Not decided',
      note: '',
      updatedAt: null,
    };
  });
  const decidedCount = categories.filter(category => Boolean(category.decision)).length;
  const resolvedCount = categories.filter(category => Boolean(category.decision) && category.decision !== 'needs_review').length;
  const updatedAt = categories
    .map(category => category.updatedAt)
    .filter((timestamp): timestamp is string => Boolean(timestamp))
    .sort()
    .at(-1) ?? null;

  return {
    categories,
    decidedCount,
    totalRequired: categories.length,
    readyForHumanSync: resolvedCount === categories.length,
    summary: decidedCount === 0
      ? 'No Git disposition decisions recorded yet.'
      : `${decidedCount} of ${categories.length} Git disposition categories have decisions recorded; ${resolvedCount} are resolved enough for a human sync attempt.`,
    updatedAt,
  };
}

function buildGitSyncPlan(preflight: GitSyncPreflight, disposition: GitDispositionSummary): GitSyncPlan {
  const generatedAt = preflight.checkedAt || new Date().toISOString();
  const activeCategories = activeGitDispositionCategories(preflight);
  const dispositionByCategory = new Map(disposition.categories.map(record => [record.category, record]));
  const requiredDispositions = activeCategories.filter(category => {
    const record = dispositionByCategory.get(category);
    return !record?.decision;
  });
  const reviewCategories = activeCategories.filter(category => dispositionByCategory.get(category)?.decision === 'needs_review');
  const commands = preflight.commands || {};
  const packetCommands = preflight.resolutionPacket?.commands || {};

  if (preflight.ok) {
    const steps: GitSyncPlanStep[] = [
      {
        kind: 'verify',
        label: 'Continue to Linear/Jules',
        detail: 'Create the Linear issue, stage the Jules manifest, or launch the prepared handoff from the verified GitHub base.',
        command: null,
        destructive: false,
      },
    ];

    return {
      generatedAt,
      status: 'ready',
      mutatesGit: false,
      canExecute: false,
      summary: 'GitHub sync gate already passes. No repair plan is needed before Linear/Jules handoff.',
      requiredDispositions: [],
      blockers: [],
      steps,
      executionPacket: buildGitSyncExecutionPacket({
        generatedAt,
        status: 'ready',
        canExecute: false,
        summary: 'GitHub sync already passes; no Git repair commands should run from this packet.',
        requiredDispositions: [],
        blockers: [],
        steps,
        preflight,
        disposition,
        expectedNextProof: 'Continue to Linear/Jules from the passing GitHub sync gate.',
      }),
    };
  }

  if (requiredDispositions.length > 0) {
    const blockers = requiredDispositions.map(category => `${gitDispositionLabel(category)} is not decided.`);
    const steps: GitSyncPlanStep[] = [
      {
        kind: 'record_disposition',
        label: 'Record Git dispositions',
        detail: 'Use the Sync Decision Board to decide what should happen to each blocked category. Symphony will not infer ownership of local commits, tracked edits, untracked artifacts, or remote commits.',
        command: null,
        destructive: false,
      },
      {
        kind: 'inspect',
        label: 'Inspect the read-only resolution packet',
        detail: 'Review the concrete commits and files before recording decisions.',
        command: packetCommands.fullStatus || commands.status || null,
        destructive: false,
      },
    ];

    return {
      generatedAt,
      status: 'blocked_by_disposition',
      mutatesGit: false,
      canExecute: false,
      summary: `${requiredDispositions.length} Git disposition categories still need decisions before Symphony can present a human sync execution plan.`,
      requiredDispositions,
      blockers,
      steps,
      executionPacket: buildGitSyncExecutionPacket({
        generatedAt,
        status: 'blocked_by_disposition',
        canExecute: false,
        summary: 'Execution packet is not executable until every active Git disposition category has a recorded operator decision.',
        requiredDispositions,
        blockers,
        steps,
        preflight,
        disposition,
        expectedNextProof: 'Record Git dispositions for every waiting category, then regenerate this packet.',
      }),
    };
  }

  if (reviewCategories.length > 0) {
    const blockers = reviewCategories.map(category => `${gitDispositionLabel(category)} is marked needs review.`);
    const steps: GitSyncPlanStep[] = [
      {
        kind: 'inspect',
        label: 'Resolve needs-review dispositions',
        detail: 'Replace every needs-review disposition with a concrete operator decision before following Git commands.',
        command: packetCommands.inspectDivergence || commands.inspectDivergence || commands.status || null,
        destructive: false,
      },
    ];

    return {
      generatedAt,
      status: 'blocked_by_review',
      mutatesGit: false,
      canExecute: false,
      summary: `${reviewCategories.map(gitDispositionLabel).join(', ')} still needs review before any sync execution plan is safe.`,
      requiredDispositions: [],
      blockers,
      steps,
      executionPacket: buildGitSyncExecutionPacket({
        generatedAt,
        status: 'blocked_by_review',
        canExecute: false,
        summary: 'Execution packet is not executable while any Git disposition remains marked needs review.',
        requiredDispositions: [],
        blockers,
        steps,
        preflight,
        disposition,
        expectedNextProof: 'Resolve needs-review dispositions, then regenerate this packet.',
      }),
    };
  }

  const steps: GitSyncPlanStep[] = [
    {
      kind: 'inspect',
      label: 'Inspect current Git packet',
      detail: 'Confirm the commits and files still match the operator decisions before running any command outside Symphony.',
      command: packetCommands.fullStatus || commands.status || null,
      destructive: false,
    },
  ];

  if ((preflight.dirtyFiles ?? 0) > 0) {
    steps.push({
      kind: 'prepare_local',
      label: 'Handle tracked edits according to disposition',
      detail: decisionDetail(dispositionByCategory.get('tracked_changes')),
      command: commands.status || null,
      destructive: false,
    });
  }

  if ((preflight.untrackedFiles ?? 0) > 0) {
    steps.push({
      kind: 'prepare_local',
      label: 'Handle untracked artifacts according to disposition',
      detail: decisionDetail(dispositionByCategory.get('untracked_artifacts')),
      command: packetCommands.fullStatus || commands.status || null,
      destructive: false,
    });
  }

  if ((preflight.ahead ?? 0) > 0) {
    steps.push({
      kind: 'push',
      label: 'Push intended local commits',
      detail: decisionDetail(dispositionByCategory.get('local_commits')),
      command: commands.pushBase || null,
      destructive: true,
    });
  }

  if ((preflight.behind ?? 0) > 0) {
    steps.push({
      kind: 'pull',
      label: 'Fast-forward after local work is safe',
      detail: decisionDetail(dispositionByCategory.get('remote_commits')),
      command: commands.pullFastForward || null,
      destructive: true,
    });
  }

  steps.push({
    kind: 'verify',
    label: 'Re-run Check GitHub Sync',
    detail: 'Only create the Linear issue or launch Jules after the sync gate reports ready from the current checkout.',
    command: null,
    destructive: false,
  });

  return {
    generatedAt,
    status: 'ready_for_human_execution',
    mutatesGit: false,
    canExecute: true,
    summary: 'Human execution plan is ready. Symphony has not changed Git; run the listed mutating steps only after confirming the dispositions are correct.',
    requiredDispositions: [],
    blockers: [],
    steps,
    executionPacket: buildGitSyncExecutionPacket({
      generatedAt,
      status: 'ready_for_human_execution',
      canExecute: true,
      summary: 'Execution packet is ready for a human-operated Git sync attempt. Symphony still will not run these commands for you.',
      requiredDispositions: [],
      blockers: [],
      steps,
      preflight,
      disposition,
      expectedNextProof: 'Run Check GitHub Sync after the commands; the next proof must show the GitHub sync gate passing before Linear/Jules starts.',
    }),
  };
}

function buildGitSyncExecutionPacket(input: {
  generatedAt: string;
  status: GitSyncPlan['status'];
  canExecute: boolean;
  summary: string;
  requiredDispositions: GitDispositionCategory[];
  blockers: string[];
  steps: GitSyncPlanStep[];
  preflight: GitSyncPreflight;
  disposition: GitDispositionSummary;
  expectedNextProof: string;
}): GitSyncExecutionPacket {
  const readOnlyCommands = uniqueStrings([
    input.preflight.commands?.status,
    input.preflight.commands?.inspectDivergence,
    input.preflight.resolutionPacket?.commands?.fullStatus,
    input.preflight.resolutionPacket?.commands?.inspectDivergence,
    ...input.steps.filter(step => !step.destructive).map(step => step.command),
  ]);
  const mutatingCommands = input.canExecute
    ? uniqueStrings(input.steps.filter(step => step.destructive).map(step => step.command))
    : [];
  const verificationCommands = uniqueStrings([
    input.preflight.commands?.status,
    input.preflight.commands?.fetch,
  ]);
  const safetyChecklist = buildGitSyncExecutionSafetyChecklist(input.canExecute);

  // The execution packet is a copy-ready human checklist, not an automation
  // hook. It gathers the exact commands, Git facts, and recorded disposition
  // decisions from the already-guarded sync plan but keeps `mutatesGit` false
  // so dashboard/API consumers cannot mistake it for permission to run Git
  // inside Symphony.
  return {
    packageId: `git-sync-${new Date(input.generatedAt).getTime().toString(36)}`,
    generatedAt: input.generatedAt,
    status: input.status,
    mutatesGit: false,
    canExecute: input.canExecute,
    requiresHumanConfirmation: true,
    summary: input.summary,
    requiredDispositions: input.requiredDispositions,
    blockedReasons: input.blockers,
    preflightReceipt: buildGitSyncExecutionPreflightReceipt(input.preflight),
    decisionReceipt: buildGitSyncExecutionDecisionReceipt(input.disposition),
    readOnlyCommands,
    mutatingCommands,
    verificationCommands,
    safetyChecklist,
    expectedNextProof: input.expectedNextProof,
  };
}

function buildGitSyncExecutionPreflightReceipt(preflight: GitSyncPreflight): GitSyncExecutionPreflightReceipt {
  const remoteName = preflight.remoteBranch.includes('/')
    ? preflight.remoteBranch.split('/')[0]
    : preflight.remoteBranch;
  const summary = [
    `branch ${preflight.currentBranch ?? 'unknown'}`,
    `ahead ${preflight.ahead ?? 0}`,
    `behind ${preflight.behind ?? 0}`,
    `tracked ${preflight.dirtyFiles}`,
    `untracked ${preflight.untrackedFiles}`,
  ].join(', ');

  // This receipt freezes the preflight facts that produced the command packet.
  // If the repository changes before the human runs commands, the follow-up
  // "Check GitHub Sync" proof must replace this packet rather than reusing a
  // stale command list.
  return {
    ok: preflight.ok,
    checkedAt: preflight.checkedAt,
    repoRoot: preflight.repoRoot,
    baseBranch: preflight.baseBranch,
    remoteBranch: preflight.remoteBranch,
    remoteName,
    currentBranch: preflight.currentBranch,
    localCommit: preflight.localCommit,
    remoteCommit: preflight.remoteCommit,
    ahead: preflight.ahead,
    behind: preflight.behind,
    dirtyFiles: preflight.dirtyFiles,
    untrackedFiles: preflight.untrackedFiles,
    blockers: [...preflight.blockers],
    summary,
  };
}

function buildGitSyncExecutionDecisionReceipt(disposition: GitDispositionSummary): GitSyncExecutionDecisionReceipt {
  // The decision receipt keeps operator intent beside the commands. That makes
  // the packet auditable without reading the separate queue file and prevents a
  // foreman from treating a command list as detached from the human choices that
  // authorized it.
  return {
    readyForHumanSync: disposition.readyForHumanSync,
    decidedCount: disposition.decidedCount,
    totalRequired: disposition.totalRequired,
    summary: disposition.summary,
    updatedAt: disposition.updatedAt,
    categories: disposition.categories.map(category => ({ ...category })),
  };
}

function buildGitSyncExecutionSafetyChecklist(canExecute: boolean): string[] {
  const checklist = [
    'Confirm this packet package id was generated after the latest Git disposition decision.',
    'Run the read-only commands first and compare the output with the preflight receipt.',
    'Do not create Linear or Jules artifacts until the GitHub sync gate passes after execution.',
    'Re-run Check GitHub Sync after the human-operated commands and save that passing proof.',
  ];

  // When the packet is still blocked, the checklist says why the command list
  // must remain evidence-only instead of becoming a human runbook.
  if (!canExecute) {
    return [
      'Do not run mutating Git commands from this packet while it is marked not executable.',
      ...checklist,
    ];
  }

  return checklist;
}

function buildTaskRoutingPlan(
  drafts: TaskDraft[],
  handoffs: JulesHandoff[],
  preflight: GitSyncPreflight
): TaskRoutingPlan {
  const generatedAt = preflight.checkedAt || new Date().toISOString();
  const latestHandoff = newestByUpdatedAt(handoffs);
  const latestDraft = newestByUpdatedAt(drafts);
  const candidates = [
    ...drafts.slice(0, 6).map(draft => buildRoutingCandidateForDraft(draft, preflight)),
    ...handoffs.slice(0, 6).map(handoff => buildRoutingCandidateForHandoff(handoff)),
  ];

  // This plan is advisory. It helps the dashboard and foreman decide whether to
  // wait, nudge, send to Jules, or assign local Codex, but it deliberately does
  // not create Linear issues, start Jules, or dispatch local agents by itself.
  if (!latestDraft && !latestHandoff) {
    const route: TaskRoutingPlan['route'] = 'ask_operator';
    return {
      generatedAt,
      route,
      subjectId: null,
      subjectTitle: null,
      summary: 'No draft or handoff exists yet. Capture a task before Symphony can route or nudge it.',
      reasons: ['The queue is empty.'],
      nextAction: {
        code: 'ask_operator',
        label: 'Draft a task',
        detail: 'Create a dashboard draft with expected files and verification commands.',
        pauseSeconds: 0,
        nextNudgeAt: null,
      },
      workerMode: buildWorkerModeRecommendation({
        route,
        subject: null,
        reasons: ['The queue is empty.'],
        blocked: true,
        dashboardStarted: false,
      }),
      candidates,
    };
  }

  if (!preflight.ok) {
    const route: TaskRoutingPlan['route'] = 'blocked';
    return {
      generatedAt,
      route,
      subjectId: latestDraft?.id ?? latestHandoff?.id ?? null,
      subjectTitle: latestDraft?.title ?? latestHandoff?.title ?? null,
      summary: 'GitHub sync gate is blocked, so Symphony should wait instead of assigning Jules or a local Codex agent.',
      reasons: preflight.blockers.length
        ? preflight.blockers.map(blocker => `Blocked: ${blocker}`)
        : ['Blocked: GitHub sync preflight is blocked.'],
      nextAction: {
        code: 'wait',
        label: 'Wait for Git disposition',
        detail: 'Resolve the Git sync gate, then re-run routing before dispatching any worker.',
        pauseSeconds: 0,
        nextNudgeAt: null,
      },
      workerMode: buildWorkerModeRecommendation({
        route,
        subject: latestDraft ?? latestHandoff ?? null,
        reasons: preflight.blockers.length
          ? preflight.blockers.map(blocker => `Blocked: ${blocker}`)
          : ['Blocked: GitHub sync preflight is blocked.'],
        blocked: true,
        dashboardStarted: Boolean(latestDraft),
      }),
      candidates,
    };
  }

  if (latestHandoff) {
    return buildRoutingPlanForHandoff(latestHandoff, generatedAt, candidates);
  }

  return buildRoutingPlanForDraft(latestDraft!, generatedAt, candidates);
}

function buildTaskNudgeSummary(records: TaskNudgeRecord[], routing: TaskRoutingPlan): TaskNudgeSummary {
  const recent = normalizeTaskNudges(records).slice(0, 8);
  const latest = recent[0] ?? null;
  const nextNudgeAt = latest?.nextNudgeAt ?? routing.nextAction.nextNudgeAt ?? null;
  const scheduler = buildTaskNudgeScheduler(records);
  const summary = latest
    ? `Recorded durable nudge evidence for ${latest.subjectTitle || latest.subjectId}; next nudge ${latest.nextNudgeAt ?? 'is not scheduled'}.`
    : routing.nextAction.nextNudgeAt
      ? `No durable nudge evidence recorded yet; current routing recommends next nudge ${routing.nextAction.nextNudgeAt}.`
      : 'No durable nudge evidence recorded yet.';

  // The summary keeps the most recent ledger entry close to the routing plan.
  // It intentionally reports scheduled nudges without executing them so the
  // dashboard can pause around Jules/GitHub boundaries instead of busy-looping.
  return {
    total: normalizeTaskNudges(records).length,
    summary,
    latest,
    recent,
    nextNudgeAt,
    scheduler,
  };
}

function buildTaskNudgeScheduler(records: TaskNudgeRecord[]): TaskNudgeScheduler {
  const checkedAt = new Date().toISOString();
  const checkedTime = new Date(checkedAt).getTime();
  const due: TaskNudgeScheduleItem[] = [];
  const waiting: TaskNudgeScheduleItem[] = [];
  const blocked: TaskNudgeScheduleItem[] = [];

  // A nudge can be in one of three operator-useful states. Timed records wait
  // until their next nudge time; untimed wait/ask-operator records stay blocked
  // on the human boundary; due records are ready for a foreman to refresh or
  // nudge deliberately, still without this scheduler mutating anything.
  for (const record of normalizeTaskNudges(records)) {
    const item = buildTaskNudgeScheduleItem(record, !record.nextNudgeAt ? 'blocked' : 'waiting');
    if (!record.nextNudgeAt) {
      blocked.push(item);
      continue;
    }

    const dueTime = new Date(record.nextNudgeAt).getTime();
    if (Number.isFinite(dueTime) && dueTime <= checkedTime) due.push(buildTaskNudgeScheduleItem(record, 'due'));
    else waiting.push(item);
  }

  const nextDueAt = waiting
    .map(item => item.nextNudgeAt)
    .filter((value): value is string => typeof value === 'string')
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null;
  const status: TaskNudgeScheduler['status'] = blocked.length > 0
    ? 'blocked'
    : due.length > 0
      ? 'due'
      : waiting.length > 0
        ? 'waiting'
        : 'idle';
  const summary = status === 'blocked'
    ? `${blocked.length} nudge record(s) are waiting for operator input before another timed refresh is useful.`
    : status === 'due'
      ? `${due.length} nudge record(s) are due for a deliberate foreman refresh or nudge.`
      : status === 'waiting'
        ? `Pause before refreshing; next nudge is due at ${nextDueAt}.`
        : 'No recorded nudges are scheduled.';

  return {
    checkedAt,
    status,
    summary,
    dueCount: due.length,
    waitingCount: waiting.length,
    blockedCount: blocked.length,
    nextDueAt,
    mutatesExternalSystems: false,
    due,
    waiting,
    blocked,
  };
}

function buildTaskNudgeScheduleItem(
  record: TaskNudgeRecord,
  state: 'due' | 'waiting' | 'blocked'
): TaskNudgeScheduleItem {
  const recommendedEndpoint = recommendedTaskNudgeEndpoint(record);
  const actionPacket = buildTaskNudgeActionPacket(record, state, recommendedEndpoint);
  const summary = record.nextNudgeAt
    ? `${record.action} for ${record.subjectTitle} after ${record.nextNudgeAt}.`
    : `${record.action} for ${record.subjectTitle} waits on operator input.`;

  // The endpoint is a hint for a foreman or dashboard, not a command runner.
  // Keeping `mutatesExternalSystems` false makes the pause scheduler safe to
  // inspect in dashboard-only mode and in live evidence captures.
  return {
    id: record.id,
    subjectId: record.subjectId,
    subjectKind: record.subjectKind,
    subjectTitle: record.subjectTitle,
    action: record.action,
    phase: record.phase,
    createdAt: record.createdAt,
    nextNudgeAt: record.nextNudgeAt,
    pauseSeconds: record.pauseSeconds,
    recommendedEndpoint,
    actionPacket,
    summary,
    mutatesExternalSystems: false,
  };
}

function buildTaskNudgeActionPacket(
  record: TaskNudgeRecord,
  state: 'due' | 'waiting' | 'blocked',
  endpoint: string | null
): TaskNudgeActionPacket {
  if (state === 'blocked' || record.action === 'wait' || record.action === 'ask_operator') {
    return {
      method: 'NONE',
      endpoint: null,
      label: record.action === 'ask_operator' ? 'Ask operator' : 'Wait for operator',
      safety: 'operator_only',
      canRunNow: false,
      requiresOperator: true,
      blockedReason: 'This nudge is blocked on operator input or Git disposition.',
      mutatesExternalSystems: false,
    };
  }

  if (state === 'waiting') {
    return {
      method: endpoint ? 'POST' : 'NONE',
      endpoint,
      label: taskNudgeActionLabel(record),
      safety: taskNudgeActionSafety(record),
      canRunNow: false,
      requiresOperator: false,
      blockedReason: record.nextNudgeAt ? `Pause until ${record.nextNudgeAt}.` : 'No timed nudge is scheduled.',
      mutatesExternalSystems: false,
    };
  }

  return {
    method: endpoint ? 'POST' : 'NONE',
    endpoint,
    label: taskNudgeActionLabel(record),
    safety: taskNudgeActionSafety(record),
    canRunNow: Boolean(endpoint),
    requiresOperator: false,
    blockedReason: endpoint ? null : 'No safe dashboard endpoint is available for this nudge action.',
    mutatesExternalSystems: false,
  };
}

function taskNudgeActionLabel(record: TaskNudgeRecord): string {
  if (record.subjectKind === 'draft' && record.action === 'send_to_jules') return 'Prepare Jules handoff';
  if (record.action === 'assign_local_agent') return 'Assign local Codex agent';
  if (record.phase === 'github_pr') return 'Refresh GitHub PR checks';
  if (record.phase === 'local_sync') return 'Refresh local sync readiness';
  if (record.action === 'nudge') return 'Refresh Jules status';
  return 'Review nudge action';
}

function taskNudgeActionSafety(record: TaskNudgeRecord): TaskNudgeActionPacket['safety'] {
  if (record.subjectKind === 'draft' && record.action === 'send_to_jules') return 'local_state_only';
  if (record.phase === 'github_pr' || record.phase === 'jules_execution' || record.phase === 'local_sync') return 'external_read';
  return 'read_only';
}

function recommendedTaskNudgeEndpoint(record: TaskNudgeRecord): string | null {
  const encoded = encodeURIComponent(record.subjectId);

  if (record.subjectKind === 'draft' && record.action === 'send_to_jules') {
    return `/api/v1/task-drafts/${encoded}/promote`;
  }

  if (record.subjectKind === 'handoff' && record.action === 'nudge') {
    return `/api/v1/jules-handoffs/${encoded}/refresh-status`;
  }

  if (record.subjectKind === 'handoff' && record.action === 'refresh') {
    return record.phase === 'local_sync'
      ? `/api/v1/jules-handoffs/${encoded}/refresh-local-sync`
      : `/api/v1/jules-handoffs/${encoded}/refresh-pr`;
  }

  return null;
}

function normalizeTaskNudges(value: unknown): TaskNudgeRecord[] {
  const records = Array.isArray(value) ? value : [];

  // The task queue file is operator-readable JSON and may be hand-edited while
  // Symphony is not running. Keep only complete records so a malformed ledger
  // entry does not take down the dashboard or erase otherwise valid drafts.
  return records
    .filter(isTaskNudgeRecord)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function isTaskNudgeRecord(value: unknown): value is TaskNudgeRecord {
  const record = value as Partial<TaskNudgeRecord>;
  return typeof record?.id === 'string'
    && typeof record.subjectId === 'string'
    && ['draft', 'handoff', 'queue'].includes(String(record.subjectKind))
    && typeof record.subjectTitle === 'string'
    && isTaskNudgeAction(record.action)
    && isTaskNudgePhase(record.phase)
    && typeof record.createdAt === 'string'
    && typeof record.pauseSeconds === 'number'
    && (record.nextNudgeAt === null || typeof record.nextNudgeAt === 'string')
    && record.status === 'recorded'
    && record.mutatesExternalSystems === false;
}

function normalizeTaskNudgeAction(value: unknown): TaskNudgeAction {
  if (!isTaskNudgeAction(value)) {
    throw new Error(`Unsupported task nudge action: ${String(value)}`);
  }

  return value;
}

function isTaskNudgeAction(value: unknown): value is TaskNudgeAction {
  return ['wait', 'refresh', 'nudge', 'ask_operator', 'send_to_jules', 'assign_local_agent'].includes(String(value));
}

function normalizeTaskNudgePhase(value: unknown): TaskNudgePhase {
  if (!isTaskNudgePhase(value)) {
    throw new Error(`Unsupported task nudge phase: ${String(value)}`);
  }

  return value;
}

function isTaskNudgePhase(value: unknown): value is TaskNudgePhase {
  return [
    'git_sync',
    'routing',
    'jules_plan',
    'jules_execution',
    'github_pr',
    'scout_core',
    'local_sync',
  ].includes(String(value));
}

function normalizeTaskNudgeSubjectKind(value: unknown): TaskNudgeRecord['subjectKind'] {
  if (value === 'draft' || value === 'handoff' || value === 'queue') {
    return value;
  }

  throw new Error(`Unsupported task nudge subject kind: ${String(value)}`);
}

function inferTaskNudgeSubjectKind(
  routing: TaskRoutingPlan,
  stored: StoredDraftFile
): TaskNudgeRecord['subjectKind'] {
  if (!routing.subjectId) return 'queue';
  if (stored.handoffs.some(handoff => handoff.id === routing.subjectId)) return 'handoff';
  return 'draft';
}

function inferTaskNudgePhase(routing: TaskRoutingPlan): TaskNudgePhase {
  if (routing.route === 'blocked') return 'git_sync';
  if (routing.nextAction.code === 'send_to_jules' && routing.route === 'jules_plan') return 'jules_plan';
  if (routing.nextAction.code === 'send_to_jules') return 'jules_execution';
  if (routing.nextAction.code === 'refresh') return 'github_pr';
  if (routing.nextAction.code === 'nudge') return 'jules_execution';
  if (routing.nextAction.code === 'assign_local_agent') return 'routing';
  return 'routing';
}

function resolveTaskNudgeSubjectTitle(
  subjectId: string,
  subjectKind: TaskNudgeRecord['subjectKind'],
  stored: StoredDraftFile,
  routing: TaskRoutingPlan
): string {
  if (subjectKind === 'queue') return routing.subjectTitle ?? 'Task queue';

  const records = subjectKind === 'handoff' ? stored.handoffs : stored.drafts;
  const match = records.find(record => record.id === subjectId);

  if (!match) {
    throw new Error(`Task nudge subject ${subjectId} was not found.`);
  }

  return match.title;
}

function defaultTaskNudgePauseSeconds(action: TaskNudgeAction, phase: TaskNudgePhase): number {
  if (action === 'wait' || action === 'ask_operator' || action === 'assign_local_agent') return 0;
  if (phase === 'jules_plan') return 300;
  if (phase === 'github_pr' || phase === 'scout_core' || phase === 'local_sync') return 300;
  if (phase === 'jules_execution') return 900;
  return 0;
}

function buildRoutingPlanForDraft(
  draft: TaskDraft,
  generatedAt: string,
  candidates: TaskRoutingCandidate[]
): TaskRoutingPlan {
  const score = scoreDraftForRouting(draft);
  const route: TaskRoutingPlan['route'] = score.wantsJulesPlan
    ? 'jules_plan'
    : score.localEnough
      ? 'local_agent'
      : 'jules_task';
  const nextAction: TaskRoutingNextAction = route === 'local_agent'
    ? {
        code: 'assign_local_agent',
        label: 'Assign local Codex agent',
        detail: 'This looks small enough that a local Codex worker is lower overhead than a Jules cloud handoff.',
        pauseSeconds: 0,
        nextNudgeAt: null,
      }
    : {
        code: 'send_to_jules',
        label: route === 'jules_plan' ? 'Ask Jules for a plan' : 'Prepare Jules handoff',
        detail: route === 'jules_plan'
          ? 'The task is broad enough that Jules should plan first before implementation.'
          : 'The task is bounded but substantial enough for a Jules handoff.',
        pauseSeconds: route === 'jules_plan' ? 300 : 600,
        nextNudgeAt: addSeconds(generatedAt, route === 'jules_plan' ? 300 : 600),
      };

  return {
    generatedAt,
    route,
    subjectId: draft.id,
    subjectTitle: draft.title,
    summary: route === 'local_agent'
      ? 'Recommended route: local Codex agent. The task appears small, low-risk, and cheaper to handle locally.'
      : route === 'jules_plan'
        ? 'Recommended route: Jules plan first. The task appears broad enough to benefit from cloud planning before execution.'
        : 'Recommended route: Jules task. The task appears bounded but substantial enough for cloud execution.',
    reasons: score.reasons,
    nextAction,
    workerMode: buildWorkerModeRecommendation({
      route,
      subject: draft,
      reasons: score.reasons,
      blocked: false,
      dashboardStarted: true,
    }),
    candidates,
  };
}

function buildRoutingPlanForHandoff(
  handoff: JulesHandoff,
  generatedAt: string,
  candidates: TaskRoutingCandidate[]
): TaskRoutingPlan {
  if (handoff.julesState === 'AWAITING_PLAN_APPROVAL' || handoff.julesState === 'AWAITING_USER_FEEDBACK') {
    const route: TaskRoutingPlan['route'] = 'wait_external';
    return {
      generatedAt,
      route,
      subjectId: handoff.id,
      subjectTitle: handoff.title,
      summary: 'Jules is waiting on the operator. Symphony should ask for a decision instead of polling harder.',
      reasons: [`Jules state is ${handoff.julesState}.`],
      nextAction: {
        code: 'ask_operator',
        label: 'Operator input needed',
        detail: 'Review the Jules plan or feedback request, then approve or respond from the dashboard.',
        pauseSeconds: 0,
        nextNudgeAt: null,
      },
      workerMode: buildWorkerModeRecommendation({
        route,
        subject: handoff,
        reasons: [`Jules state is ${handoff.julesState}.`],
        blocked: true,
        externalBoundary: true,
        dashboardStarted: handoff.status !== 'observed_pr',
      }),
      candidates,
    };
  }

  const pauseSeconds = handoff.githubPullRequestUrl ? 300 : 900;
  const route: TaskRoutingPlan['route'] = 'wait_external';
  return {
    generatedAt,
    route,
    subjectId: handoff.id,
    subjectTitle: handoff.title,
    summary: handoff.githubPullRequestUrl
      ? 'Jules has reported a PR. Symphony should refresh GitHub checks on a measured cadence.'
      : 'Jules is running or pending. Symphony should pause before nudging for status again.',
    reasons: [
      handoff.githubPullRequestUrl ? 'A PR URL exists, so GitHub check refresh is the next external boundary.' : 'No PR URL has been captured yet.',
      'External systems need time to make progress.',
    ],
    nextAction: {
      code: handoff.githubPullRequestUrl ? 'refresh' : 'nudge',
      label: handoff.githubPullRequestUrl ? 'Refresh GitHub PR checks' : 'Nudge Jules status later',
      detail: handoff.githubPullRequestUrl
        ? 'Wait briefly, then refresh PR state, checks, files, and risk.'
        : 'Wait for Jules to plan, run, or report a PR before sending another status nudge.',
      pauseSeconds,
      nextNudgeAt: addSeconds(generatedAt, pauseSeconds),
    },
    workerMode: buildWorkerModeRecommendation({
      route,
      subject: handoff,
      reasons: [
        handoff.githubPullRequestUrl ? 'A PR URL exists, so GitHub check refresh is the next external boundary.' : 'No PR URL has been captured yet.',
        'External systems need time to make progress.',
      ],
      blocked: false,
      externalBoundary: true,
      dashboardStarted: handoff.status !== 'observed_pr',
    }),
    candidates,
  };
}

function buildRoutingCandidateForDraft(draft: TaskDraft, preflight: GitSyncPreflight): TaskRoutingCandidate {
  if (!preflight.ok) {
    return {
      id: draft.id,
      title: draft.title,
      kind: 'draft',
      route: 'blocked',
      workerMode: 'operator_only',
      reason: 'GitHub sync is blocked; do not route to Jules or local Codex yet.',
    };
  }

  const score = scoreDraftForRouting(draft);
  const route: TaskRoutingPlan['route'] = score.wantsJulesPlan ? 'jules_plan' : score.localEnough ? 'local_agent' : 'jules_task';
  const workerMode = workerModeForDraftRoute(route, draft, score);
  return {
    id: draft.id,
    title: draft.title,
    kind: 'draft',
    route,
    workerMode,
    reason: score.reasons[0] || 'Route based on scope and verification size.',
  };
}

function buildRoutingCandidateForHandoff(handoff: JulesHandoff): TaskRoutingCandidate {
  return {
    id: handoff.id,
    title: handoff.title,
    kind: 'handoff',
    route: 'wait_external',
    workerMode: 'observe_wait',
    reason: handoff.githubPullRequestUrl
      ? 'Refresh GitHub PR state after a short pause.'
      : 'Wait for Jules session progress before nudging again.',
  };
}

function scoreDraftForRouting(draft: TaskDraft): {
  localEnough: boolean;
  wantsJulesPlan: boolean;
  reasons: string[];
} {
  const text = `${draft.title}\n${draft.body}`.toLowerCase();
  const fileCount = draft.expectedFiles.length;
  const commandCount = draft.verificationCommands.length;
  const reasons: string[] = [];
  const broadWords = ['multi-file', 'multi stage', 'multi-stage', 'architecture', 'system', 'plan first', 'make a plan'];
  const smallWords = ['typo', 'copy', 'wording', 'small', 'docs', 'verifier', 'dashboard wiring'];
  const wantsJulesPlan = broadWords.some(word => text.includes(word)) || fileCount >= 4 || commandCount >= 2;
  const localEnough = !wantsJulesPlan && fileCount <= 2 && smallWords.some(word => text.includes(word));

  if (fileCount <= 2) reasons.push('Small write scope.');
  if (fileCount >= 4) reasons.push('Broad multi-file write scope.');
  if (commandCount >= 2) reasons.push('Multiple verification commands suggest a larger task.');
  if (smallWords.some(word => text.includes(word))) reasons.push('Draft wording describes a small local change.');
  if (broadWords.some(word => text.includes(word))) reasons.push('Draft wording asks for Jules-scale planning or system work.');
  if (!reasons.length) reasons.push('Route based on expected file count and verification scope.');

  return { localEnough, wantsJulesPlan, reasons };
}

function buildWorkerModeRecommendation(input: {
  route: TaskRoutingPlan['route'];
  subject: TaskDraft | JulesHandoff | null;
  reasons: string[];
  blocked: boolean;
  externalBoundary?: boolean;
  dashboardStarted: boolean;
}): WorkerModeRecommendation {
  const subject = input.subject;
  const draftScore = subject && isTaskDraftRecord(subject) ? scoreDraftForRouting(subject) : null;
  const mode = subject && isTaskDraftRecord(subject)
    ? workerModeForDraftRoute(input.route, subject, draftScore ?? scoreDraftForRouting(subject))
    : workerModeForRoute(input.route);
  const complexitySignals = buildWorkerModeComplexitySignals(subject, input.blocked, Boolean(input.externalBoundary), input.dashboardStarted);
  const modelAndEffort = modelAndEffortForWorkerMode(mode);
  const dispatchable = !input.blocked && ['local_fast', 'local_careful', 'jules_task', 'jules_plan'].includes(mode);
  const modeReason = workerModeReason(mode, complexitySignals);

  // The worker-mode packet is advisory, not a dispatcher. It translates the
  // routing facts into a Codex mode/model/reasoning recommendation so the
  // dashboard can explain "why this kind of agent" before any worker starts.
  // Explicit WORKFLOW.md codex.model/codex.reasoning_effort settings still win
  // at launch time; this packet records the automatic recommendation only.
  return {
    mode,
    recommendedModel: modelAndEffort.model,
    recommendedReasoningEffort: modelAndEffort.reasoningEffort,
    canDispatchNow: dispatchable,
    summary: workerModeSummary(mode, dispatchable),
    reasons: uniqueStrings([...input.reasons, modeReason]),
    complexitySignals,
    overridePolicy: 'Automatic mode/model/reasoning is advisory. Explicit codex.model or codex.reasoning_effort in WORKFLOW.md remains the launch-time override.',
  };
}

function workerModeForDraftRoute(
  route: TaskRoutingPlan['route'],
  draft: TaskDraft,
  score: ReturnType<typeof scoreDraftForRouting>
): WorkerMode {
  if (route === 'blocked' || route === 'ask_operator') return 'operator_only';
  if (route === 'jules_plan') return 'jules_plan';
  if (route === 'jules_task') return 'jules_task';

  const signals = buildWorkerModeComplexitySignals(draft, false, false, true);
  if (route === 'local_agent' && (signals.expectedFileCount > 1 || signals.verificationCommandCount > 1 || signals.riskyKeywordCount > 0 || !score.localEnough)) {
    return 'local_careful';
  }

  if (route === 'local_agent') return 'local_fast';
  return workerModeForRoute(route);
}

function workerModeForRoute(route: TaskRoutingPlan['route']): WorkerMode {
  if (route === 'blocked' || route === 'ask_operator') return 'operator_only';
  if (route === 'local_agent') return 'local_fast';
  if (route === 'jules_plan') return 'jules_plan';
  if (route === 'jules_task') return 'jules_task';
  return 'observe_wait';
}

function modelAndEffortForWorkerMode(mode: WorkerMode): {
  model: string;
  reasoningEffort: WorkerModeRecommendation['recommendedReasoningEffort'];
} {
  if (mode === 'operator_only') return { model: 'none', reasoningEffort: 'none' };
  if (mode === 'local_fast') return { model: 'default', reasoningEffort: 'low' };
  if (mode === 'local_careful') return { model: 'default', reasoningEffort: 'medium' };
  if (mode === 'jules_plan') return { model: 'default', reasoningEffort: 'high' };
  if (mode === 'observe_wait') return { model: 'default', reasoningEffort: 'minimal' };
  return { model: 'default', reasoningEffort: 'medium' };
}

function buildWorkerModeComplexitySignals(
  subject: TaskDraft | JulesHandoff | null,
  blocked: boolean,
  externalBoundary: boolean,
  dashboardStarted: boolean
): WorkerModeRecommendation['complexitySignals'] {
  const text = subject ? `${subject.title}\n${'body' in subject ? subject.body : subject.prompt}` : '';
  const riskyKeywordCount = workerModeRiskyKeywords().filter(keyword => text.toLowerCase().includes(keyword)).length;

  return {
    expectedFileCount: subject?.expectedFiles.length ?? 0,
    verificationCommandCount: subject?.verificationCommands.length ?? 0,
    riskyKeywordCount,
    externalBoundary,
    blocked,
    dashboardStarted,
  };
}

function workerModeRiskyKeywords(): string[] {
  return [
    'architecture',
    'migration',
    'security',
    'sync',
    'merge',
    'delete',
    'refactor',
    'state',
    'orchestrator',
    'workflow',
  ];
}

function workerModeReason(mode: WorkerMode, signals: WorkerModeRecommendation['complexitySignals']): string {
  if (mode === 'operator_only') return 'Operator-only mode because a human decision or blocked gate is the current boundary.';
  if (mode === 'local_fast') return 'Local-fast mode because the task has a small file and verification footprint.';
  if (mode === 'local_careful') return 'Local-careful mode because the task is local but has enough scope or risk to need normal reasoning.';
  if (mode === 'jules_plan') return 'Jules-plan mode because the task is broad enough to benefit from planning before execution.';
  if (mode === 'observe_wait') return 'Observe-wait mode because the next boundary is an external Jules/GitHub/Scout/Core/local-sync wait.';
  return signals.riskyKeywordCount > 0
    ? 'Jules-task mode because the task is bounded but contains risk keywords or non-trivial implementation scope.'
    : 'Jules-task mode because the task is bounded but larger than a quick local edit.';
}

function workerModeSummary(mode: WorkerMode, dispatchable: boolean): string {
  const suffix = dispatchable ? 'Dispatch is allowed after normal gates.' : 'No worker should be dispatched from this packet right now.';
  if (mode === 'operator_only') return `Recommended mode: operator_only. ${suffix}`;
  if (mode === 'local_fast') return `Recommended mode: local_fast. ${suffix}`;
  if (mode === 'local_careful') return `Recommended mode: local_careful. ${suffix}`;
  if (mode === 'jules_plan') return `Recommended mode: jules_plan. ${suffix}`;
  if (mode === 'observe_wait') return `Recommended mode: observe_wait. ${suffix}`;
  return `Recommended mode: jules_task. ${suffix}`;
}

function isTaskDraftRecord(subject: TaskDraft | JulesHandoff): subject is TaskDraft {
  return 'body' in subject;
}

function newestByUpdatedAt<T extends { updatedAt?: string; createdAt?: string }>(items: T[]): T | null {
  return [...items].sort((a, b) => {
    return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
  })[0] ?? null;
}

function addSeconds(timestamp: string, seconds: number): string {
  const base = Number.isFinite(new Date(timestamp).getTime()) ? new Date(timestamp) : new Date();
  return new Date(base.getTime() + seconds * 1000).toISOString();
}

function activeGitDispositionCategories(preflight: GitSyncPreflight): GitDispositionCategory[] {
  const categories: GitDispositionCategory[] = [];
  if ((preflight.ahead ?? 0) > 0) categories.push('local_commits');
  if ((preflight.dirtyFiles ?? 0) > 0) categories.push('tracked_changes');
  if ((preflight.untrackedFiles ?? 0) > 0) categories.push('untracked_artifacts');
  if ((preflight.behind ?? 0) > 0) categories.push('remote_commits');
  return categories;
}

function gitDispositionLabel(category: GitDispositionCategory): string {
  return GIT_DISPOSITION_CATEGORIES.find(item => item.category === category)?.label ?? category;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values
    .map(value => typeof value === 'string' ? value.trim() : '')
    .filter(Boolean)));
}

function decisionDetail(record: GitDispositionRecord | undefined): string {
  if (!record?.decision) {
    return 'No disposition was recorded for this category.';
  }

  const note = record.note ? ` Note: ${record.note}` : '';
  return `${record.decisionLabel || record.decision}.${note}`;
}

function parseResolutionCommit(line: string): GitResolutionCommit | null {
  const sideMarker = line[0];
  if (sideMarker !== '<' && sideMarker !== '>') return null;

  const body = line.slice(1).trim();
  const firstSpace = body.indexOf(' ');
  const hash = firstSpace === -1 ? body : body.slice(0, firstSpace);
  const message = firstSpace === -1 ? '' : body.slice(firstSpace + 1).trim();
  if (!hash) return null;

  return {
    side: sideMarker === '<' ? 'local' : 'remote',
    hash,
    message,
  };
}

function parseResolutionFile(line: string): GitResolutionFile | null {
  if (!line.trim()) return null;

  const status = line.slice(0, 2);
  const path = line.slice(3).trim().replace(/\\/g, '/');
  if (!path) return null;

  return { status, path };
}

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function normalizeGitDispositionCategory(value: unknown): GitDispositionCategory {
  if (typeof value !== 'string' || !GIT_DISPOSITION_CATEGORIES.some(item => item.category === value)) {
    throw new Error(`Unsupported Git disposition category: ${String(value)}`);
  }

  return value as GitDispositionCategory;
}

function normalizeGitDispositionDecision(value: unknown): GitDispositionDecision {
  if (
    typeof value !== 'string'
    || !Object.prototype.hasOwnProperty.call(GIT_DISPOSITION_DECISION_LABELS, value)
  ) {
    throw new Error(`Unsupported Git disposition decision: ${String(value)}`);
  }

  return value as GitDispositionDecision;
}

function normalizeLineList(value: unknown, limit: number): string[] {
  const rawCommands = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\r?\n/)
      : [];

  return rawCommands
    .map(command => String(command).trim())
    .filter(Boolean)
    .slice(0, limit);
}

function findDuplicateTaskRecord(
  stored: StoredDraftFile,
  input: {
    title: string;
    body: string;
    expectedFiles: string[];
    verificationCommands: string[];
  },
): { kind: 'draft' | 'handoff'; id: string; title: string } | null {
  const inputTitle = normalizeDuplicateText(input.title);
  const inputBody = normalizeDuplicateText(input.body);
  const inputExpectedFiles = input.expectedFiles.map(normalizeDuplicateText);
  const inputVerificationCommands = input.verificationCommands.map(normalizeDuplicateText);

  // Duplicate detection is intentionally exact after dashboard normalization.
  // Similar task names are allowed, but an identical bounded task should point
  // the operator back to the existing draft/handoff instead of making a second
  // Jules queue item with the same write scope and verification contract.
  for (const draft of stored.drafts) {
    if (
      normalizeDuplicateText(draft.title) === inputTitle
      && normalizeDuplicateText(draft.body) === inputBody
      && duplicateArraysMatch(draft.expectedFiles.map(normalizeDuplicateText), inputExpectedFiles)
      && duplicateArraysMatch(draft.verificationCommands.map(normalizeDuplicateText), inputVerificationCommands)
    ) {
      return { kind: 'draft', id: draft.id, title: draft.title };
    }
  }

  for (const handoff of stored.handoffs) {
    if (
      normalizeDuplicateText(handoff.title) === inputTitle
      && duplicateArraysMatch((handoff.expectedFiles ?? []).map(normalizeDuplicateText), inputExpectedFiles)
      && duplicateArraysMatch((handoff.verificationCommands ?? []).map(normalizeDuplicateText), inputVerificationCommands)
    ) {
      return { kind: 'handoff', id: handoff.id, title: handoff.title };
    }
  }

  return null;
}

function normalizeDuplicateText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function duplicateArraysMatch(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function isJulesHandoff(value: unknown): value is JulesHandoff {
  const handoff = value as Partial<JulesHandoff>;
  return typeof handoff?.id === 'string'
    && typeof handoff.draftId === 'string'
    && typeof handoff.title === 'string'
    && handoff.executor === 'jules'
    && typeof handoff.prompt === 'string'
    && typeof handoff.createdAt === 'string'
    && typeof handoff.updatedAt === 'string';
}

function buildJulesPrompt(draft: TaskDraft, preflight: GitSyncPreflight): string {
  const trackingLines = buildJulesTrackingLines(draft);

  // This prompt follows docs/@JULES-WORKFLOW-GUIDE.md: bounded mission,
  // required reading, execution steps, constraints, and deliverable. The goal is
  // to preserve the existing Aralia Jules style while making Symphony the
  // dashboard-first foreman that prepares and later monitors the cloud task.
  return [
    '# MISSION',
    draft.body,
    '',
    ...trackingLines,
    '# REQUIRED READING',
    '- `AGENTS.md`',
    '- `.agent/workflows/USER.local.md` if it exists',
    '- `docs/@JULES-WORKFLOW-GUIDE.md`',
    '- `public/agent-docs/rules/Jules.md`',
    '- `public/agent-docs/rules/UPLINK.md` for the Scout/Core bridge and merge protocol',
    '- Relevant source/docs for the files you intend to touch',
    '',
    '# EXECUTION STEPS',
    '1. Confirm the repository checkout is based on the current GitHub base branch.',
    `2. Treat \`${preflight.remoteBranch}\` at commit \`${preflight.remoteCommit || 'unknown'}\` as the source of truth for the starting point.`,
    '3. Inspect existing code, docs, and local conventions before editing.',
    '4. Keep the implementation bounded to this task and avoid unrelated cleanup.',
    '5. Run the smallest meaningful verification commands and report exactly what passed or failed.',
    '6. Prepare a GitHub PR or equivalent Jules result for Symphony/Scout/Core review.',
    '7. Leave the PR ready for Scout to bridge with arbitration comments before Core validates or merges.',
    '',
    '# REQUESTED VERIFICATION',
    ...(draft.verificationCommands?.length
      ? draft.verificationCommands.map(command => `- \`${command}\``)
      : ['- No explicit commands were supplied. Choose the smallest meaningful verification for the files changed.']),
    '',
    '# EXPECTED WRITE SCOPE',
    ...(draft.expectedFiles?.length
      ? draft.expectedFiles.map(file => `- \`${file}\``)
      : ['- No explicit write scope was supplied. Keep changes as narrow as possible and report touched files clearly.']),
    '',
    '# CONSTRAINTS',
    '- Do not modify lockfiles such as `package-lock.json` unless dependency changes are explicitly required.',
    '- Avoid central registry/index churn unless this task specifically requires it.',
    '- Preserve unfinished intent and future optionality in Aralia; do not prune systems for neatness.',
    '- If conflict-prone files are unavoidable, call them out in the final report.',
    '- Do not claim visual fixes without rendered verification.',
    '',
    '# DELIVERABLE',
    '- Summary of changes made.',
    '- Files changed, with any conflict-prone files called out.',
    '- Verification commands and results.',
    '- PR URL or clear handoff status for Symphony to monitor.',
  ].join('\n');
}

function buildJulesTrackingLines(draft: TaskDraft): string[] {
  if (!draft.linearIssueIdentifier && !draft.linearIssueUrl && !draft.linearIssueId) {
    return [];
  }

  // The Linear issue is the durable work ticket a Symphony foreman can claim
  // and monitor. Put it in the prompt itself so Jules output, GitHub PRs, and
  // later Scout/Core review still point back to the same task even outside the
  // local dashboard.
  return [
    '# TRACKING',
    `- Linear issue: \`${draft.linearIssueIdentifier || draft.linearIssueId || 'linked issue'}\``,
    ...(draft.linearIssueUrl ? [`- Linear URL: ${draft.linearIssueUrl}`] : []),
    '',
  ];
}

function buildManifest(handoff: JulesHandoff, preflight: GitSyncPreflight, runId: string): JulesRunManifest {
  return {
    runId,
    source: 'sources/github/Gambitnl/Aralia',
    startingBranch: preflight.baseBranch,
    startingCommit: preflight.remoteCommit ?? preflight.localCommit ?? '',
    requirePlanApproval: true,
    automationMode: 'AUTO_CREATE_PR',
    tasks: [
      {
        id: handoff.id.replace(/^handoff-/, 'symphony-'),
        title: handoff.title,
        persona: 'scribe',
        mode: 'worker',
        prompt: handoff.prompt,
        readScopes: [
          'AGENTS.md',
          '.agent/workflows/USER.local.md',
          'docs/@JULES-WORKFLOW-GUIDE.md',
          'public/agent-docs/rules/Jules.md',
          'public/agent-docs/rules/UPLINK.md',
        ],
        writeScopes: buildJulesWriteScopes(handoff),
        forbiddenFiles: [
          'package-lock.json',
          'pnpm-lock.yaml',
          'tsconfig.tsbuildinfo',
          'tsconfig.node.tsbuildinfo',
          'dist',
        ],
        verification: [
          ...handoff.verificationCommands.map(command => `Run \`${command}\` and report the result.`),
          'Run the smallest relevant verification for the files changed.',
          'Report if this task only produced analysis or if no code changes were needed.',
          'Leave enough PR context for Scout to bridge conflicts before Core validates the merge.',
        ],
      },
    ],
  };
}

export function buildJulesManifestPreviewFromDraft(
  draft: TaskDraft,
  preflight: GitSyncPreflight,
  runId: string
): JulesRunManifest {
  // The preview must use the same manifest builder as real staging. It creates a
  // temporary handoff-shaped packet in memory only, so the dashboard can inspect
  // the future Jules boundary without writing .jules files or calling Jules.
  return buildManifest({
    id: runId.replace(/^symphony-preview-/, 'handoff-preview-'),
    draftId: draft.id,
    title: draft.title,
    executor: 'jules',
    status: preflight.ok ? 'ready_for_jules' : 'blocked_by_git_sync',
    prompt: buildJulesPrompt(draft, preflight),
    expectedFiles: draft.expectedFiles ?? [],
    verificationCommands: draft.verificationCommands ?? [],
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    gitPreflight: preflight,
    baseCommitDrift: null,
    runId,
    manifestPath: null,
    launchCommand: null,
    launchOutput: null,
    launchError: null,
    launchedAt: null,
    statusCommand: null,
    reviewCommand: null,
    pullCommand: null,
    recordsPath: null,
    lastStatusRefreshAt: null,
    julesSessionId: null,
    julesSessionUrl: null,
    julesState: null,
    linearIssueId: draft.linearIssueId,
    linearIssueIdentifier: draft.linearIssueIdentifier,
    linearIssueUrl: draft.linearIssueUrl,
    linearIssueCreatedAt: draft.linearIssueCreatedAt,
    githubPullRequestUrl: null,
    githubPullRequestState: null,
    githubPullRequestIsDraft: null,
    githubPullRequestMergeable: null,
    githubPullRequestReviewDecision: null,
    githubPullRequestHeadRef: null,
    githubPullRequestBaseRef: null,
    githubPullRequestChecks: null,
    githubPullRequestFiles: null,
    githubPullRequestFeedback: null,
    githubPullRequestNextAction: null,
    githubPullRequestRefreshError: null,
    lastPullRequestRefreshAt: null,
    pullRequestViewCommand: null,
    pullRequestChecksCommand: null,
    pullRequestMergeCommand: null,
    scoutReviewCommand: null,
    coreValidationCommand: null,
    coreMergeCommand: null,
    localSyncCommand: null,
    localSyncStatus: null,
    localSyncOutput: null,
    localSyncError: null,
    lastLocalSyncAt: null,
    operatorMessages: [],
    planApprovals: [],
  }, preflight, runId);
}

function buildJulesWriteScopes(handoff: JulesHandoff): string[] {
  // Jules manifests need explicit write scopes for patch review. When the
  // operator named files, those become the coding boundary. If no files were
  // named, keep the previous worklog-only scope so the handoff remains an
  // analysis/coordination task instead of an unbounded cloud edit.
  return handoff.expectedFiles.length
    ? handoff.expectedFiles
    : ['.jules/worklogs/worklog_scribe.md'];
}

async function readFirstRunRecord(recordsPath: string): Promise<JulesTaskRunRecord | null> {
  try {
    const raw = await readFile(recordsPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;

    const record = parsed.find(item => {
      const candidate = item as Partial<JulesTaskRunRecord>;
      return typeof candidate?.taskId === 'string';
    }) as JulesTaskRunRecord | undefined;

    return record ?? null;
  } catch {
    return null;
  }
}

function compactCommandOutput(stdout?: string, stderr?: string): string {
  const output = [stdout, stderr].filter(Boolean).join('\n').trim();
  if (!output) return '';

  const lines = output.split(/\r?\n/);
  return lines.length <= 60
    ? output
    : `${lines.slice(0, 60).join('\n')}\n... ${lines.length - 60} more lines hidden`;
}

function buildPullRequestCommands(prUrl: string | null, baseBranch: string): Pick<
  JulesHandoff,
  | 'pullRequestViewCommand'
  | 'pullRequestChecksCommand'
  | 'pullRequestMergeCommand'
  | 'scoutReviewCommand'
  | 'coreValidationCommand'
  | 'coreMergeCommand'
  | 'localSyncCommand'
> {
  if (!prUrl) {
    return {
      pullRequestViewCommand: null,
      pullRequestChecksCommand: null,
      pullRequestMergeCommand: null,
      scoutReviewCommand: null,
      coreValidationCommand: null,
      coreMergeCommand: null,
      localSyncCommand: null,
    };
  }

  // These commands deliberately preserve the Aralia Scout -> Core split. Scout
  // inspects comments/files and writes bridge instructions; Core does the final
  // validation/merge only after that bridge has happened.
  return {
    pullRequestViewCommand: `gh pr view ${prUrl}`,
    pullRequestChecksCommand: `gh pr checks ${prUrl}`,
    pullRequestMergeCommand: `gh pr merge ${prUrl} --squash --delete-branch`,
    scoutReviewCommand: `gh pr view ${prUrl} --comments --files`,
    coreValidationCommand: `gh pr view ${prUrl} --json state,isDraft,mergeable,reviewDecision,statusCheckRollup,files`,
    coreMergeCommand: `gh pr merge ${prUrl} --squash --delete-branch`,
    localSyncCommand: `git pull --ff-only origin ${baseBranch}`,
  };
}

function buildPullRequestFeedbackCommand(prUrl: string, handoffId: string): string {
  const safeId = handoffId.replace(/[^a-zA-Z0-9._-]/g, '-');
  return `gh pr comment ${prUrl} --body-file .jules/feedback/${safeId}-pr-feedback.md`;
}

function buildObservedPullRequestHandoff(input: {
  prUrl: string;
  title: string;
  expectedFiles: string[];
  verificationCommands: string[];
  now: string;
  baseBranch: string;
  existing: JulesHandoff | null;
}): JulesHandoff {
  const commands = buildPullRequestCommands(input.prUrl, input.baseBranch);
  const existing = input.existing;

  // A watched PR is intentionally stored in the same handoff list as Jules PRs
  // so the dashboard can reuse the mature PR/check/risk/readiness panels. The
  // observed_pr status keeps launch, manifest, and local-sync claims honest.
  return {
    id: existing?.id ?? `observed-pr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    draftId: existing?.draftId ?? `observed-pr:${input.prUrl}`,
    title: input.title,
    executor: 'jules',
    status: 'observed_pr',
    prompt: [
      '# OBSERVED PR',
      'This record watches an existing GitHub pull request for Symphony learning and foreman tracking.',
      'It was not created, staged, or launched by the current dashboard run.',
      '',
      `PR: ${input.prUrl}`,
    ].join('\n'),
    expectedFiles: input.expectedFiles,
    verificationCommands: input.verificationCommands,
    createdAt: existing?.createdAt ?? input.now,
    updatedAt: input.now,
    gitPreflight: existing?.gitPreflight ?? buildUnknownGitPreflight(input.now, input.baseBranch),
    baseCommitDrift: null,
    runId: null,
    manifestPath: null,
    launchCommand: null,
    launchOutput: null,
    launchError: null,
    launchedAt: null,
    statusCommand: null,
    reviewCommand: null,
    pullCommand: null,
    recordsPath: null,
    lastStatusRefreshAt: null,
    julesSessionId: null,
    julesSessionUrl: null,
    julesState: null,
    linearIssueId: null,
    linearIssueIdentifier: null,
    linearIssueUrl: null,
    linearIssueCreatedAt: null,
    githubPullRequestUrl: input.prUrl,
    githubPullRequestState: existing?.githubPullRequestState ?? null,
    githubPullRequestIsDraft: existing?.githubPullRequestIsDraft ?? null,
    githubPullRequestMergeable: existing?.githubPullRequestMergeable ?? null,
    githubPullRequestReviewDecision: existing?.githubPullRequestReviewDecision ?? null,
    githubPullRequestHeadRef: existing?.githubPullRequestHeadRef ?? null,
    githubPullRequestBaseRef: existing?.githubPullRequestBaseRef ?? null,
    githubPullRequestChecks: existing?.githubPullRequestChecks ?? null,
    githubPullRequestFiles: existing?.githubPullRequestFiles ?? null,
    githubPullRequestFeedback: existing?.githubPullRequestFeedback ?? null,
    githubPullRequestNextAction: existing?.githubPullRequestNextAction ?? null,
    githubPullRequestRefreshError: existing?.githubPullRequestRefreshError ?? null,
    lastPullRequestRefreshAt: existing?.lastPullRequestRefreshAt ?? null,
    ...commands,
    localSyncStatus: existing?.localSyncStatus ?? null,
    localSyncOutput: existing?.localSyncOutput ?? null,
    localSyncError: existing?.localSyncError ?? null,
    lastLocalSyncAt: existing?.lastLocalSyncAt ?? null,
    operatorMessages: existing?.operatorMessages ?? [],
    planApprovals: existing?.planApprovals ?? [],
  };
}

function buildObservedPullRequestFollowUpTitle(handoff: JulesHandoff): string {
  const number = extractPullRequestNumber(handoff.githubPullRequestUrl);
  const suffix = number ? `#${number}` : handoff.githubPullRequestUrl;

  // Default titles make it obvious that this is new work derived from a watched
  // PR, not a request to reopen or patch the historical PR itself.
  return `Follow-up from observed PR ${suffix}`;
}

function buildObservedPullRequestFollowUpBody(handoff: JulesHandoff): string {
  const prUrl = handoff.githubPullRequestUrl ?? 'unknown observed PR';
  const state = handoff.githubPullRequestState ?? 'unknown';
  const mergeable = handoff.githubPullRequestMergeable ?? 'unknown';
  const checks = handoff.githubPullRequestChecks
    ? `${handoff.githubPullRequestChecks.conclusion} (${handoff.githubPullRequestChecks.passed} passed, ${handoff.githubPullRequestChecks.failed} failed, ${handoff.githubPullRequestChecks.pending} pending).`
    : 'no check summary captured';
  const files = handoff.githubPullRequestFiles;
  const fileSummary = files
    ? `${files.total} changed file(s), ${files.additions} addition(s), ${files.deletions} deletion(s), risk ${files.risk}.`
    : 'No changed-file summary has been captured yet.';
  const feedback = handoff.githubPullRequestFeedback?.summary ?? 'No Jules, Scout, Core, or external review comment summary has been captured yet.';
  const riskReasons = files?.riskReasons?.length
    ? files.riskReasons.map(reason => `- ${reason}`).join('\n')
    : '- No specific PR file-risk reason has been captured yet.';

  // The body is written as an instruction packet for the future worker. It
  // carries the observed PR evidence forward while making the boundary explicit:
  // this draft is new work, and the historical PR stays read-only evidence.
  return [
    `Source observed PR: ${prUrl}`,
    '',
    'This is a new bounded task derived from historical PR evidence.',
    'Do not repair, reopen, or comment on the historical PR unless the operator explicitly creates a separate GitHub-review task.',
    '',
    `Observed PR title: ${handoff.title}`,
    `Observed PR state: ${state}`,
    `Observed PR mergeability: ${mergeable}`,
    `Observed PR checks: ${checks}`,
    `Observed PR changed files: ${fileSummary}`,
    `Observed PR feedback: ${feedback}`,
    '',
    'Risk or scope notes carried from the observed PR:',
    riskReasons,
    '',
    'Expected outcome: turn the useful lesson into a focused dashboard task with its own write scope, verifier, and evidence trail.',
  ].join('\n');
}

function deriveObservedPullRequestFollowUpFiles(handoff: JulesHandoff): string[] {
  const fromExpected = handoff.expectedFiles ?? [];
  const fromScope = handoff.githubPullRequestFiles?.scopeFiles ?? [];
  const fromChanged = handoff.githubPullRequestFiles?.files?.map(file => file.path) ?? [];

  // Prefer the original watch scope, then the PR's own scoped files, then the
  // first changed files. The fallback keeps one-click draft creation possible
  // even before a PR refresh has populated GitHub's changed-file payload.
  return uniqueStrings([
    ...fromExpected,
    ...fromScope,
    ...fromChanged,
    handoff.githubPullRequestUrl
      ? `Observed PR follow-up scope needs narrowing from ${handoff.githubPullRequestUrl}`
      : 'Observed PR follow-up scope needs narrowing',
  ]).slice(0, 12);
}

function deriveObservedPullRequestFollowUpVerification(handoff: JulesHandoff): string[] {
  const number = extractPullRequestNumber(handoff.githubPullRequestUrl);
  const repo = extractPullRequestRepository(handoff.githubPullRequestUrl);

  // Reuse any verification commands the operator supplied when watching the PR,
  // then add read-only GitHub inspection commands so the future worker can prove
  // which historical evidence shaped the new task.
  return uniqueStrings([
    ...(handoff.verificationCommands ?? []),
    repo && number ? `gh pr view ${number} --repo ${repo}` : null,
    repo && number ? `gh pr checks ${number} --repo ${repo}` : null,
  ]);
}

function extractPullRequestNumber(prUrl: string | null): string | null {
  const match = String(prUrl ?? '').match(/\/pull\/(\d+)$/i);
  return match?.[1] ?? null;
}

function extractPullRequestRepository(prUrl: string | null): string | null {
  const match = String(prUrl ?? '').match(/^https:\/\/github\.com\/([^/\s]+\/[^/\s]+)\/pull\/\d+$/i);
  return match?.[1] ?? null;
}

function buildUnknownGitPreflight(now: string, baseBranch: string): GitSyncPreflight {
  // Observed PR records can exist before a fresh Git preflight has been run.
  // This placeholder is overwritten by the snapshot boundary and prevents old
  // hand-edited records from looking like a clean Git state.
  return {
    ok: false,
    checkedAt: now,
    repoRoot: '',
    baseBranch,
    remoteBranch: `origin/${baseBranch}`,
    currentBranch: null,
    localCommit: null,
    remoteCommit: null,
    ahead: null,
    behind: null,
    dirtyFiles: 0,
    untrackedFiles: 0,
    blockers: ['Git sync has not been checked for this observed PR record.'],
    summary: 'Git sync has not been checked for this observed PR record.',
    details: [],
    dirtyFileSamples: [],
    untrackedFileSamples: [],
    resolutionPacket: {
      generatedAt: now,
      mutatesGit: false,
      repoRoot: '',
      baseBranch,
      remoteBranch: `origin/${baseBranch}`,
      summary: 'No Git resolution packet has been generated for this observed PR record yet.',
      localCommits: [],
      remoteCommits: [],
      trackedFiles: [],
      untrackedFiles: [],
      details: [],
      commands: {
        fullStatus: 'git status --short',
        inspectDivergence: `git log --oneline --left-right ${baseBranch}...origin/${baseBranch}`,
      },
    },
    remediation: [],
    nextAction: {
      code: 'inspect_git_state',
      tone: 'blocked',
      label: 'Inspect Git State',
      command: null,
      summary: 'Run the GitHub sync gate before using this PR for launch or local sync decisions.',
      steps: ['Refresh the GitHub sync gate from the dashboard.'],
    },
    commands: {
      status: 'git status --short',
      fetch: `git fetch origin ${baseBranch}`,
      showLocalCommit: `git rev-parse ${baseBranch}`,
      showRemoteCommit: `git rev-parse origin/${baseBranch}`,
      inspectDivergence: `git log --oneline --left-right ${baseBranch}...origin/${baseBranch}`,
      pullFastForward: `git pull --ff-only origin ${baseBranch}`,
      pushBase: `git push origin ${baseBranch}`,
    },
  };
}

export function summarizePullRequestFeedback(pr: Pick<GitHubPullRequestView, 'comments' | 'reviews' | 'latestReviews'>): PullRequestFeedbackSummary {
  const entries: PullRequestFeedbackComment[] = [
    ...normalizePullRequestComments(pr.comments ?? [], 'comment'),
    ...normalizePullRequestComments([...(pr.reviews ?? []), ...(pr.latestReviews ?? [])], 'review'),
  ];
  const julesFeedback = entries.filter(entry => /^\s*\[Jules feedback\]/i.test(entry.body));
  const scoutConflictComments = entries.filter(isScoutConflictComment);
  const externalReviewComments = entries.filter(entry => !julesFeedback.includes(entry) && !scoutConflictComments.includes(entry));

  // Other agents can leave useful PR review context, but only explicitly marked
  // feedback should be treated as instructions for Jules to act on. Scout
  // conflict comments get their own lane because they are foreman blockers, not
  // generic review chatter and not direct Jules feedback.
  return {
    totalComments: entries.length,
    julesFeedback,
    scoutConflictComments,
    externalReviewComments,
    summary: `${julesFeedback.length} Jules feedback comment(s), ${scoutConflictComments.length} Scout conflict comment(s), ${externalReviewComments.length} external review comment(s).`,
  };
}

function isScoutConflictComment(entry: PullRequestFeedbackComment): boolean {
  return /Potential Conflict Detected by Scout/i.test(entry.body);
}

function normalizePullRequestComments(
  comments: Array<GitHubPullRequestComment | GitHubPullRequestReview>,
  source: PullRequestFeedbackComment['source'],
): PullRequestFeedbackComment[] {
  return comments
    .filter(comment => typeof comment.body === 'string' && comment.body.trim())
    .map(comment => {
      const body = comment.body ?? '';
      const conflictFile = /Your PR modifies `([^`]+)`/i.exec(body)?.[1] ?? null;
      const priorityPullRequestMatch = /overlap with \*\*PR #(\d+)\*\*/i.exec(body);

      // Scout writes structured conflict comments directly on PRs. Preserving
      // the named file and priority PR lets the dashboard show why a handoff is
      // blocked without asking the operator to read every bot comment manually.
      return {
        author: comment.author?.login ?? 'unknown',
        body,
        url: comment.url ?? null,
        createdAt: source === 'comment'
          ? (comment as GitHubPullRequestComment).createdAt ?? null
          : (comment as GitHubPullRequestReview).submittedAt ?? null,
        source,
        conflictFile,
        priorityPullRequest: priorityPullRequestMatch ? Number(priorityPullRequestMatch[1]) : null,
      };
    });
}

export function summarizePullRequestChecks(
  rollup: GitHubPullRequestView['statusCheckRollup']
): PullRequestCheckSummary {
  const checks = Array.isArray(rollup) ? rollup : [];
  let passed = 0;
  let failed = 0;
  let pending = 0;
  let skipped = 0;
  let unknown = 0;
  const artifacts: PullRequestCheckArtifact[] = [];

  for (const check of checks) {
    const name = String(check.name ?? '');
    const conclusion = String(check.conclusion ?? '').toUpperCase();
    const status = String(check.status ?? '').toUpperCase();

    if (['SUCCESS', 'PASSED'].includes(conclusion)) passed += 1;
    else if (['FAILURE', 'FAILED', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED'].includes(conclusion)) failed += 1;
    else if (['SKIPPED', 'NEUTRAL'].includes(conclusion)) skipped += 1;
    else if (['QUEUED', 'IN_PROGRESS', 'PENDING', 'REQUESTED', 'WAITING'].includes(status)) pending += 1;
    else unknown += 1;

    if (/quality scan/i.test(name)) {
      // The advisory scan is intentionally non-blocking, but it publishes a
      // JSON artifact that foremen can parse instead of scraping raw logs.
      artifacts.push({
        checkName: name || 'Quality Scan (advisory)',
        artifactName: 'quality-scan-json',
        detailsUrl: typeof check.detailsUrl === 'string' && check.detailsUrl ? check.detailsUrl : null,
        summary: 'Machine-readable CI artifact with grouped quality-debt counts; the GitHub step summary shows the same advisory counts for human review.',
      });
    }
  }

  return {
    total: checks.length,
    passed,
    failed,
    pending,
    skipped,
    unknown,
    conclusion: failed > 0
      ? 'failing'
      : pending > 0
        ? 'pending'
        : checks.length > 0 && unknown === 0
          ? 'passing'
          : 'unknown',
    artifacts,
  };
}

export function summarizePullRequestFiles(pr: GitHubPullRequestView, expectedFiles: string[] = []): PullRequestFileSummary {
  const scopeFiles = expectedFiles
    .map(normalizeRepoPath)
    .filter(Boolean);
  const files = (Array.isArray(pr.files) ? pr.files : []).map(file => {
    const path = file.path ?? '(unknown file)';
    const risk = classifyPullRequestFileRisk(path);
    const outsideScope = scopeFiles.length > 0 && !scopeFiles.some(scope => repoPathsOverlap(scope, path));

    return {
      path,
      additions: Number(file.additions ?? 0),
      deletions: Number(file.deletions ?? 0),
      risk: outsideScope ? 'high' : risk.risk,
      reason: outsideScope ? 'Outside declared Jules write scope.' : risk.reason,
    };
  });
  const riskReasons = new Set<string>();
  const outOfScopeFiles = files
    .filter(file => file.reason === 'Outside declared Jules write scope.')
    .map(file => file.path);

  for (const file of files) {
    if (file.reason) riskReasons.add(file.reason);
  }

  if (outOfScopeFiles.length > 0) {
    // Expected files are the operator's lightweight contract with Jules. If the
    // cloud PR edits outside that list, Symphony should flag it as a foreman
    // problem even when GitHub checks are green.
    riskReasons.add(`Out-of-scope files changed: ${outOfScopeFiles.length} file(s) outside declared Jules write scope.`);
  }

  if ((pr.changedFiles ?? files.length) >= 20) {
    riskReasons.add('Large PR: changed 20 or more files.');
  }

  if ((pr.additions ?? 0) + (pr.deletions ?? 0) >= 1500) {
    riskReasons.add('Large diff: 1,500 or more changed lines.');
  }

  const hasHigh = files.some(file => file.risk === 'high') || [...riskReasons].some(reason => reason.startsWith('Large PR'));
  const hasMedium = files.some(file => file.risk === 'medium') || riskReasons.size > 0;

  return {
    total: Number(pr.changedFiles ?? files.length),
    additions: Number(pr.additions ?? files.reduce((sum, file) => sum + file.additions, 0)),
    deletions: Number(pr.deletions ?? files.reduce((sum, file) => sum + file.deletions, 0)),
    risk: hasHigh ? 'high' : hasMedium ? 'medium' : 'low',
    riskReasons: [...riskReasons],
    scopeFiles,
    outOfScopeFiles: outOfScopeFiles.slice(0, 40),
    files: files.slice(0, 40),
  };
}

function normalizeRepoPath(path: string): string {
  return path
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

function repoPathsOverlap(scopePath: string, changedPath: string): boolean {
  const scope = normalizeRepoPath(scopePath);
  const changed = normalizeRepoPath(changedPath);

  if (!scope || !changed) return false;
  if (scope === changed) return true;

  // A scope can be either a file (`src/foo.ts`) or a directory/prefix
  // (`src/components/CharacterCreator`). Treat either side containing the other
  // at a path boundary as in-scope so directory scopes remain ergonomic.
  return changed.startsWith(`${scope}/`) || scope.startsWith(`${changed}/`);
}

function classifyPullRequestFileRisk(path: string): { risk: 'low' | 'medium' | 'high'; reason: string | null } {
  const normalized = path.replace(/\\/g, '/');

  // These checks are intentionally conservative. The point is not to reject
  // Jules work automatically; it is to tell the foreman and human operator which
  // files deserve extra review before merging or pulling cloud changes locally.
  if (/^(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(normalized)) {
    return { risk: 'high', reason: 'Lockfile changed.' };
  }

  if (/^(dist|build|coverage)\//.test(normalized) || /\.tsbuildinfo$/.test(normalized)) {
    return { risk: 'high', reason: 'Generated/build artifact changed.' };
  }

  if (/^(package\.json|tsconfig[^/]*\.json|vite\.config\.)/.test(normalized)) {
    return { risk: 'medium', reason: 'Project configuration changed.' };
  }

  if (/\/?index\.(ts|tsx|js|jsx)$/.test(normalized)) {
    return { risk: 'medium', reason: 'Registry/index file changed.' };
  }

  if (/^(src\/data|src\/state|src\/hooks|src\/systems)\//.test(normalized)) {
    return { risk: 'medium', reason: 'Shared application surface changed.' };
  }

  return { risk: 'low', reason: null };
}
