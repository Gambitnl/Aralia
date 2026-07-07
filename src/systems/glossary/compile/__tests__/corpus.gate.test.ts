/**
 * Corpus gate: compiles every shipped glossary entry and asserts the build
 * gate is clean. This is the same check scripts/glossary/compile-glossary.ts
 * enforces in the build; running it in vitest means a broken entry fails
 * `npm test` locally too, not just the Pages build.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileEntry } from '../compileEntry';
import { buildResolveContext, type BundleEntryLike } from '../resolve';
import { hasStructuredContent, validateDoc } from '../validate';

const ROOT = process.cwd();
const BUNDLE_PATH = path.join(ROOT, 'public/data/glossary_bundle.json');

describe('glossary corpus gate', () => {
  it('detects a deliberately broken entry (gate is not a rubber stamp)', () => {
    const ctx = buildResolveContext([]);
    const { doc, errors } = compileEntry(
      {
        id: 'broken',
        title: 'Broken',
        category: 'Rules Glossary',
        excerpt: '',
        markdown: 'A [[missing_target]] link and <div>raw html</div>',
      },
      ctx,
    );
    expect(errors.length + validateDoc(doc).length).toBeGreaterThan(0);
  });

  it('compiles the entire shipped bundle with zero issues', () => {
    const bundle: BundleEntryLike[] = JSON.parse(
      fs.readFileSync(BUNDLE_PATH, 'utf8'),
    );
    const ctx = buildResolveContext(bundle);
    const problems: string[] = [];
    const seen = new Set<string>();

    const walk = (entries: BundleEntryLike[]) => {
      for (const entry of entries) {
        if (!seen.has(entry.id) && entry.filePath && entry.category !== 'Spells') {
          seen.add(entry.id);
          const filePath = path.join(ROOT, 'public', entry.filePath.replace(/^\//, ''));
          if (!fs.existsSync(filePath)) {
            problems.push(`${entry.id}: missing file ${entry.filePath}`);
          } else {
            const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const markdown =
              typeof raw.markdown === 'string'
                ? raw.markdown
                : typeof raw.content === 'string'
                  ? raw.content
                  : '';
            const { doc, errors } = compileEntry(
              {
                id: entry.id,
                title: entry.title,
                category: entry.category,
                excerpt: '',
                markdown,
              },
              ctx,
            );
            const structured = hasStructuredContent(raw);
            for (const e of errors) problems.push(`${e.entryId}: ${e.code} ${e.message}`);
            for (const i of validateDoc(doc)) {
              if (i.code === 'empty-doc' && structured) continue;
              problems.push(`${i.entryId}: ${i.code} ${i.message}`);
            }
          }
        }
        for (const target of entry.seeAlso ?? []) {
          if (!ctx.resolve(target)) {
            problems.push(`${entry.id}: dead seeAlso "${target}"`);
          }
        }
        if (entry.subEntries) walk(entry.subEntries);
      }
    };
    walk(bundle);

    expect(seen.size).toBeGreaterThan(1500);
    expect(problems.slice(0, 20)).toEqual([]);
    expect(problems.length).toBe(0);
  });
});
