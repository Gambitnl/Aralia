import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const ROOT = resolve(__dirname, '..');

const text = readFileSync(resolve(ROOT, 'docs/projects/PROJECT_TRACKER.md'), 'utf8');

const lines = text.split('\n');
// Match rows of the form: | Name | [link text](href) - status YYYY-MM-DD |
const rowRe = /^\|([^|]+)\|\s*\[([^\]]+)\]\(([^)]+)\)\s*-\s*(absorbed|parked|active|done)\s+(\d{4}-\d{2}-\d{2})\s*\|/;
const rows = [];
lines.forEach((l, i) => {
  const m = l.match(rowRe);
  if (m) rows.push({ line: i + 1, name: m[1].trim(), linkText: m[2].trim(), href: m[3].trim(), date: m[5] });
});

console.log('total matched rows:', rows.length);

// Project folders that exist
const projectBase = resolve(ROOT, 'docs/projects');
const projectDirs = readdirSync(projectBase).filter(f => {
  try { return existsSync(resolve(projectBase, f, 'NORTH_STAR.md')); } catch { return false; }
});


// Rows pointing at docs/projects/<folder>/...
function stripProjectPrefix(href) {
  if (href.startsWith('F:/Repos/Aralia/docs/projects/')) return href.slice('F:/Repos/Aralia/docs/projects/'.length);
  if (href.startsWith('docs/projects/')) return href.slice('docs/projects/'.length);
  return null;
}
function topFolder(target) {
  if (!target) return null;
  const slash = target.indexOf('/');
  return slash === -1 ? target : target.slice(0, slash);
}

const pointAtProjectFolder = rows.map(r => {
  const target = stripProjectPrefix(r.href);
  const folder = target ? topFolder(target) : null;
  return { ...r, target, folder };
}).filter(r => r.folder);

console.log('\nrows pointing at a docs/projects/<folder>/ target:', pointAtProjectFolder.length);

const missingProjectFolder = pointAtProjectFolder.filter(r => !existsSync(resolve(projectBase, r.folder)));
console.log('of those, rows whose <folder> does NOT exist:', missingProjectFolder.length);
missingProjectFolder.forEach(r => {
  console.log('  LINE', r.line, '|', r.name, '| folder=', r.folder, '| href=', r.href);
});

const validProjectFolder = pointAtProjectFolder.filter(r => existsSync(resolve(projectBase, r.folder)));
console.log('\nrows pointing at a valid docs/projects/<folder>/:', validProjectFolder.length);
validProjectFolder.slice(0, 10).forEach(r => {
  console.log('  LINE', r.line, '|', r.name, '| folder=', r.folder, '| href=', r.href);
});

// Also count rows whose href is a domain doc (../architecture/domains/...) and verify they resolve
const domainDocRows = rows.filter(r => {
  const h = r.href;
  return h.includes('/architecture/domains/') || h.startsWith('../architecture/domains/') || h.startsWith('F:/Repos/Aralia/docs/architecture/domains/');
});
console.log('\nrows pointing at an architecture/domains/ doc:', domainDocRows.length);
const domainDocBad = domainDocRows.filter(r => {
  let target;
  if (r.href.startsWith('F:/Repos/Aralia/docs/')) target = r.href.slice('F:/Repos/Aralia/docs/'.length);
  else if (r.href.startsWith('../')) target = r.href;
  else if (r.href.startsWith('/')) target = r.href.slice(1);
  else target = r.href;
  const resolved = resolve(ROOT, target);
  // The tracker lives in docs/projects/; a ../ from there goes to docs/, so
  // ../architecture/domains/X.md resolves to docs/architecture/domains/X.md.
  // Confirm by resolving from the tracker's own dir.
  const fromTracker = resolve(ROOT, 'docs/projects', target);
  return !existsSync(resolved) && !existsSync(fromTracker);
});

