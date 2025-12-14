// scripts/generateGlossaryIndex.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { glob } from "glob";
import fm from "front-matter";

const ENTRY_BASE_DIR = path.join(__dirname, "../public/data/glossary/entries"); // Corrected path
const OUT_INDEX_DIR = path.join(__dirname, "../public/data/glossary/index"); // New output directory for indexes
const MAIN_INDEX_FILE = path.join(OUT_INDEX_DIR, "main.json");

// Helper to create a slug from a category name
const categoryToSlug = (category) => {
  return category.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
};

// In AI Studio, we can't actually write to public. The generated JSON will be provided directly.
// For local dev, this script would create the files in public/data/glossary/index/
function buildIndex() {
  console.log(`Scanning for Markdown files in: ${ENTRY_BASE_DIR}`);
  const files = glob.sync("**/*.md", { cwd: ENTRY_BASE_DIR });
  console.log(`Found ${files.length} files...`);

  const allEntries = files.map(relPath => {
    try {
      const fullPath = path.join(ENTRY_BASE_DIR, relPath);
      const raw = fs.readFileSync(fullPath, "utf-8");
      const { attributes } = fm(raw);

      const fileNameWithoutExt = path.basename(relPath, '.md');

      // --- VALIDATION ---
      // Allow entries with missing fields but warn about them
      const fetchableFilePath = `/data/glossary/entries/${relPath.replace(/\\/g, '/')}`;

      if (!attributes.id) {
        console.warn(`WARN: Missing 'id' in ${relPath}, using filename`);
        attributes.id = fileNameWithoutExt;
      }
      if (!attributes.title) {
        console.warn(`WARN: Missing 'title' in ${relPath}, using id`);
        attributes.title = attributes.id.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      }
      if (!attributes.category) {
        console.warn(`WARN: Missing 'category' in ${relPath}, skipping`);
        return null; // Skip entries without category
      }
      if (!attributes.filePath) {
        console.warn(`WARN: Missing 'filePath' in ${relPath}, using computed path`);
        attributes.filePath = fetchableFilePath;
      }
      if (attributes.id !== fileNameWithoutExt) {
        console.warn(`WARN: id mismatch in ${relPath}: "${attributes.id}" vs "${fileNameWithoutExt}"`);
        // Use the id from frontmatter but update filePath if it doesn't match
      }
      if (attributes.filePath !== fetchableFilePath) {
        console.warn(`WARN: filePath mismatch in ${relPath}, using computed path`);
        attributes.filePath = fetchableFilePath;
      }

      return {
        id: attributes.id,
        title: attributes.title,
        category: attributes.category,
        tags: attributes.tags || [],
        excerpt: attributes.excerpt || "No excerpt available.",
        aliases: attributes.aliases || [],
        seeAlso: attributes.seeAlso || [],
        filePath: attributes.filePath,
      };
    } catch (e) {
      console.error(`\n--- ERROR PROCESSING FILE: ${relPath} ---\n`);
      console.error(e.message);
      console.error(`------------------------------------------\n`);
      // Re-throw to halt the script
      throw new Error(`Halting build due to error in ${relPath}.`);
    }
  }).filter(e => e !== null);

  // Check for duplicate IDs across all entries
  const idCounts = new Map();
  allEntries.forEach(e => {
    idCounts.set(e.id, (idCounts.get(e.id) || 0) + 1);
  });
  const dupes = [...idCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
  if (dupes.length > 0) {
    throw new Error(`Duplicate glossary IDs found: ${dupes.join(", ")}. Each 'id' must be unique.`);
  }

  // Group entries by category
  const entriesByCategory = allEntries.reduce((acc, entry) => {
    const categoryKey = entry.category;
    if (!acc[categoryKey]) {
      acc[categoryKey] = [];
    }
    acc[categoryKey].push(entry);
    return acc;
  }, {});

  const categoryIndexFiles = [];

  // Special handling for Spells: ensure the index includes every spell in the manifest,
  // even if a glossary card is missing, so the UI can show gaps.
  if (entriesByCategory["Spells"]) {
    try {
      const manifestPath = path.join(__dirname, "../public/data/spells_manifest.json");
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      const spellCardDir = path.join(ENTRY_BASE_DIR, "spells");
      // Scan level subfolders for spell cards
      const spellCardFiles = glob.sync("level-*/*.md", { cwd: spellCardDir });
      const spellCards = new Set(spellCardFiles.map(f => path.basename(f, ".md")));

      const levelsMap = new Map();
      Object.entries(manifest).forEach(([id, spell]) => {
        if (typeof spell.level !== "number") return;
        if (!levelsMap.has(spell.level)) levelsMap.set(spell.level, []);
        levelsMap.get(spell.level).push({
          id,
          title: spell.name,
          category: "Spells",
          tags: [`level ${spell.level}`],
          excerpt: spell.school ? `${spell.school} spell` : "Spell entry",
          filePath: `/data/glossary/entries/spells/level-${spell.level}/${id}.md`,
          hasCard: spellCards.has(id),
        });
      });

      const sortedLevels = [...levelsMap.keys()].sort((a, b) => a - b);
      const spellGroups = sortedLevels.map(level => ({
        id: `spell_level_${level}`,
        title: level === 0 ? "Cantrips (Level 0)" : `Level ${level} Spells`,
        category: "Spells",
        excerpt: level === 0 ? "Spells that can be cast at will, without using a spell slot." : `Spells cast using a ${level} level spell slot.`,
        filePath: null,
        subEntries: levelsMap.get(level).sort((a, b) => a.title.localeCompare(b.title)),
      }));

      entriesByCategory["Spells"] = spellGroups;
    } catch (e) {
      console.error("Failed to enrich spell index from manifest:", e.message);
    }
  }

  // Special handling for Character Classes: group subclasses under their parent class
  if (entriesByCategory["Character Classes"]) {
    try {
      const classEntries = entriesByCategory["Character Classes"];

      // Define the 13 main class names (used to identify main class entries)
      const mainClassNames = [
        'artificer', 'barbarian', 'bard', 'cleric', 'druid',
        'fighter', 'monk', 'paladin', 'ranger', 'rogue',
        'sorcerer', 'warlock', 'wizard'
      ];

      // Separate main classes from subclasses/spell lists/other
      const mainClasses = new Map();
      const subclassEntries = [];
      const spellListEntries = [];
      const otherEntries = [];

      classEntries.forEach(entry => {
        const id = entry.id.toLowerCase();
        const filePath = entry.filePath || '';

        // Check if this is a main class (exact match of main class name as id)
        if (mainClassNames.includes(id)) {
          mainClasses.set(id, { ...entry, subEntries: [] });
        }
        // Check if this is a subclass (contains "_subclass" in id or is in a subclasses folder)
        else if (id.includes('_subclass') || filePath.includes('_subclasses/')) {
          // Find parent class from tags or file path
          let parentClass = null;
          for (const className of mainClassNames) {
            if (entry.tags?.some(t => t.toLowerCase() === className) ||
              filePath.includes(`${className}_subclasses/`)) {
              parentClass = className;
              break;
            }
          }
          subclassEntries.push({ ...entry, parentClass, type: 'subclass' });
        }
        // Check if this is a spell list
        else if (id.includes('_spell_list') || id.includes('spell_list')) {
          let parentClass = null;
          for (const className of mainClassNames) {
            if (id.startsWith(className) || entry.tags?.some(t => t.toLowerCase() === className)) {
              parentClass = className;
              break;
            }
          }
          spellListEntries.push({ ...entry, parentClass, type: 'spell_list' });
        }
        // Check if this is artificer infusions (special case)
        else if (id === 'artificer_infusions') {
          otherEntries.push({ ...entry, parentClass: 'artificer', type: 'feature' });
        }
        // Any other entries
        else {
          otherEntries.push(entry);
        }
      });

      // Nest subclasses under their parent class
      subclassEntries.forEach(subclass => {
        if (subclass.parentClass && mainClasses.has(subclass.parentClass)) {
          mainClasses.get(subclass.parentClass).subEntries.push(subclass);
        } else {
          console.warn(`WARN: Could not find parent class for subclass: ${subclass.id}`);
          otherEntries.push(subclass);
        }
      });

      // Nest spell lists under their parent class
      spellListEntries.forEach(spellList => {
        if (spellList.parentClass && mainClasses.has(spellList.parentClass)) {
          mainClasses.get(spellList.parentClass).subEntries.push(spellList);
        } else {
          console.warn(`WARN: Could not find parent class for spell list: ${spellList.id}`);
          otherEntries.push(spellList);
        }
      });

      // Nest other related entries (like artificer_infusions) under their parent class
      otherEntries.forEach(other => {
        if (other.parentClass && mainClasses.has(other.parentClass)) {
          mainClasses.get(other.parentClass).subEntries.push(other);
        }
      });

      // Sort subEntries within each main class alphabetically
      mainClasses.forEach(mainClass => {
        mainClass.subEntries.sort((a, b) => a.title.localeCompare(b.title));
      });

      // Convert to array and sort main classes alphabetically
      const classGroups = [...mainClasses.values()].sort((a, b) => a.title.localeCompare(b.title));

      console.log(`Organized ${classGroups.length} main classes with ${subclassEntries.length} subclasses and ${spellListEntries.length} spell lists nested.`);

      entriesByCategory["Character Classes"] = classGroups;
    } catch (e) {
      console.error("Failed to organize class index:", e.message);
    }
  }

  // Create directory if it doesn't exist (for local dev)
  if (process.env.NODE_ENV !== 'test_ai_studio' && !fs.existsSync(OUT_INDEX_DIR)) {
    fs.mkdirSync(OUT_INDEX_DIR, { recursive: true });
  }

  // Write separate JSON file for each category
  for (const categoryName in entriesByCategory) {
    const categorySlug = categoryToSlug(categoryName);
    const categoryFileName = `${categorySlug}.json`;
    const categoryFilePath = path.join(OUT_INDEX_DIR, categoryFileName);
    const categoryEntries = entriesByCategory[categoryName];

    // Simple alphabetical sort for consistency (skip for Spells and Character Classes - already organized)
    if (categoryName !== "Spells" && categoryName !== "Character Classes") {
      categoryEntries.sort((a, b) => a.title.localeCompare(b.title));
    }

    if (process.env.NODE_ENV !== 'test_ai_studio') {
      fs.writeFileSync(categoryFilePath, JSON.stringify(categoryEntries, null, 2));
    }
    console.log(`Conceptually generated ${categoryEntries.length} entries into ${categoryFileName}`);
    categoryIndexFiles.push(`/data/glossary/index/${categoryFileName}`);
  }

  // Create main.json
  const mainIndexContent = {
    lastGenerated: new Date().toISOString(),
    index_files: categoryIndexFiles.sort()
  };
  if (process.env.NODE_ENV !== 'test_ai_studio') {
    fs.writeFileSync(MAIN_INDEX_FILE, JSON.stringify(mainIndexContent, null, 2));
  }
  console.log(`Conceptually generated main index file: ${MAIN_INDEX_FILE} listing ${categoryIndexFiles.length} category files.`);
  console.log(`Timestamp: ${mainIndexContent.lastGenerated}`);
}

// Run directly when executed as a script
buildIndex();

export default buildIndex;
