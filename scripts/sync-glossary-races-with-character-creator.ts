#!/usr/bin/env npx tsx
/**
 * Sync Glossary race grouping + images to match Character Creator.
 *
 * What it does:
 * - Normalizes glossary race IDs to match Character Creator IDs (underscores, goliath ancestry ids, etc).
 * - Removes legacy `imageUrl` from race glossary entries (renderer prefers male/female if present).
 * - Sets `maleImageUrl` / `femaleImageUrl` in glossary entries from Character Creator race visuals.
 * - Regenerates `public/data/glossary/index/character_races.json` so its grouping/membership matches
 *   Character Creator grouping (`baseRace || id`) + `src/data/races/raceGroups.ts` metadata.
 *
 * Usage:
 * - npx tsx scripts/sync-glossary-races-with-character-creator.ts
 */

import fs from 'fs';
import path from 'path';
import { getRaceGroupById } from '../src/data/races/raceGroups';

interface CharacterCreatorRaceInfo {
  id: string;
  name: string;
  baseRace?: string;
  maleIllustrationPath?: string;
  femaleIllustrationPath?: string;
}

type JsonObj = Record<string, unknown>;

const ROOT = process.cwd();
const RACES_TS_DIR = path.join(ROOT, 'src', 'data', 'races');
const GLOSSARY_RACES_DIR = path.join(ROOT, 'public', 'data', 'glossary', 'entries', 'races');
const GLOSSARY_RACE_INDEX_PATH = path.join(ROOT, 'public', 'data', 'glossary', 'index', 'character_races.json');

// Forced-choice base families (variants-only): keep as helpers, but do not treat as selectable races.
const NON_SELECTABLE_BASE_RACE_IDS = new Set<string>(['elf', 'tiefling', 'goliath', 'eladrin', 'dragonborn']);

// Mirror the Aasimar approach: do not keep leaf glossary entries for forced-choice base races.
// We keep only the variants under their group.
const GLOSSARY_BASE_LEAF_IDS_TO_REMOVE = new Set<string>(['elf', 'tiefling', 'goliath', 'eladrin', 'dragonborn']);

// ID normalization decisions (Glossary -> Character Creator canonical IDs).
const ID_RENAMES: Record<string, string> = {
  // Hyphenated IDs
  'half-elf': 'half_elf',
  'half-orc': 'half_orc',
  'yuan-ti': 'yuan_ti',

  // Goliath ancestry entries (glossary used generic ancestry ids)
  cloud_giant: 'cloud_giant_goliath',
  fire_giant: 'fire_giant_goliath',
  frost_giant: 'frost_giant_goliath',
  hill_giant: 'hill_giant_goliath',
  stone_giant: 'stone_giant_goliath',
  storm_giant: 'storm_giant_goliath',
};

function readJson(filePath: string): JsonObj {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonObj;
}

