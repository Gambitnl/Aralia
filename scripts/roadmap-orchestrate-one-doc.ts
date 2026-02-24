import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { validateRunPacket, type Report, type RunManifest } from './roadmap-packet-validation.js';

/**
 * Technical:
 * This script is the orchestrator entrypoint for "one doc at a time" roadmap processing.
 * It creates a run folder, generates a strict worker prompt, launches an external worker CLI,
 * validates the produced packet against schemas, enforces feature-oriented naming guards, and
 * optionally applies accepted runs through the existing session-close pipeline.
 *
 * Layman:
 * This is the controller that gives one document to one AI worker, checks the worker output is
 * valid and named correctly, and only then lets the roadmap update process continue.
 */

// ============================================================================
// Paths and Constants
// ============================================================================
// Technical: shared filesystem roots used by the orchestrator.
// Layman: where run artifacts, source doc queues, and roadmap files live.
// ============================================================================
const ROADMAP_LOCAL_ROOT = path.resolve(process.cwd(), '.agent/roadmap-local');
const RUNS_ROOT = path.join(ROADMAP_LOCAL_ROOT, 'runs');
const ALL_MD_FILES_PATH = path.resolve(process.cwd(), 'docs/@ALL-MD-FILES.md');

// Technical: naming blockers for process-only labels that should never become roadmap features.
// Layman: these are the generic names we reject so the roadmap stays feature-focused.
const GENERIC_NAME_PATTERNS: RegExp[] = [
  /^overview$/i,
  /^summary$/i,
  /^deliverables?$/i,
  /^acceptance criteria$/i,
  /^implementation plan$/i,
  /^implementation steps$/i,
  /^workflow$/i,
  /^readme$/i,
  /^task template$/i,
  /^start here$/i,
  /^context$/i,
  /^notes?$/i,
  /^verification$/i,
  /^verification plan$/i,
  /^open questions?$/i,
  /^dependencies$/i,
  /^objectives?$/i,
  /^goals?$/i
];

type OrchestratorArgs = {
  source?: string;
  next: boolean;
  sessionId?: string;
  runId?: string;
  workerCmd?: string;
  workerModel?: string;
  autoAccept: boolean;
  autoApply: boolean;
  dryRun: boolean;
};

type WorkerContext = {
  runId: string;
  sessionId: string;
  docId: string;
  sourceDoc: string;
  runDir: string;
  manifestPath: string;
  reportPath: string;
  patchPath: string;
  movePlanPath: string;
  promptPath: string;
};

function usage(exitCode = 1): never {
  console.error(
    [
      'Usage:',
      '  tsx scripts/roadmap-orchestrate-one-doc.ts --source <docs/tasks/...md> [options]',
      '  tsx scripts/roadmap-orchestrate-one-doc.ts --next [options]',
      '',
      'Options:',
      '  --session <id>       Override session id (default: session-YYYY-MM-DD-doc-processing)',
      '  --run <id>           Override run id',
      '  --worker-cmd "<cmd>" Command template for worker launch (required unless --dry-run)',
      '  --worker-model <id>  Label stored in run_manifest.worker_model',
      '  --auto-accept        Set review_result=accepted when packet + naming guards pass',
      '  --auto-apply         Run session-close apply after accepted packet',
      '  --dry-run            Stage run + prompt, but do not launch worker/apply',
      '',
      'Worker command placeholders:',
      '  {{RUN_ID}} {{SESSION_ID}} {{DOC_ID}} {{SOURCE_DOC}} {{RUN_DIR}}',
      '  {{PROMPT_FILE}} {{MANIFEST_PATH}} {{REPORT_PATH}} {{PATCH_PATH}} {{MOVE_PLAN_PATH}}'
    ].join('\n')
  );
  process.exit(exitCode);
}

function parseArgs(): OrchestratorArgs {
  const args = process.argv.slice(2);
  const parsed: OrchestratorArgs = {
    next: false,
    autoAccept: false,
    autoApply: false,
    dryRun: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--source') {
      parsed.source = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--next') {
      parsed.next = true;
      continue;
    }
    if (arg === '--session') {
      parsed.sessionId = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--run') {
      parsed.runId = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--worker-cmd') {
      parsed.workerCmd = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--worker-model') {
      parsed.workerModel = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--auto-accept') {
      parsed.autoAccept = true;
      continue;
    }
    if (arg === '--auto-apply') {
      parsed.autoApply = true;
      continue;
    }
    if (arg === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') usage(0);
  }

  if (!parsed.source && !parsed.next) {
    console.error('Provide --source or --next.');
    usage();
  }
  if (parsed.source && parsed.next) {
    console.error('Use either --source or --next, not both.');
    usage();
  }
  if (!parsed.dryRun && !parsed.workerCmd) {
    console.error('--worker-cmd is required unless --dry-run is used.');
    usage();
  }

  return parsed;
}

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
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function sanitizeBulletPath(line: string): string | null {
  const cleaned = line
    .replace(/^\s*-\s*/, '')
    .replace(/^\[PROCESSED\]\s*/i, '')
    .trim();
  if (!cleaned) return null;
  return cleaned.replace(/\\/g, '/');
}

