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
  taskMessages: TaskMessage[];
  taskClarifications: TaskClarification[];
  taskDisposition: TaskDisposition | null;
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

export interface TaskMessage {
  id: string;
  taskId: string;
  taskKind: 'draft' | 'handoff';
  author: 'operator' | 'codex_foreman';
  body: string;
  createdAt: string;
  source: 'task_chat';
  mutatesExternalSystems: false;
  mutatesLocalFiles: false;
  mutatesGit: false;
}

export interface TaskMessageInput {
  author?: 'operator' | 'codex_foreman' | string;
  body?: string;
}

export interface TaskClarification {
  id: string;
  taskId: string;
  taskKind: 'draft' | 'handoff';
  status: 'waiting_for_operator' | 'answered';
  question: string;
  answer: string | null;
  requestedBy: 'codex_foreman';
  answeredBy: 'operator' | null;
  createdAt: string;
  answeredAt: string | null;
  source: 'foreman_clarification';
  mutatesExternalSystems: false;
  mutatesLocalFiles: false;
  mutatesGit: false;
}

export interface TaskClarificationInput {
  question?: string;
  answer?: string;
}

export type TaskDispositionState = 'active' | 'completed' | 'archived' | 'abandoned';

export interface TaskDisposition {
  taskId: string;
  taskKind: 'draft' | 'handoff';
  state: TaskDispositionState;
  reason: string;
  recordedAt: string;
  recordedBy: 'operator' | 'codex_foreman';
  mutatesExternalSystems: false;
  mutatesLocalFiles: false;
  mutatesGit: false;
}

export interface TaskDispositionInput {
  state?: TaskDispositionState | string;
  reason?: string;
  recordedBy?: 'operator' | 'codex_foreman' | string;
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
  operatorPreferences: OperatorPreferences;
}

export interface OperatorPreferences {
  quietHours: OperatorQuietHoursPreference;
  mutatesExternalSystems: false;
  mutatesLocalFiles: false;
  mutatesGit: false;
}

export interface OperatorPreferencesInput {
  quietHours?: Partial<OperatorQuietHoursPreference>;
}

export interface OperatorQuietHoursPreference {
  enabled: boolean;
  timeZone: string;
  startHour: number;
  endHour: number;
  weekdaysOnly: boolean;
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
  scopeKey?: string | null;
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

export type JulesHandoffTimelineStage =
  | 'task_created'
  | 'linear_issue'
  | 'jules_manifest'
  | 'jules_launch'
  | 'jules_plan_approval'
  | 'operator_message'
  | 'jules_status_refresh'
  | 'github_pr_refresh'
  | 'task_nudge'
  | 'repair_decision'
  | 'operator_answer'
  | 'repair_lane_execution'
  | 'repair_push_readiness'
  | 'repair_push_result'
  | 'delegation_roi'
  | 'deployment_evidence'
  | 'local_sync';

export interface JulesHandoffTimelineEvent {
  id: string;
  stage: JulesHandoffTimelineStage;
  label: string;
  occurredAt: string;
  sortKey: string;
  status: 'complete' | 'blocked' | 'waiting' | 'recorded';
  detail: string;
  source: 'symphony' | 'linear' | 'jules' | 'github' | 'operator' | 'roi';
  url: string | null;
  mutatesExternalSystems: false;
  mutatesLocalFiles: false;
}

export interface JulesHandoffTimeline {
  handoffId: string;
  title: string;
  generatedAt: string;
  summary: string;
  nextExpectedProof: string;
  mutatesExternalSystems: false;
  mutatesLocalFiles: false;
  events: JulesHandoffTimelineEvent[];
}

export interface JulesStateReconciliation {
  handoffId: string;
  title: string;
  generatedAt: string;
  status:
    | 'consistent'
    | 'waiting_for_pr'
    | 'reconciled_from_external_evidence'
    | 'needs_browser_reconciliation';
  storedJulesState: string | null;
  sessionId: string | null;
  sessionUrl: string | null;
  capturedPullRequestUrl: string | null;
  discoverySource: PullRequestDiscoveryReceipt['source'] | null;
  discoveryStatus: PullRequestDiscoveryReceipt['status'] | null;
  matchedBy: string[];
  localStoredStateIncomplete: boolean;
  requiresBrowserCheck: boolean;
  summary: string;
  nextExpectedProof: string;
  mutatesExternalSystems: false;
  mutatesLocalFiles: false;
}

export interface HandoffOperatorQuestion {
  handoffId: string;
  title: string;
  status: 'waiting_for_operator';
  generatedAt: string;
  plainLanguageQuestion: string;
  plainLanguageSummary: string;
  requestedAction: string;
  sourceStage: 'repair_decision' | 'repair_push_approval';
  canNotifyNow: boolean;
  nextCheckAt: string | null;
  quietHours: HandoffQuietHours;
  mutatesExternalSystems: false;
  mutatesLocalFiles: false;
}

export interface HandoffQuietHours {
  timeZone: string;
  policy: string;
  localTime: string;
  appliesNow: boolean;
  nextCheckAt: string | null;
  summary: string;
}

export type OperatorAnswerAction =
  | 'create_setup_repair_task'
  | 'send_jules_feedback'
  | 'wait_for_manual_repair'
  | 'refresh_after_repair'
  | 'approve_repair_push'
  | 'reject_repair_push'
  | 'other';

export interface HandoffOperatorAnswerInput {
  selectedAction?: OperatorAnswerAction | string | null;
  answer?: string | null;
  answeredBy?: 'operator' | 'codex_foreman' | string | null;
}

export interface HandoffOperatorAnswer {
  id: string;
  handoffId: string;
  selectedAction: OperatorAnswerAction;
  answer: string;
  answeredBy: 'operator' | 'codex_foreman';
  answeredAt: string;
  sourceQuestion: string | null;
  sourceStage: HandoffOperatorQuestion['sourceStage'] | null;
  mutatesExternalSystems: false;
  mutatesLocalFiles: false;
}

export interface HandoffRepairLaneExecution {
  id: string;
  handoffId: string;
  selectedAction: OperatorAnswerAction;
  status: 'local_draft_created';
  createdAt: string;
  createdDraftId: string | null;
  summary: string;
  mutatesExternalSystems: false;
  mutatesLocalFiles: false;
}

export interface HandoffRepairPushReadinessInput {
  source?: 'local_commit' | string | null;
  worktreePath?: string | null;
  branch?: string | null;
  commit?: string | null;
  repairBaseCommit?: string | null;
  targetPullRequestHeadCommit?: string | null;
  targetPullRequestUrl?: string | null;
  changedFiles?: string[] | null;
  verificationCommands?: string[] | null;
  verificationSummary?: string | null;
}

export interface HandoffRepairPostPushFollowUp {
  status: 'waiting_for_operator_push';
  expectedSequence: [
    'operator_pushes_repair',
    'github_checks_rerun',
    'symphony_refreshes_pr',
    'scout_core_readiness_updates',
  ];
  checksCommand: string;
  refreshEndpoint: string;
  scoutCoreReadinessEndpoint: string;
  mutatesExternalSystems: false;
  mutatesLocalFiles: false;
  summary: string;
}

export interface HandoffRepairPushReadiness {
  handoffId: string;
  status: 'awaiting_operator_push_approval';
  source: 'local_commit';
  recordedAt: string;
  worktreePath: string;
  branch: string;
  commit: string;
  repairBaseCommit: string | null;
  targetPullRequestHeadCommit: string | null;
  freshnessStatus: 'matches_current_pr_head' | 'stale_pr_head' | 'unchecked';
  isBasedOnCurrentPullRequestHead: boolean | null;
  freshnessSummary: string;
  targetPullRequestUrl: string | null;
  changedFiles: string[];
  verificationCommands: string[];
  verificationSummary: string;
  pushCommand: string;
  worktreeQualifiedPushCommand: string;
  canPushNow: false;
  mutatesExternalSystemsIfRun: true;
  mutatesLocalFiles: false;
  postPushFollowUp: HandoffRepairPostPushFollowUp;
  nextExpectedProof: string;
  summary: string;
}

export interface HandoffRepairPushResultInput {
  status?: 'pushed' | 'failed' | string | null;
  pushedCommit?: string | null;
  targetPullRequestHeadCommit?: string | null;
  pushedAt?: string | null;
  pushedBy?: 'operator' | 'codex_foreman' | string | null;
  evidenceUrl?: string | null;
  summary?: string | null;
}

export interface HandoffRepairPushResult {
  handoffId: string;
  status: 'pushed' | 'failed';
  pushedCommit: string | null;
  targetPullRequestHeadCommit: string | null;
  pushedAt: string;
  recordedAt: string;
  pushedBy: 'operator' | 'codex_foreman';
  evidenceUrl: string | null;
  summary: string;
  checksCommand: string;
  refreshEndpoint: string;
  nextBoundary: 'github_checks_rerun' | 'repair_push_failed';
  nextExpectedProof: string;
  mutatesExternalSystems: false;
  mutatesLocalFiles: false;
}

export interface HandoffDeploymentEvidenceInput {
  status?: 'passed' | 'failed' | 'waived' | string | null;
  source?: 'github_pages_latest_build' | 'github_deployment_status' | 'operator_waiver' | string | null;
  evidenceUrl?: string | null;
  summary?: string | null;
  checkedAt?: string | null;
  recordedBy?: 'operator' | 'codex_foreman' | string | null;
}

export interface HandoffDeploymentEvidence {
  handoffId: string;
  status: 'passed' | 'failed' | 'waived';
  source: 'github_pages_latest_build' | 'github_deployment_status' | 'operator_waiver';
  evidenceUrl: string | null;
  summary: string;
  checkedAt: string;
  recordedAt: string;
  recordedBy: 'operator' | 'codex_foreman';
  mutatesExternalSystems: false;
  mutatesLocalFiles: false;
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
  githubPullRequestRepairDecision: PullRequestRepairDecisionPacket | null;
  delegationRoiForemanUsage: DelegationRoiForemanUsage[];
  delegationRoiEstimate: DelegationRoiEstimate | null;
  delegationRoiLedger: DelegationRoiLedger | null;
  handoffTimeline: JulesHandoffTimeline | null;
  julesStateReconciliation: JulesStateReconciliation | null;
  operatorQuestion: HandoffOperatorQuestion | null;
  operatorAnswers: HandoffOperatorAnswer[];
  repairLaneExecutions: HandoffRepairLaneExecution[];
  repairPushReadiness: HandoffRepairPushReadiness | null;
  repairPushResult: HandoffRepairPushResult | null;
  deploymentEvidence: HandoffDeploymentEvidence | null;
  githubPullRequestDiscovery?: PullRequestDiscoveryReceipt | null;
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
  taskMessages: TaskMessage[];
  taskClarifications: TaskClarification[];
  taskDisposition: TaskDisposition | null;
}

export interface HandoffBaseCommitDrift {
  detectedAt: string;
  remoteBranch: string;
  stagedRemoteCommit: string | null;
  currentRemoteCommit: string | null;
  phase: 'pre_launch' | 'post_launch';
  requiredAction: 'restage_before_launch' | 'send_post_launch_update';
  updateChannels: string[];
  nextExpectedProof: string;
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
    | 'publish_or_merge_current_branch'
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
    if ((input.ahead ?? 0) > 0 || (input.behind ?? 0) > 0) {
      return {
        code: 'publish_or_merge_current_branch',
        tone: 'blocked',
        label: 'Publish or merge current branch',
        command: null,
        summary: `Symphony is on ${input.currentBranch || 'a detached branch'}, and that checkout does not yet match ${input.remoteBranch}. Jules must start from the GitHub base commit.`,
        steps: [
          'Publish the current branch and merge the intended handoff base to GitHub, or switch to a checkout that already matches GitHub.',
          'Do not push unrelated local master commits just to clear this gate.',
          'Re-run Check GitHub Sync after GitHub has the intended base commit.',
        ],
      };
    }

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
  currentBranchCanStandInForBase?: boolean;
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

