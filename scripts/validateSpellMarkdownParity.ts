import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * This file audits spell reference markdown files against the verified spell JSON files.
 *
 * It exists to collect cross-layer drift without silently fixing or arbitrating it.
 * The script reads the structured spell reference markdown files, compares their
 * labeled facts against the live spell JSON data, and groups the mismatches into
 * recurring buckets that can be brought back to the project owner for arbitration.
 *
 * Called by: `npm run validate:spell-markdown`
 * Depends on: `docs/spells/reference/**`, `public/data/spells/**`
 */

// ============================================================================
// Paths and shared types
// ============================================================================
// This section centralizes where the script reads from and where it writes its
// collected reports. The JSON artifact is local tooling output, while the
// Markdown report is a human review surface that summarizes grouped mismatch
// families instead of flooding the project with per-spell noise.
// ============================================================================

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const SPELL_JSON_ROOT = path.resolve(REPO_ROOT, 'public', 'data', 'spells');
const SPELL_MARKDOWN_ROOT = path.resolve(REPO_ROOT, 'docs', 'spells', 'reference');
const DEFAULT_JSON_OUT = path.resolve(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'spell-markdown-parity-report.json');
const DEFAULT_MD_OUT = path.resolve(REPO_ROOT, 'docs', 'tasks', 'spells', 'SPELL_MARKDOWN_PARITY_REPORT.md');
const CANONICAL_ONLY_MARKER = '<!-- CANONICAL-ONLY-REFERENCE -->';

type MismatchFamily = 'markdown-vs-json';
type MismatchKind =
    | 'value-mismatch'
    | 'missing-markdown-field'
    | 'markdown-only-field'
    | 'presence-mismatch'
    | 'legacy-effect-collapse';

interface SpellMarkdownRecord {
    spellId: string;
    spellName: string;
    level: number;
    markdownPath: string;
    jsonPath: string;
    labels: Map<string, string>;
}

interface SpellParityMismatch {
    id: string;
    family: MismatchFamily;
    groupKey: string;
    mismatchKind: MismatchKind;
    spellId: string;
    spellName: string;
    level: number;
    markdownPath: string;
    jsonPath: string;
    fieldOrMechanic: string;
    markdownValue: string;
    jsonValue: string;
    summary: string;
}

interface GroupedMismatchSummary {
    groupKey: string;
    family: MismatchFamily;
    fieldOrMechanic: string;
    mismatchKind: MismatchKind;
    count: number;
    spellIds: string[];
    sampleSpellIds: string[];
    sampleSummaries: string[];
}

interface SpellParityReport {
    generatedAt: string;
    markdownFileCount: number;
    mismatchCount: number;
    mismatches: SpellParityMismatch[];
    groupedMismatches: GroupedMismatchSummary[];
}

// ============================================================================
// File discovery and markdown parsing
// ============================================================================
// This section maps each markdown reference file to its matching JSON file by
// level folder and basename. The markdown parser is intentionally strict about
// the `- **Label**: value` format because this validation lane should push the
// docs toward a predictable structured shape instead of guessing through prose.
// ============================================================================

function listMarkdownSpellFiles(): Array<{ level: number; markdownPath: string; jsonPath: string }> {
    const files: Array<{ level: number; markdownPath: string; jsonPath: string }> = [];

    for (let level = 0; level <= 9; level += 1) {
        const markdownLevelDir = path.join(SPELL_MARKDOWN_ROOT, `level-${level}`);
        const jsonLevelDir = path.join(SPELL_JSON_ROOT, `level-${level}`);
        if (!fs.existsSync(markdownLevelDir) || !fs.existsSync(jsonLevelDir)) continue;

        const markdownFiles = fs.readdirSync(markdownLevelDir)
            .filter((file) => file.endsWith('.md'))
            .sort((a, b) => a.localeCompare(b));

        for (const markdownFile of markdownFiles) {
            const basename = path.basename(markdownFile, '.md');
            files.push({
                level,
                markdownPath: path.join(markdownLevelDir, markdownFile),
                jsonPath: path.join(jsonLevelDir, `${basename}.json`),
            });
        }
    }

    return files;
}

