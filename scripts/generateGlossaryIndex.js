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

function buildIndex() {
  console.log(`Scanning for glossary JSON entries in: ${ENTRY_BASE_DIR}`);

  const files = glob.sync("**/*.json", {
    cwd: ENTRY_BASE_DIR,
    ignore: ["spells/**"], // spells come from spells_manifest.json
  });

  console.log(`Found ${files.length} files...`);

  const allEntries = files
    .map((relPath) => {
      const fullPath = path.join(ENTRY_BASE_DIR, relPath);
      const fileNameWithoutExt = path.basename(relPath, ".json");
      const fetchableFilePath = `/data/glossary/entries/${relPath.replace(/\\/g, "/")}`;

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
          id,
          title,
          category,
          tags: data.tags || [],
          excerpt: data.excerpt || "No excerpt available.",
          aliases: data.aliases || [],
          seeAlso: data.seeAlso || [],
          filePath: fetchableFilePath,
        };
      } catch (e) {
        console.error(`\n--- ERROR PROCESSING FILE: ${relPath} ---\n`);
        console.error(e?.message || e);
        console.error(`------------------------------------------\n`);
        throw new Error(`Halting build due to error in ${relPath}.`);
      }
    })
    .filter((e) => e !== null);

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