function isGameDocPath(sourcePath: string): boolean {
  const normalized = sourcePath.toLowerCase();
  return normalized.startsWith('docs/tasks/')
    && !normalized.includes('/roadmap/')
    && !normalized.includes('/documentation-cleanup/');
}

function pickNextQueuedDoc(): string {
  if (!fs.existsSync(ALL_MD_FILES_PATH)) {
    throw new Error(`Cannot find queue file: ${ALL_MD_FILES_PATH}`);
  }

  const lines = fs.readFileSync(ALL_MD_FILES_PATH, 'utf8').split('\n');
  const candidates = lines
    .map(sanitizeBulletPath)
    .filter((value): value is string => Boolean(value))
    .filter(isGameDocPath);

  if (candidates.length === 0) {
    throw new Error('No eligible docs found in docs/@ALL-MD-FILES.md');
  }
  return candidates[0];
}

function buildWorkerPrompt(context: WorkerContext): string {
  /**
   * Technical:
   * The worker receives strict output contracts (run_manifest/report/patch/move_plan) and must
   * write files directly into runDir. This prompt intentionally forbids canonical writes.
   *
   * Layman:
   * We tell the worker exactly what files to produce, what naming style is allowed, and that it
   * is never allowed to edit final docs directly.
   */
  return [
    '# Roadmap Worker Task (Single Doc, Strict Contract)',
    '',
    'You are processing exactly one source document for roadmap feature extraction.',
    '',
    '## Run Context',
    `- run_id: ${context.runId}`,
    `- session_id: ${context.sessionId}`,
    `- doc_id: ${context.docId}`,
    `- source_doc: ${context.sourceDoc}`,
    '',
    '## Hard Rules',
    '- Read the source doc fully before producing output.',
    '- Do not edit canonical docs directly.',
    '- Write output files ONLY inside the provided run directory.',
    '- Use feature-oriented naming ("what capability exists"), not process headings.',
    '- Generic names are forbidden (e.g., Deliverables, Acceptance Criteria, Workflow, Summary).',
    '- If blocked, emit blocked manifest and questions, then stop.',
    '',
    '## Required Output Files (exact paths)',
    `- ${context.manifestPath}`,
    `- ${context.reportPath}`,
    `- ${context.patchPath}`,
    `- ${context.movePlanPath} (only if move/split is needed)`,
    '',
    '## JSON Schemas',
    '- docs/tasks/roadmap/schemas/run_manifest.schema.json',
    '- docs/tasks/roadmap/schemas/report.schema.json',
    '- docs/tasks/roadmap/schemas/move_plan.schema.json',
    '',
    '## report.json minimum expectations',
    '- feature_extractions with feature and subfeatures',
    '- completion_claims with evidence refs',
    '- stale_claims with reasons',
    '- todo_proposals mapped to parent_feature/subfeature',
    '- uncertainties when facts are unclear',
    '',
    '## doc.patch.md',
    '- Provide the proposed canonical doc patch text for this doc scope only.',
    '',
    '## Completion Behavior',
    '- If successful: set run_manifest status=completed with finished_at.',
    '- If blocked: status=blocked with why_blocked and questions[].',
    '- If failed: status=failed with error_reason and finished_at.',
    ''
  ].join('\n');
}

function templateWorkerCommand(template: string, context: WorkerContext): string {
  const replacements: Record<string, string> = {
    RUN_ID: context.runId,
    SESSION_ID: context.sessionId,
    DOC_ID: context.docId,
    SOURCE_DOC: context.sourceDoc,
    RUN_DIR: context.runDir,
    PROMPT_FILE: context.promptPath,
    MANIFEST_PATH: context.manifestPath,
    REPORT_PATH: context.reportPath,
    PATCH_PATH: context.patchPath,
    MOVE_PLAN_PATH: context.movePlanPath
  };

  let command = template;
  for (const [key, value] of Object.entries(replacements)) {
    command = command.replaceAll(`{{${key}}}`, value);
  }
  return command;
}

