const fs = require('fs');
const path = require('path');

const dir = 'public/data/spells/level-0';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();

const allSpells = files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    return { file: f, ...data };
});

console.log('=== CANTRIP INCONSISTENCY REPORT ===\n');

// 1. Check which fields are missing on some spells but present on others
const flattenObj = (obj, prefix = '') => {
    let result = {};
    for (let key in obj) {
        const fullKey = prefix ? prefix + '.' + key : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            Object.assign(result, flattenObj(obj[key], fullKey));
        } else {
            result[fullKey] = obj[key];
        }
    }
    return result;
};

// Get field presence stats
const fieldPresence = {};
allSpells.forEach(spell => {
    const flat = flattenObj(spell);
    Object.keys(flat).forEach(k => {
        if (!fieldPresence[k]) fieldPresence[k] = { present: [], missing: [] };
        fieldPresence[k].present.push(spell.name);
    });
});

// Find fields that aren't in every spell
Object.keys(fieldPresence).forEach(k => {
    const present = fieldPresence[k].present;
    const missing = allSpells.filter(s => !present.includes(s.name)).map(s => s.name);
    fieldPresence[k].missing = missing;
});

console.log('## Fields with inconsistent presence:\n');
Object.keys(fieldPresence)
    .filter(k => !k.startsWith('effects') && k !== 'description' && k !== 'higherLevels' && k !== 'file')
    .filter(k => fieldPresence[k].missing.length > 0 && fieldPresence[k].missing.length < 44)
    .sort((a, b) => fieldPresence[a].missing.length - fieldPresence[b].missing.length)
    .forEach(k => {
        const missing = fieldPresence[k].missing;
        const present = fieldPresence[k].present;
        if (missing.length <= present.length) {
            console.log(`### ${k}`);
            console.log(`  MISSING on ${missing.length} spells: ${missing.join(', ')}\n`);
        } else {
            console.log(`### ${k}`);
            console.log(`  PRESENT only on ${present.length} spells: ${present.join(', ')}\n`);
        }
    });

// 2. Check for value consistency within fields
console.log('\n## Value variations per field:\n');

const valuesByField = {};
allSpells.forEach(spell => {
    const flat = flattenObj(spell);
    Object.keys(flat).forEach(k => {
        if (!valuesByField[k]) valuesByField[k] = new Map();
        const val = JSON.stringify(flat[k]);
        if (!valuesByField[k].has(val)) valuesByField[k].set(val, []);
        valuesByField[k].get(val).push(spell.name);
    });
});

// Show fields with unexpected variations
['school', 'range.type', 'targeting.type', 'duration.type', 'castingTime.unit'].forEach(field => {
    if (valuesByField[field]) {
        console.log(`### ${field}`);
        valuesByField[field].forEach((spells, value) => {
            console.log(`  ${value}: ${spells.length} spells`);
        });
        console.log('');
    }
});

// 3. Check tags consistency
console.log('\n## Tags analysis:\n');
const allTags = new Set();
allSpells.forEach(spell => {
    if (spell.tags) spell.tags.forEach(t => allTags.add(t));
});
console.log('Unique tags found:', Array.from(allTags).sort().join(', '));

// Check if "cantrip" tag is consistent
const hasCantrip = allSpells.filter(s => s.tags && s.tags.includes('cantrip')).map(s => s.name);
const noCantrip = allSpells.filter(s => !s.tags || !s.tags.includes('cantrip')).map(s => s.name);
console.log(`\nSpells WITH "cantrip" tag (${hasCantrip.length}): ${hasCantrip.join(', ')}`);
console.log(`\nSpells WITHOUT "cantrip" tag (${noCantrip.length}): ${noCantrip.join(', ')}`);

console.log('\n=== END REPORT ===');
