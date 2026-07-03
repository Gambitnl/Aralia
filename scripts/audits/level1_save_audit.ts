
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
type SpellSaveUsage = {
  file: string;
  spellName: string;
  effectIndex: number;
  saveType: string | undefined;
  saveEffect: string | undefined;
  damageType: string | undefined;
};

function auditLevel1Saves() {
  console.log('🔍 Auditing Level 1 Spells for saveEffect usage...');

  const files = fs.readdirSync(SPELLS_DIR).filter(f => f.endsWith('.json'));
  const damageSpells: SpellSaveUsage[] = [];

  files.forEach(file => {
    const filePath = path.join(SPELLS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    try {
      const spell = JSON.parse(content);

        if (spell.effects) {
          spell.effects.forEach((effect: unknown, index: number) => {
            const typedEffect = effect as {
              type?: string;
              condition?: { type?: string; saveType?: string; saveEffect?: string };
              damage?: { type?: string };
            };
            if (typedEffect.type === 'DAMAGE' && typedEffect.condition && typedEffect.condition.type === 'save') {
              damageSpells.push({
              file,
              spellName: spell.name,
              effectIndex: index,
              saveType: typedEffect.condition.saveType,
              saveEffect: typedEffect.condition.saveEffect,
              damageType: typedEffect.damage?.type
            });
          }
        });
      }
    } catch (err: unknown) {
      // DEBT: Cast to any to safely access message on unknown catch variable.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const _e = err as any;
      console.error(`Error parsing ${file}: ${_e.message}`);
    }
  });

  console.log('--- Level 1 Damage Spells with Saves ---');
  damageSpells.forEach((s: SpellSaveUsage) => {
    const status = s.saveEffect === 'half' ? '✅ Half' : (s.saveEffect === 'none' ? '⚠️ None' : `❓ ${s.saveEffect}`);
    console.log(`[${s.file}] ${s.spellName} (${s.damageType}): ${status} (Save: ${s.saveType})`);
  });
}

auditLevel1Saves();
