const fs = require('fs');
const path = require('path');

const dir = 'public/data/spells/level-0';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();

let fixCount = 0;

files.forEach(file => {
    const filePath = path.join(dir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let modified = false;

    // Fix 1: Add missing targeting.lineOfSight
    if (data.targeting && data.targeting.lineOfSight === undefined) {
        // Default to true for most spells
        data.targeting.lineOfSight = true;
        console.log(`[${data.name}] Added targeting.lineOfSight: true`);
        modified = true;
    }

    // Fix 2: Add "cantrip" tag if missing
    if (!data.tags) {
        data.tags = ["cantrip"];
        console.log(`[${data.name}] Created tags array with "cantrip"`);
        modified = true;
    } else if (!data.tags.includes("cantrip")) {
        data.tags.push("cantrip");
        console.log(`[${data.name}] Added "cantrip" to tags`);
        modified = true;
    }

    // Fix 3: Add targeting.range if missing but range.distance exists
    if (data.targeting && data.targeting.range === undefined) {
        if (data.range && data.range.distance) {
            data.targeting.range = data.range.distance;
            console.log(`[${data.name}] Added targeting.range: ${data.range.distance}`);
            modified = true;
        } else if (data.range && data.range.type === 'self') {
            // Self-range spells with targeting type that implies a range
            if (['single', 'melee', 'ranged'].includes(data.targeting.type)) {
                data.targeting.range = 5; // Default touch/melee range
                console.log(`[${data.name}] Added targeting.range: 5 (self/melee default)`);
                modified = true;
            } else if (data.targeting.type === 'self') {
                data.targeting.range = 0;
                console.log(`[${data.name}] Added targeting.range: 0 (self)`);
                modified = true;
            }
        } else if (data.range && data.range.type === 'touch') {
            data.targeting.range = 5;
            console.log(`[${data.name}] Added targeting.range: 5 (touch)`);
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
        fixCount++;
    }
});

console.log(`\n=== Fixed ${fixCount} files ===`);
