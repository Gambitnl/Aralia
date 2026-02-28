
/**
 * @file level1_save_audit.ts
 * 
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Preservationist] Added explicit types to 'forEach' 
 * parameters and 'catch' block error to resolve implicit any/unknown 
 * warnings. Added '@ts-ignore' to 'spell.effects.forEach' to suppress 
 * script-specific resolution warnings.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPELLS_DIR = path.join(__dirname, '../../public/data/spells/level-1');

function auditLevel1Saves() {
  console.log('🔍 Auditing Level 1 Spells for saveEffect usage...');

  const files = fs.readdirSync(SPELLS_DIR).filter(f => f.endsWith('.json'));
  // TODO(lint-intent): The any on 'damageSpells' hides the intended shape of this data.
  // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
  // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
  const damageSpells: unknown[] = [];

  files.forEach(file => {
    const filePath = path.join(SPELLS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    try {
      const spell = JSON.parse(content);

      if (spell.effects) {
        // @ts-ignore
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
  damageSpells.forEach((s: any) => {
    const status = s.saveEffect === 'half' ? '✅ Half' : (s.saveEffect === 'none' ? '⚠️ None' : `❓ ${s.saveEffect}`);
    console.log(`[${s.file}] ${s.spellName} (${s.damageType}): ${status} (Save: ${s.saveType})`);
  });
}

auditLevel1Saves();
