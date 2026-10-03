/**
 * @file rollerGuard.test.ts
 * A ratchet against new unaudited dice rolls (agora-f821.14).
 *
 * agora-f821.4 moved every production roll off the legacy `combatUtils` family
 * and onto `src/systems/dice/rollers.ts`, which rolls through `DiceAuditLog`.
 * Nothing stopped the next file from importing the old names again, or from
 * writing a fresh `Math.random` roller — `src/` already holds hundreds of
 * `Math.random` calls, so a broad ban would be noise. This guard is narrow and
 * exact: it fails on named or namespace combat imports of retired rollers,
 * plus fresh Math.random rollers.
 *
 * Existing debt stays on the allowlist. New debt fails.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repository root: this file sits at src/systems/dice/__tests__/. */
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const DEEPDIVE = 'docs/deepdives/dice-rollers-vs-roll-contract.md';
const ROLLERS = 'src/systems/dice/rollers.ts';

/** Roller names that must come from the audited module, never from combat. */
const ROLLER_NAMES = ['rollDice', 'rollD20', 'rollDamage'];

/**
 * Files still importing the roller names from `utils/combat`.
 *
 * EMPTY, and it stays empty (agora-f821.52). Four files were locked by another
 * packet during the agora-f821.4 migration and kept the old import; they moved
 * to `systems/dice/rollers` and the forwarding re-export in `combatUtils.ts`
 * was deleted with them. Adding a file here is a regression, not a waiver.
 */
const COMBAT_IMPORT_ALLOWLIST = new Set<string>([]);

const COMBAT_SPEC = /(?:^|\/)(?:combatUtils|utils\/combat)$/;
const IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*(['"])([^'"]+)\2/g;
const NAMESPACE_IMPORT_RE = /import\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s*from\s*(['"])([^'"]+)\2/g;

function walk(dir: string, out: string[] = [], includeTests = false): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || (!includeTests && entry.name === '__tests__')) continue;
      walk(full, out, includeTests);
    } else if (/\.tsx?$/.test(entry.name) && (includeTests || !entry.name.includes('.test.'))) {
      out.push(full);
    }
  }
  return out;
}

function combatImportOffenders(root: string, files: string[]): string[] {
  const offenders: string[] = [];
  for (const rel of files) {
    if (COMBAT_IMPORT_ALLOWLIST.has(rel)) continue;
    const source = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const match of source.matchAll(IMPORT_RE)) {
      if (!COMBAT_SPEC.test(match[3])) continue;
      const names = match[1]
        .split(',')
        .map(n => n.trim().split(' as ')[0].replace('type ', '').trim())
        .filter(Boolean);
      const bad = names.filter(n => ROLLER_NAMES.includes(n));
      if (bad.length) offenders.push(`${rel} imports ${bad.join(', ')} from '${match[3]}'`);
    }
    for (const match of source.matchAll(NAMESPACE_IMPORT_RE)) {
      if (!COMBAT_SPEC.test(match[3])) continue;
      const alias = match[1].replaceAll('$', '\\$');
      const accessRe = new RegExp(`(?:^|[^\\w$])${alias}\\s*(?:\\?\\.|\\.)\\s*(${ROLLER_NAMES.join('|')})\\b`, 'g');
      const bad = [...new Set([...source.matchAll(accessRe)].map(access => access[1]))];
      if (bad.length) offenders.push(`${rel} accesses ${bad.join(', ')} via namespace '${match[1]}' from '${match[3]}'`);
    }
  }
  return offenders;
}

const PRODUCTION_FILES = walk(path.join(SRC, 'src')).map(f =>
  path.relative(SRC, f).split(path.sep).join('/')
);
const SOURCE_FILES = walk(path.join(SRC, 'src'), [], true).map(f =>
  path.relative(SRC, f).split(path.sep).join('/')
);

