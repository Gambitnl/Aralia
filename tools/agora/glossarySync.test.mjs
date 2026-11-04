// tools/agora/glossarySync.test.mjs
// Verifies that GLOSSARY.md stays in sync with terms defined in CO-ORCHESTRATION.md.
// Run: node --test tools/agora/glossarySync.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGlossary } from './glossaryParse.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function extractPactTerms(pactContent) {
  const parts = pactContent.split(/^## Terms\s*$/m);
  if (parts.length < 2) return [];
  const termsBody = parts[1].split(/^##\s+/m)[0];
  return [...termsBody.matchAll(/^-\s*\*\*([^*]+)\*\*/gm)].map((m) => m[1].trim());
}

test('every term in CO-ORCHESTRATION.md Terms section exists in GLOSSARY.md (GG-175)', () => {
  const pactPath = path.join(__dirname, 'CO-ORCHESTRATION.md');
  const glossaryPath = path.join(__dirname, 'GLOSSARY.md');

  const pactContent = fs.readFileSync(pactPath, 'utf8');
  const glossaryContent = fs.readFileSync(glossaryPath, 'utf8');

  const pactTerms = extractPactTerms(pactContent);
  assert.ok(pactTerms.length > 0, 'should extract terms from CO-ORCHESTRATION.md');

  const glossaryEntries = parseGlossary(glossaryContent);
  const glossaryTerms = new Set(glossaryEntries.map((e) => e.term.toLowerCase()));

  const missing = pactTerms.filter((term) => !glossaryTerms.has(term.toLowerCase()));

  assert.deepEqual(
    missing,
    [],
    `Missing terms in GLOSSARY.md from CO-ORCHESTRATION.md Terms: ${missing.join(', ')}`,
  );
});
