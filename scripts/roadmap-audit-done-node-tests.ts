#!/usr/bin/env npx tsx
import { generateRoadmapData } from './roadmap-engine/generate.js';
import { resolveNodeTestDefinition } from './roadmap-engine/node-test-definitions.js';

/**
 * Technical:
 * Audits test coverage for completed roadmap nodes.
 *
 * Layman:
 * This script walks each roadmap branch one-by-one, lists done nodes, and shows
 * whether each done node has an isolated existing test or a generated fallback test.
 */

type BranchCoverage = {
  branch: string;
  doneCount: number;
  isolatedCount: number;
  generatedCount: number;
  missingCount: number;
};

function getBranchLabel(label: string) {
  return label.includes(' > ') ? label.split(' > ')[0] : label;
}

function main() {
  const data = generateRoadmapData();
  const doneNodes = data.nodes
    .filter((node) => node.status === 'done')
    .sort((a, b) => a.label.localeCompare(b.label));

  const byBranch = new Map<string, typeof doneNodes>();
  for (const node of doneNodes) {
    const branch = getBranchLabel(node.label);
    const arr = byBranch.get(branch) ?? [];
    arr.push(node);
    byBranch.set(branch, arr);
  }

  const branchRows: BranchCoverage[] = [];
  let totalMissing = 0;
  let totalIsolated = 0;
  let totalGenerated = 0;

  for (const [branch, nodes] of [...byBranch.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`\n[Branch] ${branch}`);
    let isolatedCount = 0;
    let generatedCount = 0;
    let missingCount = 0;

    for (const node of nodes) {
      const definition = resolveNodeTestDefinition(node);
      if (!definition) {
        missingCount += 1;
        totalMissing += 1;
        console.log(` - MISSING  ${node.label}`);
        continue;
      }

      if (definition.testKind === 'isolated-existing') {
        isolatedCount += 1;
        totalIsolated += 1;
      } else {
        generatedCount += 1;
        totalGenerated += 1;
      }

      console.log(` - ${definition.testKind.padEnd(20)} ${node.label}`);
      console.log(`   command: ${definition.testCommand}`);
    }

    branchRows.push({
      branch,
      doneCount: nodes.length,
      isolatedCount,
      generatedCount,
      missingCount
    });
  }

  console.log('\n=== Done Node Test Coverage Summary ===');
  for (const row of branchRows) {
    console.log(
      `${row.branch}: done=${row.doneCount}, isolated=${row.isolatedCount}, generated=${row.generatedCount}, missing=${row.missingCount}`
    );
  }
  console.log(
    `TOTAL: done=${doneNodes.length}, isolated=${totalIsolated}, generated=${totalGenerated}, missing=${totalMissing}`
  );

  if (totalMissing > 0) {
    process.exitCode = 1;
  }
}

main();