function writeJsonPretty(filePath: string, data: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function walkJsonFiles(dirPath: string): string[] {
  const out: string[] = [];
  const stack: string[] = [dirPath];
  while (stack.length) {
    const curr = stack.pop()!;
    for (const ent of fs.readdirSync(curr, { withFileTypes: true })) {
      const full = path.join(curr, ent.name);
      if (ent.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (ent.isFile() && ent.name.endsWith('.json')) out.push(full);
    }
  }
  return out.sort();
}

function extractFirstSentence(text: string, maxLen = 140): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'No excerpt available.';
  const idx = cleaned.search(/[.!?]\s/);
  const sentence = idx === -1 ? cleaned : cleaned.slice(0, idx + 1);
  if (sentence.length <= maxLen) return sentence;
  return sentence.slice(0, maxLen - 1).trimEnd() + '…';
}

function resolvePublicAssetUrlFromCcPath(ccPath: string | undefined): string | undefined {
  if (!ccPath) return undefined;
  // CC paths are typically like: "assets/images/races/Foo.png"
  return ccPath.startsWith('/') ? ccPath : `/${ccPath}`;
}

function getCharacterCreatorRacesFromFiles(): CharacterCreatorRaceInfo[] {
  const files = fs.readdirSync(RACES_TS_DIR).filter((file) => {
    return file.endsWith('.ts') && file !== 'index.ts' && file !== 'raceGroups.ts';
  });

  const races: CharacterCreatorRaceInfo[] = [];

  for (const file of files) {
    const filePath = path.join(RACES_TS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');

    const exportMatches = [...content.matchAll(/export\s+const\s+(\w+_DATA):\s*Race\s*=\s*\{/g)];
    if (exportMatches.length === 0) continue;

    for (let i = 0; i < exportMatches.length; i++) {
      const start = exportMatches[i].index!;
      const end = exportMatches[i + 1]?.index ?? content.length;
      const block = content.slice(start, end);

      const hasTraits = block.includes('traits:');
      if (!hasTraits) continue;

      const idMatch = block.match(/id:\s*['"]([^'"]+)['"]/);
      const nameMatch = block.match(/name:\s*['"]([^'"]+)['"]/);
      if (!idMatch || !nameMatch) continue;

      const id = idMatch[1];
      if (NON_SELECTABLE_BASE_RACE_IDS.has(id)) continue;

      const baseRaceMatch = block.match(/baseRace:\s*['"]([^'"]+)['"]/);
      const malePathMatch = block.match(/maleIllustrationPath:\s*['"]([^'"]+)['"]/);
      const femalePathMatch = block.match(/femaleIllustrationPath:\s*['"]([^'"]+)['"]/);

      races.push({
        id,
        name: nameMatch[1],
        baseRace: baseRaceMatch?.[1],
        maleIllustrationPath: malePathMatch?.[1],
        femaleIllustrationPath: femalePathMatch?.[1],
      });
    }
  }

  // De-dupe by id (in case of multiple matches)
  const uniq = new Map<string, CharacterCreatorRaceInfo>();
  for (const r of races) uniq.set(r.id, r);
  return [...uniq.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function renameGlossaryRaceFilesIfNeeded() {
  const jsonFiles = walkJsonFiles(GLOSSARY_RACES_DIR);

  for (const filePath of jsonFiles) {
    const baseName = path.basename(filePath, '.json');
    const renamedId = ID_RENAMES[baseName];
    if (!renamedId) continue;

    const nextPath = path.join(path.dirname(filePath), `${renamedId}.json`);
    if (filePath === nextPath) continue;

    if (fs.existsSync(nextPath)) {
      // Prefer not to clobber; this indicates the rename already happened or a conflict exists.
      // Leave as-is and rely on JSON id normalization.
      continue;
    }

    fs.renameSync(filePath, nextPath);
  }
}

function normalizeGlossaryRaceEntries(ccById: Map<string, CharacterCreatorRaceInfo>) {
  const jsonFiles = walkJsonFiles(GLOSSARY_RACES_DIR);

  // Update ids/refs/images first (file names may already have been renamed).
  for (const filePath of jsonFiles) {
    const entry = readJson(filePath);

    const oldId = typeof entry.id === 'string' ? (entry.id as string) : undefined;
    const normalizedId = oldId ? (ID_RENAMES[oldId] ?? oldId.replace(/-/g, '_')) : undefined;

    if (oldId && normalizedId && oldId !== normalizedId) {
      entry.id = normalizedId;

      // Keep the old ID as an alias for searchability, but do not keep it as a primary id.
      const aliases = Array.isArray(entry.aliases) ? (entry.aliases as unknown[]) : [];
      if (!aliases.includes(oldId)) aliases.push(oldId);
      entry.aliases = aliases;
    }

    // Normalize seeAlso references that are race IDs.
    if (Array.isArray(entry.seeAlso)) {
      entry.seeAlso = (entry.seeAlso as unknown[]).map((v) => {
        if (typeof v !== 'string') return v;
        const s = v as string;
        return ID_RENAMES[s] ?? s.replace(/-/g, '_');
      });
    }

    // Remove legacy imageUrl (dual images are the canonical race format now).
    if ('imageUrl' in entry) {
      delete entry.imageUrl;
    }

    // Apply CC image paths if available.
    const id = typeof entry.id === 'string' ? (entry.id as string) : undefined;
    if (id) {
      const cc = ccById.get(id);
      if (cc) {
        entry.maleImageUrl = resolvePublicAssetUrlFromCcPath(cc.maleIllustrationPath);
        entry.femaleImageUrl = resolvePublicAssetUrlFromCcPath(cc.femaleIllustrationPath);
      }
    }

    // Ensure filePath field matches actual location (useful for debugging and index generation).
    const relFromPublic = path.relative(path.join(ROOT, 'public'), filePath).replace(/\\/g, '/');
    entry.filePath = `/${relFromPublic}`;

    writeJsonPretty(filePath, entry);
  }
}

function regenerateGlossaryRaceIndex(ccRaces: CharacterCreatorRaceInfo[]) {
  // Load leaf entries by id so we can reuse tags/aliases/seeAlso/excerpts.
  const entryById = new Map<string, JsonObj>();
  const jsonFiles = walkJsonFiles(GLOSSARY_RACES_DIR);
  for (const filePath of jsonFiles) {
    const entry = readJson(filePath);
    const id = typeof entry.id === 'string' ? (entry.id as string) : undefined;
    if (id) entryById.set(id, entry);
  }

  const groupMap = new Map<string, CharacterCreatorRaceInfo[]>();
  for (const race of ccRaces) {
    const groupId = race.baseRace || race.id;
    const arr = groupMap.get(groupId) ?? [];
    arr.push(race);
    groupMap.set(groupId, arr);
  }

  const groups = [...groupMap.entries()].map(([groupId, variants]) => {
    const meta = getRaceGroupById(groupId);
    const title = meta?.name ?? groupId.charAt(0).toUpperCase() + groupId.slice(1);
    const excerpt = meta?.description ?? '';

    const subEntries = variants
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((race) => {
        const entry = entryById.get(race.id);
        if (!entry) {
          throw new Error(`Missing glossary race entry JSON for id '${race.id}'`);
        }

        const entryLore = typeof entry.entryLore === 'string' ? (entry.entryLore as string) : '';
        const leafExcerpt =
          typeof entry.excerpt === 'string'
            ? (entry.excerpt as string)
            : extractFirstSentence(entryLore);

        return {
          id: entry.id,
          title: entry.title ?? race.name,
          category: 'Character Races',
          tags: entry.tags ?? [],
          excerpt: leafExcerpt || 'No excerpt available.',
          aliases: entry.aliases ?? [],
          seeAlso: entry.seeAlso ?? [],
          filePath: entry.filePath,
        };
      });

    return {
      id: `group_${groupId}`,
      title,
      category: 'Character Races',
      excerpt,
      filePath: null,
      subEntries,
    };
  });

  groups.sort((a, b) => String(a.title).localeCompare(String(b.title)));
  writeJsonPretty(GLOSSARY_RACE_INDEX_PATH, groups);
}

function main() {
  const ccRaces = getCharacterCreatorRacesFromFiles();
  const ccById = new Map(ccRaces.map((r) => [r.id, r] as const));

  // Step 0: remove base leaf glossary entries for forced-choice families (Aasimar-style).
  for (const baseId of GLOSSARY_BASE_LEAF_IDS_TO_REMOVE) {
    const candidate = path.join(GLOSSARY_RACES_DIR, `${baseId}.json`);
    if (fs.existsSync(candidate)) {
      fs.unlinkSync(candidate);
    }
  }

  // Step 1: rename files for known ID migrations (keeps filenames aligned with canonical ids).
  renameGlossaryRaceFilesIfNeeded();

  // Step 2: normalize + rewrite all glossary race entries (ids, refs, images, remove legacy imageUrl).
  normalizeGlossaryRaceEntries(ccById);

  // Step 3: regenerate the grouped index to match Character Creator grouping/membership.
  regenerateGlossaryRaceIndex(ccRaces);

  console.log(`[sync-glossary-races] Synced ${ccRaces.length} races and regenerated character_races.json`);
}

main();
