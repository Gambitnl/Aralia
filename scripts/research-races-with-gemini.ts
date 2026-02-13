#!/usr/bin/env npx tsx
/**
 * Research race profiles using Gemini Web (CDP) and write one markdown file per race.
 *
 * This script is intentionally separate from image generation to avoid breaking
 * existing portrait regen workflows.
 *
 * Usage:
 *   cmd.exe /c "set IMAGE_GEN_USE_CDP=1&& npx tsx scripts/research-races-with-gemini.ts --race-id giff"
 *   cmd.exe /c "set IMAGE_GEN_USE_CDP=1&& npx tsx scripts/research-races-with-gemini.ts --all --limit 3"
 */

import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { doctorGeminiCDP, ensureBrowser, startNewGeminiChat } from "./image-gen-mcp";

type RaceIndexEntry = {
  id: string;
  title: string;
  filePath: string | null;
};

type ProfileQuestion = {
  id: string;
  question: string;
};

type ResearchStatusEntry = {
  timestamp: string;
  raceId: string;
  raceName: string;
  outputPath: string;
  success: boolean;
  attempts: number;
  responseChars: number;
  sourceUrlCount: number;
  promptHash: string;
  message: string;
};

const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, "public", "data", "glossary", "index", "character_races.json");
const DEFAULT_PROFILE_QUESTIONS_PATH = path.join(
  ROOT,
  "scripts",
  "audits",
  "qa-batches",
  "RACE_PROFILE_QUESTIONS.md",
);
const DEFAULT_OUT_DIR = path.join(ROOT, "docs", "portraits", "race_profiles");
const DEFAULT_STATUS_PATH = path.join(DEFAULT_OUT_DIR, "research-status.json");

const INPUT_SELECTORS = [
  'div[contenteditable="true"]',
  'textarea[aria-label*="prompt" i]',
  ".ql-editor",
  "rich-textarea",
  '[data-placeholder*="Enter" i]',
];
const RESPONSE_SELECTORS = [".markdown", ".model-response-text"];
const STOP_SELECTOR = '[aria-label="Stop generation"]';

const DEFAULT_TIMEOUT_MS = (() => {
  const raw = String(process.env.GEMINI_RESEARCH_TIMEOUT_MS || "").trim();
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 420_000;
})();

const DEFAULT_MAX_ATTEMPTS = 3;

