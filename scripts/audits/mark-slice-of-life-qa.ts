#!/usr/bin/env npx tsx
import fs from "fs";
import path from "path";

type Gender = "male" | "female";
type VisualStatus = "pending" | "approved" | "rejected";
type UniquenessStatus = "pending" | "unique" | "keeper" | "non_keeper";

type FailureChecklist = {
  isSquare: boolean | null;
  isFullBody: boolean | null;
  isEdgeToEdge: boolean | null;
  isSliceOfLife: boolean | null;
  isCivilian: boolean | null;
  hasArrowsArtifact: boolean | null;
};

type QaEntry = {
  raceId: string;
  gender: Gender;
  // Legacy compatibility. New flows use visualStatus.
  status?: VisualStatus;
  visualStatus?: VisualStatus;
  uniquenessStatus?: UniquenessStatus;
  manualReviewRequired?: boolean;
  checklist?: Partial<FailureChecklist>;
  notes?: string;
  reviewedAt?: string;
  reviewer?: string;
  likelyScore?: number | null;
  likelyReason?: string | null;
  targetActivity?: string | null;
  observedActivity?: string | null;
};

type LedgerRow = {
  pairTag?: string;
  raceId: string;
  raceName: string;
  gender: Gender;
  illustrationPath: string | null;
  observedActivity?: string | null;
  needsRegen?: boolean;
  visualStatus?: VisualStatus;
  uniquenessStatus?: UniquenessStatus;
};

type BatchFile = {
  batchId?: string;
  entries?: QaEntry[];
};

const ROOT = process.cwd();
const QA_PATH = path.join(ROOT, "scripts", "audits", "slice-of-life-qa.json");
const LEDGER_PATH = path.join(ROOT, "scripts", "audits", "slice-of-life-settings.json");

const CHECKLIST_KEYS: Array<keyof FailureChecklist> = [
  "isSquare",
  "isFullBody",
  "isEdgeToEdge",
  "isSliceOfLife",
  "isCivilian",
  "hasArrowsArtifact",
];

function keyOf(raceId: string, gender: string): string {
  return `${raceId.trim().toLowerCase()}::${gender.trim().toLowerCase()}`;
}

function normalizeChecklist(value: Partial<FailureChecklist> | undefined): FailureChecklist {
  return {
    isSquare: typeof value?.isSquare === "boolean" ? value.isSquare : null,
    isFullBody: typeof value?.isFullBody === "boolean" ? value.isFullBody : null,
    isEdgeToEdge: typeof value?.isEdgeToEdge === "boolean" ? value.isEdgeToEdge : null,
    isSliceOfLife: typeof value?.isSliceOfLife === "boolean" ? value.isSliceOfLife : null,
    isCivilian: typeof value?.isCivilian === "boolean" ? value.isCivilian : null,
    hasArrowsArtifact: typeof value?.hasArrowsArtifact === "boolean" ? value.hasArrowsArtifact : null,
  };
}

function normalizeVisualStatus(value: string | undefined): VisualStatus {
  if (value === "approved" || value === "rejected" || value === "pending") return value;
  return "pending";
}

function normalizeUniquenessStatus(value: string | undefined): UniquenessStatus {
  if (value === "unique" || value === "keeper" || value === "non_keeper" || value === "pending") return value;
  return "pending";
}

function normalizeLikelyScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 1 || value > 5) return null;
  return Math.round(value);
}

function normalizeEntry(entry: QaEntry): QaEntry {
  return {
    raceId: entry.raceId,
    gender: entry.gender,
    status: normalizeVisualStatus(entry.visualStatus ?? entry.status),
    visualStatus: normalizeVisualStatus(entry.visualStatus ?? entry.status),
    uniquenessStatus: normalizeUniquenessStatus(entry.uniquenessStatus),
    manualReviewRequired: Boolean(entry.manualReviewRequired),
    checklist: normalizeChecklist(entry.checklist),
    notes: typeof entry.notes === "string" ? entry.notes : undefined,
    reviewedAt: typeof entry.reviewedAt === "string" ? entry.reviewedAt : undefined,
    reviewer: typeof entry.reviewer === "string" ? entry.reviewer : undefined,
    likelyScore: normalizeLikelyScore(entry.likelyScore),
    likelyReason: typeof entry.likelyReason === "string" && entry.likelyReason.trim() ? entry.likelyReason.trim() : null,
    targetActivity: typeof entry.targetActivity === "string" && entry.targetActivity.trim() ? entry.targetActivity.trim() : null,
    observedActivity: typeof entry.observedActivity === "string" && entry.observedActivity.trim() ? entry.observedActivity.trim() : null,
  };
}

