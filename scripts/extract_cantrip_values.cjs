const fs = require('fs');
const path = require('path');

const dir = 'public/data/spells/level-0';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();

const allSpells = files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    return data;
});

// Flatten object to dot notation
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

// Get all unique keys (excluding effects array and long text fields)
const allKeys = new Set();
allSpells.forEach(spell => {
    const flat = flattenObj(spell);
    Object.keys(flat).forEach(k => {
        if (!k.startsWith('effects') && k !== 'description' && k !== 'higherLevels') {
            allKeys.add(k);
        }
    });
});

const sortedKeys = Array.from(allKeys).sort();

// Build markdown table
let md = '# Cantrip Raw Values Table\n\n';
md += 'Exact values from each JSON file.\n\n';

// Header
md += '| ' + sortedKeys.join(' | ') + ' |\n';
md += '|' + sortedKeys.map(() => '---').join('|') + '|\n';

// Rows
allSpells.forEach(spell => {
    const flat = flattenObj(spell);
    const row = sortedKeys.map(k => {
        const val = flat[k];
        if (val === undefined) return '';
        if (val === null) return 'null';
        if (Array.isArray(val)) return JSON.stringify(val);
        if (typeof val === 'boolean') return String(val);
        if (typeof val === 'number') return String(val);
        if (typeof val === 'string') return '"' + val.replace(/\|/g, '\\|') + '"';
        return String(val);
    });
    md += '| ' + row.join(' | ') + ' |\n';
});

fs.writeFileSync('public/data/cantrip_table.md', md);
console.log('Created cantrip_table.md with', allSpells.length, 'spells and', sortedKeys.length, 'columns');
