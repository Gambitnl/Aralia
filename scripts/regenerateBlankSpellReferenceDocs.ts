import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * This file regenerates blank spell reference markdown files from the verified
 * spell JSON files that already live in the repo.
 *
 * It exists because a small subset of the spell reference lane had zero-byte
 * markdown files, which made parity validation noisy in a way that hid the real
 * grouped mismatch buckets. The script only rebuilds blank or near-blank spell
 * reference files, and it mirrors the current JSON-backed field vocabulary
 * instead of inventing a second documentation schema.
 *
 * Called by: manual spell-validation maintenance runs
 * Depends on: docs/spells/reference/** and public/data/spells/**
 */

// ============================================================================
// Paths and shared field order
// ============================================================================
// This section centralizes where the script reads and writes. The ordered label
// groups keep the regenerated markdown close to the spell reference shape that
// already exists elsewhere in the repo, so the repair feels like a continuation
// of the current docs rather than a parallel format.
// ============================================================================

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const SPELL_JSON_ROOT = path.resolve(REPO_ROOT, 'public', 'data', 'spells');
const SPELL_MARKDOWN_ROOT = path.resolve(REPO_ROOT, 'docs', 'spells', 'reference');

const FIELD_GROUPS: string[][] = [
    ['Level', 'School', 'Ritual', 'Classes'],
    ['Casting Time Value', 'Casting Time Unit', 'Combat Cost', 'Reaction Trigger'],
    ['Range Type', 'Range Distance', 'Targeting Type', 'Targeting Max', 'Valid Targets', 'Target Filter Creature Types', 'Line of Sight'],
    ['Verbal', 'Somatic', 'Material', 'Material Description', 'Material Cost GP', 'Consumed'],
    ['Duration Type', 'Duration Value', 'Duration Unit', 'Concentration'],
    ['Effect Type', 'Utility Type', 'Save Stat', 'Save Outcome', 'Damage Dice', 'Damage Type', 'Healing Dice', 'Temporary HP', 'Terrain Type', 'Defense Type', 'Light Bright Radius', 'Light Dim Radius'],
];

// ============================================================================
// Shared normalization helpers
// ============================================================================
// This section keeps the markdown values aligned with the parity validator's
// expectations. The goal is not to reinterpret spell meaning here. The goal is
// to present the already-verified JSON data in the same human-readable shape
// the current spell reference docs already use.
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

function normalizeOptionalText(value: unknown): string {
    if (typeof value !== 'string') return 'None';
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : 'None';
}