function loadQaEntries(): QaEntry[] {
  if (!fs.existsSync(QA_PATH)) return [];
  const raw = JSON.parse(fs.readFileSync(QA_PATH, "utf8")) as { entries?: QaEntry[] };
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  return entries
    .filter((entry) => typeof entry.raceId === "string" && (entry.gender === "male" || entry.gender === "female"))
    .map(normalizeEntry);
}

function saveQaEntries(entries: QaEntry[]) {
  const out = entries
    .map(normalizeEntry)
    .sort((a, b) => keyOf(a.raceId, a.gender).localeCompare(keyOf(b.raceId, b.gender)));
  fs.mkdirSync(path.dirname(QA_PATH), { recursive: true });
  fs.writeFileSync(QA_PATH, JSON.stringify({ entries: out }, null, 2) + "\n", "utf8");
}

function loadLedgerRows(): LedgerRow[] {
  if (!fs.existsSync(LEDGER_PATH)) return [];
  const raw = JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8")) as { rows?: LedgerRow[] };
  return Array.isArray(raw.rows) ? raw.rows : [];
}

function parseFlagValue(args: string[], flag: string): string | null {
  const i = args.indexOf(flag);
  if (i === -1) return null;
  return args[i + 1] ?? null;
}

function parseTriState(args: string[], flag: string): boolean | null | undefined {
  const raw = parseFlagValue(args, flag);
  if (raw === null) return undefined;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "yes" || normalized === "true" || normalized === "1") return true;
  if (normalized === "no" || normalized === "false" || normalized === "0") return false;
  if (normalized === "skip" || normalized === "null") return null;
  throw new Error(`Invalid value for ${flag}: ${raw} (expected yes|no|skip)`);
}

function parseOptionalInt(args: string[], flag: string): number | null | undefined {
  const raw = parseFlagValue(args, flag);
  if (raw === null) return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) throw new Error(`Invalid integer for ${flag}: ${raw}`);
  return n;
}

function listNonRegenPending() {
  const rows = loadLedgerRows();
  const qaEntries = loadQaEntries();
  const qaByKey = new Map<string, QaEntry>();
  for (const entry of qaEntries) qaByKey.set(keyOf(entry.raceId, entry.gender), entry);

  const pending = rows.filter((row) => {
    if (row.needsRegen) return false;
    const qa = qaByKey.get(keyOf(row.raceId, row.gender));
    const visual = normalizeVisualStatus(qa?.visualStatus ?? qa?.status ?? row.visualStatus);
    return visual !== "approved";
  });

  console.log(`pending_non_regen_count=${pending.length}`);
  pending.forEach((row, i) => {
    const qa = qaByKey.get(keyOf(row.raceId, row.gender));
    const visual = normalizeVisualStatus(qa?.visualStatus ?? qa?.status ?? row.visualStatus);
    const uniq = normalizeUniquenessStatus(qa?.uniquenessStatus ?? row.uniquenessStatus);
    const notes = qa?.notes ?? "";
    const relPath = row.illustrationPath ?? "";
    const absPath = relPath ? path.join(ROOT, "public", relPath.replace(/^assets[\\/]/, "assets/")) : "";
    console.log(
      `${String(i + 1).padStart(3, "0")} ${row.pairTag ?? "-"} ${row.raceId} ${row.gender} visual=${visual} uniqueness=${uniq} activity="${row.observedActivity ?? ""}" path="${absPath}" notes="${notes}"`,
    );
  });
}

