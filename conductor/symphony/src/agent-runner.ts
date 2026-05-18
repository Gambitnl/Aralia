// ============================================================================
// Agent Runner — Codex App-Server Client
// ============================================================================
// Manages the Codex app-server subprocess lifecycle:
// - Launching the subprocess in the workspace directory
// - Initializing sessions via JSON-over-stdio protocol
// - Running turns and streaming events to the orchestrator
// - Handling approvals, tool calls, and timeouts
//
// Based on SPEC Sections 10.1–10.7.
//
// IMPORTANT: The exact Codex app-server protocol is the source of truth.
// This implementation targets the known JSON-line protocol over stdio.
// ============================================================================

import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import type {
  Issue,
  CodexEvent,
  CodexEventType,
  PendingApproval,
  ServiceConfig,
  WorkerDesignation,
} from './types.js';
import { AgentError } from './types.js';
import { Logger } from './logger.js';

// ---------------------------------------------------------------------------
// Types for the app-server protocol messages
// ---------------------------------------------------------------------------

/** Outbound message to the app-server (we send these) */
interface AppServerRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

/** Inbound response from the app-server */
interface AppServerResponse {
  jsonrpc: '2.0';
  id: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string; data?: unknown };
}

/** Inbound notification (no id) from the app-server */
interface AppServerNotification {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
}

type AppServerMessage = AppServerResponse | AppServerNotification;

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------
export interface SessionState {
  process: ChildProcess;
  threadId: string | null;
  turnId: string | null;
  nextRequestId: number;
  notificationHandlers: Set<(msg: AppServerNotification) => void>;
  pendingRequests: Map<
    number,
    {
      resolve: (result: Record<string, unknown>) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >;
}

// ---------------------------------------------------------------------------
// Agent Runner
// ---------------------------------------------------------------------------
export class AgentRunner {
  private config: ServiceConfig;
  private codexConfig: ServiceConfig['codex'];
  private log: Logger;

  constructor(config: ServiceConfig, logger: Logger) {
    this.config = config;
    this.codexConfig = config.codex;
    this.log = logger.child({ component: 'agent_runner' });
  }

  // -------------------------------------------------------------------------
  // Session lifecycle (Section 10.2)
  // -------------------------------------------------------------------------

  /**
   * Start a Codex app-server session in the given workspace.
   *
   * Launches the subprocess, initializes the session, and returns
   * a session handle for running turns.
   */
  async startSession(
    workspacePath: string,
    signal?: AbortSignal
  ): Promise<SessionState> {
    this.log.info('Launching Codex app-server', {
      command: this.codexConfig.command,
      workspace: workspacePath,
    });

    // Launch the subprocess (Section 10.1)
    // On Windows we need shell: true for .cmd wrappers
    const isWindows = process.platform === 'win32';
    const child = isWindows
      ? spawn(this.codexConfig.command, [], {
          cwd: workspacePath,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
        })
      : spawn('bash', ['-lc', this.codexConfig.command], {
          cwd: workspacePath,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

    // Handle abort signal
    if (signal) {
      signal.addEventListener('abort', () => {
        child.kill('SIGTERM');
      });
    }

    const session: SessionState = {
      process: child,
      threadId: null,
      turnId: null,
      nextRequestId: 1,
      notificationHandlers: new Set(),
      pendingRequests: new Map(),
    };

    // Set up message handling from stdout (JSON lines)
    const rl = createInterface({ input: child.stdout! });
    rl.on('line', (line) => {
      this.handleMessage(session, line);
    });

    // Log stderr separately (not protocol traffic)
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) {
        this.log.debug('Codex stderr', {
          output: text.slice(0, 500),
        });
      }
    });