function getPrimaryEffect(spell: Record<string, unknown>): Record<string, unknown> | null {
    const effects = spell.effects;
    if (!Array.isArray(effects) || effects.length === 0) return null;
    const first = effects[0];
    return typeof first === 'object' && first !== null ? first as Record<string, unknown> : null;
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

    // Mirror the current common spell fact rows that the reference docs already
    // expose. Blank docs do not need every imaginable optional field, only the
    // fields that currently carry real information for the JSON instance.
    fields.set('Level', normalizeNumber(spell.level));
    fields.set('School', typeof spell.school === 'string' ? spell.school : '');
    fields.set('Ritual', normalizeBoolean(spell.ritual));
    fields.set('Classes', normalizeList(spell.classes));

    fields.set('Casting Time Value', normalizeNumber(castingTime.value));
    fields.set('Casting Time Unit', typeof castingTime.unit === 'string' ? castingTime.unit : '');
    fields.set('Combat Cost', typeof combatCost.type === 'string' ? combatCost.type : '');

    const reactionTrigger = typeof castingTime.reactionCondition === 'string' && castingTime.reactionCondition.trim()
        ? castingTime.reactionCondition.trim()
        : typeof combatCost.condition === 'string'
            ? combatCost.condition.trim()
            : '';
    if (reactionTrigger) {
        fields.set('Reaction Trigger', reactionTrigger);
    }

    fields.set('Range Type', typeof range.type === 'string' ? range.type : '');
    if (typeof range.distance === 'number' && range.distance > 0) {
        fields.set('Range Distance', String(range.distance));
    }

    fields.set('Targeting Type', typeof targeting.type === 'string' ? targeting.type : '');
    if (typeof targeting.maxTargets === 'number' && targeting.maxTargets > 1) {
        fields.set('Targeting Max', String(targeting.maxTargets));
    }
    fields.set('Valid Targets', normalizeList(targeting.validTargets));
    if (Array.isArray(filter.creatureTypes) && filter.creatureTypes.length > 0) {
        fields.set('Target Filter Creature Types', normalizeList(filter.creatureTypes));
    }
    fields.set('Line of Sight', normalizeBoolean(targeting.lineOfSight));

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

    if (primaryEffect) {
        const condition = (primaryEffect.condition ?? {}) as Record<string, unknown>;
        const damage = (primaryEffect.damage ?? {}) as Record<string, unknown>;
        const healing = (primaryEffect.healing ?? {}) as Record<string, unknown>;
        const light = (primaryEffect.light ?? {}) as Record<string, unknown>;

        // DEBT: This still mirrors the current legacy single-effect markdown
        // shape. The owner already ruled that separate JSON effect objects should
        // eventually stay separate in markdown too, but every currently blank
        // doc in this repair set only has one JSON effect, so this repair stays
        // within the existing doc shape instead of widening scope.
        fields.set('Effect Type', typeof primaryEffect.type === 'string' ? primaryEffect.type : '');
        if (typeof primaryEffect.utilityType === 'string' && primaryEffect.utilityType.trim()) {
            fields.set('Utility Type', primaryEffect.utilityType);
        }
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
        if (typeof primaryEffect.terrainType === 'string' && primaryEffect.terrainType.trim()) {
            fields.set('Terrain Type', primaryEffect.terrainType);
        }
        if (typeof primaryEffect.defenseType === 'string' && primaryEffect.defenseType.trim()) {
            fields.set('Defense Type', primaryEffect.defenseType);
        }
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
// Markdown generation
// ============================================================================
// This section turns the verified JSON-backed fields into the reference markdown
// body. The output is intentionally simple because the immediate job here is to
// restore missing reference bodies, not to redesign the entire spell-doc format.
// ============================================================================

function toHeadingName(rawName: unknown, fallbackSpellId: string): string {
    if (typeof rawName === 'string' && rawName.trim()) return rawName.trim();
    return fallbackSpellId
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function renderSpellMarkdown(spellId: string, spell: Record<string, unknown>): string {
    const headingName = toHeadingName(spell.name, spellId);
    const structuredFields = buildStructuredFieldMap(spell);
    const lines: string[] = [`# ${headingName}`];

    for (const group of FIELD_GROUPS) {
        const groupLines: string[] = [];
        for (const fieldName of group) {
            if (!structuredFields.has(fieldName)) continue;
            groupLines.push(`- **${fieldName}**: ${structuredFields.get(fieldName) ?? ''}`);
        }
        if (groupLines.length === 0) continue;
        lines.push(...groupLines, '');
    }

    lines.push(`- **Description**: ${normalizeOptionalText(spell.description)}`);
    lines.push(`- **Higher Levels**: ${normalizeOptionalText(spell.higherLevels)}`);

    return `${lines.join('\n').trimEnd()}\n`;
}

// ============================================================================
// Blank-doc discovery and regeneration
// ============================================================================
// This section limits the repair to the narrow parent issue the user ruled on:
// spell reference docs that are blank or effectively empty. It does not rewrite
// the already-populated reference docs, which keeps the repair local and keeps
// later mismatch buckets honest.
// ============================================================================

function listBlankMarkdownFiles(): Array<{ level: number; markdownPath: string; jsonPath: string; spellId: string }> {
    const files: Array<{ level: number; markdownPath: string; jsonPath: string; spellId: string }> = [];

    for (let level = 0; level <= 9; level += 1) {
        const markdownLevelDir = path.join(SPELL_MARKDOWN_ROOT, `level-${level}`);
        const jsonLevelDir = path.join(SPELL_JSON_ROOT, `level-${level}`);
        if (!fs.existsSync(markdownLevelDir) || !fs.existsSync(jsonLevelDir)) continue;

        const markdownFiles = fs.readdirSync(markdownLevelDir)
            .filter((file) => file.endsWith('.md'))
            .sort((a, b) => a.localeCompare(b));

        for (const markdownFile of markdownFiles) {
            const markdownPath = path.join(markdownLevelDir, markdownFile);
            const currentSize = fs.statSync(markdownPath).size;
            if (currentSize > 5) continue;

            const spellId = path.basename(markdownFile, '.md');
            files.push({
                level,
                markdownPath,
                jsonPath: path.join(jsonLevelDir, `${spellId}.json`),
                spellId,
            });
        }
    }

    return files;
}

function regenerateBlankSpellReferenceDocs(): void {
    const blankDocs = listBlankMarkdownFiles();

    for (const doc of blankDocs) {
        const spellJson = JSON.parse(fs.readFileSync(doc.jsonPath, 'utf8')) as Record<string, unknown>;
        const markdown = renderSpellMarkdown(doc.spellId, spellJson);
        fs.writeFileSync(doc.markdownPath, markdown, 'utf8');
        console.log(`Regenerated blank spell reference doc: ${path.relative(REPO_ROOT, doc.markdownPath)}`);
    }

    console.log(`Rebuilt ${blankDocs.length} blank spell reference docs.`);
}

regenerateBlankSpellReferenceDocs();
