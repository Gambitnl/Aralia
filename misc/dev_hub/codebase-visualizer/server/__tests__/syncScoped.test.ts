/**
 * @file syncScoped.test.ts
 * Fixture proof for WF-G115: the codebase-visualizer `--sync` writer must be
 * safe to run in a shared checkout where other agents hold file locks.
 *
 * The regression this pins down is concrete. The old writer produced
 * `header + '\n\n' + content.trimStart()`, which stamped LF newlines into CRLF
 * files (BattleMap3DGpuScene.tsx ended up 1032 CRLF / 16 LF) and shoved or ate
 * the file's own `@file` doc comment. It also had no way to say "these files and
 * nothing else", so a run could rewrite a dependent another agent was editing.
 *
 * These tests build a real fixture directory under a temp folder — a CRLF file
 * with a JSDoc header plus a dependent — and assert on bytes, not on intent.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  detectDominantEol,
  placeAdvisoryHeader,
  renderSyncBlock,
  stripLegacyAdvisoryBlocks,
} from '../sync';

const HEADER = renderSyncBlock({
  advisoryLabel: 'LOCAL HELPER: This file has a small, manageable dependency footprint.',
  dependents: 'components/BattleMap/Dependent.tsx',
  importsCount: 2,
});

/** Author-written doc comment, deliberately containing the words the old cleaner matched on. */
const AUTHORED_JSDOC = [
  '/**',
  ' * @file terrainGeometry.ts',
  ' * Builds the battle-map terrain mesh.',
  ' *',
  ' * Imports: kept deliberately small so this stays a leaf of the graph.',
  ' */',
].join('\n');

const SOURCE_BODY = [
  "import { vec3 } from 'gl-matrix';",
  '',
  'export function buildTerrain(): void {',
  '  // body',
  '}',
  '',
].join('\n');

let fixtureDir: string;

/** Write a fixture file with every newline forced to `eol`. */
function writeFixture(name: string, lfContent: string, eol: '\r\n' | '\n'): string {
  const full = path.join(fixtureDir, name);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, lfContent.split('\n').join(eol), 'utf8');
  return full;
}

function countEols(content: string): { crlf: number; lf: number } {
  const total = (content.match(/\n/g) || []).length;
  const crlf = (content.match(/\r\n/g) || []).length;
  return { crlf, lf: total - crlf };
}

beforeEach(() => {
  fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aralia-sync-fixture-'));
});

afterEach(() => {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
});

describe('WF-G115 scoped sync writer', () => {
  it('detects the dominant line ending of a CRLF file and of an LF file', () => {
    expect(detectDominantEol('a\r\nb\r\nc\r\n')).toBe('\r\n');
    expect(detectDominantEol('a\nb\nc\n')).toBe('\n');
    // The damaged real-world shape: mostly CRLF with a handful of LF lines.
    expect(detectDominantEol('a\r\nb\r\nc\r\nd\ne\n')).toBe('\r\n');
  });

  it('keeps a CRLF file all-CRLF and preserves its authored @file JSDoc', () => {
    const target = writeFixture('target.ts', `${AUTHORED_JSDOC}\n\n${SOURCE_BODY}`, '\r\n');
    const before = fs.readFileSync(target, 'utf8');
    expect(countEols(before).lf).toBe(0);

    const eol = detectDominantEol(before);
    const placement = placeAdvisoryHeader(before, HEADER, eol);
    fs.writeFileSync(target, placement.content, 'utf8');

    const after = fs.readFileSync(target, 'utf8');

    // (b) EOL preserved: not one bare LF was introduced.
    expect(countEols(after).lf).toBe(0);
    expect(countEols(after).crlf).toBeGreaterThan(countEols(before).crlf);

    // (c) The authored JSDoc survives verbatim and still leads the file.
    expect(placement.keptLeadingJsDoc).toBe(true);
    expect(after.startsWith(AUTHORED_JSDOC.split('\n').join('\r\n'))).toBe(true);
    expect(after).toContain('@file terrainGeometry.ts');

    // The advisory header is present, and below the authored block.
    expect(after.indexOf('// @dependencies-start')).toBeGreaterThan(after.indexOf('@file terrainGeometry.ts'));
    expect(after).toContain('ARCHITECTURAL ADVISORY:');

    // The source body is untouched.
    expect(after).toContain(SOURCE_BODY.split('\n').join('\r\n').trimEnd());
  });

  it('does not stack headers when run twice, and still keeps the JSDoc', () => {
    const target = writeFixture('twice.ts', `${AUTHORED_JSDOC}\n\n${SOURCE_BODY}`, '\r\n');

    for (let pass = 0; pass < 2; pass += 1) {
      const content = fs.readFileSync(target, 'utf8');
      fs.writeFileSync(target, placeAdvisoryHeader(content, HEADER, detectDominantEol(content)).content, 'utf8');
    }

    const after = fs.readFileSync(target, 'utf8');
    expect((after.match(/@dependencies-start/g) || []).length).toBe(1);
    expect((after.match(/@file terrainGeometry\.ts/g) || []).length).toBe(1);
    expect(countEols(after).lf).toBe(0);
  });

  it('places the header at the top when the file has no leading doc comment', () => {
    const target = writeFixture('bare.ts', SOURCE_BODY, '\n');
    const content = fs.readFileSync(target, 'utf8');
    const placement = placeAdvisoryHeader(content, HEADER, detectDominantEol(content));

    expect(placement.keptLeadingJsDoc).toBe(false);
    expect(placement.content.startsWith('// @dependencies-start')).toBe(true);
    expect(countEols(placement.content).crlf).toBe(0);
  });

  it('leaves the dependent file byte-identical (scoped mode never follows the graph)', () => {
    const dependentSource = `${AUTHORED_JSDOC}\n\nimport { buildTerrain } from './target';\nbuildTerrain();\n`;
    const target = writeFixture('target.ts', `${AUTHORED_JSDOC}\n\n${SOURCE_BODY}`, '\r\n');
    const dependent = writeFixture('dependent.ts', dependentSource, '\r\n');

    const dependentBefore = fs.readFileSync(dependent);

    const content = fs.readFileSync(target, 'utf8');
    fs.writeFileSync(target, placeAdvisoryHeader(content, HEADER, detectDominantEol(content)).content, 'utf8');

    const dependentAfter = fs.readFileSync(dependent);
    expect(dependentAfter.equals(dependentBefore)).toBe(true);
    expect(dependentAfter.toString('utf8')).not.toContain('@dependencies-start');
  });

  it('no longer deletes an authored doc comment that happens to say "Imports:"', () => {
    // Before WF-G115 the cleaner matched any leading block containing
    // `Imports:` or `Dependents:` and removed it as if it were generated.
    const authored = `${AUTHORED_JSDOC}\n\n${SOURCE_BODY}`;
    expect(stripLegacyAdvisoryBlocks(authored)).toBe(authored);
    expect(stripLegacyAdvisoryBlocks(authored)).toContain('@file terrainGeometry.ts');
  });
});
