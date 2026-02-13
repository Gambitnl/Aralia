import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

const OUTPUT_FILE = '.agent/roadmap/file_dates.json';

function getCreationDate(filePath: string): string | null {
  try {
    const output = execSync(`git log --diff-filter=A --follow --format=%aI -- "${filePath}"`, { encoding: 'utf-8' }).trim();
    if (!output) return null;
    const dates = output.split('\n');
    return dates[dates.length - 1]; // First creation date
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log('Scanning for .md files...');
  const files = globSync('**/*.md', { 
    ignore: ['node_modules/**', 'dist/**'],
    posix: true 
  });

  console.log(`Found ${files.length} files. Extracting creation dates from Git...`);
  
  const results: Record<string, string> = {};
  let count = 0;

  for (const file of files) {
    const date = getCreationDate(file);
    if (date) {
      results[file] = date;
    }
    count++;
    if (count % 100 === 0) {
      console.log(`Processed ${count}/${files.length} files...`);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`Done! Results saved to ${OUTPUT_FILE}`);
}

main().catch(console.error);
