
import * as fs from 'fs';
import * as path from 'path';
import { auditSpell, AuditResult } from '../src/utils/validation/spellAuditor';

const SPELL_ROOT = 'public/data/spells';

function auditAllSpells() {
  console.log('| Spell | Issue | Details |');
  console.log('|-------|-------|---------|');

  let phantomScalingCount = 0;
  let totalAudited = 0;

  // Get all subdirectories (level-0, level-1, etc.)
  let levelDirs: string[] = [];
  try {
    levelDirs = fs.readdirSync(SPELL_ROOT).filter(f => {
        const fullPath = path.join(SPELL_ROOT, f);
        return fs.statSync(fullPath).isDirectory() && f.startsWith('level-');
    });
  } catch (_error) {
      console.error(`Could not read spell root: ${SPELL_ROOT}`);
      process.exit(1);
  }

  for (const levelDir of levelDirs) {
      const dirPath = path.join(SPELL_ROOT, levelDir);
      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));

      for (const file of files) {
        const content = fs.readFileSync(path.join(dirPath, file), 'utf-8');
        try {
          const spellData = JSON.parse(content);
          totalAudited++;

          const result: AuditResult = auditSpell(spellData);

          result.issues.forEach(issue => {
             if (issue.type === 'phantom_scaling') {
                 // Truncate message for display
                 const shortMsg = issue.message.substring(0, 50) + '...';
                 console.log(`| ${result.spellName} | Phantom Scaling | ${shortMsg} |`);
                 phantomScalingCount++;
             }
             // We can log other issues here too if desired
          });

        } catch (e) {
          console.error(`Failed to parse ${file}: ${e}`);
        }
      }
  }

  console.log('\nAudit Summary:');
  console.log(`Total Spells: ${totalAudited}`);
  console.log(`Phantom Scaling (Text w/o Logic): ${phantomScalingCount}`);
}

auditAllSpells();
