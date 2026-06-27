/**
 * Runnable proof for the Cell Provenance Audit first slice.
 * Usage: npx tsx .agent/scratch/run-provenance-audit.ts
 */
import { writeFileSync } from 'node:fs';
import { buildGoldenDrillPath } from '../../src/systems/worldforge/provenance/__tests__/fixtures/drillPath';
import { runCellProvenanceAudit } from '../../src/systems/worldforge/provenance/cellProvenanceAudit';

const path = buildGoldenDrillPath();
const report = runCellProvenanceAudit(path);

console.log('=== Cell Provenance Audit ===');
console.log(`cell ${report.cellId} (${report.cellType})  passed=${report.passed}`);
console.log('counts:', report.counts);

const fails = report.verdicts.filter((v) => v.severity === 'fail');
const warns = report.verdicts.filter((v) => v.severity === 'warn');
console.log(`FAIL orphans: ${fails.length}`);
for (const f of fails) console.log(`  [FAIL] ${f.kind} ${f.id}: ${f.reason}`);
console.log(`WARN orphans: ${warns.length}`);
for (const w of warns) console.log(`  [warn] ${w.kind} ${w.id}: ${w.reason}`);

// Upstream gap list = the worldmap backlog this slice surfaces.
const lines: string[] = [
  '# Upstream Worldmap Gap List',
  '',
  `Generated from the golden drill path (cell ${report.cellId}, ${report.cellType}).`,
  'Each row is a scale-appropriate fact the worldmap Voronoi cell should own but does not.',
  '',
  '| field | cellId | reason |',
  '|-------|--------|--------|',
  ...report.schemaGaps.map((g) => `| ${g.field} | ${g.cellId} | ${g.reason} |`),
];
const outPath = '.agent/scratch/provenance-gap-list.md';
writeFileSync(outPath, lines.join('\n'));
console.log(`\nGap list written to ${outPath} (${report.schemaGaps.length} gaps)`);

process.exitCode = report.passed ? 0 : 1;
