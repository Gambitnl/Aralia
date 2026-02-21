import fs from 'fs';
import path from 'path';

type SubFeatureState = 'done' | 'active' | 'planned' | 'unknown';

type ProcessingManifest = {
  version: string;
  updatedAt?: string;
  workflowMode?: string;
  documents: Array<{
    sourcePath: string;
    featureGroup: string;
    feature: string;
    subFeatures: Array<{ name: string; state: SubFeatureState }>;
    status: string;
    allMdFilesAction?: string;
    canonicalPath: string;
    processedAt?: string;
    notes?: string[];
  }>;
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

type RegistryDoc = {
  projectName: string;
  tags: string[];
  sourcePath: string;
  title: string;
  statusRaw: string;
};

const REGISTRY_PATH = path.resolve(process.cwd(), 'docs/@DOC-REGISTRY.md');
const ALL_MD_FILES_PATH = path.resolve(process.cwd(), 'docs/@ALL-MD-FILES.md');
const ROADMAP_LOCAL_ROOT = path.resolve(process.cwd(), '.agent/roadmap-local');
const PROCESSING_MANIFEST_PATH = path.join(ROADMAP_LOCAL_ROOT, 'processing_manifest.json');
const DOC_LIBRARY_PATH = path.join(ROADMAP_LOCAL_ROOT, 'doc_library.json');
const PATH_PROVENANCE_PATH = path.join(ROADMAP_LOCAL_ROOT, 'path_provenance.json');
const FEATURES_ROOT = path.join(ROADMAP_LOCAL_ROOT, 'features');

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')) as T;
}

