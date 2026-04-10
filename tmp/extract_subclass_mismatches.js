const fs = require('fs');
const report = JSON.parse(fs.readFileSync('F:/Repos/Aralia/.agent/roadmap-local/spell-validation/spell-structured-vs-canonical-report.json', 'utf8'));
const subClassMismatches = report.mismatches.filter(m => m.field === 'Sub-Classes');
console.log(`Total Sub-Classes mismatches: ${subClassMismatches.length}\n`);

// Group by mismatch kind
const byKind = {};
for (const m of subClassMismatches) {
  if (!byKind[m.mismatchKind]) byKind[m.mismatchKind] = [];
  byKind[m.mismatchKind].push(m);
}

for (const [kind, items] of Object.entries(byKind)) {
  console.log(`\n=== ${kind} (${items.length}) ===`);
  for (const m of items) {
    const sv = m.structuredValue || '(empty)';
    const cv = m.canonicalValue || '(empty)';
    console.log(`  ${m.spellId}`);
    console.log(`    structured: ${sv.substring(0, 120)}`);
    console.log(`    canonical:  ${cv.substring(0, 120)}`);
  }
}
