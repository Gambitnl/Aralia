#!/usr/bin/env npx tsx
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

type Gender = "male" | "female";
type VisualStatus = "pending" | "approved" | "rejected";
type UniquenessStatus = "pending" | "unique" | "keeper" | "non_keeper";

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

type BatchOutputEntry = {
  raceId: string;
  gender: Gender;
  visualStatus: VisualStatus;
  uniquenessStatus: UniquenessStatus;
  manualReviewRequired: boolean;
  checklist: {
    isSquare: boolean | null;
    isFullBody: boolean | null;
    isEdgeToEdge: boolean | null;
    isSliceOfLife: boolean | null;
    isCivilian: boolean | null;
    hasArrowsArtifact: boolean | null;
  };
  likelyScore: number | null;
  likelyReason: string | null;
  targetActivity: string | null;
  notes?: string;
};

type BatchOutput = {
  batchId: string;
  entries: BatchOutputEntry[];
};

const ROOT = process.cwd();
const DEFAULT_SCHEMA_PATH = path.join(ROOT, "scripts", "audits", "qa-batches", "qa-output.schema.json");
const DEFAULT_RUBRIC_PATH = path.join(ROOT, "scripts", "audits", "qa-batches", "QA_RUBRIC.md");

function parseFlag(args: string[], flag: string): string | null {
  const i = args.indexOf(flag);
  if (i === -1) return null;
  return args[i + 1] ?? null;
}

function clampLikelyScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const v = Math.round(value);
  if (v < 1 || v > 5) return null;
  return v;
}

function normalizeStatus(value: string | undefined): VisualStatus {
  if (value === "approved" || value === "rejected" || value === "pending") return value;
  return "pending";
}

function normalizeUniq(value: string | undefined): UniquenessStatus {
  if (value === "pending" || value === "unique" || value === "keeper" || value === "non_keeper") return value;
  return "pending";
}

function normalizeChecklist(value: unknown): BatchOutputEntry["checklist"] {
  const v = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const toBool = (key: string): boolean | null => (typeof v[key] === "boolean" ? (v[key] as boolean) : null);
  return {
    isSquare: toBool("isSquare"),
    isFullBody: toBool("isFullBody"),
    isEdgeToEdge: toBool("isEdgeToEdge"),
    isSliceOfLife: toBool("isSliceOfLife"),
    isCivilian: toBool("isCivilian"),
    hasArrowsArtifact: toBool("hasArrowsArtifact"),
  };
}

function normalizeEntry(entry: unknown): BatchOutputEntry | null {
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;
  if (typeof e.raceId !== "string") return null;
  if (e.gender !== "male" && e.gender !== "female") return null;
  return {
    raceId: e.raceId,
    gender: e.gender,
    visualStatus: normalizeStatus(typeof e.visualStatus === "string" ? e.visualStatus : undefined),
    uniquenessStatus: normalizeUniq(typeof e.uniquenessStatus === "string" ? e.uniquenessStatus : undefined),
    manualReviewRequired: Boolean(e.manualReviewRequired),
    checklist: normalizeChecklist(e.checklist),
    likelyScore: clampLikelyScore(e.likelyScore),
    likelyReason: typeof e.likelyReason === "string" && e.likelyReason.trim() ? e.likelyReason.trim() : null,
    targetActivity: typeof e.targetActivity === "string" && e.targetActivity.trim() ? e.targetActivity.trim() : null,
    notes: typeof e.notes === "string" ? e.notes : undefined,
  };
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through and try fenced/embedded JSON extraction.
  }
  const fence = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fence) return JSON.parse(fence[1]);
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    return JSON.parse(candidate);
  }
  throw new Error("Model response did not contain parseable JSON");
}

