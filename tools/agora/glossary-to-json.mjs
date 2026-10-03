#!/usr/bin/env node
// tools/agora/glossary-to-json.mjs
// GLOSSARY.md parse CHECK — prints what the daemon will serve. Writes nothing.
//
// The generated public/glossary/terms.json is RETIRED (2026-08-10). The glossary
// page reads GET http://localhost:4319/glossary from the Agora daemon, which
// parses GLOSSARY.md live through ./glossaryParse.mjs — the same module this
// script uses. There is one path and no static copy to drift.
//
// Use this to eyeball a parse locally (term count, tag spread, entries the
// parser could not read) without starting the daemon.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseGlossary } from './glossaryParse.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const glossaryPath = path.join(__dirname, 'GLOSSARY.md');
const content = fs.readFileSync(glossaryPath, 'utf-8');
const entries = parseGlossary(content);

console.log(`Parsed ${entries.length} terms from GLOSSARY.md`);
console.log('Served live at GET http://localhost:4319/glossary (start: npm run agora)');

// Print tag distribution
const tagCounts = {};
entries.forEach((e) => {
  e.tags.forEach((tag) => {
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  });
});

console.log('\nTag distribution:');
Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).forEach(([tag, count]) => {
  console.log(`  ${tag}: ${count}`);
});

// Check for parse errors
const lines = content.split('\n');
const unparsedLines = lines.filter((line) => {
  const trimmed = line.trim();
  return trimmed.startsWith('**') && trimmed.includes('—') && !entries.some((e) => e.term === trimmed.match(/\*\*([^*]+)\*\*/)?.[1]);
});

if (unparsedLines.length > 0) {
  console.log('\nCould not parse these entries:');
  unparsedLines.forEach((line) => console.log(`  ${line}`));
}
