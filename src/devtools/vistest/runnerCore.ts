/**
 * @file runnerCore.ts — pure helpers shared by the headless capture runner
 * (tools/vistest/shoot.ts) and the harness page (copy-command button).
 * Node-free and DOM-free so both sides and the tests can import it.
 */
import type { VisScenario } from './scenarios';

/** Absolute URL for a scenario against a dev-server base. */
export function scenarioUrl(base: string, s: VisScenario): string {
  return `${base.replace(/\/+$/, '')}/${s.url}`;
}

/** The copy-pasteable one-liner that captures this scenario headlessly. */
export function captureCommand(s: VisScenario): string {
  return `npx tsx tools/vistest/shoot.ts --only ${s.id}`;
}

/** Where the runner writes this scenario's capture. */
export function outputPath(dir: string, s: VisScenario): string {
  return `${dir.replace(/\/+$/, '')}/${s.id}.png`;
}