  if (input.currentBranch !== input.baseBranch && !input.currentBranchCanStandInForBase) {
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
  updatedAt?: string | null;
  checks: PullRequestCheckSummary | null;
  files: Pick<PullRequestFileSummary, 'risk' | 'riskReasons' | 'outOfScopeFiles'> | null;
  feedback?: Pick<PullRequestFeedbackSummary, 'julesFeedback'> | null;
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

  // Marked Jules feedback is the visible proof that the operator already chose
  // the external repair lane. A PR update after that comment means Jules may
  // have responded; without that update, the safe next action is to wait and
  // refresh rather than presenting another duplicate feedback command.
  const latestJulesFeedbackAt = latestTimestamp(input.feedback?.julesFeedback.map(comment => comment.createdAt) ?? []);
  const pullRequestUpdatedAt = parseTimestamp(input.updatedAt);
  const postFeedbackRepairWindowMs = 60_000;
  const hasJulesFeedbackWaitingForRepair = latestJulesFeedbackAt !== null
    && (pullRequestUpdatedAt === null || pullRequestUpdatedAt <= latestJulesFeedbackAt + postFeedbackRepairWindowMs);

  if (input.checks?.conclusion === 'failing') {
    const primaryBlocker = input.checks.blockers?.[0] ?? null;

    // Once a marked Jules feedback comment exists, the human has already chosen
    // the external repair lane. Keep the dashboard on a wait-and-refresh path so
    // it does not ask for the same operator decision again before Jules has had
    // a chance to push a repair commit.
    if (hasJulesFeedbackWaitingForRepair) {
      return action('wait_for_checks', 'waiting', 'Wait for Jules Repair', null, null, input.refreshPullRequestUrl,
        'Jules feedback is already posted on the PR; wait for Jules to push a repair or for GitHub checks to change.',
        ['Wait for a new Jules commit or status update.', 'Refresh PR checks after Jules pushes a repair.', 'Do not send duplicate Jules feedback unless the next refresh shows no progress.']);
    }

    if (primaryBlocker?.category === 'workflow_setup') {
      return action('repair_failed_checks', 'blocked', 'Resolve CI Setup Blocker', input.scoutReviewCommand, input.julesFeedbackCommand ?? null, input.refreshPullRequestUrl,
        primaryBlocker.summary,
        ['Inspect failed check logs.', primaryBlocker.nextAction, 'Fix or route the shared setup blocker before judging Jules implementation quality.', 'Refresh PR checks after repair.']);
    }

    if (primaryBlocker?.category === 'workflow_config') {
      return action('repair_failed_checks', 'blocked', 'Resolve Workflow Config Blocker', input.scoutReviewCommand, input.julesFeedbackCommand ?? null, input.refreshPullRequestUrl,
        primaryBlocker.summary,
        ['Inspect the failed automation logs.', primaryBlocker.nextAction, 'Fix or route the workflow configuration before asking Jules to change task code.', 'Refresh PR checks after repair.']);
    }

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
    if (hasJulesFeedbackWaitingForRepair) {
      return action('wait_for_checks', 'waiting', 'Wait for Jules Repair', null, null, input.refreshPullRequestUrl,
        'Scout feedback is already posted on the PR; wait for Jules to push a repair or for the PR to change.',
        ['Wait for a new Jules commit or status update.', 'Refresh PR checks and Scout/Core readiness after Jules pushes a repair.', 'Do not send duplicate Scout feedback unless the next refresh shows new PR activity.']);
    }

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

function latestTimestamp(values: Array<string | null | undefined>): number | null {
  // PR comments and GitHub PR metadata arrive as optional ISO timestamps. The
  // dashboard only needs the newest valid moment so it can tell "waiting for a
  // Jules repair" apart from "a repair arrived and still failed."
  const parsed = values
    .map(value => parseTimestamp(value))
    .filter((value): value is number => value !== null);
  return parsed.length > 0 ? Math.max(...parsed) : null;
}

function parseTimestamp(value: string | null | undefined): number | null {
  // Invalid or missing timestamps should never unlock a risky next action. When
  // GitHub does not provide usable timing, Symphony keeps the older wait state
  // instead of inventing progress.
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildPullRequestRepairDecision(input: {
  handoffId: string;
  checks: PullRequestCheckSummary | null;
  nextAction: PullRequestNextAction | null;
  julesFeedbackCommand: string | null;
  refreshPullRequestUrl: string | null;
  generatedAt?: string;
}): PullRequestRepairDecisionPacket | null {
  const blocker = input.checks?.blockers?.[0] ?? null;
  if (!blocker || input.nextAction?.code !== 'repair_failed_checks') return null;

  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const refreshOption: PullRequestRepairDecisionOption = {
    id: 'refresh_after_repair',
    label: 'Refresh After Repair',
    description: 'Read the PR again after a human, Jules, or a separate repair task changes the failing branch or workflow.',
    whenToUse: 'Use this only after a repair has landed or GitHub has rerun the checks.',
    command: input.refreshPullRequestUrl,
    requiresOperatorApproval: true,
    mutatesExternalSystemsIfRun: false,
    mutatesLocalFilesIfRun: false,
  };
  const waitOption: PullRequestRepairDecisionOption = {
    id: 'wait_for_manual_repair',
    label: 'Wait For Manual Repair',
    description: 'Keep the task blocked and show the operator what proof is needed next.',
    whenToUse: 'Use this when the operator will fix the dependency or workflow state outside Symphony first.',
    command: null,
    requiresOperatorApproval: true,
    mutatesExternalSystemsIfRun: false,
    mutatesLocalFilesIfRun: false,
  };

  if (blocker.category === 'workflow_setup') {
    // A shared setup failure is an operator routing decision, not automatic
    // Jules feedback. This packet keeps all available paths visible while
    // preserving the rule that Symphony must not mutate GitHub or local files
    // just to explain a blocker.
    return {
      status: 'needs_operator_decision',
      category: blocker.category,
      handoffId: input.handoffId,
      generatedAt,
      mutatesExternalSystems: false,
      mutatesLocalFiles: false,
      question: 'The PR checks failed during shared dependency setup. Should Symphony create a separate setup repair task, send Jules feedback, or wait for a manual dependency repair?',
      plainLanguageSummary: blocker.summary,
      evidence: blocker.evidence,
      recommendedFirstStep: 'Inspect the failed GitHub check logs and confirm whether the package lockfile, workflow runtime, or Jules branch caused the install failure.',
      options: [
        {
          id: 'create_setup_repair_task',
          label: 'Create Setup Repair Task',
          description: 'Track the dependency-lock or install-environment repair as its own bounded task before judging Jules code.',
          whenToUse: 'Use this when the logs show npm install or npm ci fails before tests can run.',
          command: null,
          requiresOperatorApproval: true,
          mutatesExternalSystemsIfRun: true,
          mutatesLocalFilesIfRun: false,
        },
        {
          id: 'send_jules_feedback',
          label: 'Send Jules Feedback',
          description: 'Post an explicit [Jules feedback] PR comment that asks Jules to repair the branch.',
          whenToUse: 'Use this only if the setup failure belongs to Jules changes in the PR branch, not to the shared base or workflow config.',
          command: input.julesFeedbackCommand,
          requiresOperatorApproval: true,
          mutatesExternalSystemsIfRun: true,
          mutatesLocalFilesIfRun: false,
        },
        waitOption,
        refreshOption,
      ],
      nextExpectedProof: 'A chosen repair lane, then a refreshed PR check packet showing whether setup now passes.',
    };
  }

  if (blocker.category === 'workflow_config') {
    return {
      status: 'needs_operator_decision',
      category: blocker.category,
      handoffId: input.handoffId,
      generatedAt,
      mutatesExternalSystems: false,
      mutatesLocalFiles: false,
      question: 'A workflow or review automation check failed. Should Symphony route a workflow-config repair before asking Jules to change task code?',
      plainLanguageSummary: blocker.summary,
      evidence: blocker.evidence,
      recommendedFirstStep: 'Inspect the workflow configuration and failed automation logs before sending implementation feedback.',
      options: [
        {
          id: 'fix_workflow_config',
          label: 'Fix Workflow Config',
          description: 'Create or run a separate workflow-configuration repair task.',
          whenToUse: 'Use this when the failed check names or logs point at CI/review configuration rather than task code.',
          command: null,
          requiresOperatorApproval: true,
          mutatesExternalSystemsIfRun: true,
          mutatesLocalFilesIfRun: true,
        },
        waitOption,
        refreshOption,
      ],
      nextExpectedProof: 'A workflow-config repair proof, then a refreshed PR check packet.',
    };
  }

  return {
    status: 'needs_operator_decision',
    category: blocker.category,
    handoffId: input.handoffId,
    generatedAt,
    mutatesExternalSystems: false,
    mutatesLocalFiles: false,
    question: 'GitHub checks are failing. Should the repair go to Jules, a local setup task, or a workflow configuration task?',
    plainLanguageSummary: blocker.summary,
    evidence: blocker.evidence,
    recommendedFirstStep: 'Inspect failed check logs and choose the smallest repair lane that matches the evidence.',
    options: [
      {
        id: 'send_jules_feedback',
        label: 'Send Jules Feedback',
        description: 'Post an explicit [Jules feedback] PR comment that asks Jules to repair the implementation.',
        whenToUse: 'Use this when logs show a failure in the files Jules changed or in the requested test behavior.',
        command: input.julesFeedbackCommand,
        requiresOperatorApproval: true,
        mutatesExternalSystemsIfRun: true,
        mutatesLocalFilesIfRun: false,
      },
      {
        id: 'create_setup_repair_task',
        label: 'Create Setup Repair Task',
        description: 'Track a setup/dependency repair separately.',
        whenToUse: 'Use this when checks fail before the implementation or tests run.',
        command: null,
        requiresOperatorApproval: true,
        mutatesExternalSystemsIfRun: true,
        mutatesLocalFilesIfRun: false,
      },
      waitOption,
      refreshOption,
    ],
    nextExpectedProof: 'A chosen repair lane, then a refreshed PR check packet.',
  };
}

export function buildDelegationRoiLedger(input: {
  handoff: Partial<JulesHandoff>;
  taskNudges?: Array<Partial<TaskNudgeRecord>>;
  codexUsage?: DelegationRoiCodexUsageInput | null;
  generatedAt?: string;
}): DelegationRoiLedger {
  const handoff = input.handoff;
  const handoffId = typeof handoff.id === 'string' ? handoff.id : 'unknown-handoff';
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const relatedNudges = (input.taskNudges ?? []).filter(record => record.subjectId === handoffId);
  const codexUsage = normalizeDelegationRoiCodexUsage(input.codexUsage ?? null);
  const taskScopedForemanUsage = aggregateDelegationRoiForemanUsage(handoff.delegationRoiForemanUsage, handoffId);
  const goalContextForemanUsage = aggregateDelegationRoiGoalContextUsage(handoff.delegationRoiForemanUsage, handoffId);
  const repairDecision = handoff.githubPullRequestRepairDecision as Partial<PullRequestRepairDecisionPacket> | null | undefined;
  const checkBlocker = handoff.githubPullRequestChecks?.blockers?.[0] ?? null;
  const delegatedToJules = handoff.executor === 'jules' || Boolean(handoff.julesSessionId);
  const julesProducedPullRequest = typeof handoff.githubPullRequestUrl === 'string' && handoff.githubPullRequestUrl.length > 0;
  const outOfScopeFiles = Array.isArray(handoff.githubPullRequestFiles?.outOfScopeFiles)
    ? handoff.githubPullRequestFiles.outOfScopeFiles
    : [];
  const prStayedWithinDeclaredScope = handoff.githubPullRequestFiles
    ? outOfScopeFiles.length === 0
    : null;
  const humanInterventionCount = (Array.isArray(handoff.operatorMessages) ? handoff.operatorMessages.length : 0)
    + (Array.isArray(handoff.planApprovals) ? handoff.planApprovals.length : 0)
    + (repairDecision?.status === 'needs_operator_decision' ? 1 : 0);
  const julesElapsedSeconds = secondsBetween(
    typeof handoff.launchedAt === 'string' ? handoff.launchedAt : null,
    typeof handoff.lastStatusRefreshAt === 'string' ? handoff.lastStatusRefreshAt : null,
  );
  const githubElapsedSeconds = secondsBetween(
    typeof handoff.lastStatusRefreshAt === 'string' ? handoff.lastStatusRefreshAt : null,
    typeof handoff.lastPullRequestRefreshAt === 'string' ? handoff.lastPullRequestRefreshAt : null,
  );
  const stalledBecause = classifyDelegationRoiStall(checkBlocker);
  // Codex spend is the measured side of the ROI ledger. It may come from the
  // live dashboard totals, a worker roster, or retained usage events, but it is
  // never estimated here; if no measured source exists, the ledger says missing.
  const measuredFacts: DelegationRoiMeasuredFacts = {
    codexTokens: {
      input: codexUsage?.inputTokens ?? null,
      output: codexUsage?.outputTokens ?? null,
      total: codexUsage?.totalTokens ?? null,
      source: codexUsage?.source ?? 'missing',
    },
    taskScopedForemanUsage,
    goalContextForemanUsage,
    codexActiveRuntimeSeconds: codexUsage?.secondsRunning ?? null,
    codexForemanEventCount: relatedNudges.length,
    julesElapsedSeconds,
    githubElapsedSeconds,
    humanInterventionCount,
    localCodexEditedProductionFiles: null,
    dataSources: [
      'task_handoff_record',
      ...(codexUsage ? [codexUsage.source] : []),
      ...(taskScopedForemanUsage.receiptCount ? ['task_scoped_foreman_usage'] : []),
      ...(goalContextForemanUsage.receiptCount ? ['goal_context_foreman_usage'] : []),
      ...(relatedNudges.length ? ['task_nudge_records'] : []),
      ...(julesProducedPullRequest ? ['github_pr_refresh'] : []),
    ],
  };
  const missingAvoidedWorkEstimate: DelegationRoiEstimate = {
    status: 'missing_estimate',
    estimatedLocalCodexImplementationTurns: null,
    estimatedLocalCodexTokens: null,
    estimatedDebuggingCycles: null,
    confidence: 'missing',
    method: null,
    caveats: [
      'No avoided-work estimate has been recorded for this task yet.',
      'Do not treat Jules PR creation as measured Codex savings by itself.',
    ],
  };
  const estimatedAvoidedCodexWork = handoff.delegationRoiEstimate?.status === 'documented_estimate'
    ? handoff.delegationRoiEstimate
    : missingAvoidedWorkEstimate;
  const workflowValueSignals: DelegationRoiWorkflowSignals = {
    delegatedToJules,
    julesProducedPullRequest,
    prStayedWithinDeclaredScope,
    codexAvoidedLocalImplementation: delegatedToJules && julesProducedPullRequest ? true : null,
    humanInterventionsNeeded: humanInterventionCount,
    stalledBecause,
    pullRequestUrl: typeof handoff.githubPullRequestUrl === 'string' ? handoff.githubPullRequestUrl : null,
  };
  const hasMeasuredCodexSpend = typeof measuredFacts.codexTokens.total === 'number'
    || typeof measuredFacts.taskScopedForemanUsage.totalTokens === 'number';
  const hasAvoidedWorkEstimate = estimatedAvoidedCodexWork.status === 'documented_estimate';
  const status: DelegationRoiLedger['status'] = delegatedToJules
    ? hasMeasuredCodexSpend && hasAvoidedWorkEstimate
      ? 'candidate_savings'
      : 'roi_unknown'
    : 'not_delegated';

  // The verdict is deliberately conservative. A Jules PR is useful evidence,
  // but the operator asked for real usage savings, so missing Codex spend or
  // missing avoided-work estimates keep the result at ROI unknown.
  return {
    status,
    generatedAt,
    handoffId,
    summary: status === 'roi_unknown'
      ? 'Delegation ROI is unknown because measured task-scoped Codex spend or avoided-work estimates are incomplete.'
      : status === 'candidate_savings'
        ? 'Delegation may have saved Codex work; review measured facts and estimates before claiming savings.'
        : 'This task has not been delegated to Jules.',
    verdict: status === 'roi_unknown'
      ? 'ROI unknown: measured task-scoped Codex spend and a documented avoided-work estimate are both required before claiming Jules saved Codex usage.'
      : status === 'candidate_savings'
        ? 'Candidate savings: measured facts and estimates are both present, but estimates remain counterfactual.'
        : 'Not delegated: no Jules ROI can be calculated.',
    separatesMeasuredFactsFromEstimates: true,
    measuredFacts,
    estimatedAvoidedCodexWork,
    workflowValueSignals,
  };
}

export function buildJulesHandoffTimeline(
  handoff: Partial<JulesHandoff>,
  taskNudges: TaskNudgeRecord[] = []
): JulesHandoffTimeline {
  const handoffId = typeof handoff.id === 'string' ? handoff.id : 'unknown-handoff';
  const title = typeof handoff.title === 'string' ? handoff.title : 'Untitled Jules handoff';
  const fallbackTime = firstTimelineTime(handoff.createdAt, handoff.updatedAt, handoff.launchedAt)
    ?? new Date().toISOString();
  const events: JulesHandoffTimelineEvent[] = [];
  const addEvent = (input: Omit<JulesHandoffTimelineEvent, 'sortKey' | 'mutatesExternalSystems' | 'mutatesLocalFiles'>) => {
    const occurredAt = normalizeTimelineTime(input.occurredAt, fallbackTime);
    events.push({
      ...input,
      occurredAt,
      sortKey: `${occurredAt}|${String(TIMELINE_STAGE_ORDER[input.stage] ?? 99).padStart(2, '0')}|${input.id}`,
      mutatesExternalSystems: false,
      mutatesLocalFiles: false,
    });
  };

  // The timeline is a read-only human map of the handoff. It deliberately
  // derives from facts already stored on the handoff so the dashboard does not
  // gain a second workflow state that can drift away from the real records.
  addEvent({
    id: `${handoffId}:task-created`,
    stage: 'task_created',
    label: 'Task drafted',
    occurredAt: handoff.createdAt ?? fallbackTime,
    status: 'complete',
    detail: 'Symphony captured the task as a dashboard handoff record.',
    source: 'symphony',
    url: null,
  });

  if (handoff.linearIssueIdentifier || handoff.linearIssueUrl || handoff.linearIssueId) {
    addEvent({
      id: `${handoffId}:linear-issue`,
      stage: 'linear_issue',
      label: 'Linear issue linked',
      occurredAt: handoff.linearIssueCreatedAt ?? handoff.createdAt ?? fallbackTime,
      status: 'complete',
      detail: handoff.linearIssueIdentifier
        ? `Tracking issue ${handoff.linearIssueIdentifier} is linked.`
        : 'A Linear tracking issue is linked.',
      source: 'linear',
      url: handoff.linearIssueUrl ?? null,
    });
  }

  if (handoff.manifestPath) {
    addEvent({
      id: `${handoffId}:jules-manifest`,
      stage: 'jules_manifest',
      label: 'Jules manifest staged',
      occurredAt: handoff.linearIssueCreatedAt ?? handoff.createdAt ?? fallbackTime,
      status: 'complete',
      detail: `Manifest path: ${handoff.manifestPath}`,
      source: 'symphony',
      url: null,
    });
  }

  if (handoff.julesSessionId || handoff.julesSessionUrl || handoff.launchedAt) {
    addEvent({
      id: `${handoffId}:jules-launch`,
      stage: 'jules_launch',
      label: 'Jules session launched',
      occurredAt: handoff.launchedAt ?? handoff.updatedAt ?? fallbackTime,
      status: 'complete',
      detail: handoff.julesSessionId ? `Session ${handoff.julesSessionId}` : 'Jules launch receipt exists.',
      source: 'jules',
      url: handoff.julesSessionUrl ?? null,
    });
  }

  for (const approval of handoff.planApprovals ?? []) {
    addEvent({
      id: `${handoffId}:plan-approval:${approval.id}`,
      stage: 'jules_plan_approval',
      label: 'Jules plan approval recorded',
      occurredAt: approval.createdAt,
      status: approval.status === 'approved' ? 'complete' : 'blocked',
      detail: approval.status === 'approved' ? 'The operator approval was sent to Jules.' : approval.error ?? 'Plan approval failed.',
      source: 'operator',
      url: handoff.julesSessionUrl ?? null,
    });
  }

  for (const message of handoff.operatorMessages ?? []) {
    addEvent({
      id: `${handoffId}:operator-message:${message.id}`,
      stage: 'operator_message',
      label: 'Operator note sent',
      occurredAt: message.createdAt,
      status: message.status === 'sent' ? 'recorded' : 'blocked',
      detail: message.status === 'sent' ? message.body : message.error ?? 'Operator note failed.',
      source: 'operator',
      url: handoff.julesSessionUrl ?? null,
    });
  }

  if (handoff.lastStatusRefreshAt) {
    addEvent({
      id: `${handoffId}:jules-status-refresh`,
      stage: 'jules_status_refresh',
      label: 'Jules status refreshed',
      occurredAt: handoff.lastStatusRefreshAt,
      status: handoff.githubPullRequestUrl ? 'complete' : 'waiting',
      detail: handoff.julesState ? `Jules reported ${handoff.julesState}.` : 'Symphony refreshed the Jules session record.',
      source: 'jules',
      url: handoff.julesSessionUrl ?? null,
    });
  }

  if (handoff.githubPullRequestUrl || handoff.lastPullRequestRefreshAt || handoff.githubPullRequestChecks) {
    addEvent({
      id: `${handoffId}:github-pr-refresh`,
      stage: 'github_pr_refresh',
      label: 'GitHub PR refreshed',
      occurredAt: handoff.lastPullRequestRefreshAt ?? handoff.lastStatusRefreshAt ?? fallbackTime,
      status: handoff.githubPullRequestChecks?.conclusion === 'failing' ? 'blocked' : 'complete',
      detail: handoff.githubPullRequestChecks
        ? `Checks: ${handoff.githubPullRequestChecks.conclusion}.`
        : 'GitHub PR evidence is linked.',
      source: 'github',
      url: handoff.githubPullRequestUrl ?? null,
    });
  }

  for (const nudge of taskNudges.filter(record => record.subjectKind === 'handoff' && record.subjectId === handoffId)) {
    const nextNudgeDetail = nudge.nextNudgeAt
      ? ` Next check: ${nudge.nextNudgeAt} after ${nudge.pauseSeconds} second(s).`
      : ' No timed follow-up is scheduled.';
    const noteDetail = nudge.note ? ` Note: ${nudge.note}` : '';

    // Task nudges are the foreman's durable wake-up notes. Including them in
    // the task timeline lets the dashboard explain why a later read-only
    // refresh happened without treating the nudge as a Jules or GitHub action.
    addEvent({
      id: `${handoffId}:task-nudge:${nudge.id}`,
      stage: 'task_nudge',
      label: 'Task nudge recorded',
      occurredAt: nudge.createdAt,
      status: nudge.nextNudgeAt ? 'waiting' : 'recorded',
      detail: `${nudge.action} / ${nudge.phase}.${nextNudgeDetail}${noteDetail}`,
      source: 'symphony',
      url: null,
    });
  }

  if (handoff.githubPullRequestRepairDecision) {
    addEvent({
      id: `${handoffId}:repair-decision`,
      stage: 'repair_decision',
      label: 'Repair lane decision needed',
      occurredAt: handoff.lastPullRequestRefreshAt ?? handoff.updatedAt ?? fallbackTime,
      status: handoff.githubPullRequestRepairDecision.status === 'needs_operator_decision' ? 'blocked' : 'waiting',
      detail: handoff.githubPullRequestRepairDecision.nextExpectedProof,
      source: 'github',
      url: handoff.githubPullRequestUrl ?? null,
    });
  }

  for (const answer of handoff.operatorAnswers ?? []) {
    const label = answer.sourceStage === 'repair_push_approval'
      ? 'Repair push approval answer recorded'
      : 'Repair lane answer recorded';

    addEvent({
      id: `${handoffId}:operator-answer:${answer.id}`,
      stage: 'operator_answer',
      label,
      occurredAt: answer.answeredAt,
      status: 'recorded',
      detail: `${answer.selectedAction}: ${answer.answer}`,
      source: 'operator',
      url: null,
    });
  }

  for (const execution of handoff.repairLaneExecutions ?? []) {
    addEvent({
      id: `${handoffId}:repair-lane:${execution.id}`,
      stage: 'repair_lane_execution',
      label: 'Repair lane execution recorded',
      occurredAt: execution.createdAt,
      status: 'complete',
      detail: execution.summary,
      source: 'symphony',
      url: null,
    });
  }

  if (handoff.repairPushReadiness) {
    addEvent({
      id: `${handoffId}:repair-push-readiness`,
      stage: 'repair_push_readiness',
      label: 'Repair push readiness recorded',
      occurredAt: handoff.repairPushReadiness.recordedAt,
      status: handoff.repairPushReadiness.freshnessStatus === 'stale_pr_head' ? 'blocked' : 'waiting',
      detail: `${handoff.repairPushReadiness.summary} ${handoff.repairPushReadiness.freshnessSummary}`,
      source: 'symphony',
      url: handoff.repairPushReadiness.targetPullRequestUrl,
    });
  }

  if (handoff.repairPushResult) {
    addEvent({
      id: `${handoffId}:repair-push-result`,
      stage: 'repair_push_result',
      label: 'Repair push result recorded',
      occurredAt: handoff.repairPushResult.pushedAt,
      status: handoff.repairPushResult.status === 'pushed' ? 'complete' : 'blocked',
      detail: handoff.repairPushResult.summary,
      source: 'operator',
      url: handoff.repairPushResult.evidenceUrl,
    });
  }

  if (handoff.delegationRoiLedger) {
    addEvent({
      id: `${handoffId}:delegation-roi`,
      stage: 'delegation_roi',
      label: 'Delegation ROI ledger generated',
      occurredAt: handoff.delegationRoiLedger.generatedAt,
      status: handoff.delegationRoiLedger.status === 'candidate_savings' ? 'complete' : 'waiting',
      detail: handoff.delegationRoiLedger.verdict,
      source: 'roi',
      url: null,
    });
  }

  if (handoff.deploymentEvidence) {
    addEvent({
      id: `${handoffId}:deployment-evidence`,
      stage: 'deployment_evidence',
      label: 'Deployment evidence recorded',
      occurredAt: handoff.deploymentEvidence.checkedAt,
      status: handoff.deploymentEvidence.status === 'failed' ? 'blocked' : 'complete',
      detail: handoff.deploymentEvidence.summary,
      source: handoff.deploymentEvidence.source === 'operator_waiver' ? 'operator' : 'github',
      url: handoff.deploymentEvidence.evidenceUrl,
    });
  }

  if (handoff.lastLocalSyncAt || handoff.localSyncStatus) {
    addEvent({
      id: `${handoffId}:local-sync`,
      stage: 'local_sync',
      label: 'Local sync checked',
      occurredAt: handoff.lastLocalSyncAt ?? handoff.localSyncStatus?.checkedAt ?? fallbackTime,
      status: handoff.localSyncStatus?.upToDate ? 'complete' : 'waiting',
      detail: handoff.localSyncStatus?.summary ?? 'Local sync was checked.',
      source: 'github',
      url: handoff.githubPullRequestUrl ?? null,
    });
  }

  events.sort((left, right) => left.sortKey.localeCompare(right.sortKey));
  return {
    handoffId,
    title,
    generatedAt: new Date().toISOString(),
    summary: `${events.length} timeline event${events.length === 1 ? '' : 's'} recorded for this handoff.`,
    nextExpectedProof: buildTimelineNextExpectedProof(handoff),
    mutatesExternalSystems: false,
    mutatesLocalFiles: false,
    events,
  };
}

const TIMELINE_STAGE_ORDER: Record<JulesHandoffTimelineStage, number> = {
  task_created: 1,
  linear_issue: 2,
  jules_manifest: 3,
  jules_launch: 4,
  jules_plan_approval: 5,
  operator_message: 6,
  jules_status_refresh: 7,
  github_pr_refresh: 8,
  task_nudge: 9,
  repair_decision: 10,
  operator_answer: 11,
  repair_lane_execution: 12,
  repair_push_readiness: 13,
  repair_push_result: 14,
  delegation_roi: 15,
  deployment_evidence: 16,
  local_sync: 17,
};

function buildTimelineNextExpectedProof(handoff: Partial<JulesHandoff>): string {
  if (handoff.repairPushResult?.status === 'pushed') {
    return 'GitHub checks complete after the repair push, then Symphony refreshes PR state and Scout/Core readiness.';
  }
  if (handoff.repairPushResult?.status === 'failed') {
    return 'Operator resolves the failed push or records a replacement repair push readiness packet.';
  }
  if (handoff.repairPushReadiness) {
    return 'Operator approves or rejects the repair push, then records the push result before Symphony watches GitHub checks.';
  }
  if (handoff.repairLaneExecutions?.length) {
    return 'A verified local repair commit and repair push readiness packet.';
  }
  if (handoff.operatorAnswers?.length) {
    return 'Execute the selected repair lane or record why the selected lane is deferred.';
  }
  if (handoff.githubPullRequestRepairDecision?.status === 'needs_operator_decision') {
    return 'Operator chooses the repair lane, then Symphony refreshes the PR checks after that lane runs.';
  }
  if (handoff.githubPullRequestUrl && handoff.githubPullRequestState !== 'MERGED') {
    return 'A refreshed GitHub PR check packet, Scout/Core review result, or merged PR receipt.';
  }
  if (handoff.githubPullRequestState === 'MERGED' && !handoff.lastLocalSyncAt) {
    return 'A local sync readiness packet and fast-forward sync receipt.';
  }
  if (handoff.julesSessionId && !handoff.githubPullRequestUrl) {
    return 'A Jules status refresh that either finds the PR or records why none exists yet.';
  }
  if (handoff.manifestPath && !handoff.julesSessionId) {
    return 'A Jules launch receipt.';
  }
  if (handoff.linearIssueIdentifier && !handoff.manifestPath) {
    return 'A staged Jules manifest receipt.';
  }
  return 'The next Symphony handoff proof stage for this task.';
}

function firstTimelineTime(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && Number.isFinite(new Date(value).getTime())) {
      return value;
    }
  }
  return null;
}

function normalizeTimelineTime(value: string | null | undefined, fallback: string): string {
  if (typeof value === 'string' && Number.isFinite(new Date(value).getTime())) {
    return value;
  }
  return fallback;
}

export function buildHandoffOperatorQuestion(
  handoff: Partial<JulesHandoff>,
  options: { generatedAt?: string; operatorPreferences?: OperatorPreferencesInput | OperatorPreferences | null } = {}
): HandoffOperatorQuestion | null {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const operatorPreferences = normalizeOperatorPreferences(options.operatorPreferences ?? null);
  const quietHours = buildQuietHoursPacket(generatedAt, operatorPreferences.quietHours);
  const handoffId = typeof handoff.id === 'string' ? handoff.id : 'unknown-handoff';
  const title = typeof handoff.title === 'string' ? handoff.title : 'Untitled Jules handoff';
  const repairDecision = handoff.githubPullRequestRepairDecision;
  const repairPushReadiness = handoff.repairPushReadiness;

  // Operator questions are the dashboard-facing version of a blocker. When a
  // newer repair-push packet exists, it owns the current human decision even if
  // the older repair-lane packet remains on the handoff for audit history.
  if (repairPushReadiness && !handoff.repairPushResult) {
    return {
      handoffId,
      title,
      status: 'waiting_for_operator',
      generatedAt,
      plainLanguageQuestion: 'Do you approve pushing the prepared repair to the Jules PR?',
      plainLanguageSummary: `${repairPushReadiness.summary} ${repairPushReadiness.freshnessSummary}`,
      requestedAction: 'Approve the external push and record the push result, or reject this repair and prepare a replacement.',
      sourceStage: 'repair_push_approval',
      canNotifyNow: !quietHours.appliesNow,
      nextCheckAt: quietHours.nextCheckAt,
      quietHours,
      mutatesExternalSystems: false,
      mutatesLocalFiles: false,
    };
  }

  if (repairDecision?.status === 'needs_operator_decision') {
    return {
      handoffId,
      title,
      status: 'waiting_for_operator',
      generatedAt,
      plainLanguageQuestion: repairDecision.question,
      plainLanguageSummary: repairDecision.plainLanguageSummary,
      requestedAction: repairDecision.nextExpectedProof,
      sourceStage: 'repair_decision',
      canNotifyNow: !quietHours.appliesNow,
      nextCheckAt: quietHours.nextCheckAt,
      quietHours,
      mutatesExternalSystems: false,
      mutatesLocalFiles: false,
    };
  }

  return null;
}

function normalizeOperatorAnswer(
  handoff: JulesHandoff,
  input: HandoffOperatorAnswerInput
): HandoffOperatorAnswer {
  const answer = typeof input.answer === 'string' ? input.answer.trim().slice(0, 1200) : '';
  if (!answer) {
    throw new Error('Operator answer text is required.');
  }

  const selectedAction = normalizeOperatorAnswerAction(input.selectedAction);
  const answeredBy = input.answeredBy === 'codex_foreman' ? 'codex_foreman' : 'operator';
  const question = handoff.operatorQuestion ?? buildHandoffOperatorQuestion(handoff);

  // The answer is deliberately just a local receipt. It records the operator's
  // repair-lane or repair-push decision so later controls know what was
  // decided, but it does not create tasks, comment on PRs, send Jules feedback,
  // push to GitHub, or edit local files by itself.
  return {
    id: `operator-answer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    handoffId: handoff.id,
    selectedAction,
    answer,
    answeredBy,
    answeredAt: new Date().toISOString(),
    sourceQuestion: question?.plainLanguageQuestion ?? null,
    sourceStage: question?.sourceStage ?? null,
    mutatesExternalSystems: false,
    mutatesLocalFiles: false,
  };
}

function normalizeOperatorAnswerAction(value: HandoffOperatorAnswerInput['selectedAction']): OperatorAnswerAction {
  const action = typeof value === 'string' ? value.trim() : '';
  if (
    action === 'create_setup_repair_task'
    || action === 'send_jules_feedback'
    || action === 'wait_for_manual_repair'
    || action === 'refresh_after_repair'
    || action === 'approve_repair_push'
    || action === 'reject_repair_push'
  ) {
    return action;
  }
  return 'other';
}

function normalizeRepairPushReadiness(
  handoff: JulesHandoff,
  input: HandoffRepairPushReadinessInput
): HandoffRepairPushReadiness {
  const source = input.source === 'local_commit' || !input.source ? 'local_commit' : null;
  if (!source) {
    throw new Error(`Unsupported repair push readiness source: ${String(input.source)}`);
  }

  const worktreePath = trimRequiredString(input.worktreePath, 'Repair worktree path');
  const branch = trimRequiredString(input.branch, 'Repair branch');
  const commit = trimRequiredString(input.commit, 'Repair commit');
  const repairBaseCommit = typeof input.repairBaseCommit === 'string' && input.repairBaseCommit.trim()
    ? input.repairBaseCommit.trim()
    : null;
  const targetPullRequestHeadCommit = typeof input.targetPullRequestHeadCommit === 'string' && input.targetPullRequestHeadCommit.trim()
    ? input.targetPullRequestHeadCommit.trim()
    : null;
  const hasFreshnessPair = Boolean(repairBaseCommit && targetPullRequestHeadCommit);
  const isBasedOnCurrentPullRequestHead = hasFreshnessPair
    ? repairBaseCommit === targetPullRequestHeadCommit
    : null;
  const freshnessStatus = isBasedOnCurrentPullRequestHead === true
    ? 'matches_current_pr_head'
    : isBasedOnCurrentPullRequestHead === false
      ? 'stale_pr_head'
      : 'unchecked';
  const freshnessSummary = freshnessStatus === 'matches_current_pr_head'
    ? `Repair base ${repairBaseCommit} matches the current PR head ${targetPullRequestHeadCommit}.`
    : freshnessStatus === 'stale_pr_head'
      ? `Repair base ${repairBaseCommit} does not match current PR head ${targetPullRequestHeadCommit}; do not push this repair until it is rebased or regenerated.`
      : 'Repair base freshness was not checked against the current PR head.';
  const targetPullRequestUrl = typeof input.targetPullRequestUrl === 'string' && input.targetPullRequestUrl.trim()
    ? input.targetPullRequestUrl.trim()
    : handoff.githubPullRequestUrl ?? null;
  const changedFiles = uniqueStrings(input.changedFiles ?? []);
  if (!changedFiles.length) {
    throw new Error('At least one changed file is required for repair push readiness.');
  }

  const verificationCommands = uniqueStrings(input.verificationCommands ?? handoff.verificationCommands ?? []);
  const verificationSummary = typeof input.verificationSummary === 'string' && input.verificationSummary.trim()
    ? input.verificationSummary.trim().slice(0, 1200)
    : 'Local repair verification has not been summarized yet.';
  const recordedAt = new Date().toISOString();
  const remoteRef = handoff.githubPullRequestHeadRef?.trim() || branch;
  const pushCommand = remoteRef === branch
    ? `git push origin ${branch}`
    : `git push origin ${branch}:${remoteRef}`;
  const worktreeQualifiedPushCommand = qualifyGitCommandForWorktree(pushCommand, worktreePath);
  const targetLabel = targetPullRequestUrl ?? 'the tracked GitHub pull request';
  const pullRequestNumber = extractPullRequestNumber(targetPullRequestUrl);
  const repository = extractPullRequestRepository(targetPullRequestUrl);
  const pullRequestSelector = pullRequestNumber && repository
    ? `${pullRequestNumber} --repo ${repository}`
    : targetPullRequestUrl ?? '';
  const postPushFollowUp: HandoffRepairPostPushFollowUp = {
    status: 'waiting_for_operator_push',
    expectedSequence: [
      'operator_pushes_repair',
      'github_checks_rerun',
      'symphony_refreshes_pr',
      'scout_core_readiness_updates',
    ],
    checksCommand: pullRequestSelector ? `gh pr checks ${pullRequestSelector}` : 'gh pr checks <pull-request>',
    refreshEndpoint: `/api/v1/jules-handoffs/${encodeURIComponent(handoff.id)}/refresh-pr`,
    scoutCoreReadinessEndpoint: `/api/v1/task-drafts`,
    mutatesExternalSystems: false,
    mutatesLocalFiles: false,
    summary: 'After the operator pushes the repair, watch GitHub checks, refresh the Symphony PR packet, then let Scout/Core readiness update from the refreshed evidence.',
  };

  // The push-readiness packet keeps the dirty-worktree dilemma visible. A local
  // agent can prepare and verify a repair commit, but Symphony still marks the
  // GitHub update as operator-approved external mutation instead of quietly
  // treating it like another background dashboard refresh. The PR-head freshness
  // fields preserve the second safety question: is this repair still based on
  // the same PR revision that failed, or did the cloud branch move underneath it?
  // The post-push follow-up packet preserves the third safety question: once a
  // human pushes, what should Symphony observe next before it talks about
  // Scout/Core or merge readiness? The worktree-qualified command preserves the
  // fourth safety question: will the operator push from the exact repair
  // worktree instead of whichever directory their terminal currently uses?
  return {
    handoffId: handoff.id,
    status: 'awaiting_operator_push_approval',
    source,
    recordedAt,
    worktreePath,
    branch,
    commit,
    repairBaseCommit,
    targetPullRequestHeadCommit,
    freshnessStatus,
    isBasedOnCurrentPullRequestHead,
    freshnessSummary,
    targetPullRequestUrl,
    changedFiles,
    verificationCommands,
    verificationSummary,
    pushCommand,
    worktreeQualifiedPushCommand,
    canPushNow: false,
    mutatesExternalSystemsIfRun: true,
    mutatesLocalFiles: false,
    postPushFollowUp,
    nextExpectedProof: `Operator approves ${worktreeQualifiedPushCommand}; GitHub checks rerun for ${targetLabel} and Symphony records the refreshed check state.`,
    summary: `Local repair commit ${commit} on ${branch} is ready for operator-approved push to ${targetLabel}.`,
  };
}

function qualifyGitCommandForWorktree(command: string, worktreePath: string): string {
  if (!command.startsWith('git push ')) return command;
  const escapedPath = worktreePath.includes(' ') ? `"${worktreePath.replace(/"/g, '\\"')}"` : worktreePath;
  return `git -C ${escapedPath} ${command.slice('git '.length)}`;
}

function normalizeRepairPushResult(
  handoff: JulesHandoff,
  input: HandoffRepairPushResultInput
): HandoffRepairPushResult {
  const status = input.status === 'failed' ? 'failed' : 'pushed';
  const pushedCommit = typeof input.pushedCommit === 'string' && input.pushedCommit.trim()
    ? input.pushedCommit.trim()
    : handoff.repairPushReadiness?.commit ?? null;
  const targetPullRequestHeadCommit = typeof input.targetPullRequestHeadCommit === 'string' && input.targetPullRequestHeadCommit.trim()
    ? input.targetPullRequestHeadCommit.trim()
    : null;
  const pushedAt = typeof input.pushedAt === 'string' && Number.isFinite(new Date(input.pushedAt).getTime())
    ? input.pushedAt
    : new Date().toISOString();
  const recordedAt = new Date().toISOString();
  const pushedBy = input.pushedBy === 'codex_foreman' ? 'codex_foreman' : 'operator';
  const evidenceUrl = typeof input.evidenceUrl === 'string' && input.evidenceUrl.trim()
    ? input.evidenceUrl.trim()
    : handoff.githubPullRequestUrl;
  const summary = typeof input.summary === 'string' && input.summary.trim()
    ? input.summary.trim().slice(0, 1200)
    : status === 'pushed'
      ? 'Repair push was recorded locally. Wait for GitHub checks, then refresh Symphony.'
      : 'Repair push failed or was not completed. Keep the task in the repair boundary.';
  const prUrl = handoff.githubPullRequestUrl ?? evidenceUrl;
  const number = extractPullRequestNumber(prUrl);
  const repo = extractPullRequestRepository(prUrl);
  const pullRequestSelector = number && repo ? `${number} --repo ${repo}` : prUrl ?? '<pull-request>';

  // This is a receipt for an external action that already happened with human
  // approval. Recording it gives Symphony the next thing to watch, but this
  // function does not push, rerun checks, merge, comment, or pull local Git.
  return {
    handoffId: handoff.id,
    status,
    pushedCommit,
    targetPullRequestHeadCommit,
    pushedAt,
    recordedAt,
    pushedBy,
    evidenceUrl,
    summary,
    checksCommand: `gh pr checks ${pullRequestSelector}`,
    refreshEndpoint: `/api/v1/jules-handoffs/${encodeURIComponent(handoff.id)}/refresh-pr`,
    nextBoundary: status === 'pushed' ? 'github_checks_rerun' : 'repair_push_failed',
    nextExpectedProof: status === 'pushed'
      ? 'GitHub checks complete after the repair push, then Symphony refreshes PR state.'
      : 'Operator resolves the failed push or records a replacement repair push readiness packet.',
    mutatesExternalSystems: false,
    mutatesLocalFiles: false,
  };
}

function normalizeDeploymentEvidence(
  handoff: JulesHandoff,
  input: HandoffDeploymentEvidenceInput
): HandoffDeploymentEvidence {
  const status = normalizeDeploymentEvidenceStatus(input.status);
  const source = normalizeDeploymentEvidenceSource(input.source, status);
  const summary = typeof input.summary === 'string' ? input.summary.trim().slice(0, 1200) : '';
  if (!summary) {
    throw new Error('Deployment evidence summary is required.');
  }

  const checkedAt = typeof input.checkedAt === 'string' && Number.isFinite(new Date(input.checkedAt).getTime())
    ? input.checkedAt
    : new Date().toISOString();
  const evidenceUrl = typeof input.evidenceUrl === 'string' && input.evidenceUrl.trim()
    ? input.evidenceUrl.trim()
    : handoff.githubPullRequestUrl;
  const recordedBy = input.recordedBy === 'codex_foreman' ? 'codex_foreman' : 'operator';

  // This receipt is local proof only. It lets the dashboard remember whether
  // the deployment gate passed, failed, or was explicitly waived before local
  // sync, without itself calling GitHub Pages, rerunning Actions, or pulling Git.
  return {
    handoffId: handoff.id,
    status,
    source,
    evidenceUrl,
    summary,
    checkedAt,
    recordedAt: new Date().toISOString(),
    recordedBy,
    mutatesExternalSystems: false,
    mutatesLocalFiles: false,
  };
}

function normalizeDeploymentEvidenceStatus(value: HandoffDeploymentEvidenceInput['status']): HandoffDeploymentEvidence['status'] {
  if (value === 'passed' || value === 'failed' || value === 'waived') {
    return value;
  }
  throw new Error(`Unsupported deployment evidence status: ${String(value)}`);
}

function normalizeDeploymentEvidenceSource(
  value: HandoffDeploymentEvidenceInput['source'],
  status: HandoffDeploymentEvidence['status']
): HandoffDeploymentEvidence['source'] {
  if (value === 'github_pages_latest_build' || value === 'github_deployment_status' || value === 'operator_waiver') {
    return value;
  }
  if (status === 'waived') {
    return 'operator_waiver';
  }
  throw new Error(`Unsupported deployment evidence source: ${String(value)}`);
}

function trimRequiredString(value: unknown, label: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    throw new Error(`${label} is required.`);
  }
  return text;
}

function buildSetupRepairDraftFromHandoff(
  handoff: JulesHandoff,
  answer: HandoffOperatorAnswer,
  createdAt: string
): TaskDraft {
  const blocker = handoff.githubPullRequestChecks?.blockers?.[0] ?? null;
  const issue = handoff.linearIssueIdentifier || handoff.linearIssueId || handoff.id;
  const evidence = [
    ...(blocker?.evidence ?? []),
    ...(handoff.githubPullRequestRepairDecision?.evidence ?? []),
  ].filter(Boolean);

  // Setup repair drafts are the first safe execution of the chosen repair lane.
  // They keep the problem inside Symphony's normal draft queue so the operator
  // can review scope before any Linear/Jules/GitHub mutation happens.
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: `Setup repair for ${issue}`,
    body: [
      `Repair the setup/workflow blocker discovered while following Jules handoff ${handoff.id}.`,
      '',
      `Original task: ${handoff.title}`,
      handoff.githubPullRequestUrl ? `GitHub PR: ${handoff.githubPullRequestUrl}` : '',
      handoff.linearIssueUrl ? `Linear issue: ${handoff.linearIssueUrl}` : '',
      '',
      'Operator decision:',
      answer.answer,
      '',
      'Failure summary:',
      blocker?.summary || handoff.githubPullRequestRepairDecision?.plainLanguageSummary || 'Setup failed before task validation could run.',
      '',
      'Evidence:',
      ...(evidence.length ? evidence.map(item => `- ${item}`) : ['- No detailed check evidence was captured.']),
      '',
      'Keep this repair separate from Jules implementation feedback unless later evidence shows Jules changed the failing setup files.',
    ].filter(line => line !== '').join('\n'),
    expectedFiles: [
      'package-lock.json',
      'package.json',
      '.github/workflows/ci.yml',
      '.github/workflows/gemini-review.yml',
    ],
    verificationCommands: [
      'npm ci --no-audit --no-fund',
      'npm run build',
      'npm run verify:jules-contract --workspace conductor/symphony',
    ],
    taskMessages: [],
    taskClarifications: [],
    taskDisposition: null,
    executor: 'jules',
    status: 'draft',
    linearIssueId: null,
    linearIssueIdentifier: null,
    linearIssueUrl: null,
    linearIssueCreatedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}

export function normalizeOperatorPreferences(value: unknown): OperatorPreferences {
  const input = (typeof value === 'object' && value !== null ? value : {}) as Partial<OperatorPreferencesInput>;
  const quietInput = (typeof input.quietHours === 'object' && input.quietHours !== null ? input.quietHours : {}) as Partial<OperatorQuietHoursPreference>;
  const timeZone = normalizeTimeZone(quietInput.timeZone);
  const startHour = normalizeQuietHour(quietInput.startHour, 1);
  const endHour = normalizeQuietHour(quietInput.endHour, 9);

  // Preferences are local dashboard behavior. They tell a foreman when to wait
  // for the human; they never authorize Jules, GitHub, Linear, local files, or
  // Git mutation.
  return {
    quietHours: {
      enabled: quietInput.enabled === false ? false : true,
      timeZone,
      startHour,
      endHour,
      weekdaysOnly: quietInput.weekdaysOnly === false ? false : true,
    },
    mutatesExternalSystems: false,
    mutatesLocalFiles: false,
    mutatesGit: false,
  };
}

function buildQuietHoursPacket(
  generatedAt: string,
  preference: OperatorQuietHoursPreference = normalizeOperatorPreferences(null).quietHours
): HandoffQuietHours {
  const timeZone = preference.timeZone;
  const localParts = getLocalTimeParts(generatedAt, timeZone);
  const weekdayQuiet = preference.weekdaysOnly ? localParts.weekday >= 1 && localParts.weekday <= 5 : true;
  const hourQuiet = isWithinQuietHour(localParts.hour, preference.startHour, preference.endHour);
  const appliesNow = preference.enabled && weekdayQuiet && hourQuiet;
  const nextCheckAt = appliesNow ? findNextLocalHour(generatedAt, timeZone, preference.endHour) : null;
  const localTime = `${String(localParts.year).padStart(4, '0')}-${String(localParts.month).padStart(2, '0')}-${String(localParts.day).padStart(2, '0')} ${String(localParts.hour).padStart(2, '0')}:${String(localParts.minute).padStart(2, '0')} ${timeZone}`;
  const policy = preference.enabled
    ? `${preference.weekdaysOnly ? 'Weekday' : 'Daily'} quiet hours are ${String(preference.startHour).padStart(2, '0')}:00-${String(preference.endHour).padStart(2, '0')}:00 ${timeZone}.`
    : `Quiet hours are disabled for ${timeZone}.`;

  // This policy is intentionally a packet, not a scheduler. Symphony can show
  // when a foreman should check back, but it does not keep a hidden tight loop
  // running while the human input is unlikely to arrive.
  return {
    timeZone,
    policy,
    localTime,
    appliesNow,
    nextCheckAt,
    summary: !preference.enabled
      ? 'Quiet hours are disabled; the operator question can be shown now.'
      : appliesNow
      ? `Quiet hours are active; wait until ${nextCheckAt} before checking for operator input again.`
      : 'Quiet hours are not active; the operator question can be shown now.',
  };
}

function normalizeQuietHour(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(23, Math.max(0, numeric));
}

function normalizeTimeZone(value: unknown): string {
  const candidate = typeof value === 'string' && value.trim() ? value.trim() : 'Europe/Amsterdam';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return 'Europe/Amsterdam';
  }
}

