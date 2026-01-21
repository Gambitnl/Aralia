#!/usr/bin/env tsx
/**
 * Generate race images (Male/Female versions) using Stitch (primary) with image-gen fallback.
 * 
 * Usage:
 *   npm run generate:race-images
 *   npm run generate:race-images -- --force  (Regenerate existing)
 *   npm run generate:race-images -- race_id   (Generate specific race)
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
// TODO(next-agent): Preserve behavior; replace this ts-expect-error once tsx supports extensionless local TS imports.
// @ts-expect-error -- tsx resolves local TS entrypoints at runtime; keep explicit extension for CLI use.
import { generateImage, downloadImage, cleanup } from './image-gen-driver.ts';

const RACES_DIR = path.resolve(process.cwd(), 'public/data/glossary/entries/races');
const IMAGES_DIR = path.resolve(process.cwd(), 'public/assets/images/races');

interface RaceData {
  id: string;
  title: string;
  entryLore: string;
  imageUrl: string;
  source?: string;
  tags?: string[];
}

async function loadRaceData(raceFile: string): Promise<RaceData> {
  const content = fs.readFileSync(raceFile, 'utf-8');
  return JSON.parse(content);
}

function generatePrompt(race: RaceData, gender: 'male' | 'female'): string {
  const loreSummary = race.entryLore.substring(0, 300).trim();
  const tags = race.tags?.filter(t => t !== 'race').slice(0, 4).join(', ') || '';
  
  return `A high-quality fantasy RPG character portrait of a ${gender} ${race.title} from Dungeons and Dragons. ${loreSummary}. Appearance: detailed ${race.title} features, fitting the canon D&D 5e style. Background: simple atmospheric background. Style: professional TTRPG illustration, digital art, sharp focus, oil painting style. ${tags}`;
}

async function processRace(raceFile: string, force: boolean): Promise<void> {
  const race = await loadRaceData(raceFile);
  const genders: ('male' | 'female')[] = ['male', 'female'];

  console.log(`\n🎨 Processing ${race.title} (${race.id})`);

  for (const gender of genders) {
    const fileName = `${race.id}_${gender}.png`;
    const outputPath = path.join(IMAGES_DIR, fileName);

    if (fs.existsSync(outputPath) && !force) {
      console.log(`  ✓ ${gender}: Image exists`);
      continue;
    }

    console.log(`  ✨ Generating ${gender} version...`);
    const prompt = generatePrompt(race, gender);
    
    // 1. Generate
    console.log(`     Sending prompt to image generator...`);
    const genResult = await generateImage(prompt, 'gemini'); 
    
    if (!genResult.success) {
        console.error(`  ✗ Generation failed: ${genResult.message}`);
        continue;
    }

    console.log(`     Provider: ${genResult.provider}`);
    
    await new Promise(r => setTimeout(r, 2000));

    // 2. Download
    console.log(`     Downloading...`);
    const dlResult = await downloadImage(outputPath);

    if (dlResult.success && fs.existsSync(outputPath)) {
      console.log(`  📥 Saved to ${fileName}`);
      console.log('  💤 Cooling down for 10s...');
      await new Promise(r => setTimeout(r, 10000)); 
    } else {
      console.error(`  ✗ Download failed: ${dlResult.message}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const specificRaceArg = args.find(arg => !arg.startsWith('--'));

  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

  console.log('🎨 Race Image Generator (Stitch + Fallback)');
  console.log('============================================\n');

  const raceFiles = await glob('**/*.json', {
    cwd: RACES_DIR,
    absolute: true,
    ignore: ['**/dragonmark_variants/**', '**/aasimar_variants/**', '**/elf_lineages/**', '**/gnome_subraces/**', '**/goliath_ancestries/**', '**/halfling_subraces/**', '**/shifter_variants/**', '**/tiefling_legacies/**']
  });

  const filteredFiles = raceFiles.filter(f => !f.includes('dragonmark_variants'));

  const filesToProcess = specificRaceArg
    ? filteredFiles.filter(f => f.toLowerCase().includes(specificRaceArg.toLowerCase()))
    : filteredFiles;

  if (filesToProcess.length === 0) {
    console.error(`No race files found for "${specificRaceArg || 'all'}"`);
    process.exit(1);
  }

  console.log(`Found ${filesToProcess.length} race(s) to process.`);

  for (const file of filesToProcess) {
    await processRace(file, force);
  }

  await cleanup();
  console.log('\n✨ All tasks completed!');
  process.exit(0);
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await cleanup();
  process.exit(1);
});
