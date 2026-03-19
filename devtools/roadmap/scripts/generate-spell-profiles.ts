import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type {
  SpellCanonicalProfile,
  CastingTimeUnit,
} from '../src/spell-branch/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPELLS_DIR = path.join(
  __dirname,
  '../../../public/data/spells'
);
const OUTPUT_PATH = path.join(
  __dirname,
  '../../../.agent/roadmap/spell-profiles.json'
);

const STANDARD_CASTING_UNITS = new Set([
  'action',
  'bonus_action',
  'reaction',
]);

// Exported for testing
export function buildSpellProfile(raw: any): SpellCanonicalProfile {
  const unit = raw.castingTime?.unit ?? 'action';
  const castingTimeUnit: CastingTimeUnit = STANDARD_CASTING_UNITS.has(unit)
    ? (unit as CastingTimeUnit)
    : 'special';

  return {
    id: raw.id,
    name: raw.name,
    level: raw.level,
    school: raw.school,
    classes: raw.classes ?? [],
    castingTimeUnit,
    concentration: raw.duration?.concentration ?? false,
    ritual: raw.ritual ?? false,
    components: {
      verbal: raw.components?.verbal ?? false,
      somatic: raw.components?.somatic ?? false,
      material: raw.components?.material ?? false,
    },
    effectTypes: (raw.effects ?? []).map((e: any) => e.type).filter(Boolean),
    targetingType: raw.targeting?.type ?? '',
    attackType: raw.attackType ?? '',
    arbitrationRequired: raw.arbitrationType !== 'mechanical',
    legacy: raw.legacy ?? false,
  };
}

function readAllSpellFiles(): any[] {
  const spells: any[] = [];
  for (let level = 0; level <= 9; level++) {
    const dir = path.join(SPELLS_DIR, `level-${level}`);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const filePath = path.join(dir, file);
      let raw: any;
      try {
        raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch (err: any) {
        throw new Error(`Failed to parse ${filePath}: ${err.message}`);
      }
      spells.push(raw);
    }
  }
  return spells;
}

// Only run as a script — not during tests
// ESM-compatible entry point detection
const normalisePath = (p: string) => p.replace(/\\/g, '/');
const isMain = normalisePath(process.argv[1] ?? '') === normalisePath(__filename);

if (isMain) {
  const rawSpells = readAllSpellFiles();
  const profiles = rawSpells.map(buildSpellProfile);
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(profiles, null, 2), 'utf-8');
  console.log(`Generated ${profiles.length} spell profiles → ${OUTPUT_PATH}`);
}
