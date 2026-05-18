// ============================================================================
// Symphony CLI Entry Point
// ============================================================================
// Starts the Symphony orchestrator with the specified workflow file.
//
// Usage:
//   symphony [path-to-WORKFLOW.md] [--port <port>] [--logs-root <dir>] [--dashboard-only]
//
// Based on SPEC Section 17.7.
// ============================================================================

import { resolve } from 'node:path';
import { Orchestrator } from './orchestrator.js';
import { Logger } from './logger.js';
import { HttpServer } from './server.js';

// ---------------------------------------------------------------------------
// Parse CLI arguments
// ---------------------------------------------------------------------------
function parseArgs(argv: string[]): {
  workflowPath?: string;
  port?: number;
  logsRoot?: string;
  dashboardOnly: boolean;
} {
  const args = argv.slice(2); // skip node + script
  const result: {
    workflowPath?: string;
    port?: number;
    logsRoot?: string;
    dashboardOnly: boolean;
  } = {
    dashboardOnly: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === '--port' && args[i + 1]) {
      result.port = parseInt(args[++i]!, 10);
    } else if (arg === '--logs-root' && args[i + 1]) {
      result.logsRoot = resolve(args[++i]!);
    } else if (arg === '--dashboard-only') {
      // This legacy flag still marks a safe dashboard/preflight run. Normal
      // startup is also dispatch-paused now; the explicit dashboard toggle is
      // the only path that starts tracker polling and worker assignment.
      result.dashboardOnly = true;
    } else if (!arg.startsWith('--')) {
      // Positional argument = workflow path
      result.workflowPath = resolve(arg);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const logger = new Logger('info', { component: 'symphony' });

  logger.info('Symphony — Autonomous Agent Orchestrator');
  logger.info('Starting up', {
    workflowPath: args.workflowPath ?? './WORKFLOW.md',
    port: args.port ?? 'disabled',
    dashboardOnly: args.dashboardOnly,
  });

  const orchestrator = new Orchestrator(args.workflowPath, logger);

  try {
    await orchestrator.start({ dashboardOnly: args.dashboardOnly });

    const config = orchestrator.getConfig();
    // CLI --port overrides WORKFLOW.md server.port
    const finalPort = args.port ?? config?.server.port ?? null;
    orchestrator.setDashboardBaseUrl(finalPort !== null ? `http://127.0.0.1:${finalPort}` : null);

    let httpServer: HttpServer | null = null;
    if (finalPort !== null) {
      httpServer = new HttpServer(finalPort, orchestrator, logger);
      await httpServer.start();
    }

    // Handle graceful shutdown
    const shutdown = async () => {
      logger.info('Shutdown signal received');
      if (httpServer) await httpServer.stop();
      await orchestrator.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (err) {
    logger.error('Startup failed', { error: (err as Error).message });
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
