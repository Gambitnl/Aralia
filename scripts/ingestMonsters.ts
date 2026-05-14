// ============================================================================
// 5eTools Monster Ingestion Script
// ============================================================================
// Reads monster data from vendor 5eTools bestiary JSON files and converts
// them into Aralia's MonsterData format, writing a generated TypeScript file.
//
// Pipeline:
//   vendor/5etools-src/data/bestiary/*.json
//      → this script (parse + convert)
//         → src/data/monsters.generated.ts (output)
//            → src/data/monsters.ts (re-exports)
//
// How to run:
//   npx ts-node scripts/ingestMonsters.ts
//   (Must be run from the project root.)
//
// Adding new monsters:
//   Add the monster's exact 5etools name to TARGET_MONSTERS below.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { convert5eToolsMonster } from '../src/data/adapters/5eTools/index.js';
import { parse5eToolsAction } from '../src/data/adapters/5eTools/actionsAdapter.js';
import { extractEntryText, strip5eToolsMarkup } from '../src/data/adapters/5eTools/shared.js';
import { Spell } from '../src/types/spells';

const XMM_PATH           = path.join(process.cwd(), 'vendor/5etools-src/data/bestiary/bestiary-xmm.json');
const MM_PATH            = path.join(process.cwd(), 'vendor/5etools-src/data/bestiary/bestiary-mm.json');
const LEGENDARY_GROUPS_PATH = path.join(process.cwd(), 'vendor/5etools-src/data/bestiary/legendarygroups.json');
const SPELLS_ROOT        = path.join(process.cwd(), 'public/data/spells');
const OUTPUT_PATH        = path.join(process.cwd(), 'src/data/monsters.generated.ts');

// Ingest ALL monsters from both MM and XMM.
// XMM (2024) takes precedence over MM (2014) for same-named monsters.
// Previously this was a hand-curated allowlist of 14 monsters — now the full
// 5eTools bestiary (~580 unique creatures) is available to the encounter generator.

const loadSpellRegistry = (): Map<string, Spell> => {
  const registry = new Map<string, Spell>();
  if (!fs.existsSync(SPELLS_ROOT)) {
    console.warn(`Spell directory not found: ${SPELLS_ROOT}`);
    return registry;
  }

  const walk = (dir: string) => {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) {
        walk(fullPath);
      } else if (file.name.endsWith('.json') && !file.name.includes('manifest')) {
        try {
          const spell = JSON.parse(fs.readFileSync(fullPath, 'utf-8')) as Spell;
          registry.set(spell.name.toLowerCase(), spell);
        } catch (e) {
          console.error(`Failed to parse spell: ${fullPath}`, e);
        }
      }
    }
  };

  walk(SPELLS_ROOT);
  return registry;
};

