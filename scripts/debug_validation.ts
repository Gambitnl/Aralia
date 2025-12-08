import fs from 'fs';
import path from 'path';
import { SpellValidator } from '../src/systems/spells/validation/spellValidator';

const main = () => {
    const filePath = path.join(process.cwd(), 'public/data/spells/level-0/dancing-lights.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    console.log('Parsing dancing-lights...');
    try {
        SpellValidator.parse(data);
        console.log('Success!');
    } catch (e: any) {
        console.error('Caught error:');
        console.error(e);
        if (e.stack) console.error(e.stack);
    }
};

main();
