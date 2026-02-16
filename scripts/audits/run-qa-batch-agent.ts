#!/usr/bin/env npx tsx
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

type Gender = "male" | "female";
type VisualStatus = "pending" | "approved" | "rejected";
type UniquenessStatus = "pending" | "unique" | "keeper" | "non_keeper";

type ProfileQuestion = {
  id: string;
  question: string;
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

type BatchOutputRaceProfileAnswer = {
  questionId: string;
  question: string;
  answer: string;
};

type BatchOutputRaceProfile = {
  raceId: string;
  raceName: string;
  summary: string;
  answers: BatchOutputRaceProfileAnswer[];
};

type BatchOutput = {
  batchId: string;
  entries: BatchOutputEntry[];
  raceProfiles: BatchOutputRaceProfile[];
};

const ROOT = process.cwd();
const DEFAULT_SCHEMA_PATH = path.join(ROOT, "scripts", "audits", "qa-batches", "qa-output.schema.json");
const DEFAULT_RUBRIC_PATH = path.join(ROOT, "scripts", "audits", "qa-batches", "QA_RUBRIC.md");
const DEFAULT_PROFILE_QUESTIONS_PATH = path.join(ROOT, "scripts", "audits", "qa-batches", "RACE_PROFILE_QUESTIONS.md");
const RACE_PROFILE_DIR = path.join(ROOT, "docs", "portraits", "race_profiles");

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

function loadTextFile(filePath: string, label: string): string {
  if (!fs.existsSync(filePath)) throw new Error(`${label} file not found: ${filePath}`);
  return fs.readFileSync(filePath, "utf8").trim();
}

function loadProfileQuestions(filePath: string): ProfileQuestion[] {
  const text = loadTextFile(filePath, "Profile questions");
  const lines = text.split(/\r?\n/);
  const questions = lines
    .map((line) => {
      const m = line.match(/^\s*(\d+)\.\s+(.+?)\s*$/);
      if (!m) return null;
      return { idx: Number.parseInt(m[1], 10), question: m[2].trim() };
    })
    .filter((v): v is { idx: number; question: string } => v !== null)
    .sort((a, b) => a.idx - b.idx)
    .map((v) => ({ id: `q${v.idx}`, question: v.question }));

  if (questions.length !== 10) {
    throw new Error(`Expected exactly 10 profile questions, found ${questions.length} in ${filePath}`);
  }
  return questions;
}

function getRacesFromBatch(rows: BatchRow[]): Array<{ raceId: string; raceName: string; baseRace: string | null }> {
  const byRace = new Map<string, { raceId: string; raceName: string; baseRace: string | null }>();
  for (const row of rows) {
    if (!byRace.has(row.raceId)) {
      byRace.set(row.raceId, {
        raceId: row.raceId,
        raceName: row.raceName,
        baseRace: row.baseRace ?? null,
      });
    }
  }
  return [...byRace.values()].sort((a, b) => a.raceId.localeCompare(b.raceId));
}

function buildPrompt(
  batch: BatchInput,
  rubricText: string,
  profileQuestions: ProfileQuestion[],
  visualEvidenceMode: "available" | "unavailable",
): string {
  const evidenceLines = visualEvidenceMode === "available"
    ? [
      "Visual evidence is available for this run.",
      "Evaluate checklist and visualStatus using the rubric and available evidence.",
    ]
    : [
      "Visual evidence is unavailable for this run.",
      "Apply rubric no-guess rule: checklist fields should remain null and visualStatus should remain pending unless explicitly known from provided data.",
    ];

  const questionText = profileQuestions.map((q, i) => `${i + 1}. (${q.id}) ${q.question}`).join("\n");

  return [
    "You are processing one race portrait QA batch.",
    "Return JSON only that matches the provided output schema.",
    ...evidenceLines,
    "",
    "Internet research is required for race profiles, but source references must not appear in output text:",
    "- Use live web search for each race profile.",
    "- Use official/primary references first, then secondary references as needed.",
    "- Do not include source names, URLs, citations, bibliography, or references in the output text.",
    "",
    "Also include race-level profiles:",
    "- Provide one race profile per unique raceId in the batch (not per gender).",
    "- Use generalized setting-safe language (no named cities/kingdoms/countries/proper-noun geopolitics).",
    "- Write in concise wiki-like prose with informative section headings.",
    "- No bullet lists. No numbered lists. No tables. No URLs.",
    "",
    "Use this canonical rubric verbatim:",
    rubricText,
    "",
    "Race profile themes (all must be covered, naturally in prose):",
    questionText,
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
  profileQuestions: ProfileQuestion[],
  visualEvidenceMode: "available" | "unavailable",
  enableWebSearch: boolean,
): unknown {
  const prompt = buildPrompt(batch, rubricText, profileQuestions, visualEvidenceMode);
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
  if (enableWebSearch) {
    args.unshift("--search");
  }

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

function normalizeRaceProfile(
  raw: unknown,
  expectedRaceId: string,
  fallbackRaceName: string,
  profileQuestions: ProfileQuestion[],
): BatchOutputRaceProfile {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Invalid raceProfile object for ${expectedRaceId}`);
  }
  const obj = raw as Record<string, unknown>;
  const raceId = typeof obj.raceId === "string" && obj.raceId.trim() ? obj.raceId.trim() : expectedRaceId;
  if (raceId !== expectedRaceId) {
    throw new Error(`raceProfile raceId mismatch: expected ${expectedRaceId}, got ${raceId}`);
  }
  const raceName = typeof obj.raceName === "string" && obj.raceName.trim() ? obj.raceName.trim() : fallbackRaceName;
  const summary = typeof obj.summary === "string" && obj.summary.trim() ? obj.summary.trim() : "";
  if (!summary) throw new Error(`Missing summary for raceProfile ${expectedRaceId}`);
  const textViolations = (text: string): string[] => {
    const v: string[] = [];
    if (/https?:\/\/|www\./i.test(text)) v.push("contains URL");
    if (/^(\s*)([-*+]\s+|\d+\.\s+)/m.test(text)) v.push("contains list formatting");
    if (/^\s*\|.+\|\s*$/m.test(text) || /^\s*\|?[-: ]+\|[-|: ]+\s*$/m.test(text)) v.push("contains table formatting");
    if (/(^|\n)\s*(sources?|references?|bibliography|citations?)\b/i.test(text)) v.push("contains source/reference section");
    if (/\[[0-9]+\]|\(source[:)]/i.test(text)) v.push("contains citation markers");
    return v;
  };
  const summaryViolations = textViolations(summary);
  if (summaryViolations.length > 0) {
    throw new Error(`Invalid summary for ${expectedRaceId}: ${summaryViolations.join(", ")}`);
  }

  const answersRaw = Array.isArray(obj.answers) ? obj.answers : [];
  const answerByQ = new Map<string, string>();
  for (const answerRaw of answersRaw) {
    if (!answerRaw || typeof answerRaw !== "object") continue;
    const answerObj = answerRaw as Record<string, unknown>;
    const qid = typeof answerObj.questionId === "string" ? answerObj.questionId.trim() : "";
    const answerText = typeof answerObj.answer === "string" ? answerObj.answer.trim() : "";
    if (!qid || !answerText) continue;
    answerByQ.set(qid, answerText);
  }

  const answers: BatchOutputRaceProfileAnswer[] = [];
  for (const q of profileQuestions) {
    const answer = answerByQ.get(q.id);
    if (!answer) {
      throw new Error(`Missing profile answer ${q.id} for race ${expectedRaceId}`);
    }
    const answerViolations = textViolations(answer);
    if (answerViolations.length > 0) {
      throw new Error(`Invalid answer ${q.id} for ${expectedRaceId}: ${answerViolations.join(", ")}`);
    }
    answers.push({
      questionId: q.id,
      question: q.question,
      answer,
    });
  }

  return {
    raceId: expectedRaceId,
    raceName,
    summary,
    answers,
  };
}

function validateOutput(
  raw: unknown,
  batchId: string,
  expectedRows: BatchRow[],
  profileQuestions: ProfileQuestion[],
): BatchOutput {
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

  const expectedRaces = getRacesFromBatch(expectedRows);
  const rawProfiles = Array.isArray(obj.raceProfiles) ? obj.raceProfiles : [];
  const rawProfileByRace = new Map<string, unknown>();
  for (const rp of rawProfiles) {
    if (!rp || typeof rp !== "object") continue;
    const raceId = typeof (rp as Record<string, unknown>).raceId === "string"
      ? ((rp as Record<string, unknown>).raceId as string).trim()
      : "";
    if (!raceId) continue;
    if (!rawProfileByRace.has(raceId)) rawProfileByRace.set(raceId, rp);
  }

  const raceProfiles: BatchOutputRaceProfile[] = [];
  for (const race of expectedRaces) {
    const rawProfile = rawProfileByRace.get(race.raceId);
    if (!rawProfile) {
      throw new Error(`Missing raceProfile for ${race.raceId}`);
    }
    raceProfiles.push(normalizeRaceProfile(rawProfile, race.raceId, race.raceName, profileQuestions));
  }

  return {
    batchId: typeof obj.batchId === "string" ? obj.batchId : batchId,
    entries,
    raceProfiles,
  };
}

function buildTemplateOutput(batch: BatchInput, profileQuestions: ProfileQuestion[]): BatchOutput {
  const races = getRacesFromBatch(batch.rows);
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
    raceProfiles: races.map((race) => ({
      raceId: race.raceId,
      raceName: race.raceName,
      summary: "TEMPLATE: fill generalized profile summary.",
      answers: profileQuestions.map((q) => ({
        questionId: q.id,
        question: q.question,
        answer: "TEMPLATE: fill answer.",
      })),
    })),
  };
}

function writeRaceProfileFiles(batch: BatchInput, output: BatchOutput): number {
  fs.mkdirSync(RACE_PROFILE_DIR, { recursive: true });
  const outputEntryByKey = new Map<string, BatchOutputEntry>();
  for (const entry of output.entries) {
    outputEntryByKey.set(`${entry.raceId}::${entry.gender}`, entry);
  }

  let written = 0;
  for (const profile of output.raceProfiles) {
    const raceRows = batch.rows
      .filter((row) => row.raceId === profile.raceId)
      .sort((a, b) => (a.gender === b.gender ? 0 : a.gender === "male" ? -1 : 1));
    const baseRace = raceRows[0]?.baseRace ?? null;
    const filePath = path.join(RACE_PROFILE_DIR, `${profile.raceId}.md`);
    const lines: string[] = [];
    lines.push(`# ${profile.raceName} Profile`);
    lines.push("");
    lines.push(`Race ID: ${profile.raceId}`);
    lines.push(`Base Race: ${baseRace ?? "n/a"}`);
    lines.push(`Updated: ${new Date().toISOString()}`);
    lines.push(`Source Batch: ${batch.batchId}`);
    lines.push("");
    lines.push("## Generalized Summary");
    lines.push("");
    lines.push(profile.summary);
    lines.push("");
    lines.push("## Profile Questions");
    lines.push("");
    for (const answer of profile.answers) {
      lines.push(`### ${answer.question}`);
      lines.push("");
      lines.push(answer.answer);
      lines.push("");
    }
    lines.push("## Batch QA Snapshot");
    lines.push("");
    for (const row of raceRows) {
      const qa = outputEntryByKey.get(`${row.raceId}::${row.gender}`);
      lines.push(`### ${row.gender}`);
      lines.push(`visual: ${qa?.visualStatus ?? "pending"}`);
      lines.push(`uniqueness: ${qa?.uniquenessStatus ?? "pending"}`);
      lines.push(`observedActivity: ${row.observedActivity ?? "n/a"}`);
      lines.push(`targetActivity: ${qa?.targetActivity ?? row.targetActivity ?? "n/a"}`);
      lines.push(`notes: ${qa?.notes ?? "n/a"}`);
      lines.push("");
    }

    fs.writeFileSync(filePath, lines.join("\n"), "utf8");
    written += 1;
  }
  return written;
}

async function main() {
  const args = process.argv.slice(2);
  const inputArg = parseFlag(args, "--input");
  if (!inputArg) {
    console.log("Usage:");
    console.log("  npx tsx scripts/audits/run-qa-batch-agent.ts --input scripts/audits/qa-batches/<batch>.input.json [--mode template|codex|openai] [--model gpt-5-mini] [--schema scripts/audits/qa-batches/qa-output.schema.json] [--rubric scripts/audits/qa-batches/QA_RUBRIC.md] [--profile-questions scripts/audits/qa-batches/RACE_PROFILE_QUESTIONS.md] [--visual-evidence available|unavailable] [--web-research required|optional|off] [--out <path>]");
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
  const webResearchRaw = parseFlag(args, "--web-research") ?? "required";
  const webResearchMode = webResearchRaw === "required" || webResearchRaw === "optional" || webResearchRaw === "off"
    ? webResearchRaw
    : (() => { throw new Error(`Invalid --web-research value: ${webResearchRaw} (expected required|optional|off)`); })();
  const schemaPath = path.isAbsolute(parseFlag(args, "--schema") ?? "")
    ? (parseFlag(args, "--schema") as string)
    : path.join(ROOT, parseFlag(args, "--schema") ?? path.relative(ROOT, DEFAULT_SCHEMA_PATH));
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }
  const rubricPath = path.isAbsolute(parseFlag(args, "--rubric") ?? "")
    ? (parseFlag(args, "--rubric") as string)
    : path.join(ROOT, parseFlag(args, "--rubric") ?? path.relative(ROOT, DEFAULT_RUBRIC_PATH));
  const profileQuestionsPath = path.isAbsolute(parseFlag(args, "--profile-questions") ?? "")
    ? (parseFlag(args, "--profile-questions") as string)
    : path.join(ROOT, parseFlag(args, "--profile-questions") ?? path.relative(ROOT, DEFAULT_PROFILE_QUESTIONS_PATH));
  const rubricText = loadTextFile(rubricPath, "Rubric");
  const profileQuestions = loadProfileQuestions(profileQuestionsPath);

  const batch = JSON.parse(fs.readFileSync(inputPath, "utf8")) as BatchInput;
  if (!batch || !Array.isArray(batch.rows) || typeof batch.batchId !== "string") {
    throw new Error(`Invalid batch input JSON: ${inputPath}`);
  }

  let output: BatchOutput;
  if (mode === "openai") {
    if (webResearchMode !== "off") {
      throw new Error("OpenAI mode currently has no built-in web-search tool in this script. Use --mode codex for internet-researched race profiles, or set --web-research off.");
    }
    const system = [
      "You are a strict race portrait QA classifier.",
      "Return JSON only with shape: { batchId, entries: [...], raceProfiles: [...] }.",
      "Do not include markdown or commentary.",
      "Race profiles must be generalized and setting-agnostic (no named cities/kingdoms/countries/proper nouns).",
      "Race profile text must not contain source references, citations, bibliography, or URLs.",
      "Race profile text must not use bullet lists, numbered lists, or tables.",
      `Visual evidence mode: ${visualEvidenceMode}.`,
      "Apply the canonical rubric exactly.",
      "",
      rubricText,
    ].join("\n");
    const user = [
      "Batch input JSON follows. Produce one output entry for every row and one race profile per unique raceId.",
      "Cover all 10 profile questions for each race naturally in prose answers.",
      JSON.stringify(batch, null, 2),
    ].join("\n\n");
    const rawOutput = await callModelWithPrompt(model, system, user);
    output = validateOutput(rawOutput, batch.batchId, batch.rows, profileQuestions);
  } else if (mode === "codex") {
    const rawPath = inputPath.replace(/\.input\.json$/i, ".raw.json");
    const rawOutput = callCodex(
      batch,
      schemaPath,
      rawPath,
      rubricText,
      profileQuestions,
      visualEvidenceMode,
      webResearchMode !== "off",
    );
    output = validateOutput(rawOutput, batch.batchId, batch.rows, profileQuestions);
  } else if (mode === "template") {
    output = buildTemplateOutput(batch, profileQuestions);
  } else {
    throw new Error(`Invalid --mode value: ${mode} (expected template|codex|openai)`);
  }

  const outArg = parseFlag(args, "--out");
  const outPath = outArg
    ? (path.isAbsolute(outArg) ? outArg : path.join(ROOT, outArg))
    : inputPath.replace(/\.input\.json$/i, ".output.json");

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");
  const profileCount = writeRaceProfileFiles(batch, output);

  console.log(`wrote ${path.relative(ROOT, outPath).replace(/\\/g, "/")}`);
  console.log(`entries=${output.entries.length}`);
  console.log(`race_profiles=${output.raceProfiles.length}`);
  console.log(`race_profile_files_written=${profileCount}`);
  console.log(`mode=${mode}`);
  console.log(`visual_evidence=${visualEvidenceMode}`);
  console.log(`web_research=${webResearchMode}`);
}

void main();
