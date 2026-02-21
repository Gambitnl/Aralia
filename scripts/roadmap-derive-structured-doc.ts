import fs from 'fs';
import path from 'path';

type SubFeatureState = 'done' | 'active' | 'planned' | 'unknown';

type ProcessingSubFeature = {
  name: string;
  state: SubFeatureState;
  canonicalPath?: string;
  level?: number;
  parent?: string;
};

type ProcessingDocument = {
  sourcePath: string;
  featureGroup: string;
  feature: string;
  subFeatures?: ProcessingSubFeature[];
  status?: string;
  allMdFilesAction?: string;
  canonicalPath?: string;
  processedAt?: string;
  notes?: string[];
};

type ProcessingManifest = {
  version: string;
  updatedAt?: string;
  workflowMode?: string;
  documents: ProcessingDocument[];
};

type DocLibrary = {
  version: string;
  updatedAt?: string;
  entries: Array<{
    id: string;
    title: string;
    featureGroup: string;
    status: string;
    completionState: SubFeatureState;
    sourcePath: string;
    canonicalPath: string;
    notes?: string[];
  }>;
};

type PathProvenance = {
  version: string;
  updatedAt?: string;
  mappings: Array<{
    sourcePath: string;
    canonicalPath: string;
    movedAt: string;
    method: string;
  }>;
};

type Section = {
  level: number;
  title: string;
  slug: string;
  ancestors: string[];
  contentLines: string[];
  children: Section[];
};

type SectionWrite = {
  section: Section;
  canonicalPath: string;
};

type ItemWrite = {
  itemTitle: string;
  itemCanonicalPath: string;
  headingPath: string;
  parentCanonicalPath: string;
};

const ROADMAP_LOCAL_ROOT = path.resolve(process.cwd(), '.agent/roadmap-local');
const PROCESSING_MANIFEST_PATH = path.join(ROADMAP_LOCAL_ROOT, 'processing_manifest.json');
const DOC_LIBRARY_PATH = path.join(ROADMAP_LOCAL_ROOT, 'doc_library.json');
const PATH_PROVENANCE_PATH = path.join(ROADMAP_LOCAL_ROOT, 'path_provenance.json');
const FEATURES_ROOT = path.join(ROADMAP_LOCAL_ROOT, 'features');

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')) as T;
}

function writeJson(filePath: string, value: unknown) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[`"'“”‘’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeState(value?: string): SubFeatureState {
  const v = (value || '').toLowerCase();
  if (v.includes('done') || v.includes('complete') || v.includes('verified')) return 'done';
  if (v.includes('active') || v.includes('ongoing') || v.includes('in progress')) return 'active';
  if (v.includes('planned') || v.includes('pending') || v.includes('concept')) return 'planned';
  return 'unknown';
}

function parseSections(markdown: string): Section[] {
  const sections: Section[] = [];
  const stack: Section[] = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    const match = line.match(/^(#{2,4})\s+(.*)$/);
    if (match) {
      const level = match[1].length;
      const rawTitle = match[2].trim();
      const title = rawTitle.replace(/\s+/g, ' ');
      const slug = slugify(title) || `section-${sections.length + 1}`;

      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const ancestors = stack.map((s) => s.title);
      const section: Section = {
        level,
        title,
        slug,
        ancestors,
        contentLines: [],
        children: []
      };

      if (stack.length > 0) stack[stack.length - 1].children.push(section);
      else sections.push(section);
      stack.push(section);
      continue;
    }

    if (stack.length > 0) {
      stack[stack.length - 1].contentLines.push(line);
    }
  }

  return sections;
}

function flattenSections(sections: Section[]): Section[] {
  const out: Section[] = [];
  const visit = (section: Section) => {
    out.push(section);
    for (const child of section.children) visit(child);
  };
  for (const section of sections) visit(section);
  return out;
}

function sanitizeInlineMarkdown(value: string): string {
  return value
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTopLevelListItems(contentLines: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const line of contentLines) {
    const match = line.match(/^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (!match) continue;

    const indent = match[1].length;
    if (indent > 2) continue;

    const raw = sanitizeInlineMarkdown(match[2]).replace(/[.:;,\s]+$/g, '').trim();
    if (!raw || raw.length < 4) continue;

    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }

  return out;
}

function writeItemDocsForSection(
  section: Section,
  sectionCanonicalPath: string,
  sourcePath: string
): ItemWrite[] {
  const sectionAbs = path.resolve(process.cwd(), sectionCanonicalPath);
  const sectionDir = path.dirname(sectionAbs);
  const items = parseTopLevelListItems(section.contentLines);
  if (items.length === 0) return [];

  const headingPath = [...section.ancestors, section.title].join(' > ');
  const itemWrites: ItemWrite[] = [];

  for (const itemTitle of items) {
    const itemSlug = slugify(itemTitle) || `item-${itemWrites.length + 1}`;
    const itemDir = path.join(sectionDir, 'items', itemSlug);
    ensureDir(itemDir);
    const itemIndex = path.join(itemDir, 'INDEX.md');
    const itemCanonicalPath = path.relative(process.cwd(), itemIndex).replace(/\\/g, '/');
    const sectionIndexRel = path.relative(itemDir, sectionAbs).replace(/\\/g, '/');

    const lines: string[] = [];
    lines.push(`# ${itemTitle}`);
    lines.push('');
    lines.push(`**Derived From**: \`${sourcePath}\``);
    lines.push(`**Heading Path**: \`${headingPath}\``);
    lines.push(`**Parent Section**: [${section.title}](${sectionIndexRel})`);
    lines.push('');
    lines.push('## Source Item');
    lines.push('');
    lines.push(`- ${itemTitle}`);
    lines.push('');

    fs.writeFileSync(itemIndex, `${lines.join('\n').trimEnd()}\n`, 'utf8');
    itemWrites.push({
      itemTitle,
      itemCanonicalPath,
      headingPath,
      parentCanonicalPath: sectionCanonicalPath
    });
  }

  return itemWrites;
}

