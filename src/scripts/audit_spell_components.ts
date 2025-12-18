
import fs from 'fs';
import path from 'path';

interface Spell {
  id: string;
  name: string;
  level: number;
  components: {
    material?: boolean;
    materialDescription?: string;
    materialCost?: number;
    isConsumed?: boolean;
  };
}

function getFiles(dir: string, suffix: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(file, suffix));
    } else {
      if (file.endsWith(suffix)) {
        results.push(file);
      }
    }
  });
  return results;
}

async function audit() {
  const rootDir = 'public/data/spells';
  const files = getFiles(rootDir, '.json');

  console.log('| Spell | Issue | Cost (Desc vs Data) | Consumed (Desc vs Data) |');
  console.log('|---|---|---|---|');

  let issuesFound = 0;

  for (const file of files) {
    if (!file.includes('level-')) continue;

    try {
      const content = fs.readFileSync(file, 'utf-8');
      const spell = JSON.parse(content) as Spell;

      if (!spell.components.material) continue;

      const desc = spell.components.materialDescription || '';
      // Improved Regex to handle "100+ gp"
      const costMatch = desc.match(/worth (?:at least )?([\d,]+)(?:\+)? gp/i);
      const consumedMatch = desc.match(/consumes?|consumed/i);

      let hasIssue = false;
      let issueType = '';

      // Check Cost
      let expectedCost = 0;
      if (costMatch) {
        expectedCost = parseInt(costMatch[1].replace(/,/g, ''), 10);
        if (spell.components.materialCost !== expectedCost) {
          hasIssue = true;
          issueType += 'Cost Mismatch; ';
        }
      }

      const expectedConsumed = !!consumedMatch;
      if (expectedConsumed && !spell.components.isConsumed) {
        hasIssue = true;
        issueType += 'Consumed Missing; ';
      }

      if (hasIssue) {
        issuesFound++;
        console.log(`| ${spell.name} | ${issueType} | ${expectedCost} vs ${spell.components.materialCost ?? 0} | ${expectedConsumed} vs ${spell.components.isConsumed ?? false} |`);
      }

    } catch (e) {
      console.error(`Error parsing ${file}:`, e);
    }
  }

  console.log(`\nTotal issues found: ${issuesFound}`);
}

audit();