function writeJson(filePath: string, value: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function mapFeature(sourcePath: string, projectName: string): { featureGroup: string; feature: string } {
  if (sourcePath.includes('/spell-system-overhaul/')) {
    return { featureGroup: 'spells', feature: 'Spells' };
  }
  if (sourcePath.includes('/spell-completeness-audit/')) {
    return { featureGroup: 'spells', feature: 'Spells' };
  }
  if (sourcePath.includes('/3d-exploration/')) {
    return { featureGroup: 'world-exploration-combat', feature: '3D Exploration & Combat' };
  }
  return { featureGroup: slugify(projectName), feature: projectName };
}

function normalizeStatus(statusRaw: string): SubFeatureState {
  const s = statusRaw.toLowerCase();
  if (s.includes('completed') || s.includes('retired') || s.includes('done')) return 'done';
  if (s.includes('active') || s.includes('ongoing') || s.includes('in progress')) return 'active';
  if (s.includes('pending') || s.includes('planned') || s.includes('concept')) return 'planned';
  return 'unknown';
}

function humanizeTitle(input: string): string {
  const base = input
    .replace(/\.md$/i, '')
    .replace(/^@+/, '')
    .replace(/~/g, '')
    .replace(/^[0-9]+[a-z]?[-_. ]+/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return base.length > 0 ? base : 'Untitled Feature Doc';
}

function sanitizeHeading(input: string): string {
  return input
    .replace(/\*\*/g, '')
    .replace(/^[0-9]+(?:\.[0-9]+)*[.)]\s*/, '')
    .replace(/^[^\p{L}\p{N}]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGenericHeading(value: string): boolean {
  const v = value.toLowerCase().trim();
  const genericPatterns = [
    /^overview$/,
    /^status$/,
    /^status overview$/,
    /^current status$/,
    /^implementation status$/,
    /^summary$/,
    /^executive summary$/,
    /^deliverable$/,
    /^deliverables$/,
    /^key deliverables$/,
    /^acceptance criteria$/,
    /^testing requirements$/,
    /^implementation steps$/,
    /^workflow$/,
    /^readme$/,
    /^start here$/,
    /^task template$/,
    /^context$/,
    /^notes$/,
    /^dependencies$/,
    /^verification$/,
    /^verification plan$/,
    /^objectives?$/,
    /^goals?$/,
    /^metadata$/,
    /^open questions?$/
  ];
  return genericPatterns.some((p) => p.test(v));
}

function extractSubFeatures(markdown: string, fallbackTitle: string, state: SubFeatureState): Array<{ name: string; state: SubFeatureState }> {
  const headings = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^##+\s+/.test(line))
    .map((line) => line.replace(/^##+\s+/, '').trim())
    .map(sanitizeHeading)
    .filter((h) => h.length > 0)
    .filter((h) => !isGenericHeading(h));

  const unique = new Map<string, string>();
  for (const heading of headings) {
    const key = heading.toLowerCase();
    if (!unique.has(key)) unique.set(key, heading);
  }

  const names = Array.from(unique.values()).slice(0, 8);
  if (names.length > 0) return names.map((name) => ({ name, state }));

  const h1 = markdown
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /^#\s+/.test(line));
  const fallback = sanitizeHeading(h1 ? h1.replace(/^#\s+/, '') : fallbackTitle);
  return [{ name: fallback.length > 0 ? fallback : humanizeTitle(fallbackTitle), state }];
}

function parseRegistryDocs(): RegistryDoc[] {
  const content = fs.readFileSync(REGISTRY_PATH, 'utf8');
  const blocks = content.split(/### Project: /).slice(1);
  const docs: RegistryDoc[] = [];

  for (const block of blocks) {
    const trimmedBlock = block.split('\n---')[0];
    const lines = trimmedBlock.split('\n');
    const projectName = lines[0].trim();

    const tagsMatch = trimmedBlock.match(/\*\*Tags\*\*: (.*)/);
    const tags = tagsMatch
      ? tagsMatch[1].split(',').map((t) => t.replace(/`/g, '').trim()).filter(Boolean)
      : [];

    const tableLines = lines.filter((line) => line.includes('|') && !line.includes('---'));
    for (const line of tableLines) {
      if (line.includes('Number') || line.includes('Document')) continue;
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
      if (cells.length < 3) continue;

      const numberCell = cells[0];
      const title = cells[1];
      const statusRaw = cells[2];
      const numberMatch = numberCell.match(/\[(.*?)\]\((.*?)\)/);
      if (!numberMatch) continue;

      const link = numberMatch[2].replace(/^\.\//, 'docs/');
      docs.push({ projectName, tags, sourcePath: link, title, statusRaw });
    }
  }

  return docs;
}

function isGamePath(sourcePath: string): boolean {
  const source = sourcePath.toLowerCase();
  if (!source.startsWith('docs/tasks/')) return false;
  if (source.includes('/roadmap/')) return false;
  if (source.includes('/documentation-cleanup/')) return false;
  return true;
}

function walkMarkdownFiles(dirPath: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dirPath)) return out;
  const stack = [dirPath];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        out.push(path.relative(process.cwd(), full).replace(/\\/g, '/'));
      }
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function getProjectNameFromPath(sourcePath: string): string {
  const normalized = sourcePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  // docs/tasks/<project-or-file>
  if (parts.length >= 4) {
    return parts[2].replace(/-/g, ' ');
  }
  return 'gameplay';
}

function appendOpenTasks(featureGroup: string, sourceDoc: string, markdown: string) {
  const unchecked = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- [ ] '))
    .map((line) => line.replace(/^- \[ \]\s*/, '').trim());

  if (unchecked.length === 0) return 0;

  const openTaskPath = path.join(FEATURES_ROOT, featureGroup, 'open_tasks.md');
  let content = '# Open Tasks\n\n';
  if (fs.existsSync(openTaskPath)) content = fs.readFileSync(openTaskPath, 'utf8');

  const newLines = unchecked
    .map((task) => `- [ ] ${task}`)
    .filter((line) => !content.includes(line));

  if (newLines.length === 0) return 0;

  const section = [
    '',
    `## Source: ${sourceDoc}`,
    ...newLines
  ].join('\n');

  ensureDir(path.dirname(openTaskPath));
  fs.writeFileSync(openTaskPath, `${content.trimEnd()}\n${section}\n`, 'utf8');
  return newLines.length;
}

function removeFromAllMdFiles(paths: string[]) {
  if (!fs.existsSync(ALL_MD_FILES_PATH)) return;
  const removeSet = new Set(paths.map((p) => p.replace(/\\/g, '/')));
  const lines = fs.readFileSync(ALL_MD_FILES_PATH, 'utf8').split('\n');
  const kept = lines.filter((line) => {
    const normalized = line.replace(/^\s*-\s*(\[PROCESSED\]\s*)?/, '').trim();
    return !removeSet.has(normalized);
  });
  fs.writeFileSync(ALL_MD_FILES_PATH, `${kept.join('\n')}\n`, 'utf8');
}

function main() {
  ensureDir(ROADMAP_LOCAL_ROOT);
  ensureDir(FEATURES_ROOT);

  const processingManifest = readJson<ProcessingManifest>(PROCESSING_MANIFEST_PATH, {
    version: '0.1.0',
    workflowMode: 'one_doc_at_a_time',
    documents: []
  });
  const docLibrary = readJson<DocLibrary>(DOC_LIBRARY_PATH, {
    version: '0.1.0',
    entries: []
  });
  const provenance = readJson<PathProvenance>(PATH_PROVENANCE_PATH, {
    version: '0.1.0',
    mappings: []
  });

  const registryDocs = parseRegistryDocs();
  const registryByPath = new Map(registryDocs.map((d) => [d.sourcePath, d]));
  const taskMdPaths = walkMarkdownFiles(path.resolve(process.cwd(), 'docs/tasks')).filter(isGamePath);

  const gameDocs: RegistryDoc[] = taskMdPaths.map((sourcePath) => {
    const fromRegistry = registryByPath.get(sourcePath);
    if (fromRegistry) return fromRegistry;
    return {
      projectName: getProjectNameFromPath(sourcePath),
      tags: [],
      sourcePath,
      title: humanizeTitle(path.basename(sourcePath)),
      statusRaw: 'Pending'
    };
  });
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  const processedPaths: string[] = [];
  let totalOpenTasksAdded = 0;

  console.log(`Processing ${gameDocs.length} game docs (one-by-one)...`);
  for (let i = 0; i < gameDocs.length; i++) {
    const doc = gameDocs[i];
    const sourceAbs = path.resolve(process.cwd(), doc.sourcePath);
    const { featureGroup, feature } = mapFeature(doc.sourcePath, doc.projectName);
    const canonicalPath = path.join(FEATURES_ROOT, featureGroup, 'docs', path.basename(doc.sourcePath));
    const canonicalRel = path.relative(process.cwd(), canonicalPath).replace(/\\/g, '/');
    const state = normalizeStatus(doc.statusRaw);

    console.log(`[${i + 1}/${gameDocs.length}] ${doc.sourcePath}`);
    if (!fs.existsSync(sourceAbs)) {
      console.log(`  ! missing source file, skipping`);
      continue;
    }

    const markdown = fs.readFileSync(sourceAbs, 'utf8');
    ensureDir(path.dirname(canonicalPath));
    fs.writeFileSync(canonicalPath, markdown, 'utf8');

    const subFeatures = extractSubFeatures(markdown, doc.title, state);
    totalOpenTasksAdded += appendOpenTasks(featureGroup, doc.sourcePath, markdown);

    const manifestEntry = processingManifest.documents.find((d) => d.sourcePath === doc.sourcePath);
    const note = `Processed from registry game-doc batch at ${nowIso}`;
    if (manifestEntry) {
      manifestEntry.featureGroup = featureGroup;
      manifestEntry.feature = feature;
      manifestEntry.subFeatures = subFeatures;
      manifestEntry.status = 'verified';
      manifestEntry.canonicalPath = canonicalRel;
      manifestEntry.processedAt = today;
      manifestEntry.allMdFilesAction = 'removed_entry';
      manifestEntry.notes = Array.from(new Set([...(manifestEntry.notes ?? []), note]));
    } else {
      processingManifest.documents.push({
        sourcePath: doc.sourcePath,
        featureGroup,
        feature,
        subFeatures,
        status: 'verified',
        allMdFilesAction: 'removed_entry',
        canonicalPath: canonicalRel,
        processedAt: today,
        notes: [note]
      });
    }

    const libraryEntry = docLibrary.entries.find((e) => e.sourcePath === doc.sourcePath);
    const libId = slugify(doc.sourcePath.replace(/^docs\//, '').replace(/\.md$/i, ''));
    if (libraryEntry) {
      libraryEntry.title = path.basename(doc.sourcePath);
      libraryEntry.featureGroup = featureGroup;
      libraryEntry.status = 'verified';
      libraryEntry.completionState = state;
      libraryEntry.canonicalPath = canonicalRel;
      libraryEntry.notes = Array.from(new Set([...(libraryEntry.notes ?? []), note]));
    } else {
      docLibrary.entries.push({
        id: libId,
        title: path.basename(doc.sourcePath),
        featureGroup,
        status: 'verified',
        completionState: state,
        sourcePath: doc.sourcePath,
        canonicalPath: canonicalRel,
        notes: [note]
      });
    }

    const mappingExists = provenance.mappings.some(
      (m) => m.sourcePath === doc.sourcePath && m.canonicalPath === canonicalRel
    );
    if (!mappingExists) {
      provenance.mappings.push({
        sourcePath: doc.sourcePath,
        canonicalPath: canonicalRel,
        movedAt: today,
        method: 'copied_with_provenance_reference'
      });
    }

    processedPaths.push(doc.sourcePath);
  }

  processingManifest.updatedAt = today;
  docLibrary.updatedAt = today;
  provenance.updatedAt = today;

  writeJson(PROCESSING_MANIFEST_PATH, processingManifest);
  writeJson(DOC_LIBRARY_PATH, docLibrary);
  writeJson(PATH_PROVENANCE_PATH, provenance);
  removeFromAllMdFiles(processedPaths);

  console.log(`Done. Processed ${processedPaths.length} docs, added ${totalOpenTasksAdded} open tasks.`);
}

main();
