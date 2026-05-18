// ============================================================================
// Workspace Manager
// ============================================================================
// Manages per-issue workspace directories and lifecycle hooks.
//
// Based on SPEC Sections 9.1–9.5:
// - Deterministic workspace path per issue identifier
// - Sanitized directory names (only [A-Za-z0-9._-])
// - Workspace root containment validation
// - Lifecycle hooks: after_create, before_run, after_run, before_remove
// ============================================================================

import { mkdir, rm, stat } from 'node:fs/promises';
import { resolve, normalize } from 'node:path';
import { spawn } from 'node:child_process';
import type { Workspace, ServiceConfig } from './types.js';
import { Logger } from './logger.js';

// ---------------------------------------------------------------------------
// Workspace key sanitization (Section 4.2 / 9.5 Invariant 3)
// ---------------------------------------------------------------------------

/**
 * Sanitize an issue identifier into a safe directory name.
 * Only [A-Za-z0-9._-] are allowed; everything else becomes "_".
 */
export function sanitizeWorkspaceKey(identifier: string): string {
  return identifier.replace(/[^A-Za-z0-9._-]/g, '_');
}

// ---------------------------------------------------------------------------
// Workspace Manager
// ---------------------------------------------------------------------------
export class WorkspaceManager {
  private workspaceRoot: string;
  private hooksConfig: ServiceConfig['hooks'];
  private log: Logger;

  constructor(config: ServiceConfig, logger: Logger) {
    this.workspaceRoot = config.workspace.root;
    this.hooksConfig = config.hooks;
    this.log = logger.child({ component: 'workspace' });
  }

  // -------------------------------------------------------------------------
  // Workspace creation / reuse (Section 9.2)
  // -------------------------------------------------------------------------

  /**
   * Create or reuse a workspace for a given issue identifier.
   *
   * 1. Sanitize identifier to workspace_key
   * 2. Compute workspace path under root
   * 3. Ensure directory exists
   * 4. Mark created_now if newly created
   * 5. Run after_create hook if newly created
   *
   * Throws on: invalid path, directory creation failure, after_create failure
   */
  async createForIssue(issueIdentifier: string): Promise<Workspace> {
    const workspaceKey = sanitizeWorkspaceKey(issueIdentifier);
    const workspacePath = resolve(this.workspaceRoot, workspaceKey);

    // Safety invariant 2: workspace path MUST stay inside workspace root
    this.validatePathContainment(workspacePath);

    // Check if workspace already exists
    let createdNow = false;
    try {
      const stats = await stat(workspacePath);
      if (!stats.isDirectory()) {
        // Existing non-directory path — remove and recreate
        this.log.warn('Replacing non-directory at workspace path', {
          path: workspacePath,
        });
        await rm(workspacePath, { force: true });
        await mkdir(workspacePath, { recursive: true });
        createdNow = true;
      }
      // Existing directory — reuse
    } catch {
      // Directory doesn't exist — create it
      await mkdir(workspacePath, { recursive: true });
      createdNow = true;
    }

    const workspace: Workspace = {
      path: workspacePath,
      workspaceKey,
      createdNow,
    };

    // Run after_create hook only on newly created workspaces
    if (createdNow && this.hooksConfig.afterCreate) {
      this.log.info('Running after_create hook', { workspace: workspaceKey });
      try {
        await this.runHook(
          'after_create',
          this.hooksConfig.afterCreate,
          workspacePath
        );
      } catch (err) {
        // after_create failure is fatal to workspace creation —
        // clean up the partially created workspace
        this.log.error('after_create hook failed, removing workspace', {
          workspace: workspaceKey,
          error: (err as Error).message,
        });
        await rm(workspacePath, { recursive: true, force: true }).catch(
          () => {}
        );
        throw err;
      }
    }

    this.log.info('Workspace ready', {
      workspace: workspaceKey,
      created: createdNow,
    });

    return workspace;
  }

  // -------------------------------------------------------------------------
  // Hook execution
  // -------------------------------------------------------------------------

  /**
   * Run the before_run hook. Failure aborts the current attempt.
   */
  async runBeforeRun(workspacePath: string): Promise<void> {
    if (!this.hooksConfig.beforeRun) return;
    this.log.info('Running before_run hook');
    await this.runHook('before_run', this.hooksConfig.beforeRun, workspacePath);
  }

  /**
   * Run the after_run hook. Failure is logged and ignored.
   */
  async runAfterRun(workspacePath: string): Promise<void> {
    if (!this.hooksConfig.afterRun) return;
    this.log.info('Running after_run hook');
    try {
      await this.runHook(
        'after_run',
        this.hooksConfig.afterRun,
        workspacePath
      );
    } catch (err) {
      this.log.warn('after_run hook failed (ignored)', {
        error: (err as Error).message,
      });
    }
  }

