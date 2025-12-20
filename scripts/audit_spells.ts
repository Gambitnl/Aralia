
import * as fs from 'fs';
import * as path from 'path';

// Minimal interface definitions to match the JSON structure
interface ScalingFormula {
  type: string;
  bonusPerLevel?: string;
  customFormula?: string;
  scalingTiers?: Record<string, string>;
}

interface SpellEffect {
    type: string;
    scaling?: ScalingFormula;
}

interface Spell {
  id: string;
  name: string;
  level: number;
  effects: SpellEffect[];
  higherLevels?: string;
}

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
  } catch (e) {
      console.error(`Could not read spell root: ${SPELL_ROOT}`);
      process.exit(1);
  }

  for (const levelDir of levelDirs) {
      const dirPath = path.join(SPELL_ROOT, levelDir);
      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));

      for (const file of files) {
        const content = fs.readFileSync(path.join(dirPath, file), 'utf-8');
        try {
          const spell: Spell = JSON.parse(content);
          totalAudited++;

          const hasHigherLevelsText = !!spell.higherLevels && spell.higherLevels.trim().length > 0;

          // Check if ANY effect has functional scaling
          const hasScalingLogic = spell.effects.some(effect => {
              const scaling = effect.scaling;
              return scaling && (
                (scaling.bonusPerLevel && scaling.bonusPerLevel.trim().length > 0) ||
                (scaling.customFormula && scaling.customFormula.trim().length > 0) ||
                (scaling.scalingTiers && Object.keys(scaling.scalingTiers || {}).length > 0)
              );
          });

          // Issue 1: Phantom Scaling
          // Text says it scales, but logic is empty
          if (hasHigherLevelsText && !hasScalingLogic) {
            // Truncate text for display
            const text = spell.higherLevels?.replace(/\n/g, ' ').substring(0, 30) + '...';
            console.log(`| ${spell.name} | Phantom Scaling | Text: "${text}" but no logic |`);
            phantomScalingCount++;
          }

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