    // Wait for process to be ready, then initialize
    await new Promise<void>((resolve, reject) => {
      child.on('error', (err) => {
        reject(
          new AgentError('codex_not_found', `Failed to start Codex: ${err.message}`)
        );
      });

      // Give it a moment to start up, then try to initialize
      const startupTimer = setTimeout(() => {
        if (child.exitCode !== null) {
          reject(
            new AgentError(
              'codex_not_found',
              `Codex process exited immediately with code ${child.exitCode}`
            )
          );
        } else {
          resolve();
        }
      }, 1000);

      child.on('exit', (code) => {
        clearTimeout(startupTimer);
        if (session.threadId === null) {
          reject(
            new AgentError(
              'port_exit',
              `Codex process exited before initialization with code ${code}`
            )
          );
        }
      });
    });

    // Initialize the session — create a thread
    try {
      const initResult = await this.sendRequest(session, 'initialize', {
        clientInfo: {
          name: 'symphony',
          version: '0.1.0',
        },
        capabilities: {
          experimentalApi: true,
        },
      });

      this.log.info('Session initialized', { result: JSON.stringify(initResult).slice(0, 200) });

      // Create the app-server thread in the per-issue workspace. The current
      // Codex schema calls this `thread/start`; the old mock-only path used
      // `thread/create`, which real Codex no longer accepts.
      this.sendNotification(session, 'initialized', {});
      const threadResult = await this.sendRequest(session, 'thread/start', {
        cwd: workspacePath,
        // The app-server accepts a thread-level model. Reasoning effort is a
        // turn-level field, so it is applied below when the worker actually
        // starts its foreman turn.
        model: this.codexConfig.model ?? undefined,
        approvalPolicy: this.codexConfig.approvalPolicy,
        sandbox: this.codexConfig.threadSandbox,
        config: this.buildAppToolApprovalConfig(),
        serviceName: 'symphony',
        threadSource: 'user',
      });

      session.threadId = this.extractThreadId(threadResult);
      if (!session.threadId) {
        throw new AgentError(
          'response_error',
          `Codex thread/start response did not include a thread id: ${JSON.stringify(threadResult).slice(0, 200)}`
        );
      }

      this.log.info('Thread created', { threadId: session.threadId });
    } catch (err) {
      child.kill('SIGTERM');
      throw new AgentError(
        'response_error',
        `Failed to initialize Codex session: ${(err as Error).message}`
      );
    }

    return session;
  }

  // -------------------------------------------------------------------------
  // Turn execution (Section 10.3)
  // -------------------------------------------------------------------------

