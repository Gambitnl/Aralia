import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ZodIssue } from 'zod';
import { SpellValidator } from '../src/systems/spells/validation/spellValidator';
import { buildReport as buildStructuredCanonicalReport } from './auditSpellStructuredAgainstCanonical';
import { buildReport as buildStructuredJsonReport, type StructuredVsJsonReport } from './auditSpellStructuredAgainstJson';

/**
 * This script generates a browser-readable spell gate report for the glossary dev surface.
 *
 * The live glossary already knows how to fetch each spell JSON and run the schema validator,
 * but that only gives the UI a coarse pass/fail answer. The spell-truth workflow has since
 * grown richer than that: the repo now also has current structured-vs-canonical and
 * structured-vs-JSON audit lanes. This file brings those layers together into one public JSON
 * artifact that the app can fetch without trying to run Node-only tooling in the browser.
 *
 * Called by: `npx tsx scripts/generateSpellGateReport.ts`
 * Writes to: `public/data/spell_gate_report.json`
 * Depends on:
 * - `public/data/spells/**`
 * - the live spell schema in `src/systems/spells/validation/spellValidator.ts`
 * - the current canonical and runtime comparison audits in `scripts/`
 */

// ============================================================================
// Paths and artifact shapes
// ============================================================================
// This section centralizes filesystem locations and defines the JSON shape that
// the browser will consume. The browser should not need to understand the full
// validator scripts. It just needs one per-spell snapshot that answers:
// "Is this spell structurally valid, and what spell-truth warnings still exist?"
// ============================================================================

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const SPELLS_ROOT = path.resolve(REPO_ROOT, 'public', 'data', 'spells');
const OUT_PATH = path.resolve(REPO_ROOT, 'public', 'data', 'spell_gate_report.json');
type CanonicalReviewState =
  | 'clean'
  | 'mismatch'
  | 'not_reviewed';

type StructuredJsonReviewState =
  | 'clean'
  | 'mismatch'
  | 'not_reviewed';

interface SpellGateArtifactEntry {
  spellId: string;
  spellName: string;
  level: number;
  jsonPath: string;
  schema: {
    valid: boolean;
    issues: string[];
  };
  localData: {
    classesCount: number;
    subClassesCount: number;
    subClassesVerification: string;
    flags: string[];
  };
  canonicalReview: {
    state: CanonicalReviewState;
    generatedAt?: string;
    mismatchCount: number;
    mismatchFields: string[];
    mismatchSummaries: string[];
  };
  structuredJsonReview: {
    state: StructuredJsonReviewState;
    generatedAt?: string;
    mismatchCount: number;
    mismatchFields: string[];
    mismatchSummaries: string[];
  };
}

interface SpellGateArtifact {
  generatedAt: string;
  spellCount: number;
  spells: Record<string, SpellGateArtifactEntry>;
}

interface ScriptOptions {
  spellId?: string;
}

// ============================================================================
// Shared readers
// ============================================================================
// This section enumerates the live spell corpus from disk. The gate report now
// builds from the current repo-local audits instead of the older retrieval
// artifact so the glossary reflects the present spell-truth state.
// ============================================================================

