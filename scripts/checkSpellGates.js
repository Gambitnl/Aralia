// scripts/checkSpellGates.js
// Run with: node scripts/checkSpellGates.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fm from "front-matter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GLOSSARY_DIR = path.join(__dirname, "../public/data/glossary/entries/spells");
const SPELL_DATA_DIR = path.join(__dirname, "../public/data/spells");
const MANIFEST_PATH = path.join(__dirname, "../public/data/spells_manifest.json");

// Load manifest
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));

// Helper to parse field from MD HTML
const parseFieldFromMd = (content, fieldLabel) => {
    const regex = new RegExp(
        `<span class="spell-card-stat-label">${fieldLabel}</span>\\s*` +
        `<span class="spell-card-stat-value">([^<]+)</span>`,
        'i'
    );
    const match = regex.exec(content);
    return match ? match[1].trim() : null;
};

// Compute functions (same as useSpellGateChecks)
const computeRangeFromJson = (json) => {
    const range = json.range;
    const targeting = json.targeting;
    if (!range) return 'Self';
    if (range.type === 'self') {
        if (targeting?.range) return `${targeting.range} ft.`;
        return 'Self';
    }
    if (range.type === 'touch') return 'Touch';
    if (range.distance) return `${range.distance} ft.`;
    return range.type || 'Self';
};

const computeAttackSaveFromJson = (json) => {
    const effects = json.effects;
    const tags = json.tags;
    const targeting = json.targeting;
    const range = json.range;

    if (!effects || effects.length === 0) return 'None';

    for (const effect of effects) {
        if (effect.condition?.type === 'hit') {
            if (tags?.includes('melee')) return 'Melee';
            if (targeting?.type === 'melee') return 'Melee';
            if (targeting?.range === 5 || range?.distance === 5) return 'Melee';
            if (range?.type === 'ranged' || (range?.distance && range.distance > 10)) return 'Ranged';
            if (range?.type === 'self' && targeting?.range) return 'Melee';
            return 'Ranged';
        }
        if (effect.condition?.type === 'save' && effect.condition.saveType) {
            const saveType = effect.condition.saveType;
            return `${saveType.slice(0, 3).toUpperCase()} Save`;
        }
    }
    return 'None';
};

const computeLevelFromJson = (json) => {
    const level = json.level;
    if (level === 0) return 'Cantrip';
    const suffixes = { 1: 'st', 2: 'nd', 3: 'rd' };
    const suffix = suffixes[level] || 'th';
    return `${level}${suffix}`;
};

const computeCastingTimeFromJson = (json) => {
    const ct = json.castingTime;
    if (!ct) return '1 Action';
    const unitCap = ct.unit.charAt(0).toUpperCase() + ct.unit.slice(1);
    return `${ct.value} ${unitCap}`;
};

const computeComponentsFromJson = (json) => {
    const c = json.components;
    if (!c) return 'V, S';
    const parts = [];
    if (c.verbal) parts.push('V');
    if (c.somatic) parts.push('S');
    if (c.material) parts.push(c.materialDescription ? 'M *' : 'M');
    return parts.join(', ') || 'None';
};

const computeDurationFromJson = (json) => {
    const d = json.duration;
    if (!d) return 'Instantaneous';
    if (d.type === 'instantaneous') return 'Instantaneous';

    let result = '';
    if (d.value && d.unit) {
        const unitCap = d.unit.charAt(0).toUpperCase() + d.unit.slice(1);
        result = `${d.value} ${unitCap}${d.value > 1 ? 's' : ''}`;
    } else {
        result = d.type.charAt(0).toUpperCase() + d.type.slice(1);
    }

    if (d.concentration) {
        result = `Up to ${result} (Concentration)`;
    }
    return result;
};

const computeDamageEffectFromJson = (json) => {
    const effects = json.effects;
    if (!effects || effects.length === 0) return 'Utility';

    for (const effect of effects) {
        if (effect.type === 'DAMAGE' && effect.damage?.type) {
            return effect.damage.type;
        }
        if (effect.type === 'HEALING') return 'Healing';
        if (effect.type === 'DEFENSIVE') return 'Defense';
        if (effect.type === 'STATUS_CONDITION') return 'Control';
    }
    return 'Utility';
};

// Check a single spell
function checkSpell(id, level) {
    const issues = [];

    // Check if MD exists
    const mdPath = path.join(GLOSSARY_DIR, `level-${level}`, `${id}.md`);
    const jsonPath = path.join(SPELL_DATA_DIR, `level-${level}`, `${id}.json`);

    const mdExists = fs.existsSync(mdPath);
    const jsonExists = fs.existsSync(jsonPath);

    if (!mdExists) {
        issues.push("Missing MD file");
    }
    if (!jsonExists) {
        issues.push("Missing JSON file");
    }

    if (!mdExists || !jsonExists) {
        return issues;
    }

    // Check MD frontmatter
    const mdContent = fs.readFileSync(mdPath, "utf-8");
    try {
        const { attributes } = fm(mdContent);
        if (!attributes.id) issues.push("MD missing frontmatter id");
        if (!attributes.title) issues.push("MD missing frontmatter title");
    } catch (e) {
        issues.push("MD frontmatter parse error");
    }

    // Check layout
    if (!mdContent.includes('<div class="spell-card">')) {
        issues.push("MD missing spell-card HTML");
    }
    if (!mdContent.includes('spell-card-stats-grid')) {
        issues.push("MD missing stats-grid");
    }

    // Compare fields
    const json = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

    const fieldChecks = [
        { label: 'Level', compute: computeLevelFromJson },
        { label: 'Casting Time', compute: computeCastingTimeFromJson },
        { label: 'Range/Area', compute: computeRangeFromJson },
        { label: 'Components', compute: computeComponentsFromJson },
        { label: 'Duration', compute: computeDurationFromJson },
        { label: 'School', compute: (j) => j.school || 'Unknown' },
        { label: 'Attack/Save', compute: computeAttackSaveFromJson },
        { label: 'Damage/Effect', compute: computeDamageEffectFromJson },
    ];

    for (const { label, compute } of fieldChecks) {
        const mdValue = parseFieldFromMd(mdContent, label);
        const jsonValue = compute(json);

        if (mdValue && mdValue.toLowerCase() !== jsonValue.toLowerCase()) {
            issues.push(`${label}: MD="${mdValue}" ≠ JSON="${jsonValue}"`);
        }
    }

    return issues;
}

// Main
console.log("=== SPELL GATE CHECK REPORT ===\n");

const results = { 0: [], 1: [], 2: [] };

for (const [id, data] of Object.entries(manifest)) {
    const level = data.level;
    if (typeof level !== "number" || level > 2) continue;

    const issues = checkSpell(id, level);
    if (issues.length > 0) {
        results[level].push({ id, name: data.name, issues });
    }
}

for (const level of [0, 1, 2]) {
    const levelName = level === 0 ? "CANTRIPS" : `LEVEL ${level}`;
    console.log(`\n--- ${levelName} (${results[level].length} with issues) ---\n`);

    if (results[level].length === 0) {
        console.log("  ✅ All spells pass!\n");
    } else {
        for (const spell of results[level]) {
            console.log(`  ❌ ${spell.name} (${spell.id})`);
            for (const issue of spell.issues) {
                console.log(`      - ${issue}`);
            }
        }
    }
}

console.log("\n=== END REPORT ===");
