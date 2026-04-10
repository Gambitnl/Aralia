import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * This script turns spell-canonical referenced-rule links into a glossary enrichment dataset.
 *
 * The spell retrieval lane now preserves "Referenced Rules" inside each spell's inert canonical
 * snapshot block. That is useful evidence, but it is awkward to query spell-by-spell. This file
 * lifts those links into one dedicated rules glossary entry so the glossary layer can later use
 * the data as an enrichment surface without re-parsing every spell markdown file at runtime.
 *
 * Called manually by: Codex during the spell canonical-retrieval lane
 * Depends on:
 * - `docs/spells/reference/**`
 * Writes:
 * - `public/data/glossary/entries/rules/spells/spell_referenced_rules_enrichment.json`
 */

// ============================================================================
// Paths and constants
// ============================================================================
// This section keeps the markdown input and glossary output paths centralized.
// The output intentionally lands in the existing rules/spells glossary lane so
// it can be indexed by the normal glossary tooling instead of becoming a stray
// standalone report file.
// ============================================================================

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const SPELL_REFERENCE_ROOT = path.resolve(REPO_ROOT, 'docs', 'spells', 'reference');
const ENRICHMENT_OUT = path.resolve(
  REPO_ROOT,
  'public',
  'data',
  'glossary',
  'entries',
  'rules',
  'spells',
  'spell_referenced_rules_enrichment.json',
);
const GENERATED_RULES_OUT_DIR = path.resolve(
  REPO_ROOT,
  'public',
  'data',
  'glossary',
  'entries',
  'rules',
  'spells',
  'referenced',
);
const SNAPSHOT_HEADING = '## Canonical D&D Beyond Snapshot';
const COMMENT_OPEN = '<!--';
const COMMENT_CLOSE = '-->';
const CANONICAL_RULE_TEXT_OVERRIDES: Record<string, string> = {
  '/sources/dnd/free-rules/rules-glossary#SphereAreaofEffect': "A Sphere is an area of effect that extends in straight lines from a point of origin outward in all directions. The effect that creates a Sphere specifies the distance it extends as the radius of the Sphere. A Sphere's point of origin is included in the Sphere's area of effect.",
};

interface SpellReferenceRecord {
  spellId: string;
  name: string;
  level: number;
  markdownPath: string;
}

interface ReferencedRuleLink {
  label: string;
  href: string;
}

interface GlossaryEntryRecord {
  id: string;
  title: string;
  aliases: string[];
  markdown: string;
  excerpt: string;
  filePath: string;
  isGeneratedReferencedRule: boolean;
  isReferencedRulesHub: boolean;
}

interface SpellRuleReference {
  spellId: string;
  spellName: string;
  level: number;
  markdownPath: string;
  referencedRules: ReferencedRuleLink[];
}

interface AggregatedRuleEntry {
  id: string;
  label: string;
  description: string;
  glossaryTermId: string;
  glossaryFilePath: string;
  glossarySource: 'existing' | 'generated';
  spells: Array<{
    spellId: string;
    spellName: string;
    level: number;
    markdownPath: string;
  }>;
}

interface KnownRuleAlias {
  glossaryTermId: string;
  displayLabel: string;
  suppressed?: boolean;
}

interface RuleGlossaryResolution {
  glossaryTermId: string;
  glossaryFilePath: string;
  glossarySource: 'existing' | 'generated';
  description: string;
  displayLabel: string;
  descriptionPriority: number;
  suppressed: boolean;
  suppressionReason: string;
}

interface SuppressedRuleReference {
  label: string;
  normalizedLabel: string;
  reason: string;
  spells: Array<{
    spellId: string;
    spellName: string;
    level: number;
    markdownPath: string;
  }>;
}

// ============================================================================
// Rule normalization
// ============================================================================
// This section keeps the raw D&D Beyond labels and the Aralia glossary term ids
// connected without pretending every label is unique. The canonical snapshots
// often vary only by casing or pluralization ("Bright light" vs "Bright Light",
// "Cube" vs "Cubes"), so the enrichment lane needs one place to say "these are
// the same rule concept in Aralia terms".
// ============================================================================

