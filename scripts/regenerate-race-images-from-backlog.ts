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
import { spawnSync } from 'child_process';
import { doctorGeminiCDP, generateImage, downloadImage, cleanup } from './image-gen-mcp';

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

type PromptOverride = {
  forcedActivity?: string;
  settingEnvironment?: string;
  attire?: string;
  extraRules?: string[];
  extraNegative?: string[];
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
  'Full body view, head to toe, centered, consistent framing. Visible boots/feet and some ground beneath them.',
  'Include extra margin around the character to prevent edge cropping.',
  'Canvas fill: the background must extend to all four edges (no blank/white margins).',
  'No text. No UI.',
  'Slice-of-life setting: mundane daily life. Not combat. Not heroic posing.',
  'Subject is a common villager or worker (not an adventurer or hero).',
  'Wardrobe: practical civilian clothing suitable for daily work.',
  'No weapons. No armor. No spell effects. No combat stance.',
];

// The backlog includes categories A-E (cropping, slice-of-life, etc). We still track them for
// bookkeeping, but we treat all output as the same target: full-bleed, full-body, slice-of-life,
// civilian attire. This avoids "prompting the failure mode" via negative constraints.
const CATEGORY_PROMPT_ADDONS: Record<Category, string[]> = { A: [], B: [], C: [], D: [], E: [] };

