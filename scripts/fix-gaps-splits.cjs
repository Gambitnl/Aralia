const fs = require('fs');
const path = 'docs/projects/GLOBAL_GAPS.md';
let text = fs.readFileSync(path, 'utf8');
const lines = text.split('\n');

// Find blank lines that sit between two gap-table rows (| GG-... or | GG-DEVHUB-...)
let changed = 0;
for (let i = 1; i < lines.length - 1; i++) {
  const prev = lines[i - 1];
  const cur = lines[i];
  const next = lines[i + 1];
  if (cur.trim() === '' && prev.trim().startsWith('| GG-') && next.trim().startsWith('| GG-')) {
    lines[i] = ''; // keep the blank but we will collapse below
  }
}

// Collapse: any blank line between two table rows becomes a no-op separator
// that keeps exactly ONE newline between rows (so the table is contiguous).
// Also: a blank line immediately AFTER the header row and BEFORE the first data row
// is kept (header/section separation), but blank lines BETWEEN data rows are removed.
const out = [];
for (let i = 0; i < lines.length; i++) {
  const cur = lines[i];
  const prev = out[out.length - 1];
  const next = lines[i + 1];
  const isTableRow = s => typeof s === 'string' && s.trim().startsWith('| GG-');
  if (cur.trim() === '' && prev && isTableRow(prev) && next && isTableRow(next)) {
    // drop blank lines between two data rows
    continue;
  }
  out.push(cur);
}

// Remove blank lines between the column-header row (the line that starts with
// '| Gap ID | Status | Classification') and the first data row, AND between any two
// consecutive data rows. Keep blank lines elsewhere (section prose, LOB rows).
for (let i = 0; i < out.length - 1; i++) {
  const cur = out[i];
  const next = out[i + 1];
  const isHeader = cur.trim().startsWith('| Gap ID | Status | Classification');
  const isDataRow = s => typeof s === 'string' && s.trim().startsWith('| GG-');
  if (isHeader && next && next.trim() === '') {
    out.splice(i + 1, 1);
    // after removal, check again in case there were two blanks
    if (i + 1 < out.length && out[i + 1].trim() === '') out.splice(i + 1, 1);
    break;
  }
}
// Also remove any remaining blank line between two consecutive data rows
for (let i = 0; i < out.length - 1; i++) {
  const cur = out[i];
  const next = out[i + 1];
  if (cur.trim().startsWith('| GG-') && next && next.trim() === '' && i + 2 < out.length && out[i + 2].trim().startsWith('| GG-')) {
    out.splice(i + 1, 1);
    i--; // re-check this position
  }
}

const newText = out.join('\n');
const before = text.length;
const afterLen = newText.length;
if (newText !== text) {
  fs.writeFileSync(path, newText, 'utf8');
  console.log('wrote', path, 'removed', (text.match(/\n\n/g) || []).length, 'blank-line splits approx; size', before, '->', afterLen);
} else {
  console.log('no change');
}

// Verify no blank-line splits remain between table rows
const lines2 = newText.split('\n');
let remaining = 0;
for (let i = 1; i < lines2.length - 1; i++) {
  const prev = lines2[i - 1];
  const cur = lines2[i];
  const next = lines2[i + 1];
  if (cur.trim() === '' && prev.trim().startsWith('| GG-') && next.trim().startsWith('| GG-')) {
    remaining++;
  }
}
console.log('remaining blank-line splits between table rows:', remaining);

// Show the malformed row region after fix
for (let i = 416; i < 424; i++) {
  const l = lines2[i];
  const pipes = (l.match(/\|/g) || []).length;
  console.log(i + 1, 'pipes=' + pipes + '||' + l.slice(0, 120));
}
