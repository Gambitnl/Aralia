// scripts/generateGlossaryIndex.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { glob } from "glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENTRY_BASE_DIR = path.join(__dirname, "../public/data/glossary/entries");
const OUT_INDEX_DIR = path.join(__dirname, "../public/data/glossary/index");
const MAIN_INDEX_FILE = path.join(OUT_INDEX_DIR, "main.json");

const categoryToSlug = (category) => {
  return category.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
};

const titleFromId = (id) =>
  String(id)
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const normalizeRaceKey = (value) => String(value ?? "").toLowerCase().replace(/-/g, "_");

const RACE_GROUP_DEFS = [
  {
    id: "aasimar",
    title: "Aasimar",
    excerpt: "Celestial-blooded mortals and their variants.",
    baseRaceIds: ["aasimar"],
    pathPrefixes: ["races/aasimar_variants/"],
  },
  {
    id: "beastfolk",
    title: "Beastfolk",
    excerpt: "Humanoids with animalistic features.",
    ids: [
      "aarakocra",
      "giff",
      "hadozee",
      "harengon",
      "kenku",
      "leonin",
      "lizardfolk",
      "loxodon",
      "minotaur",
      "tabaxi",
      "thri_kreen",
      "tortle",
      "yuan-ti",
    ],
  },
  {
    id: "dragonborn",
    title: "Dragonborn",
    excerpt: "Dragonborn traits and draconic ancestries.",
    ids: ["dragonborn"],
    pathPrefixes: ["races/dragonborn_ancestries/"],
    primaryIds: ["dragonborn"],
  },
  {
    id: "dwarf",
    title: "Dwarf",
    excerpt: "Dwarven lineages and related variants.",
    ids: ["dwarf", "hill_dwarf", "mountain_dwarf", "duergar"],
    baseRaceIds: ["dwarf"],
    primaryIds: ["dwarf"],
  },
  {
    id: "eladrin",
    title: "Eladrin",
    excerpt: "Seasonal eladrin variants and traits.",
    ids: ["eladrin"],
    baseRaceIds: ["eladrin"],
    pathPrefixes: ["races/eladrin_seasons/"],
    primaryIds: ["eladrin"],
  },
  {
    id: "elf",
    title: "Elf",
    excerpt: "Elven lineages and related variants.",
    ids: ["elf"],
    baseRaceIds: ["elf"],
    pathPrefixes: ["races/elf_lineages/"],
    primaryIds: ["elf"],
  },
  {
    id: "genasi",
    title: "Genasi",
    excerpt: "Elemental genasi lineages.",
    ids: ["genasi", "air_genasi", "earth_genasi", "fire_genasi", "water_genasi"],
    primaryIds: ["genasi"],
  },
  {
    id: "gith",
    title: "Gith",
    excerpt: "Psionic peoples split between two cultures.",
    ids: ["githyanki", "githzerai"],
  },
  {
    id: "gnome",
    title: "Gnome",
    excerpt: "Gnome lineages and variants.",
    ids: ["gnome", "deep_gnome"],
    baseRaceIds: ["gnome"],
    pathPrefixes: ["races/gnome_subraces/"],
    primaryIds: ["gnome"],
  },
  {
    id: "goblinoid",
    title: "Goblinoid",
    excerpt: "Fey-touched goblins and hobgoblins.",
    ids: ["goblin", "hobgoblin"],
  },
  {
    id: "goliath",
    title: "Goliath",
    excerpt: "Goliath traits and giant ancestries.",
    ids: ["goliath"],
    pathPrefixes: ["races/goliath_ancestries/"],
    primaryIds: ["goliath"],
  },
  {
    id: "half_elf",
    title: "Half-Elf",
    excerpt: "Half-elf variants and dragonmarks.",
    ids: ["half-elf"],
    baseRaceIds: ["half_elf"],
    pathPrefixes: ["races/half_elf_variants/"],
    primaryIds: ["half-elf"],
  },
  {
    id: "half_orc",
    title: "Half-Orc",
    excerpt: "Half-orc variants and dragonmarks.",
    ids: ["half-orc"],
    baseRaceIds: ["half_orc"],
    primaryIds: ["half-orc"],
  },
  {
    id: "halfling",
    title: "Halfling",
    excerpt: "Halfling subraces and variants.",
    ids: ["halfling"],
    baseRaceIds: ["halfling"],
    pathPrefixes: ["races/halfling_subraces/"],
    primaryIds: ["halfling"],
  },
  {
    id: "human",
    title: "Human",
    excerpt: "Human variants and dragonmarks.",
    ids: ["human"],
    baseRaceIds: ["human"],
    primaryIds: ["human"],
  },
  {
    id: "shifter",
    title: "Shifter",
    excerpt: "Shifter variants and traits.",
    ids: ["shifter"],
    baseRaceIds: ["shifter"],
    pathPrefixes: ["races/shifter_variants/"],
    primaryIds: ["shifter"],
  },
  {
    id: "tiefling",
    title: "Tiefling",
    excerpt: "Tiefling legacies and traits.",
    ids: ["tiefling"],
    pathPrefixes: ["races/tiefling_legacies/"],
    primaryIds: ["tiefling"],
  },
];

