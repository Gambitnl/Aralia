/**
 * @file heroStore.ts — hero-artifact store for the creature hero pipeline.
 *
 * This module is imported by node tool scripts and tests ONLY. It reads and
 * writes files with node's fs module, so it must never be imported by game or
 * browser code.
 *
 * Layout on disk: each creature entry owns one folder under a base directory.
 * The folder holds a hero.json record plus the stage artifacts the pipeline
 * produces (reference.png, master.glb, and so on).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Everything the pipeline knows about one creature entry. */
export interface HeroRecord {
  entryId: string;
  prompt?: string;
  stages: Partial<Record<'reference' | 'master' | 'hero', { at: string; note?: string }>>;
  triangles?: { master: number; hero: number };
  status: 'generated' | 'approved';
}

/** The folder that holds one entry's hero.json and stage artifacts. */
export function heroDir(baseDir: string, entryId: string): string {
  return path.join(baseDir, entryId);
}

/** Read the entry's hero.json. Returns null when the file does not exist. */
export function readHero(baseDir: string, entryId: string): HeroRecord | null {
  const file = path.join(heroDir(baseDir, entryId), 'hero.json');
  if (!fs.existsSync(file)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as HeroRecord;
}

/** Write the entry's hero.json, creating its folder first when needed. */
export function writeHero(baseDir: string, record: HeroRecord): void {
  const dir = heroDir(baseDir, record.entryId);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'hero.json');
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
}

/** The file each gated stage must leave behind in the entry's folder. */
export const STAGE_ARTIFACTS: Record<'reference' | 'master', string> = {
  reference: 'reference.png',
  master: 'master.glb',
};

/**
 * Gate for pipeline stages. A later stage calls this before it starts, naming
 * the earlier stage it depends on. The earlier stage counts as finished only
 * when the hero.json record lists it AND its artifact file exists on disk.
 * Anything less throws, so a stage can never run on half-finished input.
 */
export function assertStage(
  baseDir: string,
  entryId: string,
  needs: 'reference' | 'master'
): void {
  const record = readHero(baseDir, entryId);
  const stageRecorded = record?.stages[needs] != null;
  const artifactPath = path.join(heroDir(baseDir, entryId), STAGE_ARTIFACTS[needs]);
  if (!stageRecorded || !fs.existsSync(artifactPath)) {
    throw new Error(
      `stage "${needs}" artifact missing for ${entryId} — run the earlier stage first`
    );
  }
}
