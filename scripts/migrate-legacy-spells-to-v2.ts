/**
 * Migration script: Convert legacy spell JSONs (old flat schema) into V2 spell schema,
 * and move them into `public/data/spells/level-{N}/{id}.json`.
 *
 * Legacy schema typically looks like:
 * { id, name, level, school, castingTime: "1 Action", range: "150 feet", components: {...}, duration: "Instantaneous", description: "..." }
 */

import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { SpellValidator } from '../src/systems/spells/validation/spellValidator.ts';

type ManifestEntry = {
  name: string;
  level: number;
  school: string;
  path: string;
};

type LegacySpell = {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime?: string;
  range?: string;
  components?: {
    verbal?: boolean;
    somatic?: boolean;
    material?: boolean;
  };
  duration?: string;
  description?: string;
  higherLevels?: string;
};

const MANIFEST_PATH = path.join(process.cwd(), 'public', 'data', 'spells_manifest.json');
const SPELLS_DIR = path.join(process.cwd(), 'public', 'data', 'spells');

const toRelativePublicPath = (webPath: string) => (webPath.startsWith('/') ? webPath.slice(1) : webPath);

const parseCastingTime = (raw: string | undefined) => {
  const valueUnit = String(raw || '').trim();
  const normalized = valueUnit.toLowerCase();

  const unitMap: Record<string, any> = {
    action: { unit: 'action', combatCost: { type: 'action' } },
    'bonus action': { unit: 'bonus_action', combatCost: { type: 'bonus_action' } },
    reaction: { unit: 'reaction', combatCost: { type: 'reaction' } },
    minute: { unit: 'minute', explorationCost: true },
    minutes: { unit: 'minute', explorationCost: true },
    hour: { unit: 'hour', explorationCost: true },
    hours: { unit: 'hour', explorationCost: true },
    special: { unit: 'special' },
  };

  // Most common format: "1 Action", "10 Minutes", etc.
  const match = /(\d+)\s*(action|bonus action|reaction|minute|minutes|hour|hours|special)\b/i.exec(valueUnit);
  if (match) {
    const value = Number(match[1]);
    const key = match[2].toLowerCase();
    const meta = unitMap[key] ?? { unit: 'special' };
    const castingTime: any = { value, unit: meta.unit };
    if (meta.combatCost) castingTime.combatCost = meta.combatCost;
    if (meta.explorationCost) castingTime.explorationCost = { value, unit: meta.unit };
    return castingTime;
  }

  if (normalized.includes('bonus')) {
    return { value: 1, unit: 'bonus_action', combatCost: { type: 'bonus_action' } };
  }
  if (normalized.includes('reaction')) {
    return { value: 1, unit: 'reaction', combatCost: { type: 'reaction' } };
  }
  if (normalized.includes('minute')) {
    return { value: 1, unit: 'minute', explorationCost: { value: 1, unit: 'minute' } };
  }
  if (normalized.includes('hour')) {
    return { value: 1, unit: 'hour', explorationCost: { value: 1, unit: 'hour' } };
  }
  if (normalized.includes('special')) {
    return { value: 0, unit: 'special' };
  }

  // Safe default
  return { value: 1, unit: 'action', combatCost: { type: 'action' } };
};

const parseRange = (raw: string | undefined) => {
  const value = String(raw || '').trim();
  const normalized = value.toLowerCase();

  if (!value) return { type: 'special' };
  if (normalized.startsWith('self')) return { type: 'self' };
  if (normalized.startsWith('touch')) return { type: 'touch' };

  const feetMatch = /(\d+)\s*feet\b/i.exec(value);
  if (feetMatch) {
    return { type: 'ranged', distance: Number(feetMatch[1]) };
  }

  return { type: 'special' };
};

const parseDuration = (raw: string | undefined) => {
  const value = String(raw || '').trim();
  const normalized = value.toLowerCase();

  if (!value) return { type: 'special', concentration: false };
  if (normalized.includes('instant')) return { type: 'instantaneous', concentration: false };

  const isConcentration = normalized.includes('concentration');

  if (normalized.includes('until dispelled or triggered')) {
    return { type: 'until_dispelled_or_triggered', concentration: isConcentration };
  }
  if (normalized.includes('until dispelled')) {
    return { type: 'until_dispelled', concentration: isConcentration };
  }
  if (normalized.includes('special')) {
    return { type: 'special', concentration: isConcentration };
  }

  // Prefer parsing "up to X unit" for concentration spells
  const upToMatch = /up to\s*(\d+)\s*(round|minute|hour|day)s?\b/i.exec(value);
  if (upToMatch) {
    return { type: 'timed', value: Number(upToMatch[1]), unit: upToMatch[2].toLowerCase(), concentration: true };
  }

  const timedMatch = /(\d+)\s*(round|minute|hour|day)s?\b/i.exec(value);
  if (timedMatch) {
    return { type: 'timed', value: Number(timedMatch[1]), unit: timedMatch[2].toLowerCase(), concentration: isConcentration };
  }

  return { type: 'special', concentration: isConcentration };
};