function loadJson(fullPath) {
  const raw = fs.readFileSync(fullPath, "utf-8");
  return JSON.parse(raw);
}

function buildSpellIndexFromManifest() {
  const manifestPath = path.join(__dirname, "../public/data/spells_manifest.json");
  const spellsDir = path.join(__dirname, "../public/data/spells");
  const manifest = loadJson(manifestPath);

  const levels = new Map();
  for (const [id, spell] of Object.entries(manifest)) {
    if (typeof spell.level !== "number") continue;
    if (!levels.has(spell.level)) levels.set(spell.level, []);

    const expectedJson = path.join(spellsDir, `level-${spell.level}`, `${id}.json`);
    const hasSpellJson = fs.existsSync(expectedJson);

    levels.get(spell.level).push({
      id,
      title: spell.name || titleFromId(id),
      category: "Spells",
      tags: [`level ${spell.level}`],
      excerpt: `${spell.school ?? "Unknown"} spell`,
      aliases: spell.aliases || [],
      filePath: null,
      hasSpellJson,
    });
  }

  const levelGroups = [];
  for (const [level, entries] of [...levels.entries()].sort((a, b) => a[0] - b[0])) {
    entries.sort((a, b) => a.title.localeCompare(b.title));
    levelGroups.push({
      id: `spell_level_${level}`,
      title: level === 0 ? "Cantrips (Level 0)" : `Level ${level} Spells`,
      category: "Spells",
      excerpt: level === 0 ? "Spells that can be cast at will, without using a spell slot." : `Spells of level ${level}.`,
      filePath: null,
      subEntries: entries,
    });
  }

  return levelGroups;
}

function groupRaceEntries(raceRecords) {
  const usedIds = new Set();
  const groups = [];

  const isDragonmark = (record) => record.meta.relPath.startsWith("races/dragonmark_variants/");

  for (const def of RACE_GROUP_DEFS) {
    const ids = new Set((def.ids || []).map(normalizeRaceKey));
    const baseRaceIds = new Set((def.baseRaceIds || []).map(normalizeRaceKey));
    const primaryIds = new Set((def.primaryIds || []).map(normalizeRaceKey));
    const pathPrefixes = def.pathPrefixes || [];
    const tagIncludes = (def.tagIncludes || []).map(normalizeRaceKey);

    const members = raceRecords.filter((record) => {
      const entryId = normalizeRaceKey(record.entry.id);
      const baseRace = normalizeRaceKey(record.meta.baseRace);
      const tags = (record.entry.tags || []).map(normalizeRaceKey);

      if (ids.has(entryId)) return true;
      if (baseRace && baseRaceIds.has(baseRace)) return true;
      if (pathPrefixes.some((prefix) => record.meta.relPath.startsWith(prefix))) return true;
      if (tagIncludes.some((tag) => tags.includes(tag))) return true;

      return false;
    });

    if (members.length === 0) continue;

    members.sort((a, b) => {
      const aPrimary = primaryIds.has(normalizeRaceKey(a.entry.id));
      const bPrimary = primaryIds.has(normalizeRaceKey(b.entry.id));
      if (aPrimary !== bPrimary) return aPrimary ? -1 : 1;

      const aDragonmark = isDragonmark(a);
      const bDragonmark = isDragonmark(b);
      if (aDragonmark !== bDragonmark) return aDragonmark ? 1 : -1;

      return a.entry.title.localeCompare(b.entry.title);
    });

    members.forEach((record) => usedIds.add(record.entry.id));
    groups.push({
      id: `group_${def.id}`,
      title: def.title,
      category: "Character Races",
      excerpt: def.excerpt,
      filePath: null,
      subEntries: members.map((record) => record.entry),
    });
  }

  const remaining = raceRecords
    .filter((record) => !usedIds.has(record.entry.id))
    .map((record) => record.entry);

  const combined = [...groups, ...remaining];
  combined.sort((a, b) => a.title.localeCompare(b.title));

  return combined;
}

