// scripts/generateGlossaryIndex.js
import fs from "fs";
import path from "path";
import glob from "glob";
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
      if (!attributes.id) throw new Error(`Missing 'id' in frontmatter.`);
      if (!attributes.title) throw new Error(`Missing 'title' in frontmatter.`);
      if (!attributes.category) throw new Error(`Missing 'category' in frontmatter.`);
      if (!attributes.filePath) throw new Error(`Missing 'filePath' in frontmatter.`);
      if (attributes.id !== fileNameWithoutExt) {
        throw new Error(`Frontmatter 'id' ("${attributes.id}") does not match filename ("${fileNameWithoutExt}.md"). They must be identical.`);
      }

      const fetchableFilePath = `/data/glossary/entries/${relPath.replace(/\\/g, '/')}`;
      if (attributes.filePath !== fetchableFilePath) {
         throw new Error(`'filePath' ("${attributes.filePath}") does not match the expected public path ("${fetchableFilePath}").`);
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
  });

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
  }, {} as Record<string, any[]>);

  const categoryIndexFiles = [];

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

    // Simple alphabetical sort for consistency
    categoryEntries.sort((a,b) => a.title.localeCompare(b.title));

    if (process.env.NODE_ENV !== 'test_ai_studio') {
      fs.writeFileSync(categoryFilePath, JSON.stringify(categoryEntries, null, 2));
    }
    console.log(`Conceptually generated ${categoryEntries.length} entries into ${categoryFileName}`);
    categoryIndexFiles.push(`/data/glossary/index/${categoryFileName}`);
  }

  // Create main.json
  const mainIndexContent = {
    index_files: categoryIndexFiles.sort()
  };
  if (process.env.NODE_ENV !== 'test_ai_studio') {
    fs.writeFileSync(MAIN_INDEX_FILE, JSON.stringify(mainIndexContent, null, 2));
  }
  console.log(`Conceptually generated main index file: ${MAIN_INDEX_FILE} listing ${categoryIndexFiles.length} category files.`);
}

// buildIndex(); // Don't run directly in environments without fs/path
export default buildIndex;