function parseSpellMarkdown(markdownPath: string, jsonPath: string, level: number): SpellMarkdownRecord {
    const content = fs.readFileSync(markdownPath, 'utf8');
    const lines = content.split(/\r?\n/);

    const heading = lines.find((line) => line.startsWith('# ')) ?? `# ${path.basename(markdownPath, '.md')}`;
    const spellName = heading.replace(/^#\s+/, '').trim();
    const spellId = path.basename(markdownPath, '.md');
    const labels = new Map<string, string>();

    // Capture the current structured label format. If a line does not match this
    // shape, it is treated as prose and ignored by the structured parity layer.
    for (const line of lines) {
        const match = line.match(/^- \*\*(.+?)\*\*:\s*(.*)$/);
        if (!match) continue;
        labels.set(match[1].trim(), (match[2] ?? '').trim());
    }

    return {
        spellId,
        spellName,
        level,
        markdownPath,
        jsonPath,
        labels,
    };
}

function readSpellJson(jsonPath: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as Record<string, unknown>;
}

function isCanonicalOnlyMarkdown(markdownPath: string): boolean {
    const content = fs.readFileSync(markdownPath, 'utf8');
    return content.includes(CANONICAL_ONLY_MARKER);
}

// ============================================================================
// Value normalization
// ============================================================================
// This section converts JSON values into the same string conventions used by the
// markdown reference files. The point is not to reinterpret spell meaning. The
// point is to compare like with like for the structured fact layer.
// ============================================================================

function normalizeBoolean(value: unknown): string {
    return value ? 'true' : 'false';
}

function normalizeNumber(value: unknown): string {
    return typeof value === 'number' ? String(value) : '';
}

function normalizeList(value: unknown): string {
    return Array.isArray(value) ? value.map((entry) => String(entry)).join(', ') : '';
}

function normalizeOptionalList(value: unknown): string {
    if (!Array.isArray(value) || value.length === 0) return 'None';
    return value.map((entry) => String(entry)).join(', ');
}

function normalizeOptionalText(value: unknown): string {
    if (typeof value !== 'string') return 'None';
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : 'None';
}

function normalizePresence(value: unknown): 'present' | 'missing' {
    if (typeof value !== 'string') return 'missing';
    return value.trim().length > 0 ? 'present' : 'missing';
}

function getPrimaryEffect(spell: Record<string, unknown>): Record<string, unknown> | null {
    const effects = spell.effects;
    if (!Array.isArray(effects) || effects.length === 0) return null;
    const first = effects[0];
    return typeof first === 'object' && first !== null ? first as Record<string, unknown> : null;
}

function getEffects(spell: Record<string, unknown>): Record<string, unknown>[] {
    if (!Array.isArray(spell.effects)) return [];
    return spell.effects.filter((effect): effect is Record<string, unknown> => typeof effect === 'object' && effect !== null);
}

function buildStructuredFieldMap(spell: Record<string, unknown>): Map<string, string> {
    const fields = new Map<string, string>();
    const primaryEffect = getPrimaryEffect(spell);
    const castingTime = (spell.castingTime ?? {}) as Record<string, unknown>;
    const range = (spell.range ?? {}) as Record<string, unknown>;
    const targeting = (spell.targeting ?? {}) as Record<string, unknown>;
    const components = (spell.components ?? {}) as Record<string, unknown>;
    const duration = (spell.duration ?? {}) as Record<string, unknown>;
    const combatCost = (castingTime.combatCost ?? {}) as Record<string, unknown>;
    const filter = (targeting.filter ?? {}) as Record<string, unknown>;

    // These are the common top-level spell facts already represented as labeled
    // rows in the markdown reference files.
    fields.set('Level', normalizeNumber(spell.level));
    fields.set('School', typeof spell.school === 'string' ? spell.school : '');
    fields.set('Ritual', normalizeBoolean(spell.ritual));
    fields.set('Classes', normalizeList(spell.classes));
    fields.set('Sub-Classes', normalizeOptionalList(spell.subClasses));
    fields.set('Casting Time Value', normalizeNumber(castingTime.value));
    fields.set('Casting Time Unit', typeof castingTime.unit === 'string' ? castingTime.unit : '');
    fields.set('Combat Cost', typeof combatCost.type === 'string' ? combatCost.type : '');
    fields.set('Reaction Trigger', typeof castingTime.reactionCondition === 'string' && castingTime.reactionCondition.trim()
        ? castingTime.reactionCondition
        : typeof combatCost.condition === 'string'
            ? combatCost.condition.trim()
            : '');
    fields.set('Range Type', typeof range.type === 'string' ? range.type : '');
    // Range distance is only a meaningful parity field when the spell actually
    // reaches out beyond self/touch defaults. Many JSON files carry a literal 0
    // here as structural filler, and treating that as required parity creates noise.
    if (typeof range.distance === 'number' && range.distance > 0) {
        fields.set('Range Distance', String(range.distance));
    }
    fields.set('Targeting Type', typeof targeting.type === 'string' ? targeting.type : '');
    // A max target count of 1 is the default shape for many single-target spells.
    // We only treat this as a parity field when it adds information beyond the
    // default single-target case, such as multi-target spells.
    if (typeof targeting.maxTargets === 'number' && targeting.maxTargets > 1) {
        fields.set('Targeting Max', String(targeting.maxTargets));
    }
    fields.set('Valid Targets', normalizeList(targeting.validTargets));
    fields.set('Line of Sight', normalizeBoolean(targeting.lineOfSight));
    if (Array.isArray(filter.creatureTypes) && filter.creatureTypes.length > 0) {
        fields.set('Target Filter Creature Types', normalizeList(filter.creatureTypes));
    }
    fields.set('Verbal', normalizeBoolean(components.verbal));
    fields.set('Somatic', normalizeBoolean(components.somatic));
    fields.set('Material', normalizeBoolean(components.material));
    if (components.material && typeof components.materialDescription === 'string' && components.materialDescription.trim()) {
        fields.set('Material Description', components.materialDescription);
    }
    if (typeof components.materialCost === 'number' && components.materialCost > 0) {
        fields.set('Material Cost GP', String(components.materialCost));
    }
    if (components.isConsumed === true) {
        fields.set('Consumed', 'true');
    }
    fields.set('Duration Type', typeof duration.type === 'string' ? duration.type : '');
    if (typeof duration.value === 'number' && duration.value > 0) {
        fields.set('Duration Value', String(duration.value));
    }
    if (typeof duration.unit === 'string' && typeof duration.value === 'number' && duration.value > 0) {
        fields.set('Duration Unit', duration.unit);
    }
    fields.set('Concentration', normalizeBoolean(duration.concentration));
    fields.set('Description', normalizePresence(spell.description));
    fields.set('Higher Levels', normalizePresence(spell.higherLevels));

    if (primaryEffect) {
        const condition = (primaryEffect.condition ?? {}) as Record<string, unknown>;
        const damage = (primaryEffect.damage ?? {}) as Record<string, unknown>;
        const healing = (primaryEffect.healing ?? {}) as Record<string, unknown>;
        const light = (primaryEffect.light ?? {}) as Record<string, unknown>;

        // These fields intentionally follow the current legacy markdown shape for
        // single-effect spells so the first collector can detect drift before we
        // migrate the docs to a separate-effect-object format.
        fields.set('Effect Type', typeof primaryEffect.type === 'string' ? primaryEffect.type : '');
        fields.set('Utility Type', typeof primaryEffect.utilityType === 'string' ? primaryEffect.utilityType : '');
        if (condition.type === 'save') {
            fields.set('Save Stat', typeof condition.saveType === 'string' ? condition.saveType : 'None');
            fields.set('Save Outcome', typeof condition.saveEffect === 'string' ? condition.saveEffect : 'none');
        }
        if (primaryEffect.type === 'DAMAGE') {
            fields.set('Damage Dice', typeof damage.dice === 'string' ? damage.dice : '');
            fields.set('Damage Type', typeof damage.type === 'string' ? damage.type : '');
        }
        if (primaryEffect.type === 'HEALING') {
            fields.set('Healing Dice', typeof healing.dice === 'string' ? healing.dice : '');
            if (typeof healing.isTemporaryHp === 'boolean') {
                fields.set('Temporary HP', normalizeBoolean(healing.isTemporaryHp));
            }
        }
        fields.set('Terrain Type', typeof primaryEffect.terrainType === 'string' ? primaryEffect.terrainType : '');
        fields.set('Defense Type', typeof primaryEffect.defenseType === 'string' ? primaryEffect.defenseType : '');
        if (primaryEffect.type === 'UTILITY' && primaryEffect.utilityType === 'light') {
            if (typeof light.brightRadius === 'number' && light.brightRadius > 0) {
                fields.set('Light Bright Radius', String(light.brightRadius));
            }
            if (typeof light.dimRadius === 'number' && light.dimRadius > 0) {
                fields.set('Light Dim Radius', String(light.dimRadius));
            }
        }
    }

    return fields;
}

// ============================================================================
// Mismatch collection
// ============================================================================
// This section compares the structured markdown labels to the derived JSON facts.
// It does not auto-correct the markdown. It records grouped mismatch buckets so
// the project owner can arbitrate recurring patterns first.
// ============================================================================

function isMeaningfulMarkdownValue(value: string | undefined): boolean {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    return trimmed.toLowerCase() !== 'none';
}

function isMeaningfulJsonValue(value: string | undefined): boolean {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    return trimmed.toLowerCase() !== 'none';
}

function pushMismatch(
    mismatches: SpellParityMismatch[],
    spell: SpellMarkdownRecord,
    mismatchKind: MismatchKind,
    fieldOrMechanic: string,
    markdownValue: string,
    jsonValue: string,
    summary: string,
): void {
    mismatches.push({
        id: `${spell.spellId}::${fieldOrMechanic}::${mismatchKind}`,
        family: 'markdown-vs-json',
        groupKey: `markdown-vs-json / ${fieldOrMechanic}`,
        mismatchKind,
        spellId: spell.spellId,
        spellName: spell.spellName,
        level: spell.level,
        markdownPath: spell.markdownPath,
        jsonPath: spell.jsonPath,
        fieldOrMechanic,
        markdownValue,
        jsonValue,
        summary,
    });
}

function collectSpellMismatches(spell: SpellMarkdownRecord, spellJson: Record<string, unknown>): SpellParityMismatch[] {
    const mismatches: SpellParityMismatch[] = [];
    const structuredJsonFields = buildStructuredFieldMap(spellJson);
    const effects = getEffects(spellJson);

    // If the JSON has multiple effects but the markdown still exposes only the old
    // single-effect label set, capture that as one grouped structural mismatch
    // instead of exploding it into dozens of downstream field-level mismatches.
    if (effects.length > 1 && spell.labels.has('Effect Type')) {
        pushMismatch(
            mismatches,
            spell,
            'legacy-effect-collapse',
            'effects structure',
            'single-effect summary labels',
            `${effects.length} separate JSON effect objects`,
            `${spell.spellName} still uses legacy single-effect markdown labels while the JSON contains ${effects.length} separate effect objects.`,
        );
        return mismatches;
    }

    // Compare the current structured markdown labels to their derived JSON values.
    for (const [fieldName, jsonValue] of structuredJsonFields.entries()) {
        const markdownValue = spell.labels.get(fieldName);

        if (fieldName === 'Description' || fieldName === 'Higher Levels') {
            const markdownPresence = isMeaningfulMarkdownValue(markdownValue) ? 'present' : 'missing';
            if (markdownPresence !== jsonValue) {
                pushMismatch(
                    mismatches,
                    spell,
                    'presence-mismatch',
                    fieldName,
                    markdownPresence,
                    jsonValue,
                    `${spell.spellName} has ${fieldName} marked ${markdownPresence} in markdown but ${jsonValue} in JSON.`,
                );
            }
            continue;
        }

        if (isMeaningfulJsonValue(jsonValue) && !spell.labels.has(fieldName)) {
            pushMismatch(
                mismatches,
                spell,
                'missing-markdown-field',
                fieldName,
                '',
                jsonValue,
                `${spell.spellName} is missing the structured markdown field ${fieldName} even though the JSON provides ${jsonValue}.`,
            );
            continue;
        }

        if (!spell.labels.has(fieldName)) {
            continue;
        }

        const safeMarkdownValue = markdownValue ?? '';
        if (safeMarkdownValue !== jsonValue) {
            pushMismatch(
                mismatches,
                spell,
                'value-mismatch',
                fieldName,
                safeMarkdownValue,
                jsonValue,
                `${spell.spellName} records ${fieldName} as "${safeMarkdownValue}" in markdown but "${jsonValue}" in JSON.`,
            );
        }
    }

    // Capture structured markdown labels that do not currently map to the JSON
    // parity layer at all. This is important because fields like Source and Status
    // look authoritative to a human reader even though they are not backed by the
    // live spell JSON structure.
    const allowedMarkdownOnlyFields = new Set(['Source', 'Status']);
    for (const [fieldName, markdownValue] of spell.labels.entries()) {
        if (structuredJsonFields.has(fieldName)) continue;
        if (!allowedMarkdownOnlyFields.has(fieldName)) continue;

        pushMismatch(
            mismatches,
            spell,
            'markdown-only-field',
            fieldName,
            markdownValue,
            '',
            `${spell.spellName} still exposes the structured markdown field ${fieldName}, but that field is not backed by the live spell JSON parity layer.`,
        );
    }

    return mismatches;
}

function groupMismatches(mismatches: SpellParityMismatch[]): GroupedMismatchSummary[] {
    const groups = new Map<string, GroupedMismatchSummary>();

    for (const mismatch of mismatches) {
        const existing = groups.get(mismatch.groupKey);
        if (existing) {
            existing.count += 1;
            if (!existing.spellIds.includes(mismatch.spellId)) existing.spellIds.push(mismatch.spellId);
            if (existing.sampleSpellIds.length < 10 && !existing.sampleSpellIds.includes(mismatch.spellId)) {
                existing.sampleSpellIds.push(mismatch.spellId);
            }
            if (existing.sampleSummaries.length < 5) existing.sampleSummaries.push(mismatch.summary);
            continue;
        }

        groups.set(mismatch.groupKey, {
            groupKey: mismatch.groupKey,
            family: mismatch.family,
            fieldOrMechanic: mismatch.fieldOrMechanic,
            mismatchKind: mismatch.mismatchKind,
            count: 1,
            spellIds: [mismatch.spellId],
            sampleSpellIds: [mismatch.spellId],
            sampleSummaries: [mismatch.summary],
        });
    }

    return Array.from(groups.values())
        .map((group) => ({
            ...group,
            spellIds: group.spellIds.sort(),
            sampleSpellIds: group.sampleSpellIds.sort(),
        }))
        .sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return a.groupKey.localeCompare(b.groupKey);
        });
}