  /**
   * Run a single coding-agent turn with the given prompt.
   *
   * Streams events to the onEvent callback during execution.
   * Returns when the turn completes, fails, or times out.
   */
  async runTurn(
    session: SessionState,
    prompt: string,
    issue: Issue,
    workerDesignation: WorkerDesignation | null,
    onEvent: (event: CodexEvent) => void
  ): Promise<{ success: boolean; error?: string }> {
    if (!session.threadId) {
      throw new AgentError(
        'response_error',
        'Cannot run turn: no thread ID (session not initialized)'
      );
    }

    this.log.info('Starting turn', {
      issueIdentifier: issue.identifier,
      workerDesignation: workerDesignation?.designation,
      threadId: session.threadId,
    });

    // Start a turn on the existing thread
    try {
      const turnResult = await this.sendRequest(session, 'turn/start', {
        threadId: session.threadId,
        input: [{ type: 'text', text: prompt }],
        cwd: undefined, // The thread already owns the per-issue workspace cwd.
        // Keep model/effort explicit on each turn so a workflow reload affects
        // later turns without needing to restart the whole Symphony process.
        model: this.codexConfig.model ?? undefined,
        effort: this.codexConfig.reasoningEffort ?? undefined,
        approvalPolicy: this.codexConfig.approvalPolicy,
        sandboxPolicy: this.codexConfig.turnSandboxPolicy
          ? { type: this.codexConfig.turnSandboxPolicy }
          : undefined,
      });

      session.turnId = this.extractTurnId(turnResult);
      if (!session.turnId) {
        return {
          success: false,
          error: `turn/start response did not include a turn id: ${JSON.stringify(turnResult).slice(0, 200)}`,
        };
      }
    } catch (err) {
      return {
        success: false,
        error: `Failed to start turn: ${(err as Error).message}`,
      };
    }

    // Wait for the turn to complete by processing events
    return new Promise((resolve) => {
      let turnCompleted = false;
      const turnTimeout = setTimeout(() => {
        if (!turnCompleted) {
          turnCompleted = true;
          this.log.warn('Turn timed out', {
            timeoutMs: this.codexConfig.turnTimeoutMs,
          });
          session.notificationHandlers.delete(turnEventHandler);
          resolve({
            success: false,
            error: `Turn timed out after ${this.codexConfig.turnTimeoutMs}ms`,
          });
        }
      }, this.codexConfig.turnTimeoutMs);

      // The session-level reader already owns stdout. This per-turn handler
      // receives parsed notifications from handleMessage so real Codex events
      // cannot be swallowed by a competing readline consumer.
      const turnEventHandler = (msg: AppServerNotification) => {
        if (turnCompleted) return;

        try {
          const event = this.classifyEvent(msg);
          onEvent(event);

            // Check for turn completion events
            if (
              event.event === 'turn_completed' ||
              event.event === 'turn_failed' ||
              event.event === 'turn_cancelled' ||
              event.event === 'turn_ended_with_error' ||
              event.event === 'turn_input_required'
            ) {
              turnCompleted = true;
              clearTimeout(turnTimeout);
              session.notificationHandlers.delete(turnEventHandler);

              const success = event.event === 'turn_completed';
              resolve({
                success,
                error: success ? undefined : event.event,
              });
            }

            // Keep old and new approval protocol paths alive. Older mock
            // integrations emitted `approval/request`; current Codex app-server
            // sends JSON-RPC server requests such as
            // `item/commandExecution/requestApproval` and waits for the client
            // to respond with the same request id.
            if (msg.method === 'approval/request' && msg.params) {
              this.handleLegacyApproval(session, msg.params);
            }

            // Handle tool calls
            if (msg.method === 'tool/call' && msg.params) {
              this.handleToolCall(session, msg.params).catch(err => {
                this.log.error('Error handling tool call', { error: err.message });
              });
            }
        } catch {
          // Malformed JSON line — log and continue
          this.log.debug('Malformed message from Codex', {
            method: msg.method,
          });
        }
      };

      session.notificationHandlers.add(turnEventHandler);

      // Handle process exit during turn
      session.process.on('exit', (code) => {
        if (!turnCompleted) {
          turnCompleted = true;
          clearTimeout(turnTimeout);
          session.notificationHandlers.delete(turnEventHandler);
          resolve({
            success: false,
            error: `Codex process exited with code ${code} during turn`,
          });
        }
      });
    });
  }

  // -------------------------------------------------------------------------
  // Session shutdown
  // -------------------------------------------------------------------------

