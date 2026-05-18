// ============================================================================
// Config Layer
// ============================================================================
// Resolves raw YAML front matter from WORKFLOW.md into a fully typed
// ServiceConfig with defaults, $VAR expansion, path normalization, and
// validation.
//
// Based on SPEC Sections 5.3, 6.1, and 6.3.
// ============================================================================

import { resolve, dirname } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import type { RawWorkflowConfig, ServiceConfig } from './types.js';
import { ConfigValidationError } from './types.js';

// ---------------------------------------------------------------------------
// Default values (from spec Section 5.3)
// ---------------------------------------------------------------------------
const DEFAULTS = {
  tracker: {
    endpoint: 'https://api.linear.app/graphql',
    activeStates: ['Todo', 'In Progress'],
    terminalStates: ['Closed', 'Cancelled', 'Canceled', 'Duplicate', 'Done'],
    allowRawGraphql: false,
  },
  polling: {
    intervalMs: 30_000,
  },
  workspace: {
    // Default: <system-temp>/symphony_workspaces
    root: resolve(tmpdir(), 'symphony_workspaces'),
  },
  hooks: {
    timeoutMs: 60_000,
  },
  agent: {
    maxConcurrentAgents: 10,
    maxTurns: 20,
    maxRetryBackoffMs: 300_000, // 5 minutes
  },
  codex: {
    command: 'codex app-server',
    model: null as string | null,
    reasoningEffort: null as string | null,
    // Implementation-defined defaults — using safer Codex defaults
    approvalPolicy: 'on-failure',
    autoApproveAppTools: [] as string[],
    threadSandbox: 'workspace-write',
    turnSandboxPolicy: 'workspaceWrite',
    turnTimeoutMs: 3_600_000, // 1 hour
    readTimeoutMs: 5_000,
    stallTimeoutMs: 300_000, // 5 minutes
  },
} as const;

// ---------------------------------------------------------------------------
// $VAR expansion
// ---------------------------------------------------------------------------

/**
 * Expand $VAR_NAME references in a string value by looking up
 * environment variables. Only applies when the value explicitly
 * contains a $VAR pattern.
 */
function expandEnvVar(value: string): string {
  // Match $VAR_NAME patterns (letters, digits, underscores)
  return value.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_match, varName) => {
    return process.env[varName] ?? '';
  });
}

/**
 * Expand ~ to home directory and $VAR references in path values.
 * Then resolve relative paths against the workflow file's directory.
 */
function resolvePath(
  value: string,
  workflowDir: string
): string {
  // Expand ~ to home directory
  let expanded = value.replace(/^~/, homedir());

  // Expand $VAR references
  expanded = expandEnvVar(expanded);

  // Resolve relative paths against the workflow file directory
  if (!resolve(expanded).startsWith('/') && !expanded.match(/^[A-Za-z]:\\/)) {
    expanded = resolve(workflowDir, expanded);
  }

  return resolve(expanded);
}

// ---------------------------------------------------------------------------
// Config resolution pipeline (Section 6.1)
// ---------------------------------------------------------------------------

/**
 * Resolve raw YAML config into a fully typed ServiceConfig.
 *
 * Resolution order:
 * 1. Parse raw config map
 * 2. Apply defaults for missing optional fields
 * 3. Resolve $VAR_NAME for values that contain them
 * 4. Coerce and validate typed values
 *
 * @param raw - Raw config from YAML front matter
 * @param workflowDir - Directory containing WORKFLOW.md (for relative paths)
 */
