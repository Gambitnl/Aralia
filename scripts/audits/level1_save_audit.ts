
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPELLS_DIR = path.join(__dirname, '../../public/data/spells/level-1');

function auditLevel1Saves() {
  console.log('🔍 Auditing Level 1 Spells for saveEffect usage...');

  const files = fs.readdirSync(SPELLS_DIR).filter(f => f.endsWith('.json'));
  const damageSpells: any[] = [];

  files.forEach(file => {
    const filePath = path.join(SPELLS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    try {
      const spell = JSON.parse(content);

      if (spell.effects) {
        spell.effects.forEach((effect: any, index: number) => {
          if (effect.type === 'DAMAGE' && effect.condition && effect.condition.type === 'save') {
            damageSpells.push({
              file,
              spellName: spell.name,
              effectIndex: index,
              saveType: effect.condition.saveType,
              saveEffect: effect.condition.saveEffect,
              damageType: effect.damage?.type
            });
          }
        });
      }

    } catch (e: any) {
      console.error(`Error parsing ${file}: ${e.message}`);
    }
  });

  console.log('--- Level 1 Damage Spells with Saves ---');
  damageSpells.forEach(s => {
    const status = s.saveEffect === 'half' ? '✅ Half' : (s.saveEffect === 'none' ? '⚠️ None' : `❓ ${s.saveEffect}`);
    console.log(`[${s.file}] ${s.spellName} (${s.damageType}): ${status} (Save: ${s.saveType})`);
  });
}

auditLevel1Saves();
