import { readFileSync, writeFileSync } from 'fs';

const path = process.argv[2];
const lines = readFileSync(path, 'utf8').split('\n');
const targetIdx = lines.findIndex(l => l.trim().startsWith('| GG-267 |'));
if (targetIdx < 0) {
  console.error('GG-267 row not found');
  process.exit(1);
}
const cells = lines[targetIdx].split('|');
// cells[8] and cells[9] are the two mojibake owner/routing cells
const tag = 'worldforge';
const link = 'd2de3cb5';
cells[8] = ` ${tag} `;
cells[9] = ` ${link} | docs/projects/GLOBAL_GAPS.md `;
lines[targetIdx] = cells.join('|');
writeFileSync(path, lines.join('\n'), 'utf8');
console.log('patched GG-267 owner/routing cells ->', tag, link);
console.log('tail:', lines[targetIdx].slice(-160));