function parseFlag(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx < 0 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function safeReadJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function loadProfileQuestions(filePath: string): ProfileQuestion[] {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const questions = lines
    .map((line) => {
      const match = line.match(/^\s*(\d+)\.\s+(.+?)\s*$/);
      if (!match) return null;
      return {
        idx: Number.parseInt(match[1], 10),
        question: match[2].trim(),
      };
    })
    .filter((row): row is { idx: number; question: string } => row !== null)
    .sort((a, b) => a.idx - b.idx)
    .map((row) => ({ id: `q${row.idx}`, question: row.question }));

  if (questions.length !== 10) {
    throw new Error(`Expected 10 profile questions in ${filePath}, found ${questions.length}.`);
  }
  return questions;
}

function flattenRaceEntries(raw: unknown): RaceIndexEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: RaceIndexEntry[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const title = typeof row.title === "string" ? row.title.trim() : id;
    const filePath = typeof row.filePath === "string" ? row.filePath : null;
    if (id && filePath) out.push({ id, title, filePath });

    const subEntries = Array.isArray(row.subEntries) ? row.subEntries : [];
    for (const sub of subEntries) {
      if (!sub || typeof sub !== "object") continue;
      const sr = sub as Record<string, unknown>;
      const sid = typeof sr.id === "string" ? sr.id.trim() : "";
      const stitle = typeof sr.title === "string" ? sr.title.trim() : sid;
      const sfilePath = typeof sr.filePath === "string" ? sr.filePath : null;
      if (!sid || !sfilePath) continue;
      out.push({ id: sid, title: stitle, filePath: sfilePath });
    }
  }

  const dedup = new Map<string, RaceIndexEntry>();
  for (const row of out) {
    if (!dedup.has(row.id)) dedup.set(row.id, row);
  }
  return [...dedup.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function toTitleFromId(raceId: string): string {
  return raceId
    .split(/[_-]/g)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function readRaceContext(glossaryFilePath: string | null): string {
  if (!glossaryFilePath) return "";
  const rel = glossaryFilePath.replace(/^\/+/, "").replace(/\//g, path.sep);
  const abs = path.join(ROOT, "public", rel);
  if (!fs.existsSync(abs)) return "";

  try {
    const raw = JSON.parse(fs.readFileSync(abs, "utf8")) as Record<string, unknown>;
    const entryLore = typeof raw.entryLore === "string" ? raw.entryLore.trim() : "";
    const source = typeof raw.source === "string" ? raw.source.trim() : "";
    const tags = Array.isArray(raw.tags) ? raw.tags.filter((v): v is string => typeof v === "string") : [];
    const lore = raw.lore && typeof raw.lore === "object" ? (raw.lore as Record<string, unknown>) : {};
    const societyType = typeof lore.societyType === "string" ? lore.societyType.trim() : "";
    const typicalEnvironment = typeof lore.typicalEnvironment === "string" ? lore.typicalEnvironment.trim() : "";

    const parts = [
      entryLore ? `entryLore: ${entryLore}` : "",
      source ? `sourceBook: ${source}` : "",
      tags.length ? `tags: ${tags.join(", ")}` : "",
      societyType ? `societyType: ${societyType}` : "",
      typicalEnvironment ? `typicalEnvironment: ${typicalEnvironment}` : "",
    ].filter(Boolean);

    return parts.join("\n");
  } catch {
    return "";
  }
}

function buildResearchPrompt(
  raceId: string,
  raceName: string,
  questions: ProfileQuestion[],
  contextSnippet: string,
): string {
  const questionLines = questions.map((q, idx) => `${idx + 1}. (${q.id}) ${q.question}`).join("\n");
  const contextBlock = contextSnippet
    ? `\nCandidate internal context to cross-check (may be stale; verify externally):\n${contextSnippet}\n`
    : "";

  return [
    `You are a senior RPG lore researcher writing a world-agnostic race dossier for "${raceName}" (${raceId}).`,
    "",
    "Research mode requirements:",
    "- Perform live web research before drafting. Use Gemini's Deep Research workflow if available.",
    "- Cross-check multiple sources and resolve contradictions when possible.",
    "- Include only verifiable source URLs in the Sources section.",
    "",
    "Content constraints:",
    "- Keep this generalized for procedural world generation.",
    "- Do not anchor to named cities, kingdoms, nations, or timeline-specific events.",
    "- Avoid setting-locked proper nouns unless unavoidable for origin context; generalize them when possible.",
    "- Write in concise wiki-like prose with a light narrative flow (not a novel).",
    "- Do NOT output a Q&A table or question list format.",
    "",
    "Output format (markdown only):",
    "1) # <Race Name>",
    "2) ## Overview",
    "3) ## Cultural Throughline",
    "4) ## Ten-Point Generalized Profile",
    "   - Provide 10 numbered subsections, one per required topic, each with a heading and 1-3 concise paragraphs.",
    "5) ## Design Hooks for Procedural Worldgen",
    "6) ## Sources",
    "   - List at least 5 web sources as markdown bullets with working URLs.",
    "",
    "Required ten topics to cover inside 'Ten-Point Generalized Profile':",
    questionLines,
    "",
    "Quality bar:",
    "- Prefer official/primary sources first, then reputable references.",
    "- If sources disagree, include a short caveat in the relevant section.",
    "- Keep claims specific but setting-generalized.",
    contextBlock,
    "Return markdown only.",
  ].join("\n");
}

async function findPromptInput(page: Awaited<ReturnType<typeof ensureBrowser>>) {
  for (const selector of INPUT_SELECTORS) {
    const node = await page.waitForSelector(selector, { timeout: 6_000 }).catch(() => null);
    if (node) return node;
  }
  return null;
}

async function extractLatestResponseText(page: Awaited<ReturnType<typeof ensureBrowser>>): Promise<string> {
  return page.evaluate((selectors) => {
    const nodes = selectors.flatMap((selector) =>
      Array.from(document.querySelectorAll(selector))
        .map((el) => (el.textContent || "").trim())
        .filter((text) => text.length > 120),
    );
    if (nodes.length === 0) return "";
    return nodes[nodes.length - 1];
  }, RESPONSE_SELECTORS);
}

function validateResearchOutput(text: string): { ok: boolean; sourceUrlCount: number; reason?: string } {
  const trimmed = text.trim();
  if (trimmed.length < 1_500) return { ok: false, sourceUrlCount: 0, reason: "response too short" };

  const urlMatches = trimmed.match(/https?:\/\/[^\s)]+/g) ?? [];
  const uniqueUrls = [...new Set(urlMatches.map((url) => url.trim()))];
  if (uniqueUrls.length < 3) {
    return { ok: false, sourceUrlCount: uniqueUrls.length, reason: "insufficient source URLs" };
  }

  const hasSourcesHeading = /(^|\n)##\s+Sources\b/i.test(trimmed);
  if (!hasSourcesHeading) {
    return { ok: false, sourceUrlCount: uniqueUrls.length, reason: "missing Sources section" };
  }
  return { ok: true, sourceUrlCount: uniqueUrls.length };
}

function appendStatus(statusPath: string, row: ResearchStatusEntry) {
  const current = safeReadJson<ResearchStatusEntry[]>(statusPath, []);
  current.push(row);
  fs.mkdirSync(path.dirname(statusPath), { recursive: true });
  fs.writeFileSync(statusPath, JSON.stringify(current, null, 2) + "\n", "utf8");
}

async function generateRaceResearch(
  raceId: string,
  raceName: string,
  raceContext: string,
  questions: ProfileQuestion[],
  timeoutMs: number,
  maxAttempts: number,
): Promise<{ text: string; attempts: number; sourceUrlCount: number; promptHash: string }> {
  const prompt = buildResearchPrompt(raceId, raceName, questions, raceContext);
  const promptHash = createHash("sha256").update(prompt).digest("hex").slice(0, 16);
  const page = await ensureBrowser("gemini");
  let lastError = "unknown error";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const newChat = await startNewGeminiChat();
    if (!newChat.success) {
      throw new Error(`Failed to start new chat: ${newChat.message}`);
    }

    const input = await findPromptInput(page);
    if (!input) throw new Error("Could not find Gemini prompt input.");

    await input.click({ clickCount: 3 }).catch(() => undefined);
    await page.keyboard.press("Backspace").catch(() => undefined);
    await input.fill(prompt);
    await page.waitForTimeout(450);
    await input.press("Enter");

    await page.waitForSelector(STOP_SELECTOR, { timeout: 20_000 }).catch(() => undefined);
    await page.waitForSelector(STOP_SELECTOR, { state: "detached", timeout: timeoutMs }).catch(() => undefined);
    await page.waitForTimeout(1_200);

    const text = await extractLatestResponseText(page);
    const validation = validateResearchOutput(text);
    if (validation.ok) {
      return {
        text: text.trim(),
        attempts: attempt,
        sourceUrlCount: validation.sourceUrlCount,
        promptHash,
      };
    }

    lastError = `Attempt ${attempt} failed validation: ${validation.reason ?? "unknown"}`;
    await page.waitForTimeout(1_000 + attempt * 600);
  }

  throw new Error(lastError);
}

function writeProfileFile(
  outputPath: string,
  raceId: string,
  raceName: string,
  body: string,
  promptHash: string,
): void {
  const lines: string[] = [];
  lines.push(`# ${raceName} Profile`);
  lines.push("");
  lines.push(`- Race ID: \`${raceId}\``);
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push("- Method: Gemini Web via CDP (research prompt)");
  lines.push(`- Prompt Hash: \`${promptHash}\``);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(body.trim());
  lines.push("");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, lines.join("\n"), "utf8");
}

async function main() {
  const args = process.argv.slice(2);
  if (hasFlag(args, "--help")) {
    console.log("Usage:");
    console.log("  npx tsx scripts/research-races-with-gemini.ts --race-id <id> [--overwrite]");
    console.log("  npx tsx scripts/research-races-with-gemini.ts --all [--limit N] [--start-after <raceId>] [--overwrite]");
    console.log("");
    console.log("Options:");
    console.log("  --race-id <id>                 Research one race by id.");
    console.log("  --all                          Research all races in glossary index.");
    console.log("  --limit <n>                    Max races to process.");
    console.log("  --start-after <raceId>         Skip until this race id, then continue.");
    console.log("  --questions <path>             Questions markdown path.");
    console.log("  --out-dir <path>               Output folder for per-race markdown files.");
    console.log("  --status-path <path>           Append-only status file path.");
    console.log("  --timeout-ms <n>               Wait timeout per attempt (default 420000).");
    console.log("  --max-attempts <n>             Retry attempts per race (default 3).");
    console.log("  --overwrite                    Overwrite existing profile file.");
    process.exit(0);
  }

  const doctor = await doctorGeminiCDP({ openIfMissing: true, attemptConsent: true });
  if (!doctor.ok && doctor.stage !== "consent") {
    throw new Error(`Gemini CDP not ready: ${doctor.stage} - ${doctor.message}`);
  }

  const questionsPathArg = parseFlag(args, "--questions");
  const outDirArg = parseFlag(args, "--out-dir");
  const statusPathArg = parseFlag(args, "--status-path");
  const raceIdArg = parseFlag(args, "--race-id");
  const all = hasFlag(args, "--all");
  const overwrite = hasFlag(args, "--overwrite");
  const startAfter = parseFlag(args, "--start-after");
  const limitRaw = parseFlag(args, "--limit");
  const timeoutRaw = parseFlag(args, "--timeout-ms");
  const maxAttemptsRaw = parseFlag(args, "--max-attempts");

  const questionsPath = questionsPathArg
    ? (path.isAbsolute(questionsPathArg) ? questionsPathArg : path.join(ROOT, questionsPathArg))
    : DEFAULT_PROFILE_QUESTIONS_PATH;
  const outDir = outDirArg
    ? (path.isAbsolute(outDirArg) ? outDirArg : path.join(ROOT, outDirArg))
    : DEFAULT_OUT_DIR;
  const statusPath = statusPathArg
    ? (path.isAbsolute(statusPathArg) ? statusPathArg : path.join(ROOT, statusPathArg))
    : DEFAULT_STATUS_PATH;

  const timeoutMs = timeoutRaw ? Number(timeoutRaw) : DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error(`Invalid --timeout-ms value: ${timeoutRaw}`);

  const maxAttempts = maxAttemptsRaw ? Number(maxAttemptsRaw) : DEFAULT_MAX_ATTEMPTS;
  if (!Number.isFinite(maxAttempts) || maxAttempts < 1) {
    throw new Error(`Invalid --max-attempts value: ${maxAttemptsRaw}`);
  }

  if (!all && !raceIdArg) {
    throw new Error("Provide --race-id <id> or --all.");
  }

  const questions = loadProfileQuestions(questionsPath);
  const indexRaw = safeReadJson<unknown>(INDEX_PATH, []);
  const allRaces = flattenRaceEntries(indexRaw);
  const byId = new Map(allRaces.map((r) => [r.id, r]));

  let selected: RaceIndexEntry[];
  if (raceIdArg) {
    const found = byId.get(raceIdArg);
    selected = [found ?? { id: raceIdArg, title: toTitleFromId(raceIdArg), filePath: null }];
  } else {
    selected = [...allRaces];
  }

  if (startAfter) {
    const idx = selected.findIndex((row) => row.id === startAfter);
    if (idx >= 0 && idx + 1 < selected.length) {
      selected = selected.slice(idx + 1);
    } else if (idx >= 0) {
      selected = [];
    }
  }

  const limit = limitRaw ? Number(limitRaw) : NaN;
  if (Number.isFinite(limit) && limit > 0) {
    selected = selected.slice(0, limit);
  }

  if (selected.length === 0) {
    console.log("No races selected.");
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (const race of selected) {
    const raceId = race.id;
    const raceName = race.title || toTitleFromId(raceId);
    const outputPath = path.join(outDir, `${raceId}.md`);

    if (!overwrite && fs.existsSync(outputPath)) {
      appendStatus(statusPath, {
        timestamp: new Date().toISOString(),
        raceId,
        raceName,
        outputPath: path.relative(ROOT, outputPath).replace(/\\/g, "/"),
        success: true,
        attempts: 0,
        responseChars: fs.statSync(outputPath).size,
        sourceUrlCount: 0,
        promptHash: "skipped-existing",
        message: "Skipped (already exists). Use --overwrite to regenerate.",
      });
      console.log(`[skip] ${raceId} (already exists)`);
      continue;
    }

    try {
      const context = readRaceContext(race.filePath);
      const result = await generateRaceResearch(
        raceId,
        raceName,
        context,
        questions,
        timeoutMs,
        maxAttempts,
      );
      writeProfileFile(outputPath, raceId, raceName, result.text, result.promptHash);
      appendStatus(statusPath, {
        timestamp: new Date().toISOString(),
        raceId,
        raceName,
        outputPath: path.relative(ROOT, outputPath).replace(/\\/g, "/"),
        success: true,
        attempts: result.attempts,
        responseChars: result.text.length,
        sourceUrlCount: result.sourceUrlCount,
        promptHash: result.promptHash,
        message: "OK",
      });
      successCount += 1;
      console.log(`[ok] ${raceId} -> ${path.relative(ROOT, outputPath).replace(/\\/g, "/")}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      appendStatus(statusPath, {
        timestamp: new Date().toISOString(),
        raceId,
        raceName,
        outputPath: path.relative(ROOT, outputPath).replace(/\\/g, "/"),
        success: false,
        attempts: maxAttempts,
        responseChars: 0,
        sourceUrlCount: 0,
        promptHash: "error",
        message,
      });
      failCount += 1;
      console.error(`[fail] ${raceId}: ${message}`);
    }
  }

  console.log(`done success=${successCount} failed=${failCount} total=${selected.length}`);
}

void main();