const KNOWN_RULE_ALIASES: Record<string, KnownRuleAlias> = {
  attack: { glossaryTermId: 'attack_action', displayLabel: 'Attack' },
  attunement: { glossaryTermId: 'attunement', displayLabel: 'Attunement' },
  'bonus action': { glossaryTermId: 'bonus_action', displayLabel: 'Bonus Action' },
  'bright light': { glossaryTermId: 'bright_light', displayLabel: 'Bright Light' },
  burning: {
    glossaryTermId: 'burning',
    displayLabel: 'burning',
    suppressed: true,
  },
  concentration: { glossaryTermId: 'concentration', displayLabel: 'Concentration' },
  cone: { glossaryTermId: 'cone_area', displayLabel: 'Cone' },
  cube: { glossaryTermId: 'cube_area', displayLabel: 'Cube' },
  cubes: { glossaryTermId: 'cube_area', displayLabel: 'Cube' },
  curse: { glossaryTermId: 'curse', displayLabel: 'curse' },
  curses: { glossaryTermId: 'curse', displayLabel: 'curse' },
  cylinder: { glossaryTermId: 'cylinder_area', displayLabel: 'Cylinder' },
  damage: {
    glossaryTermId: 'damage',
    displayLabel: 'damage',
    suppressed: true,
  },
  darkness: { glossaryTermId: 'darkness', displayLabel: 'Darkness' },
  'd20 tests': { glossaryTermId: 'd20_test', displayLabel: 'D20 Tests' },
  dead: {
    glossaryTermId: 'dead',
    displayLabel: 'dead',
    suppressed: true,
  },
  dehydration: {
    glossaryTermId: 'dehydration',
    displayLabel: 'dehydration',
    suppressed: true,
  },
  'difficult terrain': { glossaryTermId: 'difficult_terrain', displayLabel: 'Difficult Terrain' },
  'dim light': { glossaryTermId: 'dim_light', displayLabel: 'Dim Light' },
  duration: { glossaryTermId: 'spell_duration_rules', displayLabel: 'Duration' },
  emanation: { glossaryTermId: 'emanation_area', displayLabel: 'Emanation' },
  force: {
    glossaryTermId: 'force',
    displayLabel: 'force',
    suppressed: true,
  },
  friendly: { glossaryTermId: 'friendly_attitude', displayLabel: 'Friendly' },
  'half cover': { glossaryTermId: 'half_cover', displayLabel: 'Half Cover' },
  'heavily obscured': { glossaryTermId: 'heavily_obscured', displayLabel: 'Heavily Obscured' },
  hostile: { glossaryTermId: 'hostile_attitude', displayLabel: 'Hostile' },
  indifferent: { glossaryTermId: 'indifferent_attitude', displayLabel: 'Indifferent' },
  line: { glossaryTermId: 'line_area', displayLabel: 'Line' },
  'lightly obscured': { glossaryTermId: 'lightly_obscured', displayLabel: 'Lightly Obscured' },
  malnutrition: {
    glossaryTermId: 'malnutrition',
    displayLabel: 'malnutrition',
    suppressed: true,
  },
  'melee spell attack': { glossaryTermId: 'attack_roll', displayLabel: 'Melee Spell Attack' },
  move: {
    glossaryTermId: 'move',
    displayLabel: 'move',
    suppressed: true,
  },
  'passive perception': { glossaryTermId: 'passive_perception', displayLabel: 'Passive Perception' },
  possessed: { glossaryTermId: 'possessed', displayLabel: 'possessed' },
  range: { glossaryTermId: 'spell_range_rules', displayLabel: 'Range' },
  'shape-shift': { glossaryTermId: 'shape_shift', displayLabel: 'Shape-Shifting' },
  'shape-shifted': { glossaryTermId: 'shape_shift', displayLabel: 'Shape-Shifting' },
  'shape-shifts': { glossaryTermId: 'shape_shift', displayLabel: 'Shape-Shifting' },
  sphere: { glossaryTermId: 'sphere_area', displayLabel: 'Sphere' },
  stable: { glossaryTermId: 'stable', displayLabel: 'Stable' },
  target: { glossaryTermId: 'spell_effects_rules', displayLabel: 'Target' },
  'temporary hit point': { glossaryTermId: 'temporary_hp', displayLabel: 'Temporary Hit Points' },
  'temporary hit points': { glossaryTermId: 'temporary_hp', displayLabel: 'Temporary Hit Points' },
  'three quarters cover': { glossaryTermId: 'three_quarters_cover', displayLabel: 'Three-Quarters Cover' },
  'three-quarters cover': { glossaryTermId: 'three_quarters_cover', displayLabel: 'Three-Quarters Cover' },
  'total cover': { glossaryTermId: 'total_cover', displayLabel: 'Total Cover' },
  turns: {
    glossaryTermId: 'turns',
    displayLabel: 'turns',
    suppressed: true,
  },
};

function normalizeRuleLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

// ============================================================================
// Markdown discovery
// ============================================================================
// This section walks the spell reference folders and derives the spell identity
// from the file location. The enrichment lane should remain tied to the actual
// markdown files that store the canonical snapshots.
// ============================================================================

function listSpellReferenceRecords(): SpellReferenceRecord[] {
  const records: SpellReferenceRecord[] = [];

  for (let level = 0; level <= 9; level += 1) {
    const levelDir = path.join(SPELL_REFERENCE_ROOT, `level-${level}`);
    if (!fs.existsSync(levelDir)) continue;

    const entries = fs.readdirSync(levelDir)
      .filter((entry) => entry.endsWith('.md'))
      .sort((a, b) => a.localeCompare(b));

    for (const fileName of entries) {
      const markdownPath = path.join(levelDir, fileName);
      const raw = fs.readFileSync(markdownPath, 'utf8');
      const headingMatch = raw.match(/^#\s+(.+)$/m);

      records.push({
        spellId: fileName.replace(/\.md$/i, ''),
        name: headingMatch ? headingMatch[1].trim() : fileName.replace(/\.md$/i, ''),
        level,
        markdownPath,
      });
    }
  }

  return records;
}

// ============================================================================
// Canonical comment parsing
// ============================================================================
// This section extracts only the inert canonical snapshot comment block. The
// project owner explicitly wanted the referenced rules to remain in that raw
// capture, so this parser reads the comment literally rather than mixing it
// with the structured Aralia spell field block above.
// ============================================================================

function extractCanonicalComment(markdown: string): string {
  const headingIndex = markdown.indexOf(SNAPSHOT_HEADING);
  if (headingIndex === -1) return '';

  const commentStart = markdown.indexOf(COMMENT_OPEN, headingIndex);
  const commentEnd = markdown.indexOf(COMMENT_CLOSE, commentStart + COMMENT_OPEN.length);
  if (commentStart === -1 || commentEnd === -1) return '';

  return markdown.slice(commentStart + COMMENT_OPEN.length, commentEnd).trim();
}

function extractReferencedRulesFromComment(commentBody: string): ReferencedRuleLink[] {
  const lines = commentBody.split(/\r?\n/).map((line) => line.trim());
  const sectionIndex = lines.findIndex((line) => line === 'Referenced Rules:');
  if (sectionIndex === -1) return [];

  const results: ReferencedRuleLink[] = [];
  for (let index = sectionIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) break;
    if (!line.includes(' -> ')) break;

    const [label, href] = line.split(' -> ');
    if (!label || !href) continue;

    results.push({
      label: label.trim(),
      href: href.trim(),
    });
  }

  return results;
}

function collectSpellRuleReferences(): SpellRuleReference[] {
  return listSpellReferenceRecords()
    .map((spell) => {
      const markdown = fs.readFileSync(spell.markdownPath, 'utf8');
      const commentBody = extractCanonicalComment(markdown);
      const referencedRules = extractReferencedRulesFromComment(commentBody);

      return {
        spellId: spell.spellId,
        spellName: spell.name,
        level: spell.level,
        markdownPath: spell.markdownPath,
        referencedRules,
      };
    })
    .filter((record) => record.referencedRules.length > 0);
}

// ============================================================================
// Glossary resolution
// ============================================================================
// This section resolves a referenced-rule label into descriptive glossary text.
// The owner explicitly asked for descriptive text instead of the raw source URL,
// so the output should surface the explanation, not just the link target. It
// also resolves or creates a real glossary destination so spell cards can show
// navigable rule chips instead of dead labels.
// ============================================================================

function stripMarkdownAndHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function listGlossaryEntries(): GlossaryEntryRecord[] {
  const entriesRoot = path.resolve(REPO_ROOT, 'public', 'data', 'glossary', 'entries');
  const records: GlossaryEntryRecord[] = [];
  const queue = [entriesRoot];

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
        const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as Record<string, unknown>;
        records.push({
          id: typeof parsed.id === 'string' ? parsed.id : entry.name.replace(/\.json$/i, ''),
          title: typeof parsed.title === 'string' ? parsed.title : '',
          aliases: Array.isArray(parsed.aliases) ? parsed.aliases.filter((alias): alias is string => typeof alias === 'string') : [],
          markdown: typeof parsed.markdown === 'string' ? parsed.markdown : '',
          excerpt: typeof parsed.excerpt === 'string' ? parsed.excerpt : '',
          filePath: typeof parsed.filePath === 'string' ? parsed.filePath : '',
          isGeneratedReferencedRule: normalizedRelPathStartsWith(fullPath, GENERATED_RULES_OUT_DIR),
          isReferencedRulesHub: typeof parsed.id === 'string' && parsed.id === 'spell_referenced_rules_enrichment',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Skipping malformed glossary entry during referenced-rules enrichment: ${fullPath} (${message})`);
      }
    }
  }

  return records;
}

function normalizedRelPathStartsWith(fullPath: string, prefixPath: string): boolean {
  const normalizedFullPath = fullPath.replace(/\\/g, '/').toLowerCase();
  const normalizedPrefixPath = prefixPath.replace(/\\/g, '/').toLowerCase();
  return normalizedFullPath.startsWith(normalizedPrefixPath);
}

function labelToTermId(label: string): string {
  return `${slugify(label)}_area`;
}

function extractBestDescriptionFromMarkdown(markdown: string, label: string): string {
  const plainText = stripMarkdownAndHtml(markdown);
  if (!plainText) return '';

  const sentences = plainText.split(/(?<=[.!?])\s+/);
  const normalizedLabel = label.toLowerCase();

  const exactSentence = sentences.find((sentence) => sentence.toLowerCase().includes(normalizedLabel));
  if (exactSentence) return exactSentence.trim();

  return sentences[0]?.trim() ?? '';
}

function resolveDescriptionFromExistingEntry(entry: GlossaryEntryRecord, label: string): string {
  return extractBestDescriptionFromMarkdown(entry.markdown, label) || entry.excerpt || '';
}

function resolveRuleGlossaryEntry(rule: ReferencedRuleLink, glossaryEntries: GlossaryEntryRecord[]): RuleGlossaryResolution {
  const normalizedLabel = normalizeRuleLabel(rule.label);
  const aliasResolution = KNOWN_RULE_ALIASES[normalizedLabel];
  const inferredTermId = aliasResolution?.glossaryTermId || labelToTermId(rule.label);
  const displayLabel = aliasResolution?.displayLabel || rule.label.trim();
  const overrideDescription = CANONICAL_RULE_TEXT_OVERRIDES[rule.href] || '';

  if (aliasResolution?.suppressed) {
    return {
      glossaryTermId: inferredTermId,
      glossaryFilePath: '',
      glossarySource: 'generated',
      description: '',
      displayLabel,
      descriptionPriority: 0,
      suppressed: true,
      suppressionReason: 'Captured canonical tooltip is too low-value or too incidental to promote into the glossary rule surface as a standalone entry.',
    };
  }

  if (overrideDescription) {
    return {
      glossaryTermId: inferredTermId,
      glossaryFilePath: `/data/glossary/entries/rules/spells/referenced/${inferredTermId}.json`,
      glossarySource: 'generated',
      description: overrideDescription,
      displayLabel,
      descriptionPriority: 3,
      suppressed: false,
      suppressionReason: '',
    };
  }

  // Prefer a real glossary entry when one already exists. That preserves hand-authored
  // rules content and prevents the enrichment lane from inventing parallel destinations.
  const exactIdMatch = glossaryEntries.find((entry) => entry.id === inferredTermId);
  if (exactIdMatch) {
    return {
      glossaryTermId: exactIdMatch.id,
      glossaryFilePath: exactIdMatch.filePath,
      glossarySource: 'existing',
      description: resolveDescriptionFromExistingEntry(exactIdMatch, displayLabel),
      displayLabel: exactIdMatch.title || displayLabel,
      descriptionPriority: 2,
      suppressed: false,
      suppressionReason: '',
    };
  }

  const exactTitleMatch = glossaryEntries.find((entry) => normalizeRuleLabel(entry.title) === normalizedLabel);
  if (exactTitleMatch) {
    return {
      glossaryTermId: exactTitleMatch.id,
      glossaryFilePath: exactTitleMatch.filePath,
      glossarySource: 'existing',
      description: resolveDescriptionFromExistingEntry(exactTitleMatch, displayLabel),
      displayLabel: exactTitleMatch.title || displayLabel,
      descriptionPriority: 2,
      suppressed: false,
      suppressionReason: '',
    };
  }

  const aliasMatch = glossaryEntries.find((entry) => entry.aliases.some((alias) => normalizeRuleLabel(alias) === normalizedLabel));
  if (aliasMatch) {
    return {
      glossaryTermId: aliasMatch.id,
      glossaryFilePath: aliasMatch.filePath,
      glossarySource: 'existing',
      description: resolveDescriptionFromExistingEntry(aliasMatch, displayLabel),
      displayLabel: aliasMatch.title || displayLabel,
      descriptionPriority: 2,
      suppressed: false,
      suppressionReason: '',
    };
  }

  // If the glossary doesn't already have a first-class rule entry, synthesize one.
  // This keeps the spell-card navigation honest: every visible rule chip points to
  // a real glossary destination instead of a guessed dead-end slug.
  return {
    glossaryTermId: inferredTermId,
    glossaryFilePath: `/data/glossary/entries/rules/spells/referenced/${inferredTermId}.json`,
    glossarySource: 'generated',
    description: '',
    displayLabel,
    descriptionPriority: 0,
    suppressed: false,
    suppressionReason: '',
  };
}

// ============================================================================
// Aggregation
// ============================================================================
// This section groups the rule links by resolved glossary term id so the
// enrichment file can answer both directions: which rules are being referenced,
// and which spells are citing each rule. Grouping after resolution is important
// because the raw canonical labels are not stable enough on their own.
// ============================================================================

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function aggregateByRule(spellReferences: SpellRuleReference[], glossaryEntries: GlossaryEntryRecord[]): {
  aggregatedRules: AggregatedRuleEntry[];
  suppressedRules: SuppressedRuleReference[];
} {
  const byRule = new Map<string, AggregatedRuleEntry & { descriptionPriority: number }>();
  const suppressedByLabel = new Map<string, SuppressedRuleReference>();

  for (const spell of spellReferences) {
    for (const rule of spell.referencedRules) {
      const glossaryResolution = resolveRuleGlossaryEntry(rule, glossaryEntries);
      if (glossaryResolution.suppressed) {
        const suppressedKey = normalizeRuleLabel(rule.label);
        const existingSuppressed = suppressedByLabel.get(suppressedKey);

        if (existingSuppressed) {
          existingSuppressed.spells.push({
            spellId: spell.spellId,
            spellName: spell.spellName,
            level: spell.level,
            markdownPath: spell.markdownPath,
          });
        } else {
          suppressedByLabel.set(suppressedKey, {
            label: rule.label.trim(),
            normalizedLabel: suppressedKey,
            reason: glossaryResolution.suppressionReason,
            spells: [
              {
                spellId: spell.spellId,
                spellName: spell.spellName,
                level: spell.level,
                markdownPath: spell.markdownPath,
              },
            ],
          });
        }
        continue;
      }

      const key = glossaryResolution.glossaryTermId;
      const existing = byRule.get(key);

      if (existing) {
        if (glossaryResolution.descriptionPriority > existing.descriptionPriority && glossaryResolution.description) {
          existing.description = glossaryResolution.description;
          existing.label = glossaryResolution.displayLabel;
          existing.descriptionPriority = glossaryResolution.descriptionPriority;
        }
        existing.spells.push({
          spellId: spell.spellId,
          spellName: spell.spellName,
          level: spell.level,
          markdownPath: spell.markdownPath,
        });
        continue;
      }

      byRule.set(key, {
        id: slugify(glossaryResolution.displayLabel),
        label: glossaryResolution.displayLabel,
        description: glossaryResolution.description,
        glossaryTermId: glossaryResolution.glossaryTermId,
        glossaryFilePath: glossaryResolution.glossaryFilePath,
        glossarySource: glossaryResolution.glossarySource,
        descriptionPriority: glossaryResolution.descriptionPriority,
        spells: [
          {
            spellId: spell.spellId,
            spellName: spell.spellName,
            level: spell.level,
            markdownPath: spell.markdownPath,
          },
        ],
      });
    }
  }

  return {
    aggregatedRules: [...byRule.values()]
      .map((entry) => ({
        ...entry,
        spells: entry.spells.sort((a, b) => a.spellName.localeCompare(b.spellName)),
      }))
      .map(({ descriptionPriority: _descriptionPriority, ...entry }) => entry)
      .sort((a, b) => a.label.localeCompare(b.label)),
    suppressedRules: [...suppressedByLabel.values()]
      .map((entry) => ({
        ...entry,
        spells: entry.spells.sort((a, b) => a.spellName.localeCompare(b.spellName)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
}

// ============================================================================
// Generated rule-entry writer
// ============================================================================
// This section creates real glossary entry files for referenced rules that do
// not already exist elsewhere in the glossary corpus. That gives the spell-card
// UI a proper navigation destination for every visible rule chip.
// ============================================================================

function renderGeneratedRuleMarkdown(rule: AggregatedRuleEntry): string {
  const lines: string[] = [
    `# ${rule.label}`,
    '',
    rule.description || 'Canonical rule text has not been captured yet for this referenced rule.',
    '',
    '---',
    '## Referenced By Spells',
    '',
  ];

  for (const spell of rule.spells) {
    lines.push(`- [[${spell.spellId}|${spell.spellName}]]`);
  }

  lines.push('');
  lines.push('---');
  lines.push('## Notes');
  lines.push('');
  lines.push('This glossary entry was generated from canonical spell snapshot references.');
  lines.push('It exists so spell details can cross-link into the glossary rules surface.');
  lines.push('');

  return lines.join('\n');
}

function writeGeneratedRuleEntries(aggregatedRules: AggregatedRuleEntry[], glossaryEntries: GlossaryEntryRecord[]): void {
  const existingIds = new Set(glossaryEntries.map((entry) => entry.id));
  fs.mkdirSync(GENERATED_RULES_OUT_DIR, { recursive: true });

  // Clear stale generated entries first so the generated folder mirrors the current
  // referenced-rule corpus instead of accumulating orphaned files forever.
  for (const entry of fs.readdirSync(GENERATED_RULES_OUT_DIR, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.json')) {
      fs.rmSync(path.join(GENERATED_RULES_OUT_DIR, entry.name));
    }
  }

  for (const rule of aggregatedRules) {
    if (rule.glossarySource !== 'generated') continue;
    if (existingIds.has(rule.glossaryTermId)) continue;

    const filePath = path.join(GENERATED_RULES_OUT_DIR, `${rule.glossaryTermId}.json`);
    const generatedEntry = {
      id: rule.glossaryTermId,
      title: rule.label,
      category: 'Spellcasting Mechanics',
      tags: [
        'rules',
        'spellcasting',
        'referenced rule',
        'generated',
      ],
      excerpt: rule.description || `Generated rule entry for ${rule.label}.`,
      aliases: [],
      seeAlso: ['spell_referenced_rules_enrichment'],
      filePath: `/data/glossary/entries/rules/spells/referenced/${rule.glossaryTermId}.json`,
      markdown: renderGeneratedRuleMarkdown(rule),
    };

    fs.writeFileSync(filePath, `${JSON.stringify(generatedEntry, null, 2)}\n`, 'utf8');
  }
}

// ============================================================================
// Markdown summary
// ============================================================================
// This section writes a human-readable summary into the glossary entry so the
// dataset is still inspectable without opening the raw JSON payload below it.
// ============================================================================

function renderMarkdownSummary(aggregatedRules: AggregatedRuleEntry[], suppressedRules: SuppressedRuleReference[]): string {
  const lines: string[] = [
    '# Spell Referenced Rules Enrichment',
    '',
    'This glossary enrichment entry aggregates the `Referenced Rules` links copied from spell canonical snapshot blocks.',
    'It is not runtime spell truth. It is a cross-link surface that shows which glossary/rules concepts are being cited by the canonical spell pages captured so far.',
    '',
    `Total referenced rules captured: ${aggregatedRules.length}`,
    `Suppressed raw references: ${suppressedRules.length}`,
    '',
  ];

  for (const rule of aggregatedRules) {
    lines.push(`## ${rule.label}`);
    lines.push('');
    if (rule.description) {
      lines.push(`- Description: ${rule.description}`);
    } else {
      lines.push('- Description: No glossary description matched yet.');
    }
    lines.push(`- Referenced By ${rule.spells.length} Spell(s): ${rule.spells.map((spell) => spell.spellName).join(', ')}`);
    lines.push('');
  }

  if (suppressedRules.length > 0) {
    lines.push('## Suppressed Raw References');
    lines.push('');
    lines.push('These labels were captured from canonical spell pages but are currently treated as too incidental or too low-value to expose as standalone glossary rule entries.');
    lines.push('');

    for (const rule of suppressedRules) {
      lines.push(`### ${rule.label}`);
      lines.push('');
      lines.push(`- Reason: ${rule.reason}`);
      lines.push(`- Captured From ${rule.spells.length} Spell(s): ${rule.spells.map((spell) => spell.spellName).join(', ')}`);
      lines.push('');
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

// ============================================================================
// Output
// ============================================================================
// This section writes a normal glossary entry JSON file with one extra machine-
// readable payload: `enrichmentDataset`. That keeps the output compatible with
// the rest of the glossary system while still exposing the spell-to-rule map.
// ============================================================================

function buildOutput() {
  const spellReferences = collectSpellRuleReferences();
  const glossaryEntries = listGlossaryEntries();
  const baseGlossaryEntries = glossaryEntries.filter(
    (entry) => !entry.isGeneratedReferencedRule && !entry.isReferencedRulesHub,
  );
  const { aggregatedRules, suppressedRules } = aggregateByRule(spellReferences, baseGlossaryEntries);
  writeGeneratedRuleEntries(aggregatedRules, baseGlossaryEntries);

  const rulesByGlossaryTermId = Object.fromEntries(
    aggregatedRules.map((rule) => [rule.glossaryTermId, rule]),
  );

  return {
    id: 'spell_referenced_rules_enrichment',
    title: 'Spell Referenced Rules Enrichment',
    category: 'Spellcasting Mechanics',
    tags: [
      'rules',
      'spellcasting',
      'glossary enrichment',
      'referenced rules',
      'spell links',
    ],
    excerpt: 'Aggregates the glossary and rules links referenced by captured canonical spell pages, grouped by rule and by spell.',
    aliases: [
      'spell rule references',
      'spell glossary enrichment',
    ],
    seeAlso: [
      'spell_effects_rules',
      'spell_components_rules',
      'spell_duration_rules',
      'spell_range_rules',
    ],
    filePath: '/data/glossary/entries/rules/spells/spell_referenced_rules_enrichment.json',
    markdown: renderMarkdownSummary(aggregatedRules, suppressedRules),
    enrichmentDataset: {
      generatedAt: new Date().toISOString(),
      totalRules: aggregatedRules.length,
      totalSpellsWithReferencedRules: spellReferences.length,
      totalSuppressedRawReferences: suppressedRules.length,
      rules: aggregatedRules,
      suppressedRules,
      rulesByGlossaryTermId,
      spells: spellReferences.map((spell) => ({
        spellId: spell.spellId,
        spellName: spell.spellName,
        level: spell.level,
        markdownPath: spell.markdownPath,
        rawReferencedRules: spell.referencedRules.map((rule) => ({
          label: rule.label,
          href: rule.href,
        })),
        referencedRules: spell.referencedRules
          .map((rule) => {
            const resolvedRule = resolveRuleGlossaryEntry(rule, baseGlossaryEntries);
            return resolvedRule.suppressed ? null : {
              label: resolvedRule.displayLabel,
              description: resolvedRule.description,
              glossaryTermId: resolvedRule.glossaryTermId,
            };
          })
          .filter((rule): rule is { label: string; description: string; glossaryTermId: string } => Boolean(rule)),
      })),
    },
  };
}

function main(): void {
  const output = buildOutput();
  fs.mkdirSync(path.dirname(ENRICHMENT_OUT), { recursive: true });
  fs.writeFileSync(ENRICHMENT_OUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Wrote spell referenced-rules enrichment file to ${ENRICHMENT_OUT}`);
  console.log(`Referenced rules captured: ${output.enrichmentDataset.totalRules}`);
  console.log(`Spells with referenced rules: ${output.enrichmentDataset.totalSpellsWithReferencedRules}`);
  console.log(`Suppressed raw references: ${output.enrichmentDataset.totalSuppressedRawReferences}`);
}

main();
