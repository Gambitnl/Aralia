import fs from 'fs';
import path from 'path';
import { CLASSES_DATA } from '../src/data/classes';

type SpellManifestEntry = {
  name: string;
  level: number;
  school: string;
  path: string;
};

const MANIFEST_PATH = path.join(process.cwd(), 'public', 'data', 'spells_manifest.json');
const GLOSSARY_BASE = path.join(process.cwd(), 'public', 'data', 'glossary', 'entries', 'spells');

const levelTagMatches = (tags: string[] = [], level: number) => {
  const needle = String(level);
  return tags.some((t) => {
    const normalized = t.toLowerCase();
    return normalized === `level ${needle}` || normalized === `level-${needle}` || normalized === `level${needle}`;
  });
};

const parseFrontmatter = (md: string) => {
  const fmMatch = /^---\s*([\s\S]*?)\s*---/m.exec(md);
  if (!fmMatch) return { tags: [] as string[], id: undefined };
  const block = fmMatch[1];
  const idMatch = /id:\s*["']?([^\n"']+)["']?/i.exec(block);

  // Inline array style: tags: [foo, bar]
  const inlineTagsMatch = /tags:\s*\[(.*?)\]/s.exec(block);
  if (inlineTagsMatch) {
    const tags = inlineTagsMatch[1]
      .split(',')
      .map((t) => t.trim().replace(/["']/g, ''))
      .filter(Boolean);
    return { tags, id: idMatch ? idMatch[1] : undefined };
  }

  // YAML list style:
  const lines = block.split(/\r?\n/);
  const tags: string[] = [];
  let inTags = false;
  for (const line of lines) {
    if (!inTags && line.trim().startsWith('tags:')) {
      inTags = true;
      const maybeInline = line.slice(line.indexOf('tags:') + 5).trim();
      if (maybeInline.startsWith('[')) {
        const inline = maybeInline.replace(/[\[\]]/g, '');
        inline
          .split(',')
          .map((t) => t.trim().replace(/["']/g, ''))
          .filter(Boolean)
          .forEach((t) => tags.push(t));
        break;
      }
      continue;
    }
    if (inTags) {
      if (line.trim().startsWith('-')) {
        const tag = line.replace('-', '').trim().replace(/["']/g, '');
        if (tag) tags.push(tag);
      } else if (line.trim() === '' || /^[A-Za-z]/.test(line.trim())) {
        break;
      }
    }
  }

  return { tags, id: idMatch ? idMatch[1] : undefined };
};

const loadManifest = (): Record<string, SpellManifestEntry> => {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error('spells_manifest.json not found; run regenerate-manifest first.');
  }
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
  return JSON.parse(raw);
};

const GLOSSARY_MAIN_INDEX = path.join(process.cwd(), 'public', 'data', 'glossary', 'index', 'main.json');

const getGlossaryLastGenerated = (): string | null => {
  try {
    if (!fs.existsSync(GLOSSARY_MAIN_INDEX)) return null;
    const data = JSON.parse(fs.readFileSync(GLOSSARY_MAIN_INDEX, 'utf-8'));
    return data.lastGenerated || null;
  } catch {
    return null;
  }
};

const main = () => {
  // Display last glossary generation time
  const lastGenerated = getGlossaryLastGenerated();
  if (lastGenerated) {
    const date = new Date(lastGenerated);
    console.log(`[Glossary Index] Last generated: ${date.toLocaleString()}`);
  } else {
    console.warn('[Glossary Index] Warning: Could not read last generation timestamp');
  }

  const manifest = loadManifest();
  const manifestIds = new Set(Object.keys(manifest));

  const missingFromManifest: { classId: string; spellId: string }[] = [];
  Object.values(CLASSES_DATA).forEach((cls) => {
    if (!cls.spellcasting?.spellList) return;
    cls.spellcasting.spellList.forEach((id) => {
      const key = String(id);
      if (!manifestIds.has(key)) {
        missingFromManifest.push({ classId: cls.id, spellId: key });
      }
    });
  });

  const missingGlossary: string[] = [];
  const missingLevelTags: string[] = [];
  const incorrectLayout: string[] = [];
  Object.entries(manifest).forEach(([id, entry]) => {
    // Only enforce for nested spells (already filtered by validation)
    if (!entry.path.includes('/level-')) return;
    const glossaryPath = path.join(GLOSSARY_BASE, `level-${entry.level}`, `${id}.md`);
    if (!fs.existsSync(glossaryPath)) {
      missingGlossary.push(id);
      return;
    }
    try {
      const md = fs.readFileSync(glossaryPath, 'utf-8');
      const { tags } = parseFrontmatter(md);
      if (!levelTagMatches(tags, entry.level)) {
        missingLevelTags.push(id);
      }
      // Check for correct spell-card HTML layout
      if (!md.includes('<div class="spell-card">') || !md.includes('spell-card-stats-grid')) {
        incorrectLayout.push(id);
      }
    } catch (e) {
      missingGlossary.push(id);
    }
  });

  // Check for underscore-named files (should use kebab-case)
  const underscoreFiles: string[] = [];
  const levelDirs = fs.readdirSync(GLOSSARY_BASE).filter((d) => d.startsWith('level-'));
  levelDirs.forEach((levelDir) => {
    const dirPath = path.join(GLOSSARY_BASE, levelDir);
    if (fs.statSync(dirPath).isDirectory()) {
      fs.readdirSync(dirPath).forEach((file) => {
        if (file.endsWith('.md') && file.includes('_')) {
          underscoreFiles.push(`${levelDir}/${file}`);
        }
      });
    }
  });
  // Also check root for stray underscore files
  fs.readdirSync(GLOSSARY_BASE).forEach((file) => {
    const filePath = path.join(GLOSSARY_BASE, file);
    if (fs.statSync(filePath).isFile() && file.endsWith('.md') && file.includes('_')) {
      underscoreFiles.push(file);
    }
  });

  if (missingFromManifest.length === 0 && missingGlossary.length === 0 && missingLevelTags.length === 0 && underscoreFiles.length === 0 && incorrectLayout.length === 0) {
    console.log('[Spell Integrity] All checks passed: class lists match manifest, glossary cards/tags present.');
    return;
  }

  console.error('[Spell Integrity] Issues detected:');
  if (missingFromManifest.length > 0) {
    console.error(`  - Class spell lists reference ${missingFromManifest.length} missing IDs:`);
    missingFromManifest.slice(0, 10).forEach((m) => console.error(`      ${m.classId}: ${m.spellId}`));
    if (missingFromManifest.length > 10) console.error(`      ...and ${missingFromManifest.length - 10} more`);
  }
  if (missingGlossary.length > 0) {
    console.error(`  - Missing glossary cards: ${missingGlossary.length}`);
    console.error(`      ${missingGlossary.slice(0, 10).join(', ')}` + (missingGlossary.length > 10 ? ' ...' : ''));
  }
  if (missingLevelTags.length > 0) {
    console.error(`  - Missing level tags in glossary frontmatter: ${missingLevelTags.length}`);
    console.error(`      ${missingLevelTags.slice(0, 10).join(', ')}` + (missingLevelTags.length > 10 ? ' ...' : ''));
  }
  if (underscoreFiles.length > 0) {
    console.error(`  - Underscore filenames (should use kebab-case): ${underscoreFiles.length}`);
    console.error(`      ${underscoreFiles.slice(0, 10).join(', ')}` + (underscoreFiles.length > 10 ? ' ...' : ''));
  }
  if (incorrectLayout.length > 0) {
    console.error(`  - Incorrect layout (missing spell-card HTML): ${incorrectLayout.length}`);
    console.error(`      ${incorrectLayout.slice(0, 10).join(', ')}` + (incorrectLayout.length > 10 ? ' ...' : ''));
  }

  process.exit(1);
};

main();
