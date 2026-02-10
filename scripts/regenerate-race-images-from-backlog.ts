#!/usr/bin/env npx tsx
/**
 * Regenerate race portrait images from a curated backlog file.
 *
 * This is intended for manual quality passes, not only "missing/duplicate" repair.
 *
 * Usage (Windows, after `npm run mcp:chrome` and logging into Gemini):
 *   cmd.exe /c "set IMAGE_GEN_USE_CDP=1&& set IMAGE_GEN_GEMINI_IMAGE_TIMEOUT_MS=240000&& npx tsx scripts/regenerate-race-images-from-backlog.ts"
 *
 * Options:
 *   --category A|B|C|D|E     Only run a specific category
 *   --limit N               Limit how many (race,gender) images to regenerate this run
 *   --dry-run               Print what would be regenerated
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { generateImage, downloadImage, cleanup } from './image-gen-mcp';

type Gender = 'male' | 'female';
type Category = 'A' | 'B' | 'C' | 'D' | 'E';

type BacklogItem = {
  category: Category;
  raceId?: string;
  raceName?: string;
  genders: Gender[];
  reason?: string;
};

type RaceInfo = {
  id: string;
  name: string;
  description?: string;
  baseRace?: string;
  male?: string;
  female?: string;
};

const ROOT = process.cwd();
const RACES_TS_DIR = path.join(ROOT, 'src', 'data', 'races');
const GLOSSARY_RACES_DIR = path.join(ROOT, 'public', 'data', 'glossary', 'entries', 'races');
const PUBLIC_DIR = path.join(ROOT, 'public');
const BACKLOG_PATH = path.join(ROOT, 'docs', 'portraits', 'race_portrait_regen_backlog.json');
const STATUS_PATH = path.join(ROOT, 'public', 'assets', 'images', 'races', 'race-image-status.json');
const ACTIVITIES_REPORT_PATH = path.join(ROOT, 'scripts', 'audits', 'slice-of-life-settings.json');

const STYLE_BASE = [
  'High fantasy Dungeons and Dragons character illustration.',
  'Full body view, head to toe, centered, consistent framing.',
  'No text. No UI. No watermark.',
];

const CATEGORY_PROMPT_ADDONS: Record<Category, string[]> = {
  A: [
    'Critical: show the entire character head-to-toe with visible feet and some ground beneath the boots.',
    'Avoid cropping or cutting off any part of the body (no cut-off at hips/legs).',
    'Include a bit of empty margin around the figure to prevent edge cropping.',
  ],
  B: [
    'Slice-of-life setting: mundane daily life. Not combat. Not heroic posing.',
    'Subject is a common villager or worker (not an adventurer or hero).',
    'No weapons. No armor. No spell effects. No combat stance.',
    'Important: use a slice-of-life activity that has NOT been used before for any other race portrait in this dataset.',
  ],
  C: [
    'Focus on correcting the specific critique for this race (see notes).',
    'Keep it believable and grounded in the race look, not a caricature.',
  ],
  D: [
    'No border. No white frame. No white edge. Background should fill the entire canvas to the edges.',
  ],
  E: [
    'Generate a clean, canonical portrait for this race with the standard guidelines.',
  ],
};

const SLICE_OF_LIFE_ACTIVITIES = [
  'baking bread in a communal oven, dusted with flour',
  'mending a torn cloak with needle and thread by window light',
  'carving wooden utensils at a simple workbench',
  'tending a herb garden, bundling fresh sprigs with twine',
  'sorting mushrooms on a cloth in a cavern-side camp',
  'repairing a wagon wheel with basic tools',
  'copying ledgers in an office nook with ink-stained fingers',
  'serving stew from a pot at a roadside inn',
  'setting lanterns along a street at dusk',
  'training a working animal (mule/ox) with gentle guidance',
  'stacking firewood neatly under an awning',
  'cleaning armor for someone else (as a job) without wearing any armor',
  'preparing tea and arranging cups for guests',
  'weaving a small basket from reeds',
  'polishing glassware behind a tavern counter',
  'painting simple signs for a shopfront',
  'packing a merchant crate with careful inventory',
  'sorting mail/parchments in a courier station',
  'stitching a patchwork quilt',
  'sharpening kitchen knives in a modest kitchen',
  'measuring cloth at a tailor stall',
  'mixing dyes in small jars at a craft table',
  'setting out offerings at a shrine (non-magical, calm)',
  'sweeping a library aisle and re-shelving books',
  'inspecting fish at a market table, choosing today’s catch',
  'hanging herbs to dry from rafters',
  'tending a forge as a helper, carrying tongs and coal (no armor, no weapons)',
  'etching runes into a stone tile as an artisan',
  'carrying water buckets from a well',
  'feeding chickens in a farmyard',
  'practicing calligraphy, testing brush strokes on scrap paper',
  'repairing boots with leather scraps',
  'arranging flowers at a stall',
  'preparing travel rations (wrapping bread, cheese, fruit)',
  'tidying a small altar, lighting candles',
  'haggling politely with a vendor, holding a coin purse',
  'rolling barrels in a cellar',
  'fletching arrows as a tradesperson (no combat, no armor)',
  'teaching a child to read (quiet domestic scene)',
  'delivering parcels in a busy street',
  'washing hands at a basin after work (grounded realism)',
];

const RACE_OVERRIDES: Record<string, string[]> = {
  // Category C guidance.
  giff: [
    'Appearance correction: clearly hippopotamus-like facial structure and body shape, but not an exaggerated cartoon.',
    'Proportions: strong barrel chest, thick neck, heavy jaw; keep it natural.',
  ],
  hadozee: [
    'Appearance correction: clearly simian/ape-like (primate), not rodent-like. Emphasize primate facial structure, hands, posture.',
  ],
  minotaur: [
    'Appearance correction: reduce head size; keep head proportional to body.',
  ],
  centaur: [
    'Composition correction: the humanoid torso should emerge anatomically from the horse body at the withers, properly aligned; avoid a floating/centered human body.',
  ],
  kobold: [
    'Gender readability: make the female kobold clearly readable via facial structure, posture, clothing silhouette (non-sexualized), and styling.',
  ],
  hearthkeeper_halfling: [
    'Background correction: avoid duplicated/cloned faces or repeated copies of the character in the background.',
  ],
  changeling: [
    'Creative direction: depict the changeling mid-transformation in a slice-of-life scene (not combat).',
    'Example: looking into a mirror or studying a portrait, with subtle facial features shifting.',
  ],
  forgeborn_human: [
    'Appearance correction: human skin tones (do not use blue skin). Emphasize a glowing dragonmark sigil rather than unusual skin color.',
  ],
  half_elf_wood: [
    'Appearance correction: half-elf skin should be within human-to-elf range; avoid fully green skin. If any fey/wood tint exists, keep it subtle and natural.',
  ],
};

function sha256File(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function resolvePublicAsset(assetPath: string): string {
  const p = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
  return path.join(PUBLIC_DIR, p);
}

function parseRaceTs(tsContent: string): RaceInfo | null {
  const id = tsContent.match(/id:\s*['"]([^'"]+)['"]/i)?.[1];
  const name = tsContent.match(/name:\s*['"]([^'"]+)['"]/i)?.[1];
  const baseRace = tsContent.match(/baseRace:\s*['"]([^'"]+)['"]/i)?.[1];
  const description = tsContent.match(/description:\s*\n?\s*['"]([\s\S]*?)['"],\s*\n/i)?.[1]?.replace(/\s+/g, ' ').trim();
  const male = tsContent.match(/maleIllustrationPath:\s*['"]([^'"]+)['"]/i)?.[1];
  const female = tsContent.match(/femaleIllustrationPath:\s*['"]([^'"]+)['"]/i)?.[1];
  if (!id || !name) return null;
  return { id, name, baseRace, description, male, female };
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadGlossaryIndex(): Map<string, any> {
  const index = new Map<string, any>();
  const walk = (dir: string) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && ent.name.endsWith('.json')) {
        try {
          const json = JSON.parse(fs.readFileSync(full, 'utf8'));
          if (json && typeof json.id === 'string') index.set(json.id, json);
        } catch {
          // ignore
        }
      }
    }
  };
  if (fs.existsSync(GLOSSARY_RACES_DIR)) walk(GLOSSARY_RACES_DIR);
  return index;
}

function readBacklog(): BacklogItem[] {
  const raw = JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf8')) as { items: BacklogItem[] };
  return Array.isArray(raw.items) ? raw.items : [];
}

function loadAllRaces(): RaceInfo[] {
  const files = fs.readdirSync(RACES_TS_DIR).filter((f) => f.endsWith('.ts') && f !== 'index.ts' && f !== 'raceGroups.ts');
  const races: RaceInfo[] = [];
  for (const f of files) {
    const content = fs.readFileSync(path.join(RACES_TS_DIR, f), 'utf8');
    const parsed = parseRaceTs(content);
    if (!parsed) continue;
    if (!parsed.male && !parsed.female) continue;
    races.push(parsed);
  }
  return races;
}

function pickUniqueActivity(used: Set<string>): string {
  for (const a of SLICE_OF_LIFE_ACTIVITIES) {
    const key = a.toLowerCase().trim();
    if (!used.has(key)) {
      used.add(key);
      return a;
    }
  }
  // Fallback: if exhausted, just cycle (but keep deterministic output).
  return SLICE_OF_LIFE_ACTIVITIES[Math.floor(Math.random() * SLICE_OF_LIFE_ACTIVITIES.length)];
}

function loadUsedActivitiesFromReport(): Set<string> {
  const used = new Set<string>();
  if (!fs.existsSync(ACTIVITIES_REPORT_PATH)) return used;
  try {
    const json = JSON.parse(fs.readFileSync(ACTIVITIES_REPORT_PATH, 'utf8')) as any;
    const roles = Array.isArray(json.uniqueRoles) ? json.uniqueRoles : [];
    for (const r of roles) used.add(String(r).toLowerCase().trim());
  } catch {
    // ignore
  }
  return used;
}

function buildPrompt(params: {
  category: Category;
  race: RaceInfo;
  gender: Gender;
  glossary?: any;
  usedActivities: Set<string>;
}): { prompt: string; activityUsed?: string } {
  const { category, race, gender, glossary, usedActivities } = params;

  const title = (glossary?.title as string | undefined) || race.name;
  const lore = glossary?.lore || {};
  const physicalAppearance = typeof lore.physicalAppearance === 'string' ? lore.physicalAppearance : '';
  const attire = typeof lore.typicalAttire === 'string' ? lore.typicalAttire : '';
  const env = typeof lore.typicalEnvironment === 'string' ? lore.typicalEnvironment : '';
  const dwelling = typeof lore.typicalDwelling === 'string' ? lore.typicalDwelling : '';

  const lines: string[] = [];
  lines.push(...STYLE_BASE);
  lines.push(`Generate ONE image.`);
  lines.push(`Subject: a ${gender} ${title}.`);
  lines.push(...CATEGORY_PROMPT_ADDONS[category]);

  let activityUsed: string | undefined;
  if (category === 'B') {
    activityUsed = pickUniqueActivity(usedActivities);
    lines.push(`Slice-of-life action: ${activityUsed}.`);
  }

  const idOverride = RACE_OVERRIDES[race.id];
  if (idOverride) lines.push(...idOverride);

  // Add lore context if available.
  if (physicalAppearance) lines.push(`Physical appearance: ${physicalAppearance}`);
  if (attire) lines.push(`Attire: ${attire}`);
  if (env || dwelling) lines.push(`Setting: ${[env, dwelling].filter(Boolean).join(' ')}`);

  // Category D: explicitly mention full bleed background.
  if (category === 'D') {
    lines.push('Ensure there is no empty/white margin; background must extend to all edges.');
  }

  return { prompt: lines.join('\n'), activityUsed };
}

function updateStatus(entry: any) {
  const dir = path.dirname(STATUS_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const existing = fs.existsSync(STATUS_PATH) ? JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8')) : { entries: [] };
  const entries: any[] = Array.isArray(existing.entries) ? existing.entries : [];
  entries.unshift(entry);
  fs.writeFileSync(STATUS_PATH, JSON.stringify({ entries }, null, 2) + '\n', 'utf8');
}

function parseArgs(argv: string[]) {
  const out: { category?: Category; limit: number | null; dryRun: boolean } = { limit: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--category' && argv[i + 1]) out.category = argv[++i] as Category;
    else if (a.startsWith('--category=')) out.category = a.split('=', 2)[1] as Category;
    else if (a === '--limit' && argv[i + 1]) out.limit = Number(argv[++i]);
    else if (a.startsWith('--limit=')) out.limit = Number(a.split('=', 2)[1]);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const backlog = readBacklog().filter((x) => (args.category ? x.category === args.category : true));
  const races = loadAllRaces();
  const glossaryIndex = loadGlossaryIndex();
  const usedActivities = loadUsedActivitiesFromReport();

  const byId = new Map(races.map((r) => [r.id, r] as const));
  const byName = new Map(races.map((r) => [normalizeName(r.name), r] as const));

  const work: Array<{ category: Category; race: RaceInfo; gender: Gender; glossary?: any; reason?: string }> = [];

  for (const item of backlog) {
    const race =
      (item.raceId && byId.get(item.raceId)) ||
      (item.raceName && (byId.get(item.raceName) || byName.get(normalizeName(item.raceName))));

    if (!race) {
      console.warn(`[regen-backlog] Could not resolve race: ${item.raceId || item.raceName}`);
      continue;
    }

    for (const gender of item.genders) {
      work.push({ category: item.category, race, gender, glossary: glossaryIndex.get(race.id), reason: item.reason });
    }
  }

  const limited = args.limit ? work.slice(0, args.limit) : work;
  console.log(`[regen-backlog] Planned regenerations: ${limited.length}${args.limit ? ` (limited from ${work.length})` : ''}`);

  for (const w of limited) {
    const assetRel = w.gender === 'male' ? w.race.male : w.race.female;
    if (!assetRel) continue;
    const absPath = resolvePublicAsset(assetRel);

    const { prompt, activityUsed } = buildPrompt({
      category: w.category,
      race: w.race,
      gender: w.gender,
      glossary: w.glossary,
      usedActivities,
    });

    if (args.dryRun) {
      console.log(`[dry-run] ${w.category} ${w.race.id} (${w.gender}) -> ${assetRel}`);
      continue;
    }

    console.log(`[regen] ${w.category} ${w.race.id} (${w.gender}) -> ${assetRel}`);
    await generateImage(prompt);
    await downloadImage(absPath);

    updateStatus({
      race: w.race.id,
      gender: w.gender,
      category: w.category,
      reason: w.reason ?? '',
      activity: activityUsed ?? '',
      prompt,
      provider: 'gemini',
      imagePath: absPath,
      sha256: fs.existsSync(absPath) ? sha256File(absPath) : '',
      downloadedAt: new Date().toISOString(),
    });
  }

  await cleanup();
}

main().catch(async (err) => {
  console.error(err);
  try { await cleanup(); } catch { /* ignore cleanup errors */ }
  process.exit(1);
});
