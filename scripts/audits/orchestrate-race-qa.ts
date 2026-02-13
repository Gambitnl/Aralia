#!/usr/bin/env npx tsx
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

type Gender = "male" | "female";
type VisualStatus = "pending" | "approved" | "rejected";
type UniquenessStatus = "pending" | "unique" | "keeper" | "non_keeper";

type LedgerRow = {
  pairNumber?: number;
  pairTag?: string;
  raceId: string;
  raceName: string;
  baseRace: string | null;
  gender: Gender;
  illustrationPath: string | null;
  observedActivity?: string | null;
  targetActivity?: string | null;
  likelyScore?: number | null;
  likelyReason?: string | null;
  visualStatus?: VisualStatus;
  uniquenessStatus?: UniquenessStatus;
  manualReviewRequired?: boolean;
  duplicateDecision?: "missing" | "unique" | "keep" | "regen";
  needsRegen?: boolean;
  statusCategory?: string | null;
  isRegenerated?: boolean;
};

type LedgerPayload = {
  summary?: {
    totalCcRacePairs?: number;
  };
  rows?: LedgerRow[];
};

type BatchRow = {
  pairTag: string;
  raceId: string;
  raceName: string;
  gender: Gender;
  baseRace: string | null;
  observedActivity: string | null;
  targetActivity: string | null;
  likelyScore: number | null;
  likelyReason: string | null;
  visualStatus: VisualStatus;
  uniquenessStatus: UniquenessStatus;
  manualReviewRequired: boolean;
  duplicateDecision: string;
  needsRegen: boolean;
  imagePath: string | null;
  statusCategory: string | null;
  isRegenerated: boolean;
};

type BatchInput = {
  batchId: string;
  createdAt: string;
  schemaVersion: 1;
  sourceLedgerPath: string;
  batchSizeRaces: number;
  raceCount: number;
  rowCount: number;
  selectionPolicy: string;
  rows: BatchRow[];
};

const ROOT = process.cwd();
const LEDGER_PATH = path.join(ROOT, "scripts", "audits", "slice-of-life-settings.json");
const DEFAULT_OUT_DIR = path.join(ROOT, "scripts", "audits", "qa-batches");
const RUBRIC_PATH = path.join(ROOT, "scripts", "audits", "qa-batches", "QA_RUBRIC.md");
const PROFILE_QUESTIONS_PATH = path.join(ROOT, "scripts", "audits", "qa-batches", "RACE_PROFILE_QUESTIONS.md");

function normalizeVisualStatus(value: string | undefined): VisualStatus {
  if (value === "approved" || value === "rejected" || value === "pending") return value;
  return "pending";
}

function normalizeUniquenessStatus(value: string | undefined): UniquenessStatus {
  if (value === "unique" || value === "keeper" || value === "non_keeper" || value === "pending") return value;
  return "pending";
}

function parseFlag(args: string[], flag: string): string | null {
  const i = args.indexOf(flag);
  if (i === -1) return null;
  return args[i + 1] ?? null;
}

