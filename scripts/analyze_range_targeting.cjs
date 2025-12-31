const fs = require('fs');
const dir = 'public/data/spells/level-0';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

console.log('=== Range vs Targeting Analysis ===\n');

files.forEach(f => {
    const d = JSON.parse(fs.readFileSync(dir + '/' + f, 'utf8'));
    const rangeType = d.range?.type || 'undefined';
    const rangeDist = d.range?.distance;
    const targetType = d.targeting?.type || 'undefined';
    const targetRange = d.targeting?.range;
    const targets = d.targeting?.validTargets || [];

    const issues = [];

    // Self range but targets enemies/creatures at distance
    if (rangeType === 'self' && targets.includes('enemies') && targetRange > 0) {
        issues.push('range=self but targets enemies at ' + targetRange + 'ft');
    }

    // Self range but targeting type is ranged
    if (rangeType === 'self' && targetType === 'ranged') {
        issues.push('range=self but targeting.type=ranged');
    }

    // Touch range but targeting indicates ranged attacks
    if (rangeType === 'touch' && targetType === 'ranged') {
        issues.push('range=touch but targeting.type=ranged');
    }

    // Ranged range but targeting is self
    if (rangeType === 'ranged' && targetType === 'self') {
        issues.push('range=ranged but targeting.type=self');
    }

    if (issues.length > 0) {
        console.log(d.name + ':');
        console.log('  range.type=' + rangeType + ', range.distance=' + rangeDist);
        console.log('  targeting.type=' + targetType + ', targeting.range=' + targetRange);
        console.log('  validTargets=' + JSON.stringify(targets));
        issues.forEach(i => console.log('  ISSUE: ' + i));
        console.log('');
    }
});

console.log('=== Summary of all range/targeting combos ===\n');
const combos = {};
files.forEach(f => {
    const d = JSON.parse(fs.readFileSync(dir + '/' + f, 'utf8'));
    const key = d.range?.type + ' -> ' + d.targeting?.type;
    if (!combos[key]) combos[key] = [];
    combos[key].push(d.name);
});

Object.keys(combos).sort().forEach(k => {
    console.log(k + ' (' + combos[k].length + '):');
    console.log('  ' + combos[k].join(', '));
    console.log('');
});
