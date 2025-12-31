import fs from 'fs';
import path from 'path';
import { validateSmiteTargeting, validateDivineSmite } from './src/systems/spells/validation/smiteValidator';
import { Spell } from './src/types/spells';

const dir = 'public/data/spells/level-1/';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

console.log('Running Smite Audit...');

files.forEach(file => {
    try {
        const content = fs.readFileSync(path.join(dir, file), 'utf8');
        const spell = JSON.parse(content) as Spell;

        const smiteErrors = validateSmiteTargeting(spell);
        const divineErrors = validateDivineSmite(spell);

        const allErrors = [...smiteErrors, ...divineErrors];

        if (allErrors.length > 0) {
            console.log(`\n❌ ${spell.id}:`);
            allErrors.forEach(e => console.log(`  - ${e}`));
        }
    } catch (e) {
        // ignore parse errors for now
    }
});