const main = async () => {
  console.log('Loading spell registry…');
  const spellRegistry = loadSpellRegistry();
  console.log(`Loaded ${spellRegistry.size} spells.`);

  console.log('Ingesting monsters from 5etools data…');

  const mmData  = JSON.parse(fs.readFileSync(MM_PATH,  'utf-8'));
  const xmmData = JSON.parse(fs.readFileSync(XMM_PATH, 'utf-8'));

  // Build a deduplicated monster map keyed by name.
  // MM is loaded first; XMM overwrites on collision so the 2024 stat blocks win.
  const monsterByName = new Map<string, any>();
  for (const m of mmData.monster)  monsterByName.set(m.name, m);
  for (const m of xmmData.monster) monsterByName.set(m.name, m);

  // Build legendary-group lookup: "Name:Source" → group entry.
  // Lair actions live in legendarygroups.json, not on the monster object itself.
  const legendaryGroupLookup = new Map<string, any>();
  if (fs.existsSync(LEGENDARY_GROUPS_PATH)) {
    const lgData = JSON.parse(fs.readFileSync(LEGENDARY_GROUPS_PATH, 'utf-8'));
    for (const group of lgData.legendaryGroup ?? []) {
      legendaryGroupLookup.set(`${group.name}:${group.source}`, group);
    }
  }

  const ingestedMonsters: Record<string, any> = {};
  let skipped = 0;

  const spellLookup = (name: string) => spellRegistry.get(name.toLowerCase());

  for (const [, monster] of monsterByName) {
    // Skip monsters with no CR (e.g. swarm components, vehicle parts)
    const rawCr = typeof monster.cr === 'object' ? monster.cr?.cr : monster.cr;
    if (rawCr === undefined || rawCr === null) { skipped++; continue; }

    let data: any;
    try {
      data = convert5eToolsMonster(monster, spellLookup);
    } catch (err) {
      console.warn(`  ⚠ Skipped ${monster.name} (conversion error): ${(err as Error).message}`);
      skipped++;
      continue;
    }

    // Inject lair actions from legendarygroups.json cross-reference.
    // The monster carries a { legendaryGroup: { name, source } } pointer.
    // Prefer the same source as the monster; fall back to MM for XMM monsters
    // (XMM dropped lair action text — it lives only in MM for most monsters).
    if (monster.legendaryGroup) {
      const lgName: string = monster.legendaryGroup.name ?? monster.name;
      const lgSource: string = monster.legendaryGroup.source ?? 'MM';
      // Prefer the exact source match, but fall back to whichever source carries
      // lairActions — XMM often omits them while MM retains them.
      const primaryGroup = legendaryGroupLookup.get(`${lgName}:${lgSource}`);
      const mmGroup      = legendaryGroupLookup.get(`${lgName}:MM`);
      const xmmGroup     = legendaryGroupLookup.get(`${lgName}:XMM`);
      const group = (primaryGroup?.lairActions ? primaryGroup : null)
        ?? (mmGroup?.lairActions ? mmGroup : null)
        ?? (xmmGroup?.lairActions ? xmmGroup : null)
        ?? primaryGroup;

      if (group?.lairActions) {
        // lairActions is [ "header string", { type:"list", items: [...] }, ... ]
        // Collect every string item from any nested list.
        const lairItems: string[] = [];
        for (const entry of group.lairActions) {
          if (typeof entry === 'string') continue; // skip header
          const text = extractEntryText(entry);
          // Each semicolon-delimited sentence inside a list item IS one lair action.
          // But items[] are already discrete — split on the list structure instead.
          // Only 'list' entries contain discrete lair actions.
          // 'entries' blocks (e.g. "Additional Lair Actions") are supplemental
          // optional content — skip them to avoid meta-text as ability names.
          if (entry.type === 'list' && Array.isArray(entry.items)) {
            for (const item of entry.items) {
              const itemText = typeof item === 'string' ? item : extractEntryText(item);
              if (itemText.trim()) lairItems.push(itemText.trim());
            }
          }
        }

        for (const itemText of lairItems) {
          // Synthesise a short display name: strip markup first, then take
          // the first clause before "," or "." (max 6 words).
          const cleanText = strip5eToolsMarkup(itemText);
          const firstClause = cleanText.split(/[.,(]/)[0].trim();
          const nameParts = firstClause.split(/\s+/).slice(0, 6);
          const lairName = nameParts.join(' ');
          const synthetic = { name: lairName, entries: [itemText] };
          const ability = parse5eToolsAction(synthetic, 'lair');
          if (ability) {
            (data as any).abilities.push(ability);
          }
        }
      }
    }

    // Append environment tags that are only present in the raw 5etools data.
    if (monster.environment && Array.isArray(monster.environment)) {
      const envTags = monster.environment.map((e: string) => e.toLowerCase());
      data.tags = Array.from(new Set([...data.tags, ...envTags]));
    }

    ingestedMonsters[data.id] = data;
  }

  const fileContent = `/**
 * GENERATED FILE - DO NOT EDIT DIRECTLY
 * Generated by scripts/ingestMonsters.ts
 */
import { MonsterData } from '../types';

export const INGESTED_MONSTERS: Record<string, MonsterData> = ${JSON.stringify(ingestedMonsters, null, 2)};
`;

  fs.writeFileSync(OUTPUT_PATH, fileContent);
  const count = Object.keys(ingestedMonsters).length;
  console.log(`\nSuccessfully wrote ${count} monsters to ${OUTPUT_PATH}`);
  if (skipped > 0) console.log(`  (${skipped} monsters skipped — missing CR or conversion error)`);
};


main();
