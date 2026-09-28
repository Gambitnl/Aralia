import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  findRuleChipDestinationProblems,
  findUnindexedRuleTermIds,
  labelToTermId,
} from '../generateSpellReferencedRulesEnrichment';

/**
 * Acceptance checks for the referenced-rule destination guarantee (agora-9833).
 *
 * The gap: SpellCardTemplate renders a rule chip for every referenced rule the
 * enrichment dataset emits and navigates by `glossaryTermId`. Nothing proved
 * that each emitted term id actually has a glossary entry behind it, so a chip
 * could silently degrade into a link that goes nowhere.
 *
 * These tests cover the two verification helpers with fixtures, the term-id
 * minting rule that decides whether a label is an area shape, and the committed
 * dataset itself, which must keep every chip pointed at a real destination.
 */

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ENRICHMENT_FILE = path.resolve(
  REPO_ROOT,
  'public',
  'data',
  'glossary',
  'entries',
  'rules',
  'spells',
  'spell_referenced_rules_enrichment.json',
);

describe('findRuleChipDestinationProblems', () => {
  it('reports nothing when every chip has a destination entry', () => {
    const problems = findRuleChipDestinationProblems(
      [{ spellId: 'fireball', referencedRules: [{ label: 'Sphere', glossaryTermId: 'sphere_area' }] }],
      new Set(['sphere_area']),
    );

    expect(problems).toEqual([]);
  });

  it('reports a chip whose term id has no glossary entry', () => {
    const problems = findRuleChipDestinationProblems(
      [{ spellId: 'fireball', referencedRules: [{ label: 'Sphere', glossaryTermId: 'sphere_area' }] }],
      new Set(['cone_area']),
    );

    expect(problems).toEqual([
      { spellId: 'fireball', label: 'Sphere', glossaryTermId: 'sphere_area', reason: 'no_destination_entry' },
    ]);
  });

  it('reports a chip that carries no term id at all', () => {
    const problems = findRuleChipDestinationProblems(
      [{ spellId: 'bless', referencedRules: [{ label: 'Concentration' }] }],
      new Set(['concentration']),
    );

    expect(problems).toEqual([
      { spellId: 'bless', label: 'Concentration', glossaryTermId: '', reason: 'missing_term_id' },
    ]);
  });

  it('keeps one problem row per spell so the operator can see every affected card', () => {
    const problems = findRuleChipDestinationProblems(
      [
        { spellId: 'bless', referencedRules: [{ label: 'Prone', glossaryTermId: 'prone' }] },
        { spellId: 'bane', referencedRules: [{ label: 'Prone', glossaryTermId: 'prone' }] },
      ],
      new Set(),
    );

    expect(problems.map((problem) => problem.spellId)).toEqual(['bless', 'bane']);
  });
});

describe('findUnindexedRuleTermIds', () => {
  it('names the destinations the compiled glossary index has not picked up yet', () => {
    expect(findUnindexedRuleTermIds(['sphere_area', 'cone_area'], new Set(['cone_area']))).toEqual(['sphere_area']);
  });

  it('deduplicates and sorts so the remediation line stays readable', () => {
    expect(findUnindexedRuleTermIds(['line_area', 'cube_area', 'line_area'], new Set())).toEqual([
      'cube_area',
      'line_area',
    ]);
  });

  it('returns nothing when every destination is indexed', () => {
    expect(findUnindexedRuleTermIds(['sphere_area'], new Set(['sphere_area']))).toEqual([]);
  });
});

describe('labelToTermId', () => {
  it('suffixes area shapes so they keep the established *_area destination ids', () => {
    expect(labelToTermId('Sphere')).toBe('sphere_area');
    // A plural label still gets the area suffix. Collapsing plurals onto one id
    // stays the alias table's job, so this keeps the raw slug it always used.
    expect(labelToTermId('Cubes')).toBe('cubes_area');
    expect(labelToTermId('Emanation')).toBe('emanation_area');
  });

  it('leaves a non-shape rule as a plain slug instead of mislabeling it as an area', () => {
    expect(labelToTermId('Prone')).toBe('prone');
    expect(labelToTermId('Surprise Round')).toBe('surprise_round');
  });
});

describe('committed spell referenced-rules enrichment dataset', () => {
  const dataset = JSON.parse(fs.readFileSync(ENRICHMENT_FILE, 'utf8')).enrichmentDataset as {
    rules: Array<{ glossaryTermId: string }>;
    spells: Array<{ spellId: string; referencedRules: Array<{ label: string; glossaryTermId?: string }> }>;
  };

  /** Every glossary entry id that exists as a file under public/data/glossary/entries. */
  const entryIds = (() => {
    const ids = new Set<string>();
    const queue = [path.resolve(REPO_ROOT, 'public', 'data', 'glossary', 'entries')];

    while (queue.length > 0) {
      const current = queue.pop();
      if (!current) continue;

      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          queue.push(fullPath);
          continue;
        }
        if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

        try {
          const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as { id?: unknown };
          if (typeof parsed.id === 'string') ids.add(parsed.id);
        } catch {
          // A malformed entry is a different failure with its own tooling; this
          // check only cares about the ids that do parse.
        }
      }
    }

    return ids;
  })();

  /** Every entry id the running glossary can actually resolve through the compiled index. */
  const indexedIds = (() => {
    const ids = new Set<string>();
    const indexDir = path.resolve(REPO_ROOT, 'public', 'data', 'glossary', 'index');

    for (const fileName of fs.readdirSync(indexDir)) {
      if (!fileName.endsWith('.json')) continue;
      const parsed = JSON.parse(fs.readFileSync(path.join(indexDir, fileName), 'utf8')) as unknown;
      if (!Array.isArray(parsed)) continue;
      for (const record of parsed) {
        const id = (record as { id?: unknown })?.id;
        if (typeof id === 'string') ids.add(id);
      }
    }

    return ids;
  })();

  it('emits at least one rule chip, so this check cannot pass on an empty dataset', () => {
    const chipCount = dataset.spells.reduce((total, spell) => total + spell.referencedRules.length, 0);
    expect(chipCount).toBeGreaterThan(0);
  });

  it('points every emitted rule chip at a glossary entry that exists on disk', () => {
    expect(findRuleChipDestinationProblems(dataset.spells, entryIds)).toEqual([]);
  });

  it('keeps every rule destination present in the compiled glossary index', () => {
    expect(findUnindexedRuleTermIds(dataset.rules.map((rule) => rule.glossaryTermId), indexedIds)).toEqual([]);
  });
});