function listSpellJsonFiles(): string[] {
  const files: string[] = [];

  for (let level = 0; level <= 9; level += 1) {
    const levelDir = path.join(SPELLS_ROOT, `level-${level}`);
    if (!fs.existsSync(levelDir)) continue;

    for (const file of fs.readdirSync(levelDir).filter((entry) => entry.endsWith('.json'))) {
      files.push(path.join(levelDir, file));
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function findSpellJsonPath(spellId: string): string | null {
  return listSpellJsonFiles().find((jsonPath) => path.basename(jsonPath, '.json') === spellId) ?? null;
}

// ============================================================================
// Normalization helpers
// ============================================================================
// This section translates live spell JSON and current audit results
// into the compact states the glossary can show. The goal is not to duplicate the
// whole audit report in the UI. The goal is to surface the few facts a developer
// needs while clicking through spell entries.
// ============================================================================

function formatZodIssue(issue: ZodIssue): string {
  const pathLabel = issue.path.length > 0 ? issue.path.join('.') : '(root)';
  return `${pathLabel}: ${issue.message}`;
}

function getCanonicalReviewState(mismatchCount: number, hasComparableCanonicalData: boolean): CanonicalReviewState {
  if (!hasComparableCanonicalData) return 'not_reviewed';
  if (mismatchCount === 0) return 'clean';
  return 'mismatch';
}

function getStructuredJsonReviewState(
  report: StructuredVsJsonReport,
  spellId: string,
): StructuredJsonReviewState {
  const mismatchCount = report.mismatches.filter((mismatch) => mismatch.spellId === spellId).length;
  if (mismatchCount === 0) return 'clean';
  return 'mismatch';
}

function buildLocalDataFlags(spell: Record<string, unknown>): {
  classesCount: number;
  subClassesCount: number;
  subClassesVerification: string;
  flags: string[];
} {
  const classes = Array.isArray(spell.classes) ? spell.classes : [];
  const subClasses = Array.isArray(spell.subClasses) ? spell.subClasses : [];
  const subClassesVerification = typeof spell.subClassesVerification === 'string'
    ? spell.subClassesVerification
    : 'missing';
  const flags: string[] = [];

  // An empty classes list is a strong sign that the spell still lacks basic access
  // data, so keep that visible in the glossary gate view.
  if (classes.length === 0) {
    flags.push('classes-empty');
  }

  return {
    classesCount: classes.length,
    subClassesCount: subClasses.length,
    subClassesVerification,
    flags,
  };
}

// ============================================================================
// Per-spell gate entry builder
// ============================================================================
// The glossary now needs a way to refresh only the spell the user is currently
// looking at. This helper builds the exact same gate payload as the full corpus
// run, but for one spell at a time so the dev UI can ask for a live answer
// without paying the cost of rebuilding the entire artifact.
// ============================================================================

export function buildSpellGateEntryForSpell(spellId: string): SpellGateArtifactEntry {
  const jsonPath = findSpellJsonPath(spellId);

  if (!jsonPath) {
    throw new Error(`Spell JSON not found for spellId "${spellId}".`);
  }

  const spell = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as Record<string, unknown>;
  const spellName = typeof spell.name === 'string' ? spell.name : spellId;
  const level = typeof spell.level === 'number' ? spell.level : -1;
  const parsed = SpellValidator.safeParse(spell);
  const structuredCanonicalReport = buildStructuredCanonicalReport({ spellId });
  const structuredCanonicalMismatches = structuredCanonicalReport.mismatches.filter((mismatch) => mismatch.spellId === spellId);
  const structuredJsonReport = buildStructuredJsonReport({ spellId });
  const structuredJsonMismatches = structuredJsonReport.mismatches.filter((mismatch) => mismatch.spellId === spellId);

  const schemaIssues = parsed.success
    ? []
    : parsed.error.issues.map((issue) => formatZodIssue(issue));

  return {
    spellId,
    spellName,
    level,
    jsonPath: path.relative(REPO_ROOT, jsonPath).replace(/\\/g, '/'),
    schema: {
      valid: parsed.success,
      issues: schemaIssues,
    },
    localData: buildLocalDataFlags(spell),
    canonicalReview: {
      state: getCanonicalReviewState(
        structuredCanonicalMismatches.length,
        structuredCanonicalReport.comparedSpellFiles > 0,
      ),
      generatedAt: structuredCanonicalReport.generatedAt,
      mismatchCount: structuredCanonicalMismatches.length,
      mismatchFields: Array.from(new Set(structuredCanonicalMismatches.map((mismatch) => mismatch.field))),
      mismatchSummaries: structuredCanonicalMismatches.map((mismatch) => mismatch.summary),
    },
    structuredJsonReview: {
      state: getStructuredJsonReviewState(structuredJsonReport, spellId),
      generatedAt: structuredJsonReport.generatedAt,
      mismatchCount: structuredJsonMismatches.length,
      mismatchFields: Array.from(new Set(structuredJsonMismatches.map((mismatch) => mismatch.field))),
      mismatchSummaries: structuredJsonMismatches.map((mismatch) => mismatch.summary),
    },
  };
}

// ============================================================================
// Artifact assembly
// ============================================================================
// This section walks every spell JSON, runs the live schema validator, merges in
// the current canonical and runtime comparison records, and assembles one
// per-spell gate payload.
// The result is intentionally redundant: duplication here is cheaper than making
// the browser reconstruct the spell-truth state from multiple local files.
// ============================================================================

export function buildSpellGateArtifact(options: ScriptOptions = {}): SpellGateArtifact {
  const structuredCanonicalReport = buildStructuredCanonicalReport(options);
  const structuredCanonicalMismatchesBySpellId = new Map<string, ReturnType<typeof buildStructuredCanonicalReport>['mismatches']>(
    Object.entries(
      structuredCanonicalReport.mismatches.reduce<Record<string, ReturnType<typeof buildStructuredCanonicalReport>['mismatches']>>((accumulator, mismatch) => {
        if (!accumulator[mismatch.spellId]) {
          accumulator[mismatch.spellId] = [];
        }
        accumulator[mismatch.spellId].push(mismatch);
        return accumulator;
      }, {}),
    ),
  );
  const structuredJsonReport = buildStructuredJsonReport(options);
  const structuredJsonMismatchesBySpellId = new Map<string, StructuredVsJsonReport['mismatches']>(
    Object.entries(
      structuredJsonReport.mismatches.reduce<Record<string, StructuredVsJsonReport['mismatches']>>((accumulator, mismatch) => {
        if (!accumulator[mismatch.spellId]) {
          accumulator[mismatch.spellId] = [];
        }
        accumulator[mismatch.spellId].push(mismatch);
        return accumulator;
      }, {}),
    ),
  );

  const spells: Record<string, SpellGateArtifactEntry> = {};

  const jsonPaths = options.spellId
    ? [findSpellJsonPath(options.spellId)].filter((value): value is string => Boolean(value))
    : listSpellJsonFiles();

  for (const jsonPath of jsonPaths) {
    const spell = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as Record<string, unknown>;
    const spellId = typeof spell.id === 'string' ? spell.id : path.basename(jsonPath, '.json');
    const spellName = typeof spell.name === 'string' ? spell.name : spellId;
    const level = typeof spell.level === 'number' ? spell.level : -1;
    const parsed = SpellValidator.safeParse(spell);
    const structuredCanonicalMismatches = structuredCanonicalMismatchesBySpellId.get(spellId) ?? [];
    const canonicalReviewState = getCanonicalReviewState(
      structuredCanonicalMismatches.length,
      structuredCanonicalReport.comparedSpellFiles > 0,
    );
    const structuredJsonMismatches = structuredJsonMismatchesBySpellId.get(spellId) ?? [];

    // Keep the full schema issue strings so the glossary can show concrete failure
    // reasons instead of only the generic "schema failed" label.
    const schemaIssues = parsed.success
      ? []
      : parsed.error.issues.map((issue) => formatZodIssue(issue));

    const localData = buildLocalDataFlags(spell);

    spells[spellId] = {
      spellId,
      spellName,
      level,
      jsonPath: path.relative(REPO_ROOT, jsonPath).replace(/\\/g, '/'),
      schema: {
        valid: parsed.success,
        issues: schemaIssues,
      },
      localData,
      canonicalReview: {
        state: canonicalReviewState,
        generatedAt: structuredCanonicalReport.generatedAt,
        mismatchCount: structuredCanonicalMismatches.length,
        mismatchFields: Array.from(new Set(structuredCanonicalMismatches.map((mismatch) => mismatch.field))),
        mismatchSummaries: structuredCanonicalMismatches.map((mismatch) => mismatch.summary),
      },
      structuredJsonReview: {
        state: getStructuredJsonReviewState(structuredJsonReport, spellId),
        generatedAt: structuredJsonReport.generatedAt,
        mismatchCount: structuredJsonMismatches.length,
        mismatchFields: Array.from(new Set(structuredJsonMismatches.map((mismatch) => mismatch.field))),
        mismatchSummaries: structuredJsonMismatches.map((mismatch) => mismatch.summary),
      },
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    spellCount: Object.keys(spells).length,
    spells,
  };
}

// ============================================================================
// Main entry
// ============================================================================
// This section writes the final public artifact and prints a compact summary so
// the developer knows what kind of gate data the glossary can now visualize.
// ============================================================================

function main(): void {
  const requestedSpellId = process.argv.find((arg) => arg.startsWith('--spell-id='))?.split('=')[1];
  const jsonOnly = process.argv.includes('--json');

  if (requestedSpellId && jsonOnly) {
    const entry = buildSpellGateEntryForSpell(requestedSpellId);
    console.log(JSON.stringify(entry, null, 2));
    return;
  }

  const artifact = buildSpellGateArtifact({ spellId: requestedSpellId });
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

  const invalidCount = Object.values(artifact.spells).filter((spell) => !spell.schema.valid).length;
  const canonicalMismatchCount = Object.values(artifact.spells).filter(
    (spell) => spell.canonicalReview.state === 'mismatch',
  ).length;
  const structuredJsonMismatchCount = Object.values(artifact.spells).filter(
    (spell) => spell.structuredJsonReview.state === 'mismatch',
  ).length;

  console.log('Generated spell gate report.');
  console.log(`Spells: ${artifact.spellCount}`);
  console.log(`Schema-invalid spells: ${invalidCount}`);
  console.log(`Structured-vs-canonical mismatch spells: ${canonicalMismatchCount}`);
  console.log(`Structured-vs-JSON mismatch spells: ${structuredJsonMismatchCount}`);
  console.log(`Wrote: ${OUT_PATH}`);
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  main();
}
