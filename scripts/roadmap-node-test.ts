import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { generateRoadmapData } from './roadmap-engine/generate.js';
import {
  resolveNodeTestDefinition,
  type NodeTestDefinition
} from './roadmap-engine/node-test-definitions.js';
import {
  type NodeTestCheck,
  type NodeTestResult,
  upsertNodeTestResult
} from './roadmap-engine/node-test-status.js';

/**
 * @file roadmap-node-test.ts
 * 
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Preservationist] Added 'as any' cast to 
 * 'shell: true' in execSync options to satisfy Node.js type definitions.
 * 
 * Technical:
 * CLI for roadmap node verification.
 *
 * Layman:
 * This script runs one node's "health check", saves pass/fail, and records
 * exactly what was checked so roadmap test badges can be driven by real data.
 */

type Args = {
  nodeId: string;
};

function usage(): never {
  console.error('Usage: npx tsx scripts/roadmap-node-test.ts --node-id <roadmap-node-id>');
  process.exit(1);
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let nodeId: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--node-id') {
      nodeId = args[i + 1] ?? null;
      i++;
    } else if (arg === '--help' || arg === '-h') {
      usage();
    }
  }

  if (!nodeId) usage();
  return { nodeId };
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function pathExistsInRepo(targetPath: string) {
  if (!targetPath || isHttpUrl(targetPath)) return true;
  const resolved = path.resolve(process.cwd(), targetPath);
  return fs.existsSync(resolved);
}

function runIsolatedCommand(definition: NodeTestDefinition): NodeTestCheck {
  // Run checker commands through shell mode for Windows wrapper compatibility (.cmd/.ps1).
  try {
    execSync(definition.testCommand, {
      cwd: process.cwd(),
      shell: true as any,
      stdio: 'pipe',
      encoding: 'utf8'
    });
    return {
      id: 'isolated-command',
      status: 'pass',
      message: `Isolated checker passed: ${definition.testCommand}`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      id: 'isolated-command',
      status: 'fail',
      message: `Isolated checker failed: ${definition.testCommand} (${message})`
    };
  }
}

function buildNodeChecks(node: {
  id: string;
  label: string;
  type: string;
  status: string;
  description?: string;
  sourceDocs?: string[];
  canonicalDocs?: string[];
  link?: string;
}): NodeTestCheck[] {
  const checks: NodeTestCheck[] = [];

  checks.push({
    id: 'node-id-present',
    status: node.id.trim() ? 'pass' : 'fail',
    message: node.id.trim() ? `Node id is valid: ${node.id}` : 'Node id is empty.'
  });

  checks.push({
    id: 'node-label-present',
    status: node.label.trim() ? 'pass' : 'fail',
    message: node.label.trim() ? `Node label is present: ${node.label}` : 'Node label is empty.'
  });

  checks.push({
    id: 'node-status-valid',
    status: node.status === 'done' || node.status === 'active' || node.status === 'planned' ? 'pass' : 'fail',
    message:
      node.status === 'done' || node.status === 'active' || node.status === 'planned'
        ? `Node status is valid: ${node.status}`
        : `Invalid node status: ${node.status}`
  });

  if (node.type === 'milestone') {
    const hasDescription = typeof node.description === 'string' && node.description.trim().length > 0;
    checks.push({
      id: 'milestone-description-present',
      status: hasDescription ? 'pass' : 'fail',
      message: hasDescription ? 'Milestone has a description.' : 'Milestone is missing a description.'
    });
  }

  const canonicalDocs = Array.isArray(node.canonicalDocs) ? node.canonicalDocs : [];
  for (const doc of canonicalDocs) {
    checks.push({
      id: `canonical-doc-exists:${doc}`,
      status: pathExistsInRepo(doc) ? 'pass' : 'fail',
      message: pathExistsInRepo(doc) ? `Found canonical doc: ${doc}` : `Missing canonical doc: ${doc}`
    });
  }

  const sourceDocs = Array.isArray(node.sourceDocs) ? node.sourceDocs : [];
  for (const doc of sourceDocs) {
    checks.push({
      id: `source-doc-exists:${doc}`,
      status: pathExistsInRepo(doc) ? 'pass' : 'fail',
      message: pathExistsInRepo(doc) ? `Found source doc: ${doc}` : `Missing source doc: ${doc}`
    });
  }

  if (typeof node.link === 'string' && node.link.trim()) {
    checks.push({
      id: 'link-target-exists',
      status: pathExistsInRepo(node.link) ? 'pass' : 'fail',
      message: pathExistsInRepo(node.link) ? `Node link is valid: ${node.link}` : `Node link missing: ${node.link}`
    });
  }

  return checks;
}

function summarizeFailure(checks: NodeTestCheck[]) {
  const failed = checks.filter((check) => check.status === 'fail');
  if (failed.length === 0) return 'All checks passed.';
  return failed.slice(0, 3).map((check) => check.message).join(' | ');
}

function main() {
  const { nodeId } = parseArgs();
  const data = generateRoadmapData();
  const node = data.nodes.find((candidate) => candidate.id === nodeId);

  if (!node) {
    const now = new Date().toISOString();
    const missingResult: NodeTestResult = {
      nodeId,
      testId: `roadmap-node:${nodeId}`,
      testCommand: `npx tsx scripts/roadmap-node-test.ts --node-id ${nodeId}`,
      status: 'fail',
      lastTestedAt: now,
      lastTestMessage: 'Node not found in generated roadmap data.',
      checks: [
        {
          id: 'node-exists',
          status: 'fail',
          message: `Node not found: ${nodeId}`
        }
      ]
    };
    upsertNodeTestResult(missingResult);
    console.error(`FAIL ${nodeId}: Node not found.`);
    process.exit(1);
  }

  const definition = resolveNodeTestDefinition(node);
  const checks = buildNodeChecks(node);

  // For done nodes with mapped existing checkers, run the isolated command in addition
  // to structural checks so the node can be validated by behavior, not only metadata.
  if (definition && definition.testKind === 'isolated-existing') {
    checks.push(runIsolatedCommand(definition));
  }

  const hasFailure = checks.some((check) => check.status === 'fail');
  const now = new Date().toISOString();

  const result: NodeTestResult = {
    nodeId: node.id,
    testId: definition?.testId ?? `roadmap-node:${node.id}`,
    testCommand: definition?.testCommand ?? `npx tsx scripts/roadmap-node-test.ts --node-id ${node.id}`,
    status: hasFailure ? 'fail' : 'pass',
    lastTestedAt: now,
    lastTestMessage: summarizeFailure(checks),
    checks
  };

  upsertNodeTestResult(result);

  if (hasFailure) {
    console.error(`FAIL ${node.id}: ${result.lastTestMessage}`);
    checks.filter((check) => check.status === 'fail').forEach((check) => console.error(` - ${check.message}`));
    process.exit(1);
  }

  console.log(`PASS ${node.id}: ${checks.length} checks passed.`);
}

main();