function writeSectionDocs(
  sections: Section[],
  baseDir: string,
  sourcePath: string
): SectionWrite[] {
  const out: SectionWrite[] = [];
  const writeOne = (section: Section, parentDir: string) => {
    const sectionDir = path.join(parentDir, section.slug);
    ensureDir(sectionDir);
    const sectionIndex = path.join(sectionDir, 'INDEX.md');
    const canonicalRel = path.relative(process.cwd(), sectionIndex).replace(/\\/g, '/');

    const headingPath = [...section.ancestors, section.title].join(' > ');
    const lines: string[] = [];
    lines.push(`# ${section.title}`);
    lines.push('');
    lines.push(`**Derived From**: \`${sourcePath}\``);
    lines.push(`**Heading Path**: \`${headingPath}\``);
    lines.push('');
    const trimmedBody = section.contentLines.join('\n').trim();
    if (trimmedBody.length > 0) {
      lines.push(trimmedBody);
      lines.push('');
    } else {
      lines.push('_No direct body text under this heading._');
      lines.push('');
    }

    if (section.children.length > 0) {
      lines.push('## Children');
      lines.push('');
      for (const child of section.children) {
        lines.push(`- [${child.title}](./${child.slug}/INDEX.md)`);
      }
      lines.push('');
    }

    fs.writeFileSync(sectionIndex, `${lines.join('\n').trimEnd()}\n`, 'utf8');
    out.push({ section, canonicalPath: canonicalRel });

    for (const child of section.children) {
      writeOne(child, sectionDir);
    }
  };

  for (const section of sections) {
    writeOne(section, baseDir);
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const sourceArg = args.find((arg) => arg.startsWith('--source='))?.slice('--source='.length);
  const mainSlugArg = args.find((arg) => arg.startsWith('--main='))?.slice('--main='.length);
  const mainTitleArg = args.find((arg) => arg.startsWith('--title='))?.slice('--title='.length);

  if (!sourceArg) {
    console.error('Usage: npx tsx scripts/roadmap-derive-structured-doc.ts --source=docs/tasks/... [--main=slug] [--title=Title]');
    process.exit(1);
  }

  const sourcePath = sourceArg.replace(/\\/g, '/');
  const sourceAbs = path.resolve(process.cwd(), sourcePath);
  if (!fs.existsSync(sourceAbs)) {
    console.error(`Source file does not exist: ${sourcePath}`);
    process.exit(1);
  }

  const processingManifest = readJson<ProcessingManifest>(PROCESSING_MANIFEST_PATH);
  const docLibrary = readJson<DocLibrary>(DOC_LIBRARY_PATH);
  const provenance = readJson<PathProvenance>(PATH_PROVENANCE_PATH);

  const manifestEntry = processingManifest.documents.find((doc) => doc.sourcePath === sourcePath);
  if (!manifestEntry) {
    console.error(`Could not find manifest entry for sourcePath: ${sourcePath}`);
    process.exit(1);
  }

  const markdown = fs.readFileSync(sourceAbs, 'utf8');
  const h1Match = markdown.match(/^#\s+(.*)$/m);
  const h1Title = h1Match?.[1]?.trim() || path.basename(sourcePath).replace(/\.md$/i, '');

  const mainSlug = mainSlugArg || (
    sourcePath.toLowerCase().includes('/3d-exploration/') && sourcePath.toLowerCase().endsWith('/implementation_plan.md')
      ? 'world-map-redesign'
      : slugify(h1Title)
  );
  const mainTitle = mainTitleArg || (
    sourcePath.toLowerCase().includes('/3d-exploration/') && sourcePath.toLowerCase().endsWith('/implementation_plan.md')
      ? 'World Map Redesign'
      : h1Title
  );

  const featureRoot = path.join(FEATURES_ROOT, manifestEntry.featureGroup);
  const structuredRoot = path.join(featureRoot, 'structured', mainSlug);
  ensureDir(structuredRoot);

  const sourceMirrorPath = path.join(structuredRoot, 'SOURCE.md');
  fs.writeFileSync(sourceMirrorPath, markdown, 'utf8');

  const sections = parseSections(markdown);
  if (sections.length === 0) {
    console.error('No level-2+ headings found. Nothing to derive.');
    process.exit(1);
  }

  const written = writeSectionDocs(sections, structuredRoot, sourcePath);
  const itemWrites: ItemWrite[] = [];
  for (const sectionWrite of written) {
    itemWrites.push(...writeItemDocsForSection(sectionWrite.section, sectionWrite.canonicalPath, sourcePath));
  }
  const writtenByHeading = new Map(
    written.map((item) => [
      [...item.section.ancestors, item.section.title].join(' > '),
      item.canonicalPath
    ])
  );

  const rootIndexPath = path.join(structuredRoot, 'INDEX.md');
  const rootIndexRel = path.relative(process.cwd(), rootIndexPath).replace(/\\/g, '/');
  const indexLines: string[] = [];
  indexLines.push(`# ${mainTitle}`);
  indexLines.push('');
  indexLines.push(`**Feature Group**: \`${manifestEntry.featureGroup}\``);
  indexLines.push(`**Source Doc**: \`${sourcePath}\``);
  indexLines.push(`**Generated At**: ${new Date().toISOString()}`);
  indexLines.push('');
  indexLines.push('## Structured Sections');
  indexLines.push('');
  const flatSections = flattenSections(sections);
  for (const section of flatSections) {
    const headingPath = [...section.ancestors, section.title].join(' > ');
    const rel = writtenByHeading.get(headingPath);
    if (!rel) continue;
    const relFromRoot = path.relative(path.dirname(rootIndexPath), path.resolve(process.cwd(), rel)).replace(/\\/g, '/');
    indexLines.push(`- [${headingPath}](${relFromRoot})`);
    const sectionItems = itemWrites.filter((item) => item.headingPath === headingPath);
    for (const sectionItem of sectionItems) {
      const itemRelFromRoot = path.relative(
        path.dirname(rootIndexPath),
        path.resolve(process.cwd(), sectionItem.itemCanonicalPath)
      ).replace(/\\/g, '/');
      indexLines.push(`  - [${sectionItem.itemTitle}](${itemRelFromRoot})`);
    }
  }
  indexLines.push('');
  indexLines.push('## Source');
  indexLines.push('');
  indexLines.push(`- [Original Source Mirror](./SOURCE.md)`);
  indexLines.push('');
  fs.writeFileSync(rootIndexPath, `${indexLines.join('\n').trimEnd()}\n`, 'utf8');

  const fallbackState =
    manifestEntry.subFeatures?.[0]?.state ||
    normalizeState(manifestEntry.status);
  manifestEntry.canonicalPath = rootIndexRel;
  const sectionSubFeatures: ProcessingSubFeature[] = flatSections.map((section) => {
    const headingPath = [...section.ancestors, section.title].join(' > ');
    const parent = section.ancestors.length > 0 ? section.ancestors.join(' > ') : undefined;
    return {
      name: headingPath,
      state: fallbackState,
      canonicalPath: writtenByHeading.get(headingPath),
      level: section.level,
      parent
    };
  });
  const itemSubFeatures: ProcessingSubFeature[] = itemWrites.map((item) => {
    const parentSection = flatSections.find((section) => [...section.ancestors, section.title].join(' > ') === item.headingPath);
    const parentLevel = parentSection?.level ?? 3;
    return {
      name: `${item.headingPath} > ${item.itemTitle}`,
      state: fallbackState,
      canonicalPath: item.itemCanonicalPath,
      level: parentLevel + 1,
      parent: item.headingPath
    };
  });
  manifestEntry.subFeatures = [...sectionSubFeatures, ...itemSubFeatures];

  const note = `Derived structured hierarchy into ${rootIndexRel} at ${new Date().toISOString()}`;
  manifestEntry.notes = Array.from(new Set([...(manifestEntry.notes ?? []), note]));
  manifestEntry.processedAt = new Date().toISOString().slice(0, 10);
  processingManifest.updatedAt = manifestEntry.processedAt;

  const libEntry = docLibrary.entries.find((entry) => entry.sourcePath === sourcePath);
  if (libEntry) {
    libEntry.canonicalPath = rootIndexRel;
    libEntry.notes = Array.from(new Set([...(libEntry.notes ?? []), note]));
  }
  docLibrary.updatedAt = processingManifest.updatedAt;

  const mappingExists = provenance.mappings.some(
    (m) => m.sourcePath === sourcePath && m.canonicalPath === rootIndexRel
  );
  if (!mappingExists) {
    provenance.mappings.push({
      sourcePath,
      canonicalPath: rootIndexRel,
      movedAt: processingManifest.updatedAt || '',
      method: 'derived_structured_split'
    });
  }
  provenance.updatedAt = processingManifest.updatedAt;

  writeJson(PROCESSING_MANIFEST_PATH, processingManifest);
  writeJson(DOC_LIBRARY_PATH, docLibrary);
  writeJson(PATH_PROVENANCE_PATH, provenance);

  console.log(`Derived ${flatSections.length} structured sections and ${itemWrites.length} list-item children from ${sourcePath}`);
  console.log(`Root index: ${rootIndexRel}`);
}

main();
