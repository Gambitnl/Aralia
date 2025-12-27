
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPELLS_DIR = path.join(__dirname, '../../public/data/spells/level-0');

function auditCantripSaves() {
  console.log('🔍 Auditing Level 0 Spells for invalid "half" damage on save...');

  const files = fs.readdirSync(SPELLS_DIR).filter(f => f.endsWith('.json'));
  let issuesFound = 0;

  files.forEach(file => {
    const filePath = path.join(SPELLS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    try {
      const spell = JSON.parse(content);

      // Check each effect
      if (spell.effects) {
        spell.effects.forEach((effect, index) => {
          // Check condition.saveEffect
          if (effect.condition && effect.condition.saveEffect === 'half') {
            console.error(`❌ [${file}] Effect ${index} (${effect.type}) has saveEffect: "half". Cantrips should be "none".`);
            issuesFound++;
          }
        });
      }

    } catch (e) {
      console.error(`Error parsing ${file}: ${e.message}`);
    }
  });

  if (issuesFound > 0) {
    console.log(`\nFound ${issuesFound} issues.`);
    process.exit(1);
  } else {
    console.log('\n✅ No "half" damage cantrips found. Audit passed.');
    process.exit(0);
  }
}

auditCantripSaves();