function buildIndex() {
  console.log(`Scanning for glossary JSON entries in: ${ENTRY_BASE_DIR}`);

  const files = glob.sync("**/*.json", {
    cwd: ENTRY_BASE_DIR,
    ignore: ["spells/**", "dev/**"], // spells come from spells_manifest.json; dev entries excluded
  });

  console.log(`Found ${files.length} files...`);

  const entryRecords = files
    .map((relPath) => {
      const fullPath = path.join(ENTRY_BASE_DIR, relPath);
      const fileNameWithoutExt = path.basename(relPath, ".json");
      const normalizedRelPath = relPath.replace(/\\/g, "/");
      const fetchableFilePath = `/data/glossary/entries/${normalizedRelPath}`;

      try {
        const data = loadJson(fullPath);

        const id = data.id || fileNameWithoutExt;
        const title = data.title || titleFromId(id);
        const category = data.category;
        if (!category) {
          console.warn(`WARN: Missing 'category' in ${relPath}, skipping`);
          return null;
        }

        return {
          entry: {
            id,
            title,
            category,
            tags: data.tags || [],
            excerpt: data.excerpt || "No excerpt available.",
            aliases: data.aliases || [],
            seeAlso: data.seeAlso || [],
            filePath: fetchableFilePath,
          },
          meta: {
            baseRace: data.baseRace,
            relPath: normalizedRelPath,
          },
        };
      } catch (e) {
        console.error(`\n--- ERROR PROCESSING FILE: ${relPath} ---\n`);
        console.error(e?.message || e);
        console.error(`------------------------------------------\n`);
        throw new Error(`Halting build due to error in ${relPath}.`);
      }
    })
    .filter((record) => record !== null);

  const allEntries = entryRecords.map((record) => record.entry);

  const idCounts = new Map();
  allEntries.forEach((e) => idCounts.set(e.id, (idCounts.get(e.id) || 0) + 1));
  const dupes = [...idCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
  if (dupes.length > 0) {
    throw new Error(`Duplicate glossary IDs found: ${dupes.join(", ")}. Each 'id' must be unique.`);
  }

  const entriesByCategory = allEntries.reduce((acc, entry) => {
    const key = entry.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  // Spells are manifest-driven (no per-spell glossary entry files)
  entriesByCategory["Spells"] = buildSpellIndexFromManifest();

  const categoryIndexFiles = [];

  // Special handling for Character Classes: group subclasses under parent class
  if (entriesByCategory["Character Classes"]) {
    try {
      const classEntries = entriesByCategory["Character Classes"];

      const mainClassNames = [
        "artificer",
        "barbarian",
        "bard",
        "cleric",
        "druid",
        "fighter",
        "monk",
        "paladin",
        "ranger",
        "rogue",
        "sorcerer",
        "warlock",
        "wizard",
      ];

      const mainClasses = new Map();
      const subclassEntries = [];
      const spellListEntries = [];
      const otherEntries = [];

      classEntries.forEach((entry) => {
        const id = String(entry.id);
        const filePath = String(entry.filePath || "");

        // Main class
        if (mainClassNames.includes(id)) {
          mainClasses.set(id, { ...entry, subEntries: [] });
          return;
        }

        // Subclass
        if (id.includes("_subclass") || filePath.includes("_subclasses/")) {
          let parentClass = null;
          for (const className of mainClassNames) {
            if (entry.tags?.some((t) => t.toLowerCase() === className) || filePath.includes(`${className}_subclasses/`)) {
              parentClass = className;
              break;
            }
          }
          subclassEntries.push({ ...entry, parentClass, type: "subclass" });
          return;
        }

        // Spell list
        if (id.includes("_spell_list") || id.includes("spell_list")) {
          let parentClass = null;
          for (const className of mainClassNames) {
            if (id.startsWith(className) || entry.tags?.some((t) => t.toLowerCase() === className)) {
              parentClass = className;
              break;
            }
          }
          spellListEntries.push({ ...entry, parentClass, type: "spell_list" });
          return;
        }

        // Special case
        if (id === "artificer_infusions") {
          otherEntries.push({ ...entry, parentClass: "artificer", type: "feature" });
          return;
        }

        otherEntries.push(entry);
      });

      subclassEntries.forEach((subclass) => {
        if (subclass.parentClass && mainClasses.has(subclass.parentClass)) {
          mainClasses.get(subclass.parentClass).subEntries.push(subclass);
        } else {
          console.warn(`WARN: Could not find parent class for subclass: ${subclass.id}`);
          otherEntries.push(subclass);
        }
      });

      spellListEntries.forEach((spellList) => {
        if (spellList.parentClass && mainClasses.has(spellList.parentClass)) {
          mainClasses.get(spellList.parentClass).subEntries.push(spellList);
        } else {
          console.warn(`WARN: Could not find parent class for spell list: ${spellList.id}`);
          otherEntries.push(spellList);
        }
      });

      otherEntries.forEach((other) => {
        if (other.parentClass && mainClasses.has(other.parentClass)) {
          mainClasses.get(other.parentClass).subEntries.push(other);
        }
      });

      mainClasses.forEach((mainClass) => {
        mainClass.subEntries.sort((a, b) => a.title.localeCompare(b.title));
      });

      const classGroups = [...mainClasses.values()].sort((a, b) => a.title.localeCompare(b.title));
      entriesByCategory["Character Classes"] = classGroups;
    } catch (e) {
      console.error("Failed to organize class index:", e?.message || e);
    }
  }

  if (entriesByCategory["Character Races"]) {
    const raceRecords = entryRecords.filter((record) => record.entry.category === "Character Races");
    if (raceRecords.length > 0) {
      entriesByCategory["Character Races"] = groupRaceEntries(raceRecords);
    }
  }

  if (!fs.existsSync(OUT_INDEX_DIR)) {
    fs.mkdirSync(OUT_INDEX_DIR, { recursive: true });
  }

  for (const categoryName in entriesByCategory) {
    const categorySlug = categoryToSlug(categoryName);
    const categoryFileName = `${categorySlug}.json`;
    const categoryFilePath = path.join(OUT_INDEX_DIR, categoryFileName);
    const categoryEntries = entriesByCategory[categoryName];

    if (categoryName !== "Spells" && categoryName !== "Character Classes") {
      categoryEntries.sort((a, b) => a.title.localeCompare(b.title));
    }

    fs.writeFileSync(categoryFilePath, JSON.stringify(categoryEntries, null, 2));
    console.log(`Generated ${categoryEntries.length} entries into ${categoryFileName}`);
    categoryIndexFiles.push(`/data/glossary/index/${categoryFileName}`);
  }

  const mainIndexContent = {
    lastGenerated: new Date().toISOString(),
    index_files: categoryIndexFiles.sort(),
  };
  fs.writeFileSync(MAIN_INDEX_FILE, JSON.stringify(mainIndexContent, null, 2));
  console.log(`Generated main index file: ${MAIN_INDEX_FILE} listing ${categoryIndexFiles.length} category files.`);
}

buildIndex();

export default buildIndex;