function isWithinQuietHour(hour: number, startHour: number, endHour: number): boolean {
  if (startHour === endHour) return false;
  return startHour < endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour;
}

function getLocalTimeParts(isoTime: string, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
} {
  const date = new Date(isoTime);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
  const weekdayName = part('weekday');
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayName);

  return {
    year: Number(part('year')),
    month: Number(part('month')),
    day: Number(part('day')),
    hour: Number(part('hour')) % 24,
    minute: Number(part('minute')),
    weekday: weekday >= 0 ? weekday : date.getUTCDay(),
  };
}

function findNextLocalHour(isoTime: string, timeZone: string, targetHour: number): string {
  const start = Math.ceil(new Date(isoTime).getTime() / (60 * 1000)) * 60 * 1000;
  const oneMinute = 60 * 1000;

  // Time-zone conversion is delegated to Intl above. This bounded search avoids
  // hardcoding daylight-saving offsets and finds the next UTC instant that reads
  // as the requested local hour in the operator's time zone. The search uses
  // minute boundaries because a receipt can be recorded at 08:52:44; stepping in
  // larger chunks would skip the 09:00 wake-up point and produce a misleading
  // afternoon follow-up time.
  for (let offset = 0; offset <= 48 * 60 * 60 * 1000; offset += oneMinute) {
    const candidate = new Date(start + offset);
    const parts = getLocalTimeParts(candidate.toISOString(), timeZone);
    if (parts.hour === targetHour && parts.minute === 0) {
      return candidate.toISOString();
    }
  }

  return new Date(start + 8 * 60 * 60 * 1000).toISOString();
}