function parseIntFlag(args: string[], flag: string, fallback: number): number {
  const raw = parseFlag(args, flag);
  if (raw === null) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid ${flag} value: ${raw}`);
  return value;
}

function loadLedgerRows(): LedgerRow[] {
  if (!fs.existsSync(LEDGER_PATH)) throw new Error(`Missing ledger: ${LEDGER_PATH}`);
  const raw = JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8")) as LedgerPayload;
  if (!Array.isArray(raw.rows)) throw new Error("Ledger rows not found");
  return raw.rows;
}

function shouldQueue(row: LedgerRow): boolean {
  const visual = normalizeVisualStatus(row.visualStatus);
  const uniq = normalizeUniquenessStatus(row.uniquenessStatus);
  const hasTarget = typeof row.targetActivity === "string" && row.targetActivity.trim().length > 0;
  if (visual !== "approved") return true;
  if (uniq === "pending") return true;
  if (!hasTarget) return true;
  if (Boolean(row.manualReviewRequired)) return true;
  return false;
}

function groupRowsByRace(rows: LedgerRow[]): Array<{ raceId: string; rows: LedgerRow[] }> {
  const byRace = new Map<string, LedgerRow[]>();
  for (const row of rows) {
    const arr = byRace.get(row.raceId) ?? [];
    arr.push(row);
    byRace.set(row.raceId, arr);
  }
  return [...byRace.entries()]
    .map(([raceId, raceRows]) => ({
      raceId,
      rows: raceRows.sort((a, b) => (a.gender === b.gender ? 0 : a.gender === "male" ? -1 : 1)),
    }))
    .sort((a, b) => {
      const pairA = a.rows[0]?.pairNumber ?? 0;
      const pairB = b.rows[0]?.pairNumber ?? 0;
      if (pairA !== pairB) return pairA - pairB;
      return a.raceId.localeCompare(b.raceId);
    });
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function toBatchRow(row: LedgerRow): BatchRow {
  return {
    pairTag: row.pairTag ?? "-",
    raceId: row.raceId,
    raceName: row.raceName,
    gender: row.gender,
    baseRace: row.baseRace ?? null,
    observedActivity: row.observedActivity ?? null,
    targetActivity: row.targetActivity ?? null,
    likelyScore: typeof row.likelyScore === "number" ? row.likelyScore : null,
    likelyReason: row.likelyReason ?? null,
    visualStatus: normalizeVisualStatus(row.visualStatus),
    uniquenessStatus: normalizeUniquenessStatus(row.uniquenessStatus),
    manualReviewRequired: Boolean(row.manualReviewRequired),
    duplicateDecision: row.duplicateDecision ?? "",
    needsRegen: Boolean(row.needsRegen),
    imagePath: row.illustrationPath ?? null,
    statusCategory: row.statusCategory ?? null,
    isRegenerated: Boolean(row.isRegenerated),
  };
}

function loadRubricText(): string {
  if (!fs.existsSync(RUBRIC_PATH)) {
    throw new Error(`Missing rubric file: ${RUBRIC_PATH}`);
  }
  return fs.readFileSync(RUBRIC_PATH, "utf8").trim();
}

function loadProfileQuestionsText(): string {
  if (!fs.existsSync(PROFILE_QUESTIONS_PATH)) {
    throw new Error(`Missing profile questions file: ${PROFILE_QUESTIONS_PATH}`);
  }
  return fs.readFileSync(PROFILE_QUESTIONS_PATH, "utf8").trim();
}

function writeBatchFiles(batch: BatchInput, outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const inputPath = path.join(outDir, `${batch.batchId}.input.json`);
  const promptPath = path.join(outDir, `${batch.batchId}.prompt.md`);
  fs.writeFileSync(inputPath, JSON.stringify(batch, null, 2) + "\n", "utf8");
  const rubricText = loadRubricText();
  const profileQuestionsText = loadProfileQuestionsText();

  const promptLines: string[] = [];
  promptLines.push(`# QA Batch ${batch.batchId}`);
  promptLines.push("");
  promptLines.push("## Objective");
  promptLines.push("Review each row and output JSON entries for scripts/audits/slice-of-life-qa.json merge.");
  promptLines.push("");
  promptLines.push("## Output Contract");
  promptLines.push("Return JSON only:");
  promptLines.push("```json");
  promptLines.push("{");
  promptLines.push('  "batchId": "<same batch id>",');
  promptLines.push('  "entries": [');
  promptLines.push("    {");
  promptLines.push('      "raceId": "...",');
  promptLines.push('      "gender": "male|female",');
  promptLines.push('      "visualStatus": "pending|approved|rejected",');
  promptLines.push('      "uniquenessStatus": "pending|unique|keeper|non_keeper",');
  promptLines.push('      "manualReviewRequired": true,');
  promptLines.push('      "checklist": { "isSquare": true, "isFullBody": true, "isEdgeToEdge": true, "isSliceOfLife": true, "isCivilian": true, "hasArrowsArtifact": false },');
  promptLines.push('      "likelyScore": 1,');
  promptLines.push('      "likelyReason": "...",');
  promptLines.push('      "targetActivity": "...",');
  promptLines.push('      "notes": "..."');
  promptLines.push("    }");
  promptLines.push("  ]");
  promptLines.push('  ,"raceProfiles": [');
  promptLines.push("    {");
  promptLines.push('      "raceId": "...",');
  promptLines.push('      "raceName": "...",');
  promptLines.push('      "summary": "...",');
  promptLines.push('      "researchSources": [');
  promptLines.push('        { "title": "...", "url": "https://...", "sourceType": "official|reference|community", "note": "optional" }');
  promptLines.push("      ],");
  promptLines.push('      "answers": [');
  promptLines.push('        { "questionId": "q1", "question": "...", "answer": "..." }');
  promptLines.push("      ]");
  promptLines.push("    }");
  promptLines.push("  ]");
  promptLines.push("}");
  promptLines.push("```");
  promptLines.push("");
  promptLines.push("## Canonical Rubric (Verbatim)");
  promptLines.push("");
  promptLines.push(rubricText);
  promptLines.push("");
  promptLines.push("## Race Profile Questions (Verbatim)");
  promptLines.push("");
  promptLines.push(profileQuestionsText);
  promptLines.push("");
  promptLines.push("## Batch Rows");
  promptLines.push("```json");
  promptLines.push(JSON.stringify(batch.rows, null, 2));
  promptLines.push("```");
  promptLines.push("");

  fs.writeFileSync(promptPath, promptLines.join("\n"), "utf8");
  return { inputPath, promptPath };
}