  /**
   * Run the before_remove hook. Failure is logged and ignored.
   */
  async runBeforeRemove(workspacePath: string): Promise<void> {
    if (!this.hooksConfig.beforeRemove) return;
    this.log.info('Running before_remove hook');
    try {
      await this.runHook(
        'before_remove',
        this.hooksConfig.beforeRemove,
        workspacePath
      );
    } catch (err) {
      this.log.warn('before_remove hook failed (ignored)', {
        error: (err as Error).message,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Workspace cleanup
  // -------------------------------------------------------------------------

  /**
   * Remove a workspace directory for a terminal issue.
   * Runs before_remove hook if configured.
   */
  async removeWorkspace(issueIdentifier: string): Promise<void> {
    const workspaceKey = sanitizeWorkspaceKey(issueIdentifier);
    const workspacePath = resolve(this.workspaceRoot, workspaceKey);

    // Only attempt cleanup if directory exists
    try {
      const stats = await stat(workspacePath);
      if (!stats.isDirectory()) return;
    } catch {
      return; // Already gone
    }

    await this.runBeforeRemove(workspacePath);

    this.log.info('Removing workspace', { workspace: workspaceKey });
    await rm(workspacePath, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // Safety validation (Section 9.5)
  // -------------------------------------------------------------------------

  /**
   * Validate that a workspace path stays inside the workspace root.
   * Invariant 2: prevents path traversal attacks.
   */
  private validatePathContainment(workspacePath: string): void {
    const normalizedRoot = normalize(this.workspaceRoot);
    const normalizedPath = normalize(workspacePath);

    if (!normalizedPath.startsWith(normalizedRoot)) {
      throw new Error(
        `Workspace path "${normalizedPath}" is outside workspace root "${normalizedRoot}"`
      );
    }
  }

  /**
   * Get the absolute path for a workspace without creating it.
   */
  getWorkspacePath(issueIdentifier: string): string {
    const workspaceKey = sanitizeWorkspaceKey(issueIdentifier);
    return resolve(this.workspaceRoot, workspaceKey);
  }

  /**
   * Validate workspace path before agent launch (Section 9.5 Invariant 1).
   * Returns the validated absolute path.
   */
  validateForAgentLaunch(workspacePath: string): string {
    const absolutePath = resolve(workspacePath);
    this.validatePathContainment(absolutePath);
    return absolutePath;
  }

  // -------------------------------------------------------------------------
  // Hook runner
  // -------------------------------------------------------------------------

  /**
   * Execute a shell hook script in the workspace directory.
   *
   * On Windows: uses powershell -Command
   * On POSIX: uses sh -lc (or bash -lc)
   *
   * Enforces hooks.timeout_ms timeout.
   */
  private runHook(
    hookName: string,
    script: string,
    cwd: string
  ): Promise<void> {
    return new Promise((resolvePromise, reject) => {
      const timeoutMs = this.hooksConfig.timeoutMs;

      // Use platform-appropriate shell
      const isWindows = process.platform === 'win32';
      const shell = isWindows ? 'powershell' : 'bash';
      const shellArgs = isWindows
        ? ['-NoLogo', '-NoProfile', '-Command', script]
        : ['-lc', script];

      const child = spawn(shell, shellArgs, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        // shell: true is not needed since we're explicitly invoking the shell
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
        // Truncate logs to avoid flooding
        if (stdout.length > 2000) {
          stdout = stdout.slice(0, 2000) + '... (truncated)';
        }
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
        if (stderr.length > 2000) {
          stderr = stderr.slice(0, 2000) + '... (truncated)';
        }
      });

      // Timeout enforcement
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(
          new Error(
            `Hook "${hookName}" timed out after ${timeoutMs}ms`
          )
        );
      }, timeoutMs);

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(
          new Error(`Hook "${hookName}" failed to spawn: ${err.message}`)
        );
      });

      child.on('exit', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          if (stdout) {
            this.log.debug(`Hook "${hookName}" stdout`, {
              output: stdout.slice(0, 500),
            });
          }
          resolvePromise();
        } else {
          reject(
            new Error(
              `Hook "${hookName}" exited with code ${code}${
                stderr ? `: ${stderr.slice(0, 200)}` : ''
              }`
            )
          );
        }
      });
    });
  }

  /** Update config at runtime (for dynamic reload) */
  updateConfig(config: ServiceConfig): void {
    this.workspaceRoot = config.workspace.root;
    this.hooksConfig = config.hooks;
  }
}