// ============================================================================
// Report writing
// ============================================================================
// This section writes both a machine-readable JSON artifact and a condensed human
// report. The Markdown report stays grouped on purpose so the owner can arbitrate
// repeated mismatch families first instead of drowning in spell-by-spell detail.
// ============================================================================

function writeFileSafely(filePath: string, content: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

function buildMarkdownReport(report: SpellParityReport): string {
    const lines: string[] = [];
    lines.push('# Spell Markdown Parity Report');
    lines.push('');
    lines.push(`Generated: ${report.generatedAt}`);
    lines.push(`Markdown files scanned: ${report.markdownFileCount}`);
    lines.push(`Total mismatches: ${report.mismatchCount}`);
    lines.push(`Grouped mismatch buckets: ${report.groupedMismatches.length}`);
    lines.push('');
    lines.push('This report is grouped so arbitration can start with repeated mismatch families instead of isolated spell noise.');
    lines.push('');
    lines.push('## Grouped Mismatches');
    lines.push('');

    if (report.groupedMismatches.length === 0) {
        lines.push('No grouped mismatches found.');
        lines.push('');
        return lines.join('\n');
    }

    for (const group of report.groupedMismatches) {
        lines.push(`### ${group.groupKey}`);
        lines.push('');
        lines.push(`- Family: \`${group.family}\``);
        lines.push(`- Kind: \`${group.mismatchKind}\``);
        lines.push(`- Occurrences: ${group.count}`);
        lines.push(`- Distinct spells: ${group.spellIds.length}`);
        lines.push(`- Sample spells: ${group.sampleSpellIds.join(', ')}`);
        lines.push('- Sample findings:');
        for (const summary of group.sampleSummaries) {
            lines.push(`  - ${summary}`);
        }
        lines.push('');
    }

    return lines.join('\n');
}

// ============================================================================
// Main entrypoint
// ============================================================================
// This section runs the audit across the spell reference set and writes the
// collected mismatch reports to disk.
// ============================================================================

function buildParityReport(): SpellParityReport {
    const files = listMarkdownSpellFiles();
    const mismatches: SpellParityMismatch[] = [];

    for (const file of files) {
        // Canonical-only placeholder files belong to the retrieval lane, not the
        // structured parity lane. Skip them here so the project can preserve raw
        // source captures before the Aralia field block has been authored.
        if (isCanonicalOnlyMarkdown(file.markdownPath)) {
            continue;
        }

        if (!fs.existsSync(file.jsonPath)) {
            const spellName = path.basename(file.markdownPath, '.md');
            mismatches.push({
                id: `${spellName}::missing-json::missing-markdown-field`,
                family: 'markdown-vs-json',
                groupKey: 'markdown-vs-json / missing json file',
                mismatchKind: 'missing-markdown-field',
                spellId: spellName,
                spellName,
                level: file.level,
                markdownPath: file.markdownPath,
                jsonPath: file.jsonPath,
                fieldOrMechanic: 'missing json file',
                markdownValue: path.basename(file.markdownPath),
                jsonValue: '',
                summary: `${spellName} has a markdown reference file but no matching spell JSON file was found at the expected level path.`,
            });
            continue;
        }

        const markdownRecord = parseSpellMarkdown(file.markdownPath, file.jsonPath, file.level);
        const spellJson = readSpellJson(file.jsonPath);
        mismatches.push(...collectSpellMismatches(markdownRecord, spellJson));
    }

    return {
        generatedAt: new Date().toISOString(),
        markdownFileCount: files.length,
        mismatchCount: mismatches.length,
        mismatches,
        groupedMismatches: groupMismatches(mismatches),
    };
}

function main(): void {
    const report = buildParityReport();
    writeFileSafely(DEFAULT_JSON_OUT, JSON.stringify(report, null, 2));
    writeFileSafely(DEFAULT_MD_OUT, buildMarkdownReport(report));

    console.log(`Spell markdown parity report written to ${DEFAULT_MD_OUT}`);
    console.log(`Machine-readable parity artifact written to ${DEFAULT_JSON_OUT}`);
    console.log(`Markdown files scanned: ${report.markdownFileCount}`);
    console.log(`Total mismatches: ${report.mismatchCount}`);
    console.log(`Grouped mismatch buckets: ${report.groupedMismatches.length}`);

    for (const group of report.groupedMismatches.slice(0, 10)) {
        console.log(`- ${group.groupKey}: ${group.count} occurrence(s) across ${group.spellIds.length} spell(s)`);
    }
}

main();
