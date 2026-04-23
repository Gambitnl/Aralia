import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Emits a browser-readable artifact describing which structured-.md fields are
// read by which audit script. The preview's audit-coverage matrix consumes this
// instead of hardcoding the list, so coverage drift is caught when the generator
// re-runs.
//
// Called by: `npx tsx scripts/generateSpellAuditCoverage.ts`
// Writes to: `public/data/spell_audit_coverage.json`

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const SPELLS_REFERENCE_ROOT = path.resolve(REPO_ROOT, 'docs', 'spells', 'reference');
const OUT_PATH = path.resolve(REPO_ROOT, 'public', 'data', 'spell_audit_coverage.json');

const AUDIT_SCRIPTS = [
  {
    id: 'canonicalAudit',
    label: 'auditSpellStructuredAgainstCanonical.ts',
    path: path.resolve(REPO_ROOT, 'scripts', 'auditSpellStructuredAgainstCanonical.ts'),
  },
  {
    id: 'structuredJsonAudit',
    label: 'auditSpellStructuredAgainstJson.ts',
    path: path.resolve(REPO_ROOT, 'scripts', 'auditSpellStructuredAgainstJson.ts'),
  },
  {
    id: 'parityScript',
    label: 'validateSpellMarkdownParity.ts',
    path: path.resolve(REPO_ROOT, 'scripts', 'validateSpellMarkdownParity.ts'),
  },
] as const;

type ScriptId = typeof AUDIT_SCRIPTS[number]['id'];

interface FieldCoverage {
  field: string;
  appearsInStructuredMd: boolean;
  mdFileCount: number;
  coverage: Record<ScriptId, boolean>;
}

interface CoverageArtifact {
  generatedAt: string;
  scripts: Record<ScriptId, { label: string; fieldsRead: string[] }>;
  fields: FieldCoverage[];
}

interface ExtractedLabels {
  literals: Set<string>;
  patterns: RegExp[];
}

function extractLabelsFromScript(scriptPath: string): ExtractedLabels {
  const source = fs.readFileSync(scriptPath, 'utf8');
  const literals = new Set<string>();
  const patterns: RegExp[] = [];

  const quoted = /labels\.get\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = quoted.exec(source)) !== null) {
    literals.add(match[1]);
  }

  const templated = /labels\.get\(\s*`([^`]+)`\s*\)/g;
  while ((match = templated.exec(source)) !== null) {
    const template = match[1];
    const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const withWildcards = escaped.replace(/\\\$\\\{[^}]+\\\}/g, '[^`]*');
    patterns.push(new RegExp(`^${withWildcards}$`));
  }

  const fieldPattern = /field:\s*['"]([A-Z][A-Za-z/ -]+)['"]/g;
  while ((match = fieldPattern.exec(source)) !== null) {
    literals.add(match[1]);
  }

  return { literals, patterns };
}

function scriptReadsField(extracted: ExtractedLabels, field: string): boolean {
  if (extracted.literals.has(field)) return true;
  return extracted.patterns.some(p => p.test(field));
}

function findStructuredMdFiles(root: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...findStructuredMdFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

function extractFieldLabelsFromMd(mdPath: string): Set<string> {
  const source = fs.readFileSync(mdPath, 'utf8');
  const labels = new Set<string>();
  const headerMarker = source.indexOf('## Canonical D&D Beyond Snapshot');
  const fieldRegion = headerMarker >= 0 ? source.slice(0, headerMarker) : source;
  const pattern = /^-\s+\*\*([^*]+)\*\*\s*:/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(fieldRegion)) !== null) {
    labels.add(match[1].trim());
  }
  return labels;
}

function buildArtifact(): CoverageArtifact {
  const scriptLabels: Record<ScriptId, ExtractedLabels> = {
    canonicalAudit: { literals: new Set(), patterns: [] },
    structuredJsonAudit: { literals: new Set(), patterns: [] },
    parityScript: { literals: new Set(), patterns: [] },
  };

  for (const entry of AUDIT_SCRIPTS) {
    scriptLabels[entry.id] = extractLabelsFromScript(entry.path);
  }

  const mdFiles = findStructuredMdFiles(SPELLS_REFERENCE_ROOT);
  const mdFieldCounts = new Map<string, number>();
  for (const mdPath of mdFiles) {
    const labels = extractFieldLabelsFromMd(mdPath);
    for (const label of labels) {
      mdFieldCounts.set(label, (mdFieldCounts.get(label) ?? 0) + 1);
    }
  }

  const allFields = new Set<string>();
  for (const extracted of Object.values(scriptLabels)) {
    for (const f of extracted.literals) allFields.add(f);
  }
  for (const f of mdFieldCounts.keys()) allFields.add(f);

  const fields: FieldCoverage[] = Array.from(allFields).sort().map(field => {
    const mdFileCount = mdFieldCounts.get(field) ?? 0;
    return {
      field,
      appearsInStructuredMd: mdFileCount > 0,
      mdFileCount,
      coverage: {
        canonicalAudit: scriptReadsField(scriptLabels.canonicalAudit, field),
        structuredJsonAudit: scriptReadsField(scriptLabels.structuredJsonAudit, field),
        parityScript: scriptReadsField(scriptLabels.parityScript, field),
      },
    };
  });

  const scripts = {} as CoverageArtifact['scripts'];
  for (const entry of AUDIT_SCRIPTS) {
    scripts[entry.id] = {
      label: entry.label,
      fieldsRead: Array.from(scriptLabels[entry.id].literals).sort(),
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    scripts,
    fields,
  };
}

function main(): void {
  const artifact = buildArtifact();
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(artifact, null, 2) + '\n', 'utf8');

  const fieldsWithAnyGap = artifact.fields.filter(f => !f.coverage.canonicalAudit || !f.coverage.structuredJsonAudit || !f.coverage.parityScript);
  const fieldsInMdButUnaudited = artifact.fields.filter(f => f.appearsInStructuredMd && !f.coverage.canonicalAudit && !f.coverage.structuredJsonAudit && !f.coverage.parityScript);

  console.log(`Wrote ${OUT_PATH}`);
  console.log(`  total fields tracked: ${artifact.fields.length}`);
  console.log(`  fields in .md files:   ${artifact.fields.filter(f => f.appearsInStructuredMd).length}`);
  console.log(`  fields with >=1 gap:   ${fieldsWithAnyGap.length}`);
  console.log(`  fields in .md but no audit reads them: ${fieldsInMdButUnaudited.length}`);
  if (fieldsInMdButUnaudited.length > 0) {
    console.log('    ->', fieldsInMdButUnaudited.map(f => f.field).join(', '));
  }
}

main();