function upsert(args: string[]) {
  const raceId = args[1];
  const gender = args[2] as Gender | undefined;
  if (!raceId || (gender !== "male" && gender !== "female")) {
    throw new Error("Usage: --upsert <raceId> <male|female> [flags]");
  }

  const visualRaw = parseFlagValue(args, "--visual");
  const uniquenessRaw = parseFlagValue(args, "--uniqueness");
  const notes = parseFlagValue(args, "--notes");
  const reviewer = parseFlagValue(args, "--reviewer") ?? "codex";
  const manualReviewRaw = parseFlagValue(args, "--manual-review");
  const likelyScore = parseOptionalInt(args, "--likely-score");
  const likelyReason = parseFlagValue(args, "--likely-reason");
  const targetActivity = parseFlagValue(args, "--target-activity");
  const observedActivity = parseFlagValue(args, "--observed-activity");

  const checklistPatch: Partial<FailureChecklist> = {};
  const square = parseTriState(args, "--square");
  const fullBody = parseTriState(args, "--full-body");
  const edgeToEdge = parseTriState(args, "--edge-to-edge");
  const sliceOfLife = parseTriState(args, "--slice-of-life");
  const civilian = parseTriState(args, "--civilian");
  const arrows = parseTriState(args, "--arrows-artifact");
  if (square !== undefined) checklistPatch.isSquare = square;
  if (fullBody !== undefined) checklistPatch.isFullBody = fullBody;
  if (edgeToEdge !== undefined) checklistPatch.isEdgeToEdge = edgeToEdge;
  if (sliceOfLife !== undefined) checklistPatch.isSliceOfLife = sliceOfLife;
  if (civilian !== undefined) checklistPatch.isCivilian = civilian;
  if (arrows !== undefined) checklistPatch.hasArrowsArtifact = arrows;

  const hasAnyChange =
    visualRaw !== null ||
    uniquenessRaw !== null ||
    notes !== null ||
    manualReviewRaw !== null ||
    likelyScore !== undefined ||
    likelyReason !== null ||
    targetActivity !== null ||
    observedActivity !== null ||
    Object.keys(checklistPatch).length > 0;
  if (!hasAnyChange) {
    throw new Error("No updates specified. Provide at least one --visual/--uniqueness/--notes/... flag.");
  }

  const entries = loadQaEntries();
  const byKey = new Map<string, QaEntry>();
  for (const entry of entries) byKey.set(keyOf(entry.raceId, entry.gender), entry);

  const current = byKey.get(keyOf(raceId, gender)) ?? normalizeEntry({ raceId, gender });
  const next: QaEntry = { ...current };

  if (visualRaw !== null) {
    next.visualStatus = normalizeVisualStatus(visualRaw);
    next.status = next.visualStatus;
  }
  if (uniquenessRaw !== null) {
    next.uniquenessStatus = normalizeUniquenessStatus(uniquenessRaw);
  }
  if (manualReviewRaw !== null) {
    const normalized = manualReviewRaw.trim().toLowerCase();
    if (normalized !== "true" && normalized !== "false") {
      throw new Error(`Invalid --manual-review value: ${manualReviewRaw} (expected true|false)`);
    }
    next.manualReviewRequired = normalized === "true";
  }
  if (notes !== null) next.notes = notes;
  if (likelyScore !== undefined) next.likelyScore = normalizeLikelyScore(likelyScore);
  if (likelyReason !== null) next.likelyReason = likelyReason?.trim() ? likelyReason.trim() : null;
  if (targetActivity !== null) next.targetActivity = targetActivity?.trim() ? targetActivity.trim() : null;
  if (observedActivity !== null) next.observedActivity = observedActivity?.trim() ? observedActivity.trim() : null;
  if (Object.keys(checklistPatch).length > 0) {
    next.checklist = {
      ...normalizeChecklist(current.checklist),
      ...checklistPatch,
    };
  }
  next.reviewer = reviewer;
  next.reviewedAt = new Date().toISOString();

  byKey.set(keyOf(raceId, gender), normalizeEntry(next));
  saveQaEntries([...byKey.values()]);
  console.log(`updated ${raceId} ${gender}`);
}