describe('dice roller guard', () => {
  it('finds the production tree it is supposed to guard', () => {
    // A broken walk would make every check below vacuously pass.
    expect(PRODUCTION_FILES.length).toBeGreaterThan(500);
    expect(PRODUCTION_FILES).toContain(ROLLERS);
  });

  it('WF-G313: catches namespace roller access in test files, then accepts the audited import', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'roller-guard-'));
    try {
      const testDir = path.join(root, '__tests__');
      fs.mkdirSync(testDir);
      const fixture = path.join(testDir, 'namespace.test.ts');
      fs.writeFileSync(fixture, [
        'import * as ', 'combatUtils', " from '../../utils/combat';",
        '\ncombatUtils.rollD20(1);',
      ].join(''));
      const files = walk(root, [], true).map(file => path.relative(root, file).split(path.sep).join('/'));
      expect(files).toContain('__tests__/namespace.test.ts');
      const offenders = combatImportOffenders(root, files);
      expect(offenders).toHaveLength(1);
      expect(offenders[0]).toMatch(/namespace.*rollD20/);

      fs.writeFileSync(fixture, "import { rollD20 } from '../../systems/dice/rollers';\nrollD20(1);\n");
      expect(combatImportOffenders(root, files)).toEqual([]);
    } finally {
      // Only remove the exact temp directory created for this test.
      if (path.dirname(root) === os.tmpdir()) fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('routes every source and test roller import through the audited module', () => {
    const offenders = combatImportOffenders(SRC, SOURCE_FILES);

    expect(
      offenders,
      `These files roll through the retired combatUtils family instead of '${ROLLERS}'.\n` +
        `Import the roller from '${ROLLERS}' so the roll lands in DiceAuditLog.\n` +
        `See ${DEEPDIVE}.\n` +
        offenders.map(o => `  - ${o}`).join('\n')
    ).toEqual([]);
  });

  it('keeps combatUtils free of a second roller implementation', () => {
    const source = fs.readFileSync(path.join(SRC, 'src/utils/combat/combatUtils.ts'), 'utf8');
    const declared = ROLLER_NAMES.filter(n =>
      new RegExp(`function\\s+${n}\\s*\\(`).test(source)
    );

    expect(
      declared,
      `combatUtils re-declares ${declared.join(', ')}. The one implementation lives in ` +
        `'${ROLLERS}' (Remy ruling q1, 2026-09-20). See ${DEEPDIVE}.`
    ).toEqual([]);
  });

  it('keeps Math.random out of every function named roll*', () => {
    // Matches `function rollFoo(`, `const rollFoo = (`, `rollFoo(` as a method,
    // then scans that function's body by brace depth.
    const DECL =
      /(?:function\s+(roll\w*)\s*\(|(?:const|let)\s+(roll\w*)\s*(?::[^=]+)?=\s*(?:async\s*)?\(|\b(roll\w*)\s*\([^)]*\)\s*(?::[^{;]+)?\{)/g;
    const offenders: string[] = [];

    for (const rel of PRODUCTION_FILES) {
      const source = fs.readFileSync(path.join(SRC, rel), 'utf8');
      if (!source.includes('Math.random')) continue;

      for (const match of source.matchAll(DECL)) {
        const name = match[1] ?? match[2] ?? match[3];
        const open = source.indexOf('{', match.index! + match[0].length - 1);
        if (open < 0) continue;
        let depth = 0;
        let i = open;
        for (; i < source.length; i++) {
          if (source[i] === '{') depth++;
          else if (source[i] === '}' && --depth === 0) break;
        }
        if (source.slice(open, i).includes('Math.random')) {
          offenders.push(`${rel}: ${name}()`);
        }
      }
    }

    expect(
      offenders,
      `These roll helpers draw from Math.random, so their result is not reproducible ` +
        `and never reaches the audit log. Roll through '${ROLLERS}'.\nSee ${DEEPDIVE}.\n` +
        offenders.map(o => `  - ${o}`).join('\n')
    ).toEqual([]);
  });
});