function classifyDelegationRoiStall(
  blocker: PullRequestCheckBlocker | null
): DelegationRoiWorkflowSignals['stalledBecause'] {
  if (!blocker) return 'none';
  if (blocker.category === 'workflow_setup') return 'ci_setup';
  if (blocker.category === 'workflow_config') return 'workflow_config';
  if (blocker.category === 'jules_implementation') return 'jules_implementation';
  return 'unknown';
}

function secondsBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) return null;
  return Math.round((endTime - startTime) / 1000);
}

function normalizeDelegationRoiCodexUsage(
  usage: DelegationRoiCodexUsageInput | null
): Required<DelegationRoiCodexUsageInput> | null {
  if (!usage) return null;
  const totalTokens = finiteNonNegativeNumber(usage.totalTokens);
  const inputTokens = finiteNonNegativeNumber(usage.inputTokens);
  const outputTokens = finiteNonNegativeNumber(usage.outputTokens);
  const secondsRunning = finiteNonNegativeNumber(usage.secondsRunning);

  // A usage source is only "measured" if it provides at least one concrete
  // spend/runtime value. Otherwise the ledger must stay explicit about missing
  // evidence instead of converting absent values into zeroes.
  if (totalTokens === null && inputTokens === null && outputTokens === null && secondsRunning === null) {
    return null;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    secondsRunning,
    source: usage.source,
  };
}

function finiteNonNegativeNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function aggregateDelegationRoiForemanUsage(
  value: unknown,
  handoffId: string
): DelegationRoiMeasuredFacts['taskScopedForemanUsage'] {
  const receipts = normalizeDelegationRoiForemanUsageList(value, handoffId)
    .filter(receipt => receipt.source !== 'codex_goal_context');
  const sumNullable = (field: keyof Pick<DelegationRoiForemanUsage, 'inputTokens' | 'outputTokens' | 'totalTokens' | 'activeRuntimeSeconds' | 'foremanTurns'>): number | null => {
    const numbers = receipts
      .map(receipt => receipt[field])
      .filter((amount): amount is number => typeof amount === 'number');
    return numbers.length ? numbers.reduce((total, amount) => total + amount, 0) : null;
  };

  // Task-scoped foreman usage is measured evidence entered for one handoff. It
  // complements the global dashboard Codex totals instead of replacing them,
  // because the global totals can include unrelated work in a long session.
  return {
    inputTokens: sumNullable('inputTokens'),
    outputTokens: sumNullable('outputTokens'),
    totalTokens: sumNullable('totalTokens'),
    activeRuntimeSeconds: sumNullable('activeRuntimeSeconds'),
    foremanTurns: sumNullable('foremanTurns'),
    source: receipts.length ? 'task_scoped_foreman_usage' : 'missing',
    receiptCount: receipts.length,
  };
}

function aggregateDelegationRoiGoalContextUsage(
  value: unknown,
  handoffId: string
): DelegationRoiMeasuredFacts['goalContextForemanUsage'] {
  const receipts = normalizeDelegationRoiForemanUsageList(value, handoffId)
    .filter(receipt => receipt.source === 'codex_goal_context');
  const sumNullable = (field: keyof Pick<DelegationRoiForemanUsage, 'inputTokens' | 'outputTokens' | 'totalTokens' | 'activeRuntimeSeconds' | 'foremanTurns'>): number | null => {
    const numbers = receipts
      .map(receipt => receipt[field])
      .filter((amount): amount is number => typeof amount === 'number');
    return numbers.length ? numbers.reduce((total, amount) => total + amount, 0) : null;
  };

  // Goal-context usage can document how much the whole Symphony goal has cost,
  // but it is broader than one task. Keeping it in its own bucket prevents a
  // long thread total from masquerading as task-level savings evidence.
  return {
    inputTokens: sumNullable('inputTokens'),
    outputTokens: sumNullable('outputTokens'),
    totalTokens: sumNullable('totalTokens'),
    activeRuntimeSeconds: sumNullable('activeRuntimeSeconds'),
    foremanTurns: sumNullable('foremanTurns'),
    source: receipts.length ? 'goal_context_foreman_usage' : 'missing',
    receiptCount: receipts.length,
  };
}