export function resolveConfig(
  raw: RawWorkflowConfig,
  workflowDir: string
): ServiceConfig {
  // --- Tracker ---
  const trackerKind = raw.tracker?.kind ?? '';
  const trackerEndpoint =
    raw.tracker?.endpoint ?? DEFAULTS.tracker.endpoint;

  // API key: resolve $VAR indirection, or fall back to LINEAR_API_KEY env
  let trackerApiKey = raw.tracker?.api_key ?? '';
  if (trackerApiKey.startsWith('$') || trackerApiKey === '') {
    trackerApiKey = trackerApiKey
      ? expandEnvVar(trackerApiKey)
      : (process.env.LINEAR_API_KEY ?? '');
  }

  const trackerProjectSlug = raw.tracker?.project_slug ?? '';
  const activeStates =
    raw.tracker?.active_states ?? [...DEFAULTS.tracker.activeStates];
  const terminalStates =
    raw.tracker?.terminal_states ?? [...DEFAULTS.tracker.terminalStates];
  const allowRawGraphql =
    raw.tracker?.allow_raw_graphql ?? DEFAULTS.tracker.allowRawGraphql;

  // --- Polling ---
  const pollingIntervalMs =
    raw.polling?.interval_ms ?? DEFAULTS.polling.intervalMs;

  // --- Workspace ---
  const workspaceRoot = raw.workspace?.root
    ? resolvePath(raw.workspace.root, workflowDir)
    : DEFAULTS.workspace.root;

  // --- Hooks ---
  const hooksTimeoutMs =
    raw.hooks?.timeout_ms ?? DEFAULTS.hooks.timeoutMs;

  // --- Agent ---
  const maxConcurrentAgents =
    raw.agent?.max_concurrent_agents ?? DEFAULTS.agent.maxConcurrentAgents;
  const maxTurns = raw.agent?.max_turns ?? DEFAULTS.agent.maxTurns;
  const maxRetryBackoffMs =
    raw.agent?.max_retry_backoff_ms ?? DEFAULTS.agent.maxRetryBackoffMs;

  // Per-state concurrency map: normalize keys to lowercase, filter invalid
  const maxConcurrentAgentsByState = new Map<string, number>();
  if (raw.agent?.max_concurrent_agents_by_state) {
    for (const [state, limit] of Object.entries(
      raw.agent.max_concurrent_agents_by_state
    )) {
      const parsed = Number(limit);
      if (Number.isFinite(parsed) && parsed > 0) {
        maxConcurrentAgentsByState.set(state.toLowerCase(), parsed);
      }
    }
  }

  // --- Codex ---
  const codexCommand = raw.codex?.command ?? DEFAULTS.codex.command;
  const model =
    raw.codex?.model === undefined
      ? DEFAULTS.codex.model
      : normalizeOptionalCodexString(raw.codex.model);
  const reasoningEffort =
    raw.codex?.reasoning_effort === undefined
      ? DEFAULTS.codex.reasoningEffort
      : normalizeOptionalCodexString(raw.codex.reasoning_effort);
  const approvalPolicy =
    raw.codex?.approval_policy ?? DEFAULTS.codex.approvalPolicy;
  const autoApproveAppTools =
    raw.codex?.auto_approve_app_tools ?? [...DEFAULTS.codex.autoApproveAppTools];
  const threadSandbox =
    raw.codex?.thread_sandbox ?? DEFAULTS.codex.threadSandbox;
  const turnSandboxPolicy =
    raw.codex?.turn_sandbox_policy ?? DEFAULTS.codex.turnSandboxPolicy;
  const turnTimeoutMs =
    raw.codex?.turn_timeout_ms ?? DEFAULTS.codex.turnTimeoutMs;
  const readTimeoutMs =
    raw.codex?.read_timeout_ms ?? DEFAULTS.codex.readTimeoutMs;
  const stallTimeoutMs =
    raw.codex?.stall_timeout_ms ?? DEFAULTS.codex.stallTimeoutMs;

  // --- Server ---
  const serverPort = (raw as Record<string, unknown>).server
    ? ((raw as Record<string, unknown>).server as { port?: number }).port ??
      null
    : null;

  return {
    tracker: {
      kind: trackerKind,
      endpoint: trackerEndpoint,
      apiKey: trackerApiKey,
      projectSlug: trackerProjectSlug,
      activeStates,
      terminalStates,
      allowRawGraphql,
    },
    polling: { intervalMs: pollingIntervalMs },
    workspace: { root: workspaceRoot },
    hooks: {
      afterCreate: raw.hooks?.after_create ?? null,
      beforeRun: raw.hooks?.before_run ?? null,
      afterRun: raw.hooks?.after_run ?? null,
      beforeRemove: raw.hooks?.before_remove ?? null,
      timeoutMs: hooksTimeoutMs,
    },
    agent: {
      maxConcurrentAgents,
      maxTurns,
      maxRetryBackoffMs,
      maxConcurrentAgentsByState,
    },
    codex: {
      command: codexCommand,
      model,
      reasoningEffort,
      approvalPolicy,
      autoApproveAppTools,
      threadSandbox,
      turnSandboxPolicy,
      turnTimeoutMs,
      readTimeoutMs,
      stallTimeoutMs,
    },
    server: { port: serverPort },
  };
}

function normalizeOptionalCodexString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

// ---------------------------------------------------------------------------
// Dispatch preflight validation (Section 6.3)
// ---------------------------------------------------------------------------

/**
 * Validate the resolved config before allowing dispatch.
 * Throws ConfigValidationError on failure.
 *
 * Checks:
 * - tracker.kind is present and supported
 * - tracker.apiKey is present after $VAR resolution
 * - tracker.projectSlug is present when required
 * - codex.command is present and non-empty
 * - hooks.timeoutMs is valid
 * - agent.maxTurns is valid
 */
export function validateDispatchConfig(config: ServiceConfig): void {
  if (!config.tracker.kind) {
    throw new ConfigValidationError(
      'missing_tracker_kind',
      'tracker.kind is required for dispatch'
    );
  }

  if (config.tracker.kind !== 'linear' && config.tracker.kind !== 'mock') {
    throw new ConfigValidationError(
      'unsupported_tracker_kind',
      `Unsupported tracker kind: "${config.tracker.kind}" (only "linear" and "mock" are supported)`
    );
  }

  if (config.tracker.kind === 'linear' && !config.tracker.apiKey) {
    throw new ConfigValidationError(
      'missing_tracker_api_key',
      'tracker.api_key is required (set LINEAR_API_KEY env or add to WORKFLOW.md)'
    );
  }

  if (config.tracker.kind === 'linear' && !config.tracker.projectSlug) {
    throw new ConfigValidationError(
      'missing_tracker_project_slug',
      'tracker.project_slug is required when tracker.kind is "linear"'
    );
  }

  if (!config.codex.command) {
    throw new ConfigValidationError(
      'missing_codex_command',
      'codex.command must be a non-empty string'
    );
  }

  if (
    config.hooks.timeoutMs !== undefined &&
    (typeof config.hooks.timeoutMs !== 'number' || config.hooks.timeoutMs <= 0)
  ) {
    throw new ConfigValidationError(
      'invalid_hook_timeout',
      `hooks.timeout_ms must be a positive number, got: ${config.hooks.timeoutMs}`
    );
  }

  if (
    typeof config.agent.maxTurns !== 'number' ||
    config.agent.maxTurns <= 0
  ) {
    throw new ConfigValidationError(
      'invalid_max_turns',
      `agent.max_turns must be a positive number, got: ${config.agent.maxTurns}`
    );
  }
}
