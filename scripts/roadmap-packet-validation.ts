import fs from 'fs';
import path from 'path';
import Ajv2020, { type ErrorObject } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

export type RunStatus = 'blocked' | 'completed' | 'failed';

export type RunManifest = {
  run_id: string;
  session_id: string;
  doc_id: string;
  source_doc: string;
  worker_model: string;
  status: RunStatus;
  review_result?: 'pending' | 'accepted' | 'rejected' | 'needs_clarification';
  roadmap_applied?: boolean;
  started_at: string;
  finished_at?: string;
  why_blocked?: string;
  questions?: string[];
  error_reason?: string;
  applied_at?: string;
};

export type Report = {
  run_id: string;
  doc_id: string;
  source_doc: string;
  summary?: string;
  feature_extractions: Array<{
    pillar?: string;
    feature: string;
    subfeatures: string[];
    evidence_refs?: EvidenceRef[];
  }>;
  completion_claims: Array<{
    target_type: 'feature' | 'subfeature' | 'component';
    target_name: string;
    state: 'done' | 'active' | 'planned' | 'unknown';
    rationale: string;
    evidence_refs?: EvidenceRef[];
  }>;
  stale_claims: Array<{
    claim_text: string;
    reason: string;
    proposed_replacement?: string;
    evidence_refs?: EvidenceRef[];
  }>;
  todo_proposals: Array<{
    title: string;
    parent_feature: string;
    parent_subfeature?: string;
    priority?: 'high' | 'medium' | 'low';
    reason: string;
    evidence_refs?: EvidenceRef[];
  }>;
  uncertainties: Array<{
    question: string;
    why_uncertain: string;
    blocking?: boolean;
  }>;
  confidence: 'low' | 'medium' | 'high';
};

export type MovePlan = {
  run_id: string;
  doc_id: string;
  source_doc: string;
  operation: 'move' | 'split';
  reason?: string;
  targets: Array<{
    new_path: string;
    feature_owner: string;
    sections?: string[];
    notes?: string;
  }>;
  provenance_map: Array<{
    source_doc: string;
    source_section?: string;
    target_path: string;
    target_section?: string;
  }>;
};

type EvidenceRef = {
  kind: 'doc' | 'code' | 'test' | 'other';
  path: string;
  line?: number;
  note?: string;
};

export type ValidatedPacket = {
  runDir: string;
  manifestPath: string;
  reportPath: string;
  patchPath: string;
  movePlanPath: string;
  manifest: RunManifest;
  report: Report | null;
  movePlan: MovePlan | null;
};

function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw) as T;
}

function loadSchema(filePath: string) {
  return readJson<Record<string, unknown>>(filePath);
}

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors || errors.length === 0) return [];
  return errors.map((err) => {
    const at = err.instancePath || '/';
    return `${at}: ${err.message ?? 'validation error'}`;
  });
}

function fail(message: string): never {
  throw new Error(message);
}

function ensureSchemaFiles(schemaDir: string) {
  const runManifestSchemaPath = path.join(schemaDir, 'run_manifest.schema.json');
  const reportSchemaPath = path.join(schemaDir, 'report.schema.json');
  const movePlanSchemaPath = path.join(schemaDir, 'move_plan.schema.json');
  const missingSchemas = [runManifestSchemaPath, reportSchemaPath, movePlanSchemaPath].filter(
    (p) => !fs.existsSync(p)
  );
  if (missingSchemas.length > 0) {
    fail(`Missing schema file(s):\n${missingSchemas.map((p) => `- ${p}`).join('\n')}`);
  }
  return { runManifestSchemaPath, reportSchemaPath, movePlanSchemaPath };
}

export function validateRunPacket(runDirInput: string): ValidatedPacket {
  const runDir = path.resolve(process.cwd(), runDirInput);
  if (!fs.existsSync(runDir) || !fs.statSync(runDir).isDirectory()) {
    fail(`Run directory not found: ${runDir}`);
  }

  const schemaDir = path.resolve(process.cwd(), 'docs/tasks/roadmap/schemas');
  const { runManifestSchemaPath, reportSchemaPath, movePlanSchemaPath } = ensureSchemaFiles(schemaDir);

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const runManifestSchema = loadSchema(runManifestSchemaPath);
  const reportSchema = loadSchema(reportSchemaPath);
  const movePlanSchema = loadSchema(movePlanSchemaPath);

  const validateRunManifest = ajv.compile(runManifestSchema);
  const validateReport = ajv.compile(reportSchema);
  const validateMovePlan = ajv.compile(movePlanSchema);

  const manifestPath = path.join(runDir, 'run_manifest.json');
  const reportPath = path.join(runDir, 'report.json');
  const patchPath = path.join(runDir, 'doc.patch.md');
  const movePlanPath = path.join(runDir, 'move_plan.json');

  if (!fs.existsSync(manifestPath)) {
    fail(`Missing required file: ${manifestPath}`);
  }

  const manifest = readJson<RunManifest>(manifestPath);
  const manifestOk = validateRunManifest(manifest);
  if (!manifestOk) {
    fail(
      `run_manifest.json failed schema validation:\n${formatErrors(validateRunManifest.errors)
        .map((line) => `- ${line}`)
        .join('\n')}`
    );
  }

  const requiresFullPacket = manifest.status === 'completed';
  if (requiresFullPacket) {
    if (!fs.existsSync(reportPath)) {
      fail(`Missing required file for completed run: ${reportPath}`);
    }
    if (!fs.existsSync(patchPath)) {
      fail(`Missing required file for completed run: ${patchPath}`);
    }
  }

  let report: Report | null = null;
  if (fs.existsSync(reportPath)) {
    report = readJson<Report>(reportPath);
    const reportOk = validateReport(report);
    if (!reportOk) {
      fail(
        `report.json failed schema validation:\n${formatErrors(validateReport.errors)
          .map((line) => `- ${line}`)
          .join('\n')}`
      );
    }
  }

  let movePlan: MovePlan | null = null;
  if (fs.existsSync(movePlanPath)) {
    movePlan = readJson<MovePlan>(movePlanPath);
    const movePlanOk = validateMovePlan(movePlan);
    if (!movePlanOk) {
      fail(
        `move_plan.json failed schema validation:\n${formatErrors(validateMovePlan.errors)
          .map((line) => `- ${line}`)
          .join('\n')}`
      );
    }
  }

  if (report) {
    if (report.run_id !== manifest.run_id) fail('Cross-file mismatch: report.run_id != run_manifest.run_id');
    if (report.doc_id !== manifest.doc_id) fail('Cross-file mismatch: report.doc_id != run_manifest.doc_id');
    if (report.source_doc !== manifest.source_doc) {
      fail('Cross-file mismatch: report.source_doc != run_manifest.source_doc');
    }
  }

  if (movePlan) {
    if (movePlan.run_id !== manifest.run_id) fail('Cross-file mismatch: move_plan.run_id != run_manifest.run_id');
    if (movePlan.doc_id !== manifest.doc_id) fail('Cross-file mismatch: move_plan.doc_id != run_manifest.doc_id');
    if (movePlan.source_doc !== manifest.source_doc) {
      fail('Cross-file mismatch: move_plan.source_doc != run_manifest.source_doc');
    }
  }

  return {
    runDir,
    manifestPath,
    reportPath,
    patchPath,
    movePlanPath,
    manifest,
    report,
    movePlan
  };
}
