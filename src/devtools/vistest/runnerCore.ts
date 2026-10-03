/**
 * @file runnerCore.ts — pure helpers shared by the headless capture runner
 * (tools/vistest/shoot.ts) and the harness page (copy-command button).
 * Node-free and DOM-free so both sides and the tests can import it.
 */
import type { VisScenario } from './scenarios';

// ============================================================================
// Shared capture addresses and commands
// ============================================================================
// These helpers keep the interactive harness and terminal runner aligned.
// ============================================================================

/** Absolute URL for a scenario against a dev-server base. */
export function scenarioUrl(base: string, s: VisScenario): string {
  return `${base.replace(/\/+$/, '')}/${s.url}`;
}

/**
 * Build a safe copyable command without pretending one stable file proves
 * every task's source is fresh. The operator must replace the visible
 * placeholder with a source module changed by the current task before capture.
 */
export function captureCommand(s: VisScenario): string {
  return `npx tsx tools/vistest/shoot.ts --fresh-module "<changed-source-module>" --only ${s.id}`;
}

/** Where the runner writes this scenario's capture. */
export function outputPath(dir: string, s: VisScenario): string {
  return `${dir.replace(/\/+$/, '')}/${s.id}.png`;
}
