#!/usr/bin/env npx tsx
import { execSync } from 'child_process';
import { generateRoadmapData } from './roadmap-engine/generate.js';

/**
 * @file roadmap-run-done-node-tests.ts
 * 
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Preservationist] Added 'as any' cast to 
 * 'shell: true' in execSync options to satisfy Node.js type definitions.
 * 
 * Technical:
 * Executes roadmap node tests for every node currently marked as done.
 *
 * Layman:
 * This is the "branch-by-branch test run" command. It walks done nodes in order,
 * runs each node's test, and prints a compact pass/fail summary at the end.
 */

type NodeRunResult = {
  nodeId: string;
  label: string;
  branch: string;
  ok: boolean;
  message: string;
};

function getBranchLabel(label: string) {
  return label.includes(' > ') ? label.split(' > ')[0] : label;
}

function runNodeTest(nodeId: string) {
  const command = `npx tsx scripts/roadmap-node-test.ts --node-id ${nodeId}`;
  try {
    const output = execSync(command, {
      cwd: process.cwd(),
      shell: true as any,
      stdio: 'pipe',
      encoding: 'utf8'
    }).trim();
    return { ok: true, message: output || 'PASS' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message };
  }
}

function main() {
  const data = generateRoadmapData();
  const doneNodes = data.nodes
    .filter((node) => node.status === 'done')
    .sort((a, b) => {
      const aBranch = getBranchLabel(a.label);
      const bBranch = getBranchLabel(b.label);
      return aBranch.localeCompare(bBranch) || a.label.localeCompare(b.label);
    });

  const results: NodeRunResult[] = [];
  let currentBranch = '';
  for (const node of doneNodes) {
    const branch = getBranchLabel(node.label);
    if (branch !== currentBranch) {
      currentBranch = branch;
      console.log(`\n[Branch] ${branch}`);
    }

    const run = runNodeTest(node.id);
    results.push({
      nodeId: node.id,
      label: node.label,
      branch,
      ok: run.ok,
      message: run.message
    });

    console.log(` - ${run.ok ? 'PASS' : 'FAIL'} ${node.label}`);
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`\nDone-node test run complete: total=${results.length}, pass=${passed}, fail=${failed}`);

  if (failed > 0) {
    console.log('\nFailed nodes:');
    for (const row of results.filter((r) => !r.ok)) {
      console.log(` - ${row.nodeId} (${row.label})`);
      console.log(`   ${row.message.split('\n')[0]}`);
    }
    process.exitCode = 1;
  }
}

main();