const inferTargeting = (range: any) => {
  if (range.type === 'self') {
    return { type: 'self', range: 0, validTargets: ['self'], lineOfSight: false };
  }
  if (range.type === 'touch') {
    return { type: 'single', range: 5, validTargets: ['creatures', 'objects'], lineOfSight: true };
  }
  if (range.type === 'ranged' && typeof range.distance === 'number') {
    return { type: 'single', range: range.distance, validTargets: ['creatures', 'objects', 'point'], lineOfSight: true };
  }
  return { type: 'single', validTargets: ['creatures', 'objects', 'point', 'ground'], lineOfSight: true };
};

const convertLegacyToV2 = (legacy: LegacySpell) => {
  const castingTime = parseCastingTime(legacy.castingTime);
  const range = parseRange(legacy.range);
  const duration = parseDuration(legacy.duration);
  const targeting = inferTargeting(range);

  const spell = {
    id: legacy.id,
    name: legacy.name,
    level: legacy.level,
    school: legacy.school,
    legacy: true,
    classes: [],
    ritual: false,
    castingTime,
    range,
    components: {
      verbal: !!legacy.components?.verbal,
      somatic: !!legacy.components?.somatic,
      material: !!legacy.components?.material,
    },
    duration,
    targeting,
    effects: [
      {
        type: 'UTILITY',
        trigger: { type: 'immediate' },
        condition: { type: 'always' },
        utilityType: 'other',
        description: legacy.description || '',
      },
    ],
    description: legacy.description || '',
    higherLevels: legacy.higherLevels,
    tags: ['legacy'],
  };

  SpellValidator.parse(spell);
  return spell;
};

const main = () => {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error('spells_manifest.json not found; run regenerate-manifest first.');
  }

  const manifest: Record<string, ManifestEntry> = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  const legacyIds = Object.entries(manifest).filter(([, entry]) => {
    if (typeof entry.level !== 'number') return false;
    return !entry.path.includes(`/level-${entry.level}/`);
  });

  console.log(`[Spell Migration] Legacy spells detected: ${legacyIds.length}`);

  let migrated = 0;
  const errors: string[] = [];

  for (const [id, entry] of legacyIds) {
    const sourcePath = path.join(process.cwd(), 'public', toRelativePublicPath(entry.path));
    const targetDir = path.join(SPELLS_DIR, `level-${entry.level}`);
    const targetPath = path.join(targetDir, `${id}.json`);

    if (!fs.existsSync(sourcePath)) {
      // If the manifest is stale, skip without failing the whole migration.
      console.warn(`[Spell Migration] Missing legacy source file for ${id}: ${sourcePath}`);
      continue;
    }
    if (fs.existsSync(targetPath)) {
      console.warn(`[Spell Migration] Target already exists for ${id}, skipping: ${targetPath}`);
      continue;
    }

    try {
      const legacyRaw = fs.readFileSync(sourcePath, 'utf-8');
      const legacy = JSON.parse(legacyRaw) as LegacySpell;

      const normalizedLegacy: LegacySpell = {
        id,
        name: legacy.name || entry.name,
        level: typeof legacy.level === 'number' ? legacy.level : entry.level,
        school: legacy.school || entry.school,
        castingTime: legacy.castingTime,
        range: legacy.range,
        components: legacy.components,
        duration: legacy.duration,
        description: legacy.description,
        higherLevels: legacy.higherLevels,
      };

      fs.mkdirSync(targetDir, { recursive: true });
      const v2 = convertLegacyToV2(normalizedLegacy);
      fs.writeFileSync(targetPath, JSON.stringify(v2, null, 2));
      fs.unlinkSync(sourcePath);

      migrated++;
    } catch (e: unknown) {
      const message =
        e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : (e instanceof Error ? e.message : String(e));
      errors.push(`${id}: ${message}`);
    }
  }

  console.log(`[Spell Migration] Migrated: ${migrated}`);
  if (errors.length > 0) {
    console.error(`[Spell Migration] Errors: ${errors.length}`);
    errors.slice(0, 10).forEach((e) => console.error(`  - ${e}`));
    if (errors.length > 10) console.error(`  ...and ${errors.length - 10} more`);
    process.exit(1);
  }
};

main();