function normalizeDelegationRoiForemanUsageInput(
  handoffId: string,
  input: DelegationRoiForemanUsageInput
): DelegationRoiForemanUsage {
  const inputTokens = finiteNonNegativeNumber(input.inputTokens);
  const outputTokens = finiteNonNegativeNumber(input.outputTokens);
  const providedTotal = finiteNonNegativeNumber(input.totalTokens);
  const totalTokens = providedTotal ?? (
    typeof inputTokens === 'number' || typeof outputTokens === 'number'
      ? (inputTokens ?? 0) + (outputTokens ?? 0)
      : null
  );
  const activeRuntimeSeconds = finiteNonNegativeNumber(input.activeRuntimeSeconds);
  const foremanTurns = finiteNonNegativeNumber(input.foremanTurns);
  const notes = typeof input.notes === 'string' ? input.notes.trim().slice(0, 1200) : '';
  const source = input.source === 'codex_goal_context' || input.source === 'other_measured_source'
    ? input.source
    : 'manual_codex_receipt';
  const recordedBy = input.recordedBy === 'operator' ? 'operator' : 'codex_foreman';

  if (totalTokens === null && activeRuntimeSeconds === null && foremanTurns === null) {
    throw new Error('Record at least one measured foreman usage value.');
  }

  return {
    id: `foreman-usage-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    handoffId,
    source,
    inputTokens,
    outputTokens,
    totalTokens,
    activeRuntimeSeconds,
    foremanTurns,
    notes,
    recordedAt: new Date().toISOString(),
    recordedBy,
    mutatesExternalSystems: false,
    mutatesLocalFiles: false,
  };
}

function normalizeDelegationRoiForemanUsageList(
  value: unknown,
  handoffId: string
): DelegationRoiForemanUsage[] {
  const receipts = Array.isArray(value) ? value : [];

  // Older handoffs have no foreman-usage receipts. Normalizing at read time
  // keeps those records valid while guaranteeing every new receipt carries the
  // non-mutation flags required by the ROI ledger.
  return receipts
    .map(item => {
      const receipt = item as Partial<DelegationRoiForemanUsage>;
      const recordedAt = typeof receipt.recordedAt === 'string' ? receipt.recordedAt : null;
      if (!recordedAt) return null;
      const normalized: DelegationRoiForemanUsage = {
        id: typeof receipt.id === 'string' ? receipt.id : `foreman-usage-${recordedAt}`,
        handoffId,
        source: receipt.source === 'codex_goal_context' || receipt.source === 'other_measured_source'
          ? receipt.source
          : 'manual_codex_receipt',
        inputTokens: finiteNonNegativeNumber(receipt.inputTokens),
        outputTokens: finiteNonNegativeNumber(receipt.outputTokens),
        totalTokens: finiteNonNegativeNumber(receipt.totalTokens),
        activeRuntimeSeconds: finiteNonNegativeNumber(receipt.activeRuntimeSeconds),
        foremanTurns: finiteNonNegativeNumber(receipt.foremanTurns),
        notes: typeof receipt.notes === 'string' ? receipt.notes.trim().slice(0, 1200) : '',
        recordedAt,
        recordedBy: receipt.recordedBy === 'operator' ? 'operator' : 'codex_foreman',
        mutatesExternalSystems: false,
        mutatesLocalFiles: false,
      };
      return normalized.totalTokens === null && normalized.activeRuntimeSeconds === null && normalized.foremanTurns === null
        ? null
        : normalized;
    })
    .filter((receipt): receipt is DelegationRoiForemanUsage => Boolean(receipt))
    .slice(0, 40);
}

function normalizeDelegationRoiEstimateInput(input: DelegationRoiEstimateInput): DelegationRoiEstimate {
  const turns = finiteNonNegativeNumber(input.estimatedLocalCodexImplementationTurns ?? null);
  const tokens = finiteNonNegativeNumber(input.estimatedLocalCodexTokens ?? null);
  const cycles = finiteNonNegativeNumber(input.estimatedDebuggingCycles ?? null);
  const method = typeof input.method === 'string' ? input.method.trim().slice(0, 1200) : '';
  const confidence = input.confidence === 'low' || input.confidence === 'medium' || input.confidence === 'high'
    ? input.confidence
    : 'low';
  const caveats = Array.isArray(input.caveats)
    ? input.caveats
    : typeof input.caveats === 'string'
      ? input.caveats.split(/\r?\n/)
      : [];
  const normalizedCaveats = caveats
    .map(item => String(item).trim())
    .filter(Boolean)
    .slice(0, 8)
    .map(item => item.slice(0, 500));

  if (turns === null && tokens === null && cycles === null) {
    throw new Error('Record at least one avoided-work estimate: turns, tokens, or debugging cycles.');
  }
  if (!method) {
    throw new Error('Delegation ROI estimate method is required.');
  }

  // The estimate is intentionally marked as counterfactual. It can help compare
  // local Codex work with Jules delegation, but it must stay labeled as an
  // estimate with confidence and caveats rather than becoming measured spend.
  return {
    status: 'documented_estimate',
    estimatedLocalCodexImplementationTurns: turns,
    estimatedLocalCodexTokens: tokens,
    estimatedDebuggingCycles: cycles,
    confidence,
    method,
    caveats: normalizedCaveats.length
      ? normalizedCaveats
      : ['Counterfactual estimate; compare against measured Codex spend before claiming savings.'],
    recordedAt: new Date().toISOString(),
    recordedBy: 'operator',
    mutatesExternalSystems: false,
    mutatesLocalFiles: false,
  };
}

export function selectJulesPullRequestFallback(input: {
  handoffId: string;
  title: string;
  julesSessionId: string | null;
  linearIssueIdentifier: string | null;
  candidates: PullRequestDiscoveryCandidate[];
  searchedAt?: string;
}): PullRequestDiscoveryReceipt {
  const searchedAt = input.searchedAt ?? new Date().toISOString();
  const sessionId = normalizeDiscoveryToken(input.julesSessionId);
  const linearId = normalizeDiscoveryToken(input.linearIssueIdentifier);
  const titleTokens = normalizeDiscoveryText(input.title)
    .split(/\s+/)
    .filter(token => token.length >= 5)
    .slice(0, 8);

  const matches = input.candidates
    .map(candidate => {
      const haystack = normalizeDiscoveryText([
        candidate.url,
        candidate.title,
        candidate.headRefName,
        candidate.baseRefName,
      ].filter(Boolean).join(' '));
      const matchedBy: string[] = [];

      if (sessionId && haystack.includes(sessionId)) {
        matchedBy.push('jules_session_id');
      }

      if (linearId && haystack.includes(linearId)) {
        matchedBy.push('linear_issue_identifier');
      }

      const titleTokenHits = titleTokens.filter(token => haystack.includes(token));
      if (!sessionId && titleTokenHits.length >= 4) {
        matchedBy.push('handoff_title');
      }

      return { candidate, matchedBy };
    })
    .filter(match => match.matchedBy.length > 0 && typeof match.candidate.url === 'string');

  if (matches.length === 1) {
    const match = matches[0];
    const candidate = match.candidate;
    const by = orderDiscoveryReasons(match.matchedBy);
    return {
      status: 'matched',
      source: 'github_pr_list',
      handoffId: input.handoffId,
      searchedAt,
      candidatesChecked: input.candidates.length,
      matchedBy: by,
      url: candidate.url ?? null,
      title: candidate.title ?? null,
      headRefName: candidate.headRefName ?? null,
      state: candidate.state ?? null,
      summary: `Matched GitHub PR by ${by.join(', ')} after checking ${input.candidates.length} candidate(s).`,
      mutatesExternalSystems: false,
    };
  }

  const status = matches.length > 1 ? 'ambiguous' : 'not_found';
  return {
    status,
    source: 'github_pr_list',
    handoffId: input.handoffId,
    searchedAt,
    candidatesChecked: input.candidates.length,
    matchedBy: [],
    url: null,
    title: null,
    headRefName: null,
    state: null,
    summary: status === 'ambiguous'
      ? `Found ${matches.length} possible GitHub PRs; Symphony will not guess which PR belongs to this Jules handoff.`
      : `No matching GitHub PR found after checking ${input.candidates.length} candidate(s).`,
    mutatesExternalSystems: false,
  };
}

export function selectJulesApiPullRequestOutput(input: {
  handoffId: string;
  session: JulesApiSession | null;
  searchedAt?: string;
}): PullRequestDiscoveryReceipt {
  const searchedAt = input.searchedAt ?? new Date().toISOString();
  const outputs = Array.isArray(input.session?.outputs) ? input.session.outputs : [];
  const pullRequests = outputs
    .map(output => output.pullRequest)
    .filter((pullRequest): pullRequest is NonNullable<JulesApiSessionOutput['pullRequest']> => Boolean(pullRequest?.url));

  if (pullRequests.length === 1) {
    const pr = pullRequests[0];
    return {
      status: 'matched',
      source: 'jules_api_session',
      handoffId: input.handoffId,
      searchedAt,
      candidatesChecked: outputs.length,
      matchedBy: ['jules_api_output'],
      url: pr.url ?? null,
      title: pr.title ?? null,
      headRefName: pr.headRef ?? null,
      state: input.session?.state ?? null,
      summary: `Matched GitHub PR from Jules API session output after checking ${outputs.length} output item(s).`,
      mutatesExternalSystems: false,
    };
  }

  const status = pullRequests.length > 1 ? 'ambiguous' : 'not_found';
  return {
    status,
    source: 'jules_api_session',
    handoffId: input.handoffId,
    searchedAt,
    candidatesChecked: outputs.length,
    matchedBy: [],
    url: null,
    title: null,
    headRefName: null,
    state: input.session?.state ?? null,
    summary: status === 'ambiguous'
      ? `Jules API returned ${pullRequests.length} PR outputs; Symphony will not guess which one owns this handoff.`
      : `Jules API session ${input.session?.id ?? input.session?.name ?? 'unknown'} did not include a pull request output.`,
    mutatesExternalSystems: false,
  };
}

export function buildJulesStateReconciliation(handoff: Partial<JulesHandoff>): JulesStateReconciliation {
  const handoffId = typeof handoff.id === 'string' ? handoff.id : 'unknown-handoff';
  const title = typeof handoff.title === 'string' ? handoff.title : 'Untitled Jules handoff';
  const discovery = handoff.githubPullRequestDiscovery ?? null;
  const storedJulesState = typeof handoff.julesState === 'string' ? handoff.julesState : null;
  const capturedPullRequestUrl = typeof handoff.githubPullRequestUrl === 'string'
    ? handoff.githubPullRequestUrl
    : null;
  const hasSession = Boolean(handoff.julesSessionId || handoff.julesSessionUrl || storedJulesState);
  const completedWithoutStoredPr = storedJulesState === 'COMPLETED' && !capturedPullRequestUrl;
  const reconciledByDiscovery = Boolean(
    capturedPullRequestUrl
      && discovery?.status === 'matched'
      && discovery.url === capturedPullRequestUrl
  );

  // This packet explains which source Symphony trusts when the local Jules
  // record and the broader Jules/GitHub evidence disagree. It does not discover
  // anything by itself; refreshPullRequestStatus owns API/GitHub reads, while
  // this derived packet makes the result readable for the operator.
  const status: JulesStateReconciliation['status'] = reconciledByDiscovery
    ? 'reconciled_from_external_evidence'
    : completedWithoutStoredPr
      ? 'needs_browser_reconciliation'
      : hasSession && !capturedPullRequestUrl
        ? 'waiting_for_pr'
        : 'consistent';
  const localStoredStateIncomplete = status === 'reconciled_from_external_evidence';
  const requiresBrowserCheck = status === 'needs_browser_reconciliation';
  const sourceLabel = discovery?.source === 'jules_api_session'
    ? 'Jules API'
    : discovery?.source === 'github_pr_list'
      ? 'GitHub PR list'
      : 'stored Symphony state';

  return {
    handoffId,
    title,
    generatedAt: new Date().toISOString(),
    status,
    storedJulesState,
    sessionId: typeof handoff.julesSessionId === 'string' ? handoff.julesSessionId : null,
    sessionUrl: typeof handoff.julesSessionUrl === 'string' ? handoff.julesSessionUrl : null,
    capturedPullRequestUrl,
    discoverySource: discovery?.source ?? null,
    discoveryStatus: discovery?.status ?? null,
    matchedBy: discovery?.matchedBy ?? [],
    localStoredStateIncomplete,
    requiresBrowserCheck,
    summary: status === 'reconciled_from_external_evidence'
      ? `${sourceLabel} found the GitHub PR after the local Jules record was incomplete.`
      : status === 'needs_browser_reconciliation'
        ? 'Jules says the task is complete, but no PR URL is captured. Inspect the visible Jules session before treating this boundary as complete.'
        : status === 'waiting_for_pr'
          ? 'Jules has a session record, but Symphony has not captured a PR yet.'
          : 'Stored Jules state and captured PR evidence are consistent enough for the next boundary.',
    nextExpectedProof: status === 'reconciled_from_external_evidence'
      ? 'Refresh PR checks, files, comments, and Scout/Core readiness from GitHub.'
      : status === 'needs_browser_reconciliation'
        ? 'Codex app browser or Jules API evidence that confirms whether a PR exists.'
        : status === 'waiting_for_pr'
          ? 'A Jules status/API/GitHub refresh that either captures a PR or records why none exists yet.'
          : 'Continue with the current Symphony handoff boundary.',
    mutatesExternalSystems: false,
    mutatesLocalFiles: false,
  };
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
  failedChecks: Array<{ name: string; detailsUrl: string | null }>;
  artifacts: PullRequestCheckArtifact[];
  blockers: PullRequestCheckBlocker[];
}

interface PullRequestCheckArtifact {
  checkName: string;
  artifactName: string;
  detailsUrl: string | null;
  summary: string;
}

interface PullRequestCheckBlocker {
  category: 'workflow_setup' | 'workflow_config' | 'jules_implementation' | 'unknown';
  severity: 'blocking' | 'advisory';
  checkNames: string[];
  evidence: string[];
  summary: string;
  nextAction: string;
  mutatesExternalSystems: false;
}

export interface PullRequestRepairDecisionPacket {
  status: 'not_needed' | 'needs_operator_decision';
  category: PullRequestCheckBlocker['category'] | null;
  handoffId: string;
  generatedAt: string;
  mutatesExternalSystems: false;
  mutatesLocalFiles: false;
  question: string;
  plainLanguageSummary: string;
  evidence: string[];
  recommendedFirstStep: string;
  options: PullRequestRepairDecisionOption[];
  nextExpectedProof: string;
}

export interface PullRequestRepairDecisionOption {
  id:
    | 'create_setup_repair_task'
    | 'send_jules_feedback'
    | 'fix_workflow_config'
    | 'wait_for_manual_repair'
    | 'refresh_after_repair';
  label: string;
  description: string;
  whenToUse: string;
  command: string | null;
  requiresOperatorApproval: true;
  mutatesExternalSystemsIfRun: boolean;
  mutatesLocalFilesIfRun: boolean;
}

export interface DelegationRoiLedger {
  status: 'roi_unknown' | 'candidate_savings' | 'not_delegated';
  generatedAt: string;
  handoffId: string;
  summary: string;
  verdict: string;
  separatesMeasuredFactsFromEstimates: true;
  measuredFacts: DelegationRoiMeasuredFacts;
  estimatedAvoidedCodexWork: DelegationRoiEstimate;
  workflowValueSignals: DelegationRoiWorkflowSignals;
}

export interface DelegationRoiMeasuredFacts {
  codexTokens: {
    input: number | null;
    output: number | null;
    total: number | null;
    source: 'missing' | 'codex_totals' | 'worker_roster' | 'retained_usage';
  };
  taskScopedForemanUsage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
    activeRuntimeSeconds: number | null;
    foremanTurns: number | null;
    source: 'missing' | 'task_scoped_foreman_usage';
    receiptCount: number;
  };
  goalContextForemanUsage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
    activeRuntimeSeconds: number | null;
    foremanTurns: number | null;
    source: 'missing' | 'goal_context_foreman_usage';
    receiptCount: number;
  };
  codexActiveRuntimeSeconds: number | null;
  codexForemanEventCount: number;
  julesElapsedSeconds: number | null;
  githubElapsedSeconds: number | null;
  humanInterventionCount: number;
  localCodexEditedProductionFiles: boolean | null;
  dataSources: string[];
}

export interface DelegationRoiCodexUsageInput {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  secondsRunning?: number | null;
  source: 'codex_totals' | 'worker_roster' | 'retained_usage';
}

export interface DelegationRoiForemanUsageInput {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  activeRuntimeSeconds?: number | null;
  foremanTurns?: number | null;
  source?: 'codex_goal_context' | 'manual_codex_receipt' | 'other_measured_source' | string | null;
  notes?: string | null;
  recordedBy?: 'operator' | 'codex_foreman' | string | null;
}

export interface DelegationRoiForemanUsage {
  id: string;
  handoffId: string;
  source: 'codex_goal_context' | 'manual_codex_receipt' | 'other_measured_source';
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  activeRuntimeSeconds: number | null;
  foremanTurns: number | null;
  notes: string;
  recordedAt: string;
  recordedBy: 'operator' | 'codex_foreman';
  mutatesExternalSystems: false;
  mutatesLocalFiles: false;
}

export interface DelegationRoiEstimateInput {
  estimatedLocalCodexImplementationTurns?: number | null;
  estimatedLocalCodexTokens?: number | null;
  estimatedDebuggingCycles?: number | null;
  confidence?: 'low' | 'medium' | 'high';
  method?: string | null;
  caveats?: string[] | string | null;
}

export interface DelegationRoiEstimate {
  status: 'missing_estimate' | 'documented_estimate';
  estimatedLocalCodexImplementationTurns: number | null;
  estimatedLocalCodexTokens: number | null;
  estimatedDebuggingCycles: number | null;
  confidence: 'missing' | 'low' | 'medium' | 'high';
  method: string | null;
  caveats: string[];
  recordedAt?: string;
  recordedBy?: 'operator' | 'codex_foreman';
  mutatesExternalSystems?: false;
  mutatesLocalFiles?: false;
}

export interface DelegationRoiWorkflowSignals {
  delegatedToJules: boolean;
  julesProducedPullRequest: boolean;
  prStayedWithinDeclaredScope: boolean | null;
  codexAvoidedLocalImplementation: boolean | null;
  humanInterventionsNeeded: number;
  stalledBecause: 'none' | 'ci_setup' | 'workflow_config' | 'jules_implementation' | 'unclear_handoff' | 'unknown';
  pullRequestUrl: string | null;
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
  updatedAt?: string;
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

export interface PullRequestDiscoveryCandidate {
  number?: number;
  url?: string;
  title?: string;
  headRefName?: string;
  baseRefName?: string;
  state?: string;
  isDraft?: boolean;
  updatedAt?: string;
}

export interface PullRequestDiscoveryReceipt {
  status: 'matched' | 'not_found' | 'ambiguous';
  source: 'github_pr_list' | 'jules_api_session';
  handoffId: string;
  searchedAt: string;
  candidatesChecked: number;
  matchedBy: string[];
  url: string | null;
  title: string | null;
  headRefName: string | null;
  state: string | null;
  summary: string;
  mutatesExternalSystems: false;
}

export interface JulesApiSessionOutput {
  pullRequest?: {
    url?: string;
    title?: string;
    description?: string;
    baseRef?: string;
    headRef?: string;
  };
  changeSet?: unknown;
}

export interface JulesApiSession {
  id?: string;
  name?: string;
  title?: string;
  state?: string;
  url?: string;
  updateTime?: string;
  outputs?: JulesApiSessionOutput[];
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
  operatorPreferences: OperatorPreferences;
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

  async snapshot(codexUsage?: DelegationRoiCodexUsageInput | null): Promise<TaskDraftSnapshot> {
    const preflight = await this.runGitSyncPreflight();
    const stored = await this.readStoredDrafts();
    return this.buildSnapshotFromStored(stored, preflight, codexUsage);
  }

  async recordOperatorPreferences(input: OperatorPreferencesInput): Promise<TaskDraftSnapshot> {
    const stored = await this.readStoredDrafts();
    const preflight = await this.runGitSyncPreflight();

    // Preference edits are local dashboard state. They let the foreman respect
    // the operator's quiet hours without crossing any task, Jules, GitHub,
    // Linear, filesystem, or Git boundary.
    stored.operatorPreferences = normalizeOperatorPreferences(input);
    await this.writeStoredDrafts(stored);

    return this.buildSnapshotFromStored(stored, preflight);
  }

  async recordGitDisposition(input: GitDispositionInput): Promise<TaskDraftSnapshot> {
    const category = normalizeGitDispositionCategory(input.category);
    const decision = normalizeGitDispositionDecision(input.decision);
    const note = typeof input.note === 'string' ? input.note.trim().slice(0, 600) : '';
    const stored = await this.readStoredDrafts();
    const preflight = await this.runGitSyncPreflight();
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
      scopeKey: gitDispositionScopeKey(preflight, category),
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

  async recordTaskMessage(
    taskId: string,
    input: TaskMessageInput
  ): Promise<TaskDraftSnapshot> {
    const stored = await this.readStoredDrafts();
    const preflight = await this.runGitSyncPreflight();
    const draftIndex = stored.drafts.findIndex(item => item.id === taskId);
    const handoffIndex = stored.handoffs.findIndex(item => item.id === taskId);
    const taskKind: TaskMessage['taskKind'] | null = draftIndex >= 0
      ? 'draft'
      : handoffIndex >= 0
        ? 'handoff'
        : null;

    if (!taskKind) {
      throw new Error(`Task ${taskId} was not found.`);
    }

    const message = normalizeTaskMessageInput(taskId, taskKind, input);

    // Task messages are the local conversation trail between the operator and
    // the Codex foreman. They intentionally do not send anything to Jules or
    // GitHub; those remain separate explicit endpoints because they cross an
    // external boundary and can change remote work.
    if (taskKind === 'draft') {
      const draft = stored.drafts[draftIndex];
      stored.drafts[draftIndex] = {
        ...draft,
        updatedAt: message.createdAt,
        taskMessages: [message, ...normalizeTaskMessages(draft.taskMessages, draft.id, 'draft')].slice(0, 40),
      };
    } else {
      const handoff = stored.handoffs[handoffIndex];
      stored.handoffs[handoffIndex] = {
        ...handoff,
        updatedAt: message.createdAt,
        taskMessages: [message, ...normalizeTaskMessages(handoff.taskMessages, handoff.id, 'handoff')].slice(0, 40),
      };
    }

    await this.writeStoredDrafts(stored);

    return this.buildSnapshotFromStored(stored, preflight);
  }

  async recordTaskClarification(
    taskId: string,
    input: TaskClarificationInput
  ): Promise<TaskDraftSnapshot> {
    const stored = await this.readStoredDrafts();
    const preflight = await this.runGitSyncPreflight();
    const draftIndex = stored.drafts.findIndex(item => item.id === taskId);
    const handoffIndex = stored.handoffs.findIndex(item => item.id === taskId);
    const taskKind: TaskClarification['taskKind'] | null = draftIndex >= 0
      ? 'draft'
      : handoffIndex >= 0
        ? 'handoff'
        : null;

    if (!taskKind) {
      throw new Error(`Task ${taskId} was not found.`);
    }

    const clarification = normalizeTaskClarificationInput(taskId, taskKind, input);

    // Clarifications are structured questions and answers for the Codex
    // foreman loop. They are kept separate from free-form task messages so the
    // dashboard can reliably mark a task as "needs clarification" before it is
    // sent across the Linear/Jules boundary.
    if (taskKind === 'draft') {
      const draft = stored.drafts[draftIndex];
      stored.drafts[draftIndex] = {
        ...draft,
        updatedAt: clarification.createdAt,
        taskClarifications: [
          clarification,
          ...normalizeTaskClarifications(draft.taskClarifications, draft.id, 'draft'),
        ].slice(0, 40),
      };
    } else {
      const handoff = stored.handoffs[handoffIndex];
      stored.handoffs[handoffIndex] = {
        ...handoff,
        updatedAt: clarification.createdAt,
        taskClarifications: [
          clarification,
          ...normalizeTaskClarifications(handoff.taskClarifications, handoff.id, 'handoff'),
        ].slice(0, 40),
      };
    }

    await this.writeStoredDrafts(stored);

    return this.buildSnapshotFromStored(stored, preflight);
  }

  async recordTaskDisposition(
    taskId: string,
    input: TaskDispositionInput
  ): Promise<TaskDraftSnapshot> {
    const stored = await this.readStoredDrafts();
    const preflight = await this.runGitSyncPreflight();
    const draftIndex = stored.drafts.findIndex(item => item.id === taskId);
    const handoffIndex = stored.handoffs.findIndex(item => item.id === taskId);
    const taskKind: TaskDisposition['taskKind'] | null = draftIndex >= 0
      ? 'draft'
      : handoffIndex >= 0
        ? 'handoff'
        : null;

    if (!taskKind) {
      throw new Error(`Task ${taskId} was not found.`);
    }

    const disposition = normalizeTaskDispositionInput(taskId, taskKind, input);

    // Disposition is a local dashboard filing decision. It lets the operator
    // mark stale, completed, or abandoned work without rewriting the Jules,
    // Linear, GitHub, or Git evidence that led to that decision.
    if (taskKind === 'draft') {
      const draft = stored.drafts[draftIndex];
      stored.drafts[draftIndex] = {
        ...draft,
        updatedAt: disposition.recordedAt,
        taskDisposition: disposition.state === 'active' ? null : disposition,
      };
    } else {
      const handoff = stored.handoffs[handoffIndex];
      stored.handoffs[handoffIndex] = {
        ...handoff,
        updatedAt: disposition.recordedAt,
        taskDisposition: disposition.state === 'active' ? null : disposition,
      };
    }

    await this.writeStoredDrafts(stored);

    return this.buildSnapshotFromStored(stored, preflight);
  }

  private buildSnapshotFromStored(
    stored: StoredDraftFile,
    preflight: GitSyncPreflight,
    codexUsage?: DelegationRoiCodexUsageInput | null
  ): TaskDraftSnapshot {
    const gitDisposition = buildGitDispositionSummary(stored.gitDisposition, preflight);
    const operatorPreferences = normalizeOperatorPreferences(stored.operatorPreferences);
    const taskRouting = buildTaskRoutingPlan(stored.drafts, stored.handoffs, preflight);

    // Every dashboard/API response carries the same preflight, disposition,
    // guarded sync-plan, routing, and nudge-ledger view. Keeping these derived
    // at the snapshot boundary prevents command buttons, foreman workers, and
    // browser panels from drifting into different interpretations of the
    // blocked Git/Jules/GitHub boundary.
    return {
      drafts: this.applyPreflightStatus(stored.drafts, preflight),
      handoffs: this.applyHandoffPreflightStatus(stored.handoffs, preflight, stored.taskNudges, codexUsage, operatorPreferences),
      preflight,
      gitDisposition,
      gitSyncPlan: buildGitSyncPlan(preflight, gitDisposition),
      taskRouting,
      taskNudges: buildTaskNudgeSummary(stored.taskNudges, taskRouting),
      operatorPreferences,
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
      taskMessages: [],
      taskClarifications: [],
      taskDisposition: null,
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
    const handoffId = `handoff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const handoff: JulesHandoff = {
      id: handoffId,
      draftId: draft.id,
      title: draft.title,
      executor: 'jules',
      status: 'ready_for_jules',
      prompt: buildJulesPrompt(draft, preflight),
      expectedFiles: draft.expectedFiles ?? [],
      verificationCommands: draft.verificationCommands ?? [],
      taskMessages: normalizeTaskMessages(draft.taskMessages, draft.id, 'draft')
        .map(message => ({ ...message, taskId: handoffId, taskKind: 'handoff' as const })),
      taskClarifications: normalizeTaskClarifications(draft.taskClarifications, draft.id, 'draft')
        .map(clarification => ({ ...clarification, taskId: handoffId, taskKind: 'handoff' as const })),
      taskDisposition: null,
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
      githubPullRequestRepairDecision: null,
      delegationRoiForemanUsage: [],
      delegationRoiEstimate: null,
      delegationRoiLedger: null,
      handoffTimeline: null,
      julesStateReconciliation: null,
      operatorQuestion: null,
      operatorAnswers: [],
      repairLaneExecutions: [],
      repairPushReadiness: null,
      repairPushResult: null,
      deploymentEvidence: null,
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

  private async discoverPullRequestForHandoff(handoff: JulesHandoff, searchedAt: string): Promise<PullRequestDiscoveryReceipt> {
    // Jules can create a PR even when the local records file never receives a
    // pullRequestUrl. This fallback keeps Symphony's foreman state honest by
    // reading GitHub's PR list and matching only on strong task evidence.
    const result = await execFileAsync(
      'gh',
      [
        'pr',
        'list',
        '--state',
        'all',
        '--limit',
        '100',
        '--json',
        'number,url,title,headRefName,baseRefName,state,isDraft,updatedAt',
      ],
      {
        cwd: this.repoRoot,
        timeout: 60_000,
        maxBuffer: 2 * 1024 * 1024,
      }
    );
    const candidates = JSON.parse(result.stdout) as PullRequestDiscoveryCandidate[];
    return selectJulesPullRequestFallback({
      handoffId: handoff.id,
      title: handoff.title,
      julesSessionId: handoff.julesSessionId,
      linearIssueIdentifier: handoff.linearIssueIdentifier,
      candidates,
      searchedAt,
    });
  }

  private async discoverPullRequestFromJulesApi(handoff: JulesHandoff, searchedAt: string): Promise<PullRequestDiscoveryReceipt | null> {
    const apiKey = process.env.JULES_API_KEY;
    if (!apiKey || !handoff.julesSessionId) {
      return null;
    }

    // The official Jules API is the first reconciliation source because it can
    // report completed session outputs even when the local .jules records file
    // missed pullRequestUrl. Keep the key only in the request header and store
    // a redacted, read-only receipt for dashboard evidence.
    const response = await fetch(`https://jules.googleapis.com/v1alpha/sessions/${encodeURIComponent(handoff.julesSessionId)}`, {
      headers: {
        'x-goog-api-key': apiKey,
      },
    });

    if (!response.ok) {
      return {
        status: 'not_found',
        source: 'jules_api_session',
        handoffId: handoff.id,
        searchedAt,
        candidatesChecked: 0,
        matchedBy: [],
        url: null,
        title: null,
        headRefName: null,
        state: null,
        summary: `Jules API session lookup returned HTTP ${response.status}.`,
        mutatesExternalSystems: false,
      };
    }

    const session = await response.json() as JulesApiSession;
    return selectJulesApiPullRequestOutput({
      handoffId: handoff.id,
      session,
      searchedAt,
    });
  }

  async refreshPullRequestStatus(handoffId: string): Promise<TaskDraftSnapshot> {
    const stored = await this.readStoredDrafts();
    const handoffIndex = stored.handoffs.findIndex(item => item.id === handoffId);
    if (handoffIndex < 0) {
      throw new Error(`Handoff ${handoffId} was not found.`);
    }

    const now = new Date().toISOString();
    const preflight = await this.runGitSyncPreflight();
    const handoff = stored.handoffs[handoffIndex];
    let prUrl = handoff.githubPullRequestUrl;
    let discovery = handoff.githubPullRequestDiscovery ?? null;

    if (!prUrl && handoff.julesSessionId) {
      try {
        const apiDiscovery = await this.discoverPullRequestFromJulesApi(handoff, now);
        if (apiDiscovery) {
          discovery = apiDiscovery;
          if (apiDiscovery.status === 'matched' && apiDiscovery.url) {
            prUrl = apiDiscovery.url;
          }
        }
      } catch (err) {
        const failed = err as Error;
        discovery = {
          status: 'not_found',
          source: 'jules_api_session',
          handoffId: handoff.id,
          searchedAt: now,
          candidatesChecked: 0,
          matchedBy: [],
          url: null,
          title: null,
          headRefName: null,
          state: null,
          summary: failed.message,
          mutatesExternalSystems: false,
        };
      }
    }

    if (!prUrl && handoff.julesSessionId) {
      try {
        discovery = await this.discoverPullRequestForHandoff(handoff, now);
        if (discovery.status === 'matched' && discovery.url) {
          prUrl = discovery.url;
        }
      } catch (err) {
        const failed = err as Error & { stdout?: string; stderr?: string };
        discovery = {
          status: 'not_found',
          source: 'github_pr_list',
          handoffId: handoff.id,
          searchedAt: now,
          candidatesChecked: 0,
          matchedBy: [],
          url: null,
          title: null,
          headRefName: null,
          state: null,
          summary: failed.stderr || failed.stdout || failed.message,
          mutatesExternalSystems: false,
        };
      }
    }

    if (!prUrl) {
      stored.handoffs[handoffIndex] = {
        ...handoff,
        updatedAt: now,
        gitPreflight: preflight,
        githubPullRequestDiscovery: discovery,
        githubPullRequestRefreshError: discovery?.summary ?? `Handoff ${handoffId} does not have a GitHub PR URL yet.`,
        lastPullRequestRefreshAt: now,
      };
      await this.writeStoredDrafts(stored);
      throw new Error(discovery?.summary ?? `Handoff ${handoffId} does not have a GitHub PR URL yet.`);
    }

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
          'number,state,isDraft,mergeable,reviewDecision,headRefName,baseRefName,url,updatedAt,additions,deletions,changedFiles,files,comments,reviews,latestReviews,statusCheckRollup',
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
      const pullRequestNextAction = buildPullRequestNextAction({
        state: pr.state ?? null,
        isDraft: typeof pr.isDraft === 'boolean' ? pr.isDraft : null,
        mergeable: pr.mergeable ?? null,
        updatedAt: pr.updatedAt ?? null,
        checks: pullRequestChecks,
        files: pullRequestFiles,
        feedback: pullRequestFeedback,
        scoutReviewCommand: commands.scoutReviewCommand,
        julesFeedbackCommand,
        coreValidationCommand: commands.coreValidationCommand,
        coreMergeCommand: commands.coreMergeCommand,
        refreshPullRequestUrl: null,
      });

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
        githubPullRequestDiscovery: discovery,
        githubPullRequestNextAction: pullRequestNextAction,
        githubPullRequestRepairDecision: buildPullRequestRepairDecision({
          handoffId: handoff.id,
          checks: pullRequestChecks,
          nextAction: pullRequestNextAction,
          julesFeedbackCommand,
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
        githubPullRequestRepairDecision: null,
        githubPullRequestRefreshError: failed.stderr || failed.stdout || failed.message,
        githubPullRequestDiscovery: discovery,
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

  async recordDelegationRoiEstimate(
    handoffId: string,
    input: DelegationRoiEstimateInput
  ): Promise<TaskDraftSnapshot> {
    const stored = await this.readStoredDrafts();
    const handoffIndex = stored.handoffs.findIndex(item => item.id === handoffId);
    if (handoffIndex < 0) {
      throw new Error(`Handoff ${handoffId} was not found.`);
    }

    const estimate = normalizeDelegationRoiEstimateInput(input);
    const preflight = await this.runGitSyncPreflight();
    const handoff = stored.handoffs[handoffIndex];

    // This local receipt records the counterfactual side of ROI: what Codex
    // thinks it avoided by delegating to Jules. It is stored separately from
    // measured tokens so a future dashboard can compare facts and estimates
    // without mixing them into a fake "saved tokens" number.
    stored.handoffs[handoffIndex] = {
      ...handoff,
      updatedAt: estimate.recordedAt ?? new Date().toISOString(),
      delegationRoiEstimate: estimate,
    };

    await this.writeStoredDrafts(stored);

    return this.buildSnapshotFromStored(stored, preflight);
  }

  async recordDelegationRoiForemanUsage(
    handoffId: string,
    input: DelegationRoiForemanUsageInput
  ): Promise<TaskDraftSnapshot> {
    const stored = await this.readStoredDrafts();
    const handoffIndex = stored.handoffs.findIndex(item => item.id === handoffId);
    if (handoffIndex < 0) {
      throw new Error(`Handoff ${handoffId} was not found.`);
    }

    const usage = normalizeDelegationRoiForemanUsageInput(handoffId, input);
    const preflight = await this.runGitSyncPreflight();
    const handoff = stored.handoffs[handoffIndex];

    // This local receipt records measured Codex foreman usage for one
    // delegation task. It fills the gap left by global Codex totals, which can
    // include unrelated work in a long-running thread and therefore cannot
    // prove task-level ROI on their own.
    stored.handoffs[handoffIndex] = {
      ...handoff,
      updatedAt: usage.recordedAt,
      delegationRoiForemanUsage: [
        usage,
        ...normalizeDelegationRoiForemanUsageList(handoff.delegationRoiForemanUsage, handoffId),
      ].slice(0, 40),
    };

    await this.writeStoredDrafts(stored);

    return this.buildSnapshotFromStored(stored, preflight);
  }

  async recordOperatorAnswer(
    handoffId: string,
    input: HandoffOperatorAnswerInput
  ): Promise<TaskDraftSnapshot> {
    const stored = await this.readStoredDrafts();
    const handoffIndex = stored.handoffs.findIndex(item => item.id === handoffId);
    if (handoffIndex < 0) {
      throw new Error(`Handoff ${handoffId} was not found.`);
    }

    const preflight = await this.runGitSyncPreflight();
    const handoff = {
      ...stored.handoffs[handoffIndex],
      operatorAnswers: Array.isArray(stored.handoffs[handoffIndex].operatorAnswers)
        ? stored.handoffs[handoffIndex].operatorAnswers
        : [],
    };
    const answer = normalizeOperatorAnswer(handoff, input);

    // This records the human's answer to a Symphony blocker without crossing
    // the repair boundary. The next action can use this receipt to decide which
    // guarded endpoint to offer, but this method itself is local-state only.
    stored.handoffs[handoffIndex] = {
      ...handoff,
      updatedAt: answer.answeredAt,
      operatorAnswers: [answer, ...handoff.operatorAnswers].slice(0, 20),
    };

    await this.writeStoredDrafts(stored);

    return this.buildSnapshotFromStored(stored, preflight);
  }

  async executeSelectedRepairLane(handoffId: string): Promise<TaskDraftSnapshot> {
    const stored = await this.readStoredDrafts();
    const handoffIndex = stored.handoffs.findIndex(item => item.id === handoffId);
    if (handoffIndex < 0) {
      throw new Error(`Handoff ${handoffId} was not found.`);
    }

    const preflight = await this.runGitSyncPreflight();
    const handoff = {
      ...stored.handoffs[handoffIndex],
      operatorAnswers: Array.isArray(stored.handoffs[handoffIndex].operatorAnswers)
        ? stored.handoffs[handoffIndex].operatorAnswers
        : [],
      repairLaneExecutions: Array.isArray(stored.handoffs[handoffIndex].repairLaneExecutions)
        ? stored.handoffs[handoffIndex].repairLaneExecutions
        : [],
    };
    const latestAnswer = handoff.operatorAnswers[0] ?? null;

    if (!latestAnswer) {
      throw new Error('Record the operator repair-lane answer before executing a repair lane.');
    }

    if (latestAnswer.selectedAction !== 'create_setup_repair_task') {
      throw new Error(`Repair lane ${latestAnswer.selectedAction} is not executable by this local draft path yet.`);
    }

    const existingExecution = handoff.repairLaneExecutions.find(execution =>
      execution.selectedAction === latestAnswer.selectedAction && execution.createdDraftId
    );
    if (existingExecution) {
      return this.buildSnapshotFromStored(stored, preflight);
    }

    const now = new Date().toISOString();
    const draft = buildSetupRepairDraftFromHandoff(handoff, latestAnswer, now);
    const execution: HandoffRepairLaneExecution = {
      id: `repair-lane-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      handoffId,
      selectedAction: latestAnswer.selectedAction,
      status: 'local_draft_created',
      createdAt: now,
      createdDraftId: draft.id,
      summary: `Created local setup repair draft ${draft.id}.`,
      mutatesExternalSystems: false,
      mutatesLocalFiles: false,
    };

    // The setup-repair lane intentionally creates only a local draft. That new
    // draft must still pass the normal Git, Linear, and Jules gates later; this
    // method does not create Linear issues, comment on PRs, send Jules feedback,
    // or edit the checkout.
    stored.drafts.unshift(draft);
    stored.handoffs[handoffIndex] = {
      ...handoff,
      updatedAt: now,
      repairLaneExecutions: [execution, ...handoff.repairLaneExecutions].slice(0, 20),
    };

    await this.writeStoredDrafts(stored);

    return this.buildSnapshotFromStored(stored, preflight);
  }

  async recordRepairPushReadiness(
    handoffId: string,
    input: HandoffRepairPushReadinessInput
  ): Promise<TaskDraftSnapshot> {
    const stored = await this.readStoredDrafts();
    const handoffIndex = stored.handoffs.findIndex(item => item.id === handoffId);
    if (handoffIndex < 0) {
      throw new Error(`Handoff ${handoffId} was not found.`);
    }

    const preflight = await this.runGitSyncPreflight();
    const handoff = stored.handoffs[handoffIndex];
    const readiness = normalizeRepairPushReadiness(handoff, input);

    // This records the handoff between local repair work and the external
    // GitHub mutation. It is intentionally a receipt only: Symphony can show
    // the prepared commit and exact push command, but this method never pushes.
    stored.handoffs[handoffIndex] = {
      ...handoff,
      updatedAt: readiness.recordedAt,
      repairPushReadiness: readiness,
    };

    await this.writeStoredDrafts(stored);

    return this.buildSnapshotFromStored(stored, preflight);
  }

  async recordRepairPushResult(
    handoffId: string,
    input: HandoffRepairPushResultInput
  ): Promise<TaskDraftSnapshot> {
    const stored = await this.readStoredDrafts();
    const handoffIndex = stored.handoffs.findIndex(item => item.id === handoffId);
    if (handoffIndex < 0) {
      throw new Error(`Handoff ${handoffId} was not found.`);
    }

    const preflight = await this.runGitSyncPreflight();
    const handoff = stored.handoffs[handoffIndex];
    const result = normalizeRepairPushResult(handoff, input);

    // This receipt records an operator-approved push after it happened. It is
    // deliberately separate from repairPushReadiness so future foremen can see
    // both the pre-push safety evidence and the post-push waiting boundary.
    stored.handoffs[handoffIndex] = {
      ...handoff,
      updatedAt: result.recordedAt,
      repairPushResult: result,
    };

    await this.writeStoredDrafts(stored);

    return this.buildSnapshotFromStored(stored, preflight);
  }

  async recordDeploymentEvidence(
    handoffId: string,
    input: HandoffDeploymentEvidenceInput
  ): Promise<TaskDraftSnapshot> {
    const stored = await this.readStoredDrafts();
    const handoffIndex = stored.handoffs.findIndex(item => item.id === handoffId);
    if (handoffIndex < 0) {
      throw new Error(`Handoff ${handoffId} was not found.`);
    }

    const preflight = await this.runGitSyncPreflight();
    const handoff = stored.handoffs[handoffIndex];
    const evidence = normalizeDeploymentEvidence(handoff, input);

    // Deployment proof is a local return-path receipt. It decides whether the
    // deployment gate is satisfied or explicitly waived, but it does not create
    // deployments, rerun Actions, call Jules, or mutate the local checkout.
    stored.handoffs[handoffIndex] = {
      ...handoff,
      updatedAt: evidence.recordedAt,
      deploymentEvidence: evidence,
    };

    await this.writeStoredDrafts(stored);

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
      if (!handoff.githubPullRequestUrl && !handoff.julesSessionId) continue;

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
    const defaultPauseSeconds = defaultTaskNudgePauseSeconds(record.action, record.phase);
    const rescheduledPauseSeconds = record.pauseSeconds > 0
      ? Math.max(record.pauseSeconds, defaultPauseSeconds)
      : 0;

    // A due refresh is a measured foreman wake-up, not permission to poll the
    // same external service in a tight loop. If a proof or manual call used a
    // tiny pause to make the nudge due, the next scheduled refresh returns to
    // the normal phase cadence before the dashboard offers it again.
    stored.taskNudges[index] = {
      ...record,
      createdAt: checkedAt,
      pauseSeconds: rescheduledPauseSeconds,
      nextNudgeAt: rescheduledPauseSeconds > 0 ? addSeconds(checkedAt, rescheduledPauseSeconds) : null,
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
    }

    // Capture the exact commits on both sides of the sync gate. The ahead /
    // behind counts are useful, but the human-facing proof is "this checked-out
    // worktree commit matches GitHub's base commit." That lets a clean planning
    // worktree based on origin/master pass without dragging unrelated local
    // master commits into the Jules handoff.
    const localRef = currentBranch === this.baseBranch ? this.baseBranch : 'HEAD';
    const localRefLabel = currentBranch === this.baseBranch
      ? this.baseBranch
      : (currentBranch || 'detached HEAD');
    const localCommitResult = await this.git(['rev-parse', localRef]);
    const localCommit = localCommitResult.ok ? localCommitResult.stdout.trim() || null : null;
    if (!localCommitResult.ok) {
      blockers.push(`Could not read the local ${localRefLabel} commit.`);
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
      `${localRef}...${remoteBranch}`,
    ]);
    const [aheadRaw, behindRaw] = divergenceResult.ok
      ? divergenceResult.stdout.trim().split(/\s+/)
      : [];
    const ahead = Number.isFinite(Number(aheadRaw)) ? Number(aheadRaw) : null;
    const behind = Number.isFinite(Number(behindRaw)) ? Number(behindRaw) : null;

    if (!divergenceResult.ok) {
      blockers.push(`Could not compare ${localRefLabel} with ${remoteBranch}.`);
      details.push(divergenceResult.message);
    } else {
      if (currentBranch !== this.baseBranch && ((ahead ?? 0) > 0 || (behind ?? 0) > 0)) {
        if ((ahead ?? 0) > 0) blockers.push(`Current branch ${localRefLabel} has ${ahead} commit(s) that are not on ${remoteBranch}.`);
        if ((behind ?? 0) > 0) blockers.push(`Current branch ${localRefLabel} is behind ${remoteBranch} by ${behind} commit(s).`);
      } else {
        if ((ahead ?? 0) > 0) blockers.push(`${this.baseBranch} has ${ahead} unpushed commit(s).`);
        if ((behind ?? 0) > 0) blockers.push(`${this.baseBranch} is behind ${remoteBranch} by ${behind} commit(s).`);
      }
    }

    const ok = blockers.length === 0;
    const commands = {
      status: `git -C ${this.repoRoot} status --short`,
      fetch: `git -C ${this.repoRoot} fetch ${this.remoteName}`,
      showLocalCommit: `git -C ${this.repoRoot} rev-parse ${localRef}`,
      showRemoteCommit: `git -C ${this.repoRoot} rev-parse ${remoteBranch}`,
      inspectDivergence: `git -C ${this.repoRoot} log --oneline --left-right ${localRef}...${remoteBranch}`,
      pullFastForward: `git -C ${this.repoRoot} pull --ff-only ${this.remoteName} ${this.baseBranch}`,
      pushBase: currentBranch === this.baseBranch
        ? `git -C ${this.repoRoot} push ${this.remoteName} ${this.baseBranch}`
        : `git -C ${this.repoRoot} push ${this.remoteName} HEAD:${currentBranch || this.baseBranch}`,
    };
    const resolutionPacket = await this.buildGitResolutionPacket({
      checkedAt,
      remoteBranch,
      localRef,
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
        ? `Ready: ${localRefLabel} matches ${remoteBranch} and the working tree is clean.`
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
      if ((input.ahead ?? 0) > 0 || (input.behind ?? 0) > 0) {
        steps.push(`Publish or merge ${input.currentBranch || 'the current branch'} so the intended handoff base is visible on ${input.remoteBranch}.`);
        steps.push('Do not push unrelated local master commits just to clear this branch gate.');
      } else {
        steps.push(`Switch to ${input.baseBranch} before starting Jules, or intentionally change the Symphony base branch.`);
      }
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
    localRef: string;
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
      `${input.localRef}...${input.remoteBranch}`,
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
        taskMessages: normalizeTaskMessages(draft.taskMessages, draft.id, 'draft'),
        taskClarifications: normalizeTaskClarifications(draft.taskClarifications, draft.id, 'draft'),
        taskDisposition: normalizeTaskDisposition(draft.taskDisposition, draft.id, 'draft'),
      status: preflight.ok ? 'ready_for_handoff' : 'blocked_by_git_sync',
      linearIssueId: draft.linearIssueId ?? null,
      linearIssueIdentifier: draft.linearIssueIdentifier ?? null,
      linearIssueUrl: draft.linearIssueUrl ?? null,
      linearIssueCreatedAt: draft.linearIssueCreatedAt ?? null,
    }));
  }

  private applyHandoffPreflightStatus(
    handoffs: JulesHandoff[],
    preflight: GitSyncPreflight,
    taskNudges: TaskNudgeRecord[] = [],
    codexUsage?: DelegationRoiCodexUsageInput | null,
    operatorPreferences: OperatorPreferences = normalizeOperatorPreferences(null)
  ): JulesHandoff[] {
    return handoffs.map(handoff => {
      const normalizedHandoff: JulesHandoff = {
        ...handoff,
        expectedFiles: handoff.expectedFiles ?? [],
        verificationCommands: handoff.verificationCommands ?? [],
        taskMessages: normalizeTaskMessages(handoff.taskMessages, handoff.id, 'handoff'),
        taskClarifications: normalizeTaskClarifications(handoff.taskClarifications, handoff.id, 'handoff'),
        taskDisposition: normalizeTaskDisposition(handoff.taskDisposition, handoff.id, 'handoff'),
        linearIssueId: handoff.linearIssueId ?? null,
        linearIssueIdentifier: handoff.linearIssueIdentifier ?? null,
        linearIssueUrl: handoff.linearIssueUrl ?? null,
        linearIssueCreatedAt: handoff.linearIssueCreatedAt ?? null,
        githubPullRequestNextAction: handoff.githubPullRequestNextAction ?? null,
        githubPullRequestRepairDecision: handoff.githubPullRequestRepairDecision ?? null,
        delegationRoiForemanUsage: normalizeDelegationRoiForemanUsageList(handoff.delegationRoiForemanUsage, handoff.id),
        delegationRoiEstimate: handoff.delegationRoiEstimate ?? null,
        delegationRoiLedger: handoff.delegationRoiLedger ?? null,
        handoffTimeline: handoff.handoffTimeline ?? null,
        julesStateReconciliation: handoff.julesStateReconciliation ?? null,
        operatorQuestion: handoff.operatorQuestion ?? null,
        operatorAnswers: Array.isArray(handoff.operatorAnswers) ? handoff.operatorAnswers : [],
        repairLaneExecutions: Array.isArray(handoff.repairLaneExecutions) ? handoff.repairLaneExecutions : [],
        repairPushReadiness: handoff.repairPushReadiness ?? null,
        repairPushResult: handoff.repairPushResult ?? null,
        deploymentEvidence: handoff.deploymentEvidence ?? null,
      };
      const withDerivedHandoffPackets = (candidate: JulesHandoff): JulesHandoff => {
        const withLedger: JulesHandoff = {
          ...candidate,
          delegationRoiLedger: buildDelegationRoiLedger({
            handoff: candidate,
            taskNudges,
            codexUsage,
          }),
        };

        // The ledger and timeline are both dashboard explanation packets. They
        // are rebuilt from the latest handoff facts every time the snapshot is
        // read, so stale stored JSON cannot make the foreman view lie.
        return {
          ...withLedger,
          handoffTimeline: buildJulesHandoffTimeline(withLedger, taskNudges),
          julesStateReconciliation: buildJulesStateReconciliation(withLedger),
          operatorQuestion: buildHandoffOperatorQuestion(withLedger, { operatorPreferences }),
        };
      };

      if (normalizedHandoff.status === 'observed_pr') {
        return withDerivedHandoffPackets({ ...normalizedHandoff, baseCommitDrift: null });
      }

      if (normalizedHandoff.status === 'sent_to_jules' || normalizedHandoff.julesSessionId) {
        return withDerivedHandoffPackets({
          ...normalizedHandoff,
          baseCommitDrift: this.buildBaseCommitDrift(normalizedHandoff, preflight, 'post_launch'),
        });
      }

      if (!preflight.ok) {
        return withDerivedHandoffPackets({
          ...normalizedHandoff,
          status: 'blocked_by_git_sync',
          baseCommitDrift: null,
        });
      }

      const baseCommitDrift = this.buildBaseCommitDrift(normalizedHandoff, preflight);
      if (baseCommitDrift) {
        return withDerivedHandoffPackets({
          ...normalizedHandoff,
          status: 'base_commit_stale',
          baseCommitDrift,
        });
      }

      if (normalizedHandoff.status === 'launch_failed' || normalizedHandoff.status === 'status_refresh_failed') {
        return withDerivedHandoffPackets({ ...normalizedHandoff, baseCommitDrift: null });
      }

      if (normalizedHandoff.status === 'manifest_ready') {
        return withDerivedHandoffPackets({ ...normalizedHandoff, baseCommitDrift: null });
      }

      return withDerivedHandoffPackets({
        ...normalizedHandoff,
        status: 'ready_for_jules',
        baseCommitDrift: null,
      });
    });
  }

  private buildBaseCommitDrift(
    handoff: JulesHandoff,
    preflight: GitSyncPreflight,
    phase: HandoffBaseCommitDrift['phase'] = 'pre_launch'
  ): HandoffBaseCommitDrift | null {
    const stagedRemoteCommit = handoff.gitPreflight?.remoteCommit ?? null;
    const currentRemoteCommit = preflight.remoteCommit ?? null;

    // Base drift means two different things depending on the handoff phase. A
    // pre-launch handoff can still be repaired by re-staging the manifest. A
    // launched Jules session is already an isolated clone, so later tracker or
    // workflow edits must be sent through a visible update channel instead.
    if (!stagedRemoteCommit || !currentRemoteCommit || stagedRemoteCommit === currentRemoteCommit) {
      return null;
    }

    const shortStaged = stagedRemoteCommit.slice(0, 12);
    const shortCurrent = currentRemoteCommit.slice(0, 12);

    if (phase === 'post_launch') {
      return {
        detectedAt: preflight.checkedAt,
        remoteBranch: preflight.remoteBranch,
        stagedRemoteCommit,
        currentRemoteCommit,
        phase,
        requiredAction: 'send_post_launch_update',
        updateChannels: [
          'visible Jules message',
          'bounded [Jules feedback] PR comment',
          'PR-branch repair or rebase',
          'replacement handoff from current origin/master',
        ],
        nextExpectedProof: 'Record which explicit update channel carried the new instruction, or record why the running Jules session was filed stale or superseded.',
        summary: `${preflight.remoteBranch} moved from ${shortStaged} to ${shortCurrent} after Jules launched; the running Jules clone will not receive later tracker or workflow edits automatically.`,
      };
    }

    return {
      detectedAt: preflight.checkedAt,
      remoteBranch: preflight.remoteBranch,
      stagedRemoteCommit,
      currentRemoteCommit,
      phase,
      requiredAction: 'restage_before_launch',
      updateChannels: ['stage Jules manifest again before launch'],
      nextExpectedProof: 'A refreshed manifest and prompt that record the current GitHub base before Jules is launched.',
      summary: `${preflight.remoteBranch} moved from ${shortStaged} to ${shortCurrent} after this handoff was prepared.`,
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
        operatorPreferences: normalizeOperatorPreferences(parsed.operatorPreferences),
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          drafts: [],
          handoffs: [],
          gitDisposition: [],
          taskNudges: [],
          operatorPreferences: normalizeOperatorPreferences(null),
        };
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

    const headCommitResult = await this.git(['rev-parse', 'HEAD']);
    const headCommit = headCommitResult.ok ? headCommitResult.stdout.trim() || null : null;
    if (!headCommitResult.ok) {
      blockers.push('Could not read the current checkout commit.');
      details.push(headCommitResult.message);
    }

    // Isolated Symphony worktrees often cannot check out `master` because the
    // user's main repo already owns that branch. A clean monitor branch at the
    // exact GitHub base commit is still a valid "nothing to pull" proof, while
    // any real fast-forward need or local difference remains blocked below.
    const currentBranchCanStandInForBase = currentBranch !== null
      && currentBranch !== this.baseBranch
      && dirtyFiles === 0
      && untrackedFiles === 0
      && (ahead ?? 0) === 0
      && (behind ?? 0) === 0
      && headCommit !== null
      && remoteCommit !== null
      && headCommit === remoteCommit;

    if (currentBranchResult.ok && currentBranch !== this.baseBranch && !currentBranchCanStandInForBase) {
      blockers.push(`Current branch is ${currentBranch || 'detached'}, not ${this.baseBranch}.`);
    }

    if (currentBranchCanStandInForBase) {
      details.push(
        `Current branch ${currentBranch} is a clean worktree branch at ${remoteBranch}; no local sync command is needed in this worktree.`,
      );
    }

    const safeToPull = blockers.length === 0 && (behind ?? 0) > 0;
    const upToDate = blockers.length === 0 && (behind ?? 0) === 0;
    const remediation = this.buildLocalSyncRemediation({
      prMerged,
      currentBranch,
      currentBranchCanStandInForBase,
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
        currentBranchCanStandInForBase,
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
    currentBranchCanStandInForBase: boolean;
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

    if (input.currentBranch !== this.baseBranch && !input.currentBranchCanStandInForBase) {
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

function normalizeTaskMessageInput(
  taskId: string,
  taskKind: TaskMessage['taskKind'],
  input: TaskMessageInput
): TaskMessage {
  const body = typeof input.body === 'string' ? input.body.trim().slice(0, 4000) : '';
  const author = input.author === 'codex_foreman' ? 'codex_foreman' : 'operator';

  if (!body) {
    throw new Error('Task message body is required.');
  }

  return {
    id: `task-message-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    taskId,
    taskKind,
    author,
    body,
    createdAt: new Date().toISOString(),
    source: 'task_chat',
    mutatesExternalSystems: false,
    mutatesLocalFiles: false,
    mutatesGit: false,
  };
}

function normalizeTaskMessages(
  value: unknown,
  taskId: string,
  taskKind: TaskMessage['taskKind']
): TaskMessage[] {
  const messages = Array.isArray(value) ? value : [];

  // Stored task messages are allowed to survive old schema versions. Normalize
  // them at the snapshot boundary so older drafts/handoffs remain readable and
  // future task pages can trust the non-mutation flags.
  return messages
    .map(item => {
      const message = item as Partial<TaskMessage>;
      const body = typeof message.body === 'string' ? message.body.trim() : '';
      const createdAt = typeof message.createdAt === 'string' ? message.createdAt : null;
      if (!body || !createdAt) return null;

      return {
        id: typeof message.id === 'string' ? message.id : `task-message-${createdAt}`,
        taskId,
        taskKind,
        author: message.author === 'codex_foreman' ? 'codex_foreman' : 'operator',
        body: body.slice(0, 4000),
        createdAt,
        source: 'task_chat' as const,
        mutatesExternalSystems: false as const,
        mutatesLocalFiles: false as const,
        mutatesGit: false as const,
      };
    })
    .filter((message): message is TaskMessage => Boolean(message))
    .slice(0, 40);
}

function normalizeTaskClarificationInput(
  taskId: string,
  taskKind: TaskClarification['taskKind'],
  input: TaskClarificationInput
): TaskClarification {
  const question = typeof input.question === 'string' ? input.question.trim().slice(0, 1200) : '';
  const answer = typeof input.answer === 'string' && input.answer.trim()
    ? input.answer.trim().slice(0, 2400)
    : null;
  const now = new Date().toISOString();

  if (!question) {
    throw new Error('Task clarification question is required.');
  }

  return {
    id: `task-clarification-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    taskId,
    taskKind,
    status: answer ? 'answered' : 'waiting_for_operator',
    question,
    answer,
    requestedBy: 'codex_foreman',
    answeredBy: answer ? 'operator' : null,
    createdAt: now,
    answeredAt: answer ? now : null,
    source: 'foreman_clarification',
    mutatesExternalSystems: false,
    mutatesLocalFiles: false,
    mutatesGit: false,
  };
}

function normalizeTaskClarifications(
  value: unknown,
  taskId: string,
  taskKind: TaskClarification['taskKind']
): TaskClarification[] {
  const clarifications = Array.isArray(value) ? value : [];

  // Old queue files are allowed to omit clarification records entirely. When a
  // record does exist, normalize its safety flags at read time so future
  // dashboard pages can trust that clarification never implies Jules feedback.
  return clarifications
    .map(item => {
      const clarification = item as Partial<TaskClarification>;
      const question = typeof clarification.question === 'string' ? clarification.question.trim() : '';
      const createdAt = typeof clarification.createdAt === 'string' ? clarification.createdAt : null;
      if (!question || !createdAt) return null;
      const answer = typeof clarification.answer === 'string' && clarification.answer.trim()
        ? clarification.answer.trim().slice(0, 2400)
        : null;

      return {
        id: typeof clarification.id === 'string' ? clarification.id : `task-clarification-${createdAt}`,
        taskId,
        taskKind,
        status: answer ? 'answered' as const : 'waiting_for_operator' as const,
        question: question.slice(0, 1200),
        answer,
        requestedBy: 'codex_foreman' as const,
        answeredBy: answer ? 'operator' as const : null,
        createdAt,
        answeredAt: answer
          ? typeof clarification.answeredAt === 'string' ? clarification.answeredAt : createdAt
          : null,
        source: 'foreman_clarification' as const,
        mutatesExternalSystems: false as const,
        mutatesLocalFiles: false as const,
        mutatesGit: false as const,
      };
    })
    .filter((clarification): clarification is TaskClarification => Boolean(clarification))
    .slice(0, 40);
}

function normalizeTaskDispositionInput(
  taskId: string,
  taskKind: TaskDisposition['taskKind'],
  input: TaskDispositionInput
): TaskDisposition {
  const allowedStates: TaskDispositionState[] = ['active', 'completed', 'archived', 'abandoned'];
  const state = allowedStates.includes(input.state as TaskDispositionState)
    ? input.state as TaskDispositionState
    : null;
  const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 1200) : '';
  const recordedBy = input.recordedBy === 'codex_foreman' ? 'codex_foreman' : 'operator';

  if (!state) {
    throw new Error('Task disposition state must be active, completed, archived, or abandoned.');
  }

  if (state !== 'active' && !reason) {
    throw new Error('A reason is required when completing, archiving, or abandoning a task.');
  }

  return {
    taskId,
    taskKind,
    state,
    reason,
    recordedAt: new Date().toISOString(),
    recordedBy,
    mutatesExternalSystems: false,
    mutatesLocalFiles: false,
    mutatesGit: false,
  };
}

function normalizeTaskDisposition(
  value: unknown,
  taskId: string,
  taskKind: TaskDisposition['taskKind']
): TaskDisposition | null {
  const disposition = value as Partial<TaskDisposition> | null;
  if (!disposition || typeof disposition !== 'object') return null;

  const allowedStates: TaskDispositionState[] = ['active', 'completed', 'archived', 'abandoned'];
  if (!allowedStates.includes(disposition.state as TaskDispositionState)) return null;

  return {
    taskId,
    taskKind,
    state: disposition.state as TaskDispositionState,
    reason: typeof disposition.reason === 'string' ? disposition.reason.slice(0, 1200) : '',
    recordedAt: typeof disposition.recordedAt === 'string' ? disposition.recordedAt : new Date().toISOString(),
    recordedBy: disposition.recordedBy === 'codex_foreman' ? 'codex_foreman' : 'operator',
    mutatesExternalSystems: false,
    mutatesLocalFiles: false,
    mutatesGit: false,
  };
}

function buildGitDispositionSummary(value: unknown, preflight?: GitSyncPreflight): GitDispositionSummary {
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

      // Git disposition decisions are only safe to reuse while the underlying
      // Git evidence is the same. This prevents a "keep local" decision made
      // for old local master commits from silently applying to a newer package
      // branch commit that should probably be merged before Jules starts.
      const expectedScope = preflight ? gitDispositionScopeKey(preflight, category) : null;
      if (expectedScope && candidate.scopeKey && candidate.scopeKey !== expectedScope) continue;

      byCategory.set(category, {
        category,
        label: definition.label,
        decision,
        decisionLabel: decision ? GIT_DISPOSITION_DECISION_LABELS[decision] : 'Not decided',
        note: typeof candidate.note === 'string' ? candidate.note : '',
        updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : null,
        scopeKey: typeof candidate.scopeKey === 'string' ? candidate.scopeKey : null,
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
      scopeKey: preflight ? gitDispositionScopeKey(preflight, definition.category) : null,
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

  if ((preflight.ahead ?? 0) > 0 && preflight.nextAction?.code === 'publish_or_merge_current_branch') {
    steps.push({
      kind: 'push',
      label: 'Publish or merge current branch',
      detail: `${decisionDetail(dispositionByCategory.get('local_commits'))} Push the branch if GitHub cannot see it yet, then open or merge a PR so ${preflight.remoteBranch} contains the intended base commit. Pushing the side branch alone does not clear this gate.`,
      command: commands.pushBase || null,
      destructive: true,
    });
  } else if ((preflight.ahead ?? 0) > 0) {
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
  const latestHandoff = selectHandoffForRouting(handoffs);
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

  const latestDraftTime = latestDraft ? timestampForRouting(latestDraft) : 0;
  const latestHandoffTime = latestHandoff ? timestampForRouting(latestHandoff) : 0;

  // Repair lanes can create a fresh local draft from an older Jules handoff.
  // When that happens the draft is the next actionable object, so it should
  // take the routing focus instead of leaving the dashboard stuck on the
  // external handoff that only discovered the failure.
  if (latestDraft && (!latestHandoff || latestDraftTime >= latestHandoffTime)) {
    return buildRoutingPlanForDraft(latestDraft, generatedAt, candidates);
  }

  return buildRoutingPlanForHandoff(latestHandoff!, generatedAt, candidates);
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
  const isSetupRepair = score.reasons.some(reason => /setup repair/i.test(reason));
  const nextAction: TaskRoutingNextAction = route === 'local_agent'
    ? {
        code: 'assign_local_agent',
        label: 'Assign local Codex agent',
        detail: isSetupRepair
          ? 'This setup repair should stay local first so the workflow failure is fixed before Jules receives more implementation feedback.'
          : 'This looks small enough that a local Codex worker is lower overhead than a Jules cloud handoff.',
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
      ? isSetupRepair
        ? 'Recommended route: local Codex agent for setup repair. Fix the workflow blocker locally before sending more instructions to Jules.'
        : 'Recommended route: local Codex agent. The task appears small, low-risk, and cheaper to handle locally.'
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
  const repairPushReadiness = handoff.repairPushReadiness;
  const latestOperatorAnswer = handoff.operatorAnswers[0] ?? null;
  if (
    repairPushReadiness
    && !handoff.repairPushResult
    && latestOperatorAnswer?.sourceStage === 'repair_push_approval'
    && latestOperatorAnswer.selectedAction === 'approve_repair_push'
  ) {
    const route: TaskRoutingPlan['route'] = 'ask_operator';
    const reasons = [
      'The prepared repair push has local operator approval.',
      'The push itself mutates GitHub and must still be performed outside this read-only routing packet.',
      `After the push, record the result with: ${repairPushReadiness.postPushFollowUp.refreshEndpoint.replace('/refresh-pr', '/repair-push-result')}.`,
    ];

    // Approval and execution are intentionally split. This routing branch keeps
    // the dashboard from re-asking the approval question while still refusing
    // to push or pretend GitHub checks can rerun before a push-result receipt.
    return {
      generatedAt,
      route,
      subjectId: handoff.id,
      subjectTitle: handoff.title,
      summary: 'Repair push approved locally. Run the external GitHub push, then record the repair push result before refreshing PR checks.',
      reasons,
      nextAction: {
        code: 'ask_operator',
        label: 'Record repair push result',
        detail: `Run the approved push command outside Symphony, then record whether it succeeded: ${repairPushReadiness.worktreeQualifiedPushCommand ?? repairPushReadiness.pushCommand}.`,
        pauseSeconds: 0,
        nextNudgeAt: null,
      },
      workerMode: buildWorkerModeRecommendation({
        route,
        subject: handoff,
        reasons,
        blocked: true,
        externalBoundary: true,
        dashboardStarted: handoff.status !== 'observed_pr',
      }),
      candidates,
    };
  }

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
  const setupRepair = text.includes('setup repair') || text.includes('setup/workflow blocker');
  const wantsJulesPlan = !setupRepair && (broadWords.some(word => text.includes(word)) || fileCount >= 4 || commandCount >= 2);
  const localEnough = setupRepair || (!wantsJulesPlan && fileCount <= 2 && smallWords.some(word => text.includes(word)));

  if (fileCount <= 2) reasons.push('Small write scope.');
  if (fileCount >= 4) reasons.push('Broad multi-file write scope.');
  if (commandCount >= 2) reasons.push('Multiple verification commands suggest a larger task.');
  if (smallWords.some(word => text.includes(word))) reasons.push('Draft wording describes a small local change.');
  if (setupRepair) reasons.push('Setup repair draft should be handled locally before Jules receives more implementation feedback.');
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

function selectHandoffForRouting(handoffs: JulesHandoff[]): JulesHandoff | null {
  // Task routing is a "what should the foreman look at next?" surface, not an
  // audit log. A closed or post-merge handoff can receive fresh bookkeeping
  // timestamps after the next package has already started. Rank the live
  // workflow boundary first so a Package 2 local-sync receipt cannot steal the
  // visible route from a Package 3 Jules session that still needs a PR.
  return [...handoffs].sort((a, b) => {
    const priorityDifference = handoffRoutingPriority(b) - handoffRoutingPriority(a);
    if (priorityDifference !== 0) return priorityDifference;

    return timestampForRouting(b) - timestampForRouting(a);
  })[0] ?? null;
}

function handoffRoutingPriority(handoff: JulesHandoff): number {
  if (handoff.status === 'observed_pr') return 1;

  if (!handoff.githubPullRequestUrl) return 5;

  if (
    handoff.julesState === 'AWAITING_PLAN_APPROVAL'
    || handoff.julesState === 'AWAITING_USER_FEEDBACK'
  ) {
    return 5;
  }

  if (handoff.githubPullRequestState !== 'MERGED' && handoff.githubPullRequestState !== 'CLOSED') {
    return 4;
  }

  if (handoff.githubPullRequestState === 'MERGED' && !handoff.localSyncStatus?.upToDate) {
    return 2;
  }

  return 0;
}

function timestampForRouting(item: { updatedAt?: string; createdAt?: string }): number {
  const timestamp = new Date(item.updatedAt || item.createdAt || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
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

function gitDispositionScopeKey(preflight: GitSyncPreflight, category: GitDispositionCategory): string {
  // The same category name can describe very different ownership questions over
  // time. Including the current branch, commits, counts, and visible samples
  // makes the saved decision expire when the evidence changes.
  const parts = [
    category,
    `branch=${preflight.currentBranch ?? 'unknown'}`,
    `base=${preflight.baseBranch}`,
    `remote=${preflight.remoteBranch}`,
    `local=${preflight.localCommit ?? 'unknown'}`,
    `github=${preflight.remoteCommit ?? 'unknown'}`,
  ];

  if (category === 'local_commits') parts.push(`ahead=${preflight.ahead ?? 'unknown'}`);
  if (category === 'remote_commits') parts.push(`behind=${preflight.behind ?? 'unknown'}`);
  if (category === 'tracked_changes') parts.push(`dirty=${preflight.dirtyFiles}`, ...preflight.dirtyFileSamples);
  if (category === 'untracked_artifacts') parts.push(`untracked=${preflight.untrackedFiles}`, ...preflight.untrackedFileSamples);

  return parts.join('|');
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
    githubPullRequestRepairDecision: null,
    delegationRoiEstimate: null,
    delegationRoiForemanUsage: [],
    delegationRoiLedger: null,
    handoffTimeline: null,
    julesStateReconciliation: null,
    operatorQuestion: null,
    operatorAnswers: [],
    repairLaneExecutions: [],
    repairPushReadiness: null,
    repairPushResult: null,
    deploymentEvidence: null,
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
    taskMessages: [],
    taskClarifications: normalizeTaskClarifications(draft.taskClarifications, draft.id, 'draft')
      .map(clarification => ({ ...clarification, taskId: runId, taskKind: 'handoff' as const })),
    taskDisposition: null,
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
  const handoffId = existing?.id ?? `observed-pr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // A watched PR is intentionally stored in the same handoff list as Jules PRs
  // so the dashboard can reuse the mature PR/check/risk/readiness panels. The
  // observed_pr status keeps launch, manifest, and local-sync claims honest.
  return {
    id: handoffId,
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
      taskDisposition: existing?.taskDisposition ?? null,
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
    githubPullRequestRepairDecision: existing?.githubPullRequestRepairDecision ?? null,
    delegationRoiEstimate: existing?.delegationRoiEstimate ?? null,
    delegationRoiForemanUsage: normalizeDelegationRoiForemanUsageList(existing?.delegationRoiForemanUsage, handoffId),
    delegationRoiLedger: existing?.delegationRoiLedger ?? null,
    handoffTimeline: existing?.handoffTimeline ?? null,
    julesStateReconciliation: existing?.julesStateReconciliation ?? null,
    operatorQuestion: existing?.operatorQuestion ?? null,
    operatorAnswers: Array.isArray(existing?.operatorAnswers) ? existing.operatorAnswers : [],
    repairLaneExecutions: Array.isArray(existing?.repairLaneExecutions) ? existing.repairLaneExecutions : [],
    repairPushReadiness: existing?.repairPushReadiness ?? null,
    repairPushResult: existing?.repairPushResult ?? null,
    deploymentEvidence: existing?.deploymentEvidence ?? null,
    githubPullRequestRefreshError: existing?.githubPullRequestRefreshError ?? null,
    lastPullRequestRefreshAt: existing?.lastPullRequestRefreshAt ?? null,
    ...commands,
    localSyncStatus: existing?.localSyncStatus ?? null,
    localSyncOutput: existing?.localSyncOutput ?? null,
    localSyncError: existing?.localSyncError ?? null,
    lastLocalSyncAt: existing?.lastLocalSyncAt ?? null,
    operatorMessages: existing?.operatorMessages ?? [],
    planApprovals: existing?.planApprovals ?? [],
    taskMessages: normalizeTaskMessages(existing?.taskMessages, handoffId, 'handoff'),
    taskClarifications: normalizeTaskClarifications(existing?.taskClarifications, handoffId, 'handoff'),
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

function normalizeDiscoveryToken(value: string | null | undefined): string | null {
  const normalized = normalizeDiscoveryText(value ?? '');
  return normalized || null;
}

function normalizeDiscoveryText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function orderDiscoveryReasons(reasons: string[]): string[] {
  const order = ['jules_session_id', 'linear_issue_identifier', 'handoff_title'];
  return order.filter(reason => reasons.includes(reason));
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
  const failedChecks: Array<{ name: string; detailsUrl: string | null }> = [];

  for (const check of checks) {
    const name = String(check.name ?? '');
    const conclusion = String(check.conclusion ?? '').toUpperCase();
    const status = String(check.status ?? '').toUpperCase();

    if (['SUCCESS', 'PASSED'].includes(conclusion)) passed += 1;
    else if (['FAILURE', 'FAILED', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED'].includes(conclusion)) {
      failed += 1;
      failedChecks.push({
        name: name || '(unnamed check)',
        detailsUrl: typeof check.detailsUrl === 'string' && check.detailsUrl ? check.detailsUrl : null,
      });
    }
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
    // Failed check names are kept as first-class evidence so the task page and
    // foreman packets can say "Build, Lint, Tests, Quality Scan failed"
    // without making the operator open raw GitHub JSON or infer names from a
    // broader setup-blocker paragraph.
    failedChecks,
    artifacts,
    blockers: classifyPullRequestCheckBlockers(failedChecks),
  };
}

function classifyPullRequestCheckBlockers(
  failedChecks: Array<{ name: string; detailsUrl: string | null }>
): PullRequestCheckBlocker[] {
  if (failedChecks.length === 0) return [];

  const failedNames = failedChecks.map(check => check.name);
  const normalizedNames = failedNames.map(name => name.toLowerCase());
  const hasBuild = normalizedNames.some(name => /build/.test(name));
  const hasLint = normalizedNames.some(name => /lint/.test(name));
  const hasTests = normalizedNames.some(name => /test/.test(name));
  const hasQuality = normalizedNames.some(name => /quality/.test(name));
  const hasReviewConfig = normalizedNames.some(name => /gemini|review/.test(name));

  if (hasBuild && hasLint && hasTests && hasQuality) {
    // When every npm-dependent CI lane fails together, the first useful
    // foreman action is log inspection for a shared setup/install problem.
    // This is a classification hint, not a proof of root cause; the details
    // links stay attached so a worker can verify the exact failing command.
    return [{
      category: 'workflow_setup',
      severity: 'blocking',
      checkNames: failedNames,
      evidence: failedChecks
        .map(check => check.detailsUrl ? `${check.name}: ${check.detailsUrl}` : check.name),
      summary: 'Build, lint, tests, and advisory quality scan failed together, which points first at a shared setup or dependency-install step.',
      nextAction: 'Inspect the failed check logs for the shared setup/install command before sending Jules implementation feedback.',
      mutatesExternalSystems: false,
    }];
  }

  if (hasReviewConfig) {
    return [{
      category: 'workflow_config',
      severity: 'blocking',
      checkNames: failedNames,
      evidence: failedChecks
        .map(check => check.detailsUrl ? `${check.name}: ${check.detailsUrl}` : check.name),
      summary: 'A review or automation check failed in a way that may belong to workflow configuration rather than the Jules code change.',
      nextAction: 'Inspect the review check configuration and logs before asking Jules to change task code.',
      mutatesExternalSystems: false,
    }];
  }

  return [{
    category: 'unknown',
    severity: 'blocking',
    checkNames: failedNames,
    evidence: failedChecks
      .map(check => check.detailsUrl ? `${check.name}: ${check.detailsUrl}` : check.name),
    summary: 'GitHub checks are failing, but Symphony cannot classify the owner from check names alone.',
    nextAction: 'Inspect failed check logs, then decide whether the fix belongs to Jules implementation, CI setup, or workflow configuration.',
    mutatesExternalSystems: false,
  }];
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

  if (scope.includes('*')) {
    // Expected-file entries often use lightweight glob patterns because a
    // Jules slice can legitimately own a family of files. Treat those globs as
    // review scope instead of marking every matching PR file out-of-scope.
    return globScopeMatchesChangedPath(scope, changed);
  }

  // A scope can be either a file (`src/foo.ts`) or a directory/prefix
  // (`src/components/CharacterCreator`). Treat either side containing the other
  // at a path boundary as in-scope so directory scopes remain ergonomic.
  return changed.startsWith(`${scope}/`) || scope.startsWith(`${changed}/`);
}

function globScopeMatchesChangedPath(scope: string, changed: string): boolean {
  // This intentionally supports only the glob shapes used in task write scopes:
  // `*` for one path segment and `**` for any nested path. It is not a shell;
  // it is a small review-boundary matcher for dashboard risk classification.
  const anyDepthToken = '___SYMPHONY_ANY_DEPTH___';
  const escaped = scope
    .replace(/\*\*/g, anyDepthToken)
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/]*')
    .replace(new RegExp(anyDepthToken, 'g'), '.*');

  return new RegExp(`^${escaped}$`).test(changed);
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
