const fs = require('fs');
const lines = fs.readFileSync('docs/projects/GLOBAL_GAPS.md', 'utf8').split('\n');
// The gapIndex expects 12 data columns for a standard row.
// The header row in this file defines 12 named columns:
// Gap ID | Status | Classification | Detected during | Gap | Evidence/source | Why it matters | Suspected owner/project | Routing decision | Destination | Next action | Next proof/check
// A standard row therefore has 13 pipe segments (12 columns + leading pipe).
const headerLine = lines.find(l => l.trim().startsWith('| Gap ID | Status | Classification'));
console.log('header line index:', lines.indexOf(headerLine) + 1);
console.log('header pipe segments:', (headerLine.match(/\|/g) || []).length);
console.log('header:', headerLine.slice(0, 200));

const targetIdx = 417; // line 418 (0-indexed 417)
const target = lines[targetIdx];
console.log('\ntarget line index:', targetIdx + 1, 'pipe segments:', (target.match(/\|/g) || []).length);
console.log('target:', target);
console.log('\ntarget segments:');
const segs = target.split('|');
segs.forEach((s, i) => console.log(i, '|', s));

// For context, show the 3 rows above and below with their pipe counts
for (let i = targetIdx - 3; i <= targetIdx + 3; i++) {
  if (i < 0 || i >= lines.length) continue;
  const l = lines[i];
  const pipes = (l.match(/\|/g) || []).length;
  console.log('\nline', i + 1, 'pipes:', pipes);
  console.log(l.slice(0, 200));
}
