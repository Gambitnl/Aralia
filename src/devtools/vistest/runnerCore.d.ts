/**
 * @file runnerCore.ts — pure helpers shared by the headless capture runner
 * (tools/vistest/shoot.ts) and the harness page (copy-command button).
 * Node-free and DOM-free so both sides and the tests can import it.
 */
import type { VisScenario } from './scenarios';
/** Absolute URL for a scenario against a dev-server base. */
export declare function scenarioUrl(base: string, s: VisScenario): string;
/**
 * Build a safe copyable command without pretending one stable file proves
 * every task's source is fresh. The operator must replace the visible
 * placeholder with a source module changed by the current task before capture.
 */
export declare function captureCommand(s: VisScenario): string;
/** Where the runner writes this scenario's capture. */
export declare function outputPath(dir: string, s: VisScenario): string;