function runLedgerRefresh(): boolean {
  const result = spawnSync(
    "npx",
    ["tsx", "scripts/audits/list-slice-of-life-settings.ts"],
    { cwd: ROOT, shell: true, stdio: "inherit" },
  );
  return result.status === 0;
}

function prepare(args: string[]) {
  const batchSize = parseIntFlag(args, "--batch-size-races", 5);
  const maxBatches = parseIntFlag(args, "--max-batches", 9999);
  const outDir = parseFlag(args, "--out-dir")
    ? path.join(ROOT, parseFlag(args, "--out-dir")!)
    : DEFAULT_OUT_DIR;

  const rows = loadLedgerRows().filter(shouldQueue);
  const grouped = groupRowsByRace(rows);
  const batches = chunk(grouped, batchSize).slice(0, maxBatches);

  const created: Array<{ batchId: string; raceCount: number; rowCount: number; inputPath: string; promptPath: string }> = [];
  const createdAt = new Date().toISOString();

  batches.forEach((batchRaces, index) => {
    const batchRows = batchRaces.flatMap((group) => group.rows).map(toBatchRow);
    const batchId = `${createdAt.replace(/[:.]/g, "-")}-r${String(index + 1).padStart(3, "0")}`;
    const payload: BatchInput = {
      batchId,
      createdAt,
      schemaVersion: 1,
      sourceLedgerPath: path.relative(ROOT, LEDGER_PATH).replace(/\\/g, "/"),
      batchSizeRaces: batchSize,
      raceCount: batchRaces.length,
      rowCount: batchRows.length,
      selectionPolicy: "visual pending/rejected OR uniqueness pending OR targetActivity missing OR manualReviewRequired",
      rows: batchRows,
    };
    const files = writeBatchFiles(payload, outDir);
    created.push({ batchId, raceCount: payload.raceCount, rowCount: payload.rowCount, ...files });
  });

  console.log(`queued_rows=${rows.length}`);
  console.log(`queued_races=${grouped.length}`);
  console.log(`batches_created=${created.length}`);
  for (const batch of created) {
    console.log(`${batch.batchId} races=${batch.raceCount} rows=${batch.rowCount}`);
    console.log(`  input: ${path.relative(ROOT, batch.inputPath).replace(/\\/g, "/")}`);
    console.log(`  prompt: ${path.relative(ROOT, batch.promptPath).replace(/\\/g, "/")}`);
  }
}

function mergeDir(args: string[]) {
  const dirArg = parseFlag(args, "--dir");
  const dir = dirArg ? path.join(ROOT, dirArg) : DEFAULT_OUT_DIR;
  if (!fs.existsSync(dir)) throw new Error(`Directory not found: ${dir}`);
  const reviewer = parseFlag(args, "--reviewer") ?? "batch-merge";
  const files = fs.readdirSync(dir)
    .filter((name) => name.endsWith(".output.json"))
    .map((name) => path.join(dir, name))
    .sort();

  let merged = 0;
  for (const file of files) {
    const result = spawnSync(
      "npx",
      ["tsx", "scripts/audits/mark-slice-of-life-qa.ts", "--merge-batch", file, "--reviewer", reviewer],
      { cwd: ROOT, shell: true, stdio: "inherit" },
    );
    if (result.status !== 0) {
      throw new Error(`Failed merging batch file: ${file}`);
    }
    merged += 1;
  }

  console.log(`merged_files=${merged}`);
  if (merged > 0) {
    const ok = runLedgerRefresh();
    if (!ok) throw new Error("Failed to refresh ledger after merge");
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--prepare") {
    prepare(args.slice(1));
    return;
  }
  if (args[0] === "--merge-dir") {
    mergeDir(args.slice(1));
    return;
  }

  console.log("Usage:");
  console.log("  npx tsx scripts/audits/orchestrate-race-qa.ts --prepare [--batch-size-races 5] [--max-batches 20] [--out-dir scripts/audits/qa-batches]");
  console.log("  npx tsx scripts/audits/orchestrate-race-qa.ts --merge-dir [--dir scripts/audits/qa-batches] [--reviewer \"batch-merge\"]");
}

main();