console.log('\nResolved (from repo root) missing domain doc rows:', domainDocBad.length);
console.log('Also try resolving from docs/projects/ (the tracker home):');
const missingFromTracker = domainDocRows.filter(r => {
  let target;
  if (r.href.startsWith('F:/Repos/Aralia/docs/')) target = r.href.slice('F:/Repos/Aralia/docs/'.length);
  else if (r.href.startsWith('../')) target = r.href;
  else if (r.href.startsWith('/')) target = r.href.slice(1);
  else target = r.href;
  return !existsSync(resolve(ROOT, 'docs/projects', target));
});
console.log('missing when resolved from docs/projects/:', missingFromTracker.length);
missingFromTracker.slice(0, 5).forEach(r => {
  console.log('  LINE', r.line, '|', r.name, '| href=', r.href, '| resolved-from-tracker=', resolve(ROOT, 'docs/projects', r.href));
});
console.log('of those, rows whose domain doc does NOT exist on disk:', domainDocBad.length);
domainDocBad.slice(0, 10).forEach(r => {
  console.log('  LINE', r.line, '|', r.name, '| href=', r.href);
});

// ---- D1 real signal: project rows ----
// Project folders that exist (by docs/projects/<name>/NORTH_STAR.md)
console.log('\n--- project-folder rows ---');
const existingProjectDirs = readdirSync(projectBase).filter(f => {
  try { return existsSync(resolve(projectBase, f, 'NORTH_STAR.md')); } catch { return false; }
});
console.log('project folders with NORTH_STAR.md (' + existingProjectDirs.length + '):', existingProjectDirs.join(', '));

function isProjectTarget(href) {
  const lower = href.toLowerCase();
  if (lower.includes('docs/projects/') || lower.startsWith('f:/repos/aralia/docs/projects/')) return true;
  // Absolute windows paths without a drive letter are being normalized by someone
  // to 'docs/projects/...' during the read; also catch bare 'docs/projects/' forms.
  if (lower.startsWith('docs/projects/')) return true;
  // Relative forms like ../projects/... resolved from docs/projects/ land in docs/projects/
  if (lower.includes('/projects/') || lower.startsWith('../projects/')) return true;
  return false;
}

const sectionHeaderRe = /^##\s+/;
let currentSection = 'PRE';
const sectionRows = new Map();
lines.forEach((l, i) => {
  if (sectionHeaderRe.test(l)) currentSection = l.replace(/^##\s+/, '').trim();
  const m = l.match(rowRe);
  if (m) {
    if (!sectionRows.has(currentSection)) sectionRows.set(currentSection, []);
    sectionRows.get(currentSection).push({ line: i + 1, name: m[1].trim(), href: m[3].trim() });
  }
});

console.log('\nrows per section:');
for (const [sec, rs] of sectionRows) {
  console.log('  [' + sec + ']', rs.length, 'rows');
}

console.log('\nper-section: project-target vs domain-doc rows:');
for (const [sec, rs] of sectionRows) {
  const proj = rs.filter(r => isProjectTarget(r.href));
  const dom = rs.filter(r => /\/architecture\/domains\//.test(r.href) || r.href.includes('architecture/domains'));
  console.log('  [' + sec + '] project-target:', proj.length, ' domain-doc:', dom.length);
}

const allProjectRows = rows.filter(r => isProjectTarget(r.href));
console.log('\ntotal project-target rows:', allProjectRows.length);
allProjectRows.slice(0, 20).forEach(r => console.log('  LINE', r.line, '|', r.name, '| href=', r.href));

// missing project-target rows: whose target project folder does not exist
function topFolderF(target) {
  if (!target) return null;
  const slash = target.indexOf('/');
  return slash === -1 ? target : target.slice(0, slash);
}

const missingProjectRows = allProjectRows.filter(r => {
  const rel = stripToRepoPath(r.href);
  const folder = topFolderF(rel);
  if (!folder) return false;
  return !existsSync(resolve(projectBase, folder));
});
console.log('\nproject-target rows whose <folder> does NOT exist:', missingProjectRows.length);
missingProjectRows.slice(0, 40).forEach(r => {
  const rel = stripToRepoPath(r.href);
  const folder = topFolderF(rel);
  console.log('  LINE', r.line, '|', r.name, '| folder=', folder, '| href=', r.href, '| exists=', existsSync(resolve(projectBase, folder)));
});