async function runWorkerCommand(command: string): Promise<number> {
  return await new Promise<number>((resolve) => {
    const child = spawn(command, {
      shell: true,
      stdio: 'inherit',
      cwd: process.cwd()
    });
    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

function isGenericName(name: string): string | null {
  const normalized = name
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s>]/gu, ' ')
    .trim();
  for (const pattern of GENERIC_NAME_PATTERNS) {
    if (pattern.test(normalized)) {
      return `matches generic pattern: ${pattern.toString()}`;
    }
  }
  return null;
}

function validateFeatureOrientedNames(report: Report | null): string[] {
  if (!report) return ['report.json is missing for completed run'];

  const names = new Set<string>();
  for (const extraction of report.feature_extractions) {
    for (const sub of extraction.subfeatures) names.add(sub);
  }
  for (const claim of report.completion_claims) {
    if (claim.target_type === 'subfeature') names.add(claim.target_name);
  }

  const violations: string[] = [];
  for (const name of names) {
    const genericReason = isGenericName(name);
    if (genericReason) {
      violations.push(`"${name}" rejected: ${genericReason}`);
      continue;
    }
    const tokenCount = name.split(/\s+/).filter(Boolean).length;
    if (tokenCount < 2) {
      violations.push(`"${name}" rejected: too short for feature-oriented clarity`);
    }
  }
  return violations;
}

function writeStarterManifest(context: WorkerContext, workerModel: string) {
  const starter: RunManifest = {
    run_id: context.runId,
    session_id: context.sessionId,
    doc_id: context.docId,
    source_doc: context.sourceDoc,
    worker_model: workerModel,
    status: 'blocked',
    review_result: 'pending',
    roadmap_applied: false,
    started_at: new Date().toISOString(),
    why_blocked: 'Worker output pending.',
    questions: ['Initial manifest generated by orchestrator before worker execution.']
  };
  writeJson(context.manifestPath, starter);
}

function patchManifest(
  manifestPath: string,
  updater: (current: RunManifest) => RunManifest
): RunManifest {
  const current = readJson<RunManifest>(manifestPath);
  const next = updater(current);
  writeJson(manifestPath, next);
  return next;
}

function writeRunSummary(runDir: string, lines: string[]) {
  const summaryPath = path.join(runDir, 'orchestrator_summary.md');
  fs.writeFileSync(summaryPath, `${lines.join('\n').trimEnd()}\n`, 'utf8');
}

async function applyAcceptedRun(runId: string): Promise<number> {
  const command = `npx tsx scripts/roadmap-session-close.ts --run ${runId}`;
  return await runWorkerCommand(command);
}

async function main() {
  const args = parseArgs();
  ensureDir(RUNS_ROOT);

  const sourceDoc = (args.source ? args.source.replace(/\\/g, '/') : pickNextQueuedDoc()).trim();
  const sourceAbs = path.resolve(process.cwd(), sourceDoc);
  if (!fs.existsSync(sourceAbs)) {
    throw new Error(`Source doc not found: ${sourceDoc}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const defaultSessionId = `session-${today}-doc-processing`;
  const sessionId = args.sessionId || defaultSessionId;
  const docId = slugify(path.basename(sourceDoc, path.extname(sourceDoc)));
  const runId = args.runId || `run-${today}-${docId}-orchestrated`;
  const runDir = path.join(RUNS_ROOT, runId);
  ensureDir(runDir);

  const context: WorkerContext = {
    runId,
    sessionId,
    docId,
    sourceDoc,
    runDir,
    manifestPath: path.join(runDir, 'run_manifest.json'),
    reportPath: path.join(runDir, 'report.json'),
    patchPath: path.join(runDir, 'doc.patch.md'),
    movePlanPath: path.join(runDir, 'move_plan.json'),
    promptPath: path.join(runDir, 'worker_prompt.md')
  };

  const workerModel = args.workerModel || (args.workerCmd ? args.workerCmd.split(/\s+/)[0] : 'unspecified-worker');
  writeStarterManifest(context, workerModel);
  fs.writeFileSync(context.promptPath, `${buildWorkerPrompt(context)}\n`, 'utf8');

  const summaryLines: string[] = [];
  summaryLines.push('# Orchestrator Summary');
  summaryLines.push('');
  summaryLines.push(`- Run ID: \`${context.runId}\``);
  summaryLines.push(`- Session ID: \`${context.sessionId}\``);
  summaryLines.push(`- Source Doc: \`${context.sourceDoc}\``);
  summaryLines.push(`- Run Dir: \`${path.relative(process.cwd(), context.runDir).replace(/\\/g, '/')}\``);
  summaryLines.push(`- Worker Model Label: \`${workerModel}\``);

  if (args.dryRun) {
    summaryLines.push('- Mode: dry-run (worker launch skipped)');
    writeRunSummary(context.runDir, summaryLines);
    console.log(`Dry run staged. Prompt: ${context.promptPath}`);
    return;
  }

  const workerCommand = templateWorkerCommand(args.workerCmd!, context);
  summaryLines.push(`- Worker Command: \`${workerCommand}\``);
  console.log(`Launching worker for ${context.sourceDoc}`);
  const workerExitCode = await runWorkerCommand(workerCommand);
  summaryLines.push(`- Worker Exit Code: ${workerExitCode}`);

  // Technical: if the worker fails and leaves manifest in placeholder state, force failed status.
  // Layman: this prevents "half-broken" runs from looking valid.
  let manifest = readJson<RunManifest>(context.manifestPath);
  if (workerExitCode !== 0 && manifest.status === 'blocked' && manifest.why_blocked === 'Worker output pending.') {
    manifest = patchManifest(context.manifestPath, (current) => ({
      ...current,
      status: 'failed',
      finished_at: new Date().toISOString(),
      error_reason: `Worker command exited with code ${workerExitCode}`,
      why_blocked: undefined,
      questions: undefined
    }));
  }

  manifest = readJson<RunManifest>(context.manifestPath);

  if (manifest.status === 'completed') {
    try {
      const packet = validateRunPacket(context.runDir);
      const namingViolations = validateFeatureOrientedNames(packet.report);

      if (namingViolations.length > 0) {
        const violationsPath = path.join(context.runDir, 'naming_violations.json');
        writeJson(violationsPath, { run_id: context.runId, violations: namingViolations });
        manifest = patchManifest(context.manifestPath, (current) => ({
          ...current,
          review_result: 'needs_clarification'
        }));
        summaryLines.push(`- Naming Gate: FAILED (${namingViolations.length} violations)`);
        summaryLines.push(`- Violations File: \`${path.relative(process.cwd(), violationsPath).replace(/\\/g, '/')}\``);
      } else {
        manifest = patchManifest(context.manifestPath, (current) => ({
          ...current,
          review_result: args.autoAccept ? 'accepted' : 'pending'
        }));
        summaryLines.push('- Packet Validation: PASSED');
        summaryLines.push(`- Naming Gate: PASSED`);
        summaryLines.push(`- Review Result: ${args.autoAccept ? 'accepted' : 'pending'}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      manifest = patchManifest(context.manifestPath, (current) => ({
        ...current,
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_reason: `packet validation failed: ${message}`,
        review_result: 'rejected'
      }));
      summaryLines.push(`- Packet Validation: FAILED (${message})`);
    }
  } else if (manifest.status === 'blocked') {
    summaryLines.push(`- Worker Status: blocked`);
    summaryLines.push(`- Block Reason: ${manifest.why_blocked || 'n/a'}`);
    if (manifest.questions && manifest.questions.length > 0) {
      summaryLines.push('- Questions:');
      for (const question of manifest.questions) summaryLines.push(`  - ${question}`);
    }
  } else if (manifest.status === 'failed') {
    summaryLines.push(`- Worker Status: failed`);
    summaryLines.push(`- Error: ${manifest.error_reason || 'n/a'}`);
  }

  // Technical: auto-apply is allowed only when a run is accepted.
  // Layman: we only publish to roadmap manifests after explicit acceptance.
  if (args.autoApply) {
    const refreshed = readJson<RunManifest>(context.manifestPath);
    if (refreshed.review_result === 'accepted') {
      const applyExit = await applyAcceptedRun(context.runId);
      summaryLines.push(`- Auto Apply Exit: ${applyExit}`);
      if (applyExit !== 0) {
        summaryLines.push('- Auto Apply Result: FAILED');
      } else {
        summaryLines.push('- Auto Apply Result: SUCCESS');
      }
    } else {
      summaryLines.push('- Auto Apply Skipped: run is not accepted');
    }
  }

  writeRunSummary(context.runDir, summaryLines);
  console.log(`Run complete: ${context.runId}`);
  console.log(`Review artifacts in: ${context.runDir}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