  /**
   * Stop an app-server session and kill the subprocess.
   */
  async stopSession(session: SessionState): Promise<void> {
    this.log.info('Stopping Codex session');

    // Cancel all pending requests
    for (const [, pending] of session.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Session stopped'));
    }
    session.pendingRequests.clear();

    // Kill the process
    if (session.process.exitCode === null) {
      session.process.kill('SIGTERM');

      // Give it a moment to exit gracefully
      await new Promise<void>((resolve) => {
        const forceKillTimer = setTimeout(() => {
          if (session.process.exitCode === null) {
            session.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        session.process.on('exit', () => {
          clearTimeout(forceKillTimer);
          resolve();
        });
      });
    }
  }

  // -------------------------------------------------------------------------
  // JSON-RPC message handling
  // -------------------------------------------------------------------------

  /**
   * Send a JSON-RPC request and wait for a response.
   */
  private sendRequest(
    session: SessionState,
    method: string,
    params?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const id = session.nextRequestId++;
      const request: AppServerRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      const timer = setTimeout(() => {
        session.pendingRequests.delete(id);
        reject(
          new AgentError(
            'response_timeout',
            `Request ${method} timed out after ${this.codexConfig.readTimeoutMs}ms`
          )
        );
      }, this.codexConfig.readTimeoutMs);

      session.pendingRequests.set(id, { resolve, reject, timer });

      // Write the JSON-RPC message as a single line to stdin
      const line = JSON.stringify(request) + '\n';
      session.process.stdin!.write(line, (err) => {
        if (err) {
          clearTimeout(timer);
          session.pendingRequests.delete(id);
          reject(
            new AgentError(
              'response_error',
              `Failed to write to Codex stdin: ${err.message}`
            )
          );
        }
      });
    });
  }

  /**
   * Send a JSON-RPC notification. Notifications do not receive responses, so
   * they are used only for protocol lifecycle messages such as `initialized`.
   */
  private sendNotification(
    session: SessionState,
    method: string,
    params?: Record<string, unknown>
  ): void {
    const line = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
    }) + '\n';
    session.process.stdin!.write(line);
  }

  /**
   * Extract thread identity from both the current Codex schema and the older
   * mock shape. The fallback preserves compatibility with previous local
   * experiments while the primary path follows `thread/start`.
   */
  private extractThreadId(result: Record<string, unknown>): string | null {
    const thread = result.thread as Record<string, unknown> | undefined;
    return (thread?.id as string | undefined) ?? (result.thread_id as string | undefined) ?? null;
  }

  /**
   * Extract turn identity from both the current Codex schema and the older mock
   * shape. Real app-server returns `result.turn.id`.
   */
  private extractTurnId(result: Record<string, unknown>): string | null {
    const turn = result.turn as Record<string, unknown> | undefined;
    return (turn?.id as string | undefined) ?? (result.turn_id as string | undefined) ?? null;
  }

  /**
   * Build a tiny app-tool policy overlay for the Codex app-server thread.
   *
   * Symphony still leaves the general approval policy in place. This overlay
   * only relaxes approval for tools named in WORKFLOW.md, such as posting a
   * status comment back to the same Linear issue. Tools not named here keep
   * Codex's normal prompt/approval behavior, which preserves review gates for
   * broader Linear changes, branch pushes, destructive actions, and unknown
   * connector writes.
   */
  private buildAppToolApprovalConfig(): Record<string, unknown> | undefined {
    const tools = this.codexConfig.autoApproveAppTools;
    if (!tools.length) return undefined;

    const apps: Record<string, Record<string, unknown>> = {};

    for (const rawTool of tools) {
      const parsed = this.parseAppToolName(rawTool);
      if (!parsed) {
        this.log.warn('Ignoring invalid auto-approved app tool entry', { tool: rawTool });
        continue;
      }

      this.addAutoApprovedTool(apps, parsed.app, parsed.tool);

      // The real activity stream exposes connector tools as names such as
      // `codex_apps.linear_save_comment`, while the workflow is easier to read
      // as `linear.save_comment`. Emit both keys so a configured routine action
      // stays routine even if the app-server checks the exposed tool namespace.
      this.addAutoApprovedTool(apps, 'codex_apps', `${parsed.app}_${parsed.tool}`);
    }

    if (!Object.keys(apps).length) return undefined;

    return { apps };
  }

  private addAutoApprovedTool(
    apps: Record<string, Record<string, unknown>>,
    app: string,
    tool: string
  ): void {
    const existingApp = apps[app] ?? {};
    const existingTools = (existingApp.tools as Record<string, unknown> | undefined) ?? {};

    apps[app] = {
      ...existingApp,
      tools: {
        ...existingTools,
        [tool]: {
          approval_mode: 'auto',
        },
      },
    };
  }

  /**
   * Normalize workflow entries into the app/tool names expected by Codex.
   *
   * Accepted examples:
   * - "linear.save_comment" for an app name plus tool name.
   * - "codex_apps.linear_save_comment" because that is how the activity feed
   *   displays the app tool call to humans.
   */
  private parseAppToolName(rawTool: string): { app: string; tool: string } | null {
    const trimmed = rawTool.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('codex_apps.')) {
      const exposedName = trimmed.slice('codex_apps.'.length);
      const underscoreIndex = exposedName.indexOf('_');
      if (underscoreIndex <= 0 || underscoreIndex === exposedName.length - 1) return null;

      return {
        app: exposedName.slice(0, underscoreIndex),
        tool: exposedName.slice(underscoreIndex + 1),
      };
    }

    const dotIndex = trimmed.indexOf('.');
    if (dotIndex <= 0 || dotIndex === trimmed.length - 1) return null;

    return {
      app: trimmed.slice(0, dotIndex),
      tool: trimmed.slice(dotIndex + 1),
    };
  }

  /**
   * Handle an incoming message from the app-server.
   */
  private handleMessage(session: SessionState, line: string): void {
    let msg: AppServerMessage;
    try {
      msg = JSON.parse(line) as AppServerMessage;
    } catch {
      this.log.debug('Malformed JSON from Codex', { line: line.slice(0, 200) });
      return;
    }

    // If it has an id and matches one of our outbound requests, it is a normal
    // response. If it has both an id and a method but no pending request, it is
    // a server-initiated request that the dashboard may need to answer.
    if ('id' in msg && typeof msg.id === 'number') {
      const response = msg as AppServerResponse;
      const pending = session.pendingRequests.get(response.id);
      if (pending) {
        session.pendingRequests.delete(response.id);
        clearTimeout(pending.timer);

        if (response.error) {
          pending.reject(
            new AgentError(
              'response_error',
              `Codex error: ${response.error.message}`
            )
          );
        } else {
          pending.resolve(response.result ?? {});
        }
        return;
      }
    }

    if ('id' in msg && 'method' in msg) {
      if (this.tryAutoApproveAppToolRequest(session, msg as AppServerNotification)) {
        (msg as AppServerNotification).params = {
          ...((msg as AppServerNotification).params ?? {}),
          auto_approved: true,
          auto_approved_tool: this.describeApprovalTool((msg as AppServerNotification).params),
        };
        (msg as AppServerNotification).method = 'approval/auto_approved';
      }

      for (const handler of session.notificationHandlers) {
        handler(msg as AppServerNotification);
      }
      return;
    }

    // Notifications have no request id. Forward them to the active turn so the
    // orchestrator can see progress, completion, tool calls, and approval
    // requests from the real app-server stream.
    if ('method' in msg && !('id' in msg)) {
      for (const handler of session.notificationHandlers) {
        handler(msg as AppServerNotification);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Event classification (Section 10.4)
  // -------------------------------------------------------------------------

  /**
   * Classify a Codex notification into a Symphony event type.
   */
  private classifyEvent(msg: AppServerNotification): CodexEvent {
    const now = new Date();
    let eventType: CodexEventType = 'other_message';

    const method = msg.method ?? '';
    const params = msg.params ?? {};

    // Map Codex notification methods to Symphony event types
    if (method.includes('turn/completed') || method.includes('turn/done')) {
      eventType = 'turn_completed';
    } else if (method.includes('turn/failed') || method.includes('turn/error')) {
      eventType = 'turn_failed';
    } else if (method.includes('turn/cancelled')) {
      eventType = 'turn_cancelled';
    } else if (method.includes('input/required') || method.includes('user_input')) {
      eventType = 'turn_input_required';
    } else if (method.includes('requestApproval') || method === 'approval/request') {
      eventType = 'approval_requested';
    } else if (method.includes('approval')) {
      eventType = 'approval_auto_approved';
    } else if (method.includes('notification') || method.includes('message')) {
      eventType = 'notification';
    } else if (method.includes('session/started')) {
      eventType = 'session_started';
    }

    // Extract usage data if present
    let usage: CodexEvent['usage'];
    const usageData =
      (params.usage as Record<string, number>) ??
      (params.token_usage as Record<string, number>) ??
      (params.total_token_usage as Record<string, number>);

    if (usageData) {
      usage = {
        inputTokens:
          usageData.input_tokens ??
          usageData.prompt_tokens ??
          0,
        outputTokens:
          usageData.output_tokens ??
          usageData.completion_tokens ??
          0,
        totalTokens:
          usageData.total_tokens ?? 0,
      };
    }

    return {
      event: eventType,
      timestamp: now,
      codexAppServerPid: String(params.pid ?? ''),
      usage,
      payload: {
        method,
        request_id: msg.id,
        ...(params as Record<string, unknown>),
      },
    };
  }

  // -------------------------------------------------------------------------
  // Approval handling (Section 10.5)
  // -------------------------------------------------------------------------

  /**
   * Handle the older approval request shape from early Symphony experiments.
   * Current app-server builds use method-specific JSON-RPC requests, so this
   * stays as a compatibility path rather than the main dashboard bridge.
   */
  private handleLegacyApproval(
    session: SessionState,
    params: Record<string, unknown>
  ): void {
    const requestId = params.request_id as number | undefined;
    if (requestId === undefined) return;

    this.log.debug('Auto-approving request', {
      type: params.type as string,
    });

    // Send approval response
    const response = JSON.stringify({
      jsonrpc: '2.0',
      id: requestId,
      result: { approved: true },
    });
    session.process.stdin!.write(response + '\n');
  }

  /**
   * Send a human approval decision back to the live app-server session.
   *
   * The app-server uses different response shapes for different approval
   * methods. Keeping the mapping here prevents the dashboard and orchestrator
   * from needing protocol details; they only say "approve" or "deny".
   */
  resolveApproval(
    session: SessionState,
    approval: PendingApproval,
    decision: 'approve' | 'deny'
  ): void {
    const result = this.buildApprovalResult(approval, decision);
    if (!result) {
      throw new AgentError(
        'unsupported_approval',
        `No dashboard response mapping for approval method ${approval.method}`
      );
    }

    const response = JSON.stringify({
      jsonrpc: '2.0',
      id: approval.requestId,
      result,
    });
    session.process.stdin!.write(response + '\n');
  }

  private buildApprovalResult(
    approval: PendingApproval,
    decision: 'approve' | 'deny'
  ): Record<string, unknown> | null {
    return buildDashboardApprovalResult(approval, decision);
  }

  private tryAutoApproveAppToolRequest(
    session: SessionState,
    msg: AppServerNotification
  ): boolean {
    if (msg.method !== 'item/mcpToolCall/requestApproval') return false;
    if (typeof msg.id !== 'number') return false;

    const item = msg.params?.item as Record<string, unknown> | undefined;
    const server = typeof item?.server === 'string' ? item.server : null;
    const tool = typeof item?.tool === 'string' ? item.tool : null;
    if (!server || !tool) return false;
    if (!this.isAutoApprovedAppTool(server, tool)) return false;

    // This is the enforcement half of WORKFLOW.md's routine app-tool policy.
    // The thread/start config asks Codex to avoid asking in the first place;
    // this fallback answers the approval if the app-server still requests it.
    const response = JSON.stringify({
      jsonrpc: '2.0',
      id: msg.id,
      result: { decision: 'accept' },
    });
    session.process.stdin!.write(response + '\n');

    this.log.info('Auto-approved app tool request', { server, tool });
    return true;
  }

  private isAutoApprovedAppTool(server: string, tool: string): boolean {
    return this.codexConfig.autoApproveAppTools.some(rawTool => {
      const parsed = this.parseAppToolName(rawTool);
      if (!parsed) return false;

      if (server === parsed.app && tool === parsed.tool) {
        return true;
      }

      return server === 'codex_apps' && tool === `${parsed.app}_${parsed.tool}`;
    });
  }

  private describeApprovalTool(params: Record<string, unknown> | undefined): string | null {
    const item = params?.item as Record<string, unknown> | undefined;
    const server = typeof item?.server === 'string' ? item.server : null;
    const tool = typeof item?.tool === 'string' ? item.tool : null;
    return server && tool ? `${server}.${tool}` : null;
  }

  // -------------------------------------------------------------------------
  // Tool call handling
  // -------------------------------------------------------------------------

  /**
   * Handle a tool call from the app-server.
   */
  private async handleToolCall(
    session: SessionState,
    params: Record<string, unknown>
  ): Promise<void> {
    const callId = params.call_id as string | undefined;
    const toolName = params.name as string;
    const toolArgs = params.arguments as Record<string, unknown> | string | undefined;

    if (!callId) return;

    this.log.debug('Tool call received', { tool: toolName });

    if (toolName === 'linear_graphql' && this.config.tracker.kind === 'linear') {
      if (!this.config.tracker.allowRawGraphql) {
        this.log.warn('Rejected linear_graphql tool call: allow_raw_graphql is disabled in config');
        const errorResponse = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tool/result',
          params: {
            call_id: callId,
            success: false,
            error: 'The linear_graphql tool is disabled by harness hardening policy.'
          },
        });
        session.process.stdin!.write(errorResponse + '\n');
        return;
      }

      try {
        let argsObj: Record<string, unknown> = {};
        if (typeof toolArgs === 'string') {
          argsObj = JSON.parse(toolArgs);
        } else if (typeof toolArgs === 'object' && toolArgs !== null) {
          argsObj = toolArgs;
        }

        const query = argsObj.query as string;
        const variables = argsObj.variables as Record<string, unknown> | undefined;

        if (typeof query !== 'string' || !query.trim()) {
          throw new Error('Missing or invalid GraphQL query');
        }

        const response = await fetch(this.config.tracker.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.config.tracker.apiKey,
          },
          body: JSON.stringify({ query, variables }),
        });

        const json = await response.json();
        const success = !json.errors || (Array.isArray(json.errors) && json.errors.length === 0);

        const resultResponse = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tool/result',
          params: {
            call_id: callId,
            success: success,
            result: json
          },
        });
        session.process.stdin!.write(resultResponse + '\n');
      } catch (err) {
        const errorResponse = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tool/result',
          params: {
            call_id: callId,
            success: false,
            error: (err as Error).message
          },
        });
        session.process.stdin!.write(errorResponse + '\n');
      }
      return;
    }

    // For now, reject unsupported tool calls
    const response = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tool/result',
      params: {
        call_id: callId,
        success: false,
        error: `Tool "${toolName}" is not supported by this Symphony instance`,
      },
    });
    session.process.stdin!.write(response + '\n');
  }

  /** Update config at runtime (for dynamic reload) */
  updateConfig(config: ServiceConfig): void {
    this.config = config;
    this.codexConfig = config.codex;
  }
}

// ---------------------------------------------------------------------------
// Dashboard approval response mapping
// ---------------------------------------------------------------------------
// The dashboard only asks the operator for a plain approve/deny decision. This
// helper is the single protocol translation point that turns that human choice
// into the JSON shape the headless Codex app-server expects. It is exported so
// the contract can be verified without launching a live worker session.
// ---------------------------------------------------------------------------

export function buildDashboardApprovalResult(
  approval: Pick<PendingApproval, 'method'>,
  decision: 'approve' | 'deny'
): Record<string, unknown> | null {
  if (
    approval.method === 'item/mcpToolCall/requestApproval' ||
    approval.method === 'item/commandExecution/requestApproval' ||
    approval.method === 'item/fileChange/requestApproval' ||
    approval.method === 'item/permissions/requestApproval'
  ) {
    // Newer app-server item-level approvals all use accept/decline, including
    // permission-root requests. Keeping permission approval in this group lets
    // the dashboard answer the same request it already explains to the user.
    return { decision: decision === 'approve' ? 'accept' : 'decline' };
  }

  if (
    approval.method === 'execCommandApproval' ||
    approval.method === 'applyPatchApproval'
  ) {
    return { decision: decision === 'approve' ? 'approved' : 'denied' };
  }

  return null;
}
