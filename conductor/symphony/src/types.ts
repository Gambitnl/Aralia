// ============================================================================
// Symphony Type Definitions
// ============================================================================
// All domain types used across the Symphony orchestrator.
// Based on Section 4 of the Symphony SPEC.md.
// ============================================================================

// ---------------------------------------------------------------------------
// 4.1.1 — Normalized issue record from the tracker
// ---------------------------------------------------------------------------
export interface Issue {
  /** Stable tracker-internal ID (Linear's UUID) */
  id: string;
  /** Human-readable ticket key, e.g. "ABC-123" */
  identifier: string;
  title: string;
  description: string | null;
  /** Lower = higher priority; null = sorts last */
  priority: number | null;
  /** Current tracker state name, e.g. "Todo", "In Progress" */
  state: string;
  /** Tracker-provided branch name if available */
  branchName: string | null;
  url: string | null;
  /** All labels, normalized to lowercase */
  labels: string[];
  /** Issues that block this one */
  blockedBy: BlockerRef[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface BlockerRef {
  id: string | null;
  identifier: string | null;
  state: string | null;
}

// ---------------------------------------------------------------------------
// 4.1.2 — Parsed WORKFLOW.md payload
// ---------------------------------------------------------------------------
export interface WorkflowDefinition {
  /** YAML front matter root object */
  config: RawWorkflowConfig;
  /** Markdown body after front matter, trimmed */
  promptTemplate: string;
}

// ---------------------------------------------------------------------------
// Raw config from YAML front matter (before typed resolution)
// ---------------------------------------------------------------------------
export interface RawWorkflowConfig {
  tracker?: {
    kind?: string;
    endpoint?: string;
    api_key?: string;
    project_slug?: string;
    active_states?: string[];
    terminal_states?: string[];
    allow_raw_graphql?: boolean;
  };
  polling?: {
    interval_ms?: number;
  };
  workspace?: {
    root?: string;
  };
  hooks?: {
    after_create?: string;
    before_run?: string;
    after_run?: string;
    before_remove?: string;
    timeout_ms?: number;
  };
  agent?: {
    max_concurrent_agents?: number;
    max_turns?: number;
    max_retry_backoff_ms?: number;
    max_concurrent_agents_by_state?: Record<string, number>;
  };
  codex?: {
    command?: string;
    model?: string | null;
    reasoning_effort?: string | null;
    approval_policy?: string;
    auto_approve_app_tools?: string[];
    thread_sandbox?: string;
    turn_sandbox_policy?: string;
    turn_timeout_ms?: number;
    read_timeout_ms?: number;
    stall_timeout_ms?: number;
  };
  server?: {
    port?: number;
  };
  // Unknown keys are allowed for forward compatibility
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// 4.1.3 — Fully resolved, typed service config
// ---------------------------------------------------------------------------
export interface ServiceConfig {
  tracker: {
    kind: string;
    endpoint: string;
    apiKey: string;
    projectSlug: string;
    activeStates: string[];
    terminalStates: string[];
    allowRawGraphql: boolean;
  };
  polling: {
    intervalMs: number;
  };
  workspace: {
    root: string;
  };
  hooks: {
    afterCreate: string | null;
    beforeRun: string | null;
    afterRun: string | null;
    beforeRemove: string | null;
    timeoutMs: number;
  };
  agent: {
    maxConcurrentAgents: number;
    maxTurns: number;
    maxRetryBackoffMs: number;
    maxConcurrentAgentsByState: Map<string, number>;
  };
  codex: {
    command: string;
    /** Optional Codex model override for Symphony-launched worker threads. */
    model: string | null;
    /** Optional Codex reasoning effort override for Symphony-launched worker turns. */
    reasoningEffort: string | null;
    approvalPolicy: string;
    /** App tools that Symphony may run without human approval, e.g. "linear.save_comment" */
    autoApproveAppTools: string[];
    threadSandbox: string;
    turnSandboxPolicy: string;
    turnTimeoutMs: number;
    readTimeoutMs: number;
    stallTimeoutMs: number;
  };
  server: {
    port: number | null;
  };
}

// ---------------------------------------------------------------------------
// 4.1.4 — Workspace record
// ---------------------------------------------------------------------------
export interface Workspace {
  /** Absolute workspace path */
  path: string;
  /** Sanitized issue identifier used as directory name */
  workspaceKey: string;
  /** True only if the directory was created during this call */
  createdNow: boolean;
}

// ---------------------------------------------------------------------------
// 4.1.5 — One execution attempt for one issue
// ---------------------------------------------------------------------------
export type RunStatus =
  | 'preparing_workspace'
  | 'building_prompt'
  | 'launching_agent'
  | 'initializing_session'
  | 'streaming_turn'
  | 'finishing'
  | 'succeeded'
  | 'failed'
  | 'timed_out'
  | 'stalled'
  | 'canceled_by_reconciliation';

export interface RunAttempt {
  issueId: string;
  issueIdentifier: string;
  /** null for first run, >= 1 for retries/continuation */
  attempt: number | null;
  workspacePath: string;
  startedAt: Date;
  status: RunStatus;
  error?: string;
}

// ---------------------------------------------------------------------------
// Symphony-assigned worker identity
// ---------------------------------------------------------------------------
export interface WorkerDesignation {
  /** Human-readable callsign for one launched worker process */
  designation: string;
  /** Monotonic local run number assigned by this Symphony process */
  runNumber: number;
  /** The retry/continuation attempt value that triggered this worker */
  attempt: number | null;
  /** Issue that this worker is allowed to act on */
  issueIdentifier: string;
  /** Workspace path once the worker has one */
  workspacePath: string | null;
  /** Codex thread id once app-server creates it */
  threadId: string | null;
  /** Codex model Symphony asked this worker to use, or null for the app-server default */
  model: string | null;
  /** Codex reasoning effort Symphony asked this worker to use, or null for the app-server default */
  reasoningEffort: string | null;
  /** Timestamp when Symphony claimed the issue for this worker run */
  startedAt: Date;
}

// ---------------------------------------------------------------------------
// 4.1.5b — Pending human approval for a paused worker
// ---------------------------------------------------------------------------
export interface PendingApproval {
  /** JSON-RPC request id that the app-server is waiting for */
  requestId: number | string;
  /** App-server method that determines the response shape */
  method: string;
  /** Short operator-facing title for the blocked action */
  title: string;
  /** Full enough detail for the human to decide without opening raw JSON */
  detail: string;
  /** ISO timestamp for when Symphony first saw the request */
  requestedAt: string;
  /** Original request params retained so the runner can answer correctly */
  params: Record<string, unknown>;
  /** False when Symphony can explain the request but does not know how to answer it safely */
  canRespond: boolean;
}

// ---------------------------------------------------------------------------
// 4.1.6 — Live session metadata while a coding agent is running
// ---------------------------------------------------------------------------
export interface LiveSession {
  sessionId: string;
  threadId: string;
  turnId: string;
  codexAppServerPid: string | null;
  lastCodexEvent: string | null;
  lastCodexTimestamp: Date | null;
  lastCodexMessage: string;
  codexInputTokens: number;
  codexOutputTokens: number;
  codexTotalTokens: number;
  lastReportedInputTokens: number;
  lastReportedOutputTokens: number;
  lastReportedTotalTokens: number;
  turnCount: number;
}

// ---------------------------------------------------------------------------
// 4.1.7 — Retry queue entry
// ---------------------------------------------------------------------------
export interface RetryEntry {
  issueId: string;
  /** Best-effort human ID for status/logs */
  identifier: string;
  /** Last worker identity that touched this issue before retry was scheduled */
  workerDesignation: WorkerDesignation | null;
  /** 1-based attempt number */
  attempt: number;
  /** Monotonic timestamp (ms) when retry should fire */
  dueAtMs: number;
  /** Runtime timer handle for cancellation */
  timerHandle: ReturnType<typeof setTimeout>;
  error: string | null;
  /** Last known workspace, kept so retry pages can still show touched files */
  workspacePath: string | null;
  /** Last worker event before the worker stopped or entered retry */
  lastCodexEvent: string | null;
  /** Short human-readable payload preview from the last worker event */
  lastCodexMessage: string | null;
  /** Timestamp for the last human-readable worker message, excluding raw protocol noise */
  lastReadableCodexTimestamp: Date | null;
  /** Timestamp of the last worker event, used to explain stalls */
  lastCodexTimestamp: Date | null;
  /** Bounded event trail retained for the issue detail API */
  recentCodexEvents: CodexEvent[];
  /** True when Codex paused on a tool or file action that needs approval */
  waitingOnApproval: boolean;
  /** Short description of the approval-blocked action, if known */
  approvalSummary: string | null;
  /** Pending approval request, if a stopped worker left one visible */
  pendingApproval: PendingApproval | null;
}

// ---------------------------------------------------------------------------
// 4.1.8 — Running entry in the orchestrator state
// ---------------------------------------------------------------------------
export interface RunningEntry {
  workerHandle: AbortController;
  identifier: string;
  /** Symphony-assigned identity for this concrete worker run */
  workerDesignation: WorkerDesignation;
  issue: Issue;
  sessionId: string | null;
  codexAppServerPid: string | null;
  lastCodexMessage: string | null;
  /** Timestamp for the current headline message shown to humans */
  lastReadableCodexTimestamp: Date | null;
  lastCodexEvent: string | null;
  lastCodexTimestamp: Date | null;
  codexInputTokens: number;
  codexOutputTokens: number;
  codexTotalTokens: number;
  lastReportedInputTokens: number;
  lastReportedOutputTokens: number;
  lastReportedTotalTokens: number;
  retryAttempt: number;
  /** Workspace path is recorded once created so the dashboard can link agent activity to files */
  workspacePath: string | null;
  /** Last failure text, if the worker has reported one before exiting */
  lastError: string | null;
  /** Bounded event trail that lets humans see what the worker is doing right now */
  recentCodexEvents: CodexEvent[];
  /** True when Codex paused on a tool or file action that needs approval */
  waitingOnApproval: boolean;
  /** Short description of the approval-blocked action, if known */
  approvalSummary: string | null;
  /** Pending approval request that can be answered through the dashboard */
  pendingApproval: PendingApproval | null;
  startedAt: Date;
  turnCount: number;
}

// ---------------------------------------------------------------------------
// 4.1.8 — Orchestrator runtime state
// ---------------------------------------------------------------------------
export interface OrchestratorState {
  pollIntervalMs: number;
  maxConcurrentAgents: number;
  running: Map<string, RunningEntry>;
  claimed: Set<string>;
  retryAttempts: Map<string, RetryEntry>;
  completed: Set<string>;
  codexTotals: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    secondsRunning: number;
  };
  codexRateLimits: unknown | null;
}

// ---------------------------------------------------------------------------
// Codex app-server events emitted upstream to orchestrator
// ---------------------------------------------------------------------------
export type CodexEventType =
  | 'session_started'
  | 'startup_failed'
  | 'turn_completed'
  | 'turn_failed'
  | 'turn_cancelled'
  | 'turn_ended_with_error'
  | 'turn_input_required'
  | 'approval_requested'
  | 'approval_auto_approved'
  | 'unsupported_tool_call'
  | 'notification'
  | 'other_message'
  | 'malformed';

export interface CodexEvent {
  event: CodexEventType;
  timestamp: Date;
  codexAppServerPid?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  payload?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Human-facing activity entries rendered by the dashboard
// ---------------------------------------------------------------------------
export interface ActivityEntry {
  /** ISO timestamp for ordering and display */
  timestamp: string;
  /** Broad category used for dashboard labels */
  kind:
    | 'lifecycle'
    | 'assistant_message'
    | 'reasoning_summary'
    | 'tool_call'
    | 'command'
    | 'file_change'
    | 'approval'
    | 'usage'
    | 'status'
    | 'result'
    | 'event';
  /** Short line shown in the feed */
  title: string;
  /** Optional detail text shown below the title */
  detail: string | null;
  /** Optional status from the app-server item */
  status?: string | null;
  /** Optional raw source type for debugging parser gaps */
  source_type?: string | null;
}

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------
export type WorkflowErrorCode =
  | 'missing_workflow_file'
  | 'workflow_parse_error'
  | 'workflow_front_matter_not_a_map'
  | 'template_parse_error'
  | 'template_render_error';

export class WorkflowError extends Error {
  constructor(
    public readonly code: WorkflowErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'WorkflowError';
  }
}

export type ConfigValidationErrorCode =
  | 'missing_tracker_kind'
  | 'unsupported_tracker_kind'
  | 'missing_tracker_api_key'
  | 'missing_tracker_project_slug'
  | 'missing_codex_command'
  | 'invalid_hook_timeout'
  | 'invalid_max_turns';

export class ConfigValidationError extends Error {
  constructor(
    public readonly code: ConfigValidationErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

// ---------------------------------------------------------------------------
// Tracker error types
// ---------------------------------------------------------------------------
export type TrackerErrorCode =
  | 'unsupported_tracker_kind'
  | 'missing_tracker_api_key'
  | 'missing_tracker_project_slug'
  | 'linear_api_request'
  | 'linear_api_status'
  | 'linear_graphql_errors'
  | 'linear_unknown_payload'
  | 'linear_missing_end_cursor';

export class TrackerError extends Error {
  constructor(
    public readonly code: TrackerErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'TrackerError';
  }
}

// ---------------------------------------------------------------------------
// Agent runner error types
// ---------------------------------------------------------------------------
export type AgentErrorCode =
  | 'codex_not_found'
  | 'invalid_workspace_cwd'
  | 'response_timeout'
  | 'turn_timeout'
  | 'port_exit'
  | 'response_error'
  | 'unsupported_approval'
  | 'turn_failed'
  | 'turn_cancelled'
  | 'turn_input_required';

export class AgentError extends Error {
  constructor(
    public readonly code: AgentErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'AgentError';
  }
}
