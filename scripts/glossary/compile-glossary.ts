/**
 * Glossary compiler CLI — the build gate.
 *
 * Compiles every non-spell glossary entry's markdown into the typed content
 * model, validates it, builds the cross-reference graph, and emits:
 *   public/data/glossary_bundle.v2.json   (compiled docs)
 *   public/data/glossary_graph.json       (bidirectional reference graph)
 *
 * Any compile error or validation issue fails the run (exit 1) — no
 * grandfathered baseline. Run with --report to see the full issue inventory
 * without writing outputs.
 *
 * Usage: tsx scripts/glossary/compile-glossary.ts [--report]
 * Spec: docs/superpowers/specs/2026-07-06-glossary-structured-content-design.md
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  compileEntry,
  type CompileError,
} from '../../src/systems/glossary/compile/compileEntry';
import {
  buildResolveContext,
  isRenderable,
  type BundleEntryLike,
} from '../../src/systems/glossary/compile/resolve';
import { buildGraph } from '../../src/systems/glossary/compile/graph';
import {
  hasStructuredContent,
  validateDoc,
  type ValidationIssue,
} from '../../src/systems/glossary/compile/validate';
import type { GlossaryDoc } from '../../src/systems/glossary/contentModel';

const ROOT = process.cwd();
const BUNDLE_PATH = path.join(ROOT, 'public/data/glossary_bundle.json');
const V2_OUT = path.join(ROOT, 'public/data/glossary_bundle.v2.json');
const GRAPH_OUT = path.join(ROOT, 'public/data/glossary_graph.json');
const ENRICHMENT_PATH = path.join(
  ROOT,
  'public/data/glossary/entries/rules/spells/spell_referenced_rules_enrichment.json',
);

interface Issue {
  entryId: string;
  code: string;
  message: string;
}

function main(): void {
  const reportOnly = process.argv.includes('--report');
  const bundle: BundleEntryLike[] = JSON.parse(
    fs.readFileSync(BUNDLE_PATH, 'utf8'),
  );
  const ctx = buildResolveContext(bundle);

  const docs: GlossaryDoc[] = [];
  const issues: Issue[] = [];
  const seen = new Set<string>();
  let scanned = 0;

  const walk = (entries: BundleEntryLike[]) => {
    for (const entry of entries) {
      if (
        !seen.has(entry.id) &&
        entry.filePath &&
        entry.category !== 'Spells'
      ) {
        seen.add(entry.id);
        const filePath = path.join(
          ROOT,
          'public',
          entry.filePath.replace(/^\//, ''),
        );
        if (!fs.existsSync(filePath)) {
          issues.push({
            entryId: entry.id,
            code: 'missing-file',
            message: `filePath does not exist: ${entry.filePath}`,
          });
        } else {
          scanned++;
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
              excerpt: (entry as { excerpt?: string }).excerpt ?? '',
              markdown,
            },
            ctx,
          );
          issues.push(...errors.map(toIssue));
          const structured = hasStructuredContent(raw);
          issues.push(
            ...validateDoc(doc)
              .filter((i) => !(i.code === 'empty-doc' && structured))
              .map(toIssue),
          );
          docs.push(doc);
        }
      }
      // seeAlso must resolve for every entry, including spells
      for (const target of entry.seeAlso ?? []) {
        if (!ctx.resolve(target)) {
          issues.push({
            entryId: entry.id,
            code: 'dead-see-also',
            message: `seeAlso "${target}" does not resolve to renderable content`,
          });
        }
      }
      if (entry.subEntries) walk(entry.subEntries);
    }
  };
  walk(bundle);

  const spellRuleRefs = loadSpellRuleRefs();
  const graph = buildGraph({ bundle, docs, spellRuleRefs });

  const byCode = new Map<string, Issue[]>();
  for (const issue of issues) {
    (byCode.get(issue.code) ?? byCode.set(issue.code, []).get(issue.code))!.push(
      issue,
    );
  }

  console.log(
    `glossary compile: ${scanned} entries compiled, ${docs.length} docs, ${issues.length} issues`,
  );
  for (const [code, list] of [...byCode.entries()].sort()) {
    const entryCount = new Set(list.map((i) => i.entryId)).size;
    console.log(`  ${code}: ${list.length} issues across ${entryCount} entries`);
    const limit = reportOnly ? 10 : 3;
    for (const issue of list.slice(0, limit)) {
      console.log(`    - [${issue.entryId}] ${issue.message}`);
    }
    if (list.length > limit) console.log(`    … ${list.length - limit} more`);
  }

  if (issues.length > 0) {
    if (reportOnly) {
      fs.writeFileSync(
        path.join(ROOT, '.agent/scratch/glossary-compile-report.json'),
        JSON.stringify(issues, null, 1),
      );
      console.log(
        '\nreport written to .agent/scratch/glossary-compile-report.json',
      );
    }
    console.error('\nglossary compile FAILED — fix the source, not the gate.');
    process.exit(1);
  }

  fs.writeFileSync(V2_OUT, JSON.stringify({ schemaVersion: 1, docs }));
  fs.writeFileSync(GRAPH_OUT, JSON.stringify(graph));
  console.log(`wrote ${path.relative(ROOT, V2_OUT)} and ${path.relative(ROOT, GRAPH_OUT)}`);
}

function toIssue(e: CompileError | ValidationIssue): Issue {
  return { entryId: e.entryId, code: e.code, message: e.message };
}

function loadSpellRuleRefs(): Record<string, string[]> {
  if (!fs.existsSync(ENRICHMENT_PATH)) return {};
  const raw = JSON.parse(fs.readFileSync(ENRICHMENT_PATH, 'utf8'));
  // Expected shape: { [ruleId]: { spells: string[] } } or { [ruleId]: string[] }
  const out: Record<string, string[]> = {};
  for (const [ruleId, value] of Object.entries(raw)) {
    if (Array.isArray(value)) out[ruleId] = value as string[];
    else if (value && Array.isArray((value as { spells?: string[] }).spells)) {
      out[ruleId] = (value as { spells: string[] }).spells;
    }
  }
  return out;
}

main();