function mergeBatch(args: string[]) {
  const batchPathArg = args[1];
  if (!batchPathArg) throw new Error("Usage: --merge-batch <path-to-batch-json> [--reviewer \"...\"]");
  const reviewer = parseFlagValue(args, "--reviewer");
  const batchPath = path.isAbsolute(batchPathArg) ? batchPathArg : path.join(ROOT, batchPathArg);
  if (!fs.existsSync(batchPath)) throw new Error(`Batch file not found: ${batchPath}`);

  const batch = JSON.parse(fs.readFileSync(batchPath, "utf8")) as BatchFile;
  const incoming = Array.isArray(batch.entries) ? batch.entries : [];
  const valid = incoming
    .filter((entry) => typeof entry.raceId === "string" && (entry.gender === "male" || entry.gender === "female"))
    .map(normalizeEntry);

  const entries = loadQaEntries();
  const byKey = new Map<string, QaEntry>();
  for (const entry of entries) byKey.set(keyOf(entry.raceId, entry.gender), entry);

  for (const entry of valid) {
    const k = keyOf(entry.raceId, entry.gender);
    const current = byKey.get(k);
    const merged: QaEntry = {
      ...(current ?? normalizeEntry({ raceId: entry.raceId, gender: entry.gender })),
      ...entry,
      checklist: {
        ...normalizeChecklist(current?.checklist),
        ...normalizeChecklist(entry.checklist),
      },
      reviewer: reviewer ?? entry.reviewer ?? current?.reviewer ?? "batch",
      reviewedAt: entry.reviewedAt ?? new Date().toISOString(),
    };
    byKey.set(k, normalizeEntry(merged));
  }

  saveQaEntries([...byKey.values()]);
  console.log(`merged_batch_entries=${valid.length}`);
  if (batch.batchId) console.log(`batch_id=${batch.batchId}`);
}

function printSummary() {
  const entries = loadQaEntries();
  const visual = { pending: 0, approved: 0, rejected: 0 };
  const uniq = { pending: 0, unique: 0, keeper: 0, non_keeper: 0 };
  let manual = 0;
  let checklistComplete = 0;

  for (const entry of entries) {
    visual[normalizeVisualStatus(entry.visualStatus ?? entry.status)] += 1;
    uniq[normalizeUniquenessStatus(entry.uniquenessStatus)] += 1;
    if (entry.manualReviewRequired) manual += 1;
    const checklist = normalizeChecklist(entry.checklist);
    if (CHECKLIST_KEYS.every((k) => checklist[k] !== null)) checklistComplete += 1;
  }

  console.log(`qa_entries=${entries.length}`);
  console.log(`visual_pending=${visual.pending}`);
  console.log(`visual_approved=${visual.approved}`);
  console.log(`visual_rejected=${visual.rejected}`);
  console.log(`uniqueness_pending=${uniq.pending}`);
  console.log(`uniqueness_unique=${uniq.unique}`);
  console.log(`uniqueness_keeper=${uniq.keeper}`);
  console.log(`uniqueness_non_keeper=${uniq.non_keeper}`);
  console.log(`manual_review_required=${manual}`);
  console.log(`checklist_complete=${checklistComplete}`);
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--list-non-regen-pending") {
    listNonRegenPending();
    return;
  }
  if (args[0] === "--upsert") {
    upsert(args);
    return;
  }
  if (args[0] === "--merge-batch") {
    mergeBatch(args);
    return;
  }
  if (args[0] === "--summary") {
    printSummary();
    return;
  }

  console.log("Usage:");
  console.log("  npx tsx scripts/audits/mark-slice-of-life-qa.ts --summary");
  console.log("  npx tsx scripts/audits/mark-slice-of-life-qa.ts --list-non-regen-pending");
  console.log("  npx tsx scripts/audits/mark-slice-of-life-qa.ts --upsert <raceId> <male|female> [flags]");
  console.log("    --visual <pending|approved|rejected>");
  console.log("    --uniqueness <pending|unique|keeper|non_keeper>");
  console.log("    --manual-review <true|false>");
  console.log("    --notes \"...\" --reviewer \"...\"");
  console.log("    --likely-score <1..5> --likely-reason \"...\"");
  console.log("    --target-activity \"...\" --observed-activity \"...\"");
  console.log("    --square yes|no|skip --full-body yes|no|skip --edge-to-edge yes|no|skip");
  console.log("    --slice-of-life yes|no|skip --civilian yes|no|skip --arrows-artifact yes|no|skip");
  console.log("  npx tsx scripts/audits/mark-slice-of-life-qa.ts --merge-batch <file> [--reviewer \"...\"]");
}

main();