async function callModelWithPrompt(model: string, system: string, user: string): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: user }] },
      ],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI response error (${response.status}): ${detail}`);
  }

  const payload = await response.json() as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };

  const text =
    payload.output_text ??
    payload.output?.flatMap((item) => item.content ?? []).find((c) => c.type === "output_text" && typeof c.text === "string")?.text;
  if (!text) throw new Error("No output_text returned by model");
  return extractJsonObject(text);
}

function loadRubricText(rubricPath: string): string {
  if (!fs.existsSync(rubricPath)) throw new Error(`Rubric file not found: ${rubricPath}`);
  return fs.readFileSync(rubricPath, "utf8").trim();
}

function buildPrompt(batch: BatchInput, rubricText: string, visualEvidenceMode: "available" | "unavailable"): string {
  const evidenceLines = visualEvidenceMode === "available"
    ? [
      "Visual evidence is available for this run.",
      "Evaluate checklist and visualStatus using the rubric and available evidence.",
    ]
    : [
      "Visual evidence is unavailable for this run.",
      "Apply rubric no-guess rule: checklist fields should remain null and visualStatus should remain pending unless explicitly known from provided data.",
    ];

  return [
    "You are processing one race portrait QA batch.",
    "Return JSON only that matches the provided output schema.",
    ...evidenceLines,
    "",
    "Use this canonical rubric verbatim:",
    rubricText,
    "",
    "Batch input JSON:",
    JSON.stringify(batch, null, 2),
  ].join("\n");
}

function callCodex(
  batch: BatchInput,
  schemaPath: string,
  rawOutputPath: string,
  rubricText: string,
  visualEvidenceMode: "available" | "unavailable",
): unknown {
  const prompt = buildPrompt(batch, rubricText, visualEvidenceMode);
  const args = [
    "exec",
    "-",
    "-C",
    ROOT,
    "--sandbox",
    "read-only",
    "--output-schema",
    schemaPath,
    "-o",
    rawOutputPath,
  ];

  const result = spawnSync("codex", args, {
    cwd: ROOT,
    shell: true,
    input: prompt,
    encoding: "utf8",
    stdio: ["pipe", "inherit", "inherit"],
  });

  if (result.status !== 0) {
    throw new Error(`codex exec failed with exit code ${result.status}`);
  }
  if (!fs.existsSync(rawOutputPath)) {
    throw new Error(`codex output file was not created: ${rawOutputPath}`);
  }
  const rawText = fs.readFileSync(rawOutputPath, "utf8");
  return extractJsonObject(rawText);
}

function validateOutput(raw: unknown, batchId: string, expectedRows: BatchRow[]): BatchOutput {
  if (!raw || typeof raw !== "object") throw new Error("Model JSON output is not an object");
  const obj = raw as Record<string, unknown>;
  const entriesRaw = Array.isArray(obj.entries) ? obj.entries : [];
  const entries = entriesRaw.map(normalizeEntry).filter((e): e is BatchOutputEntry => e !== null);
  const expected = new Set(expectedRows.map((row) => `${row.raceId}::${row.gender}`));
  const seen = new Set(entries.map((entry) => `${entry.raceId}::${entry.gender}`));
  for (const key of expected) {
    if (!seen.has(key)) {
      throw new Error(`Missing output entry for ${key}`);
    }
  }
  return {
    batchId: typeof obj.batchId === "string" ? obj.batchId : batchId,
    entries,
  };
}

function buildTemplateOutput(batch: BatchInput): BatchOutput {
  return {
    batchId: batch.batchId,
    entries: batch.rows.map((row) => ({
      raceId: row.raceId,
      gender: row.gender,
      visualStatus: normalizeStatus(row.visualStatus),
      uniquenessStatus: normalizeUniq(row.uniquenessStatus),
      manualReviewRequired: Boolean(row.manualReviewRequired),
      checklist: {
        isSquare: null,
        isFullBody: null,
        isEdgeToEdge: null,
        isSliceOfLife: null,
        isCivilian: null,
        hasArrowsArtifact: null,
      },
      likelyScore: clampLikelyScore(row.likelyScore),
      likelyReason: row.likelyReason ?? null,
      targetActivity: row.targetActivity ?? null,
      notes: "TEMPLATE: fill after visual review.",
    })),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const inputArg = parseFlag(args, "--input");
  if (!inputArg) {
    console.log("Usage:");
    console.log("  npx tsx scripts/audits/run-qa-batch-agent.ts --input scripts/audits/qa-batches/<batch>.input.json [--mode template|codex|openai] [--model gpt-5-mini] [--schema scripts/audits/qa-batches/qa-output.schema.json] [--rubric scripts/audits/qa-batches/QA_RUBRIC.md] [--visual-evidence available|unavailable] [--out <path>]");
    process.exit(1);
  }

  const inputPath = path.isAbsolute(inputArg) ? inputArg : path.join(ROOT, inputArg);
  if (!fs.existsSync(inputPath)) throw new Error(`Input file not found: ${inputPath}`);
  const mode = parseFlag(args, "--mode") ?? "template";
  const model = parseFlag(args, "--model") ?? process.env.OPENAI_QA_MODEL ?? "gpt-5-mini";
  const visualEvidenceRaw = parseFlag(args, "--visual-evidence") ?? "unavailable";
  const visualEvidenceMode = visualEvidenceRaw === "available" || visualEvidenceRaw === "unavailable"
    ? visualEvidenceRaw
    : (() => { throw new Error(`Invalid --visual-evidence value: ${visualEvidenceRaw} (expected available|unavailable)`); })();
  const schemaPath = path.isAbsolute(parseFlag(args, "--schema") ?? "")
    ? (parseFlag(args, "--schema") as string)
    : path.join(ROOT, parseFlag(args, "--schema") ?? path.relative(ROOT, DEFAULT_SCHEMA_PATH));
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }
  const rubricPath = path.isAbsolute(parseFlag(args, "--rubric") ?? "")
    ? (parseFlag(args, "--rubric") as string)
    : path.join(ROOT, parseFlag(args, "--rubric") ?? path.relative(ROOT, DEFAULT_RUBRIC_PATH));
  const rubricText = loadRubricText(rubricPath);

  const batch = JSON.parse(fs.readFileSync(inputPath, "utf8")) as BatchInput;
  if (!batch || !Array.isArray(batch.rows) || typeof batch.batchId !== "string") {
    throw new Error(`Invalid batch input JSON: ${inputPath}`);
  }

  let output: BatchOutput;
  if (mode === "openai") {
    const system = [
      "You are a strict race portrait QA classifier.",
      "Return JSON only with shape: { batchId, entries: [...] }.",
      "Do not include markdown or commentary.",
      `Visual evidence mode: ${visualEvidenceMode}.`,
      "Apply the canonical rubric exactly.",
      "",
      rubricText,
    ].join("\n");
    const user = [
      "Batch input JSON follows. Produce one output entry for every row.",
      JSON.stringify(batch, null, 2),
    ].join("\n\n");
    const rawOutput = await callModelWithPrompt(model, system, user);
    output = validateOutput(rawOutput, batch.batchId, batch.rows);
  } else if (mode === "codex") {
    const rawPath = inputPath.replace(/\.input\.json$/i, ".raw.json");
    const rawOutput = callCodex(batch, schemaPath, rawPath, rubricText, visualEvidenceMode);
    output = validateOutput(rawOutput, batch.batchId, batch.rows);
  } else if (mode === "template") {
    output = buildTemplateOutput(batch);
  } else {
    throw new Error(`Invalid --mode value: ${mode} (expected template|codex|openai)`);
  }

  const outArg = parseFlag(args, "--out");
  const outPath = outArg
    ? (path.isAbsolute(outArg) ? outArg : path.join(ROOT, outArg))
    : inputPath.replace(/\.input\.json$/i, ".output.json");

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(`wrote ${path.relative(ROOT, outPath).replace(/\\/g, "/")}`);
  console.log(`entries=${output.entries.length}`);
  console.log(`mode=${mode}`);
  console.log(`visual_evidence=${visualEvidenceMode}`);
}

void main();