const SLICE_OF_LIFE_ACTIVITIES = [
  'baking bread in a communal oven, dusted with flour',
  'mending a torn cloak with needle and thread by window light',
  'carving wooden utensils at a simple workbench',
  'tending a herb garden',
  'sorting mushrooms on a cloth in a cavern-side camp',
  'repairing a wagon wheel with basic tools',
  'copying ledgers in an office nook with ink-stained fingers',
  'serving stew from a pot at a roadside inn',
  'setting lanterns along a street at dusk',
  'training a working animal (mule/ox) with gentle guidance',
  'stacking firewood neatly under an awning',
  'cleaning armor for someone else (as a job) without wearing any armor',
  'preparing tea for guests',
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
  'sweeping a library aisle',
  "inspecting fish at a market table, choosing today's catch",
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
  fallen_aasimar: [
    // Make wings a subtle presence, not a dramatic pose.
    'Wings: wings must be folded and tucked close to the back. Do NOT spread them. For slice-of-life scenes, prefer wings fully covered by clothing so they are NOT visible.',
  ],
  protector_aasimar: [
    'Wings: wings must be folded and tucked close to the back. Do NOT spread them. Prefer only the tips/edges visible beneath a shawl or cloak.',
  ],
  scourge_aasimar: [
    'Wings: wings must be folded and tucked close to the back. Do NOT spread them. Prefer only the tips/edges visible beneath a shawl or cloak.',
  ],
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

const PROMPT_OVERRIDES: Record<string, Partial<Record<Category, Partial<Record<Gender, PromptOverride>>>>> = {
  fallen_aasimar: {
    // This is a known hard case: the lore text pushes "ruins + dread + wings-out".
    // For slice-of-life (Category B), keep the environment/action readable and mundane.
    B: {
      male: {
        forcedActivity: 'planting herb seedlings into a small soil bed using a simple hand trowel',
        settingEnvironment:
          'A neglected herb garden in a ruined cloister courtyard: damp stone, creeping ivy, simple garden bed, scattered clay pots. Calm, mundane atmosphere.',
        attire:
          'Civilian worker attire for gardening: simple tunic, work apron, sturdy boots, and a heavy shawl/poncho draped over the back that fully covers folded wings. No adventurer gear. No armor. No weapons.',
        extraRules: [
          'Action clarity: show hands actively planting seedlings with a small hand trowel.',
          'Wings must be folded AND fully covered by clothing (wings should not be visible in the image).',
          'Background must extend edge-to-edge with no blank margins.',
        ],
        extraNegative: [
          'visible wings',
          'wings spread wide',
          'hero cape',
          'travel cloak',
          'adventurer outfit',
          'dramatic battle ruins',
          'white margin',
        ],
      },
      female: {
        forcedActivity: 'baking bread using a wooden peel to slide a loaf into a communal oven',
        settingEnvironment:
          'A humble communal kitchen space (stone oven, flour dust, baskets, wooden table). Warm, mundane domestic atmosphere.',
        attire:
          'Civilian worker attire for baking: simple dress or tunic, work apron, sturdy boots, and a heavy shawl/poncho draped over the back that fully covers folded wings. No adventurer gear. No armor. No weapons.',
        extraRules: [
          'Action clarity: show the subject actively using a wooden peel with a loaf at the oven.',
          'Show full body head-to-toe with visible boots/feet and floor beneath. No cropping.',
          'Wings must be folded AND fully covered by clothing (wings should not be visible in the image).',
          'Background must extend edge-to-edge with no blank margins.',
        ],
        extraNegative: [
          'visible wings',
          'wings spread wide',
          'hero cape',
          'travel cloak',
          'adventurer outfit',
          'dramatic ruins',
          'white margin',
          'cropped feet',
        ],
      },
    },
  },
  protector_aasimar: {
    B: {
      female: {
        forcedActivity: 'mending a torn cloak with needle and thread by window light',
        settingEnvironment:
          'A modest sunlit room with a simple wooden table near a large window; sewing basket, folded cloth, and a quiet view of a small town outside. Calm, mundane domestic atmosphere.',
        attire:
          'Civilian attire for sewing: simple dress, work apron, sturdy shoes. A light shawl/mantle draped over the back so folded wings are mostly concealed; if visible at all, only small feather tips may peek out. No adventurer gear. No armor. No weapons.',
        extraRules: [
          'Action clarity: show hands actively mending fabric with needle and thread (thread visible).',
          'Wings must be folded and tucked; do not show a wide wing span.',
          'Background must extend edge-to-edge with no blank margins anywhere.',
        ],
        extraNegative: [
          'white margin',
          'blank border',
          'portrait with side borders',
          'letterboxed',
          'visible full wingspan',
          'wings spread wide',
          'heroic pose',
          'adventurer outfit',
        ],
      },
    },
  },
  scourge_aasimar: {
    B: {
      male: {
        forcedActivity: 'preparing tea for guests at a monastery refectory table (kettle, cups, steam visible)',
        settingEnvironment:
          'An austere monastery refectory: stone walls, wooden table, simple ceramics, warm morning light through a narrow window. Calm, mundane atmosphere.',
        attire:
          'Civilian monastic attire: simple robe or tunic with sash, practical shoes, and a shawl/cloak draped over the back that fully covers folded wings (wings should not be visible). No mask. No armor. No weapons.',
        extraRules: [
          'Action clarity: show hands actively pouring or arranging tea (kettle and cups clearly visible).',
          'No mask or face covering. Eyes visible.',
          'Wings must be folded AND fully covered by clothing (wings should not be visible in the image).',
          'No glowing aura, sparks, or spell-like effects. Keep it mundane.',
        ],
        extraNegative: [
          'ceremonial mask',
          'mask',
          'face covering',
          'visible wings',
          'wings spread wide',
          'glowing aura',
          'sparks',
          'weapons',
          'armor',
          'desert canyon',
          'volcanic landscape',
          'battlefield',
          'heroic pose',
        ],
      },
      female: {
        forcedActivity: 'weaving a small basket from reeds at a simple work table (hands weaving clearly visible)',
        settingEnvironment:
          'A quiet workshop corner inside a monastery or village hall: simple bench, reed bundles, warm light, calm mundane atmosphere.',
        attire:
          'Civilian worker attire for weaving: simple dress or tunic, apron, practical shoes, and a shawl/cloak draped over the back that fully covers folded wings (wings should not be visible). No mask. No armor. No weapons.',
        extraRules: [
          'Action clarity: show hands actively weaving reeds into a basket (woven pattern visible).',
          'No mask or face covering. Eyes visible.',
          'Wings must be folded AND fully covered by clothing (wings should not be visible in the image).',
          'No glowing aura, sparks, or spell-like effects. Keep it mundane.',
        ],
        extraNegative: [
          'ceremonial mask',
          'mask',
          'face covering',
          'visible wings',
          'wings spread wide',
          'glowing aura',
          'sparks',
          'weapons',
          'armor',
          'desert canyon',
          'volcanic landscape',
          'battlefield',
          'heroic pose',
        ],
      },
    },
  },
  astral_elf: {
    B: {
      male: {
        forcedActivity: 'polishing glassware behind a tavern counter (rag and glass clearly visible)',
        settingEnvironment:
          'A cozy tavern or tea house interior: wooden counter, shelves with bottles and cups, warm lamplight. Mundane, grounded atmosphere.',
        attire:
          'Civilian attire: simple shirt, vest or apron, sturdy boots. Subtle astral accent only (small star-shaped pin or faint embroidered motif). No robes, no ceremonial armor, no weapons.',
        extraRules: [
          'Action clarity: show hands actively polishing a glass with a cloth.',
          'No spell effects, no floating crystals, no cosmic void background.',
        ],
        extraNegative: [
          'astral plane',
          'cosmic void',
          'floating islands',
          'crystalline citadel',
          'weapons',
          'armor',
          'spell effects',
          'heroic pose',
        ],
      },
      female: {
        forcedActivity: 'painting simple signs for a shopfront (brush and painted lettering board visible, no text in final image)',
        settingEnvironment:
          'A small market-side workshop: wooden board, paint jars, morning daylight from an open door. Mundane, grounded atmosphere.',
        attire:
          'Civilian artisan attire: simple dress or tunic, work apron, sturdy boots. Subtle astral accent only (small star charm or faint embroidery). No robes, no weapons, no armor.',
        extraRules: [
          'Action clarity: show hands actively painting a decorative pattern on a wooden sign board (avoid readable letters).',
          'No spell effects, no floating crystals, no cosmic void background.',
        ],
        extraNegative: [
          'readable text',
          'letters',
          'words',
          'astral plane',
          'cosmic void',
          'floating islands',
          'crystalline citadel',
          'weapons',
          'armor',
          'spell effects',
          'heroic pose',
        ],
      },
    },
  },
  abyssal_tiefling: {
    B: {
      male: {
        forcedActivity: 'packing a merchant crate with careful inventory (hands placing items into a crate; ledger nearby)',
        settingEnvironment:
          'A cluttered but mundane warehouse corner: wooden crates, rope, labels, shelves. Daylight through a high window. Grounded atmosphere.',
        attire:
          'Civilian dock/warehouse worker attire: simple shirt, work vest or apron, sturdy boots. No armor. No weapons.',
        extraRules: [
          'Action clarity: show hands actively packing items into a crate; a small ledger or checklist nearby.',
          'No heroic posing; posture should look like real work.',
        ],
        extraNegative: [
          'weapons',
          'armor',
          'combat stance',
          'heroic pose',
          'fancy adventurer outfit',
        ],
      },
      female: {
        forcedActivity: 'sorting mail and parchments at a courier desk (hands sorting clearly visible)',
        settingEnvironment:
          'A small courier station: wooden desk, stacks of letters, wax seals, simple shelves. Warm daylight. Mundane atmosphere.',
        attire:
          'Civilian courier clerk attire: simple tunic or dress with apron, practical shoes. No armor. No weapons.',
        extraRules: [
          'Action clarity: show hands actively sorting letters/parchments into neat stacks.',
          'Make the character clearly female while staying non-sexualized (silhouette + face + hair styling).',
        ],
        extraNegative: [
          'weapons',
          'armor',
          'combat stance',
          'heroic pose',
          'fancy adventurer outfit',
        ],
      },
    },
  },
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
    const key = normalizeActivityKey(a);
    if (!used.has(key)) return a;
  }
  // Fallback: if exhausted, just cycle (but keep deterministic output).
  return SLICE_OF_LIFE_ACTIVITIES[Math.floor(Math.random() * SLICE_OF_LIFE_ACTIVITIES.length)];
}

function normalizeActivityKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.]+$/g, '');
}

function loadUsedActivitiesFromReport(): Set<string> {
  const used = new Set<string>();
  if (!fs.existsSync(ACTIVITIES_REPORT_PATH)) return used;
  try {
    const json = JSON.parse(fs.readFileSync(ACTIVITIES_REPORT_PATH, 'utf8')) as any;
    const roles = Array.isArray(json.uniqueRoles) ? json.uniqueRoles : [];
    for (const r of roles) used.add(normalizeActivityKey(r));
  } catch {
    // ignore
  }
  return used;
}

function runSliceOfLifeReport(): void {
  // Keep the report up-to-date after each generated image so manual review can
  // see which activity was used per race.
  const cmd = 'npx tsx scripts/audits/list-slice-of-life-settings.ts';
  const res = spawnSync(cmd, { shell: true, stdio: 'inherit' });
  if (res.status !== 0) {
    console.warn(`[slice-of-life] Warning: failed to update report (exit ${res.status ?? 'unknown'})`);
  }
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
  const defaultAttire = typeof lore.typicalAttire === 'string' ? lore.typicalAttire : '';
  const env = typeof lore.typicalEnvironment === 'string' ? lore.typicalEnvironment : '';
  const dwelling = typeof lore.typicalDwelling === 'string' ? lore.typicalDwelling : '';

  const lines: string[] = [];
  let activityUsed: string | undefined;

  const override: PromptOverride | undefined = PROMPT_OVERRIDES[race.id]?.[category]?.[gender] as PromptOverride | undefined;

  // All race images should be slice-of-life. Category B is the main driver for this, but
  // we keep the "unique activity" invariant for every regenerated image so the dataset
  // doesn't converge on the same handful of chores/settings.
  activityUsed = override?.forcedActivity || pickUniqueActivity(usedActivities);

  const idOverride = RACE_OVERRIDES[race.id];

  // Emily-style: structured spec + explicit negative constraints.
  // Gemini accepts plain text; we embed JSON to keep constraints separable.
  // We intentionally avoid adding a large negative prompt list here: in practice it often
  // reduces compliance ("don't think of elephants") and can increase template-y outputs.

  const spec = {
    output: { count: 1 },
    subject: {
      race: title,
      gender,
      notes: 'Common villager/worker; not an adventurer or hero.',
    },
    composition: {
      shot: 'full body',
      framing: 'head-to-toe centered with margin',
      background: 'background fills edge-to-edge (no blank margins)',
    },
    style: {
      medium: 'high fantasy D&D 5e canon illustration',
      lighting: 'naturalistic, dramatic but grounded',
      detail: 'high',
    },
    setting: {
      mode: 'slice-of-life',
      action: activityUsed ?? '',
      environment: override?.settingEnvironment || [env, dwelling].filter(Boolean).join(' '),
    },
    lore: {
      physicalAppearance,
      attire: override?.attire || defaultAttire,
    },
    constraints: {
      rules: [
        ...STYLE_BASE,
        ...(idOverride ?? []),
        ...(override?.extraRules ?? []),
      ],
    },
  };

  lines.push('Follow this spec as strictly as possible.');
  lines.push('Generate ONE image.');
  if (activityUsed) lines.push(`Slice-of-life action: ${activityUsed}.`);
  lines.push('SPEC_JSON:');
  lines.push(JSON.stringify(spec, null, 2));

  // Add lore context if available.
  if (physicalAppearance) lines.push(`Physical appearance: ${physicalAppearance}`);
  if (override?.attire || defaultAttire) lines.push(`Attire: ${override?.attire || defaultAttire}`);
  const computedEnv = override?.settingEnvironment || [env, dwelling].filter(Boolean).join(' ');
  if (computedEnv) lines.push(`Setting: ${computedEnv}`);

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
  const out: { category?: Category; limit: number | null; dryRun: boolean; races: string[]; genders: Gender[] } = {
    limit: null,
    dryRun: false,
    races: [],
    genders: [],
  };
  let retries: number | null = null;
  let cooldownMs: number | null = null;
  let skipWrittenAfter: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--category' && argv[i + 1]) out.category = argv[++i] as Category;
    else if (a.startsWith('--category=')) out.category = a.split('=', 2)[1] as Category;
    else if (a === '--limit' && argv[i + 1]) out.limit = Number(argv[++i]);
    else if (a.startsWith('--limit=')) out.limit = Number(a.split('=', 2)[1]);
    else if (a === '--race' && argv[i + 1]) out.races.push(String(argv[++i]));
    else if (a.startsWith('--race=')) out.races.push(a.split('=', 2)[1]);
    else if (a === '--gender' && argv[i + 1]) out.genders.push(String(argv[++i]) as Gender);
    else if (a.startsWith('--gender=')) out.genders.push(a.split('=', 2)[1] as Gender);
    else if (a === '--retries' && argv[i + 1]) retries = Number(argv[++i]);
    else if (a.startsWith('--retries=')) retries = Number(a.split('=', 2)[1]);
    else if (a === '--cooldown-ms' && argv[i + 1]) cooldownMs = Number(argv[++i]);
    else if (a.startsWith('--cooldown-ms=')) cooldownMs = Number(a.split('=', 2)[1]);
    else if (a === '--skip-written-after' && argv[i + 1]) skipWrittenAfter = String(argv[++i]);
    else if (a.startsWith('--skip-written-after=')) skipWrittenAfter = a.split('=', 2)[1];
  }
  return { ...out, retries, cooldownMs, skipWrittenAfter };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const retries = Number.isFinite((args as any).retries) && (args as any).retries >= 0 ? (args as any).retries : 8;
  const cooldown = Number.isFinite((args as any).cooldownMs) && (args as any).cooldownMs >= 0 ? (args as any).cooldownMs : 4500;
  const skipWrittenAfterRaw = String((args as any).skipWrittenAfter || '').trim();
  const skipWrittenAfter = skipWrittenAfterRaw ? Date.parse(skipWrittenAfterRaw) : NaN;

  // Ensure Gemini is reachable and the CDP browser session is ready before running a long batch.
  const doctor = await doctorGeminiCDP({
    cdpUrl: process.env.IMAGE_GEN_CDP_URL || 'http://localhost:9222',
    attemptConsent: true,
    openIfMissing: true,
  });
  if (!doctor.ok) {
    throw new Error(`[regen-backlog] Gemini not ready (${doctor.stage}): ${doctor.message}`);
  }

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

  const filteredByRace = args.races.length > 0 ? work.filter((w) => args.races.includes(w.race.id)) : work;
  const filteredByGender = args.genders.length > 0 ? filteredByRace.filter((w) => args.genders.includes(w.gender)) : filteredByRace;
  const limited = args.limit ? filteredByGender.slice(0, args.limit) : filteredByGender;
  console.log(`[regen-backlog] Planned regenerations: ${limited.length}${args.limit ? ` (limited from ${work.length})` : ''}`);

  for (const w of limited) {
    const assetRel = w.gender === 'male' ? w.race.male : w.race.female;
    if (!assetRel) continue;
    const absPath = resolvePublicAsset(assetRel);

    if (Number.isFinite(skipWrittenAfter) && fs.existsSync(absPath)) {
      const mtime = fs.statSync(absPath).mtimeMs;
      if (mtime >= skipWrittenAfter) {
        console.log(`[regen] Skip (already regenerated): ${w.race.id} (${w.gender}) -> ${assetRel}`);
        continue;
      }
    }

    const { prompt, activityUsed } = buildPrompt({
      category: w.category,
      race: w.race,
      gender: w.gender,
      glossary: w.glossary,
      usedActivities,
    });

    if (args.dryRun) {
      console.log(`[dry-run] ${w.category} ${w.race.id} (${w.gender}) -> ${assetRel}${activityUsed ? ` | activity="${activityUsed}"` : ''}`);
      continue;
    }

    console.log(`[regen] ${w.category} ${w.race.id} (${w.gender}) -> ${assetRel}`);

    let ok = false;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) {
        console.log(`[regen] Retry ${attempt}/${retries} for ${w.race.id} (${w.gender})`);
      }

      const gen = await generateImage(prompt);
      if (!gen?.success) {
        const msg = String(gen?.message || 'unknown error');
        console.warn(`[regen] Image generation failed for ${w.race.id} (${w.gender}): ${msg}`);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, cooldown));
          continue;
        }
        throw new Error(`[regen] Image generation failed for ${w.race.id} (${w.gender}) after ${retries + 1} attempts: ${msg}`);
      }
      const dl = await downloadImage(absPath);
      if (!dl?.success) {
        throw new Error(`[regen] Image download failed for ${w.race.id} (${w.gender}): ${dl?.message || 'unknown error'}`);
      }

      // Reject Gemini "letterboxing" / blank margin outputs and try again.
      const detector = `python scripts/audits/detect-blank-margins.py "${absPath}"`;
      const det = spawnSync(detector, { shell: true, stdio: 'pipe' });
      const detText = String(det.stdout || '').trim();
      if (det.status === 2) {
        console.warn(`[regen] Blank margins detected for ${w.race.id} (${w.gender}). Will retry.`);
        if (detText) console.warn(`[regen] detect-blank-margins: ${detText}`);
        await new Promise((r) => setTimeout(r, cooldown));
        continue;
      }
      if (det.status === 1) {
        console.warn(`[regen] Warning: blank-margin detector errored; accepting image. Details: ${String(det.stderr || '').trim()}`);
      }

      ok = true;
      break;
    }

    if (!ok) {
      throw new Error(`[regen] Exhausted retries for ${w.race.id} (${w.gender}); still getting blank margins.`);
    }

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

    if (activityUsed) usedActivities.add(normalizeActivityKey(activityUsed));
    runSliceOfLifeReport();

    // Gentle cooldown to reduce rate-limits / partial renders (Gemini is sensitive to rapid-fire requests).
    await new Promise((r) => setTimeout(r, cooldown));
  }

  await cleanup();
}

main().catch(async (err) => {
  console.error(err);
  try { await cleanup(); } catch { /* ignore cleanup errors */ }
  process.exit(1);
});
