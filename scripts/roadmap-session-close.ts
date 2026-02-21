import fs from 'fs';
import path from 'path';
import { validateRunPacket, type Report, type RunManifest, type ValidatedPacket } from './roadmap-packet-validation.js';

type ProcessingManifest = {
  version: string;
  updatedAt?: string;
  workflowMode?: string;
  pilotQueue?: string[];
  documents: Array<{
    sourcePath: string;
    featureGroup: string;
    feature: string;
    subFeatures: Array<{ name: string; state: 'done' | 'active' | 'planned' | 'unknown' }>;
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
    completionState: 'done' | 'active' | 'planned' | 'unknown';
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

type Args = {
  sessionId?: string;
  runId?: string;
  dryRun: boolean;
};

type SessionSummary = {
  appliedRuns: Array<{
    runId: string;
    sessionId: string;
    sourceDoc: string;
    canonicalPath: string;
    todoCount: number;
    warnings: string[];
  }>;
  skippedRuns: Array<{
    runId: string;
    reason: string;
  }>;
};

const ROADMAP_LOCAL_ROOT = path.resolve(process.cwd(), '.agent/roadmap-local');
const RUNS_ROOT = path.join(ROADMAP_LOCAL_ROOT, 'runs');
const FEATURES_ROOT = path.join(ROADMAP_LOCAL_ROOT, 'features');
const SESSION_REPORTS_ROOT = path.join(ROADMAP_LOCAL_ROOT, 'session_reports');

function usage(): never {
  console.error(
    'Usage: tsx scripts/roadmap-session-close.ts [--session <session-id>] [--run <run-id>] [--dry-run]'
  );
  process.exit(1);
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const parsed: Args = { dryRun: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--session') {
      parsed.sessionId = args[i + 1];
      i++;
    } else if (arg === '--run') {
      parsed.runId = args[i + 1];
      i++;
    } else if (arg === '--dry-run') {
      parsed.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
    }
  }

  if (parsed.runId && parsed.sessionId) {
    console.error('Use either --run or --session, not both.');
    process.exit(1);
  }

  return parsed;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')) as T;
}

function writeJson(filePath: string, value: unknown) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function safeRelativeToRoot(targetPath: string, rootPath: string): boolean {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(targetPath);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function getDefaultCanonicalPath(manifest: RunManifest, featureGroup: string): string {
  const fileName = path.basename(manifest.source_doc);
  return path.join(FEATURES_ROOT, featureGroup, 'docs', fileName);
}

function inferFeatureGroup(report: Report | null, manifest: RunManifest): string {
  const fromReport = report?.feature_extractions?.[0]?.feature;
  if (fromReport) return slugify(fromReport);
  return slugify(manifest.doc_id || path.basename(manifest.source_doc, '.md'));
}

function inferFeatureName(report: Report | null, manifest: RunManifest): string {
  return report?.feature_extractions?.[0]?.feature || manifest.doc_id || manifest.source_doc;
}

function inferCompletionState(report: Report | null): 'done' | 'active' | 'planned' | 'unknown' {
  const featureClaim = report?.completion_claims.find((claim) => claim.target_type === 'feature');
  return featureClaim?.state ?? 'active';
}

function collectSubFeatures(report: Report | null): Array<{ name: string; state: 'done' | 'active' | 'planned' | 'unknown' }> {
  if (!report) return [];
  const claimMap = new Map<string, 'done' | 'active' | 'planned' | 'unknown'>();
  report.completion_claims
    .filter((claim) => claim.target_type === 'subfeature')
    .forEach((claim) => claimMap.set(claim.target_name, claim.state));

  const names = new Set<string>();
  report.feature_extractions.forEach((fx) => fx.subfeatures.forEach((sub) => names.add(sub)));

  return Array.from(names).map((name) => ({
    name,
    state: claimMap.get(name) ?? 'unknown'
  }));
}

function appendOpenTasks(
  report: Report | null,
  sourceDoc: string,
  runId: string,
  dryRun: boolean
): number {
  if (!report || report.todo_proposals.length === 0) return 0;

  const grouped = new Map<string, Report['todo_proposals']>();
  report.todo_proposals.forEach((todo) => {
    const group = slugify(todo.parent_feature);
    const current = grouped.get(group) ?? [];
    current.push(todo);
    grouped.set(group, current);
  });

  let totalAdded = 0;
  for (const [featureGroup, todos] of grouped.entries()) {
    const featureDir = path.join(FEATURES_ROOT, featureGroup);
    const taskFile = path.join(featureDir, 'open_tasks.md');
    let content = '';
    if (fs.existsSync(taskFile)) {
      content = fs.readFileSync(taskFile, 'utf8');
    } else {
      content = `# Open Tasks - ${featureGroup}\n\n`;
    }

    const linesToAdd: string[] = [];
    todos.forEach((todo) => {
      const priorityPrefix = todo.priority ? `[${todo.priority.toUpperCase()}] ` : '';
      const line = `- [ ] ${priorityPrefix}${todo.title} - ${todo.reason}`;
      if (!content.includes(line)) {
        linesToAdd.push(line);
      }
    });

    if (linesToAdd.length === 0) continue;
    totalAdded += linesToAdd.length;
    const section = [
      '',
      `## Source Run: ${runId}`,
      `- Source Doc: \`${sourceDoc}\``,
      ...linesToAdd
    ].join('\n');

    if (!dryRun) {
      ensureDir(featureDir);
      fs.writeFileSync(taskFile, `${content.trimEnd()}\n${section}\n`, 'utf8');
    }
  }

  return totalAdded;
}

function applyRunPacket(packet: ValidatedPacket, args: Args): { canonicalPath: string; todoCount: number; warnings: string[] } {
  const warnings: string[] = [];
  const nowIso = new Date().toISOString();
  const nowDate = nowIso.slice(0, 10);
  const manifest = packet.manifest;
  const report = packet.report;
  const movePlan = packet.movePlan;

  const featureGroup = inferFeatureGroup(report, manifest);
  const featureName = inferFeatureName(report, manifest);
  const defaultCanonical = getDefaultCanonicalPath(manifest, featureGroup);
  let canonicalPath = defaultCanonical;

  if (movePlan && movePlan.operation === 'move' && movePlan.targets.length > 0) {
    canonicalPath = path.resolve(process.cwd(), movePlan.targets[0].new_path);
  } else if (movePlan && movePlan.operation === 'split') {
    warnings.push('Split move_plan detected; canonical doc write skipped (manual split integration required).');
  }

  if (!safeRelativeToRoot(canonicalPath, ROADMAP_LOCAL_ROOT)) {
    throw new Error(`Refusing to write canonical path outside roadmap-local root: ${canonicalPath}`);
  }

  // 1) Update canonical patch output (non-split only).
  if (manifest.status === 'completed' && movePlan?.operation !== 'split') {
    const patchContent = fs.readFileSync(packet.patchPath, 'utf8');
    if (!args.dryRun) {
      ensureDir(path.dirname(canonicalPath));
      fs.writeFileSync(canonicalPath, patchContent, 'utf8');
    }
  }

  // 2) Update processing manifest.
  const processingManifestPath = path.join(ROADMAP_LOCAL_ROOT, 'processing_manifest.json');
  const processingManifest = fs.existsSync(processingManifestPath)
    ? readJson<ProcessingManifest>(processingManifestPath)
    : { version: '0.1.0', documents: [] };

  const subFeatures = collectSubFeatures(report);
  const docEntry = processingManifest.documents.find((d) => d.sourcePath === manifest.source_doc);
  const note = `Applied from run ${manifest.run_id} at ${nowIso}`;

  if (docEntry) {
    docEntry.featureGroup = featureGroup;
    docEntry.feature = featureName;
    if (subFeatures.length > 0) docEntry.subFeatures = subFeatures;
    docEntry.status = 'verified';
    docEntry.canonicalPath = path.relative(process.cwd(), canonicalPath).replace(/\\/g, '/');
    docEntry.processedAt = nowDate;
    docEntry.notes = Array.from(new Set([...(docEntry.notes ?? []), note]));
  } else {
    processingManifest.documents.push({
      sourcePath: manifest.source_doc,
      featureGroup,
      feature: featureName,
      subFeatures,
      status: 'verified',
      allMdFilesAction: 'pending_manual_review',
      canonicalPath: path.relative(process.cwd(), canonicalPath).replace(/\\/g, '/'),
      processedAt: nowDate,
      notes: [note]
    });
  }
  processingManifest.updatedAt = nowDate;
  if (!args.dryRun) writeJson(processingManifestPath, processingManifest);

  // 3) Update doc library.
  const docLibraryPath = path.join(ROADMAP_LOCAL_ROOT, 'doc_library.json');
  const docLibrary = fs.existsSync(docLibraryPath)
    ? readJson<DocLibrary>(docLibraryPath)
    : { version: '0.1.0', entries: [] };

  const entry = docLibrary.entries.find((e) => e.sourcePath === manifest.source_doc);
  const completionState = inferCompletionState(report);
  const canonicalRel = path.relative(process.cwd(), canonicalPath).replace(/\\/g, '/');
  const title = path.basename(manifest.source_doc);

  if (entry) {
    entry.featureGroup = featureGroup;
    entry.status = 'verified';
    entry.completionState = completionState;
    entry.canonicalPath = canonicalRel;
    entry.notes = Array.from(new Set([...(entry.notes ?? []), note]));
  } else {
    docLibrary.entries.push({
      id: manifest.doc_id,
      title,
      featureGroup,
      status: 'verified',
      completionState,
      sourcePath: manifest.source_doc,
      canonicalPath: canonicalRel,
      notes: [note]
    });
  }
  docLibrary.updatedAt = nowDate;
  if (!args.dryRun) writeJson(docLibraryPath, docLibrary);

  // 4) Update path provenance.
  const provenancePath = path.join(ROADMAP_LOCAL_ROOT, 'path_provenance.json');
  const provenance = fs.existsSync(provenancePath)
    ? readJson<PathProvenance>(provenancePath)
    : { version: '0.1.0', mappings: [] };

  const mappingsToAdd: Array<{ sourcePath: string; canonicalPath: string; method: string }> = [];
  if (movePlan && movePlan.provenance_map.length > 0) {
    movePlan.provenance_map.forEach((map) => {
      mappingsToAdd.push({
        sourcePath: map.source_doc,
        canonicalPath: map.target_path,
        method: 'session_close_move_plan'
      });
    });
  } else {
    mappingsToAdd.push({
      sourcePath: manifest.source_doc,
      canonicalPath: canonicalRel,
      method: 'session_close_apply'
    });
  }

  mappingsToAdd.forEach((mapping) => {
    const exists = provenance.mappings.some(
      (m) => m.sourcePath === mapping.sourcePath && m.canonicalPath === mapping.canonicalPath
    );
    if (!exists) {
      provenance.mappings.push({
        sourcePath: mapping.sourcePath,
        canonicalPath: mapping.canonicalPath,
        movedAt: nowDate,
        method: mapping.method
      });
    }
  });
  provenance.updatedAt = nowDate;
  if (!args.dryRun) writeJson(provenancePath, provenance);

  // 5) Append open task files from TODO proposals.
  const todoCount = appendOpenTasks(report, manifest.source_doc, manifest.run_id, args.dryRun);

  // 6) Mark run manifest as applied.
  if (!args.dryRun) {
    manifest.roadmap_applied = true;
    manifest.applied_at = nowIso;
    writeJson(packet.manifestPath, manifest);
  }

  return { canonicalPath: canonicalRel, todoCount, warnings };
}

function getRunDirectories(args: Args): string[] {
  if (!fs.existsSync(RUNS_ROOT)) return [];

  if (args.runId) {
    const candidate = path.join(RUNS_ROOT, args.runId);
    if (!fs.existsSync(candidate)) {
      throw new Error(`Run not found: ${candidate}`);
    }
    return [candidate];
  }

  return fs
    .readdirSync(RUNS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(RUNS_ROOT, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function maybeReadManifest(runDir: string): RunManifest | null {
  const manifestPath = path.join(runDir, 'run_manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return readJson<RunManifest>(manifestPath);
  } catch {
    return null;
  }
}

function writeSessionReport(summary: SessionSummary, sessionKey: string, dryRun: boolean) {
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(SESSION_REPORTS_ROOT, `${sessionKey}-${stamp}.md`);

  const lines: string[] = [];
  lines.push('# Roadmap Session Close Report');
  lines.push('');
  lines.push(`- Generated: ${now.toISOString()}`);
  lines.push(`- Mode: ${dryRun ? 'dry-run' : 'apply'}`);
  lines.push(`- Applied Runs: ${summary.appliedRuns.length}`);
  lines.push(`- Skipped Runs: ${summary.skippedRuns.length}`);
  lines.push('');

  lines.push('## Applied Runs');
  lines.push('');
  if (summary.appliedRuns.length === 0) {
    lines.push('- None');
  } else {
    summary.appliedRuns.forEach((run) => {
      lines.push(`- Run \`${run.runId}\` (session \`${run.sessionId}\`)`);
      lines.push(`  - Source: \`${run.sourceDoc}\``);
      lines.push(`  - Canonical: \`${run.canonicalPath}\``);
      lines.push(`  - TODOs Added: ${run.todoCount}`);
      if (run.warnings.length > 0) {
        run.warnings.forEach((warning) => lines.push(`  - Warning: ${warning}`));
      }
    });
  }
  lines.push('');
  lines.push('## Skipped Runs');
  lines.push('');
  if (summary.skippedRuns.length === 0) {
    lines.push('- None');
  } else {
    summary.skippedRuns.forEach((run) => lines.push(`- \`${run.runId}\`: ${run.reason}`));
  }
  lines.push('');

  if (!dryRun) {
    ensureDir(SESSION_REPORTS_ROOT);
    fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
  }

  console.log(`Session report ${dryRun ? 'previewed' : 'written'}: ${reportPath}`);
}

function main() {
  const args = parseArgs();
  const summary: SessionSummary = { appliedRuns: [], skippedRuns: [] };
  const runs = getRunDirectories(args);

  if (runs.length === 0) {
    console.log('No run directories found.');
    process.exit(0);
  }

  for (const runDir of runs) {
    const fallbackRunId = path.basename(runDir);
    const manifest = maybeReadManifest(runDir);
    if (!manifest) {
      summary.skippedRuns.push({ runId: fallbackRunId, reason: 'missing or invalid run_manifest.json' });
      continue;
    }

    if (args.sessionId && manifest.session_id !== args.sessionId) {
      summary.skippedRuns.push({ runId: manifest.run_id, reason: `session mismatch (${manifest.session_id})` });
      continue;
    }
    if (manifest.review_result !== 'accepted') {
      summary.skippedRuns.push({ runId: manifest.run_id, reason: `review_result is ${manifest.review_result ?? 'pending'}` });
      continue;
    }
    if (manifest.roadmap_applied === true) {
      summary.skippedRuns.push({ runId: manifest.run_id, reason: 'already applied' });
      continue;
    }
    if (manifest.status !== 'completed') {
      summary.skippedRuns.push({ runId: manifest.run_id, reason: `status is ${manifest.status}, expected completed` });
      continue;
    }

    try {
      const packet = validateRunPacket(runDir);
      const result = applyRunPacket(packet, args);
      summary.appliedRuns.push({
        runId: packet.manifest.run_id,
        sessionId: packet.manifest.session_id,
        sourceDoc: packet.manifest.source_doc,
        canonicalPath: result.canonicalPath,
        todoCount: result.todoCount,
        warnings: result.warnings
      });
      console.log(`${args.dryRun ? 'DRY-RUN applied' : 'Applied'} run: ${packet.manifest.run_id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.skippedRuns.push({ runId: manifest.run_id, reason: `validation/apply error: ${message}` });
    }
  }

  const sessionKey = args.runId ? `run-${args.runId}` : args.sessionId ? `session-${args.sessionId}` : 'all-runs';
  writeSessionReport(summary, sessionKey, args.dryRun);

  const appliedCount = summary.appliedRuns.length;
  const skippedCount = summary.skippedRuns.length;
  console.log(`Session close complete. Applied: ${appliedCount}, Skipped: ${skippedCount}`);
}

main();
